import { supabase } from './supabase';
import { BOARD_PAGE_H, type BoardPage, type Background, type Stroke, type PageImage } from './boardRender';
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
  meta?: unknown;
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

/**
 * La colonne `meta` (migration 074) range ce qui n'est ni contenu ni fond à motif : couleur de
 * la page, rideau, hauteur d'une page allongée. Absente (base pas encore migrée) : ces réglages
 * restent sur l'appareil, comme avant.
 */
let metaColumnMissing = false;

function isMissingMetaColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (msg.includes('.meta') || msg.includes("'meta'") || msg.includes(' meta ')) && (msg.includes('column') || msg.includes('schema cache'));
}

/** Vrai si la migration 074 n'est pas appliquée (détecté au premier appel). */
export const pageMetaUnavailable = () => metaColumnMissing;

/** Réglages d'une page à ranger dans `meta` ; null quand tout est à la valeur par défaut. */
export function pageMeta(page: Pick<BoardPage, 'color' | 'curtain' | 'height'>): { color?: string; curtain?: true; height?: number } | null {
  const meta: { color?: string; curtain?: true; height?: number } = {};
  if (typeof page.color === 'string' && page.color) meta.color = page.color;
  if (page.curtain === true) meta.curtain = true;
  if (typeof page.height === 'number' && Number.isFinite(page.height) && page.height > BOARD_PAGE_H) meta.height = page.height;
  return Object.keys(meta).length > 0 ? meta : null;
}

/** Lecture de `meta` : seules les valeurs valides sont reprises. */
export function parsePageMeta(raw: unknown): Pick<BoardPage, 'color' | 'curtain' | 'height'> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  return pageMeta({
    color: typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : undefined,
    curtain: r.curtain === true ? true : undefined,
    height: typeof r.height === 'number' ? r.height : undefined,
  }) ?? {};
}

export async function fetchBoardPages(ref: BoardRef): Promise<RemoteBoard> {
  const columns = () => `page_id, position, background, strokes, image, updated_at${objectsColumnMissing ? '' : ', objects'}${metaColumnMissing ? '' : ', meta'}`;
  const read = () => supabase
    .from('board_pages')
    .select(columns())
    .eq(ownerColumn(ref), ownerId(ref))
    .order('position');
  let { data, error } = await read();
  // Une colonne peut manquer sur une base pas encore migrée : on la retire et on relit
  for (let i = 0; i < 2 && error; i++) {
    if (!objectsColumnMissing && isMissingObjectsColumn(error)) {
      console.warn('[boardQueries] colonne « objects » absente : migration add_board_objects.sql à appliquer');
      objectsColumnMissing = true;
    } else if (!metaColumnMissing && isMissingMetaColumn(error)) {
      console.warn('[boardQueries] colonne « meta » absente : migration 074 à appliquer');
      metaColumnMissing = true;
    } else break;
    ({ data, error } = await read());
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
    ...parsePageMeta(r.meta),
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
    ...(metaColumnMissing ? {} : { meta: pageMeta(page) }),
    updated_at: now,
  }));
  const write = () => supabase.from('board_pages').upsert(rows(), { onConflict: conflict });
  let { error } = await write();
  for (let i = 0; i < 2 && error; i++) {
    if (!objectsColumnMissing && isMissingObjectsColumn(error)) {
      console.warn('[boardQueries] colonne « objects » absente : migration add_board_objects.sql à appliquer');
      objectsColumnMissing = true;
    } else if (!metaColumnMissing && isMissingMetaColumn(error)) {
      console.warn('[boardQueries] colonne « meta » absente : migration 074 à appliquer');
      metaColumnMissing = true;
    } else break;
    ({ error } = await write());
  }
  if (error) throw error;
}

// ---- État de séance du tableau blanc (migration 074 : session_board_state) ----

let stateTableMissing = false;

const isMissingStateTable = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === '42P01' || /session_board_state/i.test(error.message ?? ''));

/**
 * Révélations enregistrées pour cette séance (rideaux levés, trous découverts…), avec leur date ;
 * null si la séance n'a rien d'enregistré, si la table manque ou si la lecture échoue.
 */
export async function fetchSessionReveal(sessionId: string): Promise<{ reveal: unknown; updatedAt: number } | null> {
  if (stateTableMissing) return null;
  const { data, error } = await supabase.from('session_board_state').select('reveal, updated_at').eq('session_id', sessionId).maybeSingle();
  if (isMissingStateTable(error)) { stateTableMissing = true; console.warn('[boardQueries] table « session_board_state » absente : migration 074 à appliquer'); return null; }
  if (error || !data) return null;
  const row = data as { reveal: unknown; updated_at: string };
  return { reveal: row.reveal, updatedAt: new Date(row.updated_at).getTime() };
}

/** Range les révélations de la séance ; renvoie faux si rien n'a pu être écrit. */
export async function saveSessionReveal(userId: string, sessionId: string, reveal: unknown): Promise<boolean> {
  if (stateTableMissing) return false;
  const { error } = await supabase
    .from('session_board_state')
    .upsert({ session_id: sessionId, user_id: userId, reveal, updated_at: new Date().toISOString() }, { onConflict: 'session_id' });
  if (isMissingStateTable(error)) { stateTableMissing = true; return false; }
  if (error) { console.warn('[boardQueries] révélations de séance :', error.message); return false; }
  return true;
}

export async function countBoardPages(sessionId: string): Promise<number> {
  const { count, error } = await supabase
    .from('board_pages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  if (error) throw error;
  return count ?? 0;
}
