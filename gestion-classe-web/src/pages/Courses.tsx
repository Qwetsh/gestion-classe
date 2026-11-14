/**
 * Mes cours : le foyer des cours préparés (PLAN_mes_cours.md, lot C1).
 *
 * La bibliothèque liste les originaux (table `boards`, hors copies placées sur un cours de
 * l'emploi du temps et hors modèles), rangés niveau › séquence › activité.
 *
 * Un cours s'ouvre par son adresse, `/cours?ouvrir=<id>&mode=texte|tableau|classe` : l'accueil, le
 * calendrier et les comptes rendus peuvent tous y pointer, et le bouton Précédent du navigateur
 * referme l'éditeur. `ouvrir=brouillon` ouvre l'ardoise libre gardée sur l'appareil.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import {
  boardsUnavailable,
  createBoard,
  deleteBoard,
  duplicateBoard,
  fetchBoard,
  fetchBoardUsages,
  listBoards,
  renameChapter,
  updateBoard,
  type Board,
  type BoardMeta,
  type BoardUsage,
} from '../lib/boardsQueries';
import { createCourse, duplicateCourse, emptyCourseDoc } from '../lib/course/courseDoc';
import { queueCourseImport } from '../lib/course/courseImport';
import { DRAFT_ID, courseHref, groupLibrary, parseOpenTarget, type OpenMode } from '../lib/courseLibrary';
import { draftTab } from '../lib/boardTabs';
import { BoardWorkspace } from '../components/classroom/BoardWorkspace';
import { OpenPreparedBoard } from '../components/course/OpenPreparedBoard';
import { withDefaultTheme } from '../components/course/courseThemes';
import { BUILTIN_TEMPLATES } from '../components/course/courseTemplates';
import { BoardMetaForm, type TemplateChoice } from '../components/courses/BoardMetaForm';
import { CourseLibrary } from '../components/courses/CourseLibrary';
import '../styles/mes-cours.css';

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function Courses() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { toast, confirm } = useUIFeedback();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [boards, setBoards] = useState<Board[]>([]);
  const [usages, setUsages] = useState<Map<string, BoardUsage[]>>(new Map());
  /** La liste a répondu au moins une fois (réussite ou erreur). */
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Board | 'new' | null>(null);

  const target = useMemo(() => parseOpenTarget(params), [params]);
  const targetId = target?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, used] = await Promise.all([listBoards(userId), fetchBoardUsages(userId)]);
      setBoards(list);
      setUsages(used);
      setError(null);
    } catch (err) {
      setError(message(err, 'La liste des cours ne répond pas.'));
    } finally {
      setReady(true);
    }
  }, [userId]);

  // À l'arrivée, puis à chaque ouverture ou fermeture d'un cours (titre et rangement ont pu changer)
  useEffect(() => { void refresh(); }, [refresh, targetId]);

  // ---- Ouverture par l'adresse ----

  const known = targetId ? boards.find((b) => b.id === targetId) ?? null : null;
  /** Cours absent de la bibliothèque (copie placée sur un créneau, modèle) : lu par son identifiant. */
  const [fetched, setFetched] = useState<{ id: string; board: Board | null } | null>(null);
  const mustFetch = !!targetId && targetId !== DRAFT_ID && ready && !known;

  useEffect(() => {
    if (!mustFetch || !targetId) return;
    let cancelled = false;
    void fetchBoard(targetId).then((board) => { if (!cancelled) setFetched({ id: targetId, board }); });
    return () => { cancelled = true; };
  }, [mustFetch, targetId]);

  const opened = known ?? (fetched && fetched.id === targetId ? fetched.board : null);
  const notFound = mustFetch && fetched?.id === targetId && fetched.board === null;

  const open = useCallback((id: string, mode: OpenMode = 'texte') => {
    // `retour` : l'éditeur a été ouvert depuis l'application, sa fermeture revient d'un pas en arrière
    void navigate(courseHref(id, mode), { state: { retour: true } });
  }, [navigate]);

  const close = useCallback(() => {
    const cameFromApp = (location.state as { retour?: boolean } | null)?.retour === true;
    if (cameFromApp) void navigate(-1);
    else void navigate('/cours', { replace: true });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!notFound) return;
    toast('Ce cours est introuvable : il a peut-être été supprimé.');
    close();
  }, [notFound, toast, close]);

  // ---- Actions de la bibliothèque ----

  const levels = useMemo(() => groupLibrary(boards), [boards]);

  const save = async (meta: BoardMeta, kind: 'course' | 'board', template: TemplateChoice) => {
    if (editing === 'new') {
      let created: Board;
      if (kind === 'board') created = await createBoard(userId, meta);
      else if (template.from === 'mine') created = await duplicateCourse(userId, template.id, meta);
      else if (template.from === 'word') {
        // Cours vide : l'éditeur importe le fichier Word à l'ouverture (avec le nettoyage du collage)
        created = await createCourse(userId, meta, null, withDefaultTheme(emptyCourseDoc()));
        queueCourseImport(created.id, template.file);
      } else {
        const builtin = BUILTIN_TEMPLATES.find((t) => t.id === template.id) ?? BUILTIN_TEMPLATES[0];
        created = await createCourse(userId, meta, null, withDefaultTheme(builtin.build()));
      }
      setEditing(null);
      open(created.id);
    } else if (editing) {
      await updateBoard(editing.id, meta);
      setEditing(null);
      await refresh();
    }
  };

  const duplicate = async (b: Board, asTemplate = false) => {
    const meta: BoardMeta = { title: asTemplate ? b.title : `${b.title} (copie)`, level: b.level, chapter: b.chapter };
    try {
      if (b.is_course) await duplicateCourse(userId, b.id, meta, asTemplate);
      else await duplicateBoard(userId, b.id, meta);
      toast(asTemplate ? 'Modèle enregistré : il est proposé à la création d’un cours.' : `Copie créée : « ${meta.title} ».`, 'success');
      await refresh();
    } catch (err) {
      toast(message(err, 'Copie impossible.'));
    }
  };

  const remove = async (b: Board) => {
    const used = usages.get(b.id)?.length ?? 0;
    const ok = await confirm({
      title: 'Supprimer ce cours ?',
      message: `« ${b.title} » et toutes ses pages seront supprimés.`,
      details: used > 0 ? `${used > 1 ? `Les ${used} séances` : 'La séance'} qui en ${used > 1 ? 'sont parties gardent' : 'est partie garde'} ${used > 1 ? 'leurs' : 'ses'} propres pages.` : undefined,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteBoard(b.id);
      setBoards((prev) => prev.filter((x) => x.id !== b.id));
    } catch (err) {
      toast(message(err, 'Suppression impossible.'));
    }
  };

  const renameSequence = async (level: string | null, from: string, to: string) => {
    try {
      await renameChapter(userId, level, from, to);
      await refresh();
    } catch (err) {
      toast(message(err, 'La séquence n’a pas pu être renommée.'));
    }
  };

  const unavailable = boardsUnavailable();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Mes cours</h1>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => open(DRAFT_ID)} title="Ardoise libre, gardée sur cet appareil">
              Brouillon
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setEditing('new')} disabled={unavailable} title={unavailable ? 'Migration add_boards.sql à appliquer' : undefined}>
              + Nouveau
            </button>
          </div>
        </div>

        {error && <p className="mc-error" role="alert">{error}</p>}

        {ready && !error && boards.length === 0 && (
          <div className="mc-empty">
            Aucun cours pour l’instant. « + Nouveau » crée un cours rédigé ou un tableau blanc ; ils se rangent ici par niveau et par séquence.
          </div>
        )}

        {boards.length > 0 && (
          <CourseLibrary
            levels={levels}
            onOpen={(b) => open(b.id)}
            onPresent={(b) => open(b.id, 'classe')}
            onEdit={setEditing}
            onDuplicate={(b) => void duplicate(b)}
            onSaveAsTemplate={(b) => void duplicate(b, true)}
            onDelete={(b) => void remove(b)}
            onRenameSequence={renameSequence}
          />
        )}
      </div>

      {editing && (
        <BoardMetaForm
          userId={userId}
          boards={boards}
          initial={editing === 'new' ? { title: '', level: null, chapter: null } : { title: editing.title, level: editing.level, chapter: editing.chapter }}
          isNew={editing === 'new'}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}

      {targetId === DRAFT_ID && userId && (
        <BoardWorkspace initial={draftTab()} userId={userId} chrome="ribbon" onClose={close} />
      )}
      {target && opened && userId && (
        <OpenPreparedBoard
          key={`${opened.id}:${target.mode}`}
          board={opened}
          kind={opened.is_course === undefined ? undefined : opened.is_course ? 'course' : 'board'}
          present={target.mode === 'classe'}
          screens={target.mode === 'tableau'}
          userId={userId}
          onClose={close}
        />
      )}
    </Layout>
  );
}
