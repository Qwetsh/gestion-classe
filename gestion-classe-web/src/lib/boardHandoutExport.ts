/**
 * Export « page web pour les élèves » (voir `boardHandout`) : rend chaque page dans son état final,
 * embarque les animations (code, bibliothèques, fichiers joints) et télécharge un fichier HTML.
 */
import { animationInfo, animationLibs, animationSrcDoc, isSceneLib } from './boardAnimation';
import { BOARD_UNIT, pageHeight, renderPageToCanvas, type BoardPage } from './boardRender';
import { buildHandoutHtml, handoutPage, toFraction, type HandoutAnimation, type HandoutScreen } from './boardHandout';
import { loadSceneAsset, loadSceneLib } from './sceneAssets';
import { downloadBlob } from './boardFile';

export interface HandoutExportOptions {
  /** Indices des pages à exporter (toutes si absent). */
  pageIndexes?: number[];
  /** Sans l'encre écrite par-dessus. */
  hideInk?: boolean;
}

/** Largeur de rendu des pages : nette sur un écran d'ordinateur, raisonnable en poids. */
const RENDER_W = 1600;

export const handoutFileName = (name: string) => `${name.replace(/[^\w\dÀ-ÿ -]+/g, '').trim() || 'Tableau'} - élèves.html`;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

/** Fabrique le fichier (sans le télécharger). */
export async function buildBoardHandout(pages: BoardPage[], name: string, opts: HandoutExportOptions = {}): Promise<string> {
  const indexes = (opts.pageIndexes ?? pages.map((_, i) => i)).filter((i) => pages[i]);
  const states = indexes.map((i) => handoutPage(pages[i]));
  const screenOf = new Map(indexes.map((i, k) => [pages[i].id, k]));

  // Bibliothèques des scènes riches, une fois pour tout le fichier
  const libNames = [...new Set(states.flatMap((s) => s.animations.flatMap((a) => animationLibs(a.code))))].filter(isSceneLib);
  const libs: Record<string, string> = {};
  await Promise.all(libNames.map((n) => loadSceneLib(n).then((src) => { libs[n] = src; }, (err) => console.error('[export élèves]', err))));

  const animations: HandoutAnimation[] = [];
  const screens: HandoutScreen[] = [];
  for (const state of states) {
    const page = state.page;
    const h = pageHeight(page);
    const canvas = await renderPageToCanvas(page, RENDER_W, { mode: 'revealed', hideInk: opts.hideInk });
    const screen: HandoutScreen = {
      image: canvas.toDataURL('image/jpeg', 0.9),
      links: state.links
        .filter((l) => screenOf.has(l.pageId))
        .map((l) => ({ rect: toFraction(l.rect, BOARD_UNIT, h), target: screenOf.get(l.pageId)! })),
      animations: [],
    };
    for (const a of state.animations) {
      const info = animationInfo(a.code);
      const assets = await Promise.all((a.assets ?? []).map((f) => loadSceneAsset(f.path).then(
        (loaded) => ({ name: f.name, type: loaded.type, base64: toBase64(loaded.buffer) }),
        (err) => { console.error('[export élèves]', err); return null; },
      )));
      screen.animations.push({ rect: toFraction(a, BOARD_UNIT, h), index: animations.length });
      animations.push({
        title: a.title ?? info.title ?? 'Animation',
        steps: info.contract ? info.steps.length : 1,
        srcdoc: animationSrcDoc(a.code, libs),
        assets: assets.filter((x): x is NonNullable<typeof x> => !!x),
      });
    }
    screens.push(screen);
  }
  return buildHandoutHtml({ title: name, screens, animations });
}

/** Fabrique le fichier et le télécharge. */
export async function exportBoardHandout(pages: BoardPage[], name: string, opts: HandoutExportOptions = {}): Promise<void> {
  const html = await buildBoardHandout(pages, name, opts);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), handoutFileName(name));
}
