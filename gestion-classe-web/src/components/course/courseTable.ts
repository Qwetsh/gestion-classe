/**
 * Tableaux de l'éditeur de cours (AUDIT_editeur_texte.md, lot T4) : style du tableau (grille,
 * cadre seul, lignes, lignes alternées, en-tête coloré, sans bordures), largeur et position,
 * couleur de fond et alignement vertical des cellules, hauteur des lignes, colonnes égales.
 *
 * Le tableau redimensionnable est dessiné par une vue de TipTap (`TableView`) qui ignore les
 * attributs ajoutés au nœud : `CourseTableView` les reporte sur l'enveloppe du tableau.
 */
import { Table, TableCell, TableHeader, TableRow, TableView } from '@tiptap/extension-table';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { COL_W } from '../../lib/course/coursePage';

export type TableStyle = 'grid' | 'outer' | 'lines' | 'zebra' | 'header' | 'none';

export const TABLE_STYLES: { id: TableStyle; label: string; hint: string }[] = [
  { id: 'grid', label: 'Grille', hint: 'Toutes les bordures' },
  { id: 'outer', label: 'Cadre', hint: 'Bordure extérieure seulement' },
  { id: 'lines', label: 'Lignes', hint: 'Traits horizontaux seulement' },
  { id: 'zebra', label: 'Alterné', hint: 'Une ligne sur deux grisée' },
  { id: 'header', label: 'En-tête', hint: 'Ligne d’en-tête colorée' },
  { id: 'none', label: 'Invisible', hint: 'Sans bordures : pour aligner deux textes côte à côte' },
];

/** Couleurs de fond proposées pour les cellules (claires : le texte reste lisible, peu d'encre). */
export const CELL_COLORS: { c: string; n: string }[] = [
  { c: '#F1F5F9', n: 'Gris' }, { c: '#FEF3C7', n: 'Jaune' }, { c: '#DCFCE7', n: 'Vert' },
  { c: '#DBEAFE', n: 'Bleu' }, { c: '#FCE7F3', n: 'Rose' }, { c: '#EDE9FE', n: 'Violet' }, { c: '#FFEDD5', n: 'Orange' },
];

/** Hauteurs de ligne proposées (px) : auto, 1 cm, 1,5 cm, 2 cm, 3 cm. */
export const ROW_HEIGHTS: { label: string; value: number | null }[] = [
  { label: 'Auto', value: null },
  { label: '1 cm', value: 38 },
  { label: '1,5 cm', value: 57 },
  { label: '2 cm', value: 76 },
  { label: '3 cm', value: 113 },
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    courseTable: {
      /** Largeur du tableau en % de la colonne de texte ; les colonnes sont remises à l'échelle. */
      setTableWidth: (percent: number) => ReturnType;
      /** Donne la même largeur à toutes les colonnes. */
      equalizeColumns: () => ReturnType;
      /** Hauteur minimale des lignes sélectionnées (px), null = automatique. */
      setRowHeight: (px: number | null) => ReturnType;
    };
  }
}

// ---- Vue : reporte les attributs du tableau sur son enveloppe ----

class CourseTableView extends TableView {
  constructor(node: PMNode, cellMinWidth: number, view: EditorView, HTMLAttributes?: Record<string, unknown>) {
    super(node, cellMinWidth, view, HTMLAttributes);
    const { tableStyle, tableAlign } = node.attrs as { tableStyle?: string; tableAlign?: string };
    this.dom.dataset.tstyle = tableStyle || 'grid';
    this.dom.dataset.talign = tableAlign || 'left';
  }
}

// ---- Nœuds ----

/** Position du tableau dans la table du document, depuis la sélection. */
function findTable(state: EditorState): { pos: number; node: PMNode } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'table') return { pos: $from.before(d), node };
  }
  return null;
}

/** Nombre de colonnes (somme des colspan de la première ligne). */
function columnCount(table: PMNode): number {
  let n = 0;
  table.firstChild?.forEach((cell) => { n += Number(cell.attrs.colspan) || 1; });
  return n;
}

