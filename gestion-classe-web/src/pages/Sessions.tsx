import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

interface Session {
  id: string;
  class_id: string;
  class_name: string;
  started_at: string;
  ended_at: string | null;
  events_count: number;
  participations: number;
  bavardages: number;
  absences: number;
  remarques: number;
  sorties: number;
}

interface ClassFilter {
  id: string;
  name: string;
}

type ViewMode = 'list' | 'calendar';

export function Sessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassFilter[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Session detail modal state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    loadSessions();
  }, [user, selectedClassId]);

  const loadSessions = async () => {
    if (!user) return;
    setIsLoading(true);

    // Load classes for filter
    const { data: classesData } = await supabase
      .from('classes')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    setClasses(classesData || []);

    // Load sessions
    let query = supabase
      .from('sessions')
      .select(`
        id,
        class_id,
        started_at,
        ended_at,
        classes (name)
      `)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false });

    if (selectedClassId) {
      query = query.eq('class_id', selectedClassId);
    }

    const { data: sessionsData } = await query;

    if (sessionsData) {
      // Get event counts for each session
      const sessionsWithCounts = await Promise.all(
        sessionsData.map(async (session) => {
          const { data: events } = await supabase
            .from('events')
            .select('type')
            .eq('session_id', session.id);

          const eventsData = events || [];
          const participations = eventsData.filter(e => e.type === 'participation').length;
          const bavardages = eventsData.filter(e => e.type === 'bavardage').length;
          const absences = eventsData.filter(e => e.type === 'absence').length;
          const remarques = eventsData.filter(e => e.type === 'remarque').length;
          const sorties = eventsData.filter(e => e.type === 'sortie').length;

          return {
            id: session.id,
            class_id: session.class_id,
            class_name: (session.classes as any)?.name || 'Classe inconnue',
            started_at: session.started_at,
            ended_at: session.ended_at,
            events_count: eventsData.length,
            participations,
            bavardages,
            absences,
            remarques,
            sorties,
          };
        })
      );
      setSessions(sessionsWithCounts);
    }

    setIsLoading(false);
  };

  const handleOpenDeleteModal = (e: React.MouseEvent, session: Session) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(session);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      // Delete events first (even though CASCADE should handle it)
      await supabase.from('events').delete().eq('session_id', deleteTarget.id);
      // Then delete the session
      await supabase.from('sessions').delete().eq('id', deleteTarget.id);

      setShowDeleteModal(false);
      setDeleteTarget(null);
      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = (startedAt: string, endedAt: string | null) => {
    if (!endedAt) return 'En cours';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  // Calendar helpers
  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get the day of week for the first day (0 = Sunday, adjust for Monday start)
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Convert to Monday = 0

    return { daysInMonth, startDayOfWeek, year, month };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setMonth(newDate.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Group sessions by date for calendar
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach(session => {
      const dateKey = new Date(session.started_at).toISOString().split('T')[0];
      const existing = map.get(dateKey) || [];
      existing.push(session);
      map.set(dateKey, existing);
    });
    // Sort sessions within each day by time
    map.forEach((daySessions, key) => {
      daySessions.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    });
    return map;
  }, [sessions]);

  const openSessionModal = (session: Session) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  };

  // Get class color based on class name (deterministic)
  const getClassColor = (className: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
    ];
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getClassInitials = (className: string) => {
    return className
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="text-[var(--color-text-secondary)]">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page title and view toggle */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Seances</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {sessions.length} seance{sessions.length > 1 ? 's' : ''} synchronisee{sessions.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]'
              }`}
            >
              📋 Liste
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]'
              }`}
            >
              📅 Calendrier
            </button>
          </div>
        </div>

        {/* Class filter */}
        {classes.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-[var(--color-text-secondary)]">Filtrer:</span>
            <button
              onClick={() => setSelectedClassId(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedClassId === null
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]'
              }`}
            >
              Toutes
            </button>
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedClassId === cls.id
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-background)]'
                }`}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {sessions.length === 0 ? (
              <div className="bg-[var(--color-surface)] rounded-xl p-12 text-center">
                <div className="text-4xl mb-4">📅</div>
                <h2 className="text-lg font-medium text-[var(--color-text)]">
                  Aucune seance
                </h2>
                <p className="text-[var(--color-text-tertiary)] mt-2">
                  {selectedClassId
                    ? 'Aucune seance pour cette classe'
                    : 'Demarrez une seance depuis l\'application mobile'}
                </p>
              </div>
            ) : (
              <div className="bg-[var(--color-surface)] rounded-xl shadow-sm divide-y divide-[var(--color-border)]">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    to={`/sessions/${session.id}`}
                    className="block p-4 hover:bg-[var(--color-background)] transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--color-text)]">
                            {session.class_name}
                          </span>
                          {!session.ended_at && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              En cours
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[var(--color-text-tertiary)]">
                          {formatDate(session.started_at)} a {formatTime(session.started_at)}
                          {session.ended_at && ` - ${getDuration(session.started_at, session.ended_at)}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex gap-3">
                          <span className="flex items-center gap-1 text-sm">
                            <span className="w-6 h-6 rounded-full bg-[var(--color-participation)] text-white text-xs flex items-center justify-center font-semibold">
                              +
                            </span>
                            <span className="text-[var(--color-text-secondary)]">{session.participations}</span>
                          </span>
                          <span className="flex items-center gap-1 text-sm">
                            <span className="w-6 h-6 rounded-full bg-[var(--color-bavardage)] text-white text-xs flex items-center justify-center font-semibold">
                              -
                            </span>
                            <span className="text-[var(--color-text-secondary)]">{session.bavardages}</span>
                          </span>
                          <span className="text-sm text-[var(--color-text-tertiary)]">
                            {session.events_count} total
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleOpenDeleteModal(e, session)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          title="Supprimer la seance"
                        >
                          🗑️
                        </button>
                        <span className="text-[var(--color-text-tertiary)]">›</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="bg-[var(--color-surface)] rounded-xl shadow-sm overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-[var(--color-background)] rounded-lg transition-colors"
              >
                <span className="text-xl">←</span>
              </button>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)] capitalize">
                  {getMonthName(currentMonth)}
                </h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-[var(--color-background)] hover:bg-[var(--color-border)] rounded-lg transition-colors text-[var(--color-text-secondary)]"
                >
                  Aujourd'hui
                </button>
              </div>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-[var(--color-background)] rounded-lg transition-colors"
              >
                <span className="text-xl">→</span>
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-background)]"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {(() => {
                const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                const cells = [];
                const today = new Date();
                const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

                // Empty cells for days before the first of the month
                for (let i = 0; i < startDayOfWeek; i++) {
                  cells.push(
                    <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-[var(--color-border)] bg-[var(--color-background)]/50" />
                  );
                }

                // Days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const daySessions = sessionsByDate.get(dateKey) || [];
                  const isToday = isCurrentMonth && today.getDate() === day;
                  const isWeekend = (startDayOfWeek + day - 1) % 7 >= 5;

                  cells.push(
                    <div
                      key={day}
                      className={`min-h-[100px] border-b border-r border-[var(--color-border)] p-1 ${
                        isWeekend ? 'bg-[var(--color-background)]/30' : ''
                      }`}
                    >
                      <div className={`text-right mb-1 ${
                        isToday
                          ? 'text-white'
                          : 'text-[var(--color-text-secondary)]'
                      }`}>
                        <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                          isToday
                            ? 'bg-[var(--color-primary)] rounded-full font-bold'
                            : ''
                        }`}>
                          {day}
                        </span>
                      </div>

                      {/* Sessions for this day */}
                      <div className="space-y-1">
                        {daySessions.slice(0, 7).map((session) => (
                          <button
                            key={session.id}
                            onClick={() => openSessionModal(session)}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-xs text-white truncate hover:opacity-80 transition-opacity ${getClassColor(session.class_name)}`}
                            title={`${session.class_name} - ${formatTime(session.started_at)}`}
                          >
                            <span className="font-medium">{getClassInitials(session.class_name)}</span>
                            <span className="ml-1 opacity-80">{formatTime(session.started_at)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Fill remaining cells to complete the last row
                const totalCells = cells.length;
                const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                for (let i = 0; i < remainingCells; i++) {
                  cells.push(
                    <div key={`empty-end-${i}`} className="min-h-[100px] border-b border-r border-[var(--color-border)] bg-[var(--color-background)]/50" />
                  );
                }

                return cells;
              })()}
            </div>

            {/* Legend */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-background)]">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="text-[var(--color-text-tertiary)]">Legende:</span>
                {classes.map((cls) => (
                  <div key={cls.id} className="flex items-center gap-1">
                    <span className={`w-3 h-3 rounded ${getClassColor(cls.name)}`} />
                    <span className="text-[var(--color-text-secondary)]">{cls.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
              Supprimer la seance
            </h3>
            <p className="text-[var(--color-text-secondary)] mb-2">
              Voulez-vous vraiment supprimer cette seance du{' '}
              <strong>{formatDate(deleteTarget.started_at)}</strong> ?
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
              {deleteTarget.events_count} evenement{deleteTarget.events_count > 1 ? 's' : ''} (participations, bavardages, etc.) seront egalement supprimes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text)] hover:bg-[var(--color-background)]"
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal (Calendar View) */}
      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className={`p-4 text-white ${getClassColor(selectedSession.class_name)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold">{selectedSession.class_name}</h3>
                  <p className="text-white/80 text-sm mt-1">
                    {formatDate(selectedSession.started_at)}
                  </p>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <span className="text-xl">×</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Time info */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-text-tertiary)]">Debut:</span>
                  <span className="font-medium text-[var(--color-text)]">
                    {formatTime(selectedSession.started_at)}
                  </span>
                </div>
                {selectedSession.ended_at ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-tertiary)]">Fin:</span>
                      <span className="font-medium text-[var(--color-text)]">
                        {formatTime(selectedSession.ended_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-tertiary)]">Duree:</span>
                      <span className="font-medium text-[var(--color-text)]">
                        {getDuration(selectedSession.started_at, selectedSession.ended_at)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    En cours
                  </span>
                )}
              </div>

              {/* Event stats */}
              <div>
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
                  Resume des evenements
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedSession.participations}
                    </div>
                    <div className="text-xs text-green-700">Participations</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedSession.bavardages}
                    </div>
                    <div className="text-xs text-orange-700">Bavardages</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {selectedSession.absences}
                    </div>
                    <div className="text-xs text-red-700">Absences</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedSession.remarques}
                    </div>
                    <div className="text-xs text-blue-700">Remarques</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedSession.sorties}
                    </div>
                    <div className="text-xs text-purple-700">Sorties</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {selectedSession.events_count}
                    </div>
                    <div className="text-xs text-gray-700">Total</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Link
                  to={`/sessions/${selectedSession.id}`}
                  className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-center hover:bg-[var(--color-primary)]/90 transition-colors"
                >
                  Voir les details
                </Link>
                <button
                  onClick={(e) => {
                    setShowSessionModal(false);
                    handleOpenDeleteModal(e, selectedSession);
                  }}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
