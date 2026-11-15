/**
 * Rappel des évals à faire rattraper aux absents (migration 066, vue pending_makeups).
 *
 * Rien n'est stocké par cours : la vue liste les élèves absents à une éval écrite récente,
 * sans note ni copie, et l'accueil place chaque élève sur le PROCHAIN cours de sa classe
 * (ou de son demi-groupe). Le rattrapage n'a pas eu lieu ? Une fois le cours passé, l'élève
 * glisse tout seul sur le cours suivant. Une copie scannée ou une note saisie le sort de la vue.
 */
import { supabase } from '../supabase';
import { lessonNoteKey } from './lessonNotesQueries';
import type { TimetableLesson } from './weekView';

/** Une ligne de la vue : un élève absent à une éval. */
export interface PendingMakeup {
  assessmentId: string;
  assessmentName: string;
  /** jour de l'éval (minuit local) */
  assessmentDate: Date;
  classId: string;
  /** éval passée en demi-groupe (null : classe entière) */
  groupId: string | null;
  studentId: string;
  pseudo: string;
  /** demi-groupes de l'élève */
  studentGroupIds: string[];
}

/** Ce qu'un cours doit rappeler pour une éval : « Faire reprendre l'éval X à : … ». */
export interface MakeupReminder {
  assessmentId: string;
  assessmentName: string;
  assessmentDate: Date;
  students: { id: string; pseudo: string }[];
}

type Row = {
  assessment_id: string;
  assessment_name: string;
  assessment_date: string;
  class_id: string;
  group_id: string | null;
  student_id: string;
  pseudo: string;
  student_group_ids: string[] | null;
};

/** « 2026-11-06 » -> minuit local (pas UTC : le jour de l'éval est un jour du collège). */
function localDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Élèves à faire rattraper. Vue absente (migration non passée) ou erreur : liste vide. */
export async function fetchPendingMakeups(userId: string): Promise<PendingMakeup[]> {
  const { data, error } = await supabase
    .from('pending_makeups')
    .select('assessment_id, assessment_name, assessment_date, class_id, group_id, student_id, pseudo, student_group_ids')
    .eq('user_id', userId);
  if (error) {
    console.warn('[rattrapages] lecture impossible :', error.message);
    return [];
  }
  return ((data || []) as Row[]).map(r => ({
    assessmentId: r.assessment_id,
    assessmentName: r.assessment_name,
    assessmentDate: localDay(r.assessment_date),
    classId: r.class_id,
    groupId: r.group_id,
    studentId: r.student_id,
    pseudo: r.pseudo,
    studentGroupIds: r.student_group_ids ?? [],
  }));
}

/** « Ne plus rappeler » pour toute l'éval (null = rallumer le rappel). */
export async function setMakeupReminderDismissed(assessmentId: string, dismissed: boolean): Promise<void> {
  const { error } = await supabase
    .from('written_assessments')
    .update({ makeup_reminder_dismissed_at: dismissed ? new Date().toISOString() : null })
    .eq('id', assessmentId);
  if (error) throw error;
}

/**
 * L'élève peut-il rattraper pendant ce cours ? Même classe, et si le cours est en demi-groupe :
 * l'éval était celle de ce groupe, ou l'élève est membre du groupe (ou d'aucun groupe). Un cours
 * en classe entière convient toujours.
 */
export function lessonFitsMakeup(
  lesson: Pick<TimetableLesson, 'classId' | 'groupId'>,
  m: Pick<PendingMakeup, 'classId' | 'groupId' | 'studentGroupIds'>,
): boolean {
  if (!lesson.classId || lesson.classId !== m.classId) return false;
  if (!lesson.groupId) return true;
  if (m.groupId) return m.groupId === lesson.groupId;
  // Élève rangé dans aucun demi-groupe : n'importe quel cours de la classe
  return m.studentGroupIds.length === 0 || m.studentGroupIds.includes(lesson.groupId);
}

/**
 * Place chaque élève sur le premier cours qui lui convient, non terminé à `now`, et qui
 * commence au plus tôt le lendemain de l'éval (le cours de l'éval elle-même ne compte pas).
 * `lessons` doit couvrir tout ce qui est connu de `now` à la fin de la semaine affichée :
 * un élève dont le prochain cours tombe avant la semaine affichée n'y apparaît pas.
 * Résultat indexé par lessonNoteKey (heure de début + libellé), une entrée par éval.
 */
export function placeMakeups(
  makeups: PendingMakeup[],
  lessons: Pick<TimetableLesson, 'start' | 'end' | 'label' | 'classId' | 'groupId' | 'status'>[],
  now: Date,
): Map<string, MakeupReminder[]> {
  const upcoming = lessons
    .filter(l => l.classId && l.status !== 'canceled' && l.end > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const byLesson = new Map<string, MakeupReminder[]>();
  for (const m of makeups) {
    const from = new Date(m.assessmentDate);
    from.setDate(from.getDate() + 1);
    const lesson = upcoming.find(l => l.start >= from && lessonFitsMakeup(l, m));
    if (!lesson) continue;
    const key = lessonNoteKey(lesson.start, lesson.label);
    const list = byLesson.get(key) ?? [];
    let reminder = list.find(r => r.assessmentId === m.assessmentId);
    if (!reminder) {
      reminder = { assessmentId: m.assessmentId, assessmentName: m.assessmentName, assessmentDate: m.assessmentDate, students: [] };
      list.push(reminder);
      byLesson.set(key, list);
    }
    reminder.students.push({ id: m.studentId, pseudo: m.pseudo });
  }
  for (const list of byLesson.values()) {
    list.sort((a, b) => a.assessmentDate.getTime() - b.assessmentDate.getTime());
    for (const r of list) r.students.sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
  }
  return byLesson;
}

export function makeupsForLesson(
  byLesson: Map<string, MakeupReminder[]>,
  lesson: Pick<TimetableLesson, 'start' | 'label'>,
): MakeupReminder[] {
  return byLesson.get(lessonNoteKey(lesson.start, lesson.label)) ?? [];
}

/** « Faire reprendre l'éval Micro-organismes à : Léa M., Tom B. » */
export function makeupSentence(r: MakeupReminder): string {
  return `Faire reprendre l'éval ${r.assessmentName} à : ${r.students.map(s => s.pseudo).join(', ')}`;
}
