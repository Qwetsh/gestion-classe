import { describe, expect, it } from 'vitest';
import { buildSeatGrades, sessionSparkline, type SeatEventRow } from '../seatGrades';
import { buildStudentGrades, type GradeRules } from '../implicationGrades';

const event = (studentId: string, type: string, sessionId: string | null): SeatEventRow => ({ student_id: studentId, type, session_id: sessionId });
const rules = (over: Partial<GradeRules> = {}): GradeRules => ({
  target_participations: 15, total_sessions_expected: 60, bavardage_penalty: false, base_grade: null, ...over,
});

describe('sessionSparkline', () => {
  it('laisse dix cases vides pour un élève sans événement', () => {
    const s = sessionSparkline([]);
    expect(s.sparkHistory).toEqual(Array(10).fill(null));
    expect(s.trend).toBe('flat');
    expect(s.trendDelta).toBe(0);
  });

  it('compte participations moins bavardages par séance, borné entre −2 et 2', () => {
    const s = sessionSparkline([
      event('e', 'participation', 's1'), event('e', 'participation', 's1'), event('e', 'participation', 's1'),
      event('e', 'bavardage', 's2'), event('e', 'bavardage', 's2'), event('e', 'bavardage', 's2'),
      event('e', 'participation', 's3'), event('e', 'bavardage', 's3'), event('e', 'absence', 's3'),
    ]);
    expect(s.sparkHistory.slice(-3)).toEqual([2, -2, 0]);
    expect(s.sparkHistory.slice(0, 7)).toEqual(Array(7).fill(null));
  });

  it('ne garde que les dix dernières séances, dans l’ordre reçu', () => {
    const events = Array.from({ length: 12 }, (_, i) => event('e', i < 2 ? 'bavardage' : 'participation', `s${i}`));
    const s = sessionSparkline(events);
    expect(s.sparkHistory).toEqual(Array(10).fill(1));
  });

  it('ignore un événement sans séance', () => {
    expect(sessionSparkline([event('e', 'participation', null)]).sparkHistory).toEqual(Array(10).fill(null));
  });

  it('donne la tendance en comparant les deux moitiés de la courbe', () => {
    const monte = sessionSparkline([event('e', 'bavardage', 's1'), event('e', 'participation', 's2')]);
    expect(monte.trend).toBe('up');
    expect(monte.trendDelta).toBe(2);
    const descend = sessionSparkline([event('e', 'participation', 's1'), event('e', 'bavardage', 's2')]);
    expect(descend.trend).toBe('down');
    const stable = sessionSparkline([event('e', 'participation', 's1'), event('e', 'participation', 's2')]);
    expect(stable.trend).toBe('flat');
  });

  it('reste stable avec une seule séance', () => {
    expect(sessionSparkline([event('e', 'participation', 's1')]).trend).toBe('flat');
  });
});

describe('buildSeatGrades', () => {
  it('rend une entrée par élève de la classe, même sans événement', () => {
    const grades = buildSeatGrades(['a', 'b'], [event('a', 'participation', 's1')], [], rules());
    expect([...grades.keys()]).toEqual(['a', 'b']);
    expect(grades.get('b')).toMatchObject({ participations: 0, malus: 0, absences: 0, grade: 0, trend: 'flat' });
  });

  it('ajoute les participations manuelles et ignore celles d’un autre élève', () => {
    const grades = buildSeatGrades(
      ['a'],
      [event('a', 'participation', 's1'), event('a', 'bavardage', 's1'), event('a', 'absence', 's2')],
      [{ student_id: 'a', count: 2 }, { student_id: 'a', count: 1 }, { student_id: 'z', count: 9 }],
      rules(),
    );
    expect(grades.get('a')).toMatchObject({ participations: 4, malus: 1, absences: 1 });
  });

  it('applique les réglages par défaut à une classe sans réglage', () => {
    const events = Array.from({ length: 15 }, (_, i) => event('a', 'participation', `s${i}`));
    expect(buildSeatGrades(['a'], events, [], undefined).get('a')?.grade).toBe(20);
  });

  it('donne la même note que la page « Suivi élèves » pour les mêmes données', () => {
    const cases: GradeRules[] = [rules(), rules({ bavardage_penalty: true }), rules({ base_grade: 10 }), rules({ base_grade: 10, bavardage_penalty: true }), rules({ target_participations: 20, total_sessions_expected: 12 })];
    for (const r of cases) {
      const seatEvents = [
        ...Array.from({ length: 7 }, (_, i) => event('a', 'participation', `s${i}`)),
        ...Array.from({ length: 3 }, (_, i) => event('a', 'bavardage', `s${i}`)),
        ...Array.from({ length: 4 }, (_, i) => event('a', 'absence', `x${i}`)),
      ];
      const seat = buildSeatGrades(['a'], seatEvents, [{ student_id: 'a', count: 2 }], r).get('a');
      const [page] = buildStudentGrades({
        students: [{ id: 'a', pseudo: 'Lina Bo', class_id: 'c', created_at: '', gender: 'F', student_code: null, is_witness: false, has_pap: false, has_ppre: false, has_pai: false, classes: { name: '5D' } }],
        events: seatEvents.map((e, i) => ({ id: `e${i}`, student_id: 'a', session_id: e.session_id ?? '', type: e.type, subtype: null, note: null, timestamp: '2026-10-01T08:00:00Z' })),
        manualParticipations: [{ id: 'm', student_id: 'a', trimester: 1, school_year: '2026-2027', count: 2, reason: null, created_at: null }],
        archivedGrades: [],
        oralEvaluations: [],
        classConfigs: new Map([['c', { class_id: 'c', ...r }]]),
      });
      expect(seat?.grade).toBe(page.grade);
      expect(seat?.participations).toBe(page.totalParticipations);
    }
  });
});
