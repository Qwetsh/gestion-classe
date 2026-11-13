/**
 * Blocs en colonnes (AUDIT_editeur_texte.md, lot T8) : deux ou trois colonnes côte à côte, le
 * cas courant étant « image à gauche, texte à droite ». Pas de colonnes « journal » qui coulent
 * d'une page à l'autre : un bloc de colonnes est un bloc de premier niveau, la pagination le
 * renvoie donc entier à la page suivante (au plus une page).
 */
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import { NodeSelection, TextSelection, type EditorState } from '@tiptap/pm/state';

export type ColumnsLayout = '1-1' | '1-2' | '2-1' | '1-1-1';

export const COLUMNS_LAYOUTS: { id: ColumnsLayout; label: string; title: string }[] = [
  { id: '1-1', label: 'Deux égales', title: 'Deux colonnes de même largeur' },
  { id: '1-2', label: 'Étroite à gauche', title: 'Un tiers à gauche (image), deux tiers à droite (texte)' },
  { id: '2-1', label: 'Étroite à droite', title: 'Deux tiers à gauche (texte), un tiers à droite (image)' },
  { id: '1-1-1', label: 'Trois égales', title: 'Trois colonnes de même largeur' },
];

export const columnCount = (layout: ColumnsLayout) => (layout === '1-1-1' ? 3 : 2);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      /** Bloc de colonnes au curseur ; une image sélectionnée va dans la première colonne. */
      insertColumns: (layout: ColumnsLayout) => ReturnType;
      /** Change la disposition (passer de 3 à 2 colonnes rassemble les deux dernières). */
      setColumnsLayout: (layout: ColumnsLayout) => ReturnType;
      /** Retire les colonnes en gardant leur contenu, à la suite. */
      unsetColumns: () => ReturnType;
    };
  }
}

/** Le bloc de colonnes qui contient la sélection : position et nœud. */
export function findColumns(state: EditorState): { pos: number; node: PMNode } | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === 'columns') return { pos: sel.from, node: sel.node };
  const $from = sel.$from;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'columns') return { pos: $from.before(d), node };
  }
  return null;
}

const emptyColumn = (schema: Schema) => schema.nodes.column.create(null, schema.nodes.paragraph.create());

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  defining: true,
  parseHTML: () => [{ tag: 'div[data-type="column"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'ce-col' }), 0],
});

export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',
  isolating: true,
  defining: true,
  draggable: false,

  addAttributes() {
    return {
      layout: {
        default: '1-1' as ColumnsLayout,
        parseHTML: (el: HTMLElement) => (el.getAttribute('data-layout') as ColumnsLayout) || '1-1',
        renderHTML: (attrs: { layout?: string }) => ({ 'data-layout': attrs.layout ?? '1-1' }),
      },
    };
  },

  parseHTML: () => [{ tag: 'div[data-type="columns"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'columns', class: 'ce-cols' }), 0],

  addCommands() {
    return {
      insertColumns: (layout) => ({ state, tr, dispatch }) => {
        // Pas de colonnes dans des colonnes
        if (findColumns(state)) return false;
        const { schema } = state;
        const sel = state.selection;
        const image = sel instanceof NodeSelection && sel.node.type.name === 'image' ? sel.node : null;
        const n = columnCount(layout);
        const cols = Array.from({ length: n }, (_, i) =>
          i === 0 && image ? schema.nodes.column.create(null, [image, schema.nodes.paragraph.create()]) : emptyColumn(schema));
        const node = schema.nodes.columns.create({ layout }, cols);
        if (!dispatch) return true;
        const start = sel.from;
        tr.replaceSelectionWith(node);
        // Position du bloc inséré : on le retrouve à partir du point d'insertion
        let at = -1;
        tr.doc.nodesBetween(Math.max(0, tr.mapping.map(start, -1) - 1), Math.min(tr.doc.content.size, tr.mapping.map(start, 1) + 1), (nd, pos) => {
          if (at === -1 && nd.type.name === 'columns') at = pos;
          return at === -1;
        });
        if (at !== -1) {
          // Curseur dans la colonne à remplir : la 2e quand l'image occupe la 1re
          const inserted = tr.doc.nodeAt(at)!;
          let colPos = at + 1;
          for (let i = 0; i < (image ? 1 : 0); i++) colPos += inserted.child(i).nodeSize;
          tr.setSelection(TextSelection.near(tr.doc.resolve(colPos + 1)));
        }
        dispatch(tr.scrollIntoView());
        return true;
      },

      setColumnsLayout: (layout) => ({ state, tr, dispatch }) => {
        const found = findColumns(state);
        if (!found) return false;
        if (!dispatch) return true;
        const { pos, node } = found;
        const want = columnCount(layout);
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, layout });
        if (want > node.childCount) {
          tr.insert(pos + node.nodeSize - 1, emptyColumn(state.schema));
        } else if (want < node.childCount) {
          // La dernière colonne rejoint l'avant-dernière (rien n'est perdu)
          const last = node.child(node.childCount - 1);
          const lastStart = pos + node.nodeSize - 1 - last.nodeSize;
          const prevEnd = lastStart - 1;
          const kept = last.content.childCount === 1 && last.content.firstChild!.isTextblock && last.content.firstChild!.content.size === 0
            ? Fragment.empty : last.content;
          tr.delete(lastStart, lastStart + last.nodeSize);
          if (kept.size) tr.insert(prevEnd, kept);
          // Curseur dans la colonne retirée : il suit son texte dans la colonne d'à côté
          if (state.selection.from >= lastStart) tr.setSelection(TextSelection.near(tr.doc.resolve(prevEnd + kept.size - 1), -1));
        }
        dispatch(tr);
        return true;
      },

      unsetColumns: () => ({ state, tr, dispatch }) => {
        const found = findColumns(state);
        if (!found) return false;
        if (!dispatch) return true;
        const { pos, node } = found;
        let content = Fragment.empty;
        node.forEach((col) => { content = content.append(col.content); });
        tr.replaceWith(pos, pos + node.nodeSize, content);
        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos + 1, tr.doc.content.size))));
        dispatch(tr);
        return true;
      },
    };
  },
});
