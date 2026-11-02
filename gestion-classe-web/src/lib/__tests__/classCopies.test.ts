import { describe, expect, it } from 'vitest';
import {
  addPagesToStudent,
  assignBundle,
  assignInOrder,
  checkBeforeSend,
  mergeWithNext,
  nextStudentWithout,
  reassignFrom,
  shiftEdgePage,
  splitBundle,
  splitIntoBundles,
  suggestPagesPerCopy,
  updatePages,
  UNNAMED,
  type Bundle,
} from '../classCopies';

const ids = () => {
  let n = 0;
  return () => `n${++n}`;
};
const pagesOf = (bs: Bundle<string>[]) => bs.map((b) => b.pages.join(''));
const studentsOf = (bs: Bundle<string>[]) => bs.map((b) => b.studentId);

describe('suggestPagesPerCopy', () => {
  it('prend le nombre de pages le plus fréquent', () => {
    expect(suggestPagesPerCopy([2, 3, 2, 2, 4])).toBe(2);
  });
  it('à égalité, prend le plus grand', () => {
    expect(suggestPagesPerCopy([2, 3, 3, 2])).toBe(3);
  });
  it('sans copie rangée, rend la valeur par défaut', () => {
    expect(suggestPagesPerCopy([])).toBe(2);
    expect(suggestPagesPerCopy([0, 0], 4)).toBe(4);
  });
});

describe('découpage et attribution', () => {
  it('découpe en copies de N pages, la dernière plus courte', () => {
    expect(pagesOf(splitIntoBundles(['a', 'b', 'c', 'd', 'e'], 2, ids()))).toEqual(['ab', 'cd', 'e']);
  });
  it('attribue dans l’ordre et laisse les copies en trop sans élève', () => {
    const bs = assignInOrder(splitIntoBundles(['a', 'b', 'c'], 1, ids()), ['s1', 's2']);
    expect(studentsOf(bs)).toEqual(['s1', 's2', null]);
  });
  it('glisser une copie sur un élève déjà pris échange les deux élèves', () => {
    const bs = assignInOrder(splitIntoBundles(['a', 'b', 'c'], 1, ids()), ['s1', 's2', 's3']);
    expect(studentsOf(assignBundle(bs, bs[0].id, 's3'))).toEqual(['s3', 's2', 's1']);
  });
  it('un absent retiré décale la suite d’un cran', () => {
    const bs = assignInOrder(splitIntoBundles(['a', 'b', 'c'], 1, ids()), ['s1', 's2', 's3']);
    // s2 était absent : sa copie était en fait celle de s3, et la suivante est en trop.
    expect(studentsOf(reassignFrom(bs, 1, ['s1', 's3']))).toEqual(['s1', 's3', null]);
  });
  it('reprend après le dernier élève attribué, pas au début de la liste', () => {
    const bs: Bundle<string>[] = [
      { id: '1', pages: ['a'], studentId: 's3' },
      { id: '2', pages: ['b'], studentId: null },
    ];
    expect(studentsOf(reassignFrom(bs, 1, ['s1', 's2', 's3', 's4']))).toEqual(['s3', 's4']);
  });
  it('retirer l’élève d’une copie ne touche pas aux autres', () => {
    const bs = assignInOrder(splitIntoBundles(['a', 'b'], 1, ids()), ['s1', 's2']);
    expect(studentsOf(assignBundle(bs, bs[1].id, null))).toEqual(['s1', null]);
  });
});

describe('couper, fusionner, déplacer', () => {
  const base = () => assignInOrder(splitIntoBundles(['a', 'b', 'c', 'd'], 2, ids()), ['s1', 's2']);

  it('coupe une copie : la seconde moitié est sans élève', () => {
    const bs = base();
    const out = splitBundle(bs, bs[0].id, 1, () => 'x');
    expect(pagesOf(out)).toEqual(['a', 'b', 'cd']);
    expect(studentsOf(out)).toEqual(['s1', null, 's2']);
  });
  it('ne coupe pas au bord', () => {
    const bs = base();
    expect(splitBundle(bs, bs[0].id, 0)).toBe(bs);
    expect(splitBundle(bs, bs[0].id, 2)).toBe(bs);
  });
  it('fusionne avec la suivante en gardant le premier élève', () => {
    const bs = base();
    const out = mergeWithNext(bs, bs[0].id);
    expect(pagesOf(out)).toEqual(['abcd']);
    expect(studentsOf(out)).toEqual(['s1']);
  });
  it('fait passer une page de bord dans la copie voisine', () => {
    const bs = base();
    expect(pagesOf(shiftEdgePage(bs, bs[1].id, -1))).toEqual(['abc', 'd']);
    expect(pagesOf(shiftEdgePage(bs, bs[0].id, 1))).toEqual(['a', 'bcd']);
  });
  it('une copie vidée disparaît', () => {
    const bs = assignInOrder(splitIntoBundles(['a', 'b', 'c'], 2, ids()), ['s1', 's2']);
    const out = shiftEdgePage(bs, bs[1].id, -1);
    expect(pagesOf(out)).toEqual(['abc']);
    const two = base();
    expect(pagesOf(updatePages(two, two[0].id, () => []))).toEqual(['cd']);
  });
});

