/**
 * Menu radial du tableau blanc : s'ouvre sous les deux doigts posés sur le TBI (ou par le
 * menu). Huit quartiers autour d'un disque central ; on tape un quartier, ou on glisse un
 * doigt dessus et on relâche. Taper le centre ou ailleurs ferme le menu.
 * Même géométrie que le menu radial élève de la PWA (`WebRadialMenu`), en version générique.
 */
import { useEffect, useRef, useState } from 'react';

export interface RadialItem {
  id: string;
  label: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  x: number;
  y: number;
  items: RadialItem[];
  onClose: () => void;
}

const INNER = 44;
const OUTER = 150;
const LABEL_R = 100;
const GAP = (2 * Math.PI) / 180;

function arc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

export function BoardRadialMenu({ x, y, items, onClose }: Props) {
  const [hot, setHot] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const n = Math.max(1, items.length);
  const step = (2 * Math.PI) / n;
  // Le menu reste dans l'écran
  const cx = Math.max(OUTER + 8, Math.min(window.innerWidth - OUTER - 8, x));
  const cy = Math.max(OUTER + 8, Math.min(window.innerHeight - OUTER - 8, y));

  const indexAt = (px: number, py: number): number | null => {
    const dx = px - cx, dy = py - cy;
    const d = Math.hypot(dx, dy);
    if (d < INNER || d > OUTER + 30) return null;
    let a = Math.atan2(dx, -dy);
    if (a < 0) a += 2 * Math.PI;
    return Math.floor(((a + step / 2) % (2 * Math.PI)) / step);
  };

  useEffect(() => {
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = window.setTimeout(() => { window.addEventListener('pointerdown', onDown, true); window.addEventListener('keydown', onKey); }, 50);
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const pick = (i: number | null) => {
    if (i === null) { onClose(); return; }
    const it = items[i];
    if (!it || it.disabled) return;
    it.onSelect();
    onClose();
  };

  return (
    <svg
      ref={ref}
      className="wbr"
      width={OUTER * 2 + 20}
      height={OUTER * 2 + 20}
      style={{ left: cx - OUTER - 10, top: cy - OUTER - 10 }}
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setHot(indexAt(e.clientX, e.clientY)); try { (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); } catch { /* synthétique */ } }}
      onPointerMove={(e) => { if (e.buttons) setHot(indexAt(e.clientX, e.clientY)); }}
      onPointerUp={(e) => { e.stopPropagation(); pick(indexAt(e.clientX, e.clientY)); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) => {
        const a0 = -Math.PI / 2 + i * step - step / 2 + GAP / 2;
        const a1 = a0 + step - GAP;
        const am = (a0 + a1) / 2;
        const lx = OUTER + 10 + LABEL_R * Math.cos(am), ly = OUTER + 10 + LABEL_R * Math.sin(am);
        const on = hot === i;
        return (
          <g key={it.id} className={`wbr__seg ${on ? 'is-hot' : ''} ${it.active ? 'is-active' : ''} ${it.disabled ? 'is-disabled' : ''}`}>
            <path d={arc(OUTER + 10, OUTER + 10, INNER, OUTER, a0, a1)} />
            <text x={lx} y={ly - 10} textAnchor="middle" className="wbr__icon">{it.icon}</text>
            <text x={lx} y={ly + 16} textAnchor="middle" className="wbr__label">{it.label}</text>
          </g>
        );
      })}
      <circle cx={OUTER + 10} cy={OUTER + 10} r={INNER - 6} className="wbr__center" />
      <text x={OUTER + 10} y={OUTER + 16} textAnchor="middle" className="wbr__x">✕</text>
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
.wbr__x { font: 700 18px/1 Inter, system-ui, sans-serif; fill: #374151; pointer-events: none; }
`;
