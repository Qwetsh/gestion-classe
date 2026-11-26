import { describe, expect, it } from 'vitest';
import { DEFAULT_STUDENT_THEME, STUDENT_THEMES, isStudentTheme, readStudentTheme, saveStudentTheme, studentTheme, studentThemeFontUrl } from '../studentThemes';

/** Stockage de navigateur en mémoire. */
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
  };
}

/** Contraste WCAG entre deux couleurs `#RRGGBB`. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('thèmes de l’espace élève', () => {
  it('part du thème Carnet quand rien n’est gardé', () => {
    expect(readStudentTheme(memoryStore())).toBe(DEFAULT_STUDENT_THEME);
    expect(readStudentTheme(null)).toBe(DEFAULT_STUDENT_THEME);
  });

  it('relit le thème gardé sur l’appareil', () => {
    const store = memoryStore();
    saveStudentTheme('arcade', store);
    expect(readStudentTheme(store)).toBe('arcade');
  });

  it('ignore une valeur inconnue (thème retiré, stockage trafiqué)', () => {
    expect(readStudentTheme(memoryStore({ 'gc-eleve-theme': 'licorne' }))).toBe(DEFAULT_STUDENT_THEME);
    expect(isStudentTheme('cosmos')).toBe(true);
    expect(isStudentTheme(42)).toBe(false);
  });

  it('ne casse pas si le stockage refuse', () => {
    const broken = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('plein'); } };
    expect(readStudentTheme(broken)).toBe(DEFAULT_STUDENT_THEME);
    expect(() => saveStudentTheme('jungle', broken)).not.toThrow();
  });

  it('garde un texte lisible dans l’aperçu de chaque thème', () => {
    for (const t of STUDENT_THEMES) {
      expect(contrast(t.text, t.bg), `${t.id} : texte sur le fond`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.text, t.surface), `${t.id} : texte sur une carte`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, t.surface), `${t.id} : accent sur une carte`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('ne charge une police que pour les thèmes qui en ont une', () => {
    expect(studentThemeFontUrl(studentTheme('carnet'))).toBeNull();
    expect(studentThemeFontUrl(studentTheme('cosmos'))).toContain('fonts.googleapis.com');
  });
});
