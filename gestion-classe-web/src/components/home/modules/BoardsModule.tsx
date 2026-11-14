/**
 * « Repris récemment » : les trois cours retouchés en dernier, le brouillon, et l'accès à la page
 * « Mes cours » (qui porte la bibliothèque entière — lot C1 de PLAN_mes_cours.md).
 * L'identifiant du module reste `boards` : il est enregistré dans les dispositions de l'accueil.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, PenLine, Presentation } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { listBoards, type Board } from '../../../lib/boardsQueries';
import { DRAFT_ID, courseHref, recentBoards } from '../../../lib/courseLibrary';

/** L'éditeur ouvert depuis l'accueil y revient à la fermeture (voir `close` dans pages/Courses.tsx). */
const FROM_APP = { retour: true };

export function BoardsModule() {
  const { user } = useAuth();
  const userId = user?.id;
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listBoards(userId)
      .then((list) => { if (!cancelled) setBoards(list); })
      .catch((err: unknown) => console.warn('[BoardsModule] liste des cours :', err));
    return () => { cancelled = true; };
  }, [userId]);

  const recent = useMemo(() => recentBoards(boards), [boards]);

  if (!userId) return null;

  return (
    <div className="dash__card">
      <div className="dash__card-head">
        <h2 className="dash__card-title">Repris récemment</h2>
        <Link to="/cours" className="dash__card-link">Mes cours</Link>
      </div>
      <div className="dash__shortcuts" style={{ gridTemplateColumns: '1fr' }}>
        {recent.map((b) => (
          <Link key={b.id} to={courseHref(b.id)} state={FROM_APP} className="dash__shortcut" title={b.is_course ? 'Ouvrir le cours' : 'Ouvrir le tableau blanc'}>
            <span className="dash__shortcut-icon" style={{ display: 'grid', color: 'var(--text-muted)' }}>
              {b.is_course ? <FileText size={17} aria-label="Cours rédigé" /> : <Presentation size={17} aria-label="Tableau blanc" />}
            </span>
            <span className="dash__shortcut-title" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
          </Link>
        ))}
        <Link to={courseHref(DRAFT_ID)} state={FROM_APP} className="dash__shortcut" title="Ardoise libre, gardée sur cet appareil">
          <span className="dash__shortcut-icon" style={{ display: 'grid', color: 'var(--text-muted)' }}><PenLine size={17} aria-hidden /></span>
          <span className="dash__shortcut-title">Brouillon</span>
        </Link>
      </div>
    </div>
  );
}
