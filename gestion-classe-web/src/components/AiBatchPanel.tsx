import { useCallback, useMemo } from 'react';
import { useAiBatch } from '../hooks/useAiBatch';
import { batchCandidates, BATCH_CONCURRENCY, estimateBatchCost, type BatchRow } from '../lib/aiBatch';
import type { AiCorrectionRun } from '../lib/aiCorrection';

/**
 * « Corriger avec Claude » pour toute la classe (hub Évaluations, phase 5) : le bouton, puis
 * l'avancement du lot (corrigées, en cours, erreurs) et « Arrêter ». Les notes arrivent en
 * brouillon, comme pour une copie seule : « Valider la classe » sur la ligne de la fiche.
 */
export function AiBatchPanel({
  assessmentId,
  rows,
  aiRuns,
  hasKit,
  trackRun,
}: {
  assessmentId: string;
  rows: (BatchRow & { student: { id: string; pseudo: string } })[];
  aiRuns: Record<string, AiCorrectionRun>;
  hasKit: boolean;
  trackRun: (run: AiCorrectionRun) => void;
}) {
  const pseudos = useMemo(() => new Map(rows.map((r) => [r.student.id, r.student.pseudo])), [rows]);
  const pseudoOf = useCallback((id: string) => pseudos.get(id) ?? 'Élève', [pseudos]);
  const { batch, progress, start, stop, dismiss } = useAiBatch(assessmentId, aiRuns, trackRun, pseudoOf);
  const candidates = useMemo(() => batchCandidates(rows, aiRuns), [rows, aiRuns]);

  if (!batch || !progress) {
    if (!hasKit || candidates.length < 2) return null;
    const n = candidates.length;
    const minutes = Math.max(1, Math.round((n * 1.5) / BATCH_CONCURRENCY));
    const launch = () => {
      const ok = window.confirm(
        `Corriger avec Claude les ${n} copies scannées sans note (${estimateBatchCost(n)} de crédits API) ?\n\n`
          + `Les notes arrivent en brouillon : tu les relis et tu les valides ensuite.\n`
          + `Compte environ ${minutes} min. Garde cette page ouverte : si tu la fermes, les copies en cours finissent, `
          + 'et relancer reprend les copies restantes.',
      );
      if (ok) start(candidates);
    };
    return (
      <button
        onClick={launch}
        style={{ ...btn, width: '100%', marginBottom: 8, background: 'var(--indigo-soft)', color: 'var(--indigo)', borderColor: 'var(--indigo)' }}
        title="Toutes les copies scannées qui n’ont pas encore de note, deux à la fois"
      >
        Corriger avec Claude ({n} copies)
      </button>
    );
  }

  const handled = progress.done + progress.errors.length;
  const pct = batch.total > 0 ? Math.round((handled / batch.total) * 100) : 100;
  return (
    <div style={{ border: '1px solid var(--indigo)', borderRadius: 10, padding: 10, marginBottom: 8, background: 'var(--indigo-soft)', fontSize: 12.5 }} role="status">
      <div style={{ fontWeight: 700, color: 'var(--indigo)', marginBottom: 6 }}>
        {progress.finished ? 'Correction en lot terminée' : batch.stopping ? 'Arrêt après les copies en cours…' : 'Correction en lot…'}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'var(--surface)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--indigo)', transition: 'width .4s' }} />
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {progress.done}/{batch.total} corrigée{progress.done > 1 ? 's' : ''}
        {progress.running > 0 && ` · ${progress.running} en cours`}
        {progress.errors.length > 0 && <span style={{ color: 'var(--neg)' }}> · {progress.errors.length} erreur{progress.errors.length > 1 ? 's' : ''}</span>}
        {batch.stopping && batch.pending.length > 0 && ` · ${batch.pending.length} non lancée${batch.pending.length > 1 ? 's' : ''}`}
      </div>
      {batch.stopReason && <div style={{ color: 'var(--neg)', marginTop: 4 }}>{batch.stopReason}</div>}
      {progress.errors.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--neg)' }}>Voir les erreurs</summary>
          <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'var(--text-muted)' }}>
            {progress.errors.map((e) => <li key={e.studentId}><strong>{e.pseudo}</strong> : {e.message}</li>)}
          </ul>
        </details>
      )}
      {progress.finished && progress.done > 0 && (
        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Les notes sont en brouillon : relis-les, puis « Valider la classe ».</div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {!progress.finished && !batch.stopping && <button onClick={stop} style={btn}>Arrêter</button>}
        {progress.finished && <button onClick={dismiss} style={btn}>Fermer</button>}
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--border)', background: 'var(--surface-3)', color: 'var(--text)', fontFamily: 'inherit',
};
