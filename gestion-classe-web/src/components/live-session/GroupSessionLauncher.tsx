import { Users, Castle, Play } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useGroupSession } from '../../contexts/GroupSessionContext';

export function GroupSessionLauncher() {
  const isMobile = useIsMobile();
  const { startFlow, startEpreuveFlow, resumeFlow, step, sessionId, sessionData } = useGroupSession();

  if (!isMobile || step !== 'idle') return null;

  const hasSuspended = !!(sessionId && sessionData);

  // Direction C : boutons ghost compacts côte à côte (classes rf-launch* dans styles/refonte-accueil.css).
  return (
    <div className="rf-launch-group">
      {/* Resume button if session suspended */}
      {hasSuspended && (
        <button type="button" onClick={resumeFlow} className="rf-launch rf-launch--resume rf-launch--resume-warn">
          <Play size={16} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          <span className="rf-launch__text">
            <span className="rf-launch__title">Reprendre la notation</span>
            <span className="rf-launch__meta">{sessionData?.name || 'Session en cours'}</span>
          </span>
        </button>
      )}

      <div className="rf-launch-row">
        <button type="button" onClick={startFlow} className="rf-launch rf-launch--ghost">
          <Users size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="rf-launch__title">Travail de groupe</span>
        </button>
        <button type="button" onClick={startEpreuveFlow} className="rf-launch rf-launch--ghost">
          <Castle size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="rf-launch__title">Épreuve</span>
        </button>
      </div>
    </div>
  );
}
