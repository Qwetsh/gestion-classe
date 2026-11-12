import { describe, expect, it } from 'vitest';
import { animatedCorrectionLabel, animatedCorrectionToast, hasAnimatedCorrection } from '../animatedCorrection';

describe('correction animée de l’hôpital', () => {
  it('ne concerne que les patients de l’hôpital', () => {
    expect(hasAnimatedCorrection('hopital-yve-apabien')).toBe(true);
    expect(hasAnimatedCorrection('hopital-eve-amalle')).toBe(true);
    expect(hasAnimatedCorrection('svt-digestion')).toBe(false);
    expect(hasAnimatedCorrection('mon-hopital-x')).toBe(false);
    expect(hasAnimatedCorrection('')).toBe(false);
    expect(hasAnimatedCorrection(null)).toBe(false);
    expect(hasAnimatedCorrection(undefined)).toBe(false);
  });

  it('dit pour quelle classe elle est ouverte ou fermée', () => {
    expect(animatedCorrectionLabel(true, '4eB')).toBe('Correction animée (Docteur Morel) : ouverte pour la 4eB');
    expect(animatedCorrectionLabel(false, '4eB')).toBe('Correction animée (Docteur Morel) : fermée pour la 4eB');
    expect(animatedCorrectionLabel(false, '')).toBe('Correction animée (Docteur Morel) : choisis une classe');
    expect(animatedCorrectionToast(true, '4eB')).toBe('Correction animée ouverte pour la 4eB.');
    expect(animatedCorrectionToast(false, '4eB')).toBe('Correction animée fermée pour la 4eB.');
  });
});
