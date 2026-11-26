/**
 * Version mobile « sur mesure » d'un document imprimé (migration 093, table `board_mobile_custom`) :
 * une page HTML complète, pensée pour le téléphone, écrite par une session Claude (skill
 * `version-mobile`) et déposée par le jeton d'import (Edge Function depot-cours, action "mobile").
 * Le QR code déjà imprimé y mène : `/d/<jeton du QR>` l'affiche quand elle existe, la version
 * automatique sinon.
 *
 * Fonctions pures, sans dépendance, lues par trois côtés :
 *  - depot-cours : règle d'autonomie de la page et empreinte du document au moment du dépôt ;
 *  - version-mobile : quelle version servir (QR code ou lien de partage) ;
 *  - le navigateur du professeur et ses tests (gestion-classe-web/src/lib/mobileVersion.ts) :
 *    empreinte du document à l'instant, état « plus ancienne que le document ».
 */
import { mobileDoc, type LinkKind } from './rules.ts';

// ---------------------------------------------------------------------------------------------
// Quelle version servir
// ---------------------------------------------------------------------------------------------

/**
 * Version rendue pour un lien : la page sur mesure seulement par le QR code imprimé (le lien de
 * partage du cahier de texte garde ses vues Téléphone / Pages A4 automatiques, qui s'impriment),
 * seulement si elle existe, et sauf si le lecteur a demandé la version simple.
 */
export function servedVersion(kind: LinkKind, hasCustom: boolean, wantSimple: boolean): 'custom' | 'auto' {
  return kind === 'qr' && hasCustom && !wantSimple ? 'custom' : 'auto';
}

// ---------------------------------------------------------------------------------------------
// Empreinte du document : la version sur mesure est-elle plus ancienne que lui ?
// ---------------------------------------------------------------------------------------------

