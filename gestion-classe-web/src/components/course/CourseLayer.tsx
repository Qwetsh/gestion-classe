/**
 * Calque Tableau du cours (lot 3) : SVG posé dans `.ce-sheets`, au-dessus du texte, aux
 * dimensions de la feuille (il suit le zoom et le défilement du bureau). En mode Texte il ne
 * capte rien ; stylet sorti, il reçoit la souris, le stylet et le doigt.
 *
 * Les éléments sont ancrés aux blocs du document (voir `lib/course/courseLayer.ts`) : leur
 * position verticale est recalculée à chaque changement de mise en page.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  anchorAt, localBox, newLayerId, placeAt, r1, resolveY, simplify,
  type BlockBox, type LayerItem,
} from '../../lib/course/courseLayer';
import { PAGE_W } from '../../lib/course/coursePage';
import { TEXT_SIZES, strokeFor, type DrawStyle } from './courseDraw';

interface Props {
  editor: Editor;
  items: LayerItem[];
  /** Hauteur des feuilles (px de feuille). */
  height: number;
  /** Stylet sorti : le calque reçoit les gestes. */
  active: boolean;
  style: DrawStyle;
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** `record` : une étape d'annulation. */
  onChange: (items: LayerItem[], record: boolean) => void;
  /** Lecture seule (aperçu d'une version). */
  readOnly?: boolean;
}

type Draft =
  | { kind: 'ink'; tool: 'pen' | 'highlighter'; points: [number, number][] }
  | { kind: 'line' | 'arrow'; a: [number, number]; b: [number, number] }
  | { kind: 'rect' | 'ellipse'; a: [number, number]; b: [number, number] };

const inkPath = (pts: [number, number][]) =>
  pts.length === 1 ? `M${pts[0][0]} ${pts[0][1]}l0.01 0` : `M${pts.map((p) => `${p[0]} ${p[1]}`).join('L')}`;

/** Pointe de flèche : triangle au bout du trait. */
function arrowHead(to: [number, number], size: number): string {
  const ang = Math.atan2(to[1], to[0]);
  const len = 6 + size * 2.5;
  const a1 = ang + Math.PI - 0.45;
  const a2 = ang + Math.PI + 0.45;
  return `${to[0]},${to[1]} ${to[0] + len * Math.cos(a1)},${to[1] + len * Math.sin(a1)} ${to[0] + len * Math.cos(a2)},${to[1] + len * Math.sin(a2)}`;
}

