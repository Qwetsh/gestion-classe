/**
 * Révélation progressive : rideaux, tickets à gratter, textes à trous.
 *
 * Deux choses bien séparées :
 * - ce qui est **dans le document** (un objet porte un cache `cover`, une page porte un
 *   rideau `curtain`, un texte contient des trous `<span data-gap="…">`) ;
 * - ce qui est **l'état de séance** (`RevealState`) : ce qui a déjà été découvert. Il vit hors
 *   du document, dans le navigateur, pour que la classe suivante reparte à couvert et que
 *   l'export « version élève » ignore ce qui a été révélé.
 */
import type { BoardPage } from './boardRender';

export interface RevealCover {
  kind: 'curtain' | 'scratch';
  /** Couleur du cache (ou du fond derrière l'image). */
  color: string;
  /** Image de couverture (ticket à gratter), chemin dans le bucket board-assets. */
  imagePath?: string;
  /** Texte affiché sur un rideau (« Réponse », « ? »…). */
  label?: string;
}

export interface RevealState {
  /** Fraction découverte du rideau de page (0 = couvert, 1 = tout découvert). */
  pages: Record<string, number>;
  /** Objet découvert (true) ou masque de grattage en cours (data URL PNG). */
  objects: Record<string, true | string>;
  /** Identifiants des trous révélés, par zone de texte. */
  gaps: Record<string, string[]>;
}

export const EMPTY_REVEAL: RevealState = { pages: {}, objects: {}, gaps: {} };

const STORAGE_PREFIX = 'classroom-board-reveal:';

export function loadRevealState(sessionId: string): RevealState {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + sessionId);
    if (!raw) return EMPTY_REVEAL;
    const parsed = JSON.parse(raw) as Partial<RevealState>;
    return {
      pages: parsed.pages && typeof parsed.pages === 'object' ? parsed.pages : {},
      objects: parsed.objects && typeof parsed.objects === 'object' ? parsed.objects : {},
      gaps: parsed.gaps && typeof parsed.gaps === 'object' ? parsed.gaps : {},
    };
  } catch {
    return EMPTY_REVEAL;
  }
}

export function saveRevealState(sessionId: string, state: RevealState) {
  try {
    localStorage.setItem(STORAGE_PREFIX + sessionId, JSON.stringify(state));
  } catch {
    /* quota : l'état de révélation n'est pas vital */
  }
}

export const isObjectRevealed = (state: RevealState, objectId: string) => state.objects[objectId] === true;
export const pageRevealedFraction = (state: RevealState, pageId: string) => state.pages[pageId] ?? 0;
export const revealedGaps = (state: RevealState, objectId: string): ReadonlySet<string> => new Set(state.gaps[objectId] ?? []);

/** Remet à couvert une page (ses objets, ses trous, son rideau). */
export function recoverPage(state: RevealState, page: BoardPage): RevealState {
  const objects = { ...state.objects };
  const gaps = { ...state.gaps };
  for (const o of page.objects ?? []) {
    delete objects[o.id];
    delete gaps[o.id];
  }
  const pages = { ...state.pages };
  delete pages[page.id];
  return { pages, objects, gaps };
}

// ---- Trous dans un texte ----

let gapCounter = 0;
export const newGapId = () => `g${Date.now().toString(36)}${(gapCounter++).toString(36)}`;

/** Identifiants des trous présents dans le HTML d'une zone. */
export function gapIdsIn(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return Array.from(doc.body.querySelectorAll('[data-gap]')).map((el) => el.getAttribute('data-gap') || '').filter(Boolean);
}

/** Retire tous les trous (le texte redevient ordinaire). */
export function stripGaps(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  for (const el of Array.from(doc.body.querySelectorAll('[data-gap]'))) el.replaceWith(...Array.from(el.childNodes));
  return doc.body.innerHTML;
}

/**
 * Transforme la sélection courante de l'éditeur en trou. Sans sélection, le mot sous le
 * curseur. Renvoie l'identifiant créé, ou null si rien à masquer.
 */
export function wrapSelectionAsGap(editor: HTMLElement): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return null;

  if (range.collapsed) {
    // Mot sous le curseur
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const text = (node as Text).data;
    let start = range.startOffset, end = range.startOffset;
    while (start > 0 && /[\p{L}\p{N}'’-]/u.test(text[start - 1])) start--;
    while (end < text.length && /[\p{L}\p{N}'’-]/u.test(text[end])) end++;
    if (start === end) return null;
    range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
  }
  if (!range.toString().trim()) return null;
  // Un trou dans un trou : on garde l'existant
  const anc = range.commonAncestorContainer;
  const ancEl = anc.nodeType === Node.ELEMENT_NODE ? (anc as Element) : anc.parentElement;
  if (ancEl?.closest('[data-gap]')) return null;

  const id = newGapId();
  const span = document.createElement('span');
  span.setAttribute('data-gap', id);
  try {
    range.surroundContents(span);
  } catch {
    // Sélection à cheval sur des balises : on extrait puis on réinsère
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(span);
  r.collapse(false);
  sel.addRange(r);
  return id;
}

// ---- Rendu (export, vignettes) ----

export interface RenderRevealOptions {
  /** 'covered' : caches dessinés et trous masqués (version élève) ; 'revealed' : tout visible (corrigé). */
  mode: 'covered' | 'revealed';
  /** Ne pas dessiner l'encre (version « à compléter »). */
  hideInk?: boolean;
}
