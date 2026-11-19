/**
 * Tableaux blancs écrits en classe (versos, PR #121), retrouvés depuis le cours : pour un cours,
 * toutes les séances parties de lui ou de ses copies placées sur l'emploi du temps, et, pour
 * chaque page jouée, le verso écrit pendant la séance.
 *
 * Chemin des données :
 * - la famille du cours : l'original de la bibliothèque et ses copies (`lesson_boards`,
 *   `source_board_id`, migration 077) ;
 * - les séances liées à l'un d'eux (`session_boards`), avec la classe et la date ;
 * - les versos de ces séances (`board_pages`, `page_id` « verso:<page> ») et la page jouée qu'ils
 *   doublent, dont `meta.origin` dit de quelle page préparée elle est la copie.
 *
 * Une même page du cours a le même identifiant dans l'original et dans les copies d'un cours
 * rédigé ; pour un tableau classique, la copie note sa page source dans `origin` : la clé d'une
 * page est donc l'origine de l'origine quand elle existe. Les séances jouées avant le 19/11/2026
 * n'ont pas de verso, ni de lien vers la page préparée.
 */
import { supabase } from './supabase';
import { VERSO_PREFIX, isVersoPageId, pageHasContent, rowToBoardPage } from './boardQueries';
import type { BoardPage } from './boardRender';

export interface VersoSession {
  sessionId: string;
  classId: string | null;
  className: string;
  startedAt: string;
}

export interface ClassVerso extends VersoSession {
  /** Page jouée en classe (copie de la page préparée). */
  pageId: string;
  /** Page du cours qu'elle copie (null : page ajoutée pendant la séance, ou séance trop ancienne). */
  key: string | null;
  verso: BoardPage;
  /** La page jouée, pour la montrer à côté du verso (absente si non demandée ou illisible). */
  page: BoardPage | null;
}

export interface CourseVersos {
  /** Versos écrits, les plus récents d'abord. */
  entries: ClassVerso[];
  /** Séances parties du cours, par identifiant (même sans verso). */
  sessions: Map<string, VersoSession>;
  /** Clé de page du cours pour l'origine d'une page jouée. */
  keyOf: (origin: string | null | undefined) => string | null;
}

const EMPTY: CourseVersos = { entries: [], sessions: new Map(), keyOf: (o) => o ?? null };

const CONTENT = 'page_id, background, strokes, image, objects, meta';

/** L'original du cours et toutes ses copies placées sur l'emploi du temps. */
async function courseFamily(boardId: string): Promise<string[]> {
  const ids = new Set([boardId]);
  const own = await supabase.from('lesson_boards').select('source_board_id').eq('board_id', boardId).maybeSingle();
  if (own.error) return [...ids];
  const root = (own.data as { source_board_id: string | null } | null)?.source_board_id ?? boardId;
  ids.add(root);
  const copies = await supabase.from('lesson_boards').select('board_id').eq('source_board_id', root);
  if (!copies.error) for (const c of (copies.data ?? []) as { board_id: string }[]) ids.add(c.board_id);
  return [...ids];
}

type SessionRow = { session_id: string; sessions: { started_at: string; class_id: string | null; classes: { name: string } | { name: string }[] | null } | null };

/**
 * Versos écrits en classe sur un cours. `withPages` : lire aussi les pages jouées (aperçu côte à
 * côte, hors classe). Rend un résultat vide si une table manque ou si la lecture échoue.
 */
