/**
 * Mise en forme du paragraphe (AUDIT_editeur_texte.md, lot T2) : interligne, espace avant et
 * après, retrait gauche, alinéa de première ligne — portés par les paragraphes et les titres.
 *
 * Les valeurs sont écrites en style sur le bloc : la pagination mesure les hauteurs réelles,
 * elle suit donc toute seule.
 */
import { Extension } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';

/** Un cran de retrait : 1,25 cm, comme la tabulation. */
export const INDENT_STEP_CM = 1.25;
export const MAX_INDENT = 8;

/**
 * Interlignes proposés, avec les libellés de Word. « 1,0 » de Word vaut environ 1,2 fois le
 * corps ; le style du cours est à 1,45 (un peu plus aéré que « 1,15 »).
 */
export const LINE_HEIGHTS: { label: string; value: string | null }[] = [
  { label: '1,0', value: '1.2' },
  { label: '1,15', value: '1.38' },
  { label: 'Normal', value: null },
  { label: '1,5', value: '1.8' },
  { label: '2,0', value: '2.4' },
];

/** Espaces avant / après (px) ; `null` = celui du style. */
export const SPACE_BEFORE: { label: string; value: number | null }[] = [
  { label: 'Du style', value: null },
  { label: 'Aucun', value: 0 },
  { label: 'Petit', value: 8 },
  { label: 'Moyen', value: 16 },
  { label: 'Grand', value: 28 },
];
export const SPACE_AFTER = SPACE_BEFORE;

const TYPES = ['paragraph', 'heading'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    courseParagraph: {
      setLineHeight: (value: string | null) => ReturnType;
      setSpaceBefore: (px: number | null) => ReturnType;
      setSpaceAfter: (px: number | null) => ReturnType;
      /** Retrait gauche d'un cran en plus (+1) ou en moins (−1), sur chaque paragraphe sélectionné. */
      indentParagraph: (dir: 1 | -1) => ReturnType;
      toggleFirstLine: () => ReturnType;
    };
  }
}

const px = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

export const CourseParagraph = Extension.create({
  name: 'courseParagraph',

  addGlobalAttributes() {
    return [{
      types: TYPES,
      attributes: {
        lineHeight: {
          default: null,
          parseHTML: (el) => el.style.lineHeight || null,
          renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
        },
        spaceBefore: {
          default: null,
          parseHTML: (el) => (el.style.marginTop ? px(el.style.marginTop) : null),
          renderHTML: (a) => (a.spaceBefore == null ? {} : { style: `margin-top: ${a.spaceBefore}px` }),
        },
        spaceAfter: {
          default: null,
          parseHTML: (el) => (el.style.marginBottom ? px(el.style.marginBottom) : null),
          renderHTML: (a) => (a.spaceAfter == null ? {} : { style: `margin-bottom: ${a.spaceAfter}px` }),
        },
        indent: {
          default: 0,
          parseHTML: (el) => Number(el.getAttribute('data-indent')) || 0,
          renderHTML: (a) => (a.indent ? { 'data-indent': String(a.indent), style: `margin-left: ${(a.indent * INDENT_STEP_CM).toFixed(2)}cm` } : {}),
        },
        firstLine: {
          default: false,
          parseHTML: (el) => el.hasAttribute('data-first-line'),
          renderHTML: (a) => (a.firstLine ? { 'data-first-line': '', style: `text-indent: ${INDENT_STEP_CM}cm` } : {}),
        },
      },
    }];
  },

  addCommands() {
    /** Applique `patch` à chaque paragraphe ou titre touché par la sélection. */
    const patchBlocks = (patch: (attrs: Record<string, unknown>) => Record<string, unknown> | null) =>
      ({ state, tr, dispatch }: { state: EditorState; tr: Transaction; dispatch?: unknown }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!TYPES.includes(node.type.name)) return;
          const next = patch(node.attrs);
          if (!next) return;
          changed = true;
          if (dispatch) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...next });
        });
        return changed;
      };

    return {
      setLineHeight: (value) => patchBlocks(() => ({ lineHeight: value })),
      setSpaceBefore: (v) => patchBlocks(() => ({ spaceBefore: v })),
      setSpaceAfter: (v) => patchBlocks(() => ({ spaceAfter: v })),
      indentParagraph: (dir) => patchBlocks((attrs) => {
        const current = Number(attrs.indent) || 0;
        const next = Math.max(0, Math.min(MAX_INDENT, current + dir));
        return next === current ? null : { indent: next };
      }),
      toggleFirstLine: () => ({ editor, ...rest }) => {
        const on = !!(editor.getAttributes('paragraph') as { firstLine?: boolean }).firstLine;
        return patchBlocks(() => ({ firstLine: !on }))(rest);
      },
    };
  },

  addKeyboardShortcuts() {
    // Ctrl+M / Ctrl+Maj+M : retrait, comme dans Word (hors liste : les listes ont Tab)
    return {
      'Mod-m': () => (this.editor.isActive('listItem') || this.editor.isActive('taskItem') ? false : this.editor.commands.indentParagraph(1)),
      'Mod-Shift-m': () => (this.editor.isActive('listItem') || this.editor.isActive('taskItem') ? false : this.editor.commands.indentParagraph(-1)),
    };
  },
});
