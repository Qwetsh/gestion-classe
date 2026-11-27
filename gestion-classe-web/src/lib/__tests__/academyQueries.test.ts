import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { planAnswerSync } from '../academyQueries';

describe('planAnswerSync', () => {
  const existing = [
    { id: 'c', display_order: 3 },
    { id: 'a', display_order: 1 },
    { id: 'b', display_order: 2 },
    { id: 'd', display_order: 4 },
  ];

  it('met à jour sur place chaque réponse existante, dans l’ordre d’affichage', () => {
    const plan = planAnswerSync(existing, ['A', 'B', 'C', 'D']);
    expect(plan.updates).toEqual([
      { id: 'a', answer: 'A' },
      { id: 'b', answer: 'B' },
      { id: 'c', answer: 'C' },
      { id: 'd', answer: 'D' },
    ]);
    expect(plan.inserts).toEqual([]);
    expect(plan.deleteIds).toEqual([]);
  });

  it('crée toutes les réponses d’une nouvelle question', () => {
    const plan = planAnswerSync([], ['A', 'B']);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual(['A', 'B']);
    expect(plan.deleteIds).toEqual([]);
  });

  it('ne retire que les réponses en trop', () => {
    const plan = planAnswerSync(existing, ['A', 'B']);
    expect(plan.updates.map(u => u.id)).toEqual(['a', 'b']);
    expect(plan.deleteIds).toEqual(['c', 'd']);
  });

  it('ajoute les réponses en plus', () => {
    const plan = planAnswerSync(existing.slice(0, 2), ['A', 'B', 'C']);
    expect(plan.updates.map(u => u.id)).toEqual(['a', 'c']);
    expect(plan.inserts).toEqual(['C']);
  });
});
