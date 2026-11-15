import { describe, expect, it } from 'vitest';
import { filterTps, formatPoints, groupTps, templatesForClass, themeShortName, themesOf, totalPoints, tpChaptersOfLevel, tpSearchWords } from '../tpLibrary';

const tp = (name: string, level: string | null, chapter: string | null, extra: Partial<{ theme: string; materials: string[]; problem: string }> = {}) =>
  ({ name, level, chapter, theme: extra.theme ?? null, materials: extra.materials ?? [], problem: extra.problem ?? null });

describe('groupTps', () => {
  it('range niveau › séquence › TP dans l\'ordre du collège', () => {
    const levels = groupTps([
      tp('Sardine', '5e', 'Séquence 4 — Nutrition des animaux'),
      tp('Cœur', '5e', 'Séquence 4 — Nutrition des animaux'),
      tp('Convection', '4e', 'Séquence 10 — Fin'),
      tp('Puzzle', '4e', 'Séquence 2 — Terre en mouvement'),
      tp('Ancien', null, null),
      tp('Libre', '4e', null),
    ]);
    expect(levels.map((l) => l.level)).toEqual(['5e', '4e', null]);
    expect(levels[0].sequences[0].items.map((t) => t.name)).toEqual(['Cœur', 'Sardine']);
    expect(levels[1].sequences.map((s) => s.chapter)).toEqual(['Séquence 2 — Terre en mouvement', 'Séquence 10 — Fin', '']);
    expect(levels[1].count).toBe(3);
  });

  it('traite un niveau vide comme sans niveau', () => {
    expect(groupTps([tp('A', '', null)])[0].level).toBeNull();
  });
});

describe('recherche', () => {
  const list = [
    tp('Dissection de la sardine', '5e', 'Séquence 4 — Nutrition', { materials: ['Ciseaux fins'], theme: 'Le corps humain et la santé' }),
    tp('Roches et acide', '4e', 'Séquence 1 — Planète active', { theme: 'La planète Terre, l\'environnement et l\'action humaine' }),
  ];
  it('cherche sans accents dans le nom, la séquence et le matériel', () => {
    expect(filterTps(list, tpSearchWords('séquence 1'))).toHaveLength(1);
    expect(filterTps(list, tpSearchWords('CISEAUX'))).toHaveLength(1);
    expect(filterTps(list, tpSearchWords('roches planete'))).toHaveLength(1);
    expect(filterTps(list, tpSearchWords('a'))).toHaveLength(2);
  });
  it('filtre par thème (nom court)', () => {
    expect(filterTps(list, [], 'Planète Terre').map((t) => t.name)).toEqual(['Roches et acide']);
  });
});

describe('thèmes', () => {
  it('reconnaît les thèmes du programme, même mal écrits', () => {
    expect(themeShortName('Corps Humaine et santé')).toBe('Corps humain et santé');
    expect(themeShortName('Anatomie')).toBe('Anatomie');
  });
  it('liste les thèmes dans l\'ordre du programme', () => {
    expect(themesOf([tp('a', null, null, { theme: 'Anatomie' }), tp('b', null, null, { theme: 'Le corps humain et la santé' }), tp('c', null, null, { theme: 'Le vivant et son évolution' })]))
      .toEqual(['Le vivant', 'Corps humain et santé', 'Anatomie']);
  });
});

describe('templatesForClass', () => {
  const templates = [{ level: '5e' }, { level: '4e' }, { level: null }];
  it('garde le niveau de la classe et les modèles sans niveau', () => {
    expect(templatesForClass(templates, '5B')).toEqual([{ level: '5e' }, { level: null }]);
  });
  it('rend tout si la classe n\'a pas de niveau ou aucun modèle de son niveau', () => {
    expect(templatesForClass(templates, 'Club')).toHaveLength(3);
    expect(templatesForClass(templates, '3A')).toHaveLength(3);
  });
});

describe('points', () => {
  it('additionne les demi-points sans erreur d\'arrondi', () => {
    expect(totalPoints([{ max_points: 0.1 }, { max_points: 0.2 }])).toBe(0.3);
    expect(formatPoints(1.5)).toBe('1,5');
  });
  it('propose les séquences d\'un niveau', () => {
    expect(tpChaptersOfLevel([tp('a', '5e', 'S2'), tp('b', '5e', 'S1'), tp('c', '4e', 'S9')], '5e')).toEqual(['S1', 'S2']);
  });
});
