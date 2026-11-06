import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Supprimer / déplacer une page d'une copie d'élève, contre une table en mémoire qui applique la
 * contrainte UNIQUE (assessment_id, student_id, page_order) comme Postgres.
 */
type Row = { id: string; assessment_id: string; student_id: string; page_order: number; storage_path: string };

const db = vi.hoisted(() => ({
  rows: [] as Row[],
  files: new Set<string>(),
  log: [] as string[],
}));

vi.mock('../pdfjs', () => ({ getPdfjs: vi.fn() }));
vi.mock('../supabase', () => {
  const unique = (r: Row) =>
    db.rows.some((x) => x.id !== r.id && x.assessment_id === r.assessment_id && x.student_id === r.student_id && x.page_order === r.page_order);
  const table = {
    delete: () => ({
      eq: async (_col: string, id: string) => {
        db.rows = db.rows.filter((r) => r.id !== id);
        db.log.push(`delete ${id}`);
        return { error: null };
      },
    }),
    update: (patch: Partial<Row>) => ({
      eq: async (_col: string, id: string) => {
        const r = db.rows.find((x) => x.id === id)!;
        const next = { ...r, ...patch };
        if (unique(next)) return { error: { code: '23505', message: 'duplicate key' } };
        Object.assign(r, patch);
        db.log.push(`update ${id} ${JSON.stringify(patch)}`);
        return { error: null };
      },
    }),
    select: () => {
      const filters: [string, string][] = [];
      const q = {
        eq: (col: string, v: string) => {
          filters.push([col, v]);
          return q;
        },
        order: () => q,
        limit: async (n: number) => ({
          data: db.rows
            .filter((r) => filters.every(([c, v]) => (r as Record<string, unknown>)[c] === v))
            .sort((a, b) => b.page_order - a.page_order)
            .slice(0, n),
          error: null,
        }),
      };
      return q;
    },
  };
  const bucket = {
    move: async (from: string, to: string) => {
      if (!db.files.has(from)) return { error: { message: 'not found' } };
      db.files.delete(from);
      db.files.add(to);
      db.log.push(`move ${from} -> ${to}`);
      return { error: null };
    },
    remove: async (paths: string[]) => {
      for (const p of paths) db.files.delete(p);
      db.log.push(`remove ${paths.join(',')}`);
      return { error: null };
    },
  };
  return { supabase: { from: () => table, storage: { from: () => bucket } } };
});

import { deleteCopyPage, moveCopyPage, pathForStudent, renumberPlan } from '../copyUpload';

const page = (id: string, student: string, order: number): Row => ({
  id,
  assessment_id: 'eval',
  student_id: student,
  page_order: order,
  storage_path: `user/eval/${student}/${id}.jpg`,
});
const pagesOf = (student: string) =>
  db.rows.filter((r) => r.student_id === student).sort((a, b) => a.page_order - b.page_order);

beforeEach(() => {
  db.rows = [];
  db.files = new Set();
  db.log = [];
});

describe('renumberPlan', () => {
  it('ne touche à rien quand les pages vont déjà de 1 à n', () => {
    expect(renumberPlan([{ id: 'a', page_order: 1 }, { id: 'b', page_order: 2 }])).toEqual([]);
  });

  it('bouche les trous dans l’ordre croissant', () => {
    expect(
      renumberPlan([
        { id: 'd', page_order: 6 },
        { id: 'a', page_order: 1 },
        { id: 'c', page_order: 4 },
      ]),
    ).toEqual([
      { id: 'c', page_order: 2 },
      { id: 'd', page_order: 3 },
    ]);
  });
});

describe('pathForStudent', () => {
  it('change le dossier de l’élève', () => {
    expect(pathForStudent('u/e/s1/p.jpg', 's2')).toBe('u/e/s2/p.jpg');
  });

  it('laisse un chemin d’une autre forme', () => {
    expect(pathForStudent('u/e/sans-nom/x/p.jpg', 's2')).toBeNull();
    expect(pathForStudent('p.jpg', 's2')).toBeNull();
  });
});

describe('deleteCopyPage', () => {
  it('efface la page et son fichier, les suivantes remontent sans trou', async () => {
    db.rows = [1, 2, 3, 4, 5].map((n) => page(`p${n}`, 'tessa', n));
    db.rows.forEach((r) => db.files.add(r.storage_path));
    const target = db.rows[1];

    await deleteCopyPage(target, [...db.rows]);

    expect(pagesOf('tessa').map((r) => [r.id, r.page_order])).toEqual([
      ['p1', 1],
      ['p3', 2],
      ['p4', 3],
      ['p5', 4],
    ]);
    expect(db.files.has(target.storage_path)).toBe(false);
    expect(db.files.size).toBe(4);
  });

  it('la dernière page : rien à renuméroter', async () => {
    db.rows = [page('p1', 'tessa', 1), page('p2', 'tessa', 2)];
    await deleteCopyPage(db.rows[1], [...db.rows]);
    expect(pagesOf('tessa').map((r) => r.page_order)).toEqual([1]);
    expect(db.log.filter((l) => l.startsWith('update'))).toEqual([]);
  });
});

describe('moveCopyPage', () => {
  it('range la page après celles de l’autre élève, fichier compris, et renumérote l’élève d’origine', async () => {
    db.rows = [
      ...[1, 2, 3, 4, 5, 6].map((n) => page(`t${n}`, 'tessa', n)),
      ...[1, 2, 3].map((n) => page(`e${n}`, 'emma', n)),
    ];
    db.rows.forEach((r) => db.files.add(r.storage_path));
    const moved = db.rows.find((r) => r.id === 't4')!;

    await moveCopyPage({ ...moved }, pagesOf('tessa'), 'emma');

    expect(pagesOf('emma').map((r) => [r.id, r.page_order])).toEqual([
      ['e1', 1],
      ['e2', 2],
      ['e3', 3],
      ['t4', 4],
    ]);
    expect(pagesOf('tessa').map((r) => [r.id, r.page_order])).toEqual([
      ['t1', 1],
      ['t2', 2],
      ['t3', 3],
      ['t5', 4],
      ['t6', 5],
    ]);
    const row = db.rows.find((r) => r.id === 't4')!;
    expect(row.storage_path).toBe('user/eval/emma/t4.jpg');
    expect(db.files.has('user/eval/emma/t4.jpg')).toBe(true);
    expect(db.files.has('user/eval/tessa/t4.jpg')).toBe(false);
  });

  it('vers un élève sans copie : page 1', async () => {
    db.rows = [page('t1', 'tessa', 1), page('t2', 'tessa', 2)];
    db.rows.forEach((r) => db.files.add(r.storage_path));
    await moveCopyPage({ ...db.rows[0] }, pagesOf('tessa'), 'leo');
    expect(pagesOf('leo').map((r) => r.page_order)).toEqual([1]);
    expect(pagesOf('tessa').map((r) => [r.id, r.page_order])).toEqual([['t2', 1]]);
  });

  it('fichier introuvable : rien ne bouge en base', async () => {
    db.rows = [page('t1', 'tessa', 1), page('t2', 'tessa', 2)];
    await expect(moveCopyPage({ ...db.rows[0] }, pagesOf('tessa'), 'leo')).rejects.toBeTruthy();
    expect(pagesOf('tessa').map((r) => r.id)).toEqual(['t1', 't2']);
    expect(pagesOf('leo')).toEqual([]);
  });
});
