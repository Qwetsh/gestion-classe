/**
 * Classeur virtuel (lot 2) : l'écriture de l'élève. Fonctions pures qui transforment le document
 * d'un cours (JSON TipTap) pour le montrer « rempli » dans le classeur, sans toucher au cours.
 *
 * - Page de garde : les cases « Collé ✓ » sont cochées à la main.
 * - Feuille de bilans : chaque zone de lignes reçoit le bilan de son activité, lu dans la feuille
 *   « (correction) », recopié en rouge (règle de Thomas : les bilans s'écrivent en rouge).
 *
 * L'écriture est une marque ordinaire des cours (police « Écriture attachée », couleur) : le rendu
 * reste celui de l'éditeur. Les fiches d'activité ne sont pas transformées : leurs corrections sont
 * des corrigés pour le professeur (barème, tolérances), pas des copies d'élève.
 */
import type { JSONContent } from '@tiptap/core';

/** Police « Écriture attachée » du menu des cours (FONT_FAMILIES). */
export const HAND_FONT = '"Playwrite FR Moderne", cursive';
/** Encre du stylo de l'élève. */
export const INK_BLUE = '#1F3A93';
/** Rouge des bilans (le même que dans les cours). */
export const INK_RED = '#C00000';

type Mark = NonNullable<JSONContent['marks']>[number];

/** Marques d'un texte écrit à la main : la police et l'encre, plus le soulignement s'il y était. */
function inkMarks(color: string, kept: Mark[] = []): Mark[] {
  return [
    ...kept.filter((m) => m.type === 'underline'),
    { type: 'textStyle', attrs: { color, fontFamily: HAND_FONT } },
  ];
}

/** Texte brut d'un nœud (paragraphe, cellule…). */
export function plainText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(plainText).join('');
}

const mapNodes = (node: JSONContent, fn: (n: JSONContent) => JSONContent): JSONContent => {
  const next = fn(node);
  return next.content ? { ...next, content: next.content.map((c) => mapNodes(c, fn)) } : next;
};

/** Le document contient-il de l'écriture d'élève ? */
export function hasInk(content: JSONContent): boolean {
  if (content.marks?.some((m) => m.type === 'textStyle' && m.attrs?.fontFamily === HAND_FONT)) return true;
  return (content.content ?? []).some(hasInk);
}

// ---------------------------------------------------------------------------------------------
// Page de garde : « Collé ✓ » coché
// ---------------------------------------------------------------------------------------------

/** Coche à la main chaque case vide (☐) de la page de garde. */
export function tickCover(content: JSONContent): JSONContent {
  return mapNodes(content, (n) => {
    if (n.type !== 'text' || (n.text ?? '').trim() !== '☐') return n;
    const size = n.marks?.find((m) => m.type === 'textStyle')?.attrs?.fontSize as string | undefined;
    return {
      ...n,
      text: '✓',
      marks: [{ type: 'bold' }, { type: 'textStyle', attrs: { color: INK_BLUE, ...(size ? { fontSize: size } : {}) } }],
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Feuille de bilans : les bilans recopiés en rouge
// ---------------------------------------------------------------------------------------------

const cellsOf = (table: JSONContent): JSONContent[] =>
  (table.content ?? []).flatMap((row) => row.content ?? []).filter((c) => c.type === 'tableCell' || c.type === 'tableHeader');

/** Cellule « Bilan : » d'un tableau d'activité : son premier paragraphe porte l'intitulé. */
const isSummaryCell = (cell: JSONContent): boolean => /^\s*bilan\s*:?\s*$/i.test(plainText(cell.content?.[0] ?? {}));

/** Repère d'un tableau d'activité : « activité 2 », lu dans sa première cellule. */
function activityKey(table: JSONContent): string | null {
  const first = cellsOf(table)[0];
  const m = first ? /^\s*(activit[ée]s?\s+[^\s—–:-]+)/iu.exec(plainText(first).normalize('NFC')) : null;
  return m ? m[1].toLocaleLowerCase('fr').replace(/\s+/g, ' ').replace('é', 'e') : null;
}

/**
 * Textes des bilans d'une feuille corrigée, par activité : les paragraphes qui suivent « Bilan : »
 * dans le tableau de chaque activité. Un tableau sans repère d'activité est rangé par son rang.
 */
export function summaryTexts(corrected: JSONContent): Map<string, JSONContent[]> {
  const out = new Map<string, JSONContent[]>();
  let rank = 0;
  for (const table of (corrected.content ?? []).filter((n) => n.type === 'table')) {
    const cell = cellsOf(table).find(isSummaryCell);
    if (!cell) continue;
    const paragraphs = (cell.content ?? []).slice(1).filter((p) => p.type === 'paragraph' && plainText(p).trim() !== '');
    if (paragraphs.length > 0) out.set(activityKey(table) ?? `#${rank}`, paragraphs);
    rank++;
  }
  return out;
}

/** Un paragraphe recopié à la main, en rouge ; les mots soulignés le restent. */
function handwritten(paragraph: JSONContent, color: string): JSONContent {
  return {
    type: 'paragraph',
    content: (paragraph.content ?? []).map((n) => (n.type === 'text' ? { ...n, marks: inkMarks(color, n.marks) } : n)),
  };
}

/**
 * La feuille de bilans vierge, avec dans chaque zone de lignes le bilan de son activité (lu dans la
 * feuille corrigée). Une activité sans bilan corrigé garde ses lignes vides.
 */
export function fillSummaries(blank: JSONContent, corrected: JSONContent): JSONContent {
  const texts = summaryTexts(corrected);
  if (texts.size === 0) return blank;
  let rank = 0;
  return {
    ...blank,
    content: (blank.content ?? []).map((node) => {
      if (node.type !== 'table') return node;
      const cells = cellsOf(node);
      if (!cells.some(isSummaryCell)) return node;
      const found = texts.get(activityKey(node) ?? `#${rank}`);
      rank++;
      if (!found) return node;
      return mapNodes(node, (n) => {
        if ((n.type !== 'tableCell' && n.type !== 'tableHeader') || !isSummaryCell(n)) return n;
        const kept = (n.content ?? []).filter((c) => c.type !== 'writingZone');
        return { ...n, content: [...kept, ...found.map((p) => handwritten(p, INK_RED))] };
      });
    }),
  };
}
