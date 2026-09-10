/**
 * Menu contextuel du tableau blanc : clic droit à la souris, appui long au doigt / stylet.
 * Le contenu dépend de ce qui est sous le pointeur (vide, objet, sélection multiple, page) ;
 * c'est le composant appelant qui fournit les entrées, le menu ne fait que les afficher.
 * Lignes hautes (44 px) pour le TBI.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  /** Raccourci affiché à droite (informatif). */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Vrai = simple séparateur (les autres champs sont ignorés). */
  separator?: boolean;
  onSelect?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function BoardContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Le menu reste dans l'écran
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(x, window.innerWidth - r.width - 8);
    const top = Math.min(y, window.innerHeight - r.height - 8);
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y, items]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Différé : le pointerdown qui a ouvert le menu ne doit pas le fermer aussitôt
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown, true);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="wbm" style={{ left: pos.left, top: pos.top }} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it, i) =>
        it.separator ? (
          <div key={`sep-${i}`} className="wbm__sep" />
        ) : (
          <button
            key={`${it.label}-${i}`}
            type="button"
            className={`wbm__item ${it.danger ? 'is-danger' : ''}`}
            disabled={it.disabled}
            onClick={() => { it.onSelect?.(); onClose(); }}
          >
            <span>{it.label}</span>
            {it.shortcut && <kbd>{it.shortcut}</kbd>}
          </button>
        )
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbm {
  position: fixed; z-index: 20; min-width: 240px; max-height: calc(100vh - 16px); overflow-y: auto;
  padding: 6px; border-radius: 14px; background: #111827; color: #F3F4F6;
  box-shadow: 0 16px 48px rgba(0,0,0,0.45); font: 500 15px/1.2 Inter, system-ui, sans-serif;
  user-select: none;
}
.wbm__item {
  display: flex; align-items: center; justify-content: space-between; gap: 18px; width: 100%;
  min-height: 44px; padding: 8px 14px; border: 0; border-radius: 9px; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.wbm__item:hover, .wbm__item:focus-visible { background: #1F2937; outline: none; }
.wbm__item:disabled { opacity: 0.35; cursor: default; }
.wbm__item.is-danger { color: #FCA5A5; }
.wbm__item kbd { font: 500 12px/1 "IBM Plex Mono", ui-monospace, monospace; color: #9CA3AF; }
.wbm__sep { height: 1px; margin: 6px 8px; background: #374151; }
`;
