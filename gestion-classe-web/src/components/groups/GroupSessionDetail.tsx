import { useCallback, useEffect, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { Icon } from '../design-system';
import {
  deleteSessionPhoto,
  fetchSessionPhotos,
  getPhotoUrl,
  updatePhotoCaption,
  uploadSessionPhoto,
  type GroupSessionPhoto,
} from '../../lib/groupSessionPhotos';

/**
 * Détail d'une séance de groupe notée sur critères : critères, matériel, photos de référence,
 * résultats par groupe (avec modification des points), export PDF des fiches à découper,
 * suppression. Partagé par la page Groupes et par la fiche de l'éval « TP de groupe » du carnet
 * (hub Évaluations, phase 3) : un seul endroit pour ces gestes. Les notes du carnet suivent toute
 * modification par la base (migration 063).
 */

interface SessionInfo {
  id: string;
  name: string;
  class_name: string;
  created_at: string;
  linked_session_id: string | null;
  materials: string[];
}

interface SessionGroup {
  id: string;
  name: string;
  conduct_malus: number;
  members: { id: string; pseudo: string }[];
  grades: { criteria_id: string; points_awarded: number }[];
  total_score: number;
}

interface GradingCriteria {
  id: string;
  label: string;
  max_points: number;
  display_order: number;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function GroupSessionDetail({ sessionId, onDeleted, onChanged }: {
  sessionId: string;
  /** La séance vient d'être supprimée (et l'éval du carnet mise à la corbeille). */
  onDeleted?: () => void;
  /** Des points, un malus ou le matériel ont changé. */
  onChanged?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useUIFeedback();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [criteria, setCriteria] = useState<GradingCriteria[]>([]);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGrades, setEditGrades] = useState<Record<string, number>>({});
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [criteriaExpanded, setCriteriaExpanded] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const [photos, setPhotos] = useState<GroupSessionPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<GroupSessionPhoto | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newMaterial, setNewMaterial] = useState('');
  const [isSavingMaterials, setIsSavingMaterials] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: s, error: sErr }, { data: criteriaData }, { data: groupsData }] = await Promise.all([
        supabase.from('group_sessions').select('id, name, created_at, linked_session_id, materials, classes (name)').eq('id', sessionId).maybeSingle(),
        supabase.from('grading_criteria').select('id, label, max_points, display_order').eq('session_id', sessionId).order('display_order'),
        supabase.from('session_groups').select('id, name, conduct_malus').eq('session_id', sessionId).order('name'),
      ]);
      if (sErr) throw sErr;
      if (!s) { setSession(null); setError('Cette séance de groupe n’existe plus.'); return; }
      setSession({
        id: s.id,
        name: s.name,
        class_name: (s.classes as unknown as { name: string } | null)?.name ?? 'Classe inconnue',
        created_at: s.created_at,
        linked_session_id: s.linked_session_id ?? null,
        materials: s.materials ?? [],
      });
      setCriteria(criteriaData || []);

      const groupIds = (groupsData || []).map((g) => g.id);
      const [{ data: membersData }, { data: gradesData }] = groupIds.length
        ? await Promise.all([
          supabase.from('session_group_members').select('group_id, students (id, pseudo)').in('group_id', groupIds),
          supabase.from('group_grades').select('group_id, criteria_id, points_awarded').in('group_id', groupIds),
        ])
        : [{ data: [] }, { data: [] }];

      const next: SessionGroup[] = (groupsData || []).map((g) => {
        const members = ((membersData || []) as { group_id: string; students: unknown }[])
          .filter((m) => m.group_id === g.id)
          .map((m) => m.students as { id: string; pseudo: string })
          .filter(Boolean);
        const grades = ((gradesData || []) as { group_id: string; criteria_id: string; points_awarded: number }[])
          .filter((gr) => gr.group_id === g.id)
          .map((gr) => ({ criteria_id: gr.criteria_id, points_awarded: gr.points_awarded }));
        const total = grades.reduce((sum, gr) => sum + gr.points_awarded, 0) - (g.conduct_malus ?? 0);
        return { id: g.id, name: g.name, conduct_malus: g.conduct_malus ?? 0, members, grades, total_score: total };
      });
      next.sort((a, b) => b.total_score - a.total_score);
      setGroups(next);
      setError(null);
    } catch (e) {
      console.error('Error loading session detail:', e);
      setError('Erreur lors du chargement de la séance de groupe.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const loadPhotos = useCallback(async () => {
    try {
      const data = await fetchSessionPhotos(sessionId);
      setPhotos(data);
      const urls: Record<string, string> = {};
      await Promise.all(data.map(async (p) => {
        const url = await getPhotoUrl(p.file_path);
        if (url) urls[p.id] = url;
      }));
      setPhotoUrls(urls);
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  }, [sessionId]);

  useEffect(() => { void load(); void loadPhotos(); }, [load, loadPhotos]);

  const maxPoints = criteria.reduce((sum, c) => sum + c.max_points, 0);

  // ---------------- Photos ----------------
  const handleUploadPhoto = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadSessionPhoto(user.id, sessionId, file);
        const url = await getPhotoUrl(photo.file_path);
        setPhotos((prev) => [...prev, photo]);
        if (url) setPhotoUrls((prev) => ({ ...prev, [photo.id]: url }));
      }
      toast('Photo(s) ajoutée(s)');
    } catch (err) {
      console.error('Upload error:', err);
      toast('Erreur lors de l\'upload');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (photo: GroupSessionPhoto) => {
    try {
      await deleteSessionPhoto(photo);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setPhotoUrls((prev) => { const u = { ...prev }; delete u[photo.id]; return u; });
      if (viewingPhoto?.id === photo.id) setViewingPhoto(null);
      toast('Photo supprimée');
    } catch (err) {
      console.error('Delete photo error:', err);
      toast('Erreur lors de la suppression');
    }
  };

  const handleSaveCaption = async (photoId: string) => {
    try {
      await updatePhotoCaption(photoId, captionText);
      setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption: captionText } : p)));
      setEditingCaption(null);
    } catch (err) {
      console.error('Caption error:', err);
    }
  };

  // ---------------- Matériel ----------------
  const saveMaterials = async (materials: string[]) => {
    if (!session) return;
    setIsSavingMaterials(true);
    try {
      const { error: err } = await supabase.from('group_sessions').update({ materials }).eq('id', session.id);
      if (err) throw err;
      setSession((prev) => (prev ? { ...prev, materials } : prev));
      onChanged?.();
    } catch (err) {
      console.error('Materials error:', err);
      toast('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingMaterials(false);
    }
  };

  const handleAddMaterial = () => {
    const item = newMaterial.trim();
    if (!item || !session) return;
    void saveMaterials([...session.materials, item]);
    setNewMaterial('');
  };

  const handleRemoveMaterial = (index: number) => {
    if (!session) return;
    void saveMaterials(session.materials.filter((_, i) => i !== index));
  };

  // ---------------- Points par critère ----------------
  const handleStartEditGroup = (group: SessionGroup) => {
    const g: Record<string, number> = {};
    group.grades.forEach((x) => { g[x.criteria_id] = x.points_awarded; });
    setEditGrades(g);
    setEditingGroupId(group.id);
  };

  const handleSaveGrades = async (groupId: string) => {
    setIsSavingGrades(true);
    try {
      const rows = criteria.map((c) => ({ group_id: groupId, criteria_id: c.id, points_awarded: editGrades[c.id] ?? 0 }));
      const { error: err } = await supabase.from('group_grades').upsert(rows, { onConflict: 'group_id,criteria_id' });
      if (err) throw err;
      await load();
      setEditingGroupId(null);
      setEditGrades({});
      onChanged?.();
    } catch (err) {
      console.error('Error saving grades:', err);
      toast('Erreur lors de la sauvegarde des notes.');
    } finally {
      setIsSavingGrades(false);
    }
  };

  // ---------------- Suppression ----------------
  const handleDeleteSession = async () => {
    if (!session) return;
    setIsDeleting(true);
    try {
      const { error: err } = await supabase.from('group_sessions').delete().eq('id', session.id);
      if (err) throw err;
      if (session.linked_session_id) {
        const { error: eventsError } = await supabase.from('events').delete().eq('session_id', session.linked_session_id);
        if (eventsError) throw eventsError;
        const { error: sessionError } = await supabase.from('sessions').delete().eq('id', session.linked_session_id);
        if (sessionError) throw sessionError;
      }
      setShowDeleteConfirm(false);
      onDeleted?.();
    } catch (err) {
      console.error('Error deleting session:', err);
      toast('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------------- Export PDF : 3 fiches à découper par page ----------------
  const handleExportPDF = () => {
    if (!session) return;
    const doc = new jsPDF();
    const students: { name: string; groupName: string; teammates: string; grades: { label: string; points: number; max: number }[]; total: number; malus: number }[] = [];
    groups.forEach((group) => {
      group.members.forEach((member) => {
        students.push({
          name: member.pseudo,
          groupName: group.name,
          teammates: group.members.filter((m) => m.id !== member.id).map((m) => m.pseudo).join(', ') || '-',
          grades: criteria.map((c) => ({ label: c.label, points: group.grades.find((g) => g.criteria_id === c.id)?.points_awarded ?? 0, max: c.max_points })),
          total: group.total_score,
          malus: group.conduct_malus,
        });
      });
    });
    students.sort((a, b) => a.name.localeCompare(b.name));

    const cardHeight = 85;
    const cardWidth = 180;
    const marginLeft = 15;
    const marginTop = 15;
    const cardsPerPage = 3;
    students.forEach((student, index) => {
      const cardIndex = index % cardsPerPage;
      const yOffset = marginTop + cardIndex * (cardHeight + 5);
      if (index > 0 && cardIndex === 0) doc.addPage();
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(marginLeft - 3, yOffset - 3, cardWidth + 6, cardHeight);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(34, 197, 94);
      doc.text(session.name, marginLeft, yOffset + 5);
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
      doc.text(`${session.class_name} - ${formatDate(session.created_at)}`, marginLeft, yOffset + 10);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 0, 0);
      doc.text(student.name, marginLeft, yOffset + 20);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
      doc.text(`Groupe: ${student.groupName}`, marginLeft, yOffset + 27);
      doc.text(`Avec: ${student.teammates}`, marginLeft, yOffset + 33);
      const tableData = student.grades.map((g) => [g.label, `${g.points} / ${g.max}`]);
      if (student.malus > 0) tableData.push(['Malus conduite', `-${student.malus}`]);
      tableData.push(['TOTAL', `${student.total} / ${maxPoints}`]);
      autoTable(doc, {
        body: tableData,
        startY: yOffset + 37,
        margin: { left: marginLeft },
        tableWidth: cardWidth,
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: { 0: { cellWidth: cardWidth - 30 }, 1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' } },
        bodyStyles: { lineColor: [220, 220, 220], lineWidth: 0.1 },
        didParseCell: (data) => {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [34, 197, 94];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.index === tableData.length - 2 && student.malus > 0) data.cell.styles.textColor = [220, 38, 38];
        },
      });
    });
    doc.save(`${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_fiches.pdf`);
  };

  if (loading) {
    return <div className="py-8 text-center text-[var(--text-muted)]">Chargement de la séance…</div>;
  }
  if (error || !session) {
    return <div className="py-8 text-center text-[var(--neg)]">{error ?? 'Séance introuvable.'}</div>;
  }

  return (
    <div className="flex flex-col">
      {/* Critères — repliés sur mobile, toujours visibles sur ordinateur */}
      <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--surface-3)]/50">
        <button onClick={() => setCriteriaExpanded(!criteriaExpanded)} className="md:hidden w-full flex items-center justify-between text-left">
          <h4 className="text-sm font-medium text-[var(--text-muted)]">Critères ({criteria.length}) - {maxPoints} pts</h4>
          <span className={`text-[var(--text-dim)] transition-transform ${criteriaExpanded ? 'rotate-180' : ''}`}>▼</span>
        </button>
        <h4 className="hidden md:block text-sm font-medium text-[var(--text-muted)] mb-3">Critères de notation ({criteria.length})</h4>
        <div className={`${criteriaExpanded ? 'mt-3' : 'hidden'} md:block`}>
          <div className="flex flex-wrap gap-2">
            {criteria.map((c) => (
              <span key={c.id} className="px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)]" style={{ borderRadius: 'var(--radius)' }}>
                {c.label} <span className="text-[var(--text-dim)]">({c.max_points} pts)</span>
              </span>
            ))}
          </div>
          <div className="mt-2 text-sm text-[var(--text-dim)]">Total: {maxPoints} points</div>
        </div>
      </div>

      <div className="p-6">
        {/* Matériel */}
        <div className="mb-6 pb-4 border-b border-[var(--border)]">
          <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">Matériel nécessaire</h4>
          {session.materials.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {session.materials.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] group" style={{ borderRadius: 'var(--radius)' }}>
                  {item}
                  <button
                    onClick={() => handleRemoveMaterial(i)}
                    aria-label={`Retirer ${item}`}
                    className="w-4 h-4 flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--neg)] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 14, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newMaterial}
              onChange={(e) => setNewMaterial(e.target.value)}
              placeholder="Ex: microscope, lame, bleu de méthylène..."
              aria-label="Ajouter du matériel"
              className="flex-1 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
              style={{ borderRadius: 'var(--radius)' }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddMaterial(); }}
              disabled={isSavingMaterials}
            />
            <button
              onClick={handleAddMaterial}
              disabled={!newMaterial.trim() || isSavingMaterials}
              aria-label="Ajouter"
              className="px-3 py-2 text-sm font-medium bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
              style={{ borderRadius: 'var(--radius)' }}
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>

        {/* Photos */}
        <div className="mb-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-[var(--text-muted)]">Photos de référence ({photos.length})</h4>
            <label className="px-3 py-1.5 text-sm font-medium bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-2" style={{ borderRadius: 'var(--radius)' }}>
              <Icon name="plus" size={14} />
              {isUploadingPhoto ? 'Upload...' : 'Ajouter'}
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleUploadPhoto(e.target.files)} style={{ display: 'none' }} disabled={isUploadingPhoto} />
            </label>
          </div>
          {photos.length === 0 ? (
            <div className="text-center py-4 text-[var(--text-dim)] text-sm">Aucune photo. Ajoutez des images de référence pour ce TP.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {photos.map((photo) => (
                <div key={photo.id} className="relative group cursor-pointer" style={{ borderRadius: 'var(--radius)', overflow: 'hidden', aspectRatio: '1', background: 'var(--surface-3)' }} onClick={() => setViewingPhoto(photo)}>
                  {photoUrls[photo.id]
                    ? <img src={photoUrls[photo.id]} alt={photo.caption || 'Photo TP'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div className="flex items-center justify-center h-full text-[var(--text-dim)]">...</div>}
                  {photo.caption && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', padding: '16px 8px 6px', fontSize: 11, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {photo.caption}
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleDeletePhoto(photo); }}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    style={{ fontSize: 12, lineHeight: 1 }}
                    title="Supprimer"
                    aria-label="Supprimer la photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Résultats */}
        <h4 className="text-sm font-medium text-[var(--text-muted)] mb-1">Résultats par groupe</h4>
        <p className="text-xs text-[var(--text-dim)] mb-4">
          Chaque membre reçoit la note de son groupe dans le carnet ; une note ajustée pour un élève (bouton « i » du carnet) ne suit plus le groupe.
        </p>
        {groups.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-dim)]">Aucun groupe dans cette séance</div>
        ) : (
          <div className="space-y-4">
            {groups.map((group, idx) => {
              const percentage = maxPoints > 0 ? Math.round((group.total_score / maxPoints) * 100) : 0;
              const isFirst = idx === 0;
              return (
                <div
                  key={group.id}
                  className={`p-4 border ${isFirst ? 'border-[var(--pos)]' : 'border-[var(--border)]'} cursor-pointer hover:bg-[var(--surface-2)] transition-colors`}
                  style={{ borderRadius: 'var(--radius)' }}
                  onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {isFirst && <span className="text-xl" aria-hidden>🥇</span>}
                      <span className="font-semibold text-[var(--text)]">{group.name}</span>
                      <span className="text-sm text-[var(--text-dim)]">({group.members.length} élève{group.members.length > 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingGroupId !== group.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartEditGroup(group); }}
                          className="p-1.5 text-[var(--text-dim)] hover:text-[var(--indigo)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                          title="Modifier les notes"
                          aria-label={`Modifier les notes de ${group.name}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <div className="text-right">
                        <div className="text-xl font-bold text-[var(--text)]">
                          {group.total_score.toFixed(1)} <span className="text-sm font-normal text-[var(--text-dim)]">/ {maxPoints}</span>
                        </div>
                        <div className="text-sm text-[var(--text-muted)]">{percentage}%</div>
                      </div>
                    </div>
                  </div>
                  <div className="h-2 bg-[var(--surface-3)] mb-3" style={{ borderRadius: 'var(--radius-full)' }}>
                    <div className="h-full transition-all" style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, background: percentage >= 70 ? 'var(--pos)' : percentage >= 50 ? 'var(--warn)' : 'var(--neg)', borderRadius: 'var(--radius-full)' }} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.members.map((m) => (
                      <span key={m.id} className="px-2 py-1 text-xs bg-[var(--surface-3)] text-[var(--text-muted)]" style={{ borderRadius: 'var(--radius-md)' }}>{m.pseudo}</span>
                    ))}
                  </div>
                  {group.conduct_malus > 0 && (
                    <div className="mt-2 text-xs text-[var(--neg)]">Malus conduite: -{group.conduct_malus} pt{group.conduct_malus > 1 ? 's' : ''}</div>
                  )}
                  {(expandedGroupId === group.id || editingGroupId === group.id) && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                      {editingGroupId === group.id ? (
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {criteria.map((c) => (
                              <div key={c.id} className="flex items-center gap-2">
                                <label htmlFor={`gc-${group.id}-${c.id}`} className="text-sm text-[var(--text-dim)] flex-1 min-w-0 truncate">{c.label}</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    id={`gc-${group.id}-${c.id}`}
                                    type="number"
                                    min={0}
                                    max={c.max_points}
                                    step={0.5}
                                    value={editGrades[c.id] ?? 0}
                                    onChange={(e) => setEditGrades((prev) => ({ ...prev, [c.id]: Math.min(c.max_points, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                                    className="w-16 px-2 py-1 text-sm text-center border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                  />
                                  <span className="text-xs text-[var(--text-dim)]">/{c.max_points}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-3 justify-end">
                            <button onClick={() => { setEditingGroupId(null); setEditGrades({}); }} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]" disabled={isSavingGrades}>Annuler</button>
                            <button onClick={() => { void handleSaveGrades(group.id); }} disabled={isSavingGrades} className="px-3 py-1.5 text-sm bg-[var(--indigo)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                              {isSavingGrades ? 'Sauvegarde...' : 'Sauvegarder'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {criteria.map((c) => {
                            const points = group.grades.find((g) => g.criteria_id === c.id)?.points_awarded ?? 0;
                            return (
                              <div key={c.id} className="text-sm">
                                <span className="text-[var(--text-dim)]">{c.label}:</span>{' '}
                                <span className="font-medium text-[var(--text)]">{points}/{c.max_points}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 flex flex-wrap gap-3">
        <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2.5 bg-[var(--neg-soft)] text-[var(--neg)] hover:bg-[var(--neg)] hover:text-white transition-colors font-medium" style={{ borderRadius: 'var(--radius)' }}>
          Supprimer la séance
        </button>
        <button onClick={handleExportPDF} className="px-4 py-2.5 bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors font-medium" style={{ borderRadius: 'var(--radius)' }}>
          Fiches à découper (PDF)
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="bg-[var(--surface)] w-full max-w-md p-6" style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Supprimer cette séance">
            <h3 className="text-lg font-semibold text-[var(--text)] text-center">Supprimer cette séance ?</h3>
            <p className="text-[var(--text-muted)] mt-2 text-center">
              La séance <strong>{session.name}</strong> et toutes ses données (groupes, notes, critères) seront définitivement supprimées.
              Son évaluation dans le carnet est mise à la corbeille.
            </p>
            {session.linked_session_id && (
              <p className="text-sm text-[var(--neg)] mt-3 p-3 bg-[var(--neg-soft)] font-medium text-left" style={{ borderRadius: 'var(--radius)' }}>
                La séance classique liée et tous ses événements (participations, bavardages, etc.) seront également supprimés.
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium disabled:opacity-50" style={{ borderRadius: 'var(--radius)' }}>Annuler</button>
              <button onClick={() => { void handleDeleteSession(); }} disabled={isDeleting} className="flex-1 px-4 py-2.5 bg-[var(--neg)] text-white hover:opacity-90 transition-colors font-medium disabled:opacity-50" style={{ borderRadius: 'var(--radius)' }}>
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingPhoto && photoUrls[viewingPhoto.id] && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 130 }} onClick={() => { setViewingPhoto(null); setEditingCaption(null); }}>
          <div className="relative max-w-3xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={photoUrls[viewingPhoto.id]} alt={viewingPhoto.caption || 'Photo TP'} style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius)' }} />
            <div className="mt-3 w-full max-w-md text-center">
              {editingCaption === viewingPhoto.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Légende..."
                    aria-label="Légende de la photo"
                    className="flex-1 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                    style={{ borderRadius: 'var(--radius)' }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveCaption(viewingPhoto.id); }}
                  />
                  <button onClick={() => { void handleSaveCaption(viewingPhoto.id); }} className="px-3 py-2 text-sm bg-[var(--indigo)] text-white font-medium" style={{ borderRadius: 'var(--radius)' }}>OK</button>
                </div>
              ) : (
                <button onClick={() => { setEditingCaption(viewingPhoto.id); setCaptionText(viewingPhoto.caption || ''); }} className="text-white/70 hover:text-white text-sm transition-colors">
                  {viewingPhoto.caption || 'Ajouter une légende...'}
                </button>
              )}
            </div>
            <button onClick={() => { setViewingPhoto(null); setEditingCaption(null); }} aria-label="Fermer la photo" className="absolute -top-2 -right-2 w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors" style={{ fontSize: 18 }}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
