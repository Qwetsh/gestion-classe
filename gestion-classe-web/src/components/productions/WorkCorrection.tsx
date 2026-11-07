import { useEffect, useMemo, useState } from 'react';
import {
  applyAuto,
  checkQ1Cell,
  computeTotal,
  deleteWork,
  hasAuto,
  q1Label,
  sameCorrection,
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
 * l'élève ne peut plus renvoyer). Pour une production de groupe (élèves qui ont envoyé ensemble,
 * voir groupWorks), tout part par défaut pour tous les membres ; « Corriger pour » permet de choisir
 * un membre seul, qui garde alors sa propre correction et sa propre note.
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
/** Comparaison titre / consigne : sans casse, ponctuation finale ni espaces. */
const norm = (s: string) => s.toLowerCase().replace(/[\s.:…?!]+/g, ' ').trim();
const noAnswer = <span style={{ color: 'var(--neg)', fontSize: 13, fontStyle: 'italic', fontWeight: 500 }}>pas de réponse</span>;

function emptyCorrection(): Correction { return { questions: {} }; }

/** Correction de départ : celle enregistrée, sinon la correction automatique des réponses à choix. */
function initialCorrection(work: WorkRow, activity: ActivityRow): { corr: Correction; auto: boolean } {
  if (work.correction) return { corr: work.correction, auto: false };
  if (!hasAuto(activity.definition)) return { corr: emptyCorrection(), auto: false };
  return { corr: applyAuto(activity.definition, emptyCorrection(), work.content), auto: true };
}

