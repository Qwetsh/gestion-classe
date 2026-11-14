/**
 * Où un cours de la bibliothèque est placé (lot C3 de PLAN_mes_cours.md).
 *
 * Un original est copié sur chaque créneau où il sert ; `lesson_boards.source_board_id`
 * (migration 077) garde le lien copie → original. Ce fichier lit ces placements pour les pastilles
 * de classes de « Mes cours », et les prochains créneaux libres pour « Placer sur un cours… ».
 *
 * Les créneaux viennent de l'emploi du temps enregistré (`timetable_entries`, import .ics) : Pronote
 * en direct n'est lu que par l'accueil.
 */
import { supabase } from './supabase';
import { fetchClassGroupsForUser } from './classGroupQueries';
import { fetchEntriesBetween, fetchLabelLinks } from './timetable/timetableQueries';
import { resolveLabel } from './timetable/labelMatching';
import { dropReplacedCancellations, type TimetableLesson } from './timetable/weekView';

export interface ClassRef {
  id: string;
  name: string;
}

/** Une copie placée sur un créneau, avec son original. */
export interface Placement {
  /** Tableau de la copie (celui qui s'ouvre depuis le calendrier). */
  boardId: string;
  sourceBoardId: string;
  classId: string | null;
  startsAt: Date;
  /** Libellé du cours dans l'emploi du temps (« 4D ») : sert de nom quand la classe est inconnue. */
  label: string;
}

/** Une classe où un original est placé. */
export interface PlacementChip {
  key: string;
  name: string;
  /** Copie vers laquelle mène la pastille : le prochain cours, sinon le dernier passé. */
  boardId: string;
  /** Dates de tous les cours de cette classe qui portent une copie, du plus ancien au plus récent. */
  dates: Date[];
}

const byName = (a: string, b: string) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });

/**
 * Pastilles par original : une par classe, triées par nom. `now` sépare les cours à venir (dont
 * ceux du jour) des cours passés.
 */
export function placementChips(placements: Placement[], classes: ClassRef[], now: Date): Map<string, PlacementChip[]> {
  const names = new Map(classes.map((c) => [c.id, c.name]));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const bySource = new Map<string, Map<string, Placement[]>>();
  for (const p of placements) {
    const key = p.classId ?? `label:${p.label}`;
    const perClass = bySource.get(p.sourceBoardId) ?? new Map<string, Placement[]>();
    perClass.set(key, [...(perClass.get(key) ?? []), p]);
    bySource.set(p.sourceBoardId, perClass);
  }
  const out = new Map<string, PlacementChip[]>();
  for (const [source, perClass] of bySource) {
    const chips = [...perClass.entries()].map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      const upcoming = sorted.find((p) => p.startsAt >= today);
      const target = upcoming ?? sorted[sorted.length - 1];
      return {
        key,
        name: (target.classId && names.get(target.classId)) || target.label,
        boardId: target.boardId,
        dates: sorted.map((p) => p.startsAt),
      };
    });
    out.set(source, chips.sort((a, b) => byName(a.name, b.name)));
  }
  return out;
}

