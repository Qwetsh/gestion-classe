import { describe, expect, it } from 'vitest';
import { buildCopiesMarkdown, makeScrubber, studentLabels } from '../copiesMarkdown';

const roster = [
  { id: 'a', pseudo: 'Abigaël FA.' },
  { id: 'b', pseudo: 'Brahim AS.' },
  { id: 'c', pseudo: 'Marie-Lou DE.' },
];

describe('export Markdown pseudonymisé', () => {
  it('numérote dans l’ordre de la classe', () => {
    const labels = studentLabels(roster);
    expect(labels.get('a')).toBe('Élève 01');
    expect(labels.get('c')).toBe('Élève 03');
  });

  it('remplace prénoms, pseudos et noms de famille', () => {
    const scrub = makeScrubber(roster, studentLabels(roster));
    expect(scrub('Bravo Abigaël, belle copie.')).toBe('Bravo Élève 01, belle copie.');
    expect(scrub('abigael a aidé Brahim AS.')).toBe('Élève 01 a aidé Élève 02');
    expect(scrub('Nom : Abigaël Faure')).toBe('Nom : Élève 01');
    expect(scrub('Copie de FAURE Abigaël')).toBe('Copie de [nom] Élève 01');
    expect(scrub('Marie-Lou DE. et Marie-Lou')).toBe('Élève 03 et Élève 03');
    // Des mots ordinaires qui commencent comme un nom ne bougent pas.
    expect(scrub('des faits, de la faune')).toBe('des faits, de la faune');
  });

  it('écrit note, détail et transcription sans aucun nom', () => {
    const { markdown, count } = buildCopiesMarkdown({
      assessmentName: 'Les séismes',
      className: '4B',
      bareme: 10,
      roster,
      grades: {
        a: {
          grade: 16, grade_raw: 8, status: 'noted', is_validated: true,
          details: { questions: [{ label: 'Q1', bareme: 4, points: 3, commentaire: 'Bien vu, Abigaël | précis' }], commentaire: 'Continue Abigaël !' },
        },
        b: { grade: null, grade_raw: null, status: 'absent', is_validated: true },
      },
      transcripts: { a: { v: 1, items: [{ q: 'Q1', texte: 'Abigaël FAURE : la faille' }] } },
      withTranscripts: true,
    });
    expect(count).toBe(2);
    expect(markdown).toContain('## Élève 01');
    expect(markdown).toContain('- Note : 16/20 (8/10)');
    expect(markdown).toContain('| Q1 | 3/4 | Bien vu, Élève 01 \\| précis |');
    expect(markdown).toContain('**Q1** : Élève 01 : la faille');
    expect(markdown).toContain('## Élève 02\n\n- Absent');
    expect(markdown).not.toMatch(/Abiga|Brahim|FAURE/i);
    expect(markdown).not.toContain('Élève 03');
  });
});
