/**
 * Détail d'une correction (assessment_grades.details, format v1) : écrit par le Correcteur
 * (generer_correction.py → push_grades.py), lu par le prof (validation) et par l'élève
 * (une fois la note validée et l'éval publiée — migration 053).
 *
 * Le JSON vient d'un script et d'une base : on le lit défensivement, un champ manquant ou
 * mal formé ne doit jamais casser l'affichage d'une note.
 */

export const COMPETENCE_LEVELS = ['Insuffisante', 'Fragile', 'Satisfaisante', 'Très bonne maîtrise'] as const;
export type CompetenceLevel = (typeof COMPETENCE_LEVELS)[number];

export interface DetailQuestion {
  label: string;
  bareme: number;
  points: number;
  commentaire: string;
  competences: string[];
}

export interface DetailCompetence {
  nom: string;
  niveau: CompetenceLevel | null;
}

export interface GradeDetails {
  version: string | null;
  baremeTotal: number | null;
  noteBrute: number | null;
  noteForcee: boolean;
  questions: DetailQuestion[];
  competences: DetailCompetence[];
  forces: string;
  faiblesses: string;
  commentaire: string;
}

function num(x: unknown): number | null {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
}

function str(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function level(x: unknown): CompetenceLevel | null {
  const s = str(x).toLowerCase();
  return COMPETENCE_LEVELS.find((l) => l.toLowerCase() === s) ?? null;
}

/** Lit un `details` brut ; `null` s'il n'y a rien d'exploitable. */
export function parseGradeDetails(raw: unknown): GradeDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const questions: DetailQuestion[] = Array.isArray(d.questions)
    ? d.questions
        .filter((q): q is Record<string, unknown> => !!q && typeof q === 'object')
        .map((q) => ({
          label: str(q.label) || '—',
          bareme: num(q.bareme) ?? 0,
          points: num(q.points) ?? 0,
          commentaire: str(q.commentaire),
          competences: Array.isArray(q.competences) ? q.competences.map(str).filter(Boolean) : [],
        }))
    : [];
  const competences: DetailCompetence[] = Array.isArray(d.competences)
    ? d.competences
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && !!str(c.nom))
        .map((c) => ({ nom: str(c.nom), niveau: level(c.niveau) }))
    : [];
  const out: GradeDetails = {
    version: str(d.version) || null,
    baremeTotal: num(d.bareme_total),
    noteBrute: num(d.note_brute),
    noteForcee: d.note_forcee === true,
    questions,
    competences,
    forces: str(d.forces),
    faiblesses: str(d.faiblesses),
    commentaire: str(d.commentaire),
  };
  const empty = questions.length === 0 && competences.length === 0 && !out.forces && !out.faiblesses && !out.commentaire;
  return empty ? null : out;
}

/** Valeur d'un niveau sur l'axe du radar : 1 (Insuffisante) à 4 (Très bonne maîtrise), 0 si inconnu. */
export function levelScore(niveau: CompetenceLevel | null): number {
  return niveau ? COMPETENCE_LEVELS.indexOf(niveau) + 1 : 0;
}

/** Taux de réussite d'une question (0 à 1), pour colorer la ligne. */
export function questionRate(q: DetailQuestion): number {
  return q.bareme > 0 ? Math.max(0, Math.min(1, q.points / q.bareme)) : 0;
}
