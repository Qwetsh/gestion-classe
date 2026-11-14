/**
 * Pagination A4 de l'éditeur de cours.
 *
 * Le document reste un seul flux ProseMirror (une seule zone éditable : sélection, copier-coller
 * et annulation traversent les pages). Pour le répartir sur des feuilles, on mesure les blocs de
 * premier niveau et on insère avant le premier bloc qui déborde un intercalaire (décoration
 * « widget ») assez haut pour le renvoyer en haut de la page suivante : marge du bas, espace entre
 * les feuilles, marge du haut. Les feuilles blanches sont dessinées derrière par CourseEditor.
 *
 * La mise en page part des positions « naturelles » des blocs (intercalaires déjà posés retirés) :
 * elle ne dépend pas de la mise en page précédente, donc pas d'oscillation. Un bloc plus haut
 * qu'une page (grand tableau) déborde simplement.
 */
import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { CONTENT_H, PAGE_H, SHEET_GAP } from '../../lib/course/coursePage';

export interface PageLayout {
  /** Nombre de feuilles. */
  pages: number;
  /** Intercalaires : position ProseMirror du bloc renvoyé à la page suivante, hauteur en px. */
  spacers: { pos: number; h: number }[];
  /** Espace entre les feuilles utilisé pour ce calcul (0 à l'impression). */
  gap: number;
}

interface PaginationState { deco: DecorationSet; layout: PageLayout }

export const paginationKey = new PluginKey<PaginationState>('coursePagination');

/** Délai entre une modification et le recalcul des pages. */
const LAYOUT_DELAY_MS = 60;
/** Un titre en bas de page doit pouvoir emmener ce début du bloc suivant (≈ 2 lignes). */
const KEEP_WITH_NEXT_PX = 48;

interface PaginationOptions {
  onLayout?: (layout: PageLayout) => void;
}

interface PaginationStorage {
  gap: number;
  /** Hauteur utile d'une page (dépend des marges du cours, lot Q4). */
  contentH: number;
}

declare module '@tiptap/core' {
  interface Storage {
    coursePagination: PaginationStorage;
  }
}

function spacerWidget(s: { pos: number; h: number }) {
  return Decoration.widget(s.pos, () => {
    const el = document.createElement('div');
    el.className = 'ce-spacer';
    el.style.height = `${s.h}px`;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }, { side: -1, key: `sp-${s.pos}-${Math.round(s.h * 10)}`, ignoreSelection: true });
}

/**
 * Calcule la répartition en pages.
 *
 * Positions lues au sous-pixel (getBoundingClientRect, ramené au zoom) : additionner des hauteurs
 * arrondies (`offsetHeight`) décale le bas de page de plusieurs px au fil des blocs. On retire de
 * chaque position l'effet des intercalaires déjà posés — leur hauteur, plus la marge qui ne se
 * confond plus de part et d'autre (sans intercalaire : max(mb, mt) ; avec : mb + mt) — pour
 * retrouver la position « naturelle », indépendante de la mise en page précédente.
 */
