/**
 * Animations du tableau blanc : une scène HTML autonome (dessin vectoriel animé, étapes, légendes)
 * jouée dans un cadre isolé, posée sur la page comme une image et pilotée par les boutons du
 * tableau (« Étape suivante », « Étape précédente », « Rejouer l'étape »).
 *
 * Le code vit dans l'objet (`AnimationObject.code`) : il suit la page (copies, versions,
 * annulation) et ne dépend d'aucun fichier. Il n'a aucun accès à l'application : le cadre est
 * `sandbox="allow-scripts"` (origine opaque : ni session, ni stockage, ni page parente) et une
 * politique de contenu lui interdit tout accès au réseau.
 *
 * Contrat « gc-anim » (version 1), facultatif. Un HTML qui le suit se pilote étape par étape :
 * - il déclare ses étapes dans
 *   `<script type="application/json" id="gc-anim">{"version":1,"ratio":1.9,"steps":[{"title":"…","caption":"…"}]}</script>` ;
 * - il écoute `message` : `{ gc: 'anim', cmd: 'init' | 'goto', step }`, `{ cmd: 'replay' }`,
 *   `{ cmd: 'play' | 'pause' | 'toggle' }` ;
 * - il annonce `{ gc: 'anim', ev: 'ready', steps }` au chargement.
 * Un HTML quelconque est joué tel quel, en une seule « étape », avec ses propres boutons.
 *
 * Scènes riches (3D, graphiques, modèles, photos) :
 * - bibliothèques : `<script data-gc-lib="three"></script>` (ou `chart`) est remplacé à cet endroit
 *   par la bibliothèque, servie par l'application (public/scene-libs, voir scripts/build-scene-libs.mjs) ;
 *   le code écrit pour une séance reste petit, et rien ne vient du réseau ;
 * - fichiers joints (`assets`) : modèles GLB, images, sons rangés dans le stockage du tableau,
 *   transmis au cadre par message à son chargement ; la scène les lit par
 *   `await gcAsset('patient.glb')` → `{ name, type, buffer, blob, url }` (adresse blob: locale).
 */
import type { BoardObjectBase } from './boardObjects';

export interface AnimationObject extends BoardObjectBase {
  type: 'animation';
  h: number;
  /** Document HTML autonome (scène et lecteur). */
  code: string;
  title?: string;
  /**
   * Image de l'animation dans le bucket (une étape figée) : c'est elle que montrent les vignettes
   * et l'export PDF, où le cadre isolé ne peut pas être dessiné. Sans elle, une carte.
   */
  imagePath?: string;
  /** Vrai : le pointeur passe à l'animation en classe (HTML qui porte ses propres boutons, 3D à tourner). */
  interactive?: boolean;
  /** Fichiers joints (modèles 3D, images, sons), lus par la scène avec `gcAsset(name)`. */
  assets?: AnimationAsset[];
}

/** Un fichier joint à une scène : son nom pour la scène, son chemin dans le stockage du tableau. */
export interface AnimationAsset { name: string; path: string }

/** Bibliothèques qu'une scène peut demander (`<script data-gc-lib="…"></script>`). */
export const SCENE_LIBS = ['three', 'chart'] as const;
export type SceneLib = typeof SCENE_LIBS[number];
export const isSceneLib = (name: string): name is SceneLib => (SCENE_LIBS as readonly string[]).includes(name);

