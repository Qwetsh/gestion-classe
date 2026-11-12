/**
 * Collage dans l'éditeur de cours (AUDIT_editeur_texte.md, lot T5).
 *
 * - « Adapter au cours » (Ctrl+V, défaut) : le texte collé depuis Word, Writer, Google Docs ou
 *   une page web prend l'apparence du cours. On garde la structure (titres, listes, tableaux),
 *   le gras, l'italique, le soulignement, les couleurs vives et les surlignages ; on retire
 *   polices, tailles, interlignes, marges, gris et noirs « automatiques », et le balisage propre
 *   à Word (mso-*, o:p…). Les listes de Word (paragraphes « MsoList… ») redeviennent des listes.
 * - « Garder la mise en forme » : on retire seulement le balisage parasite.
 * - « Texte seul » : Ctrl+Maj+V ou le menu du bouton Coller (géré par ProseMirror).
 *
 * Images : celles d'une page web restent d'abord liées au site, celles incrustées (data:) sont
 * converties en fichiers locaux ; toutes sont ensuite rapatriées dans le stockage du cours
 * (`CourseEditor`). Les images de Word (« file:/// », illisibles par le navigateur) sont
 * retirées et comptées pour prévenir l'utilisateur.
 *
 * Un collage interne à l'éditeur (copier-coller dans le même cours, reconnu à `data-pm-slice`)
 * n'est pas touché, sauf les encarts : un encart copié reçoit sa propre page.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Fragment, Slice, type Node as PMNode } from '@tiptap/pm/model';

export type PasteMode = 'adapt' | 'keep';

interface PasteOptions {
  /** Mode du prochain collage HTML (le bouton Coller peut demander « garder la mise en forme »). */
  getMode: () => PasteMode;
  /** Des images n'ont pas pu être reprises (fichiers locaux de Word). */
  onDroppedImages: (count: number) => void;
  /** Un encart collé reprenait la page d'un encart existant : copier `fromId` vers `toId`. */
  onDuplicateEncart: (fromId: string, toId: string) => void;
  /** Fichiers image seuls (capture d'écran, image copiée) : à envoyer au stockage. */
  onImageFiles: (files: File[]) => void;
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------------------------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------------------------

function parseColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'inherit' || v === 'initial') return null;
  if (v === 'auto' || v === 'windowtext' || v === 'black' || v === 'currentcolor') return [0, 0, 0];
  if (v === 'white' || v === 'window') return [255, 255, 255];
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as [number, number, number];
  m = v.match(/^#([0-9a-f]{6})$/);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number];
  m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  // Nom de couleur (« red », « darkblue »…) : le canevas le traduit en #rrggbb
  if (/^[a-z]+$/.test(v)) {
    const ctx = colorCanvas();
    if (ctx) {
      ctx.fillStyle = '#010203';
      ctx.fillStyle = v;
      const hex = String(ctx.fillStyle);
      if (hex !== '#010203') return parseColor(hex);
    }
  }
  return null;
}

let canvasCtx: CanvasRenderingContext2D | null | undefined;
function colorCanvas(): CanvasRenderingContext2D | null {
  if (canvasCtx === undefined) canvasCtx = document.createElement('canvas').getContext('2d');
  return canvasCtx;
}

/** Couleur « neutre » (noir, gris, blanc) : la couleur du texte par défaut, à ne pas reprendre. */
function isNeutral(value: string): boolean {
  const rgb = parseColor(value);
  if (!rgb) return true;
  const max = Math.max(...rgb), min = Math.min(...rgb);
  return max - min < 40; // peu saturée : noir, gris, blanc
}

// ---------------------------------------------------------------------------------------------
// Nettoyage du HTML
// ---------------------------------------------------------------------------------------------

