import type { GradeStatus } from './gradeStats';

/**
 * Lecture d'un export de notes Pronote (CSV « Notes d'une classe »).
 *
 * Structure observée :
 *   ;;;01/10                      ← date de chaque évaluation (colonnes d'évaluation seulement)
 *   29 élèves;Moyenne;N.R.;       ← libellés ; « Moyenne » et « N.R. » sont des colonnes de synthèse
 *   ;;;1-/10                      ← coefficient puis « -/ » puis barème
 *   "BACHARI Amina";"14,00";"";"7,00"
 *   …
 *   "Moyenne de la classe :";…    ← ligne de synthèse, ignorée
 *
 * La colonne « Moyenne » est ramenée sur 20 : elle ne doit jamais être prise pour une note.
 * Le nom de l'évaluation n'est pas dans le fichier (seulement la matière, dans le nom du
 * fichier) : l'appelant propose un nom par défaut que l'enseignant corrige.
 */

export interface PronoteEval {
  /** Index de colonne dans le CSV. */
  col: number;
  /** Libellé de l'en-tête s'il y en a un, sinon chaîne vide. */
  label: string;
  /** Date telle qu'exportée (« 01/10 » ou « 01/10/2026 »), vide si absente. */
  rawDate: string;
  bareme: number;
  coefficient: number;
}

export interface PronoteGrade {
  status: GradeStatus;
  /** Note brute sur le barème de l'évaluation ; `null` pour un statut ou une cellule vide. */
  raw: number | null;
}

export interface PronoteStudentRow {
  /** Nom tel qu'écrit dans le fichier (« BACHARI Amina »). */
  fullName: string;
  firstName: string;
  lastName: string;
  /** Une entrée par évaluation de `evals`, dans le même ordre ; `null` = cellule vide. */
  grades: (PronoteGrade | null)[];
  /** Valeurs non reconnues (colonne → texte), pour les signaler plutôt que les avaler. */
  unknown: { col: number; text: string }[];
}

export interface PronoteExport {
  evals: PronoteEval[];
  students: PronoteStudentRow[];
}

