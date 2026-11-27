/**
 * Version couleur au format téléphone d'un document imprimé : fonctions pures, sans accès à la base
 * (la lecture et l'écriture des liens sont dans mobileVersionQueries.ts).
 *
 * Chaque document imprimé depuis l'éditeur de cours (fiche, documents, protocole…) porte, en haut à
 * droite de sa première page, dans la marge, un QR code vers `/d/<jeton>` : la page publique qui
 * montre le même document, en couleur, sur une colonne de téléphone. Le QR code n'est jamais écrit
 * dans le document : il est posé par-dessus la feuille, seulement à l'impression.
 *
 * Les règles de ce qui peut sortir (QR code : jamais une correction ni une évaluation ; lien de
 * partage : tout sauf une copie modèle) sont partagées avec le serveur :
 * supabase/functions/version-mobile/rules.ts.
 */
import QRCode from 'qrcode';
import type { JSONContent } from '@tiptap/core';
import { COL_W, MARGIN, MM } from './course/coursePage';
import { MOBILE_TOKEN, linkEligible, linkTarget, mobileEligible, shareEligible, type CourseRef, type LinkKind } from '../../../supabase/functions/version-mobile/rules';

export { MOBILE_TOKEN, linkEligible, linkTarget, mobileEligible, shareEligible, type CourseRef, type LinkKind };
export { CUSTOM_MAX_BYTES, customPageProblem, customState, docFingerprint, servedVersion, type CustomProblem, type CustomState } from '../../../supabase/functions/version-mobile/custom';

// ---------------------------------------------------------------------------------------------
// Lien
// ---------------------------------------------------------------------------------------------

/**
 * Jeton d'un lien : 20 caractères base64url (15 octets tirés au hasard, 120 bits : impossible à
 * deviner). Assez court pour que l'adresse tienne dans un QR code de version 4 (33 × 33 modules) en
 * correction M, lisible à 1,2 cm de côté.
 */
export function newMobileToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Adresse de la version téléphone : la plus courte possible (`/d/<jeton>`), pour un QR code lisible. */
export function mobileUrl(token: string, origin: string = window.location.origin, base: string = import.meta.env.BASE_URL): string {
  return `${origin}${base.replace(/\/$/, '')}/d/${token}`;
}

/**
 * Le document vers lequel pointe le QR code d'un cours imprimé : toujours l'original de la
 * bibliothèque. Une copie posée pour une classe (`lesson_boards.source_board_id`) renvoie au lien de
 * son original ; un original introuvable (supprimé depuis) laisse la copie servir elle-même.
 * Pas de lien (null) si le cours imprimé ou son original est une correction ou une évaluation.
 */
export function mobileTarget(printed: CourseRef, original: CourseRef | null): string | null {
  return linkTarget('qr', printed, original);
}

// ---------------------------------------------------------------------------------------------
// QR code imprimé
// ---------------------------------------------------------------------------------------------

/** Écart entre le QR code et les bords de la feuille (3 mm). */
export const QR_INSET = 3 * MM;
/** Côté du QR code : entre 1,2 et 1,8 cm. */
export const QR_MIN = 12 * MM;
export const QR_MAX = 18 * MM;

/**
 * Taille et place du QR code (px CSS, comme la feuille) : dans la marge du haut, à 3 mm des bords,
 * aussi grand que la marge le permet, entre 1,2 et 1,8 cm de côté. Marges de 2,5 cm : 1,8 cm ;
 * marges de 1,5 cm : 1,2 cm (il occupe alors juste le coin de la feuille, hors de la colonne).
 */
export function qrBox(margin: number = MARGIN): { size: number; inset: number } {
  return { size: Math.min(QR_MAX, Math.max(QR_MIN, margin - QR_INSET)), inset: QR_INSET };
}

/**
 * Modules d'un QR code (correction M, pour résister à la photocopie), en un seul tracé SVG : un
 * rectangle par suite de modules noirs d'une ligne. `size` : nombre de modules par côté, sans marge.
 */
export function qrModules(text: string): { size: number; version: number; path: string } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const { size, data } = qr.modules;
  let path = '';
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!data[r * size + c]) { c++; continue; }
      let end = c;
      while (end < size && data[r * size + end]) end++;
      path += `M${c} ${r}h${end - c}v1h-${end - c}z`;
      c = end;
    }
  }
  return { size, version: qr.version, path };
}

// ---------------------------------------------------------------------------------------------
// Rendu sur le téléphone
// ---------------------------------------------------------------------------------------------

/** Largeur (px) à partir de laquelle une image prend toute la largeur du téléphone ; les plus petites (pictogrammes) gardent la leur. */
export const PHONE_FULL_IMAGE = Math.round(COL_W * 0.4);

const textOf = (n: JSONContent): string => n.text ?? (n.content ?? []).map(textOf).join(' ');

