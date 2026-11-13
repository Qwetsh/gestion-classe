import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINT_OPTIONS, TWO_UP_SCALE, printClasses } from '../coursePrint';

describe('options d’impression', () => {
  it('version normale en couleur : aucune classe (impression comme avant)', () => {
    expect(printClasses(DEFAULT_PRINT_OPTIONS)).toEqual([]);
  });
  it('toutes les options', () => {
    expect(printClasses({ version: 'adapted', twoUp: true, color: 'bw' })).toEqual(['ce-print-adapted', 'ce-print-bw', 'ce-print-twoup']);
    expect(printClasses({ version: 'normal', twoUp: false, color: 'eco' })).toEqual(['ce-print-eco']);
  });
  it('A4 réduit en A5 : 210 mm de large deviennent 148,5 mm', () => {
    expect(210 * TWO_UP_SCALE).toBeCloseTo(148.5, 1);
  });
});
