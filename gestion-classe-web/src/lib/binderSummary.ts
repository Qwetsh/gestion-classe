/**
 * Classeur virtuel : le bilan de chaque activité, écrit à la main sur les lignes de la feuille du
 * classeur (demande de Thomas, 20/11/2026). Fonctions pures.
 *
 * Le texte vient de l'écran « Bilan » qui termine les écrans de l'activité (screenSummary, Thomas,
 * 22/11/2026), mots à trouver soulignés ; à défaut, de la feuille de bilans corrigée de la séquence
 * (« Feuille de bilans — Séquence n (correction) », summaryRuns), tant qu'elle existe.
 * L'élève l'écrit en rouge sous la fiche collée (six lignes libres), et finit en haut de la page
 * suivante : au-dessus de la feuille de documents de l'activité si la fin y tient, sinon sur une
 * page à part.
 *
 * Les lignes sont coupées ici, mot par mot, avec la largeur mesurée de l'écriture (`measure`) : le
 * rendu pose chaque ligne telle quelle sur une ligne du papier, sans laisser le navigateur couper.
 */
import type { JSONContent } from '@tiptap/core';
import type { BinderPage } from './binder';
import { activityKeyOf, summaryTables } from './binderInk';
import { naturalCompare } from './courseLibrary';

/** Un morceau de texte écrit à la main ; les mots clés du bilan restent soulignés. */
export interface InkRun {
  text: string;
  underline?: boolean;
}
/** Une ligne d'écriture, posée sur une ligne du papier. */
export type InkLine = InkRun[];
/** Lignes libres sous une fiche A5 collée à sa place habituelle. */
export const UNDER_LINES = 6;
/** Lignes qu'on peut écrire au-dessus d'une feuille de documents sans qu'elle sorte de la page. */
export const ABOVE_MAX = 7;
/** Lignes d'une page sans fiche collée, et de la même page avec son titre écrit en haut. */
export const RULED_LINES = 33;
export const RULED_LINES_TITLED = 32;
/** Écriture sur les lignes du papier : corps en px de feuille, largeur utile en mm (marge à bord). */
export const INK_PX = 17;
export const INK_WIDTH_MM = 172;

/** Intitulé écrit par l'élève devant son bilan. */
export const SUMMARY_LEAD: InkRun = { text: 'Bilan :', underline: true };

/** Morceaux d'un paragraphe de cours (texte et soulignement seulement). */
function runsOf(paragraph: JSONContent): InkRun[] {
  const runs: InkRun[] = [];
  const visit = (n: JSONContent) => {
    if (n.type === 'text' && n.text) {
      const underline = !!n.marks?.some((m) => m.type === 'underline');
      const last = runs[runs.length - 1];
      if (last && !!last.underline === underline) last.text += n.text;
      else runs.push(underline ? { text: n.text, underline } : { text: n.text });
    }
    (n.content ?? []).forEach(visit);
  };
  visit(paragraph);
  return runs;
}

/** Le bilan d'une activité, prêt à être écrit. */
export interface Summary {
  /** « Activité 2 — L'importance d'un séisme » */
  heading: string;
  paragraphs: InkRun[][];
}
/** Bilans d'une séquence, par activité (« activite 2 »). */
export type SummaryRuns = Map<string, Summary>;

/** Bilans d'une feuille corrigée, prêts à être écrits : par activité, son intitulé et ses paragraphes. */
export function summaryRuns(corrected: JSONContent): SummaryRuns {
  const out: SummaryRuns = new Map();
  for (const { key, title, paragraphs } of summaryTables(corrected)) {
    const runs = paragraphs.map(runsOf).filter((r) => r.length > 0);
    if (runs.length > 0) out.set(key, { heading: title, paragraphs: runs });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// L'écran « Bilan » d'une activité (gabarit bilan de gc_ecrans.py) : titre « Bilan » en rouge,
// puis le texte en rouge, mots à trouver en <span data-gap>. Il prime sur la feuille de bilans.
// ---------------------------------------------------------------------------------------------

/** Rouge des bilans (règle de Thomas). */
const SUMMARY_RED = '#c00000';

/** Ce qu'il faut d'un objet d'écran pour y lire un bilan. */
interface ScreenText {
  type?: unknown;
  color?: unknown;
  html?: unknown;
  x?: unknown;
  y?: unknown;
}
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—' };
const decode = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
  if (code[0] === '#') {
    const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : all;
  }
  return ENTITIES[code.toLowerCase()] ?? all;
});

/** Balises qui commencent un nouveau paragraphe. */
const BLOCK = /^(div|p|li|h[1-6]|br)$/;

/**
 * Paragraphes d'un texte d'écran (HTML du tableau blanc) : un par bloc (`<div>`, `<p>`, `<br>`).
 * Les mots à trouver (`data-gap`) sont écrits en clair et soulignés, comme les mots clés de la
 * feuille de bilans ; ce qui est déjà souligné (`<u>`) le reste.
 */
