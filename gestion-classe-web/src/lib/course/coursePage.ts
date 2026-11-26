/**
 * Géométrie de la feuille d'un cours (PLAN_cours_editeur.md § 2), en px CSS à 96 dpi :
 * c'est ce que le navigateur imprime tel quel (794 px = 210 mm).
 *
 * Marges de 1,5 cm (24/11/2026, avant : 2,5 cm) : la colonne de texte fait 18 cm (680,7 px). Les
 * 2,5 cm venaient du mode « En classe », qui projetait la fiche en bande de la largeur de la
 * colonne ; la classe voit maintenant les écrans 16:9 du cours, la bande n'est plus qu'un repli
 * (cours sans écrans) où un texte 12 pt fait ≈ 29 px sur un TBI de 1280 px.
 *
 * Les tableaux écrits pour l'ancienne colonne (largeurs en px dont la somme fait ≈ 605) sont
 * élargis à l'ouverture : voir `fitLegacyTables` (courseTable.ts).
 */

/** Un millimètre en px CSS (96 dpi). */
export const MM = 96 / 25.4;

/** Largeur d'une feuille A4 (210 mm). */
export const PAGE_W = 793.7;
/** Hauteur d'une feuille A4 (297 mm) — non arrondie : l'écart s'accumulerait page après page à l'impression. */
export const PAGE_H = 1122.52;
/**
 * Marges : 1,5 cm de chaque côté (56,5 px = 14,95 mm, et non 56,69). La colonne fait ainsi 680,7 px :
 * un tableau dont les colonnes font 680 px en tout, plus sa bordure (1 px), y tient sans barre de
 * défilement. Avec 680,32 px, il dépassait d'un pixel (l'ancienne colonne de 604,72 px gardait la
 * même réserve pour ses tableaux de 604 px).
 */
export const MARGIN = 56.5;
/** Largeur de la colonne de texte (18 cm). */
export const COL_W = PAGE_W - 2 * MARGIN;
/** Hauteur utile d'une page. */
export const CONTENT_H = PAGE_H - 2 * MARGIN;
/** Espace entre deux feuilles à l'écran (0 à l'impression). */
export const SHEET_GAP = 24;
/** Taille du texte « Normal » : 12 pt. */
export const BASE_FONT_PX = 16;
/** Hauteur d'un écran de classe en unités de colonne (16:9). */
export const SCREEN_H = COL_W * 9 / 16;

/** Colonne de texte des cours écrits avant le 24/11/2026 (marges de 2,5 cm) : 604,72 px. */
export const LEGACY_COL_W = PAGE_W - 2 * 94.49;

/** Tailles de police proposées (pt), comme dans Word. */
export const FONT_SIZES_PT = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];

/** Polices proposées : celle du cours (lisible au TBI) puis des polices présentes partout. */
export const FONT_FAMILIES: { label: string; value: string | null }[] = [
  { label: 'Atkinson Hyperlegible', value: null },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive' },
  // Lot T16a (paquets Fontsource, licence OFL, chargés avec l'éditeur de cours)
  { label: 'OpenDyslexic', value: '"OpenDyslexic", sans-serif' },
  { label: 'Écriture attachée', value: '"Playwrite FR Moderne", cursive' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];