export function CourseLayer({ editor, items, height, active, style, selected, onSelect, onChange, readOnly }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [blocks, setBlocks] = useState<BlockBox[]>([]);
  const [tick, setTick] = useState(0);
  const [draft, setDraftState] = useState<Draft | null>(null);
  /** Tracé en cours, lu par les gestionnaires (des événements rapprochés arrivent avant le rendu suivant). */
  const draftRef = useRef<Draft | null>(null);
  const setDraft = (d: Draft | null) => { draftRef.current = d; setDraftState(d); };
  const [textEdit, setTextEdit] = useState<{ id: string | null; x: number; y: number; value: string } | null>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  /** Élément en cours de déplacement et décalage (état : lu pendant le rendu). */
  const [drag, setDragState] = useState<{ id: string; delta: [number, number] } | null>(null);
  const dragDeltaRef = useRef<[number, number] | null>(null);
  const setDrag = (v: { id: string; delta: [number, number] } | null) => { dragDeltaRef.current = v?.delta ?? null; setDragState(v); };
  const erasedRef = useRef<Set<string>>(new Set());
  const [erasing, setErasing] = useState<Set<string>>(new Set());

  // ---- Positions des blocs (mises à jour à chaque frappe, image chargée, changement de page) ----
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    editor.on('update', bump);
    const flow = svgRef.current?.parentElement?.querySelector('.ce-flow');
    const ro = flow ? new ResizeObserver(bump) : null;
    if (flow && ro) ro.observe(flow);
    return () => { editor.off('update', bump); ro?.disconnect(); };
  }, [editor]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || editor.isDestroyed) return;
    const sr = svg.getBoundingClientRect();
    const zoom = sr.width / PAGE_W || 1;
    const out: BlockBox[] = [];
    editor.state.doc.forEach((node, offset) => {
      const id = node.attrs.blockId as string | null | undefined;
      if (!id) return;
      const dom = editor.view.nodeDOM(offset) as HTMLElement | null;
      if (!dom || typeof dom.getBoundingClientRect !== 'function') return;
      const r = dom.getBoundingClientRect();
      out.push({ id, top: (r.top - sr.top) / zoom, bottom: (r.bottom - sr.top) / zoom });
    });
    // Mesure du DOM après le rendu : c'est l'usage prévu d'un effet de mise en page
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks((prev) => (prev.length === out.length && prev.every((b, i) => b.id === out[i].id && Math.abs(b.top - out[i].top) < 0.5) ? prev : out));
  }, [editor, tick, height]);

  const tops = new Map(blocks.map((b) => [b.id, b.top]));

  // ---- Coordonnées ----
  const toSheet = useCallback((e: { clientX: number; clientY: number }): [number, number] => {
    const sr = svgRef.current!.getBoundingClientRect();
    const zoom = sr.width / PAGE_W || 1;
    return [r1((e.clientX - sr.left) / zoom), r1((e.clientY - sr.top) / zoom)];
  }, []);

  const commit = (next: LayerItem[]) => onChange(next, true);

  const base = (x: number, y: number) => {
    const a = anchorAt(blocks, y);
    return { id: newLayerId(), color: style.color, size: strokeFor(style.tool, style.size), x, y, blockId: a.blockId, dy: a.dy };
  };

  // ---- Gestes ----

  /** Garder le pointeur pendant le geste (refusé pour un pointeur inconnu : on continue sans). */
  const capture = (e: React.PointerEvent) => {
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
  };
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active || readOnly || e.button > 0) return;
    const p = toSheet(e);
    const target = (e.target as Element).closest('[data-item]');
    const hitId = target?.getAttribute('data-item') ?? null;
    if (style.tool === 'select') {
      if (!hitId) { onSelect(null); return; }
      onSelect(hitId);
      const it = items.find((i) => i.id === hitId);
      if (!it) return;
      dragRef.current = { id: hitId, sx: p[0], sy: p[1], ox: it.x, oy: resolveY(it, tops), moved: false };
      capture(e);
      return;
    }
    if (style.tool === 'eraser') {
      erasedRef.current = new Set(hitId ? [hitId] : []);
      setErasing(new Set(erasedRef.current));
      capture(e);
      return;
    }
    if (style.tool === 'text') {
      e.preventDefault();
      setTextEdit({ id: null, x: p[0], y: p[1], value: '' });
      return;
    }
    capture(e);
    if (style.tool === 'pen' || style.tool === 'highlighter') setDraft({ kind: 'ink', tool: style.tool, points: [p] });
    else setDraft({ kind: style.tool, a: p, b: p });
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!active || readOnly) return;
    if (style.tool === 'eraser' && e.buttons) {
      // Sous le doigt : l'élément touché (la capture du pointeur masque la cible : on la cherche)
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-item]');
      const id = el?.getAttribute('data-item');
      if (id && !erasedRef.current.has(id)) { erasedRef.current.add(id); setErasing(new Set(erasedRef.current)); }
      return;
    }
    const d = dragRef.current;
    if (d) {
      const p = toSheet(e);
      const dx = p[0] - d.sx; const dy = p[1] - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
      setDrag({ id: d.id, delta: [dx, dy] });
      return;
    }
    const cur = draftRef.current;
    if (!cur) return;
    const p = toSheet(e);
    if (cur.kind === 'ink') setDraft({ ...cur, points: [...cur.points, p] });
    else setDraft({ ...cur, b: p });
  };

  const onPointerUp = () => {
    if (!active || readOnly) return;
    if (style.tool === 'eraser') {
      if (erasedRef.current.size) commit(items.filter((i) => !erasedRef.current.has(i.id)));
      erasedRef.current = new Set();
      setErasing(new Set());
      return;
    }
    const d = dragRef.current;
    if (d) {
      dragRef.current = null;
      const delta = dragDeltaRef.current;
      if (d.moved && delta) {
        commit(items.map((i) => (i.id === d.id ? placeAt(i, r1(d.ox + delta[0]), r1(d.oy + delta[1]), blocks) : i)));
      }
      setDrag(null);
      return;
    }
    const draft = draftRef.current;
    if (!draft) return;
    setDraft(null);
    if (draft.kind === 'ink') {
      const [ox, oy] = draft.points[0];
      const pts = simplify(draft.points).map(([x, y]) => [r1(x - ox), r1(y - oy)] as [number, number]);
      commit([...items, { ...base(ox, oy), kind: 'ink', tool: draft.tool, size: strokeFor(draft.tool, style.size), points: pts }]);
      return;
    }
    const [ax, ay] = draft.a; const [bx, by] = draft.b;
    if (Math.hypot(bx - ax, by - ay) < 4) return;
    if (draft.kind === 'line' || draft.kind === 'arrow') {
      commit([...items, { ...base(ax, ay), kind: draft.kind, to: [r1(bx - ax), r1(by - ay)] }]);
    } else {
      const x = Math.min(ax, bx); const y = Math.min(ay, by);
      commit([...items, { ...base(x, y), kind: draft.kind, w: r1(Math.abs(bx - ax)), h: r1(Math.abs(by - ay)) }]);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!active || readOnly) return;
    const id = (e.target as Element).closest('[data-item]')?.getAttribute('data-item');
    const it = items.find((i) => i.id === id);
    if (it?.kind === 'text') setTextEdit({ id: it.id, x: it.x, y: resolveY(it, tops), value: it.text });
  };

  const finishText = () => {
    const t = textEdit;
    setTextEdit(null);
    if (!t) return;
    const value = t.value.trim();
    if (t.id) {
      commit(value ? items.map((i) => (i.id === t.id && i.kind === 'text' ? { ...i, text: value } : i)) : items.filter((i) => i.id !== t.id));
    } else if (value) {
      commit([...items, { ...base(t.x, t.y), kind: 'text', size: TEXT_SIZES[style.size], text: value }]);
    }
  };

  // Le mode Texte ferme une saisie en cours (réglé pendant le rendu, sans effet)
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setTextEdit(null);
  }

  // ---- Rendu ----
  const itemsOnTop = style.tool === 'select' || style.tool === 'eraser';

  const renderItem = (it: LayerItem) => {
    const moving = drag && drag.id === it.id ? drag.delta : null;
    const x = it.x + (moving ? moving[0] : 0);
    const y = resolveY(it, tops) + (moving ? moving[1] : 0);
    const faded = erasing.has(it.id);
    const common = { stroke: it.color, strokeWidth: it.size, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    let shape: React.ReactNode;
    let hit: React.ReactNode = null;
    switch (it.kind) {
      case 'ink': {
        const d = inkPath(it.points);
        shape = <path d={d} {...common} opacity={it.tool === 'highlighter' ? 0.35 : 1} style={it.tool === 'highlighter' ? { mixBlendMode: 'multiply' } : undefined} />;
        hit = <path d={d} stroke="transparent" strokeWidth={it.size + 12} fill="none" />;
        break;
      }
      case 'line':
      case 'arrow':
        shape = (
          <>
            <line x1={0} y1={0} x2={it.to[0]} y2={it.to[1]} {...common} />
            {it.kind === 'arrow' && <polygon points={arrowHead(it.to, it.size)} fill={it.color} stroke={it.color} strokeWidth={1} strokeLinejoin="round" />}
          </>
        );
        hit = <line x1={0} y1={0} x2={it.to[0]} y2={it.to[1]} stroke="transparent" strokeWidth={it.size + 12} />;
        break;
      case 'rect':
        shape = <rect x={0} y={0} width={it.w} height={it.h} rx={3} {...common} />;
        hit = <rect x={0} y={0} width={it.w} height={it.h} stroke="transparent" strokeWidth={it.size + 12} fill="none" />;
        break;
      case 'ellipse':
        shape = <ellipse cx={it.w / 2} cy={it.h / 2} rx={it.w / 2} ry={it.h / 2} {...common} />;
        hit = <ellipse cx={it.w / 2} cy={it.h / 2} rx={it.w / 2} ry={it.h / 2} stroke="transparent" strokeWidth={it.size + 12} fill="none" />;
        break;
      case 'text':
        shape = <text x={0} y={0} fill={it.color} fontSize={it.size} dominantBaseline="hanging" className="ce-layer__text">{it.text}</text>;
        { const b = localBox(it); hit = <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />; }
        break;
    }
    const box = selected === it.id ? localBox(it) : null;
    return (
      <g key={it.id} data-item={it.id} transform={`translate(${x} ${y})`} opacity={faded ? 0.25 : 1} className={itemsOnTop && active ? 'ce-layer__item is-hit' : 'ce-layer__item'}>
        {shape}
        {hit}
        {box && <rect className="ce-layer__sel" x={box.x - 6} y={box.y - 6} width={box.w + 12} height={box.h + 12} rx={4} />}
      </g>
    );
  };

  const renderDraft = () => {
    if (!draft) return null;
    const color = style.color;
    const w = strokeFor(style.tool, style.size);
    if (draft.kind === 'ink') {
      return <path d={inkPath(draft.points)} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={draft.tool === 'highlighter' ? 0.35 : 1} />;
    }
    const [ax, ay] = draft.a; const [bx, by] = draft.b;
    if (draft.kind === 'line' || draft.kind === 'arrow') {
      return (
        <g transform={`translate(${ax} ${ay})`}>
          <line x1={0} y1={0} x2={bx - ax} y2={by - ay} stroke={color} strokeWidth={w} strokeLinecap="round" />
          {draft.kind === 'arrow' && <polygon points={arrowHead([bx - ax, by - ay], w)} fill={color} />}
        </g>
      );
    }
    const x = Math.min(ax, bx); const y = Math.min(ay, by); const ww = Math.abs(bx - ax); const hh = Math.abs(by - ay);
    return draft.kind === 'rect'
      ? <rect x={x} y={y} width={ww} height={hh} rx={3} stroke={color} strokeWidth={w} fill="none" />
      : <ellipse cx={x + ww / 2} cy={y + hh / 2} rx={ww / 2} ry={hh / 2} stroke={color} strokeWidth={w} fill="none" />;
  };

  return (
    <>
      <svg
        ref={svgRef}
        className={`ce-layer ${active && !readOnly ? `is-active ce-layer--${style.tool}` : ''}`}
        width={PAGE_W}
        height={height}
        viewBox={`0 0 ${PAGE_W} ${height}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        aria-hidden={!active}
      >
        {items.map(renderItem)}
        {renderDraft()}
      </svg>
      {textEdit && (
        <input
          className="ce-layer__input"
          style={{ left: textEdit.x, top: textEdit.y, fontSize: TEXT_SIZES[style.size], color: style.color }}
          autoFocus
          value={textEdit.value}
          onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
          onBlur={finishText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); finishText(); }
            if (e.key === 'Escape') { e.preventDefault(); setTextEdit(null); }
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          placeholder="Texte"
          aria-label="Texte de l’annotation"
        />
      )}
    </>
  );
}
