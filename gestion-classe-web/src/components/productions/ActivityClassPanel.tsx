import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { WorkCorrection } from './WorkCorrection';
import { MoreMenu } from '../MoreMenu';
import { Badge } from '../AiRunPanel';
import {
  fetchActivityAssessments,
  fetchClassStudents,
  fetchWorks,
  gradableWorks,
  groupWorks,
  sendGradesToCarnet,
  updateActivity,
  WORK_STATUS_LABEL,
  type ActivityAssessmentRow,
  type ActivityRow,
  type WorkGroup,
  type WorkRow,
  type WorkStatus,
} from '../../lib/productionsQueries';
import { worksToSync } from '../../lib/productionSync';
import { fetchAssessmentGrades } from '../../lib/evaluationQueries';
import { printWorks } from '../../lib/productionsPrint';
import { buildClaudeExport, downloadText, importClaudeCorrections, parseClaudeCorrection } from '../../lib/productionsExport';

/**
 * Une activité numérique pour une classe : en-tête (corrigé attendu, envois ouverts ou fermés),
 * compteurs, gestes (imprimer, notes au carnet, correction par Claude par fichier), puis la même
 * mise en page que les copies d'éval (CopyViewer) : élèves à gauche, copie au centre, correction
 * et analyse à droite (WorkCorrection). Partagé par la page Productions et la
 * fiche d'une éval liée à une activité (hub Évaluations, phase 6).
 *
 * Dans la fiche (`assessmentId` fourni), la note suit la correction (Q5 du plan) : chaque
 * correction enregistrée ou importée part au carnet, et à l'ouverture les notes en retard sur
 * une correction plus récente sont mises à jour. Une note retouchée à la main dans le carnet
 * après la correction n'est pas écrasée.
 */

const STATUS_ORDER: WorkStatus[] = ['draft', 'submitted', 'corrected', 'validated'];

/** Statut d'un groupe : celui de tous ses membres, ou le moins avancé s'ils diffèrent (il reste du travail). */
function groupStatus(g: WorkGroup): WorkStatus {
  return g.works.reduce<WorkStatus>((s, w) => (STATUS_ORDER.indexOf(w.status) < STATUS_ORDER.indexOf(s) ? w.status : s), 'validated');
}

const groupNames = (g: WorkGroup): string => g.works.map((w) => w.students?.pseudo ?? 'Élève').join(', ');

type Filter = 'all' | 'todo' | 'done' | 'none';
const FILTERS: [Filter, string][] = [['all', 'Tous'], ['todo', 'À corriger'], ['done', 'Corrigées'], ['none', 'Rien reçu']];
/** À corriger : envoyée sans correction, ou renvoyée après correction. */
const needsCorrection = (g: WorkGroup) => g.works.some((w) => w.status === 'submitted' || (w.modified_after_correction && w.status !== 'validated'));

const STATUS_COLOR: Record<WorkStatus, { bg: string; fg: string }> = {
  draft: { bg: 'var(--surface-3)', fg: 'var(--text-muted)' },
  submitted: { bg: 'var(--indigo-soft, rgba(99,102,241,.12))', fg: 'var(--indigo)' },
  corrected: { bg: 'var(--warn-soft, rgba(245,158,11,.14))', fg: 'var(--warn, #b45309)' },
  validated: { bg: 'var(--pos-soft, rgba(16,185,129,.14))', fg: 'var(--pos, #047857)' },
};


