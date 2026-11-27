import { useEffect, useState } from 'react';
import { canUseAiCorrection } from '../lib/aiCorrectionAccess';

/** Une seule question à la base par session : la réponse ne change pas en cours de route. */
let pending: Promise<boolean> | null = null;

/**
 * « Corriger avec Claude » n'est proposé qu'aux comptes autorisés (correction payée par la clé
 * du propriétaire de l'application). Caché tant que la réponse n'est pas arrivée.
 */
export function useAiCorrectionAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let alive = true;
    pending ??= canUseAiCorrection();
    void pending.then((ok) => { if (alive) setAllowed(ok); });
    return () => { alive = false; };
  }, []);
  return allowed;
}
