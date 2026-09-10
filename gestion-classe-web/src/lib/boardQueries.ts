import { supabase } from './supabase';
import type { BoardPage, Background, Stroke, PageImage } from './boardRender';
import type { TextBox } from './boardText';
import { migrateLegacyTexts, type BoardObject } from './boardObjects';

interface BoardPageRow {
  page_id: string;
  position: number;
  background: string;
  strokes: unknown;
  image: unknown;
  texts?: unknown;
  objects?: unknown;
  updated_at: string;
}

function parseImage(raw: unknown): PageImage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.path !== 'string' || typeof r.width !== 'number' || typeof r.height !== 'number') return null;
  return { path: r.path, width: r.width, height: r.height };
}

/** Propriétaire des pages : une séance (mode « en classe ») ou un tableau nommé. */
export type BoardRef = string | { boardId: string };

const ownerColumn = (ref: BoardRef) => (typeof ref === 'string' ? 'session_id' : 'board_id');
const ownerId = (ref: BoardRef) => (typeof ref === 'string' ? ref : ref.boardId);

export interface RemoteBoard {
  pages: BoardPage[];
  /** Dernière mise à jour connue côté serveur (ms), 0 si aucune page. */
  updatedAt: number;
}

/**
 * La colonne `objects` (migration add_board_objects.sql) peut manquer sur une base
 * pas encore migrée : on le détecte une fois et on continue sans les objets
 * plutôt que de perdre la sauvegarde de l'encre.
 */
let objectsColumnMissing = false;

function isMissingObjectsColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('objects') && (msg.includes('column') || msg.includes('schema cache'));
}

export async function fetchBoardPages(ref: BoardRef): Promise<RemoteBoard> {
  const columns = () => `page_id, position, background, strokes, image, updated_at${objectsColumnMissing ? '' : ', objects'}`;
  let { data, error } = await supabase
    .from('board_pages')
    .select(columns())
    .eq(ownerColumn(ref), ownerId(ref))
    .order('position');
  if (isMissingObjectsColumn(error)) {
    console.warn('[boardQueries] colonne « objects » absente : migration add_board_objects.sql à appliquer');
    objectsColumnMissing = true;
    ({ data, error } = await supabase
      .from('board_pages')
      .select(columns())
      .eq(ownerColumn(ref), ownerId(ref))
      .order('position'));
  }
  if (error) throw error;
  const rows = (data || []) as unknown as BoardPageRow[];
  const pages: BoardPage[] = rows.map((r) => ({
    id: r.page_id,
    background: (['blank', 'grid', 'lines', 'seyes', 'graph', 'axes', 'dots'].includes(r.background) ? r.background : 'blank') as Background,
    strokes: Array.isArray(r.strokes) ? (r.strokes as Stroke[]) : [],
    image: parseImage(r.image),
    objects: migrateLegacyTexts(
      Array.isArray(r.objects) ? (r.objects as BoardObject[]) : [],
      Array.isArray(r.texts) ? (r.texts as TextBox[]) : []
    ),
  }));
  const updatedAt = rows.reduce((max, r) => Math.max(max, new Date(r.updated_at).getTime()), 0);
  return { pages, updatedAt };
}

export async function upsertBoardPages(
  userId: string,
  ref: BoardRef,
  pages: { page: BoardPage; position: number }[]
): Promise<void> {
  if (pages.length === 0) return;
  const now = new Date().toISOString();
  const conflict = typeof ref === 'string' ? 'session_id,page_id' : 'board_id,page_id';
  const rows = () => pages.map(({ page, position }) => ({
    user_id: userId,
    [ownerColumn(ref)]: ownerId(ref),
    page_id: page.id,
    position,
    background: page.background,
    strokes: page.strokes,
    image: page.image ?? null,
    ...(objectsColumnMissing ? {} : { objects: page.objects ?? [] }),
    updated_at: now,
  }));
  let { error } = await supabase.from('board_pages').upsert(rows(), { onConflict: conflict });
  if (isMissingObjectsColumn(error)) {
    console.warn('[boardQueries] colonne « objects » absente : migration add_board_objects.sql à appliquer');
    objectsColumnMissing = true;
    ({ error } = await supabase.from('board_pages').upsert(rows(), { onConflict: conflict }));
  }
  if (error) throw error;
}

export async function countBoardPages(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('board_pages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) throw error;
  return count ?? 0;
}
