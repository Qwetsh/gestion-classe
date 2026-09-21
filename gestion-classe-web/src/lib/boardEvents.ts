/**
 * Banque d'événements du tableau blanc : des éléments déjà munis de leurs actions d'interaction,
 * qu'on pose sur la page d'un tap depuis l'onglet « Événements » du panneau Ressources.
 *
 * Deux étages :
 * - les préréglages fournis (`EVENT_PRESETS`) : un bouton, une zone, une fenêtre, un widget…
 *   construits à la demande avec des identifiants frais ; quand l'action a besoin d'une cible qui
 *   n'est pas dans le préréglage (afficher / masquer, découvrir, zoomer…), l'insertion enchaîne
 *   sur le choix de la cible, action déjà choisie (`pending`) ;
 * - « mes événements » (`SavedEvent`) : une sélection enregistrée depuis un tableau, positions
 *   relatives, gardée dans le navigateur et dans le compte (`user_board_events`).
 */
import { cloneObjects, needsTarget, objectId, type BoardObject, type Interaction, type InteractionAction, type TextObject } from './boardObjects';
import type { ShapeObject } from './boardShapes';
import { WINDOW_CARD, type WidgetObject, type WindowObject } from './boardMedia';
import { supabase } from './supabase';

export interface EventPending { action: InteractionAction; params?: Interaction['params'] }
/** Ce qu'une insertion pose sur la page : ses objets, le bouton porteur, et l'action encore sans cible. */
export interface EventInsert { objects: BoardObject[]; triggerId: string; pending?: EventPending }
export interface EventPreset {
  id: string;
  label: string;
  icon: string;
  /** Une ligne pour dire ce qui se passe après le dépôt. */
  hint: string;
  keywords?: string[];
  build: () => EventInsert;
}

// ---- Préréglages fournis ----------------------------------------------------------------------

const BUTTON = { w: 200, h: 64 };

/** Bouton : rectangle arrondi indigo avec son libellé, prêt à porter des actions. */
function button(label: string, interactions?: Interaction[], x = 0, y = 0): ShapeObject {
  return {
    id: objectId(), type: 'shape', kind: 'rounded-rect', x, y, w: BUTTON.w, h: BUTTON.h,
    stroke: '#3730A3', strokeWidth: 2, fill: '#4F46E5',
    text: { html: `<div style="text-align:center">${label}</div>`, size: 24, font: 'sans', color: '#FFFFFF' },
    ...(interactions ? { interactions } : {}),
  };
}

function textBox(html: string, x: number, y: number, w = 420, extra: Partial<TextObject> = {}): TextObject {
  return { id: objectId(), type: 'text', x, y, w, size: 28, font: 'sans', color: '#111827', html, ...extra };
}

function widget(kind: WidgetObject['widget'], x: number, y: number, w: number, h: number, config: WidgetObject['config']): WidgetObject {
  return { id: objectId(), type: 'widget', x, y, w, h, widget: kind, config };
}

function hotspot(kind: 'rect' | 'ellipse', w: number, h: number, interactions?: Interaction[]): ShapeObject {
  return { id: objectId(), type: 'shape', kind, x: 0, y: 0, w, h, stroke: '#6366F1', strokeWidth: 2, fill: null, dashed: true, hotspot: true, ...(interactions ? { interactions } : {}) };
}

