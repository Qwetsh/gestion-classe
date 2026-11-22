import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import {
  binderDocKind, binderLevels, binderToc, buildBinder, dividerIndex, glueAngle, sectionAt, shortActivityLabel, spreadOf, turn,
} from '../binder';

let n = 0;
const board = (title: string, level: string | null, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id: `b${++n}`, title, level, chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — La Terre, une planète active';
const S2 = 'Séquence 2 — Sous nos pieds, une Terre en mouvement';
const S3 = 'Séquence 3 — Pas encore prête';

const library: Board[] = [
  board('Mon classeur de SVT — mode d’emploi', null, null),
  board('Activité 2 — Séisme', '4e', S1),
  board('Activité 2 — Séisme (documents)', '4e', S1),
  board('Activité 2 — Séisme (correction)', '4e', S1),
  board('Activité 2 — Séisme (copie modèle)', '4e', S1),
  board('Activité 2 — Séisme (extraits)', '4e', S1),
  board('Activité 2 — Séisme (adaptée)', '4e', S1),
  board('Activité 10 — Bilan', '4e', S1),
  board('Activité 1 — Volcans', '4e', S1),
  board('Activité bonus — Modéliser', '4e', S1),
  board('Évaluation — La Terre', '4e', S1),
  board('Page de garde — Séquence 1', '4e', S1),
  board('Feuille de bilans — Séquence 1', '4e', S1),
  board('Feuille de bilans — Séquence 1 (correction)', '4e', S1),
  board('Fiche de mémorisation — Séquence 1', '4e', S1),
  board('Test Bilan', '4e', S2),
  board('Page de garde — Séquence 2', '4e', S2),
  board('Activité 3 — Wegener', '4e', S2, { updated_at: '2026-10-01T08:00:00Z' }),
  board('Activité 3 — Wegener', '4e', S2, { id: 'wegener-recent', updated_at: '2026-11-05T08:00:00Z' }),
  board('Activité 1 — Plaques', '4e', S3),
  board('FM2 — Construire un tableau', null, null, { category: 'methode' }),
  board('FM10 — Exposé', null, null, { category: 'methode' }),
  board('FM1 — Lire une consigne', null, null, { category: 'methode' }),
  board('Page de garde — Séquence 1', '3e', 'Séquence 1 — Corps humain'),
];

describe('binderDocKind', () => {
  it('reconnaît les documents du classeur par leur titre', () => {
    expect(binderDocKind('Page de garde — Séquence 1')).toBe('cover');
    expect(binderDocKind('Feuille de bilans — Séquence 2 (correction)')).toBe('summaries');
    expect(binderDocKind('Fiche de memorisation — Séquence 2')).toBe('memo');
    expect(binderDocKind("Mon classeur de SVT — mode d'emploi")).toBe('guide');
    expect(binderDocKind('Activité 1 — Volcans')).toBeNull();
  });
});

describe('binderLevels', () => {
  it('liste les niveaux qui ont une page de garde, dans l’ordre du collège', () => {
    expect(binderLevels(library)).toEqual(['4e', '3e']);
  });
});

describe('buildBinder', () => {
  const pages = buildBinder(library, '4e');
  const labels = pages.map((p) => (p.kind === 'divider' ? `[${p.section}]` : p.label));

  it('suit le mode d’emploi : 1re page, trois intercalaires, séquences prêtes seulement', () => {
    expect(labels).toEqual([
      'Mode d’emploi',
      '[sequences]',
      'Page de garde', 'Activité 1', 'Activité 2', 'Activité 2 — documents', 'Activité 10', 'Activité bonus', 'Évaluation',
      'Page de garde', 'Activité 3',
      '[methodes]', 'FM1', 'FM2', 'FM10',
      '[revise]', 'Feuille de bilans', 'Fiche de mémorisation',
    ]);
  });

  it('écarte les corrections d’activité, les cours hors classeur et les séquences sans page de garde', () => {
    const titles = pages.flatMap((p) => (p.kind === 'sheet' ? [p.board.title] : []));
    expect(titles.some((t) => /correction/.test(t))).toBe(false);
    // La version adaptée (PAP) reste hors du classeur de la classe
    expect(titles.some((t) => /adaptée/.test(t))).toBe(false);
    expect(titles).not.toContain('Test Bilan');
    expect(titles).not.toContain('Activité 1 — Plaques');
  });

  it('garde un seul exemplaire d’un cours copié, le plus récent', () => {
    const wegener = pages.filter((p) => p.kind === 'sheet' && p.board.title === 'Activité 3 — Wegener');
    expect(wegener).toHaveLength(1);
    expect(wegener[0].kind === 'sheet' && wegener[0].board.id).toBe('wegener-recent');
  });

  it('donne à chaque fiche son rôle, son titre manuscrit et la feuille de bilans corrigée', () => {
    const sheets = pages.flatMap((p) => (p.kind === 'sheet' ? [p] : []));
    expect(sheets.find((p) => p.label === 'Activité 2')).toMatchObject({ role: 'activity', heading: 'Activité 2 — Séisme' });
    const documents = sheets.find((p) => p.label === 'Activité 2 — documents');
    expect(documents?.role).toBe('documents');
    expect(documents?.heading).toBeUndefined();
    // La copie modèle n'est pas une page : elle accompagne sa fiche
    expect(sheets.some((p) => /copie modèle/.test(p.board.title))).toBe(false);
    // Les extraits (documents découpés pour le tableau) ne sont pas non plus une page du classeur
    expect(sheets.some((p) => /extraits/.test(p.board.title))).toBe(false);
    expect(sheets.find((p) => p.label === 'Activité 2')?.companion?.title).toBe('Activité 2 — Séisme (copie modèle)');
    expect(sheets.find((p) => p.label === 'Activité 1')?.companion).toBeUndefined();
    expect(sheets.find((p) => p.role === 'summaries')?.companion?.title).toBe('Feuille de bilans — Séquence 1 (correction)');
    expect(sheets.map((p) => p.role).filter((r, i, all) => all.indexOf(r) === i))
      .toEqual(['guide', 'cover', 'activity', 'documents', 'evaluation', 'method', 'summaries', 'memo']);
  });

  it('met l’évaluation après les activités : sa copie modèle l’accompagne, sinon sa correction suit', () => {
    const withCopy = buildBinder([
      ...library,
      board('Évaluation — La Terre (documents)', '4e', S1),
      board('Évaluation — La Terre (correction)', '4e', S1),
      board('Évaluation — La Terre (copie modèle)', '4e', S1),
    ], '4e').flatMap((p) => (p.kind === 'sheet' && /^Évaluation/.test(p.label) ? [p] : []));
    expect(withCopy.map((p) => [p.label, p.role])).toEqual([['Évaluation', 'evaluation'], ['Évaluation — documents', 'documents']]);
    expect(withCopy[0].companion?.title).toBe('Évaluation — La Terre (copie modèle)');
    expect(withCopy[0].heading).toBe('Évaluation — La Terre');

    const withoutCopy = buildBinder([...library, board('Évaluation — La Terre (correction)', '4e', S1)], '4e')
      .flatMap((p) => (p.kind === 'sheet' && /^Évaluation/.test(p.label) ? [p] : []));
    expect(withoutCopy.map((p) => [p.label, p.role])).toEqual([['Évaluation', 'evaluation'], ['Évaluation — correction', 'correction']]);
  });

  it('ne mélange pas les niveaux', () => {
    expect(buildBinder(library, '3e').filter((p) => p.kind === 'sheet').map((p) => p.kind === 'sheet' && p.label))
      .toEqual(['Mode d’emploi', 'Page de garde', 'FM1', 'FM2', 'FM10']);
  });
});

describe('feuilleter', () => {
  it('double page : la première page seule à droite, puis des paires', () => {
    expect(spreadOf(0, 5, true)).toEqual([null, 0]);
    expect(spreadOf(2, 5, true)).toEqual([1, 2]);
    expect(spreadOf(4, 5, true)).toEqual([3, 4]);
    expect(spreadOf(5, 6, true)).toEqual([5, null]);
    expect(spreadOf(3, 5, false)).toEqual([null, 3]);
  });

  it('tourne d’une vue à l’autre sans sortir du classeur', () => {
    expect(turn(0, 5, true, 1)).toBe(1);
    expect(turn(2, 5, true, 1)).toBe(3);
    expect(turn(3, 5, true, 1)).toBe(3);
    expect(turn(4, 5, true, -1)).toBe(1);
    expect(turn(1, 5, true, -1)).toBe(0);
    expect(turn(0, 5, true, -1)).toBe(0);
    expect(turn(4, 5, false, 1)).toBe(4);
    expect(turn(2, 5, false, -1)).toBe(1);
  });
});

describe('repères', () => {
  const pages = buildBinder(library, '4e');

  it('trouve la partie d’une page et l’intercalaire d’une partie', () => {
    expect(sectionAt(pages, 0)).toBeNull();
    expect(sectionAt(pages, 3)).toBe('sequences');
    expect(sectionAt(pages, dividerIndex(pages, 'methodes') + 1)).toBe('methodes');
    expect(dividerIndex(pages, 'revise')).toBe(15);
  });

  it('sommaire : parties, séquences, pages', () => {
    const toc = binderToc(pages);
    expect(toc.slice(0, 4).map((e) => [e.label, e.depth])).toEqual([
      ['Mode d’emploi', 0], ['Séquences', 0], [S1, 1], ['Page de garde', 2],
    ]);
    expect(toc.filter((e) => e.label === S1)).toHaveLength(2); // une fois dans Séquences, une fois dans Je révise
  });

  it('libellés courts et angle de collage stable', () => {
    expect(shortActivityLabel('Activité 2 — Comment mesurer ?')).toBe('Activité 2');
    expect(shortActivityLabel('activité bonus — Modéliser')).toBe('Activité bonus');
    expect(glueAngle('abc')).toBe(glueAngle('abc'));
    expect(Math.abs(glueAngle('xyz'))).toBeLessThanOrEqual(0.7);
  });
});
