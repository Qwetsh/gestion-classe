import { useState, useEffect } from 'react';

function checkIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  // Consider mobile if touch device AND either narrow viewport OR standalone PWA
  const isNarrow = window.innerWidth <= 1024;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return hasTouch && (isNarrow || isStandalone);
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    const check = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
