/**
 * Éditeur de cours — mode Texte (PLAN_cours_editeur.md, étape 1).
 *
 * Un traitement de texte « comme Word » : ruban, règle, feuilles A4 paginées, barre d'état.
 * Le document est enregistré tout seul dans `boards.doc` (migration 071) une seconde après la
 * dernière frappe, avec une copie locale de secours (reprise à la prochaine ouverture si le
 * serveur n'a pas pu la recevoir). Impression : les feuilles s'impriment telles qu'affichées.
 *
 * Plein écran au-dessus de l'application (portail sur <body>), comme le tableau blanc.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { courseExtensions } from './courseExtensions';
import { relayoutNow } from './coursePagination';
import { CourseRibbon } from './CourseRibbon';
import { Icon } from './courseIcons';
import {
  COURSE_DOC_VERSION, duplicateCourse, emptyCourseDoc, fetchCourse, loadLocalCourse, saveCourseDocGuarded, saveLocalCourse,
  templatesUnavailable, type CourseDoc, type CourseSettings,
} from '../../lib/course/courseDoc';
import { countWords, createVersion, fetchVersionDoc, lastVersionAt, versionsUnavailable, type CourseVersion } from '../../lib/course/courseVersions';
import { PDF_PAGES_MAX, PDF_PAGES_WARN, docxToCourseHtml, isDocxFile, isOldDocFile, isPdfFile, pdfPageCount, pdfToImages, takeCourseImport } from '../../lib/course/courseImport';
import { supabase } from '../../lib/supabase';
import { CourseVersionsPanel } from './CourseVersionsPanel';
import { CourseVersionPreview } from './CourseVersionPreview';
import { CourseNameDialog } from './CourseNameDialog';
import { CourseFindBar } from './CourseFindBar';
import { CourseOutline } from './CourseOutline';
import { CourseSheetChrome } from './CourseSheetChrome';
import { CourseHeaderFooterDialog } from './CourseHeaderFooterDialog';
import { formatHeaderDate } from './courseHeaderFooter';
import { setInvisibles } from './courseInvisibles';
import { checkCourse, setLiveSpell, spellHits, spellKey, hideSpell, type SpellHit } from './courseSpell';
import { CourseSpellPopover } from './CourseSpellPopover';
import { CoursePrintDialog } from './CoursePrintDialog';
import { buildTwoUp, printClasses, type PrintOptions } from './coursePrint';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import { updateBoard } from '../../lib/boardsQueries';
import { uploadBoardImage } from '../../lib/boardImport';
import { fetchLessonBoardByBoardId } from '../../lib/timetable/lessonBoardsQueries';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { Whiteboard } from '../classroom/Whiteboard';
import { duplicateEncartPage, loadEncartPages } from './encartStore';
import type { PasteMode } from './coursePaste';
import { CourseLinkDialog } from './CourseLinkDialog';
import { CourseQrDialog } from './CourseQrDialog';
import { MM } from '../../lib/course/coursePage';
import './course.css';

interface Props {
  boardId: string;
  title: string;
  userId: string;
  onClose: () => void;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'offline' | 'conflict';

/** Une version automatique au plus toutes les 10 minutes de travail. */
const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;

interface Loaded {
  doc: CourseDoc;
  title: string;
  level: string | null;
  chapter: string | null;
  restored: boolean;
  /** Document et numéro d'enregistrement tels qu'en base à l'ouverture. */
  serverDoc: CourseDoc | null;
  rev: string | null;
  updatedAt: number;
}

const SAVE_DELAY_MS = 1000;
const RETRY_MS = 15000;
const ZOOM_KEY = 'course-editor-zoom';
const RULER_KEY = 'course-editor-ruler';
const OUTLINE_KEY = 'course-editor-outline';
const INVISIBLES_KEY = 'course-editor-invisibles';
/** Lot T11 : vérification pendant la frappe (réglage de l'ordinateur) et accord pour l'envoi au correcteur. */
const SPELL_LIVE_KEY = 'course-spell-live';
const SPELL_CONSENT_KEY = 'course-spell-consent';
/** Largeur du volet « Plan du cours » (.ce-outline), pour garder la règle au-dessus de la page. */
const OUTLINE_W = 250;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
/** Marge haute du bureau (padding de .ce-desk), pour garder un point fixe en zoomant. */
const DESK_PAD = 24;
/** Événement interne : raccourci Ctrl+K frappé dans le texte. */
const LINK_EVENT = 'course-editor:link';

const readNumber = (key: string, fallback: number) => {
  try { const v = Number(localStorage.getItem(key)); return Number.isFinite(v) && v > 0 ? v : fallback; } catch { return fallback; }
};
const readBool = (key: string, fallback: boolean) => {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch { return fallback; }
};
const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* stockage indisponible */ } };

function imageFiles(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((f) => f.type.startsWith('image/'));
}

/** Fichiers à importer (lot T10a) : Word et PDF déposés sur la feuille. */
function documentFiles(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((f) => isDocxFile(f) || isPdfFile(f) || isOldDocFile(f));
}

