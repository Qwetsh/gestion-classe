/**
 * Zones de texte du tableau blanc : modèle, nettoyage du HTML et rendu canvas.
 *
 * L'édition se fait dans un `contenteditable` (overlay DOM) ; le HTML produit est
 * ramené à un sous-ensemble sûr et stable, puis re-dessiné sur canvas pour les
 * vignettes, la relecture d'une séance et l'export PDF.
 *
 * Deux règles rendent le rendu identique à toute échelle :
 * - les positions et la taille de base sont en unités logiques (page = 1000 de large) ;
 * - les tailles de caractères d'une sélection sont relatives (`em`), jamais en pixels.
 */

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TextBox {
  id: string;
  /** Coin haut-gauche, en unités logiques. */
  x: number;
  y: number;
  /** Largeur du bloc, en unités logiques (la hauteur découle du contenu). */
  w: number;
  /** Taille de base, en unités logiques. */
  size: number;
  /** Identifiant de police (voir BOARD_FONTS). */
  font: string;
  /** Couleur par défaut du bloc. */
  color: string;
  /** HTML restreint (voir sanitizeBoardHtml). */
  html: string;
  /** Fond coloré (post-it) : la zone est alors rembourrée d'une demi-taille de police. */
  background?: string;
}

/** Marge intérieure d'une zone à fond coloré, en unités. */
export const textBoxPadding = (box: TextBox) => (box.background ? box.size * 0.5 : 0);

export interface BoardFont {
  id: string;
  label: string;
  css: string;
}

export const BOARD_FONTS: BoardFont[] = [
  { id: 'sans', label: 'Sans (Inter)', css: 'Inter, system-ui, Arial, sans-serif' },
  { id: 'arial', label: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { id: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  { id: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { id: 'courier', label: 'Courier New', css: '"Courier New", Courier, monospace' },
  { id: 'comic', label: 'Comic Sans MS', css: '"Comic Sans MS", "Comic Sans", cursive' },
];

const FONT_BY_ID = new Map(BOARD_FONTS.map((f) => [f.id, f]));

export function fontCss(id: string | null | undefined): string {
  return (id && FONT_BY_ID.get(id)?.css) || BOARD_FONTS[0].css;
}

/** Tailles proposées dans la barre d'outils, en unités logiques. */
export const TEXT_SIZES = [16, 20, 24, 28, 34, 42, 54, 72];
export const DEFAULT_TEXT_SIZE = 28;
/** Interligne, en multiples de la taille de police. */
export const LINE_HEIGHT = 1.34;
/** Décalage horizontal d'un niveau d'indentation, en em. */
export const INDENT_EM = 2;
/** Largeur par défaut d'une nouvelle zone, en unités logiques. */
export const DEFAULT_TEXT_WIDTH = 420;
export const MIN_TEXT_WIDTH = 80;

// ---- Nettoyage du HTML ----

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'H1', 'H2', 'H3', 'BLOCKQUOTE']);
const INLINE_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'SUB', 'SUP', 'BR', 'FONT']);
const KEEP_TAGS = new Set([...BLOCK_TAGS, ...INLINE_TAGS]);
/** Balises supprimées avec leur contenu (jamais du texte à afficher). */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG', 'CANVAS', 'AUDIO', 'VIDEO', 'IMG']);

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|[a-z]+)$/i;

function safeColor(value: string | null | undefined): string | null {
  const v = (value || '').trim();
  if (!v || v === 'transparent' || v === 'initial' || v === 'inherit') return null;
  return COLOR_RE.test(v) ? v : null;
}

