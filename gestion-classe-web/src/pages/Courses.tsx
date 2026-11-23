/**
 * Mes cours : le foyer des cours préparés (PLAN_mes_cours.md, lot C1).
 *
 * La bibliothèque liste les originaux (table `boards`, hors copies placées sur un cours de
 * l'emploi du temps et hors modèles), rangés niveau › séquence › activité. Les fiches méthode
 * (boards.category = 'methode', migration 082) ont leur onglet, « Fiches méthode » (`?vue=methodes`).
 *
 * Un cours s'ouvre par son adresse, `/cours?ouvrir=<id>&mode=texte|tableau|classe` : l'accueil, le
 * calendrier et les comptes rendus peuvent tous y pointer, et le bouton Précédent du navigateur
 * referme l'éditeur. `ouvrir=brouillon` ouvre l'ardoise libre gardée sur l'appareil.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, FileText, Search } from 'lucide-react';
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
import { createCourse, duplicateCourse, emptyCourseDoc, saveCourseLinks } from '../lib/course/courseDoc';
import { queueCourseImport } from '../lib/course/courseImport';
import { DRAFT_ID, courseHref, groupLibrary, isMethodSheet, parseOpenTarget, splitShelves, type OpenMode } from '../lib/courseLibrary';
import { binderLevels } from '../lib/binder';
import { BinderGrid } from '../components/binder/BinderGrid';
import { fetchClassGroupsForUser } from '../lib/classGroupQueries';
import { openLocalFile, type OpenedFile } from '../lib/cloudFiles';
import { STORAGE_QUOTA_BYTES, formatBytes, refuseCourseFile, renamedFile, sequenceKey, usageLevel, type CourseFile } from '../lib/courseFiles';
import {
  courseFilesUnavailable,
  deleteCourseFile,
  downloadCourseFile,
  fetchStorageUsage,
  listCourseFiles,
  renameCourseFile,
  renameFilesChapter,
  uploadCourseFile,
  type StorageUsage,
} from '../lib/courseFilesQueries';
import { fetchClasses, fetchPlacedDocuments, placementChips, placementsOf, type ClassRef, type DocumentSession, type PlacedDocument } from '../lib/coursePlacements';
import { filterBoards, highlightParts, searchCourseText, searchWords, type CourseTextHit } from '../lib/courseSearch';
import { draftTab } from '../lib/boardTabs';
import { BoardWorkspace } from '../components/classroom/BoardWorkspace';
import { OpenPreparedBoard } from '../components/course/OpenPreparedBoard';
import { withDefaultTheme } from '../components/course/courseThemes';
import { BUILTIN_TEMPLATES } from '../components/course/courseTemplates';
import { BoardMetaForm, type TemplateChoice } from '../components/courses/BoardMetaForm';
import { ClassCourses } from '../components/courses/ClassCourses';
import { CloudFileViewer } from '../components/clouds/CloudFileViewer';
import { CourseLibrary, type SequenceFilesApi } from '../components/courses/CourseLibrary';
import { PlaceCourseDialog } from '../components/courses/PlaceCourseDialog';
import { CourseLinksDialog } from '../components/courses/CourseLinksDialog';
import { listTpRefs, type TpRef } from '../lib/tpQueries';
import { tpsByActivity } from '../lib/tpLibrary';
import { syncTpStudentBoards } from '../lib/tpStudentBoards';
import '../styles/mes-cours.css';

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Onglets de la page : bibliothèque des activités, fiches méthode, cours placés par classe. */
type View = 'library' | 'methods' | 'classes' | 'binder';

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
  /** Fichiers des séquences (lot F1), jauge du stockage, envoi en cours, fichier ouvert. */
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ opened: OpenedFile; title: string; subtitle: string } | null>(null);
  const [placing, setPlacing] = useState<Board | null>(null);
  /** Activité dont on règle les liens vers un site ou une app. */
  const [linking, setLinking] = useState<Board | null>(null);
  // TP de « Mes TP » reliés aux activités (migration 081) : un plus, chargé à part
  const [tpRefs, setTpRefs] = useState<TpRef[]>([]);

  const target = useMemo(() => parseOpenTarget(params), [params]);
  const targetId = target?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [list, used] = await Promise.all([listBoards(userId), fetchBoardUsages(userId)]);
      setBoards(list);
      setUsages(used);
      setError(null);
      // Onglet TP des élèves : fiche, protocole et documents de chaque TP, écrits d'ici (migration 088)
      void syncTpStudentBoards(userId, list.map(({ id, title, level, chapter }) => ({ id, title, level: level ?? null, chapter: chapter ?? null })))
        .catch((err: unknown) => console.warn('[Courses] cours des élèves :', err));
      // Les placements sont un plus : leur échec ne vide pas la bibliothèque
      void Promise.all([fetchPlacedDocuments(userId), fetchClasses(userId), fetchClassGroupsForUser(userId)])
        .then(([placed, cls, groups]) => {
          setDocuments(placed);
          setClasses(cls);
          setGroupNames(new Map(groups.map((g) => [g.id, g.name])));
        })
        .catch((err: unknown) => console.warn('[Courses] placements :', err));
      void listTpRefs(userId).then(setTpRefs).catch((err: unknown) => console.warn('[Courses] TP :', err));
      // Les fichiers aussi : sans la migration 078, la bibliothèque s'affiche sans eux
      void Promise.all([listCourseFiles(userId), fetchStorageUsage()])
        .then(([list, used]) => { setFiles(list); setUsage(used); })
        .catch((err: unknown) => console.warn('[Courses] fichiers :', err));
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

  // ---- Vue affichée sous l'éditeur : Bibliothèque, Fiches méthode (?vue=methodes) ou Par classe (?vue=classes&classe=…&activite=…) ----

  const vue = params.get('vue');
  const view: View = vue === 'classes' ? 'classes' : vue === 'methodes' ? 'methods' : vue === 'classeur' ? 'binder' : 'library';
  /** Les deux rayons de la bibliothèque (activités, fiches méthode), par opposition aux vues par classe. */
  const libraryView = view === 'library' || view === 'methods';
  const classKey = params.get('classe');
  const activity = params.get('activite');

  /** Adresse de la page avec ces réglages de vue (sans cours ouvert). */
  const viewHref = useCallback((next: { view: View; classKey?: string | null; activity?: string | null }) => {
    const q = new URLSearchParams();
    if (next.view === 'methods') q.set('vue', 'methodes');
    if (next.view === 'binder') q.set('vue', 'classeur');
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
  /** Bibliothèque des activités et fiches méthode : chaque onglet montre et cherche dans son rayon. */
  const shelves = useMemo(() => splitShelves(boards), [boards]);
  const methodsView = view === 'methods';
  const shelf = methodsView ? shelves.methods : shelves.activities;
  const textHits = useMemo(() => {
    if (!textSettled || !textResult) return [];
    const byId = new Map(shelf.map((b) => [b.id, b]));
    // Seuls les cours du rayon : les copies placées se retrouvent par le calendrier
    return textResult.hits.flatMap((hit) => { const b = byId.get(hit.boardId); return b ? [{ board: b, excerpt: hit.excerpt }] : []; });
  }, [textSettled, textResult, shelf]);

  const shown = useMemo(() => filterBoards(shelf, words), [shelf, words]);
  const chips = useMemo(() => placementChips(placementsOf(documents), classes, new Date()), [documents, classes]);
  /** Séances parties de chaque document (table session_boards, déjà lue pour la bibliothèque). */
  const sessions = useMemo(() => {
    const map = new Map<string, DocumentSession[]>();
    for (const [boardId, list] of usages) map.set(boardId, list.map((u) => ({ sessionId: u.session_id, startedAt: new Date(u.started_at) })));
    return map;
  }, [usages]);
  // Hors recherche, une séquence qui n'a plus que des fichiers reste affichée
  const tpsOfActivities = useMemo(() => tpsByActivity(tpRefs, boards), [tpRefs, boards]);
  const levels = useMemo(
    // Les fichiers sont rangés dans les séquences d'activités : pas dans l'onglet des fiches méthode
    () => groupLibrary(shown, searching || methodsView ? [] : files.map((f) => ({ level: f.level, chapter: f.chapter }))),
    [shown, searching, methodsView, files],
  );

  const save = async (typed: BoardMeta, kind: 'course' | 'board', template: TemplateChoice) => {
    // Créé depuis l'onglet « Fiches méthode » : une fiche méthode
    const meta: BoardMeta = editing === 'new' && methodsView ? { ...typed, category: 'methode' } : typed;
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
    const meta: BoardMeta = { title: asTemplate ? b.title : `${b.title} (copie)`, level: b.level, chapter: b.chapter, category: b.category ?? null };
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

  /** Bibliothèque des activités ↔ fiches méthode. */
  const moveShelf = async (b: Board) => {
    const category = isMethodSheet(b) ? null : 'methode';
    try {
      await updateBoard(b.id, { category });
      setBoards((prev) => prev.map((x) => (x.id === b.id ? { ...x, category } : x)));
      toast(category ? `« ${b.title} » est rangé dans les fiches méthode.` : `« ${b.title} » est revenu dans la bibliothèque.`, 'success');
    } catch (err) {
      toast(message(err, 'Le cours n’a pas pu changer d’onglet.'));
    }
  };

  const renameSequence = async (level: string | null, from: string, to: string) => {
    try {
      await renameChapter(userId, level, from, to);
      await renameFilesChapter(userId, level, from, to);
      await refresh();
    } catch (err) {
      toast(message(err, 'La séquence n’a pas pu être renommée.'));
    }
  };

  // ---- Fichiers d'une séquence ----

  const addFiles = async (level: string | null, chapter: string, picked: File[]) => {
    setUploadingKey(sequenceKey(level, chapter));
    let used = usage?.totalBytes ?? null;
    const added: CourseFile[] = [];
    for (const file of picked) {
      const reason = refuseCourseFile(file, used);
      if (reason) { toast(reason); continue; }
      try {
        added.push(await uploadCourseFile(userId, level, chapter, file));
        if (used !== null) used += file.size;
      } catch (err) {
        toast(message(err, `Envoi de « ${file.name} » impossible.`));
      }
    }
    if (added.length > 0) {
      setFiles((prev) => [...prev, ...added]);
      const bytes = added.reduce((n, f) => n + f.size, 0);
      setUsage((prev) => (prev ? { totalBytes: prev.totalBytes + bytes, courseFilesBytes: prev.courseFilesBytes + bytes } : prev));
    }
    setUploadingKey(null);
  };

  const openFile = async (file: CourseFile) => {
    try {
      const opened = await openLocalFile(await downloadCourseFile(file));
      setViewer({ opened, title: file.name, subtitle: [file.level, file.chapter].filter(Boolean).join(' · ') });
    } catch (err) {
      toast(message(err, `« ${file.name} » ne s’ouvre pas.`));
    }
  };

  const saveFile = async (file: CourseFile) => {
    try {
      const url = URL.createObjectURL(await downloadCourseFile(file));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast(message(err, `« ${file.name} » ne se télécharge pas.`));
    }
  };

  const renameFile = async (file: CourseFile, typed: string) => {
    const name = renamedFile(file.name, typed);
    if (name === file.name) return;
    try {
      await renameCourseFile(file.id, name);
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, name } : f)));
    } catch (err) {
      toast(message(err, 'Le fichier n’a pas pu être renommé.'));
    }
  };

  const removeFile = async (file: CourseFile) => {
    const ok = await confirm({
      title: 'Supprimer ce fichier ?',
      message: `« ${file.name} » sera retiré de la séquence et du stockage.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCourseFile(file);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      setUsage((prev) => (prev ? { totalBytes: Math.max(0, prev.totalBytes - file.size), courseFilesBytes: Math.max(0, prev.courseFilesBytes - file.size) } : prev));
    } catch (err) {
      toast(message(err, 'Suppression impossible.'));
    }
  };

  const filesApi: SequenceFilesApi | null = courseFilesUnavailable() ? null : {
    list: files,
    uploadingKey,
    onAdd: (level, chapter, picked) => void addFiles(level, chapter, picked),
    onOpen: (file) => void openFile(file),
    onDownload: (file) => void saveFile(file),
    onRename: renameFile,
    onDelete: (file) => void removeFile(file),
  };

  const unavailable = boardsUnavailable();
  /** Classeur virtuel : le premier niveau dont une séquence a sa page de garde. */
  const binderLevel = binderLevels(boards)[0] ?? null;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Mes cours</h1>
          <div className="flex gap-2">
            {binderLevel && (
              <button type="button" className="btn" onClick={() => void navigate(`/classeur?niveau=${encodeURIComponent(binderLevel)}`)} title="Le classeur d’un élève, assemblé à partir de la bibliothèque">
                <BookOpen size={16} aria-hidden /> Classeur
              </button>
            )}
            <button type="button" className="btn" onClick={() => open(DRAFT_ID)} title="Ardoise libre, gardée sur cet appareil">
              Brouillon
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setEditing('new')} disabled={unavailable} title={unavailable ? 'Migration add_boards.sql à appliquer' : methodsView ? 'Nouvelle fiche méthode' : undefined}>
              + Nouveau
            </button>
          </div>
        </div>

        <div className="mc-views" role="tablist" aria-label="Vue">
          <button type="button" role="tab" aria-selected={view === 'library'} className="mc-view" onClick={() => { if (view !== 'library') void navigate(viewHref({ view: 'library' })); }}>
            Bibliothèque
          </button>
          <button type="button" role="tab" aria-selected={methodsView} className="mc-view" onClick={() => { if (!methodsView) void navigate(viewHref({ view: 'methods' })); }}>
            Fiches méthode
          </button>
          <button type="button" role="tab" aria-selected={view === 'classes'} className="mc-view" onClick={() => { if (view !== 'classes') void navigate(viewHref({ view: 'classes' })); }}>
            Par classe
          </button>
          {binderLevel && (
            <button type="button" role="tab" aria-selected={view === 'binder'} className="mc-view" onClick={() => { if (view !== 'binder') void navigate(viewHref({ view: 'binder' })); }} title="Ce que chaque classe voit du classeur">
              Classeur des classes
            </button>
          )}
        </div>

        {error && <p className="mc-error" role="alert">{error}</p>}

        {view === 'binder' && ready && <BinderGrid userId={userId} />}

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

        {view === 'library' && ready && !error && shelf.length === 0 && (
          <div className="mc-empty">
            Aucun cours pour l’instant. « + Nouveau » crée un cours rédigé ou un tableau blanc ; ils se rangent ici par niveau et par séquence.
          </div>
        )}

        {methodsView && ready && !error && shelf.length === 0 && (
          <div className="mc-empty">
            Aucune fiche méthode pour l’instant. « + Nouveau » en crée une depuis cet onglet ; un cours de la bibliothèque s’y range par son menu ⋯.
          </div>
        )}

        {libraryView && shelf.length > 0 && (
          <label className="mc-search">
            <Search size={16} className="mc-search__icon" aria-hidden />
            <input
              type="search"
              className="mc-search__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              placeholder={methodsView ? 'Chercher une fiche méthode, un mot du texte' : 'Chercher un cours, une séquence, un mot du texte'}
              aria-label={methodsView ? 'Chercher dans les fiches méthode' : 'Chercher dans mes cours'}
            />
          </label>
        )}

        {libraryView && searching && textSettled && shown.length === 0 && textHits.length === 0 && (
          <div className="mc-empty">{methodsView ? 'Aucune fiche méthode' : 'Aucun cours'} ne correspond à « {query.trim()} ».</div>
        )}

        {libraryView && levels.length > 0 && (
          <CourseLibrary
            key={view}
            shelf={methodsView ? 'methodes' : 'activites'}
            onMoveShelf={(b) => void moveShelf(b)}
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
            onEditLinks={setLinking}
            onRenameSequence={renameSequence}
            files={methodsView ? null : filesApi}
            tps={methodsView ? undefined : tpsOfActivities}
          />
        )}

        {view === 'library' && filesApi && usage && (
          <div className={`mc-usage mc-usage--${usageLevel(usage.totalBytes)}`} title="Tout le stockage de l'application : copies d'évaluation, annales, images des cours, fichiers des séquences">
            <span>Stockage : {formatBytes(usage.totalBytes)} sur {formatBytes(STORAGE_QUOTA_BYTES)}</span>
            <span className="mc-usage__bar" aria-hidden><span style={{ width: `${Math.min(100, Math.round((usage.totalBytes / STORAGE_QUOTA_BYTES) * 100))}%` }} /></span>
          </div>
        )}

        {libraryView && textHits.length > 0 && (
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

      {linking && (
        <CourseLinksDialog
          board={linking}
          onClose={() => setLinking(null)}
          onSave={async (links) => {
            const saved = await saveCourseLinks(linking.id, links);
            if (!saved) throw new Error('Le cours vient d’être modifié ailleurs : fermez cette fenêtre et recommencez.');
            setBoards((prev) => prev.map((b) => (b.id === linking.id ? { ...b, links: links.length ? links : undefined } : b)));
            setLinking(null);
            toast(links.length ? 'Liens enregistrés.' : 'Liens retirés.', 'success');
          }}
        />
      )}

      {viewer && <CloudFileViewer opened={viewer.opened} title={viewer.title} subtitle={viewer.subtitle} onClose={() => setViewer(null)} />}

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
