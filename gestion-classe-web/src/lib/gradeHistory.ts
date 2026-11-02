import { STATUS_LABEL, toTwenty, type GradeStatus } from './gradeStats';

/**
 * Historique des corrections d'une note (migration 061) : qui a écrit une version, et ce qu'elle
 * disait. Même règle que le trigger `assessment_grades_archive` pour l'auteur. Logique pure, testée.
 */

export type GradeSource = 'prof' | 'ia' | 'correcteur';

export const SOURCE_LABEL: Record<GradeSource, string> = {
  prof: 'Saisie du prof',
  ia: 'Claude (« Corriger avec Claude »)',
  correcteur: 'Correcteur (PC)',
};

/** Auteur d'une version d'après son détail : details.source = 'api' → Claude ; autre détail → Correcteur ; rien → prof. */
export function gradeSource(details: unknown): GradeSource {
  if (details && typeof details === 'object') {
    return (details as { source?: unknown }).source === 'api' ? 'ia' : 'correcteur';
  }
  return 'prof';
}

const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

/** « 14,5/28 (10,36/20) », « 12/20 », « Absent », « Sans note ». */
export function describeGradeValue(
  v: { status: string | null; grade: number | null; grade_raw: number | null },
  baremeTotal: number | null | undefined,
): string {
  if (v.status && v.status !== 'noted') return STATUS_LABEL[v.status as GradeStatus] ?? v.status;
  const bareme = Number(baremeTotal ?? 20) || 20;
  const raw = v.grade_raw != null ? Number(v.grade_raw) : null;
  const twenty = v.grade != null ? Number(v.grade) : raw != null ? toTwenty(raw, bareme) : null;
  if (raw == null && twenty == null) return 'Sans note';
  if (raw != null && bareme !== 20) return `${num(raw)}/${num(bareme)}${twenty != null ? ` (${num(twenty)}/20)` : ''}`;
  return `${num(twenty ?? raw ?? 0)}/20`;
}

/** « 02/11 à 14:32 » */
export function formatVersionDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}
