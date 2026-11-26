import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { pickableActivities } from '../activitySuggest';
import {
  NO_LIBRARY_LINK,
  correctionChangedSince,
  findLinkedActivity,
  groupsForAssessment,
  hasLibraryLink,
  libraryColumns,
  linkedDocBoardId,
  linkFromGroup,
  linkFromRow,
  matchLibrarySequence,
  sameLink,
  sequenceLabel,
  summarizeKit,
} from '../assessmentLibrary';

let n = 0;
const board = (title: string, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id: `b${++n}`, title, level: '3e', chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — Micro-organismes';
const S2 = 'Séquence 2 — Le système immunitaire';

const library: Board[] = [
  board('Activité 1 — Les microbes', S1), board('Activité 1 — Les microbes (correction)', S1),
  board('Évaluation — Micro-organismes', S1),
  board('Évaluation — Micro-organismes (documents)', S1),
  board('Évaluation — Micro-organismes (correction)', S1),
  board('Activité 1 — Barrières', S2),
  board('Évaluation — Le système immunitaire', S2),
];
const sequences = pickableActivities(library, '3e');
const byTitle = (t: string) => library.find((b) => b.title === t)!.id;

describe('linkFromGroup / linkFromRow', () => {
  it('relie la fiche, les documents et la correction de l’activité', () => {
    const evalGroup = groupsForAssessment(sequences.find((s) => s.chapter === S1))[0];
    expect(evalGroup.title).toBe('Évaluation — Micro-organismes');
    expect(linkFromGroup(evalGroup)).toEqual({
      boardId: byTitle('Évaluation — Micro-organismes'),
      documentsId: byTitle('Évaluation — Micro-organismes (documents)'),
      correctionId: byTitle('Évaluation — Micro-organismes (correction)'),
    });
  });

  it('laisse vide un rôle absent de la bibliothèque', () => {
    const g = groupsForAssessment(sequences.find((s) => s.chapter === S2)).find((x) => x.title === 'Évaluation — Le système immunitaire')!;
    expect(linkFromGroup(g)).toEqual({ boardId: byTitle('Évaluation — Le système immunitaire'), documentsId: null, correctionId: null });
  });

  it('lit une ligne sans les colonnes de la migration comme une éval sans activité', () => {
    expect(linkFromRow({})).toEqual(NO_LIBRARY_LINK);
    expect(hasLibraryLink(linkFromRow({}))).toBe(false);
    expect(linkFromRow({ library_correction_board_id: 'c' })).toEqual({ boardId: null, documentsId: null, correctionId: 'c' });
  });
});

describe('libraryColumns', () => {
  const link = { boardId: 'f', documentsId: null, correctionId: 'c' };
  it('n’envoie rien à la création sans activité (base sans la migration 095)', () => {
    expect(libraryColumns(undefined)).toEqual({});
    expect(libraryColumns(NO_LIBRARY_LINK)).toEqual({});
    expect(libraryColumns(null)).toEqual({});
  });
  it('écrit les trois colonnes quand une activité est choisie', () => {
    expect(libraryColumns(link)).toEqual({ library_board_id: 'f', library_documents_board_id: null, library_correction_board_id: 'c' });
  });
  it('efface le lien en modification, et ne touche à rien sans changement', () => {
    expect(libraryColumns(NO_LIBRARY_LINK, true)).toEqual({ library_board_id: null, library_documents_board_id: null, library_correction_board_id: null });
    expect(libraryColumns(undefined, true)).toEqual({});
  });
  it('compare deux liens', () => {
    expect(sameLink(link, { ...link })).toBe(true);
    expect(sameLink(link, { ...link, correctionId: 'x' })).toBe(false);
  });
});

describe('groupsForAssessment', () => {
  it('met les évaluations de la séquence en tête', () => {
    const titles = groupsForAssessment(sequences.find((s) => s.chapter === S1)).map((g) => g.title);
    expect(titles).toEqual(['Évaluation — Micro-organismes', 'Activité 1 — Les microbes']);
    expect(groupsForAssessment(undefined)).toEqual([]);
  });
});

describe('findLinkedActivity', () => {
  it('retrouve l’activité par l’un de ses cours, même si la fiche a disparu', () => {
    const found = findLinkedActivity(sequences, { boardId: 'disparue', documentsId: null, correctionId: byTitle('Évaluation — Micro-organismes (correction)') });
    expect(found?.chapter).toBe(S1);
    expect(found?.group.title).toBe('Évaluation — Micro-organismes');
  });
  it('null sans lien ou quand plus aucun cours n’existe', () => {
    expect(findLinkedActivity(sequences, NO_LIBRARY_LINK)).toBeNull();
    expect(findLinkedActivity(sequences, { boardId: 'x', documentsId: null, correctionId: 'y' })).toBeNull();
  });
});

describe('matchLibrarySequence / sequenceLabel', () => {
  it('reconnaît le nom entier, puis « Séquence n » seul', () => {
    expect(matchLibrarySequence(sequences, S2)).toBe(S2);
    expect(matchLibrarySequence(sequences, 'Séquence 2')).toBe(S2);
    expect(matchLibrarySequence(sequences, 'sequence 1')).toBe(S1);
    expect(matchLibrarySequence(sequences, 'Séquence 9')).toBeNull();
    expect(matchLibrarySequence(sequences, '')).toBeNull();
  });
  it('ne confond pas « Séquence 1 » et « Séquence 12 »', () => {
    const many = pickableActivities([board('Activité 1 — X', 'Séquence 12 — Autre')], '3e');
    expect(matchLibrarySequence(many, 'Séquence 1')).toBeNull();
  });
  it('enregistre la forme courte, comme les évaluations déjà saisies', () => {
    expect(sequenceLabel(S2)).toBe('Séquence 2');
    expect(sequenceLabel('Sequence 3 – Génétique')).toBe('Séquence 3');
    expect(sequenceLabel('Révisions du brevet')).toBe('Révisions du brevet');
  });
});

describe('summarizeKit', () => {
  it('résume un kit de la bibliothèque', () => {
    const k = summarizeKit({
      version_key: '',
      source: 'bibliotheque',
      questions: [{ label: 'Q1', bareme: 1.5 }, { label: 'Q2', bareme: 8.5 }, 'illisible'],
      library: { bareme_from: 'claude', correction_board_id: 'c', correction_updated_at: '2026-11-20T10:00:00Z' },
    });
    expect(k).toMatchObject({ source: 'bibliotheque', total: 10, baremeFrom: 'claude', correctionId: 'c' });
    expect(k.lines).toHaveLength(2);
  });
  it('un kit sans source vient du Correcteur', () => {
    expect(summarizeKit({ version_key: 'v5', source: null, questions: [], library: null })).toMatchObject({ source: 'correcteur', baremeFrom: null, total: 0 });
  });
  it('signale une correction retouchée après la préparation du kit', () => {
    const k = summarizeKit({ version_key: '', source: 'bibliotheque', questions: [], library: { correction_updated_at: '2026-11-20T10:00:00Z' } });
    expect(correctionChangedSince(k, '2026-11-21T08:00:00Z')).toBe(true);
    expect(correctionChangedSince(k, '2026-11-19T08:00:00Z')).toBe(false);
    expect(correctionChangedSince(k, null)).toBe(false);
  });
});

describe('linkedDocBoardId', () => {
  it('donne la fiche pour le sujet et la correction pour le corrigé', () => {
    const row = { library_board_id: 'fiche', library_correction_board_id: 'corr' };
    expect(linkedDocBoardId([row], 'subject')).toBe('fiche');
    expect(linkedDocBoardId([row], 'correction')).toBe('corr');
  });
  it('prend la première éval reliée de la série, et rien sans lien', () => {
    expect(linkedDocBoardId([{}, { library_correction_board_id: 'c2' }], 'correction')).toBe('c2');
    expect(linkedDocBoardId([{ library_board_id: null }], 'subject')).toBeNull();
    expect(linkedDocBoardId([], 'subject')).toBeNull();
  });
});
