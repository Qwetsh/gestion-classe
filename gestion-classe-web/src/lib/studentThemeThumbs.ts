/**
 * Vignettes des thèmes de l'espace élève : une petite image du vrai décor de chaque thème
 * (`src/themes-eleve/<id>/vignette.webp`, 360 × 222), montrée dans l'écran « Mon thème ».
 *
 * À part de lib/studentThemes.ts pour que ces images ne soient chargées qu'avec cet écran.
 * Refaire une vignette quand le décor d'un thème change (capture du haut de l'accueil élève,
 * contenu masqué, 390 × 240 points ; Carnet, sans décor, montre ses cartes).
 */
import type { StudentThemeId } from './studentThemes';

const files = import.meta.glob<string>('../themes-eleve/*/vignette.webp', { eager: true, query: '?url', import: 'default' });

const byTheme = new Map<string, string>(
  Object.entries(files).map(([path, url]) => [path.split('/').slice(-2)[0], url]),
);

/** Adresse de la vignette d'un thème ; null s'il n'en a pas (l'écran montre alors sa couleur de fond). */
export const studentThemeThumb = (id: StudentThemeId): string | null => byTheme.get(id) ?? null;