export const EVENT_PRESETS: EventPreset[] = [
  {
    id: 'toggle', label: 'Afficher / masquer', icon: '👁', hint: 'Touchez ensuite l’objet à afficher ou masquer.', keywords: ['bouton', 'visible', 'cacher'],
    build: () => { const b = button('Voir'); return { objects: [b], triggerId: b.id, pending: { action: 'toggle' } }; },
  },
  {
    id: 'answer', label: 'Bouton Réponse', icon: '✅', hint: 'Un bouton et sa réponse cachée, à écrire.', keywords: ['réponse', 'correction', 'révéler'],
    build: () => {
      const answer = textBox('<div>Réponse…</div>', 0, BUTTON.h + 24, 420, { hidden: true, background: '#DCFCE7' });
      const b = button('Réponse', [{ action: 'toggle', targetId: answer.id }]);
      return { objects: [b, answer], triggerId: b.id };
    },
  },
  {
    id: 'reveal', label: 'Découvrir un cache', icon: '🎭', hint: 'Touchez ensuite l’objet recouvert d’un rideau ou d’un ticket.', keywords: ['rideau', 'gratter', 'cache'],
    build: () => { const b = button('Découvrir'); return { objects: [b], triggerId: b.id, pending: { action: 'reveal' } }; },
  },
  {
    id: 'next', label: 'Suite →', icon: '→', hint: 'Passe à la page suivante.', keywords: ['page', 'suivante'],
    build: () => { const b = button('Suite →', [{ action: 'next' }]); return { objects: [b], triggerId: b.id }; },
  },
  {
    id: 'prev', label: '← Retour', icon: '←', hint: 'Revient à la page précédente.', keywords: ['page', 'précédente'],
    build: () => { const b = button('← Retour', [{ action: 'prev' }]); return { objects: [b], triggerId: b.id }; },
  },
  {
    id: 'goto', label: 'Aller à une page', icon: '🔢', hint: 'Choisissez ensuite la page visée.', keywords: ['sommaire', 'menu', 'page'],
    build: () => { const b = button('Sommaire'); return { objects: [b], triggerId: b.id, pending: { action: 'goto' } }; },
  },
  {
    id: 'reset', label: 'Tout remettre', icon: '↺', hint: 'Remet la page à couvert et arrête minuteurs et sons.', keywords: ['réinitialiser', 'recommencer'],
    build: () => { const b = button('↺ Remise à zéro', [{ action: 'reset' }]); return { objects: [b], triggerId: b.id }; },
  },
  {
    id: 'zone', label: 'Zone cliquable', icon: '▭', hint: 'Zone invisible en classe ; touchez ensuite l’objet qu’elle affiche ou masque.', keywords: ['schéma', 'invisible', 'hotspot'],
    build: () => { const z = hotspot('rect', 240, 140); return { objects: [z], triggerId: z.id, pending: { action: 'toggle' } }; },
  },
  {
    id: 'hotspot-window', label: 'Point chaud + fenêtre', icon: '🗔', hint: 'Une zone ovale qui ouvre une fenêtre (titre, texte, image) à remplir.', keywords: ['schéma', 'fenêtre', 'légende', 'définition'],
    build: () => {
      const win: WindowObject = { id: objectId(), type: 'window', x: 0, y: 130, w: WINDOW_CARD.w, h: WINDOW_CARD.h, title: 'Fenêtre', html: '<div><br></div>' };
      const z = hotspot('ellipse', 160, 110, [{ action: 'window', targetId: win.id }]);
      return { objects: [z, win], triggerId: z.id };
    },
  },
  {
    id: 'zoom', label: 'Zoom sur…', icon: '🔍', hint: 'Touchez ensuite l’objet à cadrer.', keywords: ['loupe', 'agrandir', 'vue'],
    build: () => { const b = button('🔍 Zoom'); return { objects: [b], triggerId: b.id, pending: { action: 'zoomTo' } }; },
  },
  {
    id: 'move', label: 'Avancer d’un cran', icon: '↗', hint: 'Touchez ensuite l’objet à décaler de 50 unités vers la droite.', keywords: ['déplacer', 'bouger', 'animer'],
    build: () => { const b = button('→ Avancer'); return { objects: [b], triggerId: b.id, pending: { action: 'moveBy', params: { dx: 50, dy: 0 } } }; },
  },
  {
    id: 'timer', label: 'Top chrono', icon: '⏱', hint: 'Un bouton et son minuteur de 5 minutes.', keywords: ['minuteur', 'temps', 'chrono'],
    build: () => {
      const t = widget('timer', 0, BUTTON.h + 24, 320, 186, { seconds: 300 });
      const b = button('⏱ Top chrono', [{ action: 'startToggle', targetId: t.id }]);
      return { objects: [b, t], triggerId: b.id };
    },
  },
  {
    id: 'dice', label: 'Tirage', icon: '🎲', hint: 'Un bouton et son dé.', keywords: ['dé', 'hasard', 'aléatoire'],
    build: () => {
      const d = widget('dice', 0, BUTTON.h + 24, 260, 196, { faces: 6 });
      const b = button('🎲 Tirage', [{ action: 'roll', targetId: d.id }]);
      return { objects: [b, d], triggerId: b.id };
    },
  },
  {
    id: 'sound', label: 'Jouer un son', icon: '🔊', hint: 'Touchez ensuite le son à lire.', keywords: ['audio', 'écouter'],
    build: () => { const b = button('🔊 Écouter'); return { objects: [b], triggerId: b.id, pending: { action: 'playToggle' } }; },
  },
];

/** Préréglages dont le libellé ou un mot-clé contient la recherche. */
export function filterPresets(query: string): EventPreset[] {
  const q = query.trim().toLowerCase();
  if (!q) return EVENT_PRESETS;
  return EVENT_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.hint.toLowerCase().includes(q) || (p.keywords ?? []).some((k) => k.toLowerCase().includes(q)));
}

