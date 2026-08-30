import { Play } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { DB } from './directionB';

export function LiveSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, restore, step, minimized, selectedClass } = useLiveSession();

  if (!isMobile) return null;

  // Show "resume session" button when session is minimized
  if (step === 'recording' && minimized) {
    return (
      <button
        onClick={restore}
        className="w-full p-4 text-left flex items-center gap-4 active:scale-[0.98] transition-all"
        style={{
          background: DB.surface,
          borderRadius: 16,
          border: `1.5px solid ${DB.action}`,
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: DB.action, boxShadow: `0 0 0 6px ${DB.actionSoft}` }}
        >
          <Play size={20} color="#fff" fill="#fff" strokeWidth={0} style={{ marginLeft: 2 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: DB.action }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: DB.action, letterSpacing: '0.05em' }}>
              EN COURS
            </span>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: DB.text, margin: '2px 0 0' }}>
            Reprendre la séance
          </h3>
          <p className="truncate" style={{ fontSize: 13, color: DB.textSecondary, margin: 0 }}>
            {selectedClass?.name}
          </p>
        </div>
      </button>
    );
  }

  // Normal start button (only when idle)
  if (step !== 'idle') return null;

  return (
    <button
      onClick={startFlow}
      className="w-full p-4 text-left flex items-center gap-4 active:scale-[0.98] transition-all"
      style={{
        background: DB.surface,
        borderRadius: 16,
        border: `1px solid ${DB.border}`,
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: DB.action,
          boxShadow: `0 0 0 6px ${DB.actionSoft}, 0 4px 14px rgba(5,150,105,0.25)`,
        }}
      >
        <Play size={20} color="#fff" fill="#fff" strokeWidth={0} style={{ marginLeft: 2 }} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 style={{ fontSize: 16, fontWeight: 600, color: DB.text, margin: 0 }}>
          Démarrer une séance
        </h3>
        <p style={{ fontSize: 13, color: DB.textSecondary, margin: '1px 0 0' }}>
          Suivre la participation en classe
        </p>
      </div>
      <span style={{ color: DB.textTertiary, fontSize: 20 }}>›</span>
    </button>
  );
}
