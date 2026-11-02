import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { WorkCorrection } from '../components/productions/WorkCorrection';
import { MoreMenu } from '../components/MoreMenu';
import {
  autoPoints,
  fetchActivities,
  fetchActivityAssessments,
  fetchWorks,
  fetchClassStudents,
  gradableWorks,
  groupWorks,
  sameCorrection,
  sendGradesToCarnet,
  updateActivity,
  WORK_STATUS_LABEL,
  type ActivityAssessmentRow,
  type ActivityRow,
  type WorkGroup,
  type WorkRow,
  type WorkStatus,
} from '../lib/productionsQueries';
import { printWorks } from '../lib/productionsPrint';
import { buildClaudeExport, downloadText, importClaudeCorrections, parseClaudeCorrection } from '../lib/productionsExport';

/**
 * Productions : les fiches d'activité que les élèves remplissent dans une application
 * (« Terre en mouvement »…) et envoient avec leur code. Ici : lecture et suivi des envois.
 * La correction par critères est dans components/productions/WorkCorrection.tsx.
 * Par classe : « Envoyer les notes au carnet » (évaluation TP coef 1 créée au premier envoi, puis mise à jour)
 * et « Imprimer les corrigées » (lib/productionsPrint.ts). Dans le menu ⋯ : « Actualiser », et la correction par
 * Claude par fichier — « Exporter pour Claude » (document Markdown avec consignes, barème, corrigé et fiches) puis
 * « Importer la correction Claude » (JSON renvoyé), voir lib/productionsExport.ts.
 * Le bouton de ligne s'appelle « Ouvrir » : la fenêtre dit elle-même s'il reste à corriger (« Corriger » est
 * réservé, dans Évaluations, à la correction d'une copie par l'API Claude).
 * Une ligne par production : les élèves qui ont envoyé ensemble depuis un poste (groupWorks) n'en font qu'une,
 * et la correction part pour tout le groupe sauf si le prof choisit un membre seul dans la fenêtre.
 * Les élèves qui n'ont rien envoyé gardent chacun leur ligne, à leur place dans l'ordre alphabétique.
 */

const STATUS_ORDER: WorkStatus[] = ['draft', 'submitted', 'corrected', 'validated'];

/** Statut d'un groupe : celui de tous ses membres, ou le moins avancé s'ils diffèrent (il reste du travail). */
function groupStatus(g: WorkGroup): WorkStatus {
  return g.works.reduce<WorkStatus>((s, w) => (STATUS_ORDER.indexOf(w.status) < STATUS_ORDER.indexOf(s) ? w.status : s), 'validated');
}

const groupNames = (g: WorkGroup): string => g.works.map((w) => w.students?.pseudo ?? 'Élève').join(', ');

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

