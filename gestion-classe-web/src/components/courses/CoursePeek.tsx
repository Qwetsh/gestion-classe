/**
 * Aperçu au survol, dans « Mes cours » : la première page d'un original (feuille A4 d'un cours
 * rédigé, ou première page d'un tableau blanc), en petit, à côté du bouton survolé.
 * Lecture seule ; le document lu est gardé en mémoire tant qu'il n'a pas été modifié.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Board } from '../../lib/boardsQueries';
import { fetchBoardPages } from '../../lib/boardQueries';
import { pageRatio, renderPageToCanvas, type BoardPage } from '../../lib/boardRender';
import { fetchCourseDoc, type CourseDoc } from '../../lib/course/courseDoc';
import { COL_W, MARGIN, PAGE_H, PAGE_W } from '../../lib/course/coursePage';
import { courseExtensions } from '../course/courseExtensions';
import { CourseSheetChrome } from '../course/CourseSheetChrome';
import { flowStyle } from '../course/courseThemes';
import '../course/course.css';

type Preview = { kind: 'course'; doc: CourseDoc } | { kind: 'board'; page: BoardPage | null };

/** Documents déjà lus, par original et date de modification (un cours retouché est relu). */
const cache = new Map<string, Promise<Preview>>();

/** Lit l'aperçu d'avance (dès que la souris arrive sur le bouton) ; sans effet s'il est déjà lu. */
export function prefetchPreview(board: Board): void {
  loadPreview(board).catch(() => { /* retenté à l'affichage */ });
}

function loadPreview(board: Board): Promise<Preview> {
  const key = `${board.id}|${board.updated_at}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async (): Promise<Preview> => {
      const doc = board.is_course === false ? null : await fetchCourseDoc(board.id);
      if (doc) return { kind: 'course', doc };
      const { pages } = await fetchBoardPages({ boardId: board.id });
      return { kind: 'board', page: pages[0] ?? null };
    })();
    // Une lecture ratée sera retentée au prochain survol
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/** Largeur de l'aperçu : une feuille A4 lisible d'un coup d'œil, une page 16:9 un peu plus large. */
const SHEET_W = 260;
const BOARD_W = 340;
const GAP = 8;
const EDGE = 8;

export interface PeekTarget {
  board: Board;
  /** Bouton survolé : l'aperçu se place dessous, ou dessus s'il manque de place. */
  anchor: DOMRect;
}

export function CoursePeek({ target }: { target: PeekTarget }) {
  const { board, anchor } = target;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setFailed(false);
    loadPreview(board).then((p) => { if (!cancelled) setPreview(p); }, () => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [board]);

  const isBoard = preview?.kind === 'board' || (!preview && board.is_course === false);
  const width = isBoard ? BOARD_W : SHEET_W;
  const height = preview?.kind === 'board' && preview.page
    ? Math.round(width / pageRatio(preview.page))
    : isBoard ? Math.round(width * 9 / 16) : Math.round(width * PAGE_H / PAGE_W);

  // Dessous si la place le permet, sinon dessus ; jamais hors de la fenêtre
  const below = anchor.bottom + GAP + height + EDGE <= window.innerHeight || anchor.top - GAP - height < EDGE;
  const top = below ? Math.min(anchor.bottom + GAP, window.innerHeight - height - EDGE) : anchor.top - GAP - height;
  const left = Math.max(EDGE, Math.min(anchor.left, window.innerWidth - width - EDGE));

  return createPortal(
    <div className="mc-peek" style={{ top: Math.max(EDGE, top), left, width, height }} aria-hidden>
      {preview?.kind === 'course' && <CourseFirstPage boardId={board.id} title={board.title} doc={preview.doc} width={width} />}
      {preview?.kind === 'board' && (preview.page
        ? <BoardFirstPage page={preview.page} width={width} />
        : <span className="mc-peek__note">Tableau vide</span>)}
      {!preview && <span className="mc-peek__note">{failed ? 'Aperçu indisponible' : 'Chargement…'}</span>}
    </div>,
    document.body,
  );
}

/** Première feuille A4 d'un cours rédigé, réduite. */
function CourseFirstPage({ boardId, title, doc, width }: { boardId: string; title: string; doc: CourseDoc; width: number }) {
  const [pages, setPages] = useState(1);
  const extensions = useMemo(() => courseExtensions(
    (layout) => setPages(layout.pages),
    { boardId, onEdit: () => { /* lecture seule */ } },
    () => { /* lecture seule */ },
    { getMode: () => 'adapt', onDroppedImages: () => {}, onDuplicateEncart: () => {}, onImageFiles: () => {} },
  ), [boardId]);
  const editor = useEditor({ extensions, content: doc.content, editable: false, editorProps: { attributes: { class: 'ce-doc', lang: 'fr' } } }, [doc]);
  const numbering = doc.settings?.numbering;
  return (
    <div className="ce-sheets" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${width / PAGE_W})`, cursor: 'default' }}>
      <div className="ce-sheet" style={{ top: 0, width: PAGE_W, height: PAGE_H, boxShadow: 'none' }}>
        <CourseSheetChrome page={1} pages={pages} settings={doc.settings ?? {}} values={{ titre: title, classe: '', date: '' }} />
      </div>
      <div
        className="ce-flow"
        style={{ left: MARGIN, top: MARGIN, width: COL_W, ...flowStyle(doc.settings) }}
        data-numbering={numbering && numbering !== 'none' ? numbering : undefined}
        data-hyphens={doc.settings?.hyphens ? '' : undefined}
        data-caption={doc.settings?.captionLabel ?? 'document'}
      >
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  );
}

/** Première page d'un tableau blanc, dessinée au double de sa taille pour rester nette. */
function BoardFirstPage({ page, width }: { page: BoardPage; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawW = width * 2;
  const drawH = Math.round(drawW / pageRatio(page));
  useEffect(() => {
    let cancelled = false;
    renderPageToCanvas(page, drawW).then((rendered) => {
      const ctx = ref.current?.getContext('2d');
      if (cancelled || !ctx) return;
      ctx.clearRect(0, 0, drawW, drawH);
      ctx.drawImage(rendered, 0, 0);
    }).catch(() => { /* image illisible : page laissée blanche */ });
    return () => { cancelled = true; };
  }, [page, drawW, drawH]);
  return <canvas ref={ref} width={drawW} height={drawH} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
