import { useEffect, useRef } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { DB } from './directionB';

export interface UndoBannerState {
  message: string;
  variant: 'success' | 'error';
  onUndo?: (() => void) | null;
}

interface UndoBannerProps {
  banner: UndoBannerState;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4000;

/**
 * Banniere de confirmation Direction B en haut d'ecran :
 * "✓ {eleve} · +1 Implication — Annuler", auto-dismiss 4 s.
 * Variante 'error' rouge pour les echecs d'enregistrement.
 */
export function UndoBanner({ banner, onDismiss }: UndoBannerProps) {
  // Ref sur onDismiss : le timer ne doit pas etre relance a chaque render du parent
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [banner]);

  const isError = banner.variant === 'error';

  return (
    <div
      className="fixed left-4 right-4 z-[230] flex items-center gap-2"
      style={{
        top: 'calc(8px + env(safe-area-inset-top))',
        background: isError ? DB.error : DB.action,
        borderRadius: 12,
        padding: '11px 16px',
        boxShadow: '0 6px 20px rgba(20, 25, 40, 0.15)',
        animation: 'fadeIn 0.18s ease-out',
      }}
    >
      {isError ? (
        <AlertTriangle size={16} color="#fff" strokeWidth={2.5} />
      ) : (
        <Check size={16} color="#fff" strokeWidth={2.5} />
      )}
      <span
        className="flex-1 truncate"
        style={{ color: '#fff', fontSize: 13.5, fontWeight: 600 }}
      >
        {banner.message}
      </span>
      {!isError && banner.onUndo && (
        <button
          onClick={() => {
            banner.onUndo?.();
            onDismiss();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 700,
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Annuler
        </button>
      )}
    </div>
  );
}
