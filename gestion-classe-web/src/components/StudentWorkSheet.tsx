import { useEffect, useState } from 'react';
import { fetchStudentWorkCorrection, type StudentWorkActivity, type StudentWorkView } from '../lib/studentGrades';
import {
  ZONE_NAMES,
  checkQ1Cell,
  q1Label,
  questionScore,
  type ActivityDefinition,
  type ActivityQuestion,
  type Q1Row,
} from '../lib/productionsQueries';

/**
 * Espace élève — sa copie corrigée d'une activité numérique (ex. « Terre en mouvement »), en plein écran
 * et pensée pour le téléphone : une colonne, une carte par question avec sa réponse, les critères acquis
 * ou non, la remarque de l'enseignant, puis les compétences et les conseils.
 *
 * Les données viennent de la RPC `get_student_work_correction` (migration 047), qui revérifie les verrous
 * côté serveur et ne renvoie jamais le corrigé attendu de l'enseignant. Le calcul des points par question
 * est celui du prof (`questionScore`) : l'élève lit le même chiffre que sur la copie imprimée.
 */

const T = {
  bg: '#1e1712',
  card: '#2a2018',
  cardBorder: '#3a2e22',
  inset: '#241c15',
  text: '#e8dcc8',
  textMuted: '#a09080',
  textDim: '#6a5c4e',
  pos: '#4ade80',
  posSoft: '#14331f',
  neg: '#f87171',
  negSoft: '#3a1f1f',
  warn: '#fbbf24',
  warnSoft: '#3a2d12',
  indigo: '#a5b4fc',
  indigoSoft: '#1e1b4b',
} as const;

const SKILL_LEVELS = ['Insuffisante', 'Fragile', 'Satisfaisante', 'Très bonne'];
const pts = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');
const fmtDate = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');

function scoreColor(got: number, max: number): string {
  if (max <= 0) return T.textMuted;
  if (got >= max) return T.pos;
  if (got > 0) return T.warn;
  return T.neg;
}

/* ---------- la réponse de l'élève, selon le type de question ---------- */

function Mark({ ok }: { ok: boolean | null }) {
  if (ok === null) return null;
  return (
    <span style={{ color: ok ? T.pos : T.neg, fontWeight: 800, marginRight: 6 }} aria-label={ok ? 'juste' : 'faux'}>
      {ok ? '✓' : '✗'}
    </span>
  );
}

function Empty({ label = '—' }: { label?: string }) {
  return <span style={{ color: T.textDim, fontStyle: 'italic' }}>{label}</span>;
}

