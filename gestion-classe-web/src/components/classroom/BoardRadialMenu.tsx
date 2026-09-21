/**
 * Menu radial du tableau blanc : s'ouvre autour de la pastille flottante (`BoardPalette`).
 * Huit quartiers autour d'un disque central ; on tape un quartier, ou on appuie puis on glisse
 * dessus et on relâche. Taper le centre ou ailleurs ferme le menu ; glisser le disque central
 * déplace la pastille (et le menu avec elle). Même géométrie que le menu radial élève de la PWA (`WebRadialMenu`),
 * mise à l'échelle de l'écran : un TBI en 1280×720 a un menu plus compact qu'un écran 4K.
 */
import { useEffect, useRef, useState } from 'react';
import { radialArc } from '../../lib/boardRadialPalette';

export interface RadialItem {
  id: string;
  label: string;
  icon: string;
  /** Un disque de cette couleur remplace l'icône (quartiers « couleur »). */
  swatch?: string;
  active?: boolean;
  disabled?: boolean;
  /** L'action remplace le contenu du menu (sous-menu) : on ne ferme pas. */
  keepOpen?: boolean;
  onSelect: () => void;
  /** Clic droit sur le quartier (ex. personnaliser une couleur) ; le menu reste ouvert. */
  onContextMenu?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: RadialItem[];
  onClose: () => void;
  /** Le disque central est glissé : nouvelle position (écran) demandée pour la pastille et le menu. */
  onDragCenter?: (clientX: number, clientY: number) => void;
  /** Zone où le menu doit tenir en entier (la scène, moins la barre d'outils) ; défaut : la fenêtre. */
  bounds?: { left: number; top: number; right: number; bottom: number };
}

/** Géométrie de référence (écran ≥ 1080 px de haut), réduite jusqu'à ×0,68 sur les petits écrans. */
const BASE = { inner: 58, outer: 214, label: 148 };
const GAP = (2 * Math.PI) / 180;

function radialScale(): number {
  const dim = Math.min(window.innerWidth, window.innerHeight);
  return Math.max(0.68, Math.min(1, dim / 1080));
}


export function BoardRadialMenu({ x, y, items, onClose, onDragCenter, bounds }: Props) {
  const [hot, setHot] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  /** Appui parti du disque central : devient un déplacement au-delà de 12 px. */
  const centerPress = useRef<{ id: number; x0: number; y0: number; moved: boolean } | null>(null);
  const s = radialScale();
  const INNER = Math.round(BASE.inner * s);
  const OUTER = Math.round(BASE.outer * s);
  const LABEL_R = Math.round(BASE.label * s);
  const n = Math.max(1, items.length);
  const step = (2 * Math.PI) / n;
  // Le menu reste entier dans sa zone (au pire, il s'écarte un peu de la pastille)
  const b = bounds ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const cx = Math.max(b.left + OUTER + 8, Math.min(b.right - OUTER - 8, x));
  const cy = Math.max(b.top + OUTER + 8, Math.min(b.bottom - OUTER - 8, y));

  const indexAt = (px: number, py: number): number | null => {
    const dx = px - cx, dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d < INNER || d > OUTER + 30) return null;
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += 2 * Math.PI;
    return Math.floor(((a + step / 2) % (2 * Math.PI)) / step);
  };

  const pick = (i: number | null) => {
    if (i === null) { onClose(); return; }
    const it = items[i];
    if (!it || it.disabled) return;
    it.onSelect();
    if (!it.keepOpen) onClose();
    else setHot(null);
  };

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = window.setTimeout(() => { window.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey); }, 50);
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const c = OUTER + 10;
  return (
    <svg
      ref={ref}
      className="wbr"
      width={OUTER * 2 + 20}
      height={OUTER * 2 + 20}
      style={{ left: cx - OUTER - 10, top: cy - OUTER - 10 }}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button === 2) return; // clic droit : géré par onContextMenu du quartier
        try { (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); } catch { /* synthétique */ }
        if (onDragCenter && Math.hypot(e.clientX - cx, e.clientY - cy) < INNER) centerPress.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
        setHot(indexAt(e.clientX, e.clientY));
      }}
      onPointerMove={(e) => {
        const cp = centerPress.current;
        if (cp && e.pointerId === cp.id) {
          if (!cp.moved && Math.hypot(e.clientX - cp.x0, e.clientY - cp.y0) <= 12) return;
          cp.moved = true;
          onDragCenter?.(e.clientX, e.clientY);
          return;
        }
        if (e.buttons) setHot(indexAt(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        if (e.button === 2) return;
        const cp = centerPress.current;
        centerPress.current = null;
        if (cp && cp.moved) return; // fin du déplacement : le menu reste ouvert, au nouvel endroit
        pick(indexAt(e.clientX, e.clientY));
      }}
      onPointerCancel={() => { centerPress.current = null; }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        const a0 = -Math.PI / 2 + i * step - step / 2 + GAP / 2;
        const a1 = a0 + step - GAP;
        const am = (a0 + a1) / 2;
        const lx = c + LABEL_R * Math.cos(am), ly = c + LABEL_R * Math.sin(am);
        const on = hot === i;
        return (
          <g
            key={`${it.id}-${i}`}
            className={`wbr__seg ${on ? 'is-hot' : ''} ${it.active ? 'is-active' : ''} ${it.disabled ? 'is-disabled' : ''}`}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!it.disabled) it.onContextMenu?.(); }}
          >
            <path d={radialArc(c, c, INNER, OUTER, a0, a1)} />
            {it.swatch
              ? <circle cx={lx} cy={ly - 16 * s} r={13 * s} fill={it.swatch} stroke="#FFFFFF" strokeWidth={2.5} pointerEvents="none" />
              : <text x={lx} y={ly - 16 * s} textAnchor="middle" className="wbr__icon" style={{ fontSize: 30 * s }}>{it.icon}</text>}
            <text x={lx} y={ly + 24 * s} textAnchor="middle" className="wbr__label" style={{ fontSize: 17 * s }}>{it.label}</text>
          </g>
        );
      })}
      <circle cx={c} cy={c} r={INNER - 6} className={`wbr__center ${onDragCenter ? 'is-grab' : ''}`} />
      <text x={c} y={c + 8 * s} textAnchor="middle" className="wbr__x" style={{ fontSize: 24 * s }}>✕</text>
      <style>{CSS}</style>
    </svg>
  );
}

const CSS = `
.wbr { position: fixed; z-index: 25; overflow: visible; touch-action: none; user-select: none; filter: drop-shadow(0 12px 30px rgba(0,0,0,0.45)); }
.wbr__seg path { fill: #111827; stroke: #1F2937; stroke-width: 2; cursor: pointer; }
.wbr__seg.is-active path { fill: #312E81; }
.wbr__seg.is-hot path { fill: #4F46E5; }
.wbr__seg.is-disabled { opacity: 0.35; }
.wbr__icon { font-size: 26px; fill: #F9FAFB; pointer-events: none; }
.wbr__label { font: 600 12px/1 Inter, system-ui, sans-serif; fill: #E5E7EB; pointer-events: none; }
.wbr__center { fill: #FFFFFF; }
.wbr__center.is-grab { cursor: grab; }
.wbr__x { font: 700 18px/1 Inter, system-ui, sans-serif; fill: #374151; pointer-events: none; }
`;
