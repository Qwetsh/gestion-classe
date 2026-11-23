import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { Icon } from '../design-system';
import { deleteSessionPhoto, fetchSessionPhotos, uploadSessionPhoto, type GroupSessionPhoto } from '../../lib/groupSessionPhotos';
import {
  absentIds,
  addCriterion,
  clampCriterionGrades,
  closeDeposit,
  fetchDepositState,
  reopenDeposit,
  type DepositState,
  copyCriteriaToTemplate,
  deleteCriterion,
  fillMissingGrades,
  firstName,
  fmtNumber,
  fmtTime,
  groupTimeline,
  groupTotal,
  isGroupGraded,
  loadTpSheet,
  movePhotoToGroup,
  photoUrls,
  saveGroupComment,
  saveGroupGrade,
  saveGroupMalus,
  saveMemberGrade,
  stepPoints,
  tpGroupColor,
  updateCriterion,
  type TpCriterion,
  type TpGroup,
  type TpMemberGrade,
  type TpSheetData,
} from '../../lib/tpGroupSheet';

/**
 * Fiche d'un TP en groupes (PLAN_tp_groupes.md, lot 2 ; maquette B1 « Fiche du TP : partie TP »).
 * Trois colonnes comme les copies d'éval et les productions : les groupes à gauche, le travail du
 * groupe au centre (photos, commentaire, faits de la séance), le barème à droite. Tout s'enregistre
 * au fil des gestes ; les notes du carnet suivent les groupes par la base (migrations 063 et 087).
 * Partagée par la page Groupes et par la fiche de l'éval « TP de groupe ».
 */

const TP = { line: '#C2410C', soft: '#FFF7F0', text: '#9A3412', edge: '#FED7AA' };

