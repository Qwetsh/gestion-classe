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

const CLASS_GRADIENTS = [
  'linear-gradient(135deg, #4A90D9 0%, #357ABD 100%)',
  'linear-gradient(135deg, #81C784 0%, #66BB6A 100%)',
  'linear-gradient(135deg, #9575CD 0%, #7E57C2 100%)',
  'linear-gradient(135deg, #FFB74D 0%, #FFA726 100%)',
  'linear-gradient(135deg, #E57373 0%, #EF5350 100%)',
  'linear-gradient(135deg, #4DB6AC 0%, #26A69A 100%)',
];

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

  // Error state
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [user, selectedClassId]);

  const loadSessions = async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (classesError) throw classesError;
      setClasses(classesData || []);

      let query = supabase
        .from('sessions')
        .select(`id, class_id, started_at, ended_at, classes (name)`)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (selectedClassId) {
        query = query.eq('class_id', selectedClassId);
      }

      const { data: sessionsData, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      if (sessionsData) {
        const sessionsWithCounts = await Promise.all(
          sessionsData.map(async (session) => {
            const { data: events } = await supabase
              .from('events')
              .select('type')
              .eq('session_id', session.id);

            const eventsData = events || [];
            return {
              id: session.id,
              class_id: session.class_id,
              class_name: (session.classes as any)?.name || 'Classe inconnue',
              started_at: session.started_at,
              ended_at: session.ended_at,
              events_count: eventsData.length,
              participations: eventsData.filter(e => e.type === 'participation').length,
              bavardages: eventsData.filter(e => e.type === 'bavardage').length,
              absences: eventsData.filter(e => e.type === 'absence').length,
              remarques: eventsData.filter(e => e.type === 'remarque').length,
              sorties: eventsData.filter(e => e.type === 'sortie').length,
            };
          })
        );
        setSessions(sessionsWithCounts);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Erreur lors du chargement des seances.');
    } finally {
      setIsLoading(false);
    }
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
      const { error: eventsError } = await supabase.from('events').delete().eq('session_id', deleteTarget.id);
      if (eventsError) throw eventsError;
      const { error: sessionError } = await supabase.from('sessions').delete().eq('id', deleteTarget.id);
      if (sessionError) throw sessionError;
      setShowDeleteModal(false);
      setDeleteTarget(null);
      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Erreur lors de la suppression de la seance.');
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
    const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  const getMonthName = (date: Date) => date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    return { daysInMonth: lastDay.getDate(), startDayOfWeek, year, month };
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
      return newDate;
    });
  };

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    sessions.forEach(session => {
      const dateKey = new Date(session.started_at).toISOString().split('T')[0];
      const existing = map.get(dateKey) || [];
      existing.push(session);
      map.set(dateKey, existing);
    });
    map.forEach((daySessions) => {
      daySessions.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    });
    return map;
  }, [sessions]);

  const getClassGradient = (className: string) => {
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CLASS_GRADIENTS[Math.abs(hash) % CLASS_GRADIENTS.length];
  };

  const getClassInitials = (className: string) => {
    return className.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

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
      <div className="space-y-6">
        {/* Error banner */}
        {error && (
          <div
            className="bg-[var(--color-error-soft)] text-[var(--color-error)] p-4 flex items-center justify-between"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[var(--color-error)] hover:opacity-70"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Seances</h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {sessions.length} seance{sessions.length > 1 ? 's' : ''} synchronisee{sessions.length > 1 ? 's' : ''}
            </p>
          </div>

          <div
            className="flex items-center gap-1 bg-[var(--color-surface)] p-1"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
          >
            {(['list', 'calendar'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  viewMode === mode
                    ? 'text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
                style={viewMode === mode ? {
                  background: 'var(--gradient-primary)',
                  borderRadius: 'var(--radius-lg)'
                } : { borderRadius: 'var(--radius-lg)' }}
              >
                {mode === 'list' ? '📋 Liste' : '📅 Calendrier'}
              </button>
            ))}
          </div>
        </div>

        {/* Class filter */}
        {classes.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-[var(--color-text-secondary)]">Filtrer:</span>
            <button
              onClick={() => setSelectedClassId(null)}
              className={`px-3 py-1.5 text-sm font-medium transition-all ${
                selectedClassId === null ? 'text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
              style={{
                borderRadius: 'var(--radius-full)',
                ...(selectedClassId === null ? { background: 'var(--gradient-primary)' } : {})
              }}
            >
              Toutes
            </button>
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-3 py-1.5 text-sm font-medium transition-all ${
                  selectedClassId === cls.id ? 'text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
                style={{
                  borderRadius: 'var(--radius-full)',
                  ...(selectedClassId === cls.id ? { background: getClassGradient(cls.name) } : {})
                }}
              >
                {cls.name}
              </button>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          sessions.length === 0 ? (
            <div
              className="bg-[var(--color-surface)] p-12 text-center"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="w-20 h-20 mx-auto mb-4 bg-[var(--color-primary-soft)] flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="text-4xl">📅</span>
              </div>
              <h2 className="text-lg font-medium text-[var(--color-text)]">Aucune seance</h2>
              <p className="text-[var(--color-text-tertiary)] mt-2">
                {selectedClassId ? 'Aucune seance pour cette classe' : 'Demarrez une seance depuis l\'application mobile'}
              </p>
            </div>
          ) : (
            <div
              className="bg-[var(--color-surface)] divide-y divide-[var(--color-border)]"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              {sessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/sessions/${session.id}`}
                  className="block p-4 hover:bg-[var(--color-surface-hover)] transition-colors first:rounded-t-xl last:rounded-b-xl"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: getClassGradient(session.class_name), borderRadius: 'var(--radius-lg)' }}
                      >
                        {getClassInitials(session.class_name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--color-text)]">{session.class_name}</span>
                          {!session.ended_at && (
                            <span
                              className="px-2 py-0.5 bg-[var(--color-success-soft)] text-[var(--color-success)] text-xs font-medium flex items-center gap-1"
                              style={{ borderRadius: 'var(--radius-full)' }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                              En cours
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[var(--color-text-tertiary)]">
                          {formatDate(session.started_at)} a {formatTime(session.started_at)}
                          {session.ended_at && ` · ${getDuration(session.started_at, session.ended_at)}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex gap-3">
                        <span className="flex items-center gap-1.5 text-sm">
                          <span
                            className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--color-participation-soft)', color: 'var(--color-participation)', borderRadius: 'var(--radius-md)' }}
                          >+</span>
                          <span className="text-[var(--color-text-secondary)] font-medium">{session.participations}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-sm">
                          <span
                            className="w-7 h-7 flex items-center justify-center text-xs font-bold"
                            style={{ background: 'var(--color-bavardage-soft)', color: 'var(--color-bavardage)', borderRadius: 'var(--radius-md)' }}
                          >-</span>
                          <span className="text-[var(--color-text-secondary)] font-medium">{session.bavardages}</span>
                        </span>
                        <span
                          className="px-2 py-1 text-xs font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface-secondary)]"
                          style={{ borderRadius: 'var(--radius-md)' }}
                        >
                          {session.events_count} evt
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleOpenDeleteModal(e, session)}
                        className="p-2 text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-colors"
                        style={{ borderRadius: 'var(--radius-lg)' }}
                      >
                        🗑️
                      </button>
                      <span className="text-[var(--color-text-tertiary)] text-xl">›</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div
            className="bg-[var(--color-surface)] overflow-hidden"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                ←
              </button>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold text-[var(--color-text)] capitalize">
                  {getMonthName(currentMonth)}
                </h2>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1.5 text-sm bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)] font-medium"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  Aujourd'hui
                </button>
              </div>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-[var(--color-surface-hover)] transition-colors"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                <div key={day} className="py-3 text-center text-sm font-semibold text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {(() => {
                const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                const cells = [];
                const today = new Date();
                const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

                for (let i = 0; i < startDayOfWeek; i++) {
                  cells.push(<div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-[var(--color-border)] bg-[var(--color-surface-secondary)]/30" />);
                }

                for (let day = 1; day <= daysInMonth; day++) {
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const daySessions = sessionsByDate.get(dateKey) || [];
                  const isToday = isCurrentMonth && today.getDate() === day;
                  const isWeekend = (startDayOfWeek + day - 1) % 7 >= 5;

                  cells.push(
                    <div
                      key={day}
                      className={`min-h-[100px] border-b border-r border-[var(--color-border)] p-1 ${isWeekend ? 'bg-[var(--color-surface-secondary)]/30' : ''}`}
                    >
                      <div className="text-right mb-1">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium ${isToday ? 'text-white font-bold' : 'text-[var(--color-text-secondary)]'}`}
                          style={isToday ? { background: 'var(--gradient-primary)', borderRadius: 'var(--radius-full)' } : undefined}
                        >
                          {day}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {daySessions.slice(0, 3).map((session) => (
                          <button
                            key={session.id}
                            onClick={() => { setSelectedSession(session); setShowSessionModal(true); }}
                            className="w-full text-left px-1.5 py-0.5 text-xs text-white truncate hover:opacity-80 transition-opacity"
                            style={{ background: getClassGradient(session.class_name), borderRadius: 'var(--radius-sm)' }}
                            title={`${session.class_name} - ${formatTime(session.started_at)}`}
                          >
                            <span className="font-medium">{getClassInitials(session.class_name)}</span>
                            <span className="ml-1 opacity-80">{formatTime(session.started_at)}</span>
                          </button>
                        ))}
                        {daySessions.length > 3 && (
                          <div className="text-xs text-[var(--color-text-tertiary)] text-center">+{daySessions.length - 3}</div>
                        )}
                      </div>
                    </div>
                  );
                }

                const remainingCells = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
                for (let i = 0; i < remainingCells; i++) {
                  cells.push(<div key={`empty-end-${i}`} className="min-h-[100px] border-b border-r border-[var(--color-border)] bg-[var(--color-surface-secondary)]/30" />);
                }

                return cells;
              })()}
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-[var(--color-text-tertiary)]">Legende:</span>
                {classes.map((cls) => (
                  <div key={cls.id} className="flex items-center gap-2">
                    <span className="w-4 h-4" style={{ background: getClassGradient(cls.name), borderRadius: 'var(--radius-sm)' }} />
                    <span className="text-[var(--color-text-secondary)]">{cls.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] p-6 w-full max-w-md" style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'var(--color-error-soft)', borderRadius: 'var(--radius-lg)' }}>
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">Supprimer la seance</h3>
            </div>
            <p className="text-[var(--color-text-secondary)] mb-2">
              Voulez-vous vraiment supprimer cette seance du <strong>{formatDate(deleteTarget.started_at)}</strong> ?
            </p>
            <p className="text-sm text-[var(--color-text-tertiary)] mb-6 p-3 bg-[var(--color-surface-secondary)]" style={{ borderRadius: 'var(--radius-lg)' }}>
              {deleteTarget.events_count} evenement{deleteTarget.events_count > 1 ? 's' : ''} seront supprimes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium"
                style={{ borderRadius: 'var(--radius-lg)' }}
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-50 transition-all font-medium"
                style={{ background: 'var(--gradient-error)', borderRadius: 'var(--radius-lg)' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] w-full max-w-lg overflow-hidden" style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="p-5 text-white" style={{ background: getClassGradient(selectedSession.class_name) }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 flex items-center justify-center font-bold text-lg" style={{ borderRadius: 'var(--radius-lg)' }}>
                    {getClassInitials(selectedSession.class_name)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{selectedSession.class_name}</h3>
                    <p className="text-white/80 text-sm mt-0.5">{formatDate(selectedSession.started_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSessionModal(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-6 text-sm">
                <div><span className="text-[var(--color-text-tertiary)]">Debut:</span> <span className="font-semibold text-[var(--color-text)]">{formatTime(selectedSession.started_at)}</span></div>
                {selectedSession.ended_at ? (
                  <>
                    <div><span className="text-[var(--color-text-tertiary)]">Fin:</span> <span className="font-semibold text-[var(--color-text)]">{formatTime(selectedSession.ended_at)}</span></div>
                    <div><span className="text-[var(--color-text-tertiary)]">Duree:</span> <span className="font-semibold text-[var(--color-text)]">{getDuration(selectedSession.started_at, selectedSession.ended_at)}</span></div>
                  </>
                ) : (
                  <span className="px-3 py-1 bg-[var(--color-success-soft)] text-[var(--color-success)] text-xs font-semibold flex items-center gap-1" style={{ borderRadius: 'var(--radius-full)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                    En cours
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Resume des evenements</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'participations', label: 'Implications', color: 'participation' },
                    { key: 'bavardages', label: 'Bavardages', color: 'bavardage' },
                    { key: 'absences', label: 'Absences', color: 'absence' },
                    { key: 'remarques', label: 'Remarques', color: 'remarque' },
                    { key: 'sorties', label: 'Sorties', color: 'sortie' },
                    { key: 'events_count', label: 'Total', color: 'text' },
                  ].map(({ key, label, color }) => (
                    <div
                      key={key}
                      className="p-3 text-center"
                      style={{ background: color === 'text' ? 'var(--color-surface-secondary)' : `var(--color-${color}-soft)`, borderRadius: 'var(--radius-lg)' }}
                    >
                      <div className="text-2xl font-bold" style={{ color: color === 'text' ? 'var(--color-text)' : `var(--color-${color})` }}>
                        {selectedSession[key as keyof Session]}
                      </div>
                      <div className="text-xs" style={{ color: color === 'text' ? 'var(--color-text-tertiary)' : `var(--color-${color})` }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Link
                  to={`/sessions/${selectedSession.id}`}
                  className="flex-1 px-4 py-2.5 text-white text-center hover:opacity-90 transition-all font-medium"
                  style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
                >
                  Voir les details
                </Link>
                <button
                  onClick={(e) => { setShowSessionModal(false); handleOpenDeleteModal(e, selectedSession); }}
                  className="px-4 py-2.5 border border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-colors font-medium"
                  style={{ borderRadius: 'var(--radius-lg)' }}
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
