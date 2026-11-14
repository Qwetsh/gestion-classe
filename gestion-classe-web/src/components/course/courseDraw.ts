/**
 * Outils du calque Tableau (lot 3) : outil courant, couleurs, épaisseurs.
 */
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';

export interface DrawStyle { tool: DrawTool; color: string; size: 'S' | 'M' | 'L' }

export const DRAW_COLORS = ['#111827', '#DC2626', '#2563EB', '#16A34A', '#9333EA', '#EA580C', '#FACC15'];
const STROKE = { S: 2, M: 3.5, L: 6 };
export const TEXT_SIZES = { S: 14, M: 18, L: 26 };

/** Épaisseur réelle selon l'outil (le surligneur est large). */
export function strokeFor(tool: DrawTool, size: DrawStyle['size']): number {
  if (tool === 'text') return TEXT_SIZES[size];
  return tool === 'highlighter' ? STROKE[size] * 4 : STROKE[size];
}
