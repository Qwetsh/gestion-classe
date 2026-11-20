/**
 * Classeur virtuel : le bilan de chaque activité, écrit à la main sur les lignes de la feuille du
 * classeur (demande de Thomas, 20/11/2026). Fonctions pures.
 *
 * Le texte vient de « L'essentiel » : la feuille de bilans corrigée de la séquence (« Feuille de
 * bilans — Séquence n (correction) »), où chaque activité a son bilan, mots clés soulignés.
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
      });
    }
  }
  orphans(current);
  return out;
}