/** « mer. 18 nov. à 08:15 » */
export function formatSlot(date: Date): string {
  const day = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} à ${time}`;
}

// ---------------------------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------------------------

export async function fetchClasses(userId: string): Promise<ClassRef[]> {
  const { data, error } = await supabase.from('classes').select('id, name').eq('user_id', userId).order('name');
  if (error) throw error;
  return ((data ?? []) as ClassRef[]).sort((a, b) => byName(a.name, b.name));
}

let sourceColumnMissing = false;

/** Vrai si la migration 077 n'est pas appliquée (détecté au premier appel) : pas de provenance. */
export const placementsUnavailable = () => sourceColumnMissing;

/** Un document placé sur un créneau : la copie d'un original, ou un tableau créé sur le créneau. */
export interface PlacedDocument {
  /** Tableau du document (celui qui s'ouvre depuis le calendrier). */
  boardId: string;
  /** Original de la bibliothèque, s'il est connu. */
  sourceBoardId: string | null;
  classId: string | null;
  groupId: string | null;
  startsAt: Date;
  /** Libellé du cours dans l'emploi du temps (« 4D ») : sert de nom quand la classe est inconnue. */
  label: string;
  title: string;
  /** Cours rédigé (essai en classe possible) plutôt que tableau blanc. */
  isCourse: boolean;
}

/** PostgREST ne rend pas plus de 1 000 lignes : les plus récentes suffisent à une année scolaire. */
const MAX_DOCUMENTS = 1000;

/**
 * Tous les documents placés du professeur, du plus récent au plus ancien. La vue « Par classe »
 * les lit directement, sans passer par l'emploi du temps : un document dont le créneau a disparu
 * ou dont le libellé Pronote a changé reste trouvable. Table absente ou erreur : liste vide.
 */
export async function fetchPlacedDocuments(userId: string): Promise<PlacedDocument[]> {
  const query = (columns: string) => supabase
    .from('lesson_boards')
    .select(columns)
    .eq('user_id', userId)
    .order('starts_at', { ascending: false })
    .limit(MAX_DOCUMENTS);
  const base = 'board_id, class_id, group_id, starts_at, label, boards(title, course:doc->version)';
  type Res = { data: unknown[] | null; error: { message?: string; code?: string } | null };
  let { data, error } = (sourceColumnMissing ? await query(base) : await query(`${base}, source_board_id`)) as Res;
  if (error && (error.code === '42703' || /source_board_id/i.test(error.message ?? ''))) {
    sourceColumnMissing = true;
    console.warn('[coursePlacements] colonne « source_board_id » absente : migration 077 à appliquer');
    ({ data, error } = (await query(base)) as Res);
  }
  if (error) {
    if (error.code !== '42P01') console.warn('[coursePlacements] documents placés illisibles :', error.message);
    return [];
  }
  type BoardCols = { title: string; course?: unknown };
  type Row = { board_id: string; source_board_id?: string | null; class_id: string | null; group_id: string | null; starts_at: string; label: string; boards: BoardCols | BoardCols[] | null };
  return ((data ?? []) as Row[]).map((r) => {
    const b = Array.isArray(r.boards) ? r.boards[0] : r.boards;
    return {
      boardId: r.board_id,
      sourceBoardId: r.source_board_id ?? null,
      classId: r.class_id,
      groupId: r.group_id,
      startsAt: new Date(r.starts_at),
      label: r.label,
      title: b?.title ?? 'Tableau',
      isCourse: b?.course != null,
    };
  });
}

/** Les copies dont l'original est connu (pastilles de la bibliothèque). */
export function placementsOf(documents: PlacedDocument[]): Placement[] {
  return documents.flatMap((d) => (d.sourceBoardId ? [{ boardId: d.boardId, sourceBoardId: d.sourceBoardId, classId: d.classId, startsAt: d.startsAt, label: d.label }] : []));
}

// ---------------------------------------------------------------------------------------------
// Vue « Par classe » (lot C4)
// ---------------------------------------------------------------------------------------------

/** Séance partie d'un document (table session_boards). */
export interface DocumentSession {
  sessionId: string;
  startedAt: Date;
}

export interface TimelineEntry {
  doc: PlacedDocument;
  /** Séance qui a joué ce document, la plus récente s'il y en a plusieurs. */
  session: DocumentSession | null;
}

export interface Timeline {
  /** Du plus proche au plus lointain. */
  upcoming: TimelineEntry[];
  /** Du plus récent au plus ancien. */
  past: TimelineEntry[];
}

/**
 * Range des documents en « à venir » et « passé ». Un document est passé dès qu'une séance l'a
 * joué, ou quand son cours est d'un jour précédent ; les cours du jour sans séance restent à venir.
 */
export function buildTimeline(documents: PlacedDocument[], sessions: Map<string, DocumentSession[]>, now: Date): Timeline {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const upcoming: TimelineEntry[] = [];
  const past: TimelineEntry[] = [];
  for (const doc of documents) {
    const played = [...(sessions.get(doc.boardId) ?? [])].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0] ?? null;
    if (played || doc.startsAt < today) past.push({ doc, session: played });
    else upcoming.push({ doc, session: null });
  }
  upcoming.sort((a, b) => a.doc.startsAt.getTime() - b.doc.startsAt.getTime());
  past.sort((a, b) => b.doc.startsAt.getTime() - a.doc.startsAt.getTime());
  return { upcoming, past };
}

/** Clé de la « classe » des documents dont la classe est inconnue ou supprimée. */
export const NO_CLASS = 'sans-classe';

/** Documents d'une classe (`NO_CLASS` : ceux qu'aucune classe connue ne porte). */
export function documentsOfClass(documents: PlacedDocument[], classId: string, classes: ClassRef[]): PlacedDocument[] {
  if (classId !== NO_CLASS) return documents.filter((d) => d.classId === classId);
  const known = new Set(classes.map((c) => c.id));
  return documents.filter((d) => d.classId === null || !known.has(d.classId));
}

/** Classes qui portent au moins un document, dans l'ordre de la liste ; `other` : il en reste sans classe. */
export function classesWithDocuments(documents: PlacedDocument[], classes: ClassRef[]): { classes: ClassRef[]; other: boolean } {
  const used = new Set(documents.map((d) => d.classId));
  const known = new Set(classes.map((c) => c.id));
  return {
    classes: classes.filter((c) => used.has(c.id)),
    other: documents.some((d) => d.classId === null || !known.has(d.classId)),
  };
}

/** La même activité dans toutes les classes : les copies d'un même original. */
export function documentsOfActivity(documents: PlacedDocument[], sourceBoardId: string): PlacedDocument[] {
  return documents.filter((d) => d.sourceBoardId === sourceBoardId);
}

/**
 * Cours à venir de mes classes dans [from, to[, d'après l'emploi du temps enregistré : ni les cours
 * annulés, ni ceux dont le libellé n'est rattaché à aucune classe.
 */
export async function fetchUpcomingLessons(userId: string, from: Date, to: Date, classes: ClassRef[]): Promise<TimetableLesson[]> {
  const [entries, links, groups] = await Promise.all([
    fetchEntriesBetween(userId, from, to),
    fetchLabelLinks(userId),
    fetchClassGroupsForUser(userId),
  ]);
  const linkMap = new Map(links.map((l) => [l.label, l]));
  const lessons: TimetableLesson[] = entries.filter((e) => e.kind === 'lesson').map((e) => ({
    id: e.id,
    start: new Date(e.starts_at),
    end: new Date(e.ends_at),
    label: e.label,
    subject: e.subject,
    room: e.room,
    status: e.status,
    ...resolveLabel(e.label, e.class_label, linkMap, classes, groups),
  }));
  return dropReplacedCancellations(lessons)
    .filter((l) => l.status !== 'canceled' && l.classId !== null && l.start >= from)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