/** Déclarations CSS gardées sur un élément, selon le mode. */
function cleanStyle(el: HTMLElement, mode: PasteMode): void {
  const style = el.getAttribute('style');
  if (!style) return;
  const kept: string[] = [];
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim();
    if (!value || prop.startsWith('mso-') || prop.startsWith('-')) continue;
    const isCell = el.tagName === 'TD' || el.tagName === 'TH';
    switch (prop) {
      case 'font-weight':
      case 'font-style':
      case 'text-decoration':
      case 'text-decoration-line':
      case 'vertical-align':
        kept.push(`${prop}: ${value}`);
        break;
      case 'text-align':
        if (/^(center|right|justify)$/i.test(value)) kept.push(`${prop}: ${value}`);
        break;
      case 'color':
        // Les titres prennent la couleur des titres du cours (Word les colore en bleu)
        if (mode === 'keep' || (!isNeutral(value) && !el.closest('h1, h2, h3, h4, h5, h6'))) kept.push(`${prop}: ${value}`);
        break;
      case 'background':
      case 'background-color': {
        const color = value.split(/\s+/).find((part) => parseColor(part)) ?? value;
        const rgb = parseColor(color);
        const white = rgb && rgb.every((c) => c > 245);
        if (rgb && !white) kept.push(`background-color: ${color}`);
        break;
      }
      case 'font-family':
      case 'font-size':
        if (mode === 'keep' && !isCell) kept.push(`${prop}: ${value}`);
        break;
      default:
        // polices, tailles, interlignes, marges, retraits, largeurs, bordures… : au cours de décider
        break;
    }
  }
  if (kept.length) el.setAttribute('style', kept.join('; '));
  else el.removeAttribute('style');
}

/** Remplace un élément par ses enfants. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** Paragraphes de liste de Word (« mso-list: l0 level2 lfo1 ») → vraies listes imbriquées. */
function convertWordLists(body: HTMLElement): void {
  const isListPara = (n: Element | null) => !!n && n.tagName === 'P' && /mso-list:\s*l\d+\s+level\d+/i.test(n.getAttribute('style') ?? '');
  const children = Array.from(body.children);
  let i = 0;
  while (i < children.length) {
    if (!isListPara(children[i])) { i++; continue; }
    // Une suite de paragraphes de liste consécutifs = une liste
    const run: Element[] = [];
    while (i < children.length && isListPara(children[i])) run.push(children[i++]);

    const stack: { level: number; list: HTMLElement }[] = [];
    const first = run[0];
    for (const p of run) {
      const level = Number((p.getAttribute('style') ?? '').match(/level(\d+)/i)?.[1] ?? 1);
      // La puce ou le numéro de Word est dans un span « mso-list: Ignore »
      const marker = p.querySelector('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]');
      const markerText = (marker?.textContent ?? '').replace(/\u00a0/g, ' ').trim();
      marker?.remove();
      const ordered = /^[\dA-Za-z]{1,4}[.)]/.test(markerText);
      const type = /^[ivxlc]+[.)]/.test(markerText) ? 'i' : /^[IVXLC]+[.)]/.test(markerText) ? 'I' : /^[a-z][.)]/.test(markerText) ? 'a' : /^[A-Z][.)]/.test(markerText) ? 'A' : null;

      while (stack.length && stack[stack.length - 1].level > level) stack.pop();
      let current = stack[stack.length - 1];
      if (!current || current.level < level) {
        const list = body.ownerDocument.createElement(ordered ? 'ol' : 'ul');
        if (ordered && type) list.setAttribute('type', type);
        if (current) {
          const lastItem = current.list.lastElementChild ?? current.list.appendChild(body.ownerDocument.createElement('li'));
          lastItem.appendChild(list);
        } else {
          body.insertBefore(list, first);
        }
        current = { level, list };
        stack.push(current);
      }
      const li = body.ownerDocument.createElement('li');
      const para = body.ownerDocument.createElement('p');
      while (p.firstChild) para.appendChild(p.firstChild);
      li.appendChild(para);
      current.list.appendChild(li);
      p.remove();
    }
  }
}

export interface CleanResult {
  html: string;
  droppedImages: number;
}

