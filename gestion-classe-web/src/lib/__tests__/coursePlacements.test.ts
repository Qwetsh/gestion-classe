import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { NO_CLASS, buildTimeline, classesWithDocuments, documentsOfActivity, documentsOfClass, placementChips, placementsOf, type DocumentSession, type PlacedDocument, type Placement } from '../coursePlacements';

const classes = [
  { id: 'c4a', name: '4A' },
  { id: 'c4b', name: '4B' },
  { id: 'c4d', name: '4D' },
];

const placement = (boardId: string, sourceBoardId: string, classId: string | null, iso: string, label = '4X'): Placement => ({
  boardId, sourceBoardId, classId, startsAt: new Date(iso), label,
});

const now = new Date('2026-11-18T12:00:00');

describe('placementChips', () => {
  it('donne une pastille par classe, triée par nom', () => {
    const chips = placementChips([
      placement('b3', 'orig', 'c4d', '2026-11-18T10:15:00'),
      placement('b1', 'orig', 'c4a', '2026-11-18T08:15:00'),
      placement('b2', 'orig', 'c4b', '2026-11-20T08:15:00'),
    ], classes, now);
    expect(chips.get('orig')?.map((c) => c.name)).toEqual(['4A', '4B', '4D']);
  });

  it('range chaque copie sous son original', () => {
    const chips = placementChips([
      placement('b1', 'fiche', 'c4a', '2026-11-18T08:15:00'),
      placement('b2', 'correction', 'c4a', '2026-11-25T08:15:00'),
    ], classes, now);
    expect(chips.get('fiche')?.map((c) => c.boardId)).toEqual(['b1']);
    expect(chips.get('correction')?.map((c) => c.boardId)).toEqual(['b2']);
  });

  it('mène au prochain cours de la classe, celui du jour compris', () => {
    const chips = placementChips([
      placement('passe', 'orig', 'c4a', '2026-11-10T08:15:00'),
      placement('ce-matin', 'orig', 'c4a', '2026-11-18T08:15:00'),
      placement('plus-tard', 'orig', 'c4a', '2026-11-25T08:15:00'),
    ], classes, now);
    const chip = chips.get('orig')![0];
    expect(chip.boardId).toBe('ce-matin');
    expect(chip.dates).toHaveLength(3);
  });

  it('mène au dernier cours passé quand il n’y en a plus à venir', () => {
    const chips = placementChips([
      placement('ancien', 'orig', 'c4a', '2026-11-03T08:15:00'),
      placement('recent', 'orig', 'c4a', '2026-11-10T08:15:00'),
    ], classes, now);
    expect(chips.get('orig')![0].boardId).toBe('recent');
  });

  it('garde le libellé du cours quand la classe est inconnue ou supprimée', () => {
    const chips = placementChips([
      placement('b1', 'orig', null, '2026-11-20T08:15:00', '3°EP1'),
      placement('b2', 'orig', 'disparue', '2026-11-20T10:15:00', '5C'),
    ], classes, now);
    expect(chips.get('orig')?.map((c) => c.name)).toEqual(['3°EP1', '5C']);
  });

  it('ne rend rien pour un original sans copie', () => {
    expect(placementChips([], classes, now).get('orig')).toBeUndefined();
  });
});

// ---- Vue « Par classe » (lot C4) ----

const doc = (boardId: string, classId: string | null, iso: string, sourceBoardId: string | null = null): PlacedDocument => ({
  boardId, sourceBoardId, classId, groupId: null, startsAt: new Date(iso), label: '4X', title: `Document ${boardId}`, isCourse: true,
});

const played = (sessionId: string, iso: string): DocumentSession => ({ sessionId, startedAt: new Date(iso) });

describe('buildTimeline', () => {
  const documents = [
    doc('hier', 'c4a', '2026-11-17T08:15:00'),
    doc('ce-matin', 'c4a', '2026-11-18T08:15:00'),
    doc('ce-soir', 'c4a', '2026-11-18T15:40:00'),
    doc('demain', 'c4a', '2026-11-19T08:15:00'),
    doc('avant-hier', 'c4a', '2026-11-16T08:15:00'),
  ];

  it('range les cours du jour sans séance dans « à venir », du plus proche au plus lointain', () => {
    const t = buildTimeline(documents, new Map(), now);
    expect(t.upcoming.map((e) => e.doc.boardId)).toEqual(['ce-matin', 'ce-soir', 'demain']);
  });

  it('range le passé du plus récent au plus ancien', () => {
    const t = buildTimeline(documents, new Map(), now);
    expect(t.past.map((e) => e.doc.boardId)).toEqual(['hier', 'avant-hier']);
    expect(t.past.every((e) => e.session === null)).toBe(true);
  });

  it('passe un cours du jour dans « passé » dès qu’une séance l’a joué', () => {
    const sessions = new Map([['ce-matin', [played('s1', '2026-11-18T08:20:00')]]]);
    const t = buildTimeline(documents, sessions, now);
    expect(t.upcoming.map((e) => e.doc.boardId)).toEqual(['ce-soir', 'demain']);
    expect(t.past[0]).toMatchObject({ doc: { boardId: 'ce-matin' }, session: { sessionId: 's1' } });
  });

  it('garde la séance la plus récente quand un document en a plusieurs', () => {
    const sessions = new Map([['hier', [played('ancienne', '2026-11-17T08:20:00'), played('reprise', '2026-11-17T10:20:00')]]]);
    const t = buildTimeline(documents, sessions, now);
    expect(t.past.find((e) => e.doc.boardId === 'hier')?.session?.sessionId).toBe('reprise');
  });
});

describe('documents par classe et par activité', () => {
  const documents = [
    doc('a1', 'c4a', '2026-11-18T08:15:00', 'fiche'),
    doc('b1', 'c4b', '2026-11-20T08:15:00', 'fiche'),
    doc('a2', 'c4a', '2026-11-25T08:15:00', 'correction'),
    doc('x', null, '2026-11-25T10:15:00'),
    doc('y', 'disparue', '2026-11-26T10:15:00'),
  ];

  it('liste les classes qui portent un document, dans l’ordre des classes', () => {
    const tabs = classesWithDocuments(documents, classes);
    expect(tabs.classes.map((c) => c.name)).toEqual(['4A', '4B']);
    expect(tabs.other).toBe(true);
  });

  it('rend les documents d’une classe, et à part ceux sans classe connue', () => {
    expect(documentsOfClass(documents, 'c4a', classes).map((d) => d.boardId)).toEqual(['a1', 'a2']);
    expect(documentsOfClass(documents, NO_CLASS, classes).map((d) => d.boardId)).toEqual(['x', 'y']);
  });

  it('réunit les copies d’un même original', () => {
    expect(documentsOfActivity(documents, 'fiche').map((d) => d.boardId)).toEqual(['a1', 'b1']);
  });

  it('ne garde pour les pastilles que les copies dont l’original est connu', () => {
    expect(placementsOf(documents).map((p) => p.boardId)).toEqual(['a1', 'b1', 'a2']);
  });
});
