/**
 * Palette de couleurs du tableau blanc et mémoire des couleurs récentes.
 * Séparé du composant pour que le rechargement à chaud reste possible.
 */

import { SWATCHES } from './boardSwatches';

/** Palette complète par défaut : noir, gris, puis teintes utiles en classe (sang, veines, chlorophylle…). */
export const BOARD_PALETTE: readonly string[] = SWATCHES.palette.defaults;
/** Pastilles toujours visibles dans la barre (défauts ; les pastilles se personnalisent au clic droit). */
export const QUICK_COLORS: readonly string[] = SWATCHES.quick.defaults;

const RECENT_KEY = 'classroom-board-recent-colors';
const MAX_RECENT = 6;

export function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((c): c is string => typeof c === 'string').slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

export function pushRecentColor(color: string): string[] {
  const next = [color, ...loadRecentColors().filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  return next;
}
