import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_SESSION_MS, classroomUrl } from '../activeSession';

describe('écran de classe', () => {
  it('mène à /classe, avec le tableau du cours quand on le connaît', () => {
    expect(classroomUrl()).toBe('/classe');
    expect(classroomUrl(null)).toBe('/classe');
    expect(classroomUrl('3b7b90be-6373-4efc-8b9b-14d4cde35e61')).toBe('/classe?board=3b7b90be-6373-4efc-8b9b-14d4cde35e61');
  });

  it('ne prend pas pour « en cours » une séance de plus de six heures', () => {
    expect(MAX_ACTIVE_SESSION_MS).toBe(6 * 60 * 60 * 1000);
  });
});
