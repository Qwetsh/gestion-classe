import { useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { ClassSelector } from './ClassSelector';
import { RoomSelector } from './RoomSelector';
import { SessionNameInput } from './SessionNameInput';
import { RecordingView } from './RecordingView';

export function LiveSessionOverlay() {
  const isMobile = useIsMobile();
  const { step, minimized } = useLiveSession();

  // Prevent iOS swipe-back gesture and accidental navigation during recording
  useEffect(() => {
    if (step === 'recording' && !minimized) {
      const prevent = (e: TouchEvent) => {
        // Block edge swipes (within 20px of screen edges)
        const touch = e.touches[0];
        if (touch && (touch.clientX < 20 || touch.clientX > window.innerWidth - 20)) {
          e.preventDefault();
        }
      };
      document.addEventListener('touchstart', prevent, { passive: false });
      return () => document.removeEventListener('touchstart', prevent);
    }
  }, [step, minimized]);

  if (!isMobile || step === 'idle') return null;

  // When minimized during recording, don't show overlay
  if (minimized && step === 'recording') return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-[var(--bg)] flex flex-col overflow-hidden"
      style={{
        touchAction: step === 'recording' ? 'none' : 'auto',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {step === 'select-class' && <ClassSelector />}
      {step === 'select-room' && <RoomSelector />}
      {step === 'session-name' && <SessionNameInput />}
      {step === 'recording' && <RecordingView />}
    </div>
  );
}
