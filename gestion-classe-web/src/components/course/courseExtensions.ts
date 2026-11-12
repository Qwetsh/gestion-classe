/**
 * Extensions TipTap de l'éditeur de cours : base « traitement de texte » (StarterKit, police,
 * taille, couleur, surlignage, alignement, tableaux, images) + blocs propres aux cours :
 * encadrés (Définition, À retenir, Consigne, Exemple) et saut de page.
 *
 * Chaque bloc reçoit un identifiant stable (`blockId`) : le calque tableau s'y ancrera (étape 3).
 */
import { Node, mergeAttributes, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import UniqueID from '@tiptap/extension-unique-id';
import { Placeholder } from '@tiptap/extensions';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CoursePagination, type PageLayout } from './coursePagination';
import { CourseImageView } from './CourseImageView';

// ---- Encadrés ----

export type CalloutKind = 'definition' | 'retenir' | 'consigne' | 'exemple';

export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  definition: 'Définition',
  retenir: 'À retenir',
  consigne: 'Consigne',
  exemple: 'Exemple',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Encadre les blocs sélectionnés ; même type déjà posé = retire l'encadré ; autre type = le change. */
      toggleCallout: (kind: CalloutKind) => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: {
        default: 'definition',
        parseHTML: (el) => el.getAttribute('data-callout') ?? 'definition',
        renderHTML: (attrs) => ({ 'data-callout': attrs.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'ce-callout' }), 0];
  },

  addCommands() {
    return {
      toggleCallout: (kind) => ({ editor, commands }) => {
        if (editor.isActive('callout', { kind })) return commands.lift('callout');
        if (editor.isActive('callout')) return commands.updateAttributes('callout', { kind });
        return commands.wrapIn('callout', { kind });
      },
    };
  },
});

// ---- Saut de page (Ctrl+Entrée) : n'existe que sur papier ----

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'ce-pagebreak' })];
  },

  addCommands() {
    return {
      setPageBreak: () => ({ chain }) => chain().insertContent({ type: 'pageBreak' }).run(),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});

// ---- Images : fichier du bucket board-assets (chemin), affiché par URL signée ----

export const CourseImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** Chemin dans le bucket (les URL signées expirent : on ne stocke jamais l'URL). */
      path: { default: null },
      /** Largeur affichée en px (null = largeur naturelle, plafonnée à la colonne). */
      width: { default: null },
      align: { default: 'center' },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CourseImageView);
  },
}).configure({ inline: false, allowBase64: true });

// ---- Assemblage ----

/** Blocs qui reçoivent un identifiant stable (ancrage du calque tableau, animations). */
const BLOCK_TYPES = ['heading', 'paragraph', 'callout', 'image', 'table', 'bulletList', 'orderedList', 'pageBreak', 'blockquote', 'horizontalRule'];

export function courseExtensions(onLayout: (layout: PageLayout) => void): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    TableKit.configure({ table: { resizable: true } }),
    CourseImage,
    Callout,
    PageBreak,
    UniqueID.configure({ types: BLOCK_TYPES, attributeName: 'blockId' }),
    Placeholder.configure({
      includeChildren: false,
      showOnlyCurrent: false,
      placeholder: ({ node, pos }) => {
        if (node.type.name === 'heading' && pos === 0) return 'Titre du cours';
        if (node.type.name === 'heading') return 'Titre';
        return pos <= 2 ? 'Commencez à rédiger votre cours…' : '';
      },
    }),
    CoursePagination.configure({ onLayout }),
  ];
}
