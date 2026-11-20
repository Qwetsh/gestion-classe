import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { activityTitleKey, pickableActivities, searchActivities, suggestActivities } from '../activitySuggest';

let n = 0;
const board = (title: string, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id: `b${++n}`, title, level: '4e', chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — La Terre';
const S2 = 'Séquence 2 — Plaques';

const library: Board[] = [
  board('Activité 1 — Volcans', S1), board('Activité 1 — Volcans (correction)', S1), board('Activité 1 — Volcans (documents)', S1),
  board('Activité 2 — Séisme', S1), board('Activité 2 — Séisme (correction)', S1), board('Activité 2 — Séisme (copie modèle)', S1),
  board('Activité 3 — Répartition', S1),
  board('Évaluation — La Terre', S1),
  board('Page de garde — Séquence 1', S1), board('Feuille de bilans — Séquence 1', S1), board('Fiche de mémorisation — Séquence 1', S1),
  board('Activité 1 — Frontières', S2),
  board('Activité 1 — Frontières (correction)', S2),
  board('FM1 — Lire une consigne', null, { category: 'methode' }),
  board('4C · lun. 16 nov.', null),
  board('Activité 1 — Autre niveau', S1, { level: '3e' }),
];

const sequences = pickableActivities(library, '4e');
const titles = (s: { group: { title: string } }[]) => s.map((x) => x.group.title);

describe('pickableActivities', () => {
  it('range les activités du niveau par séquence, sans les documents du classeur ni les fiches méthode', () => {
    expect(sequences.map((s) => s.chapter)).toEqual([S1, S2]);
    expect(sequences[0].groups.map((g) => g.title)).toEqual(['Activité 1 — Volcans', 'Activité 2 — Séisme', 'Activité 3 — Répartition', 'Évaluation — La Terre']);
  });

  it('rassemble la fiche, ses documents et sa correction en une activité', () => {
    const volcans = sequences[0].groups[0];
    expect(volcans.members.map((m) => m.variant)).toEqual(['fiche', 'documents', 'correction']);
  });

  it('ne garde pas les tableaux sans séquence (cours déjà posés sur l’emploi du temps)', () => {
    expect(sequences.flatMap((s) => s.groups).some((g) => g.title.startsWith('4C'))).toBe(false);
  });
});

describe('suggestActivities', () => {
  it('après une activité faite, propose d’abord sa correction puis la suite', () => {
    const s = suggestActivities({ sequences, last: { title: 'Activité 1 — Volcans' } });
    expect(s.map((x) => x.reason)).toEqual(['correction', 'suite', 'apres', 'apres']);
    expect(titles(s)).toEqual(['Activité 1 — Volcans', 'Activité 2 — Séisme', 'Activité 3 — Répartition', 'Évaluation — La Terre']);
    expect(s[0].open).toBe('correction');
  });

  it('une correction déjà vue : la suite vient en premier', () => {
    const s = suggestActivities({ sequences, last: { title: 'Activité 1 — Volcans (correction)' } });
    expect(s[0].reason).toBe('suite');
    expect(s[0].group.title).toBe('Activité 2 — Séisme');
  });

  it('une activité sans correction : directement la suite', () => {
    const s = suggestActivities({ sequences, last: { title: 'Activité 3 — Répartition' } });
    expect(s[0].group.title).toBe('Évaluation — La Terre');
    expect(s[0].reason).toBe('suite');
  });

  it('passe à la séquence suivante après la dernière activité d’une séquence', () => {
    const s = suggestActivities({ sequences, last: { title: 'Évaluation — La Terre' } });
    expect(s[0].group.title).toBe('Activité 1 — Frontières');
    expect(s[0].chapter).toBe(S2);
  });

  it('retrouve l’activité malgré une apostrophe typographique ou des espaces en trop', () => {
    expect(activityTitleKey('Activité  2 — L’importance (correction)')).toBe(activityTitleKey("Activité 2 — L'importance"));
  });

  it('sans historique, propose le début de chaque séquence', () => {
    const s = suggestActivities({ sequences, last: null });
    expect(s.map((x) => x.reason)).toEqual(['debut', 'debut']);
    expect(titles(s)).toEqual(['Activité 1 — Volcans', 'Activité 1 — Frontières']);
  });

  it('historique inconnu de la bibliothèque (tableau libre) : même repli', () => {
    const s = suggestActivities({ sequences, last: { title: '4C · lun. 16 nov.' } });
    expect(s.every((x) => x.reason === 'debut')).toBe(true);
  });

  it('propose au plus `max` activités, sans doublon', () => {
    const s = suggestActivities({ sequences, last: { title: 'Activité 1 — Volcans' }, max: 2 });
    expect(s).toHaveLength(2);
    expect(new Set(s.map((x) => x.group.key)).size).toBe(2);
  });
});

describe('searchActivities', () => {
  it('trouve sans accent ni casse, en croisant le titre et la séquence', () => {
    const r = searchActivities(sequences, 'seisme');
    expect(r.flatMap((s) => s.groups.map((g) => g.title))).toEqual(['Activité 2 — Séisme']);
    expect(searchActivities(sequences, 'plaques frontieres').flatMap((s) => s.groups.map((g) => g.title))).toEqual(['Activité 1 — Frontières']);
  });

  it('une saisie vide rend tout', () => {
    expect(searchActivities(sequences, '  ')).toBe(sequences);
  });
});
