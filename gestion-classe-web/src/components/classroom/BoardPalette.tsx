/**
 * Pastille flottante du tableau blanc : un bouton rond posé sur la scène, qui montre l'outil et
 * la couleur en cours et ouvre le menu radial (`BoardRadialMenu`) autour de lui.
 *
 * Deux gestes, un seul contact, aucun chronomètre :
 *  - tape (appui puis relâchement sans bouger) : le menu s'ouvre ;
 *  - appui puis glissé : la pastille suit le doigt, sa position est mémorisée au relâchement.
 * Fonctionne en émulation souris (TBI mono-contact), au stylet et au doigt.
 */
import { useRef, useState } from 'react';

interface Props {
  /** Position en fraction de la scène (0-1). */
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  /** Ouvre le menu autour du centre de la pastille. */
  onPress: (clientX: number, clientY: number) => void;
  open: boolean;
  icon: string;
  /** Couleur de l'anneau : couleur du stylo, jaune du surligneur… `null` = pas d'anneau. */
  ring: string | null;
  title?: string;
}

/** Au-delà de ce déplacement, l'appui devient un glissé (large : un cadre infrarouge tremble). */
const MOVE_PX = 14;
const MARGIN = 0.04;

export function BoardPalette({ x, y, onMove, onPress, open, icon, ring, title }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ id: number; x0: number; y0: number; dragging: boolean } | null>(null);

  const toFraction = (clientX: number, clientY: number) => {
    const parent = ref.current?.offsetParent as HTMLElement | null;
    if (!parent) return { x, y };
    const r = parent.getBoundingClientRect();
    return {
      x: Math.max(MARGIN, Math.min(1 - MARGIN, (clientX - r.left) / Math.max(1, r.width))),
      y: Math.max(MARGIN, Math.min(1 - MARGIN, (clientY - r.top) / Math.max(1, r.height))),
    };
  };

  const px = drag?.x ?? x;
  const py = drag?.y ?? y;

  return (
    <button
      ref={ref}
      type="button"
      className={`wbpal ${open ? 'is-open' : ''} ${drag ? 'is-drag' : ''}`}
      style={{ left: `${px * 100}%`, top: `${py * 100}%`, ['--wbpal-ring' as string]: ring ?? 'transparent' }}
      title={title ?? 'Outils (taper) — glisser pour déplacer'}
      aria-label="Palette d'outils"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        if (press.current) return;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
        press.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dragging: false };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || e.pointerId !== p.id) return;
        if (!p.dragging) {
          if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) <= MOVE_PX) return;
          p.dragging = true;
        }
        setDrag(toFraction(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        const p = press.current;
        if (!p || e.pointerId !== p.id) return;
        press.current = null;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
        if (p.dragging) {
          const f = toFraction(e.clientX, e.clientY);
          setDrag(null);
          onMove(f.x, f.y);
          return;
        }
        const r = e.currentTarget.getBoundingClientRect();
        onPress(r.left + r.width / 2, r.top + r.height / 2);
      }}
      onPointerCancel={(e) => {
        const p = press.current;
        if (!p || e.pointerId !== p.id) return;
        press.current = null;
        // Contact perdu en plein glissé : on garde la dernière position connue
        if (p.dragging && drag) onMove(drag.x, drag.y);
        setDrag(null);
      }}
    >
      <span className="wbpal__icon">{icon}</span>
      <style>{CSS}</style>
    </button>
  );
}

const CSS = `
.wbpal {
  position: absolute; z-index: 12; width: 60px; height: 60px; margin: -30px 0 0 -30px; padding: 0;
  border: 0; border-radius: 50%; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none;
  background: var(--wb-chrome, #171C24); color: var(--wb-on-chrome, #E7ECF3);
  box-shadow: 0 0 0 4px var(--wbpal-ring), 0 0 0 6px rgba(255,255,255,0.9), var(--wb-e2, 0 14px 30px -14px rgba(0,0,0,.9));
  display: flex; align-items: center; justify-content: center;
  transition: transform var(--wb-t, 140ms) var(--wb-ease, ease), opacity var(--wb-t, 140ms);
}
.wbpal:hover { transform: scale(1.06); }
.wbpal.is-open { opacity: 0; }
.wbpal.is-drag { cursor: grabbing; transform: scale(1.15); box-shadow: 0 0 0 4px var(--wb-select, #4F46E5), 0 0 0 6px rgba(255,255,255,0.9), var(--wb-e3, 0 24px 48px -20px rgba(0,0,0,1)); transition: none; }
.wbpal__icon { font-size: 28px; line-height: 1; pointer-events: none; }
.wb.is-drawing .wbpal { opacity: 0.45; }
@media (max-width: 1366px), (max-height: 800px) {
  .wbpal { width: 52px; height: 52px; margin: -26px 0 0 -26px; }
  .wbpal__icon { font-size: 24px; }
}
`;
