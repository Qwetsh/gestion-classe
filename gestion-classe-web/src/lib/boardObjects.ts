/**
 * Objets d'une page du tableau blanc (modèle v2).
 *
 * Une page porte, au-dessus de son fond et de son encre, une liste ordonnée d'objets
 * typés (l'ordre du tableau = ordre d'empilement). Tout objet partage la même
 * géométrie en unités logiques (page = 1000 de large) et la même mécanique de
 * sélection, de déplacement, de redimensionnement et de menu contextuel.
 *
 * Phase 0 : seul le type `text` existe (ancien `texts[]`, migré ici). Les formes,
 * images, tableaux… viendront s'ajouter à l'union sans toucher à la mécanique.
 */
import { type TextBox, textBoxRect } from './boardText';
import type { ShapeObject } from './boardShapes';
import type { RevealCover } from './boardReveal';
import { mediaRect, type MediaObject } from './boardMedia';
import type { LibraryObject } from './boardLibrary';
import { remapConnectorEnds, type ConnectorObject } from './boardConnectors';

export interface BoardObjectBase {
  id: string;
  type: string;
  /** Coin haut-gauche et largeur, en unités logiques. */
  x: number;
  y: number;
  w: number;
  /** Rotation en degrés — dans le modèle dès maintenant, sans interface avant la phase TBI. */
  rotation?: number;
  /** Verrouillé : ni déplacement, ni redimensionnement, ni suppression par la sélection. */
  locked?: boolean;
  opacity?: number;
  /** Rideau ou ticket à gratter posé sur l'objet (voir boardReveal). */
  cover?: RevealCover;
  /** Caché au départ : n'apparaît qu'une fois affiché par un bouton d'interaction. */
  hidden?: boolean;
  /** L'objet est un bouton : toucher déclenche ces interactions sur d'autres objets de la page. */
  interactions?: Interaction[];
  /** Groupe (Ctrl+G) : sélectionner un membre sélectionne tout le groupe, qui se déplace d'un bloc. */
  groupId?: string;
}

/** Identifiants des objets à sélectionner avec ceux-ci : leurs groupes entiers. */
export function expandGroups(objects: readonly BoardObject[], ids: Iterable<string>): Set<string> {
  const out = new Set(ids);
  const groups = new Set<string>();
  for (const o of objects) if (out.has(o.id) && o.groupId) groups.add(o.groupId);
  if (groups.size > 0) for (const o of objects) if (o.groupId && groups.has(o.groupId)) out.add(o.id);
  return out;
}

/**
 * Ce qu'un bouton fait quand on le touche (façon Genially). Un bouton porte une **séquence**
 * d'interactions, jouée dans l'ordre : les actions d'état (visibilité, caches, post-its)
 * modifient l'état de séance, les autres (pages, médias, widgets, remise à zéro) sont des
 * effets exécutés ensuite par le tableau (voir `fireInteractions` dans boardReveal).
 */
export type InteractionAction =
  | 'show' | 'hide' | 'toggle'          // visibilité de la cible
  | 'reveal' | 'cover'                  // cache de la cible : découvrir / recouvrir
  | 'unfold' | 'fold'                   // post-it de la cible : déplier / replier (séance)
  | 'goto' | 'next' | 'prev'            // pages ; goto : params.pageId
  | 'play' | 'pause' | 'playToggle'     // son de la cible (objet audio)
  | 'start' | 'stop' | 'startToggle'    // minuteur, sonomètre (widget cible)
  | 'roll'                              // dé, roue, tirage de groupes (widget cible)
  | 'reset'                             // page courante : tout remettre à couvert, arrêter les widgets
  | 'window'                            // ouvre la fenêtre cible en modale
  | 'zoomTo'                            // la vue cadre la cible (animé) ; tap hors = retour
  | 'moveTo' | 'moveBy' | 'moveBack';   // la cible se déplace (état de séance, animé)

