import { Play } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLiveSession } from '../../contexts/LiveSessionContext';

export function LiveSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, restore, step, minimized, selectedClass } = useLiveSession();

  if (!isMobile) return null;

  // Show "resume session" button when session is minimized
  // Direction C : rendu compact (classes rf-launch* dans styles/refonte-accueil.css), même comportement.
  if (step === 'recording' && minimized) {
    return (
      <button type="button" onClick={restore} className="rf-launch rf-launch--resume">
        <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
        <span className="rf-launch__text">
          <span className="rf-launch__title">Reprendre la séance</span>
          {selectedClass?.name && <span className="rf-launch__meta">{selectedClass.name}</span>}
        </span>
        <span className="rf-launch__live">En cours</span>
      </button>
    );
  }

  // Normal start button (only when idle)
  if (step !== 'idle') return null;

  return (
    <button type="button" onClick={startFlow} className="rf-launch rf-launch--primary">
      <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      <span className="rf-launch__title">Démarrer une séance</span>
    </button>
  );
}
