/**
 * Nuanciers personnalisables du tableau blanc. Chaque nuancier (pastilles rapides du stylo,
 * palette complète, couleurs du texte, surligneurs, flèches, couleur du menu radial, fonds de
 * page) a des couleurs par défaut ; un clic droit sur une pastille ouvre la roue de couleur
 * native et remplace cette pastille. Le choix est mémorisé (localStorage) et partagé par toutes
 * les barres qui affichent le même nuancier.
 */
import { useSyncExternalStore } from 'react';

export interface SwatchSet {
  key: string;
  defaults: readonly string[];
  /** Noms affichés (menus) ; une pastille personnalisée montre son code hexadécimal. */
  labels?: readonly string[];
}

export const SWATCHES = {
  /** Pastilles rapides du stylo et des formes, reprises par le menu radial (couleurs 1 à 4). */
  quick: { key: 'quick', defaults: ['#111827', '#1D4ED8', '#DC2626', '#059669'] },
  /** Palette complète du panneau « Plus de couleurs ». */
  palette: {
    key: 'palette',
    defaults: [
      '#111827', '#6B7280', '#FFFFFF', '#1D4ED8', '#0EA5E9', '#0D9488', '#059669', '#65A30D',
      '#CA8A04', '#F97316', '#DC2626', '#DB2777', '#9333EA', '#7C3AED', '#92400E', '#F5D0A9',
    ],
  },
  text: { key: 'text', defaults: ['#111827', '#1D4ED8', '#DC2626', '#059669'] },
  highlights: { key: 'highlights', defaults: ['#FDE047', '#BBF7D0', '#BFDBFE'] },
  connectors: { key: 'connectors', defaults: ['#6B7280', '#111827', '#1D4ED8', '#DC2626', '#059669'] },
  /** Sous-menu « Couleur » du menu radial. */
  radial: {
    key: 'radial',
    defaults: ['#111827', '#1D4ED8', '#DC2626', '#059669', '#F97316', '#9333EA', '#0EA5E9', '#6B7280'],
    labels: ['Noir', 'Bleu', 'Rouge', 'Vert', 'Orange', 'Violet', 'Ciel', 'Gris'],
  },
  /** Couleurs de fond de page. */
  background: {
    key: 'background',
    defaults: ['#FFFFFF', '#FEF9E7', '#FEF3C7', '#E0F2FE', '#DCFCE7', '#FCE7F3', '#F3F4F6', '#1F2937'],
    labels: ['Blanc', 'Crème', 'Jaune pâle', 'Bleu pâle', 'Vert pâle', 'Rose pâle', 'Gris clair', 'Ardoise'],
  },
} satisfies Record<string, SwatchSet>;

const STORAGE_KEY = 'classroom-board-swatches';
type Store = Record<string, (string | null)[]>;

let store: Store | null = null;
const listeners = new Set<() => void>();
/** Instantanés par nuancier : `useSyncExternalStore` veut une référence stable tant que rien ne change. */
const snapshots = new Map<string, string[]>();

const HEX = /^#[0-9a-f]{6}$/i;

function load(): Store {
  if (store) return store;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    store = parsed && typeof parsed === 'object' ? (parsed as Store) : {};
  } catch { store = {}; }
  return store;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store ?? {})); } catch { /* stockage indisponible */ }
}

/** Couleurs courantes du nuancier : les défauts, remplacés pastille par pastille par les choix mémorisés. */
export function getSwatches(set: SwatchSet): string[] {
  const cached = snapshots.get(set.key);
  if (cached) return cached;
  const custom = load()[set.key] ?? [];
  const value = set.defaults.map((d, i) => { const c = custom[i]; return typeof c === 'string' && HEX.test(c) ? c : d; });
  snapshots.set(set.key, value);
  return value;
}

export function setSwatch(set: SwatchSet, index: number, color: string) {
  if (!HEX.test(color) || index < 0 || index >= set.defaults.length) return;
  const s = load();
  const arr = [...(s[set.key] ?? [])];
  while (arr.length < set.defaults.length) arr.push(null);
  arr[index] = color.toUpperCase() === set.defaults[index].toUpperCase() ? null : color;
  s[set.key] = arr;
  snapshots.delete(set.key);
  save();
  listeners.forEach((l) => l());
}

