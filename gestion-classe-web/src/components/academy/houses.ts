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
    name: 'Gryffondor',
    element: 'Feu',
    motto: 'Audentes fortuna iuvat',
    mottoFr: 'La fortune sourit aux audacieux',
    virtue: 'Le Courage',
    c1: 'var(--flamme-1)',
    c2: 'var(--flamme-2)',
    cInk: 'var(--flamme-ink)',
    cInkLight: 'oklch(0.62 0.16 30)',
    description: 'Où règnent le courage et la bravoure. Cœur vaillant, parole franche, audace à l\'épreuve du feu.',
  },
  vouivre: {
    id: 'vouivre',
    name: 'Serpentard',
    element: 'Eau',
    motto: 'Per ambages ad astra',
    mottoFr: 'Par les détours jusqu\'aux étoiles',
    virtue: 'L\'Ambition',
    c1: 'var(--onde-1)',
    c2: 'var(--onde-2)',
    cInk: 'var(--onde-ink)',
    cInkLight: 'oklch(0.48 0.12 168)',
    description: 'Où règnent la ruse et l\'ambition. Patience, stratégie, mémoire longue comme un fleuve.',
  },
  zephyr: {
    id: 'zephyr',
    name: 'Serdaigle',
    element: 'Air',
    motto: 'Mens volans',
    mottoFr: 'L\'esprit qui s\'envole',
    virtue: 'Le Savoir',
    c1: 'var(--souffle-1)',
    c2: 'var(--souffle-2)',
    cInk: 'var(--souffle-ink)',
    cInkLight: 'oklch(0.52 0.12 248)',
    description: 'Où règnent la sagesse et l\'érudition. Intelligence aérienne, curiosité sans borne.',
  },
  taisson: {
    id: 'taisson',
    name: 'Poufsouffle',
    element: 'Terre',
    motto: 'Fidelis terra',
    mottoFr: 'Fidèle comme la terre',
    virtue: 'La Loyauté',
    c1: 'var(--glebe-1)',
    c2: 'var(--glebe-2)',
    cInk: 'var(--glebe-ink)',
    cInkLight: 'oklch(0.60 0.14 82)',
    description: 'Où règnent la loyauté et le travail. Parole tenue, camaraderie indéfectible.',
  },
};

export const HOUSE_LIST: HouseData[] = [
  HOUSE_DATA.salamandre,
  HOUSE_DATA.vouivre,
  HOUSE_DATA.zephyr,
  HOUSE_DATA.taisson,
];
