import { type ReactNode, useEffect, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Higher z-index for nested modals */
  zIndex?: number;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  size = 'md',
  zIndex = 50,
}: ModalProps) {
  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`bg-[var(--color-surface)] w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col`}
        style={{ borderRadius: 'var(--radius-2xl)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div
                className="w-10 h-10 flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-lg)' }}
              >
                {icon}
              </div>
            )}
            <h3 id="modal-title" className="text-lg font-semibold text-[var(--color-text)]">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors"
            style={{ borderRadius: 'var(--radius-lg)' }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-[var(--color-border)] shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation modal for delete actions
 */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  details?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'warning';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  details,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isLoading = false,
  variant = 'danger',
}: ConfirmModalProps) {
  const iconBg = variant === 'danger' ? 'var(--color-error-soft)' : 'var(--color-warning-soft)';
  const buttonBg = variant === 'danger' ? 'var(--gradient-error)' : 'var(--gradient-warning)';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={
        <div
          className="w-12 h-12 flex items-center justify-center"
          style={{ background: iconBg, borderRadius: 'var(--radius-lg)' }}
        >
          <span className="text-2xl">{variant === 'danger' ? '🗑️' : '⚠️'}</span>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[var(--color-text-secondary)]">{message}</p>
        {details && (
          <p
            className="text-sm text-[var(--color-text-tertiary)] p-3 bg-[var(--color-surface-secondary)]"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            {details}
          </p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors font-medium"
            style={{ borderRadius: 'var(--radius-lg)' }}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 text-white hover:opacity-90 disabled:opacity-50 transition-all font-medium"
            style={{ background: buttonBg, borderRadius: 'var(--radius-lg)' }}
            disabled={isLoading}
          >
            {isLoading ? 'Chargement...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
