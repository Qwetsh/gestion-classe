import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MoreMenuItem } from './MoreMenu';

/**
 * Menu du clic droit (ou de l'appui long au doigt) : les mêmes actions que le menu « ⋯ », posées là
 * où l'on a cliqué. Fermé au clic ailleurs, sur Échap, au défilement ou au redimensionnement.
 * Il reste entièrement dans la fenêtre (décalé vers la gauche ou le haut près d'un bord).
 */
export function ContextMenu({ x, y, title, items, onClose }: {
  x: number;
  y: number;
  /** Intitulé en tête du menu (le nom du document visé). */
  title?: string;
  items: MoreMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const close = () => onClose();
    // Écoute posée après coup : le clic droit qui ouvre le menu remonte encore jusqu'au document
    const armed = window.setTimeout(() => {
      document.addEventListener('mousedown', away);
      document.addEventListener('touchstart', away);
      document.addEventListener('contextmenu', away);
    }, 0);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.clearTimeout(armed);
      document.removeEventListener('mousedown', away);
      document.removeEventListener('touchstart', away);
      document.removeEventListener('contextmenu', away);
      document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [onClose]);

  useEffect(() => { ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus(); }, []);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={title}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, minWidth: 240, maxWidth: 'min(340px, calc(100vw - 16px))',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        boxShadow: 'var(--shadow-2)', zIndex: 1200, padding: 4,
      }}
    >
      {title && (
        <div role="presentation" style={{ padding: '6px 10px 4px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
      )}
      {items.map((it, i) => (
        <Fragment key={`${it.group ?? ''}|${it.label}`}>
          {(i > 0 || title) && it.group !== items[i - 1]?.group && (
            <div role="separator" style={{ margin: '4px 6px', borderTop: '1px solid var(--border)' }} />
          )}
          <button
            type="button"
            role="menuitem"
            disabled={it.disabled}
            title={it.title}
            onClick={() => { onClose(); it.onClick(); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6,
              border: 0, background: 'transparent', cursor: it.disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13,
              color: it.danger ? 'var(--danger, #B91C1C)' : 'var(--text)', opacity: it.disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = 'var(--surface-2, #F3F4F6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onFocus={(e) => { e.currentTarget.style.background = 'var(--surface-2, #F3F4F6)'; }}
            onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {it.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
