import { describe, expect, it } from 'vitest';
import {
  bandDepth,
  detectTalkers,
  distanceToBack,
  distanceToFront,
  generateSeating,
  listSeats,
  parseSeatKey,
  seededRng,
  type SeatingConstraint,
  type SeatingStudentInfo,
} from '../seatingAuto';

const room = { grid_rows: 4, grid_cols: 5, disabled_cells: ['0,2', '1,2', '2,2', '3,2'] }; // allée centrale

const students = (n: number, extra: Partial<SeatingStudentInfo>[] = []): SeatingStudentInfo[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, pseudo: `Élève ${i}`, gender: i % 2 ? 'F' : 'M', ...(extra[i] || {}) }));

const seatOf = (positions: Record<string, string>, id: string) => {
  const key = Object.keys(positions).find((k) => positions[k] === id);
  return key ? parseSeatKey(key) : null;
};

describe('grille', () => {
  it('liste les sièges actifs seulement', () => {
    const seats = listSeats(room);
    expect(seats).toHaveLength(16);
    expect(seats.every((s) => s.col !== 2)).toBe(true);
  });

  it('devant = rangée d’indice élevé (tableau en bas)', () => {
    expect(bandDepth(4)).toBe(2);
    expect(distanceToFront(3, 4)).toBe(0);
    expect(distanceToFront(2, 4)).toBe(0);
    expect(distanceToFront(0, 4)).toBe(2);
    expect(distanceToBack(0, 4)).toBe(0);
    expect(distanceToBack(3, 4)).toBe(2);
  });
});

describe('generateSeating', () => {
  it('place tout le monde sans doublon et sans case désactivée', () => {
    const res = generateSeating({ students: students(12), room, constraints: [], rng: seededRng(1) });
    const ids = Object.values(res.positions);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(Object.keys(res.positions).every((k) => !k.startsWith('0-2') && parseSeatKey(k)?.col !== 2)).toBe(true);
    expect(res.unplaced).toEqual([]);
  });

  it('signale les élèves en trop quand la salle est pleine', () => {
    const res = generateSeating({ students: students(20), room, constraints: [], rng: seededRng(2) });
    expect(Object.keys(res.positions)).toHaveLength(16);
    expect(res.unplaced).toHaveLength(4);
  });

  it('respecte devant / au fond', () => {
    const constraints: SeatingConstraint[] = [
      { id: 'c1', student_id: 's0', kind: 'front' },
      { id: 'c2', student_id: 's1', kind: 'back' },
    ];
    const res = generateSeating({ students: students(12), room, constraints, rng: seededRng(3), rules: { fillFromFront: false } });
    expect(seatOf(res.positions, 's0')!.row).toBeGreaterThanOrEqual(2);
    expect(seatOf(res.positions, 's1')!.row).toBeLessThanOrEqual(1);
    expect(res.violations).toEqual([]);
  });

  it('respecte à côté de / pas à côté de / éloigné de', () => {
    const constraints: SeatingConstraint[] = [
      { id: 'c1', student_id: 's0', kind: 'next_to', other_student_id: 's1' },
      { id: 'c2', student_id: 's2', kind: 'not_next_to', other_student_id: 's3' },
      { id: 'c3', student_id: 's4', kind: 'far_from', other_student_id: 's5', params: { minDistance: 3 } },
    ];
    const res = generateSeating({ students: students(14), room, constraints, rng: seededRng(4) });
    const a = seatOf(res.positions, 's0')!;
    const b = seatOf(res.positions, 's1')!;
    expect(a.row).toBe(b.row);
    expect(Math.abs(a.col - b.col)).toBe(1);
    const c = seatOf(res.positions, 's2')!;
    const d = seatOf(res.positions, 's3')!;
    expect(Math.max(Math.abs(c.row - d.row), Math.abs(c.col - d.col))).toBeGreaterThan(1);
    const e = seatOf(res.positions, 's4')!;
    const f = seatOf(res.positions, 's5')!;
    expect(Math.max(Math.abs(e.row - f.row), Math.abs(e.col - f.col))).toBeGreaterThanOrEqual(3);
    expect(res.violations).toEqual([]);
  });

  it('garde la place d’un élève verrouillé et de tous les placés avec keepPlaced', () => {
    const current = { '0-0': 's0', '3-4': 's1' };
    const constraints: SeatingConstraint[] = [{ id: 'c1', student_id: 's0', kind: 'fixed' }];
    const res = generateSeating({ students: students(10), room, constraints, currentPositions: current, rng: seededRng(5) });
    expect(res.positions['0-0']).toBe('s0');

    const kept = generateSeating({ students: students(10), room, constraints: [], currentPositions: current, rng: seededRng(6), rules: { keepPlaced: true } });
    expect(kept.positions['0-0']).toBe('s0');
    expect(kept.positions['3-4']).toBe('s1');
  });

  it('met les élèves PAP devant par défaut', () => {
    const list = students(12, [{}, {}, {}, {}, {}, { has_pap: true }]);
    const res = generateSeating({ students: list, room, constraints: [], rng: seededRng(7) });
    expect(seatOf(res.positions, 's5')!.row).toBeGreaterThanOrEqual(2);
  });

  it('seul à sa table : aucun voisin latéral', () => {
    const res = generateSeating({
      students: students(8), room,
      constraints: [{ id: 'c1', student_id: 's0', kind: 'alone' }],
      rng: seededRng(8),
    });
    const a = seatOf(res.positions, 's0')!;
    expect(res.positions[`${a.row}-${a.col - 1}`]).toBeUndefined();
    expect(res.positions[`${a.row}-${a.col + 1}`]).toBeUndefined();
  });

  it('liste les contraintes impossibles au lieu d’échouer', () => {
    // 3 élèves qui doivent tous être seuls et devant, dans une salle de 2 rangées x 2 : impossible
    const tiny = { grid_rows: 1, grid_cols: 3, disabled_cells: [] };
    const constraints: SeatingConstraint[] = [
      { id: 'c1', student_id: 's0', kind: 'alone' },
      { id: 'c2', student_id: 's1', kind: 'alone' },
      { id: 'c3', student_id: 's2', kind: 'alone' },
    ];
    const res = generateSeating({ students: students(3), room: tiny, constraints, rng: seededRng(9) });
    expect(Object.keys(res.positions)).toHaveLength(3);
    expect(res.violations.length).toBeGreaterThan(0);
    expect(res.violations[0].message).toContain('seul');
  });

  it('est reproductible à graine égale', () => {
    const a = generateSeating({ students: students(12), room, constraints: [], rng: seededRng(42) });
    const b = generateSeating({ students: students(12), room, constraints: [], rng: seededRng(42) });
    expect(a.positions).toEqual(b.positions);
  });

  it('ignore les contraintes qui visent un élève absent de la classe', () => {
    const res = generateSeating({
      students: students(4), room,
      constraints: [{ id: 'c1', student_id: 'inconnu', kind: 'front' }, { id: 'c2', student_id: 's0', kind: 'next_to', other_student_id: 'parti' }],
      rng: seededRng(10),
    });
    expect(res.violations).toEqual([]);
  });
});

describe('detectTalkers', () => {
  it('retient les élèves nettement au-dessus de la médiane des malus', () => {
    const list = students(6, [{ malus: 0 }, { malus: 1 }, { malus: 0 }, { malus: 6 }, { malus: 5 }, { malus: 0 }]);
    const t = detectTalkers(list);
    expect(t.has('s3')).toBe(true);
    expect(t.has('s4')).toBe(true);
    expect(t.has('s1')).toBe(false);
  });
});
