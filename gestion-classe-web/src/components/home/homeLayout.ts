/**
 * Modèle de disposition de l'accueil : grille 12 colonnes, coordonnées {x, y, w, h}.
 * Volontairement identique au format de react-grid-layout, qui prendra le relais au lot 2
 * (cf. PLAN_accueil_modulaire.md).
 */

export const HOME_COLUMNS = 12;

/** Hauteur d'une rangée, en pixels — la hauteur d'un module vaut h * ROW + (h - 1) * GAP */
export const HOME_ROW_HEIGHT = 8;
export const HOME_GAP = 12;

export interface HomeLayoutItem {
  /** identifiant du module dans le registre */
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HomeLayout {
  version: number;
  items: HomeLayoutItem[];
  /** modules volontairement retirés par l'utilisateur */
  hidden: string[];
}

export const HOME_LAYOUT_VERSION = 1;

/** Disposition livrée par défaut : reprend la page d'accueil dessinée le 23/09/2026. */
export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  version: HOME_LAYOUT_VERSION,
  hidden: [],
  items: [
    { i: 'quick-actions',   x: 0, y: 0,  w: 12, h: 5 },
    { i: 'kpi-implication', x: 0, y: 5,  w: 4,  h: 7 },
    { i: 'kpi-alerts',      x: 4, y: 5,  w: 4,  h: 7 },
    { i: 'kpi-sessions',    x: 8, y: 5,  w: 4,  h: 7 },
    { i: 'student-alerts',  x: 0, y: 12, w: 8,  h: 20 },
    { i: 'next-lesson',     x: 8, y: 12, w: 4,  h: 10 },
    { i: 'class-averages',  x: 8, y: 22, w: 4,  h: 18 },
    { i: 'recent-sessions', x: 0, y: 32, w: 8,  h: 21 },
    { i: 'boards',          x: 8, y: 40, w: 4,  h: 22 },
    { i: 'timetable',       x: 0, y: 53, w: 8,  h: 7 },
  ],
};

/** Hauteur en pixels d'un module de h rangées. */
export function itemPixelHeight(h: number): number {
  return h * HOME_ROW_HEIGHT + (h - 1) * HOME_GAP;
}

function collides(a: HomeLayoutItem, b: HomeLayoutItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Compactage vertical : chaque module remonte tant qu'il ne heurte rien.
 * C'est l'algorithme qu'applique react-grid-layout ; on le refait ici pour que
 * la grille reste sans trou quand un module est masqué ou indisponible.
 */
export function compactLayout(items: HomeLayoutItem[]): HomeLayoutItem[] {
  const sorted = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const placed: HomeLayoutItem[] = [];

  for (const item of sorted) {
    const moved = { ...item };
    while (moved.y > 0) {
      const candidate = { ...moved, y: moved.y - 1 };
      if (placed.some(p => collides(candidate, p))) break;
      moved.y = candidate.y;
    }
    placed.push(moved);
  }

  return placed;
}

/** Ordre de lecture (haut→bas, gauche→droite), utilisé pour l'aplatissement mobile. */
export function readingOrder(items: HomeLayoutItem[]): HomeLayoutItem[] {
  return [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/**
 * Fusionne une disposition enregistrée avec les modules connus :
 * - les modules inconnus du registre sont ignorés (module retiré du code) ;
 * - les modules absents de la disposition et non masqués sont ajoutés en bas
 *   (module ajouté par une mise à jour) ;
 * - une disposition d'une version antérieure est remplacée par les défauts.
 */
export function mergeLayout(
  saved: HomeLayout | null,
  knownIds: string[],
  defaults: HomeLayout = DEFAULT_HOME_LAYOUT,
): HomeLayout {
  if (!saved || saved.version !== HOME_LAYOUT_VERSION) {
    return {
      version: HOME_LAYOUT_VERSION,
      hidden: [],
      items: defaults.items.filter(it => knownIds.includes(it.i)).map(it => ({ ...it })),
    };
  }

  const known = new Set(knownIds);
  const hidden = saved.hidden.filter(id => known.has(id));
  const items = saved.items.filter(it => known.has(it.i) && !hidden.includes(it.i)).map(it => ({ ...it }));

  const placed = new Set(items.map(it => it.i));
  let nextY = items.reduce((max, it) => Math.max(max, it.y + it.h), 0);

  for (const id of knownIds) {
    if (placed.has(id) || hidden.includes(id)) continue;
    const fallback = defaults.items.find(it => it.i === id);
    items.push({
      i: id,
      x: 0,
      y: nextY,
      w: fallback?.w ?? 4,
      h: fallback?.h ?? 6,
    });
    nextY += fallback?.h ?? 6;
  }

  return { version: HOME_LAYOUT_VERSION, hidden, items: compactLayout(items) };
}
