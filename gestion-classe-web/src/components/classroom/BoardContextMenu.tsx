/**
 * Menu contextuel du tableau blanc : clic droit à la souris, appui long au doigt / stylet.
 * Le contenu dépend de ce qui est sous le pointeur (vide, objet, sélection multiple, page) ;
 * c'est le composant appelant qui fournit les entrées, le menu ne fait que les afficher.
 * Les entrées peuvent porter des sous-menus (`children`), ouverts au survol à la souris, au
 * toucher sur l'entrée (le TBI n'a pas de survol ; un second toucher referme) ou à la flèche
 * droite au clavier. Lignes hautes (44 px) pour le TBI ; le thème (wb-theme.css) resserre.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  /** Raccourci affiché à droite (informatif). */
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  /** Coche affichée à gauche (choix courant dans un sous-menu, ex. le fond de page). */
  checked?: boolean;
  /** Vrai = simple séparateur (les autres champs sont ignorés). */
  separator?: boolean;
  /** Sous-menu : l'entrée l'ouvre au survol ou au toucher, `onSelect` est alors ignoré. */
  children?: MenuItem[];
  onSelect?: () => void;
  /** Pastille de couleur affichée à gauche du libellé (choix de couleur). */
  swatch?: string;
  /** Clic droit sur l'entrée (ex. personnaliser une pastille) ; le menu reste ouvert. */
  onContextMenu?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function BoardContextMenu({ x, y, items, onClose }: Props) {
  // Racine sans boîte propre (display: contents) : elle ne sert qu'à savoir si un clic est
  // dans le menu ou dehors ; chaque liste se positionne et se recadre elle-même.
  const ref = useRef<HTMLDivElement>(null);

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
    <div ref={ref} className="wbm-root" onContextMenu={(e) => e.preventDefault()}>
      <MenuList items={items} left={x} top={y} depth={0} onClose={onClose} />
      <style>{CSS}</style>
    </div>
  );
}

interface ListProps {
  items: MenuItem[];
  left: number;
  top: number;
  depth: number;
  /** Sous-menu : rectangle de l'entrée parente, pour se ranger à sa droite (ou à sa gauche). */
  anchor?: DOMRect;
  /** Sous-menu ouvert au clavier : prend le focus sur sa première entrée. */
  autoFocus?: boolean;
  /** Sous-menu : flèche gauche, on revient à l'entrée parente. */
  onBack?: () => void;
  onClose: () => void;
}

