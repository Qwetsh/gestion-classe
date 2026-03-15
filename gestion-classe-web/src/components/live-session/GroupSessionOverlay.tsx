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
    <div className="fixed inset-0 z-50 bg-[var(--color-background)] flex flex-col overflow-hidden">
      {step === 'select-class' && <GroupClassSelector />}
      {step === 'setup' && <GroupSetup />}
      {step === 'grading' && <GroupGrading />}
      {step === 'summary' && <GroupSummary />}
    </div>
  );
}
