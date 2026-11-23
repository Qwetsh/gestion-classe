import { describe, expect, it } from 'vitest';
import { activityIndex, sameStudentBoards, studentBoardsOfTp, activityNumberOf, activityOfTp, filterTps, formatPoints, groupTps, tpsByActivity, templatesForClass, themeShortName, themesOf, totalPoints, tpChaptersOfLevel, tpSearchWords } from '../tpLibrary';

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

describe('lien TP ↔ activité', () => {
  const board = (id: string, title: string, chapter = 'Séquence 3 — L’intégration', level = '4e') => ({ id, title, level, chapter });
  const boards = [
    board('f3', 'Activité 3 — Observer des neurones'),
    board('c3', 'Activité 3 — Observer des neurones (correction)'),
    board('b', 'Activité bonus — Modéliser'),
    board('f3bis', 'Activité 3 — Doublon'),
    board('autre', 'Activité 3 — Autre séquence', 'Séquence 9'),
    board('ev', 'Évaluation — L’intégration'),
  ];
  const t = (name: string, activity: string | null, chapter = "Séquence 3 — L'intégration") => ({ name, level: '4e', chapter, activity });

  it('lit le numéro d’un titre d’activité', () => {
    expect(activityNumberOf('Activité 3 — X')).toBe('3');
    expect(activityNumberOf('Activité 12a — X')).toBe('12a');
    expect(activityNumberOf('Activité bonus — X')).toBe('bonus');
    expect(activityNumberOf('Activités 3')).toBeNull();
    expect(activityNumberOf('Évaluation — X')).toBeNull();
  });

  it('relie à la fiche de la même séquence, apostrophes comprises, sinon au numéro sans lettre', () => {
    const index = activityIndex(boards);
    expect(activityOfTp(t('a', '3'), index)?.id).toBe('f3');
    expect(activityOfTp(t('a', '3b'), index)?.id).toBe('f3');
    expect(activityOfTp(t('a', 'Bonus'), index)?.id).toBe('b');
    expect(activityOfTp(t('a', '4'), index)).toBeNull();
    expect(activityOfTp(t('a', null), index)).toBeNull();
    expect(activityOfTp(t('a', '3', 'Séquence 1'), index)).toBeNull();
  });

  it('range les TP par activité', () => {
    const map = tpsByActivity([t('Zèbre', '3'), t('Abeille', '3a'), t('Seul', 'bonus'), t('Perdu', '7')], boards);
    expect(map.get('f3')?.map((x) => x.name)).toEqual(['Abeille', 'Zèbre']);
    expect(map.get('b')?.map((x) => x.name)).toEqual(['Seul']);
    expect(map.size).toBe(2);
  });

  it('classe les TP d’une séquence dans l’ordre des activités', () => {
    const items = [
      { ...tp('Z', '4e', 'S1'), activity: '10' },
      { ...tp('A', '4e', 'S1'), activity: null },
      { ...tp('M', '4e', 'S1'), activity: '2' },
    ];
    expect(groupTps(items)[0].sequences[0].items.map((x) => x.name)).toEqual(['M', 'Z', 'A']);
  });
});

describe('studentBoardsOfTp', () => {
  const b = (id: string, title: string, chapter = 'Séquence 2 — Micro-organismes', level: string | null = '3e') => ({ id, title, level, chapter });
  const boards = [
    b('f3', 'Activité 3 — Choisir le bon antibiotique'),
    b('p3', 'Activité 3 — Choisir le bon antibiotique (protocole)'),
    b('d3', 'Activité 3 – Choisir le bon antibiotique (documents)'.replace('–', '—')),
    b('c3', 'Activité 3 — Choisir le bon antibiotique (correction)'),
    b('p3autre', 'Activité 3 — Choisir le bon antibiotique (protocole)', 'Séquence 5 — Autre'),
    b('f4', 'Activité 4 — Les vaccins'),
  ];

  it('rend fiche, protocole et documents de l’activité, jamais la correction', () => {
    expect(studentBoardsOfTp({ level: '3e', chapter: 'Séquence 2 — Micro-organismes', activity: '3' }, boards))
      .toEqual({ fiche: 'f3', protocole: 'p3', documents: 'd3' });
  });

  it('laisse vides les cours qui manquent, et null sans activité reliée', () => {
    expect(studentBoardsOfTp({ level: '3e', chapter: 'Séquence 2 — Micro-organismes', activity: '4' }, boards))
      .toEqual({ fiche: 'f4', protocole: null, documents: null });
    expect(studentBoardsOfTp({ level: '3e', chapter: 'Séquence 2 — Micro-organismes', activity: '9' }, boards)).toBeNull();
    expect(studentBoardsOfTp({ level: '3e', chapter: null, activity: '3' }, boards)).toBeNull();
  });

  it('compare deux choix sans tenir compte de null ou d’une clé absente', () => {
    expect(sameStudentBoards(null, { fiche: null, protocole: null, documents: null })).toBe(true);
    expect(sameStudentBoards({ fiche: 'a' }, { fiche: 'a', protocole: null, documents: null })).toBe(true);
    expect(sameStudentBoards({ fiche: 'a' }, { fiche: 'b' })).toBe(false);
  });
});
