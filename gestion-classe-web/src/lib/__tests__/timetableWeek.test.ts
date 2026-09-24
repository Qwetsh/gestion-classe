import { describe, expect, it } from 'vitest';
import {
  buildWeek,
  assignSessions,
  dropReplacedCancellations,
  mondayOf,
  percentOfDay,
  placeLessons,
  type TimetableLesson,
} from '../timetable/weekView';

let n = 0;
const lesson = (day: number, from: string, to: string, extra: Partial<TimetableLesson> = {}): TimetableLesson => {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  return {
    id: `l${n++}`,
    start: new Date(2026, 8, day, fh, fm),
    end: new Date(2026, 8, day, th, tm),
    label: '4D', subject: 'SVT', room: null, status: 'normal',
    classId: 'c', className: '4D', groupId: null, groupName: null,
    ...extra,
  };
};

const MONDAY = new Date(2026, 8, 21); // lundi 21 septembre 2026

describe('mondayOf', () => {
  it('ramène au lundi, dimanche compris', () => {
    expect(mondayOf(new Date(2026, 8, 24, 15)).getTime()).toBe(MONDAY.getTime());
    expect(mondayOf(new Date(2026, 8, 27)).getTime()).toBe(MONDAY.getTime());
    expect(mondayOf(MONDAY).getTime()).toBe(MONDAY.getTime());
  });
});

describe('dropReplacedCancellations', () => {
  it('masque un cours annulé remplacé sur le même créneau, garde les autres annulations', () => {
    const canceled = lesson(22, '15:40', '16:40', { status: 'canceled', label: '3°EP1' });
    const kept = lesson(22, '15:40', '16:40', { label: '3°EP1' });
    const alone = lesson(23, '08:15', '09:15', { status: 'canceled' });
    const otherClass = lesson(22, '15:40', '16:40', { status: 'canceled', label: '3°EP2' });
    const out = dropReplacedCancellations([canceled, kept, alone, otherClass]);
    expect(out).toEqual([kept, alone, otherClass]);
  });
});

describe('placeLessons', () => {
  it('laisse pleine largeur les cours qui se suivent', () => {
    const out = placeLessons([lesson(21, '08:15', '09:15'), lesson(21, '09:15', '10:10')]);
    expect(out.map(l => [l.lane, l.lanes])).toEqual([[0, 1], [0, 1]]);
  });

  it('met côte à côte les cours qui se chevauchent', () => {
    const out = placeLessons([
      lesson(21, '13:40', '14:40', { id: 'a' }),
      lesson(21, '13:40', '14:40', { id: 'b' }),
      lesson(21, '14:40', '15:40', { id: 'c' }),
    ]);
    const byId = Object.fromEntries(out.map(l => [l.id, [l.lane, l.lanes]]));
    expect(byId).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });
});

describe('buildWeek', () => {
  it('répartit les cours par jour, du lundi au vendredi', () => {
    const w = buildWeek(MONDAY, [lesson(21, '08:15', '09:15'), lesson(25, '10:25', '11:20')], []);
    expect(w.days).toHaveLength(5);
    expect(w.days[0].lessons).toHaveLength(1);
    expect(w.days[4].lessons).toHaveLength(1);
    expect(w.days[2].lessons).toHaveLength(0);
  });

  it('ajoute le samedi seulement s’il y a cours', () => {
    expect(buildWeek(MONDAY, [lesson(26, '08:00', '12:00')], []).days).toHaveLength(6);
  });

  it('élargit la plage horaire aux cours, 8 h – 17 h au minimum', () => {
    expect(buildWeek(MONDAY, [lesson(21, '09:00', '10:00')], [])).toMatchObject({ startHour: 8, endHour: 17 });
    expect(buildWeek(MONDAY, [lesson(21, '07:30', '08:30'), lesson(22, '17:00', '18:10')], []))
      .toMatchObject({ startHour: 7, endHour: 19 });
  });

  it('marque les jours de congé (fin exclusive)', () => {
    const toussaint = { id: 'h', label: 'Vacances', start: new Date(2026, 8, 24), end: new Date(2026, 8, 26) };
    const w = buildWeek(MONDAY, [], [toussaint]);
    expect(w.days.map(d => d.holiday)).toEqual([null, null, null, 'Vacances', 'Vacances']);
  });
});

