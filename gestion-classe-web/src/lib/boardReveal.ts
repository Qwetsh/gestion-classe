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
import type { BoardObject, Interaction } from './boardObjects';

export interface RevealCover {
  kind: 'curtain' | 'scratch';
  /** Couleur du cache (ou du fond derrière l'image). */
  color: string;
  /** Image de couverture (ticket à gratter), chemin dans le bucket board-assets. */
  imagePath?: string;
  /** Texte affiché sur un rideau (« Réponse », « ? »…). */
  label?: string;
}

/**
 * Rideau d'objet tiré à la main : décalage vertical du drap, en fraction de sa hauteur
 * (−1 … 1), comme un store qu'on remonte ou qu'on descend. Le drap reste découpé à l'emprise
 * de l'objet : ce qui dépasse disparaît. `dx` est conservé pour les états déjà enregistrés
 * (le rideau se tirait autrefois dans tous les sens) mais vaut toujours 0 désormais.
 */
export interface CurtainSlide { dx: number; dy: number }

/** Au-delà de cette fraction, un rideau tiré compte comme découvert. */
export const CURTAIN_OPEN_AT = 0.92;

export interface RevealState {
  /** Fraction découverte du rideau de page (0 = couvert, 1 = tout découvert). */
  pages: Record<string, number>;
  /** Objet découvert (true), masque de grattage en cours (data URL PNG) ou rideau tiré en partie. */
  objects: Record<string, true | string | CurtainSlide>;
  /** Identifiants des trous révélés, par zone de texte. */
  gaps: Record<string, string[]>;
  /**
   * Visibilité décidée en séance par les boutons d'interaction (voir `Interaction` dans
   * boardObjects) : absent = l'objet suit son réglage `hidden` du document.
   */
  shown: Record<string, boolean>;
  /** Post-its repliés dans le document mais dépliés pendant la séance (un tap en classe). */
  unfolded: Record<string, true>;
  /** Interactions « une seule fois » déjà jouées, clé `boutonId:index`. */
  fired: Record<string, true>;
  /** Objets déplacés par un bouton : décalage par rapport à leur position dans le document. */
  moved: Record<string, { dx: number; dy: number }>;
}

export const EMPTY_REVEAL: RevealState = { pages: {}, objects: {}, gaps: {}, shown: {}, unfolded: {}, fired: {}, moved: {} };
/** État de séance vierge (nouvel objet à chaque appel, pour un `setState`). */
export const emptyReveal = (): RevealState => ({ pages: {}, objects: {}, gaps: {}, shown: {}, unfolded: {}, fired: {}, moved: {} });

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
      shown: parsed.shown && typeof parsed.shown === 'object' ? parsed.shown : {},
      unfolded: parsed.unfolded && typeof parsed.unfolded === 'object' ? parsed.unfolded : {},
      fired: parsed.fired && typeof parsed.fired === 'object' ? parsed.fired : {},
      moved: parsed.moved && typeof parsed.moved === 'object' ? parsed.moved : {},
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
/** Décalage du rideau tiré à la main, ou null (rideau en place, découvert, ou ticket à gratter). */
export function curtainSlide(state: RevealState, objectId: string): CurtainSlide | null {
  const v = state.objects[objectId];
  return v && typeof v === 'object' ? v : null;
}
/** Un rideau tiré au-delà du seuil compte comme découvert : on ne garde pas un drap presque sorti. */
export function settleCurtain(slide: CurtainSlide): true | CurtainSlide | null {
  if (Math.abs(slide.dx) >= CURTAIN_OPEN_AT || Math.abs(slide.dy) >= CURTAIN_OPEN_AT) return true;
  if (Math.abs(slide.dx) < 0.02 && Math.abs(slide.dy) < 0.02) return null;
  return slide;
}

/** Visibilité effective d'un objet : ce que la séance a décidé, sinon son réglage de départ. */
export const isObjectVisible = (state: RevealState, o: Pick<BoardObject, 'id' | 'hidden'>) => state.shown[o.id] ?? !o.hidden;

/** Commande envoyée à un widget ou à un son (`reset` : remise à zéro de la page). */
export type CommandName = 'play' | 'pause' | 'playToggle' | 'start' | 'stop' | 'startToggle' | 'roll' | 'reset';
/**
 * Commande en attente pour un objet, état éphémère du tableau (jamais persisté : un rechargement
 * ne doit pas relancer un minuteur). `at` change à chaque envoi pour rejouer la même commande.
 */
export interface ObjectCommand { command: CommandName; at: number }

