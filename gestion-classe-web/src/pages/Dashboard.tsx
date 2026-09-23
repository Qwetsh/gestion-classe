import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { LiveSessionLauncher } from '../components/live-session/LiveSessionLauncher';
import { GroupSessionLauncher } from '../components/live-session/GroupSessionLauncher';
import { BoardWorkspace } from '../components/classroom/BoardWorkspace';
import { draftTab } from '../lib/boardTabs';
import { HomeDataProvider, useHomeData } from '../components/home/HomeDataContext';
import { HomeGrid } from '../components/home/HomeGrid';
import { HomeEditBar } from '../components/home/HomeEditBar';
import { HOME_MODULE_IDS } from '../components/home/homeModules';
import { initHomeLayout, setEditing, useHomeLayoutStore } from '../components/home/homeLayoutStore';
import { formatDayFr, formatTime, getTimeOfDay, isSameDay } from '../components/home/homeHelpers';

/**
 * Page d'accueil : en-tête + grille de modules personnalisable.
 * Les données vivent dans HomeDataProvider, le contenu dans components/home/modules,
 * la disposition dans homeLayoutStore (cf. PLAN_accueil_modulaire.md).
 */
export function Dashboard() {
  const { user } = useAuth();
  const [boardOpen, setBoardOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Chargement de la disposition enregistrée
  useEffect(() => {
    if (user) void initHomeLayout(user.id, HOME_MODULE_IDS);
  }, [user]);

  // Les réglages ouvrent l'édition en renvoyant ici avec ?accueil=edition
  useEffect(() => {
    if (searchParams.get('accueil') === 'edition') {
      setEditing(true);
      const next = new URLSearchParams(searchParams);
      next.delete('accueil');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Quitter la page met fin à l'édition
  useEffect(() => () => setEditing(false), []);

  return (
    <Layout>
      <HomeDataProvider onOpenBoard={() => setBoardOpen(true)}>
        <HomeContent />
      </HomeDataProvider>
      {boardOpen && (
        <BoardWorkspace initial={draftTab()} userId={user?.id ?? ''} onClose={() => setBoardOpen(false)} />
      )}
    </Layout>
  );
}

function HomeContent() {
  const { isLoading, now, tomorrow, pronoteConnected, nextLesson, tomorrowLessons } = useHomeData();
  const { layout, editing } = useHomeLayoutStore();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--indigo)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`dash ${editing ? 'dash--editing' : ''}`}>
      <div className="dash__head">
        <div className="dash__date">{formatDayFr(now)} · {getTimeOfDay()}</div>
        <h1 className="dash__title">Accueil</h1>
        {pronoteConnected && nextLesson && !editing && (
          <p className="dash__subtitle">
            {isSameDay(nextLesson.startDate, tomorrow) ? 'Demain' : 'Prochaine séance'},{' '}
            {tomorrowLessons.length > 0 ? (
              <>{tomorrowLessons.length} séances. Commence par <strong>{nextLesson.groupNames[0] || nextLesson.subject || 'Cours'}</strong>, {formatTime(nextLesson.startDate)}.</>
            ) : (
              <>commence par <strong>{nextLesson.groupNames[0] || nextLesson.subject || 'Cours'}</strong>, {formatTime(nextLesson.startDate)}.</>
            )}
          </p>
        )}
      </div>

      {editing && <HomeEditBar layout={layout} />}

      {!editing && (
        <>
          <LiveSessionLauncher />
          <GroupSessionLauncher />
        </>
      )}

      <HomeGrid layout={layout} editing={editing} />
    </div>
  );
}
