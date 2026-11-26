/**
 * Groupe de classe du cours « de maintenant », d'après l'emploi du temps (timetable_entries) et la
 * correspondance libellé Pronote -> classe / groupe (timetable_label_links, migration 043).
 * Exemple : un cours « 3°AP1 » relié à 3A / Groupe 1 -> la séance de 3A part sur le Groupe 1.
 * Jumeau mobile : gestion-classe-mobile/utils/lessonGroup.ts (même logique, même fenêtre).
 */
import { supabase } from './supabase';

/** Un cours est « de maintenant » s'il a commencé il y a moins de 50 min ou commence dans moins de 30 min. */
export const LESSON_BEFORE_MS = 50 * 60 * 1000;
export const LESSON_AFTER_MS = 30 * 60 * 1000;

export interface TimetableLessonLike {
  label: string;
  starts_at: string;
}

export interface LabelLinkLike {
  label: string;
  class_id: string | null;
  group_id: string | null;
  ignored?: boolean | null;
}

export interface LessonGroupMatch {
  /** Libellé Pronote du cours (« 3°AP1 ») */
  label: string;
  /** Groupe relié au libellé ; null = cours en classe entière */
  groupId: string | null;
  startsAt: string;
}

/**
 * Cours de la classe dont le début est le plus proche de `at`, dans la fenêtre
 * [at - 50 min, at + 30 min]. null s'il n'y en a aucun (pas de cours, libellé non relié).
 * Un groupe qui n'appartient pas aux groupes connus de la classe est ignoré (lien périmé).
 */
export function pickLessonGroup(
  lessons: TimetableLessonLike[],
  links: LabelLinkLike[],
  classId: string,
  at: Date,
  knownGroupIds?: Iterable<string> | null,
): LessonGroupMatch | null {
  const byLabel = new Map<string, LabelLinkLike>();
  for (const l of links) byLabel.set(l.label, l);
  const known = knownGroupIds ? new Set(knownGroupIds) : null;
  const t = at.getTime();

  let best: LessonGroupMatch | null = null;
  let bestDelta = Infinity;
  for (const lesson of lessons) {
    const link = byLabel.get(lesson.label);
    if (!link || link.ignored || link.class_id !== classId) continue;
    const start = new Date(lesson.starts_at).getTime();
    if (Number.isNaN(start)) continue;
    if (start < t - LESSON_BEFORE_MS || start > t + LESSON_AFTER_MS) continue;
    const delta = Math.abs(start - t);
    if (delta >= bestDelta) continue;
    const groupId = link.group_id && (!known || known.has(link.group_id)) ? link.group_id : null;
    best = { label: lesson.label, groupId, startsAt: lesson.starts_at };
    bestDelta = delta;
  }
  return best;
}

/** Lecture serveur ; null en cas d'erreur (l'appelant retombe sur l'alternance). */
export async function fetchLessonGroupFor(
  classId: string,
  at: Date,
  knownGroupIds?: Iterable<string> | null,
): Promise<LessonGroupMatch | null> {
  try {
    const { data: lessons, error } = await supabase
      .from('timetable_entries')
      .select('label, starts_at')
      .eq('kind', 'lesson')
      .gte('starts_at', new Date(at.getTime() - LESSON_BEFORE_MS).toISOString())
      .lte('starts_at', new Date(at.getTime() + LESSON_AFTER_MS).toISOString());
    if (error || !lessons || lessons.length === 0) return null;
    const labels = [...new Set(lessons.map(l => l.label as string))];
    const { data: links, error: linkError } = await supabase
      .from('timetable_label_links')
      .select('label, class_id, group_id, ignored')
      .in('label', labels);
    if (linkError || !links) return null;
    return pickLessonGroup(lessons, links, classId, at, knownGroupIds);
  } catch {
    return null;
  }
}