function MenuList({ items, left, top, depth, anchor, autoFocus, onBack, onClose }: ListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left, top });
  const [open, setOpen] = useState<{ index: number; rect: DOMRect; byKeyboard: boolean } | null>(null);
  const closeTimer = useRef<number | null>(null);

  // Menu principal : au point cliqué ; sous-menu : à droite de l'entrée parente, sinon à
  // gauche. Dans les deux cas la liste reste dans l'écran.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let l = left, t = top;
    if (anchor) {
      l = anchor.right + 2;
      if (l + r.width > window.innerWidth - 8) l = anchor.left - r.width - 2;
      t = anchor.top - 6;
    }
    l = Math.max(8, Math.min(l, window.innerWidth - r.width - 8));
    t = Math.max(8, Math.min(t, window.innerHeight - r.height - 8));
    setPos({ left: l, top: t });
  }, [left, top, anchor, items]);

  // Focus clavier : le menu principal prend le focus sur sa liste (les flèches marchent tout
  // de suite, sans voler la première entrée), un sous-menu ouvert au clavier sur sa première entrée.
  useEffect(() => {
    if (autoFocus) firstButton(ref.current)?.focus();
    else if (depth === 0) ref.current?.focus({ preventScroll: true });
  }, [autoFocus, depth]);

  const cancelClose = () => {
    if (closeTimer.current !== null) { window.clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const openSub = (index: number, el: HTMLElement, byKeyboard = false) => {
    cancelClose();
    setOpen((cur) => (cur?.index === index && !byKeyboard ? cur : { index, rect: el.getBoundingClientRect(), byKeyboard }));
  };
  // Survol d'une entrée sans sous-menu : on referme le sous-menu ouvert, avec un court délai
  // pour laisser le pointeur traverser en diagonale vers le sous-menu.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(null), 220);
  };
  useEffect(() => cancelClose, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = ref.current;
    if (!list) return;
    const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>('button.wbm__item:not(:disabled)'));
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => buttons[(i + buttons.length) % buttons.length].focus();
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); e.stopPropagation(); focusAt(current + 1); break;
      case 'ArrowUp': e.preventDefault(); e.stopPropagation(); focusAt(current < 0 ? buttons.length - 1 : current - 1); break;
      case 'Home': e.preventDefault(); e.stopPropagation(); focusAt(0); break;
      case 'End': e.preventDefault(); e.stopPropagation(); focusAt(buttons.length - 1); break;
      case 'ArrowRight': {
        const btn = buttons[current];
        const idx = btn ? Number(btn.dataset.index) : -1;
        if (btn && items[idx]?.children?.length) { e.preventDefault(); e.stopPropagation(); openSub(idx, btn, true); }
        break;
      }
      case 'ArrowLeft':
        if (onBack) { e.preventDefault(); e.stopPropagation(); onBack(); }
        break;
      default: break;
    }
  };

  return (
    <>
      <div
        ref={ref}
        className={`wbm ${depth > 0 ? 'wbm--sub' : ''}`}
        style={{ left: pos.left, top: pos.top }}
        role="menu"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {items.map((it, i) => {
          if (it.separator) return <div key={`sep-${i}`} className="wbm__sep" />;
          const hasSub = !!it.children?.length;
          const isOpen = open?.index === i;
          return (
            <button
              key={`${it.label}-${i}`}
              type="button"
              role="menuitem"
              data-index={i}
              aria-haspopup={hasSub || undefined}
              aria-expanded={hasSub ? isOpen : undefined}
              className={`wbm__item ${it.danger ? 'is-danger' : ''} ${hasSub ? 'has-sub' : ''} ${isOpen ? 'is-open' : ''}`}
              disabled={it.disabled}
              onPointerEnter={(e) => {
                if (e.pointerType !== 'mouse') return;
                if (hasSub && !it.disabled) openSub(i, e.currentTarget);
                else scheduleClose();
              }}
              onClick={(e) => {
                if (hasSub) {
                  // Toucher / clic : un second appui sur l'entrée referme son sous-menu
                  if (isOpen) { cancelClose(); setOpen(null); } else openSub(i, e.currentTarget);
                  return;
                }
                it.onSelect?.();
                onClose();
              }}
              onContextMenu={it.onContextMenu ? (e) => { e.preventDefault(); e.stopPropagation(); it.onContextMenu?.(); } : undefined}
            >
              {it.checked !== undefined && <span className="wbm__check" aria-hidden>{it.checked ? '✓' : ''}</span>}
              {it.swatch && <span className="wbm__swatch" style={{ background: it.swatch }} aria-hidden />}
              <span className="wbm__label">{it.label}</span>
              {it.shortcut && <kbd>{it.shortcut}</kbd>}
              {hasSub && <span className="wbm__arrow" aria-hidden>▸</span>}
            </button>
          );
        })}
      </div>
      {open && items[open.index]?.children && (
        <div onPointerEnter={cancelClose}>
          <MenuList
            items={items[open.index].children!}
            left={pos.left}
            top={pos.top}
            depth={depth + 1}
            anchor={open.rect}
            autoFocus={open.byKeyboard}
            onBack={() => {
              const idx = open.index;
              setOpen(null);
              ref.current?.querySelector<HTMLButtonElement>(`button[data-index="${idx}"]`)?.focus();
            }}
            onClose={onClose}
          />
        </div>
      )}
    </>
  );
}

const firstButton = (list: HTMLElement | null) => list?.querySelector<HTMLButtonElement>('button.wbm__item:not(:disabled)') ?? null;

const CSS = `
.wbm-root { display: contents; }
.wbm {
  position: fixed; z-index: 20; min-width: var(--wb-menu-w, 240px); max-height: calc(100vh - 16px); overflow-y: auto;
  padding: var(--wb-panel-pad, 6px); border-radius: 14px; background: #111827; color: #F3F4F6;
  box-shadow: 0 16px 48px rgba(0,0,0,0.45); font: 500 15px/1.2 Inter, system-ui, sans-serif;
  user-select: none; outline: none;
}
.wbm--sub { z-index: 21; }
.wbm__item {
  display: flex; align-items: center; gap: 12px; width: 100%;
  min-height: var(--wb-menu-h, 44px); padding: var(--wb-menu-pad, 8px 14px); border: 0; border-radius: 9px; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.wbm__item:hover, .wbm__item:focus-visible, .wbm__item.is-open { background: #1F2937; outline: none; }
.wbm__item:focus-visible { box-shadow: inset 0 0 0 2px #6366F1; }
.wbm__item:disabled { opacity: 0.35; cursor: default; }
.wbm__item.is-danger { color: #FCA5A5; }
.wbm__label { flex: 1; }
.wbm__check { width: 16px; flex: none; color: #A5B4FC; font-weight: 700; }
.wbm__swatch { width: 22px; height: 22px; flex: none; border-radius: 50%; border: 2px solid #4B5563; }
.wbm__arrow { flex: none; margin-left: 6px; color: #9CA3AF; }
.wbm__item kbd { font: 500 12px/1 "IBM Plex Mono", ui-monospace, monospace; color: #9CA3AF; }
.wbm__sep { height: 1px; margin: 6px 8px; background: #374151; }
`;