/** Taille de police retenue uniquement si exprimée en em (stable à toute échelle). */
function safeFontEm(value: string | null | undefined): string | null {
  const m = /^([\d.]+)em$/.exec((value || '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 8) return null;
  return `${Math.round(n * 100) / 100}em`;
}

function safeFamily(value: string | null | undefined): string | null {
  const v = (value || '').trim().replace(/["']/g, '');
  if (!v) return null;
  const match = BOARD_FONTS.find((f) => f.css.replace(/["']/g, '').toLowerCase().startsWith(v.split(',')[0].toLowerCase()));
  return match ? match.css : null;
}

/** Taille héritée de `execCommand('fontSize')` : <font size="1..7"> → em. */
const FONT_SIZE_EM: Record<string, string> = {
  '1': '0.6em', '2': '0.8em', '3': '1em', '4': '1.2em', '5': '1.6em', '6': '2em', '7': '2.6em',
};

function cleanElement(el: HTMLElement) {
  // <font> (produit par execCommand) → <span> équivalent
  if (el.tagName === 'FONT') {
    const span = el.ownerDocument.createElement('span');
    const color = safeColor(el.getAttribute('color'));
    const face = safeFamily(el.getAttribute('face'));
    const size = FONT_SIZE_EM[el.getAttribute('size') || ''];
    if (color) span.style.color = color;
    if (face) span.style.fontFamily = face;
    if (size) span.style.fontSize = size;
    while (el.firstChild) span.appendChild(el.firstChild);
    el.replaceWith(span);
    el = span;
  }

  const style = el.style;
  const keep: Record<string, string> = {};
  const color = safeColor(style.color);
  const bg = safeColor(style.backgroundColor);
  const family = safeFamily(style.fontFamily);
  const size = safeFontEm(style.fontSize);
  const align = style.textAlign;
  if (color) keep.color = color;
  if (bg) keep['background-color'] = bg;
  if (family) keep['font-family'] = family;
  if (size) keep['font-size'] = size;
  if (['left', 'center', 'right', 'justify'].includes(align)) keep['text-align'] = align;
  if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) keep['font-weight'] = 'bold';
  if (style.fontStyle === 'italic') keep['font-style'] = 'italic';
  const deco = style.textDecorationLine || style.textDecoration;
  if (deco && (deco.includes('underline') || deco.includes('line-through'))) {
    keep['text-decoration'] = [deco.includes('underline') ? 'underline' : '', deco.includes('line-through') ? 'line-through' : '']
      .filter(Boolean)
      .join(' ');
  }

  const indent = Number(el.getAttribute('data-indent'));
  const gap = el.getAttribute('data-gap');
  for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
  if (Number.isFinite(indent) && indent > 0) el.setAttribute('data-indent', String(Math.min(8, Math.round(indent))));
  if (gap && /^[\w-]{1,40}$/.test(gap) && el.tagName === 'SPAN') el.setAttribute('data-gap', gap);
  const css = Object.entries(keep).map(([k, v]) => `${k}: ${v}`).join('; ');
  if (css) el.setAttribute('style', css);
}

/**
 * Ramène le HTML d'un contenteditable au sous-ensemble accepté :
 * balises de mise en forme, styles de couleur / police / taille (em) / alignement,
 * indentation via `data-indent`. Tout le reste est déballé ou supprimé.
 */
export function sanitizeBoardHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const root = doc.body;

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) walk(child);
    if (node === root) return;
    const el = node as HTMLElement;
    if (DROP_TAGS.has(el.tagName)) {
      el.remove();
      return;
    }
    if (!KEEP_TAGS.has(el.tagName)) {
      // Balise inconnue : on garde son contenu
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    cleanElement(el);
  };
  walk(root);

  return root.innerHTML
    .replace(/<div><br><\/div>/g, '<div><br></div>') // normalisation lisible
    .trim();
}

/** Vrai si la zone ne contient aucun texte visible. */
export function isEmptyBoardHtml(html: string): boolean {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ').trim().length === 0;
}

// ---- Analyse en blocs / segments ----

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string | null;
  bg: string | null;
  family: string | null;
  /** Multiplicateur de taille (em cumulés). */
  em: number;
  /** Exposant (1), indice (-1) ou normal (0). */
  shift: 1 | 0 | -1;
  /** Identifiant du trou (texte à trous) dont ce segment fait partie. */
  gap?: string;
}

interface Block {
  align: TextAlign;
  indent: number;
  marker: string | null;
  runs: Run[];
}

const BASE_STYLE: Omit<Run, 'text'> = {
  bold: false, italic: false, underline: false, strike: false,
  color: null, bg: null, family: null, em: 1, shift: 0,
};

function styleFrom(el: HTMLElement, parent: Omit<Run, 'text'>): Omit<Run, 'text'> {
  const s = { ...parent };
  const tag = el.tagName;
  if (tag === 'B' || tag === 'STRONG') s.bold = true;
  if (tag === 'I' || tag === 'EM') s.italic = true;
  if (tag === 'U') s.underline = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.strike = true;
  if (tag === 'SUB') s.shift = -1;
  if (tag === 'SUP') s.shift = 1;
  const st = el.style;
  if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) s.bold = true;
  if (st.fontStyle === 'italic') s.italic = true;
  const deco = st.textDecorationLine || st.textDecoration;
  if (deco?.includes('underline')) s.underline = true;
  if (deco?.includes('line-through')) s.strike = true;
  const color = safeColor(st.color);
  if (color) s.color = color;
  const bg = safeColor(st.backgroundColor);
  if (bg) s.bg = bg;
  const family = safeFamily(st.fontFamily);
  if (family) s.family = family;
  const em = safeFontEm(st.fontSize);
  if (em) s.em = parent.em * parseFloat(em);
  const gap = el.getAttribute('data-gap');
  if (gap) s.gap = gap;
  return s;
}

/** Découpe le HTML restreint en blocs (une ligne logique) de segments homogènes. */
export function parseBoardHtml(html: string): Block[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks: Block[] = [];
  let current: Block | null = null;

  const openBlock = (align: TextAlign, indent: number, marker: string | null) => {
    current = { align, indent, marker, runs: [] };
    blocks.push(current);
  };

  const walk = (node: Node, style: Omit<Run, 'text'>, align: TextAlign, indent: number, listMarker: string | null) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent || '').replace(/\u00a0/g, ' ');
        if (!text) continue;
        if (!current) openBlock(align, indent, listMarker);
        current!.runs.push({ ...style, text });
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      const tag = el.tagName;

      if (tag === 'BR') {
        if (!current) openBlock(align, indent, listMarker);
        current = null;
        continue;
      }

      const ownAlign = (['left', 'center', 'right', 'justify'] as const).find((a) => a === el.style.textAlign) ?? align;
      const ownIndent = indent + (Number(el.getAttribute('data-indent')) || 0);

      if (tag === 'UL' || tag === 'OL') {
        current = null;
        let counter = 1;
        for (const li of Array.from(el.children)) {
          if (li.tagName !== 'LI') continue;
          const liEl = li as HTMLElement;
          const liAlign = (['left', 'center', 'right', 'justify'] as const).find((a) => a === liEl.style.textAlign) ?? ownAlign;
          const liIndent = ownIndent + 1 + (Number(liEl.getAttribute('data-indent')) || 0);
          openBlock(liAlign, liIndent, tag === 'UL' ? '•' : `${counter}.`);
          counter += 1;
          walk(liEl, styleFrom(liEl, style), liAlign, liIndent, null);
          current = null;
        }
        continue;
      }

      if (BLOCK_TAGS.has(tag)) {
        current = null;
        const blockStyle = styleFrom(el, style);
        const heading = { H1: 1.7, H2: 1.4, H3: 1.2 }[tag];
        if (heading) {
          blockStyle.em *= heading;
          blockStyle.bold = true;
        }
        openBlock(ownAlign, ownIndent, null);
        walk(el, blockStyle, ownAlign, ownIndent, null);
        current = null;
        continue;
      }

      walk(el, styleFrom(el, style), align, indent, listMarker);
    }
  };

  walk(doc.body, BASE_STYLE, 'left', 0, null);
  return blocks.filter((b) => b.runs.length > 0 || b.marker !== null);
}

