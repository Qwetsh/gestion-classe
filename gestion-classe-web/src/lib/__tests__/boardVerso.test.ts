import { describe, expect, it, vi } from 'vitest';

/** Lignes de `board_pages` renvoyées par la fausse base. */
let rows: Record<string, unknown>[] = [];
vi.mock('../supabase', () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => Promise.resolve({ data: rows, error: null }),
  };
  return { supabase: { from: () => query } };
});

import { fetchBoardPages, isVersoPageId, pageMeta, parsePageMeta, versoPageId } from '../boardQueries';
import { clonePages } from '../boardsQueries';
import type { BoardPage } from '../boardRender';

const row = (page_id: string, updated: string, strokes: unknown[] = []) => ({
  page_id, position: 0, background: 'blank', strokes, image: null, objects: [], meta: null, updated_at: updated,
});

describe('verso d’une page (« Tableau blanc »)', () => {
  it('se reconnaît à son identifiant', () => {
    expect(versoPageId('abc')).toBe('verso:abc');
    expect(isVersoPageId('verso:abc')).toBe(true);
    expect(isVersoPageId('abc')).toBe(false);
  });

  it('n’apparaît pas parmi les pages de la séance, mais est signalé sur sa page', async () => {
    rows = [
      row('p1', '2026-11-19T08:00:00Z'),
      row('p2', '2026-11-19T08:00:00Z'),
      row('verso:p1', '2026-11-19T09:00:00Z', [{ id: 's', tool: 'pen', color: '#000', size: 4, points: [] }]),
      row('verso:p2', '2026-11-19T09:00:00Z'),
    ];
    const board = await fetchBoardPages('seance');
    expect(board.pages.map((p) => p.id)).toEqual(['p1', 'p2']);
    // Seul un verso écrit compte
    expect(board.versoOf).toEqual(['p1']);
    // Un verso écrit plus tard ne rend pas les pages du serveur plus récentes que celles du poste
    expect(board.updatedAt).toBe(new Date('2026-11-19T08:00:00Z').getTime());
  });

  it('se lit quand on le demande (le verso ouvert lit sa page)', async () => {
    rows = [row('p1', '2026-11-19T08:00:00Z'), row('verso:p1', '2026-11-19T09:00:00Z')];
    const board = await fetchBoardPages('seance', { versos: true });
    expect(board.pages.map((p) => p.id)).toEqual(['p1', 'verso:p1']);
  });
});

describe('page copiée pour la classe', () => {
  it('retient la page préparée dont elle est la copie', () => {
    const pages: BoardPage[] = [{ id: 'prep-1', background: 'blank', strokes: [], objects: [] }];
    const [copy] = clonePages(pages);
    expect(copy.id).not.toBe('prep-1');
    expect(copy.origin).toBe('prep-1');
  });

  it('garde ce lien dans `meta`', () => {
    expect(pageMeta({ origin: 'prep-1' })).toEqual({ origin: 'prep-1' });
    expect(parsePageMeta({ origin: 'prep-1' })).toEqual({ origin: 'prep-1' });
  });
});
