import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { pickLessonGroup } from '../lessonGroup';

// Mardi 1/12 : 3°AP2 à 13h40, 3°AP1 à 14h40 (heure de Paris = UTC+1)
const lessons = [
  { label: '3°AP2', starts_at: '2026-12-01T12:40:00.000Z' },
  { label: '3°AP1', starts_at: '2026-12-01T13:40:00.000Z' },
  { label: '4D', starts_at: '2026-12-01T13:40:00.000Z' },
];
const links = [
  { label: '3°AP1', class_id: 'c3a', group_id: 'g1', ignored: false },
  { label: '3°AP2', class_id: 'c3a', group_id: 'g2', ignored: false },
  { label: '4D', class_id: 'c4d', group_id: null, ignored: false },
];

describe('pickLessonGroup', () => {
  it('prend le demi-groupe du cours qui commence dans quelques minutes', () => {
    expect(pickLessonGroup(lessons, links, 'c3a', new Date('2026-12-01T12:36:00.000Z'))?.groupId).toBe('g2');
    expect(pickLessonGroup(lessons, links, 'c3a', new Date('2026-12-01T13:38:00.000Z'))?.groupId).toBe('g1');
  });

  it('renvoie un groupe null pour un cours en classe entière', () => {
    expect(pickLessonGroup(lessons, links, 'c4d', new Date('2026-12-01T13:42:00.000Z'))).toEqual({
      label: '4D', groupId: null, startsAt: '2026-12-01T13:40:00.000Z',
    });
  });

  it('ne trouve rien hors de la fenêtre, pour une autre classe ou un libellé ignoré', () => {
    expect(pickLessonGroup(lessons, links, 'c3a', new Date('2026-12-01T09:00:00.000Z'))).toBeNull();
    expect(pickLessonGroup(lessons, links, 'c5e', new Date('2026-12-01T12:40:00.000Z'))).toBeNull();
    expect(pickLessonGroup(lessons, [{ ...links[1], ignored: true }], 'c3a', new Date('2026-12-01T12:40:00.000Z'))).toBeNull();
  });

  it('oublie un groupe qui n’existe plus dans la classe', () => {
    const at = new Date('2026-12-01T12:40:00.000Z');
    expect(pickLessonGroup(lessons, links, 'c3a', at, ['g1'])?.groupId).toBeNull();
  });
});
