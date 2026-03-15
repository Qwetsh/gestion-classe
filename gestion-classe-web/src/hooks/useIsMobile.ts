import { useState, useEffect } from 'react';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  });

  useEffect(() => {
    const check = () => {
      setIsMobile(
        window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
      );
    };

    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