function TableAnswer({ def, q, content }: { def: ActivityDefinition; q: ActivityQuestion; content: Record<string, unknown> }) {
  const lignes = (content[q.id] ?? {}) as Record<string, Q1Row>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(def.lignes_q1 ?? []).map((l, i) => {
        const row = lignes[l.id] ?? {};
        const zone = ZONE_NAMES[String(row.zone ?? '')] ?? (row.zone ? String(row.zone) : null);
        return (
          <div key={l.id} style={{ background: T.inset, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ color: T.text, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              Ligne {i + 1} <span style={{ color: T.textMuted, fontWeight: 500 }}>· {zone ?? 'zone non choisie'}</span>
            </div>
            {(def.colonnes_q1 ?? []).map((col) => {
              const champs = col.champs ?? [{ id: col.id }];
              const auto = q.criteres.some((cr) => cr.auto?.colonne === col.id) ? checkQ1Cell(def, row, col.id) : null;
              const texte = champs.map((ch) => q1Label(def, ch, row[ch.id])).filter(Boolean).join(' · ');
              return (
                <div key={col.id} style={{ fontSize: 13, lineHeight: 1.45, color: T.text, marginBottom: 3 }}>
                  <span style={{ color: T.textMuted }}>{col.nom} : </span>
                  {texte ? <><Mark ok={auto} />{texte}</> : <Empty />}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function Answer({ def, q, content }: { def: ActivityDefinition; q: ActivityQuestion; content: Record<string, unknown> }) {
  const v = content[q.id];
  if (q.type === 'tableau') return <TableAnswer def={def} q={q} content={content} />;
  if (q.type === 'deductive') {
    const o = (v ?? {}) as Record<string, string>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(q.champs ?? []).map((ch) => (
          <div key={ch.id} style={{ background: T.inset, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ color: T.indigo, fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{ch.nom}</div>
            <div style={{ color: T.text, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {o[ch.id]?.trim() ? o[ch.id].trim() : <Empty />}
            </div>
          </div>
        ))}
      </div>
    );
  }
  const t = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return (
    <div style={{ background: T.inset, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: '8px 10px', color: T.text, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {t.trim() ? t.trim() : <Empty label="— pas de réponse" />}
    </div>
  );
}

/* ---------- une question : réponse, critères, remarque ---------- */

function QuestionCard({ def, q, work }: { def: ActivityDefinition; q: ActivityQuestion; work: StudentWorkView }) {
  const c = work.correction.questions[q.id];
  const got = questionScore(q, work.correction);
  const color = q.bonus ? T.indigo : scoreColor(got, q.points);
  return (
    <section style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center',
          background: T.inset, border: `1px solid ${T.cardBorder}`, color: T.text, fontWeight: 800, fontSize: 13,
        }}>{q.num}</span>
        <span style={{ flex: 1, minWidth: 0, color: T.text, fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{q.titre}</span>
        <span style={{ flexShrink: 0, color, fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap' }}>
          {q.bonus ? '★ bonus' : `${pts(got)} / ${pts(q.points)}`}
        </span>
      </header>

      <div style={{ color: T.textDim, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Ta réponse</div>
      <Answer def={def} q={q} content={work.content} />

      <div style={{ color: T.textDim, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '12px 0 6px' }}>Correction</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {q.criteres.map((cr) => {
          const on = !!c?.criteres?.[cr.id];
          return (
            <li key={cr.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px', borderRadius: 10,
              background: on ? T.posSoft : T.inset, border: `1px solid ${on ? T.pos + '44' : T.cardBorder}`,
            }}>
              <span style={{ color: on ? T.pos : T.textDim, fontWeight: 800, flexShrink: 0 }}>{on ? '✓' : '✗'}</span>
              <span style={{ flex: 1, color: on ? T.text : T.textMuted, fontSize: 13, lineHeight: 1.4 }}>{cr.nom}</span>
              <span style={{ color: T.textDim, fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>{q.bonus ? '★' : `${pts(cr.points)} pt`}</span>
            </li>
          );
        })}
      </ul>

      {c?.remarque && (
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 10, background: T.warnSoft, borderLeft: `3px solid ${T.warn}`, color: T.text, fontSize: 14, lineHeight: 1.45 }}>
          <span style={{ color: T.warn, fontWeight: 700, marginRight: 6 }}>💬</span>{c.remarque}
        </div>
      )}
    </section>
  );
}

/* ---------- la feuille complète ---------- */

interface Props {
  code: string;
  assessmentId: string;
  assessmentName: string;
  onClose: () => void;
}

export function StudentWorkSheet({ code, assessmentId, assessmentName, onClose }: Props) {
  const [data, setData] = useState<{ activity: StudentWorkActivity; work: StudentWorkView } | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStudentWorkCorrection(code, assessmentId)
      .then((r) => { if (alive) setData(r); })
      .catch(() => { if (alive) setError('Impossible de charger ta copie.'); });
    return () => { alive = false; };
  }, [code, assessmentId]);

  // La page derrière ne défile pas pendant la lecture de la copie.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const total = data?.work.total_points != null ? pts(Number(data.work.total_points)) : null;
  const bareme = data ? pts(Number(data.activity.bareme_total)) : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Ma copie corrigée · ${assessmentName}`} style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: T.bg, color: T.text,
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
    }}>
      {/* Barre haute collante */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 10,
        padding: 'max(10px, env(safe-area-inset-top)) 12px 10px', background: T.bg, borderBottom: `1px solid ${T.cardBorder}`,
      }}>
        <button onClick={onClose} aria-label="Retour aux notes" style={{
          background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text, borderRadius: 10,
          padding: '8px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: T.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ma copie corrigée</div>
          <div style={{ color: T.text, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data?.activity.title ?? assessmentName}
          </div>
        </div>
        {total !== null && (
          <div style={{ flexShrink: 0, textAlign: 'right', background: T.indigoSoft, border: `1px solid ${T.indigo}55`, borderRadius: 12, padding: '6px 10px' }}>
            <span style={{ color: T.indigo, fontWeight: 800, fontSize: 18 }}>{total}</span>
            <span style={{ color: T.textMuted, fontSize: 12 }}> / {bareme}</span>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <p style={{ color: T.neg, textAlign: 'center', padding: '24px 0' }}>{error}</p>}
        {!error && data === undefined && <p style={{ color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>Chargement…</p>}
        {!error && data === null && (
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <p style={{ color: T.text, marginBottom: 6 }}>Ta copie n’est pas encore consultable.</p>
            <p style={{ color: T.textDim, fontSize: 13, margin: 0 }}>Elle apparaîtra ici quand ton professeur l’aura corrigée.</p>
          </div>
        )}

        {data && (
          <>
            <div style={{ color: T.textMuted, fontSize: 12, lineHeight: 1.5 }}>
              {data.activity.sequence && <div>{data.activity.sequence}</div>}
              <div>
                Envoi n°{data.work.version}{data.work.submitted_at ? ` du ${fmtDate(data.work.submitted_at)}` : ''}
                {data.work.corrected_at ? ` · corrigée le ${fmtDate(data.work.corrected_at)}` : ''}
                {data.work.group_pseudos.length > 1 ? ` · binôme : ${data.work.group_pseudos.join(', ')}` : ''}
              </div>
            </div>

            {data.activity.definition.questions.map((q) => (
              <QuestionCard key={q.id} def={data.activity.definition} q={q} work={data.work} />
            ))}

            {(data.activity.definition.competences?.length ?? 0) > 0 && (
              <section style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 14 }}>
                <div style={{ color: T.textDim, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Compétences</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(data.activity.definition.competences ?? []).map((comp) => {
                    const lvl = data.work.skills?.[comp.id];
                    return (
                      <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ flex: 1, color: T.text, fontSize: 13, lineHeight: 1.35 }}>{comp.nom}</span>
                        <span style={{ display: 'flex', gap: 3, flexShrink: 0 }} aria-hidden>
                          {[1, 2, 3, 4].map((n) => (
                            <span key={n} style={{ width: 9, height: 9, borderRadius: '50%', background: lvl && n <= lvl ? T.indigo : T.cardBorder }} />
                          ))}
                        </span>
                        <span style={{ color: lvl ? T.indigo : T.textDim, fontSize: 12, fontWeight: 600, width: 92, textAlign: 'right', flexShrink: 0 }}>
                          {lvl ? SKILL_LEVELS[lvl - 1] : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {data.work.advice && (
              <section style={{ background: T.indigoSoft, border: `1px solid ${T.indigo}55`, borderRadius: 16, padding: 14 }}>
                <div style={{ color: T.indigo, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Conseils pour la prochaine fois</div>
                <p style={{ margin: 0, color: T.text, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{data.work.advice}</p>
              </section>
            )}

            <button onClick={onClose} style={{
              marginTop: 4, background: T.card, border: `1px solid ${T.cardBorder}`, color: T.text, borderRadius: 12,
              padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>← Retour aux notes</button>
          </>
        )}
      </div>
    </div>
  );
}
