/**
 * Barre contextuelle flottante : les commandes d'un objet sélectionné se posent **au-dessus de
 * l'objet**, pas dans la barre principale.
 *
 * Avant, la barre de texte et celle des formes s'inséraient dans `.wb__bar` : une vingtaine de
 * boutons apparaissaient au milieu des outils de dessin, sans rien qui distingue « ce qui agit
 * sur ma zone de texte » de « ce qui agit sur le tableau ». D'où une surface différente (fond
 * creusé, liseré accent), un libellé de type, et une flèche qui désigne l'objet concerné.
 *
 * Sans objet accroché (outil texte actif, rien de sélectionné), la barre se pose juste au-dessus
 * de la barre principale : les réglages par défaut restent accessibles, hors du chemin.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Valeur `data-obj` de l'objet suivi, ou null pour l'ancrage sur la barre principale. */
  objectId: string | null;
  /** Type d'objet, en tête de barre : « Texte », « Forme »… */
  label: string;
  children: React.ReactNode;
}

/** Écart entre la barre et l'objet, et marge minimale au bord de l'écran. */
const GAP = 12;
const MARGIN = 8;

interface Pos { left: number; top: number; arrow: number | null }

export function BoardFloatingToolbar({ objectId, label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const lastKey = useRef('');

  // L'objet bouge (glissé, redimensionné), la vue se déplace (zoom, panoramique) et le contenu
  // de la barre change de largeur au fil de la frappe : une boucle d'animation suit tout ça sans
  // qu'on ait à câbler un événement par cause. On ne rend que si la position a bougé d'un pixel.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;

      const anchor = objectId ? document.querySelector(`[data-obj="${objectId}"]`) : null;
      let left: number;
      let top: number;
      let arrow: number | null = null;

      if (anchor) {
        const a = anchor.getBoundingClientRect();
        const cx = a.left + a.width / 2;
        left = Math.max(MARGIN, Math.min(cx - w / 2, window.innerWidth - w - MARGIN));
        const above = a.top - GAP - h;
        // Au-dessus si la place existe, sinon en dessous ; la flèche ne se dessine qu'au-dessus.
        if (above >= MARGIN) {
          top = above;
          arrow = Math.max(18, Math.min(cx - left, w - 18));
        } else {
          top = Math.min(a.bottom + GAP, window.innerHeight - h - MARGIN);
        }
      } else {
        const bar = document.querySelector('.wb__bar')?.getBoundingClientRect();
        const cx = bar ? bar.left + bar.width / 2 : window.innerWidth / 2;
        left = Math.max(MARGIN, Math.min(cx - w / 2, window.innerWidth - w - MARGIN));
        top = Math.max(MARGIN, (bar ? bar.top : window.innerHeight) - GAP - h);
      }

      const key = `${Math.round(left)}|${Math.round(top)}|${arrow === null ? 'x' : Math.round(arrow)}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        setPos({ left, top, arrow });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [objectId]);

  return (
    <div
      ref={ref}
      className="wbft"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="wbft__label">{label}</span>
      {children}
      {pos?.arrow != null && <span className="wbft__arrow" style={{ left: pos.arrow }} />}
      <style>{STYLE}</style>
    </div>
  );
}

/* Structure seulement : l'habillage final vient de wb-theme.css, plus spécifique. */
const STYLE = `
.wbft {
  position: fixed; z-index: 13; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
  padding: 6px; border-radius: 16px;
  background: #1E2530; border: 1px solid #4F46E5; box-shadow: 0 18px 40px rgba(0,0,0,0.5);
  max-width: min(940px, calc(100vw - 24px));
}
.wbft__label { padding: 0 6px 0 4px; color: #93A0B4; font: 700 11px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
.wbft__arrow { position: absolute; bottom: -7px; width: 12px; height: 12px; background: #1E2530; border-right: 1px solid #4F46E5; border-bottom: 1px solid #4F46E5; transform: translateX(-50%) rotate(45deg); }
`;