describe('webcam en file', () => {
  it('ajoute à la copie de l’élève ou la crée', () => {
    let bs: Bundle<string>[] = [];
    bs = addPagesToStudent(bs, 's1', ['a'], () => 'x');
    bs = addPagesToStudent(bs, 's1', ['b']);
    bs = addPagesToStudent(bs, 's2', ['c'], () => 'y');
    expect(pagesOf(bs)).toEqual(['ab', 'c']);
    expect(studentsOf(bs)).toEqual(['s1', 's2']);
  });
  it('passe au prochain élève sans copie, en bouclant', () => {
    const bs = [{ id: 'x', pages: ['a'], studentId: 's2' }];
    expect(nextStudentWithout(bs, ['s1', 's2', 's3'], 's1')).toBe('s3');
    expect(nextStudentWithout(bs, ['s1', 's2', 's3'], 's3')).toBe('s1');
    expect(nextStudentWithout(bs, ['s1', 's2', 's3'], null)).toBe('s1');
    expect(nextStudentWithout(bs, ['s2'], 's2')).toBeNull();
  });
});

describe('Pas de nom', () => {
  const mixed = (): Bundle<string>[] => [
    { id: '1', pages: ['a'], studentId: null },
    { id: '2', pages: ['b'], studentId: UNNAMED },
    { id: '3', pages: ['c'], studentId: null },
  ];
  it('l’attribution dans l’ordre laisse les copies sans nom à leur place', () => {
    expect(studentsOf(assignInOrder(mixed(), ['s1', 's2']))).toEqual(['s1', UNNAMED, 's2']);
  });
  it('réattribuer d’ici saute les copies sans nom', () => {
    const bs = assignInOrder(mixed(), ['s1', 's2', 's3']);
    expect(studentsOf(reassignFrom(bs, 1, ['s1', 's3']))).toEqual(['s1', UNNAMED, 's3']);
  });
  it('plusieurs copies peuvent être sans nom, sans échange', () => {
    const bs = mixed();
    expect(studentsOf(assignBundle(bs, '1', UNNAMED))).toEqual([UNNAMED, UNNAMED, null]);
  });
  it('une copie sans nom posée sur un élève laisse l’autre copie à attribuer', () => {
    const bs: Bundle<string>[] = [
      { id: '1', pages: ['a'], studentId: UNNAMED },
      { id: '2', pages: ['b'], studentId: 's1' },
    ];
    expect(studentsOf(assignBundle(bs, '1', 's1'))).toEqual(['s1', null]);
  });
  it('part à l’envoi sans demander de version', () => {
    const check = checkBeforeSend(mixed(), () => '', ['v4', 'v5']);
    expect(check).toEqual({ ready: 1, unassigned: 2, missingVersion: [] });
  });
});

describe('checkBeforeSend', () => {
  const bs: Bundle<string>[] = [
    { id: '1', pages: ['a'], studentId: 's1' },
    { id: '2', pages: ['b'], studentId: 's2' },
    { id: '3', pages: ['c'], studentId: null },
  ];
  it('compte les copies prêtes et sans élève', () => {
    expect(checkBeforeSend(bs, () => '', ['v1'])).toEqual({ ready: 2, unassigned: 1, missingVersion: [] });
  });
  it('exige une version par élève quand il y en a plusieurs', () => {
    const versions: Record<string, string> = { s1: 'v4' };
    expect(checkBeforeSend(bs, (id) => versions[id] ?? '', ['v4', 'v5']).missingVersion).toEqual(['s2']);
  });
});
