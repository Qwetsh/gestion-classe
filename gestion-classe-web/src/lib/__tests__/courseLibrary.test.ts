import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { chaptersOfLevel, courseHref, groupLibrary, naturalCompare, parseOpenTarget, recentBoards } from '../courseLibrary';

const board = (id: string, title: string, level: string | null, chapter: string | null, updated = '2026-11-01T08:00:00Z'): Board => ({
  id, title, level, chapter, class_id: null, created_at: updated, updated_at: updated,
});

describe('naturalCompare', () => {
  it('range « Activité 2 » avant « Activité 10 »', () => {
    expect(['Activité 10', 'Activité 2', 'activité 1'].sort(naturalCompare)).toEqual(['activité 1', 'Activité 2', 'Activité 10']);
  });
});

describe('groupLibrary', () => {
  const boards = [
    board('a', 'Activité 10 — Bilan', '4e', 'Séquence 2 — Terre en mouvement'),
    board('b', 'Activité 2 — Séismes', '4e', 'Séquence 2 — Terre en mouvement'),
    board('c', 'Brouillon de rentrée', '4e', null),
    board('d', 'Activité 1', '4e', 'Séquence 10 — Reproduction'),
    board('e', 'Cellule', '6e', 'Séquence 1'),
    board('f', 'Club sciences', 'Autre', null),
    board('g', 'Sans rien', null, null),
  ];
  const groups = groupLibrary(boards);

  it('suit l’ordre du collège, « sans niveau » en dernier', () => {
    expect(groups.map((g) => g.level)).toEqual(['6e', '4e', 'Autre', null]);
  });

  it('trie les séquences par leur numéro et met les cours sans séquence à la fin', () => {
    const fourth = groups.find((g) => g.level === '4e')!;
    expect(fourth.sequences.map((s) => s.chapter)).toEqual(['Séquence 2 — Terre en mouvement', 'Séquence 10 — Reproduction', '']);
    expect(fourth.count).toBe(4);
  });

  it('trie les activités par leur titre, pas par leur date', () => {
    const seq = groups.find((g) => g.level === '4e')!.sequences[0];
    expect(seq.boards.map((b) => b.id)).toEqual(['b', 'a']);
  });

  it('ne change pas la liste reçue', () => {
    expect(boards[0].id).toBe('a');
  });

  it('garde une séquence sans cours quand on la lui demande (elle porte des fichiers)', () => {
    const withFiles = groupLibrary(boards, [
      { level: '4e', chapter: 'Séquence 3 — Fichiers seuls' },
      { level: '5e', chapter: 'Séquence 1' },
      { level: '4e', chapter: 'Séquence 2 — Terre en mouvement' },
    ]);
    const fourth = withFiles.find((g) => g.level === '4e')!;
    expect(fourth.sequences.map((s) => s.chapter)).toEqual(['Séquence 2 — Terre en mouvement', 'Séquence 3 — Fichiers seuls', 'Séquence 10 — Reproduction', '']);
    expect(fourth.sequences[1].boards).toEqual([]);
    expect(fourth.count).toBe(4);
    expect(withFiles.map((g) => g.level)).toEqual(['6e', '5e', '4e', 'Autre', null]);
  });
});

describe('recentBoards', () => {
  it('garde les trois cours modifiés en dernier', () => {
    const list = [
      board('1', 'un', null, null, '2026-11-01T08:00:00Z'),
      board('2', 'deux', null, null, '2026-11-14T08:00:00Z'),
      board('3', 'trois', null, null, '2026-11-10T08:00:00Z'),
      board('4', 'quatre', null, null, '2026-10-01T08:00:00Z'),
    ];
    expect(recentBoards(list).map((b) => b.id)).toEqual(['2', '3', '1']);
  });
});

describe('chaptersOfLevel', () => {
  it('liste une fois chaque séquence du niveau', () => {
    const list = [board('1', 'a', '4e', 'S2'), board('2', 'b', '4e', 'S2'), board('3', 'c', '4e', 'S1'), board('4', 'd', '3e', 'S9'), board('5', 'e', '4e', null)];
    expect(chaptersOfLevel(list, '4e')).toEqual(['S1', 'S2']);
    expect(chaptersOfLevel(list, null)).toEqual([]);
  });
});

describe('adresse d’ouverture', () => {
  it('écrit le mode seulement quand il n’est pas « texte »', () => {
    expect(courseHref('abc')).toBe('/cours?ouvrir=abc');
    expect(courseHref('abc', 'classe')).toBe('/cours?ouvrir=abc&mode=classe');
  });

  it('relit ce qu’elle a écrit', () => {
    const read = (href: string) => parseOpenTarget(new URLSearchParams(href.split('?')[1]));
    expect(read(courseHref('abc', 'tableau'))).toEqual({ id: 'abc', mode: 'tableau' });
    expect(read(courseHref('abc'))).toEqual({ id: 'abc', mode: 'texte' });
  });

  it('ignore une adresse sans cours et un mode inconnu', () => {
    expect(parseOpenTarget(new URLSearchParams(''))).toBeNull();
    expect(parseOpenTarget(new URLSearchParams('ouvrir=%20'))).toBeNull();
    expect(parseOpenTarget(new URLSearchParams('ouvrir=abc&mode=autre'))).toEqual({ id: 'abc', mode: 'texte' });
  });
});
