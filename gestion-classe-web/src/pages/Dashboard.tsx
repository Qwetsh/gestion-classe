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
          supabase.from('classes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('students').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('events').select('type, session_id, sessions!inner(user_id)').eq('sessions.user_id', user.id),
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
          .eq('user_id', user.id)
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
      }

      setIsLoading(false);
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
          <div className="text-[var(--color-text-secondary)]">Chargement...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Tableau de bord</h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            Vue d'ensemble de vos donnees
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Classes" value={stats?.classesCount || 0} icon="📚" />
          <StatCard label="Eleves" value={stats?.studentsCount || 0} icon="👥" />
          <StatCard label="Seances" value={stats?.sessionsCount || 0} icon="📅" />
          <StatCard label="Evenements" value={stats?.eventsCount || 0} icon="📝" />
          <StatCard
            label="Participations"
            value={stats?.participations || 0}
            icon="+"
            color="var(--color-participation)"
          />
          <StatCard
            label="Bavardages"
            value={stats?.bavardages || 0}
            icon="-"
            color="var(--color-bavardage)"
          />
        </div>

        {/* Recent sessions */}
        <div className="bg-[var(--color-surface)] rounded-xl shadow-sm">
          <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Seances recentes
            </h2>
            <Link
              to="/sessions"
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              Voir tout
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-tertiary)]">
              Aucune seance synchronisee
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {recentSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/sessions/${session.id}`}
                  className="flex items-center justify-between p-4 hover:bg-[var(--color-background)] transition-colors"
                >
                  <div>
                    <div className="font-medium text-[var(--color-text)]">
                      {session.class_name}
                    </div>
                    <div className="text-sm text-[var(--color-text-tertiary)]">
                      {formatDate(session.started_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {session.events_count} evenement{session.events_count > 1 ? 's' : ''}
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">›</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
          style={{ backgroundColor: color || 'var(--color-primary)' }}
        >
          {icon}
        </span>
      </div>
      <div className="text-2xl font-bold text-[var(--color-text)]">{value}</div>
      <div className="text-sm text-[var(--color-text-tertiary)]">{label}</div>
    </div>
  );
}
