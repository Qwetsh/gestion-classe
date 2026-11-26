import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { COMPETENCE_LEVELS, levelScore, questionRate, type GradeDetails } from '../lib/gradeDetails';

/**
 * Détail d'une correction : tableau des questions (points et commentaire), radar des
 * compétences, forces, faiblesses et commentaire général. Partagé entre l'écran du prof
 * (validation des brouillons, thème clair) et l'espace élève (thème sombre) : seule la
 * palette change, pour que les deux lisent exactement la même chose.
 */

export interface DetailsPalette {
  text: string;
  muted: string;
  dim: string;
  border: string;
  surface: string;
  pos: string;
  warn: string;
  neg: string;
  accent: string;
}

export const LIGHT_PALETTE: DetailsPalette = {
  text: 'var(--text)',
  muted: 'var(--text-muted)',
  dim: 'var(--text-dim)',
  border: 'var(--border)',
  surface: 'var(--surface-3)',
  pos: 'var(--pos)',
  warn: 'var(--warn)',
  neg: 'var(--neg)',
  accent: 'var(--indigo)',
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ',');
}

/** Libellé court sur l'axe du radar (un nom de compétence peut être long). */
function shortLabel(s: string): string {
  return s.length > 22 ? `${s.slice(0, 21)}…` : s;
}

interface Props {
  details: GradeDetails;
  palette?: DetailsPalette;
  /**
   * Téléphone (espace élève) : pas de radar, dont les libellés sont coupés sur un écran étroit, et
   * les questions en lignes (titre et points, commentaire dessous) plutôt qu'en tableau à trois colonnes.
   */
  compact?: boolean;
}

export function GradeDetailsView({ details, palette = LIGHT_PALETTE, compact = false }: Props) {
  const p = palette;
  const rateColor = (r: number) => (r >= 0.75 ? p.pos : r >= 0.5 ? p.warn : p.neg);
  const radarData = details.competences.map((c) => ({ axe: shortLabel(c.nom), valeur: levelScore(c.niveau) }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: p.text }}>
      {details.commentaire && (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{details.commentaire}</p>
      )}

      {!compact && details.competences.length >= 3 && (
        <div style={{ width: '100%', height: 230 }}>
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke={p.border} />
              <PolarAngleAxis dataKey="axe" tick={{ fill: p.muted, fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 4]} tickCount={5} tick={false} axisLine={false} />
              <Radar dataKey="valeur" stroke={p.accent} fill={p.accent} fillOpacity={0.3} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {details.competences.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {details.competences.map((c) => {
            const score = levelScore(c.niveau);
            return (
              <div key={c.nom} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: compact ? 14 : 13, lineHeight: 1.35 }}>
                <span style={{ flex: 1, color: p.text }}>{c.nom}</span>
                <span style={{ display: 'flex', gap: 2 }} aria-hidden>
                  {COMPETENCE_LEVELS.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 10, height: 10, borderRadius: 3,
                        background: i < score ? rateColor(score / 4) : p.surface,
                        border: `1px solid ${p.border}`,
                      }}
                    />
                  ))}
                </span>
                <span style={{ width: compact ? 112 : 128, textAlign: 'right', color: p.muted, fontSize: 13 }}>{c.niveau ?? '—'}</span>
              </div>
            );
          })}
        </div>
      )}

      {(details.forces || details.faiblesses) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {details.forces && (
            <div style={compact ? undefined : { borderLeft: `3px solid ${p.pos}`, paddingLeft: 8 }}>
              <div style={{ fontSize: compact ? 13 : 11, fontWeight: 700, color: p.pos, marginBottom: 2 }}>Points forts</div>
              <div style={{ fontSize: compact ? 15 : 13, lineHeight: 1.45 }}>{details.forces}</div>
            </div>
          )}
          {details.faiblesses && (
            <div style={compact ? undefined : { borderLeft: `3px solid ${p.warn}`, paddingLeft: 8 }}>
              <div style={{ fontSize: compact ? 13 : 11, fontWeight: 700, color: p.warn, marginBottom: 2 }}>Pour progresser</div>
              <div style={{ fontSize: compact ? 15 : 13, lineHeight: 1.45 }}>{details.faiblesses}</div>
            </div>
          )}
        </div>
      )}

      {compact && details.questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {details.questions.map((q, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 0', borderTop: `1px solid ${p.border}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{q.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {fmt(q.points)}<span style={{ fontSize: 13, fontWeight: 500, color: p.dim }}> / {fmt(q.bareme)}</span>
                </span>
              </div>
              {q.commentaire && <span style={{ fontSize: 14, lineHeight: 1.45, color: p.muted }}>{q.commentaire}</span>}
            </div>
          ))}
          {details.noteBrute !== null && details.baremeTotal !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 0 0', borderTop: `1px solid ${p.border}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, fontSize: 15, fontWeight: 700 }}>
                <span>Total</span>
                <span>{fmt(details.noteBrute)}<span style={{ fontSize: 13, fontWeight: 500, color: p.dim }}> / {fmt(details.baremeTotal)}</span></span>
              </div>
              {details.noteForcee && <span style={{ fontSize: 13, color: p.dim }}>Note fixée par ton professeur.</span>}
            </div>
          )}
        </div>
      )}

      {!compact && details.questions.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: p.dim, textAlign: 'left' }}>
              <th style={{ padding: '4px 6px', fontWeight: 600 }}>Question</th>
              <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>Points</th>
              <th style={{ padding: '4px 6px', fontWeight: 600 }}>Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {details.questions.map((q, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${p.border}`, verticalAlign: 'top' }}>
                <td style={{ padding: '6px', fontWeight: 600 }}>{q.label}</td>
                <td style={{ padding: '6px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: rateColor(questionRate(q)) }}>
                  {fmt(q.points)}/{fmt(q.bareme)}
                </td>
                <td style={{ padding: '6px', color: p.muted, lineHeight: 1.4 }}>{q.commentaire}</td>
              </tr>
            ))}
          </tbody>
          {details.noteBrute !== null && details.baremeTotal !== null && (
            <tfoot>
              <tr style={{ borderTop: `1px solid ${p.border}` }}>
                <td style={{ padding: '6px', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700 }}>
                  {fmt(details.noteBrute)}/{fmt(details.baremeTotal)}
                </td>
                <td style={{ padding: '6px', color: p.dim }}>
                  {details.noteForcee ? 'Note fixée par ton professeur.' : ''}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
