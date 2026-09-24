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

/**
 * Vrai quand la fenêtre est étroite (téléphone), écran tactile ou non —
 * contrairement à useIsMobile qui exige le tactile (menu radial des séances).
 * Sert aux mises en page qui doivent passer en une colonne dans une fenêtre PC rétrécie.
 */
export function useIsNarrowViewport(maxWidth = 767): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsNarrow(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isNarrow;
}
