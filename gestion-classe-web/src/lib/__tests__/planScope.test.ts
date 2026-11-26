import { describe, expect, it } from 'vitest';
import { groupSizes, keepPlacedStudents, studentsInScope } from '../planScope';

const students = [{ id: 'a', pseudo: 'Lina Bo' }, { id: 'b', pseudo: 'Noé Ma' }, { id: 'c', pseudo: 'Iris Ta' }];
const members = [
  { group_id: 'g1', student_id: 'a' },
  { group_id: 'g1', student_id: 'c' },
  { group_id: 'g2', student_id: 'b' },
];

describe('studentsInScope', () => {
  it('rend toute la classe quand aucun groupe n’est choisi', () => {
    expect(studentsInScope(students, members, null).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('rend les membres du groupe, dans l’ordre de la classe', () => {
    expect(studentsInScope(students, members, 'g1').map((s) => s.id)).toEqual(['a', 'c']);
    expect(studentsInScope(students, members, 'g2').map((s) => s.id)).toEqual(['b']);
  });

  it('rend une liste vide pour un groupe sans membre ou inconnu', () => {
    expect(studentsInScope(students, members, 'g9')).toEqual([]);
  });

  it('ignore un membre qui n’est plus dans la classe', () => {
    const withGhost = [...members, { group_id: 'g2', student_id: 'parti' }];
    expect(studentsInScope(students, withGhost, 'g2').map((s) => s.id)).toEqual(['b']);
  });
});

describe('keepPlacedStudents', () => {
  it('garde les places des élèves donnés et vide les autres', () => {
    const positions = { '0-0': 'a', '0-1': 'b', '1-0': 'c', '1-1': 'parti' };
    expect(keepPlacedStudents(positions, [{ id: 'a' }, { id: 'c' }])).toEqual({ '0-0': 'a', '1-0': 'c' });
  });

  it('accepte un plan absent', () => {
    expect(keepPlacedStudents(null, students)).toEqual({});
    expect(keepPlacedStudents(undefined, students)).toEqual({});
  });

  it('ne modifie pas le plan reçu', () => {
    const positions = { '0-0': 'a', '0-1': 'b' };
    keepPlacedStudents(positions, [{ id: 'a' }]);
    expect(positions).toEqual({ '0-0': 'a', '0-1': 'b' });
  });
});

describe('groupSizes', () => {
  it('compte les membres par groupe', () => {
    expect(groupSizes(members, students)).toEqual({ g1: 2, g2: 1 });
    expect(groupSizes([], students)).toEqual({});
  });

  it('ne compte pas un membre parti dans une autre classe', () => {
    expect(groupSizes([...members, { group_id: 'g1', student_id: 'parti' }], students)).toEqual({ g1: 2, g2: 1 });
  });
});
