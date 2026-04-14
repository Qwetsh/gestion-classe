import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  TOAST                                                             */
/* ------------------------------------------------------------------ */
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  warning: '\u26A0',
  info: '\u2139',
};

const TOAST_COLORS: Record<ToastType, { bg: string; text: string; border: string }> = {
  success: { bg: 'var(--color-success-soft)', text: 'var(--color-success)', border: 'var(--color-success)' },
  error: { bg: 'var(--color-error-soft)', text: 'var(--color-error)', border: 'var(--color-error)' },
  warning: { bg: 'rgba(255,152,0,0.12)', text: 'var(--color-warning)', border: 'var(--color-warning)' },
  info: { bg: 'var(--color-primary-soft)', text: 'var(--color-primary)', border: 'var(--color-primary)' },
};

/* ------------------------------------------------------------------ */
/*  CONFIRM DIALOG                                                    */
/* ------------------------------------------------------------------ */
interface ConfirmOptions {
  title: string;
  message: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  CONTEXT                                                           */
/* ------------------------------------------------------------------ */
interface UIFeedbackContextValue {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const UIFeedbackContext = createContext<UIFeedbackContextValue | null>(null);

export function useUIFeedback() {
  const ctx = useContext(UIFeedbackContext);
  if (!ctx) throw new Error('useUIFeedback must be used within UIFeedbackProvider');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  PROVIDER                                                          */
/* ------------------------------------------------------------------ */
let toastId = 0;

export function UIFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const confirmResolveRef = useRef<((v: boolean) => void) | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const handleConfirmResult = useCallback((result: boolean) => {
    confirmResolveRef.current?.(result);
    confirmResolveRef.current = null;
    setConfirmState(null);
  }, []);

  return (
    <UIFeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ---- Toast stack ---- */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 right-4 flex flex-col gap-2"
          style={{ zIndex: 9999 }}
        >
          {toasts.map((t) => {
            const colors = TOAST_COLORS[t.type];
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3 min-w-[280px] max-w-[420px] border-l-4 animate-[slideIn_0.25s_ease-out]"
                style={{
                  background: colors.bg,
                  borderLeftColor: colors.border,
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)',
                  backdropFilter: 'blur(8px)',
                }}
                role="alert"
              >
                <span
                  className="text-lg font-bold shrink-0 w-6 h-6 flex items-center justify-center rounded-full"
                  style={{ color: colors.text }}
                >
                  {TOAST_ICONS[t.type]}
                </span>
                <span className="text-sm font-medium flex-1" style={{ color: colors.text }}>
                  {t.message}
                </span>
                <button
                  onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                  className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  style={{ color: colors.text }}
                  aria-label="Fermer"
                >
                  \u2715
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Confirm dialog ---- */}
      {confirmState && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          style={{ zIndex: 9998 }}
          onClick={() => handleConfirmResult(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[var(--color-surface)] w-full max-w-md overflow-hidden"
            style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div
                className="w-14 h-14 mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: confirmState.variant === 'warning'
                    ? 'rgba(255,152,0,0.12)'
                    : 'var(--color-error-soft)',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                <span className="text-2xl">
                  {confirmState.variant === 'warning' ? '\u26A0\uFE0F' : '\uD83D\uDDD1\uFE0F'}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                {confirmState.title}
              </h3>
              <p className="text-[var(--color-text-secondary)] mt-2 text-sm whitespace-pre-line">
                {confirmState.message}
              </p>
              {confirmState.details && (
                <p
                  className="text-xs text-[var(--color-text-tertiary)] mt-3 p-3 bg-[var(--color-surface-secondary)] text-left"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  {confirmState.details}
                </p>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => handleConfirmResult(false)}
                className="flex-1 px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                {confirmState.cancelLabel || 'Annuler'}
              </button>
              <button
                onClick={() => handleConfirmResult(true)}
                className="flex-1 px-4 py-2.5 text-white hover:opacity-90 transition-all font-medium"
                style={{
                  background: confirmState.variant === 'warning'
                    ? 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)'
                    : 'var(--gradient-error)',
                  borderRadius: 'var(--radius-lg)',
                }}
                autoFocus
              >
                {confirmState.confirmLabel || 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIFeedbackContext.Provider>
  );
}
