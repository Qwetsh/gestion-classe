/**
 * Pagination A4 de l'éditeur de cours.
 *
 * Le document reste un seul flux ProseMirror (une seule zone éditable : sélection, copier-coller
 * et annulation traversent les pages). Pour le répartir sur des feuilles, on mesure les blocs et
 * on insère avant le premier qui déborde un intercalaire (décoration « widget ») assez haut pour
 * le renvoyer en haut de la page suivante : marge du bas, espace entre les feuilles, marge du
 * haut. Les feuilles blanches sont dessinées derrière par CourseEditor.
 *
 * Lot T15a : les listes, les encadrés et les citations se coupent entre leurs éléments. On ne
 * mesure plus seulement les blocs de premier niveau mais des « unités » : un conteneur sécable
 * est remplacé par ses enfants (récursivement), le premier enfant emmenant le haut du conteneur
 * (titre de l'encadré, marge) et le dernier son bas. Un intercalaire peut ainsi se poser entre
 * deux éléments de liste ou deux paragraphes d'un encadré ; dans un encadré il « coupe » le cadre
 * (bandes blanches et bande de bureau dessinées par-dessus le fond, voir `course.css`).
 *
 * Lot T15b : un tableau se coupe entre deux lignes. L'intercalaire est alors une ligne `<tr>`
 * fantôme (une cellule sur toute la largeur, sans bordure) ; si la première ligne du tableau est
 * une ligne d'en-tête, elle est répétée en haut de la suite (copie non éditable, dessinée à partir
 * du nœud). On ne coupe jamais à l'intérieur d'une cellule fusionnée sur plusieurs lignes, ni
 * entre la ligne d'en-tête et la première ligne de données.
 *
 * Lot T15c : un long paragraphe se coupe au début d'une ligne, jamais en laissant moins de deux
 * lignes de chaque côté (veuves et orphelines). L'intercalaire est une boîte en ligne, pleine
 * largeur (`inline-block`), posée au début de la ligne : la ligne d'avant n'est donc pas la
 * dernière d'un bloc et reste justifiée. On ne coupe pas au milieu d'un mot (césure automatique),
 * ni un paragraphe dans un encadré (la bande de bureau n'y est pas dessinée).
 *
 * La mise en page part des positions « naturelles » des unités (intercalaires déjà posés retirés) :
 * elle ne dépend pas de la mise en page précédente, donc pas d'oscillation. Une unité plus haute
 * qu'une page (grand tableau, très long paragraphe) déborde simplement.
 */
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { DOMSerializer, type Node as PMNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CONTENT_H, MARGIN, PAGE_H, SHEET_GAP } from '../../lib/course/coursePage';

export interface Spacer {
  /** Position ProseMirror de l'unité renvoyée à la page suivante. */
  pos: number;
  /** Hauteur en px. */
  h: number;
  /**
   * Intercalaire dans un encadré : bande de bureau (entre deux feuilles), en px depuis le haut de
   * l'intercalaire, pour couper le cadre. Absent hors encadré.
   */
  cut?: { a: number; b: number };
  /** Intercalaire dans un encadré (le débord doit couvrir le cadre). */
  inBox?: boolean;
  /** Intercalaire entre deux lignes d'un tableau (lot T15b). */
  row?: RowBreak;
  /** Intercalaire au début d'une ligne d'un paragraphe (lot T15c) : `pos` est dans le texte. */
  inline?: boolean;
}

/** Début d'une ligne d'un paragraphe (lot T15c). */
export interface LineStart {
  /** Position ProseMirror du premier caractère de la ligne. */
  pos: number;
  /** Haut de la ligne, en px du haut du flux, intercalaires déjà posés retirés. */
  top: number;
  /** On peut couper ici : la ligne commence un mot (pas au milieu d'un mot coupé par la césure). */
  ok: boolean;
}

/** Coupure entre deux lignes de tableau : nombre de colonnes, ligne d'en-tête à répéter. */
export interface RowBreak {
  cols: number;
  /** Position de la ligne d'en-tête du tableau (null : pas d'en-tête à répéter). */
  headPos: number | null;
  /** Hauteur de la ligne d'en-tête répétée, en px. */
  headH: number;
}

