/**
 * Panneau flottant ancré à un bouton de la barre d'outils (Insérer, Réglages, formes, couleurs).
 *
 * Rendu dans un portail sur `document.body` : la barre d'outils défile horizontalement
 * (`overflow-x: auto`), ce qui coupe aussi verticalement — un panneau rendu à l'intérieur y
 * serait invisible. Le portail s'en affranchit ; la position est calculée depuis le bouton.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** Bouton auquel le panneau est accroché (la ref est lue après le rendu). */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
  /** Largeur du panneau, en px (sert au placement avant mesure). */
  width?: number;
  children: React.ReactNode;
}

const GAP = 10;
const MARGIN = 8;

export function BoardPopover({ anchorRef, onClose, className = '', width = 300, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Placement : au-dessus du bouton si la place existe, sinon en dessous ; borné à l'écran
  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      const anchor = anchorRef.current;
      if (!anchor || !el) return;
      const a = anchor.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const w = r.width || width;
      const h = r.height || 200;
      const above = a.top - GAP - h;
      const top = above >= MARGIN ? above : Math.min(a.bottom + GAP, window.innerHeight - h - MARGIN);
      const left = Math.max(MARGIN, Math.min(a.left, window.innerWidth - w - MARGIN));
      setPos({ left, top: Math.max(MARGIN, top) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, width, children]);

  // Fermeture au clic hors du panneau (et hors du bouton) ou sur Échap
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('keydown', onKey, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={ref}
      className={`wbpop ${className}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width, visibility: pos ? 'visible' : 'hidden' }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      <style>{CSS}</style>
    </div>,
    document.body
  );
}

const CSS = `
.wbpop { position: fixed; z-index: 24; box-sizing: border-box; max-height: calc(100vh - 16px); overflow-y: auto; }
`;
