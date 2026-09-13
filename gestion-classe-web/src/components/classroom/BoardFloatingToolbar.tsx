/**
 * Barre contextuelle flottante : les commandes d'un objet sélectionné se posent **au-dessus de
 * l'objet**, pas dans la barre principale.
 *
 * Avant, la barre de texte et celle des formes s'inséraient dans `.wb__bar` : une vingtaine de
 * boutons apparaissaient au milieu des outils de dessin, sans rien qui distingue « ce qui agit
 * sur ma zone de texte » de « ce qui agit sur le tableau ». D'où une surface différente (fond
 * creusé, liseré accent), un libellé de type, et une flèche qui désigne l'objet concerné.
 *
 * Sans objet accroché (outil texte actif, rien de sélectionné), la barre se pose juste à côté
 * de la barre principale : les réglages par défaut restent accessibles, hors du chemin.
 *
 * Deux libertés laissées à l'enseignant :
 * - `docked` (réglage « barres contextuelles accrochées à la barre principale ») : la barre ne
 *   suit plus l'objet, elle reste collée à la barre principale — rien ne bouge sur la page ;
 * - « Réduire » : la barre se replie en une pastille portant son libellé ; un tap la rouvre.
 *   Le repli est mémorisé par type d'objet (Texte, Forme…) dans le navigateur.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Valeur `data-obj` de l'objet suivi, ou null pour l'ancrage sur la barre principale. */
  objectId: string | null;
  /** Type d'objet, en tête de barre : « Texte », « Forme »… */
  label: string;
  /** Vrai = toujours accrochée à la barre principale, quel que soit l'objet. */
  docked?: boolean;
  children: React.ReactNode;
}

/** Écart entre la barre et l'objet, et marge minimale au bord de l'écran. */
const GAP = 12;
const MARGIN = 8;

const COLLAPSED_KEY = 'classroom-board-float-collapsed';

/** Clé de mémorisation du repli : le type, sans le détail (« Encre · 3 traits » → « Encre »). */
const kindOf = (label: string) => label.split(' · ')[0];

function loadCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') as Record<string, boolean>; } catch { return {}; }
}

interface Pos { left: number; top: number; arrow: number | null }

export function BoardFloatingToolbar({ objectId, label, docked = false, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const lastKey = useRef('');
  const kind = kindOf(label);
  const [collapsedByKind, setCollapsedByKind] = useState<Record<string, boolean>>(loadCollapsed);
  const collapsed = !!collapsedByKind[kind];
  const setCollapsed = (value: boolean) => {
    setCollapsedByKind((prev) => {
      const next = { ...prev, [kind]: value };
      try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

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

      const anchor = objectId && !docked ? document.querySelector(`[data-obj="${objectId}"]`) : null;
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
        // Accrochée à la barre principale : au-dessus quand elle est en bas, à côté quand elle est
        // sur un flanc — toujours du côté de la page, jamais entre la barre et le bord.
        const barEl = document.querySelector('.wb__bar');
        const bar = barEl?.getBoundingClientRect();
        const side = barEl?.classList.contains('wb__bar--left') ? 'left' : barEl?.classList.contains('wb__bar--right') ? 'right' : 'bottom';
        if (bar && side !== 'bottom') {
          left = side === 'left' ? bar.right + GAP : bar.left - GAP - w;
          left = Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN));
          top = Math.max(MARGIN, Math.min(bar.top + bar.height / 2 - h / 2, window.innerHeight - h - MARGIN));
        } else {
          const cx = bar ? bar.left + bar.width / 2 : window.innerWidth / 2;
          left = Math.max(MARGIN, Math.min(cx - w / 2, window.innerWidth - w - MARGIN));
          top = Math.max(MARGIN, (bar ? bar.top : window.innerHeight) - GAP - h);
        }
      }

      const key = `${Math.round(left)}|${Math.round(top)}|${arrow === null ? 'x' : Math.round(arrow)}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        setPos({ left, top, arrow });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [objectId, docked]);

  const style = { left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' } as const;

  if (collapsed) {
    return (
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        type="button"
        className="wbft wbft--collapsed"
        style={style}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setCollapsed(false)}
        title={`Afficher les options « ${label} »`}
      >
        <span className="wbft__label">{label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10l4 4 4-4" /></svg>
        {pos?.arrow != null && <span className="wbft__arrow" style={{ left: pos.arrow }} />}
        <style>{STYLE}</style>
      </button>
    );
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="wbft"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="wbft__label">{label}</span>
      {children}
      <button type="button" className="wb__btn wbft__collapse" onPointerDown={(e) => e.preventDefault()} onClick={() => setCollapsed(true)} title={`Réduire la barre « ${kind} » (un tap sur la pastille la rouvre)`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 14l4-4 4 4" /></svg>
      </button>
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
.wbft--collapsed { flex-wrap: nowrap; min-height: 44px; padding: 0 12px 0 8px; cursor: pointer; color: #93A0B4; }
.wbft--collapsed svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.wbft__collapse svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
`;
