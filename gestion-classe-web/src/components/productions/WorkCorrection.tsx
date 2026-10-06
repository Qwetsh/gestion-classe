import { useEffect, useMemo, useState } from 'react';
import {
  applyAuto,
  checkQ1Cell,
  computeTotal,
  deleteWork,
  hasAuto,
  q1Label,
  saveWorkCorrection,
  setWorkStatus,
  fetchWorkVersions,
  WORK_STATUS_LABEL,
  type ActivityRow,
  type ActivityQuestion,
  type WorkRow,
  type WorkCorrection as Correction,
  type WorkVersionRow,
  type Q1Row,
} from '../../lib/productionsQueries';

/**
 * Correction d'une production, par critères.
 * À gauche la réponse de l'élève, à droite les critères du barème (cases à cocher, points fixes),
 * une remarque par question, les compétences, les conseils. Le total se calcule tout seul.
 * « Enregistrer » pose la correction (statut corrigée), « Valider » la fige (statut validée,
 * l'élève ne peut plus renvoyer). « Appliquer au binôme » recopie la correction sur les autres
 * membres du groupe (même contenu envoyé) : ils restent notés individuellement ensuite.
 * Les questions à réponses fermées (tableau de la question 1 depuis la définition v2) sont corrigées
 * automatiquement à l'ouverture d'une copie pas encore corrigée ; le bouton « Auto » refait ce calcul,
 * et chaque case reste modifiable à la main.
 */