export function ActivityClassPanel({
  activity,
  classId,
  className,
  classPicker,
  assessmentId,
  initialStudentId,
  onActivityChange,
  onWorksLoaded,
  onGradesSynced,
}: {
  activity: ActivityRow;
  classId: string;
  className: string;
  /** Page Productions : le sélecteur de classe, affiché dans le bloc des compteurs. */
  classPicker?: React.ReactNode;
  /** Fiche de l'éval liée : la note suit la correction, sans bouton « Envoyer au carnet ». */
  assessmentId?: string;
  /** Ouvre la production de cet élève à l'arrivée (lien depuis la modale du carnet). */
  initialStudentId?: string | null;
  onActivityChange: (a: ActivityRow) => void;
  /** Toutes les productions de l'activité (page Productions : classes présentes). */
  onWorksLoaded?: (works: WorkRow[]) => void;
  /** Des notes du carnet viennent d'être mises à jour (fiche : recharger). */
  onGradesSynced?: () => void;
}) {
  const { toast: showToast, confirm } = useUIFeedback();
  const { user } = useAuth();
  const [works, setWorks] = useState<WorkRow[]>([]);
  const [links, setLinks] = useState<ActivityAssessmentRow[]>([]);
  const [classStudents, setClassStudents] = useState<{ id: string; pseudo: string }[]>([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Élève sélectionné qui n'a rien envoyé. */
  const [emptyStudentId, setEmptyStudentId] = useState<string | null>(null);
  const [showExpected, setShowExpected] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const onWorksLoadedRef = useRef(onWorksLoaded);
  useEffect(() => { onWorksLoadedRef.current = onWorksLoaded; }, [onWorksLoaded]);

  const loadWorks = useCallback(async () => {
    setLoadingWorks(true);
    try {
      const rows = await fetchWorks(activity.id);
      setWorks(rows);
      onWorksLoadedRef.current?.(rows);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLoadingWorks(false);
    }
  }, [activity.id, showToast]);

  useEffect(() => { void loadWorks(); }, [loadWorks]);
  useEffect(() => {
    fetchActivityAssessments(activity.id).then(setLinks).catch(() => setLinks([]));
  }, [activity.id]);
  useEffect(() => {
    if (!classId) return;
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
  // Lien depuis la modale du carnet : la production de cet élève, une fois les envois chargés.
  const [initialDone, setInitialDone] = useState(false);
  if (!initialDone && initialStudentId && classWorks.length > 0) {
    setInitialDone(true);
    const w = classWorks.find((x) => x.student_id === initialStudentId);
    if (w) setOpenId(w.id);
  }
  // Rien d'ouvert : la première production à corriger, sinon la première reçue (comme la première copie scannée).
  const openIndex = openId ? ordered.findIndex((g) => g.works.some((w) => w.id === openId)) : -1;
  const openGroup = openIndex >= 0 ? ordered[openIndex] : null;
  const emptyStudent = emptyStudentId ? classStudents.find((s) => s.id === emptyStudentId) ?? null : null;
  const firstPick = ordered.find(needsCorrection) ?? ordered[0];
  if (openIndex < 0 && !emptyStudent && firstPick && !loadingWorks && !(initialStudentId && !initialDone)) setOpenId(firstPick.works[0].id);

  const [filter, setFilter] = useState<Filter>('all');
  const rowFilter = (r: (typeof rows)[number], f: Filter) =>
    f === 'all' ? true : f === 'none' ? !r.group : !!r.group && r.group.works[0].status !== 'draft' && (f === 'todo' ? needsCorrection(r.group) : !needsCorrection(r.group));
  const visible = useMemo(() => rows.filter((r) => rowFilter(r, filter)), [rows, filter]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Changer d'élève avec une correction non enregistrée : on demande, comme pour « Corriger pour ».
  const dirtyRef = useRef(false);
  const onDirtyChange = useCallback((d: boolean) => { dirtyRef.current = d; }, []);
  const canLeave = () => !dirtyRef.current || window.confirm('Modifications non enregistrées : les abandonner pour passer à un autre élève ?');
  const selectGroup = (g: WorkGroup) => { if (g.works.some((w) => w.id === openId) || !canLeave()) return; setEmptyStudentId(null); setOpenId(g.works[0].id); };
  const selectEmpty = (id: string) => { if (!canLeave()) return; setOpenId(null); setEmptyStudentId(id); };

  // ↑ ↓ : élève précédent ou suivant parmi ceux qui ont envoyé quelque chose (comme les copies d'éval).
  const moveRef = useRef<(d: 1 | -1) => void>(() => {});
  moveRef.current = (d) => {
    const cands = visible.flatMap((r) => (r.group ? [r.group] : []));
    if (cands.length === 0) return;
    const i = cands.findIndex((g) => g.works.some((w) => w.id === openId));
    selectGroup(cands[(i + d + cands.length) % cands.length]);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (e.key === 'ArrowDown') moveRef.current(1);
      else if (e.key === 'ArrowUp') moveRef.current(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const c = { draft: 0, submitted: 0, corrected: 0, validated: 0, none: 0 };
    for (const r of rows) { if (r.group) c[groupStatus(r.group)]++; else c.none++; }
    return c;
  }, [rows]);

  const gradable = useMemo(() => gradableWorks(classWorks), [classWorks]);
  const correctedGroups = useMemo(() => groups.filter((g) => g.works.every((w) => gradable.includes(w))).length, [groups, gradable]);
  const carnetLink = links.find((l) => l.class_id === classId && !l.written_assessments?.is_deleted) ?? null;

  /** Fiche : envoie au carnet les notes de ces productions (la note suit la correction). */
  const syncGrades = useCallback(async (changed: WorkRow[], silent = false) => {
    if (!assessmentId || !user) return;
    const toSend = gradableWorks(changed.filter((w) => w.class_id === classId));
    if (toSend.length === 0) return;
    try {
      await sendGradesToCarnet({ userId: user.id, activity, classId, works: toSend });
      onGradesSynced?.();
      if (!silent) showToast(`Note${toSend.length > 1 ? 's' : ''} du carnet mise${toSend.length > 1 ? 's' : ''} à jour.`, 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  }, [assessmentId, user, activity, classId, onGradesSynced, showToast]);

  // Fiche : à l'ouverture, rattrape les notes en retard sur une correction plus récente.
  const syncedOnce = useRef(false);
  useEffect(() => {
    if (!assessmentId || syncedOnce.current || loadingWorks || classWorks.length === 0) return;
    syncedOnce.current = true;
    fetchAssessmentGrades(assessmentId)
      .then((grades) => {
        const late = worksToSync(classWorks, grades);
        if (late.length > 0) return syncGrades(late, true);
      })
      .catch(() => { /* la fiche affiche déjà ses notes : rien à signaler */ });
  }, [assessmentId, loadingWorks, classWorks, syncGrades]);

  const sendToCarnet = async () => {
    if (!user || !classId) return;
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
    if (exportable.length === 0) { showToast('Aucune copie envoyée dans cette classe.', 'warning'); return; }
    const md = buildClaudeExport(activity, exportable, className);
    const slug = `${activity.key}_${className}`.replace(/[^A-Za-z0-9_-]+/g, '-');
    downloadText(`correction-claude_${slug}.md`, md);
    showToast(`${exportableCopies} copie${exportableCopies > 1 ? 's' : ''} exportée${exportableCopies > 1 ? 's' : ''} (une par groupe). Donne ce fichier à Claude, puis importe sa réponse JSON ici.`, 'success');
  };

  const importClaude = async (file: File) => {
    setImporting(true);
    try {
      const entries = parseClaudeCorrection(await file.text());
      if (entries.length === 0) throw new Error('Aucune copie reconnue dans ce fichier (il faut un tableau d’objets avec work_id).');
      const r = await importClaudeCorrections(activity, classWorks, entries);
      setWorks((ws) => ws.map((w) => r.updated.find((u) => u.id === w.id) ?? w));
      const msg = `${r.updated.length} correction${r.updated.length > 1 ? 's' : ''} importée${r.updated.length > 1 ? 's' : ''} (par Claude)${r.skipped.length ? ` · ${r.skipped.length} ignorée${r.skipped.length > 1 ? 's' : ''} : ${r.skipped.join(' ; ')}` : ''}.`;
      showToast(msg, r.updated.length ? 'success' : 'warning');
      await syncGrades(r.updated, true);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const print = () => {
    try {
      const n = printWorks(activity, classWorks, className);
      if (n === 0) showToast('Aucune copie corrigée à imprimer pour cette classe.', 'warning');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const toggleAccepting = async () => {
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
      onActivityChange({ ...activity, accepting_submissions: !activity.accepting_submissions });
      showToast(activity.accepting_submissions ? 'Envois fermés.' : 'Envois rouverts.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const saveExpected = async () => {
    try {
      await updateActivity(activity.id, { expected_answers: expectedDraft || null });
      onActivityChange({ ...activity, expected_answers: expectedDraft || null });
      setShowExpected(false);
      showToast('Corrigé attendu enregistré.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  const inFiche = !!assessmentId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{activity.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {inFiche ? 'Activité numérique' : `Clé ${activity.key}`} · définition v{activity.definition_version} · {activity.definition.questions?.length ?? 0} questions · barème /{activity.bareme_total}
            {!activity.accepting_submissions && <span style={{ marginLeft: 6, color: 'var(--neg)' }}>· envois fermés</span>}
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
          {classPicker}
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
              {inFiche
                ? <> La note du carnet suit la correction : chaque fiche corrigée met sa note à jour.</>
                : carnetLink
                  ? <> Carnet : évaluation « {carnetLink.written_assessments?.name ?? activity.title} » liée, les envois suivants mettent les notes à jour.</>
                  : <> Pas encore d’évaluation au carnet pour cette classe : elle sera créée au premier envoi (TP, coefficient 1, /{activity.bareme_total}).</>}
            </div>
            <button onClick={print} style={btnGhost} disabled={gradable.length === 0} title="Une page par élève : réponses, critères acquis, remarques, compétences, conseils">
              Imprimer les corrigées
            </button>
            {!inFiche && (
              <button onClick={sendToCarnet} style={btnPrimary} disabled={sending || gradable.length === 0 || !user}>
                {sending ? 'Envoi…' : carnetLink ? `Mettre à jour les notes au carnet (${gradable.length})` : `Envoyer les notes au carnet (${gradable.length})`}
              </button>
            )}
            <MoreMenu
              label="⋯"
              title="Actualiser, correction par Claude (fichier)"
              items={[
                { label: loadingWorks ? 'Actualisation…' : 'Actualiser les envois', onClick: () => { void loadWorks(); }, disabled: loadingWorks },
                { label: `Exporter pour Claude (${exportableCopies})`, onClick: exportClaude, disabled: exportable.length === 0, title: 'Fichier Markdown à donner à un Claude correcteur : consignes, barème, corrigé attendu et les fiches envoyées' },
                { label: importing ? 'Import…' : 'Importer la correction Claude', onClick: () => fileInput.current?.click(), disabled: importing || exportable.length === 0, title: 'Fichier JSON (ou texte contenant le bloc JSON) renvoyé par Claude : critères, remarques, compétences, conseils' },
              ]}
            />
            <input ref={fileInput} type="file" accept=".json,.md,.txt,application/json,text/plain,text/markdown" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importClaude(f); }} />
          </div>
        )}
      </div>

      {/* Élèves à gauche, copie et correction à droite : la mise en page des copies d'éval (CopyViewer). */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{ ...chip, background: filter === id ? 'var(--text)' : 'var(--surface-3)', color: filter === id ? 'var(--surface)' : 'var(--text-muted)' }}
              >
                {label} {rows.filter((r) => rowFilter(r, id)).length}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 640, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            {visible.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-dim)' }}>{rows.length === 0 ? 'Aucun élève pour cette classe.' : 'Personne ici.'}</div>
            )}
            {visible.map((r) => {
              if (!r.group) {
                const on = r.student.id === emptyStudentId && !openGroup;
                return (
                  <button key={r.student.id} onClick={() => selectEmpty(r.student.id)} style={{ ...listItem, background: on ? 'var(--indigo-soft)' : 'transparent' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' }}>{r.student.pseudo}</span>
                    <Badge tone="warn">Rien reçu</Badge>
                  </button>
                );
              }
              const g = r.group;
              const lead = g.works[0];
              const status = groupStatus(g);
              const on = g.works.some((w) => w.id === openId);
              const graded = g.works.find((w) => w.total_points != null);
              return (
                <button key={g.key} onClick={() => selectGroup(g)} style={{ ...listItem, background: on ? 'var(--indigo-soft)' : 'transparent' }}
                  title={g.works.length > 1 ? `Production de groupe : ${groupNames(g)}` : undefined}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: status === 'draft' ? 'var(--text-dim)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {groupNames(g)}
                  </span>
                  {graded && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: status === 'validated' ? 'var(--pos)' : 'var(--warn)' }}
                      title={status === 'validated' ? 'Correction validée' : 'Corrigée, pas encore validée'}>
                      {String(graded.total_points).replace('.', ',')}{status === 'validated' ? '' : '*'}
                    </span>
                  )}
                  {g.works.length > 1 && <Badge>{g.works.length}</Badge>}
                  {status === 'draft' ? <Badge>Brouillon</Badge>
                    : needsCorrection(g) ? <Badge tone="info">{lead.modified_after_correction ? 'Renvoyée' : 'À corriger'}</Badge>
                    : status === 'validated' ? <Badge tone="ok">Validée</Badge>
                    : <Badge tone="warn">Corrigée</Badge>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          {openGroup ? (
            <WorkCorrection
              group={openGroup.works}
              activity={activity}
              onSaved={(updated) => {
                setWorks((ws) => ws.map((w) => updated.find((u) => u.id === w.id) ?? w));
                void syncGrades(updated);
              }}
              onDeleted={(id) => {
                // La vue reste sur ce qui reste du groupe ; si c'était le dernier membre, on passe à la suivante.
                const rest = openGroup.works.find((w) => w.id !== id);
                dirtyRef.current = false;
                setOpenId(rest ? rest.id : null);
                setWorks((ws) => ws.filter((w) => w.id !== id));
              }}
              onDirtyChange={onDirtyChange}
              position={{ index: openIndex, total: ordered.length }}
              toast={showToast}
            />
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10 }}>
              {loadingWorks ? 'Chargement des productions…'
                : emptyStudent ? `${emptyStudent.pseudo} n’a rien envoyé pour cette activité.`
                : 'Aucune production reçue dans cette classe.'}
            </div>
          )}
        </div>
      </div>

      {showExpected && (
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
    </div>
  );
}

/* ---------- styles ---------- */

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 };
const chip: React.CSSProperties = { border: 'none', borderRadius: 999, padding: '3px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const listItem: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '7px 10px',
  border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
};
const pill: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(20, 25, 40, 0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, color: 'var(--text)' };
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 };
const btnBase: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
