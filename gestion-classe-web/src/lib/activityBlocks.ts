/**
 * Prélever un morceau d'un document d'activité pour le poser sur le tableau blanc en direct.
 * Fonctions pures sur le document ProseMirror du cours (aucun accès au DOM ni à la base).
 *
 * Sélection « intelligente » : un toucher choisit le plus petit bloc utile (un paragraphe, une
 * image, un titre) ; chaque nouveau toucher sur la même sélection l'élargit d'un cran :
 *  - paragraphe d'une liste → l'élément de la liste → toute la liste ;
 *  - paragraphe d'un tableau → la cellule → la ligne → le tableau ;
 *  - paragraphe d'un encadré → l'encadré ;
 *  - paragraphe numéroté (« 1. ») → la question entière, avec ce qui la suit jusqu'à la suivante.
 * « + suivant » ajoute le bloc d'après.
 */
import type { Node as PMNode } from '@tiptap/pm/model';

/** Un morceau du document, de `from` à `to` (positions ProseMirror alignées sur des nœuds frères). */
export interface PickRange {
  from: number;
  to: number;
  /** Ce que c'est, pour le libellé : « Paragraphe », « Question », « Tableau »… */
  label: string;
}

const LEAF_LABEL: Record<string, string> = {
  paragraph: 'Paragraphe', heading: 'Titre', image: 'Image', dots: 'Pointillés', writingZone: 'Zone d’écriture', courseIcon: 'Icône',
};
const CONTAINER_LABEL: Record<string, string> = {
  listItem: 'Élément de liste', taskItem: 'Élément de liste', bulletList: 'Liste', orderedList: 'Liste', taskList: 'Liste',
  blockquote: 'Citation', callout: 'Encadré', tableCell: 'Cellule', tableHeader: 'Cellule', tableRow: 'Ligne', table: 'Tableau',
  columns: 'Colonnes', column: 'Colonne', encart: 'Encart',
};
/** Blocs qui ne contiennent pas de texte à choisir plus finement (feuille de page, saut). */
const IGNORED = new Set(['pageBreak', 'pointsTotal']);

/** « 1. », « 2) », « 12. » en tête d'un paragraphe : début d'une question. */
const NUMBERED = /^\s*\d{1,2}\s*[.)]\s+\S/;

export const isNumberedQuestion = (node: PMNode): boolean => node.type.name === 'paragraph' && NUMBERED.test(node.textContent);

/**
 * Questions : du paragraphe numéroté jusqu'au suivant (ou jusqu'à un titre, un saut de page, la fin
 * du conteneur). Null si la question tient en un seul bloc (rien de plus à choisir).
 */
function questionRange(doc: PMNode, nodePos: number): PickRange | null {
  const node = doc.nodeAt(nodePos);
  if (!node || !isNumberedQuestion(node)) return null;
  const $pos = doc.resolve(nodePos);
  const parent = $pos.parent;
  let index = $pos.index();
  let to = nodePos + node.nodeSize;
  for (index += 1; index < parent.childCount; index++) {
    const next = parent.child(index);
    if (isNumberedQuestion(next) || next.type.name === 'heading' || IGNORED.has(next.type.name)) break;
    to += next.nodeSize;
  }
  return to > nodePos + node.nodeSize ? { from: nodePos, to, label: 'Question' } : null;
}

/**
 * Les choix possibles à partir d'un toucher, du plus petit au plus grand, sans doublon.
 * `pos` : position de texte sous le doigt ; `inside` : position du nœud sans texte touché (image,
 * zone d'écriture), ou -1.
 */
export function pickLevels(doc: PMNode, pos: number, inside = -1): PickRange[] {
  const levels: PickRange[] = [];
  const push = (r: PickRange | null) => {
    if (!r) return;
    const last = levels[levels.length - 1];
    if (last && last.from === r.from && last.to === r.to) return;
    // Un niveau plus large doit contenir le précédent
    if (last && !(r.from <= last.from && r.to >= last.to)) return;
    levels.push(r);
  };

  let $at;
  if (inside >= 0 && doc.nodeAt(inside) && doc.nodeAt(inside)!.isAtom) {
    const atom = doc.nodeAt(inside)!;
    if (IGNORED.has(atom.type.name)) return [];
    push({ from: inside, to: inside + atom.nodeSize, label: LEAF_LABEL[atom.type.name] ?? 'Bloc' });
    $at = doc.resolve(inside);
  } else {
    $at = doc.resolve(Math.max(0, Math.min(doc.content.size, pos)));
    // Le plus petit bloc de texte sous le doigt
    for (let d = $at.depth; d >= 1; d--) {
      const n = $at.node(d);
      if (n.isTextblock) {
        push({ from: $at.before(d), to: $at.after(d), label: LEAF_LABEL[n.type.name] ?? 'Paragraphe' });
        push(questionRange(doc, $at.before(d)));
        break;
      }
    }
  }

  // Les conteneurs, du plus proche au plus éloigné
  for (let d = $at.depth; d >= 1; d--) {
    const n = $at.node(d);
    if (n.isTextblock) continue;
    const label = CONTAINER_LABEL[n.type.name];
    if (!label) continue;
    push({ from: $at.before(d), to: $at.after(d), label });
  }
  return levels;
}

/** Ajoute `count` blocs frères à la suite de la sélection (jamais au-delà de leur conteneur). */
export function extendRange(doc: PMNode, range: PickRange, count: number): PickRange {
  let to = range.to;
  for (let i = 0; i < count; i++) {
    const after = doc.resolve(to).nodeAfter;
    if (!after || IGNORED.has(after.type.name)) break;
    to += after.nodeSize;
  }
  return to === range.to ? range : { ...range, to };
}

