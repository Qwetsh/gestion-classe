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
import { FileText, Search } from 'lucide-react';
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
import { fetchClassGroupsForUser } from '../lib/classGroupQueries';
import { fetchClasses, fetchPlacedDocuments, placementChips, placementsOf, type ClassRef, type DocumentSession, type PlacedDocument } from '../lib/coursePlacements';
import { filterBoards, highlightParts, searchCourseText, searchWords, type CourseTextHit } from '../lib/courseSearch';
import { draftTab } from '../lib/boardTabs';
import { BoardWorkspace } from '../components/classroom/BoardWorkspace';
import { OpenPreparedBoard } from '../components/course/OpenPreparedBoard';
import { withDefaultTheme } from '../components/course/courseThemes';
import { BUILTIN_TEMPLATES } from '../components/course/courseTemplates';
import { BoardMetaForm, type TemplateChoice } from '../components/courses/BoardMetaForm';
import { ClassCourses } from '../components/courses/ClassCourses';
import { CourseLibrary } from '../components/courses/CourseLibrary';
import { PlaceCourseDialog } from '../components/courses/PlaceCourseDialog';
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
  /** Documents placés sur des créneaux, classes et demi-groupes : pastilles (lot C3) et vue « Par classe » (lot C4). */
  const [documents, setDocuments] = useState<PlacedDocument[]>([]);
  const [classes, setClasses] = useState<ClassRef[]>([]);
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map());
  const [placing, setPlacing] = useState<Board | null>(null);

  const target = useMemo(() => parseOpenTarget(params), [params]);
  const targetId = target?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, used] = await Promise.all([listBoards(userId), fetchBoardUsages(userId)]);
      setBoards(list);
      setUsages(used);
      setError(null);
      // Les placements sont un plus : leur échec ne vide pas la bibliothèque
      void Promise.all([fetchPlacedDocuments(userId), fetchClasses(userId), fetchClassGroupsForUser(userId)])
        .then(([placed, cls, groups]) => {
          setDocuments(placed);
          setClasses(cls);
          setGroupNames(new Map(groups.map((g) => [g.id, g.name])));
        })
        .catch((err: unknown) => console.warn('[Courses] placements :', err));
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

  // ---- Vue affichée sous l'éditeur : Bibliothèque ou Par classe (?vue=classes&classe=…&activite=…) ----

  const view: 'library' | 'classes' = params.get('vue') === 'classes' ? 'classes' : 'library';
  const classKey = params.get('classe');
  const activity = params.get('activite');

  /** Adresse de la page avec ces réglages de vue (sans cours ouvert). */
  const viewHref = useCallback((next: { view: 'library' | 'classes'; classKey?: string | null; activity?: string | null }) => {
    const q = new URLSearchParams();
    if (next.view === 'classes') {
      q.set('vue', 'classes');
      if (next.classKey) q.set('classe', next.classKey);
      if (next.activity) q.set('activite', next.activity);
    }
    const text = q.toString();
    return text ? `/cours?${text}` : '/cours';
  }, []);

  const here = viewHref({ view, classKey, activity });

  const open = useCallback((id: string, mode: OpenMode = 'texte') => {
    // La vue reste la même sous l'éditeur. `retour` : ouvert depuis l'application, la fermeture
    // revient d'un pas en arrière
    const href = courseHref(id, mode);
    void navigate(here === '/cours' ? href : `${here}&${href.split('?')[1]}`, { state: { retour: true } });
  }, [navigate, here]);

  const close = useCallback(() => {
    const cameFromApp = (location.state as { retour?: boolean } | null)?.retour === true;
    if (cameFromApp) void navigate(-1);
    else void navigate(here, { replace: true });
  }, [location.state, navigate, here]);

  useEffect(() => {
    if (!notFound) return;
    toast('Ce cours est introuvable : il a peut-être été supprimé.');
    close();
  }, [notFound, toast, close]);

  // ---- Actions de la bibliothèque ----

  // ---- Recherche : titres, séquences et niveaux tout de suite ; texte des cours après une courte pause ----

  const [query, setQuery] = useState('');
  const words = useMemo(() => searchWords(query), [query]);
  const wordsKey = words.join(' ');
  const searching = words.length > 0;
  const [textResult, setTextResult] = useState<{ key: string; hits: CourseTextHit[] } | null>(null);

  useEffect(() => {
    if (!wordsKey) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchCourseText(wordsKey.split(' ')).then((hits) => { if (!cancelled) setTextResult({ key: wordsKey, hits }); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [wordsKey]);

  /** La réponse affichée est celle de la demande en cours (pas d'une frappe précédente). */
  const textSettled = searching && textResult?.key === wordsKey;
  const textHits = useMemo(() => {
    if (!textSettled || !textResult) return [];
    const byId = new Map(boards.map((b) => [b.id, b]));
    // Seuls les cours de la bibliothèque : les copies placées se retrouvent par le calendrier
    return textResult.hits.flatMap((hit) => { const b = byId.get(hit.boardId); return b ? [{ board: b, excerpt: hit.excerpt }] : []; });
  }, [textSettled, textResult, boards]);

  const shown = useMemo(() => filterBoards(boards, words), [boards, words]);
  const chips = useMemo(() => placementChips(placementsOf(documents), classes, new Date()), [documents, classes]);
  /** Séances parties de chaque document (table session_boards, déjà lue pour la bibliothèque). */
  const sessions = useMemo(() => {
    const map = new Map<string, DocumentSession[]>();
    for (const [boardId, list] of usages) map.set(boardId, list.map((u) => ({ sessionId: u.session_id, startedAt: new Date(u.started_at) })));
    return map;
  }, [usages]);
  const levels = useMemo(() => groupLibrary(shown), [shown]);

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

        <div className="mc-views" role="tablist" aria-label="Vue">
          <button type="button" role="tab" aria-selected={view === 'library'} className="mc-view" onClick={() => { if (view !== 'library') void navigate(viewHref({ view: 'library' })); }}>
            Bibliothèque
          </button>
          <button type="button" role="tab" aria-selected={view === 'classes'} className="mc-view" onClick={() => { if (view !== 'classes') void navigate(viewHref({ view: 'classes' })); }}>
            Par classe
          </button>
        </div>

        {error && <p className="mc-error" role="alert">{error}</p>}

        {view === 'classes' && ready && (
          <ClassCourses
            documents={documents}
            classes={classes}
            groupNames={groupNames}
            sessions={sessions}
            classKey={classKey}
            activity={activity}
            activityTitle={activity ? boards.find((b) => b.id === activity)?.title ?? null : null}
            onClass={(key) => void navigate(viewHref({ view: 'classes', classKey: key }), { replace: true })}
            onActivity={(source) => void navigate(viewHref({ view: 'classes', classKey, activity: source }))}
            onOpen={open}
          />
        )}

        {view === 'library' && ready && !error && boards.length === 0 && (
          <div className="mc-empty">
            Aucun cours pour l’instant. « + Nouveau » crée un cours rédigé ou un tableau blanc ; ils se rangent ici par niveau et par séquence.
          </div>
        )}

        {view === 'library' && boards.length > 0 && (
          <label className="mc-search">
            <Search size={16} className="mc-search__icon" aria-hidden />
            <input
              type="search"
              className="mc-search__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              placeholder="Chercher un cours, une séquence, un mot du texte"
              aria-label="Chercher dans mes cours"
            />
          </label>
        )}

        {view === 'library' && searching && textSettled && shown.length === 0 && textHits.length === 0 && (
          <div className="mc-empty">Aucun cours ne correspond à « {query.trim()} ».</div>
        )}

        {view === 'library' && shown.length > 0 && (
          <CourseLibrary
            levels={levels}
            expandAll={searching}
            chips={chips}
            onOpenCopy={(id) => open(id)}
            onPlace={setPlacing}
            onOpen={(b) => open(b.id)}
            onPresent={(b) => open(b.id, 'classe')}
            onEdit={setEditing}
            onDuplicate={(b) => void duplicate(b)}
            onSaveAsTemplate={(b) => void duplicate(b, true)}
            onDelete={(b) => void remove(b)}
            onRenameSequence={renameSequence}
          />
        )}

        {view === 'library' && textHits.length > 0 && (
          <section className="mc-level" aria-label="Cours dont le texte contient les mots cherchés">
            <div className="mc-seq__head"><span className="mc-seq__name">Dans le texte</span></div>
            <ul className="mc-rows">
              {textHits.map(({ board: b, excerpt }) => (
                <li key={b.id} className="mc-row">
                  <button type="button" className="mc-row__open mc-row__open--hit" onClick={() => open(b.id)} title="Ouvrir le cours">
                    <FileText size={17} className="mc-row__icon" aria-hidden />
                    <span className="mc-hit">
                      <span className="mc-row__title">{b.title}</span>
                      <span className="mc-hit__excerpt">
                        {highlightParts(excerpt, words).map((part, i) => (part.hit ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
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

      {placing && (
        <PlaceCourseDialog userId={userId} board={placing} onClose={() => setPlacing(null)} onPlaced={() => void refresh()} />
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
