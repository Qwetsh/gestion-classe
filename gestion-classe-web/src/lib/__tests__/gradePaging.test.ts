import { describe, expect, it } from 'vitest';
import { fetchAllPages, type PageResult } from '../evaluationQueries';

/**
 * Régression du bug le plus grave trouvé à la revue du 22/09/2026 : une requête sans
 * pagination s'arrête à 1000 lignes **sans erreur**, et la sauvegarde se télécharge
 * incomplète sans que rien ne le signale.
 */

const PAGE = 1000;

/** Faux serveur qui applique la limite de PostgREST. */
function fakeServer(totalRows: number) {
  const calls: [number, number][] = [];
  const build = async (from: number, to: number): Promise<PageResult<number>> => {
    calls.push([from, to]);
    const size = Math.min(to - from + 1, PAGE);
    const rows = Array.from({ length: Math.max(0, Math.min(size, totalRows - from)) },
      (_, i) => from + i);
    return { data: rows, error: null };
  };
  return { build, calls };
}

describe('fetchAllPages', () => {
  it('ramène toutes les lignes au-delà de la limite de 1000', async () => {
    const { build, calls } = fakeServer(5000);
    const rows = await fetchAllPages(build);
    expect(rows).toHaveLength(5000);
    expect(rows[0]).toBe(0);
    expect(rows[4999]).toBe(4999);
    // 5 pages pleines + une page vide qui signale la fin
    expect(calls.length).toBe(6);
  });

  it('s’arrête sur une page incomplète sans requête inutile', async () => {
    const { build, calls } = fakeServer(1500);
    const rows = await fetchAllPages(build);
    expect(rows).toHaveLength(1500);
    expect(calls.length).toBe(2);
  });

  it('gère le cas exactement à la limite', async () => {
    const { build, calls } = fakeServer(1000);
    const rows = await fetchAllPages(build);
    expect(rows).toHaveLength(1000);
    // Une page pleine ne prouve pas la fin : il faut la page suivante pour le savoir.
    expect(calls.length).toBe(2);
  });

  it('gère une table vide', async () => {
    const { build, calls } = fakeServer(0);
    expect(await fetchAllPages(build)).toEqual([]);
    expect(calls.length).toBe(1);
  });

  it('remonte l’erreur au lieu de rendre un résultat partiel', async () => {
    let n = 0;
    const build = async (from: number, to: number): Promise<PageResult<number>> => {
      n += 1;
      if (n === 2) return { data: null, error: { message: 'boom' } };
      return { data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null };
    };
    await expect(fetchAllPages(build)).rejects.toMatchObject({ message: 'boom' });
  });

  it('traite une réponse sans données comme une fin de parcours', async () => {
    const build = async (): Promise<PageResult<number>> => ({ data: null, error: null });
    expect(await fetchAllPages(build)).toEqual([]);
  });
});
