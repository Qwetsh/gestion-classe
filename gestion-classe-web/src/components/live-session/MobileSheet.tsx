import { useEffect, useState, type ReactNode } from 'react';
import { DB } from './directionB';

interface MobileSheetProps {
  onClose: () => void;
  children: ReactNode;
  /** z-index du backdrop (par defaut au-dessus de l'overlay seance). */
  zIndex?: number;
}

/**
 * Bottom sheet Direction B (maquettes 9a/9b/9c) : sheet blanche radius 20 en
 * haut, poignee 38x4, padding 24, backdrop rgba(15,23,42,.35), slide 250 ms.
 */
export function MobileSheet({ onClose, children, zIndex = 220 }: MobileSheetProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{
        zIndex,
        background: DB.sheetBackdrop,
        opacity: entered ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg"
        style={{
          background: DB.surface,
          borderRadius: '20px 20px 0 0',
          padding: '10px 24px 24px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          maxHeight: '88vh',
          overflowY: 'auto',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 2,
            background: DB.border,
            margin: '0 auto 16px',
          }}
        />
        {children}
      </div>
    </div>
  );
}

/** Titre standard de sheet. */
export function SheetTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1">
      <h3 style={{ fontSize: 18, fontWeight: 700, color: DB.text, margin: 0 }}>{children}</h3>
      {right}
    </div>
  );
}

/** Bouton plein (indigo par defaut, vert avec color=DB.action). */
export function SheetButton({
  children,
  onClick,
  disabled,
  color = DB.primary,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 active:scale-[0.98] transition-transform"
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        border: 'none',
        background: disabled ? DB.segmentTrack : color,
        color: disabled ? DB.textTertiary : '#FFFFFF',
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}

/** Bouton secondaire bordé. */
export function SheetGhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 active:scale-[0.98] transition-transform"
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${DB.border}`,
        background: DB.surface,
        color: DB.text,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}