/** Ce qu'un bouton demande au tableau, en plus de l'état : navigation, commande, remise à zéro. */
export type InteractionEffect =
  | { kind: 'page'; pageId: string }
  | { kind: 'pageDelta'; delta: -1 | 1 }
  | { kind: 'command'; targetId: string; command: Exclude<CommandName, 'reset'> }
  | { kind: 'reset' }
  | { kind: 'window'; targetId: string }
  | { kind: 'zoom'; targetId: string };

/**
 * Déclenche la séquence d'un bouton. Fonction pure : l'état de séance revient modifié (visibilité,
 * caches, post-its, « une seule fois »), et les actions qui ne sont pas de l'état (pages, médias,
 * widgets, remise à zéro) reviennent en liste d'effets, à exécuter **après** l'état, dans l'ordre.
 * Les cibles disparues (objet supprimé) sont ignorées. Un bouton ne déclenche jamais un autre
 * bouton : pas de boucle possible.
 */
export function fireInteractions(state: RevealState, trigger: BoardObject, objects: BoardObject[]): { state: RevealState; effects: InteractionEffect[] } {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const shown = { ...state.shown };
  const covers = { ...state.objects };
  const unfolded = { ...state.unfolded };
  const fired = { ...state.fired };
  const moved = { ...state.moved };
  const effects: InteractionEffect[] = [];
  (trigger.interactions ?? []).forEach((it: Interaction, index) => {
    const key = `${trigger.id}:${index}`;
    if (it.once && fired[key]) return;
    const target = it.targetId ? byId.get(it.targetId) : undefined;
    switch (it.action) {
      case 'show': case 'hide': case 'toggle': {
        if (!target) return;
        const visible = shown[target.id] ?? !target.hidden;
        shown[target.id] = it.action === 'show' ? true : it.action === 'hide' ? false : !visible;
        break;
      }
      case 'reveal': case 'cover': {
        if (!target) return;
        if (it.action === 'reveal') covers[target.id] = true; else delete covers[target.id];
        break;
      }
      case 'unfold': case 'fold': {
        if (!target) return;
        if (it.action === 'unfold') unfolded[target.id] = true; else delete unfolded[target.id];
        break;
      }
      case 'goto':
        if (!it.params?.pageId) return;
        effects.push({ kind: 'page', pageId: it.params.pageId });
        break;
      case 'next': effects.push({ kind: 'pageDelta', delta: 1 }); break;
      case 'prev': effects.push({ kind: 'pageDelta', delta: -1 }); break;
      case 'reset': effects.push({ kind: 'reset' }); break;
      case 'window':
        if (!target || target.type !== 'window') return;
        effects.push({ kind: 'window', targetId: target.id });
        break;
      case 'zoomTo':
        if (!target) return;
        effects.push({ kind: 'zoom', targetId: target.id });
        break;
      case 'moveTo': {
        if (!target || it.params?.x === undefined || it.params?.y === undefined) return;
        moved[target.id] = { dx: it.params.x - target.x, dy: it.params.y - target.y };
        break;
      }
      case 'moveBy': {
        if (!target) return;
        const prev = moved[target.id] ?? { dx: 0, dy: 0 };
        moved[target.id] = { dx: prev.dx + (it.params?.dx ?? 0), dy: prev.dy + (it.params?.dy ?? 0) };
        break;
      }
      case 'moveBack':
        if (!target) return;
        delete moved[target.id];
        break;
      default:
        if (!target) return;
        effects.push({ kind: 'command', targetId: target.id, command: it.action });
    }
    if (it.once) fired[key] = true;
  });
  return { state: { ...state, shown, objects: covers, unfolded, fired, moved }, effects };
}
export const pageRevealedFraction = (state: RevealState, pageId: string) => state.pages[pageId] ?? 0;
export const revealedGaps = (state: RevealState, objectId: string): ReadonlySet<string> => new Set(state.gaps[objectId] ?? []);

/** Remet à couvert une page (ses objets, ses trous, son rideau). */
export function recoverPage(state: RevealState, page: BoardPage): RevealState {
  const objects = { ...state.objects };
  const gaps = { ...state.gaps };
  const shown = { ...state.shown };
  const unfolded = { ...state.unfolded };
  const fired = { ...state.fired };
  const moved = { ...state.moved };
  const ids = new Set((page.objects ?? []).map((o) => o.id));
  for (const id of ids) {
    delete objects[id];
    delete gaps[id];
    delete shown[id];
    delete unfolded[id];
    delete moved[id];
  }
  // Les « une seule fois » des boutons de la page rejouent
  for (const key of Object.keys(fired)) if (ids.has(key.slice(0, key.lastIndexOf(':')))) delete fired[key];
  const pages = { ...state.pages };
  delete pages[page.id];
  return { pages, objects, gaps, shown, unfolded, fired, moved };
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
