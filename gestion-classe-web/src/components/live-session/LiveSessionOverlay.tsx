import { useIsMobile } from '../../hooks/useIsMobile';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { ClassSelector } from './ClassSelector';
import { RoomSelector } from './RoomSelector';
import { SeatingPlanPreview } from './SeatingPlanPreview';
import { RecordingView } from './RecordingView';

export function LiveSessionOverlay() {
  const isMobile = useIsMobile();
  const { step, minimized } = useLiveSession();

  if (!isMobile || step === 'idle') return null;

  // When minimized during recording, don't show overlay
  if (minimized && step === 'recording') return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--color-background)] flex flex-col overflow-hidden"
      style={{ touchAction: step === 'recording' ? 'none' : 'auto' }}
    >
      {step === 'select-class' && <ClassSelector />}
      {step === 'select-room' && <RoomSelector />}
      {step === 'seating-preview' && <SeatingPlanPreview />}
      {step === 'recording' && <RecordingView />}
    </div>
  );
}
