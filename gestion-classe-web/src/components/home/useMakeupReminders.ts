import { useCallback, useEffect, useState } from 'react';
import { fetchEntriesBetween, type StoredTimetableEntry } from '../../lib/timetable/timetableQueries';
import {
  fetchPendingMakeups, placeMakeups, setMakeupReminderDismissed,
  type MakeupReminder, type PendingMakeup,
} from '../../lib/timetable/makeupReminders';
import type { TimetableLesson } from '../../lib/timetable/weekView';

/**
 * Rappels « faire rattraper l'éval aux absents » de l'accueil (migration 066).
 *
 * Les élèves à faire rattraper sont relus au montage et quand l'onglet redevient visible
 * (on scanne la copie sur le téléphone, on revient sur le PC). Leur placement sur le prochain
 * cours se calcule à l'heure du composant qui affiche (`placeMakeupsAt(now)`) : un cours qui
 * se termine sans rattrapage passe le relais au suivant sans rien relire.
 *
 * Semaine future : il faut aussi connaître les cours d'ici là, sinon un élève qui a cours
 * mercredi apparaîtrait aussi la semaine suivante. Avec l'emploi du temps importé, on les lit ;
 * avec Pronote en direct (une semaine à la fois), les rappels ne s'affichent que sur la
 * semaine en cours.
 */
export function useMakeupReminders({
  userId, weekLessons, viewedMonday, pronoteConnected, toLesson,
}: {
  userId: string | undefined;
  /** cours de la semaine affichée */
  weekLessons: TimetableLesson[];
  viewedMonday: Date;
  pronoteConnected: boolean;
  /** conversion d'un cours importé (même résolution des libellés que la semaine affichée) */
  toLesson: (e: StoredTimetableEntry) => TimetableLesson;
}) {
  const [pending, setPending] = useState<PendingMakeup[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchPendingMakeups(userId).then(rows => { if (!cancelled) setPending(rows); });
    return () => { cancelled = true; };
  }, [userId, reload]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setReload(r => r + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Cours entre aujourd'hui et la semaine affichée, quand elle est dans le futur
  const viewedMs = viewedMonday.getTime();
  const futureWeek = viewedMs > Date.now();
  const [gapEntries, setGapEntries] = useState<StoredTimetableEntry[]>([]);
  useEffect(() => {
    if (!userId || pronoteConnected || !futureWeek) { setGapEntries([]); return; }
    let cancelled = false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    fetchEntriesBetween(userId, today, new Date(viewedMs))
      .then(rows => { if (!cancelled) setGapEntries(rows.filter(e => e.kind === 'lesson')); })
      .catch(() => { if (!cancelled) setGapEntries([]); });
    return () => { cancelled = true; };
  }, [userId, pronoteConnected, futureWeek, viewedMs]);

  const hidden = pronoteConnected && futureWeek;
  const lessons = hidden ? [] : [...gapEntries.map(toLesson), ...weekLessons];

  const placeMakeupsAt = useCallback(
    (now: Date): Map<string, MakeupReminder[]> => placeMakeups(pending, lessons, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, gapEntries, weekLessons, hidden],
  );

  const dismissMakeup = useCallback(async (assessmentId: string) => {
    await setMakeupReminderDismissed(assessmentId, true);
    setPending(prev => prev.filter(m => m.assessmentId !== assessmentId));
  }, []);

  return { placeMakeupsAt, dismissMakeup };
}