export interface Interaction {
  action: InteractionAction;
  /** Objet visé ; absent pour les actions sans cible (goto, next, prev, reset). */
  targetId?: string;
  /**
   * Paramètres selon l'action : `pageId` (goto, par identifiant : les index bougent quand on
   * réordonne les pages), `x`/`y` (moveTo : coin haut-gauche visé, unités), `dx`/`dy` (moveBy).
   */
  params?: { pageId?: string; x?: number; y?: number; dx?: number; dy?: number };
  /** Ne se joue qu'une fois par séance (mémorisé dans `RevealState.fired`). */
  once?: boolean;
}

export const INTERACTION_LABELS: Record<InteractionAction, string> = {
  show: 'Afficher',
  hide: 'Masquer',
  toggle: 'Afficher / masquer',
  reveal: 'Découvrir',
  cover: 'Recouvrir',
  unfold: 'Déplier',
  fold: 'Replier',
  goto: 'Aller à la page',
  next: 'Page suivante',
  prev: 'Page précédente',
  play: 'Lire',
  pause: 'Mettre en pause',
  playToggle: 'Lire / pause',
  start: 'Lancer',
  stop: 'Arrêter',
  startToggle: 'Lancer / arrêter',
  roll: 'Tirer',
  reset: 'Réinitialiser la page',
  window: 'Ouvrir la fenêtre',
  zoomTo: 'Zoomer sur',
  moveTo: 'Déplacer vers',
  moveBy: 'Décaler de',
  moveBack: 'Remettre en place',
};

/** Familles d'actions, telles que la bulle les présente (une ligne d'icônes, puis les actions). */
export type InteractionFamily = 'visibility' | 'cover' | 'note' | 'content' | 'view' | 'motion' | 'page' | 'media' | 'tool';
export const INTERACTION_FAMILIES: Record<InteractionFamily, { label: string; icon: string; actions: readonly InteractionAction[] }> = {
  visibility: { label: 'Visibilité', icon: '👁', actions: ['show', 'hide', 'toggle'] },
  cover: { label: 'Cache', icon: '🎭', actions: ['reveal', 'cover'] },
  note: { label: 'Post-it', icon: '📌', actions: ['unfold', 'fold'] },
  content: { label: 'Fenêtre', icon: '🗔', actions: ['window'] },
  view: { label: 'Vue', icon: '🔍', actions: ['zoomTo'] },
  motion: { label: 'Déplacer', icon: '↗', actions: ['moveTo', 'moveBy', 'moveBack'] },
  page: { label: 'Page', icon: '📄', actions: ['next', 'prev', 'goto', 'reset'] },
  media: { label: 'Son', icon: '🔊', actions: ['play', 'pause', 'playToggle'] },
  tool: { label: 'Outil', icon: '⏱', actions: ['start', 'stop', 'startToggle', 'roll'] },
};
export function interactionFamily(action: InteractionAction): InteractionFamily {
  for (const [family, def] of Object.entries(INTERACTION_FAMILIES) as [InteractionFamily, { actions: readonly InteractionAction[] }][]) {
    if (def.actions.includes(action)) return family;
  }
  return 'visibility';
}

/** Actions qui ne visent aucun objet. */
export const TARGETLESS_ACTIONS: readonly InteractionAction[] = ['goto', 'next', 'prev', 'reset'];
export const needsTarget = (action: InteractionAction) => !TARGETLESS_ACTIONS.includes(action);

/**
 * Actions qu'un bouton peut avoir sur une cible donnée (`null` = sans cible). C'est la bulle qui
 * s'en sert pour ne proposer que ce qui a un sens : un cache pour un objet couvert, déplier /
 * replier pour un post-it, lancer / arrêter pour un minuteur…
 */
export function actionsFor(target: BoardObject | null): InteractionAction[] {
  if (!target) return [...TARGETLESS_ACTIONS];
  // Une fenêtre ne fait qu'une chose : s'ouvrir
  if (target.type === 'window') return ['window'];
  const out: InteractionAction[] = ['show', 'hide', 'toggle'];
  if (target.cover) out.push('reveal', 'cover');
  if (target.type !== 'connector') out.push('zoomTo', 'moveTo', 'moveBy', 'moveBack');
  if (target.type === 'text' && target.background) out.push('unfold', 'fold');
  if (target.type === 'audio') out.push('play', 'pause', 'playToggle');
  if (target.type === 'widget') {
    if (target.widget === 'timer' || target.widget === 'meter') out.push('start', 'stop', 'startToggle');
    if (target.widget === 'dice' || target.widget === 'wheel' || target.widget === 'groups') out.push('roll');
  }
  return out;
}

