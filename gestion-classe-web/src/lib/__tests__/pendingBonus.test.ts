import { describe, expect, it } from 'vitest';
import { pendingBonusByStudent, type BonusSelectionRow } from '../pendingBonus';

const row = (over: Partial<BonusSelectionRow>): BonusSelectionRow => ({
  id: 'b1', student_id: 's1', used_at: null, selected_at: '2026-11-20T10:00:00Z', label: 'Joker devoir', ...over,
});

describe('pendingBonusByStudent', () => {
  it('garde un bonus choisi et pas encore accordé', () => {
    const m = pendingBonusByStudent([row({})]);
    expect(m.get('s1')).toEqual({ id: 'b1', label: 'Joker devoir', others: 0 });
  });

  it('ignore un bonus déjà accordé', () => {
    const m = pendingBonusByStudent([row({ used_at: '2026-11-21T10:00:00Z' })]);
    expect(m.has('s1')).toBe(false);
  });

  it('propose le plus ancien d’abord et compte les suivants', () => {
    const m = pendingBonusByStudent([
      row({ id: 'b2', selected_at: '2026-11-25T10:00:00Z', label: 'Place au choix' }),
      row({ id: 'b1', selected_at: '2026-11-20T10:00:00Z' }),
    ]);
    expect(m.get('s1')).toEqual({ id: 'b1', label: 'Joker devoir', others: 1 });
  });

  it('sépare les élèves', () => {
    const m = pendingBonusByStudent([row({}), row({ id: 'b3', student_id: 's2', label: 'DJ' })]);
    expect(m.get('s2')?.label).toBe('DJ');
    expect(m.size).toBe(2);
  });
});
