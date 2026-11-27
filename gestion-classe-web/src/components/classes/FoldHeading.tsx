import type { ReactNode } from 'react';

/** Titre d'un bloc repliable du panneau d'une classe (page Classes) : un clic l'ouvre ou le referme. */
export function FoldHeading({ open, onToggle, title, children }: {
  open: boolean; onToggle: () => void; title?: string; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', minHeight: 32,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-dim)',
        padding: '4px 8px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}
      title={title}
    >
      <span aria-hidden="true" style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▸</span>
      {children}
    </button>
  );
}