// ---- Mise en page et rendu ----

interface LaidRun extends Run { width: number }
interface LaidLine { runs: LaidRun[]; width: number; height: number; align: TextAlign; indent: number; marker: string | null }

function runFont(run: Run, box: TextBox, scale: number): string {
  const px = box.size * run.em * (run.shift === 0 ? 1 : 0.7) * scale;
  const family = run.family || fontCss(box.font);
  return `${run.italic ? 'italic ' : ''}${run.bold ? '700' : '400'} ${px}px ${family}`;
}

/** Découpe en mots en gardant les espaces avec le mot qui précède (césure naturelle). */
function splitWords(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) || [];
}

function layout(ctx: CanvasRenderingContext2D, box: TextBox, scale: number): LaidLine[] {
  const maxWidth = box.w * scale;
  const lines: LaidLine[] = [];

  for (const block of parseBoardHtml(box.html)) {
    const indentPx = block.indent * INDENT_EM * box.size * scale;
    const markerWidth = block.marker ? (() => {
      ctx.font = runFont({ ...BASE_STYLE, text: '' }, box, scale);
      return ctx.measureText(`${block.marker} `).width;
    })() : 0;
    const avail = Math.max(20, maxWidth - indentPx - markerWidth);

    let line: LaidRun[] = [];
    let width = 0;
    let first = true;
    const push = () => {
      const height = line.reduce((h, r) => Math.max(h, box.size * r.em * scale * LINE_HEIGHT), box.size * scale * LINE_HEIGHT);
      lines.push({
        runs: line,
        width,
        height,
        align: block.align,
        indent: block.indent,
        marker: first ? block.marker : null,
      });
      first = false;
      line = [];
      width = 0;
    };

    if (block.runs.length === 0) {
      push();
      continue;
    }

    for (const run of block.runs) {
      ctx.font = runFont(run, box, scale);
      for (const word of splitWords(run.text)) {
        const w = ctx.measureText(word).width;
        if (width + w > avail && line.length > 0 && word.trim() !== '') {
          push();
          ctx.font = runFont(run, box, scale);
        }
        const last = line[line.length - 1];
        if (last && last.bold === run.bold && last.italic === run.italic && last.underline === run.underline
          && last.strike === run.strike && last.color === run.color && last.bg === run.bg
          && last.family === run.family && last.em === run.em && last.shift === run.shift && last.gap === run.gap) {
          last.text += word;
          last.width += w;
        } else {
          line.push({ ...run, text: word, width: w });
        }
        width += w;
      }
    }
    push();
  }

  return lines;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
}

