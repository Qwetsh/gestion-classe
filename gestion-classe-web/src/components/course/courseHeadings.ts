/**
 * Titres d'un cours et leur numéro (lot T7, volet « Plan du cours ») : même numérotation que
 * les compteurs CSS de course.css (Titre 2 / Titre 3 selon le réglage du document).
 */
import type { Node as PMNode } from '@tiptap/pm/model';
import type { HeadingNumbering } from '../../lib/course/courseDoc';

export interface OutlineItem {
  pos: number;
  level: number;
  text: string;
  number: string;
}

const roman = (n: number): string => {
  const table: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
};
const alpha = (n: number): string => {
  let out = '';
  while (n > 0) { n--; out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26); }
  return out;
};

/** Titres du document, avec la même numérotation que les compteurs CSS (course.css). */
export function outlineOf(doc: PMNode, numbering: HeadingNumbering | undefined): OutlineItem[] {
  const items: OutlineItem[] = [];
  let h2 = 0;
  let h3 = 0;
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true;
    const level = Number(node.attrs.level) || 1;
    const text = node.textContent.trim();
    let number = '';
    if (level === 2) { h2++; h3 = 0; }
    if (level === 3) h3++;
    if (text && numbering && numbering !== 'none') {
      if (level === 2) number = numbering === 'roman' ? `${roman(h2)}.` : `${h2}.`;
      if (level === 3) number = numbering === 'roman' ? `${h3}.` : numbering === 'alpha' ? `${alpha(h3)}.` : `${h2}.${h3}`;
    }
    items.push({ pos, level, text, number });
    return false;
  });
  return items;
}
