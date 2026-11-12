// Correction animée de l'Hôpital virtuel (Docteur Morel reprend le cas en classe).
// Fermée par défaut ; le prof l'ouvre classe par classe (table activity_class_settings, migration 070).

/** Seuls les patients de l'hôpital (clé `hopital-<id du patient>`) ont une correction animée. */
export function hasAnimatedCorrection(activityKey: string | null | undefined): boolean {
  return !!activityKey && activityKey.startsWith('hopital-');
}

/** Libellé de l'interrupteur, pour une classe donnée (ou aucune). */
export function animatedCorrectionLabel(open: boolean, className: string | null | undefined): string {
  if (!className) return 'Correction animée (Docteur Morel) : choisis une classe';
  return `Correction animée (Docteur Morel) : ${open ? 'ouverte' : 'fermée'} pour la ${className}`;
}

/** Toast de confirmation après un changement. */
export function animatedCorrectionToast(open: boolean, className: string): string {
  return open
    ? `Correction animée ouverte pour la ${className}.`
    : `Correction animée fermée pour la ${className}.`;
}
