import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import {
  fetchActivities,
  fetchWorks,
  fetchClassStudents,
  fetchWorkVersions,
  updateActivity,
  WORK_STATUS_LABEL,
  type ActivityRow,
  type ActivityQuestion,
  type WorkRow,
  type WorkStatus,
  type WorkVersionRow,
} from '../lib/productionsQueries';

/**
 * Productions : les fiches d'activité que les élèves remplissent dans une application
 * (« Terre en mouvement »…) et envoient avec leur code. Ici : lecture et suivi des envois.
 * La correction (par critères, par Claude), l'envoi des notes dans le carnet et l'impression
 * viennent dans un second temps, une fois les premières vraies copies reçues.
 */

const STATUS_COLOR: Record<WorkStatus, { bg: string; fg: string }> = {
  draft: { bg: 'var(--surface-3)', fg: 'var(--text-muted)' },
  submitted: { bg: 'var(--indigo-soft, rgba(99,102,241,.12))', fg: 'var(--indigo)' },
  corrected: { bg: 'var(--warn-soft, rgba(245,158,11,.14))', fg: 'var(--warn, #b45309)' },
  validated: { bg: 'var(--pos-soft, rgba(16,185,129,.14))', fg: 'var(--pos, #047857)' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const ZONE_NAMES: Record<string, string> = {
  islande: 'Islande', atlantique: 'Atlantique', andes: 'Andes', java: 'Java', himalaya: 'Himalaya', rhin: 'Fossé rhénan',
};

export function Productions() {
  const { toast: showToast } = useUIFeedback();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [classStudents, setClassStudents] = useState<{ id: string; pseudo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [open, setOpen] = useState<WorkRow | null>(null);
  const [showExpected, setShowExpected] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState('');

  const activity = useMemo(() => activities.find((a) => a.id === activityId) ?? null, [activities, activityId]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchActivities();
      setActivities(rows);
      setActivityId((cur) => cur ?? rows[0]?.id ?? null);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadWorks = useCallback(async (id: string) => {
    setLoadingWorks(true);
    try {
      setWorks(await fetchWorks(id));
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoadingWorks(false);
    }
  }, [showToast]);

  useEffect(() => { void loadActivities(); }, [loadActivities]);
  useEffect(() => { if (activityId) void loadWorks(activityId); }, [activityId, loadWorks]);

  // Classes présentes dans les envois de cette activité.
  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of works) if (w.class_id) m.set(w.class_id, w.classes?.name ?? '?');
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [works]);

  useEffect(() => {
    if (!classId && classOptions.length) setClassId(classOptions[0][0]);
  }, [classOptions, classId]);

  useEffect(() => {
    if (!classId) { setClassStudents([]); return; }
    fetchClassStudents(classId).then(setClassStudents).catch(() => setClassStudents([]));
  }, [classId]);

  const rows = useMemo(() => {
    const byStudent = new Map(works.filter((w) => w.class_id === classId).map((w) => [w.student_id, w]));
    return classStudents.map((s) => ({ student: s, work: byStudent.get(s.id) ?? null }));
  }, [works, classStudents, classId]);

  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, corrected: 0, validated: 0, none: 0 };
    for (const r of rows) { if (r.work) c[r.work.status]++; else c.none++; }
    return c;
  }, [rows]);

  const toggleAccepting = async () => {
    if (!activity) return;
    try {
      await updateActivity(activity.id, { accepting_submissions: !activity.accepting_submissions });
      setActivities((as) => as.map((a) => (a.id === activity.id ? { ...a, accepting_submissions: !a.accepting_submissions } : a)));
      showToast(activity.accepting_submissions ? 'Envois fermés.' : 'Envois rouverts.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const saveExpected = async () => {
    if (!activity) return;
    try {
      await updateActivity(activity.id, { expected_answers: expectedDraft || null });
      setActivities((as) => as.map((a) => (a.id === activity.id ? { ...a, expected_answers: expectedDraft || null } : a)));
      setShowExpected(false);
      showToast('Corrigé attendu enregistré.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  return (
    <Layout fluid>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Productions</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Fiches d’activité remplies dans une application et envoyées par les élèves avec leur code.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Chargement…</div>
      ) : activities.length === 0 ? (
        <div style={card}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
            Aucune production reçue pour l’instant. Une activité apparaît ici dès qu’un élève envoie sa première fiche depuis l’application.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
          {/* ---- Activités ---- */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
              {activities.length} activité{activities.length > 1 ? 's' : ''}
            </div>
            {activities.map((a) => (
              <button
                key={a.id}
                onClick={() => { setActivityId(a.id); setClassId(''); setOpen(null); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', cursor: 'pointer',
                  background: a.id === activityId ? 'var(--surface-3)' : 'transparent', borderBottom: '1px solid var(--border)',
                  color: 'var(--text)', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {[a.level, a.sequence].filter(Boolean).join(' · ')} · /{a.bareme_total}
                  {!a.accepting_submissions && <span style={{ marginLeft: 6, color: 'var(--neg)' }}>· envois fermés</span>}
                </div>
              </button>
            ))}
          </div>

          {/* ---- Productions de l'activité ---- */}
          {activity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{activity.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Clé {activity.key} · définition v{activity.definition_version} · {activity.definition.questions?.length ?? 0} questions · barème /{activity.bareme_total}
                  </div>
                </div>
                <button onClick={() => { setExpectedDraft(activity.expected_answers ?? ''); setShowExpected(true); }} style={btnGhost}>
                  {activity.expected_answers ? 'Corrigé attendu ✓' : 'Saisir le corrigé attendu'}
                </button>
                <button onClick={toggleAccepting} style={activity.accepting_submissions ? btnGhost : btnPrimary}>
                  {activity.accepting_submissions ? 'Fermer les envois' : 'Rouvrir les envois'}
                </button>
              </div>

              <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Classe</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ ...inp, width: 160 }}>
                  {classOptions.length === 0 && <option value="">—</option>}
                  {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                  {(['submitted', 'corrected', 'validated', 'draft'] as WorkStatus[]).map((s) => (
                    <span key={s} style={{ ...pill, background: STATUS_COLOR[s].bg, color: STATUS_COLOR[s].fg }}>{WORK_STATUS_LABEL[s]} : {counts[s]}</span>
                  ))}
                  <span style={{ ...pill, background: 'var(--surface-3)', color: 'var(--text-muted)' }}>Rien reçu : {counts.none}</span>
                </div>
                <button onClick={() => loadWorks(activity.id)} style={{ ...btnGhost, marginLeft: 'auto' }} disabled={loadingWorks}>
                  {loadingWorks ? 'Actualisation…' : 'Actualiser'}
                </button>
              </div>

              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-3)', textAlign: 'left' }}>
                      <th style={th}>Élève</th>
                      <th style={th}>Statut</th>
                      <th style={th}>Binôme</th>
                      <th style={th}>Dernier envoi</th>
                      <th style={th}>Envois</th>
                      <th style={th}>Note</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={7} style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>Aucun élève pour cette classe.</td></tr>
                    )}
                    {rows.map(({ student, work }) => (
                      <tr key={student.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={td}><strong>{student.pseudo}</strong></td>
                        <td style={td}>
                          {work ? (
                            <span style={{ ...pill, background: STATUS_COLOR[work.status].bg, color: STATUS_COLOR[work.status].fg }}>
                              {WORK_STATUS_LABEL[work.status]}{work.modified_after_correction && ' · modifiée après correction'}
                            </span>
                          ) : <span style={{ color: 'var(--text-dim)' }}>Rien reçu</span>}
                        </td>
                        <td style={td}>{work && work.group_pseudos.length > 1 ? work.group_pseudos.filter((p) => p !== student.pseudo).join(', ') : <span style={{ color: 'var(--text-dim)' }}>seul</span>}</td>
                        <td style={td}>{work ? fmtDate(work.submitted_at ?? work.updated_at) : '—'}</td>
                        <td style={td}>{work ? work.version : '—'}</td>
                        <td style={td}>{work?.total_points != null ? `${work.total_points} / ${activity.bareme_total}` : '—'}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          {work && <button onClick={() => setOpen(work)} style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }}>Lire</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {open && activity && <WorkModal work={open} activity={activity} onClose={() => setOpen(null)} />}

      {showExpected && activity && (
        <div style={overlay} onClick={() => setShowExpected(false)}>
          <div style={{ ...modal, width: 'min(760px, 94vw)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>Corrigé attendu · {activity.title}</h2>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-muted)' }}>
              Réponses attendues et consignes de notation, pour toi et pour Claude. Jamais envoyé aux élèves.
            </p>
            <textarea value={expectedDraft} onChange={(e) => setExpectedDraft(e.target.value)} rows={18} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowExpected(false)} style={btnGhost}>Annuler</button>
              <button onClick={saveExpected} style={btnPrimary}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

/* ---------- Lecture d'une production ---------- */

function answerText(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function WorkModal({ work, activity, onClose }: { work: WorkRow; activity: ActivityRow; onClose: () => void }) {
  const def = activity.definition;
  const c = work.content as Record<string, unknown>;
  const [versions, setVersions] = useState<WorkVersionRow[] | null>(null);
  const app = (c.app ?? null) as Record<string, { ok: boolean; type: string | null; etapes: number }> | null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const renderQuestion = (q: ActivityQuestion) => {
    const v = c[q.id];
    if (q.type === 'tableau') {
      const lignes = (v ?? {}) as Record<string, Record<string, string>>;
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--surface-3)' }}>
              <th style={thSmall}>Zone</th>
              {(def.colonnes_q1 ?? []).map((col) => <th key={col.id} style={thSmall}>{col.nom}</th>)}
            </tr>
          </thead>
          <tbody>
            {(def.lignes_q1 ?? []).map((l) => {
              const row = lignes[l.id] ?? {};
              return (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tdSmall}><strong>{ZONE_NAMES[row.zone] ?? row.zone ?? '—'}</strong></td>
                  {(def.colonnes_q1 ?? []).map((col) => <td key={col.id} style={tdSmall}>{row[col.id] || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>)}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {(q.champs ?? []).map((ch) => (
            <div key={ch.id} style={answerBox}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>{ch.nom}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{o[ch.id] || <span style={{ color: 'var(--text-dim)' }}>—</span>}</div>
            </div>
          ))}
        </div>
      );
    }
    const t = answerText(v);
    return <div style={{ ...answerBox, whiteSpace: 'pre-wrap' }}>{t || <span style={{ color: 'var(--text-dim)' }}>— (pas de réponse)</span>}</div>;
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, width: 'min(980px, 96vw)', maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>{work.students?.pseudo ?? 'Élève'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {work.classes?.name ?? ''}</span></h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {activity.title} · {WORK_STATUS_LABEL[work.status]} · envoi n°{work.version} le {fmtDate(work.submitted_at)}
              {work.group_pseudos.length > 1 && ` · binôme : ${work.group_pseudos.join(', ')}`}
            </div>
          </div>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
        </div>

        {app && (
          <div style={{ ...answerBox, marginBottom: 12, fontSize: 12 }}>
            <strong>Dans l’application :</strong>{' '}
            {Object.entries(app).map(([z, s]) => `${ZONE_NAMES[z] ?? z} ${s.ok ? '✓' : `${s.etapes}/3`}${s.type ? ` (${s.type})` : ''}`).join(' · ') || 'aucune zone commencée'}
          </div>
        )}

        {def.questions.map((q) => (
          <section key={q.id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{q.num}. {q.titre}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.bonus ? 'bonus' : `${q.points} pt${q.points > 1 ? 's' : ''}`}</span>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)' }}>{q.consigne}</p>
            {renderQuestion(q)}
          </section>
        ))}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          {versions === null ? (
            <button onClick={() => fetchWorkVersions(work.id).then(setVersions).catch(() => setVersions([]))} style={{ ...btnGhost, fontSize: 12 }}>Voir l’historique des envois</button>
          ) : versions.length === 0 ? 'Aucun envoi archivé.' : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {versions.map((v) => <li key={v.id}>Envoi n°{v.version} · {fmtDate(v.submitted_at)}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- styles ---------- */

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 };
const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 };
const th: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' };
const td: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'top' };
const thSmall: React.CSSProperties = { padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'left' };
const tdSmall: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', whiteSpace: 'pre-wrap' };
const answerBox: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 13 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--text)' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 };
const btnBase: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
