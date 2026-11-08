import {
  ZONE_NAMES,
  checkQ1Cell,
  questionScore,
  q1Label,
  type ActivityQuestion,
  type ActivityRow,
  type Q1Row,
  type WorkCorrection,
} from '../../lib/productionsQueries';

/**
 * Copie d'une production numérique, en lecture : chaque question (titre, consigne si elle apporte
 * quelque chose) et la réponse de l'élève, avec les points obtenus quand la question est corrigée.
 * Partagée par la correction (WorkCorrection, colonne du centre) et la modale élève × éval du
 * carnet (StudentGradeModal, colonne de gauche).
 */

const fmtPts = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
/** Comparaison titre / consigne : sans casse, ponctuation finale ni espaces. */
const norm = (s: string) => s.toLowerCase().replace(/[\s.:…?!]+/g, ' ').trim();
const noAnswer = <span style={{ color: 'var(--neg)', fontSize: 13, fontStyle: 'italic', fontWeight: 500 }}>pas de réponse</span>;
const rateColor = (r: number) => (r >= 0.75 ? 'var(--pos)' : r >= 0.5 ? 'var(--warn)' : 'var(--neg)');
const tdSmall: React.CSSProperties = { padding: '4px 6px', verticalAlign: 'top' };

function Answer({ def, q, content }: { def: ActivityRow['definition']; q: ActivityQuestion; content: Record<string, unknown> }) {
  const v = content[q.id];
  if (q.type === 'tableau') {
    const lignes = (v ?? {}) as Record<string, Q1Row>;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <tbody>
          {(def.lignes_q1 ?? []).map((l, i) => {
            const row = lignes[l.id] ?? {};
            return (
              <tr key={l.id} style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
                <td style={{ ...tdSmall, width: 84 }}><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Ligne {i + 1}</span><br /><strong>{ZONE_NAMES[String(row.zone ?? '')] ?? String(row.zone ?? '—')}</strong></td>
                <td style={tdSmall}>
                  {(def.colonnes_q1 ?? []).map((col) => {
                    // Définition v2 : cases listées par `champs` (menus, nombre) ; v1 : un texte libre par colonne.
                    const champs = col.champs ?? [{ id: col.id }];
                    const auto = q.criteres.some((cr) => cr.auto?.colonne === col.id) ? checkQ1Cell(def, row, col.id) : null;
                    const texte = champs.map((ch) => q1Label(def, ch, row[ch.id])).filter(Boolean).join(' · ');
                    return (
                      <div key={col.id} style={{ marginBottom: 2 }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 400 }}>{col.nom} : </span>
                        {texte
                          ? <span style={{ color: auto === true ? 'var(--pos)' : auto === false ? 'var(--neg)' : undefined }}>{auto === true ? '✓ ' : auto === false ? '✗ ' : ''}{texte}</span>
                          : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </div>
                    );
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  if (q.type === 'deductive') {
    const o = (v ?? {}) as Record<string, string>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(q.champs ?? []).map((ch) => (
          <div key={ch.id}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{ch.nom}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{o[ch.id] || noAnswer}</div>
          </div>
        ))}
      </div>
    );
  }
  const t = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return <div style={{ whiteSpace: 'pre-wrap' }}>{t || noAnswer}</div>;
}

export function WorkAnswersView({ activity, content, correction, answerId }: {
  activity: ActivityRow;
  content: Record<string, unknown>;
  /** Correction affichée (enregistrée ou en cours) : donne les points des questions corrigées. */
  correction: WorkCorrection | null;
  /** id DOM d'une question, pour y faire défiler depuis la correction. */
  answerId?: (qid: string) => string;
}) {
  const def = activity.definition;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '4px 14px' }}>
      {def.questions.map((q, qi) => {
        const pts = questionScore(q, correction);
        const touched = !!correction?.questions[q.id];
        // La consigne répète souvent le titre (« Les 4 symptômes… sont : ») : on ne l'affiche que si elle apporte quelque chose.
        const consigne = q.consigne && norm(q.consigne) !== norm(q.titre) ? q.consigne : '';
        return (
          <section key={q.id} id={answerId?.(q.id)} style={{ padding: '10px 0', borderTop: qi ? '1px solid var(--border)' : undefined, scrollMarginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.35 }}>{q.num}. {q.titre}</div>
              {!q.bonus && touched && q.points > 0 && (
                <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: rateColor(pts / q.points) }}>
                  {fmtPts(pts)}/{fmtPts(q.points)}
                </span>
              )}
            </div>
            {consigne && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 1 }}>{consigne}</div>}
            <div className="gc-wc__answer"><Answer def={def} q={q} content={content} /></div>
          </section>
        );
      })}
    </div>
  );
}
