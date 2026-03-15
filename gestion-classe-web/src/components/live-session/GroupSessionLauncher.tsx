import { useIsMobile } from '../../hooks/useIsMobile';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, step } = useGroupSession();

  console.log('[GroupSessionLauncher] isMobile:', isMobile, 'step:', step);
  if (!isMobile || step !== 'idle') return null;

  return (
    <button
      onClick={startFlow}
      className="w-full p-4 text-left flex items-center gap-4 group active:scale-[0.98] transition-all"
      style={{
        background: 'var(--gradient-success)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
        border: 'none',
      }}
    >
      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
        👥
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-white text-base">Travail de groupe</h3>
        <p className="text-white/70 text-xs mt-0.5">Noter un TP ou travail collaboratif</p>
      </div>
      <span className="text-white/50 text-2xl group-hover:text-white transition-colors">→</span>
    </button>
  );
}
