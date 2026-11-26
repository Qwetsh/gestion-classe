import { useState } from 'react';

/** Les trois vues de la page « Suivi élèves » ; « bulletin » : appréciations du trimestre, modifiables sur place. */
export type StudentsLayout = 'grid' | 'list' | 'bulletin';

const STORAGE_KEY = 'gc-students-layout';

/** La vue choisie, gardée sur l'appareil d'une visite à l'autre (liste par défaut). */
export function useStudentsLayout(): [StudentsLayout, (next: StudentsLayout) => void] {
  const [layout, setLayoutState] = useState<StudentsLayout>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'grid' || saved === 'bulletin' ? saved : 'list';
    } catch { return 'list'; }
  });
  const setLayout = (next: StudentsLayout) => {
    setLayoutState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* stockage indisponible */ }
  };
  return [layout, setLayout];
}
