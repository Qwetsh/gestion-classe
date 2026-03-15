import { useIsMobile } from '../../hooks/useIsMobile';
import { useLiveSession } from '../../contexts/LiveSessionContext';

export function LiveSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, restore, step, minimized, selectedClass, startedAt } = useLiveSession();

  if (!isMobile) return null;

  // Show "resume session" button when session is minimized
  if (step === 'recording' && minimized) {
    return (
      <button
        onClick={restore}
        className="w-full p-5 text-left flex items-center gap-4 group active:scale-[0.98] transition-all animate-pulse"
        style={{
          background: 'linear-gradient(135deg, #E91E63 0%, #C62828 100%)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 4px 20px rgba(233, 30, 99, 0.3)',
          border: 'none',
        }}
      >
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
          ⏱
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-white text-lg">Seance en cours</h3>
          <p className="text-white/70 text-sm mt-0.5">
            {selectedClass?.name} — Appuyez pour reprendre
          </p>
        </div>
        <span className="text-white/80 text-2xl">→</span>
      </button>
    );
  }

  // Normal start button (only when idle)
  if (step !== 'idle') return null;

  return (
    <button
      onClick={startFlow}
      className="w-full p-5 text-left flex items-center gap-4 group active:scale-[0.98] transition-all"
      style={{
        background: 'var(--gradient-primary)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-glow)',
        border: 'none',
      }}
    >
      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
        ▶
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-white text-lg">Demarrer une seance</h3>
        <p className="text-white/70 text-sm mt-0.5">Enregistrer les evenements en classe</p>
      </div>
      <span className="text-white/50 text-2xl group-hover:text-white transition-colors">→</span>
    </button>
  );
}
