import { describe, expect, it } from 'vitest';
import { PUBLICATION_LABEL, publicationState } from '../assessmentGroups';

describe('publication en deux temps (migration 064)', () => {
  it('distingue rien, les notes seules, et tout', () => {
    expect(publicationState({ published_to_students: false })).toBe('none');
    expect(publicationState({ published_to_students: false, corrections_withheld: true })).toBe('none');
    expect(publicationState({ published_to_students: true, corrections_withheld: true })).toBe('notes');
    expect(publicationState({ published_to_students: true, corrections_withheld: false })).toBe('all');
    // Base sans la migration : la colonne manque, la publication montre tout comme avant.
    expect(publicationState({ published_to_students: true })).toBe('all');
    expect(PUBLICATION_LABEL.notes).toMatch(/corrections retenues/);
  });
});
