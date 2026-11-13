/**
 * Caractères non imprimables (AUDIT_editeur_texte.md, lot T7) : espaces (·), espaces insécables
 * (°, ceux que la typographie française pose devant « ; : ! ? »), tabulations (→) et retours à
 * la ligne (↵). Les fins de paragraphe (¶) sont dessinées en CSS (`.ce-flow[data-invisibles]`).
 *
 * Les marques ne prennent aucune place (rien ne bouge, la pagination reste la même) et ne
 * s'impriment pas.
 */
import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const invisiblesKey = new PluginKey<{ on: boolean; decorations: DecorationSet }>('courseInvisibles');

const CLASS: Record<string, string> = {
  ' ': 'ce-inv ce-inv--space',
  '\u00A0': 'ce-inv ce-inv--nbsp',
  '\u202F': 'ce-inv ce-inv--nbsp',
  '\t': 'ce-inv ce-inv--tab',
};

function breakMark(): HTMLElement {
  const span = document.createElement('span');
  span.className = 'ce-inv-break';
  span.textContent = '↵';
  return span;
}

function build(doc: PMNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      const t = node.text!;
      for (let i = 0; i < t.length; i++) {
        const cls = CLASS[t[i]];
        if (cls) decos.push(Decoration.inline(pos + i, pos + i + 1, { class: cls }));
      }
      return false;
    }
    if (node.type.name === 'hardBreak') decos.push(Decoration.widget(pos, breakMark, { side: -1, ignoreSelection: true }));
    return true;
  });
  return DecorationSet.create(doc, decos);
}

export const CourseInvisibles = Extension.create({
  name: 'courseInvisibles',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: invisiblesKey,
        state: {
          init: () => ({ on: false, decorations: DecorationSet.empty }),
          apply: (tr, prev, _old, next) => {
            const meta = tr.getMeta(invisiblesKey) as boolean | undefined;
            const on = meta ?? prev.on;
            if (!on) return prev.on ? { on: false, decorations: DecorationSet.empty } : prev;
            if (meta !== undefined || tr.docChanged) return { on, decorations: build(next.doc) };
            return prev;
          },
        },
        props: {
          decorations: (state) => invisiblesKey.getState(state)?.decorations ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

export function setInvisibles(view: { state: EditorState; dispatch: (tr: Transaction) => void }, on: boolean): void {
  view.dispatch(view.state.tr.setMeta(invisiblesKey, on).setMeta('addToHistory', false));
}
