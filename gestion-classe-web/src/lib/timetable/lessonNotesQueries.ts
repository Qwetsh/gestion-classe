/**
 * Notes sur un cours de l'emploi du temps (migration 044, table lesson_notes).
 *
 * Une note n'est pas une séance : rien n'est créé dans `sessions`. Elle est identifiée par
 * (user_id, starts_at, label), ce qui vaut pour toutes les sources (Pronote en direct, .ics,
 * saisie manuelle). class_id / group_id sont recopiés pour que le téléphone la retrouve.
 */
import { supabase } from '../supabase';
import type { TimetableLesson } from './weekView';

export interface LessonNote {
  id: string;
  startsAt: Date;
  endsAt: Date;
  label: string;
  classId: string | null;
  groupId: string | null;
  content: string;
  done: boolean;
  updatedAt: Date;
}

/** Clé de rapprochement note <-> cours : heure de début (à la minute) + libellé. */
export function lessonNoteKey(startsAt: Date, label: string): string {
  const t = new Date(startsAt);
  t.setSeconds(0, 0);
  return `${t.getTime()}|${label.trim().toLowerCase()}`;
}

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  class_id: string | null;
  group_id: string | null;
  content: string;
  done: boolean;
  updated_at: string;
};

function fromRow(r: Row): LessonNote {
  return {
    id: r.id,
    startsAt: new Date(r.starts_at),
    endsAt: new Date(r.ends_at),
    label: r.label,
    classId: r.class_id,
    groupId: r.group_id,
    content: r.content,
    done: !!r.done,
    updatedAt: new Date(r.updated_at),
  };
}

/** Notes dont le cours commence dans [from, to[. Table absente : liste vide (l'accueil s'en passe). */
export async function fetchLessonNotes(userId: string, from: Date, to: Date): Promise<LessonNote[]> {
  const { data, error } = await supabase
    .from('lesson_notes')
    .select('id, starts_at, ends_at, label, class_id, group_id, content, done, updated_at')
    .eq('user_id', userId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString());
  if (error) {
    console.warn('[lessonNotes] lecture impossible :', error.message);
    return [];
  }
  return ((data || []) as Row[]).map(fromRow);
}

/** Indexe les notes par clé de cours (cf. lessonNoteKey). */
export function indexLessonNotes(notes: LessonNote[]): Map<string, LessonNote> {
  const map = new Map<string, LessonNote>();
  for (const n of notes) map.set(lessonNoteKey(n.startsAt, n.label), n);
  return map;
}

export function noteForLesson(notes: Map<string, LessonNote>, lesson: Pick<TimetableLesson, 'start' | 'label'>): LessonNote | null {
  return notes.get(lessonNoteKey(lesson.start, lesson.label)) ?? null;
}

/** Crée ou remplace la note d'un cours (une seule note par cours). Contenu vide = suppression. */
export async function saveLessonNote(
  userId: string,
  lesson: Pick<TimetableLesson, 'start' | 'end' | 'label' | 'classId' | 'groupId'>,
  content: string,
): Promise<LessonNote | null> {
  const text = content.trim();
  const startsAt = new Date(lesson.start);
  startsAt.setSeconds(0, 0);
  if (!text) {
    await deleteLessonNote(userId, startsAt, lesson.label);
    return null;
  }
  const { data, error } = await supabase
    .from('lesson_notes')
    .upsert(
      {
        user_id: userId,
        starts_at: startsAt.toISOString(),
        ends_at: new Date(lesson.end).toISOString(),
        label: lesson.label,
        class_id: lesson.classId ?? null,
        group_id: lesson.groupId ?? null,
        content: text,
        done: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,starts_at,label' },
    )
    .select('id, starts_at, ends_at, label, class_id, group_id, content, done, updated_at')
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function deleteLessonNote(userId: string, startsAt: Date, label: string): Promise<void> {
  const t = new Date(startsAt);
  t.setSeconds(0, 0);
  const { error } = await supabase
    .from('lesson_notes')
    .delete()
    .eq('user_id', userId)
    .eq('starts_at', t.toISOString())
    .eq('label', label);
  if (error) throw error;
}

export async function setLessonNoteDone(noteId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('lesson_notes')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', noteId);
  if (error) throw error;
}
