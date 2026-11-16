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
 */
import type { BoardObjectBase } from './boardObjects';

export interface AnimationObject extends BoardObjectBase {
  type: 'animation';
  h: number;
  /** Document HTML autonome (scène et lecteur). */
  code: string;
  title?: string;
  /** Vrai : le pointeur passe à l'animation en classe (HTML qui porte ses propres boutons). */
  interactive?: boolean;
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
      const steps = Array.isArray(parsed.steps)
        ? parsed.steps.map((s) => {
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

/** Aucun réseau : ni script, ni image, ni police venus d'ailleurs. Tout est dans le document. */
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";

/** Document à donner au cadre isolé : le code, précédé de sa politique de contenu. */
export function animationSrcDoc(code: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  const head = /<head\b[^>]*>/i.exec(code);
  if (head) {
    const at = head.index + head[0].length;
    return code.slice(0, at) + meta + code.slice(at);
  }
  const start = /^\s*(?:<!doctype[^>]*>\s*)?(?:<html\b[^>]*>)?/i.exec(code);
  const at = start ? start[0].length : 0;
  return `${code.slice(0, at)}<head>${meta}</head>${code.slice(at)}`;
}
