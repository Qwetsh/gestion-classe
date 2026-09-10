/**
 * Projecteur : tout est assombri sauf un disque qu'on déplace au doigt ou à la souris
 * (l'inverse du rideau). Molette ou boutons pour la taille.
 */
import { useRef, useState } from 'react';

interface Props {
  onClose: () => void;
}

export function BoardSpotlight({ onClose }: Props) {
  const [pos, setPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [radius, setRadius] = useState(Math.min(window.innerWidth, window.innerHeight) * 0.18);
  const dragging = useRef<number | null>(null);

  return (
    <div
      className="wbsp"
      style={{ background: `radial-gradient(circle at ${pos.x}px ${pos.y}px, transparent ${radius}px, rgba(0,0,0,0.86) ${radius + 3}px)` }}
      onPointerDown={(e) => { e.preventDefault(); dragging.current = e.pointerId; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* synthétique */ } setPos({ x: e.clientX, y: e.clientY }); }}
      onPointerMove={(e) => { if (dragging.current === e.pointerId) setPos({ x: e.clientX, y: e.clientY }); }}
      onPointerUp={() => { dragging.current = null; }}
      onPointerCancel={() => { dragging.current = null; }}
      onWheel={(e) => { e.preventDefault(); setRadius((r) => Math.max(40, Math.min(600, r - e.deltaY * 0.3))); }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="wbsp__bar" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setRadius((r) => Math.max(40, r - 40))} title="Réduire">−</button>
        <button type="button" onClick={() => setRadius((r) => Math.min(600, r + 40))} title="Agrandir">+</button>
        <button type="button" onClick={onClose} title="Fermer le projecteur (Échap)">Fermer</button>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbsp { position: fixed; inset: 0; z-index: 14; cursor: move; touch-action: none; user-select: none; }
.wbsp__bar { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); display: flex; gap: 8px; }
.wbsp__bar button { height: 42px; min-width: 42px; padding: 0 14px; border: 0; border-radius: 11px; background: #111827; color: #F9FAFB; font: 600 16px/1 Inter, system-ui, sans-serif; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
`;
