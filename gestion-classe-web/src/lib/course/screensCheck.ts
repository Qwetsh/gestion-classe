/**
 * Vérificateur des écrans d'un cours (`npm run screens:check`) — étape 3 de
 * PLAN_preparation_semaine.md, phase 0 de PLAN_vision_suite.md.
 *
 * Les écrans sont des pages de tableau blanc écrites par Claude, hors de l'application. Ce contrôle
 * les lit avant tout envoi et dit ce qui ne passerait pas, ou passerait mal :
 *
 *  - **erreurs** : ce que la fonction de dépôt refuserait (identifiants, fond, balises), ce que le
 *    tableau ne saurait pas afficher (type d'objet inconnu, champ manquant), un bouton ou un cache
 *    qui vise un objet absent, un objet hors de l'écran ;
 *  - **avertissements** : ce qui s'affiche mais se lit mal sur le TBI (texte trop petit), et ce
 *    qu'une estimation de la hauteur des textes laisse craindre (débordement, chevauchement).
 *
 * La hauteur d'un texte dépend de la police et du rendu : elle est ici **estimée**. Seul un rendu
 * dans l'application la donne vraiment ; ces avertissements disent où regarder, pas ce qui est faux.
 */
import { ANIMATION_MAX_CHARS, SCENE_LIBS, animationInfo, animationLibs, isSceneLib } from '../boardAnimation';

/** Page logique du tableau blanc : 1000 × 562,5 (16:9). */
export const PAGE_W = 1000;
export const PAGE_H = 562.5;
/**
 * Bas de l'écran (Thomas, 19/11/2026) : sous cette ligne, le bureau du prof cache le tableau et le
 * fond de la classe lit mal. Rien à lire en dessous ; des boutons pour le prof, oui.
 */
export const LOW_LINE = 450;

/** Un écran de 1 280 px affiche 1,28 px par unité : un texte de taille 22 y fait 28 px. */
const READABLE_SIZE = 22;
/** En dessous, même une étiquette courte ne se lit plus du fond de la classe (taille 14 = 18 px). */
const SMALL_SIZE = 14;
/** Un texte de plus de 60 caractères est du texte courant, pas une étiquette. */
const RUNNING_TEXT_CHARS = 60;