export interface PageLayout {
  /** Nombre de feuilles. */
  pages: number;
  spacers: Spacer[];
  /** Espace entre les feuilles utilisé pour ce calcul (0 à l'impression). */
  gap: number;
}

/** Une unité mesurée, à sa position « naturelle » (sans intercalaire), en px du haut du flux. */
export interface Unit {
  pos: number;
  top: number;
  h: number;
  mt: number;
  mb: number;
  type: string;
  /** Unité à l'intérieur d'un encadré : l'intercalaire posé devant doit couper le cadre. */
  inBox?: boolean;
  /** Ligne de tableau (sauf la première) : l'intercalaire posé devant est une ligne fantôme. */
  row?: RowBreak;
  /** Paragraphe d'au moins quatre lignes : ses débuts de ligne, où on peut le couper (lot T15c). */
  lines?: LineStart[];
  /** Image « page entière » : haute de toute la page utile, elle couvre aussi les marges. */
  page?: boolean;
  /** Paragraphe vide. */
  empty?: boolean;
}

interface PaginationState { deco: DecorationSet; layout: PageLayout }

export const paginationKey = new PluginKey<PaginationState>('coursePagination');

/** Délai entre une modification et le recalcul des pages. */
const LAYOUT_DELAY_MS = 60;
/** Un titre en bas de page doit pouvoir emmener ce début du bloc suivant (≈ 2 lignes). */
const KEEP_WITH_NEXT_PX = 48;
/** Conteneurs qui peuvent se couper entre leurs enfants (lot T15a). */
const SPLITTABLE = new Set(['bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem', 'callout', 'blockquote']);
/** Garde-fou : profondeur d'imbrication explorée. */
const MAX_DEPTH = 6;

interface PaginationOptions {
  onLayout?: (layout: PageLayout) => void;
}

interface PaginationStorage {
  gap: number;
}

declare module '@tiptap/core' {
  interface Storage {
    coursePagination: PaginationStorage;
  }
}

function setCut(el: HTMLElement, cut: Spacer['cut']) {
  if (!cut) return;
  el.style.setProperty('--cut-a', `${cut.a}px`);
  el.style.setProperty('--cut-b', `${cut.b}px`);
}

function spacerWidgets(s: Spacer): Decoration[] {
  const key = `sp-${s.pos}-${Math.round(s.h * 10)}-${s.cut ? Math.round(s.cut.a * 10) : ''}`;
  if (s.inline) {
    return [Decoration.widget(s.pos, () => {
      const el = document.createElement('span');
      el.className = 'ce-spacer ce-spacer--inline';
      el.style.height = `${s.h}px`;
      el.contentEditable = 'false';
      el.setAttribute('aria-hidden', 'true');
      return el;
    }, { side: -1, key: `${key}-i`, ignoreSelection: true })];
  }
  if (!s.row) {
    return [Decoration.widget(s.pos, () => {
      const el = document.createElement('div');
      el.className = s.cut ? 'ce-spacer ce-spacer--cut' : 'ce-spacer';
      el.style.height = `${s.h}px`;
      setCut(el, s.cut);
      el.setAttribute('aria-hidden', 'true');
      return el;
    }, { side: -1, key, ignoreSelection: true })];
  }
  // Tableau : une ligne fantôme, puis la copie de la ligne d'en-tête
  const row = s.row;
  const out = [Decoration.widget(s.pos, () => {
    const tr = document.createElement('tr');
    tr.className = `ce-spacer ce-spacer--row${s.inBox ? ' ce-spacer--box' : ''}`;
    tr.setAttribute('aria-hidden', 'true');
    tr.contentEditable = 'false';
    const td = document.createElement('td');
    td.colSpan = Math.max(1, row.cols);
    td.style.height = `${s.h}px`;
    setCut(td, s.cut);
    tr.appendChild(td);
    return tr;
  }, { side: -2, key: `${key}-r${row.cols}${s.inBox ? 'b' : ''}`, ignoreSelection: true })];
  if (row.headPos != null) {
    const headPos = row.headPos;
    out.push(Decoration.widget(s.pos, (view) => {
      const node = view.state.doc.nodeAt(headPos);
      const tr = node && node.type.name === 'tableRow'
        ? DOMSerializer.fromSchema(view.state.schema).serializeNode(node) as HTMLElement
        : document.createElement('tr');
      tr.classList.add('ce-spacer-head');
      tr.setAttribute('aria-hidden', 'true');
      tr.contentEditable = 'false';
      return tr;
    }, { side: -1, key: `${key}-h${headPos}-${Math.round(row.headH * 10)}`, ignoreSelection: true }));
  }
  return out;
}

