import { questionRate } from '../lib/gradeDetails';
import type { TranscriptBlock } from '../lib/copyTranscript';

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ',');
}

function rateColor(r: number): string {
  return r >= 0.75 ? 'var(--pos)' : r >= 0.5 ? 'var(--warn)' : 'var(--neg)';
}

/**
 * Copie transcrite par le Correcteur, passage par passage, avec en face les points et le
 * commentaire de chaque question du barème. Écran du prof seulement : la transcription n'est
 * jamais montrée à l'élève (migration 056).
 */
export function CopyTranscriptView({ blocks }: { blocks: TranscriptBlock[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {blocks.map((b, i) => {
        const bareme = b.questions.reduce((n, q) => n + q.bareme, 0);
        const points = b.questions.reduce((n, q) => n + q.points, 0);
        const several = b.questions.length > 1;
        return (
          <div key={`${b.q}-${i}`} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
                {b.q}
                {!several && b.questions[0] && b.questions[0].label !== b.q && (
                  <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> · {b.questions[0].label}</span>
                )}
              </span>
              {bareme > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, color: rateColor(points / bareme) }}>
                  {fmt(points)}/{fmt(bareme)}
                </span>
              )}
            </div>

            {b.questions.map((q) =>
              several || q.commentaire ? (
                <div key={q.label} style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 6 }}>
                  {several && (
                    <span style={{ fontWeight: 600, color: rateColor(questionRate(q)), whiteSpace: 'nowrap' }}>
                      {q.label} {fmt(q.points)}/{fmt(q.bareme)}
                    </span>
                  )}
                  {q.commentaire && <span>{q.commentaire}</span>}
                </div>
              ) : null,
            )}

            {b.texte === null ? (
              <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-dim)', marginTop: 6 }}>
                Pas de réponse transcrite.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--surface-3)',
                  fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {b.texte || '—'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