// Mêmes limites que la fonction de dépôt (supabase/functions/depot-cours)
const MAX_PAGES = 60;
const MAX_PAGES_CHARS = 3_000_000;
const PAGE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const BACKGROUNDS = ['blank', 'grid', 'lines', 'seyes', 'graph', 'axes', 'dots'];
const ALLOWED_TAG = /^<\/?(div|p|li|ul|ol|h1|h2|h3|blockquote|b|strong|i|em|u|s|strike|del|span|sub|sup|br|font)(\s[^<>]*)?\/?>$/i;
const UNSAFE_ATTR = /\son[a-z]+\s*=|javascript:|expression\s*\(|url\s*\(|\ssrc\s*=|\shref\s*=/i;

// Ce que le tableau blanc sait afficher (lib/boardObjects.ts et voisins)
const OBJECT_TYPES = ['text', 'shape', 'image', 'library', 'connector', 'table', 'video', 'web', 'audio', 'link', 'widget', 'equation', 'window', 'animation'];
/** Types dont la hauteur est une donnée (`h`) ; celle d'un texte découle de son contenu. */
const SIZED_TYPES = ['shape', 'image', 'library', 'table', 'video', 'web', 'audio', 'link', 'widget', 'equation', 'window', 'animation'];
const SHAPE_KINDS = ['line', 'arrow', 'double-arrow', 'rect', 'rounded-rect', 'ellipse', 'triangle', 'right-triangle', 'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'star', 'polygon'];
const WIDGET_KINDS = ['timer', 'dice', 'wheel', 'noise', 'calc', 'meter', 'groups', 'clock', 'traffic', 'qr'];
const FONTS = ['sans', 'arial', 'verdana', 'georgia', 'times', 'courier', 'comic'];
const COVER_KINDS = ['curtain', 'scratch'];
const ACTIONS = ['show', 'hide', 'toggle', 'reveal', 'cover', 'unfold', 'fold', 'goto', 'next', 'prev', 'play', 'pause', 'playToggle', 'start', 'stop', 'startToggle', 'roll', 'reset', 'window', 'zoomTo', 'moveTo', 'moveBy', 'moveBack', 'stepNext', 'stepPrev', 'replay'];
/** Actions qui ne visent qu'une animation. */
const ANIMATION_ACTIONS = ['stepNext', 'stepPrev', 'replay'];
const TARGETLESS_ACTIONS = ['goto', 'next', 'prev', 'reset'];

/** Interligne du tableau blanc (lib/boardText.ts) et largeur moyenne d'un caractère, en tailles de police. */
const LINE_HEIGHT = 1.34;
const CHAR_WIDTH = 0.52;

export interface ScreensReport {
  errors: string[];
  warnings: string[];
  pages: number;
  objects: number;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Les balises d'un texte sont-elles toutes de la mise en forme ? (même règle que le dépôt) */
export function htmlProblem(html: unknown): string | null {
  if (typeof html !== 'string') return 'texte absent';
  const bad = (html.match(/<[^>]*>?/g) ?? []).find((tag) => !ALLOWED_TAG.test(tag) || UNSAFE_ATTR.test(tag));
  return bad ? `balise refusée « ${bad.slice(0, 40)} » (écrire &lt; pour le signe <)` : null;
}

/** Texte nu d'un HTML, un bloc par ligne. */
export function htmlLines(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h1|h2|h3|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/** Blocs vides (`<div><br></div>`) : chacun occupe une ligne à l'écran, sans porter de texte. */
export function emptyBlocks(html: string): number {
  return (html.match(/<(div|p)\b[^>]*>(?:\s*(?:<br\s*\/?>|&nbsp;))+\s*<\/\1>/gi) ?? []).length;
}

/**
 * Hauteur estimée d'une zone de texte : chaque bloc occupe autant de lignes que sa longueur le
 * demande pour la largeur donnée, et chaque bloc vide une ligne. Estimation large (mesurée dans
 * l'application le 15/11/2026 : juste ou par excès sur 42 textes).
 */
export function estimateTextHeight(html: string, w: number, size: number, padded: boolean): number {
  const padding = padded ? size * 0.5 : 0;
  const perLine = Math.max(1, Math.floor((w - padding * 2) / (size * CHAR_WIDTH)));
  const lines = htmlLines(html).reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0) + emptyBlocks(html);
  return Math.max(1, lines) * size * LINE_HEIGHT + padding * 2;
}

interface Box { id: string; x: number; y: number; w: number; h: number; text: boolean }

const overlap = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? h : 0;
};

/** Contrôle une suite d'écrans (le contenu d'un fichier `pages.json`). */
export function checkScreens(input: unknown): ScreensReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pages = Array.isArray(input) ? input : isRec(input) && Array.isArray(input.pages) ? input.pages : null;
  if (!pages) return { errors: ['Le fichier doit contenir une liste de pages.'], warnings, pages: 0, objects: 0 };
  if (pages.length === 0) errors.push('Aucune page.');
  if (pages.length > MAX_PAGES) errors.push(`${pages.length} pages : le dépôt en accepte ${MAX_PAGES} au plus.`);
  if (JSON.stringify(pages).length > MAX_PAGES_CHARS) errors.push('Écrans trop lourds pour le dépôt (3 millions de caractères au plus).');

  const pageIds = new Set<string>();
  for (const p of pages) if (isRec(p) && typeof p.id === 'string') pageIds.add(p.id);
  const seenPages = new Set<string>();
  const seenObjects = new Set<string>();
  let objectCount = 0;

  pages.forEach((page, index) => {
    const where = `Écran ${index + 1}`;
    if (!isRec(page)) { errors.push(`${where} : ce n'est pas une page.`); return; }
    const id = page.id;
    if (typeof id !== 'string' || !PAGE_ID.test(id)) errors.push(`${where} : identifiant de page refusé (lettres, chiffres, - et _, 40 caractères au plus).`);
    else if (seenPages.has(id)) errors.push(`${where} : l'identifiant « ${id} » sert déjà à une autre page.`);
    else seenPages.add(id);
    if (page.background !== undefined && !BACKGROUNDS.includes(String(page.background))) errors.push(`${where} : fond « ${String(page.background)} » inconnu.`);
    if (page.strokes !== undefined && !Array.isArray(page.strokes)) errors.push(`${where} : « strokes » doit être une liste.`);
    if (!Array.isArray(page.objects)) { errors.push(`${where} : « objects » doit être une liste.`); return; }
    const pageH = isNum(page.height) && page.height > PAGE_H ? page.height : PAGE_H;

    const ids = new Set<string>();
    const animations = new Set<string>();
    for (const o of page.objects) if (isRec(o) && typeof o.id === 'string') { ids.add(o.id); if (o.type === 'animation' || o.type === 'web') animations.add(o.id); }
    const boxes: Box[] = [];

    page.objects.forEach((object, k) => {
      objectCount++;
      if (!isRec(object)) { errors.push(`${where}, objet ${k + 1} : ce n'est pas un objet.`); return; }
      const o = object;
      const name = typeof o.id === 'string' ? `« ${o.id} »` : `objet ${k + 1}`;
      const at = `${where}, ${name}`;
      if (typeof o.id !== 'string' || o.id === '') errors.push(`${at} : identifiant absent.`);
      else if (seenObjects.has(o.id)) errors.push(`${at} : identifiant déjà utilisé par un autre objet.`);
      else seenObjects.add(o.id);
      if (typeof o.type !== 'string' || !OBJECT_TYPES.includes(o.type)) { errors.push(`${at} : type « ${String(o.type)} » inconnu du tableau blanc.`); return; }
      if (!isNum(o.x) || !isNum(o.y) || !isNum(o.w)) { errors.push(`${at} : x, y et w doivent être des nombres.`); return; }
      if (o.w <= 0) errors.push(`${at} : largeur nulle.`);
      const sized = SIZED_TYPES.includes(o.type);
      if (sized && (!isNum(o.h) || o.h <= 0)) errors.push(`${at} : hauteur « h » absente (${o.type}).`);

      // ---- Contenu selon le type ----
      let height = sized && isNum(o.h) ? o.h : 0;
      if (o.type === 'text') {
        const problem = htmlProblem(o.html);
        if (problem) errors.push(`${at} : ${problem}.`);
        if (!isNum(o.size) || o.size <= 0) errors.push(`${at} : taille de texte absente.`);
        if (typeof o.font === 'string' && !FONTS.includes(o.font)) warnings.push(`${at} : police « ${o.font} » inconnue, le tableau prendra la sienne.`);
        if (typeof o.html === 'string' && isNum(o.size) && o.size > 0) {
          const chars = htmlLines(o.html).join(' ').length;
          if (chars === 0) warnings.push(`${at} : texte vide.`);
          if (o.size < SMALL_SIZE) warnings.push(`${at} : taille ${o.size}, illisible du fond de la classe (${SMALL_SIZE} au moins).`);
          else if (o.size < READABLE_SIZE && chars > RUNNING_TEXT_CHARS) warnings.push(`${at} : ${chars} caractères en taille ${o.size} ; un texte courant se lit à partir de ${READABLE_SIZE}.`);
          height = estimateTextHeight(o.html, o.w, o.size, typeof o.background === 'string');
        }
      } else if (o.type === 'shape') {
        if (typeof o.kind !== 'string' || !SHAPE_KINDS.includes(o.kind)) errors.push(`${at} : forme « ${String(o.kind)} » inconnue.`);
        if (isRec(o.text)) {
          const problem = htmlProblem(o.text.html);
          if (problem) errors.push(`${at} : ${problem}.`);
          if (typeof o.text.html === 'string' && isNum(o.text.size) && isNum(o.h)) {
            const needed = estimateTextHeight(o.text.html, o.w - 12, o.text.size, false);
            if (needed > o.h + o.text.size * 0.5) warnings.push(`${at} : le texte demande environ ${Math.round(needed)} de haut, le cadre en fait ${Math.round(o.h)} (estimation).`);
          }
        }
      } else if (o.type === 'image') {
        if (typeof o.path !== 'string' || o.path === '') errors.push(`${at} : chemin de l'image absent (l'envoyer d'abord avec gc_envoi.py image).`);
        else if (/^https?:/i.test(o.path)) errors.push(`${at} : une image se cite par son chemin de stockage, pas par une adresse.`);
        if (!isNum(o.naturalWidth) || !isNum(o.naturalHeight)) warnings.push(`${at} : dimensions d'origine de l'image absentes.`);
      } else if (o.type === 'animation') {
        if (typeof o.code !== 'string' || o.code.trim() === '') errors.push(`${at} : code de l'animation absent.`);
        else {
          if (o.code.length > ANIMATION_MAX_CHARS) errors.push(`${at} : animation trop lourde (${o.code.length} caractères, ${ANIMATION_MAX_CHARS} au plus).`);
          if (/(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\//i.test(o.code)) errors.push(`${at} : l'animation charge un fichier du réseau ; le tableau le bloque, tout doit être dans le code.`);
          const info = animationInfo(o.code);
          if (!info.contract) warnings.push(`${at} : animation hors contrat « gc-anim » ; les boutons du tableau ne pourront pas la faire avancer.`);
          else if (info.steps.some((s) => s.title.trim() === '')) warnings.push(`${at} : une étape de l'animation n'a pas de titre.`);
          for (const lib of animationLibs(o.code)) {
            if (!isSceneLib(lib)) errors.push(`${at} : bibliothèque « ${lib} » inconnue (${SCENE_LIBS.join(', ')}).`);
          }
          // Fichiers demandés par la scène (gcAsset('…')) mais pas joints : la scène attendrait toujours
          const joined = new Set(Array.isArray(o.assets) ? o.assets.filter(isRec).map((a) => a.name) : []);
          for (const m of o.code.matchAll(/gcAsset\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
            if (!joined.has(m[1])) errors.push(`${at} : la scène lit le fichier « ${m[1]} », qui n'est pas joint (assets).`);
          }
        }
        if (o.assets !== undefined) {
          if (!Array.isArray(o.assets)) errors.push(`${at} : « assets » doit être une liste de { name, path }.`);
          else {
            const names = new Set<string>();
            for (const a of o.assets) {
              if (!isRec(a) || typeof a.name !== 'string' || a.name === '' || typeof a.path !== 'string' || a.path === '') { errors.push(`${at} : fichier joint sans nom ou sans chemin.`); continue; }
              if (/^https?:/i.test(a.path)) errors.push(`${at} : le fichier joint « ${a.name} » se cite par son chemin de stockage, pas par une adresse (gc_envoi.py fichier).`);
              if (names.has(a.name)) errors.push(`${at} : deux fichiers joints s'appellent « ${a.name} ».`);
              names.add(a.name);
            }
          }
        }
        if (o.interactive !== undefined && typeof o.interactive !== 'boolean') errors.push(`${at} : « interactive » vaut true ou false.`);
        if (o.imagePath === undefined) warnings.push(`${at} : pas d'image pour les vignettes et l'export (gc_animation.affiche, puis gc_envoi.py image).`);
        else if (typeof o.imagePath !== 'string' || o.imagePath === '' || /^https?:/i.test(o.imagePath)) errors.push(`${at} : l'image de l'animation se cite par son chemin de stockage, pas par une adresse.`);
      } else if (o.type === 'widget') {
        if (typeof o.widget !== 'string' || !WIDGET_KINDS.includes(o.widget)) errors.push(`${at} : outil « ${String(o.widget)} » inconnu.`);
      } else if (o.type === 'web') {
        if (typeof o.url !== 'string' || !/^https:\/\//i.test(o.url)) errors.push(`${at} : un site se cite par son adresse complète en https://.`);
        if (o.steps !== undefined && !(typeof o.steps === 'number' && Number.isInteger(o.steps) && o.steps >= 1)) errors.push(`${at} : « steps » d'un site pilotable est un nombre entier d'étapes.`);
      } else if (o.type === 'table' && Array.isArray(o.cells)) {
        for (const row of o.cells) for (const cell of Array.isArray(row) ? row : []) { const problem = htmlProblem(cell); if (problem) errors.push(`${at} : ${problem}.`); }
      } else if (o.type === 'window' && 'html' in o) {
        const problem = htmlProblem(o.html);
        if (problem) errors.push(`${at} : ${problem}.`);
      }

      // ---- Cache et interactions ----
      if (o.cover !== undefined && (!isRec(o.cover) || !COVER_KINDS.includes(String(o.cover.kind)))) errors.push(`${at} : cache inconnu (curtain ou scratch).`);
      if (o.interactions !== undefined) {
        if (!Array.isArray(o.interactions)) errors.push(`${at} : « interactions » doit être une liste.`);
        else for (const it of o.interactions) {
          if (!isRec(it) || typeof it.action !== 'string' || !ACTIONS.includes(it.action)) { errors.push(`${at} : action de bouton inconnue.`); continue; }
          if (it.action === 'goto') {
            const target = isRec(it.params) ? it.params.pageId : undefined;
            if (typeof target !== 'string' || !pageIds.has(target)) errors.push(`${at} : le bouton va à une page absente de ces écrans.`);
          } else if (!TARGETLESS_ACTIONS.includes(it.action)) {
            if (typeof it.targetId !== 'string' || !ids.has(it.targetId)) errors.push(`${at} : le bouton vise un objet absent de la page (« ${String(it.targetId)} »).`);
            else if (ANIMATION_ACTIONS.includes(it.action) && !animations.has(it.targetId)) errors.push(`${at} : « ${it.action} » ne s'adresse qu'à une animation ou à un site pilotable (« ${it.targetId} » n'en est pas un).`);
          }
        }
      }

      // ---- Place dans l'écran ----
      if (o.type !== 'connector') {
        if (o.x < 0 || o.y < 0 || o.x + o.w > PAGE_W + 0.5) errors.push(`${at} : dépasse de l'écran (x de ${Math.round(o.x)} à ${Math.round(o.x + o.w)}, la page va de 0 à ${PAGE_W}).`);
        if (o.y + height > pageH + 0.5) {
          const bottom = Math.round(o.y + height);
          if (o.type === 'text') warnings.push(`${at} : le texte descendrait jusqu'à ${bottom}, sous le bas de l'écran (${pageH}) — estimation.`);
          else errors.push(`${at} : descend jusqu'à ${bottom}, sous le bas de l'écran (${pageH}).`);
        }
        const label = o.type === 'shape' && isRec(o.text) && typeof o.text.html === 'string' && htmlLines(o.text.html).join('').trim() !== '';
        const readable = o.type === 'text' || o.type === 'table' || o.type === 'equation' || label;
        const button = Array.isArray(o.interactions) && o.interactions.length > 0;
        if (pageH === PAGE_H && readable && !button && o.y + height > LOW_LINE + 0.5 && o.y + height <= pageH + 0.5) {
          warnings.push(`${at} : descend jusqu'à ${Math.round(o.y + height)}, dans le bas de l'écran (sous ${LOW_LINE}) : caché par le bureau, mal lu du fond de la classe — le remonter.`);
        }
        boxes.push({ id: String(o.id), x: o.x, y: o.y, w: o.w, h: height, text: o.type === 'text' });
      }
    });

    // ---- Textes qui se recouvriraient (estimation) ----
    const texts = boxes.filter((b) => b.text);
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const [a, b] = texts[i].y <= texts[j].y ? [texts[i], texts[j]] : [texts[j], texts[i]];
        const depth = overlap(a, b);
        // Un texte posé exprès dans la zone d'un autre (même y) n'est pas un débordement
        if (depth > 6 && b.y > a.y + 1) warnings.push(`${where} : « ${a.id} » descendrait de ${Math.round(depth)} sur « ${b.id} » (estimation).`);
      }
    }
  });

  return { errors, warnings, pages: pages.length, objects: objectCount };
}
