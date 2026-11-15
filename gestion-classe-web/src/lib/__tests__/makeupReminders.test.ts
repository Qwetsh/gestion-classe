import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { lessonFitsMakeup, makeupSentence, makeupsForLesson, placeMakeups, type PendingMakeup } from '../timetable/makeupReminders';

const C3E = 'class-3e';
const G1 = 'group-1';
const G2 = 'group-2';

function absent(pseudo: string, extra: Partial<PendingMakeup> = {}): PendingMakeup {
  return {
    assessmentId: 'eval-micro',
    assessmentName: 'Éval 1 – Micro-organismes',
    assessmentDate: new Date(2026, 10, 6), // vendredi 6 novembre
    classId: C3E,
    groupId: null,
    studentId: `s-${pseudo}`,
    pseudo,
    studentGroupIds: [],
    ...extra,
  };
}

function lesson(label: string, day: number, hour: number, extra: { classId?: string | null; groupId?: string | null; status?: 'normal' | 'canceled' } = {}) {
  const start = new Date(2026, 10, day, hour, 0);
  return {
    start,
    end: new Date(start.getTime() + 55 * 60_000),
    label,
    classId: extra.classId === undefined ? C3E : extra.classId,
    groupId: extra.groupId ?? null,
    status: extra.status ?? ('normal' as const),
  };
}

describe('placeMakeups', () => {
  const evalDay = lesson('3E', 6, 10); // le cours de l'éval
  const thu = lesson('3°EP2', 12, 14);
  const thu2 = lesson('3°EP1', 12, 15);
  const fri = lesson('3E', 13, 10);

  it('place les absents sur le prochain cours de la classe, pas sur celui de l’éval', () => {
    const map = placeMakeups([absent('Léa M.'), absent('Tom B.')], [evalDay, thu, thu2, fri], new Date(2026, 10, 6, 10, 30));
    const r = makeupsForLesson(map, thu);
    expect(r).toHaveLength(1);
    expect(r[0].students.map(s => s.pseudo)).toEqual(['Léa M.', 'Tom B.']);
    expect(makeupsForLesson(map, evalDay)).toEqual([]);
    expect(makeupsForLesson(map, fri)).toEqual([]);
  });

  it('glisse au cours suivant une fois le cours passé sans rattrapage', () => {
    const map = placeMakeups([absent('Léa M.')], [thu, thu2, fri], new Date(2026, 10, 12, 15, 10));
    expect(makeupsForLesson(map, thu)).toEqual([]);
    expect(makeupsForLesson(map, thu2)[0].students[0].pseudo).toBe('Léa M.');
  });

  it('reste affiché pendant le cours en cours', () => {
    const map = placeMakeups([absent('Léa M.')], [thu, fri], new Date(2026, 10, 12, 14, 20));
    expect(makeupsForLesson(map, thu)).toHaveLength(1);
  });

  it('ignore les cours annulés et ceux d’une autre classe', () => {
    const canceled = lesson('3E', 9, 10, { status: 'canceled' });
    const other = lesson('4C', 9, 11, { classId: 'class-4c' });
    const map = placeMakeups([absent('Léa M.')], [canceled, other, fri], new Date(2026, 10, 7));
    expect(makeupsForLesson(map, canceled)).toEqual([]);
    expect(makeupsForLesson(map, other)).toEqual([]);
    expect(makeupsForLesson(map, fri)).toHaveLength(1);
  });

  it('répartit selon les demi-groupes connus', () => {
    const g2 = lesson('3°EP2', 12, 14, { groupId: G2 });
    const g1 = lesson('3°EP1', 12, 15, { groupId: G1 });
    const map = placeMakeups(
      [absent('Léa M.', { studentGroupIds: [G1] }), absent('Tom B.', { studentGroupIds: [G2] }), absent('Zoé K.')],
      [g2, g1, fri],
      new Date(2026, 10, 7),
    );
    // Zoé n'est dans aucun groupe : premier cours de la classe, quel qu'il soit
    expect(makeupsForLesson(map, g2)[0].students.map(s => s.pseudo)).toEqual(['Tom B.', 'Zoé K.']);
    expect(makeupsForLesson(map, g1)[0].students.map(s => s.pseudo)).toEqual(['Léa M.']);
    expect(makeupsForLesson(map, fri)).toEqual([]);
  });

  it('une entrée par éval quand plusieurs évals tombent sur le même cours', () => {
    const map = placeMakeups(
      [absent('Léa M.'), absent('Tom B.', { assessmentId: 'eval-old', assessmentName: 'Éval 0', assessmentDate: new Date(2026, 9, 15) })],
      [thu],
      new Date(2026, 10, 7),
    );
    const r = makeupsForLesson(map, thu);
    expect(r.map(x => x.assessmentName)).toEqual(['Éval 0', 'Éval 1 – Micro-organismes']);
  });

  it('rien si aucun cours connu ne convient', () => {
    expect(placeMakeups([absent('Léa M.')], [evalDay], new Date(2026, 10, 6, 9)).size).toBe(0);
  });
});

describe('lessonFitsMakeup', () => {
  it('éval de demi-groupe : seulement ce groupe ou la classe entière', () => {
    const m = { classId: C3E, groupId: G1, studentGroupIds: [] };
    expect(lessonFitsMakeup({ classId: C3E, groupId: G1 }, m)).toBe(true);
    expect(lessonFitsMakeup({ classId: C3E, groupId: G2 }, m)).toBe(false);
    expect(lessonFitsMakeup({ classId: C3E, groupId: null }, m)).toBe(true);
  });
});

describe('makeupSentence', () => {
  it('formule le rappel', () => {
    const map = placeMakeups([absent('Léa M.'), absent('Tom B.')], [lesson('3E', 13, 10)], new Date(2026, 10, 7));
    const [r] = [...map.values()][0];
    expect(makeupSentence(r)).toBe("Faire reprendre l'éval Éval 1 – Micro-organismes à : Léa M., Tom B.");
  });
});
