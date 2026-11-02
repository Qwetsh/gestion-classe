import type { GradeStatus } from './gradeStats';

/**
 * Colonne de notes « prête pour Pronote » (hub Évaluations, phase 4).
 *
 * Dans Pronote, la saisie d'un devoir accepte qu'on colle une colonne : une valeur par ligne,
 * dans l'ordre de sa liste, c'est-à-dire l'ordre alphabétique des NOMS. L'app ne connaît que
 * le pseudo « Prénom XX. » (prénom + 2 premières lettres du nom, cf. pseudoKey) : on trie sur
 * ces deux lettres puis sur le prénom. Deux élèves dont le nom commence pareil peuvent donc
 * être inversés : on les signale pour vérification plutôt que de prétendre à l'exactitude.
 *
 * Valeurs : la note brute sur le barème du devoir (virgule décimale), ou le code Pronote du
 * statut (Abs, Disp, N.Rdu, N.Rdu0). Une ligne vide garde l'alignement d'un élève sans note.
 */

export interface PronoteColumnStudent {
  id: string;
  pseudo: string;
}

export interface PronoteColumnGrade {
  student_id: string;
  grade: number | null;
  grade_raw: number | null;
  status: GradeStatus | string | null;
  is_validated?: boolean | null;
}

export interface PronoteColumnRow {
  studentId: string;
  pseudo: string;
  /** Ce qui sera collé dans Pronote pour cet élève (chaîne vide : pas de note). */
  cell: string;
  /** Note encore en brouillon (Correcteur ou Claude), pas validée par le prof. */
  draft: boolean;
  /** Même début de nom qu'un voisin : l'ordre entre eux est deviné sur le prénom. */
  orderToCheck: boolean;
}

/** « Alisia ZH. » → { first: 'Alisia', initials: 'ZH' } ; sans initiales reconnaissables, initials vide. */
export function splitPseudo(pseudo: string): { first: string; initials: string } {
  const m = pseudo.trim().match(/^(.*\S)\s+([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ'’-]{0,2})\.?$/u);
  if (!m) return { first: pseudo.trim(), initials: '' };
  return { first: m[1], initials: m[2] };
}

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/** Ordre « à la Pronote » : début du nom, puis prénom. */
export function comparePronoteOrder(a: string, b: string): number {
  const x = splitPseudo(a);
  const y = splitPseudo(b);
  return collator.compare(x.initials, y.initials) || collator.compare(x.first, y.first);
}

const STATUS_CODE: Partial<Record<string, string>> = {
  absent: 'Abs',
  dispense: 'Disp',
  non_rendu: 'N.Rdu',
  non_rendu_zero: 'N.Rdu0',
};

function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Valeur Pronote d'une note : brute sur le barème du devoir, ou code de statut. */
export function pronoteCell(g: PronoteColumnGrade | undefined, bareme: number): string {
  if (!g) return '';
  const status = g.status ?? 'noted';
  if (status !== 'noted') return STATUS_CODE[status] ?? '';
  if (g.grade_raw !== null && g.grade_raw !== undefined) return formatNumber(Number(g.grade_raw));
  if (g.grade !== null && g.grade !== undefined) return formatNumber((Number(g.grade) * bareme) / 20);
  return '';
}

export function buildPronoteColumn(
  students: readonly PronoteColumnStudent[],
  grades: readonly PronoteColumnGrade[],
  bareme: number,
): PronoteColumnRow[] {
  const byStudent = new Map(grades.map((g) => [g.student_id, g]));
  const sorted = [...students].sort((a, b) => comparePronoteOrder(a.pseudo, b.pseudo));
  const initials = sorted.map((s) => splitPseudo(s.pseudo).initials || null);
  return sorted.map((s, i) => {
    const g = byStudent.get(s.id);
    const cell = pronoteCell(g, bareme);
    const mine = initials[i];
    const same = (j: number) => j >= 0 && j < sorted.length && mine !== null && initials[j] !== null
      && collator.compare(initials[j]!, mine) === 0;
    return {
      studentId: s.id,
      pseudo: s.pseudo,
      cell,
      draft: !!g && cell !== '' && g.is_validated === false,
      orderToCheck: mine === null || same(i - 1) || same(i + 1),
    };
  });
}

/** Le texte à coller : une valeur par ligne. */
export function pronoteColumnText(rows: readonly PronoteColumnRow[]): string {
  return rows.map((r) => r.cell).join('\n');
}