export function Productions() {
  const { toast: showToast, confirm } = useUIFeedback();
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [links, setLinks] = useState<ActivityAssessmentRow[]>([]);   // évaluations du carnet liées, par classe
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [classStudents, setClassStudents] = useState<{ id: string; pseudo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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
  useEffect(() => {
    if (!activityId) { setLinks([]); return; }
    fetchActivityAssessments(activityId).then(setLinks).catch(() => setLinks([]));
  }, [activityId]);

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

  const classWorks = useMemo(() => works.filter((w) => w.class_id === classId), [works, classId]);
  const groups = useMemo(() => groupWorks(classWorks), [classWorks]);

  // Une ligne par production, plus une par élève qui n'a rien envoyé, dans l'ordre alphabétique.
  const rows = useMemo(() => {
    const sent = new Set(classWorks.map((w) => w.student_id));
    const out: ({ group: WorkGroup; student?: undefined } | { group?: undefined; student: { id: string; pseudo: string } })[] = [
      ...groups.map((group) => ({ group })),
      ...classStudents.filter((s) => !sent.has(s.id)).map((student) => ({ student })),
    ];
    const name = (r: (typeof out)[number]) => (r.group ? r.group.works[0].students?.pseudo ?? '' : r.student.pseudo);
    return out.sort((a, b) => name(a).localeCompare(name(b)));
  }, [groups, classStudents, classWorks]);

  // Productions de la classe dans l'ordre du tableau, pour passer de l'une à l'autre.
  const ordered = useMemo(() => rows.flatMap((r) => (r.group ? [r.group] : [])), [rows]);
  const openIndex = openId ? ordered.findIndex((g) => g.works.some((w) => w.id === openId)) : -1;
  const openGroup = openIndex >= 0 ? ordered[openIndex] : null;

  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, corrected: 0, validated: 0, none: 0 };
    for (const r of rows) { if (r.group) c[groupStatus(r.group)]++; else c.none++; }
    return c;
  }, [rows]);

  const gradable = useMemo(() => gradableWorks(classWorks), [classWorks]);
  const correctedGroups = useMemo(() => groups.filter((g) => g.works.every((w) => gradable.includes(w))).length, [groups, gradable]);
  const className = classOptions.find(([id]) => id === classId)?.[1] ?? '';
  const carnetLink = links.find((l) => l.class_id === classId && !l.written_assessments?.is_deleted) ?? null;

  const sendToCarnet = async () => {
    if (!activity || !user || !classId) return;
    const msg = carnetLink
      ? `Mettre à jour ${gradable.length} note${gradable.length > 1 ? 's' : ''} dans l’évaluation « ${carnetLink.written_assessments?.name ?? activity.title} » (${className}) ?`
      : `Créer l’évaluation « ${activity.title} » (${className}, TP, coefficient 1, /${activity.bareme_total}) dans le carnet et y envoyer ${gradable.length} note${gradable.length > 1 ? 's' : ''} ?`;
    if (!window.confirm(msg)) return;
    setSending(true);
    try {
      const r = await sendGradesToCarnet({ userId: user.id, activity, classId, works: classWorks });
      if (r.created) setLinks(await fetchActivityAssessments(activity.id));
      showToast(`${r.sent} note${r.sent > 1 ? 's' : ''} envoyée${r.sent > 1 ? 's' : ''} au carnet${r.created ? ' (évaluation créée)' : ''}. Onglet Évaluations → Carnet.`, 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const exportable = useMemo(() => classWorks.filter((w) => w.status !== 'draft'), [classWorks]);
  const exportableCopies = useMemo(() => groupWorks(exportable).length, [exportable]);   // une copie par groupe

  const exportClaude = () => {
    if (!activity) return;
    if (exportable.length === 0) { showToast('Aucune copie envoyée dans cette classe.', 'warning'); return; }
    const md = buildClaudeExport(activity, exportable, className);
    const slug = `${activity.key}_${className}`.replace(/[^A-Za-z0-9_-]+/g, '-');
    downloadText(`correction-claude_${slug}.md`, md);
    showToast(`${exportableCopies} copie${exportableCopies > 1 ? 's' : ''} exportée${exportableCopies > 1 ? 's' : ''} (une par groupe). Donne ce fichier à Claude, puis importe sa réponse JSON ici.`, 'success');
  };

  const importClaude = async (file: File) => {
    if (!activity) return;
    setImporting(true);
    try {
      const entries = parseClaudeCorrection(await file.text());
      if (entries.length === 0) throw new Error('Aucune copie reconnue dans ce fichier (il faut un tableau d’objets avec work_id).');
      const r = await importClaudeCorrections(activity, classWorks, entries);
      setWorks((ws) => ws.map((w) => r.updated.find((u) => u.id === w.id) ?? w));
      const msg = `${r.updated.length} correction${r.updated.length > 1 ? 's' : ''} importée${r.updated.length > 1 ? 's' : ''} (par Claude)${r.skipped.length ? ` · ${r.skipped.length} ignorée${r.skipped.length > 1 ? 's' : ''} : ${r.skipped.join(' ; ')}` : ''}.`;
      showToast(msg, r.updated.length ? 'success' : 'warning');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const print = () => {
    if (!activity) return;
    try {
      const n = printWorks(activity, classWorks, className);
      if (n === 0) showToast('Aucune copie corrigée à imprimer pour cette classe.', 'warning');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const toggleAccepting = async () => {
    if (!activity) return;
    // Fermer est rarement voulu en pleine séance : on le dit clairement (une séance entière perdue le 15/10/2026).
    if (activity.accepting_submissions) {
      const ok = await confirm({
        title: `Fermer les envois de « ${activity.title} » ?`,
        message: 'Les élèves ne pourront plus envoyer leur fiche. Ce qu’ils enverront quand même sera mis de côté, et un bandeau rouge te préviendra sur toutes les pages pour que tu puisses le récupérer.',
        details: 'À faire seulement quand l’activité est terminée pour toutes tes classes (avant la correction, par exemple).',
        confirmLabel: 'Fermer les envois',
        variant: 'warning',
      });
      if (!ok) return;
    }
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
                onClick={() => { setActivityId(a.id); setClassId(''); setOpenId(null); }}
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

              {/* La classe : ses compteurs et, dessous, ce qu'on fait de ses fiches. Un seul bloc. */}
              <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  <label htmlFor="productions-classe" style={{ fontSize: 13, fontWeight: 600 }}>Classe</label>
                  <select id="productions-classe" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ ...inp, width: 160 }}>
                    {classOptions.length === 0 && <option value="">—</option>}
                    {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
                    {(['submitted', 'corrected', 'validated', 'draft'] as WorkStatus[]).map((s) => (
                      <span key={s} style={{ ...pill, background: STATUS_COLOR[s].bg, color: STATUS_COLOR[s].fg }}>{WORK_STATUS_LABEL[s]} : {counts[s]}</span>
                    ))}
                    <span style={{ ...pill, background: 'var(--surface-3)', color: 'var(--text-muted)' }}>Rien reçu : {counts.none}</span>
                  </div>
                </div>

                {classId && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                    <div style={{ flex: 1, minWidth: 240, fontSize: 12, color: 'var(--text-muted)' }}>
                      {correctedGroups} production{correctedGroups > 1 ? 's' : ''} corrigée{correctedGroups > 1 ? 's' : ''} sur {groups.length} reçue{groups.length > 1 ? 's' : ''} ({classWorks.length} élève{classWorks.length > 1 ? 's' : ''}).
                      {carnetLink
                        ? <> Carnet : évaluation « {carnetLink.written_assessments?.name ?? activity.title} » liée, les envois suivants mettent les notes à jour.</>
                        : <> Pas encore d’évaluation au carnet pour cette classe : elle sera créée au premier envoi (TP, coefficient 1, /{activity.bareme_total}).</>}
                    </div>
                    <button onClick={print} style={btnGhost} disabled={gradable.length === 0} title="Une page par élève : réponses, critères acquis, remarques, compétences, conseils">
                      Imprimer les corrigées
                    </button>
                    <button onClick={sendToCarnet} style={btnPrimary} disabled={sending || gradable.length === 0 || !user}>
                      {sending ? 'Envoi…' : carnetLink ? `Mettre à jour les notes au carnet (${gradable.length})` : `Envoyer les notes au carnet (${gradable.length})`}
                    </button>
                    <MoreMenu
                      label="⋯"
                      title="Actualiser, correction par Claude (fichier)"
                      items={[
                        { label: loadingWorks ? 'Actualisation…' : 'Actualiser les envois', onClick: () => { void loadWorks(activity.id); }, disabled: loadingWorks },
                        { label: `Exporter pour Claude (${exportableCopies})`, onClick: exportClaude, disabled: exportable.length === 0, title: 'Fichier Markdown à donner à un Claude correcteur : consignes, barème, corrigé attendu et les fiches envoyées' },
                        { label: importing ? 'Import…' : 'Importer la correction Claude', onClick: () => fileInput.current?.click(), disabled: importing || exportable.length === 0, title: 'Fichier JSON (ou texte contenant le bloc JSON) renvoyé par Claude : critères, remarques, compétences, conseils' },
                      ]}
                    />
                    <input ref={fileInput} type="file" accept=".json,.md,.txt,application/json,text/plain,text/markdown" style={{ display: 'none' }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void importClaude(f); }} />
                  </div>
                )}
              </div>

              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-3)', textAlign: 'left' }}>
                      <th style={th}>Élèves</th>
                      <th style={th}>Statut</th>
                      <th style={th}>Dernier envoi</th>
                      <th style={th}>Envois</th>
                      <th style={th}>Note</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td colSpan={6} style={{ padding: 20, color: 'var(--text-dim)', textAlign: 'center' }}>Aucun élève pour cette classe.</td></tr>
                    )}
                    {rows.map((r) => {
                      if (!r.group) return (
                        <tr key={r.student.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={td}><strong>{r.student.pseudo}</strong></td>
                          <td style={td}><span style={{ color: 'var(--text-dim)' }}>Rien reçu</span></td>
                          <td style={td}>—</td>
                          <td style={td}>—</td>
                          <td style={td}>—</td>
                          <td style={td}></td>
                        </tr>
                      );
                      const g = r.group;
                      const lead = g.works[0];
                      const status = groupStatus(g);
                      const mixedStatus = g.works.some((w) => w.status !== lead.status);
                      const fmtNote = (w: WorkRow) => (w.total_points != null ? `${String(w.total_points).replace('.', ',')} / ${activity.bareme_total}` : '—');
                      return (
                        <tr key={g.key} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={td}>
                            <strong>{groupNames(g)}</strong>
                            {g.works.length === 1 && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>seul</span>}
                          </td>
                          <td style={td}>
                            <span style={{ ...pill, background: STATUS_COLOR[status].bg, color: STATUS_COLOR[status].fg }}>
                              {WORK_STATUS_LABEL[status]}{g.works.some((w) => w.modified_after_correction) && ' · modifiée après correction'}
                            </span>
                            {mixedStatus && (
                              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
                                {g.works.map((w) => `${w.students?.pseudo ?? 'Élève'} : ${WORK_STATUS_LABEL[w.status].toLowerCase()}`).join(' · ')}
                              </div>
                            )}
                          </td>
                          <td style={td}>{fmtDate(lead.submitted_at ?? lead.updated_at)}</td>
                          <td style={td}>{lead.version}</td>
                          <td style={td}>
                            {g.works.some((w) => w.total_points != null) ? (
                              sameCorrection(g.works)
                                ? fmtNote(lead)
                                : <span title="Membres corrigés à part">{g.works.map((w) => `${w.students?.pseudo ?? 'Élève'} ${fmtNote(w)}`).join(' · ')}</span>
                            ) : lead.status !== 'draft' ? (() => {
                              // Pas encore corrigée : aperçu des points des réponses à choix (correction automatique).
                              const a = autoPoints(activity.definition, lead.content);
                              return a ? <span style={{ color: 'var(--text-muted)' }} title="Réponses à choix corrigées automatiquement, questions ouvertes à corriger">auto {String(a.points).replace('.', ',')} / {String(a.max).replace('.', ',')}</span> : '—';
                            })() : '—'}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <button
                              onClick={() => setOpenId(lead.id)}
                              style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }}
                              title={status === 'draft' ? 'Brouillon : lecture seule' : lead.correction ? 'Revoir la correction' : g.works.length > 1 ? 'Corriger cette production pour tout le groupe' : 'Corriger cette fiche'}
                            >
                              Ouvrir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {openGroup && activity && (
        <WorkCorrection
          group={openGroup.works}
          activity={activity}
          onClose={() => setOpenId(null)}
          onSaved={(updated) => setWorks((ws) => ws.map((w) => updated.find((u) => u.id === w.id) ?? w))}
          onDeleted={(id) => {
            // La fenêtre reste sur ce qui reste du groupe ; si c'était le dernier membre, elle se ferme.
            const rest = openGroup.works.find((w) => w.id !== id);
            setOpenId(rest ? rest.id : null);
            setWorks((ws) => ws.filter((w) => w.id !== id));
          }}
          onPrev={openIndex > 0 ? () => setOpenId(ordered[openIndex - 1].works[0].id) : undefined}
          onNext={openIndex >= 0 && openIndex < ordered.length - 1 ? () => setOpenId(ordered[openIndex + 1].works[0].id) : undefined}
          position={openIndex >= 0 ? { index: openIndex, total: ordered.length } : undefined}
          toast={showToast}
        />
      )}

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

/* ---------- styles ---------- */

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 };
const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 };
const th: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' };
const td: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'top' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, color: 'var(--text)' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 };
const btnBase: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
