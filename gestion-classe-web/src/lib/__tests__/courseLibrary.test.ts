import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import {
  chaptersOfLevel, courseHref, groupActivities, groupLibrary, isEvaluationTitle, isMethodSheet, naturalCompare, parseOpenTarget,
  recentBoards, splitShelves, splitVariant, variantLabel, withoutEvaluationPrefix,
} from '../courseLibrary';

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

describe('splitVariant', () => {
  it('lit la correction et les documents à la fin du titre', () => {
    expect(splitVariant('Activité 3 — Wegener (correction)')).toEqual({ base: 'Activité 3 — Wegener', variant: 'correction' });
    expect(splitVariant('Activité 3 — Wegener (Documents)')).toEqual({ base: 'Activité 3 — Wegener', variant: 'documents' });
    expect(splitVariant('Activité 3 — Wegener (corrigé) ')).toEqual({ base: 'Activité 3 — Wegener', variant: 'correction' });
    expect(splitVariant('Activité 3 — Wegener (copie modèle)')).toEqual({ base: 'Activité 3 — Wegener', variant: 'copie' });
    expect(splitVariant('Activité 3 — Wegener (extraits)')).toEqual({ base: 'Activité 3 — Wegener', variant: 'extraits' });
    expect(splitVariant('Activité 3 — Wegener (Extrait)').variant).toBe('extraits');
    expect(splitVariant('Activité 2 — Microbiote (adaptée)')).toEqual({ base: 'Activité 2 — Microbiote', variant: 'adaptee' });
    expect(splitVariant('Évaluation — Micro-organismes (Adaptee)').variant).toBe('adaptee');
    expect(splitVariant('Activité 3 — Wegener')).toEqual({ base: 'Activité 3 — Wegener', variant: 'fiche' });
    expect(splitVariant('La correction (bilan)').variant).toBe('fiche');
  });
});

