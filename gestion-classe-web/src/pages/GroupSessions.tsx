import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { getClassGradient, getClassInitials } from '../lib/constants';
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
          id, name, class_id, status, created_at, completed_at, linked_session_id,
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
    await loadSessionDetail(session);
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSessionDetail(null);
    setShowDeleteConfirm(false);
    setEditingGroupId(null);
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
      alert('Erreur lors de la sauvegarde des notes.');
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
      alert('Erreur lors de la suppression');
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
          bg: 'var(--color-success-soft)',
          color: 'var(--color-success)',
        };
      case 'active':
        return {
          label: 'En cours',
          bg: 'var(--color-warning-soft)',
          color: 'var(--color-warning)',
        };
      default:
        return {
          label: 'Brouillon',
          bg: 'var(--color-surface-secondary)',
          color: 'var(--color-text-tertiary)',
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
            <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-[var(--color-text-secondary)]">Chargement...</span>
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
          className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4 mb-4 flex items-center justify-between"
          style={{ borderRadius: 'var(--radius-lg)' }}
        >
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--color-error)] hover:opacity-70">x</button>
        </div>
      )}

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
        {/* LEFT SIDEBAR - Class list */}
        <aside className="w-64 shrink-0 flex flex-col">
          <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Groupes</h1>

          <div className="flex-1 overflow-y-auto space-y-1">
            {/* "All" option */}
            <button
              onClick={() => setSelectedClassId(null)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${
                selectedClassId === null
                  ? 'bg-[var(--color-primary)] text-white shadow-md'
                  : 'hover:bg-[var(--color-surface)] text-[var(--color-text)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Toutes les classes</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  selectedClassId === null
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
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
                      : 'hover:bg-[var(--color-surface)] text-[var(--color-text)]'
                  }`}
                  style={isActive ? { background: getClassGradient(cls.name) } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{cls.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
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
                <h2 className="text-lg font-medium text-[var(--color-text)]">Aucune seance de groupe</h2>
                <p className="text-[var(--color-text-tertiary)] mt-2">
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
                    className="w-full text-left p-4 bg-[var(--color-surface)] hover:shadow-lg transition-all rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/30"
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
                          <span className="font-semibold text-[var(--color-text)] truncate">{session.name}</span>
                          <span
                            className="inline-flex px-2 py-0.5 text-xs font-medium shrink-0"
                            style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 'var(--radius-full)' }}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--color-text-tertiary)]">
                          <span>{session.class_name}</span>
                          <span>{formatDate(session.created_at)}</span>
                          <span>{session.groups_count} groupe{session.groups_count > 1 ? 's' : ''}</span>
                          <span>{session.total_points} pts</span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-[var(--color-text-tertiary)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            className="bg-[var(--color-surface)] w-full max-w-md p-6"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto mb-4 bg-[var(--color-error-soft)] flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="text-3xl">🗑️</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                Supprimer cette seance ?
              </h3>
              <p className="text-[var(--color-text-secondary)] mt-2">
                La seance <strong>{sessionDetail.session.name}</strong> et toutes ses donnees
                (groupes, notes, criteres) seront definitivement supprimees.
              </p>
              {sessionDetail.session.linked_session_id && (
                <p className="text-sm text-[var(--color-error)] mt-3 p-3 bg-[var(--color-error-soft)] font-medium text-left" style={{ borderRadius: 'var(--radius-lg)' }}>
                  La seance classique liee et tous ses evenements (participations, bavardages, etc.) seront egalement supprimes.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteSession}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-[var(--color-error)] text-white hover:opacity-90 transition-colors font-medium disabled:opacity-50"
                style={{ borderRadius: 'var(--radius-lg)' }}
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
            className="bg-[var(--color-surface)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {isLoadingDetail || !sessionDetail ? (
              <div className="flex justify-center items-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[var(--color-text-secondary)]">Chargement...</span>
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
                        style={{ borderRadius: 'var(--radius-lg)' }}
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
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      x
                    </button>
                  </div>
                </div>

                {/* Criteria summary - Accordion on mobile, always visible on desktop */}
                <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/50">
                  {/* Mobile: clickable header */}
                  <button
                    onClick={() => setCriteriaExpanded(!criteriaExpanded)}
                    className="md:hidden w-full flex items-center justify-between text-left"
                  >
                    <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">
                      Criteres ({sessionDetail.criteria.length}) - {sessionDetail.criteria.reduce((sum, c) => sum + c.max_points, 0)} pts
                    </h4>
                    <span className={`text-[var(--color-text-tertiary)] transition-transform ${criteriaExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </button>

                  {/* Desktop: always visible header */}
                  <h4 className="hidden md:block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                    Criteres de notation ({sessionDetail.criteria.length})
                  </h4>

                  {/* Content - hidden on mobile unless expanded, always visible on desktop */}
                  <div className={`${criteriaExpanded ? 'mt-3' : 'hidden'} md:block`}>
                    <div className="flex flex-wrap gap-2">
                      {sessionDetail.criteria.map(c => (
                        <span
                          key={c.id}
                          className="px-3 py-1.5 text-sm bg-[var(--color-surface)] border border-[var(--color-border)]"
                          style={{ borderRadius: 'var(--radius-lg)' }}
                        >
                          {c.label} <span className="text-[var(--color-text-tertiary)]">({c.max_points} pts)</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                      Total: {sessionDetail.criteria.reduce((sum, c) => sum + c.max_points, 0)} points
                    </div>
                  </div>
                </div>

                {/* Groups */}
                <div className="flex-1 overflow-y-auto p-6">
                  <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
                    Resultats par groupe
                  </h4>

                  {sessionDetail.groups.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-tertiary)]">
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
                            className={`p-4 border ${isFirst ? 'border-[var(--color-success)]' : 'border-[var(--color-border)]'}`}
                            style={{ borderRadius: 'var(--radius-xl)' }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {isFirst && (
                                  <span className="text-xl">🥇</span>
                                )}
                                <span className="font-semibold text-[var(--color-text)]">{group.name}</span>
                                <span className="text-sm text-[var(--color-text-tertiary)]">
                                  ({group.members.length} eleve{group.members.length > 1 ? 's' : ''})
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                {editingGroupId !== group.id && (
                                  <button
                                    onClick={() => handleStartEditGroup(group)}
                                    className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
                                    title="Modifier les notes"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                )}
                                <div className="text-right">
                                  <div className="text-xl font-bold text-[var(--color-text)]">
                                    {group.total_score.toFixed(1)} <span className="text-sm font-normal text-[var(--color-text-tertiary)]">/ {maxPoints}</span>
                                  </div>
                                  <div className="text-sm text-[var(--color-text-secondary)]">{percentage}%</div>
                                </div>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div
                              className="h-2 bg-[var(--color-surface-secondary)] mb-3"
                              style={{ borderRadius: 'var(--radius-full)' }}
                            >
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.min(100, Math.max(0, percentage))}%`,
                                  background: percentage >= 70 ? 'var(--color-success)' : percentage >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                                  borderRadius: 'var(--radius-full)',
                                }}
                              />
                            </div>

                            {/* Members */}
                            <div className="flex flex-wrap gap-1">
                              {group.members.map(m => (
                                <span
                                  key={m.id}
                                  className="px-2 py-1 text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                                  style={{ borderRadius: 'var(--radius-md)' }}
                                >
                                  {m.pseudo}
                                </span>
                              ))}
                            </div>

                            {/* Malus indicator */}
                            {group.conduct_malus > 0 && (
                              <div className="mt-2 text-xs text-[var(--color-error)]">
                                Malus conduite: -{group.conduct_malus} pt{group.conduct_malus > 1 ? 's' : ''}
                              </div>
                            )}

                            {/* Criteria grades */}
                            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                              {editingGroupId === group.id ? (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {sessionDetail.criteria.map(c => (
                                      <div key={c.id} className="flex items-center gap-2">
                                        <label className="text-sm text-[var(--color-text-tertiary)] flex-1 min-w-0 truncate">{c.label}</label>
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
                                            className="w-16 px-2 py-1 text-sm text-center border border-[var(--color-border)] rounded-lg bg-[var(--color-background)] text-[var(--color-text)]"
                                          />
                                          <span className="text-xs text-[var(--color-text-tertiary)]">/{c.max_points}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-2 mt-3 justify-end">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
                                      disabled={isSavingGrades}
                                    >
                                      Annuler
                                    </button>
                                    <button
                                      onClick={() => handleSaveGrades(group.id)}
                                      disabled={isSavingGrades}
                                      className="px-3 py-1.5 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
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
                                        <span className="text-[var(--color-text-tertiary)]">{c.label}:</span>{' '}
                                        <span className="font-medium text-[var(--color-text)]">{points}/{c.max_points}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--color-border)] shrink-0 flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2.5 bg-[var(--color-error-soft)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white transition-colors font-medium"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    Supprimer
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="px-4 py-2.5 bg-green-100 text-green-700 hover:bg-green-600 hover:text-white transition-colors font-medium flex items-center gap-2"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    <span>📄</span> Exporter PDF
                  </button>
                  <button
                    onClick={handleCloseDetail}
                    className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
