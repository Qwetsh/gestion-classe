import { describe, expect, it } from 'vitest';
import {
  alignTranscript,
  describeKeptCopies,
  parseTranscript,
  planCopyPurge,
  questionKey,
} from '../copyTranscript';
import type { DetailQuestion } from '../gradeDetails';

const q = (label: string, points = 1, bareme = 2): DetailQuestion => ({
  label,
  points,
  bareme,
  commentaire: '',
  competences: [],
});

describe('parseTranscript', () => {
  it('lit les passages dans l’ordre de la copie, sauts de ligne compris', () => {
    expect(
      parseTranscript({ v: 1, items: [{ q: 'Q1', texte: 'Le magma\nest fondu' }, { q: 'Partie 2', texte: '…' }] }),
    ).toEqual([
      { q: 'Q1', texte: 'Le magma\nest fondu' },
      { q: 'Partie 2', texte: '…' },
    ]);
  });

  it('ignore ce qui est mal formé et renvoie null sans passage', () => {
    expect(parseTranscript(null)).toBeNull();
    expect(parseTranscript({ v: 1 })).toBeNull();
    expect(parseTranscript({ items: [null, 3, { q: '', texte: '  ' }] })).toBeNull();
    expect(parseTranscript({ items: [{ q: 'Q2' }] })).toEqual([{ q: 'Q2', texte: '' }]);
  });
});

describe('questionKey', () => {
  it('rapproche les libellés du Correcteur et ceux du barème', () => {
    expect(questionKey('Q1')).toBe('q1');
    expect(questionKey('Q1 Magma et lave')).toBe('q1');
    expect(questionKey('Q12 Répartition, plaques')).toBe('q12');
    expect(questionKey('Partie 2')).toBe('p2');
    expect(questionKey("P2 · J'observe")).toBe('p2');
  });
});

describe('alignTranscript', () => {
  const questions = [q('Q1 Magma et lave'), q('Q2 Viscosité'), q("P2 · J'observe"), q('P2 · Rédaction structurée')];

  it('met chaque passage en face de ses questions, la rédaction en face de toute la partie', () => {
    const blocks = alignTranscript(
      [
        { q: 'Q1', texte: 'roche fondue' },
        { q: 'Partie 2', texte: 'J’observe que…' },
      ],
      questions,
    );
    expect(blocks.map((b) => [b.q, b.texte, b.questions.map((x) => x.label)])).toEqual([
      ['Q1', 'roche fondue', ['Q1 Magma et lave']],
      ['Partie 2', 'J’observe que…', ["P2 · J'observe", 'P2 · Rédaction structurée']],
      ['Q2 Viscosité', null, ['Q2 Viscosité']],
    ]);
  });

  it('ne compte pas deux fois une réponse coupée sur deux pages', () => {
    const blocks = alignTranscript(
      [
        { q: 'Q1', texte: 'début' },
        { q: 'Q1', texte: 'suite' },
      ],
      [q('Q1 Magma')],
    );
    expect(blocks.map((b) => b.questions.length)).toEqual([1, 0]);
  });

  it('garde un passage sans question connue', () => {
    expect(alignTranscript([{ q: 'Bonus', texte: 'x' }], [])).toEqual([{ q: 'Bonus', texte: 'x', questions: [] }]);
  });
});

describe('planCopyPurge', () => {
  const pages = [
    { student_id: 'a', storage_path: 'u/e/a/1.jpg' },
    { student_id: 'a', storage_path: 'u/e/a/2.jpg' },
    { student_id: 'b', storage_path: 'u/e/b/1.jpg' },
  ];

  it('ne supprime que les pages des copies transcrites', () => {
    expect(planCopyPurge(pages, new Set(['a']))).toEqual({
      paths: ['u/e/a/1.jpg', 'u/e/a/2.jpg'],
      purgedStudents: ['a'],
      keptStudents: ['b'],
    });
  });

  it('garde tout sans transcription', () => {
    expect(planCopyPurge(pages, new Set()).paths).toEqual([]);
  });
});

describe('describeKeptCopies', () => {
  it('accorde au pluriel', () => {
    expect(describeKeptCopies(1)).toBe('1 copie sans transcription : scans conservés');
    expect(describeKeptCopies(3)).toBe('3 copies sans transcription : scans conservés');
  });
});
