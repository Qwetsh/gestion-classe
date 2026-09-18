/**
 * Rail des pages du tableau blanc : page précédente / suivante, compteur, nouvelle page et
 * ouverture du navigateur de vignettes. Îlot flottant posé au bord de la scène, du côté du
 * navigateur ; ce n'est pas un outil de dessin, il ne vit pas dans la barre principale.
 *
 * Il se déplace par sa poignée pointillée (en haut) : appui puis glissé, la position est
 * mémorisée sur l'appareil en fraction de l'écran (`classroom-board-pagerail`). Double-clic ou
 * double-tap sur la poignée : retour à la place d'origine, au bord. Utile quand il tombe sur le
 * rail de défilement d'une page allongée, ou sous la main qui écrit.
 */
import { useRef, useState } from 'react';

const STORAGE_KEY = 'classroom-board-pagerail';
/** Marge minimale au bord (fraction de l'écran) : le rail reste saisissable. */
const MARGIN = 0.02;
/** Deux appuis sur la poignée à moins de cet intervalle = remise en place. */
const DOUBLE_TAP_MS = 350;

/** Centre du rail, en fraction de l'écran (0-1). `null` = position d'origine, au bord. */
interface RailPos { cx: number; cy: number }

function loadPos(): RailPos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RailPos>;
    return typeof p.cx === 'number' && typeof p.cy === 'number' ? { cx: p.cx, cy: p.cy } : null;
  } catch { return null; }
}

function savePos(pos: RailPos | null) {
  try {
    if (pos) localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* stockage indisponible */ }
}

interface Props {
  side: 'left' | 'right';
  /** Navigateur de vignettes ouvert : le rail s'en écarte (position d'origine seulement). */
  navOpen: boolean;
  navWidth: number;
  pageIndex: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
  onAdd: () => void;
  onToggleNav: () => void;
}

export function BoardPageRail({ side, navOpen, navWidth, pageIndex, pageCount, onPrev, onNext, onAdd, onToggleNav }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<RailPos | null>(loadPos);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; dx: number; dy: number; moved: boolean } | null>(null);
  const lastTap = useRef(0);

  /** Centre visé par le pointeur, borné pour que le rail reste entièrement à l'écran. */
  const toPos = (clientX: number, clientY: number, dx: number, dy: number): RailPos => {
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    const r = ref.current?.getBoundingClientRect();
    const halfW = (r?.width ?? 48) / 2 / w, halfH = (r?.height ?? 200) / 2 / h;
    return {
      cx: Math.max(MARGIN + halfW, Math.min(1 - MARGIN - halfW, (clientX - dx) / w)),
      cy: Math.max(MARGIN + halfH, Math.min(1 - MARGIN - halfH, (clientY - dy) / h)),
    };
  };

  const style = pos
    ? { left: `${pos.cx * 100}%`, top: `${pos.cy * 100}%`, right: 'auto', transform: 'translate(-50%, -50%)' }
    : side === 'right' && navOpen ? { right: navWidth + 20 } : undefined;

  return (
    <div ref={ref} className={`wb__pagerail wb__pagerail--${side} ${pos ? 'is-floating' : ''} ${dragging ? 'is-drag' : ''}`} style={style} onPointerDown={(e) => e.stopPropagation()}>
      <div
        className="wb__grip"
        title="Glisser pour déplacer · double-clic : remettre au bord"
        aria-label="Déplacer le rail des pages"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          if (drag.current) return;
          const r = ref.current?.getBoundingClientRect();
          const cx = r ? r.left + r.width / 2 : e.clientX, cy = r ? r.top + r.height / 2 : e.clientY;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
          drag.current = { id: e.pointerId, dx: e.clientX - cx, dy: e.clientY - cy, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || e.pointerId !== d.id) return;
          if (!d.moved) { d.moved = true; setDragging(true); }
          setPos(toPos(e.clientX, e.clientY, d.dx, d.dy));
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d || e.pointerId !== d.id) return;
          drag.current = null;
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
          setDragging(false);
          if (d.moved) {
            const p = toPos(e.clientX, e.clientY, d.dx, d.dy);
            setPos(p);
            savePos(p);
            return;
          }
          // Appui sans déplacement : un second dans la foulée remet le rail au bord
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) { setPos(null); savePos(null); lastTap.current = 0; }
          else lastTap.current = now;
        }}
        onPointerCancel={(e) => {
          const d = drag.current;
          if (!d || e.pointerId !== d.id) return;
          drag.current = null;
          setDragging(false);
          if (d.moved && pos) savePos(pos);
        }}
      />
      <button className="wb__btn" onClick={onPrev} disabled={pageIndex === 0} title="Page précédente">
        <svg viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" /></svg>
      </button>
      <span className="wb__pages">{pageIndex + 1}/{pageCount}</span>
      <button className="wb__btn" onClick={onNext} disabled={pageIndex >= pageCount - 1} title="Page suivante">
        <svg viewBox="0 0 24 24"><path d="M5 9l7 7 7-7" /></svg>
      </button>
      {/* Nouvelle page toujours à portée, même navigateur fermé (il l'est par défaut en 720p) */}
      <button className="wb__btn wb__btn--add" onClick={onAdd} title="Nouvelle page (Ctrl+Entrée)">
        <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button className={`wb__btn ${navOpen ? 'is-on' : ''}`} onClick={onToggleNav} title="Navigateur de pages (N)">
        <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM14 5v14M16 9h2M16 12h2M16 15h2" /></svg>
      </button>
    </div>
  );
}