// ---- 1) Mesure ----

/**
 * La marge d'un enfant « traverse » le conteneur (marges confondues, règle CSS) quand rien ne les
 * sépare de ce côté : ni marge intérieure, ni bordure, ni contexte de formatage propre.
 */
function collapsesThrough(cs: CSSStyleDeclaration, side: 'Top' | 'Bottom'): boolean {
  return (cs.display === 'block' || cs.display === 'list-item') && cs.overflow === 'visible'
    && !parseFloat(cs[`padding${side}`]) && !parseFloat(cs[`border${side}Width`]);
}

interface Measured {
  pos: number; anchor: HTMLElement; top: number; bottom: number; mt: number; mb: number; type: string; inBox: boolean; row?: RowBreak;
  page?: boolean; empty?: boolean;
  /** Paragraphe long : débuts de ligne (hauts en px d'écran, déjà sans les intercalaires en ligne). */
  lines?: LineStart[];
  /** Hauteur (px d'écran) des intercalaires en ligne posés dans ce paragraphe. */
  inner?: number;
}

/** Mesure des lignes d'un paragraphe, valable tant que le nœud, la largeur et la police ne changent pas. */
interface LineCache {
  key: string;
  /** Position relative au paragraphe, haut de ligne relatif à la première ligne (px de mise en page). */
  lines: { rel: number; dy: number; ok: boolean }[] | null;
}
const lineCache = new WeakMap<PMNode, LineCache>();
/** Change quand les polices finissent d'arriver : les mesures en cache ne sont plus bonnes. */
let fontsEpoch = 0;
if (typeof document !== 'undefined') void document.fonts?.ready.then(() => { fontsEpoch++; });

/**
 * Débuts de ligne d'un paragraphe (lot T15c), lus caractère par caractère : un caractère dont le
 * centre descend de plus de 0,6 interligne sous celui de la ligne courante ouvre une ligne. Les
 * hauts sont ramenés à la mise en page « naturelle » (intercalaires en ligne retirés). Rend null
 * si le paragraphe a moins de quatre lignes (rien à couper en gardant deux lignes de chaque côté).
 * Le résultat est gardé par nœud : seul un paragraphe modifié est relu à la frappe.
 */
function measureLines(view: EditorView, node: PMNode, pos: number, el: HTMLElement, scale: number): { lines: LineStart[]; inner: number } | null {
  const cs = getComputedStyle(el);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const lh = parseFloat(cs.lineHeight) || fontSize * 1.2;
  const box = el.getBoundingClientRect();
  const spacers = Array.from(el.children)
    .filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains('ce-spacer--inline'))
    .map((c) => c.getBoundingClientRect());
  const inner = spacers.reduce((sum, r) => sum + r.height, 0);
  if (box.height - inner < lh * 3.6) return null;
  const padTop = parseFloat(cs.paddingTop) || 0;
  const key = [el.clientWidth, cs.font, cs.lineHeight, cs.hyphens, cs.letterSpacing, cs.wordSpacing, cs.textIndent, cs.paddingLeft, fontsEpoch].join('|');
  const cached = lineCache.get(node);
  const fromCache = (c: LineCache) => (c.lines && c.lines.length >= 4
    ? { lines: c.lines.map((l) => ({ pos: pos + l.rel, top: box.top + padTop + l.dy * scale, ok: l.ok })), inner }
    : null);
  if (cached && cached.key === key) return fromCache(cached);

  const natural = (center: number) => spacers.reduce((sum, r) => (center > r.top ? sum + r.height : sum), 0);
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const lines: { rel: number; dy: number; ok: boolean }[] = [];
  let firstCenter = 0;
  let lineCenter = 0;
  let prev = '';
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const stop = n.parentElement?.closest('[contenteditable="false"]');
    if (stop && el.contains(stop)) continue;
    const text = n.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) { prev = ch; continue; }
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const rect = range.getClientRects()[0];
      if (!rect) { prev = ch; continue; }
      const center = (rect.top + rect.bottom) / 2;
      if (lines.length === 0) {
        firstCenter = center;
        lineCenter = center;
        lines.push({ rel: view.posAtDOM(n, i) - pos, dy: 0, ok: false });
      } else if (center - lineCenter > lh * 0.6) {
        lineCenter = center;
        lines.push({ rel: view.posAtDOM(n, i) - pos, dy: (center - firstCenter - natural(center)) / scale, ok: /\s/.test(prev) });
      }
      prev = ch;
    }
  }
  const entry: LineCache = { key, lines };
  lineCache.set(node, entry);
  return fromCache(entry);
}

