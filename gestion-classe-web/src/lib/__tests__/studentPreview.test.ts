import { describe, expect, it } from 'vitest';
import { filterPreviewClasses, groupPreviewStudents, isStudentCode, studentSpaceUrl } from '../studentPreview';

const classes = [
  { id: 'c4b', name: '4B' },
  { id: 'c3a', name: '3A' },
  { id: 'c10', name: '10e essai' },
  { id: 'cvide', name: '5C' },
];
const row = (id: string, pseudo: string, class_id: string | null, student_code: string | null, is_witness = false) =>
  ({ id, pseudo, class_id, student_code, is_witness });

describe('groupPreviewStudents', () => {
  const grouped = groupPreviewStudents(classes, [
    row('1', 'Zoé Ma', 'c4b', '123456'),
    row('2', 'Élise Do', 'c4b', '234567'),
    row('3', 'Témoin Te', 'c4b', '345678', true),
    row('4', 'Adam Be', 'c3a', '456789'),
    row('5', 'Sans Co', 'c3a', null),
    row('6', 'Mauvais Co', 'c3a', '12AB56'),
    row('7', 'Hors Cl', null, '567890'),
    row('8', 'Classe In', 'inconnue', '678901'),
    row('9', 'Dix Di', 'c10', '789012'),
  ]);

  it('trie les classes par nom, en tenant compte des nombres', () => {
    expect(grouped.map((c) => c.name)).toEqual(['3A', '4B', '10e essai']);
  });

  it('met l’élève témoin en tête, puis les élèves par ordre alphabétique', () => {
    expect(grouped.find((c) => c.id === 'c4b')!.students.map((s) => s.pseudo)).toEqual(['Témoin Te', 'Élise Do', 'Zoé Ma']);
  });

  it('laisse de côté les élèves sans code valide, sans classe ou d’une classe inconnue, et les classes vides', () => {
    expect(grouped.find((c) => c.id === 'c3a')!.students.map((s) => s.id)).toEqual(['4']);
    expect(grouped.flatMap((c) => c.students.map((s) => s.id))).not.toContain('7');
    expect(grouped.flatMap((c) => c.students.map((s) => s.id))).not.toContain('8');
    expect(grouped.map((c) => c.id)).not.toContain('cvide');
  });
});

describe('filterPreviewClasses', () => {
  const grouped = groupPreviewStudents(classes, [
    row('1', 'Éloïse Ma', 'c4b', '123456'),
    row('2', 'Paul Do', 'c4b', '234567'),
    row('3', 'Paula Be', 'c3a', '123999'),
  ]);

  it('rend la liste telle quelle sans recherche', () => {
    expect(filterPreviewClasses(grouped, '  ')).toBe(grouped);
  });

  it('cherche dans le pseudo, sans tenir compte des accents ni de la casse', () => {
    const r = filterPreviewClasses(grouped, 'eloise');
    expect(r.flatMap((c) => c.students.map((s) => s.id))).toEqual(['1']);
  });

  it('cherche par début de code, dans toutes les classes', () => {
    const r = filterPreviewClasses(grouped, '123');
    expect(r.flatMap((c) => c.students.map((s) => s.id)).sort()).toEqual(['1', '3']);
  });

  it('garde toute une classe quand on tape son nom', () => {
    const r = filterPreviewClasses(grouped, '4b');
    expect(r.map((c) => c.id)).toEqual(['c4b']);
    expect(r[0].students).toHaveLength(2);
  });
});

describe('codes et adresse', () => {
  it('reconnaît un code à six chiffres', () => {
    expect(isStudentCode('012345')).toBe(true);
    expect(isStudentCode('12345')).toBe(false);
    expect(isStudentCode(null)).toBe(false);
  });

  it('construit l’adresse de l’espace élève connecté', () => {
    expect(studentSpaceUrl('/gestion-classe/', '012345')).toBe('/gestion-classe/eleve?code=012345');
    expect(studentSpaceUrl('/', '012345')).toBe('/eleve?code=012345');
  });
});
