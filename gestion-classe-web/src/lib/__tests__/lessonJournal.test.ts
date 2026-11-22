import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { journalHeadline, journalKey, normalizeJournalText } from '../timetable/lessonJournalQueries';

describe('cahier de texte', () => {
  it('normalise le texte collé : fins de ligne, espaces de fin, lignes vides autour', () => {
    expect(normalizeJournalText('\r\n\r\nTitre  \r\n\r\nTRAVAIL EFFECTUÉ EN CLASSE\t\r\n- point\r\n\r\n')).toBe(
      'Titre\n\nTRAVAIL EFFECTUÉ EN CLASSE\n- point',
    );
    expect(normalizeJournalText('  \n \n')).toBe('');
  });

  it('résume une entrée par sa première ligne non vide, tronquée', () => {
    expect(journalHeadline('\n  Thème — séquence 1, séance 2 : titre\n\nTRAVAIL')).toBe('Thème — séquence 1, séance 2 : titre');
    const long = 'x'.repeat(200);
    expect(journalHeadline(long, 20)).toBe(`${'x'.repeat(19)}…`);
  });

  it('rapproche une entrée de son cours comme les notes : début à la minute + libellé', () => {
    const a = new Date('2026-11-23T10:15:00Z');
    const b = new Date('2026-11-23T10:15:42Z');
    expect(journalKey(a, '4B')).toBe(journalKey(b, ' 4b '));
    expect(journalKey(a, '4B')).not.toBe(journalKey(a, '4C'));
  });
});
