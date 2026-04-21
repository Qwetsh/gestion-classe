import { useIsMobile } from '../../hooks/useIsMobile';
import { useGroupSession } from '../../contexts/GroupSessionContext';
import { GroupClassSelector } from './GroupClassSelector';
import { GroupSetup } from './GroupSetup';
import { GroupGrading } from './GroupGrading';
import { GroupSummary } from './GroupSummary';

export function GroupSessionOverlay() {
  const isMobile = useIsMobile();
  const { step } = useGroupSession();

  if (!isMobile || step === 'idle') return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {step === 'select-class' && <GroupClassSelector />}
      {step === 'setup' && <GroupSetup />}
      {step === 'grading' && <GroupGrading />}
      {step === 'summary' && <GroupSummary />}
    </div>
  );
}
