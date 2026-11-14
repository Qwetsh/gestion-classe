/**
 * Pastille flottante du tableau blanc : un bouton rond posé sur la scène, qui montre l'outil et
 * la couleur en cours et ouvre le menu radial (`BoardRadialMenu`) autour de lui.
 *
 * Deux gestes, un seul contact, aucun chronomètre :
 *  - tape (appui puis relâchement sans bouger) : le menu s'ouvre ;
 *  - appui puis glissé : la pastille suit le doigt, sa position est mémorisée au relâchement.
 * Au clic droit (souris ou stylet avec bouton), la personnalisation du menu s'ouvre directement.
 * Fonctionne en émulation souris (TBI mono-contact), au stylet et au doigt.
 */
import { useRef, useState, type ReactNode } from 'react';

interface Props {
  /** Position en fraction de la scène (0-1). */
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  /** Ouvre le menu autour du centre de la pastille. */
  onPress: (clientX: number, clientY: number) => void;
  /** Clic droit : ouvre le paramétrage du menu (éditeur de palette). */
  onSettings?: () => void;
  open: boolean;
  /** Outil en cours : émoji (habillage tactile) ou icône au trait (ruban). */
  icon: ReactNode;
  /** Couleur en cours : couleur du stylo, jaune du surligneur… `null` = aucune (gomme, sélection). */
  ring: string | null;
  /**
   * Habillage du ruban : disque blanc à bord fin, icône au trait, couleur en cours dans une petite
   * pastille — le même vocabulaire que les boutons du ruban. Sans lui, le disque sombre à anneau
   * de l'habillage tactile.
   */
  flat?: boolean;
  title?: string;
}

/** Au-delà de ce déplacement, l'appui devient un glissé (large : un cadre infrarouge tremble). */
const MOVE_PX = 14;
const MARGIN = 0.04;

export function BoardPalette({ x, y, onMove, onPress, onSettings, open, icon, ring, flat, title }: Props) {
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
      className={`wbpal ${flat ? 'wbpal--flat' : ''} ${open ? 'is-open' : ''} ${drag ? 'is-drag' : ''}`}
      style={{ left: `${px * 100}%`, top: `${py * 100}%`, ['--wbpal-ring' as string]: ring ?? 'transparent' }}
      title={title ?? 'Outils (taper) — glisser pour déplacer — clic droit : personnaliser'}
      aria-label="Palette d'outils"
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSettings?.(); }}
      onPointerDown={(e) => {
        if (e.button !== 0) { e.stopPropagation(); return; }
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
      {flat && ring && <span className="wbpal__color" style={{ background: ring }} aria-hidden />}
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
/* Ruban : surface blanche, bord fin, indigo au survol — comme un bouton du ruban, en rond */
.wbpal.wbpal--flat {
  width: 52px; height: 52px; margin: -26px 0 0 -26px;
  background: #FFFFFF; color: #1F2937; border: 1px solid #D1D5DB;
  box-shadow: 0 1px 2px rgba(15,23,42,.06), 0 6px 16px -6px rgba(15,23,42,.22);
  transition: background var(--wb-t, 140ms), border-color var(--wb-t, 140ms), opacity var(--wb-t, 140ms);
}
.wbpal.wbpal--flat:hover { transform: none; background: #EEF0FF; border-color: #A5B4FC; color: #3730A3; }
.wbpal.wbpal--flat.is-drag { transform: none; background: #EEF0FF; border-color: #4F46E5; box-shadow: 0 0 0 3px rgba(79,70,229,.18), 0 10px 24px -8px rgba(15,23,42,.3); }
.wbpal--flat .wbpal__icon { display: flex; }
.wbpal__color { position: absolute; right: 1px; bottom: 1px; width: 15px; height: 15px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 0 0 1px #D1D5DB; pointer-events: none; }
`;
