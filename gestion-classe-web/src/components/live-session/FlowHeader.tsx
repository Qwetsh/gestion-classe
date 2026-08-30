import { ChevronLeft } from 'lucide-react';
import { DB } from './directionB';

interface FlowHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onCancel?: () => void;
}

/** Header plat Direction B des ecrans de preparation de seance (maquette 2b). */
export function FlowHeader({ title, subtitle, onBack, onCancel }: FlowHeaderProps) {
  return (
    <div
      className="flex items-center shrink-0"
      style={{ padding: '10px 12px', background: DB.background }}
    >
      <button
        onClick={onBack}
        className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
        style={{ border: 'none', background: 'transparent' }}
      >
        <ChevronLeft size={22} color={DB.text} strokeWidth={2} />
      </button>
      <div className="flex-1 text-center min-w-0">
        <h1 className="truncate" style={{ fontSize: 19, fontWeight: 600, color: DB.text, margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p className="truncate" style={{ fontSize: 12, color: DB.textSecondary, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      {onCancel ? (
        <button
          onClick={onCancel}
          style={{
            border: 'none',
            background: 'transparent',
            color: DB.error,
            fontSize: 14,
            fontWeight: 500,
            padding: '8px 4px',
            minWidth: 40,
          }}
        >
          Annuler
        </button>
      ) : (
        <div style={{ width: 40 }} />
      )}
    </div>
  );
}

/** Label de section "1 · CHOISIR UNE CLASSE". */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: DB.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        margin: '0 0 10px',
      }}
    >
      {children}
    </p>
  );
}
