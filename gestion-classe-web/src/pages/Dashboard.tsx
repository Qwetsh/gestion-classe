import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

interface Stats {
  classesCount: number;
  studentsCount: number;
  sessionsCount: number;
  eventsCount: number;
  participations: number;
  bavardages: number;
}

interface RecentSession {
  id: string;
  class_name: string;
  started_at: string;
  ended_at: string | null;
  events_count: number;
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function loadData() {
      setIsLoading(true);

      try {
        // Load stats
        const [
          { count: classesCount },
          { count: studentsCount },
          { count: sessionsCount },
          { data: events },
        ] = await Promise.all([
          supabase.from('classes').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
          supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user!.id),
          supabase.from('events').select('type, session_id, sessions!inner(user_id)').eq('sessions.user_id', user!.id),
        ]);

        const eventsData = events || [];
        const participations = eventsData.filter(e => e.type === 'participation').length;
        const bavardages = eventsData.filter(e => e.type === 'bavardage').length;

        setStats({
          classesCount: classesCount || 0,
          studentsCount: studentsCount || 0,
          sessionsCount: sessionsCount || 0,
          eventsCount: eventsData.length,
          participations,
          bavardages,
        });

        // Load recent sessions
        const { data: sessions } = await supabase
          .from('sessions')
          .select(`
            id,
            started_at,
            ended_at,
            classes (name)
          `)
          .eq('user_id', user!.id)
          .order('started_at', { ascending: false })
          .limit(5);

        if (sessions) {
          const sessionsWithCounts = await Promise.all(
            sessions.map(async (session) => {
              const { count } = await supabase
                .from('events')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', session.id);

              return {
                id: session.id,
                class_name: (session.classes as any)?.name || 'Classe inconnue',
                started_at: session.started_at,
                ended_at: session.ended_at,
                events_count: count || 0,
              };
            })
          );
          setRecentSessions(sessionsWithCounts);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        setError('Erreur lors du chargement du tableau de bord.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      <div className="space-y-8">
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

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tableau de bord</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Vue d'ensemble de vos donnees
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Classes"
            value={stats?.classesCount || 0}
            icon="📚"
            bgColor="var(--color-primary-soft)"
            iconColor="var(--color-primary)"
          />
          <StatCard
            label="Eleves"
            value={stats?.studentsCount || 0}
            icon="👥"
            bgColor="var(--color-sortie-soft)"
            iconColor="var(--color-sortie)"
          />
          <StatCard
            label="Seances"
            value={stats?.sessionsCount || 0}
            icon="📅"
            bgColor="var(--color-remarque-soft)"
            iconColor="var(--color-remarque)"
          />
          <StatCard
            label="Evenements"
            value={stats?.eventsCount || 0}
            icon="📝"
            bgColor="var(--color-absence-soft)"
            iconColor="var(--color-absence)"
          />
          <StatCard
            label="Implications"
            value={stats?.participations || 0}
            icon="+"
            bgColor="var(--color-participation-soft)"
            iconColor="var(--color-participation)"
            isLarge
          />
          <StatCard
            label="Bavardages"
            value={stats?.bavardages || 0}
            icon="-"
            bgColor="var(--color-bavardage-soft)"
            iconColor="var(--color-bavardage)"
            isLarge
          />
        </div>

        {/* Recent sessions */}
        <div
          className="bg-[var(--color-surface)] overflow-hidden"
          style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="p-5 border-b border-[var(--color-border)] flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 flex items-center justify-center"
                style={{ background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-lg)' }}
              >
                <span className="text-xl">📅</span>
              </div>
              <h2 className="text-lg font-semibold text-[var(--color-text)]">
                Seances recentes
              </h2>
            </div>
            <Link
              to="/sessions"
              className="text-sm font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1"
            >
              Voir tout
              <span>→</span>
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
                <span className="text-3xl">📅</span>
              </div>
              <p className="text-[var(--color-text-tertiary)]">
                Aucune seance synchronisee
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {recentSessions.map((session, index) => (
                <Link
                  key={session.id}
                  to={`/sessions/${session.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[var(--color-surface-hover)] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 flex items-center justify-center text-white font-bold text-sm"
                      style={{
                        background: getClassGradient(index),
                        borderRadius: 'var(--radius-lg)'
                      }}
                    >
                      {session.class_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--color-text)] flex items-center gap-2">
                        {session.class_name}
                        {!session.ended_at && (
                          <span
                            className="text-xs px-2 py-0.5 bg-[var(--color-success-soft)] text-[var(--color-success)] font-medium"
                            style={{ borderRadius: 'var(--radius-full)' }}
                          >
                            En cours
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--color-text-tertiary)]">
                        {formatDate(session.started_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className="px-3 py-1 text-sm font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                      style={{ borderRadius: 'var(--radius-full)' }}
                    >
                      {session.events_count} evt{session.events_count > 1 ? 's' : ''}
                    </span>
                    <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] transition-colors text-xl">
                      ›
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Gerer les classes"
            description="Creer et organiser vos classes"
            icon="📚"
            link="/classes"
            color="var(--color-primary)"
          />
          <QuickActionCard
            title="Voir les eleves"
            description="Notes d'implication"
            icon="👥"
            link="/students"
            color="var(--color-sortie)"
          />
          <QuickActionCard
            title="Configurer les salles"
            description="Plans de classe"
            icon="🏫"
            link="/rooms"
            color="var(--color-remarque)"
          />
        </div>
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  icon,
  bgColor,
  iconColor,
  isLarge = false,
}: {
  label: string;
  value: number;
  icon: string;
  bgColor: string;
  iconColor: string;
  isLarge?: boolean;
}) {
  return (
    <div
      className="bg-[var(--color-surface)] p-4 transition-transform hover:scale-[1.02]"
      style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className={`${isLarge ? 'w-12 h-12 text-xl' : 'w-10 h-10 text-lg'} flex items-center justify-center font-bold mb-3`}
        style={{
          background: bgColor,
          color: iconColor,
          borderRadius: 'var(--radius-lg)'
        }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      <div className="text-sm text-[var(--color-text-tertiary)]">{label}</div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  link,
  color,
}: {
  title: string;
  description: string;
  icon: string;
  link: string;
  color: string;
}) {
  return (
    <Link
      to={link}
      className="bg-[var(--color-surface)] p-5 flex items-center gap-4 group transition-all hover:translate-y-[-2px]"
      style={{ borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div
        className="w-14 h-14 flex items-center justify-center text-2xl transition-transform group-hover:scale-110"
        style={{
          background: `${color}15`,
          borderRadius: 'var(--radius-xl)'
        }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
          {title}
        </h3>
        <p className="text-sm text-[var(--color-text-tertiary)]">{description}</p>
      </div>
      <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--color-primary)] transition-colors text-xl">
        →
      </span>
    </Link>
  );
}

function getClassGradient(index: number) {
  const gradients = [
    'linear-gradient(135deg, #4A90D9 0%, #357ABD 100%)',
    'linear-gradient(135deg, #81C784 0%, #66BB6A 100%)',
    'linear-gradient(135deg, #FFB74D 0%, #FFA726 100%)',
    'linear-gradient(135deg, #E57373 0%, #EF5350 100%)',
    'linear-gradient(135deg, #9575CD 0%, #7E57C2 100%)',
  ];
  return gradients[index % gradients.length];
}
