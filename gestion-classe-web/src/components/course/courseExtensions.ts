/**
 * Extensions TipTap de l'éditeur de cours : base « traitement de texte » (StarterKit, police,
 * taille, couleur, surlignage, alignement, tableaux, images) + blocs propres aux cours :
 * encadrés (Définition, À retenir, Consigne, Exemple), saut de page, encarts tableau 16:9
 * (une page du tableau, exactement un écran en classe) et zones d'écriture (Seyès, carreaux…).
 *
 * Chaque bloc reçoit un identifiant stable (`blockId`) : le calque tableau s'y ancrera (étape 3).
 */
import { Node, mergeAttributes, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { courseTableExtensions } from './courseTable';
import { CoursePaste, type PasteMode } from './coursePaste';
import { FormatPainter } from './courseFormatPainter';
import { CourseSearch } from './courseSearch';
import { CourseInvisibles } from './courseInvisibles';
import { CourseSpell } from './courseSpell';
import Image from '@tiptap/extension-image';
import UniqueID from '@tiptap/extension-unique-id';
import { Placeholder } from '@tiptap/extensions';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CoursePagination, type PageLayout } from './coursePagination';
import { CourseImageView } from './CourseImageView';
import { CourseIconView } from './CourseIconView';
import { Column, Columns } from './courseColumns';
import { EncartView, type EncartOptions } from './EncartView';
import { MM } from '../../lib/course/coursePage';
import { typographyExtensions } from './courseTypography';
import { CourseParagraph } from './courseParagraph';
import { Dots, Points, PointsTotal } from './courseEval';
import { OrderedList, TaskItem, TaskList } from '@tiptap/extension-list';

// ---- Encadrés ----

export type CalloutKind = 'definition' | 'retenir' | 'consigne' | 'exemple' | 'libre';

export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  definition: 'Définition',
  retenir: 'À retenir',
  consigne: 'Consigne',
  exemple: 'Exemple',
  libre: 'Encadré',
};

/** Couleurs proposées pour l'encadré libre. */
export const CALLOUT_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Encadre les blocs sélectionnés ; même type déjà posé = retire l'encadré ; autre type = le change. */
      toggleCallout: (kind: CalloutKind) => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
    encart: {
      /** Nouvel encart vide (sa page du tableau est créée au premier dessin). */
      insertEncart: () => ReturnType;
    };
    writingZone: {
      insertWritingZone: (attrs?: Partial<WritingZoneAttrs>) => ReturnType;
    };
  }
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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
      /** Titre affiché en tête ; null = celui du type (« Définition »…) ; '' = pas de titre. */
      title: {
        default: null,
        parseHTML: (el) => (el.hasAttribute('data-custom-title') ? el.getAttribute('data-title') ?? '' : null),
        renderHTML: (attrs) => (attrs.title == null
          ? { 'data-title': CALLOUT_LABELS[attrs.kind as CalloutKind] ?? '' }
          : { 'data-title': attrs.title, 'data-custom-title': '' }),
      },
      /** Couleur de l'encadré libre (#rrggbb). */
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-color'),
        renderHTML: (attrs) => (attrs.color ? { 'data-color': attrs.color, style: `--ce-callout: ${attrs.color}` } : {}),
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

});

// ---- Encart tableau 16:9 ----

export const Encart = Node.create<EncartOptions>({
  name: 'encart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { boardId: '', onEdit: () => undefined };
  },

  addAttributes() {
    return {
      /** Identifiant de la page dans board_pages (board_id = le tableau du cours). */
      pageId: { default: null },
      /** Impression : 'filled' = avec son contenu, 'blank' = cadre vide que l'élève complète. */
      print: { default: 'filled' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-encart]', getAttrs: (el) => ({ pageId: (el as HTMLElement).getAttribute('data-encart') }) }];
  },

  renderHTML({ node }) {
    return ['div', { 'data-encart': node.attrs.pageId, class: 'ce-encart' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EncartView);
  },

  addCommands() {
    return {
      insertEncart: () => ({ chain }) => chain().insertContent({ type: 'encart', attrs: { pageId: newId() } }).run(),
    };
  },
});

// ---- Zone d'écriture ----

export type WritingZoneStyle = 'seyes' | 'carreaux' | 'lignes' | 'pointilles' | 'blanc';

export interface WritingZoneAttrs {
  style: WritingZoneStyle;
  lines: number;
}

export const WRITING_ZONE_LABELS: Record<WritingZoneStyle, string> = {
  seyes: 'Seyès',
  carreaux: 'Carreaux 5 mm',
  lignes: 'Lignes',
  pointilles: 'Pointillés',
  blanc: 'Blanc',
};

/** Hauteur d'une ligne d'écriture : 8 mm (grand carreau Seyès). */
export const ZONE_LINE_PX = 8 * MM;

export const WritingZone = Node.create({
  name: 'writingZone',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      style: { default: 'seyes' },
      lines: { default: 6 },
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-zone]',
      getAttrs: (el) => ({
        style: (el as HTMLElement).getAttribute('data-zone') ?? 'seyes',
        lines: Number((el as HTMLElement).getAttribute('data-lines')) || 6,
      }),
    }];
  },

  renderHTML({ node }) {
    const style = node.attrs.style as WritingZoneStyle;
    const lines = Math.max(1, Math.min(40, Number(node.attrs.lines) || 6));
    return ['div', {
      'data-zone': style,
      'data-lines': String(lines),
      'data-label': `✎ Zone d'écriture · ${lines} ligne${lines > 1 ? 's' : ''} · ${WRITING_ZONE_LABELS[style] ?? style}`,
      class: `ce-zone ce-zone--${style}`,
      style: `height: ${(lines * ZONE_LINE_PX).toFixed(2)}px`,
    }];
  },

  addCommands() {
    return {
      insertWritingZone: (attrs) => ({ chain }) => chain().insertContent({ type: 'writingZone', attrs: { style: 'seyes', lines: 6, ...attrs } }).run(),
    };
  },
});

