/**
 * Éléments de fiche et d'évaluation (AUDIT_editeur_texte.md, lot T3) :
 * - `dots` : pointillés de réponse dans la ligne (jusqu'au bord, ou d'une longueur choisie) ;
 * - `points` : barème d'une question (« / 2 »), calé à droite ;
 * - `pointsTotal` : total du barème, toujours calculé, jamais stocké.
 *
 * Trois nœuds en ligne insécables : on les sélectionne d'un clic, on les règle dans le ruban.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    courseEval: {
      /** Pointillés : `cm` null = jusqu'au bord de la ligne. */
      insertDots: (cm?: number | null) => ReturnType;
      insertPoints: (value?: number) => ReturnType;
      insertPointsTotal: () => ReturnType;
    };
  }
}

/** 1,5 — et non 1.5 ; pas de décimale inutile. */
export function formatPoints(v: number): string {
  return (Math.round(v * 100) / 100).toString().replace('.', ',');
}

/** Somme des barèmes du document. */
export function sumPoints(doc: PMNode): number {
  let total = 0;
  doc.descendants((node) => {
    if (node.type.name === 'points') total += Number(node.attrs.value) || 0;
  });
  return total;
}

export const Dots = Node.create({
  name: 'dots',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      /** Longueur en cm ; null = remplit la ligne jusqu'au bord. */
      cm: {
        default: null,
        parseHTML: (el) => { const v = Number(el.getAttribute('data-cm')); return v > 0 ? v : null; },
        renderHTML: (a) => (a.cm ? { 'data-cm': String(a.cm), style: `width: ${a.cm}cm` } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-dots]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-dots': '', class: `ce-dots ${node.attrs.cm ? '' : 'ce-dots--fill'}` })];
  },

  addCommands() {
    return {
      insertDots: (cm = null) => ({ chain }) => chain().insertContent({ type: 'dots', attrs: { cm } }).run(),
    };
  },
});

export const Points = Node.create({
  name: 'points',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute('data-points')) || 0,
        renderHTML: (a) => ({ 'data-points': String(a.value) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-points]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'ce-points' }), `/ ${formatPoints(Number(node.attrs.value) || 0)}`];
  },

  addCommands() {
    return {
      insertPoints: (value = 1) => ({ chain }) => chain().insertContent({ type: 'points', attrs: { value } }).run(),
    };
  },
});

export const PointsTotal = Node.create({
  name: 'pointsTotal',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'span[data-points-total]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-points-total': '', class: 'ce-total' }), '/ …'];
  },

  // Le total se recalcule à chaque modification du document
  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('span');
      dom.className = 'ce-total';
      dom.setAttribute('data-points-total', '');
      dom.title = 'Total du barème (calculé)';
      const render = () => { dom.textContent = `/ ${formatPoints(sumPoints(editor.state.doc))}`; };
      render();
      editor.on('update', render);
      return { dom, destroy: () => { editor.off('update', render); } };
    };
  },

  addCommands() {
    return {
      insertPointsTotal: () => ({ chain }) => chain().insertContent({ type: 'pointsTotal' }).run(),
    };
  },
});
