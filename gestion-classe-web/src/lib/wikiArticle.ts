/**
 * Article Wikipédia découpé en blocs à prélever pour le tableau : titres, paragraphes, listes et
 * images, dans l'ordre de la page. Lu par l'API REST (Parsoid, CORS ouvert, sans clé).
 *
 * On laisse de côté ce qui ne sert pas en classe : notes et références, bandeaux, palettes de
 * navigation, tableaux ; l'image de l'infobox est gardée en tête.
 */

export type WikiBlock =
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'para'; html: string; text: string }
  | { kind: 'list'; html: string; text: string }
  | { kind: 'image'; src: string; full: string; caption: string };

export interface WikiArticle {
  title: string;
  url: string;
  blocks: WikiBlock[];
}

/** Sections de fin d'article : on s'arrête au premier de ces titres. */
const STOP_HEADINGS = ['notes et références', 'notes', 'références', 'voir aussi', 'bibliographie', 'liens externes', 'articles connexes', 'annexes', 'sources'];

export function isStopHeading(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  return STOP_HEADINGS.includes(t);
}

/** Largeur demandée pour l'image posée sur le tableau (taille standard des vignettes Wikimedia). */
const FULL_WIDTH = 960;

/**
 * Adresse de l'image en grand à partir de la vignette de l'article. Une vignette plus grande que
 * l'original n'existe pas : en dessous de 960 px on prend l'original ; un SVG se rastérise à toute
 * taille.
 */
export function fullImageUrl(src: string, fileWidth?: number): string {
  const abs = src.startsWith('//') ? `https:${src}` : src;
  // Les vignettes arrivent avec des paramètres de suivi, parfois depuis thumb.wikimedia.org, qui ne
  // sert pas les originaux : on repasse par upload.wikimedia.org, qui sert les deux
  const m = /^(.*)\/thumb\/(.+?)\/(\d+)px-([^/?]+)(?:\?.*)?$/.exec(abs);
  if (!m) return abs;
  const [, host, path, , name] = m;
  const base = host.replace('://thumb.wikimedia.org', '://upload.wikimedia.org');
  if (/\.svg$/i.test(path) || (fileWidth ?? Infinity) > FULL_WIDTH) return `${base}/thumb/${path}/${FULL_WIDTH}px-${name}`;
  return `${base}/${path}`;
}

/** Ancêtres dont le contenu ne se prélève pas. */
const SKIP_SELECTOR = [
  'table', '.infobox', '.infobox_v2', '.infobox_v3', '.navbox', '.reflist', '.references', '.mw-references-wrap',
  '.bandeau', '.bandeau-container', '.homonymie', '.metadata', '.noprint', '[role="note"]', '.hatnote', '.mw-empty-elt',
  'figure', 'figcaption', '.thumb', '.gallery', '.toc', '.printfooter', '.bandeau-portail',
].join(', ');

/** Copie nettoyée d'un paragraphe ou d'une liste : sans appels de notes, liens réduits à leur texte. */
function cleanHtml(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll('sup, style, .mw-ref, .reference, .noprint, .mw-editsection, link, .bandeau-portail').forEach((n) => n.remove());
  c.querySelectorAll('a').forEach((a) => a.replaceWith(...Array.from(a.childNodes)));
  c.querySelectorAll('[style], [class], [id], [about], [typeof], [data-mw], [rel], [title]').forEach((n) => {
    for (const attr of ['style', 'class', 'id', 'about', 'typeof', 'data-mw', 'rel', 'title']) n.removeAttribute(attr);
  });
  return c.innerHTML.replace(/\s+/g, ' ').trim();
}

const textOf = (el: Element) => (el.textContent || '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();

function imageBlock(img: HTMLImageElement, caption: string): WikiBlock | null {
  const src = img.getAttribute('src');
  if (!src) return null;
  const w = Number(img.getAttribute('data-file-width') || img.getAttribute('width') || 0);
  // Icônes, drapeaux et pictogrammes : trop petits pour le tableau
  if (Number(img.getAttribute('width') || 0) < 80 && w < 200) return null;
  const abs = src.startsWith('//') ? `https:${src}` : src;
  return { kind: 'image', src: abs, full: fullImageUrl(src, w || undefined), caption };
}

/** Découpe le HTML Parsoid d'un article en blocs. */
export function parseWikiHtml(html: string): WikiBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: WikiBlock[] = [];

  const lead = doc.querySelector('.infobox_v3 img, .infobox_v2 img, .infobox img') as HTMLImageElement | null;
  if (lead) { const b = imageBlock(lead, ''); if (b) blocks.push(b); }

  for (const el of Array.from(doc.body.querySelectorAll('h2, h3, p, ul, figure'))) {
    const tag = el.tagName;
    if (tag === 'FIGURE') {
      if (el.parentElement?.closest(SKIP_SELECTOR)) continue;
      const img = el.querySelector('img') as HTMLImageElement | null;
      const b = img ? imageBlock(img, textOf(el.querySelector('figcaption') ?? doc.createElement('i'))) : null;
      if (b) blocks.push(b);
      continue;
    }
    if (el.closest(SKIP_SELECTOR)) continue;
    if (tag === 'H2' || tag === 'H3') {
      const text = textOf(el);
      if (isStopHeading(text)) break;
      if (text) blocks.push({ kind: 'heading', level: tag === 'H2' ? 2 : 3, text });
      continue;
    }
    if (tag === 'UL') {
      if (el.parentElement?.closest('ul, ol')) continue;
      const text = textOf(el);
      if (text.length > 1) blocks.push({ kind: 'list', html: `<ul>${cleanHtml(el)}</ul>`, text });
      continue;
    }
    const text = textOf(el);
    if (text.length > 1) blocks.push({ kind: 'para', html: cleanHtml(el), text });
  }
  // Un titre sans contenu avant le titre suivant de même rang (section vide ou toute en tableaux) ne sert à rien
  return blocks.filter((b, i) => {
    if (b.kind !== 'heading') return true;
    const next = blocks[i + 1];
    return !!next && (next.kind !== 'heading' || next.level > b.level);
  });
}

export async function fetchWikiArticle(title: string): Promise<WikiArticle> {
  const slug = encodeURIComponent(title.replace(/ /g, '_'));
  const res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/html/${slug}?redirect=true`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return { title, url: `https://fr.wikipedia.org/wiki/${slug}`, blocks: parseWikiHtml(await res.text()) };
}

/** HTML à poser sur le tableau pour des blocs de texte choisis, avec la source en gris. */
export function blocksToBoardHtml(blocks: WikiBlock[], title: string): string {
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  const parts = blocks.flatMap((b) => {
    if (b.kind === 'heading') return [`<div><b>${esc(b.text)}</b></div>`];
    if (b.kind === 'para') return [`<div>${b.html}</div>`];
    if (b.kind === 'list') return [b.html];
    return [];
  });
  if (parts.length === 0) return '';
  return `${parts.join('')}<div><span style="color: #6B7280">Source : Wikipédia, « ${esc(title)} »</span></div>`;
}