/**
 * Texte JSON aux clés triées : deux lectures du même document donnent le même texte, quel que soit
 * l'ordre de ses clés (base, éditeur, script).
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Hachage rapide et stable (cyrb53) : pas un secret, seulement une marque de changement. */
function cyrb53(text: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Empreinte de ce que montre le document au téléphone : son texte et sa mise en page (ce que rend
 * `mobileDoc`), sans ses écrans, ses liens, son calque d'annotations ni son numéro
 * d'enregistrement. Elle ne change donc que si le document lui-même change : déposer des écrans
 * ou renommer le cours ne rend pas la version sur mesure « plus ancienne ». Null : pas un cours
 * rédigé.
 */
export function docFingerprint(doc: unknown): string | null {
  const served = mobileDoc(doc, 'qr');
  if (!served) return null;
  const text = canonical({ content: served.content, settings: served.settings ?? null });
  return `v1:${cyrb53(text, 1)}${cyrb53(text, 2)}`;
}

/** `stale` : le document a changé depuis le dépôt (ou depuis « Garder ») ; `unknown` : document illisible. */
export type CustomState = 'current' | 'stale' | 'unknown';

export function customState(depositedFingerprint: string, currentFingerprint: string | null): CustomState {
  if (currentFingerprint === null) return 'unknown';
  return depositedFingerprint === currentFingerprint ? 'current' : 'stale';
}

// ---------------------------------------------------------------------------------------------
// Règle d'autonomie de la page déposée
// ---------------------------------------------------------------------------------------------

/** 5 Mo au plus, images comprises (en data URI). */
export const CUSTOM_MAX_BYTES = 5 * 1024 * 1024;

export type CustomProblem =
  | { error: 'bad_html' }
  | { error: 'too_large'; bytes: number }
  | { error: 'not_a_page' }
  | { error: 'network'; detail: string };

/**
 * Attributs qui chargent une ressource. Leur valeur doit être dans la page : une data URI, une
 * ancre (`#id` : `<use href="#fleche">` en SVG) ou rien. Une adresse relative (« image.png ») ne
 * mène à rien depuis la page isolée : refusée aussi.
 */
const URL_ATTRS = new Set([
  'src', 'srcset', 'poster', 'data', 'background', 'href', 'xlink:href', 'action', 'formaction',
  'manifest', 'ping', 'lowsrc', 'dynsrc', 'codebase', 'archive', 'icon', 'profile',
]);
/** Balises de lien : l'élève peut toucher un lien vers un site (rien n'est chargé tant qu'il ne le fait pas). */
const LINK_TAGS = new Set(['a', 'area']);
/** Balises qui ouvrent une autre page ou un greffon : jamais (un cadre seulement par `srcdoc`, voir plus bas). */
const FORBIDDEN_TAGS = new Set(['object', 'embed', 'frame', 'frameset', 'applet', 'portal', 'base']);

/** Adresses qui sortent de la page : http(s), ws(s), ftp, ou `//hote`. */
const NETWORK = String.raw`(?:https?:|wss?:|ftp:|\/\/)`;
const Q = String.raw`['"\x60]`;

/** CSS : `url(http…)` et `@import` d'une adresse, où que ce soit (feuille, attribut style, chaîne d'un script). */
const CSS_RULES: RegExp[] = [
  new RegExp(String.raw`url\(\s*['"]?\s*${NETWORK}`, 'i'),
  new RegExp(String.raw`@import\s+(?:url\(\s*)?['"]?\s*${NETWORK}`, 'i'),
];

/**
 * Scripts : un appel réseau vers une adresse écrite en toutes lettres. Une bibliothèque recopiée
 * dans la page (three.js) contient `fetch(` sans adresse : elle n'est pas refusée (et le réseau
 * reste coupé à l'affichage).
 */
const SCRIPT_RULES: RegExp[] = [
  new RegExp(String.raw`\b(?:fetch|EventSource|WebSocket|importScripts|import|sendBeacon)\s*\(\s*${Q}\s*${NETWORK}`, 'i'),
  new RegExp(String.raw`\.open\s*\(\s*${Q}[A-Za-z]+${Q}\s*,\s*${Q}\s*${NETWORK}`, 'i'),
  new RegExp(String.raw`\b(?:src|href|srcset|poster|data|action)\s*=\s*${Q}\s*${NETWORK}`, 'i'),
  new RegExp(String.raw`setAttribute(?:NS)?\s*\([^)]*?${Q}(?:src|href|xlink:href|srcset|poster)${Q}\s*,\s*${Q}\s*${NETWORK}`, 'i'),
  new RegExp(String.raw`\bimport\b[^;'"\x60]*\bfrom\s*${Q}\s*${NETWORK}`, 'i'),
  new RegExp(String.raw`\bimport\s*${Q}\s*${NETWORK}`, 'i'),
];

const excerpt = (text: string, at: number) => text.slice(Math.max(0, at - 10), at + 70).replace(/\s+/g, ' ').trim();

function firstHit(text: string, rules: RegExp[]): string | null {
  for (const rule of rules) {
    const m = rule.exec(text);
    if (m) return excerpt(text, m.index);
  }
  return null;
}

/** Entités d'un attribut HTML (le `srcdoc` d'un cadre porte une page entière, échappée). */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|quot|apos|lt|gt|amp|nbsp);/gi, (all, code: string) => {
    const c = code.toLowerCase();
    if (c === 'quot') return '"';
    if (c === 'apos') return "'";
    if (c === 'lt') return '<';
    if (c === 'gt') return '>';
    if (c === 'amp') return '&';
    if (c === 'nbsp') return ' ';
    const n = c.startsWith('#x') ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
    return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
  });
}

const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g;
const SCRIPT_OR_STYLE = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi;

/** Une valeur d'attribut de ressource qui reste dans la page. */
function inPage(value: string): boolean {
  const v = value.trim();
  return v === '' || /^data:/i.test(v) || v.startsWith('#');
}

/**
 * Adresses d'un `srcset` (« a.png 1x, b.png 2x ») : une adresse est une suite sans espace (une data
 * URI contient des virgules), suivie de ses descripteurs jusqu'à la virgule suivante.
 */
function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    let j = i;
    while (j < value.length && !/\s/.test(value[j])) j++;
    let url = value.slice(i, j);
    i = j;
    if (url.endsWith(',')) url = url.replace(/,+$/, '');
    else while (i < value.length && value[i] !== ',') i++;
    if (url) urls.push(url);
  }
  return urls;
}