type Filter = 'all' | 'todo' | 'done';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function GroupSessionDetail({ sessionId, onDeleted, onChanged }: {
  sessionId: string;
  /** La séance vient d'être supprimée (et l'éval du carnet mise à la corbeille). */
  onDeleted?: () => void;
  /** Des points, un malus, le barème ou le matériel ont changé. */
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useUIFeedback();

  const [data, setData] = useState<TpSheetData | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GroupSessionPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<Record<string, string>>({});
  const [commentState, setCommentState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const commentTimer = useRef<number | null>(null);

  const [updateTemplate, setUpdateTemplate] = useState(false);
  const [newCriterion, setNewCriterion] = useState<{ label: string; max: string } | null>(null);
  const [adjusting, setAdjusting] = useState<{ studentId: string; value: string } | null>(null);

  const [newMaterial, setNewMaterial] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Le carnet de la page parente se recharge une fois les gestes finis, pas à chaque clic.
  const changedTimer = useRef<number | null>(null);
  const notifyChanged = useCallback(() => {
    if (changedTimer.current) window.clearTimeout(changedTimer.current);
    changedTimer.current = window.setTimeout(() => onChanged?.(), 1200);
  }, [onChanged]);

  const load = useCallback(async () => {
    try {
      const next = await loadTpSheet(sessionId);
      if (!next) { setData(null); setError('Cette séance de groupe n’existe plus.'); return; }
      setData(next);
      setComments(Object.fromEntries(next.groups.map((g) => [g.id, g.comment])));
      setSelectedId((cur) => (cur && next.groups.some((g) => g.id === cur) ? cur : next.groups[0]?.id ?? null));
      setError(null);
      setUrls(await photoUrls(next.photos));
    } catch (e) {
      console.error('Error loading TP sheet:', e);
      setError('Erreur lors du chargement du TP.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  // ---------------- Dépôt des élèves (lot 4) ----------------
  const [deposit, setDeposit] = useState<DepositState | null>(null);
  const [depositBusy, setDepositBusy] = useState(false);
  const refreshDeposit = useCallback(async () => {
    setDeposit(await fetchDepositState(sessionId));
  }, [sessionId]);
  useEffect(() => { void refreshDeposit(); }, [refreshDeposit]);

  // Dépôt ouvert : les photos des élèves arrivent ici d'elles-mêmes (toutes les 20 s)
  const depositOpen = deposit?.open === true;
  const urlsRef = useRef(urls);
  useEffect(() => { urlsRef.current = urls; }, [urls]);
  useEffect(() => {
    if (!depositOpen) return;
    const timer = window.setInterval(async () => {
      try {
        const [list, state] = await Promise.all([fetchSessionPhotos(sessionId), fetchDepositState(sessionId)]);
        setDeposit(state);
        setData((prev) => {
          if (!prev) return prev;
          const known = new Set(prev.photos.map((p) => p.id));
          const kept = new Set(list.map((p) => p.id));
          return { ...prev, photos: [...prev.photos.filter((p) => kept.has(p.id)), ...list.filter((p) => !known.has(p.id))] };
        });
        const unsigned = list.filter((p) => !urlsRef.current[p.id]);
        if (unsigned.length > 0) {
          const signed = await photoUrls(unsigned);
          setUrls((prev) => ({ ...prev, ...signed }));
        }
      } catch { /* on réessaiera au prochain tour */ }
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [depositOpen, sessionId]);

  const toggleDeposit = async () => {
    if (!deposit) return;
    setDepositBusy(true);
    try {
      if (deposit.open) await closeDeposit(sessionId);
      else await reopenDeposit(sessionId, 30);
      await refreshDeposit();
    } catch (e) {
      console.error('Deposit error:', e);
      toast('Le dépôt n’a pas pu changer. Réessayez.');
    } finally {
      setDepositBusy(false);
    }
  };

  useEffect(() => () => {
    if (changedTimer.current) window.clearTimeout(changedTimer.current);
    if (commentTimer.current) window.clearTimeout(commentTimer.current);
  }, []);

  // Notes du carnet de chaque membre : relues après les gestes (la base les recalcule aussitôt).
  const gradesTimer = useRef<number | null>(null);
  const refreshMemberGrades = useCallback(() => {
    if (gradesTimer.current) window.clearTimeout(gradesTimer.current);
    gradesTimer.current = window.setTimeout(async () => {
      const assessmentId = data?.assessmentId;
      if (!assessmentId) return;
      const { data: rows } = await supabase
        .from('assessment_grades')
        .select('id, student_id, grade, grade_raw, status, details')
        .eq('assessment_id', assessmentId);
      const next: Record<string, TpMemberGrade> = {};
      for (const r of (rows ?? []) as { id: string; student_id: string; grade: number | null; grade_raw: number | null; status: string; details: { groupe?: { total?: number } } | null }[]) {
        next[r.student_id] = {
          gradeId: r.id,
          studentId: r.student_id,
          grade: r.grade === null ? null : Number(r.grade),
          gradeRaw: r.grade_raw === null ? null : Number(r.grade_raw),
          status: r.status,
          groupTotal: r.details?.groupe?.total !== undefined ? Number(r.details.groupe.total) : null,
        };
      }
      setData((prev) => (prev ? { ...prev, memberGrades: next } : prev));
    }, 700);
  }, [data?.assessmentId]);

  const criteria = useMemo(() => data?.criteria ?? [], [data]);
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const bareme = criteria.reduce((s, c) => s + c.max_points, 0);
  const absents = useMemo(() => absentIds(data?.events ?? []), [data]);
  const pseudoOf = useMemo(() => new Map(groups.flatMap((g) => g.members.map((m) => [m.studentId, m.pseudo] as const))), [groups]);
  const gradedCount = groups.filter((g) => isGroupGraded(g, criteria)).length;
  const visibleGroups = groups.filter((g) => (filter === 'all' ? true : filter === 'done' ? isGroupGraded(g, criteria) : !isGroupGraded(g, criteria)));
  const group = groups.find((g) => g.id === selectedId) ?? null;
  const groupIndex = group ? groups.indexOf(group) : -1;

  const groupPhotos = useMemo(() => (data?.photos ?? []).filter((p) => group && p.group_id === group.id), [data, group]);
  const classPhotos = useMemo(() => (data?.photos ?? []).filter((p) => !p.group_id), [data]);
  const photo = (data?.photos ?? []).find((p) => p.id === photoId) ?? groupPhotos[0] ?? null;

  const patchGroup = (groupId: string, fn: (g: TpGroup) => TpGroup) => {
    setData((prev) => (prev ? { ...prev, groups: prev.groups.map((g) => (g.id === groupId ? fn(g) : g)) } : prev));
  };

  const fail = (e: unknown, message: string) => {
    console.error(message, e);
    toast(message);
    void load();
  };

  // ---------------- Barème ----------------
  const setPoints = async (g: TpGroup, c: TpCriterion, points: number) => {
    patchGroup(g.id, (x) => ({ ...x, grades: { ...x.grades, [c.id]: points } }));
    try {
      await saveGroupGrade(g.id, c.id, points);
      notifyChanged();
      refreshMemberGrades();
    } catch (e) { fail(e, 'Erreur lors de l’enregistrement de la note.'); }
  };

  const stepCriterion = (g: TpGroup, c: TpCriterion, delta: 1 | -1) => {
    const current = g.grades[c.id];
    // Premier geste sur un critère jamais noté : « + » donne le maximum, « − » donne zéro.
    const next = current === undefined ? (delta > 0 ? c.max_points : 0) : stepPoints(current, delta, c.max_points);
    if (next !== current) void setPoints(g, c, next);
  };

  const setMalus = async (g: TpGroup, malus: number) => {
    const value = Math.max(0, malus);
    patchGroup(g.id, (x) => ({ ...x, conductMalus: value }));
    try {
      await saveGroupMalus(g.id, value);
      notifyChanged();
      refreshMemberGrades();
    } catch (e) { fail(e, 'Erreur lors de l’enregistrement du malus.'); }
  };

  const afterCriteriaChange = async (next: TpCriterion[]) => {
    notifyChanged();
    refreshMemberGrades();
    if (updateTemplate && data?.session.templateId) {
      try { await copyCriteriaToTemplate(data.session.templateId, next); } catch (e) { fail(e, 'Le barème de Mes TP n’a pas pu être mis à jour.'); }
    }
  };

  const changeMax = async (c: TpCriterion, raw: string) => {
    const max = Math.round(parseFloat(raw.replace(',', '.')) * 2) / 2;
    if (!Number.isFinite(max) || max <= 0 || max === c.max_points || !data) return;
    const next = criteria.map((x) => (x.id === c.id ? { ...x, max_points: max } : x));
    setData({ ...data, criteria: next, groups: data.groups.map((g) => (g.grades[c.id] !== undefined && g.grades[c.id] > max ? { ...g, grades: { ...g.grades, [c.id]: max } } : g)) });
    try {
      await updateCriterion(c.id, { max_points: max });
      await clampCriterionGrades(c.id, max);
      await afterCriteriaChange(next);
    } catch (e) { fail(e, 'Erreur lors de la modification du barème.'); }
  };

  const changeLabel = async (c: TpCriterion, label: string) => {
    const clean = label.trim();
    if (!clean || clean === c.label || !data) return;
    const next = criteria.map((x) => (x.id === c.id ? { ...x, label: clean } : x));
    setData({ ...data, criteria: next });
    try {
      await updateCriterion(c.id, { label: clean });
      await afterCriteriaChange(next);
    } catch (e) { fail(e, 'Erreur lors de la modification du critère.'); }
  };

  const createCriterion = async () => {
    if (!newCriterion || !data) return;
    const label = newCriterion.label.trim();
    const max = Math.round(parseFloat(newCriterion.max.replace(',', '.')) * 2) / 2;
    if (!label || !Number.isFinite(max) || max <= 0) { toast('Donnez un nom et un maximum au critère.'); return; }
    try {
      const order = criteria.reduce((m, c) => Math.max(m, c.display_order), -1) + 1;
      const created = await addCriterion(data.session.id, label, max, order);
      const next = [...criteria, created];
      setData((prev) => (prev ? { ...prev, criteria: next } : prev));
      setNewCriterion(null);
      await afterCriteriaChange(next);
    } catch (e) { fail(e, 'Erreur lors de l’ajout du critère.'); }
  };

  const removeCriterion = async (c: TpCriterion) => {
    if (!data) return;
    const graded = groups.filter((g) => g.grades[c.id] !== undefined).length;
    const msg = graded > 0
      ? `Retirer « ${c.label} » du barème ? Les points déjà donnés à ${graded} groupe${graded > 1 ? 's' : ''} sur ce critère seront perdus.`
      : `Retirer « ${c.label} » du barème ?`;
    if (!window.confirm(msg)) return;
    const next = criteria.filter((x) => x.id !== c.id);
    setData({ ...data, criteria: next, groups: data.groups.map((g) => { const gr = { ...g.grades }; delete gr[c.id]; return { ...g, grades: gr }; }) });
    try {
      await deleteCriterion(c.id);
      await afterCriteriaChange(next);
    } catch (e) { fail(e, 'Erreur lors de la suppression du critère.'); }
  };

  const toggleUpdateTemplate = async (checked: boolean) => {
    setUpdateTemplate(checked);
    if (checked && data?.session.templateId) {
      try {
        await copyCriteriaToTemplate(data.session.templateId, criteria);
        toast('Barème recopié dans Mes TP');
      } catch (e) { fail(e, 'Le barème de Mes TP n’a pas pu être mis à jour.'); }
    }
  };

  const validateAndNext = async (g: TpGroup) => {
    const missing = criteria.filter((c) => g.grades[c.id] === undefined).map((c) => c.id);
    if (missing.length) {
      patchGroup(g.id, (x) => ({ ...x, grades: { ...x.grades, ...Object.fromEntries(missing.map((id) => [id, 0])) } }));
      try {
        await fillMissingGrades(g.id, missing);
        notifyChanged();
        refreshMemberGrades();
      } catch (e) { fail(e, 'Erreur lors de la validation du groupe.'); return; }
    }
    const after = [...groups.slice(groupIndex + 1), ...groups.slice(0, groupIndex)];
    const next = after.find((x) => !isGroupGraded(x, criteria)) ?? null;
    if (next) selectGroup(next.id);
  };

  // ---------------- Commentaire au groupe ----------------
  const editComment = (g: TpGroup, text: string) => {
    setComments((prev) => ({ ...prev, [g.id]: text }));
    setCommentState('saving');
    if (commentTimer.current) window.clearTimeout(commentTimer.current);
    commentTimer.current = window.setTimeout(async () => {
      try {
        await saveGroupComment(g.id, text);
        patchGroup(g.id, (x) => ({ ...x, comment: text }));
        setCommentState('saved');
        notifyChanged();
      } catch (e) {
        console.error('Comment error:', e);
        setCommentState('error');
      }
    }, 800);
  };

  // ---------------- Notes des membres ----------------
  const saveAdjust = async (studentId: string, rawText: string) => {
    if (!user || !data?.assessmentId) return;
    const raw = Math.round(parseFloat(rawText.replace(',', '.')) * 100) / 100;
    if (!Number.isFinite(raw) || raw < 0 || raw > bareme) { toast(`Une note entre 0 et ${fmtNumber(bareme)}.`); return; }
    try {
      await saveMemberGrade({ userId: user.id, assessmentId: data.assessmentId, studentId, raw, bareme });
      setAdjusting(null);
      notifyChanged();
      refreshMemberGrades();
    } catch (e) { fail(e, 'Erreur lors de l’enregistrement de la note.'); }
  };

  // ---------------- Photos ----------------
  const upload = async (files: FileList | null) => {
    if (!files?.length || !user || !group) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const created = await uploadSessionPhoto(user.id, sessionId, file, '', group.id);
        const u = await photoUrls([created]);
        setData((prev) => (prev ? { ...prev, photos: [...prev.photos, created] } : prev));
        setUrls((prev) => ({ ...prev, ...u }));
        setPhotoId(created.id);
      }
    } catch (e) {
      console.error('Upload error:', e);
      toast('Erreur lors de l’envoi de la photo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async (p: GroupSessionPhoto) => {
    if (!window.confirm('Supprimer cette photo ? Le groupe ne la verra plus.')) return;
    try {
      await deleteSessionPhoto(p);
      setData((prev) => (prev ? { ...prev, photos: prev.photos.filter((x) => x.id !== p.id) } : prev));
      if (photoId === p.id) setPhotoId(null);
      if (lightbox?.id === p.id) setLightbox(null);
    } catch (e) { fail(e, 'Erreur lors de la suppression de la photo'); }
  };

  const movePhoto = async (p: GroupSessionPhoto, groupId: string | null) => {
    setData((prev) => (prev ? { ...prev, photos: prev.photos.map((x) => (x.id === p.id ? { ...x, group_id: groupId } : x)) } : prev));
    try { await movePhotoToGroup(p.id, groupId); } catch (e) { fail(e, 'La photo n’a pas pu changer de groupe.'); }
  };

  const photoAuthor = (p: GroupSessionPhoto) =>
    p.author === 'student' && p.student_id ? firstName(pseudoOf.get(p.student_id) ?? 'Élève') : 'Prof';

  // ---------------- Navigation ----------------
  const selectGroup = (id: string) => {
    setSelectedId(id);
    setPhotoId(null);
    setAdjusting(null);
    setNewCriterion(null);
    setCommentState('idle');
  };
  const stepGroup = (delta: 1 | -1) => {
    if (groups.length === 0 || groupIndex < 0) return;
    selectGroup(groups[(groupIndex + delta + groups.length) % groups.length].id);
  };

  // ---------------- Matériel, export, suppression ----------------
  const saveMaterials = async (materials: string[]) => {
    if (!data) return;
    try {
      const { error: err } = await supabase.from('group_sessions').update({ materials }).eq('id', data.session.id);
      if (err) throw err;
      setData({ ...data, session: { ...data.session, materials } });
      onChanged?.();
    } catch (e) { fail(e, 'Erreur lors de la sauvegarde du matériel'); }
  };

  const handleDeleteSession = async () => {
    if (!data) return;
    setIsDeleting(true);
    try {
      const { error: err } = await supabase.from('group_sessions').delete().eq('id', data.session.id);
      if (err) throw err;
      if (data.session.linkedSessionId) {
        const { error: eventsError } = await supabase.from('events').delete().eq('session_id', data.session.linkedSessionId);
        if (eventsError) throw eventsError;
        const { error: sessionError } = await supabase.from('sessions').delete().eq('id', data.session.linkedSessionId);
        if (sessionError) throw sessionError;
      }
      setShowDeleteConfirm(false);
      onDeleted?.();
    } catch (e) {
      console.error('Error deleting session:', e);
      toast('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export PDF : 3 fiches à découper par page
  const handleExportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    const students = groups.flatMap((g) => g.members.map((m) => ({
      name: m.pseudo,
      groupName: g.name,
      teammates: g.members.filter((x) => x.studentId !== m.studentId).map((x) => x.pseudo).join(', ') || '-',
      grades: criteria.map((c) => ({ label: c.label, points: g.grades[c.id] ?? 0, max: c.max_points })),
      total: groupTotal(g, criteria),
      malus: g.conductMalus,
    }))).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    const cardHeight = 85;
    const cardWidth = 180;
    const marginLeft = 15;
    const marginTop = 15;
    students.forEach((student, index) => {
      const cardIndex = index % 3;
      const yOffset = marginTop + cardIndex * (cardHeight + 5);
      if (index > 0 && cardIndex === 0) doc.addPage();
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(marginLeft - 3, yOffset - 3, cardWidth + 6, cardHeight);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(194, 65, 12);
      doc.text(data.session.name, marginLeft, yOffset + 5);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      doc.text(`${data.session.className} - ${formatDate(data.session.createdAt)}`, marginLeft, yOffset + 10);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text(student.name, marginLeft, yOffset + 20);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
      doc.text(`Groupe : ${student.groupName}`, marginLeft, yOffset + 27);
      doc.text(`Avec : ${student.teammates}`, marginLeft, yOffset + 33);
      const tableData = student.grades.map((g) => [g.label, `${fmtNumber(g.points)} / ${fmtNumber(g.max)}`]);
      if (student.malus > 0) tableData.push(['Malus conduite', `-${fmtNumber(student.malus)}`]);
      tableData.push(['TOTAL', `${fmtNumber(student.total)} / ${fmtNumber(bareme)}`]);
      autoTable(doc, {
        body: tableData,
        startY: yOffset + 37,
        margin: { left: marginLeft },
        tableWidth: cardWidth,
        styles: { fontSize: 11, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: cardWidth - 30 }, 1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } },
        bodyStyles: { lineColor: [220, 220, 220], lineWidth: 0.1 },
        didParseCell: (cell) => {
          if (cell.row.index === tableData.length - 1) {
            cell.cell.styles.fillColor = [194, 65, 12];
            cell.cell.styles.textColor = [255, 255, 255];
            cell.cell.styles.fontStyle = 'bold';
          }
          if (cell.row.index === tableData.length - 2 && student.malus > 0) cell.cell.styles.textColor = [185, 28, 28];
        },
      });
    });
    doc.save(`${data.session.name.replace(/[^a-zA-Z0-9]/g, '_')}_fiches.pdf`);
  };

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Chargement du TP…</div>;
  if (error || !data) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--neg)' }}>{error ?? 'TP introuvable.'}</div>;

  const session = data.session;
  const total = group ? groupTotal(group, criteria) : 0;
  const graded = group ? isGroupGraded(group, criteria) : false;
  const timeline = group ? groupTimeline(group, data.events) : [];
  const nextTodo = group ? [...groups.slice(groupIndex + 1), ...groups.slice(0, groupIndex)].find((x) => !isGroupGraded(x, criteria)) : null;
  const color = group ? tpGroupColor(group.displayOrder) : null;
  const memberCount = groups.reduce((s, g) => s + g.members.length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      {/* Partie TP : en-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 10, border: `2px solid ${TP.line}`, background: TP.soft }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 320px' }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: TP.text }}>PARTIE TP · NOTÉE PAR GROUPE</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {session.className} · {formatDate(session.createdAt)} · {memberCount} élève{memberCount > 1 ? 's' : ''} en {groups.length} groupe{groups.length > 1 ? 's' : ''}
            {session.status !== 'completed' ? ' · TP pas encore terminé au téléphone' : ''}
          </span>
        </div>
        <span style={{ fontSize: 13, color: TP.text, fontWeight: 600 }}>{gradedCount} groupe{gradedCount > 1 ? 's' : ''} noté{gradedCount > 1 ? 's' : ''} sur {groups.length}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: TP.text }}>/{fmtNumber(bareme)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8 }}>
        La note du groupe va à chacun de ses membres, absents compris. Un élève qui change de groupe prend la note du nouveau.
      </div>

      {deposit && (() => {
        const studentPhotos = data.photos.filter((p) => p.author === 'student');
        const groupsWith = new Set(studentPhotos.map((p) => p.group_id).filter(Boolean)).size;
        const until = deposit.closes_at ? fmtTime(deposit.closes_at) : null;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 10, background: deposit.open ? '#FBFEFC' : 'var(--surface-3)', border: `1px solid ${deposit.open ? '#86C99B' : 'var(--border)'}` }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: deposit.open ? '#15803D' : '#71717A' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: deposit.open ? '#15803D' : 'var(--text)' }}>
              {deposit.open ? 'Dépôt des élèves ouvert' : 'Dépôt des élèves fermé'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {deposit.open
                ? (deposit.mode === 'reopened' ? `rouvert, se referme tout seul à ${until}` : `se ferme tout seul à la fin de l’heure${until ? ` (${until} au plus tard)` : ''}`)
                : (deposit.mode === 'closed' ? 'fermé par vous' : 'fermé à la fin de l’heure')}
              {' · '}{studentPhotos.length} photo{studentPhotos.length > 1 ? 's' : ''} d’élèves{studentPhotos.length > 0 ? ` dans ${groupsWith} groupe${groupsWith > 1 ? 's' : ''}` : ''}
            </span>
            <span style={{ flex: 1 }} />
            <button style={deposit.open ? { ...btn, background: '#18181B', borderColor: '#18181B', color: '#FFFFFF' } : btn} disabled={depositBusy} onClick={() => { void toggleDeposit(); }}>
              {deposit.open ? 'Fermer plus tôt' : 'Rouvrir 30 min'}
            </button>
          </div>
        );
      })()}

      {groups.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)' }}>Aucun groupe dans ce TP.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          {/* Gauche : les groupes */}
          <div style={{ flex: '0 1 260px', minWidth: 230, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div role="group" aria-label="Filtrer les groupes" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {([['all', `Tous ${groups.length}`], ['todo', `À noter ${groups.length - gradedCount}`], ['done', `Notés ${gradedCount}`]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} style={{ ...chip, background: filter === key ? 'var(--text)' : 'var(--surface-3)', color: filter === key ? 'var(--surface)' : 'var(--text-muted)' }}>{label}</button>
              ))}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
              {visibleGroups.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-dim)' }}>Aucun groupe ici.</div>}
              {visibleGroups.map((g, i) => {
                const c = tpGroupColor(g.displayOrder);
                const on = g.id === selectedId;
                const n = data.photos.filter((p) => p.group_id === g.id).length;
                const done = isGroupGraded(g, criteria);
                return (
                  <button
                    key={g.id}
                    onClick={() => selectGroup(g.id)}
                    aria-current={on ? 'true' : undefined}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', border: 0, borderBottom: i < visibleGroups.length - 1 ? '1px solid var(--border)' : 0, background: on ? 'var(--indigo-soft, #EEF0FF)' : 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ ...swatch, background: c.soft, borderColor: c.border }} />
                      <b style={{ fontSize: 13 }}>{g.name}</b>
                      <span style={{ flex: 1 }} />
                      {n > 0 && <span style={{ ...badge, background: 'var(--surface-3)', color: 'var(--text-muted)' }}>{n} ph.</span>}
                      {done
                        ? <b style={{ fontSize: 12, color: 'var(--pos)' }}>{fmtNumber(groupTotal(g, criteria))}/{fmtNumber(bareme)}</b>
                        : <span style={{ ...badge, background: '#FDF1E3', color: '#B45309' }}>À noter</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {g.members.length === 0 ? 'Aucun membre' : g.members.map((m) => `${m.pseudo}${absents.has(m.studentId) ? ' (abs.)' : ''}`).join(', ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Centre : le travail du groupe */}
          {group && color && (
            <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => stepGroup(-1)} style={btn} aria-label="Groupe précédent">◀</button>
                <button onClick={() => stepGroup(1)} style={btn} aria-label="Groupe suivant">▶</button>
                <span style={{ ...swatch, background: color.soft, borderColor: color.border }} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>{group.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.members.length} membre{group.members.length > 1 ? 's' : ''}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{groupPhotos.length} photo{groupPhotos.length > 1 ? 's' : ''} du groupe</span>
              </div>

              <div style={{ position: 'relative', height: 360, borderRadius: 10, background: '#2A3142', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {photo && urls[photo.id] ? (
                  <>
                    <img src={urls[photo.id]} alt={photo.caption || `Photo de ${group.name}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'zoom-in' }} onClick={() => setLightbox(photo)} />
                    <span style={{ position: 'absolute', left: 12, top: 12, minHeight: 28, padding: '4px 10px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', color: '#FFFFFF', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', maxWidth: '50%' }}>
                      {photoAuthor(photo)} · {fmtTime(photo.created_at)}{photo.caption ? ` · ${photo.caption}` : ''}{!photo.group_id ? ' · toute la classe' : ''}
                    </span>
                    <span style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button style={btnSm} onClick={() => setLightbox(photo)}>Ouvrir en grand</button>
                      <select
                        aria-label="Ranger la photo"
                        value={photo.group_id ?? ''}
                        onChange={(e) => { void movePhoto(photo, e.target.value || null); }}
                        style={{ ...btnSm, paddingRight: 4 }}
                      >
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        <option value="">Toute la classe</option>
                      </select>
                      <button style={{ ...btnSm, color: '#B91C1C', borderColor: '#F3B4B4' }} onClick={() => { void removePhoto(photo); }}>Supprimer</button>
                    </span>
                  </>
                ) : (
                  <span style={{ color: '#CBD5E1', fontSize: 14 }}>{photo ? 'Chargement de la photo…' : 'Aucune photo pour ce groupe.'}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {groupPhotos.map((p) => (
                  <Thumb key={p.id} url={urls[p.id]} label={photoAuthor(p)} prof={photoAuthor(p) === 'Prof'} on={photo?.id === p.id} onClick={() => setPhotoId(p.id)} aria={`Photo de ${photoAuthor(p)}, ${fmtTime(p.created_at)}`} />
                ))}
                <label style={{ width: 76, height: 76, borderRadius: 8, border: '1.5px dashed var(--border-strong, #D4D4D8)', background: 'var(--surface)', color: 'var(--indigo)', fontSize: 12, fontWeight: 600, lineHeight: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', padding: 4 }}>
                  {uploading ? 'Envoi…' : '+ Ajouter une photo'}
                  <input ref={fileRef} type="file" accept="image/*" multiple disabled={uploading} onChange={(e) => { void upload(e.target.files); }} style={{ display: 'none' }} />
                </label>
              </div>
              {classPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', width: '100%' }}>Toute la classe ({classPhotos.length}) · visibles par tous les groupes</span>
                  {classPhotos.map((p) => (
                    <Thumb key={p.id} url={urls[p.id]} label={photoAuthor(p)} prof={photoAuthor(p) === 'Prof'} on={photo?.id === p.id} onClick={() => setPhotoId(p.id)} aria={`Photo de toute la classe, ${fmtTime(p.created_at)}`} small />
                  ))}
                </div>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <span style={lbl}>Commentaire au groupe</span>
                <textarea
                  rows={3}
                  value={comments[group.id] ?? ''}
                  onChange={(e) => editComment(group, e.target.value)}
                  placeholder="Ce que le groupe doit retenir de sa manipulation"
                  style={{ width: '100%', resize: 'vertical', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, lineHeight: '20px', color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'var(--text-dim)', marginTop: -4 }}>
                <span>Joint à la note de chaque membre dans le carnet.</span>
                <span style={{ color: commentState === 'error' ? 'var(--neg)' : undefined }}>
                  {commentState === 'saving' ? 'Enregistrement…' : commentState === 'saved' ? 'Enregistré' : commentState === 'error' ? 'Non enregistré' : ''}
                </span>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', background: 'var(--surface)' }}>
                <div style={{ ...lbl, marginBottom: 4 }}>Pendant la séance (au téléphone)</div>
                {timeline.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '4px 0' }}>Rien de noté pour ce groupe.</div>
                ) : timeline.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '4px 0' }}>
                    <span style={{ width: 44, color: 'var(--text-dim)', flexShrink: 0 }}>{fmtTime(t.at)}</span>
                    <span style={{ color: t.tone === 'neg' ? '#B45309' : t.tone === 'pos' ? 'var(--pos)' : 'var(--text)' }}>{t.text}</span>
                  </div>
                ))}
                {group.conductMalus > 0 && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 13, padding: '4px 0' }}>
                    <span style={{ width: 44, flexShrink: 0 }} />
                    <span style={{ color: '#B45309' }}>Malus conduite −{fmtNumber(group.conductMalus)} pour le groupe</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Droite : le barème */}
          {group && (
            <div style={{ flex: '0 1 380px', minWidth: 300, border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Barème du TP</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{criteria.length} critère{criteria.length > 1 ? 's' : ''} · /{fmtNumber(bareme)}</span>
              </div>
              <div>
                {criteria.map((c) => {
                  const v = group.grades[c.id];
                  return (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 44, borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <input
                        key={`${c.id}-${c.label}`}
                        defaultValue={c.label}
                        aria-label="Nom du critère"
                        onBlur={(e) => { void changeLabel(c, e.target.value); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ flex: 1, minWidth: 0, border: '1px solid transparent', borderRadius: 6, padding: '4px 6px', fontSize: 13, color: 'var(--text)', background: 'transparent', fontFamily: 'inherit' }}
                      />
                      <button style={step} aria-label={`Moins sur ${c.label}`} onClick={() => stepCriterion(group, c, -1)}>−</button>
                      <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, color: v === undefined ? 'var(--text-dim)' : 'var(--text)' }}>{v === undefined ? '—' : fmtNumber(v)}</span>
                      <button style={step} aria-label={`Plus sur ${c.label}`} onClick={() => stepCriterion(group, c, 1)}>+</button>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>/</span>
                      <input
                        key={`${c.id}-${c.max_points}`}
                        defaultValue={fmtNumber(c.max_points)}
                        aria-label={`Maximum de ${c.label}`}
                        inputMode="decimal"
                        onBlur={(e) => { void changeMax(c, e.target.value); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        style={{ width: 40, height: 30, border: '1px solid var(--border)', borderRadius: 6, padding: '0 6px', fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-3)', fontFamily: 'inherit' }}
                      />
                      <button onClick={() => { void removeCriterion(c); }} aria-label={`Retirer ${c.label}`} title="Retirer ce critère" style={{ width: 24, height: 30, border: 0, background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15 }}>×</button>
                    </div>
                  );
                })}
              </div>
              {newCriterion ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input autoFocus value={newCriterion.label} onChange={(e) => setNewCriterion({ ...newCriterion, label: e.target.value })} placeholder="Nouveau critère" aria-label="Nom du nouveau critère" style={{ ...field, flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') void createCriterion(); if (e.key === 'Escape') setNewCriterion(null); }} />
                  <input value={newCriterion.max} onChange={(e) => setNewCriterion({ ...newCriterion, max: e.target.value })} aria-label="Maximum du nouveau critère" inputMode="decimal" style={{ ...field, width: 48 }} onKeyDown={(e) => { if (e.key === 'Enter') void createCriterion(); }} />
                  <button style={btnPri} onClick={() => { void createCriterion(); }}>Ajouter</button>
                </div>
              ) : (
                <button onClick={() => setNewCriterion({ label: '', max: '1' })} style={{ height: 36, border: '1px dashed var(--border-strong, #D4D4D8)', borderRadius: 8, background: 'var(--surface)', color: 'var(--indigo)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Ajouter un critère</button>
              )}
              {session.templateId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={updateTemplate} onChange={(e) => { void toggleUpdateTemplate(e.target.checked); }} style={{ width: 16, height: 16, accentColor: 'var(--indigo)' }} />
                  Mettre aussi à jour ce barème dans Mes TP
                </label>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, background: '#FDF1E3', color: '#B45309', fontSize: 13 }}>
                <span style={{ flex: 1 }}><b>Malus conduite</b><span style={{ display: 'block', fontSize: 11.5 }}>retiré de la note du groupe</span></span>
                <button style={step} aria-label="Moins de malus" onClick={() => { void setMalus(group, group.conductMalus - 1); }} disabled={group.conductMalus <= 0}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{group.conductMalus > 0 ? `−${fmtNumber(group.conductMalus)}` : '0'}</span>
                <button style={step} aria-label="Plus de malus" onClick={() => { void setMalus(group, group.conductMalus + 1); }}>+</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Note du groupe</span>
                <span>
                  {!graded && <span style={{ ...badge, background: '#FDF1E3', color: '#B45309', marginRight: 8 }}>à finir</span>}
                  <b style={{ fontSize: 22, color: TP.text }}>{fmtNumber(total)}</b>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}> / {fmtNumber(bareme)}</span>
                </span>
              </div>

              <div>
                <div style={{ ...lbl, marginBottom: 2 }}>Note de chaque membre</div>
                {!data.assessmentId && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 0 6px' }}>Les notes arrivent au carnet quand le TP est terminé au téléphone.</div>
                )}
                {group.members.map((m) => {
                  const mg = data.memberGrades[m.studentId];
                  const adjusted = !!mg && mg.status === 'noted' && mg.gradeRaw !== null && mg.groupTotal !== null && mg.gradeRaw !== mg.groupTotal;
                  const shown = mg && mg.status === 'noted' && mg.gradeRaw !== null ? mg.gradeRaw : total;
                  const outMinutes = minutesOut(data.events, m.studentId);
                  return (
                    <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {m.pseudo}
                        {absents.has(m.studentId) && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}> absent(e), garde la note</span>}
                        {outMinutes > 0 && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}> sorti(e) {outMinutes} min</span>}
                        {mg && mg.status !== 'noted' && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}> {mg.status}</span>}
                      </span>
                      {adjusting?.studentId === m.studentId ? (
                        <>
                          <input autoFocus value={adjusting.value} onChange={(e) => setAdjusting({ studentId: m.studentId, value: e.target.value })} aria-label={`Note de ${m.pseudo}`} inputMode="decimal" style={{ ...field, width: 52 }} onKeyDown={(e) => { if (e.key === 'Enter') void saveAdjust(m.studentId, adjusting.value); if (e.key === 'Escape') setAdjusting(null); }} />
                          <button style={btnSm} onClick={() => { void saveAdjust(m.studentId, adjusting.value); }}>OK</button>
                        </>
                      ) : (
                        <>
                          {adjusted && <span style={{ ...badge, background: '#EEF0FF', color: 'var(--indigo)' }}>ajustée</span>}
                          <b>{fmtNumber(shown)}</b>
                          {data.assessmentId && (adjusted
                            ? <button style={btnSm} onClick={() => { void saveAdjust(m.studentId, String(mg?.groupTotal ?? total)); }} title="La note suit de nouveau celle du groupe">Suivre le groupe</button>
                            : <button style={btnSm} onClick={() => setAdjusting({ studentId: m.studentId, value: fmtNumber(shown) })}>Ajuster</button>)}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <button style={{ ...btnPri, height: 40 }} onClick={() => { void validateAndNext(group); }}>
                {nextTodo ? `Valider ${group.name} et passer à ${nextTodo.name} ▶` : graded ? 'Tous les groupes sont notés' : `Valider ${group.name}`}
              </button>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>Chaque point s’enregistre aussitôt. Valider compte 0 aux critères laissés vides.</div>
            </div>
          )}
        </div>
      )}

      {/* Le reste : matériel, fiches à découper, suppression */}
      <details style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Matériel, fiches à découper, suppression du TP</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ ...lbl, marginBottom: 6 }}>Matériel nécessaire</div>
            {session.materials.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {session.materials.map((item, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 13, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    {item}
                    <button onClick={() => { void saveMaterials(session.materials.filter((_, j) => j !== i)); }} aria-label={`Retirer ${item}`} style={{ border: 0, background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                placeholder="Ex : microscope, lame, bleu de méthylène…"
                aria-label="Ajouter du matériel"
                style={{ ...field, flex: 1 }}
                onKeyDown={(e) => { if (e.key === 'Enter' && newMaterial.trim()) { void saveMaterials([...session.materials, newMaterial.trim()]); setNewMaterial(''); } }}
              />
              <button style={btn} aria-label="Ajouter" disabled={!newMaterial.trim()} onClick={() => { void saveMaterials([...session.materials, newMaterial.trim()]); setNewMaterial(''); }}>
                <Icon name="plus" size={14} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={btn} onClick={handleExportPDF}>Fiches à découper (PDF)</button>
            <button style={{ ...btn, background: 'var(--neg-soft)', color: 'var(--neg)', borderColor: 'transparent' }} onClick={() => setShowDeleteConfirm(true)}>Supprimer le TP</button>
          </div>
        </div>
      </details>

      {showDeleteConfirm && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center z-[120] p-4" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="bg-[var(--surface)] w-full max-w-md p-6" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Supprimer ce TP">
            <h3 className="text-lg font-semibold text-[var(--text)] text-center">Supprimer ce TP ?</h3>
            <p className="text-[var(--text-muted)] mt-2 text-center">
              Le TP <strong>{session.name}</strong> et toutes ses données (groupes, notes, critères, photos) seront définitivement supprimés.
              Son évaluation dans le carnet est mise à la corbeille.
            </p>
            {session.linkedSessionId && (
              <p className="text-sm text-[var(--neg)] mt-3 p-3 bg-[var(--neg-soft)] font-medium text-left" style={{ borderRadius: 'var(--radius)' }}>
                La séance liée et tous ses événements (participations, bavardages, etc.) seront également supprimés.
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium disabled:opacity-50" style={{ borderRadius: 'var(--radius)' }}>Annuler</button>
              <button onClick={() => { void handleDeleteSession(); }} disabled={isDeleting} className="flex-1 px-4 py-2.5 bg-[var(--neg)] text-white hover:opacity-90 transition-colors font-medium disabled:opacity-50" style={{ borderRadius: 'var(--radius)' }}>
                {isDeleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && urls[lightbox.id] && (
        <div className="gc-overlay gc-modal fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 130 }} onClick={() => setLightbox(null)}>
          <div className="relative max-w-5xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={urls[lightbox.id]} alt={lightbox.caption || 'Photo du TP'} style={{ maxHeight: '85vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius)' }} />
            <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.85)', fontSize: 13 }}>
              {photoAuthor(lightbox)} · {fmtTime(lightbox.created_at)}{lightbox.caption ? ` · ${lightbox.caption}` : ''}
            </div>
            <button onClick={() => setLightbox(null)} aria-label="Fermer la photo" className="absolute -top-2 -right-2 w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors" style={{ fontSize: 18 }}>×</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Minutes passées hors de la salle (sorties terminées par un retour). */
function minutesOut(events: TpSheetData['events'], studentId: string): number {
  let total = 0;
  for (const e of events) {
    if (e.studentId !== studentId || e.type !== 'sortie') continue;
    const back = events.find((r) => r.studentId === studentId && r.type === 'retour' && r.timestamp > e.timestamp);
    if (back) total += (new Date(back.timestamp).getTime() - new Date(e.timestamp).getTime()) / 60000;
  }
  return Math.round(total);
}

function Thumb({ url, label, prof, on, onClick, aria, small }: {
  url?: string; label: string; prof: boolean; on: boolean; onClick: () => void; aria: string; small?: boolean;
}) {
  const size = small ? 56 : 76;
  return (
    <button onClick={onClick} aria-label={aria} aria-pressed={on} style={{ position: 'relative', width: size, height: size, padding: 0, borderRadius: 8, border: `2px solid ${on ? 'var(--indigo)' : 'var(--border)'}`, background: '#2A3142', overflow: 'hidden', cursor: 'pointer' }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      <span style={{ position: 'absolute', left: 4, bottom: 4, height: 18, padding: '0 5px', borderRadius: 4, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', background: prof ? '#18181B' : 'rgba(255,255,255,0.92)', color: prof ? '#FFFFFF' : '#18181B' }}>{label}</span>
    </button>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, padding: '0 12px',
  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
};
const btnSm: React.CSSProperties = { ...btn, height: 30, padding: '0 9px', fontSize: 12 };
const btnPri: React.CSSProperties = { ...btn, background: 'var(--indigo)', borderColor: 'var(--indigo)', color: '#FFFFFF' };
const step: React.CSSProperties = {
  width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)',
  color: 'var(--text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
};
const chip: React.CSSProperties = { height: 28, padding: '0 10px', border: 0, borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const badge: React.CSSProperties = { fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' };
const swatch: React.CSSProperties = { display: 'inline-block', width: 12, height: 12, borderRadius: 3, border: '1.5px solid', flexShrink: 0 };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' };
const field: React.CSSProperties = {
  height: 32, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13,
  color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', boxSizing: 'border-box',
};
