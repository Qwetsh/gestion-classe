import { describe, expect, it } from 'vitest';
import {
  buildStudentGrades,
  computeImplicationGrade,
  type ClassConfig,
  type EventRow,
  type StudentRow,
} from '../implicationGrades';

const config = (over: Partial<ClassConfig> = {}): ClassConfig => ({
  class_id: 'classe-1',
  target_participations: 15,
  total_sessions_expected: 60,
  bavardage_penalty: false,
  base_grade: null,
  ...over,
});

describe('computeImplicationGrade, mode « objectif »', () => {
  it('donne 20 quand l’objectif est atteint, sans bonus', () => {
    const g = computeImplicationGrade({ totalParticipations: 15, malus: 0, absences: 0 }, config());
    expect(g.grade).toBe(20);
    expect(g.bonus).toBe(0);
    expect(g.adjustedTarget).toBe(15);
  });

  it('est proportionnelle en dessous de l’objectif', () => {
    const g = computeImplicationGrade({ totalParticipations: 6, malus: 0, absences: 0 }, config());
    expect(g.grade).toBeCloseTo(8, 10);
  });

  it('plafonne à 20 et compte en bonus les participations au-delà de l’objectif', () => {
    const g = computeImplicationGrade({ totalParticipations: 18, malus: 0, absences: 0 }, config());
    expect(g.grade).toBe(20);
    expect(g.bonus).toBe(3);
  });

  it('baisse l’objectif avec les absences', () => {
    // 15 participations attendues sur 60 séances : chaque absence retire 0,25 à l'objectif
    const g = computeImplicationGrade({ totalParticipations: 7, malus: 0, absences: 4 }, config());
    expect(g.adjustedTarget).toBe(14);
    expect(g.grade).toBeCloseTo(10, 10);
  });

  it('ne laisse jamais l’objectif passer sous 1', () => {
    const g = computeImplicationGrade({ totalParticipations: 1, malus: 0, absences: 500 }, config());
    expect(g.adjustedTarget).toBe(1);
    expect(g.grade).toBe(20);
  });

  it('ignore les bavardages sans la pénalité, les retire avec', () => {
    const sans = computeImplicationGrade({ totalParticipations: 9, malus: 3, absences: 0 }, config());
    const avec = computeImplicationGrade({ totalParticipations: 9, malus: 3, absences: 0 }, config({ bavardage_penalty: true }));
    expect(sans.effectiveParticipations).toBe(9);
    expect(sans.grade).toBeCloseTo(12, 10);
    expect(avec.effectiveParticipations).toBe(6);
    expect(avec.grade).toBeCloseTo(8, 10);
  });

  it('ne descend pas sous zéro quand les bavardages dépassent les participations', () => {
    const g = computeImplicationGrade({ totalParticipations: 2, malus: 5, absences: 0 }, config({ bavardage_penalty: true }));
    expect(g.effectiveParticipations).toBe(0);
    expect(g.grade).toBe(0);
  });

  it('applique 15 participations sur 60 séances à une classe sans réglage', () => {
    const g = computeImplicationGrade({ totalParticipations: 15, malus: 0, absences: 0 }, undefined);
    expect(g.targetParticipations).toBe(15);
    expect(g.totalSessionsExpected).toBe(60);
    expect(g.malusPenalty).toBe(false);
    expect(g.baseGrade).toBeNull();
    expect(g.grade).toBe(20);
  });
});

describe('computeImplicationGrade, mode « note de base »', () => {
  it('ajoute les participations à la note de base', () => {
    const g = computeImplicationGrade({ totalParticipations: 4, malus: 2, absences: 0 }, config({ base_grade: 10 }));
    expect(g.grade).toBe(14);
    expect(g.bonus).toBe(0);
  });

  it('retire les bavardages quand la pénalité est active, et borne à zéro', () => {
    const g = computeImplicationGrade({ totalParticipations: 4, malus: 2, absences: 0 }, config({ base_grade: 10, bavardage_penalty: true }));
    expect(g.grade).toBe(12);
    const bas = computeImplicationGrade({ totalParticipations: 0, malus: 30, absences: 0 }, config({ base_grade: 10, bavardage_penalty: true }));
    expect(bas.grade).toBe(0);
  });

  it('plafonne à 20 et met le dépassement en bonus', () => {
    const g = computeImplicationGrade({ totalParticipations: 13, malus: 0, absences: 0 }, config({ base_grade: 10 }));
    expect(g.grade).toBe(20);
    expect(g.bonus).toBe(3);
  });

  it('revient au mode « objectif » pour une note de base à zéro', () => {
    const g = computeImplicationGrade({ totalParticipations: 6, malus: 0, absences: 0 }, config({ base_grade: 0 }));
    expect(g.grade).toBeCloseTo(8, 10);
  });
});

