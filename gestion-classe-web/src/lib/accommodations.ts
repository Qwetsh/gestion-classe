/**
 * Dispositifs d'accompagnement (PAP / PPRE / PAI).
 *
 * On stocke uniquement SI l'élève en bénéficie (3 booléens sur `students`),
 * jamais le contenu du dispositif (RGPD : aucune donnée de santé / de suivi).
 */

export type AccommodationKey = 'has_pap' | 'has_ppre' | 'has_pai';

export interface StudentAccommodations {
  has_pap?: boolean | null;
  has_ppre?: boolean | null;
  has_pai?: boolean | null;
}

export interface AccommodationDef {
  key: AccommodationKey;
  label: string;
  title: string;
}

export const ACCOMMODATION_DEFS: readonly AccommodationDef[] = [
  { key: 'has_pap', label: 'PAP', title: "Plan d'Accompagnement Personnalisé" },
  { key: 'has_ppre', label: 'PPRE', title: 'Programme Personnalisé de Réussite Éducative' },
  { key: 'has_pai', label: 'PAI', title: "Projet d'Accueil Individualisé" },
];

/** Libellés actifs, dans l'ordre PAP › PPRE › PAI. Vide si aucun dispositif. */
export function accommodationTags(s: StudentAccommodations | null | undefined): string[] {
  if (!s) return [];
  return ACCOMMODATION_DEFS.filter(d => !!s[d.key]).map(d => d.label);
}

export function hasAccommodation(s: StudentAccommodations | null | undefined): boolean {
  return accommodationTags(s).length > 0;
}

/** Texte d'info-bulle : « PAP : Plan d'Accompagnement Personnalisé · PAI : … ». */
export function accommodationTitle(s: StudentAccommodations | null | undefined): string {
  if (!s) return '';
  return ACCOMMODATION_DEFS.filter(d => !!s[d.key])
    .map(d => `${d.label} : ${d.title}`)
    .join(' · ');
}
