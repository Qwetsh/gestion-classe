/**
 * Palette de couleurs du tableau blanc et mémoire des couleurs récentes.
 * Séparé du composant pour que le rechargement à chaud reste possible.
 */

/** Palette complète : noir, gris, puis teintes utiles en classe (sang, veines, chlorophylle…). */
export const BOARD_PALETTE = [
  '#111827', '#6B7280', '#FFFFFF', '#1D4ED8', '#0EA5E9', '#0D9488', '#059669', '#65A30D',
  '#CA8A04', '#F97316', '#DC2626', '#DB2777', '#9333EA', '#7C3AED', '#92400E', '#F5D0A9',
];
/** Pastilles toujours visibles dans la barre. */
export const QUICK_COLORS = ['#111827', '#1D4ED8', '#DC2626', '#059669'];

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