const ZONE_NAMES: Record<string, string> = {
  islande: 'Islande', atlantique: 'Atlantique', andes: 'Andes', java: 'Java', himalaya: 'Himalaya', rhin: 'Fossé rhénan',
};
const SKILL_LEVELS = ['Insuffisante', 'Fragile', 'Satisfaisante', 'Très bonne'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
const fmtPts = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

function emptyCorrection(): Correction { return { questions: {} }; }

/** Correction de départ : celle enregistrée, sinon la correction automatique des réponses à choix. */
function initialCorrection(work: WorkRow, activity: ActivityRow): { corr: Correction; auto: boolean } {
  if (work.correction) return { corr: work.correction, auto: false };
  if (!hasAuto(activity.definition)) return { corr: emptyCorrection(), auto: false };
  return { corr: applyAuto(activity.definition, emptyCorrection(), work.content), auto: true };
}

interface Props {
  work: WorkRow;
  activity: ActivityRow;
  /** Autres productions du même binôme (même group_key, même contenu), pour « appliquer au binôme ». */
  groupMates: WorkRow[];
  onClose: () => void;
  onSaved: (updated: WorkRow[]) => void;
  onDeleted: (workId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function WorkCorrection({ work, activity, groupMates, onClose, onSaved, onDeleted, onPrev, onNext, position, toast }: Props) {
  const def = activity.definition;
  const content = work.content as Record<string, unknown>;
  const [corr, setCorr] = useState<Correction>(() => initialCorrection(work, activity).corr);
  const [autoPrefilled, setAutoPrefilled] = useState(() => initialCorrection(work, activity).auto);
  const [advice, setAdvice] = useState(work.advice ?? '');
  const [skills, setSkills] = useState<Record<string, number>>(() => work.skills ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [versions, setVersions] = useState<WorkVersionRow[] | null>(null);

  // Nouvelle copie ouverte (navigation) : repartir de sa correction.
  useEffect(() => {
    const init = initialCorrection(work, activity);
    setCorr(init.corr);
    setAutoPrefilled(init.auto);
    setAdvice(work.advice ?? '');
    setSkills(work.skills ?? {});
    setDirty(false);
    setVersions(null);
  }, [work, activity]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.altKey && e.key === 'ArrowRight' && onNext) onNext();
      if (e.altKey && e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose, onNext, onPrev]);

  const total = useMemo(() => computeTotal(def, corr) ?? 0, [def, corr]);
  const bonusOk = useMemo(() => {
    const q = def.questions.find((x) => x.bonus);
    if (!q) return 0;
    return q.criteres.filter((c) => corr.questions[q.id]?.criteres?.[c.id]).length;
  }, [def, corr]);

  const toggle = (qid: string, cid: string) => {
    setCorr((c) => {
      const q = c.questions[qid] ?? {};
      const criteres = { ...(q.criteres ?? {}) };
      criteres[cid] = !criteres[cid];
      return { questions: { ...c.questions, [qid]: { ...q, criteres, points: null } } };
    });
    setDirty(true);
  };
  const setAll = (q: ActivityQuestion, value: boolean) => {
    setCorr((c) => ({
      questions: { ...c.questions, [q.id]: { ...(c.questions[q.id] ?? {}), criteres: Object.fromEntries(q.criteres.map((cr) => [cr.id, value])), points: null } },
    }));
    setDirty(true);
  };
  const redoAuto = (q: ActivityQuestion) => {
    setCorr((c) => applyAuto(def, c, content, q.id));
    setDirty(true);
  };
  const setRemark = (qid: string, remarque: string) => {
    setCorr((c) => ({ questions: { ...c.questions, [qid]: { ...(c.questions[qid] ?? {}), remarque } } }));
    setDirty(true);
  };

  const persist = async (targets: WorkRow[], validate: boolean) => {
    setSaving(true);
    try {
      const updated: WorkRow[] = [];
      for (const w of targets) {
        await saveWorkCorrection(w.id, { correction: corr, advice: advice || null, skills: Object.keys(skills).length ? skills : null, totalPoints: total, correctedBy: 'prof' });
        let status: WorkRow['status'] = 'corrected';
        let validated_at = w.validated_at;
        if (validate) { await setWorkStatus(w.id, 'validated'); status = 'validated'; validated_at = new Date().toISOString(); }
        updated.push({ ...w, correction: corr, advice: advice || null, skills, total_points: total, corrected_by: 'prof', corrected_at: new Date().toISOString(), status, validated_at, modified_after_correction: false });
      }
      onSaved(updated);
      setDirty(false);
      toast(validate ? `Validée${targets.length > 1 ? ` pour ${targets.length} élèves` : ''} : ${fmtPts(total)} / ${activity.bareme_total}.` : 'Correction enregistrée.', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    try {
      await setWorkStatus(work.id, 'corrected');
      onSaved([{ ...work, status: 'corrected', validated_at: null }]);
      toast('Copie rouverte : l’élève peut renvoyer, et tu peux modifier la correction.', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const remove = async () => {
    const who = work.students?.pseudo ?? 'cet élève';
    if (!window.confirm(`Supprimer définitivement la copie de ${who} (et son historique) ? Le prochain envoi de l’élève repartira de zéro.`)) return;
    try {
      await deleteWork(work.id);
      onDeleted(work.id);
      toast('Copie supprimée.', 'info');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const sameContent = groupMates.filter((m) => JSON.stringify(m.content) === JSON.stringify(work.content));
  const locked = work.status === 'validated';

  const renderAnswer = (q: ActivityQuestion) => {
    const v = content[q.id];
    if (q.type === 'tableau') {
      const lignes = (v ?? {}) as Record<string, Q1Row>;
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <tbody>
            {(def.lignes_q1 ?? []).map((l, i) => {
              const row = lignes[l.id] ?? {};
              return (
                <tr key={l.id} style={{ borderTop: i ? '1px solid var(--border)' : undefined }}>
                  <td style={{ ...tdSmall, width: 90 }}><strong>Ligne {i + 1}</strong><br />{ZONE_NAMES[String(row.zone ?? '')] ?? String(row.zone ?? '—')}</td>
                  <td style={tdSmall}>
                    {(def.colonnes_q1 ?? []).map((col) => {
                      // Définition v2 : cases listées par `champs` (menus, nombre) ; v1 : un texte libre par colonne.
                      const champs = col.champs ?? [{ id: col.id }];
                      const auto = q.criteres.some((cr) => cr.auto?.colonne === col.id) ? checkQ1Cell(def, row, col.id) : null;
                      const texte = champs.map((ch) => q1Label(def, ch, row[ch.id])).filter(Boolean).join(' · ');
                      return (
                        <div key={col.id} style={{ marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{col.nom} : </span>
                          {texte
                            ? <span style={{ color: auto === true ? 'var(--pos, #047857)' : auto === false ? 'var(--neg)' : undefined }}>{auto === true ? '✓ ' : auto === false ? '✗ ' : ''}{texte}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(q.champs ?? []).map((ch) => (
            <div key={ch.id}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{ch.nom}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{o[ch.id] || <span style={{ color: 'var(--text-dim)' }}>—</span>}</div>
            </div>
          ))}
        </div>
      );
    }
    const t = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
    return <div style={{ whiteSpace: 'pre-wrap' }}>{t || <span style={{ color: 'var(--text-dim)' }}>— (pas de réponse)</span>}</div>;
  };

  const questionPoints = (q: ActivityQuestion) => {
    const c = corr.questions[q.id];
    if (!c) return 0;
    if (typeof c.points === 'number') return c.points;
    return q.criteres.reduce((s, cr) => s + (c.criteres?.[cr.id] ? cr.points : 0), 0);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modal, width: 'min(1240px, 97vw)', height: '94vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onPrev} disabled={!onPrev} style={{ ...btnGhost, padding: '4px 10px' }} title="Copie précédente (Alt + ←)">←</button>
            <button onClick={onNext} disabled={!onNext} style={{ ...btnGhost, padding: '4px 10px' }} title="Copie suivante (Alt + →)">→</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>
              {work.students?.pseudo ?? 'Élève'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {work.classes?.name ?? ''}{position && ` · ${position.index + 1}/${position.total}`}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {WORK_STATUS_LABEL[work.status]}{work.corrected_by === 'claude' && ' par Claude'} · envoi n°{work.version} le {fmtDate(work.submitted_at)}
              {work.group_pseudos.length > 1 && ` · binôme : ${work.group_pseudos.join(', ')}`}
              {work.modified_after_correction && <span style={{ color: 'var(--warn, #b45309)', fontWeight: 600 }}> · renvoyée après correction</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{fmtPts(total)} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>/ {activity.bareme_total}</span></div>
            {bonusOk > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>bonus ★ {bonusOk} critère{bonusOk > 1 ? 's' : ''}</div>}
          </div>
          <button onClick={() => setShowExpected((s) => !s)} style={btnGhost}>{showExpected ? 'Masquer le corrigé' : 'Corrigé attendu'}</button>
          <button onClick={onClose} style={btnGhost}>Fermer</button>
        </div>

        {/* Corps */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: showExpected ? '1fr 340px' : '1fr' }}>
          <div style={{ overflow: 'auto', padding: 18 }}>
            {locked && (
              <div style={{ ...note, background: 'var(--pos-soft, rgba(16,185,129,.14))', color: 'var(--pos, #047857)' }}>
                Copie validée le {fmtDate(work.validated_at)} : l’élève ne peut plus la renvoyer. <button onClick={reopen} style={{ ...btnGhost, padding: '2px 8px', fontSize: 12, marginLeft: 8 }}>Rouvrir</button>
              </div>
            )}
            {autoPrefilled && !locked && (
              <div style={{ ...note, background: 'var(--indigo-soft, rgba(99,102,241,.12))', color: 'var(--indigo)' }}>
                Les réponses à choix ont été corrigées automatiquement (✓ / ✗ dans la copie, cases pré-cochées). Vérifie, corrige les questions ouvertes, puis enregistre.
              </div>
            )}
            {!autoPrefilled && !locked && work.modified_after_correction && hasAuto(def) && (
              <div style={{ ...note, background: 'var(--warn-soft, rgba(245,158,11,.14))', color: 'var(--warn, #b45309)' }}>
                Copie renvoyée après correction : le bouton « Auto » d’une question refait la correction automatique sur le nouvel envoi.
              </div>
            )}

            {def.questions.map((q) => {
              const c = corr.questions[q.id];
              const pts = questionPoints(q);
              return (
                <section key={q.id} style={{ marginBottom: 18, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', background: 'var(--surface-3)' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{q.num}. {q.titre}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{q.bonus ? 'bonus, non compté' : `${fmtPts(pts)} / ${fmtPts(q.points)}`}{q.auto && ' · corrigée automatiquement'}</span>
                    {!locked && (
                      <>
                        {q.criteres.some((cr) => cr.auto) && (
                          <button onClick={() => redoAuto(q)} style={{ ...btnGhost, padding: '2px 8px', fontSize: 11 }} title="Refaire la correction automatique d’après les réponses de l’élève">Auto</button>
                        )}
                        <button onClick={() => setAll(q, true)} style={{ ...btnGhost, padding: '2px 8px', fontSize: 11 }}>Tout</button>
                        <button onClick={() => setAll(q, false)} style={{ ...btnGhost, padding: '2px 8px', fontSize: 11 }}>Rien</button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 0 }}>
                    <div style={{ padding: 12, borderRight: '1px solid var(--border)', fontSize: 13 }}>
                      <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--text-muted)' }}>{q.consigne}</p>
                      {renderAnswer(q)}
                    </div>
                    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {q.criteres.map((cr) => {
                        const on = !!c?.criteres?.[cr.id];
                        return (
                          <label key={cr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, cursor: locked ? 'default' : 'pointer', padding: '4px 6px', borderRadius: 6, background: on ? 'var(--pos-soft, rgba(16,185,129,.12))' : 'transparent' }}>
                            <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(q.id, cr.id)} style={{ marginTop: 2 }} />
                            <span style={{ flex: 1 }}>{cr.nom}{cr.auto && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)' }}>auto</span>}</span>
                            <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{q.bonus ? '★' : `${fmtPts(cr.points)} pt`}</span>
                          </label>
                        );
                      })}
                      <textarea
                        value={c?.remarque ?? ''}
                        onChange={(e) => setRemark(q.id, e.target.value)}
                        disabled={locked}
                        placeholder="Remarque pour l’élève (facultatif)"
                        rows={2}
                        style={{ ...inp, marginTop: 4, fontSize: 12.5, resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </section>
              );
            })}

            {/* Compétences + conseils */}
            <section style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Compétences et conseils</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, marginBottom: 10 }}>
                {(def.competences ?? []).map((comp) => (
                  <div key={comp.id}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{comp.nom}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {SKILL_LEVELS.map((lab, i) => {
                        const lvl = i + 1;
                        const on = skills[comp.id] === lvl;
                        return (
                          <button key={lvl} disabled={locked} onClick={() => { setSkills((s) => ({ ...s, [comp.id]: on ? 0 : lvl })); setDirty(true); }} title={lab}
                            style={{ ...btnGhost, padding: '4px 8px', fontSize: 11, background: on ? 'var(--indigo)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--text)' }}>
                            {lvl}
                          </button>
                        );
                      })}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>{skills[comp.id] ? SKILL_LEVELS[skills[comp.id] - 1] : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
              <textarea value={advice} onChange={(e) => { setAdvice(e.target.value); setDirty(true); }} disabled={locked} rows={3} placeholder="Conseils pour la prochaine fois (imprimés sur la copie)" style={{ ...inp, resize: 'vertical' }} />
            </section>

            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {versions === null ? (
                <button onClick={() => fetchWorkVersions(work.id).then(setVersions).catch(() => setVersions([]))} style={{ ...btnGhost, fontSize: 12 }}>Historique des envois</button>
              ) : versions.length === 0 ? 'Aucun envoi archivé.' : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>{versions.map((v) => <li key={v.id}>Envoi n°{v.version} · {fmtDate(v.submitted_at)}</li>)}</ul>
              )}
            </div>
          </div>

          {showExpected && (
            <div style={{ overflow: 'auto', padding: 14, borderLeft: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
              {activity.expected_answers || <span style={{ color: 'var(--text-dim)' }}>Aucun corrigé attendu saisi (bouton « Corrigé attendu » sur la page Productions).</span>}
            </div>
          )}
        </div>

        {/* Pied */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
            {dirty ? 'Modifications non enregistrées.' : work.corrected_at ? `Corrigée le ${fmtDate(work.corrected_at)}${work.corrected_by === 'claude' ? ' par Claude' : ''}.` : 'Pas encore corrigée.'}
          </span>
          <button onClick={remove} disabled={saving} style={{ ...btnGhost, color: 'var(--neg)' }}>Supprimer cette copie</button>
          {!locked && sameContent.length > 0 && (
            <button onClick={() => persist([work, ...sameContent], false)} disabled={saving} style={btnGhost} title={sameContent.map((m) => m.students?.pseudo).join(', ')}>
              Enregistrer pour le binôme ({sameContent.length + 1})
            </button>
          )}
          {!locked && <button onClick={() => persist([work], false)} disabled={saving} style={btnGhost}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>}
          {!locked && (
            <button onClick={() => persist(sameContent.length ? [work, ...sameContent] : [work], true)} disabled={saving} style={btnPrimary}>
              Valider{sameContent.length ? ` (binôme, ${sameContent.length + 1})` : ''} · {fmtPts(total)} / {activity.bareme_total}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const tdSmall: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top' };
const note: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 14 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 };
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };
const btnBase: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
