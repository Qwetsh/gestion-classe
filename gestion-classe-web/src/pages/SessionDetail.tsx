import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { EVENT_CONFIG, getGroupColor } from '../lib/constants';

interface Session {
  id: string;
  class_name: string;
  room_name: string;
  topic: string | null;
  started_at: string;
  ended_at: string | null;
}

interface Event {
  id: string;
  student_pseudo: string;
  type: string;
  subtype: string | null;
  note: string | null;
  photo_path: string | null;
  timestamp: string;
}

interface SessionGroup {
  id: string;
  group_number: number;
  created_at: string;
  members: GroupMember[];
  events: GroupEvent[];
}

interface GroupMember {
  id: string;
  student_id: string;
  student_pseudo: string;
  joined_at: string;
}

interface GroupEvent {
  id: string;
  type: 'remarque' | 'note';
  note: string | null;
  photo_path: string | null;
  grade_value: number | null;
  grade_max: number | null;
  timestamp: string;
}

// EVENT_CONFIG imported from lib/constants

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedGroupEvent, setSelectedGroupEvent] = useState<{ event: GroupEvent; groupNumber: number } | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Topic editing states
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [editedTopic, setEditedTopic] = useState('');
  const [isSavingTopic, setIsSavingTopic] = useState(false);

  // Load photo URL when an event with photo is selected
  const handleEventClick = async (event: Event) => {
    if (event.type !== 'remarque' || (!event.note && !event.photo_path)) return;

    setSelectedEvent(event);

    if (event.photo_path) {
      setIsLoadingPhoto(true);
      const { data } = await supabase.storage
        .from('student-photos')
        .createSignedUrl(event.photo_path, 3600);
      setPhotoUrl(data?.signedUrl || null);
      setIsLoadingPhoto(false);
    } else {
      setPhotoUrl(null);
    }
  };

  const closeModal = () => {
    setSelectedEvent(null);
    setSelectedGroupEvent(null);
    setPhotoUrl(null);
  };

  const handleGroupEventClick = async (event: GroupEvent, groupNumber: number) => {
    if (event.type !== 'remarque' || (!event.note && !event.photo_path)) return;

    setSelectedGroupEvent({ event, groupNumber });

    if (event.photo_path) {
      setIsLoadingPhoto(true);
      const { data } = await supabase.storage
        .from('student-photos')
        .createSignedUrl(event.photo_path, 3600);
      setPhotoUrl(data?.signedUrl || null);
      setIsLoadingPhoto(false);
    } else {
      setPhotoUrl(null);
    }
  };

  const handleStartEditTopic = () => {
    setEditedTopic(session?.topic || '');
    setIsEditingTopic(true);
  };

  const handleCancelEditTopic = () => {
    setIsEditingTopic(false);
    setEditedTopic('');
  };

  const handleSaveTopic = async () => {
    if (!session) return;

    setIsSavingTopic(true);
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ topic: editedTopic.trim() || null })
        .eq('id', session.id);

      if (error) {
        console.error('Error saving topic:', error);
        alert('Erreur lors de la sauvegarde du theme');
        return;
      }

      // Update local state
      setSession({ ...session, topic: editedTopic.trim() || null });
      setIsEditingTopic(false);
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cet evenement ?')) {
      return;
    }

    setDeletingEventId(eventId);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('Error deleting event:', error);
        alert('Erreur lors de la suppression');
        return;
      }

      // Remove from local state
      setEvents(events.filter(e => e.id !== eventId));
    } finally {
      setDeletingEventId(null);
    }
  };

  useEffect(() => {
    if (!id) return;

    async function loadData() {
      setIsLoading(true);

      // Load session
      const { data: sessionData } = await supabase
        .from('sessions')
        .select(`
          id,
          topic,
          started_at,
          ended_at,
          classes (name),
          rooms (name)
        `)
        .eq('id', id)
        .single();

      if (sessionData) {
        setSession({
          id: sessionData.id,
          class_name: (sessionData.classes as any)?.name || 'Classe inconnue',
          room_name: (sessionData.rooms as any)?.name || 'Salle inconnue',
          topic: sessionData.topic,
          started_at: sessionData.started_at,
          ended_at: sessionData.ended_at,
        });
      }

      // Load events
      const { data: eventsData } = await supabase
        .from('events')
        .select(`
          id,
          type,
          subtype,
          note,
          photo_path,
          timestamp,
          students (pseudo)
        `)
        .eq('session_id', id)
        .order('timestamp', { ascending: true });

      if (eventsData) {
        setEvents(
          eventsData.map((e) => ({
            id: e.id,
            student_pseudo: (e.students as any)?.pseudo || 'Eleve inconnu',
            type: e.type,
            subtype: e.subtype,
            note: e.note,
            photo_path: e.photo_path,
            timestamp: e.timestamp,
          }))
        );
      }

      // Load session groups
      const { data: groupsData } = await supabase
        .from('session_groups')
        .select('id, group_number, created_at')
        .eq('session_id', id)
        .order('group_number', { ascending: true });

      if (groupsData && groupsData.length > 0) {
        const groupsWithDetails: SessionGroup[] = [];

        for (const group of groupsData) {
          // Load members for this group
          const { data: membersData } = await supabase
            .from('group_members')
            .select(`
              id,
              student_id,
              joined_at,
              students (pseudo)
            `)
            .eq('session_group_id', group.id)
            .is('left_at', null);

          // Load events for this group
          const { data: groupEventsData } = await supabase
            .from('group_events')
            .select('id, type, note, photo_path, grade_value, grade_max, timestamp')
            .eq('session_group_id', group.id)
            .order('timestamp', { ascending: true });

          groupsWithDetails.push({
            id: group.id,
            group_number: group.group_number,
            created_at: group.created_at,
            members: (membersData || []).map((m) => ({
              id: m.id,
              student_id: m.student_id,
              student_pseudo: (m.students as any)?.pseudo || 'Eleve inconnu',
              joined_at: m.joined_at,
            })),
            events: (groupEventsData || []).map((e) => ({
              id: e.id,
              type: e.type as 'remarque' | 'note',
              note: e.note,
              photo_path: e.photo_path,
              grade_value: e.grade_value,
              grade_max: e.grade_max,
              timestamp: e.timestamp,
            })),
          });
        }

        setGroups(groupsWithDetails);
      }

      setIsLoading(false);
    }

    loadData();
  }, [id]);

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

  // Calculate totals
  const totals = events.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

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

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div
            className="w-20 h-20 mx-auto mb-4 bg-[var(--color-surface-secondary)] flex items-center justify-center"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            <span className="text-4xl">🔍</span>
          </div>
          <h2 className="text-lg font-medium text-[var(--color-text)]">
            Seance non trouvee
          </h2>
          <Link
            to="/sessions"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            ← Retour aux seances
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <Link to="/sessions" className="text-[var(--color-primary)] hover:underline">
            Seances
          </Link>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <span className="text-[var(--color-text-secondary)]">{session.class_name}</span>
        </div>

        {/* Session info */}
        <div
          className="bg-[var(--color-surface)] p-6"
          style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 flex items-center justify-center text-white font-bold text-xl"
                style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-xl)' }}
              >
                {session.class_name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--color-text)]">
                  {session.class_name}
                </h1>
                <p className="text-[var(--color-text-secondary)] mt-1 flex items-center gap-2">
                  <span>🏫</span>
                  {session.room_name}
                </p>
                <p className="text-[var(--color-text-tertiary)] mt-2 text-sm">
                  {formatDate(session.started_at)} de {formatTime(session.started_at)}
                  {session.ended_at && ` a ${formatTime(session.ended_at)}`}
                  {' · '}
                  {getDuration(session.started_at, session.ended_at)}
                </p>
              </div>
            </div>

            {/* Topic section */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">📝 Theme de la seance</span>
                {!isEditingTopic && (
                  <button
                    onClick={handleStartEditTopic}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    {session.topic ? 'Modifier' : 'Ajouter'}
                  </button>
                )}
              </div>
              {isEditingTopic ? (
                <div className="space-y-3">
                  <textarea
                    value={editedTopic}
                    onChange={(e) => setEditedTopic(e.target.value)}
                    placeholder="Ex: Chapitre 3 - Les fonctions lineaires..."
                    className="w-full px-4 py-3 bg-[var(--color-surface-secondary)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] resize-none focus:outline-none focus:border-[var(--color-primary)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                    rows={2}
                    maxLength={200}
                    autoFocus
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {editedTopic.length}/200
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEditTopic}
                        className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                        style={{ borderRadius: 'var(--radius-lg)' }}
                        disabled={isSavingTopic}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSaveTopic}
                        className="px-3 py-1.5 text-sm text-white hover:opacity-90 transition-colors disabled:opacity-50"
                        style={{ background: 'var(--gradient-primary)', borderRadius: 'var(--radius-lg)' }}
                        disabled={isSavingTopic}
                      >
                        {isSavingTopic ? 'Sauvegarde...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : session.topic ? (
                <p
                  className="text-[var(--color-text)] p-3 bg-[var(--color-surface-secondary)] italic"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  {session.topic}
                </p>
              ) : (
                <p className="text-[var(--color-text-tertiary)] text-sm italic">
                  Aucun theme defini
                </p>
              )}
            </div>

            {!session.ended_at && (
              <span
                className="px-4 py-2 bg-[var(--color-success-soft)] text-[var(--color-success)] text-sm font-semibold self-start flex items-center gap-2"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
                En cours
              </span>
            )}
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(EVENT_CONFIG).map(([type, config]) => (
            <div
              key={type}
              className="bg-[var(--color-surface)] p-4 flex items-center gap-4 transition-transform hover:scale-[1.02]"
              style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center text-lg font-bold"
                style={{
                  background: config.softColor,
                  color: config.color,
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                {config.icon}
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text)]">
                  {totals[type] || 0}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {config.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Groups section */}
        {groups.length > 0 && (
          <div
            className="bg-[var(--color-surface)] overflow-hidden"
            style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="p-5 border-b border-[var(--color-border)] flex items-center gap-3">
              <div
                className="w-10 h-10 flex items-center justify-center text-xl"
                style={{ background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-lg)' }}
              >
                👥
              </div>
              <h2 className="font-semibold text-[var(--color-text)]">
                Groupes ({groups.length})
              </h2>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const groupColor = getGroupColor(group.group_number);
                const gradeEvents = group.events.filter((e) => e.type === 'note');
                const remarkEvents = group.events.filter((e) => e.type === 'remarque');

                return (
                  <div
                    key={group.id}
                    className="border border-[var(--color-border)] overflow-hidden"
                    style={{ borderRadius: 'var(--radius-xl)' }}
                  >
                    {/* Group header */}
                    <div
                      className="px-4 py-3 flex items-center gap-3"
                      style={{ backgroundColor: groupColor + '15' }}
                    >
                      <div
                        className="w-8 h-8 flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: groupColor, borderRadius: 'var(--radius-lg)' }}
                      >
                        {group.group_number}
                      </div>
                      <span className="font-medium text-[var(--color-text)]">
                        Groupe {group.group_number}
                      </span>
                      <span className="text-sm text-[var(--color-text-tertiary)] ml-auto">
                        {group.members.length} eleve{group.members.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Members */}
                    <div className="px-4 py-3 border-b border-[var(--color-border)]">
                      <div className="flex flex-wrap gap-2">
                        {group.members.map((member) => (
                          <span
                            key={member.id}
                            className="px-2 py-1 text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text)]"
                            style={{ borderRadius: 'var(--radius-md)' }}
                          >
                            {member.student_pseudo}
                          </span>
                        ))}
                        {group.members.length === 0 && (
                          <span className="text-sm text-[var(--color-text-tertiary)] italic">
                            Aucun membre
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Group events */}
                    <div className="px-4 py-3 space-y-2">
                      {/* Grades */}
                      {gradeEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span
                            className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: 'var(--color-participation-soft)',
                              color: 'var(--color-participation)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            N
                          </span>
                          <span className="font-medium text-[var(--color-text)]">
                            {event.grade_value}/{event.grade_max}
                          </span>
                          {event.note && (
                            <span className="text-[var(--color-text-tertiary)] truncate">
                              - {event.note}
                            </span>
                          )}
                          <span className="text-[var(--color-text-tertiary)] ml-auto text-xs">
                            {formatTime(event.timestamp)}
                          </span>
                        </div>
                      ))}

                      {/* Remarks */}
                      {remarkEvents.map((event) => {
                        const isClickable = event.note || event.photo_path;
                        return (
                          <div
                            key={event.id}
                            className={`flex items-center gap-2 text-sm ${isClickable ? 'cursor-pointer hover:bg-[var(--color-surface-hover)] -mx-2 px-2 py-1 transition-colors' : ''}`}
                            style={isClickable ? { borderRadius: 'var(--radius-md)' } : undefined}
                            onClick={() => isClickable && handleGroupEventClick(event, group.group_number)}
                          >
                            <span
                              className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                              style={{
                                backgroundColor: 'var(--color-remarque-soft)',
                                color: 'var(--color-remarque)',
                                borderRadius: 'var(--radius-md)'
                              }}
                            >
                              !
                            </span>
                            <span className="text-[var(--color-text)] truncate flex-1">
                              {event.note || 'Remarque'}
                            </span>
                            {event.photo_path && (
                              <span className="text-[var(--color-remarque)]" title="Photo attachee">
                                📷
                              </span>
                            )}
                            <span className="text-[var(--color-text-tertiary)] text-xs">
                              {formatTime(event.timestamp)}
                            </span>
                          </div>
                        );
                      })}

                      {/* No events */}
                      {group.events.length === 0 && (
                        <p className="text-sm text-[var(--color-text-tertiary)] italic">
                          Aucun evenement
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Events list */}
        <div
          className="bg-[var(--color-surface)] overflow-hidden"
          style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="p-5 border-b border-[var(--color-border)] flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--color-remarque-soft)', borderRadius: 'var(--radius-lg)' }}
            >
              <span className="text-xl">📋</span>
            </div>
            <h2 className="font-semibold text-[var(--color-text)]">
              Evenements ({events.length})
            </h2>
          </div>

          {events.length === 0 ? (
            <div className="p-8 text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <span className="text-3xl">📝</span>
              </div>
              <p className="text-[var(--color-text-tertiary)]">
                Aucun evenement enregistre
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {events.map((event) => {
                const config = EVENT_CONFIG[event.type] || {
                  label: event.type,
                  color: 'var(--color-text-tertiary)',
                  softColor: 'var(--color-surface-secondary)',
                  icon: '?',
                };

                const isClickable = event.type === 'remarque' && (event.note || event.photo_path);

                return (
                  <div
                    key={event.id}
                    className={`p-4 flex items-center gap-4 ${isClickable ? 'cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors' : ''}`}
                    onClick={() => isClickable && handleEventClick(event)}
                  >
                    <div
                      className="w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: config.softColor,
                        color: config.color,
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--color-text)]">
                          {event.student_pseudo}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 font-medium"
                          style={{
                            background: config.softColor,
                            color: config.color,
                            borderRadius: 'var(--radius-full)'
                          }}
                        >
                          {config.label}
                          {event.subtype && ` - ${event.subtype}`}
                        </span>
                        {event.photo_path && (
                          <span className="text-[var(--color-remarque)]" title="Photo attachee">
                            📷
                          </span>
                        )}
                      </div>
                      {event.note && (
                        <p className="text-sm text-[var(--color-text-tertiary)] italic mt-1 truncate">
                          "{event.note}"
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-[var(--color-text-tertiary)] shrink-0">
                      {formatTime(event.timestamp)}
                    </span>
                    {isClickable && (
                      <span className="text-[var(--color-text-tertiary)]">›</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      disabled={deletingEventId === event.id}
                      className="ml-2 p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-soft)] transition-colors shrink-0 disabled:opacity-50"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                      title="Supprimer"
                    >
                      {deletingEventId === event.id ? '...' : '🗑️'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Photo/Note Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[var(--color-surface)] max-w-lg w-full max-h-[90vh] overflow-hidden"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center"
                  style={{ background: 'var(--color-remarque-soft)', borderRadius: 'var(--radius-lg)' }}
                >
                  <span className="text-xl" style={{ color: 'var(--color-remarque)' }}>!</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text)]">
                    {selectedEvent.student_pseudo}
                  </h3>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Remarque · {formatTime(selectedEvent.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Note */}
              {selectedEvent.note && (
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Note
                  </p>
                  <p
                    className="text-[var(--color-text)] whitespace-pre-wrap p-4 bg-[var(--color-surface-secondary)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    {selectedEvent.note}
                  </p>
                </div>
              )}

              {/* Photo */}
              {selectedEvent.photo_path && (
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Photo
                  </p>
                  {isLoadingPhoto ? (
                    <div
                      className="flex items-center justify-center h-48 bg-[var(--color-surface-secondary)]"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <span className="text-[var(--color-text-tertiary)]">Chargement...</span>
                    </div>
                  ) : photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Photo de la remarque"
                      className="w-full object-contain max-h-96"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center h-48 bg-[var(--color-surface-secondary)]"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <span className="text-[var(--color-text-tertiary)]">Photo non disponible</span>
                    </div>
                  )}
                </div>
              )}

              {/* No content fallback */}
              {!selectedEvent.note && !selectedEvent.photo_path && (
                <p className="text-[var(--color-text-tertiary)] text-center py-4">
                  Aucun contenu
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Event Modal */}
      {selectedGroupEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[var(--color-surface)] max-w-lg w-full max-h-[90vh] overflow-hidden"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 flex items-center justify-center text-white font-bold"
                  style={{
                    backgroundColor: getGroupColor(selectedGroupEvent.groupNumber),
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  {selectedGroupEvent.groupNumber}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text)]">
                    Groupe {selectedGroupEvent.groupNumber}
                  </h3>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Remarque · {formatTime(selectedGroupEvent.event.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 flex items-center justify-center hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Note */}
              {selectedGroupEvent.event.note && (
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Note
                  </p>
                  <p
                    className="text-[var(--color-text)] whitespace-pre-wrap p-4 bg-[var(--color-surface-secondary)]"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    {selectedGroupEvent.event.note}
                  </p>
                </div>
              )}

              {/* Photo */}
              {selectedGroupEvent.event.photo_path && (
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Photo
                  </p>
                  {isLoadingPhoto ? (
                    <div
                      className="flex items-center justify-center h-48 bg-[var(--color-surface-secondary)]"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <span className="text-[var(--color-text-tertiary)]">Chargement...</span>
                    </div>
                  ) : photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="Photo de la remarque"
                      className="w-full object-contain max-h-96"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center h-48 bg-[var(--color-surface-secondary)]"
                      style={{ borderRadius: 'var(--radius-lg)' }}
                    >
                      <span className="text-[var(--color-text-tertiary)]">Photo non disponible</span>
                    </div>
                  )}
                </div>
              )}

              {/* No content fallback */}
              {!selectedGroupEvent.event.note && !selectedGroupEvent.event.photo_path && (
                <p className="text-[var(--color-text-tertiary)] text-center py-4">
                  Aucun contenu
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
