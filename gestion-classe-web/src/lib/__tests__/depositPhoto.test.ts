import { describe, expect, it } from 'vitest';
import { DEPOSIT_STEPS, fitInside, formatBytes } from '../depositPhoto';

describe('fitInside', () => {
  it('ramène le plus grand côté, en gardant les proportions', () => {
    expect(fitInside(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitInside(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
  it("n'agrandit jamais une petite photo", () => {
    expect(fitInside(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('formatBytes', () => {
  it('écrit les tailles à la française', () => {
    expect(formatBytes(7.8 * 1024 * 1024)).toBe('7,8 Mo');
    expect(formatBytes(640 * 1024)).toBe('640 ko');
  });
});

describe('DEPOSIT_STEPS', () => {
  it('va du plus grand au plus petit', () => {
    for (let i = 1; i < DEPOSIT_STEPS.length; i++) {
      const a = DEPOSIT_STEPS[i - 1];
      const b = DEPOSIT_STEPS[i];
      expect(b.side * b.quality).toBeLessThan(a.side * a.quality);
    }
  });
});