/** Hauteur occupée par la zone, en unités logiques (0 si le texte est vide). */
export function textBoxHeight(box: TextBox): number {
  const ctx = getMeasureCtx();
  if (!ctx) return box.size * LINE_HEIGHT;
  return layout(ctx, inner(box), 1).reduce((h, l) => h + l.height, 0) + textBoxPadding(box) * 2;
}

/** Boîte du texte lui-même, à l'intérieur de la marge d'un post-it. */
function inner(box: TextBox): TextBox {
  const p = textBoxPadding(box);
  return p ? { ...box, x: box.x + p, y: box.y + p, w: Math.max(20, box.w - p * 2) } : box;
}

/** Zone cliquable de la boîte, en unités logiques. */
export function textBoxRect(box: TextBox): { x: number; y: number; w: number; h: number } {
  return { x: box.x, y: box.y, w: box.w, h: Math.max(box.size * LINE_HEIGHT + textBoxPadding(box) * 2, textBoxHeight(box)) };
}

/**
 * Dessine la zone. `hiddenGaps` : trous à masquer (case blanche soulignée à la place du mot),
 * 'all' pour tous les trous (version élève), absent pour tout afficher.
 */
export function renderTextBox(ctx: CanvasRenderingContext2D, outer: TextBox, scale: number, hiddenGaps?: ReadonlySet<string> | 'all') {
  if (outer.background) {
    const r = textBoxRect(outer);
    ctx.save();
    ctx.fillStyle = outer.background;
    ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
    ctx.restore();
  }
  const box = inner(outer);
  const lines = layout(ctx, box, scale);
  if (lines.length === 0) return;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  let y = box.y * scale;

  for (const line of lines) {
    const indentPx = line.indent * INDENT_EM * box.size * scale;
    const baseFont = runFont({ ...BASE_STYLE, text: '' }, box, scale);
    ctx.font = baseFont;
    const markerWidth = line.marker ? ctx.measureText(`${line.marker} `).width : 0;
    const avail = box.w * scale - indentPx - markerWidth;

    let x = box.x * scale + indentPx + markerWidth;
    if (line.align === 'center') x += Math.max(0, (avail - line.width) / 2);
    else if (line.align === 'right') x += Math.max(0, avail - line.width);

    const baseline = y + line.height * 0.78;

    if (line.marker) {
      ctx.font = baseFont;
      ctx.fillStyle = box.color;
      ctx.fillText(line.marker, box.x * scale + indentPx, baseline);
    }

    for (const run of line.runs) {
      const px = box.size * run.em * scale;
      const shift = run.shift === 1 ? -px * 0.32 : run.shift === -1 ? px * 0.18 : 0;
      ctx.font = runFont(run, box, scale);
      if (run.gap && hiddenGaps && (hiddenGaps === 'all' || hiddenGaps.has(run.gap))) {
        // Trou masqué : une case vide de la largeur du mot, soulignée
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, baseline - px * 0.86 + shift, run.width, px * 1.12);
        ctx.strokeStyle = run.color || box.color;
        ctx.lineWidth = Math.max(1, px * 0.06);
        ctx.beginPath();
        ctx.moveTo(x, baseline + px * 0.14 + shift);
        ctx.lineTo(x + run.width, baseline + px * 0.14 + shift);
        ctx.stroke();
        x += run.width;
        continue;
      }
      if (run.bg) {
        ctx.fillStyle = run.bg;
        ctx.fillRect(x, baseline - px * 0.86 + shift, run.width, px * 1.12);
      }
      ctx.fillStyle = run.color || box.color;
      ctx.fillText(run.text, x, baseline + shift);
      if (run.underline || run.strike) {
        ctx.strokeStyle = run.color || box.color;
        ctx.lineWidth = Math.max(1, px * 0.055);
        const trimmed = run.text.replace(/\s+$/, '');
        const w = trimmed === run.text ? run.width : ctx.measureText(trimmed).width;
        if (run.underline) {
          ctx.beginPath();
          ctx.moveTo(x, baseline + px * 0.14 + shift);
          ctx.lineTo(x + w, baseline + px * 0.14 + shift);
          ctx.stroke();
        }
        if (run.strike) {
          ctx.beginPath();
          ctx.moveTo(x, baseline - px * 0.28 + shift);
          ctx.lineTo(x + w, baseline - px * 0.28 + shift);
          ctx.stroke();
        }
      }
      x += run.width;
    }
    y += line.height;
  }
  ctx.restore();
}