export function resetSwatches(set: SwatchSet) {
  const s = load();
  delete s[set.key];
  snapshots.delete(set.key);
  save();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Couleurs du nuancier, réactives aux personnalisations faites ailleurs. */
export function useSwatches(set: SwatchSet): string[] {
  return useSyncExternalStore(subscribe, () => getSwatches(set), () => getSwatches(set));
}

/** Nom d'une pastille : son libellé si elle est d'origine, sinon son code. */
export function swatchLabel(set: SwatchSet, index: number, colors: string[]): string {
  const c = colors[index] ?? set.defaults[index];
  if (set.labels && c.toUpperCase() === set.defaults[index].toUpperCase()) return set.labels[index];
  return c.toUpperCase();
}

let wheel: HTMLInputElement | null = null;
let wheelHandler: ((hex: string) => void) | null = null;
/** Dernier point touché : le navigateur ancre la roue sur le champ caché, qu'on pose là. */
let lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
  const track = (e: PointerEvent | MouseEvent) => { lastPointer = { x: e.clientX, y: e.clientY }; };
  window.addEventListener('pointerdown', track, true);
  window.addEventListener('contextmenu', track, true);
}

/**
 * Roue de couleur native du navigateur, ouverte depuis un geste utilisateur (clic droit). Un seul
 * champ caché est réutilisé, posé sous le pointeur (`at`, sinon le dernier point touché) pour que
 * la roue s'ouvre à côté de la pastille ; `onPick` est appelé à chaque changement (aperçu en
 * direct) puis à la validation. Annuler ne rappelle rien.
 */
export function openColorWheel(initial: string, onPick: (hex: string) => void, at?: { x: number; y: number }) {
  if (!wheel) {
    wheel = document.createElement('input');
    wheel.type = 'color';
    wheel.setAttribute('aria-hidden', 'true');
    wheel.tabIndex = -1;
    Object.assign(wheel.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(wheel);
    const emit = () => { if (wheel && wheelHandler && HEX.test(wheel.value)) wheelHandler(wheel.value.toUpperCase()); };
    wheel.addEventListener('input', emit);
    wheel.addEventListener('change', emit);
  }
  wheelHandler = onPick;
  wheel.value = HEX.test(initial) ? initial : '#111827';
  const p = at ?? lastPointer;
  wheel.style.left = `${Math.max(0, Math.min(window.innerWidth - 2, p.x))}px`;
  wheel.style.top = `${Math.max(0, Math.min(window.innerHeight - 2, p.y))}px`;
  wheel.click();
}

/**
 * Personnalise une pastille : ouvre la roue sur sa couleur actuelle, remplace la pastille par la
 * couleur choisie et, si `apply` est donné, l'applique aussitôt (elle devient la courante).
 */
export function pickSwatchColor(set: SwatchSet, index: number, apply?: (hex: string) => void, at?: { x: number; y: number }) {
  const current = getSwatches(set)[index] ?? set.defaults[index];
  openColorWheel(current, (hex) => { setSwatch(set, index, hex); apply?.(hex); }, at);
}

/** Gestionnaire de clic droit d'une pastille (bouton DOM) : `pickSwatchColor` sans le menu natif, roue posée au clic. */
export function customizeSwatch(set: SwatchSet, index: number, apply?: (hex: string) => void) {
  return (e: { preventDefault: () => void; stopPropagation: () => void; clientX?: number; clientY?: number }) => {
    e.preventDefault();
    e.stopPropagation();
    pickSwatchColor(set, index, apply, typeof e.clientX === 'number' && typeof e.clientY === 'number' ? { x: e.clientX, y: e.clientY } : undefined);
  };
}

/** Titre d'une pastille : rappelle le clic droit. */
export const SWATCH_HINT = 'clic droit : autre couleur';
