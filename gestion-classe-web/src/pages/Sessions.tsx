import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { EVENT_CONFIG } from '../lib/constants';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { ClassChip, Icon } from '../components/design-system';

interface Session {
  id: string;
  class_id: string;
  class_name: string;
  topic: string | null;
  started_at: string;
  ended_at: string | null;
  room_id?: string;
  events_count: number;
  participations: number;
  malus: number;
  absences: number;
  remarques: number;
  sorties: number;
}

interface SessionEvent {
  id: string;
  student_id: string;
  type: string;
  subtype: string | null;
  note: string | null;
  timestamp: string;
}

interface ClassroomData {
  room: { grid_rows: number; grid_cols: number; disabled_cells: string[] } | null;
  positions: Record<string, string>; // "row-col" -> studentId
  students: { id: string; pseudo: string }[];
  events: SessionEvent[];
}

// EVENT_CONFIG imported from lib/constants

interface ClassFilter {
  id: string;
  name: string;
}

type ViewMode = 'list' | 'week' | 'month';

const COLOR_PALETTE = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6','#F97316','#06B6D4','#84CC16','#E879F9','#FB923C'];

function getClassLabel(name: string): string {
  return name.replace(/ème groupe /i, 'G').replace(/ème /i, '').substring(0, 3);
}

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  return Array.from({ length: 5 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

function formatWeekLabel(days: Date[]): string {
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}`;
  return `${fmt(days[0])} – ${fmt(days[4])}`;
}

// CLASS_GRADIENTS imported from lib/constants

export function Sessions() {
  const { user } = useAuth();
  const { toast } = useUIFeedback();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<ClassFilter[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [linkedGroupSession, setLinkedGroupSession] = useState<{ id: string; name: string } | null>(null);

  // Session detail modal state
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Classroom modal state
  const [classroomData, setClassroomData] = useState<ClassroomData | null>(null);
  const [isLoadingClassroom, setIsLoadingClassroom] = useState(false);
  // Error state
  const [error, setError] = useState<string | null>(null);


  // Add event states
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [addEventStudent, setAddEventStudent] = useState('');
  const [addEventType, setAddEventType] = useState('');
  const [addEventSubtype, setAddEventSubtype] = useState('');
  const [addEventNote, setAddEventNote] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);

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
        .select(`id, class_id, topic, started_at, ended_at, classes (name)`)
        .eq('user_id', user.id)
        .order('started_at', { ascending: false });

      if (selectedClassId) {
        query = query.eq('class_id', selectedClassId);
      }

      const { data: sessionsData, error: sessionsError } = await query;
      if (sessionsError) throw sessionsError;

      if (sessionsData && sessionsData.length > 0) {
        // Fetch ALL events for all sessions in ONE query
        const sessionIds = sessionsData.map(s => s.id);
        const { data: allEvents } = await supabase
          .from('events')
          .select('session_id, type')
          .in('session_id', sessionIds);

        // Group events by session_id
        const eventsBySession = new Map<string, { type: string }[]>();
        (allEvents || []).forEach(event => {
          const existing = eventsBySession.get(event.session_id) || [];
          existing.push(event);
          eventsBySession.set(event.session_id, existing);
        });

        // Map sessions with counts (no async needed now)
        const sessionsWithCounts = sessionsData.map((session) => {
          const eventsData = eventsBySession.get(session.id) || [];
          return {
            id: session.id,
            class_id: session.class_id,
            class_name: (session.classes as any)?.name || 'Classe inconnue',
            topic: session.topic,
            started_at: session.started_at,
            ended_at: session.ended_at,
            events_count: eventsData.length,
            participations: eventsData.filter(e => e.type === 'participation').length,
            malus: eventsData.filter(e => e.type === 'bavardage').length,
            absences: eventsData.filter(e => e.type === 'absence').length,
            remarques: eventsData.filter(e => e.type === 'remarque').length,
            sorties: eventsData.filter(e => e.type === 'sortie').length,
          };
        });
        setSessions(sessionsWithCounts);
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Error loading sessions:', err);
      setError('Erreur lors du chargement des seances.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClassroomData = async (session: Session) => {
    setIsLoadingClassroom(true);
    setClassroomData(null);

    try {
      // Fetch session with room info to get room_id
      const { data: sessionWithRoom } = await supabase
        .from('sessions')
        .select('room_id, rooms (grid_rows, grid_cols, disabled_cells)')
        .eq('id', session.id)
        .single();

      const roomId = sessionWithRoom?.room_id;
      // Supabase returns rooms as object for foreign key relation, cast via any
      const roomData = (sessionWithRoom?.rooms as any) as { grid_rows: number; grid_cols: number; disabled_cells: string[] } | null;

      // Parallel fetch: plan, students, events
      const [planResult, studentsResult, eventsResult] = await Promise.all([
        // Fetch class room plan (only if we have a room)
        roomId
          ? supabase
              .from('class_room_plans')
              .select('positions')
              .eq('class_id', session.class_id)
              .eq('room_id', roomId)
              .single()
          : Promise.resolve({ data: null }),
        // Fetch students
        supabase
          .from('students')
          .select('id, pseudo')
          .eq('class_id', session.class_id)
          .order('pseudo'),
        // Fetch events
        supabase
          .from('events')
          .select('id, student_id, type, subtype, note, timestamp')
          .eq('session_id', session.id)
          .order('timestamp', { ascending: true }),
      ]);

      setClassroomData({
        room: roomData || null,
        positions: planResult.data?.positions || {},
        students: studentsResult.data || [],
        events: eventsResult.data || [],
      });
    } catch (err) {
      console.error('Error loading classroom data:', err);
      setClassroomData({
        room: null,
        positions: {},
        students: [],
        events: [],
      });
    } finally {
      setIsLoadingClassroom(false);
    }
  };

  const handleOpenSessionModal = async (session: Session) => {
    setSelectedSession(session);
    setShowSessionModal(true);
    await loadClassroomData(session);
  };

  const handleCloseSessionModal = () => {
    setShowSessionModal(false);
    setSelectedSession(null);
    setClassroomData(null);
    setShowAddEvent(false);
    setAddEventStudent('');
    setAddEventType('');
    setAddEventSubtype('');
    setAddEventNote('');
  };

  const handleAddEvent = async () => {
    if (!selectedSession || !addEventStudent || !addEventType) return;
    setIsAddingEvent(true);
    try {
      const { error } = await supabase
        .from('events')
        .insert({
          session_id: selectedSession.id,
          student_id: addEventStudent,
          type: addEventType,
          subtype: addEventSubtype || null,
          note: addEventNote.trim() || null,
          timestamp: new Date().toISOString(),
        });
      if (error) { toast('Erreur lors de l\'ajout'); return; }
      // Refresh events in the sheet
      await loadClassroomData(selectedSession);
      // Update session counts
      loadSessions();
      // Reset form
      setAddEventStudent('');
      setAddEventType('');
      setAddEventSubtype('');
      setAddEventNote('');
      setShowAddEvent(false);
      toast('Événement ajouté');
    } catch (err) {
      console.error(err);
      toast('Erreur lors de l\'ajout');
    } finally {
      setIsAddingEvent(false);
    }
  };

  // Computed: student map for fast lookup
  const studentsMap = useMemo(() => {
    if (!classroomData) return new Map<string, { id: string; pseudo: string }>();
    return new Map(classroomData.students.map((s) => [s.id, s]));
  }, [classroomData]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      // 1. Delete linked group session first (FK constraint)
      if (linkedGroupSession) {
        const { error: gsError } = await supabase.from('group_sessions').delete().eq('id', linkedGroupSession.id);
        if (gsError) throw gsError;
      }

      // 2. Delete events
      const { error: eventsError } = await supabase.from('events').delete().eq('session_id', deleteTarget.id);
      if (eventsError) throw eventsError;

      // 3. Delete session
      const { error: sessionError } = await supabase.from('sessions').delete().eq('id', deleteTarget.id);
      if (sessionError) throw sessionError;

      setShowDeleteModal(false);
      setDeleteTarget(null);
      setLinkedGroupSession(null);
      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      toast('Erreur lors de la suppression de la seance.');
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

  const classCounts = useMemo(() => {
    const map: Record<string, number> = {};
    sessions.forEach(s => { map[s.class_id] = (map[s.class_id] || 0) + 1; });
    return map;
  }, [sessions]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === 'prev' ? -7 : 7));
      return d;
    });
  };

  const weekDays = useMemo(() => getWeekDays(currentWeek), [currentWeek]);
  const todayStr = new Date().toISOString().split('T')[0];

  const weekSessions = useMemo(() => {
    const result: Record<string, Session[]> = {};
    weekDays.forEach(d => {
      const key = d.toISOString().split('T')[0];
      result[key] = (sessionsByDate.get(key) || []);
    });
    return result;
  }, [weekDays, sessionsByDate]);

  // getClassGradient and getClassInitials imported from lib/constants

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
      <div className="space-y-6">
        {/* Error banner */}
        {error && (
          <div
            className="bg-[var(--neg-soft)] text-[var(--neg)] p-4 flex items-center justify-between"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-[var(--neg)] hover:opacity-70"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' as const }}>
          <div>
            <div className="breadcrumb" style={{ marginBottom: 6 }}>
              <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Accueil</Link>
              <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>›</span>
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>Séances</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontStyle: 'italic', fontSize: 40, lineHeight: 1, letterSpacing: '-0.02em' }}>Séances</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>
              {sessions.length} séance{sessions.length > 1 ? 's' : ''} cette année · {selectedClassId ? sessions.length : sessions.length} visibles
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="segbtn">
              {([['list', 'Liste', 'list'], ['week', 'Semaine', 'calendar-plus'], ['month', 'Mois', 'grid']] as [ViewMode, string, string][]).map(([mode, label, icon]) => (
                <button key={mode} className={`segbtn__b ${viewMode === mode ? 'is-on' : ''}`} onClick={() => setViewMode(mode)}>
                  <Icon name={icon as any} size={13} />
                  <span style={{ marginLeft: 4 }}>{label}</span>
                </button>
              ))}
            </div>
            <Link to="/sessions" className="btn btn--accent" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
              <Icon name="plus" size={14} /> Nouvelle séance
            </Link>
          </div>
        </div>

        {/* Class filter chips */}
        <div className="ses-filters" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <button
            onClick={() => setSelectedClassId(null)}
            className={`ses-filter ${selectedClassId === null ? 'is-on' : ''}`}
            style={selectedClassId === null ? { background: 'var(--text)', color: 'var(--surface)' } : undefined}
          >
            Toutes <span className="chip__count">{sessions.length}</span>
          </button>
          {classes.map((cls, i) => {
            const color = COLOR_PALETTE[i % COLOR_PALETTE.length];
            const count = classCounts[cls.id] || 0;
            if (count === 0) return null;
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(selectedClassId === cls.id ? null : cls.id)}
                className={`ses-filter ${selectedClassId === cls.id ? 'is-on' : ''}`}
                style={selectedClassId === cls.id ? { background: color, color: '#fff' } : undefined}
              >
                <span className="ses-filter__dot" style={{ background: color }} />
                {cls.name} <span className="chip__count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ====== LIST VIEW ====== */}
        {viewMode === 'list' && (
          sessions.length === 0 ? (
            <div className="gc-card" style={{ textAlign: 'center', padding: 48 }}>
              <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Aucune séance</h2>
              <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>
                {selectedClassId ? 'Aucune séance pour cette classe' : 'Démarrez une séance depuis l\'application mobile'}
              </p>
            </div>
          ) : (
            <div className="listview" style={{ marginTop: 14 }}>
              {(() => {
                const groups: { date: string; sessions: Session[] }[] = [];
                sessions.forEach(s => {
                  const d = new Date(s.started_at);
                  const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                  const dateKey = d.toDateString();
                  const last = groups[groups.length - 1];
                  if (last && last.date === dateKey) {
                    last.sessions.push(s);
                  } else {
                    groups.push({ date: dateKey, sessions: [s] });
                  }
                });
                return groups.map((group) => (
                  <div key={group.date} className="gc-card" style={{ marginBottom: 12 }}>
                    <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--border)', textTransform: 'capitalize' }}>
                      {new Date(group.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {group.sessions.map((session) => {
                      const classIdx = classes.findIndex(c => c.id === session.class_id);
                      const color = COLOR_PALETTE[classIdx >= 0 ? classIdx % COLOR_PALETTE.length : 0];
                      const total = session.participations + session.malus + session.absences;
                      const durMin = session.ended_at ? Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000) : 0;
                      return (
                        <div key={session.id} onClick={() => handleOpenSessionModal(session)} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 16, borderBottom: '1px solid var(--border)', color: 'inherit', transition: 'background 0.12s', cursor: 'pointer' }} className="lsession">
                          {/* Time */}
                          <div style={{ width: 56, flexShrink: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{formatTime(session.started_at)}</div>
                            {durMin > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{durMin}'</div>}
                          </div>
                          {/* Class chip */}
                          <ClassChip label={getClassLabel(session.class_name)} color={color} size={28} />
                          {/* Main */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{session.class_name}</div>
                            {session.topic && <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.topic}</div>}
                          </div>
                          {/* Events count */}
                          <div style={{ width: 80, textAlign: 'center', flexShrink: 0 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500 }}>{session.events_count}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 3 }}>évts</span>
                            {/* Event bar */}
                            {total > 0 && (
                              <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4, background: 'var(--surface-3)' }}>
                                <div style={{ width: `${(session.participations / total) * 100}%`, background: 'var(--pos)' }} />
                                <div style={{ width: `${(session.malus / total) * 100}%`, background: 'var(--neg)' }} />
                                <div style={{ width: `${(session.absences / total) * 100}%`, background: 'var(--text-dim)' }} />
                              </div>
                            )}
                          </div>
                          {/* Breakdown */}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <span className="break break--pos">+{session.participations}</span>
                            <span className="break break--neg">−{session.malus}</span>
                            <span className="break break--abs">{session.absences} abs</span>
                          </div>
                          {/* Chevron */}
                          <Icon name="chevron-right" size={14} stroke={1.5} />
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )
        )}

        {/* ====== WEEK VIEW ====== */}
        {viewMode === 'week' && (
          <div style={{ marginTop: 14 }}>
            {/* Week navigation */}
            <div className="ses-weekbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <button onClick={() => navigateWeek('prev')} className="iconbtn iconbtn--flip"><Icon name="chevron-right" size={16} stroke={2} /></button>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>{formatWeekLabel(weekDays)}</span>
              <button onClick={() => navigateWeek('next')} className="iconbtn"><Icon name="chevron-right" size={16} stroke={2} /></button>
              <button onClick={() => setCurrentWeek(new Date())} className="btn btn--ghost" style={{ fontSize: 12, marginLeft: 8 }}>Cette semaine</button>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-dim)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pos)', display: 'inline-block' }} /> Séance riche ({'>'} 10 évts)</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', display: 'inline-block' }} /> À compléter</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-2)', display: 'inline-block' }} /> Pas encore eue</span>
              </div>
            </div>

            <div className="gc-card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(5, 1fr)', minHeight: 560 }}>
                {/* Hour rail */}
                <div style={{ borderRight: '1px solid var(--border)' }}>
                  <div style={{ height: 48, borderBottom: '1px solid var(--border)' }} />
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} style={{ height: 56, padding: '4px 8px 0', fontSize: 10, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border)' }}>
                      {String(8 + i).padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, dayIdx) => {
                  const dateKey = day.toISOString().split('T')[0];
                  const isToday = dateKey === todayStr;
                  const daySessions = weekSessions[dateKey] || [];
                  const dayNames = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'];
                  return (
                    <div key={dayIdx} style={{ borderRight: dayIdx < 4 ? '1px solid var(--border)' : 'none', position: 'relative', background: isToday ? 'var(--accent-soft)' : undefined }}>
                      {/* Day header */}
                      <div style={{ height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border)', gap: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: isToday ? 'var(--accent)' : 'var(--text-dim)', letterSpacing: '0.04em' }}>{dayNames[dayIdx]}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>{day.getDate()}</span>
                        {isToday && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aujourd'hui</span>}
                      </div>
                      {/* Time grid background */}
                      <div style={{ position: 'relative', height: 560 }}>
                        {Array.from({ length: 10 }, (_, i) => (
                          <div key={i} style={{ height: 56, borderBottom: '1px solid var(--border)' }} />
                        ))}
                        {/* Session blocks */}
                        {daySessions.map((session) => {
                          const startD = new Date(session.started_at);
                          const endD = session.ended_at ? new Date(session.ended_at) : new Date(startD.getTime() + 3600000);
                          const startMin = (startD.getHours() - 8) * 60 + startD.getMinutes();
                          const durMin = Math.round((endD.getTime() - startD.getTime()) / 60000);
                          const top = (startMin / 60) * 56;
                          const height = Math.max(28, (durMin / 60) * 56);
                          const classIdx = classes.findIndex(c => c.id === session.class_id);
                          const color = COLOR_PALETTE[classIdx >= 0 ? classIdx % COLOR_PALETTE.length : 0];
                          const isUpcoming = !session.ended_at && new Date(session.started_at) > new Date();
                          return (
                            <div key={session.id} onClick={() => handleOpenSessionModal(session)} style={{
                              position: 'absolute', top, left: 3, right: 3, height, borderRadius: 6,
                              borderLeft: `3px solid ${color}`,
                              background: isUpcoming ? 'var(--surface-3)' : `${color}1A`,
                              padding: '4px 6px', overflow: 'hidden', color: 'inherit', cursor: 'pointer',
                              fontSize: 11, display: 'flex', flexDirection: 'column', gap: 1,
                              opacity: isUpcoming ? 0.72 : 1,
                              transition: 'opacity 0.12s',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <ClassChip label={getClassLabel(session.class_name)} color={color} size={18} />
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>{formatTime(session.started_at)}</span>
                              </div>
                              {session.topic && <div style={{ fontWeight: 500, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.topic}</div>}
                              {height > 45 && session.events_count > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 'auto', fontSize: 10 }}>
                                  <span style={{ color: 'var(--pos)', fontWeight: 600 }}>+{session.participations}</span>
                                  <span style={{ color: 'var(--neg)', fontWeight: 600 }}>−{session.malus}</span>
                                  {session.absences > 0 && <span style={{ color: 'var(--text-dim)' }}>{session.absences} abs</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====== MONTH VIEW ====== */}
        {viewMode === 'month' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => navigateMonth('prev')} className="iconbtn iconbtn--flip"><Icon name="chevron-right" size={16} stroke={2} /></button>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, textTransform: 'capitalize' }}>{getMonthName(currentMonth)}</h2>
                <button onClick={() => navigateMonth('next')} className="iconbtn"><Icon name="chevron-right" size={16} stroke={2} /></button>
                <button onClick={() => setCurrentMonth(new Date())} className="btn btn--ghost" style={{ fontSize: 12, marginLeft: 8 }}>Aujourd'hui</button>
              </div>
            </div>
            <div className="gc-card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                  <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-3)', borderBottom: '1px solid var(--border)' }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {(() => {
                  const { daysInMonth, startDayOfWeek, year, month } = getDaysInMonth(currentMonth);
                  const cells = [];
                  const today = new Date();
                  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
                  for (let i = 0; i < startDayOfWeek; i++) {
                    cells.push(<div key={`e-${i}`} style={{ minHeight: 90, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--surface-3)', opacity: 0.3 }} />);
                  }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const daySessions = sessionsByDate.get(dateKey) || [];
                    const isToday = isCurrentMonth && today.getDate() === day;
                    cells.push(
                      <div key={day} style={{ minHeight: 90, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: 4 }}>
                        <div style={{ textAlign: 'right', marginBottom: 4 }}>
                          <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: isToday ? 700 : 400, fontFamily: 'var(--font-display)', borderRadius: '50%', background: isToday ? 'var(--indigo)' : 'transparent', color: isToday ? '#fff' : 'var(--text-muted)' }}>{day}</span>
                        </div>
                        {daySessions.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {daySessions.map(s => {
                              const ci = classes.findIndex(c => c.id === s.class_id);
                              return <span key={s.id} style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR_PALETTE[ci >= 0 ? ci % COLOR_PALETTE.length : 0] }} />;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }
                  const rem = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
                  for (let i = 0; i < rem; i++) {
                    cells.push(<div key={`ee-${i}`} style={{ minHeight: 90, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--surface-3)', opacity: 0.3 }} />);
                  }
                  return cells;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] p-6 w-full max-w-md" style={{ borderRadius: 'var(--radius)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 flex items-center justify-center" style={{ background: 'var(--neg-soft)', borderRadius: 'var(--radius)' }}>
                <span className="text-2xl">🗑️</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)]">Supprimer la seance</h3>
            </div>
            <p className="text-[var(--text-muted)] mb-2">
              Voulez-vous vraiment supprimer cette seance du <strong>{formatDate(deleteTarget.started_at)}</strong> ?
            </p>
            <p className="text-sm text-[var(--text-dim)] mb-2 p-3 bg-[var(--surface-3)]" style={{ borderRadius: 'var(--radius)' }}>
              {deleteTarget.events_count} evenement{deleteTarget.events_count > 1 ? 's' : ''} seront supprimes.
            </p>
            {linkedGroupSession && (
              <p className="text-sm text-[var(--neg)] mb-4 p-3 bg-[var(--neg-soft)] font-medium" style={{ borderRadius: 'var(--radius)' }}>
                La seance de groupe &laquo;&nbsp;{linkedGroupSession.name}&nbsp;&raquo; liee a cette seance sera egalement supprimee (groupes, notes, criteres).
              </p>
            )}
            {!linkedGroupSession && <div className="mb-4" />}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors font-medium"
                style={{ borderRadius: 'var(--radius)' }}
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-50 transition-all font-medium"
                style={{ background: 'var(--gradient-error)', borderRadius: 'var(--radius)' }}
                disabled={isDeleting}
              >
                {isDeleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Sheet (slide-in panel) */}
      {showSessionModal && selectedSession && (
        <>
          <div className="sheet-backdrop" onClick={handleCloseSessionModal} />
          <div className="sheet">
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ClassChip label={getClassLabel(selectedSession.class_name)} color={COLOR_PALETTE[classes.findIndex(c => c.id === selectedSession.class_id) % COLOR_PALETTE.length]} size={36} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSession.class_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDate(selectedSession.started_at)} · {formatTime(selectedSession.started_at)}
                      {selectedSession.ended_at && ` (${getDuration(selectedSession.started_at, selectedSession.ended_at)})`}
                    </div>
                  </div>
                </div>
                <button onClick={handleCloseSessionModal} style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 6, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              {/* Topic */}
              {selectedSession.topic && (
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontStyle: 'italic', fontSize: 22, letterSpacing: '-0.01em', marginTop: 12 }}>
                  {selectedSession.topic}
                </h2>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: 'var(--surface-3)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>{selectedSession.events_count}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginTop: 2 }}>Événements</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: 'var(--pos-soft)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--pos)' }}>+{selectedSession.participations}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--pos)', marginTop: 2 }}>Positifs</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: 'var(--neg-soft)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, color: 'var(--neg)' }}>−{selectedSession.malus}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--neg)', marginTop: 2 }}>Malus</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 10, background: 'var(--surface-3)' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>{selectedSession.absences}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginTop: 2 }}>Absents</div>
              </div>
            </div>

            {/* Event timeline (DÉROULÉ) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 16 }}>Déroulé</div>
              {isLoadingClassroom ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid var(--indigo)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : classroomData && classroomData.events.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {classroomData.events.map((event, idx) => {
                    const student = studentsMap.get(event.student_id);
                    const config = EVENT_CONFIG[event.type] || { label: event.type, color: 'var(--text-dim)', softColor: 'var(--surface-3)', icon: '?' };
                    const dotColor = event.type === 'participation' ? 'var(--pos)' : event.type === 'bavardage' ? 'var(--neg)' : event.type === 'absence' ? 'var(--text-dim)' : 'var(--indigo)';
                    const label = event.subtype ? `${config.label} (${event.subtype})` : config.label;
                    const isLast = idx === classroomData.events.length - 1;
                    return (
                      <div key={event.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0' }}>
                        <div style={{ width: 44, flexShrink: 0, textAlign: 'right', fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', paddingTop: 2 }}>
                          {formatTime(event.timestamp)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 10 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                          {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 28, background: 'var(--border)' }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{student?.pseudo || '?'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                          {event.note && <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 2 }}>« {event.note} »</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)', fontSize: 13 }}>
                  Aucun événement enregistré
                </div>
              )}
            </div>

            {/* Add event form */}
            {showAddEvent && classroomData && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 10 }}>Nouvel événement</div>
                {/* Student select */}
                <select
                  value={addEventStudent}
                  onChange={(e) => setAddEventStudent(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 13, marginBottom: 8, fontFamily: 'var(--font-sans)', color: 'var(--text)' }}
                >
                  <option value="">Sélectionner un élève...</option>
                  {classroomData.students.map(s => (
                    <option key={s.id} value={s.id}>{s.pseudo}</option>
                  ))}
                </select>
                {/* Event type buttons */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  {Object.entries(EVENT_CONFIG).map(([type, cfg]) => (
                    <button
                      key={type}
                      onClick={() => { setAddEventType(type); setAddEventSubtype(''); }}
                      style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1.5px solid',
                        borderColor: addEventType === type ? cfg.color : 'var(--border)',
                        background: addEventType === type ? cfg.softColor : 'var(--surface)',
                        color: addEventType === type ? cfg.color : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
                {/* Sortie subtype */}
                {addEventType === 'sortie' && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {['toilettes', 'infirmerie', 'bureau', 'autre'].map(sub => (
                      <button
                        key={sub}
                        onClick={() => setAddEventSubtype(sub)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                          border: `1.5px solid ${addEventSubtype === sub ? 'var(--indigo)' : 'var(--border)'}`,
                          background: addEventSubtype === sub ? 'var(--indigo-soft)' : 'var(--surface)',
                          color: addEventSubtype === sub ? 'var(--indigo)' : 'var(--text-muted)',
                          cursor: 'pointer', textTransform: 'capitalize' as const,
                        }}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
                {/* Note for remarque */}
                {addEventType === 'remarque' && (
                  <textarea
                    value={addEventNote}
                    onChange={(e) => setAddEventNote(e.target.value)}
                    placeholder="Remarque..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontFamily: 'var(--font-sans)', resize: 'none', marginBottom: 8 }}
                    rows={2}
                  />
                )}
                {/* Submit */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowAddEvent(false)} className="btn btn--ghost" style={{ fontSize: 12, padding: '6px 14px' }}>Annuler</button>
                  <button
                    onClick={handleAddEvent}
                    disabled={isAddingEvent || !addEventStudent || !addEventType || (addEventType === 'sortie' && !addEventSubtype)}
                    className="btn btn--accent"
                    style={{ fontSize: 12, padding: '6px 14px', opacity: (isAddingEvent || !addEventStudent || !addEventType) ? 0.5 : 1 }}
                  >
                    {isAddingEvent ? '...' : 'Ajouter'}
                  </button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <Link to={`/sessions/${selectedSession.id}`} className="btn btn--ghost" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>
                Exporter
              </Link>
              <button onClick={() => setShowAddEvent(!showAddEvent)} className="btn btn--primary" style={{ flex: 1, justifyContent: 'center' }}>
                <Icon name="plus" size={14} /> Ajouter un événement
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