describe('variante extraits', () => {
  const seq = 'Séquence 2 — Terre en mouvement';
  const b = (id: string, title: string) => ({ id, title, level: '4e', chapter: seq, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z' });
  it('se range avec son activité, entre les documents et la correction', () => {
    const groups = groupActivities([
      b('c', 'Activité 3 — Wegener (correction)'), b('e', 'Activité 3 — Wegener (extraits)'),
      b('f', 'Activité 3 — Wegener'), b('d', 'Activité 3 — Wegener (documents)'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.variant)).toEqual(['fiche', 'documents', 'extraits', 'correction']);
  });
});

describe('groupActivities', () => {
  const seq = 'Séquence 2 — Terre en mouvement';
  const sorted = (list: Board[]) => [...list].sort((x, y) => naturalCompare(x.title, y.title));

  it('rattache la correction et les documents à leur activité, dans l’ordre fiche › documents › correction', () => {
    const groups = groupActivities(sorted([
      board('c1', 'Activité 1 — Plaques (correction)', '4e', seq),
      board('d1', 'Activité 1 — Plaques (documents)', '4e', seq),
      board('f1', 'Activité 1 — Plaques', '4e', seq),
      board('f2', 'Activité 2 — Subduction', '4e', seq),
      board('c2', 'Activité 2 — Subduction (correction)', '4e', seq),
    ]));
    expect(groups.map((g) => g.title)).toEqual(['Activité 1 — Plaques', 'Activité 2 — Subduction']);
    expect(groups[0].members.map((m) => m.board.id)).toEqual(['f1', 'd1', 'c1']);
    expect(groups[1].members.map((m) => m.variant)).toEqual(['fiche', 'correction']);
    expect(groups.every((g) => !g.evaluation)).toBe(true);
  });

  it('regroupe l’évaluation avec ses documents et sa correction, et la range après les activités', () => {
    const groups = groupActivities(sorted([
      board('es', 'Évaluation — La Terre en mouvement', '4e', seq),
      board('ec', 'Évaluation — La Terre en mouvement (correction)', '4e', seq),
      board('ed', 'Évaluation — La Terre en mouvement (documents)', '4e', seq),
      board('f1', 'Activité 1 — Plaques', '4e', seq),
      board('fm', 'Fiche méthode — Lire un graphique', '4e', seq),
      board('z', 'Activité 9 — Zénith', '4e', seq),
    ]));
    expect(groups.map((g) => g.key)).toEqual(['f1', 'z', 'fm', 'es']);
    const evaluation = groups[3];
    expect(evaluation.evaluation).toBe(true);
    expect(evaluation.members.map((m) => m.board.id)).toEqual(['es', 'ed', 'ec']);
    expect(evaluation.members.map((m) => variantLabel(m.variant, evaluation.evaluation))).toEqual(['Sujet', 'Documents', 'Correction']);
  });

  it('garde les parenthèses du titre (« partie n », « TP ») et ne lit que le dernier suffixe', () => {
    const groups = groupActivities(sorted([
      board('p1', 'Activité 1 — Le changement climatique (partie 1 : parcours GIEC)', '3e', seq),
      board('p1c', 'Activité 1 — Le changement climatique (partie 1 : parcours GIEC) (correction)', '3e', seq),
      board('p1d', 'Activité 1 — Le changement climatique (partie 1 : parcours GIEC) (documents)', '3e', seq),
      board('p2', 'Activité 1 — Le changement climatique (partie 2 : cours)', '3e', seq),
      board('p2c', 'Activité 1 — Le changement climatique (partie 2 : cours) (correction)', '3e', seq),
      board('tp', 'Activité 2 — Que fabrique la plante à la lumière ? (TP)', '5e', seq),
      board('tpc', 'Activité 2 — Que fabrique la plante à la lumière ? (TP) (correction)', '5e', seq),
    ]));
    expect(groups.map((g) => g.members.map((m) => m.board.id))).toEqual([['p1', 'p1d', 'p1c'], ['p2', 'p2c'], ['tp', 'tpc']]);
    expect(groups[0].title).toBe('Activité 1 — Le changement climatique (partie 1 : parcours GIEC)');
  });

  it('rapproche apostrophe droite et typographique', () => {
    const groups = groupActivities([
      board('f', 'Activité 5 — Le choix d’avoir un enfant', '4e', seq),
      board('d', "Activité 5 — Le choix d'avoir un enfant (documents)", '4e', seq),
    ]);
    expect(groups.map((g) => g.members.map((m) => m.board.id))).toEqual([['f', 'd']]);
  });

  it('reconnaît le préfixe, avec ou sans accent ni majuscule', () => {
    expect(isEvaluationTitle('Évaluation — Le système immunitaire')).toBe(true);
    expect(isEvaluationTitle('evaluation : séismes')).toBe(true);
    expect(isEvaluationTitle('EVALUATION séismes')).toBe(true);
    expect(isEvaluationTitle('Évaluations de fin de séquence')).toBe(true);
    expect(isEvaluationTitle('Évaluation — forme décomposée')).toBe(true);
    expect(isEvaluationTitle('Évaluationnel')).toBe(false);
    expect(isEvaluationTitle('Activité 1 — Préparer l’évaluation')).toBe(false);
  });

  it('retire le préfixe pour l’affichage, sans vider le titre', () => {
    expect(withoutEvaluationPrefix('Évaluation — Le système immunitaire')).toBe('Le système immunitaire');
    expect(withoutEvaluationPrefix('Évaluation')).toBe('Évaluation');
  });

  it('laisse seule une correction orpheline ou un cours sans activité', () => {
    const groups = groupActivities(sorted([
      board('o', 'Activité 2 — Patiente 2 (correction)', '3e', seq),
      board('f', 'Activité 3 — Antibiogramme', '3e', seq),
    ]));
    expect(groups.map((g) => g.members.length)).toEqual([1, 1]);
    expect(groups[0].members[0].variant).toBe('correction');
  });

  it('compte une activité et sa correction pour une seule ligne du niveau', () => {
    const [level] = groupLibrary([
      board('f1', 'Activité 1 — Plaques', '4e', seq),
      board('c1', 'Activité 1 — Plaques (correction)', '4e', seq),
      board('o', 'Activité 2 — Seule (correction)', '4e', seq),
    ]);
    expect(level.count).toBe(2);
  });

  it('garde un doublon de titre à part', () => {
    const groups = groupActivities([
      board('a', 'Activité 1', '4e', seq),
      board('b', 'Activité 1', '4e', seq),
      board('c', 'Activité 1 (correction)', '4e', seq),
    ]);
    expect(groups.map((g) => g.members.map((m) => m.board.id))).toEqual([['a', 'c'], ['b']]);
  });
});

describe('splitShelves', () => {
  it('range les fiches méthode à part, sans toucher à l’ordre', () => {
    const list = [
      board('a', 'Activité 1 — Wegener', '4e', 'Séquence 2'),
      { ...board('m2', 'FM2 — Construire un tableau', null, null), category: 'methode' as const },
      board('b', 'Activité 2 — Les séismes', '4e', 'Séquence 2'),
      { ...board('m1', 'FM1 — Lire une consigne', null, null), category: 'methode' as const },
      { ...board('c', 'Activité 3', '4e', 'Séquence 2'), category: null },
    ];
    const { activities, methods } = splitShelves(list);
    expect(activities.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(methods.map((b) => b.id)).toEqual(['m2', 'm1']);
  });

  it('un cours sans rayon connu (migration 082 absente) reste une activité', () => {
    expect(isMethodSheet(board('a', 'Activité 1', '5e', null))).toBe(false);
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