// ---------------------------------------------------------------------------------------------
// Contenu prélevé : texte pour le tableau, tableau, images
// ---------------------------------------------------------------------------------------------

export interface PickedImage {
  /** Chemin dans le stockage des cours (image téléversée) ; null si l'image vient d'une adresse. */
  path: string | null;
  src: string | null;
  alt: string | null;
}

export interface PickedContent {
  /** HTML pour une zone de texte du tableau (à assainir avant l'insertion). Vide si la sélection n'est qu'un tableau ou des images. */
  html: string;
  /** Texte brut, pour le libellé et les tests. */
  text: string;
  /** La sélection est exactement un tableau : cellules en HTML de zone de texte, première ligne = en-tête. */
  table: { cells: string[][]; header: boolean } | null;
  images: PickedImage[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const HEX = /^#[0-9a-f]{3,8}$/i;

/** Texte en ligne d'un paragraphe : gras, italique, souligné, exposant, indice, couleur. */
function inlineHtml(node: PMNode): string {
  let out = '';
  node.forEach((child) => {
    if (child.type.name === 'hardBreak') { out += '<br>'; return; }
    if (child.type.name === 'dots') { out += '……'; return; }
    if (!child.isText) return;
    let s = esc(child.text ?? '');
    for (const m of child.marks) {
      const name = m.type.name;
      if (name === 'bold') s = `<b>${s}</b>`;
      else if (name === 'italic') s = `<i>${s}</i>`;
      else if (name === 'underline') s = `<u>${s}</u>`;
      else if (name === 'superscript') s = `<sup>${s}</sup>`;
      else if (name === 'subscript') s = `<sub>${s}</sub>`;
      else if (name === 'textStyle') {
        const color = m.attrs.color as string | undefined;
        if (color && HEX.test(color)) s = `<span style="color: ${color}">${s}</span>`;
      }
    }
    out += s;
  });
  return out;
}

const imageOf = (n: PMNode): PickedImage => ({ path: (n.attrs.path as string | null) ?? null, src: (n.attrs.src as string | null) ?? null, alt: (n.attrs.alt as string | null) ?? null });

/** Lignes de texte d'un bloc, avec le marqueur des listes (« • », « 1. », « ☐ »). */
function blockLines(node: PMNode, marker: string | null, depth: number, lines: string[], images: PickedImage[]): void {
  const name = node.type.name;
  if (name === 'image') { images.push(imageOf(node)); return; }
  if (IGNORED.has(name) || name === 'writingZone' || name === 'courseIcon') return;
  if (node.isTextblock) {
    const html = inlineHtml(node);
    if (!html && !marker) return;
    const body = name === 'heading' ? `<b>${html}</b>` : html;
    lines.push(`${'&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(depth)}${marker ? `${marker}&nbsp;` : ''}${body}`);
    return;
  }
  if (name === 'bulletList' || name === 'orderedList' || name === 'taskList') {
    let n = Number(node.attrs.start) || 1;
    node.forEach((item) => {
      const m = name === 'bulletList' ? '•' : name === 'taskList' ? '☐' : `${n++}.`;
      let first = true;
      item.forEach((child) => {
        blockLines(child, first ? m : null, first ? depth : depth + 1, lines, images);
        first = false;
      });
    });
    return;
  }
  if (name === 'table') {
    // Dans une sélection plus large : une ligne de texte par ligne du tableau
    node.forEach((row) => {
      const cells: string[] = [];
      row.forEach((cell) => cells.push(cellHtml(cell)));
      lines.push(cells.join(' | '));
    });
    return;
  }
  node.forEach((child) => blockLines(child, null, depth, lines, images));
}

/** Contenu d'une cellule en HTML de zone de texte (paragraphes séparés par un saut de ligne). */
function cellHtml(cell: PMNode): string {
  const parts: string[] = [];
  const images: PickedImage[] = [];
  cell.forEach((child) => blockLines(child, null, 0, parts, images));
  return parts.join('<br>');
}

/** Contenu d'une sélection, prêt à être posé sur le tableau. */
export function pickedContent(doc: PMNode, range: PickRange): PickedContent {
  const slice = doc.slice(range.from, range.to, false);
  const nodes: PMNode[] = [];
  slice.content.forEach((n) => nodes.push(n));

  // Un tableau seul : un objet tableau du tableau blanc
  const only = nodes.length === 1 && nodes[0].type.name === 'table' ? nodes[0] : null;
  const rows: string[][] = [];
  let header = false;
  if (only) {
    only.forEach((row, _o, i) => {
      const cells: string[] = [];
      row.forEach((cell) => {
        cells.push(cellHtml(cell));
        if (i === 0 && cell.type.name === 'tableHeader') header = true;
      });
      rows.push(cells);
    });
    const width = Math.max(1, ...rows.map((r) => r.length));
    for (const r of rows) while (r.length < width) r.push('');
  }

  const lines: string[] = [];
  const images: PickedImage[] = [];
  if (only) only.descendants((d) => { if (d.type.name === 'image') images.push(imageOf(d)); return true; });
  else for (const n of nodes) blockLines(n, null, 0, lines, images);
  const html = lines.map((l) => `<div>${l}</div>`).join('');
  return {
    html,
    text: slice.content.textBetween(0, slice.content.size, '\n', ' '),
    table: only && rows.length > 0 ? { cells: rows, header } : null,
    images,
  };
}
