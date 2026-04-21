import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { getClassGradient, getClassInitials } from '../lib/constants';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { Icon } from '../components/design-system';
import { fetchSessionPhotos, uploadSessionPhoto, deleteSessionPhoto, updatePhotoCaption, getPhotoUrl, type GroupSessionPhoto } from '../lib/groupSessionPhotos';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GroupSession {
  id: string;
  name: string;
  class_id: string;
  class_name: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  completed_at: string | null;
  groups_count: number;
  total_points: number;
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

interface SessionDetail {
  session: GroupSession;
  criteria: GradingCriteria[];
  groups: SessionGroup[];
}

interface ClassFilter {
  id: string;
  name: string;
}

export function GroupSessions() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [classes, setClasses] = useState<ClassFilter[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit grades
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGrades, setEditGrades] = useState<Record<string, number>>({});
  const [isSavingGrades, setIsSavingGrades] = useState(false);

  // Mobile accordion for criteria
  const [criteriaExpanded, setCriteriaExpanded] = useState(false);
  // Per-group criteria expansion
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<GroupSessionPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<GroupSessionPhoto | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Materials
  const [newMaterial, setNewMaterial] = useState('');
  const [isSavingMaterials, setIsSavingMaterials] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      // Load classes for filter
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

      // Load group sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('group_sessions')
        .select(`
          id, name, class_id, status, created_at, completed_at, linked_session_id, materials,
          classes (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (sessionsError) throw sessionsError;

      if (sessionsData && sessionsData.length > 0) {
        // Get groups count and total points for each session
        const sessionIds = sessionsData.map(s => s.id);

        // Fetch groups count
        const { data: groupsData } = await supabase
          .from('session_groups')
          .select('session_id')
          .in('session_id', sessionIds);

        // Fetch criteria for max points
        const { data: criteriaData } = await supabase
          .from('grading_criteria')
          .select('session_id, max_points')
          .in('session_id', sessionIds);

        // Group counts
        const groupsCountMap = new Map<string, number>();
        (groupsData || []).forEach(g => {
          const count = groupsCountMap.get(g.session_id) || 0;
          groupsCountMap.set(g.session_id, count + 1);
        });

        // Total points by session
        const pointsMap = new Map<string, number>();
        (criteriaData || []).forEach(c => {
          const sum = pointsMap.get(c.session_id) || 0;
          pointsMap.set(c.session_id, sum + c.max_points);
        });

        const sessionsWithDetails = sessionsData.map(session => ({
          id: session.id,
          name: session.name,
          class_id: session.class_id,
          class_name: (session.classes as any)?.name || 'Classe inconnue',
          status: session.status as 'draft' | 'active' | 'completed',
          created_at: session.created_at,
          completed_at: session.completed_at,
          groups_count: groupsCountMap.get(session.id) || 0,
          total_points: pointsMap.get(session.id) || 0,
          linked_session_id: (session as any).linked_session_id || null,
          materials: (session as any).materials || [],
        }));

        setSessions(sessionsWithDetails);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Error loading group sessions:', err);
      setError('Erreur lors du chargement des seances de groupe.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessionDetail = async (session: GroupSession) => {
    setIsLoadingDetail(true);
    setSessionDetail(null);

    try {
      // Fetch criteria
      const { data: criteriaData } = await supabase
        .from('grading_criteria')
        .select('id, label, max_points, display_order')
        .eq('session_id', session.id)
        .order('display_order');

      // Fetch groups
      const { data: groupsData } = await supabase
        .from('session_groups')
        .select('id, name, conduct_malus')
        .eq('session_id', session.id)
        .order('name');

      if (!groupsData) {
        setSessionDetail({
          session,
          criteria: criteriaData || [],
          groups: [],
        });
        return;
      }

      const groupIds = groupsData.map(g => g.id);

      // Fetch members
      const { data: membersData } = await supabase
        .from('session_group_members')
        .select(`
          group_id,
          students (id, pseudo)
        `)
        .in('group_id', groupIds);

      // Fetch grades
      const { data: gradesData } = await supabase
        .from('group_grades')
        .select('group_id, criteria_id, points_awarded')
        .in('group_id', groupIds);

      // Build groups with members and grades
      const groups: SessionGroup[] = groupsData.map(g => {
        const members = (membersData || [])
          .filter(m => m.group_id === g.id)
          .map(m => (m.students as any) as { id: string; pseudo: string })
          .filter(Boolean);

        const grades = (gradesData || [])
          .filter(gr => gr.group_id === g.id)
          .map(gr => ({
            criteria_id: gr.criteria_id,
            points_awarded: gr.points_awarded,
          }));

        const totalScore = grades.reduce((sum, gr) => sum + gr.points_awarded, 0) - g.conduct_malus;

        return {
          id: g.id,
          name: g.name,
          conduct_malus: g.conduct_malus,
          members,
          grades,
          total_score: totalScore,
        };
      });

      // Sort groups by score descending
      groups.sort((a, b) => b.total_score - a.total_score);

      setSessionDetail({
        session,
        criteria: criteriaData || [],
        groups,
      });
    } catch (err) {
      console.error('Error loading session detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenDetail = async (session: GroupSession) => {
    setShowDetailModal(true);
    setCriteriaExpanded(false);
    setExpandedGroupId(null);
    setPhotos([]);
    setPhotoUrls({});
    await loadSessionDetail(session);
    loadPhotos(session.id);
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSessionDetail(null);
    setShowDeleteConfirm(false);
    setEditingGroupId(null);
    setPhotos([]);
    setPhotoUrls({});
    setViewingPhoto(null);
  };

  const loadPhotos = async (sessionId: string) => {
    try {
      const data = await fetchSessionPhotos(sessionId);
      setPhotos(data);
      // Load signed URLs
      const urls: Record<string, string> = {};
      await Promise.all(data.map(async (p) => {
        const url = await getPhotoUrl(p.file_path);
        if (url) urls[p.id] = url;
      }));
      setPhotoUrls(urls);
    } catch (err) {
      console.error('Error loading photos:', err);
    }
  };

  const handleUploadPhoto = async (files: FileList | null) => {
    if (!files || !files.length || !user || !sessionDetail) return;
    setIsUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadSessionPhoto(user.id, sessionDetail.session.id, file);
        const url = await getPhotoUrl(photo.file_path);
        setPhotos(prev => [...prev, photo]);
        if (url) setPhotoUrls(prev => ({ ...prev, [photo.id]: url }));
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
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      setPhotoUrls(prev => { const u = { ...prev }; delete u[photo.id]; return u; });
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
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption: captionText } : p));
      setEditingCaption(null);
    } catch (err) {
      console.error('Caption error:', err);
    }
  };

  const saveMaterials = async (materials: string[]) => {
    if (!sessionDetail) return;
    setIsSavingMaterials(true);
    try {
      const { error } = await supabase
        .from('group_sessions')
        .update({ materials })
        .eq('id', sessionDetail.session.id);
      if (error) throw error;
      setSessionDetail(prev => prev ? { ...prev, session: { ...prev.session, materials } } : prev);
      setSessions(prev => prev.map(s => s.id === sessionDetail.session.id ? { ...s, materials } : s));
    } catch (err) {
      console.error('Materials error:', err);
      toast('Erreur lors de la sauvegarde');
    } finally {
      setIsSavingMaterials(false);
    }
  };

  const handleAddMaterial = () => {
    const item = newMaterial.trim();
    if (!item || !sessionDetail) return;
    const updated = [...sessionDetail.session.materials, item];
    saveMaterials(updated);
    setNewMaterial('');
  };

  const handleRemoveMaterial = (index: number) => {
    if (!sessionDetail) return;
    const updated = sessionDetail.session.materials.filter((_, i) => i !== index);
    saveMaterials(updated);
  };

  const handleStartEditGroup = (group: SessionGroup) => {
    const grades: Record<string, number> = {};
    group.grades.forEach(g => { grades[g.criteria_id] = g.points_awarded; });
    setEditGrades(grades);
    setEditingGroupId(group.id);
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditGrades({});
  };

  const handleSaveGrades = async (groupId: string) => {
    if (!sessionDetail) return;
    setIsSavingGrades(true);

    try {
      const rows = sessionDetail.criteria.map(c => ({
        group_id: groupId,
        criteria_id: c.id,
        points_awarded: editGrades[c.id] ?? 0,
      }));

      const { error } = await supabase
        .from('group_grades')
        .upsert(rows, { onConflict: 'group_id,criteria_id' });
      if (error) throw error;

      // Reload detail
      await loadSessionDetail(sessionDetail.session);
      setEditingGroupId(null);
      setEditGrades({});
    } catch (err) {
      console.error('Error saving grades:', err);
      toast('Erreur lors de la sauvegarde des notes.');
    } finally {
      setIsSavingGrades(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionDetail) return;

    setIsDeleting(true);
    try {
      const linkedSessionId = sessionDetail.session.linked_session_id;

      // 1. Delete group session (cascade: grading_criteria, session_groups -> members, grades)
      const { error } = await supabase
        .from('group_sessions')
        .delete()
        .eq('id', sessionDetail.session.id);

      if (error) throw error;

      // 2. If linked to a regular session, also delete events + session
      if (linkedSessionId) {
        const { error: eventsError } = await supabase.from('events').delete().eq('session_id', linkedSessionId);
        if (eventsError) throw eventsError;

        const { error: sessionError } = await supabase.from('sessions').delete().eq('id', linkedSessionId);
        if (sessionError) throw sessionError;
      }

      // Remove from local state
      setSessions(prev => prev.filter(s => s.id !== sessionDetail.session.id));
      handleCloseDetail();
    } catch (err) {
      console.error('Error deleting session:', err);
      toast('Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleExportPDF = () => {
    if (!sessionDetail) return;

    const doc = new jsPDF();
    const { session, criteria, groups } = sessionDetail;
    const maxPoints = criteria.reduce((sum, c) => sum + c.max_points, 0);

    // Build list of all students with their data
    const students: {
      name: string;
      groupName: string;
      teammates: string;
      grades: { label: string; points: number; max: number }[];
      total: number;
      malus: number;
    }[] = [];

    groups.forEach(group => {
      group.members.forEach(member => {
        const teammates = group.members
          .filter(m => m.id !== member.id)
          .map(m => m.pseudo)
          .join(', ') || '-';

        const grades = criteria.map(c => {
          const grade = group.grades.find(g => g.criteria_id === c.id);
          return {
            label: c.label,
            points: grade?.points_awarded ?? 0,
            max: c.max_points,
          };
        });

        students.push({
          name: member.pseudo,
          groupName: group.name,
          teammates,
          grades,
          total: group.total_score,
          malus: group.conduct_malus,
        });
      });
    });

    // Sort alphabetically
    students.sort((a, b) => a.name.localeCompare(b.name));

    // Config: 3 fiches par page (A4)
    const cardHeight = 85; // mm
    const cardWidth = 180; // mm
    const marginLeft = 15;
    const marginTop = 15;
    const cardsPerPage = 3;

    students.forEach((student, index) => {
      const cardIndex = index % cardsPerPage;
      const yOffset = marginTop + cardIndex * (cardHeight + 5);

      // New page if needed
      if (index > 0 && cardIndex === 0) {
        doc.addPage();
      }

      // Draw card border (dashed for cutting)
      doc.setDrawColor(180, 180, 180);
      doc.setLineDashPattern([2, 2], 0);
      doc.rect(marginLeft - 3, yOffset - 3, cardWidth + 6, cardHeight);
      doc.setLineDashPattern([], 0);

      // Header: TP name + class
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text(session.name, marginLeft, yOffset + 5);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${session.class_name} - ${formatDate(session.created_at)}`, marginLeft, yOffset + 10);

      // Student name (big)
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(student.name, marginLeft, yOffset + 20);

      // Group + teammates
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Groupe: ${student.groupName}`, marginLeft, yOffset + 27);
      doc.text(`Avec: ${student.teammates}`, marginLeft, yOffset + 33);

      // Grades table
      const tableData = student.grades.map(g => [g.label, `${g.points} / ${g.max}`]);
      if (student.malus > 0) {
        tableData.push(['Malus conduite', `-${student.malus}`]);
      }
      tableData.push(['TOTAL', `${student.total} / ${maxPoints}`]);

      autoTable(doc, {
        body: tableData,
        startY: yOffset + 37,
        margin: { left: marginLeft },
        tableWidth: cardWidth,
        styles: {
          fontSize: 8,
          cellPadding: 1.5,
        },
        columnStyles: {
          0: { cellWidth: cardWidth - 30 },
          1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
        },
        bodyStyles: {
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        didParseCell: (data) => {
          // Style the TOTAL row
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [34, 197, 94];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          // Style malus row in red
          if (data.row.index === tableData.length - 2 && student.malus > 0) {
            data.cell.styles.textColor = [220, 38, 38];
          }
        },
      });
    });

    // Save
    doc.save(`${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_fiches.pdf`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          label: 'Terminee',
          bg: 'var(--pos-soft)',
          color: 'var(--pos)',
        };
      case 'active':
        return {
          label: 'En cours',
          bg: 'var(--warn-soft)',
          color: 'var(--warn)',
        };
      default:
        return {
          label: 'Brouillon',
          bg: 'var(--surface-3)',
          color: 'var(--text-dim)',
        };
    }
  };

  // Sessions filtered by selected class
  const filteredSessions = selectedClassId
    ? sessions.filter(s => s.class_id === selectedClassId)
    : sessions;

  // Count sessions per class
  const sessionCountByClass = new Map<string, number>();
  sessions.forEach(s => {
    sessionCountByClass.set(s.class_id, (sessionCountByClass.get(s.class_id) || 0) + 1);
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--text-muted)]">Chargement...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Error banner */}
      {error && (
        <div
          className="bg-[var(--neg-soft)] text-[var(--neg)] p-4 mb-4 flex items-center justify-between"
          style={{ borderRadius: 'var(--radius)' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--neg)] hover:opacity-70">x</button>
        </div>
      )}

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* LEFT SIDEBAR - Class list */}
        <aside className="w-64 shrink-0 flex flex-col">
          <h1 className="text-[var(--text)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}>Groupes</h1>
          <p className="text-[var(--text-muted)] mt-1 mb-4 text-sm">{sessions.length} seance{sessions.length > 1 ? 's' : ''}</p>

          <div className="flex-1 overflow-y-auto space-y-1">
            {/* "All" option */}
            <button
              onClick={() => setSelectedClassId(null)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                selectedClassId === null
                  ? 'bg-[var(--indigo)] text-white shadow-md'
                  : 'hover:bg-[var(--surface)] text-[var(--text)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Toutes les classes</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedClassId === null
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
                }`}>
                  {sessions.length}
                </span>
              </div>
            </button>

            {classes.map(cls => {
              const isActive = selectedClassId === cls.id;
              const count = sessionCountByClass.get(cls.id) || 0;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'hover:bg-[var(--surface)] text-[var(--text)]'
                  }`}
                  style={isActive ? { background: getClassGradient(cls.name) } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{cls.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
                    }`}>
                      {count}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN AREA - Sessions list */}
        <main className="flex-1 min-w-0">
          {filteredSessions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4">👥</div>
                <h2 className="text-lg font-medium text-[var(--text)]">Aucune seance de groupe</h2>
                <p className="text-[var(--text-dim)] mt-2">
                  {selectedClassId
                    ? 'Aucune seance pour cette classe'
                    : 'Creez une seance de groupe depuis l\'application mobile'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map((session) => {
                const statusBadge = getStatusBadge(session.status);

                return (
                  <button
                    key={session.id}
                    onClick={() => handleOpenDetail(session)}
                    className="w-full text-left p-4 bg-[var(--surface)] hover:shadow-lg transition-all rounded-xl border border-[var(--border)] hover:border-[var(--indigo)]/30"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 flex items-center justify-center text-white font-bold text-sm shrink-0 rounded-xl"
                        style={{ background: getClassGradient(session.class_name) }}
                      >
                        {getClassInitials(session.class_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--text)] truncate">{session.name}</span>
                          <span
                            className="inline-flex px-2 py-0.5 text-xs font-medium shrink-0"
                            style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 'var(--radius-full)' }}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-dim)]">
                          <span>{session.class_name}</span>
                          <span>{formatDate(session.created_at)}</span>
                          <span>{session.groups_count} groupe{session.groups_count > 1 ? 's' : ''}</span>
                          <span>{session.total_points} pts</span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-[var(--text-dim)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && sessionDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div
            className="bg-[var(--surface)] w-full max-w-md p-6"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
          >
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto mb-4 bg-[var(--neg-soft)] flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)]">
                Supprimer cette seance ?
              </h3>
              <p className="text-[var(--text-muted)] mt-2">
                La seance <strong>{sessionDetail.session.name}</strong> et toutes ses donnees
                (groupes, notes, criteres) seront definitivement supprimees.
              </p>
              {sessionDetail.session.linked_session_id && (
                <p className="text-sm text-[var(--neg)] mt-3 p-3 bg-[var(--neg-soft)] font-medium text-left" style={{ borderRadius: 'var(--radius)' }}>
                  La seance classique liee et tous ses evenements (participations, bavardages, etc.) seront egalement supprimes.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteSession}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-[var(--neg)] text-white hover:opacity-90 transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius)' }}
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseDetail}
        >
          <div
            className="bg-[var(--surface)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingDetail || !sessionDetail ? (
              <div className="flex justify-center items-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[var(--text-muted)]">Chargement...</span>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div
                  className="p-5 text-white shrink-0"
                  style={{ background: getClassGradient(sessionDetail.session.class_name) }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 bg-white/20 flex items-center justify-center font-bold text-lg"
                        style={{ borderRadius: 'var(--radius)' }}
                      >
                        {getClassInitials(sessionDetail.session.class_name)}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{sessionDetail.session.name}</h3>
                        <p className="text-white/80 text-sm mt-0.5">
                          {sessionDetail.session.class_name} - {formatDate(sessionDetail.session.created_at)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCloseDetail}
                      className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors"
                      style={{ borderRadius: 'var(--radius)' }}
                    >
                      x
                    </button>
                  </div>
                </div>

                {/* Criteria summary - Accordion on mobile, always visible on desktop */}
                <div className="px-6 py-3 border-b border-[var(--border)] bg-[var(--surface-3)]/50">
                  {/* Mobile: clickable header */}
                  <button
                    onClick={() => setCriteriaExpanded(!criteriaExpanded)}
                    className="md:hidden w-full flex items-center justify-between text-left"
                  >
                    <h4 className="text-sm font-medium text-[var(--text-muted)]">
                      Criteres ({sessionDetail.criteria.length}) - {sessionDetail.criteria.reduce((sum, c) => sum + c.max_points, 0)} pts
                    </h4>
                    <span className={`text-[var(--text-dim)] transition-transform ${criteriaExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {/* Desktop: always visible header */}
                  <h4 className="hidden md:block text-sm font-medium text-[var(--text-muted)] mb-3">
                    Criteres de notation ({sessionDetail.criteria.length})
                  </h4>

                  {/* Content - hidden on mobile unless expanded, always visible on desktop */}
                  <div className={`${criteriaExpanded ? 'mt-3' : 'hidden'} md:block`}>
                    <div className="flex flex-wrap gap-2">
                      {sessionDetail.criteria.map(c => (
                        <span
                          key={c.id}
                          className="px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)]"
                          style={{ borderRadius: 'var(--radius)' }}
                        >
                          {c.label} <span className="text-[var(--text-dim)]">({c.max_points} pts)</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-dim)]">
                      Total: {sessionDetail.criteria.reduce((sum, c) => sum + c.max_points, 0)} points
                    </div>
                  </div>
                </div>

                {/* Groups + Materials + Photos — all scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                  {/* Materials section */}
                  <div className="mb-6 pb-4 border-b border-[var(--border)]">
                    <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">
                      Matériel nécessaire
                    </h4>
                    {sessionDetail.session.materials.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {sessionDetail.session.materials.map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] group"
                            style={{ borderRadius: 'var(--radius)' }}
                          >
                            {item}
                            <button
                              onClick={() => handleRemoveMaterial(i)}
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
                        className="flex-1 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                        style={{ borderRadius: 'var(--radius)' }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddMaterial(); }}
                        disabled={isSavingMaterials}
                      />
                      <button
                        onClick={handleAddMaterial}
                        disabled={!newMaterial.trim() || isSavingMaterials}
                        className="px-3 py-2 text-sm font-medium bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
                        style={{ borderRadius: 'var(--radius)' }}
                      >
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Photos section */}
                  <div className="mb-6 pb-4 border-b border-[var(--border)]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-[var(--text-muted)]">
                        Photos de référence ({photos.length})
                      </h4>
                      <label
                        className="px-3 py-1.5 text-sm font-medium bg-[var(--surface-3)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex items-center gap-2"
                        style={{ borderRadius: 'var(--radius)' }}
                      >
                        <Icon name="plus" size={14} />
                        {isUploadingPhoto ? 'Upload...' : 'Ajouter'}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleUploadPhoto(e.target.files)}
                          style={{ display: 'none' }}
                          disabled={isUploadingPhoto}
                        />
                      </label>
                    </div>

                    {photos.length === 0 ? (
                      <div className="text-center py-4 text-[var(--text-dim)] text-sm">
                        Aucune photo. Ajoutez des images de référence pour ce TP.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                        {photos.map(photo => (
                          <div
                            key={photo.id}
                            className="relative group cursor-pointer"
                            style={{ borderRadius: 'var(--radius)', overflow: 'hidden', aspectRatio: '1', background: 'var(--surface-3)' }}
                            onClick={() => setViewingPhoto(photo)}
                          >
                            {photoUrls[photo.id] ? (
                              <img
                                src={photoUrls[photo.id]}
                                alt={photo.caption || 'Photo TP'}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-[var(--text-dim)]">...</div>
                            )}
                            {photo.caption && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                padding: '16px 8px 6px', fontSize: 11, color: '#fff',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {photo.caption}
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo); }}
                              className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              style={{ fontSize: 12, lineHeight: 1 }}
                              title="Supprimer"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Results */}
                  <h4 className="text-sm font-medium text-[var(--text-muted)] mb-4">
                    Resultats par groupe
                  </h4>

                  {sessionDetail.groups.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-dim)]">
                      Aucun groupe dans cette seance
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sessionDetail.groups.map((group, idx) => {
                        const maxPoints = sessionDetail.criteria.reduce((sum, c) => sum + c.max_points, 0);
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
                                {isFirst && (
                                  <span className="text-xl">🥇</span>
                                )}
                                <span className="font-semibold text-[var(--text)]">{group.name}</span>
                                <span className="text-sm text-[var(--text-dim)]">
                                  ({group.members.length} eleve{group.members.length > 1 ? 's' : ''})
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {editingGroupId !== group.id && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleStartEditGroup(group); }}
                                    className="p-1.5 text-[var(--text-dim)] hover:text-[var(--indigo)] rounded-lg hover:bg-[var(--surface-3)] transition-colors"
                                    title="Modifier les notes"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

                            {/* Progress bar */}
                            <div
                              className="h-2 bg-[var(--surface-3)] mb-3"
                              style={{ borderRadius: 'var(--radius-full)' }}
                            >
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                                  background: percentage >= 70 ? 'var(--pos)' : percentage >= 50 ? 'var(--warn)' : 'var(--neg)',
                                  borderRadius: 'var(--radius-full)',
                                }}
                              />
                            </div>

                            {/* Members */}
                            <div className="flex flex-wrap gap-1">
                              {group.members.map(m => (
                                <span
                                  key={m.id}
                                  className="px-2 py-1 text-xs bg-[var(--surface-3)] text-[var(--text-muted)]"
                                  style={{ borderRadius: 'var(--radius-md)' }}
                                >
                                  {m.pseudo}
                                </span>
                              ))}
                            </div>

                            {/* Malus indicator */}
                            {group.conduct_malus > 0 && (
                              <div className="mt-2 text-xs text-[var(--neg)]">
                                Malus conduite: -{group.conduct_malus} pt{group.conduct_malus > 1 ? 's' : ''}
                              </div>
                            )}

                            {/* Criteria grades — only shown when this group is expanded */}
                            {(expandedGroupId === group.id || editingGroupId === group.id) && (
                              <div className="mt-3 pt-3 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
                                {editingGroupId === group.id ? (
                                  <>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      {sessionDetail.criteria.map(c => (
                                        <div key={c.id} className="flex items-center gap-2">
                                          <label className="text-sm text-[var(--text-dim)] flex-1 min-w-0 truncate">{c.label}</label>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min={0}
                                              max={c.max_points}
                                              step={0.5}
                                              value={editGrades[c.id] ?? 0}
                                              onChange={(e) => setEditGrades(prev => ({
                                                ...prev,
                                                [c.id]: Math.min(c.max_points, Math.max(0, parseFloat(e.target.value) || 0)),
                                              }))}
                                              className="w-16 px-2 py-1 text-sm text-center border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                            />
                                            <span className="text-xs text-[var(--text-dim)]">/{c.max_points}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex gap-2 mt-3 justify-end">
                                      <button
                                        onClick={handleCancelEdit}
                                        className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg)]"
                                        disabled={isSavingGrades}
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        onClick={() => handleSaveGrades(group.id)}
                                        disabled={isSavingGrades}
                                        className="px-3 py-1.5 text-sm bg-[var(--indigo)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                                      >
                                        {isSavingGrades ? 'Sauvegarde...' : 'Sauvegarder'}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {sessionDetail.criteria.map(c => {
                                      const grade = group.grades.find(g => g.criteria_id === c.id);
                                      const points = grade?.points_awarded ?? 0;
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

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border)] shrink-0 flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2.5 bg-[var(--neg-soft)] text-[var(--neg)] hover:bg-[var(--neg)] hover:text-white transition-colors font-medium"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2.5 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white transition-colors font-medium flex items-center gap-2"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    <span>📄</span> Exporter PDF
                  </button>
                  <button
                    onClick={handleCloseDetail}
                    className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Photo lightbox */}
      {viewingPhoto && photoUrls[viewingPhoto.id] && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center p-4"
          style={{ zIndex: 70 }}
          onClick={() => { setViewingPhoto(null); setEditingCaption(null); }}
        >
          <div
            className="relative max-w-3xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoUrls[viewingPhoto.id]}
              alt={viewingPhoto.caption || 'Photo TP'}
              style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--radius)' }}
            />
            {/* Caption */}
            <div className="mt-3 w-full max-w-md text-center">
              {editingCaption === viewingPhoto.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Légende..."
                    className="flex-1 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                    style={{ borderRadius: 'var(--radius)' }}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCaption(viewingPhoto.id); }}
                  />
                  <button
                    onClick={() => handleSaveCaption(viewingPhoto.id)}
                    className="px-3 py-2 text-sm bg-[var(--indigo)] text-white font-medium"
                    style={{ borderRadius: 'var(--radius)' }}
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingCaption(viewingPhoto.id); setCaptionText(viewingPhoto.caption || ''); }}
                  className="text-white/70 hover:text-white text-sm transition-colors"
                >
                  {viewingPhoto.caption || 'Ajouter une légende...'}
                </button>
              )}
            </div>
            {/* Close */}
            <button
              onClick={() => { setViewingPhoto(null); setEditingCaption(null); }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center transition-colors"
              style={{ fontSize: 18 }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
