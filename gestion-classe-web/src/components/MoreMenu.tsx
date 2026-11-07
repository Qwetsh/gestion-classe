import { useEffect, useRef, useState } from 'react';

export interface MoreMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}

/**
 * Menu « ⋯ » : les actions rares, hors de vue tant qu'on ne les cherche pas (sauvegarde,
 * import Pronote, rétention des scans, export pour Claude…). Un bouton, une liste, fermée
 * au clic ailleurs ou sur Échap.
 */
export function MoreMenu({ items, label = '⋯', title, align = 'right', compact, touch }: {
  items: MoreMenuItem[];
  label?: string;
  title?: string;
  align?: 'left' | 'right';
  /** Bouton plus petit, pour une ligne de tableau. */
  compact?: boolean;
  /** Cible tactile de 44 px (en-têtes de page sur téléphone). */
  touch?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-label={title ?? 'Autres actions'}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          padding: compact ? '4px 8px' : touch ? '0 12px' : '7px 12px', borderRadius: touch ? 10 : 8,
          fontSize: compact ? 12 : touch ? 20 : 13, fontWeight: 600, lineHeight: 1,
          minWidth: touch ? 44 : undefined, minHeight: touch ? 44 : undefined,
          cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', [align]: 0, top: '100%', marginTop: 4, minWidth: 230,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: 'var(--shadow-2)', zIndex: 20, padding: 4,
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              title={it.title}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none',
                background: 'none', cursor: it.disabled ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13,
                borderRadius: 6, color: it.danger ? 'var(--neg)' : 'var(--text)', opacity: it.disabled ? 0.5 : 1,
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