// ---- Mes événements -----------------------------------------------------------------------------

export interface SavedEvent { id: string; label: string; objects: BoardObject[]; createdAt: string }

/**
 * Fragment normalisé pour l'enregistrement : identifiants frais, positions relatives au coin
 * haut-gauche du fragment (les interactions internes suivent, celles vers l'extérieur gardent
 * leur cible, qui ne sera plus là : elles redeviennent « à relier » à l'insertion).
 */
export function eventFromSelection(objects: BoardObject[]): BoardObject[] {
  if (objects.length === 0) return [];
  const minX = Math.min(...objects.map((o) => o.x)), minY = Math.min(...objects.map((o) => o.y));
  return cloneObjects(objects, -minX, -minY);
}

/** Insertion d'un événement enregistré : copies fraîches ; la première action vers l'extérieur devient « à relier ». */
export function insertFromSaved(ev: SavedEvent): EventInsert {
  const objects = cloneObjects(ev.objects, 0, 0);
  const ids = new Set(objects.map((o) => o.id));
  let triggerId = objects[0]?.id ?? '';
  let pending: EventPending | undefined;
  for (const o of objects) {
    if (!o.interactions) continue;
    const kept: Interaction[] = [];
    for (const it of o.interactions) {
      if (!needsTarget(it.action) || (it.targetId && ids.has(it.targetId))) { kept.push(it); continue; }
      if (!pending) { pending = { action: it.action, ...(it.params ? { params: it.params } : {}) }; triggerId = o.id; }
    }
    if (kept.length > 0) o.interactions = kept; else delete o.interactions;
    if (!pending && (o.interactions?.length ?? 0) > 0) triggerId = o.id;
  }
  return { objects, triggerId, ...(pending ? { pending } : {}) };
}

const STORAGE_KEY = 'classroom-board-events';
let owner: string | null = null;
let tableMissing = false;

export function setEventsOwner(userId: string | null) { owner = userId || null; }

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || ((error.message || '').includes('user_board_events') && (error.message || '').includes('schema cache'));
}

export function loadSavedEvents(): SavedEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as SavedEvent[]).filter((e) => e && typeof e.id === 'string' && Array.isArray(e.objects)) : [];
  } catch { return []; }
}

function storeLocal(list: SavedEvent[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* stockage indisponible */ }
}

/** Compte → navigateur (au démarrage du tableau). Silencieux si la table manque ou hors ligne. */
export async function pullEvents(): Promise<void> {
  if (!owner || tableMissing) return;
  const { data, error } = await supabase.from('user_board_events').select('id, label, payload, created_at').eq('user_id', owner).order('created_at', { ascending: false });
  if (error) { if (isMissingTable(error)) tableMissing = true; else console.warn('[boardEvents] lecture :', error); return; }
  const remote: SavedEvent[] = (data ?? []).map((r) => ({ id: r.id as string, label: r.label as string, objects: ((r.payload as { objects?: BoardObject[] })?.objects ?? []), createdAt: r.created_at as string }));
  // Le compte fait foi ; ce que le navigateur a en plus (enregistré hors ligne) est renvoyé au compte
  const local = loadSavedEvents();
  const remoteIds = new Set(remote.map((e) => e.id));
  const onlyLocal = local.filter((e) => !remoteIds.has(e.id));
  storeLocal([...remote, ...onlyLocal]);
  for (const e of onlyLocal) void pushEvent(e);
}

async function pushEvent(e: SavedEvent): Promise<void> {
  if (!owner || tableMissing) return;
  const { error } = await supabase.from('user_board_events').upsert({ id: e.id, user_id: owner, label: e.label, payload: { objects: e.objects }, created_at: e.createdAt });
  if (error) { if (isMissingTable(error)) tableMissing = true; else console.warn('[boardEvents] enregistrement :', error); }
}

/** Enregistre un fragment sous un nom ; navigateur tout de suite, compte ensuite. */
export function saveEvent(label: string, objects: BoardObject[]): SavedEvent {
  const e: SavedEvent = { id: crypto.randomUUID(), label: label.trim() || 'Événement', objects: eventFromSelection(objects), createdAt: new Date().toISOString() };
  storeLocal([e, ...loadSavedEvents()]);
  void pushEvent(e);
  return e;
}

export function deleteEvent(id: string): void {
  storeLocal(loadSavedEvents().filter((e) => e.id !== id));
  if (!owner || tableMissing) return;
  void supabase.from('user_board_events').delete().eq('id', id).eq('user_id', owner).then(({ error }) => { if (error && !isMissingTable(error)) console.warn('[boardEvents] suppression :', error); });
}
