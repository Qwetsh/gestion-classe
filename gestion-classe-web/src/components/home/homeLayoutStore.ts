/**
 * État partagé de la disposition de l'accueil.
 *
 * Deux endroits la manipulent et doivent rester d'accord : la grille (déplacement,
 * redimensionnement, retrait) et la modale de réglages (afficher / masquer, réinitialiser).
 * Un store de module + useSyncExternalStore évite d'enrober toute l'application dans un provider.
 */

import { useSyncExternalStore } from 'react';
import { fetchPreference, readCachedPreference, savePreference, clearPreference } from '../../lib/userPreferences';
import {
  DEFAULT_HOME_LAYOUT, HOME_LAYOUT_VERSION,
  compactLayout, mergeLayout,
  type HomeLayout, type HomeLayoutItem,
} from './homeLayout';

export const HOME_LAYOUT_KEY = 'home_layout';

/** Délai d'écriture après la dernière manipulation, pour ne pas écrire à chaque pixel. */
const SAVE_DEBOUNCE_MS = 800;

interface StoreState {
  layout: HomeLayout;
  /** true tant que la préférence distante n'a pas répondu */
  loading: boolean;
  /** mode édition actif sur la page d'accueil */
  editing: boolean;
}

let state: StoreState = {
  layout: DEFAULT_HOME_LAYOUT,
  loading: true,
  editing: false,
};

let knownIds: string[] = [];
let currentUserId: string | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot(): StoreState {
  return state;
}

/** À appeler une fois que l'utilisateur et le registre sont connus. */
export async function initHomeLayout(userId: string, moduleIds: string[]): Promise<void> {
  knownIds = moduleIds;

  // Rien ne change : on évite de rejouer le chargement à chaque rendu.
  if (currentUserId === userId && !state.loading) return;
  currentUserId = userId;

  const cached = readCachedPreference<HomeLayout>(HOME_LAYOUT_KEY);
  if (cached) setState({ layout: mergeLayout(cached, knownIds), loading: true });

  const remote = await fetchPreference<HomeLayout>(userId, HOME_LAYOUT_KEY);
  setState({ layout: mergeLayout(remote ?? cached, knownIds), loading: false });
}

function scheduleSave(layout: HomeLayout) {
  if (!currentUserId) return;
  if (saveTimer) clearTimeout(saveTimer);
  const userId = currentUserId;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void savePreference(userId, HOME_LAYOUT_KEY, layout);
  }, SAVE_DEBOUNCE_MS);
}

function update(next: HomeLayout) {
  setState({ layout: next });
  scheduleSave(next);
}

/** Applique de nouvelles positions (sortie de drag ou de redimensionnement). */
export function setLayoutItems(items: HomeLayoutItem[]): void {
  update({
    ...state.layout,
    version: HOME_LAYOUT_VERSION,
    items: items.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
  });
}

/** Retire un module de la page (il rejoint la bibliothèque). */
export function hideModule(id: string): void {
  if (state.layout.hidden.includes(id)) return;
  update({
    ...state.layout,
    hidden: [...state.layout.hidden, id],
    items: compactLayout(state.layout.items.filter(it => it.i !== id)),
  });
}

/** Repose un module en bas de la page. */
export function showModule(id: string): void {
  const fallback = DEFAULT_HOME_LAYOUT.items.find(it => it.i === id);
  const bottom = state.layout.items.reduce((max, it) => Math.max(max, it.y + it.h), 0);
  const withoutId = state.layout.items.filter(it => it.i !== id);

  update({
    ...state.layout,
    hidden: state.layout.hidden.filter(h => h !== id),
    items: compactLayout([
      ...withoutId,
      { i: id, x: 0, y: bottom, w: fallback?.w ?? 4, h: fallback?.h ?? 6 },
    ]),
  });
}

export function toggleModule(id: string, visible: boolean): void {
  if (visible) showModule(id);
  else hideModule(id);
}

/** Revient à la disposition livrée par défaut. */
export function resetHomeLayout(): void {
  const fresh = mergeLayout(null, knownIds);
  setState({ layout: fresh });
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (currentUserId) void clearPreference(currentUserId, HOME_LAYOUT_KEY);
}

export function setEditing(editing: boolean): void {
  setState({ editing });
  // en quittant l'édition, on n'attend pas le debounce
  if (!editing && saveTimer && currentUserId) {
    clearTimeout(saveTimer);
    saveTimer = null;
    void savePreference(currentUserId, HOME_LAYOUT_KEY, state.layout);
  }
}

export function useHomeLayoutStore(): StoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Réservé aux tests. */
export function __resetStoreForTests(): void {
  state = { layout: DEFAULT_HOME_LAYOUT, loading: true, editing: false };
  knownIds = [];
  currentUserId = null;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  listeners.clear();
}
