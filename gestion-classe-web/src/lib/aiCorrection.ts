/**
 * Bouton « Corriger » / « Recorriger » de « Voir les copies » (migration 057, Edge Function
 * corriger-copie) : quel bouton montrer, état d'un appel, messages. Les calculs de la correction
 * vivent dans supabase/functions/corriger-copie/correction.ts.
 */

import { mentionsOtherVersion } from '../../../supabase/functions/corriger-copie/correction.ts';

export { mentionsOtherVersion };

export type AiCorrectionMode = 'corriger' | 'recorriger';

export interface AiArbitrage {
  question: string;
  note_mise: number;
  raison: string;
}

/** Une ligne de assessment_ai_corrections (journal d'un appel). */
export interface AiCorrectionRun {
  id: string;
  assessment_id: string;
  student_id: string;
  mode: AiCorrectionMode;
  status: 'running' | 'done' | 'error';
  error: string | null;
  model: string | null;
  attempts: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
  cost_usd: number | null;
  grade: number | null;
  a_arbitrer: AiArbitrage[];
  started_at: string;
  finished_at: string | null;
}

/** Au-delà, un appel encore « en cours » a été interrompu (limite d'exécution de la fonction). */
export const RUN_STALE_MS = 10 * 60_000;

/** Coût indicatif d'une copie, annoncé avant l'appel. */
export const COST_HINT = '≈ 0,30 $';

export const NO_KIT_MESSAGE = 'Corrige d’abord la classe dans le Correcteur';

/** Bouton à proposer : Corriger une copie scannée sans note, Recorriger une copie notée. */
export function correctionMode(row: { pages: number; grade: { grade: number | null } | null }): AiCorrectionMode | null {
  if (row.pages === 0) return null;
  return row.grade?.grade != null ? 'recorriger' : 'corriger';
}

export function isRunActive(run: AiCorrectionRun | null | undefined, now = Date.now()): boolean {
  return !!run && run.status === 'running' && now - new Date(run.started_at).getTime() < RUN_STALE_MS;
}

export function isRunInterrupted(run: AiCorrectionRun | null | undefined, now = Date.now()): boolean {
  return !!run && run.status === 'running' && !isRunActive(run, now);
}

/** Dernier appel par élève. */
export function latestRunByStudent(runs: AiCorrectionRun[]): Record<string, AiCorrectionRun> {
  const out: Record<string, AiCorrectionRun> = {};
  for (const r of runs) {
    const cur = out[r.student_id];
    if (!cur || r.started_at > cur.started_at) out[r.student_id] = r;
  }
  return out;
}

/** La note affichée vient-elle de l'API (et pas d'un envoi du Correcteur fait depuis) ? */
export function isApiGrade(details: unknown): boolean {
  return typeof details === 'object' && details !== null && (details as { source?: unknown }).source === 'api';
}

const START_ERRORS: Record<string, string> = {
  no_kit: NO_KIT_MESSAGE + ' (kit envoyé avec push_grades.py --kit).',
  no_pages: 'Pas de page scannée pour cet élève.',
  no_api_key: 'Clé API Anthropic absente : pose le secret ANTHROPIC_API_KEY dans Supabase.',
  already_graded: 'Cet élève a déjà une note : utilise « Recorriger ».',
  not_graded: 'Cet élève n’a pas encore de note : utilise « Corriger ».',
  needs_confirmation: 'La note est validée : confirme la recorrection.',
  already_running: 'Une correction est déjà en cours pour cet élève.',
  version_unknown: 'Cette éval a un kit par version du sujet : indique la version de la copie (« Ajouter une copie ») avant de corriger.',
  no_kit_for_version: 'Pas de kit pour la version du sujet de cette copie : envoie-le depuis le Correcteur (push_grades.py --kit).',
  kit_version_unsure: 'Le kit n’indique pas sa version du sujet et cette copie a une version à elle : envoie un kit par version depuis le Correcteur.',
  not_found: 'Évaluation introuvable.',
  unauthorized: 'Session expirée : reconnecte-toi.',
};

export function describeStartError(code: string, info?: { versions?: string[]; student_version?: string | null }): string {
  const base = START_ERRORS[code] ?? `Correction impossible (${code}).`;
  if (!info || !['version_unknown', 'no_kit_for_version', 'kit_version_unsure'].includes(code)) return base;
  const copy = info.student_version ? ` Copie : ${info.student_version}.` : '';
  const kits = info.versions?.length ? ` Kits : ${info.versions.join(', ')}.` : '';
  return base + copy + kits;
}

export function formatCost(usd: number | null): string {
  return usd == null ? '—' : `${usd.toFixed(2).replace('.', ',')} $`;
}