export function computeLayout(view: EditorView, gap: number, contentH: number = CONTENT_H): PageLayout {
  const stride = PAGE_H + gap;
  const spacers: PageLayout['spacers'] = [];
  const dom = view.dom as HTMLElement;
  const domTop = dom.getBoundingClientRect().top;
  const scale = dom.offsetWidth ? dom.getBoundingClientRect().width / dom.offsetWidth : 1;
  // 1) Mesure : position naturelle, hauteur et marges de chaque bloc de premier niveau
  const blocks: { offset: number; natural: number; h: number; mt: number; mb: number; type: string }[] = [];
  let removed = 0; // décalage dû aux intercalaires actuels, au-dessus du bloc courant
  let lastMb = 0;
  view.state.doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset);
    if (!(el instanceof HTMLElement)) return;
    const cs = getComputedStyle(el);
    const mt = parseFloat(cs.marginTop) || 0;
    const mb = parseFloat(cs.marginBottom) || 0;
    const r = el.getBoundingClientRect();
    const before = el.previousElementSibling as HTMLElement | null;
    if (before?.classList.contains('ce-spacer')) removed += (parseFloat(before.style.height) || 0) + Math.min(lastMb, mt);
    blocks.push({ offset, natural: (r.top - domTop) / scale - removed, h: r.height / scale, mt, mb, type: node.type.name });
    lastMb = mb;
  });

  // 2) Répartition en pages
  let shift = 0; // décalage dû aux intercalaires de la nouvelle mise en page
  let pageTop = 0;
  let prevBottom: number | null = null;
  let prevMb = 0;
  let forceBreak = false;

  blocks.forEach((b, i) => {
    const { offset, h, mt, mb } = b;
    let top = b.natural + shift;
    if (prevBottom !== null) {
      const notFirstOnPage = top - mt > pageTop + 0.5;
      // Titre « solidaire du suivant » (comme dans Word) : il emmène au moins le début du bloc suivant
      const next = blocks[i + 1];
      const keep = b.type === 'heading' && next && next.type !== 'pageBreak' ? Math.max(0, next.natural - b.natural - h) + Math.min(next.h, KEEP_WITH_NEXT_PX) : 0;
      if (forceBreak || (notFirstOnPage && top + h + keep > pageTop + contentH)) {
        const next = pageTop + stride;
        const spacer = next - prevBottom - prevMb;
        if (spacer > 0) {
          spacers.push({ pos: offset, h: spacer });
          shift += next + mt - top;
          top = next + mt;
          pageTop = next;
        }
      }
    }
    // Un bloc qui a débordé seul (plus haut qu'une page) : la page suivante commence après lui
    while (top >= pageTop + stride) pageTop += stride;

    prevBottom = top + h;
    prevMb = mb;
    forceBreak = b.type === 'pageBreak';
  });

  const bottom = prevBottom ?? 0;
  const pages = Math.max(Math.round(pageTop / stride) + 1, Math.floor(Math.max(0, bottom - 1) / stride) + 1, forceBreak ? Math.round(pageTop / stride) + 2 : 1);
  return { pages, spacers, gap };
}

function sameLayout(a: PageLayout, b: PageLayout): boolean {
  if (a.pages !== b.pages || a.gap !== b.gap || a.spacers.length !== b.spacers.length) return false;
  return a.spacers.every((s, i) => s.pos === b.spacers[i].pos && Math.abs(s.h - b.spacers[i].h) < 0.5);
}

function applyLayout(view: EditorView, layout: PageLayout, onLayout?: (l: PageLayout) => void) {
  const current = paginationKey.getState(view.state)?.layout;
  if (current && sameLayout(current, layout)) return;
  view.dispatch(view.state.tr.setMeta(paginationKey, layout).setMeta('addToHistory', false));
  onLayout?.(layout);
}

/**
 * Recalcule tout de suite (impression : l'espace entre feuilles passe à 0 avant le rendu ;
 * marges : la hauteur utile des pages change).
 */
export function relayoutNow(editor: Editor, gap?: number, contentH?: number) {
  if (gap !== undefined) editor.storage.coursePagination.gap = gap;
  if (contentH !== undefined) editor.storage.coursePagination.contentH = contentH;
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'coursePagination');
  const st = editor.storage.coursePagination;
  applyLayout(editor.view, computeLayout(editor.view, st.gap, st.contentH), (ext?.options as PaginationOptions | undefined)?.onLayout);
}

export const CoursePagination = Extension.create<PaginationOptions, PaginationStorage>({
  name: 'coursePagination',

  addOptions() {
    return { onLayout: undefined };
  },

  addStorage() {
    return { gap: SHEET_GAP, contentH: CONTENT_H };
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
              if (!view.isDestroyed) applyLayout(view, computeLayout(view, storage.gap, storage.contentH), options.onLayout);
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
