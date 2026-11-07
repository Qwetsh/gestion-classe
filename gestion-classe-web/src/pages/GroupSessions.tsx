import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { getClassGradient, getClassInitials } from '../lib/constants';
import { GroupSessionDetail } from '../components/groups/GroupSessionDetail';

/**
 * Historique des séances de groupe (TP notés sur critères). Le détail d'une séance (critères,
 * groupes, notes, matériel, photos, fiches PDF, suppression) est le composant partagé
 * GroupSessionDetail, aussi affiché dans la fiche de l'éval « TP de groupe » du carnet
 * (hub Évaluations, phase 3).
 */

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
}

interface ClassFilter {
  id: string;
  name: string;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed': return { label: 'Terminée', bg: 'var(--pos-soft)', color: 'var(--pos)' };
    case 'active': return { label: 'En cours', bg: 'var(--warn-soft)', color: 'var(--warn)' };
    default: return { label: 'Brouillon', bg: 'var(--surface-3)', color: 'var(--text-dim)' };
  }
}

export function GroupSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [classes, setClasses] = useState<ClassFilter[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Séance ouverte dans la fenêtre de détail. */
  const [openSession, setOpenSession] = useState<GroupSession | null>(null);
  /** Éval du carnet de la séance ouverte (migration 063), pour y renvoyer. */
  const [openAssessmentId, setOpenAssessmentId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: classesData, error: classesError } = await supabase
        .from('classes').select('id, name').eq('user_id', user.id).order('name');
      if (classesError) throw classesError;
      setClasses(classesData || []);

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('group_sessions')
        .select('id, name, class_id, status, created_at, completed_at, classes (name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (sessionsError) throw sessionsError;

      if (sessionsData && sessionsData.length > 0) {
        const sessionIds = sessionsData.map((s) => s.id);
        const [{ data: groupsData }, { data: criteriaData }] = await Promise.all([
          supabase.from('session_groups').select('session_id').in('session_id', sessionIds),
          supabase.from('grading_criteria').select('session_id, max_points').in('session_id', sessionIds),
        ]);
        const groupsCount = new Map<string, number>();
        (groupsData || []).forEach((g) => groupsCount.set(g.session_id, (groupsCount.get(g.session_id) || 0) + 1));
        const points = new Map<string, number>();
        (criteriaData || []).forEach((c) => points.set(c.session_id, (points.get(c.session_id) || 0) + c.max_points));
        setSessions(sessionsData.map((s) => ({
          id: s.id,
          name: s.name,
          class_id: s.class_id,
          class_name: (s.classes as unknown as { name: string } | null)?.name || 'Classe inconnue',
          status: s.status as GroupSession['status'],
          created_at: s.created_at,
          completed_at: s.completed_at,
          groups_count: groupsCount.get(s.id) || 0,
          total_points: points.get(s.id) || 0,
        })));
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Error loading group sessions:', err);
      setError('Erreur lors du chargement des séances de groupe.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const open = async (session: GroupSession) => {
    setOpenSession(session);
    setOpenAssessmentId(null);
    const { data } = await supabase
      .from('written_assessments')
      .select('id')
      .eq('group_session_id', session.id)
      .eq('is_deleted', false)
      .maybeSingle();
    setOpenAssessmentId((data as { id: string } | null)?.id ?? null);
  };

  const filteredSessions = selectedClassId ? sessions.filter((s) => s.class_id === selectedClassId) : sessions;
  const sessionCountByClass = new Map<string, number>();
  sessions.forEach((s) => sessionCountByClass.set(s.class_id, (sessionCountByClass.get(s.class_id) || 0) + 1));

  if (isLoading) {
    return (
      <Layout fluid>
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
    <Layout fluid>
      {error && (
        <div className="bg-[var(--neg-soft)] text-[var(--neg)] p-4 mb-4 flex items-center justify-between" style={{ borderRadius: 'var(--radius)' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[var(--neg)] hover:opacity-70" aria-label="Fermer">x</button>
        </div>
      )}

      <div className="flex gap-6" style={{ minHeight: 'calc(100vh - 220px)' }}>
        <aside className="w-64 shrink-0 flex flex-col">
          <h1 className="page-title">Groupes</h1>
          <p className="text-[var(--text-muted)] mt-1 mb-4 text-sm">{sessions.length} séance{sessions.length > 1 ? 's' : ''}</p>
          <div className="flex-1 overflow-y-auto space-y-1">
            <button
              onClick={() => setSelectedClassId(null)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${selectedClassId === null ? 'bg-[var(--indigo)] text-white shadow-md' : 'hover:bg-[var(--surface)] text-[var(--text)]'}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Toutes les classes</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${selectedClassId === null ? 'bg-white/20 text-white' : 'bg-[var(--surface-3)] text-[var(--text-dim)]'}`}>{sessions.length}</span>
              </div>
            </button>
            {classes.map((cls) => {
              const isActive = selectedClassId === cls.id;
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'text-white shadow-md' : 'hover:bg-[var(--surface)] text-[var(--text)]'}`}
                  style={isActive ? { background: getClassGradient(cls.name) } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{cls.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[var(--surface-3)] text-[var(--text-dim)]'}`}>{sessionCountByClass.get(cls.id) || 0}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-muted)] mb-3">
            Une séance terminée devient une colonne « TP de groupe » du carnet (onglet Évaluations), avec la note du groupe pour chaque membre.
          </p>
          {filteredSessions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-lg font-medium text-[var(--text)]">Aucune séance de groupe</h2>
                <p className="text-[var(--text-dim)] mt-2">
                  {selectedClassId ? 'Aucune séance pour cette classe' : 'Lance une séance de groupe depuis l’accueil ou l’application mobile'}
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
                    onClick={() => { void open(session); }}
                    className="w-full text-left p-4 bg-[var(--surface)] hover:shadow-lg transition-all rounded-xl border border-[var(--border)] hover:border-[var(--indigo)]/30"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-sm shrink-0 rounded-xl" style={{ background: getClassGradient(session.class_name) }}>
                        {getClassInitials(session.class_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--text)] truncate">{session.name}</span>
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium shrink-0" style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 'var(--radius-full)' }}>{statusBadge.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--text-dim)]">
                          <span>{session.class_name}</span>
                          <span>{formatDate(session.created_at)}</span>
                          <span>{session.groups_count} groupe{session.groups_count > 1 ? 's' : ''}</span>
                          <span>{session.total_points} pts</span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-[var(--text-dim)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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

      {openSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setOpenSession(null)}>
          <div
            className="bg-[var(--surface)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-2)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={openSession.name}
          >
            <div className="p-5 text-white shrink-0" style={{ background: getClassGradient(openSession.class_name) }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 bg-white/20 flex items-center justify-center font-bold text-lg shrink-0" style={{ borderRadius: 'var(--radius)' }}>
                    {getClassInitials(openSession.class_name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold truncate">{openSession.name}</h3>
                    <p className="text-white/80 text-sm mt-0.5">{openSession.class_name} - {formatDate(openSession.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {openAssessmentId && (
                    <Link to={`/evaluations/${openAssessmentId}`} className="px-3 py-1.5 text-sm font-medium bg-white/20 hover:bg-white/30 transition-colors" style={{ borderRadius: 'var(--radius)' }}>
                      Voir dans le carnet ↗
                    </Link>
                  )}
                  <button onClick={() => setOpenSession(null)} className="w-10 h-10 flex items-center justify-center hover:bg-white/20 transition-colors" style={{ borderRadius: 'var(--radius)' }} aria-label="Fermer">x</button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <GroupSessionDetail
                sessionId={openSession.id}
                onChanged={() => { void loadSessions(); }}
                onDeleted={() => {
                  setSessions((prev) => prev.filter((s) => s.id !== openSession.id));
                  setOpenSession(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
