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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { courseExtensions } from './courseExtensions';
import { relayoutNow } from './coursePagination';
import { CourseRibbon } from './CourseRibbon';
import { Icon } from './courseIcons';
import {
  COURSE_DOC_VERSION, emptyCourseDoc, fetchCourse, loadLocalCourse, saveCourseDoc, saveLocalCourse,
  type CourseDoc,
} from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W, SHEET_GAP } from '../../lib/course/coursePage';
import { updateBoard } from '../../lib/boardsQueries';
import { uploadBoardImage } from '../../lib/boardImport';
import { fetchLessonBoardByBoardId } from '../../lib/timetable/lessonBoardsQueries';
import { useUIFeedback } from '../../contexts/UIFeedbackContext';
import { Whiteboard } from '../classroom/Whiteboard';
import { loadEncartPages } from './encartStore';
import { CourseLinkDialog } from './CourseLinkDialog';
import './course.css';

interface Props {
  boardId: string;
  title: string;
  userId: string;
  onClose: () => void;
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'offline';

const SAVE_DELAY_MS = 1000;
const RETRY_MS = 15000;
const ZOOM_KEY = 'course-editor-zoom';
const RULER_KEY = 'course-editor-ruler';
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

export function CourseEditor({ boardId, title, userId, onClose }: Props) {
  const [loaded, setLoaded] = useState<{ doc: CourseDoc; title: string; restored: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCourse(boardId)
      .then(({ doc, title: t, updatedAt }) => {
        if (cancelled) return;
        // Copie locale plus récente que le serveur : un enregistrement n'est pas arrivé
        const local = loadLocalCourse(boardId);
        const restored = !!local && local.savedAt > updatedAt + 2000;
        setLoaded({ doc: restored && local ? local.doc : doc ?? emptyCourseDoc(), title: t, restored });
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
        <CourseEditorInner boardId={boardId} userId={userId} initialDoc={loaded.doc} initialTitle={loaded.title} restored={loaded.restored} onClose={onClose} />
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

function CourseEditorInner({ boardId, userId, initialDoc, initialTitle, restored, onClose }: {
  boardId: string;
  userId: string;
  initialDoc: CourseDoc;
  initialTitle: string;
  restored: boolean;
  onClose: () => void;
}) {
  const { toast, confirm } = useUIFeedback();
  const [title, setTitle] = useState(initialTitle);
  const [renaming, setRenaming] = useState(false);
  const [save, setSave] = useState<SaveState>(restored ? 'dirty' : 'saved');
  const [pages, setPages] = useState(1);
  const [gap, setGap] = useState(SHEET_GAP);
  const [zoom, setZoomState] = useState(() => Math.min(2, Math.max(0.5, readNumber(ZOOM_KEY, 1))));
  const [showRuler, setShowRuler] = useState(() => readBool(RULER_KEY, true));
  const [lessonChip, setLessonChip] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollbarW, setScrollbarW] = useState(0);
  /** Encart ouvert dans le tableau blanc (identifiant de sa page), ou null. */
  const [editingEncart, setEditingEncart] = useState<string | null>(null);
  /** Fenêtre « Lien » (Ctrl+K) : état de départ, ou null si fermée. */
  const [linkDialog, setLinkDialog] = useState<{ href: string; text: string; askText: boolean; inLink: boolean } | null>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const saveTimer = useRef(0);
  const pendingRef = useRef(restored);

  const setZoom = useCallback((z: number) => {
    const v = Math.round(Math.min(2, Math.max(0.5, z)) * 100) / 100;
    setZoomState(v);
    store(ZOOM_KEY, String(v));
  }, []);

  // ---- Enregistrement ----

  const currentDoc = (): CourseDoc | null => {
    const ed = editorRef.current;
    return ed ? { version: COURSE_DOC_VERSION, content: ed.getJSON() } : null;
  };

  /** Toujours la dernière version de `flush` (minuteries, raccourcis, nouvel essai). */
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const flush = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(saveTimer.current);
    if (!pendingRef.current) return true;
    const doc = currentDoc();
    if (!doc) return true;
    pendingRef.current = false;
    saveLocalCourse(boardId, doc);
    setSave('saving');
    try {
      await saveCourseDoc(boardId, doc);
      if (!pendingRef.current) setSave('saved');
      return true;
    } catch (err) {
      console.warn('[CourseEditor] enregistrement :', err);
      pendingRef.current = true;
      setSave(navigator.onLine ? 'error' : 'offline');
      saveTimer.current = window.setTimeout(() => { void flushRef.current(); }, RETRY_MS);
      return false;
    }
  }, [boardId]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  // Copie restaurée depuis cet ordinateur : on la renvoie tout de suite au serveur
  useEffect(() => {
    if (!restored) return;
    toast('Une version plus récente gardée sur cet ordinateur a été reprise.', 'info');
    const t = window.setTimeout(() => { void flushRef.current(); }, 500);
    return () => window.clearTimeout(t);
  }, [restored, toast]);

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

  const uploadImages = useCallback(async (files: File[], at?: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    for (const f of files) {
      try {
        toast('Envoi de l’image…', 'info');
        const img = await uploadBoardImage(f, userId, `board:${boardId}`);
        const node = { type: 'image', attrs: { path: img.path, width: Math.round(Math.min(COL_W, img.width)) } };
        if (at != null) ed.chain().focus().insertContentAt(at, node).run();
        else ed.chain().focus().insertContent(node).run();
      } catch (err) {
        toast(`Image non envoyée : ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      }
    }
  }, [boardId, userId, toast]);
  const uploadRef = useRef(uploadImages);
  useEffect(() => { uploadRef.current = uploadImages; }, [uploadImages]);

  // ---- Éditeur ----

  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId, onEdit: (pageId) => setEditingEncart(pageId) },
    // Ctrl+K : l'extension prévient par un événement, l'éditeur ouvre la fenêtre (cf. insertLink)
    () => { window.dispatchEvent(new Event(LINK_EVENT)); },
  ), [boardId]);

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
      attributes: { class: 'ce-doc', spellcheck: 'true', lang: 'fr' },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData);
        if (files.length === 0) return false;
        void uploadRef.current(files);
        return true;
      },
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
        const files = imageFiles(event.dataTransfer);
        if (files.length === 0) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
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
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

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

  const print = useCallback(() => { window.print(); }, []);

  // ---- Raccourcis globaux ----

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        pendingRef.current = true;
        void flushRef.current().then((ok) => { if (ok) toast('Cours enregistré.', 'success'); });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toast]);

  // ---- Bureau : page courante, largeur de la barre de défilement (alignement de la règle) ----

  const sheetsH = pages * PAGE_H + (pages - 1) * gap;

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
  const paste = async () => {
    if (!editor) return;
    try {
      editor.commands.focus();
      if (typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (item.types.includes('text/html')) {
            editor.view.pasteHTML(await (await item.getType('text/html')).text());
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
        <span className="ce-spacer-flex" />
        <button type="button" className="ce-btn ce-btn--primary" onClick={() => void close()}>Fermer</button>
      </header>

      <CourseRibbon
        editor={editor}
        onPrint={print}
        onExportPdf={() => { toast('Dans la fenêtre d’impression, choisissez « Enregistrer au format PDF ».', 'info'); window.setTimeout(print, 400); }}
        onRename={() => setRenaming(true)}
        onInsertImage={() => fileRef.current?.click()}
        onInsertLink={insertLink}
        onPaste={() => void paste()}
        zoom={zoom}
        onZoom={setZoom}
        onFitWidth={fitWidth}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler((v) => { store(RULER_KEY, v ? '0' : '1'); return !v; })}
        onSoon={(what) => toast(what, 'info')}
        onEditEncart={(pageId) => setEditingEncart(pageId)}
      />

      {showRuler && (
        <div className="ce-rulerbar" style={{ paddingRight: scrollbarW }} aria-hidden>
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

      <div className="ce-desk" ref={deskRef} onScroll={onDeskScroll}>
        <div className="ce-sheets-outer" style={{ width: PAGE_W * zoom, height: sheetsH * zoom }}>
          <div className="ce-sheets" style={{ width: PAGE_W, height: sheetsH, transform: `scale(${zoom})` }} onMouseDown={onSheetsMouseDown}>
            {Array.from({ length: pages }).map((_, i) => (
              <div key={i} className="ce-sheet" style={{ top: i * (PAGE_H + gap), width: PAGE_W, height: PAGE_H }}>
                <span className="ce-sheet__num">{i + 1}</span>
              </div>
            ))}
            <div className="ce-flow" style={{ left: MARGIN, top: MARGIN, width: COL_W }}>
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      <footer className="ce-status">
        <span>Page {Math.min(currentPage, pages)} sur {pages}</span>
        <span>{words} mot{words > 1 ? 's' : ''}</span>
        <span className="ce-spacer-flex" />
        <div className="ce-modes" role="group" aria-label="Mode">
          <button type="button" className="is-on" title="Rédiger le cours">¶ Texte</button>
          <button type="button" title="Bientôt : dessiner par-dessus le cours" onClick={() => toast('Le mode Tableau arrive à l’étape 3.', 'info')}>✎ Tableau</button>
          <button type="button" className="ce-modes__play" title="Bientôt : le cours projeté en classe" onClick={() => toast('Le mode En classe arrive à l’étape 4.', 'info')}>▶ En classe</button>
        </div>
        <div className="ce-zoom">
          <button type="button" onClick={() => setZoom(zoom - 0.1)} aria-label="Zoom arrière">−</button>
          <input type="range" min={50} max={200} step={5} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} aria-label="Zoom" />
          <button type="button" onClick={() => setZoom(zoom + 0.1)} aria-label="Zoom avant">+</button>
          <span className="ce-zoom__pct">{Math.round(zoom * 100)} %</span>
        </div>
      </footer>

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
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void uploadImages(files);
        }}
      />
    </>
  );
}
