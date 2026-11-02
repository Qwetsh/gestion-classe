import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeStartError, type AiCorrectionRun } from '../lib/aiCorrection';
import {
  batchProgress,
  canLaunchNext,
  FATAL_START_CODES,
  isFatalRunError,
  newBatch,
  type BatchProgress,
  type BatchState,
} from '../lib/aiBatch';
import { AiCorrectionStartError, fetchAiCorrection, startAiCorrection } from '../lib/evaluationQueries';

/**
 * File de correction en lot (lib/aiBatch.ts) : lance les copies une par une, au plus
 * BATCH_CONCURRENCY à la fois, et s'appuie sur le suivi des appels de useAssessmentCopies
 * (`aiRuns`, relus toutes les 4 s ; `trackRun` pour y ajouter un appel lancé ici).
 */
export function useAiBatch(
  assessmentId: string,
  aiRuns: Record<string, AiCorrectionRun>,
  trackRun: (run: AiCorrectionRun) => void,
  pseudoOf: (studentId: string) => string,
) {
  const [batch, setBatch] = useState<BatchState | null>(null);
  // Une seule mise en route à la fois : le lancement est asynchrone (appel de la fonction).
  const launching = useRef(false);
  const [launchTick, setLaunchTick] = useState(0);

  // Changer d'éval abandonne le lot affiché (les appels déjà lancés vont au bout côté serveur).
  const [batchFor, setBatchFor] = useState(assessmentId);
  if (batchFor !== assessmentId) {
    setBatchFor(assessmentId);
    setBatch(null);
  }

  const progress: BatchProgress | null = useMemo(
    () => (batch ? batchProgress(batch, aiRuns, pseudoOf) : null),
    [batch, aiRuns, pseudoOf],
  );

  // Une erreur qui vaut pour toutes les copies (clé API, crédits) arrête le lot.
  const fatalError = progress?.errors.find((e) => isFatalRunError(e.message))?.message ?? null;

  useEffect(() => {
    if (!batch || !progress || launching.current) return;
    if (fatalError && !batch.stopping) {
      // Différé : pas de mise à jour d'état synchrone dans l'effet.
      const t = window.setTimeout(() => setBatch((b) => (b ? { ...b, stopping: true, stopReason: fatalError } : b)), 0);
      return () => window.clearTimeout(t);
    }
    if (!canLaunchNext(batch, progress)) return;
    const next = batch.pending[0];
    launching.current = true;
    startAiCorrection({ assessmentId, studentId: next.id, mode: 'corriger' })
      .then(async (runId) => {
        setBatch((b) => (b ? { ...b, pending: b.pending.slice(1), started: { ...b.started, [next.id]: runId } } : b));
        const run = await fetchAiCorrection(runId).catch(() => null);
        if (run) trackRun(run);
      })
      .catch((e: unknown) => {
        const code = e instanceof AiCorrectionStartError ? e.code : 'unknown';
        const message = e instanceof AiCorrectionStartError
          ? describeStartError(e.code, e.info)
          : e instanceof Error ? e.message : 'Correction impossible';
        const fatal = FATAL_START_CODES.has(code);
        setBatch((b) => (b ? {
          ...b,
          pending: b.pending.slice(1),
          failed: [...b.failed, { studentId: next.id, pseudo: next.pseudo, message }],
          stopping: b.stopping || fatal,
          stopReason: fatal ? message : b.stopReason,
        } : b));
      })
      .finally(() => {
        launching.current = false;
        setLaunchTick((t) => t + 1);
      });
  }, [batch, progress, fatalError, assessmentId, trackRun, launchTick]);

  const start = useCallback((students: { id: string; pseudo: string }[]) => {
    if (students.length > 0) setBatch(newBatch(students));
  }, []);
  const stop = useCallback(() => setBatch((b) => (b ? { ...b, stopping: true } : b)), []);
  const dismiss = useCallback(() => setBatch(null), []);

  return { batch, progress, start, stop, dismiss };
}
