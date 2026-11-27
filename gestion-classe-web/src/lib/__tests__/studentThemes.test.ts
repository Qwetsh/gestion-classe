import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREE_THEME_RIGHTS, STAMPS_PER_THEME, canEarnTheme, goalFor, goalRatio, isThemeUnlocked, parseThemeRights, themeGoal, themeRightsError, themeToApply } from '../studentThemeUnlocks';
import { DEFAULT_STUDENT_THEME, STUDENT_THEMES, STUDENT_THEME_GROUPS, isStudentTheme, readStudentTheme, saveStudentTheme, studentTheme, studentThemeFontUrl } from '../studentThemes';

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

  it('range chaque thème dans une famille de l’écran « Mon thème », sans famille vide', () => {
    const groups = STUDENT_THEME_GROUPS.map((g) => g.id);
    for (const t of STUDENT_THEMES) expect(groups, `${t.id} : famille inconnue`).toContain(t.group);
    for (const g of groups) expect(STUDENT_THEMES.some((t) => t.group === g), `${g} : famille vide`).toBe(true);
    expect(new Set(STUDENT_THEMES.map((t) => t.id)).size).toBe(STUDENT_THEMES.length);
  });

  it('range les thèmes dans les mêmes familles de déblocage que la base', () => {
    // La dernière migration qui définit _student_theme_kind fait foi
    const dir = join(__dirname, '..', '..', '..', '..', 'supabase-migrations');
    const file = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().reverse()
      .find((f) => readFileSync(join(dir, f), 'utf8').includes('function public._student_theme_kind'));
    expect(file, 'migration des thèmes introuvable').toBeTruthy();
    const sql = readFileSync(join(dir, file ?? ''), 'utf8');
    const body = sql.slice(sql.indexOf('function public._student_theme_kind'));
    for (const kind of ['free', 'class', 'card'] as const) {
      const listed = new RegExp(`when p_theme in \\(([^)]*)\\) then '${kind}'`).exec(body)?.[1] ?? '';
      const inBase = [...listed.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
      expect(inBase, `famille ${kind}`).toEqual(STUDENT_THEMES.filter((t) => t.unlock === kind).map((t) => t.id).sort());
    }
  });

  it('n’ouvre que les thèmes libres tant que le serveur n’a pas répondu', () => {
    expect(FREE_THEME_RIGHTS.free).toHaveLength(6);
    expect(isThemeUnlocked(FREE_THEME_RIGHTS, 'cosmos')).toBe(true);
    expect(isThemeUnlocked(FREE_THEME_RIGHTS, 'volcan')).toBe(false);
    expect(isThemeUnlocked(FREE_THEME_RIGHTS, DEFAULT_STUDENT_THEME)).toBe(true);
  });

  it('relit la réponse du serveur sans lui faire confiance', () => {
    expect(parseThemeRights({ error: 'not_found' })).toBeNull();
    expect(parseThemeRights(null)).toBeNull();
    const rights = parseThemeRights({ free: ['carnet', 'cosmos'], opened: ['volcan', 'licorne'], earned: ['savane'], credits: '2', chosen: 'licorne' });
    expect(rights).toEqual({ free: ['carnet', 'cosmos'], opened: ['volcan'], earned: ['savane'], credits: 2, chosen: null });
    expect(themeRightsError({ error: 'locked', free: [] })).toBe('locked');
    expect(themeRightsError({ free: [] })).toBeNull();
  });

  it('ne propose de débloquer qu’un thème « à gagner », fermé, quand il reste un thème à choisir', () => {
    const rights = { free: FREE_THEME_RIGHTS.free, opened: ['volcan' as const, 'ruche' as const], earned: ['savane' as const], credits: 1, chosen: null };
    expect(canEarnTheme(rights, 'abysses')).toBe(true);
    expect(canEarnTheme(rights, 'savane')).toBe(false); // déjà gagné
    expect(canEarnTheme(rights, 'ruche')).toBe(false); // déjà ouvert à la classe
    expect(canEarnTheme(rights, 'adn')).toBe(false); // thème de cours : seul le professeur l'ouvre
    expect(canEarnTheme({ ...rights, credits: 0 }, 'abysses')).toBe(false);
  });

  it('choisit le thème à afficher à la connexion', () => {
    const rights = { free: FREE_THEME_RIGHTS.free, opened: ['volcan' as const], earned: [], credits: 0, chosen: null };
    expect(themeToApply({ ...rights, chosen: 'volcan' }, 'jungle', 'carnet')).toBe('volcan'); // le serveur d'abord
    expect(themeToApply(rights, 'jungle', 'carnet')).toBe('jungle'); // sinon l'appareil, s'il y a droit
    expect(themeToApply(rights, 'savane', 'carnet')).toBe('carnet'); // un thème fermé ne s'affiche pas
  });

  it('a une vignette de son décor pour chaque thème', () => {
    const dir = join(__dirname, '..', '..', 'themes-eleve');
    const missing = STUDENT_THEMES.filter((t) => !existsSync(join(dir, t.id, 'vignette.webp'))).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('annonce le défi d’un thème fermé d’après sa famille', () => {
    expect(themeGoal({ unlock: 'free' }, 4)).toBeNull();
    expect(themeGoal({ unlock: 'class' }, 4)).toMatchObject({ kind: 'class', label: 'Avec le cours' });
    const stamps = themeGoal({ unlock: 'card' }, 7);
    expect(stamps).toMatchObject({ kind: 'stamps', progress: { value: 7, target: STAMPS_PER_THEME } });
    expect(stamps && goalRatio(stamps)).toBeCloseTo(0.7);
    // Une classe sans tampons : le défi reste dit, sans progression
    expect(themeGoal({ unlock: 'card' }, null)?.progress).toBeUndefined();
    // Une carte pleine a déjà donné son thème : la barre repart de zéro vers le suivant
    expect(themeGoal({ unlock: 'card' }, STAMPS_PER_THEME)?.progress?.value).toBe(0);
    expect(themeGoal({ unlock: 'card' }, 14)?.progress?.value).toBe(4);
  });

  it('prend le défi décrit par le serveur quand il y en a un, et écarte ce qu’il ne comprend pas', () => {
    const rights = parseThemeRights({
      free: ['carnet'], opened: [], earned: [], credits: 0, chosen: null,
      goals: {
        savane: { kind: 'grade', label: 'Un 15 ou plus', detail: 'Obtiens 15 sur 20.', progress: { value: 13.5, target: 15, unit: '' } },
        ruche: { kind: 'licorne', label: 'x', detail: 'y' },
        licorne: { kind: 'grade', label: 'x', detail: 'y' },
        abysses: { kind: 'grade', label: 'Un 20', detail: 'Obtiens 20 sur 20.', progress: { value: 12, target: 0 } },
      },
    });
    expect(Object.keys(rights?.goals ?? {}).sort()).toEqual(['abysses', 'savane']);
    expect(rights?.goals?.abysses?.progress).toBeUndefined();
    const savane = rights && goalFor(rights, studentTheme('savane'), 3);
    expect(savane).toMatchObject({ kind: 'grade', label: 'Un 15 ou plus' });
    expect(savane && goalRatio(savane)).toBeCloseTo(0.9);
    // Sans défi du serveur : celui de la famille
    expect(rights && goalFor(rights, studentTheme('ruche'), 3)).toMatchObject({ kind: 'stamps', progress: { value: 3 } });
  });

  it('ne charge une police que pour les thèmes qui en ont une', () => {
    expect(studentThemeFontUrl(studentTheme('carnet'))).toBeNull();
    expect(studentThemeFontUrl(studentTheme('cosmos'))).toContain('fonts.googleapis.com');
  });
});