/** Premier chargement réseau repéré dans une page (et dans les pages des cadres `srcdoc`), ou null. */
function networkProblem(html: string, depth: number): string | null {
  if (depth > 3) return 'cadres imbriqués trop profondément';
  const css = firstHit(html, CSS_RULES);
  if (css) return css;

  // Corps des scripts et des feuilles de style à part : leur texte n'est pas du balisage
  const scripts: string[] = [];
  const markup = html.replace(SCRIPT_OR_STYLE, (_all, open: string, kind: string, body: string, close: string) => {
    if (kind.toLowerCase() === 'script') scripts.push(body);
    return open + close;
  });
  for (const body of scripts) {
    const hit = firstHit(body, SCRIPT_RULES);
    if (hit) return hit;
  }

  for (const tag of markup.matchAll(TAG)) {
    const name = tag[1].toLowerCase();
    const where = excerpt(markup, tag.index ?? 0);
    if (FORBIDDEN_TAGS.has(name)) return where;
    const attrs = new Map<string, string>();
    for (const a of (tag[2] ?? '').matchAll(ATTR)) attrs.set(a[1].toLowerCase(), decodeEntities(a[2] ?? a[3] ?? a[4] ?? ''));
    if (name === 'meta' && /refresh/i.test(attrs.get('http-equiv') ?? '')) return where;
    if (name === 'iframe') {
      // Un cadre seulement avec sa page dans `srcdoc` (une animation du tableau), relue elle aussi
      if (attrs.has('src') || !attrs.has('srcdoc')) return where;
      const inner = networkProblem(attrs.get('srcdoc') ?? '', depth + 1);
      if (inner) return inner;
    }
    for (const [attr, value] of attrs) {
      if (attr.startsWith('on')) {
        const hit = firstHit(value, SCRIPT_RULES);
        if (hit) return hit;
        continue;
      }
      if (!URL_ATTRS.has(attr) || (attr === 'href' && LINK_TAGS.has(name))) continue;
      const urls = attr === 'srcset' ? srcsetUrls(value) : [value];
      if (!urls.every(inPage)) return where;
    }
  }
  return null;
}

/**
 * La page déposée est-elle autonome ? Refusée si ce n'est pas une page HTML complète (commence par
 * `<!doctype html>` ou `<html>`), si elle dépasse 5 Mo, ou si elle charge quoi que ce soit hors
 * d'elle-même :
 *  - un attribut de ressource (`src`, `srcset`, `poster`, `href` hors lien `<a>`, `xlink:href`,
 *    `data`, `action`…) qui n'est ni une data URI ni une ancre `#` : http(s), `//hote`, ou adresse
 *    relative (qui ne mène à rien depuis la page isolée) ;
 *  - `url(http…)` ou `@import` d'une adresse dans le CSS ;
 *  - un script qui appelle le réseau vers une adresse écrite en toutes lettres (`fetch("https://…")`,
 *    `new WebSocket("wss://…")`, `img.src = "https://…"`, `import … from "https://…"`…) ;
 *  - `<object>`, `<embed>`, `<base>`, `<meta http-equiv="refresh">`, et tout `<iframe>` qui n'a pas
 *    sa page dans `srcdoc` (celle-ci est relue avec les mêmes règles).
 * Un lien `<a href="https://…">` est permis : rien n'est chargé tant que l'élève ne le touche pas.
 *
 * C'est un garde-fou contre les oublis (une police Google, une image laissée en ligne), qui donne
 * au dépôt un message clair. Le vrai mur est à l'affichage : la page tourne dans un cadre isolé
 * (`sandbox="allow-scripts"`, sans `allow-same-origin`) sous une CSP qui coupe le réseau.
 */
export function customPageProblem(html: unknown): CustomProblem | null {
  if (typeof html !== 'string' || html.trim() === '') return { error: 'bad_html' };
  const bytes = new TextEncoder().encode(html).length;
  if (bytes > CUSTOM_MAX_BYTES) return { error: 'too_large', bytes };
  const head = html.replace(/^﻿/, '').replace(/^(?:\s|<!--[\s\S]*?-->)+/, '');
  if (!/^<!doctype\s+html\b/i.test(head) && !/^<html\b/i.test(head)) return { error: 'not_a_page' };
  const detail = networkProblem(html, 0);
  return detail ? { error: 'network', detail } : null;
}
