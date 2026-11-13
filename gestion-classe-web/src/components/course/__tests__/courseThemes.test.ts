import { describe, expect, it } from 'vitest';
import { COURSE_THEMES, themeById, themeStyle, withDefaultTheme } from '../courseThemes';
import { emptyCourseDoc } from '../../../lib/course/courseDoc';

describe('thèmes', () => {
  it('Classique : aucune variable (les couleurs d’origine restent les valeurs de repli)', () => {
    expect(themeStyle(undefined)).toEqual({});
    expect(themeStyle('classique')).toEqual({});
  });
  it('thème inconnu : Classique', () => {
    expect(themeById('nimporte').id).toBe('classique');
  });
  it('chaque autre thème pose toutes les couleurs', () => {
    for (const t of COURSE_THEMES.filter((x) => x.id !== 'classique')) {
      const v = themeStyle(t.id) as Record<string, string>;
      for (const k of ['--ce-h1', '--ce-h2', '--ce-h3', '--ce-def-bg', '--ce-ret-line', '--ce-con-ink', '--ce-ex-line']) expect(v[k]).toMatch(/^#/);
    }
  });
  it('Écolier : titres en écriture attachée', () => {
    expect((themeStyle('ecolier') as Record<string, string>)['--ce-head-font']).toContain('Playwrite FR Moderne');
  });
  it('sans thème par défaut enregistré : le nouveau cours ne change pas', () => {
    const doc = emptyCourseDoc();
    expect(withDefaultTheme(doc)).toBe(doc);
  });
});
