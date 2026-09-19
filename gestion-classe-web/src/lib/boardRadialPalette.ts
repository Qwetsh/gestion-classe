/**
 * Palette flottante du tableau blanc : la pastille ronde posée sur la scène ouvre le menu radial
 * à huit quartiers. Ce module décrit le catalogue des actions qu'on peut y ranger, la
 * configuration par défaut et sa persistance locale (`classroom-board-radial`).
 * Les gestes réels (changer d'outil, annuler…) restent dans `Whiteboard.tsx` : ici on ne
 * manipule que des identifiants.
 */

import { WIDGET_LABELS, type WidgetKind } from './boardMedia';

export const PALETTE_STORAGE_KEY = 'classroom-board-radial';
export const PALETTE_SLOTS = 8;

export type PaletteGroup = 'Outils' | 'Couleur et trait' | 'Historique' | 'Pages' | 'Instruments' | 'Insertion' | 'Séance';

/** Ce qu'on peut insérer sur la page : médias, objets et widgets. */
export type InsertKind = 'image' | 'table' | 'video' | 'web' | 'link' | 'audio' | 'record' | 'sticky' | 'equation' | WidgetKind;
export const INSERT_WIDGETS: WidgetKind[] = ['timer', 'clock', 'meter', 'noise', 'traffic', 'dice', 'wheel', 'groups', 'qr', 'calc'];
const WIDGET_ICONS: Record<WidgetKind, string> = { timer: '⏱', dice: '🎲', wheel: '🎡', noise: '🔔', calc: '🧮', meter: '🎚', groups: '👥', clock: '🕒', traffic: '🚦', qr: '▦' };

/**
 * Catalogue d'insertion : une seule liste pour le bouton « Insérer » de la barre, le sous-menu
 * du clic droit et les quartiers de la palette (`insert-<id>`). Les gestes restent dans
 * `Whiteboard.tsx`, qui associe chaque identifiant à l'action correspondante.
 */
export const INSERT_ACTIONS: { id: InsertKind; label: string; icon: string }[] = [
  { id: 'image', label: 'Image', icon: '🖼' },
  { id: 'table', label: 'Tableau 3 × 3', icon: '▦' },
  { id: 'video', label: 'Vidéo (YouTube…)', icon: '▶' },
  { id: 'web', label: 'Site web', icon: '🌐' },
  { id: 'link', label: 'Lien', icon: '🔗' },
  { id: 'audio', label: 'Son (fichier)', icon: '🔊' },
  { id: 'record', label: 'Enregistrer au micro', icon: '🎙' },
  { id: 'sticky', label: 'Post-it', icon: '🗒' },
  { id: 'equation', label: 'Équation (LaTeX)', icon: '∑' },
  ...INSERT_WIDGETS.map((k) => ({ id: k, label: WIDGET_LABELS[k], icon: WIDGET_ICONS[k] })),
];

export interface PaletteActionDef {
  id: string;
  label: string;
  icon: string;
  group: PaletteGroup;
  /** Ne figure jamais dans la configuration par défaut (action destructive ou de contexte). */
  optional?: boolean;
}

/** Tout ce qu'on peut mettre dans un quartier. L'ordre est celui de l'éditeur. */
export const PALETTE_CATALOG: PaletteActionDef[] = [
  { id: 'pen', label: 'Stylo', icon: '✏️', group: 'Outils' },
  { id: 'highlighter', label: 'Surligneur', icon: '🖍️', group: 'Outils' },
  { id: 'eraser', label: 'Gomme', icon: '🧽', group: 'Outils' },
  { id: 'select', label: 'Sélection', icon: '⬚', group: 'Outils' },
  { id: 'text', label: 'Texte', icon: 'T', group: 'Outils' },
  { id: 'shape', label: 'Forme', icon: '◯', group: 'Outils' },
  { id: 'laser', label: 'Laser', icon: '🔴', group: 'Outils' },
  { id: 'color', label: 'Couleur…', icon: '●', group: 'Couleur et trait' },
  { id: 'color-0', label: 'Noir', icon: '●', group: 'Couleur et trait' },
  { id: 'color-1', label: 'Bleu', icon: '●', group: 'Couleur et trait' },
  { id: 'color-2', label: 'Rouge', icon: '●', group: 'Couleur et trait' },
  { id: 'color-3', label: 'Vert', icon: '●', group: 'Couleur et trait' },
  { id: 'size-cycle', label: 'Épaisseur', icon: '━', group: 'Couleur et trait' },
  { id: 'undo', label: 'Annuler', icon: '↶', group: 'Historique' },
  { id: 'redo', label: 'Rétablir', icon: '↷', group: 'Historique' },
  { id: 'page-next', label: 'Page +', icon: '⏭', group: 'Pages' },
  { id: 'page-prev', label: 'Page −', icon: '⏮', group: 'Pages' },
  { id: 'page-new', label: 'Nouvelle page', icon: '＋', group: 'Pages' },
  { id: 'page-nav', label: 'Liste des pages', icon: '▤', group: 'Pages' },
  { id: 'page-clear', label: 'Effacer la page', icon: '🗑', group: 'Pages', optional: true },
  { id: 'zoom-in', label: 'Zoom +', icon: '🔍', group: 'Instruments' },
  { id: 'zoom-reset', label: 'Vue entière', icon: '⤢', group: 'Instruments' },
  { id: 'spotlight', label: 'Projecteur', icon: '🔦', group: 'Instruments' },
  { id: 'ruler', label: 'Règle', icon: '📏', group: 'Instruments' },
  { id: 'setsquare', label: 'Équerre', icon: '📐', group: 'Instruments' },
  { id: 'protractor', label: 'Rapporteur', icon: '🧭', group: 'Instruments' },
  { id: 'keyboard', label: 'Clavier', icon: '⌨', group: 'Instruments' },
  { id: 'insert', label: 'Insérer…', icon: '🧩', group: 'Insertion' },
  // Un quartier par élément insérable, pour poser d'un geste la calculatrice ou le minuteur
  ...INSERT_ACTIONS.map((a): PaletteActionDef => ({ id: `insert-${a.id}`, label: a.label, icon: a.icon, group: 'Insertion' })),
  { id: 'library', label: 'Ressources', icon: '📚', group: 'Séance' },
  { id: 'search', label: 'Rechercher', icon: '🔎', group: 'Séance' },
  { id: 'pick', label: 'Tirage au sort', icon: '🎯', group: 'Séance' },
  { id: 'display', label: 'Mode affichage', icon: '🖥', group: 'Séance' },
  { id: 'none', label: '— vide —', icon: '', group: 'Séance', optional: true },
];

