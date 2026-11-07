import {
  formatCost,
  isRunActive,
  isRunInterrupted,
  mentionsOtherVersion,
  type AiCorrectionRun,
} from '../lib/aiCorrection';

/** État du dernier appel « Corriger » de l'élève : en cours, erreur, ou points à arbitrer et coût. */
export function AiRunPanel({ run, apiGrade }: { run: AiCorrectionRun | undefined; apiGrade: boolean }) {
  if (!run) return null;
  const box: React.CSSProperties = { borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 13 };
  const when = new Date(run.finished_at ?? run.started_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const cost = run.cost_usd != null ? ` · coût estimé ${formatCost(run.cost_usd)}` : '';
  if (isRunActive(run)) {
    return (
      <div style={{ ...box, background: 'var(--indigo-soft)', color: 'var(--indigo)', fontWeight: 600 }}>
        Correction en cours par Claude… (1 à 2 minutes, tu peux changer d’élève)
      </div>
    );
  }
  if (isRunInterrupted(run) || run.status === 'error') {
    return (
      <div style={{ ...box, background: 'var(--neg-soft)', color: 'var(--neg)' }}>
        <strong>Correction automatique échouée</strong> ({when}{cost}) :{' '}
        {run.error ?? 'appel interrompu (délai dépassé). Rien n’a été enregistré ; tu peux relancer.'}
      </div>
    );
  }
  // Une note renvoyée depuis par le Correcteur remplace celle de l'API : le journal n'est plus d'actualité.
  if (!apiGrade) return null;
  const otherVersion = mentionsOtherVersion(run.a_arbitrer);
  return (
    <>
    {otherVersion && (
      <div style={{ ...box, background: 'var(--neg-soft)', color: 'var(--neg)', fontWeight: 600 }}>
        ⚠ Claude signale que cette copie semble faite sur une autre version du sujet : la note a pu être
        calculée sur le mauvais barème. Vérifie la version (« Ajouter une copie ») et recorrige avant de valider.
      </div>
    )}
    <div style={{ ...box, background: run.a_arbitrer.length ? 'var(--warn-soft)' : 'var(--surface-3)', border: '1px solid var(--border)' }}>
      {run.a_arbitrer.length > 0 ? (
        <>
          <div style={{ fontWeight: 700, color: 'var(--warn)', marginBottom: 6 }}>
            ⚑ À arbitrer ({run.a_arbitrer.length}) : vérifie avant de valider
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text)' }}>
            {run.a_arbitrer.map((a, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                <strong>{a.question}</strong> · note mise {String(a.note_mise).replace('.', ',')} — {a.raison}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)' }}>Claude ne signale rien à arbitrer.</div>
      )}
      {run.error && <div style={{ color: 'var(--neg)', marginTop: 6 }}>{run.error}</div>}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
        Corrigée par Claude ({run.model ?? '?'}) le {when}
        {cost}
        {run.input_tokens != null &&
          ` · ${((run.input_tokens + (run.cache_creation_tokens ?? 0) + (run.cache_read_tokens ?? 0)) / 1000).toFixed(0)} k tokens lus, ${((run.output_tokens ?? 0) / 1000).toFixed(1).replace('.', ',')} k écrits`}
        {run.attempts > 1 && ` · ${run.attempts} essais`}
      </div>
    </div>
    </>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'neg' | 'info' }) {
  const colors = {
    neutral: ['var(--surface-3)', 'var(--text-muted)'],
    ok: ['var(--pos-soft)', 'var(--pos)'],
    warn: ['var(--warn-soft)', 'var(--warn)'],
    neg: ['var(--neg-soft)', 'var(--neg)'],
    info: ['var(--indigo-soft)', 'var(--indigo)'],
  }[tone];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: colors[0], color: colors[1], whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
