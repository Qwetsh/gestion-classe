/**
 * Pinceau « Reproduire la mise en forme » (AUDIT_editeur_texte.md, lot T5), comme dans Word :
 * un clic sur le bouton mémorise la mise en forme du texte sous le curseur (gras, couleur,
 * police, taille, surlignage… et réglages du paragraphe : alignement, interligne, espaces,
 * retraits) ; la prochaine sélection faite à la souris la reçoit. Double-clic sur le bouton :
 * le pinceau reste actif jusqu'à Échap ou un nouveau clic.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Mark } from '@tiptap/pm/model';

/** Réglages de paragraphe recopiés (les blocs de texte n'ont pas tous ces attributs). */
const BLOCK_ATTRS = ['textAlign', 'lineHeight', 'spaceBefore', 'spaceAfter', 'indent', 'firstLine'];
/** Marques jamais recopiées : un lien ou un barème n'est pas une « mise en forme ». */
const SKIPPED_MARKS = new Set(['link']);

interface PainterStorage {
  armed: boolean;
  sticky: boolean;
  marks: Mark[];
  blockAttrs: Record<string, unknown> | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    formatPainter: {
      /** Mémorise la mise en forme sous le curseur ; `sticky` = plusieurs applications. */
      pickFormat: (sticky?: boolean) => ReturnType;
      cancelFormat: () => ReturnType;
    };
  }
  interface Storage {
    formatPainter: PainterStorage;
  }
}

export const painterKey = new PluginKey('formatPainter');

export const FormatPainter = Extension.create<Record<string, never>, PainterStorage>({
  name: 'formatPainter',

  addStorage() {
    return { armed: false, sticky: false, marks: [], blockAttrs: null };
  },

  addCommands() {
    return {
      pickFormat: (sticky = false) => ({ state, tr, dispatch }) => {
        const { $from, from, to, empty } = state.selection;
        // Marques du texte sous le curseur (ou au début de la sélection)
        const marks = (empty ? state.storedMarks ?? $from.marks() : state.doc.resolve(Math.min(to, from + 1)).marks())
          .filter((m) => !SKIPPED_MARKS.has(m.type.name));
        const block = $from.parent;
        const blockAttrs: Record<string, unknown> = {};
        for (const key of BLOCK_ATTRS) if (key in block.attrs) blockAttrs[key] = block.attrs[key];
        if (dispatch) {
          Object.assign(this.storage, { armed: true, sticky, marks, blockAttrs });
          tr.setMeta(painterKey, 'armed');
        }
        return true;
      },
      cancelFormat: () => ({ tr, dispatch }) => {
        if (!this.storage.armed) return false;
        if (dispatch) {
          Object.assign(this.storage, { armed: false, sticky: false, marks: [], blockAttrs: null });
          tr.setMeta(painterKey, 'cancel');
        }
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return { Escape: () => this.editor.commands.cancelFormat() };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const editor = this.editor;
    return [
      new Plugin({
        key: painterKey,
        props: {
          attributes: (): Record<string, string> => (storage.armed ? { class: 'ce-painting' } : {}),
          handleDOMEvents: {
            // La sélection est à jour une fois le bouton de la souris relâché
            mouseup: (view) => {
              if (!storage.armed) return false;
              window.setTimeout(() => {
                const { from, to, empty } = view.state.selection;
                if (empty) return;
                const tr = view.state.tr;
                // Caractères : on remplace toute la mise en forme (sauf les liens) par celle mémorisée
                view.state.doc.nodesBetween(from, to, (node, pos) => {
                  if (!node.isText) return;
                  const start = Math.max(from, pos), end = Math.min(to, pos + node.nodeSize);
                  for (const m of node.marks) if (!SKIPPED_MARKS.has(m.type.name)) tr.removeMark(start, end, m.type);
                });
                for (const m of storage.marks) tr.addMark(from, to, m);
                // Paragraphes touchés
                if (storage.blockAttrs) {
                  view.state.doc.nodesBetween(from, to, (node, pos) => {
                    if (!node.isTextblock) return;
                    const attrs: Record<string, unknown> = { ...node.attrs };
                    for (const [k, v] of Object.entries(storage.blockAttrs ?? {})) if (k in attrs) attrs[k] = v;
                    tr.setNodeMarkup(pos, undefined, attrs);
                  });
                }
                if (!storage.sticky) {
                  Object.assign(storage, { armed: false, marks: [], blockAttrs: null });
                  tr.setMeta(painterKey, 'applied');
                }
                view.dispatch(tr);
                editor.commands.focus();
              }, 0);
              return false;
            },
          },
        },
      }),
    ];
  },
});
