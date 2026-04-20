import type { HouseId } from '../../lib/academyQueries';

export interface HouseData {
  id: HouseId;
  name: string;
  element: string;
  motto: string;
  mottoFr: string;
  virtue: string;
  c1: string;
  c2: string;
  cInk: string;
  cInkLight: string;
  description: string;
}

export const HOUSE_DATA: Record<HouseId, HouseData> = {
  salamandre: {
    id: 'salamandre',
    name: 'Salamandre',
    element: 'Flamme',
    motto: 'Ardere sine timore',
    mottoFr: 'Brûler sans crainte',
    virtue: 'Le Courage',
    c1: 'var(--flamme-1)',
    c2: 'var(--flamme-2)',
    cInk: 'var(--flamme-ink)',
    cInkLight: 'oklch(0.62 0.16 30)',
    description: 'Enfants des braises. Cœur vaillant, parole franche, audace à l\'épreuve du feu.',
  },
  vouivre: {
    id: 'vouivre',
    name: 'Vouivre',
    element: 'Onde',
    motto: 'Per ambages ad astra',
    mottoFr: 'Par les détours jusqu\'aux étoiles',
    virtue: 'L\'Astuce',
    c1: 'var(--onde-1)',
    c2: 'var(--onde-2)',
    cInk: 'var(--onde-ink)',
    cInkLight: 'oklch(0.48 0.12 168)',
    description: 'Filles des eaux profondes. Patience, stratégie, mémoire longue comme un fleuve.',
  },
  zephyr: {
    id: 'zephyr',
    name: 'Zéphyr',
    element: 'Souffle',
    motto: 'Mens volans',
    mottoFr: 'L\'esprit qui s\'envole',
    virtue: 'Le Savoir',
    c1: 'var(--souffle-1)',
    c2: 'var(--souffle-2)',
    cInk: 'var(--souffle-ink)',
    cInkLight: 'oklch(0.52 0.12 248)',
    description: 'Voix du vent. Intelligence aérienne, curiosité sans borne, idées qui traversent les murs.',
  },
  taisson: {
    id: 'taisson',
    name: 'Taisson',
    element: 'Glèbe',
    motto: 'Fidelis terra',
    mottoFr: 'Fidèle comme la terre',
    virtue: 'La Loyauté',
    c1: 'var(--glebe-1)',
    c2: 'var(--glebe-2)',
    cInk: 'var(--glebe-ink)',
    cInkLight: 'oklch(0.60 0.14 82)',
    description: 'Gardiens des racines. Travail constant, parole tenue, camaraderie indéfectible.',
  },
};

export const HOUSE_LIST: HouseData[] = [
  HOUSE_DATA.salamandre,
  HOUSE_DATA.vouivre,
  HOUSE_DATA.zephyr,
  HOUSE_DATA.taisson,
];