/**
 * Unités d'un nœud : lui-même, ou (conteneur sécable) celles de ses enfants, la première prenant
 * le haut du conteneur et la dernière son bas.
 */
function measureNode(view: EditorView, node: PMNode, pos: number, el: HTMLElement, depth: number, inBox: boolean, scale: number): Measured[] {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const self: Measured = {
    pos, anchor: el, top: r.top, bottom: r.bottom,
    mt: parseFloat(cs.marginTop) || 0, mb: parseFloat(cs.marginBottom) || 0, type: node.type.name, inBox,
  };
  if (node.type.name === 'image' && node.attrs.page) self.page = true;
  if (node.type.name === 'paragraph' && node.content.size === 0) self.empty = true;
  if (node.type.name === 'paragraph' && !inBox) {
    const found = measureLines(view, node, pos, el, scale);
    if (found) { self.lines = found.lines; self.inner = found.inner; }
  }
  if (node.type.name === 'table') return measureTable(view, node, pos, el, self);
  if (!SPLITTABLE.has(node.type.name) || depth >= MAX_DEPTH) return [self];
  const childInBox = inBox || node.type.name === 'callout';
  const units: Measured[] = [];
  node.forEach((child, offset) => {
    const childPos = pos + 1 + offset;
    const childEl = view.nodeDOM(childPos);
    if (childEl instanceof HTMLElement) units.push(...measureNode(view, child, childPos, childEl, depth + 1, childInBox, scale));
  });
  if (units.length === 0) return [self];
  // Couper avant le premier enfant, c'est couper avant le conteneur (titre de l'encadré compris)
  const mt = collapsesThrough(cs, 'Top') ? Math.max(self.mt, units[0].mt) : self.mt;
  units[0] = { ...units[0], pos, anchor: el, top: r.top, mt, inBox, row: undefined };
  const last = units.length - 1;
  const mb = collapsesThrough(cs, 'Bottom') ? Math.max(self.mb, units[last].mb) : self.mb;
  units[last] = { ...units[last], bottom: r.bottom, mb };
  return units;
}

/**
 * Lignes d'un tableau (lot T15b). Une ligne ne devient une unité à part que si l'on peut couper
 * juste avant : aucune cellule fusionnée ne traverse la limite, et ce n'est pas la première ligne
 * de données sous l'en-tête (l'en-tête ne reste jamais seul en bas de page).
 */