interface Props {
  /** Membres de la production (un seul si l'élève était seul), triés par pseudo : même contenu envoyé. */
  group: WorkRow[];
  activity: ActivityRow;
  onClose: () => void;
  onSaved: (updated: WorkRow[]) => void;
  onDeleted: (workId: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { index: number; total: number };
  toast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const pseudo = (w: WorkRow) => w.students?.pseudo ?? 'Élève';

export function WorkCorrection({ group, activity, onClose, onSaved, onDeleted, onPrev, onNext, position, toast }: Props) {
  const def = activity.definition;
  // « Corriger pour » : tout le groupe, ou l'id d'un membre seul. Une autre production ouverte repart sur tout le groupe.
  const [target, setTarget] = useState<'group' | string>('group');
  const groupIds = group.map((w) => w.id).join(',');
  useEffect(() => { setTarget('group'); }, [groupIds]);
  const member = target === 'group' ? null : group.find((w) => w.id === target) ?? null;
  // Copie affichée : le membre choisi, ou le premier du groupe (tous ont envoyé le même contenu).
  const work = member ?? group[0];
  const scope = member ? [member] : group;
  const editable = scope.filter((w) => w.status !== 'validated');
  const content = work.content as Record<string, unknown>;
  const [corr, setCorr] = useState<Correction>(() => initialCorrection(work, activity).corr);
  const [autoPrefilled, setAutoPrefilled] = useState(() => initialCorrection(work, activity).auto);
  const [advice, setAdvice] = useState(work.advice ?? '');
  const [skills, setSkills] = useState<Record<string, number>>(() => work.skills ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showExpected, setShowExpected] = useState(false);
  const [versions, setVersions] = useState<WorkVersionRow[] | null>(null);
  /** Questions dont la remarque (vide) a été ouverte : repliée sinon, pour garder la vue compacte. */
  const [openRemarks, setOpenRemarks] = useState<Set<string>>(new Set());

  // Nouvelle copie ouverte (navigation) : repartir de sa correction.
  useEffect(() => {
    const init = initialCorrection(work, activity);
    setCorr(init.corr);
    setAutoPrefilled(init.auto);
    setAdvice(work.advice ?? '');
    setSkills(work.skills ?? {});
    setDirty(false);
    setVersions(null);
    setOpenRemarks(new Set());
  }, [work, activity]);

  // La page derrière ne défile pas tant que la correction est ouverte (comme Modal.tsx).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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

  /** Enregistre (et valide si demandé) la correction affichée pour les membres choisis encore modifiables. */
  const persist = async (validate: boolean) => {
    const targets = editable;
    setSaving(true);
    try {
      const updated: WorkRow[] = [];
      const savedSkills = Object.keys(skills).length ? skills : null;
      for (const w of targets) {
        await saveWorkCorrection(w.id, { correction: corr, advice: advice || null, skills: savedSkills, totalPoints: total, correctedBy: 'prof' });
        let status: WorkRow['status'] = 'corrected';
        let validated_at = w.validated_at;
        if (validate) { await setWorkStatus(w.id, 'validated'); status = 'validated'; validated_at = new Date().toISOString(); }
        updated.push({ ...w, correction: corr, advice: advice || null, skills: savedSkills, total_points: total, corrected_by: 'prof', corrected_at: new Date().toISOString(), status, validated_at, modified_after_correction: false });
      }
      onSaved(updated);
      setDirty(false);
      const forWho = targets.length > 1 ? ` pour ${targets.length} élèves` : group.length > 1 ? ` pour ${pseudo(targets[0])}` : '';
      toast(validate ? `Validée${forWho} : ${fmtPts(total)} / ${activity.bareme_total}.` : `Correction enregistrée${forWho}.`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    const targets = scope.filter((w) => w.status === 'validated');
    try {
      for (const w of targets) await setWorkStatus(w.id, 'corrected');
      onSaved(targets.map((w) => ({ ...w, status: 'corrected', validated_at: null })));
      toast(targets.length > 1 ? `Copies rouvertes (${targets.length} élèves) : ils peuvent renvoyer, et tu peux modifier la correction.` : 'Copie rouverte : l’élève peut renvoyer, et tu peux modifier la correction.', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  // Suppression d'un seul élève à la fois : dans un groupe, il faut d'abord le choisir dans « Corriger pour ».
  // (onDeleted laisse la page décider : la fenêtre reste ouverte sur le reste du groupe.)
  const removable = member ?? (group.length === 1 ? group[0] : null);
  const remove = async () => {
    if (!removable) return;
    if (!window.confirm(`Supprimer définitivement la copie de ${pseudo(removable)} (et son historique) ? Le prochain envoi de l’élève repartira de zéro.`)) return;
    try {
      await deleteWork(removable.id);
      onDeleted(removable.id);
      toast('Copie supprimée.', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const chooseTarget = (t: 'group' | string) => {
    const next = t === 'group' ? group[0] : group.find((w) => w.id === t);
    // Garder la même copie à l'écran garde les modifications ; en changer recharge sa correction enregistrée.
    if (dirty && next && next.id !== work.id && !window.confirm('Modifications non enregistrées : les abandonner pour afficher la correction de cet élève ?')) return;
    setTarget(t);
  };

  const locked = editable.length === 0;
  const validatedApart = !member && !locked ? group.filter((w) => w.status === 'validated') : [];
  const correctedApart = !member && group.length > 1 && group.some((w) => w.correction) && !sameCorrection(group);

  const renderAnswer = (q: ActivityQuestion) => {
    const v = content[q.id];
    if (q.type === 'tableau') {
      const lignes = (v ?? {}) as Record<string, Q1Row>;
      return (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(q.champs ?? []).map((ch) => (
            <div key={ch.id}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{ch.nom}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{o[ch.id] || noAnswer}</div>
            </div>
          ))}
        </div>
      );
    }
    const t = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
    return <div style={{ whiteSpace: 'pre-wrap' }}>{t || noAnswer}</div>;
  };

  const questionPoints = (q: ActivityQuestion) => {
    const c = corr.questions[q.id];
    if (!c) return 0;
    if (typeof c.points === 'number') return c.points;
    return q.criteres.reduce((s, cr) => s + (c.criteres?.[cr.id] ? cr.points : 0), 0);
  };

  return (
    <div style={overlay} onClick={onClose}>
      {/* Fenêtre centrée, assez étroite pour garder l'œil près des réponses ; le corrigé attendu l'élargit de sa colonne. */}
      <div style={{ ...modal, width: showExpected ? 'min(1108px, 97vw)' : 'min(768px, 97vw)', height: 'min(84vh, 900px)', boxShadow: '0 18px 48px rgba(17, 24, 39, 0.28)', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onPrev} disabled={!onPrev} style={{ ...btnGhost, padding: '4px 10px' }} title="Copie précédente (Alt + ←)">←</button>
            <button onClick={onNext} disabled={!onNext} style={{ ...btnGhost, padding: '4px 10px' }} title="Copie suivante (Alt + →)">→</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {group.map(pseudo).join(', ')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {work.classes?.name ?? ''}{position && ` · ${position.index + 1}/${position.total}`}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {WORK_STATUS_LABEL[work.status]}{work.corrected_by === 'claude' && ' par Claude'} · envoi n°{work.version} le {fmtDate(work.submitted_at)}
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

        {group.length > 1 && (
          <div role="radiogroup" aria-label="Corriger pour" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '5px 14px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
            <span style={{ fontWeight: 600, marginRight: 4 }}>Corriger pour :</span>
            {[{ id: 'group', label: `tout le groupe (${group.length})` }, ...group.map((w) => ({ id: w.id, label: `${pseudo(w)} uniquement${w.status === 'validated' ? ' · validée' : ''}` }))].map((o) => {
              const on = target === o.id;
              return (
                <button key={o.id} role="radio" aria-checked={on} onClick={() => chooseTarget(o.id)}
                  style={{ ...btnGhost, padding: '3px 10px', fontSize: 12, background: on ? 'var(--indigo)' : 'var(--surface-3)', color: on ? '#fff' : 'var(--text)' }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Corps */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: showExpected ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)' }}>
          <div style={{ overflow: 'auto', overscrollBehavior: 'contain', padding: '10px 14px' }}>
            {locked && (
              <div style={{ ...note, background: 'var(--pos-soft, rgba(16,185,129,.14))', color: 'var(--pos, #047857)' }}>
                {scope.length > 1
                  ? <>Copie validée le {fmtDate(work.validated_at)} pour tout le groupe : plus personne ne peut la renvoyer.</>
                  : <>Copie validée le {fmtDate(work.validated_at)} : l’élève ne peut plus la renvoyer.</>}
                <button onClick={reopen} style={{ ...btnGhost, padding: '2px 8px', fontSize: 12, marginLeft: 8 }}>{scope.length > 1 ? `Rouvrir pour le groupe (${scope.length})` : 'Rouvrir'}</button>
              </div>
            )}
            {validatedApart.length > 0 && (
              <div style={{ ...note, background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
                {validatedApart.map(pseudo).join(', ')} : copie déjà validée, elle ne sera pas modifiée. Pour la rouvrir, choisis cet élève dans « Corriger pour ».
              </div>
            )}
            {correctedApart && (
              <div style={{ ...note, background: 'var(--warn-soft, rgba(245,158,11,.14))', color: 'var(--warn, #b45309)' }}>
                Les membres ont été corrigés à part ({group.map((w) => `${pseudo(w)} ${w.total_points != null ? `${fmtPts(Number(w.total_points))} / ${activity.bareme_total}` : 'pas corrigé'}`).join(' · ')}).
                {' '}Correction affichée : {pseudo(work)}. L’enregistrer ici la donnera à {editable.map(pseudo).join(', ')}.
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

            {def.questions.map((q, qi) => {
              const c = corr.questions[q.id];
              const pts = questionPoints(q);
              const full = !q.bonus && pts >= q.points && q.points > 0;
              // La consigne répète souvent le titre (« Les 4 symptômes… sont : ») : on ne l'affiche que si elle apporte quelque chose.
              const consigne = q.consigne && norm(q.consigne) !== norm(q.titre) ? q.consigne : '';
              const remarkOpen = !!c?.remarque || openRemarks.has(q.id);
              return (
                <section key={q.id} className="gc-wc__q" style={{ borderTop: qi ? '1px solid var(--border)' : undefined }}>
                  {/* Gauche : la question en une ligne, puis la réponse de l'élève, mise en avant. */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {q.num}. {q.titre}
                    </div>
                    {consigne && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 1 }}>{consigne}</div>}
                    <div className="gc-wc__answer">{renderAnswer(q)}</div>
                  </div>
                  {/* Droite : points, critères, remarque (repliée tant qu'elle est vide). */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: full ? 'var(--pos, #047857)' : 'var(--text)', flex: 1 }}>
                        {q.bonus ? 'Bonus ★' : <>{fmtPts(pts)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {fmtPts(q.points)}</span></>}
                        {q.auto && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 500, color: 'var(--text-dim)' }}>auto</span>}
                      </span>
                      {!locked && (
                        <>
                          {q.criteres.some((cr) => cr.auto) && (
                            <button onClick={() => redoAuto(q)} style={miniBtn} title="Refaire la correction automatique d’après les réponses de l’élève">Auto</button>
                          )}
                          <button onClick={() => setAll(q, true)} style={miniBtn} title="Cocher tous les critères">Tout</button>
                          <button onClick={() => setAll(q, false)} style={miniBtn} title="Décocher tous les critères">Rien</button>
                        </>
                      )}
                    </div>
                    {q.criteres.map((cr) => {
                      const on = !!c?.criteres?.[cr.id];
                      return (
                        <label key={cr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, lineHeight: 1.35, cursor: locked ? 'default' : 'pointer', padding: '2px 4px', borderRadius: 5, background: on ? 'var(--pos-soft, rgba(16,185,129,.12))' : 'transparent', color: on ? 'var(--text)' : 'var(--text-muted)' }}>
                          <input type="checkbox" checked={on} disabled={locked} onChange={() => toggle(q.id, cr.id)} style={{ marginTop: 1 }} />
                          <span style={{ flex: 1 }}>{cr.nom}{cr.auto && <span style={{ marginLeft: 5, fontSize: 10, color: 'var(--text-dim)' }}>auto</span>}</span>
                          <span style={{ color: 'var(--text-dim)', whiteSpace: 'nowrap', fontSize: 11 }}>{q.bonus ? '★' : `${fmtPts(cr.points)}`}</span>
                        </label>
                      );
                    })}
                    {remarkOpen ? (
                      <textarea
                        value={c?.remarque ?? ''}
                        onChange={(e) => setRemark(q.id, e.target.value)}
                        disabled={locked}
                        placeholder="Remarque pour l’élève"
                        rows={1}
                        autoFocus={!c?.remarque}
                        style={{ ...inp, marginTop: 4, padding: '4px 8px', fontSize: 12, resize: 'vertical', minHeight: 28 }}
                      />
                    ) : !locked && (
                      <button onClick={() => setOpenRemarks((s) => new Set(s).add(q.id))} style={{ ...linkMini, marginTop: 2 }}>+ remarque</button>
                    )}
                  </div>
                </section>
              );
            })}

            {/* Compétences + conseils */}
            <section style={{ borderTop: '1px solid var(--border)', padding: '10px 0', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Compétences et conseils</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginBottom: 8 }}>
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
              <textarea value={advice} onChange={(e) => { setAdvice(e.target.value); setDirty(true); }} disabled={locked} rows={2} placeholder="Conseils pour la prochaine fois (imprimés sur la copie)" style={{ ...inp, fontSize: 12.5, padding: '6px 8px', resize: 'vertical' }} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
            {dirty ? 'Modifications non enregistrées.' : work.corrected_at ? `Corrigée le ${fmtDate(work.corrected_at)}${work.corrected_by === 'claude' ? ' par Claude' : ''}.` : 'Pas encore corrigée.'}
          </span>
          {removable && (
            <button onClick={remove} disabled={saving} style={{ ...btnGhost, color: 'var(--neg)' }}>
              {group.length > 1 ? `Supprimer la copie de ${pseudo(removable)}` : 'Supprimer cette copie'}
            </button>
          )}
          {!locked && (
            <button onClick={() => persist(false)} disabled={saving} style={btnGhost} title={editable.map(pseudo).join(', ')}>
              {saving ? 'Enregistrement…' : editable.length > 1 ? `Enregistrer pour le groupe (${editable.length})` : group.length > 1 ? `Enregistrer pour ${pseudo(editable[0])}` : 'Enregistrer'}
            </button>
          )}
          {!locked && (
            <button onClick={() => persist(true)} disabled={saving} style={btnPrimary} title={editable.map(pseudo).join(', ')}>
              Valider{editable.length > 1 ? ` le groupe (${editable.length})` : group.length > 1 ? ` pour ${pseudo(editable[0])}` : ''} · {fmtPts(total)} / {activity.bareme_total}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const tdSmall: React.CSSProperties = { padding: '4px 6px', verticalAlign: 'top' };
const note: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, fontSize: 12, marginBottom: 8 };
const miniBtn: React.CSSProperties = {
  padding: '1px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)',
};
const linkMini: React.CSSProperties = {
  background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  color: 'var(--indigo)', fontFamily: 'inherit',
};
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 };
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };
const btnBase: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