/** Décode le fichier : UTF-8 d'abord, Windows-1252 si le texte n'est pas de l'UTF-8 valide. */
export function decodeCsvBytes(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Découpe un CSV à point-virgule, guillemets doublés acceptés, retours à la ligne dans une cellule inclus. */
function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

const num = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** « BACHARI Amina », « NGUYEN VAN Kalissa » : le nom de famille est la tête en capitales. */
export function splitPronoteName(full: string): { lastName: string; firstName: string } {
  const tokens = full.trim().split(/\s+/);
  const isUpper = (t: string) => t === t.toLocaleUpperCase('fr') && t !== t.toLocaleLowerCase('fr');
  let i = 0;
  // Au moins un mot reste pour le prénom.
  while (i < tokens.length - 1 && isUpper(tokens[i])) i++;
  if (i === 0) i = 1; // pas de capitales repérables : on suppose « NOM Prénom » quand même
  return { lastName: tokens.slice(0, i).join(' '), firstName: tokens.slice(i).join(' ') };
}

/** Statut Pronote → statut du carnet. `undefined` si le texte n'est pas reconnu. */
function statusFromText(text: string): GradeStatus | undefined {
  const t = text.trim().toLowerCase().replace(/[.\s]/g, '');
  if (t.startsWith('abs')) return 'absent';
  if (t.startsWith('disp')) return 'dispense';
  if (t === 'nn' || t === 'nnot' || t === 'nr' || t.startsWith('nonrendu') || t.startsWith('nonnot')) return 'non_rendu';
  return undefined;
}

export function parsePronoteCsv(text: string): PronoteExport {
  const rows = splitCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length < 3) throw new Error('Fichier trop court : ce n’est pas un export de notes Pronote.');

  // Les trois lignes d'en-tête : la dernière contient les « coef-/barème ». Une date
  // (« 01/10 ») ressemble à un barème (« 1/10 ») : on retient la première ligne sans
  // nom d'élève après la première, ce qui écarte la ligne des dates.
  const baremeRowIdx = rows.findIndex(
    (r, i) => i >= 1 && i < 6 && (r[0] ?? '').trim() === '' && r.slice(1).some((c) => /\/\s*\d/.test(c)),
  );
  if (baremeRowIdx < 0) throw new Error('Barèmes introuvables : ce n’est pas un export de notes Pronote.');
  const baremeRow = rows[baremeRowIdx];
  const labelRow = rows[baremeRowIdx - 1] ?? [];
  const dateRow = rows[baremeRowIdx - 2] ?? [];

  const evals: PronoteEval[] = [];
  for (let col = 1; col < baremeRow.length; col++) {
    const m = /^\s*([\d.,]*)\s*-?\s*\/\s*(\d+(?:[.,]\d+)?)/.exec(baremeRow[col] ?? '');
    if (!m) continue;
    const bareme = num(m[2]);
    if (!bareme || bareme <= 0) continue;
    evals.push({
      col,
      label: (labelRow[col] ?? '').trim(),
      rawDate: (dateRow[col] ?? '').trim(),
      bareme,
      coefficient: num(m[1]) ?? 1,
    });
  }
  if (evals.length === 0) throw new Error('Aucune évaluation trouvée dans ce fichier.');

  const students: PronoteStudentRow[] = [];
  for (const r of rows.slice(baremeRowIdx + 1)) {
    const name = (r[0] ?? '').trim();
    if (!name || /^moyenne/i.test(name)) continue;
    const { lastName, firstName } = splitPronoteName(name);
    const unknown: { col: number; text: string }[] = [];
    const grades = evals.map((ev): PronoteGrade | null => {
      const cell = (r[ev.col] ?? '').trim();
      if (cell === '') return null;
      const n = num(cell);
      if (n !== null) return { status: 'noted', raw: n };
      const status = statusFromText(cell);
      if (status) return { status, raw: null };
      unknown.push({ col: ev.col, text: cell });
      return null;
    });
    students.push({ fullName: name, firstName, lastName, grades, unknown });
  }
  return { evals, students };
}

// ============================================================
// Rapprochement avec les élèves du carnet
// ============================================================

/** Minuscules, sans accents ni ponctuation : « Kaïs R. » et « KAIS R » se valent. */
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Même règle que `generatePseudo` (pages/Classes.tsx) : prénom + 2 premières lettres du nom. */
export function pseudoKey(firstName: string, lastName: string): string {
  return fold(`${firstName} ${lastName.trim().substring(0, 2)}`);
}

export interface StudentMatch {
  row: PronoteStudentRow;
  /** `null` : aucun élève du carnet ne correspond. */
  studentId: string | null;
  /** Plusieurs élèves du carnet portent le même pseudo : on ne devine pas. */
  ambiguous: boolean;
}

export function matchStudents(
  rows: readonly PronoteStudentRow[],
  students: readonly { id: string; pseudo: string }[],
): StudentMatch[] {
  const byKey = new Map<string, string[]>();
  for (const s of students) {
    const k = fold(s.pseudo);
    byKey.set(k, [...(byKey.get(k) ?? []), s.id]);
  }
  return rows.map((row) => {
    const ids = byKey.get(pseudoKey(row.firstName, row.lastName)) ?? [];
    return { row, studentId: ids.length === 1 ? ids[0] : null, ambiguous: ids.length > 1 };
  });
}

/** « 01/10 » + année scolaire « 2026-2027 » → « 2026-10-01 ». `null` si illisible. */
export function isoDateFromPronote(rawDate: string, schoolYear: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(rawDate.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year: number;
  if (m[3]) year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
  else {
    const start = Number(schoolYear.slice(0, 4));
    if (!Number.isFinite(start)) return null;
    year = month >= 8 ? start : start + 1;
  }
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