function measureTable(view: EditorView, node: PMNode, pos: number, el: HTMLElement, self: Measured): Measured[] {
  if (node.childCount < 2) return [self];
  let map: TableMap;
  try { map = TableMap.get(node); } catch { return [self]; }
  const first = node.firstChild;
  const hasHead = !!first && first.childCount > 0 && Array.from({ length: first.childCount }, (_, i) => first.child(i)).every((c) => c.type.name === 'tableHeader');
  const headEl = view.nodeDOM(pos + 1);
  const headH = hasHead && headEl instanceof HTMLElement ? headEl.getBoundingClientRect().height : 0;
  const scaleOf = (view.dom as HTMLElement).getBoundingClientRect().width / (parseFloat(getComputedStyle(view.dom as HTMLElement).width) || 1) || 1;
  const row: RowBreak = { cols: map.width, headPos: hasHead ? pos + 1 : null, headH: headH / scaleOf };
  const units: Measured[] = [];
  let r = 0;
  node.forEach((child, offset) => {
    const rowPos = pos + 1 + offset;
    const rowEl = view.nodeDOM(rowPos);
    const index = r++;
    if (!(rowEl instanceof HTMLElement)) return;
    const rr = rowEl.getBoundingClientRect();
    const crossing = index > 0 && Array.from({ length: map.width }, (_, c) => map.map[(index - 1) * map.width + c] === map.map[index * map.width + c]).some(Boolean);
    const glued = index === 0 || crossing || (hasHead && index === 1);
    if (glued && units.length) {
      units[units.length - 1].bottom = rr.bottom;
      return;
    }
    units.push({ pos: rowPos, anchor: rowEl, top: rr.top, bottom: rr.bottom, mt: 0, mb: 0, type: child.type.name, inBox: self.inBox, row });
  });
  if (units.length < 2) return [self];
  units[0] = { ...units[0], pos, anchor: el, top: self.top, mt: self.mt, row: undefined };
  const last = units.length - 1;
  units[last] = { ...units[last], bottom: self.bottom, mb: self.mb };
  return units;
}

/**
 * Positions lues au sous-pixel (getBoundingClientRect, ramené au zoom) : additionner des hauteurs
 * arrondies (`offsetHeight`) décale le bas de page de plusieurs px au fil des blocs. On retire de
 * chaque position l'effet des intercalaires déjà posés — leur hauteur, plus la marge qui ne se
 * confond plus de part et d'autre (sans intercalaire : max(mb, mt) ; avec : mb + mt) — pour
 * retrouver la position « naturelle », indépendante de la mise en page précédente.
 */
export function measureUnits(view: EditorView): Unit[] {
  const dom = view.dom as HTMLElement;
  const domTop = dom.getBoundingClientRect().top;
  // Largeur exacte avant zoom (offsetWidth est arrondi au px : 681 pour 680,7, soit ≈ 0,3 px
  // de dérive par page)
  const layoutW = parseFloat(getComputedStyle(dom).width) || dom.offsetWidth;
  const scale = layoutW ? dom.getBoundingClientRect().width / layoutW : 1;
  const measured: Measured[] = [];
  view.state.doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset);
    if (el instanceof HTMLElement) measured.push(...measureNode(view, node, offset, el, 0, false, scale));
  });
  const units: Unit[] = [];
  let removed = 0; // décalage dû aux intercalaires actuels, au-dessus de l'unité courante
  let lastMb = 0;
  for (const m of measured) {
    let before = m.anchor.previousElementSibling as HTMLElement | null;
    // En-tête de tableau répété : sa hauteur s'ajoute à celle de la ligne fantôme
    if (before?.classList.contains('ce-spacer-head')) {
      removed += before.getBoundingClientRect().height / scale;
      before = before.previousElementSibling as HTMLElement | null;
    }
    if (before?.classList.contains('ce-spacer--row')) removed += before.getBoundingClientRect().height / scale;
    else if (before?.classList.contains('ce-spacer')) removed += (parseFloat(before.style.height) || 0) + Math.min(lastMb, m.mt);
    const inner = (m.inner ?? 0) / scale;
    units.push({
      pos: m.pos,
      top: (m.top - domTop) / scale - removed,
      h: (m.bottom - m.top) / scale - inner,
      mt: m.mt,
      mb: m.mb,
      type: m.type,
      ...(m.inBox ? { inBox: true } : {}),
      ...(m.row ? { row: m.row } : {}),
      ...(m.page ? { page: true } : {}),
      ...(m.empty ? { empty: true } : {}),
      ...(m.lines ? { lines: m.lines.map((l) => ({ ...l, top: (l.top - domTop) / scale - removed })) } : {}),
    });
    removed += inner; // les unités suivantes sont décalées des intercalaires posés dans ce paragraphe
    lastMb = m.mb;
  }
  return units;
}