export function CourseEditor({ boardId, title, userId, onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCourse(boardId)
      .then(({ doc, title: t, level, chapter, updatedAt, rev }) => {
        if (cancelled) return;
        // Copie locale plus récente que le serveur : un enregistrement n'est pas arrivé
        const local = loadLocalCourse(boardId);
        const restored = !!local && local.savedAt > updatedAt + 2000;
        setLoaded({ doc: restored && local ? local.doc : doc ?? emptyCourseDoc(), title: t, level, chapter, restored, serverDoc: doc, rev, updatedAt });
      })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Ouverture impossible'); });
    return () => { cancelled = true; };
  }, [boardId]);

  // Pendant que l'éditeur est ouvert : pas de défilement de la page dessous, impression du seul cours
  useEffect(() => {
    document.body.classList.add('ce-open');
    return () => document.body.classList.remove('ce-open');
  }, []);

  return createPortal(
    <div className="ce-root" role="dialog" aria-label={`Cours ${title}`}>
      {loaded ? (
        <CourseEditorInner boardId={boardId} userId={userId} loaded={loaded} onClose={onClose} />
      ) : (
        <div className="ce-loading">
          {error ? (
            <>
              <p>{error}</p>
              <button type="button" className="ce-btn" onClick={onClose}>Fermer</button>
            </>
          ) : (
            <p>Ouverture du cours…</p>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}

function CourseEditorInner({ boardId, userId, loaded, onClose }: {
  boardId: string;
  userId: string;
  loaded: Loaded;
  onClose: () => void;
}) {
  const { doc: initialDoc, title: initialTitle, restored } = loaded;
  const { toast, confirm } = useUIFeedback();
  const [title, setTitle] = useState(initialTitle);
  /** Réglages du document (numérotation des titres, coupure des mots), enregistrés avec lui. */
  const [settings, setSettings] = useState<CourseSettings>(initialDoc.settings ?? {});
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const [renaming, setRenaming] = useState(false);
  const [save, setSave] = useState<SaveState>(restored ? 'dirty' : 'saved');
  const [pages, setPages] = useState(1);
  const [gap, setGap] = useState(SHEET_GAP);
  const [zoom, setZoomState] = useState(() => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, readNumber(ZOOM_KEY, 1))));
  const [showRuler, setShowRuler] = useState(() => readBool(RULER_KEY, true));
  /** Lot T7 : volet du plan, marques non imprimables, barre de recherche. */
  const [showOutline, setShowOutline] = useState(() => readBool(OUTLINE_KEY, false));
  const [showInvisibles, setShowInvisibles] = useState(() => readBool(INVISIBLES_KEY, false));
  const [find, setFind] = useState<{ replace: boolean; query: string; key: number } | null>(null);
  /** Bulle du correcteur ouverte sur une faute (lot T11). */
  const [spellPop, setSpellPop] = useState<{ hit: SpellHit; rect: DOMRect } | null>(null);
  const [lessonChip, setLessonChip] = useState<string | null>(null);
  /** Cours de l'emploi du temps rattaché : champs {classe} et {date} des en-têtes (lot T9). */
  const [lesson, setLesson] = useState<{ label: string; startsAt: Date } | null>(null);
  const [hfOpen, setHfOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollbarW, setScrollbarW] = useState(0);
  /** Encart ouvert dans le tableau blanc (identifiant de sa page), ou null. */
  const [editingEncart, setEditingEncart] = useState<string | null>(null);
  /** Fenêtre « Lien » (Ctrl+K) : état de départ, ou null si fermée. */
  const [qrOpen, setQrOpen] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ href: string; text: string; askText: boolean; inLink: boolean } | null>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  /** Feuilles du cours (copie figée pour « deux par feuille », lot T13). */
  const sheetsRef = useRef<HTMLDivElement>(null);
  /** Fenêtre « Imprimer » / « Exporter en PDF » (lot T13). */
  const [printDialog, setPrintDialog] = useState<'print' | 'pdf' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Sélecteur « Importer un fichier Word ou PDF » (lot T10a). */
  const docFileRef = useRef<HTMLInputElement>(null);
  /** Import en cours : texte de la barre d'état. */
  const [importing, setImporting] = useState<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef(0);
  const pendingRef = useRef(restored);
  /** Numéro d'enregistrement attendu en base (contrôle des écritures concurrentes). */
  const revRef = useRef<string | null>(loaded.rev);
  /** Un autre onglet ou appareil a enregistré le cours : plus d'écriture avant le choix. */
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  /** Historique : volet ouvert, version affichée, fenêtres « nommer ». */
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versionsKey, setVersionsKey] = useState(0);
  const [preview, setPreview] = useState<{ version: CourseVersion; doc: CourseDoc } | null>(null);
  const [nameDialog, setNameDialog] = useState<'version' | 'duplicate' | 'template' | null>(null);
  const lastSnapshotRef = useRef(Date.now());
  /** Nombre d'autres onglets ou appareils où le cours est ouvert. */
  const [others, setOthers] = useState(0);

  const setZoom = useCallback((z: number) => {
    const v = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100;
    setZoomState(v);
    store(ZOOM_KEY, String(v));
  }, []);

  // ---- Enregistrement ----

  const currentDoc = (): CourseDoc | null => {
    const ed = editorRef.current;
    return ed ? { version: COURSE_DOC_VERSION, content: ed.getJSON(), settings: settingsRef.current } : null;
  };

  /** Toujours la dernière version de `flush` (minuteries, raccourcis, nouvel essai). */
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(saveTimer.current);
    if (!pendingRef.current) return true;
    const doc = currentDoc();
    if (!doc) return true;
    saveLocalCourse(boardId, doc);
    if (conflictRef.current) return false;
    pendingRef.current = false;
    setSave('saving');
    try {
      const res = await saveCourseDocGuarded(boardId, doc, revRef.current);
      if (!res.ok) {
        // Réécrit ailleurs depuis l'ouverture : on n'écrase rien, on demande
        pendingRef.current = true;
        conflictRef.current = true;
        setConflict(true);
        setSave('conflict');
        return false;
      }
      revRef.current = res.rev;
      if (!pendingRef.current) setSave('saved');
      // Une version toutes les 10 minutes de travail
      if (Date.now() - lastSnapshotRef.current >= SNAPSHOT_EVERY_MS) {
        lastSnapshotRef.current = Date.now();
        void createVersion(userId, boardId, doc, 'auto')
          .then((ok) => { if (ok) setVersionsKey((k) => k + 1); })
          .catch((err: unknown) => console.warn('[CourseEditor] version :', err));
      }
      return true;
    } catch (err) {
      console.warn('[CourseEditor] enregistrement :', err);
      pendingRef.current = true;
      setSave(navigator.onLine ? 'error' : 'offline');
      saveTimer.current = window.setTimeout(() => { void flushRef.current(); }, RETRY_MS);
      return false;
    }
  }, [boardId, userId]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  // Copie restaurée depuis cet ordinateur : on la renvoie tout de suite au serveur
  useEffect(() => {
    if (!restored) return;
    toast('Une version plus récente gardée sur cet ordinateur a été reprise.', 'info');
    const t = window.setTimeout(() => { void flushRef.current(); }, 500);
    return () => window.clearTimeout(t);
  }, [restored, toast]);

  // Version prise à l'ouverture : l'état du cours tel qu'en base, s'il a changé depuis la dernière
  useEffect(() => {
    const serverDoc = loaded.serverDoc;
    if (!serverDoc) return;
    let cancelled = false;
    void lastVersionAt(boardId).then(async (last) => {
      if (cancelled || last === null || last >= loaded.updatedAt - 1000) return;
      // cours tout juste créé (pas d'historique, écrit il y a moins d'une minute) : rien à garder
      if (last === 0 && Date.now() - loaded.updatedAt < 60_000) return;
      if (await createVersion(userId, boardId, serverDoc, 'auto')) setVersionsKey((k) => k + 1);
    }).catch((err: unknown) => console.warn('[CourseEditor] version d’ouverture :', err));
    return () => { cancelled = true; };
  }, [boardId, userId, loaded]);

  // Le même cours ouvert dans un autre onglet ou sur un autre appareil (présence Realtime)
  useEffect(() => {
    const key = Math.random().toString(36).slice(2, 10);
    const channel = supabase.channel(`course-open:${boardId}`, { config: { presence: { key } } });
    channel
      .on('presence', { event: 'sync' }, () => { setOthers(Math.max(0, Object.keys(channel.presenceState()).length - 1)); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') void channel.track({ since: Date.now() }); });
    return () => { void supabase.removeChannel(channel); };
  }, [boardId]);

  // Fermeture de l'onglet avec des modifications en attente : copie locale immédiate
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!pendingRef.current) return;
      const doc = currentDoc();
      if (doc) saveLocalCourse(boardId, doc);
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [boardId]);

  // ---- Images (bouton, collage, glisser-déposer) ----

  const uploadImages = useCallback(async (files: File[], at?: number, widthPx?: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    for (const f of files) {
      try {
        toast('Envoi de l’image…', 'info');
        const img = await uploadBoardImage(f, userId, `board:${boardId}`, { keepTransparency: true });
        const node = { type: 'image', attrs: { path: img.path, width: Math.round(Math.min(COL_W, widthPx ?? img.width)) } };
        if (at != null) ed.chain().focus().insertContentAt(at, node).run();
        else ed.chain().focus().insertContent(node).run();
      } catch (err) {
        toast(`Image non envoyée : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      }
    }
  }, [boardId, userId, toast]);
  /** Image à remplacer (position du nœud), le temps que le sélecteur de fichier réponde. */
  const replacePosRef = useRef<number | null>(null);
  const replaceImage = useCallback(async (file: File) => {
    const ed = editorRef.current;
    const pos = replacePosRef.current;
    replacePosRef.current = null;
    if (!ed || pos == null) return;
    try {
      toast('Envoi de l’image…', 'info');
      const img = await uploadBoardImage(file, userId, `board:${boardId}`, { keepTransparency: true });
      const node = ed.state.doc.nodeAt(pos);
      if (!node || node.type.name !== 'image') { toast('L’image a été déplacée entre-temps : réessayez.'); return; }
      // Taille, place, cadre et légende gardés ; rognage, rotation et texte de remplacement (propres à
      // l'ancienne image) retirés
      ed.chain().command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, path: img.path, src: null, crop: null, rotate: 0, flip: false, alt: null });
        return true;
      }).setNodeSelection(pos).run();
    } catch (err) {
      toast(`Image non envoyée : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
    }
  }, [boardId, userId, toast]);

  // ---- Importer un fichier Word ou PDF (lot T10a) ----

  /** `replaceAll` : le fichier remplace tout le cours (nouveau cours créé à partir d'un fichier). */
  const importFile = useCallback(async (file: File, at?: number, replaceAll = false) => {
    const ed = editorRef.current;
    if (!ed) return;
    if (isOldDocFile(file) && !isDocxFile(file)) {
      toast('Ancien format Word (.doc) : ouvrez-le dans Word ou LibreOffice et enregistrez-le en .docx.');
      return;
    }
    if (!isDocxFile(file) && !isPdfFile(file)) { toast('Formats acceptés : Word (.docx) et PDF.'); return; }
    try {
      let pdfPages = 0;
      if (isPdfFile(file)) {
        setImporting(`Lecture de « ${file.name} »…`);
        pdfPages = await pdfPageCount(file);
        if (pdfPages > PDF_PAGES_WARN) {
          setImporting(null);
          const ok = await confirm({
            title: `Insérer ${Math.min(pdfPages, PDF_PAGES_MAX)} pages ?`,
            message: pdfPages > PDF_PAGES_MAX
              ? `Ce PDF a ${pdfPages} pages : seules les ${PDF_PAGES_MAX} premières seront insérées, chacune comme une image du cours.`
              : `Ce PDF a ${pdfPages} pages : chacune devient une image du cours (le texte n'est pas modifiable).`,
            confirmLabel: 'Insérer',
            variant: 'warning',
          });
          if (!ok) return;
        }
      }
      // Filet de sécurité (lot T6) : l'état d'avant l'import reste dans l'historique
      const before = ed.getJSON();
      if (countWords(before) > 0) {
        void createVersion(userId, boardId, { version: COURSE_DOC_VERSION, content: before, settings: settingsRef.current }, 'import', `Avant l'import de ${file.name}`)
          .then((ok) => { if (ok) setVersionsKey((k) => k + 1); })
          .catch((err: unknown) => console.warn('[CourseEditor] version avant import :', err));
      }
      if (isDocxFile(file)) {
        setImporting(`Lecture de « ${file.name} »…`);
        const html = await docxToCourseHtml(file);
        if (replaceAll) ed.commands.selectAll();
        else {
          // Le fichier arrive dans un paragraphe vide après le bloc du curseur : sinon son premier
          // paragraphe (souvent le titre) se fondrait dans le texte du curseur
          const $p = ed.state.doc.resolve(at ?? ed.state.selection.to);
          if ($p.parent.isTextblock && $p.parent.content.size > 0) {
            const after = $p.after($p.depth);
            ed.chain().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run();
          } else {
            ed.commands.setTextSelection($p.pos);
          }
        }
        ed.commands.focus();
        pasteModeRef.current = 'adapt';
        ed.view.pasteHTML(html);
        toast(`« ${file.name} » importé : relisez-le. Les couleurs, colonnes, zones de texte et en-têtes de Word ne sont pas repris.`, 'success');
      } else {
        const blobs = await pdfToImages(file, (done, total) => setImporting(`PDF : page ${Math.min(done + 1, total)} sur ${total}…`));
        const nodes = [];
        for (let i = 0; i < blobs.length; i++) {
          setImporting(`Envoi des pages : ${i + 1} sur ${blobs.length}…`);
          const img = await uploadBoardImage(new File([blobs[i]], `page-${i + 1}.jpg`, { type: 'image/jpeg' }), userId, `board:${boardId}`);
          // Bordure fine : le bord d'une page blanche reste visible sur la feuille
          nodes.push({ type: 'image', attrs: { path: img.path, width: Math.round(COL_W), frame: 'border', alt: `${file.name}, page ${i + 1}` } });
        }
        const pos = at ?? ed.state.selection.to;
        // Une seule étape : un Ctrl+Z retire toutes les pages
        ed.chain().focus().insertContentAt(pos, nodes).run();
        toast(`${nodes.length} page${nodes.length > 1 ? 's' : ''} du PDF insérée${nodes.length > 1 ? 's' : ''} en image${nodes.length > 1 ? 's' : ''}.`, 'success');
      }
    } catch (err) {
      toast(`Import impossible : ${err instanceof Error ? err.message : 'fichier illisible'}`);
    } finally {
      setImporting(null);
    }
  }, [boardId, userId, toast, confirm]);
  const importRef = useRef(importFile);
  useEffect(() => { importRef.current = importFile; }, [importFile]);

  const uploadRef = useRef(uploadImages);
  useEffect(() => { uploadRef.current = uploadImages; }, [uploadImages]);

  // ---- Éditeur ----

  /** Mode du prochain collage HTML : « garder la mise en forme » le temps d'un clic sur le bouton. */
  const pasteModeRef = useRef<PasteMode>('adapt');

  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId, onEdit: (pageId) => setEditingEncart(pageId) },
    // Ctrl+K : l'extension prévient par un événement, l'éditeur ouvre la fenêtre (cf. insertLink)
    () => { window.dispatchEvent(new Event(LINK_EVENT)); },
    {
      getMode: () => pasteModeRef.current,
      onDroppedImages: (n) => toast(`${n} image${n > 1 ? 's' : ''} de Word n'${n > 1 ? 'ont' : 'a'} pas pu être reprise${n > 1 ? 's' : ''} : insérez-la${n > 1 ? 's' : ''} avec le bouton Image.`, 'info'),
      onDuplicateEncart: (fromId, toId) => { void duplicateEncartPage(boardId, userId, fromId, toId).catch(() => toast('Le dessin de l’encart copié n’a pas pu être dupliqué.')); },
      onImageFiles: (files) => { void uploadRef.current(files); },
    },
  ), [boardId, userId, toast]);

  // Pages des encarts (aperçus) ; relues au retour du tableau blanc
  useEffect(() => { void loadEncartPages(boardId); }, [boardId]);
  useEffect(() => {
    document.body.classList.toggle('ce-encart-editing', !!editingEncart);
    return () => document.body.classList.remove('ce-encart-editing');
  }, [editingEncart]);
  const closeEncart = useCallback(() => {
    setEditingEncart(null);
    void loadEncartPages(boardId, true);
  }, [boardId]);

  const editor = useEditor({
    extensions,
    content: initialDoc.content,
    autofocus: 'start',
    editorProps: {
      // Le correcteur du navigateur se tait quand celui du cours (LanguageTool) est affiché :
      // pas de double soulignement
      attributes: (state) => ({ class: 'ce-doc', spellcheck: spellKey.getState(state)?.find().length || editorRef.current?.storage.courseSpell?.active ? 'false' : 'true', lang: 'fr' }),
      // Ctrl + clic sur un lien : l'ouvrir dans un nouvel onglet (un clic simple place le curseur)
      handleClick: (_view, _pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) return false;
        const a = (event.target as HTMLElement).closest('a');
        if (!a?.href) return false;
        window.open(a.href, '_blank', 'noopener,noreferrer');
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        const docs = documentFiles(event.dataTransfer);
        if (docs.length > 0) { void importRef.current(docs[0], pos); return true; }
        const files = imageFiles(event.dataTransfer);
        if (files.length === 0) return false;
        void uploadRef.current(files, pos);
        return true;
      },
    },
    onUpdate: () => {
      pendingRef.current = true;
      setSave('dirty');
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => { void flushRef.current(); }, SAVE_DELAY_MS);
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  // Cours créé « à partir d'un fichier Word » : le fichier attend l'ouverture de l'éditeur
  useEffect(() => {
    if (!editor) return;
    const queued = takeCourseImport(boardId);
    if (queued) void importRef.current(queued, undefined, true);
  }, [editor, boardId]);

  // Images collées (page web, image incrustée) : rapatriées dans le stockage du cours, pour ne
  // dépendre ni du site d'origine ni d'un lien qui expire. Un site peut refuser : on prévient.
  const triedImages = useRef(new Set<string>());
  useEffect(() => {
    if (!editor) return;
    const rescue = () => {
      const pending: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name !== 'image' || node.attrs.path || !node.attrs.src) return;
        const src = node.attrs.src as string;
        if (!triedImages.current.has(src)) pending.push(src);
      });
      if (pending.length === 0) return;
      let failed = 0;
      void Promise.all(pending.map(async (src) => {
        triedImages.current.add(src);
        try {
          const res = await fetch(src);
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          if (!blob.type.startsWith('image/')) throw new Error('pas une image');
          const img = await uploadBoardImage(new File([blob], 'image', { type: blob.type }), userId, `board:${boardId}`, { keepTransparency: true });
          // La position a pu bouger pendant l'envoi : on retrouve l'image par son adresse
          const { tr } = editor.state;
          let changed = false;
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'image' && node.attrs.src === src && !node.attrs.path) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, path: img.path, src: null, width: node.attrs.width ?? Math.round(Math.min(COL_W, img.width)) });
              changed = true;
            }
          });
          if (changed) editor.view.dispatch(tr);
          if (src.startsWith('blob:')) URL.revokeObjectURL(src);
        } catch {
          failed++;
        }
      })).then(() => {
        if (failed > 0) toast(`${failed} image${failed > 1 ? 's' : ''} collée${failed > 1 ? 's' : ''} reste${failed > 1 ? 'nt' : ''} liée${failed > 1 ? 's' : ''} au site d'origine (il en interdit la copie) : enregistrez-la${failed > 1 ? 's' : ''} puis insérez-la${failed > 1 ? 's' : ''} avec le bouton Image.`, 'info');
      });
    };
    rescue();
    editor.on('update', rescue);
    return () => { editor.off('update', rescue); };
  }, [editor, boardId, userId, toast]);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const changeSettings = (patch: Partial<CourseSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      return next;
    });
    pendingRef.current = true;
    setSave('dirty');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { void flushRef.current(); }, SAVE_DELAY_MS);
  };

  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? e.getText({ blockSeparator: ' ' }).split(/\s+/).filter(Boolean).length : 0),
  }) ?? 0;

  // ---- Cours de l'emploi du temps rattaché (pastille de la barre de titre) ----

  useEffect(() => {
    let cancelled = false;
    fetchLessonBoardByBoardId(boardId).then((lb) => {
      if (cancelled || !lb) return;
      const day = lb.startsAt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const time = lb.startsAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setLessonChip(`${lb.label} · ${day} · ${time}`);
      setLesson({ label: lb.label, startsAt: lb.startsAt });
    });
    return () => { cancelled = true; };
  }, [boardId]);

  // ---- Impression : feuilles collées (pas d'espace entre elles), zoom ignoré ----

  useEffect(() => {
    const before = () => {
      const ed = editorRef.current;
      flushSync(() => setGap(0));
      if (ed) flushSync(() => relayoutNow(ed, 0));
    };
    const after = () => {
      const ed = editorRef.current;
      setGap(SHEET_GAP);
      if (ed) relayoutNow(ed, SHEET_GAP);
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);


  /**
   * Impression avec options (lot T13) : classes posées sur <body> (la version adaptée change la
   * mise en page : la pagination de `beforeprint` la mesure), copie « deux par feuille » faite
   * après ce recalcul, tout est retiré après l'impression.
   */
  const printWith = (o: PrintOptions) => {
    flushSync(() => setPrintDialog(null));
    const classes = printClasses(o);
    if (classes.length === 0) { window.print(); return; }
    document.body.classList.add(...classes);
    let undoTwoUp: (() => void) | null = null;
    const before = () => {
      const root = deskRef.current?.closest('.ce-root') as HTMLElement | null;
      const sheets = sheetsRef.current;
      if (o.twoUp && root && sheets) undoTwoUp = buildTwoUp(root, sheets, sheets.querySelectorAll('.ce-sheet').length);
    };
    const after = () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      undoTwoUp?.();
      document.body.classList.remove(...classes);
      const ed = editorRef.current;
      if (ed) relayoutNow(ed, SHEET_GAP);
    };
    // Enregistrés après ceux de la pagination : ils voient la mise en page recalculée
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    window.print();
  };

  // ---- Raccourcis globaux ----

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        pendingRef.current = true;
        void flushRef.current().then((ok) => { if (ok) toast('Cours enregistré.', 'success'); });
      }
      // Ctrl+F, Ctrl+H : la recherche du cours plutôt que celle du navigateur (pas dans un encart)
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'f' || k === 'h') && !editingEncartRef.current) {
        e.preventDefault();
        openFindRef.current(k === 'h');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast]);

  // ---- Bureau : page courante, largeur de la barre de défilement (alignement de la règle) ----

  const sheetsH = pages * PAGE_H + (pages - 1) * gap;
  const chromeValues = useMemo(() => ({
    titre: title,
    classe: lesson?.label ?? '',
    date: formatHeaderDate(lesson?.startsAt ?? new Date()),
  }), [title, lesson]);

  const onDeskScroll = () => {
    const desk = deskRef.current;
    if (!desk) return;
    const y = (desk.scrollTop + desk.clientHeight * 0.35 - 24) / zoom;
    setCurrentPage(Math.min(pages, Math.max(1, Math.floor(y / (PAGE_H + gap)) + 1)));
  };

  useEffect(() => {
    const desk = deskRef.current;
    if (!desk) return;
    const measure = () => setScrollbarW(desk.offsetWidth - desk.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(desk);
    return () => ro.disconnect();
  }, []);

  const fitWidth = () => {
    const desk = deskRef.current;
    if (desk) setZoom((desk.clientWidth - 48) / PAGE_W);
  };

  // ---- Zoom autour d'un point fixe (Ctrl+molette, page entière) ----

  const zoomRef = useRef(zoom);
  /** Point du bureau à garder sous le même pixel après le prochain changement de zoom. */
  const zoomAnchorRef = useRef<{ y: number; contentY: number } | null>(null);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const desk = deskRef.current;
    const a = zoomAnchorRef.current;
    zoomAnchorRef.current = null;
    if (desk && a) desk.scrollTop = a.contentY * zoom + DESK_PAD - a.y;
  }, [zoom]);

  useEffect(() => {
    const desk = deskRef.current;
    if (!desk) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const y = e.clientY - desk.getBoundingClientRect().top;
      zoomAnchorRef.current = { y, contentY: (desk.scrollTop + y - DESK_PAD) / zoomRef.current };
      // pavé tactile (petits pas) comme molette (pas de 100) : environ 14 % par cran de molette
      setZoom(zoomRef.current * Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.0015));
    };
    desk.addEventListener('wheel', onWheel, { passive: false });
    return () => desk.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  /** Une page entière à l'écran, en haut du bureau. */
  const fitPage = () => {
    const desk = deskRef.current;
    if (!desk) return;
    const page = Math.min(currentPage, pages) - 1;
    zoomAnchorRef.current = { y: DESK_PAD, contentY: page * (PAGE_H + gap) };
    setZoom(Math.min((desk.clientHeight - 2 * DESK_PAD) / PAGE_H, (desk.clientWidth - 48) / PAGE_W));
  };

  /** Fait défiler le bureau jusqu'à une position du document (au tiers haut), si elle est hors de vue. */
  const reveal = useCallback((pos: number) => {
    const ed = editorRef.current;
    const desk = deskRef.current;
    if (!ed || !desk) return;
    let c: { top: number; bottom: number; left: number };
    try { c = ed.view.coordsAtPos(pos); } catch { return; }
    const r = desk.getBoundingClientRect();
    if (c.top < r.top + 40 || c.bottom > r.bottom - 40) desk.scrollTop += c.top - r.top - r.height / 3;
    if (c.left < r.left + 20 || c.left > r.right - 20) desk.scrollLeft += c.left - r.left - r.width / 2;
  }, []);

  // ---- Rechercher, plan, marques (lot T7) ----

  const editingEncartRef = useRef(editingEncart);
  useEffect(() => { editingEncartRef.current = editingEncart; }, [editingEncart]);

  const openFind = (replace: boolean) => {
    const ed = editorRef.current;
    let query = '';
    if (ed && !ed.state.selection.empty) {
      const { from, to } = ed.state.selection;
      const sel = ed.state.doc.textBetween(from, to, '\n');
      if (sel.length <= 120 && !sel.includes('\n')) query = sel;
    }
    setFind((prev) => ({ replace: replace || (prev?.replace ?? false), query, key: (prev?.key ?? 0) + 1 }));
  };
  const openFindRef = useRef(openFind);
  useEffect(() => { openFindRef.current = openFind; });

  const goToHeading = (pos: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain().focus().setTextSelection(pos + 1).run();
    reveal(pos + 1);
  };

  const toggleOutline = () => setShowOutline((v) => { store(OUTLINE_KEY, v ? '0' : '1'); return !v; });
  const toggleInvisibles = () => setShowInvisibles((v) => { store(INVISIBLES_KEY, v ? '0' : '1'); return !v; });

  // ---- Orthographe et grammaire (lot T11) ----

  const spell = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const st = e?.storage.courseSpell;
      return { active: !!st?.active, live: !!st?.live, checking: !!st?.checking, count: e ? spellHits(e.state).length : 0 };
    },
  }) ?? { active: false, live: false, checking: false, count: 0 };

  useEffect(() => {
    if (!editor) return;
    editor.storage.courseSpell.onOpen = (hit, rect) => setSpellPop({ hit, rect });
    if (readBool(SPELL_LIVE_KEY, false) && readBool(SPELL_CONSENT_KEY, false)) setLiveSpell(editor, true);
    return () => { if (!editor.isDestroyed) editor.storage.courseSpell.onOpen = null; };
  }, [editor]);

  /** Le texte part chez un service en ligne : on le dit une fois, l'enseignant décide. */
  const spellConsent = async (): Promise<boolean> => {
    if (readBool(SPELL_CONSENT_KEY, false)) return true;
    const ok = await confirm({
      title: 'Vérifier avec LanguageTool ?',
      message: 'Le texte du cours est envoyé au service en ligne gratuit LanguageTool (le même que pour le tableau blanc), qui renvoie les fautes. Rien n’est envoyé sans que vous le demandiez. Évitez d’y laisser des noms d’élèves.',
      confirmLabel: 'Vérifier',
      variant: 'warning',
    });
    if (ok) store(SPELL_CONSENT_KEY, '1');
    return ok;
  };

  const runSpell = async () => {
    if (!editor || !(await spellConsent())) return;
    try {
      const n = await checkCourse(editor);
      toast(n === 0 ? 'Aucune faute trouvée.' : `${n} faute${n > 1 ? 's' : ''} soulignée${n > 1 ? 's' : ''} : cliquez sur un mot pour les propositions.`, n === 0 ? 'success' : 'info');
    } catch {
      toast('Le correcteur ne répond pas (pas de réseau, ou trop de demandes) : réessayez dans une minute.');
    }
  };

  /** Faute suivante après le curseur (on reboucle au début), bulle ouverte dessus. */
  const nextSpell = () => {
    if (!editor) return;
    const hits = spellHits(editor.state);
    if (hits.length === 0) { toast('Aucune faute soulignée.', 'info'); return; }
    const at = editor.state.selection.to;
    const hit = hits.find((h) => h.from >= at) ?? hits[0];
    editor.chain().focus().setTextSelection({ from: hit.from, to: hit.to }).run();
    reveal(hit.from);
    window.setTimeout(() => {
      const el = (editor.view.domAtPos(hit.from + 1).node as Node);
      const span = (el.nodeType === Node.TEXT_NODE ? el.parentElement : el as HTMLElement)?.closest('.ce-spell') as HTMLElement | null;
      const r = span?.getBoundingClientRect() ?? editor.view.coordsAtPos(hit.from);
      setSpellPop({ hit, rect: r instanceof DOMRect ? r : new DOMRect(r.left, r.top, 1, r.bottom - r.top) });
    }, 60);
  };

  const toggleLiveSpell = async () => {
    if (!editor) return;
    const next = !spell.live;
    if (next && !(await spellConsent())) return;
    store(SPELL_LIVE_KEY, next ? '1' : '0');
    setLiveSpell(editor, next);
  };

  // Marques non imprimables : le réglage gardé sur cet ordinateur s'applique au document
  useEffect(() => {
    if (editor && !editor.isDestroyed) setInvisibles(editor.view, showInvisibles);
  }, [editor, showInvisibles]);

  /** Clic dans une marge ou sous le texte : le curseur va au point le plus proche, comme dans Word. */
  const onSheetsMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!editor || target.closest('.ce-flow')) return;
    e.preventDefault();
    const flow = (e.currentTarget as HTMLElement).querySelector('.ce-flow') as HTMLElement | null;
    if (!flow) return;
    const r = flow.getBoundingClientRect();
    const left = Math.min(r.right - 2, Math.max(r.left + 2, e.clientX));
    const top = Math.min(r.bottom - 2, Math.max(r.top + 2, e.clientY));
    const hit = editor.view.posAtCoords({ left, top });
    if (hit) editor.chain().focus().setTextSelection(hit.pos).run();
    else editor.commands.focus('end');
  };

  // ---- Actions de la barre de titre et du ruban ----

  const close = async () => {
    const ok = await flush();
    if (!ok) {
      const leave = await confirm({
        title: 'Cours pas encore enregistré',
        message: 'Le serveur ne répond pas. Une copie est gardée sur cet ordinateur : elle sera reprise à la prochaine ouverture du cours.',
        confirmLabel: 'Fermer quand même',
        variant: 'warning',
      });
      if (!leave) return;
    }
    onClose();
  };

  const commitTitle = async (value: string) => {
    setRenaming(false);
    const t = value.trim();
    if (!t || t === title) return;
    setTitle(t);
    try { await updateBoard(boardId, { title: t }); }
    catch { toast('Impossible de renommer le cours.'); setTitle(title); }
  };

  // ---- Versions, copies, modèles (lot T6) ----

  /** Remplace le document affiché (restauration, version de l'autre appareil). */
  const replaceDoc = (doc: CourseDoc, emitUpdate: boolean) => {
    if (!editor) return;
    setSettings(doc.settings ?? {});
    settingsRef.current = doc.settings ?? {};
    editor.commands.setContent(doc.content, { emitUpdate });
  };

  const saveVersion = async (label: string) => {
    const doc = currentDoc();
    if (!doc) return;
    try {
      const ok = await createVersion(userId, boardId, doc, label ? 'manual' : 'auto', label || null);
      if (!ok) { toast('L’historique des versions demande la migration 072.'); return; }
      lastSnapshotRef.current = Date.now();
      setVersionsKey((k) => k + 1);
      setNameDialog(null);
      toast(label ? `Version « ${label} » enregistrée.` : 'Version enregistrée.', 'success');
    } catch { toast('Impossible d’enregistrer la version.'); }
  };

  const openPreview = async (version: CourseVersion) => {
    try { setPreview({ version, doc: await fetchVersionDoc(version.id) }); }
    catch { toast('Cette version est illisible.'); }
  };

  const restorePreview = async () => {
    if (!preview || !editor) return;
    const at = new Date(preview.version.created_at);
    const ok = await confirm({
      title: 'Restaurer cette version ?',
      message: `Le texte du cours reprend son état du ${at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. L’état actuel reste dans l’historique (« Avant restauration »). Les dessins des encarts ne changent pas.`,
      confirmLabel: 'Restaurer',
      variant: 'warning',
    });
    if (!ok) return;
    const current = currentDoc();
    if (current) await createVersion(userId, boardId, current, 'restore').catch((err: unknown) => console.warn('[CourseEditor] version avant restauration :', err));
    replaceDoc(preview.doc, true);
    setPreview(null);
    setVersionsKey((k) => k + 1);
    lastSnapshotRef.current = Date.now();
    toast('Version restaurée. Ctrl+Z pour revenir en arrière.', 'success');
  };

  const duplicate = async (name: string, asTemplate: boolean) => {
    if (!(await flush())) { toast('Le cours n’est pas encore enregistré : réessayez dans un instant.'); return; }
    try {
      await duplicateCourse(userId, boardId, { title: name, level: loaded.level, chapter: loaded.chapter }, asTemplate);
      setNameDialog(null);
      toast(asTemplate
        ? `Modèle « ${name} » enregistré : il est proposé à la création d’un cours.`
        : `Copie « ${name} » créée dans Mes tableaux.`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Copie impossible.');
    }
  };

  /** Conflit : garder ma version (celle d'en face va dans l'historique) ou prendre l'autre. */
  const resolveConflict = async (keep: 'mine' | 'theirs') => {
    try {
      const server = await fetchCourse(boardId);
      const mine = currentDoc();
      if (keep === 'mine') {
        if (server.doc) await createVersion(userId, boardId, server.doc, 'conflict', 'Écrasée par une autre fenêtre').catch(() => false);
        revRef.current = server.rev;
        conflictRef.current = false;
        setConflict(false);
        pendingRef.current = true;
        await flush();
      } else {
        if (mine) await createVersion(userId, boardId, mine, 'conflict', 'Modifications non gardées').catch(() => false);
        conflictRef.current = false;
        setConflict(false);
        revRef.current = server.rev;
        pendingRef.current = false;
        window.clearTimeout(saveTimer.current);
        if (server.doc) { replaceDoc(server.doc, false); saveLocalCourse(boardId, server.doc); }
        setSave('saved');
      }
      setVersionsKey((k) => k + 1);
    } catch {
      toast('Le serveur ne répond pas : réessayez dans un instant.');
    }
  };

  const insertLink = () => {
    if (!editor) return;
    const inLink = editor.isActive('link');
    const { from, to, empty } = editor.state.selection;
    setLinkDialog({
      href: (editor.getAttributes('link') as { href?: string }).href ?? '',
      text: empty ? '' : editor.state.doc.textBetween(from, to, ' '),
      askText: empty && !inLink,
      inLink,
    });
  };
  useEffect(() => {
    window.addEventListener(LINK_EVENT, insertLink);
    return () => window.removeEventListener(LINK_EVENT, insertLink);
  });

  const applyLink = (href: string, text: string) => {
    if (!editor || !linkDialog) return;
    if (linkDialog.askText) {
      editor.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkDialog(null);
  };

  /** Bouton « Coller » : comme Ctrl+V (mise en forme comprise), si le navigateur donne accès au presse-papiers. */
  const paste = async (mode: PasteMode | 'text' = 'adapt') => {
    if (!editor) return;
    try {
      editor.commands.focus();
      if (mode === 'text') {
        const text = await navigator.clipboard.readText();
        if (text) editor.view.pasteText(text);
        return;
      }
      if (typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (item.types.includes('text/html')) {
            pasteModeRef.current = mode;
            try { editor.view.pasteHTML(await (await item.getType('text/html')).text()); }
            finally { pasteModeRef.current = 'adapt'; }
            return;
          }
          if (imageType) {
            const blob = await item.getType(imageType);
            void uploadImages([new File([blob], 'image.png', { type: imageType })]);
            return;
          }
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) editor.view.pasteText(text);
    } catch {
      toast('Le navigateur bloque le bouton Coller : utilisez Ctrl+V.', 'info');
    }
  };

  const saveLabel: Record<SaveState, string> = {
    saved: 'Enregistré',
    dirty: 'Modifications…',
    saving: 'Enregistrement…',
    error: 'Pas enregistré — nouvel essai bientôt',
    offline: 'Hors connexion — copie gardée sur cet ordinateur',
    conflict: 'Pas enregistré — modifié ailleurs',
  };

  if (!editor) return null;

  return (
    <>
      <header className="ce-titlebar">
        <div className="ce-logo" aria-hidden>GC</div>
        <div className="ce-qa">
          <button type="button" title="Annuler (Ctrl+Z)" aria-label="Annuler" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Icon name="undo" size={16} /></button>
          <button type="button" title="Rétablir (Ctrl+Y)" aria-label="Rétablir" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Icon name="redo" size={16} /></button>
        </div>
        {renaming ? (
          <input
            className="ce-title-input"
            defaultValue={title}
            autoFocus
            onBlur={(e) => void commitTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
            aria-label="Nom du cours"
          />
        ) : (
          <button type="button" className="ce-title" onClick={() => setRenaming(true)} title="Renommer le cours">{title}</button>
        )}
        {lessonChip && <span className="ce-chip" title="Cours de l'emploi du temps auquel ce document est rattaché">{lessonChip}</span>}
        <span className={`ce-saved ce-saved--${save}`} role="status">{saveLabel[save]}</span>
        {others > 0 && (
          <span className="ce-chip ce-chip--warn" title="Ce cours est ouvert dans un autre onglet ou sur un autre appareil. Si les deux enregistrent, l’éditeur demandera quelle version garder.">
            Ouvert aussi ailleurs
          </span>
        )}
        <span className="ce-spacer-flex" />
        <button type="button" className="ce-btn ce-btn--primary" onClick={() => void close()}>Fermer</button>
      </header>

      <CourseRibbon
        editor={editor}
        onPrint={() => setPrintDialog('print')}
        onExportPdf={() => setPrintDialog('pdf')}
        onRename={() => setRenaming(true)}
        onInsertImage={() => { replacePosRef.current = null; fileRef.current?.click(); }}
        onInsertQr={() => setQrOpen(true)}
        onInsertLink={insertLink}
        onPaste={(mode) => void paste(mode)}
        zoom={zoom}
        onZoom={setZoom}
        onFitWidth={fitWidth}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler((v) => { store(RULER_KEY, v ? '0' : '1'); return !v; })}
        onSoon={(what) => toast(what, 'info')}
        onEditEncart={(pageId) => setEditingEncart(pageId)}
        settings={settings}
        onSettings={changeSettings}
        onHistory={() => setVersionsOpen((v) => !v)}
        historyOpen={versionsOpen}
        onSaveVersion={() => setNameDialog('version')}
        onDuplicate={() => setNameDialog('duplicate')}
        onSaveTemplate={() => setNameDialog('template')}
        onFind={() => openFind(false)}
        onReplace={() => openFind(true)}
        onFitPage={fitPage}
        showOutline={showOutline}
        onToggleOutline={toggleOutline}
        showInvisibles={showInvisibles}
        onToggleInvisibles={toggleInvisibles}
        onHeaderFooter={() => setHfOpen(true)}
        onImportFile={() => docFileRef.current?.click()}
        spell={spell}
        onSpellCheck={() => void runSpell()}
        onSpellNext={nextSpell}
        onSpellLive={() => void toggleLiveSpell()}
        onSpellHide={() => { if (editor) hideSpell(editor); setSpellPop(null); }}
        onReplaceImage={() => { replacePosRef.current = editor.state.selection.from; fileRef.current?.click(); }}
      />

      {conflict && (
        <div className="ce-conflict" role="alert">
          <div>
            <strong>Ce cours a été modifié dans une autre fenêtre ou sur un autre appareil.</strong>
            <span>Vos dernières modifications ne sont pas encore enregistrées. Quelle version garder ? L’autre restera dans l’historique.</span>
          </div>
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={() => void resolveConflict('theirs')}>Prendre l’autre version</button>
          <button type="button" className="ce-btn ce-btn--primary" onClick={() => void resolveConflict('mine')}>Garder la mienne</button>
        </div>
      )}

      {showRuler && (
        <div className="ce-rulerbar" style={{ paddingRight: scrollbarW, paddingLeft: showOutline ? OUTLINE_W : 0 }} aria-hidden>
          <div className="ce-ruler" style={{ width: PAGE_W * zoom }}>
            <div className="ce-ruler__margin" style={{ left: 0, width: MARGIN * zoom }} />
            <div className="ce-ruler__margin" style={{ right: 0, width: MARGIN * zoom }} />
            {Array.from({ length: 22 }).map((_, i) => (
              <span key={i}>
                <i className="ce-ruler__tick" style={{ left: i * 37.795 * zoom, height: i % 5 === 0 ? 8 : 4 }} />
                {i > 0 && i < 21 && i % 2 === 0 && <span className="ce-ruler__num" style={{ left: i * 37.795 * zoom }}>{i}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`ce-main ${versionsOpen ? 'has-versions' : ''}`}>
      {showOutline && (
        <CourseOutline editor={editor} numbering={settings.numbering} onGo={goToHeading} onClose={toggleOutline} />
      )}
      <div className="ce-desk" ref={deskRef} onScroll={onDeskScroll}>
        <div className="ce-sheets-outer" style={{ width: PAGE_W * zoom, height: sheetsH * zoom }}>
          <div ref={sheetsRef} className="ce-sheets" style={{ width: PAGE_W, height: sheetsH, transform: `scale(${zoom})` }} onMouseDown={onSheetsMouseDown}>
            {Array.from({ length: pages }).map((_, i) => (
              <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + gap), width: PAGE_W, height: PAGE_H }}>
                <CourseSheetChrome page={i + 1} pages={pages} settings={settings} values={chromeValues} onEdit={() => setHfOpen(true)} />
              </div>
            ))}
            <div className="ce-flow" style={{ left: MARGIN, top: MARGIN, width: COL_W }} data-numbering={settings.numbering && settings.numbering !== 'none' ? settings.numbering : undefined} data-hyphens={settings.hyphens ? '' : undefined} data-invisibles={showInvisibles ? '' : undefined} data-caption={settings.captionLabel ?? 'document'}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
        {preview && (
          <CourseVersionPreview
            key={preview.version.id}
            boardId={boardId}
            version={preview.version}
            doc={preview.doc}
            zoom={zoom}
            chromeValues={chromeValues}
            onRestore={() => void restorePreview()}
            onClose={() => setPreview(null)}
          />
        )}
        {find && (
          <CourseFindBar
            editor={editor}
            replaceOpen={find.replace}
            onReplaceOpen={(open) => setFind((f) => (f ? { ...f, replace: open } : f))}
            initialQuery={find.query}
            focusKey={find.key}
            onReveal={reveal}
            onClose={() => setFind(null)}
            onToast={(msg) => toast(msg, 'info')}
          />
        )}
        {versionsOpen && (
          <CourseVersionsPanel
            boardId={boardId}
            refreshKey={versionsKey}
            previewId={preview?.version.id ?? null}
            onPreview={(v) => void openPreview(v)}
            onSaveVersion={() => setNameDialog('version')}
            onClose={() => { setVersionsOpen(false); setPreview(null); }}
          />
        )}
      </div>

      <footer className="ce-status">
        <span>Page {Math.min(currentPage, pages)} sur {pages}</span>
        <span>{words} mot{words > 1 ? 's' : ''}</span>
        {importing && <span className="ce-status__busy" role="status">{importing}</span>}
        {spell.checking && <span className="ce-status__busy" role="status">Vérification de l’orthographe…</span>}
        {!spell.checking && spell.active && (
          <button type="button" className="ce-status__spell" onClick={nextSpell} title="Aller à la faute suivante">
            {spell.count === 0 ? 'Aucune faute' : `${spell.count} faute${spell.count > 1 ? 's' : ''}`}
          </button>
        )}
        <span className="ce-spacer-flex" />
        <div className="ce-modes" role="group" aria-label="Mode">
          <button type="button" className="is-on" title="Rédiger le cours">¶ Texte</button>
          <button type="button" title="Bientôt : dessiner par-dessus le cours" onClick={() => toast('Le mode Tableau arrive à l’étape 3.', 'info')}>✎ Tableau</button>
          <button type="button" className="ce-modes__play" title="Bientôt : le cours projeté en classe" onClick={() => toast('Le mode En classe arrive à l’étape 4.', 'info')}>▶ En classe</button>
        </div>
        <div className="ce-zoom">
          <button type="button" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom arrière">−</button>
          <input type="range" min={ZOOM_MIN * 100} max={ZOOM_MAX * 100} step={5} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} aria-label="Zoom" />
          <button type="button" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom avant">+</button>
          <span className="ce-zoom__pct">{Math.round(zoom * 100)} %</span>
        </div>
      </footer>

      {printDialog && <CoursePrintDialog pdf={printDialog === 'pdf'} onPrint={printWith} onClose={() => setPrintDialog(null)} />}

      {spellPop && <CourseSpellPopover editor={editor} hit={spellPop.hit} rect={spellPop.rect} onClose={() => setSpellPop(null)} />}

      {hfOpen && <CourseHeaderFooterDialog settings={settings} onSettings={changeSettings} onClose={() => setHfOpen(false)} />}

      {nameDialog === 'version' && (
        <CourseNameDialog
          title="Enregistrer une version"
          label="Nom de la version (facultatif)"
          placeholder="Avant la séance de jeudi, version corrigée…"
          hint={versionsUnavailable() ? 'L’historique demande la migration 072.' : 'Une version nommée n’est jamais effacée de l’historique.'}
          confirmLabel="Enregistrer"
          optional
          onConfirm={saveVersion}
          onClose={() => setNameDialog(null)}
        />
      )}
      {(nameDialog === 'duplicate' || nameDialog === 'template') && (
        <CourseNameDialog
          title={nameDialog === 'duplicate' ? 'Dupliquer ce cours' : 'Enregistrer comme modèle'}
          label={nameDialog === 'duplicate' ? 'Nom de la copie' : 'Nom du modèle'}
          initial={nameDialog === 'duplicate' ? `${title} (copie)` : title}
          hint={nameDialog === 'duplicate'
            ? 'La copie (texte et encarts) est indépendante : la modifier ne change pas ce cours.'
            : templatesUnavailable() ? 'Les modèles demandent la migration 072.' : 'Le modèle sera proposé dans « + Nouveau » de Mes tableaux. Ce cours-ci ne change pas.'}
          confirmLabel={nameDialog === 'duplicate' ? 'Dupliquer' : 'Enregistrer le modèle'}
          onConfirm={(name) => duplicate(name, nameDialog === 'template')}
          onClose={() => setNameDialog(null)}
        />
      )}

      {qrOpen && (
        <CourseQrDialog
          onInsert={(file, cm) => { void uploadImages([file], undefined, cm * 10 * MM); }}
          onClose={() => { setQrOpen(false); editor.commands.focus(); }}
        />
      )}

      {linkDialog && (
        <CourseLinkDialog
          initialHref={linkDialog.href}
          initialText={linkDialog.text}
          askText={linkDialog.askText}
          onApply={applyLink}
          onRemove={linkDialog.inLink ? () => editor.chain().focus().extendMarkRange('link').unsetLink().run() : null}
          onClose={() => { setLinkDialog(null); editor.commands.focus(); }}
        />
      )}

      {/* Encart ouvert dans le tableau blanc, sur sa seule page ; le cours reste monté dessous (masqué) */}
      {editingEncart && createPortal(
        <Whiteboard
          key={editingEncart}
          sessionId={`encart:${editingEncart}`}
          boardId={boardId}
          onlyPageId={editingEncart}
          userId={userId}
          title={`${title} — encart`}
          chrome="ribbon"
          remote
          onClose={closeEncart}
        />,
        document.body,
      )}

      <input
        ref={docFileRef}
        type="file"
        accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importFile(f);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (replacePosRef.current != null) { if (files[0]) void replaceImage(files[0]); else replacePosRef.current = null; return; }
          if (files.length) void uploadImages(files);
        }}
      />
    </>
  );
}
