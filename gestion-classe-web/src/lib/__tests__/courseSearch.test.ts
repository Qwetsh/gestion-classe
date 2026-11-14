import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import type { Board } from '../boardsQueries';
import { filterBoards, foldSearch, highlightParts, searchWords, tidyExcerpt } from '../courseSearch';

const board = (id: string, title: string, level: string | null, chapter: string | null): Board => ({
  id, title, level, chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z',
});

describe('foldSearch', () => {
  it('retire la casse et les accents sans changer la longueur', () => {
    expect(foldSearch('Séquence 2 — Dérive')).toBe('sequence 2 — derive');
    expect(foldSearch('Séquence 2 — Dérive')).toHaveLength('Séquence 2 — Dérive'.length);
  });

  it('range l’apostrophe typographique avec l’apostrophe droite', () => {
    expect(foldSearch('l’écorce')).toBe("l'ecorce");
  });
});

describe('searchWords', () => {
  it('sépare, replie et dédoublonne', () => {
    expect(searchWords('  Dérive  WEGENER derive ')).toEqual(['derive', 'wegener']);
    expect(searchWords('   ')).toEqual([]);
  });
});

describe('filterBoards', () => {
  const boards = [
    board('a', 'Activité 3 — Wegener et la dérive des continents', '4e', 'Séquence 2 — Terre en mouvement'),
    board('b', 'Les séismes', '4e', 'Séquence 2 — Terre en mouvement'),
    board('c', 'Microbiote', '3e', 'Séquence 1'),
  ];

  it('rend toute la liste sans mot', () => {
    expect(filterBoards(boards, [])).toBe(boards);
  });

  it('cherche dans le titre, sans accents', () => {
    expect(filterBoards(boards, searchWords('derive')).map((b) => b.id)).toEqual(['a']);
  });

  it('cherche aussi dans la séquence et le niveau', () => {
    expect(filterBoards(boards, searchWords('terre')).map((b) => b.id)).toEqual(['a', 'b']);
    expect(filterBoards(boards, searchWords('3e')).map((b) => b.id)).toEqual(['c']);
  });

  it('exige tous les mots', () => {
    expect(filterBoards(boards, searchWords('4e seismes')).map((b) => b.id)).toEqual(['b']);
    expect(filterBoards(boards, searchWords('seismes microbiote'))).toEqual([]);
  });
});

describe('highlightParts', () => {
  it('surligne le mot tel qu’il est écrit, accents compris', () => {
    expect(highlightParts('La Dérive des continents', ['derive'])).toEqual([
      { text: 'La ', hit: false },
      { text: 'Dérive', hit: true },
      { text: ' des continents', hit: false },
    ]);
  });

  it('surligne chaque occurrence et réunit les mots qui se touchent', () => {
    const parts = highlightParts('plaque et plaques', ['plaque', 'plaques']);
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['plaque', 'plaques']);
  });

  it('rend le texte entier quand rien ne correspond', () => {
    expect(highlightParts('Rien ici', ['volcan'])).toEqual([{ text: 'Rien ici', hit: false }]);
  });
});

describe('tidyExcerpt', () => {
  it('retire les mots coupés aux deux bouts', () => {
    expect(tidyExcerpt('uvement  Étude de documents : Wegener et la dérive des cont', ['wegener']))
      .toBe('… Étude de documents : Wegener et la dérive des …');
  });

  it('garde l’extrait entier si le mot trouvé est au bord', () => {
    expect(tidyExcerpt('Wegener propose', ['wegener'])).toBe('Wegener propose');
  });
});