// ---- 2) Répartition (calcul pur, testé dans __tests__/coursePagination.test.ts) ----

export function paginate(units: Unit[], gap: number): PageLayout {
  const stride = PAGE_H + gap;
  const spacers: Spacer[] = [];
  let shift = 0; // décalage dû aux intercalaires de la nouvelle mise en page
  let pageTop = 0;
  let prevBottom: number | null = null;
  let prevMb = 0;
  let forceBreak = false;

  units.forEach((u, i) => {
    const { pos, h, mt, mb } = u;
    let top = u.top + shift;

    /**
     * Coupe le paragraphe au début d'une ligne (lot T15c) tant que le reste déborde : la dernière
     * ligne qui tient sur la page, avec au moins deux lignes de chaque côté. Vrai si on a coupé.
     */
    const cutLines = (): boolean => {
      const lines = u.lines;
      if (!lines) return false;
      const n = lines.length;
      let from = 0;
      let cut = false;
      for (;;) {
        const room = pageTop + CONTENT_H + 0.5;
        if (u.top + h + shift <= room) break;
        let k = -1;
        for (let j = n - 2; j >= from + 2; j--) {
          if (lines[j].ok && lines[j].top + shift <= room) { k = j; break; }
        }
        if (k < 0) break;
        const start = lines[k].top + shift;
        const nextTop = pageTop + stride;
        if (nextTop - start <= 0) break;
        spacers.push({ pos: lines[k].pos, h: nextTop - start, inline: true });
        shift += nextTop - start;
        pageTop = nextTop;
        from = k;
        cut = true;
      }
      return cut;
    };

    // Juste sous une page entière, un saut de page ou le paragraphe vide qui termine le cours reste
    // sur cette feuille (caché sous l'image) : renvoyé à la suivante, il imprimerait une page blanche
    const afterPage = !!units[i - 1]?.page && !forceBreak;
    let placed = afterPage && (u.type === 'pageBreak' || (!!u.empty && i === units.length - 1));
    if (u.lines && !forceBreak && top + h > pageTop + CONTENT_H + 0.5) placed = cutLines();
    if (!placed && prevBottom !== null) {
      const notFirstOnPage = top - mt > pageTop + 0.5;
      // Titre « solidaire du suivant » (comme dans Word) : il emmène au moins le début du bloc suivant
      const next = units[i + 1];
      const keep = u.type === 'heading' && next && next.type !== 'pageBreak' ? Math.max(0, next.top - u.top - h) + Math.min(next.h, KEEP_WITH_NEXT_PX) : 0;
      if (forceBreak || (notFirstOnPage && top + h + keep > pageTop + CONTENT_H)) {
        const nextTop = pageTop + stride;
        const start = prevBottom + prevMb;
        const height = nextTop - start;
        if (height > 0) {
          const spacer: Spacer = { pos, h: height };
          if (u.row) spacer.row = u.row;
          if (u.inBox) spacer.inBox = true;
          if (u.inBox || u.row) {
            // Bande de bureau entre la feuille courante et la suivante (vide à l'impression)
            const a = Math.min(height, Math.max(0, pageTop + PAGE_H - MARGIN - start));
            const b = Math.min(height, Math.max(a, pageTop + stride - MARGIN - start));
            spacer.cut = { a, b };
          }
          spacers.push(spacer);
          // Sous la ligne d'en-tête répétée, pour un tableau
          const head = u.row?.headPos != null ? u.row.headH : 0;
          shift += nextTop + mt + head - top;
          top = nextTop + mt + head;
          pageTop = nextTop;
        }
      }
    }
    // Renvoyé en haut de page mais encore trop haut pour elle : un long paragraphe se coupe
    if (!placed && u.lines && top + h > pageTop + CONTENT_H + 0.5) cutLines();
    top = u.top + shift;
    // Une unité qui a débordé seule (plus haute qu'une page) : la page suivante commence après elle
    while (top >= pageTop + stride) pageTop += stride;

    prevBottom = top + h;
    prevMb = mb;
    forceBreak = u.type === 'pageBreak';
  });

  const bottom = prevBottom ?? 0;
  const pages = Math.max(Math.round(pageTop / stride) + 1, Math.floor(Math.max(0, bottom - 1) / stride) + 1, forceBreak ? Math.round(pageTop / stride) + 2 : 1);
  return { pages, spacers, gap };
}

