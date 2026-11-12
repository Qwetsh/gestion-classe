/**
 * Caractères et frappe de l'éditeur de cours (AUDIT_editeur_texte.md, lots T0 et T1) :
 * exposant et indice, typographie française (guillemets « », espaces insécables avant ; : ? !),
 * changement de casse (Maj+F3), touche Tab qui reste dans le texte, raccourcis Ctrl+Entrée
 * (saut de page) et Ctrl+K (lien).
 *
 * Une correction automatique se défait d'un Retour arrière juste après (mécanisme des règles de
 * saisie de TipTap).
 */
import { Extension, InputRule, type Extensions } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Typography from '@tiptap/extension-typography';

/** Espace insécable (avant « : », dans les guillemets). */
const NBSP = ' ';
/** Espace fine insécable (avant « ; », « ? », « ! »). */
const NNBSP = ' ';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    courseCase: {
      /** Fait tourner la casse de la sélection : minuscules → MAJUSCULES → Première lettre. */
      cycleCase: () => ReturnType;
    };
  }
}

// ---- Espaces avant la ponctuation haute (règle française) ----

/** « http: », « mailto: »… : pas d'espace avant les deux-points d'une adresse. */
const URL_SCHEME = /(?:https?|ftp|mailto|tel|file)$/i;

export const FrenchSpacing = Extension.create({
  name: 'frenchSpacing',

  addInputRules() {
    return [
      new InputRule({
        // un caractère, une espace ordinaire éventuelle, puis ; : ? ou !
        find: /(\S)( ?)([;:?!])$/,
        handler: ({ state, range, match }) => {
          const [, prev, , mark] = match;
          // « ?! », « !! », « :: », parenthèse ou guillemet ouvrant : rien à ajouter
          if (';:?!(«'.includes(prev)) return null;
          if (mark === ':') {
            if (/\d/.test(prev)) return null; // 10:30, 1:2
            const $from = state.doc.resolve(range.from);
            const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 8), $from.parentOffset, undefined, ' ') + prev;
            if (URL_SCHEME.test(before)) return null;
          }
          // Dans un lien (adresse affichée), on ne touche à rien
          if (state.doc.resolve(range.from).marks().some((m) => m.type.name === 'link')) return null;
          state.tr.insertText(`${prev}${mark === ':' ? NBSP : NNBSP}${mark}`, range.from, range.to);
        },
      }),
    ];
  },
});

// ---- Casse ----

type CaseMode = 'lower' | 'upper' | 'sentence';

/** Casse suivante du cycle : minuscules → MAJUSCULES → Première lettre → minuscules. */
function nextCase(text: string): CaseMode {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (!letters) return 'upper';
  if (letters === letters.toLocaleLowerCase('fr')) return 'upper';
  if (letters === letters.toLocaleUpperCase('fr')) return letters.length > 1 ? 'sentence' : 'lower';
  return 'lower';
}

export const CourseCase = Extension.create({
  name: 'courseCase',

  addCommands() {
    return {
      cycleCase: () => ({ state, tr, dispatch }) => {
        let { from, to } = state.selection;
        // Sans sélection : le mot sous le curseur, comme dans Word
        if (from === to) {
          const $pos = state.selection.$from;
          const text = $pos.parent.textContent;
          let a = $pos.parentOffset, b = $pos.parentOffset;
          while (a > 0 && /[\p{L}\p{N}’'-]/u.test(text[a - 1])) a--;
          while (b < text.length && /[\p{L}\p{N}’'-]/u.test(text[b])) b++;
          if (a === b) return false;
          from = $pos.start() + a;
          to = $pos.start() + b;
        }
        const mode = nextCase(state.doc.textBetween(from, to, '\n'));

        if (!dispatch) return true;
        let startOfSentence = true;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!node.isText || !node.text) {
            if (node.isBlock) startOfSentence = true;
            return;
          }
          const s = Math.max(from, pos);
          const e = Math.min(to, pos + node.nodeSize);
          const part = node.text.slice(s - pos, e - pos);
          let out: string;
          if (mode === 'upper') out = part.toLocaleUpperCase('fr');
          else if (mode === 'lower') out = part.toLocaleLowerCase('fr');
          else {
            out = '';
            for (const ch of part.toLocaleLowerCase('fr')) {
              if (startOfSentence && /\p{L}/u.test(ch)) { out += ch.toLocaleUpperCase('fr'); startOfSentence = false; }
              else out += ch;
              if ('.!?'.includes(ch)) startOfSentence = true;
            }
          }
          // Même longueur obligatoire : les positions du document ne doivent pas bouger
          if (out.length === part.length && out !== part) tr.replaceWith(s, e, state.schema.text(out, node.marks));
        });
        tr.setSelection(TextSelection.create(tr.doc, from, to));
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return { 'Shift-F3': () => this.editor.commands.cycleCase() };
  },
});

// ---- Touches ----

/**
 * Tab dans un paragraphe ordinaire : une tabulation dans le texte (sans cela, le navigateur
 * emmène le focus hors de la feuille). Priorité basse : les listes et les tableaux passent avant.
 */
export const CourseTab = Extension.create({
  name: 'courseTab',
  priority: 20,

  addKeyboardShortcuts() {
    const inStructure = () => this.editor.isActive('listItem') || this.editor.isActive('taskItem') || this.editor.isActive('table');
    return {
      Tab: () => {
        if (inStructure()) return false;
        return this.editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) tr.insertText('\t');
          return true;
        });
      },
      // Hors liste et hors tableau, Maj+Tab ne fait rien — mais ne quitte pas la feuille
      'Shift-Tab': () => !inStructure(),
    };
  },
});

interface CourseKeysOptions {
  onLink: () => void;
}

/** Raccourcis prioritaires : Ctrl+Entrée = saut de page (avant le retour à la ligne de TipTap), Ctrl+K = lien. */
export const CourseKeys = Extension.create<CourseKeysOptions>({
  name: 'courseKeys',
  priority: 1000,

  addOptions() {
    return { onLink: () => undefined };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.setPageBreak(),
      'Mod-k': () => { this.options.onLink(); return true; },
    };
  },
});

// ---- Assemblage ----

export function typographyExtensions(onLink: () => void): Extensions {
  return [
    Superscript,
    Subscript,
    Typography.configure({
      // Guillemets français avec leur espace insécable ; l'apostrophe devient typographique
      openDoubleQuote: `«${NBSP}`,
      closeDoubleQuote: `${NBSP}»`,
      laquo: `«${NBSP}`,
      raquo: `${NBSP}»`,
      openSingleQuote: false,
      // Gardés : … — → ← ≠ ± ² ³. Coupés : ce qui surprend plus qu'il n'aide dans un cours
      oneHalf: false,
      oneQuarter: false,
      threeQuarters: false,
      multiplication: false,
      copyright: false,
      trademark: false,
      servicemark: false,
      registeredTrademark: false,
    }),
    FrenchSpacing,
    CourseCase,
    CourseTab,
    CourseKeys.configure({ onLink }),
  ];
}