/** Applique à chaque cellule la largeur de ses colonnes, d'après `colWidths` (une valeur par colonne). */
function applyColumnWidths(tr: Transaction, tablePos: number, table: PMNode, colWidths: number[]) {
  table.forEach((row, rowOffset) => {
    let col = 0;
    row.forEach((cell, cellOffset) => {
      const span = Number(cell.attrs.colspan) || 1;
      const colwidth = colWidths.slice(col, col + span).map((w) => Math.round(w));
      // +1 (entrée dans le tableau) +1 (entrée dans la ligne)
      tr.setNodeMarkup(tablePos + 1 + rowOffset + 1 + cellOffset, undefined, { ...cell.attrs, colwidth });
      col += span;
    });
  });
}

export const CourseTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableStyle: {
        default: 'grid',
        parseHTML: (el) => el.getAttribute('data-tstyle') ?? 'grid',
        renderHTML: (a) => ({ 'data-tstyle': a.tableStyle }),
      },
      tableAlign: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-talign') ?? 'left',
        renderHTML: (a) => ({ 'data-talign': a.tableAlign }),
      },
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setTableWidth: (percent) => ({ state, tr, dispatch }) => {
        const found = findTable(state);
        if (!found) return false;
        if (!dispatch) return true;
        const n = columnCount(found.node);
        // Largeurs actuelles (colonnes sans largeur : part égale), remises à l'échelle
        const current: number[] = [];
        found.node.firstChild?.forEach((cell) => {
          const span = Number(cell.attrs.colspan) || 1;
          const cw = cell.attrs.colwidth as number[] | null;
          for (let j = 0; j < span; j++) current.push(cw?.[j] || 0);
        });
        const known = current.filter((w) => w > 0);
        const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : COL_W / n;
        const filled = current.map((w) => w || fallback);
        const total = filled.reduce((a, b) => a + b, 0);
        const target = (COL_W * percent) / 100;
        applyColumnWidths(tr, found.pos, found.node, filled.map((w) => (w / total) * target));
        return true;
      },
      equalizeColumns: () => ({ state, tr, dispatch }) => {
        const found = findTable(state);
        if (!found) return false;
        if (!dispatch) return true;
        const n = columnCount(found.node);
        let total = 0;
        let complete = true;
        found.node.firstChild?.forEach((cell) => {
          const cw = cell.attrs.colwidth as number[] | null;
          const span = Number(cell.attrs.colspan) || 1;
          for (let j = 0; j < span; j++) { if (cw?.[j]) total += cw[j]; else complete = false; }
        });
        const width = complete ? total : COL_W;
        applyColumnWidths(tr, found.pos, found.node, Array.from({ length: n }, () => width / n));
        return true;
      },
      setRowHeight: (px) => ({ state, tr, dispatch }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name !== 'tableRow') return;
          changed = true;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, minHeight: px });
        });
        return changed;
      },
    };
  },
});

export const CourseTableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      minHeight: {
        default: null,
        parseHTML: (el) => { const v = parseFloat(el.style.height); return Number.isFinite(v) && v > 0 ? v : null; },
        renderHTML: (a) => (a.minHeight ? { style: `height: ${a.minHeight}px` } : {}),
      },
    };
  },
});

/** Fond et alignement vertical : mêmes attributs pour les cellules et les cellules d'en-tête. */
const cellAttributes = {
  backgroundColor: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-bg') || el.style.backgroundColor || null,
    renderHTML: (a: Record<string, unknown>) => (a.backgroundColor ? { 'data-bg': a.backgroundColor, style: `background-color: ${a.backgroundColor as string}` } : {}),
  },
  verticalAlign: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.verticalAlign || null,
    renderHTML: (a: Record<string, unknown>) => (a.verticalAlign ? { style: `vertical-align: ${a.verticalAlign as string}` } : {}),
  },
};

export const CourseTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

export const CourseTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes };
  },
});

/** Les quatre nœuds de tableau, à poser à la place de `TableKit`. */
export const courseTableExtensions = [
  CourseTable.configure({ resizable: true, View: CourseTableView }),
  CourseTableRow,
  CourseTableHeader,
  CourseTableCell,
];
