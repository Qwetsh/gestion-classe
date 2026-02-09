import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';

interface Session {
  id: string;
  class_name: string;
  room_name: string;
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

const EVENT_CONFIG: Record<string, { label: string; color: string; softColor: string; icon: string }> = {
  participation: { label: 'Implication', color: 'var(--color-participation)', softColor: 'var(--color-participation-soft)', icon: '+' },
  bavardage: { label: 'Bavardage', color: 'var(--color-bavardage)', softColor: 'var(--color-bavardage-soft)', icon: '-' },
  absence: { label: 'Absence', color: 'var(--color-absence)', softColor: 'var(--color-absence-soft)', icon: 'A' },
  remarque: { label: 'Remarque', color: 'var(--color-remarque)', softColor: 'var(--color-remarque-soft)', icon: '!' },
  sortie: { label: 'Sortie', color: 'var(--color-sortie)', softColor: 'var(--color-sortie-soft)', icon: 'S' },
};

export function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

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
    setPhotoUrl(null);
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
    </Layout>
  );
}
