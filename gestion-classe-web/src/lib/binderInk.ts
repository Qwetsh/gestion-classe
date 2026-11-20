/**
 * Classeur virtuel (lot 2) : l'écriture de l'élève. Fonctions pures qui transforment le document
 * d'un cours (JSON TipTap) pour le montrer « rempli » dans le classeur, sans toucher au cours.
 *
 * - Page de garde : les cases « Collé ✓ » sont cochées à la main.
 * - Feuille de bilans : chaque zone de lignes reçoit le bilan de son activité, lu dans la feuille
 *   « (correction) », recopié en rouge (règle de Thomas : les bilans s'écrivent en rouge).
 *
 * - Fiche d'activité : les réponses de sa « (copie modèle) » sont écrites à la main, dans l'ordre,
 *   dans ses zones à remplir (zones de lignes, pointillés, cellules vides), et les cases de
 *   « J'ai réussi » sont cochées. La correction ne sert pas : c'est un corrigé pour le professeur
 *   (barème et tolérances mêlés aux réponses).
 *
 * L'écriture est une marque ordinaire des cours (police « Écriture attachée », couleur) : le rendu
 * reste celui de l'éditeur.
 */
import type { JSONContent } from '@tiptap/core';

/** Police « Écriture attachée » du menu des cours (FONT_FAMILIES). */
export const HAND_FONT = '"Playwrite FR Moderne", cursive';
/** Encre du stylo de l'élève. */
export const INK_BLUE = '#1F3A93';
/** Rouge des bilans (le même que dans les cours). */
export const INK_RED = '#C00000';

type Mark = NonNullable<JSONContent['marks']>[number];

/** Taille de l'écriture posée sur des lignes ; sa présence dit au rendu de tracer les lignes. */
export const RULED_SIZE = '9.5pt';
/** Taille de l'écriture dans une cellule de tableau : petite, les colonnes sont étroites. */
export const CELL_SIZE = '8pt';

/**
 * Marques d'un texte écrit à la main : la police et l'encre, plus le soulignement s'il y était.
 * `size` : RULED_SIZE pour une zone d'écriture remplie, CELL_SIZE dans une cellule de tableau ;
 * sans taille, l'écriture prend celle de la phrase où elle se glisse.
 */
function inkMarks(color: string, kept: Mark[] = [], size?: string): Mark[] {
  return [
    ...kept.filter((m) => m.type === 'underline'),
    { type: 'textStyle', attrs: { color, fontFamily: HAND_FONT, ...(size ? { fontSize: size } : {}) } },
  ];
}

const isInk = (n: JSONContent): boolean =>
  n.type === 'text' && !!n.marks?.some((m) => m.type === 'textStyle' && m.attrs?.fontFamily === HAND_FONT);

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
    content: (paragraph.content ?? []).map((n) => (n.type === 'text' ? { ...n, marks: inkMarks(color, n.marks, RULED_SIZE) } : n)),
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

// ---------------------------------------------------------------------------------------------
// Fiche d'activité : les réponses de la copie modèle, écrites dans les zones à remplir
// ---------------------------------------------------------------------------------------------

/** Une réponse : le texte écrit par l'élève, ou null pour laisser la zone vide. */
export type ModelAnswer = JSONContent[] | null;

/**
 * Réponses d'une copie modèle, dans l'ordre des zones à remplir de la fiche. Chaque paragraphe
 * de premier niveau qui porte de l'écriture est une réponse (son texte imprimé, un repère comme
 * « Question 2 », est ignoré) ; un tiret seul laisse la zone vide. Les paragraphes sans écriture
 * sont des notes.
 */
export function modelAnswers(copy: JSONContent): ModelAnswer[] {
  const out: ModelAnswer[] = [];
  for (const block of copy.content ?? []) {
    if (block.type !== 'paragraph') continue;
    const ink = (block.content ?? []).filter(isInk);
    if (ink.length === 0) continue;
    const written = ink.map((n) => n.text ?? '').join('').trim();
    out.push(written === '' || written === '—' || written === '-' ? null : ink);
  }
  return out;
}

const isBlankCell = (n: JSONContent): boolean =>
  (n.type === 'tableCell' || n.type === 'tableHeader')
  && (n.content ?? []).length === 1 && n.content![0].type === 'paragraph' && (n.content![0].content ?? []).length === 0;

/** Encadré « J'ai réussi l'activité si je peux : ». */
const SUCCESS = /j['’]ai r[ée]ussi/i;

/** Champs de la ligne d'identité d'une fiche. */
const IDENTITY = /(^|[^\p{L}])(nom|pr[ée]nom|classe|date)\s*:/iu;

/** Lettres écrites par ligne d'une zone de lignes (pleine largeur) : sert à garder les lignes restantes. */
const CHARS_PER_LINE = 78;

/**
 * La fiche, avec les réponses écrites à la main dans ses zones à remplir, prises dans l'ordre du
 * document : zone d'écriture (le texte est posé sur des lignes, les lignes en trop restent),
 * pointillés dans une phrase (sauf ceux de la ligne d'identité : nom, prénom, classe, date),
 * cellule vide d'un tableau. Sans réponse pour une zone, elle reste vide. Les cases de la liste « J'ai réussi » sont cochées.
 */
export function fillSheet(sheet: JSONContent, answers: ModelAnswer[]): JSONContent {
  if (!answers.some((a) => a)) return sheet;
  let next = 0;
  const take = (): ModelAnswer | undefined => answers[next++];
  const colored = (ink: JSONContent[], size?: string): JSONContent[] =>
    ink.map((n) => ({ ...n, marks: inkMarks(INK_BLUE, n.marks, size) }));

  const visit = (node: JSONContent, success = false): JSONContent[] => {
    if (node.type === 'writingZone') {
      const answer = take();
      if (!answer) return [node];
      const lines = Number(node.attrs?.lines) || 0;
      const used = Math.ceil(answer.reduce((n, t) => n + (t.text ?? '').length, 0) / CHARS_PER_LINE);
      const written: JSONContent = { type: 'paragraph', content: colored(answer, RULED_SIZE) };
      return lines - used > 0 ? [written, { ...node, attrs: { ...node.attrs, lines: lines - used } }] : [written];
    }
    if (isBlankCell(node)) {
      const answer = take();
      return answer ? [{ ...node, content: [{ ...node.content![0], content: colored(answer, CELL_SIZE) }] }] : [node];
    }
    if (node.type === 'dots') {
      const answer = take();
      return answer ? colored(answer) : [node];
    }
    // Ligne d'identité (« Nom : …… Prénom : …… Classe : …… ») : ses pointillés ne sont pas des réponses
    if (node.type === 'paragraph' && IDENTITY.test(plainText(node))) return [node];
    // Les cases de l'encadré « J'ai réussi » sont cochées ; les autres cases (un choix à faire) restent
    const inSuccess = success || (node.type === 'callout' && SUCCESS.test(String(node.attrs?.title ?? '')));
    if (node.type === 'taskItem' && inSuccess) return [{ ...node, attrs: { ...node.attrs, checked: true }, content: (node.content ?? []).flatMap((c) => visit(c, true)) }];
    return [node.content ? { ...node, content: node.content.flatMap((c) => visit(c, inSuccess)) } : node];
  };
  return visit(sheet)[0];
}
