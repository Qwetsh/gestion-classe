import { useState } from 'react';
import { readTabChoices, saveTabChoices } from '../lib/tabChoice';

/**
 * Onglet choisi dans une liste rangée, gardé sur l'appareil. `scope` distingue les listes qui
 * partagent la même clé de stockage (bibliothèque et fiches méthode, matière et rangement des annales).
 */
export function useTabChoice(storageKey: string, scope: string): [string | undefined, (key: string) => void] {
  const [choices, setChoices] = useState(() => readTabChoices(storageKey));
  const pick = (key: string) => {
    setChoices((prev) => {
      const next = { ...prev, [scope]: key };
      saveTabChoices(storageKey, next);
      return next;
    });
  };
  return [choices[scope], pick];
}
