/**
 * Photographier un morceau d'un document d'activité (lecteur du panneau « Activité ») pour le
 * poser sur le tableau comme une image fidèle à la mise en page du cours.
 *
 * Les blocs choisis sont copiés depuis le DOM déjà affiché (images chargées comprises), replacés
 * dans les mêmes conteneurs (liste, tableau, encadré) pour garder leur style, puis rasterisés hors
 * écran avec html2canvas.
 */
import html2canvas from 'html2canvas';
import type { EditorView } from '@tiptap/pm/view';
import { COL_W } from './course/coursePage';
import type { PickRange } from './activityBlocks';

/** Éléments ajoutés par la mise en page (intercalaires de pages, marques) : jamais dans la photo. */
const LAYOUT_NOISE = '.ce-spacer, .ce-spacer-head, .ce-invisible, [data-ce-noise]';

export class CaptureError extends Error {}

/** Couleurs que html2canvas ne sait pas lire (CSS moderne) : `color(srgb …)`, `color-mix(…)`, `oklch(…)`… */
const MODERN_COLOR = /color\(|color-mix\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(/;
const COLOR_PROPS = ['color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'textDecorationColor'] as const;
const COMPLEX_PROPS = ['backgroundImage', 'boxShadow', 'textShadow'] as const;

/**
 * Ramène à du `rgb()` les couleurs que le navigateur sait écrire mais pas html2canvas. Une couleur
 * est lue par le navigateur lui-même (un pixel peint sur un canevas) ; un dégradé ou une ombre qui
 * en contient est retiré plutôt que de faire échouer toute la photo.
 */
function legacyColors(root: HTMLElement) {
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  ctx.canvas.width = ctx.canvas.height = 1;
  const rgb = (value: string): string => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    const cs = getComputedStyle(el);
    for (const prop of COLOR_PROPS) if (MODERN_COLOR.test(cs[prop])) el.style[prop] = rgb(cs[prop]);
    for (const prop of COMPLEX_PROPS) if (MODERN_COLOR.test(cs[prop])) el.style[prop] = 'none';
  }
}

/** Copie profonde d'un bloc affiché, débarrassée de ce qui n'est pas du contenu. */
function cleanClone(el: Element): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(LAYOUT_NOISE).forEach((n) => n.remove());
  copy.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
  copy.querySelectorAll<HTMLImageElement>('img').forEach((img) => { img.crossOrigin = 'anonymous'; });
  return copy;
}

/** Image PNG du morceau `range` du document affiché par `view`. */
export async function captureRange(view: EditorView, range: PickRange, scale = 2): Promise<Blob> {
  const doc = view.state.doc;
  const $from = doc.resolve(range.from);
  const flow = view.dom.closest('.ce-flow') as HTMLElement | null;
  if (!flow) throw new CaptureError('Le document n’est pas affiché.');

  // Les blocs frères choisis, tels qu'affichés
  const picked: HTMLElement[] = [];
  for (let pos = range.from; pos < range.to;) {
    const node = doc.nodeAt(pos);
    if (!node) break;
    const dom = view.nodeDOM(pos);
    if (dom instanceof HTMLElement) picked.push(cleanClone(dom));
    pos += node.nodeSize;
  }
  if (picked.length === 0) throw new CaptureError('Rien à photographier.');

  // Le même habillage que le cours : conteneur du flux, éditeur, puis les conteneurs du morceau (liste, tableau…)
  const host = flow.cloneNode(false) as HTMLElement;
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${COL_W}px`, background: '#ffffff', zIndex: '-1' });
  const editor = view.dom.cloneNode(false) as HTMLElement;
  editor.removeAttribute('contenteditable');
  let inner: HTMLElement = editor;
  host.appendChild(editor);
  for (let depth = 1; depth <= $from.depth; depth++) {
    const dom = view.nodeDOM($from.before(depth));
    if (!(dom instanceof HTMLElement)) continue;
    const shell = dom.cloneNode(false) as HTMLElement;
    inner.appendChild(shell);
    inner = shell;
  }
  for (const el of picked) inner.appendChild(el);
  document.body.appendChild(host);

  try {
    legacyColors(host);
    await Promise.all([...host.querySelectorAll('img')].map((img) => (img.complete ? Promise.resolve() : new Promise<void>((done) => { img.onload = () => done(); img.onerror = () => done(); }))));
    const canvas = await html2canvas(host, { backgroundColor: '#ffffff', scale, useCORS: true, logging: false });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new CaptureError('L’image n’a pas pu être produite.'))), 'image/png');
    });
  } finally {
    host.remove();
  }
}