export function htmlParagraphs(html: string): InkRun[][] {
  const paragraphs: InkRun[][] = [];
  let runs: InkRun[] = [];
  const stack: { name: string; underline: boolean }[] = [];
  const close = () => {
    const text = runs.map((r) => r.text).join('');
    if (text.trim() !== '') {
      // Espaces de bord retirées : le paragraphe commence et finit sur un mot
      runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, '') };
      const last = runs.length - 1;
      runs[last] = { ...runs[last], text: runs[last].text.replace(/\s+$/, '') };
      paragraphs.push(runs.filter((r) => r.text !== ''));
    }
    runs = [];
  };
  for (const [token] of html.matchAll(/<[^>]*>|[^<]+/g)) {
    const tag = /^<\s*(\/)?\s*([a-z0-9]+)([^>]*)>$/i.exec(token);
    if (!tag) {
      const text = decode(token);
      const underline = stack.some((s) => s.underline);
      const last = runs[runs.length - 1];
      if (last && !!last.underline === underline) last.text += text;
      else runs.push(underline ? { text, underline } : { text });
      continue;
    }
    const [, closing, rawName, attrs] = tag;
    const name = rawName.toLowerCase();
    if (BLOCK.test(name)) close();
    if (name === 'br' || name === 'img' || /\/\s*$/.test(attrs)) continue;
    if (closing) {
      const at = stack.map((s) => s.name).lastIndexOf(name);
      if (at >= 0) stack.splice(at);
    } else {
      stack.push({ name, underline: name === 'u' || /\bdata-gap\b/i.test(attrs) || /text-decoration[^;"']*underline/i.test(attrs) });
    }
  }
  close();
  return paragraphs;
}

const plain = (html: string) => htmlParagraphs(html).map((p) => p.map((r) => r.text).join('')).join(' ').trim();
const isRedText = (o: ScreenText) => o.type === 'text' && typeof o.html === 'string' && typeof o.color === 'string' && o.color.toLowerCase() === SUMMARY_RED;

/**
 * Bilan lu dans les écrans d'une activité, dans leur ordre : sur chaque écran dont le titre rouge
 * commence par « Bilan », les textes rouges posés sous ce titre (de haut en bas). Plusieurs écrans
 * Bilan sont mis bout à bout. Rien : l'activité n'a pas d'écran Bilan.
 */
export function screenSummary(screens: { objects?: unknown }[]): InkRun[][] {
  const out: InkRun[][] = [];
  for (const screen of screens) {
    const texts = (Array.isArray(screen.objects) ? screen.objects : []).filter((o): o is ScreenText => !!o && typeof o === 'object').filter(isRedText);
    const title = texts
      .filter((o) => /^bilan\b/i.test(plain(o.html as string)))
      .sort((a, b) => num(a.y) - num(b.y))[0];
    if (!title) continue;
    const body = texts
      .filter((o) => o !== title && num(o.y) > num(title.y))
      .sort((a, b) => num(a.y) - num(b.y) || num(a.x) - num(b.x));
    for (const o of body) out.push(...htmlParagraphs(o.html as string));
  }
  return out;
}

/**
 * Bilans d'une séquence : celui de l'écran Bilan prime, activité par activité ; la feuille de
 * bilans corrigée ne sert qu'aux activités sans écran Bilan.
 */
export function mergeSummaries(screens: SummaryRuns, sheet: SummaryRuns | undefined): SummaryRuns {
  const out: SummaryRuns = new Map(screens);
  for (const [key, summary] of sheet ?? []) if (!out.has(key)) out.set(key, summary);
  return out;
}

/** Mots d'un paragraphe : chacun garde son soulignement ; l'espace qui le précède est noté à part. */
interface Word {
  text: string;
  underline: boolean;
  /** Une espace sépare ce mot du précédent (faux au milieu d'un mot à moitié souligné). */
  spaced: boolean;
}

function wordsOf(runs: InkRun[]): Word[] {
  const words: Word[] = [];
  let spaced = false;
  for (const run of runs) {
    for (const part of run.text.split(/(\s+)/)) {
      if (part === '') continue;
      if (/^\s+$/.test(part)) { spaced = true; continue; }
      words.push({ text: part, underline: !!run.underline, spaced: spaced && words.length > 0 });
      spaced = false;
    }
  }
  return words;
}

/** Ponctuation française qui ne commence jamais une ligne (« : », « ? », « ; », « ! », « » »). */
const CLINGS = /^[:;?!»]/;

/**
 * Coupe des paragraphes en lignes d'au plus `width` (dans l'unité de `measure`). Le premier
 * paragraphe commence par `lead` (« Bilan : »). Un mot plus large que la ligne reste entier.
 */
export function wrapInk(paragraphs: InkRun[][], width: number, measure: (text: string) => number, lead?: InkRun): InkLine[] {
  const lines: InkLine[] = [];
  paragraphs.forEach((runs, rank) => {
    const words = wordsOf(rank === 0 && lead ? [lead, { text: ' ' }, ...runs] : runs);
    let line: Word[] = [];
    let text = '';
    const flush = () => {
      if (line.length === 0) return;
      const out: InkLine = [];
      line.forEach((w, i) => {
        const piece = (i > 0 && w.spaced ? ' ' : '') + w.text;
        const last = out[out.length - 1];
        // L'espace entre deux mots soulignés l'est aussi ; sinon elle reste nue
        if (last && !!last.underline === w.underline) last.text += piece;
        else if (w.underline && piece.startsWith(' ')) {
          if (last) last.text += ' '; else out.push({ text: ' ' });
          out.push({ text: w.text, underline: true });
        } else out.push(w.underline ? { text: piece, underline: true } : { text: piece });
      });
      lines.push(out);
      line = [];
      text = '';
    };
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const glue = line.length > 0 && w.spaced ? ' ' : '';
      const next = text + glue + w.text;
      // Un mot collé au précédent, ou une ponctuation double, ne passe pas seul à la ligne
      const bound = line.length > 0 && (!w.spaced || CLINGS.test(w.text));
      if (line.length > 0 && !bound && measure(next) > width) {
        flush();
        line = [w];
        text = w.text;
      } else {
        line.push(w);
        text = next;
      }
    }
    flush();
  });
  return lines;
}

/** Repère de l'activité d'une page (« activite 2 »), lu dans le titre écrit en haut de la feuille. */
const pageKey = (page: BinderPage): string | null =>
  page.kind === 'sheet' && page.role === 'activity' ? activityKeyOf(page.heading ?? page.board.title) : null;

/**
 * Le classeur avec ses bilans : chaque fiche d'activité reçoit le sien sous la fiche (`summary`), et
 * la fin passe au-dessus de sa feuille de documents (`above`) ou sur une feuille de lignes à part.
 * Un bilan dont l'activité n'a pas de fiche dans le classeur prend sa propre feuille, à sa place.
 * `texts` : les bilans par séquence (`chapter`) ; `wrap` : la coupe en lignes, à la largeur du papier
 * (elle écrit « Bilan : » devant le premier paragraphe).
 */
export function withSummaries(
  pages: BinderPage[],
  texts: Map<string, SummaryRuns>,
  wrap: (paragraphs: InkRun[][]) => InkLine[],
): BinderPage[] {
  const out: BinderPage[] = [];
  // Activités qui ont leur fiche dans le classeur, par séquence
  const hasPage = new Map<string, Set<string>>();
  for (const p of pages) {
    const key = pageKey(p);
    if (key && p.kind === 'sheet' && p.chapter) hasPage.set(p.chapter, (hasPage.get(p.chapter) ?? new Set()).add(key));
  }
  const done = new Set<string>();

  /** Feuilles des bilans sans fiche : celles d'avant l'activité `before`, ou toutes celles qui restent. */
  const orphans = (chapter: string | null, before?: string) => {
    const bilans = chapter ? texts.get(chapter) : undefined;
    if (!chapter || !bilans) return;
    const keys = [...bilans.keys()]
      .filter((k) => !hasPage.get(chapter)?.has(k) && !done.has(`${chapter}|${k}`) && (!before || naturalCompare(k, before) < 0))
      .sort(naturalCompare);
    for (const k of keys) {
      done.add(`${chapter}|${k}`);
      const { heading, paragraphs } = bilans.get(k)!;
      const lines = wrap(paragraphs);
      for (let from = 0, first = true; from < lines.length; first = false) {
        const size = first ? RULED_LINES_TITLED : RULED_LINES;
        out.push({
          kind: 'ruled',
          key: `${chapter}:${k}:${from}`,
          section: 'sequences',
          chapter,
          label: `${heading.split(' — ')[0]} — bilan`,
          ...(first ? { heading } : {}),
          lines: lines.slice(from, from + size),
        });
        from += size;
      }
    }
  };

  let current: string | null = null;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const chapter = page.kind === 'divider' ? null : page.chapter;
    if (current && (chapter !== current || (page.kind === 'sheet' && page.role === 'evaluation'))) orphans(current);
    current = chapter;
    const key = pageKey(page);
    if (key && chapter) orphans(chapter, key);
    const summary = page.kind === 'sheet' && key && chapter ? texts.get(chapter)?.get(key) : undefined;
    if (page.kind !== 'sheet' || !summary) { out.push(page); continue; }
    done.add(`${chapter}|${key}`);
    const lines = wrap(summary.paragraphs);
    if (lines.length === 0) { out.push(page); continue; }
    out.push({ ...page, summary: lines.slice(0, UNDER_LINES) });
    const rest = lines.slice(UNDER_LINES);
    if (rest.length === 0) continue;
    const next = pages[i + 1];
    if (next?.kind === 'sheet' && next.role === 'documents' && next.chapter === page.chapter
      && next.label === `${page.label} — documents` && rest.length <= ABOVE_MAX) {
      out.push({ ...next, above: rest });
      i++;
      continue;
    }
    for (let from = 0; from < rest.length; from += RULED_LINES) {
      out.push({
        kind: 'ruled',
        key: `${page.key}:bilan:${from}`,
        section: page.section,
        chapter: page.chapter,
        label: `${page.label} — suite du bilan`,
        lines: rest.slice(from, from + RULED_LINES),
        ...(page.anchor ? { anchor: page.anchor } : {}),
      });
    }
  }
  orphans(current);
  return out;
}
