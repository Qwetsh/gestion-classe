import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { placementChips, type Placement } from '../coursePlacements';

const classes = [
  { id: 'c4a', name: '4A' },
  { id: 'c4b', name: '4B' },
  { id: 'c4d', name: '4D' },
];

const placement = (boardId: string, sourceBoardId: string, classId: string | null, iso: string, label = '4X'): Placement => ({
  boardId, sourceBoardId, classId, startsAt: new Date(iso), label,
});

const now = new Date('2026-11-18T12:00:00');

describe('placementChips', () => {
  it('donne une pastille par classe, triée par nom', () => {
    const chips = placementChips([
      placement('b3', 'orig', 'c4d', '2026-11-18T10:15:00'),
      placement('b1', 'orig', 'c4a', '2026-11-18T08:15:00'),
      placement('b2', 'orig', 'c4b', '2026-11-20T08:15:00'),
    ], classes, now);
    expect(chips.get('orig')?.map((c) => c.name)).toEqual(['4A', '4B', '4D']);
  });

  it('range chaque copie sous son original', () => {
    const chips = placementChips([
      placement('b1', 'fiche', 'c4a', '2026-11-18T08:15:00'),
      placement('b2', 'correction', 'c4a', '2026-11-25T08:15:00'),
    ], classes, now);
    expect(chips.get('fiche')?.map((c) => c.boardId)).toEqual(['b1']);
    expect(chips.get('correction')?.map((c) => c.boardId)).toEqual(['b2']);
  });

  it('mène au prochain cours de la classe, celui du jour compris', () => {
    const chips = placementChips([
      placement('passe', 'orig', 'c4a', '2026-11-10T08:15:00'),
      placement('ce-matin', 'orig', 'c4a', '2026-11-18T08:15:00'),
      placement('plus-tard', 'orig', 'c4a', '2026-11-25T08:15:00'),
    ], classes, now);
    const chip = chips.get('orig')![0];
    expect(chip.boardId).toBe('ce-matin');
    expect(chip.dates).toHaveLength(3);
  });

  it('mène au dernier cours passé quand il n’y en a plus à venir', () => {
    const chips = placementChips([
      placement('ancien', 'orig', 'c4a', '2026-11-03T08:15:00'),
      placement('recent', 'orig', 'c4a', '2026-11-10T08:15:00'),
    ], classes, now);
    expect(chips.get('orig')![0].boardId).toBe('recent');
  });

  it('garde le libellé du cours quand la classe est inconnue ou supprimée', () => {
    const chips = placementChips([
      placement('b1', 'orig', null, '2026-11-20T08:15:00', '3°EP1'),
      placement('b2', 'orig', 'disparue', '2026-11-20T10:15:00', '5C'),
    ], classes, now);
    expect(chips.get('orig')?.map((c) => c.name)).toEqual(['3°EP1', '5C']);
  });

  it('ne rend rien pour un original sans copie', () => {
    expect(placementChips([], classes, now).get('orig')).toBeUndefined();
  });
});