describe('percentOfDay', () => {
  it('place une heure dans la plage, bornée à [0, 100]', () => {
    expect(percentOfDay(new Date(2026, 8, 21, 12, 30), 8, 17)).toBeCloseTo(50);
    expect(percentOfDay(new Date(2026, 8, 21, 6), 8, 17)).toBe(0);
    expect(percentOfDay(new Date(2026, 8, 21, 20), 8, 17)).toBe(100);
  });
});

describe('assignSessions — séance enregistrée pendant un cours', () => {
  const course = lesson(24, '13:40', '14:40', { id: 'c', classId: '3C' });
  const session = (id: string, h: number, m: number, extra: Partial<{ classId: string; groupId: string | null }> = {}) =>
    ({ id, classId: '3C', groupId: null, startedAt: new Date(2026, 8, 24, h, m), ...extra });
  const one = (l: TimetableLesson, sessions: ReturnType<typeof session>[]) => assignSessions([l], sessions).get(l.id)?.id ?? null;

  it('rattache la séance démarrée pendant le cours, ou un peu avant', () => {
    expect(one(course, [session('a', 13, 42)])).toBe('a');
    expect(one(course, [session('b', 13, 30)])).toBe('b');
  });

  it('ignore une autre classe, un autre créneau ou un autre groupe', () => {
    expect(one(course, [session('x', 13, 42, { classId: '3B' })])).toBeNull();
    expect(one(course, [session('y', 14, 40)])).toBeNull();
    expect(one(course, [session('z', 13, 10)])).toBeNull();
    const g1 = { ...course, groupId: 'g1' };
    expect(one(g1, [session('w', 13, 42, { groupId: 'g2' })])).toBeNull();
    expect(one(g1, [session('v', 13, 42)])).toBe('v');
  });

  it('garde pour un cours la séance la plus proche du début', () => {
    expect(one(course, [session('late', 14, 20), session('near', 13, 41)])).toBe('near');
  });

  it('ne rattache rien à un cours hors de mes classes', () => {
    expect(one({ ...course, classId: null }, [session('a', 13, 42)])).toBeNull();
  });

  it('ne rattache une séance qu’à un seul cours : celui dont le début est le plus proche', () => {
    // Cas réels du 22/09 : 3A G2 13:40–14:40 puis G1 14:40–15:40, séance lancée à 14:37
    const g2 = lesson(22, '13:40', '14:40', { id: 'g2', classId: '3A' });
    const g1 = lesson(22, '14:40', '15:40', { id: 'g1', classId: '3A' });
    const at = (h: number, m: number) => ({ id: `s${h}${m}`, classId: '3A', groupId: null, startedAt: new Date(2026, 8, 22, h, m) });
    const map = assignSessions([g2, g1], [at(13, 42), at(14, 37)]);
    expect(map.get('g2')?.id).toBe('s1342');
    expect(map.get('g1')?.id).toBe('s1437');

    // Réunion 4C 15:40–16:10 puis cours 16:10–16:40 : séance lancée à 15:48 → la réunion seule
    const meeting = lesson(22, '15:40', '16:10', { id: 'meeting', classId: '4C' });
    const next = lesson(22, '16:10', '16:40', { id: 'next', classId: '4C' });
    const s1548 = { id: 's', classId: '4C', groupId: null, startedAt: new Date(2026, 8, 22, 15, 48) };
    const map2 = assignSessions([meeting, next], [s1548]);
    expect(map2.get('meeting')?.id).toBe('s');
    expect(map2.has('next')).toBe(false);
  });
});
