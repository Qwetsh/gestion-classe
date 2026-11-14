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
 * La mise en page part des positions « naturelles » des unités (intercalaires déjà posés retirés) :
 * elle ne dépend pas de la mise en page précédente, donc pas d'oscillation. Une unité plus haute
 * qu'une page (grand tableau, très long paragraphe) déborde simplement.
 */
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
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

function spacerWidget(s: Spacer) {
  return Decoration.widget(s.pos, () => {
    const el = document.createElement('div');
    el.className = s.cut ? 'ce-spacer ce-spacer--cut' : 'ce-spacer';
    el.style.height = `${s.h}px`;
    if (s.cut) {
      el.style.setProperty('--cut-a', `${s.cut.a}px`);
      el.style.setProperty('--cut-b', `${s.cut.b}px`);
    }
    el.setAttribute('aria-hidden', 'true');
    return el;
  }, { side: -1, key: `sp-${s.pos}-${Math.round(s.h * 10)}-${s.cut ? Math.round(s.cut.a * 10) : ''}`, ignoreSelection: true });
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

interface Measured { pos: number; anchor: HTMLElement; top: number; bottom: number; mt: number; mb: number; type: string; inBox: boolean }

/**
 * Unités d'un nœud : lui-même, ou (conteneur sécable) celles de ses enfants, la première prenant
 * le haut du conteneur et la dernière son bas.
 */
function measureNode(view: EditorView, node: PMNode, pos: number, el: HTMLElement, depth: number, inBox: boolean): Measured[] {
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const self: Measured = {
    pos, anchor: el, top: r.top, bottom: r.bottom,
    mt: parseFloat(cs.marginTop) || 0, mb: parseFloat(cs.marginBottom) || 0, type: node.type.name, inBox,
  };
  if (!SPLITTABLE.has(node.type.name) || depth >= MAX_DEPTH) return [self];
  const childInBox = inBox || node.type.name === 'callout';
  const units: Measured[] = [];
  node.forEach((child, offset) => {
    const childPos = pos + 1 + offset;
    const childEl = view.nodeDOM(childPos);
    if (childEl instanceof HTMLElement) units.push(...measureNode(view, child, childPos, childEl, depth + 1, childInBox));
  });
  if (units.length === 0) return [self];
  // Couper avant le premier enfant, c'est couper avant le conteneur (titre de l'encadré compris)
  const mt = collapsesThrough(cs, 'Top') ? Math.max(self.mt, units[0].mt) : self.mt;
  units[0] = { ...units[0], pos, anchor: el, top: r.top, mt, inBox };
  const last = units.length - 1;
  const mb = collapsesThrough(cs, 'Bottom') ? Math.max(self.mb, units[last].mb) : self.mb;
  units[last] = { ...units[last], bottom: r.bottom, mb };
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
  // Largeur exacte avant zoom (offsetWidth est arrondi au px : 605 pour 604,72, soit ≈ 0,5 px
  // de dérive par page)
  const layoutW = parseFloat(getComputedStyle(dom).width) || dom.offsetWidth;
  const scale = layoutW ? dom.getBoundingClientRect().width / layoutW : 1;
  const measured: Measured[] = [];
  view.state.doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset);
    if (el instanceof HTMLElement) measured.push(...measureNode(view, node, offset, el, 0, false));
  });
  const units: Unit[] = [];
  let removed = 0; // décalage dû aux intercalaires actuels, au-dessus de l'unité courante
  let lastMb = 0;
  for (const m of measured) {
    const before = m.anchor.previousElementSibling as HTMLElement | null;
    if (before?.classList.contains('ce-spacer')) removed += (parseFloat(before.style.height) || 0) + Math.min(lastMb, m.mt);
    units.push({
      pos: m.pos,
      top: (m.top - domTop) / scale - removed,
      h: (m.bottom - m.top) / scale,
      mt: m.mt,
      mb: m.mb,
      type: m.type,
      ...(m.inBox ? { inBox: true } : {}),
    });
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
    if (prevBottom !== null) {
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
          if (u.inBox) {
            // Bande de bureau entre la feuille courante et la suivante (vide à l'impression)
            const a = Math.min(height, Math.max(0, pageTop + PAGE_H - MARGIN - start));
            const b = Math.min(height, Math.max(a, pageTop + stride - MARGIN - start));
            spacer.cut = { a, b };
          }
          spacers.push(spacer);
          shift += nextTop + mt - top;
          top = nextTop + mt;
          pageTop = nextTop;
        }
      }
    }
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
    if (s.pos !== o.pos || Math.abs(s.h - o.h) >= 0.5) return false;
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
            if (next) return { deco: DecorationSet.create(tr.doc, next.spacers.map(spacerWidget)), layout: next };
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
