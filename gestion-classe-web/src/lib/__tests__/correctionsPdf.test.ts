import { describe, expect, it } from 'vitest';
import {
  appreciation,
  buildCorrectionsPdf,
  correctionsPdfName,
  evaluationTitle,
  fmt,
  pdfText,
  questionSuccess,
  sheetsPerPage,
  type CorrectionSheet,
} from '../correctionsPdf';
import type { GradeDetails } from '../gradeDetails';

const details = (points: number[], n = points.length): GradeDetails => ({
  version: null,
  baremeTotal: n,
  noteBrute: points.reduce((a, b) => a + b, 0),
  noteForcee: false,
  questions: Array.from({ length: n }, (_, i) => ({
    label: `Q${i + 1}`,
    bareme: 1,
    points: points[i] ?? 0,
    commentaire: `Commentaire ${i + 1} : c’est l’œuvre — « bien ».`,
    competences: ['Restituer'],
  })),
  competences: [
    { nom: 'Restituer mes connaissances', niveau: 'Satisfaisante' },
    { nom: 'Raisonner sur un phénomène', niveau: 'Fragile' },
    { nom: 'Exploiter des documents', niveau: 'Très bonne maîtrise' },
  ],
  forces: 'Vocabulaire précis.',
  faiblesses: 'Explications courtes.',
  commentaire: 'Bon travail, continue.',
});

const sheet = (pseudo: string, grade: number, d: GradeDetails, validated = true): CorrectionSheet => ({ pseudo, grade, validated, details: d });

describe('pdfText', () => {
  it('garde accents et typographie française', () => {
    expect(pdfText('é è à ç — ’ œ … « »')).toBe('é è à ç — ’ œ … « »');
  });
  it('remplace ce que les polices standard ne savent pas écrire', () => {
    expect(pdfText('x ≥ 2 → y !')).toBe('x >= 2 -> y !');
    // ř n'existe pas en WinAnsi : sans son accent ; á y existe : gardé ; l'emoji disparaît.
    expect(pdfText('Dvořák 🌋')).toBe('Dvorák ');
  });
});

describe('petits calculs', () => {
  it('appréciation comme le Correcteur', () => {
    expect([16, 14, 12, 10, 7, 6.5].map(appreciation)).toEqual(['Très bien', 'Bien', 'Assez bien', 'Satisfaisant', 'Fragile', 'Insuffisant']);
  });
  it('nombres à la française', () => {
    expect(fmt(15.5)).toBe('15,5');
    expect(fmt(0.25)).toBe('0,25');
    expect(fmt(null)).toBe('—');
  });
  it('2 fiches par page jusqu’à 12 lignes de barème', () => {
    expect(sheetsPerPage(12)).toBe(2);
    expect(sheetsPerPage(13)).toBe(1);
  });
  it('réussite moyenne par question, sur le même barème seulement', () => {
    const other = { ...details([1]), questions: [{ label: 'Autre', bareme: 1, points: 1, commentaire: '', competences: [] }] };
    const rows = questionSuccess([sheet('A', 10, details([1, 0.5])), sheet('B', 5, details([0, 0.5])), sheet('C', 1, other)]);
    expect(rows.map((r) => [r.label, r.rate])).toEqual([['Q1', 0.5], ['Q2', 0.5]]);
  });
  it('nom de fichier et titre de l’éval', () => {
    expect(correctionsPdfName('4D', 'Séquence 1 : volcans')).toBe('Correction_4D_Sequence_1_volcans.pdf');
    expect(correctionsPdfName('4D', 'Séquence 1', 'Nathan HE.')).toBe('Correction_4D_Sequence_1_Nathan_HE.pdf');
    expect(evaluationTitle([null, { v: 1 }, { evaluation: ' Volcans ' }])).toBe('Volcans');
    expect(evaluationTitle([{}])).toBeNull();
  });
});

describe('buildCorrectionsPdf', () => {
  const input = (sheets: CorrectionSheet[], summary = false) => ({ assessmentName: 'Sequence 1', className: '4D', sheets, summary });

  it('met 2 fiches courtes par page, et une par page pour un long barème', () => {
    const short = [1, 2, 3, 4].map((i) => sheet(`Élève ${i}`, 12, details([1, 0, 1])));
    expect(buildCorrectionsPdf(input(short)).getNumberOfPages()).toBe(2);
    const long = [1, 2, 3].map((i) => sheet(`Élève ${i}`, 12, details(Array(19).fill(0.5))));
    expect(buildCorrectionsPdf(input(long)).getNumberOfPages()).toBe(3);
  });

  it('ajoute le récapitulatif en tête', () => {
    const one = [sheet('Léa', 14, details(Array(19).fill(1)))];
    expect(buildCorrectionsPdf(input(one, true)).getNumberOfPages()).toBe(2);
  });

  it('produit une page même sans fiche', () => {
    expect(buildCorrectionsPdf(input([])).getNumberOfPages()).toBe(1);
  });
});
