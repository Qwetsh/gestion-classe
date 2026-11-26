import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Les bilans de participation lisaient tous les événements d'un enseignant en une requête : au-delà
 * de 1 000 lignes la base tronque sans erreur, et le calcul portait sur une partie des événements.
 */

const PAGE = 1000;

interface Row {
  id: string;
  type: string;
  student_id: string;
  session_id: string;
  sessions: { class_id: string; user_id: string };
}

const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  failAtCall: 0,
  calls: [] as { filters: Record<string, string>; order: string | null; from: number; to: number }[],
}));

vi.mock('../supabase', () => {
  const builder = () => {
    const filters: Record<string, string> = {};
    let order: string | null = null;
    const api = {
      select: () => api,
      eq: (column: string, value: string) => { filters[column] = value; return api; },
      order: (column: string) => { order = column; return api; },
      range: async (from: number, to: number) => {
        state.calls.push({ filters: { ...filters }, order, from, to });
        if (state.failAtCall === state.calls.length) return { data: null, error: { message: 'coupure' } };
        const matching = (state.rows as Row[]).filter((r) =>
          r.sessions.user_id === filters['sessions.user_id']
          && (!filters['sessions.class_id'] || r.sessions.class_id === filters['sessions.class_id']));
        // La base applique son plafond quelle que soit la plage demandée.
        return { data: matching.slice(from, Math.min(to + 1, from + PAGE)), error: null };
      },
    };
    return api;
  };
  return { supabase: { from: () => builder() } };
});

import { fetchTeacherEvents } from '../eventsQueries';

function makeRows(count: number, userId: string, classId: string, prefix: string): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${String(i).padStart(5, '0')}`,
    type: i % 3 === 0 ? 'bavardage' : 'participation',
    student_id: `eleve-${i % 25}`,
    session_id: `seance-${i % 40}`,
    sessions: { class_id: classId, user_id: userId },
  }));
}

describe('fetchTeacherEvents', () => {
  beforeEach(() => {
    state.rows = [];
    state.calls = [];
    state.failAtCall = 0;
  });

  it('ramène tous les événements au-delà de 1 000 lignes', async () => {
    state.rows = [...makeRows(2600, 'prof', '3A', 'a'), ...makeRows(300, 'autre', '5B', 'b')];
    const events = await fetchTeacherEvents('prof');
    expect(events).toHaveLength(2600);
    expect(new Set(events.map((e) => e.id)).size).toBe(2600);
    expect(state.calls.map((c) => [c.from, c.to])).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('trie par identifiant pour que les pages ne se chevauchent pas', async () => {
    state.rows = makeRows(10, 'prof', '3A', 'a');
    await fetchTeacherEvents('prof');
    expect(state.calls.every((c) => c.order === 'id')).toBe(true);
  });

  it('se limite à une classe quand elle est donnée, et rend la classe de chaque événement', async () => {
    state.rows = [...makeRows(1500, 'prof', '3A', 'a'), ...makeRows(1200, 'prof', '4C', 'c')];
    const events = await fetchTeacherEvents('prof', '4C');
    expect(events).toHaveLength(1200);
    expect(events.every((e) => e.class_id === '4C')).toBe(true);
    expect(state.calls[0].filters).toEqual({ 'sessions.user_id': 'prof', 'sessions.class_id': '4C' });
  });

  it('lève l’erreur au lieu de rendre une liste partielle', async () => {
    state.rows = makeRows(2600, 'prof', '3A', 'a');
    state.failAtCall = 2;
    await expect(fetchTeacherEvents('prof')).rejects.toMatchObject({ message: 'coupure' });
  });
});