/** Libellé complet d'une interaction : « Afficher · Texte “Réponse” », « Aller à la page 3 ». */
export function describeInteraction(it: Interaction, objects: readonly BoardObject[], pageIds: readonly string[]): string {
  const base = INTERACTION_LABELS[it.action];
  if (it.action === 'goto') {
    const idx = it.params?.pageId ? pageIds.indexOf(it.params.pageId) : -1;
    return idx >= 0 ? `${base} ${idx + 1}` : `${base} (page supprimée)`;
  }
  if (!needsTarget(it.action)) return base;
  const target = it.targetId ? objects.find((o) => o.id === it.targetId) : undefined;
  const name = target ? objectShortLabel(target) : 'objet supprimé';
  if (it.action === 'moveTo') return `${base} (${Math.round(it.params?.x ?? 0)}, ${Math.round(it.params?.y ?? 0)}) · ${name}`;
  if (it.action === 'moveBy') { const s = (n: number) => (n >= 0 ? `+${Math.round(n)}` : `${Math.round(n)}`); return `${base} (${s(it.params?.dx ?? 0)}, ${s(it.params?.dy ?? 0)}) · ${name}`; }
  return `${base} · ${name}`;
}

/** Zone de texte : la hauteur découle du contenu. */
export interface TextObject extends BoardObjectBase, TextBox {
  type: 'text';
}

/** Image (photo, schéma, capture) stockée dans le bucket board-assets. */
export interface ImageObject extends BoardObjectBase {
  type: 'image';
  h: number;
  path: string;
  /** Dimensions du fichier, pour garder les proportions au redimensionnement. */
  naturalWidth: number;
  naturalHeight: number;
}

export type BoardObject = TextObject | ShapeObject | ImageObject | LibraryObject | MediaObject | ConnectorObject;

export interface Rect { x: number; y: number; w: number; h: number }

export const objectId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Emprise cliquable de l'objet, en unités logiques. */
export function objectRect(o: BoardObject): Rect {
  switch (o.type) {
    case 'text':
      return textBoxRect(o);
    case 'shape': {
      // Une ligne fine reste attrapable : emprise minimale de 12 unités
      const pad = Math.max(0, (12 - o.h) / 2);
      const padW = Math.max(0, (12 - o.w) / 2);
      return { x: o.x - padW, y: o.y - pad, w: o.w + padW * 2, h: o.h + pad * 2 };
    }
    case 'image':
    case 'library':
      return { x: o.x, y: o.y, w: o.w, h: o.h };
    case 'connector':
      // Boîte englobante dérivée (voir refreshConnectors) : sert au lasso, pas au clic (le
      // calque des connecteurs pointe sur le tracé lui-même)
      return { x: o.x, y: o.y, w: Math.max(o.w, 1), h: Math.max(o.h, 1) };
    default:
      return mediaRect(o);
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Objet le plus haut dans l'empilement sous le point (x, y). */
export function objectAt(objects: BoardObject[], x: number, y: number): BoardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    if (objects[i].type === 'connector') continue;
    if (rectContains(objectRect(objects[i]), x, y)) return objects[i];
  }
  return null;
}

/**
 * Copie d'objets avec de nouveaux identifiants, décalée (pour dupliquer / coller).
 * Un bouton copié avec ses cibles garde ses interactions vers les copies ; vers un objet resté
 * hors de la copie, l'interaction est conservée telle quelle (même page) — elle sera ignorée si
 * la cible n'existe pas sur la page d'arrivée.
 */