export async function fetchCourseVersos(boardId: string, opts: { withPages?: boolean } = {}): Promise<CourseVersos> {
  try {
    const family = await courseFamily(boardId);
    const links = await supabase
      .from('session_boards')
      .select('session_id, sessions(started_at, class_id, classes(name))')
      .in('board_id', family);
    if (links.error || !links.data?.length) return EMPTY;
    const sessions = new Map<string, VersoSession>();
    for (const row of links.data as unknown as SessionRow[]) {
      const s = row.sessions;
      const cls = s?.classes;
      sessions.set(row.session_id, {
        sessionId: row.session_id,
        classId: s?.class_id ?? null,
        className: (Array.isArray(cls) ? cls[0]?.name : cls?.name) ?? '',
        startedAt: s?.started_at ?? '',
      });
    }
    const sessionIds = [...sessions.keys()];

    const versoRes = await supabase
      .from('board_pages')
      .select(`session_id, ${CONTENT}`)
      .in('session_id', sessionIds)
      .like('page_id', `${VERSO_PREFIX}%`);
    if (versoRes.error) return { ...EMPTY, sessions };
    const versos = ((versoRes.data ?? []) as unknown as ({ session_id: string } & Parameters<typeof rowToBoardPage>[0])[])
      .filter((r) => isVersoPageId(r.page_id))
      .map((r) => ({ sessionId: r.session_id, verso: rowToBoardPage(r) }))
      .filter((v) => pageHasContent(v.verso));

    // Pages jouées que ces versos doublent (leur origine), et origines des pages du cours
    const pageIds = [...new Set(versos.map((v) => v.verso.id.slice(VERSO_PREFIX.length)))];
    const [played, prepared] = await Promise.all([
      pageIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase.from('board_pages').select(`session_id, ${opts.withPages ? CONTENT : 'page_id, meta'}`).in('session_id', sessionIds).in('page_id', pageIds),
      supabase.from('board_pages').select('page_id, meta').in('board_id', family),
    ]);
    const preparedOrigin = new Map<string, string>();
    for (const r of (prepared.data ?? []) as { page_id: string; meta: unknown }[]) {
      const o = (r.meta as { origin?: unknown } | null)?.origin;
      if (typeof o === 'string' && o) preparedOrigin.set(r.page_id, o);
    }
    const keyOf = (origin: string | null | undefined) => (origin ? preparedOrigin.get(origin) ?? origin : null);
    const playedBy = new Map<string, BoardPage>();
    for (const r of (played.data ?? []) as unknown as ({ session_id: string } & Parameters<typeof rowToBoardPage>[0])[]) {
      playedBy.set(`${r.session_id}|${r.page_id}`, rowToBoardPage(r));
    }

    const entries: ClassVerso[] = versos.map(({ sessionId, verso }) => {
      const pageId = verso.id.slice(VERSO_PREFIX.length);
      const page = playedBy.get(`${sessionId}|${pageId}`) ?? null;
      return {
        ...(sessions.get(sessionId) as VersoSession),
        pageId,
        key: keyOf(page?.origin),
        verso,
        page: opts.withPages ? page : null,
      };
    });
    entries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return { entries, sessions, keyOf };
  } catch (err) {
    console.warn('[boardVersos] lecture impossible :', err);
    return EMPTY;
  }
}

/**
 * Versos des séances précédentes pour une page du cours, vus depuis une séance : ceux de la même
 * classe d'abord, puis les autres, chacun du plus récent au plus ancien. La séance en cours est
 * écartée (son verso est celui qu'on a sous la main).
 */
export function previousVersos(all: CourseVersos, key: string | null, currentSessionId: string): ClassVerso[] {
  if (!key) return [];
  const currentClass = all.sessions.get(currentSessionId)?.classId ?? null;
  const list = all.entries.filter((e) => e.key === key && e.sessionId !== currentSessionId);
  const same = (e: ClassVerso) => (currentClass !== null && e.classId === currentClass ? 0 : 1);
  return list.sort((a, b) => same(a) - same(b) || b.startedAt.localeCompare(a.startedAt));
}

/** Versos regroupés par séance (la plus récente d'abord), pour la fenêtre « Écrit en classe ». */
export function groupBySession(entries: ClassVerso[]): { session: VersoSession; versos: ClassVerso[] }[] {
  const groups = new Map<string, { session: VersoSession; versos: ClassVerso[] }>();
  for (const e of entries) {
    const g = groups.get(e.sessionId) ?? { session: { sessionId: e.sessionId, classId: e.classId, className: e.className, startedAt: e.startedAt }, versos: [] };
    g.versos.push(e);
    groups.set(e.sessionId, g);
  }
  return [...groups.values()].sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt));
}

/** « 4C — lun. 18 nov. » */
export function versoLabel(s: Pick<VersoSession, 'className' | 'startedAt'>): string {
  const d = s.startedAt ? new Date(s.startedAt) : null;
  const day = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  return [s.className || 'Classe', day].filter(Boolean).join(' — ');
}
