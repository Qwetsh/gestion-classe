/**
 * Classeur virtuel (lot 3) : repérage des volets de la fiche de mémorisation. Fonctions pures.
 *
 * Une ligne à volet est une ligne de tableau à trois cellules dont la dernière porte la marque de
 * pliage (« ⟵ plie ») : question, réponse, volet à rabattre sur la réponse.
 */

/** Rectangle en px de la feuille (à l'échelle 1, origine en haut à gauche des feuilles du cours). */
export interface SheetRect { x: number; y: number; w: number; h: number }

export interface FlapBox {
  /** Rang de la ligne parmi les lignes de tableau du document. */
  row: number;
  /** La cellule de la réponse, que le volet rabattu couvre. */
  answer: SheetRect;
  /** La cellule du volet : vide quand il est rabattu (on voit la feuille du classeur au travers). */
  hole: SheetRect;
}

const FOLD_MARK = /plie/i;

/** Rangs des lignes à volet, d'après le texte des cellules de chaque ligne de tableau. */
export function flapRows(rows: string[][]): number[] {
  const out: number[] = [];
  rows.forEach((cells, i) => {
    if (cells.length === 3 && FOLD_MARK.test(cells[2]) && cells[1].trim() !== '') out.push(i);
  });
  return out;
}

interface ScreenRect { left: number; top: number; width: number; height: number }

/**
 * Rectangle mesuré à l'écran, ramené au repère de la feuille : `box` est le conteneur des feuilles
 * à l'écran, large de `sheetWidth` à l'échelle 1 (le classeur est réduit pour tenir dans l'écran).
 */
export function toSheet(rect: ScreenRect, box: ScreenRect, sheetWidth: number): SheetRect {
  const scale = box.width / sheetWidth || 1;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    x: round((rect.left - box.left) / scale),
    y: round((rect.top - box.top) / scale),
    w: round(rect.width / scale),
    h: round(rect.height / scale),
  };
}

/** Sens d'une page qui se tourne : vers l'avant, vers l'arrière, ou rien (même vue). */
export function turnDirection(from: number, to: number): 1 | -1 | 0 {
  return to > from ? 1 : to < from ? -1 : 0;
}