/** Cartouche des fiches (gc_cours.py, Cartouche) : un tableau en tête de fiche, avec « Note : » et « Commentaire : ». */
function isCartouche(n: JSONContent): boolean {
  if (n.type !== 'table') return false;
  const text = textOf(n);
  return /\bNote\s*:/.test(text) && /Commentaire\s*:/.test(text);
}

const WHITE = /^(?:#f{3}(?:f{3})?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))$/i;

/** Retire le texte blanc (bandeau de séquence sur fond sombre) : sans son fond, il serait invisible. */
function withoutWhite(n: JSONContent): JSONContent {
  const marks = n.marks?.map((m) => {
    if (m.type !== 'textStyle' || typeof m.attrs?.color !== 'string' || !WHITE.test(m.attrs.color.trim())) return m;
    const attrs = { ...m.attrs };
    delete attrs.color;
    return { ...m, attrs };
  });
  return { ...n, ...(marks ? { marks } : {}), ...(n.content ? { content: n.content.map(withoutWhite) } : {}) };
}

/**
 * Le cartouche à plat, pour une colonne étroite : le titre, la séquence, la durée, la problématique,
 * les objectifs, les uns sous les autres. Ce qui ne sert qu'au papier (note, commentaire, cercles
 * des compétences, niveau seul dans sa case) est laissé de côté.
 */
function flatCartouche(table: JSONContent): JSONContent[] {
  const out: JSONContent[] = [];
  for (const row of table.content ?? []) {
    for (const cell of row.content ?? []) {
      const text = textOf(cell).replace(/\s+/g, ' ').trim();
      if (text.length <= 3 || /^(?:Note|Commentaire)\s*:/i.test(text) || text.includes('○')) continue;
      for (const block of cell.content ?? []) out.push(withoutWhite(block));
    }
  }
  return out;
}

/** Zones d'écriture et pointillés (gardés par un lien de partage pour l'impression) : rien à faire d'eux sur un téléphone. */
const PAPER_ONLY = new Set(['writingZone', 'dots']);

function phoneNode(n: JSONContent): JSONContent {
  if (n.type === 'image' && !n.attrs?.page) {
    const width = n.attrs?.width;
    if (typeof width === 'number' && width < PHONE_FULL_IMAGE) return n;
    return { ...n, attrs: { ...n.attrs, width: null } };
  }
  if (!n.content) return n;
  const content = n.content.filter((c) => !PAPER_ONLY.has(c.type ?? '')).map(phoneNode);
  // Un encadré qui ne portait qu'une zone d'écriture garde un paragraphe (le schéma refuse certains conteneurs vides)
  if (content.length === 0 && n.content.length > 0 && n.type !== 'paragraph' && n.type !== 'heading') content.push({ type: 'paragraph' });
  return { ...n, content };
}

/**
 * Le document tel qu'il se lit sur un téléphone : cartouche mis à plat (les trois premiers blocs),
 * images à toute la largeur, sans zones d'écriture ni pointillés. Les encarts ont déjà été retirés
 * par le serveur (et, pour le lien du QR code, les zones d'écriture et les pointillés aussi).
 */
export function phoneContent(content: JSONContent): JSONContent {
  const blocks: JSONContent[] = [];
  (content.content ?? []).forEach((block, i) => {
    if (i < 3 && isCartouche(block)) blocks.push(...flatCartouche(block));
    else blocks.push(block);
  });
  return phoneNode({ ...content, content: blocks });
}

// ---------------------------------------------------------------------------------------------
// Version sur mesure (migration 093) : la page déposée par Claude, dans un cadre isolé
// ---------------------------------------------------------------------------------------------

/**
 * Règles de la page sur mesure : rien du réseau. Images, polices, sons et vidéos seulement en
 * data URI (ou blob: créé par la page elle-même) ; styles et scripts seulement écrits dans la page.
 * `connect-src data: blob:` : une scène 3D lit les textures de son modèle par une adresse blob:
 * (rien ne sort de la page). Les cadres `srcdoc` d'une animation héritent de ces règles.
 */
export const CUSTOM_CSP = [
  "default-src 'none'",
  'img-src data: blob:',
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  'font-src data:',
  'media-src data: blob:',
  'connect-src data: blob:',
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const DOCTYPE = /^(\uFEFF?(?:\s|<!--[\s\S]*?-->)*<!doctype[^>]*>)/i;

/**
 * La page sur mesure prête pour le `srcdoc` du cadre : la CSP et « pas d'adresse transmise » posées
 * en tout premier (après le doctype, qui doit rester en tête : sans lui, la page passerait en mode
 * de compatibilité). Une CSP écrite plus loin par la page ne peut que restreindre davantage.
 */
export function customSrcdoc(html: string): string {
  const guard = `<meta http-equiv="Content-Security-Policy" content="${CUSTOM_CSP}"><meta name="referrer" content="no-referrer">`;
  const m = DOCTYPE.exec(html);
  return m ? m[1] + guard + html.slice(m[1].length) : guard + html;
}