export function cloneObjects(objects: BoardObject[], dx = 24, dy = 24): BoardObject[] {
  const ids = new Map(objects.map((o) => [o.id, objectId()]));
  // Un groupe copié devient un nouveau groupe (mêmes membres, nouvel identifiant)
  const groups = new Map<string, string>();
  for (const o of objects) if (o.groupId && !groups.has(o.groupId)) groups.set(o.groupId, objectId());
  return objects.map((o) => {
    const copy: BoardObject = {
      ...o,
      id: ids.get(o.id) ?? objectId(),
      x: o.x + dx,
      y: o.y + dy,
      ...(o.groupId ? { groupId: groups.get(o.groupId) } : {}),
      ...(o.interactions ? { interactions: o.interactions.map((it) => (it.targetId ? { ...it, targetId: ids.get(it.targetId) ?? it.targetId } : it)) } : {}),
    };
    // Une flèche copiée avec ses objets suit les copies ; vers un objet resté hors de la copie,
    // elle reste attachée à l'original (même page)
    return copy.type === 'connector' ? remapConnectorEnds(copy, ids) : copy;
  });
}

/** Bas de l'objet le plus bas (unités logiques), 0 sans objet. */
export function objectsBottom(objects: BoardObject[]): number {
  let bottom = 0;
  for (const o of objects) { const r = objectRect(o); if (r.y + r.h > bottom) bottom = r.y + r.h; }
  return bottom;
}

/** Nom court d'un objet, pour désigner une cible d'interaction : « Texte “Réponse…” », « Image ». */
export function objectShortLabel(o: BoardObject): string {
  const generic = objectTypeLabel([o]);
  const kind = generic !== 'Objet' ? generic : o.type === 'text' ? 'Texte' : o.type === 'shape' ? (o.hotspot ? 'Zone' : 'Forme') : o.type === 'library' ? 'Dessin' : o.type === 'connector' ? 'Flèche' : 'Objet';
  if (o.type === 'window') return o.title.trim() ? `Fenêtre « ${o.title.length > 24 ? `${o.title.slice(0, 24)}…` : o.title} »` : 'Fenêtre';
  if (o.type === 'text' || o.type === 'table') {
    const html = o.type === 'text' ? o.html : o.cells.flat().join(' ');
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) return `${kind} « ${text.length > 24 ? `${text.slice(0, 24)}…` : text} »`;
  }
  return kind;
}

/** Déplace les objets sélectionnés d'un cran vers l'avant ou l'arrière dans l'empilement. */
export function reorder(objects: BoardObject[], ids: Set<string>, move: 'front' | 'back' | 'forward' | 'backward'): BoardObject[] {
  const selected = objects.filter((o) => ids.has(o.id));
  const others = objects.filter((o) => !ids.has(o.id));
  if (selected.length === 0) return objects;
  if (move === 'front') return [...others, ...selected];
  if (move === 'back') return [...selected, ...others];
  const next = [...objects];
  if (move === 'forward') {
    for (let i = next.length - 2; i >= 0; i--) {
      if (ids.has(next[i].id) && !ids.has(next[i + 1].id)) [next[i], next[i + 1]] = [next[i + 1], next[i]];
    }
  } else {
    for (let i = 1; i < next.length; i++) {
      if (ids.has(next[i].id) && !ids.has(next[i - 1].id)) [next[i], next[i - 1]] = [next[i - 1], next[i]];
    }
  }
  return next;
}

/** Ancien champ `texts[]` d'une page → objets `text`. Idempotent. */
export function migrateLegacyTexts(objects: BoardObject[] | undefined, texts: TextBox[] | undefined): BoardObject[] {
  const base = Array.isArray(objects) ? objects : [];
  if (!Array.isArray(texts) || texts.length === 0) return base;
  const known = new Set(base.map((o) => o.id));
  const migrated: BoardObject[] = texts
    .filter((t) => !known.has(t.id))
    .map((t) => ({ ...t, type: 'text' as const }));
  return [...base, ...migrated];
}

/** Libellé de type affiché en tête de barre. */
export function objectTypeLabel(objects: BoardObject[]): string {
  if (objects.length > 1) return `Objets (${objects.length})`;
  switch (objects[0]?.type) {
    case 'image': return 'Image';
    case 'table': return 'Tableau';
    case 'video': return 'Vidéo';
    case 'web': return 'Site';
    case 'audio': return 'Son';
    case 'link': return 'Lien';
    case 'window': return 'Fenêtre';
    case 'widget': return 'Widget';
    case 'equation': return 'Équation';
    case 'connector': return 'Flèche';
    default: return 'Objet';
  }
}