// ---- Liste numérotée : type de numéros (a, A, i, I) ----

const LIST_KINDS: Record<string, string> = { a: 'lower-alpha', A: 'upper-alpha', i: 'lower-roman', I: 'upper-roman' };

/**
 * L'attribut HTML `type` d'une liste ne distingue pas « a » de « A » dans un sélecteur CSS
 * (comparaison insensible à la casse) : on double l'information dans `data-kind`.
 */
export const CourseOrderedList = OrderedList.extend({
  renderHTML({ HTMLAttributes, node }) {
    const { start, ...rest } = HTMLAttributes as Record<string, unknown>;
    const kind = LIST_KINDS[String(node.attrs.type ?? '')];
    return ['ol', mergeAttributes(this.options.HTMLAttributes, start === 1 ? rest : HTMLAttributes, kind ? { 'data-kind': kind } : {}), 0];
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
      // Lot T8 (absents des images plus anciennes : valeurs par défaut)
      /** Légende sous l'image (null = pas de légende ; '' = légende à écrire). */
      caption: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-caption'),
        renderHTML: (a: { caption?: string | null }) => (a.caption == null ? {} : { 'data-caption': a.caption }),
      },
      /** Rognage non destructif : { t, r, b, l } en fractions de l'image tournée. */
      crop: {
        default: null,
        parseHTML: (el: HTMLElement) => { try { return JSON.parse(el.getAttribute('data-crop') || 'null'); } catch { return null; } },
        renderHTML: (a: { crop?: unknown }) => (a.crop ? { 'data-crop': JSON.stringify(a.crop) } : {}),
      },
      /** Quarts de tour : 0, 90, 180, 270. */
      rotate: {
        default: 0,
        parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-rotate')) || 0,
        renderHTML: (a: { rotate?: number }) => (a.rotate ? { 'data-rotate': String(a.rotate) } : {}),
      },
      flip: {
        default: false,
        parseHTML: (el: HTMLElement) => el.hasAttribute('data-flip'),
        renderHTML: (a: { flip?: boolean }) => (a.flip ? { 'data-flip': '' } : {}),
      },
      frame: {
        default: 'none',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-frame') || 'none',
        renderHTML: (a: { frame?: string }) => (a.frame && a.frame !== 'none' ? { 'data-frame': a.frame } : {}),
      },
      /** Lot T16b : crédit d'une image de la banque ({ text, url }), écrit sous l'image. */
      credit: {
        default: null,
        parseHTML: (el: HTMLElement) => { try { return JSON.parse(el.getAttribute('data-credit') || 'null'); } catch { return null; } },
        renderHTML: (a: { credit?: unknown }) => (a.credit ? { 'data-credit': JSON.stringify(a.credit) } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CourseImageView);
  },
// Pas d'image en base64 dans le document : elle alourdirait chaque enregistrement
}).configure({ inline: false, allowBase64: false });

// ---- Icônes dans le texte (lot T16a) ----

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    courseIcon: {
      /** Icône Lucide (nom du jeu `courseIconSet.ts`) au curseur. */
      insertIcon: (name: string) => ReturnType;
    };
  }
}

export const CourseIcon = Node.create({
  name: 'courseIcon',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      name: {
        default: 'Star',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-icon') || 'Star',
        renderHTML: (a: { name?: string }) => ({ 'data-icon': a.name ?? 'Star' }),
      },
    };
  },
  parseHTML: () => [{ tag: 'span[data-icon]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { class: 'ce-icon' })],
  addNodeView() {
    return ReactNodeViewRenderer(CourseIconView);
  },
  addCommands() {
    return {
      insertIcon: (name) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { name } }),
    };
  },
});

// ---- Assemblage ----

/** Blocs qui reçoivent un identifiant stable (ancrage du calque tableau, animations). */
const BLOCK_TYPES = ['heading', 'paragraph', 'callout', 'image', 'table', 'bulletList', 'orderedList', 'pageBreak', 'blockquote', 'horizontalRule', 'encart', 'writingZone', 'taskList', 'columns'];

export interface CoursePasteHooks {
  getMode: () => PasteMode;
  onDroppedImages: (count: number) => void;
  onDuplicateEncart: (fromId: string, toId: string) => void;
  onImageFiles: (files: File[]) => void;
}

export function courseExtensions(onLayout: (layout: PageLayout) => void, encart: EncartOptions, onLink: () => void, paste: CoursePasteHooks): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      orderedList: false,
      code: false,
      // Un clic place le curseur ; Ctrl + clic ouvre le lien (géré dans CourseEditor)
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    }),
    TextStyleKit.configure({ lineHeight: false }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    ...courseTableExtensions,
    CourseImage,
    Columns,
    Column,
    CourseIcon,
    Callout,
    PageBreak,
    Encart.configure(encart),
    WritingZone,
    CourseOrderedList,
    TaskList,
    TaskItem.configure({ nested: true }),
    CourseParagraph,
    Dots,
    Points,
    PointsTotal,
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
    ...typographyExtensions(onLink),
    CoursePaste.configure(paste),
    FormatPainter,
    CourseSearch,
    CourseInvisibles,
    CourseSpell,
    CoursePagination.configure({ onLayout }),
  ];
}
