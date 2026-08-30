/**
 * Générateurs de disposition de salle (purs, sans I/O).
 *
 * Le placement reste CELLULAIRE (positions "r,c" -> élève), donc le menu radial et
 * le placement ne changent pas. Les `tableGroups` sont une couche visuelle : ils disent
 * quelles cases forment une même table/îlot.
 */

export type LayoutType = 'rows' | 'u' | 'islands' | 'custom';

export interface TableGroup {
  id: string;
  label?: string;
  cells: string[]; // clés "r,c"
}

export interface GeneratedLayout {
  gridRows: number;
  gridCols: number;
  disabledCells: string[];
  tableGroups: TableGroup[];
}

export const cellKey = (r: number, c: number) => `${r},${c}`;

// Couleurs douces par table (cyclées) — purement visuel, jamais "bon/mauvais".
export const TABLE_PALETTE = [
  { bg: '#EEF0FF', border: '#6366F1' },
  { bg: '#E4F6ED', border: '#10B981' },
  { bg: '#FEF1D8', border: '#F59E0B' },
  { bg: '#FDE8E8', border: '#EF4444' },
  { bg: '#F5F3FF', border: '#8B5CF6' },
  { bg: '#EFF6FF', border: '#3B82F6' },
];

export function tableColor(index: number) {
  return TABLE_PALETTE[index % TABLE_PALETTE.length];
}

function disabledFromActive(rows: number, cols: number, active: Set<string>): string[] {
  const disabled: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!active.has(cellKey(r, c))) disabled.push(cellKey(r, c));
    }
  }
  return disabled;
}

/** Rangées classiques : grille pleine, aucune table. */
export function generateRows(rows: number, cols: number): GeneratedLayout {
  return { gridRows: rows, gridCols: cols, disabledCells: [], tableGroups: [] };
}

/**
 * Îlots de 4 (blocs 2×2), arrangés en `across` × `down` îlots, séparés par 1 allée.
 * Ex : across=3, down=3 -> 9 tables de 4 = 36 places.
 */
export function generateIslands(across: number, down: number): GeneratedLayout {
  const a = Math.max(1, across);
  const d = Math.max(1, down);
  const gridCols = a * 2 + (a - 1);
  const gridRows = d * 2 + (d - 1);
  const active = new Set<string>();
  const tableGroups: TableGroup[] = [];
  let n = 0;
  for (let id = 0; id < d; id++) {
    for (let ia = 0; ia < a; ia++) {
      const r0 = id * 3;
      const c0 = ia * 3;
      const cells = [cellKey(r0, c0), cellKey(r0, c0 + 1), cellKey(r0 + 1, c0), cellKey(r0 + 1, c0 + 1)];
      cells.forEach((k) => active.add(k));
      n++;
      tableGroups.push({ id: `t${n}`, label: `Table ${n}`, cells });
    }
  }
  return { gridRows, gridCols, disabledCells: disabledFromActive(gridRows, gridCols, active), tableGroups };
}

/**
 * Disposition en U : tables sur les côtés gauche/droit + le fond, ouverture vers le tableau (haut).
 * Les coins appartiennent aux côtés (gauche/droite) ; le fond exclut les coins (pas de chevauchement).
 */
export function generateU(rows: number, cols: number): GeneratedLayout {
  const r = Math.max(2, rows);
  const c = Math.max(3, cols);
  const active = new Set<string>();
  const left: string[] = [];
  const right: string[] = [];
  const bottom: string[] = [];

  for (let rr = 0; rr < r; rr++) {
    active.add(cellKey(rr, 0));
    active.add(cellKey(rr, c - 1));
    left.push(cellKey(rr, 0));
    right.push(cellKey(rr, c - 1));
  }
  for (let cc = 1; cc < c - 1; cc++) {
    active.add(cellKey(r - 1, cc));
    bottom.push(cellKey(r - 1, cc));
  }

  return {
    gridRows: r,
    gridCols: c,
    disabledCells: disabledFromActive(r, c, active),
    tableGroups: [
      { id: 'u-left', label: 'Côté gauche', cells: left },
      { id: 'u-bottom', label: 'Fond', cells: bottom },
      { id: 'u-right', label: 'Côté droit', cells: right },
    ],
  };
}

/** Nombre de places actives d'une disposition. */
export function seatCount(layout: GeneratedLayout): number {
  return layout.gridRows * layout.gridCols - layout.disabledCells.length;
}

/** Map case "r,c" -> id de table (pour le rendu). */
export function buildCellToGroup(tableGroups: TableGroup[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const g of tableGroups) {
    for (const cell of g.cells) map[cell] = g.id;
  }
  return map;
}
