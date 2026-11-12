/**
 * Géométrie de la feuille d'un cours (PLAN_cours_editeur.md § 2), en px CSS à 96 dpi :
 * c'est ce que le navigateur imprime tel quel (794 px = 210 mm).
 *
 * La colonne de texte (16 cm) est aussi la largeur de la bande projetée en classe : un texte
 * 12 pt (16 px) y fait ≈ 34 px sur un TBI de 1280 px, et un bloc 16:9 de la largeur de colonne
 * (605 × 340) remplit exactement un écran.
 */

/** Un millimètre en px CSS (96 dpi). */
export const MM = 96 / 25.4;

/** Largeur d'une feuille A4 (210 mm). */
export const PAGE_W = 793.7;
/** Hauteur d'une feuille A4 (297 mm) — non arrondie : l'écart s'accumulerait page après page à l'impression. */
export const PAGE_H = 1122.52;
/** Marges : 2,5 cm de chaque côté. */
export const MARGIN = 94.49;
/** Largeur de la colonne de texte (16 cm environ). */
export const COL_W = PAGE_W - 2 * MARGIN;
/** Hauteur utile d'une page. */
export const CONTENT_H = PAGE_H - 2 * MARGIN;
/** Espace entre deux feuilles à l'écran (0 à l'impression). */
export const SHEET_GAP = 24;
/** Taille du texte « Normal » : 12 pt. */
export const BASE_FONT_PX = 16;
/** Hauteur d'un écran de classe en unités de colonne (16:9). */
export const SCREEN_H = COL_W * 9 / 16;

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
  { label: 'Courier New', value: '"Courier New", monospace' },
];
