import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_BYTES,
  STORAGE_QUOTA_BYTES,
  courseFileKind,
  filesOfSequence,
  formatBytes,
  refuseCourseFile,
  renamedFile,
  storagePathFor,
  usageLevel,
  type CourseFile,
} from '../courseFiles';

const MO = 1024 * 1024;

describe('courseFileKind', () => {
  it('reconnaît les types acceptés, sans tenir compte de la casse', () => {
    expect(courseFileKind('Documents élèves.PDF')).toBe('pdf');
    expect(courseFileKind('carte.png')).toBe('image');
    expect(courseFileKind('consigne.m4a')).toBe('audio');
    expect(courseFileKind('Fiche_eleve.docx')).toBe('document');
  });

  it('refuse le reste', () => {
    expect(courseFileKind('film.mp4')).toBeNull();
    expect(courseFileKind('archive.zip')).toBeNull();
    expect(courseFileKind('sans-extension')).toBeNull();
  });
});

describe('refuseCourseFile', () => {
  it('accepte un PDF de taille raisonnable', () => {
    expect(refuseCourseFile({ name: 'doc.pdf', size: 2 * MO }, 300 * MO)).toBeNull();
  });

  it('explique qu’une vidéo se met en lien', () => {
    expect(refuseCourseFile({ name: 'volcan.mp4', size: 5 * MO }, 0)).toMatch(/vidéo/);
  });

  it('refuse un type inconnu, un fichier trop lourd, un fichier vide', () => {
    expect(refuseCourseFile({ name: 'archive.zip', size: MO }, 0)).toMatch(/n'est pas accepté/);
    expect(refuseCourseFile({ name: 'gros.pdf', size: MAX_FILE_BYTES + 1 }, 0)).toMatch(/plafond/);
    expect(refuseCourseFile({ name: 'vide.pdf', size: 0 }, 0)).toMatch(/vide/);
  });

  it('refuse ce qui ferait dépasser le stockage, sauf si la jauge est inconnue', () => {
    const almostFull = STORAGE_QUOTA_BYTES - MO;
    expect(refuseCourseFile({ name: 'doc.pdf', size: 2 * MO }, almostFull)).toMatch(/Plus assez de place/);
    expect(refuseCourseFile({ name: 'doc.pdf', size: 2 * MO }, null)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('écrit la taille à la française', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(320 * 1024)).toBe('320 Ko');
    expect(formatBytes(1.4 * MO)).toBe('1,4 Mo');
    expect(formatBytes(320 * MO)).toBe('320 Mo');
    expect(formatBytes(STORAGE_QUOTA_BYTES)).toBe('1,00 Go');
  });
});

describe('storagePathFor', () => {
  it('range le fichier dans le dossier du professeur, sans son nom d’origine', () => {
    expect(storagePathFor('u1', 'f1', 'Fiche élève — activité 3.DOCX')).toBe('u1/f1.docx');
    expect(storagePathFor('u1', 'f1', 'sans-extension')).toBe('u1/f1');
  });
});

describe('filesOfSequence', () => {
  const file = (id: string, name: string, level: string | null, chapter: string): CourseFile => ({
    id, name, level, chapter, storagePath: `u/${id}`, mime: null, size: 1, createdAt: '2026-11-15T08:00:00Z',
  });
  const files = [
    file('1', 'Document 10.pdf', '4e', 'Séquence 2'),
    file('2', 'Document 2.pdf', '4e', 'Séquence 2'),
    file('3', 'Autre.pdf', '3e', 'Séquence 2'),
    file('4', 'Sans niveau.pdf', null, 'Séquence 2'),
  ];

  it('garde les fichiers de la séquence, triés par nom', () => {
    expect(filesOfSequence(files, '4e', 'Séquence 2').map((f) => f.id)).toEqual(['2', '1']);
  });

  it('distingue deux séquences de même nom dans deux niveaux, et le « sans niveau »', () => {
    expect(filesOfSequence(files, '3e', 'Séquence 2').map((f) => f.id)).toEqual(['3']);
    expect(filesOfSequence(files, null, 'Séquence 2').map((f) => f.id)).toEqual(['4']);
  });
});

describe('renamedFile', () => {
  it('remet l’extension quand elle a été retirée', () => {
    expect(renamedFile('doc.pdf', 'Documents élèves')).toBe('Documents élèves.pdf');
    expect(renamedFile('doc.pdf', 'Documents élèves.pdf')).toBe('Documents élèves.pdf');
  });

  it('garde le nom d’origine pour une saisie vide', () => {
    expect(renamedFile('doc.pdf', '   ')).toBe('doc.pdf');
  });
});

describe('usageLevel', () => {
  it('prévient à 80 % et dit plein à 95 %', () => {
    expect(usageLevel(320 * MO)).toBe('ok');
    expect(usageLevel(0.8 * STORAGE_QUOTA_BYTES)).toBe('warn');
    expect(usageLevel(0.95 * STORAGE_QUOTA_BYTES)).toBe('full');
  });
});