describe('buildStudentGrades', () => {
  const student = (over: Partial<StudentRow> = {}): StudentRow => ({
    id: 'eleve-1',
    pseudo: 'Lina Bo',
    class_id: 'classe-1',
    created_at: '2026-09-01T08:00:00Z',
    gender: 'F',
    student_code: '123456',
    is_witness: false,
    has_pap: false,
    has_ppre: false,
    has_pai: false,
    classes: { name: '5D' },
    ...over,
  });
  const event = (id: string, studentId: string, type: string, timestamp = '2026-10-01T09:00:00Z'): EventRow => ({
    id, student_id: studentId, session_id: 'seance-1', type, subtype: null, note: null, timestamp,
  });
  const empty = { events: [], manualParticipations: [], archivedGrades: [], oralEvaluations: [], classConfigs: new Map<string, ClassConfig>() };

  it('compte les événements de chaque élève par type', () => {
    const [lina, noe] = buildStudentGrades({
      ...empty,
      students: [student(), student({ id: 'eleve-2', pseudo: 'Noé Ma', gender: 'M' })],
      events: [
        event('e1', 'eleve-1', 'participation'),
        event('e2', 'eleve-1', 'participation'),
        event('e3', 'eleve-1', 'bavardage'),
        event('e4', 'eleve-1', 'absence'),
        event('e5', 'eleve-1', 'remarque'),
        event('e6', 'eleve-2', 'participation'),
      ],
    });
    expect([lina.participations, lina.malus, lina.absences]).toEqual([2, 1, 1]);
    expect(lina.events).toHaveLength(5);
    expect([noe.participations, noe.malus, noe.absences]).toEqual([1, 0, 0]);
  });

  it('ajoute les participations saisies à la main', () => {
    const [lina] = buildStudentGrades({
      ...empty,
      students: [student()],
      events: [event('e1', 'eleve-1', 'participation')],
      manualParticipations: [
        { id: 'm1', student_id: 'eleve-1', trimester: 1, school_year: '2026-2027', count: 3, reason: 'exposé', created_at: null },
        { id: 'm2', student_id: 'eleve-2', trimester: 1, school_year: '2026-2027', count: 9, reason: null, created_at: null },
      ],
    });
    expect(lina.manualParticipations).toBe(3);
    expect(lina.totalParticipations).toBe(4);
    expect(lina.manualParticipationsList.map((m) => m.id)).toEqual(['m1']);
  });

  it('applique le réglage de la classe de l’élève', () => {
    const classConfigs = new Map([['classe-1', config({ base_grade: 12 })]]);
    const [lina] = buildStudentGrades({ ...empty, students: [student()], events: [event('e1', 'eleve-1', 'participation')], classConfigs });
    expect(lina.baseGrade).toBe(12);
    expect(lina.grade).toBe(13);
  });

  it('garde un ancien élève sans classe, avec les réglages par défaut', () => {
    const [ancien] = buildStudentGrades({ ...empty, students: [student({ class_id: null, classes: null })] });
    expect(ancien.student.class_id).toBeNull();
    expect(ancien.student.class_name).toBe('Classe inconnue');
    expect(ancien.targetParticipations).toBe(15);
    expect(ancien.grade).toBe(0);
  });

  it('convertit en nombres les notes archivées rendues en texte, et rattache l’oral', () => {
    const [lina] = buildStudentGrades({
      ...empty,
      students: [student()],
      archivedGrades: [{
        student_id: 'eleve-1', trimester: 1, school_year: '2025-2026', class_name: null, participations: 10, absences: 2,
        target_participations: 15, adjusted_target: '14.50', grade: '13.79', bonus: '0', archived_at: '2025-12-01T00:00:00Z',
      }],
      oralEvaluations: [{ id: 'o1', student_id: 'eleve-1', class_id: 'classe-1', user_id: 'prof', trimester: 1, school_year: '2026-2027', grade: 4, evaluated_at: null }],
    });
    expect(lina.archivedGrades[0]).toMatchObject({ adjusted_target: 14.5, grade: 13.79, bonus: 0 });
    expect(lina.oralEvaluation?.grade).toBe(4);
  });

  it('lit le genre, l’élève témoin et les aménagements tels que la base les rend', () => {
    const [a, b] = buildStudentGrades({
      ...empty,
      students: [
        student({ gender: null, is_witness: null, has_pap: null, student_code: null }),
        student({ id: 'eleve-2', gender: 'M', is_witness: true, has_pap: true }),
      ],
    });
    expect(a.student).toMatchObject({ gender: 'M', is_witness: false, has_pap: false });
    expect(a.student.student_code).toBeUndefined();
    expect(b.student).toMatchObject({ gender: 'M', is_witness: true, has_pap: true });
  });
});