/** Calcule la répartition en pages. */
export function computeLayout(view: EditorView, gap: number): PageLayout {
  return paginate(measureUnits(view), gap);
}

function sameLayout(a: PageLayout, b: PageLayout): boolean {
  if (a.pages !== b.pages || a.gap !== b.gap || a.spacers.length !== b.spacers.length) return false;
  return a.spacers.every((s, i) => {
    const o = b.spacers[i];
    if (s.pos !== o.pos || Math.abs(s.h - o.h) >= 0.5 || !s.row !== !o.row || !s.inline !== !o.inline) return false;
    if (s.row && o.row && (s.row.cols !== o.row.cols || s.row.headPos !== o.row.headPos || Math.abs(s.row.headH - o.row.headH) >= 0.5)) return false;
    if (!s.cut || !o.cut) return !s.cut && !o.cut;
    return Math.abs(s.cut.a - o.cut.a) < 0.5 && Math.abs(s.cut.b - o.cut.b) < 0.5;
  });
}

function applyLayout(view: EditorView, layout: PageLayout, onLayout?: (l: PageLayout) => void) {
  const current = paginationKey.getState(view.state)?.layout;
  if (current && sameLayout(current, layout)) return;
  view.dispatch(view.state.tr.setMeta(paginationKey, layout).setMeta('addToHistory', false));
  onLayout?.(layout);
}

/** Recalcule tout de suite (impression : l'espace entre feuilles passe à 0 avant le rendu). */
export function relayoutNow(editor: Editor, gap?: number) {
  if (gap !== undefined) editor.storage.coursePagination.gap = gap;
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'coursePagination');
  applyLayout(editor.view, computeLayout(editor.view, editor.storage.coursePagination.gap), (ext?.options as PaginationOptions | undefined)?.onLayout);
}

export const CoursePagination = Extension.create<PaginationOptions, PaginationStorage>({
  name: 'coursePagination',

  addOptions() {
    return { onLayout: undefined };
  },

  addStorage() {
    return { gap: SHEET_GAP };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const options = this.options;
    return [
      new Plugin<PaginationState>({
        key: paginationKey,
        state: {
          init: () => ({ deco: DecorationSet.empty, layout: { pages: 1, spacers: [], gap: SHEET_GAP } }),
          apply(tr, value) {
            const next = tr.getMeta(paginationKey) as PageLayout | undefined;
            if (next) return { deco: DecorationSet.create(tr.doc, next.spacers.flatMap(spacerWidgets)), layout: next };
            if (!tr.docChanged) return value;
            return { deco: value.deco.map(tr.mapping, tr.doc), layout: value.layout };
          },
        },
        props: {
          decorations(state) {
            return paginationKey.getState(state)?.deco;
          },
        },
        view(view) {
          // Minuterie plutôt que requestAnimationFrame : regroupe les recalculs pendant la frappe,
          // et fonctionne même quand la fenêtre n'est pas dessinée (rAF y est suspendu).
          let timer = 0;
          const schedule = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
              if (!view.isDestroyed) applyLayout(view, computeLayout(view, storage.gap), options.onLayout);
            }, LAYOUT_DELAY_MS);
          };
          schedule();
          // Images qui finissent de charger, police qui arrive, zoom : la hauteur des blocs change
          const ro = new ResizeObserver(schedule);
          ro.observe(view.dom);
          void document.fonts?.ready.then(schedule);
          return {
            update: (_v, prev) => { if (prev.doc !== view.state.doc) schedule(); },
            destroy: () => { window.clearTimeout(timer); ro.disconnect(); },
          };
        },
      }),
    ];
  },
});
