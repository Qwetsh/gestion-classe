/**
 * Navigateur de pages du tableau blanc : colonne de vignettes à droite, masquable.
 * Vignettes rendues par `renderPageToCanvas` (même rendu que l'export) avec un délai
 * après la dernière modification ; réordonnancement par glisser-déposer ou flèches.
 */
import { useEffect, useRef, useState } from 'react';
import { BOARD_RATIO, renderPageToCanvas, type BoardPage } from '../../lib/boardRender';

const THUMB_W = 200;
const RENDER_DELAY_MS = 250;

interface Props {
  pages: BoardPage[];
  pageIndex: number;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  /** Clic droit / appui long sur une vignette. */
  onContextMenu: (index: number, x: number, y: number) => void;
  onAddPage: () => void;
}

function Thumb({ page, active, index, onSelect, onContextMenu, onDragStart, onDrop }: {
  page: BoardPage;
  active: boolean;
  index: number;
  onSelect: () => void;
  onContextMenu: (x: number, y: number) => void;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const longPress = useRef<number | null>(null);

  // Rendu différé : la page change à chaque trait, on attend que ça se calme
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      renderPageToCanvas(page, THUMB_W * 2)
        .then((canvas) => { if (!cancelled) setUrl(canvas.toDataURL('image/jpeg', 0.7)); })
        .catch(() => undefined);
    }, RENDER_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [page]);

  return (
    <div
      className={`wbn__thumb ${active ? 'is-active' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        longPress.current = window.setTimeout(() => onContextMenu(e.clientX, e.clientY), 500);
      }}
      onPointerUp={() => { if (longPress.current) window.clearTimeout(longPress.current); }}
      onPointerMove={() => { if (longPress.current) window.clearTimeout(longPress.current); }}
      title={`Page ${index + 1}`}
    >
      <div className="wbn__img" style={{ aspectRatio: `${BOARD_RATIO}` }}>
        {url ? <img src={url} alt="" draggable={false} /> : null}
        {page.strokes.length === 0 && (page.objects ?? []).length === 0 && !page.image && <span className="wbn__empty">vide</span>}
      </div>
      <div className="wbn__num">{index + 1}</div>
    </div>
  );
}

export function BoardPageNavigator({ pages, pageIndex, onSelect, onReorder, onContextMenu, onAddPage }: Props) {
  const dragFrom = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // La page courante reste visible dans la colonne
  useEffect(() => {
    const el = listRef.current?.children[pageIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [pageIndex]);

  return (
    <aside className="wbn" onPointerDown={(e) => e.stopPropagation()}>
      <div className="wbn__head">
        <span>Pages</span>
        <span className="wbn__count">{pages.length}</span>
      </div>
      <div className="wbn__list" ref={listRef}>
        {pages.map((p, i) => (
          <Thumb
            key={p.id}
            page={p}
            index={i}
            active={i === pageIndex}
            onSelect={() => onSelect(i)}
            onContextMenu={(x, y) => onContextMenu(i, x, y)}
            onDragStart={() => { dragFrom.current = i; }}
            onDrop={() => {
              const from = dragFrom.current;
              dragFrom.current = null;
              if (from !== null && from !== i) onReorder(from, i);
            }}
          />
        ))}
      </div>
      <div className="wbn__foot">
        <button type="button" className="wbn__btn" onClick={() => pageIndex > 0 && onReorder(pageIndex, pageIndex - 1)} disabled={pageIndex === 0} title="Monter la page">▲</button>
        <button type="button" className="wbn__btn" onClick={() => pageIndex < pages.length - 1 && onReorder(pageIndex, pageIndex + 1)} disabled={pageIndex >= pages.length - 1} title="Descendre la page">▼</button>
        <button type="button" className="wbn__btn wbn__btn--add" onClick={onAddPage} title="Nouvelle page (Ctrl+Entrée)">+</button>
      </div>
      <style>{CSS}</style>
    </aside>
  );
}

const CSS = `
.wbn {
  position: fixed; right: 0; top: 0; bottom: 0; z-index: 11; width: 232px;
  display: flex; flex-direction: column; background: #111827; color: #E5E7EB;
  border-left: 1px solid #1F2937; font: 500 13px/1.2 Inter, system-ui, sans-serif; user-select: none;
}
.wbn__head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px 10px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #9CA3AF; }
.wbn__count { font-family: "IBM Plex Mono", ui-monospace, monospace; color: #6B7280; }
.wbn__list { flex: 1; overflow-y: auto; padding: 4px 14px 12px; display: flex; flex-direction: column; gap: 10px; }
.wbn__thumb { position: relative; border-radius: 8px; padding: 4px; cursor: pointer; border: 2px solid transparent; }
.wbn__thumb:hover { background: #1F2937; }
.wbn__thumb.is-active { border-color: #6366F1; }
.wbn__img { width: 100%; background: #FFFFFF; border-radius: 4px; overflow: hidden; position: relative; }
.wbn__img img { display: block; width: 100%; height: 100%; object-fit: cover; }
.wbn__empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #9CA3AF; font-size: 12px; }
.wbn__num { position: absolute; left: 8px; bottom: 8px; min-width: 22px; padding: 2px 6px; border-radius: 6px; background: rgba(17,24,39,0.85); color: #F9FAFB; font: 600 11px/1.3 "IBM Plex Mono", ui-monospace, monospace; text-align: center; }
.wbn__foot { display: flex; gap: 6px; padding: 10px 14px 14px; border-top: 1px solid #1F2937; }
.wbn__btn { flex: 1; height: 40px; border-radius: 10px; border: 0; background: #1F2937; color: #E5E7EB; font: 600 15px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbn__btn:hover { background: #374151; }
.wbn__btn:disabled { opacity: 0.35; cursor: default; }
.wbn__btn--add { background: #4F46E5; color: #FFFFFF; font-size: 20px; }
`;
