import { COST_PER_COPY_USD, isRunActive, type AiCorrectionRun } from './aiCorrection';

/**
 * Correction en lot avec Claude (hub Évaluations, phase 5).
 *
 * Une file tenue par le navigateur : elle lance la même Edge Function que le bouton
 * « Corriger » d'un élève (corriger-copie), deux copies à la fois, et suit chaque appel dans
 * le journal assessment_ai_corrections. Pas de table de plus : si la page se ferme, les
 * corrections déjà lancées vont au bout côté serveur, et relancer le lot reprend simplement
 * les copies qui n'ont toujours pas de note.
 */

/** Copies corrigées en même temps : assez pour aller deux fois plus vite, pas assez pour saturer l'API. */
export const BATCH_CONCURRENCY = 2;

export interface BatchRow {
  student: { id: string; pseudo: string };
  pages: unknown[];
  grade: { grade: number | null; status?: string | null } | null;
}

/** Copies à corriger : scannées, sans note ni statut (absent, dispensé…), sans correction en cours. */
export function batchCandidates(
  rows: readonly BatchRow[],
  runs: Readonly<Record<string, AiCorrectionRun | undefined>>,
  now = Date.now(),
): { id: string; pseudo: string }[] {
  return rows
    .filter((r) => r.pages.length > 0)
    .filter((r) => r.grade == null || (r.grade.grade == null && (r.grade.status ?? 'noted') === 'noted'))
    .filter((r) => !isRunActive(runs[r.student.id], now))
    .map((r) => r.student);
}

/** Coût indicatif d'un lot, annoncé avant de lancer. */
export function estimateBatchCost(count: number): string {
  return `≈ ${(count * COST_PER_COPY_USD).toFixed(2).replace('.', ',')} $`;
}

/** Une erreur qui touchera toutes les copies suivantes : inutile de continuer le lot. */
export function isFatalRunError(message: string | null | undefined): boolean {
  return !!message && /Clé API|clé API|Limite de l'API|crédits/i.test(message);
}

/** Codes de refus au démarrage qui valent pour toute la classe (et pas pour un seul élève). */
export const FATAL_START_CODES = new Set(['no_api_key', 'unauthorized', 'no_kit', 'not_found']);

export interface BatchFailure {
  studentId: string;
  pseudo: string;
  message: string;
}

export interface BatchState {
  total: number;
  /** Élèves pas encore lancés, dans l'ordre. */
  pending: { id: string; pseudo: string }[];
  /** Élève → appel lancé (id dans assessment_ai_corrections). */
  started: Record<string, string>;
  /** Refus au démarrage (version du sujet inconnue, etc.). */
  failed: BatchFailure[];
  /** Plus rien ne se lance ; les appels en cours vont au bout. */
  stopping: boolean;
  /** Raison de l'arrêt, s'il n'a pas été demandé. */
  stopReason: string | null;
}

export function newBatch(students: { id: string; pseudo: string }[]): BatchState {
  return { total: students.length, pending: students, started: {}, failed: [], stopping: false, stopReason: null };
}

export interface BatchProgress {
  done: number;
  running: number;
  errors: BatchFailure[];
  /** Plus rien en cours ni à lancer. */
  finished: boolean;
}

/** Où en est le lot, d'après le journal des appels. */
export function batchProgress(
  batch: BatchState,
  runs: Readonly<Record<string, AiCorrectionRun | undefined>>,
  pseudoOf: (studentId: string) => string,
  now = Date.now(),
): BatchProgress {
  let done = 0;
  let running = 0;
  const errors: BatchFailure[] = [...batch.failed];
  for (const [studentId, runId] of Object.entries(batch.started)) {
    const run = runs[studentId];
    // Appel pas encore relu : on le compte en cours.
    if (!run || run.id !== runId || isRunActive(run, now)) running += 1;
    else if (run.status === 'done') done += 1;
    else errors.push({ studentId, pseudo: pseudoOf(studentId), message: run.error ?? 'Correction interrompue' });
  }
  const pendingLeft = batch.stopping ? 0 : batch.pending.length;
  return { done, running, errors, finished: running === 0 && pendingLeft === 0 };
}

/** Peut-on lancer la copie suivante ? */
export function canLaunchNext(batch: BatchState, progress: BatchProgress): boolean {
  return !batch.stopping && batch.pending.length > 0 && progress.running < BATCH_CONCURRENCY;
}
