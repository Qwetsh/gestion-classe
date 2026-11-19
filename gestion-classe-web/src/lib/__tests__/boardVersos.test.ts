import { describe, expect, it, vi } from 'vitest';

/**
 * Fausse base : chaque requête rend les lignes de sa table, filtrées par `eq`, `in` et `like`.
 */
const db: Record<string, Record<string, unknown>[]> = {};
vi.mock('../supabase', () => {
  const query = (table: string) => {
    const filters: ((r: Record<string, unknown>) => boolean)[] = [];
    const rows = () => (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return q; },
      like: (c: string, pat: string) => { filters.push((r) => String(r[c]).startsWith(pat.replace(/%$/, ''))); return q; },
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (ok: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows(), error: null }).then(ok),
    };
    return q;
  };
  return { supabase: { from: query } };
});

import { fetchCourseVersos, groupBySession, previousVersos, versoLabel } from '../boardVersos';

const ink = [{ id: 's', tool: 'pen', color: '#000', size: 4, points: [] }];
const page = (extra: Record<string, unknown>) => ({ background: 'blank', strokes: [], image: null, objects: [], meta: null, updated_at: '2026-11-19T08:00:00Z', ...extra });

// Original « orig », copié pour la 4C (« copie-c ») et la 4D (« copie-d ») ; un cours rédigé
// garde les identifiants de pages d'une copie à l'autre (« p1 »).
db.lesson_boards = [
  { board_id: 'copie-c', source_board_id: 'orig' },
  { board_id: 'copie-d', source_board_id: 'orig' },
];
db.session_boards = [
  { session_id: 's-c1', board_id: 'copie-c', sessions: { started_at: '2026-11-16T08:00:00Z', class_id: 'c', classes: { name: '4C' } } },
  { session_id: 's-d1', board_id: 'copie-d', sessions: { started_at: '2026-11-17T10:00:00Z', class_id: 'd', classes: { name: '4D' } } },
  { session_id: 's-c2', board_id: 'copie-c', sessions: { started_at: '2026-11-19T08:00:00Z', class_id: 'c', classes: { name: '4C' } } },
];
db.board_pages = [
  page({ board_id: 'orig', page_id: 'p1' }),
  page({ board_id: 'copie-c', page_id: 'p1' }),
  // Séances : la page jouée (copie de p1) et son verso
  page({ session_id: 's-c1', page_id: 'j1', meta: { origin: 'p1' } }),
  page({ session_id: 's-c1', page_id: 'verso:j1', strokes: ink }),
  page({ session_id: 's-d1', page_id: 'j2', meta: { origin: 'p1' } }),
  page({ session_id: 's-d1', page_id: 'verso:j2', strokes: ink }),
  // Verso vide : ne compte pas
  page({ session_id: 's-c2', page_id: 'j3', meta: { origin: 'p1' } }),
  page({ session_id: 's-c2', page_id: 'verso:j3' }),
];

describe('tableaux blancs retrouvés depuis le cours', () => {
  it('rassemble les versos écrits des séances de l’original et de ses copies', async () => {
    const all = await fetchCourseVersos('copie-c', { withPages: true });
    expect(all.entries.map((e) => e.sessionId)).toEqual(['s-d1', 's-c1']);
    expect(all.entries.every((e) => e.key === 'p1')).toBe(true);
    expect(all.entries[0].page?.id).toBe('j2');
    expect(all.sessions.size).toBe(3);
  });

  it('propose en classe ceux de la même classe d’abord, sans la séance en cours', async () => {
    const all = await fetchCourseVersos('copie-c');
    const list = previousVersos(all, all.keyOf('p1'), 's-c2');
    expect(list.map((e) => e.className)).toEqual(['4C', '4D']);
    expect(previousVersos(all, null, 's-c2')).toEqual([]);
  });

  it('regroupe par séance, la plus récente d’abord', async () => {
    const all = await fetchCourseVersos('orig');
    expect(groupBySession(all.entries).map((g) => g.session.className)).toEqual(['4D', '4C']);
  });

  it('nomme une séance par sa classe et son jour', () => {
    expect(versoLabel({ className: '4C', startedAt: '2026-11-16T08:00:00Z' })).toMatch(/^4C — lun\.? 16 nov/);
    expect(versoLabel({ className: '', startedAt: '' })).toBe('Classe');
  });
});