/** Nettoie un HTML collé venu d'ailleurs (Word, Writer, Google Docs, page web). */
export function cleanPastedHTML(html: string, mode: PasteMode): CleanResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  let droppedImages = 0;

  // Commentaires (dont les « [if !supportLists] » de Word) et balisage sans contenu utile
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));
  body.querySelectorAll('style, meta, link, script, noscript, xml, template, iframe, object, embed, svg, canvas, button, input, select, textarea, nav, form').forEach((el) => el.remove());

  // Google Docs entoure tout d'un <b style="font-weight:normal"> : tout deviendrait gras
  body.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
  // Balises de Word sans équivalent (o:p, w:sdt…)
  body.querySelectorAll('*').forEach((el) => { if (el.tagName.includes(':')) unwrap(el); });

  // Titre et sous-titre de Word
  body.querySelectorAll('p.MsoTitle').forEach((p) => { const h = doc.createElement('h1'); while (p.firstChild) h.appendChild(p.firstChild); p.replaceWith(h); });
  // Titres 4 à 6 : le cours n'a que trois niveaux
  body.querySelectorAll('h4, h5, h6').forEach((h) => { const h3 = doc.createElement('h3'); while (h.firstChild) h3.appendChild(h.firstChild); h.replaceWith(h3); });

  convertWordLists(body);

  // Images
  body.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    if (/^data:image\//i.test(src)) {
      // Image incrustée : un fichier local (blob:), rapatrié ensuite comme les autres
      try {
        const [meta, data] = src.split(',');
        const type = meta.match(/data:(.*?);/)?.[1] ?? 'image/png';
        const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
        img.setAttribute('src', URL.createObjectURL(new Blob([bytes], { type })));
      } catch {
        img.remove();
        droppedImages++;
      }
    } else if (!/^(https?:|blob:)/i.test(src)) {
      // file:///… (Word), cid:…, chemin relatif : le navigateur ne peut pas le lire
      img.remove();
      droppedImages++;
    } else {
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.removeAttribute('srcset');
    }
  });

  // Attributs : on ne garde que ce que l'éditeur sait lire
  const KEEP_ATTRS = new Set(['href', 'src', 'alt', 'colspan', 'rowspan', 'type', 'start', 'style', 'data-type', 'data-checked']);
  body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP_ATTRS.has(attr.name)) el.removeAttribute(attr.name);
    }
    cleanStyle(el as HTMLElement, mode);
    if (el.tagName === 'A' && !/^(https?:|mailto:|tel:)/i.test(el.getAttribute('href') ?? '')) unwrap(el);
  });

  // Paragraphes vides en série (Word en met entre chaque bloc) : on en garde un au plus
  body.querySelectorAll('p').forEach((p) => {
    const empty = !p.textContent?.replace(/\u00a0/g, '').trim() && !p.querySelector('img');
    const prev = p.previousElementSibling;
    if (empty && prev?.tagName === 'P' && !prev.textContent?.replace(/\u00a0/g, '').trim()) p.remove();
  });

  return { html: body.innerHTML, droppedImages };
}

/** Le HTML a-t-il du texte (et pas seulement une image) ? */
function hasText(html: string): boolean {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return !!doc.body.textContent?.replace(/\u00a0/g, '').trim();
}

// ---------------------------------------------------------------------------------------------
// Encarts copiés : chacun sa page
// ---------------------------------------------------------------------------------------------

function existingPageIds(doc: PMNode): Set<string> {
  const ids = new Set<string>();
  doc.descendants((node) => { if (node.type.name === 'encart' && node.attrs.pageId) ids.add(node.attrs.pageId as string); });
  return ids;
}

function remapEncarts(fragment: Fragment, taken: Set<string>, onCopy: (from: string, to: string) => void): Fragment {
  const nodes: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.type.name === 'encart' && node.attrs.pageId && taken.has(node.attrs.pageId as string)) {
      const to = newId();
      onCopy(node.attrs.pageId as string, to);
      nodes.push(node.type.create({ ...node.attrs, pageId: to }, node.content, node.marks));
    } else if (node.childCount > 0) {
      nodes.push(node.copy(remapEncarts(node.content, taken, onCopy)));
    } else {
      nodes.push(node);
    }
  });
  return Fragment.from(nodes);
}

// ---------------------------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------------------------

export const CoursePaste = Extension.create<PasteOptions>({
  name: 'coursePaste',

  addOptions() {
    return {
      getMode: () => 'adapt',
      onDroppedImages: () => undefined,
      onDuplicateEncart: () => undefined,
      onImageFiles: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey('coursePaste'),
        props: {
          handlePaste: (_view, event) => {
            const data = event.clipboardData;
            if (!data) return false;
            const files = Array.from(data.files ?? []).filter((f) => f.type.startsWith('image/'));
            if (files.length === 0) return false;
            // Word joint une image de la sélection à son HTML : si le HTML a du texte, c'est lui qu'on colle
            const html = data.getData('text/html');
            if (html && hasText(html)) return false;
            options.onImageFiles(files);
            return true;
          },
          transformPastedHTML: (html) => {
            if (/data-pm-slice/.test(html)) return html; // copier-coller dans l'éditeur
            const { html: clean, droppedImages } = cleanPastedHTML(html, options.getMode());
            if (droppedImages > 0) options.onDroppedImages(droppedImages);
            return clean;
          },
          transformPasted: (slice, view) => {
            const taken = existingPageIds(view.state.doc);
            if (taken.size === 0) return slice;
            return new Slice(remapEncarts(slice.content, taken, options.onDuplicateEncart), slice.openStart, slice.openEnd);
          },
        },
      }),
    ];
  },
});