const LIB_RE = /<script\b[^>]*\bdata-gc-lib\s*=\s*["']([\w-]+)["'][^>]*>\s*<\/script\s*>/gi;

/** Bibliothèques demandées par le code, dans l'ordre, sans doublon (connues ou non). */
export function animationLibs(code: string): string[] {
  const names: string[] = [];
  for (const m of code.matchAll(LIB_RE)) if (!names.includes(m[1])) names.push(m[1]);
  return names;
}

export interface AnimationStep { title: string; caption: string }

export interface AnimationInfo {
  /** Le code suit le contrat « gc-anim » : ses étapes se pilotent depuis le tableau. */
  contract: boolean;
  steps: AnimationStep[];
  title?: string;
  /** Largeur / hauteur conseillée du cadre. */
  ratio?: number;
}

/** Taille maximale du code d'une animation, en caractères. */
export const ANIMATION_MAX_CHARS = 300_000;

const DATA_RE = /<script\b[^>]*\bid\s*=\s*["']gc-anim["'][^>]*>([\s\S]*?)<\/script>/i;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;

const cache = new Map<string, AnimationInfo>();
const CACHE_MAX = 40;

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&').trim();

/** Ce que le code d'une animation annonce (étapes, titre, proportions). Résultat gardé en mémoire. */
export function animationInfo(code: string): AnimationInfo {
  const known = cache.get(code);
  if (known) return known;
  const titleMatch = TITLE_RE.exec(code);
  const title = titleMatch ? decode(titleMatch[1]).slice(0, 120) || undefined : undefined;
  let info: AnimationInfo = { contract: false, steps: [{ title: title ?? '', caption: '' }], title };
  const data = DATA_RE.exec(code);
  if (data) {
    try {
      const parsed = JSON.parse(data[1]) as { steps?: unknown; title?: unknown; ratio?: unknown };
      // Une étape masquée n'est pas jouée : elle ne compte pas parmi les étapes pilotables
      const steps = Array.isArray(parsed.steps)
        ? parsed.steps
          .filter((s) => !(s && typeof s === 'object' && (s as { hidden?: unknown }).hidden === true))
          .map((s) => {
            const r = (s && typeof s === 'object' ? s : {}) as { title?: unknown; caption?: unknown };
            return { title: typeof r.title === 'string' ? r.title : '', caption: typeof r.caption === 'string' ? r.caption : '' };
          })
        : [];
      if (steps.length > 0) {
        info = {
          contract: true,
          steps,
          title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim().slice(0, 120) : title,
          ratio: typeof parsed.ratio === 'number' && parsed.ratio > 0.2 && parsed.ratio < 5 ? parsed.ratio : undefined,
        };
      }
    } catch {
      /* bloc illisible : l'animation est jouée comme un HTML quelconque */
    }
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(code, info);
  return info;
}

/** Nombre d'étapes pilotables d'une animation (1 pour un HTML hors contrat). */
export const animationStepCount = (o: Pick<AnimationObject, 'code'>) => animationInfo(o.code).steps.length;

// ---- Retouche des étapes sans toucher au dessin ----

/** Une étape telle qu'elle est écrite dans le bloc « gc-anim » (les champs inconnus sont gardés). */
export interface AnimationStepData {
  /** Identifiant du dessin de l'étape dans la scène ; sans lui, l'ordre des étapes est figé. */
  id?: string;
  title: string;
  caption: string;
  /** Étape masquée : gardée dans le fichier, pas jouée. */
  hidden?: boolean;
  [key: string]: unknown;
}
export interface AnimationData { steps: AnimationStepData[]; [key: string]: unknown }

/** Emplacement du contenu du bloc « gc-anim » dans le code, ou null. */
function dataRange(code: string): { start: number; end: number } | null {
  const m = DATA_RE.exec(code);
  if (!m) return null;
  const start = m.index + m[0].indexOf('>') + 1;
  return { start, end: start + m[1].length };
}

/** Bloc « gc-anim » du code, tel qu'écrit (étapes masquées comprises) ; null hors contrat. */
export function animationData(code: string): AnimationData | null {
  const range = dataRange(code);
  if (!range) return null;
  try {
    const parsed = JSON.parse(code.slice(range.start, range.end)) as { steps?: unknown };
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps) || parsed.steps.length === 0) return null;
    const steps = parsed.steps.map((s): AnimationStepData => {
      const r = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      return { ...r, title: typeof r.title === 'string' ? r.title : '', caption: typeof r.caption === 'string' ? r.caption : '' } as AnimationStepData;
    });
    return { ...(parsed as Record<string, unknown>), steps };
  } catch {
    return null;
  }
}

/** Le code avec son bloc « gc-anim » réécrit ; inchangé s'il n'a pas de bloc. */
export function withAnimationData(code: string, data: AnimationData): string {
  const range = dataRange(code);
  if (!range) return code;
  // « </ » et « <!-- » ne doivent ni fermer ni commenter le bloc <script> qui porte les données
  const json = JSON.stringify(data, null, 1).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');
  return code.slice(0, range.start) + json + code.slice(range.end);
}

/** L'ordre des étapes peut changer si chacune porte l'identifiant de son dessin. */
export const canReorderSteps = (data: AnimationData) => data.steps.every((s) => typeof s.id === 'string' && s.id !== '');

/**
 * Légende saisie dans le panneau « Étapes » → ce que le lecteur d'animation accepte : du texte,
 * du gras (les mots clés), de l'italique et des retours à la ligne.
 */
export function sanitizeCaption(html: string): string {
  return html
    .replace(/<\s*(\/?)\s*strong\b[^>]*>/gi, '<$1b>')
    .replace(/<\s*(\/?)\s*em\b[^>]*>/gi, '<$1i>')
    .replace(/<\s*\/\s*(?:div|p)\s*>\s*<\s*(?:div|p)\b[^>]*>/gi, '<br>')
    .replace(/<\s*br\b[^>]*>/gi, '<br>')
    .replace(/<\s*(\/?)\s*(b|i)\b[^>]*>/gi, (_m, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`)
    .replace(/<(?!\/?(?:b|i|br)>)[^>]*>/g, '')
    .replace(/<(b|i)>(\s*)<\/\1>/g, '$2')
    .replace(/^(?:<br>|\s|&nbsp;)+/, '')
    .replace(/(?:<br>|\s|&nbsp;)+$/, '');
}

/**
 * Aucun réseau : ni script, ni image, ni police venus d'ailleurs. Tout est dans le document ou dans
 * des adresses blob: que la scène fabrique elle-même avec ses fichiers joints. WebAssembly est
 * permis (décodeur des modèles 3D compressés), sans `eval` du JavaScript.
 */
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src data: blob:; worker-src blob:";

/**
 * Réception des fichiers joints, injectée avant tout autre script : `gcAsset(name)` attend le
 * fichier envoyé par le tableau (`{ gc: 'anim', cmd: 'assets', files, missing }`).
 */
const ASSET_RUNTIME = `<script>(function(){var p={},ok={},ko={};function w(n){return p[n]||(p[n]=new Promise(function(a,b){ok[n]=a;ko[n]=b;}));}
window.addEventListener('message',function(e){var m=e.data;if(e.source!==window.parent||!m||m.gc!=='anim'||m.cmd!=='assets')return;
(m.files||[]).forEach(function(f){w(f.name);var b=new Blob([f.buffer],{type:f.type||''});ok[f.name]({name:f.name,type:f.type||'',buffer:f.buffer,blob:b,url:URL.createObjectURL(b)});});
(m.missing||[]).forEach(function(n){w(n);ko[n](new Error('Fichier joint illisible : '+n));});});
window.gcAsset=function(n){return w(String(n));};
if(window.parent!==window)document.addEventListener('DOMContentLoaded',function(){window.parent.postMessage({gc:'anim',ev:'assets'},'*');});})();</script>`;

/** « </script » dans une bibliothèque fermerait la balise qui la porte. */
const inlineScript = (source: string) => `<script>${source.replace(/<\/(script)/gi, '<\\/$1')}</script>`;

/**
 * Document à donner au cadre isolé : le code, précédé de sa politique de contenu et de la réception
 * des fichiers joints, avec ses bibliothèques en place (`libs` : nom → source ; une bibliothèque
 * absente laisse un commentaire).
 */
export function animationSrcDoc(code: string, libs: Record<string, string> = {}): string {
  code = code.replace(LIB_RE, (_m, name: string) => (libs[name] !== undefined ? inlineScript(libs[name]) : `<!-- bibliothèque « ${name.replace(/-/g, '')} » indisponible -->`));
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">${ASSET_RUNTIME}`;
  const head = /<head\b[^>]*>/i.exec(code);
  if (head) {
    const at = head.index + head[0].length;
    return code.slice(0, at) + meta + code.slice(at);
  }
  const start = /^\s*(?:<!doctype[^>]*>\s*)?(?:<html\b[^>]*>)?/i.exec(code);
  const at = start ? start[0].length : 0;
  return `${code.slice(0, at)}<head>${meta}</head>${code.slice(at)}`;
}
