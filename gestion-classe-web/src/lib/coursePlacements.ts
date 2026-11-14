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

/** Vrai si la migration 077 n'est pas appliquée (détecté au premier appel) : pas de pastilles. */
export const placementsUnavailable = () => sourceColumnMissing;

/** Toutes les copies placées dont l'original est connu. Migration absente ou erreur : liste vide. */
export async function fetchPlacements(userId: string): Promise<Placement[]> {
  if (sourceColumnMissing) return [];
  const { data, error } = await supabase
    .from('lesson_boards')
    .select('board_id, source_board_id, class_id, starts_at, label')
    .eq('user_id', userId)
    .not('source_board_id', 'is', null)
    .order('starts_at', { ascending: true });
  if (error) {
    if (error.code === '42703' || /source_board_id/i.test(error.message ?? '')) {
      sourceColumnMissing = true;
      console.warn('[coursePlacements] colonne « source_board_id » absente : migration 077 à appliquer');
    } else if (error.code !== '42P01') {
      console.warn('[coursePlacements] placements illisibles :', error.message);
    }
    return [];
  }
  type Row = { board_id: string; source_board_id: string; class_id: string | null; starts_at: string; label: string };
  return ((data ?? []) as Row[]).map((r) => ({
    boardId: r.board_id,
    sourceBoardId: r.source_board_id,
    classId: r.class_id,
    startsAt: new Date(r.starts_at),
    label: r.label,
  }));
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
