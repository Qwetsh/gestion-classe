/**
 * Barre des formes : choix de la forme (grille), contour, épaisseur, pointillé, remplissage,
 * flèches. Agit sur les réglages par défaut (outil forme) ou sur les formes sélectionnées.
 */
import { useRef, useState } from 'react';
import { SHAPE_CATALOG, SHAPE_STROKE_WIDTHS, isLineKind, shapePath, arrowHeadPaths, type ShapeKind, type ShapeObject } from '../../lib/boardShapes';
import { BoardColorPicker } from './BoardColorPicker';
import { BoardPopover } from './BoardPopover';

export interface ShapeStyle {
  stroke: string;
  strokeWidth: number;
  fill: string | null;
  dashed: boolean;
}

interface Props {
  kind: ShapeKind;
  style: ShapeStyle;
  /** Formes sélectionnées (la barre reflète la première, applique à toutes). */
  selected: ShapeObject[];
  onKind: (kind: ShapeKind) => void;
  onStyle: (patch: Partial<ShapeStyle>) => void;
  /** Change le type de flèche des lignes sélectionnées. */
  onLineKind: (kind: 'line' | 'arrow' | 'double-arrow') => void;
  onDelete: () => void;
}

/** Icône d'une forme : la forme elle-même, dessinée petit. */
export function ShapeIcon({ kind, size = 26 }: { kind: ShapeKind; size?: number }) {
  const sample: ShapeObject = {
    id: '', type: 'shape', kind, x: 0, y: 0, w: 20, h: isLineKind(kind) ? 0 : 20,
    stroke: 'currentColor', strokeWidth: 2, fill: null,
    a: { x: 0, y: 1 }, b: { x: 1, y: 0 },
    points: kind === 'polygon' ? [{ x: 0.5, y: 0 }, { x: 1, y: 0.4 }, { x: 0.8, y: 1 }, { x: 0.2, y: 1 }, { x: 0, y: 0.4 }] : undefined,
  };
  if (isLineKind(kind)) sample.h = 20;
  return (
    <svg width={size} height={size} viewBox="-3 -3 26 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      <path d={shapePath(sample)} />
      {arrowHeadPaths(sample).map((d, i) => <path key={i} d={d} fill="currentColor" />)}
    </svg>
  );
}

export function BoardShapeToolbar({ kind, style, selected, onKind, onStyle, onLineKind, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const hold = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();
  const current = selected[0] ?? null;
  const lineSelected = selected.length > 0 && selected.every((s) => isLineKind(s.kind));
  const widthKey = (Object.keys(SHAPE_STROKE_WIDTHS) as ('S' | 'M' | 'L')[]).find((k) => SHAPE_STROKE_WIDTHS[k] === style.strokeWidth);

  return (
    <>
      <div className="wb__group" ref={ref} style={{ position: 'relative' }}>
        <button ref={btnRef} className="wb__btn is-on" onPointerDown={hold} onClick={() => setOpen((v) => !v)} title="Choisir une forme">
          <ShapeIcon kind={current?.kind ?? kind} />
        </button>
        {open && (
          <BoardPopover anchorRef={btnRef} onClose={() => setOpen(false)} className="wbs__panel" width={300}>
            {SHAPE_CATALOG.map((s) => (
              <button
                key={s.kind}
                className={`wbs__cell ${(current?.kind ?? kind) === s.kind ? 'is-on' : ''}`}
                onPointerDown={hold}
                onClick={() => { onKind(s.kind); setOpen(false); }}
                title={s.label}
              >
                <ShapeIcon kind={s.kind} size={30} />
              </button>
            ))}
          </BoardPopover>
        )}
        {(lineSelected || (selected.length === 0 && isLineKind(kind))) && (
          <>
            {(['line', 'arrow', 'double-arrow'] as const).map((k) => (
              <button key={k} className={`wb__btn ${(current?.kind ?? kind) === k ? 'is-on' : ''}`} onPointerDown={hold} onClick={() => (selected.length > 0 ? onLineKind(k) : onKind(k))} title={k === 'line' ? 'Sans flèche' : k === 'arrow' ? 'Flèche' : 'Double flèche'}>
                <ShapeIcon kind={k} size={22} />
              </button>
            ))}
          </>
        )}
      </div>

      <div className="wb__group" title="Contour">
        <BoardColorPicker value={style.stroke} onChange={(c) => onStyle({ stroke: c })} title="Couleur du contour" />
      </div>

      <div className="wb__group">
        {(Object.keys(SHAPE_STROKE_WIDTHS) as ('S' | 'M' | 'L')[]).map((k) => (
          <button key={k} className={`wb__btn wb__size ${widthKey === k ? 'is-on' : ''}`} onPointerDown={hold} onClick={() => onStyle({ strokeWidth: SHAPE_STROKE_WIDTHS[k] })} title={`Épaisseur ${k}`}>
            <i style={{ width: 6 + SHAPE_STROKE_WIDTHS[k] * 2, height: 6 + SHAPE_STROKE_WIDTHS[k] * 2 }} />
          </button>
        ))}
        <button className={`wb__btn ${style.dashed ? 'is-on' : ''}`} onPointerDown={hold} onClick={() => onStyle({ dashed: !style.dashed })} title="Pointillés">
          <svg viewBox="0 0 24 24"><path d="M3 12h3M9 12h3M15 12h3M21 12h0" /></svg>
        </button>
      </div>

      {!lineSelected && (
        <div className="wb__group" title="Remplissage">
          <span className="wbs__label">Fond</span>
          <BoardColorPicker value={style.fill ?? 'none'} onChange={(c) => onStyle({ fill: c === 'none' ? null : c })} allowNone title="Remplissage" muted={style.fill === null} />
        </div>
      )}

      <div className="wb__group">
        <button className="wb__btn" disabled={selected.length === 0} onPointerDown={hold} onClick={onDelete} title="Supprimer (Suppr)">
          <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
        </button>
      </div>
      <style>{CSS}</style>
    </>
  );
}

const CSS = `
.wbs__panel {
  padding: 10px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
  border-radius: 14px; background: #111827; box-shadow: 0 16px 48px rgba(0,0,0,0.45);
}
.wbs__cell { display: flex; align-items: center; justify-content: center; height: 50px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; cursor: pointer; }
.wbs__cell:hover { background: #374151; }
.wbs__cell.is-on { background: #4F46E5; color: #FFFFFF; }
.wbs__label { color: #9CA3AF; font: 500 12px/1 Inter, system-ui, sans-serif; margin-right: 4px; }
`;