export const PALETTE_GROUPS: PaletteGroup[] = ['Outils', 'Couleur et trait', 'Historique', 'Pages', 'Instruments', 'Insertion', 'Séance'];

/** Huit quartiers par défaut : outils d'écriture, retour arrière, couleur, navigation. */
export const DEFAULT_PALETTE_SLOTS: string[] = ['pen', 'highlighter', 'eraser', 'select', 'undo', 'color', 'page-next', 'laser'];

/** Sous-menu « Couleur » : huit teintes nommées, tirées de la palette du sélecteur (`boardPalette.ts`). */
export const RADIAL_COLOR_CHOICES: { hex: string; label: string }[] = [
  { hex: '#111827', label: 'Noir' },
  { hex: '#1D4ED8', label: 'Bleu' },
  { hex: '#DC2626', label: 'Rouge' },
  { hex: '#059669', label: 'Vert' },
  { hex: '#F97316', label: 'Orange' },
  { hex: '#9333EA', label: 'Violet' },
  { hex: '#0EA5E9', label: 'Ciel' },
  { hex: '#6B7280', label: 'Gris' },
];

export interface PaletteConfig {
  slots: string[];
  /** Position de la pastille, en fraction de la scène (0-1), pour survivre aux changements d'écran. */
  x: number;
  y: number;
  hidden: boolean;
}

const KNOWN = new Set(PALETTE_CATALOG.map((a) => a.id));

function sanitizeSlots(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw.map((s) => (s === 'color-cycle' ? 'color' : s)).filter((s): s is string => typeof s === 'string' && KNOWN.has(s))
    : [];
  const out = list.slice(0, PALETTE_SLOTS);
  while (out.length < PALETTE_SLOTS) out.push(DEFAULT_PALETTE_SLOTS[out.length] ?? 'none');
  return out;
}

/** Position par défaut : du côté de la main (à droite si la barre est centrée), assez haut pour que
 *  le menu tienne au-dessus de la barre en 1280×720 sans s'écarter de la pastille. */
export function defaultPalettePosition(hand: 'left' | 'right' | 'center'): { x: number; y: number } {
  return { x: hand === 'left' ? 0.16 : 0.84, y: 0.62 };
}

export function loadPalette(hand: 'left' | 'right' | 'center'): PaletteConfig {
  const pos = defaultPalettePosition(hand);
  const base: PaletteConfig = { slots: [...DEFAULT_PALETTE_SLOTS], x: pos.x, y: pos.y, hidden: false };
  try {
    const raw = JSON.parse(localStorage.getItem(PALETTE_STORAGE_KEY) || 'null') as Partial<PaletteConfig> | null;
    if (!raw || typeof raw !== 'object') return base;
    return {
      slots: sanitizeSlots(raw.slots),
      x: typeof raw.x === 'number' && raw.x >= 0 && raw.x <= 1 ? raw.x : base.x,
      y: typeof raw.y === 'number' && raw.y >= 0 && raw.y <= 1 ? raw.y : base.y,
      hidden: raw.hidden === true,
    };
  } catch {
    return base;
  }
}

export function savePalette(cfg: PaletteConfig): void {
  try { localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(cfg)); } catch { /* stockage indisponible */ }
}

export function paletteAction(id: string): PaletteActionDef | undefined {
  return PALETTE_CATALOG.find((a) => a.id === id);
}

/** Chemin SVG d'un quartier d'anneau (rayons r0 < r1, angles a0 → a1 en radians). Partagé par le menu et son éditeur. */
export function radialArc(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}
