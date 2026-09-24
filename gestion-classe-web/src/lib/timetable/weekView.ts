/**
 * Mise en forme d'une semaine d'emploi du temps, quelle que soit la source (Pronote en direct,
 * import .ics, saisie manuelle) : répartition par jour, cours superposés côte à côte, congés.
 */

export type LessonStatus = 'normal' | 'canceled' | 'modified' | 'exceptional';

/** Un cours, tel que l'accueil l'affiche — indépendant de sa source. */
export interface TimetableLesson {
  id: string;
  start: Date;
  end: Date;
  /** libellé Pronote (« 4D », « 3°EP1 ») : clé de correspondance */
  label: string;
  subject: string | null;
  room: string | null;
  status: LessonStatus;
  /** résolus via la correspondance des libellés ; null = pas une de mes classes */
  classId: string | null;
  className: string | null;
  groupId: string | null;
  groupName: string | null;
}

export interface TimetableHoliday {
  id: string;
  label: string;
  start: Date;
  /** exclusif */
  end: Date;
}

export interface PlacedLesson extends TimetableLesson {
  /** colonne occupée parmi `lanes` quand plusieurs cours se chevauchent */
  lane: number;
  lanes: number;
}

export interface TimetableDay {
  date: Date;
  lessons: PlacedLesson[];
  /** congé qui couvre la journée (vacances, férié) */
  holiday: string | null;
}

export interface TimetableWeek {
  monday: Date;
  days: TimetableDay[];
  /** plage horaire affichée, en heures entières */
  startHour: number;
  endHour: number;
}

export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const overlaps = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
  a.start < b.end && b.start < a.end;

/**
 * Pronote exporte parfois un cours annulé ET son remplaçant sur le même créneau
 * (ex. « Réservation de matériel ») : on ne garde alors que celui qui a lieu.
 */
export function dropReplacedCancellations<T extends TimetableLesson>(lessons: T[]): T[] {
  return lessons.filter(l =>
    l.status !== 'canceled' ||
    !lessons.some(o => o !== l && o.status !== 'canceled' && o.label === l.label && overlaps(o, l)),
  );
}

/** Cours qui se chevauchent : chacun reçoit une colonne, le groupe partage la largeur. */
export function placeLessons(lessons: TimetableLesson[]): PlacedLesson[] {
  const sorted = [...lessons].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const out: PlacedLesson[] = [];
  let cluster: PlacedLesson[] = [];
  let clusterEnd = 0;

  const flush = () => {
    const lanes = cluster.reduce((m, l) => Math.max(m, l.lane + 1), 0);
    for (const l of cluster) l.lanes = lanes;
    out.push(...cluster);
    cluster = [];
  };

  for (const lesson of sorted) {
    if (cluster.length > 0 && lesson.start.getTime() >= clusterEnd) flush();
    const laneEnds: number[] = [];
    for (const c of cluster) laneEnds[c.lane] = Math.max(laneEnds[c.lane] ?? 0, c.end.getTime());
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] > lesson.start.getTime()) lane++;
    cluster.push({ ...lesson, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, lesson.end.getTime());
  }
  if (cluster.length > 0) flush();
  return out;
}

/**
 * Semaine du lundi donné : lundi → vendredi, plus le samedi s'il y a cours.
 * La plage horaire s'ajuste aux cours (8 h – 17 h au minimum).
 */
export function buildWeek(
  monday: Date,
  lessons: TimetableLesson[],
  holidays: TimetableHoliday[],
): TimetableWeek {
  const kept = dropReplacedCancellations(lessons);
  const saturday = addDays(monday, 5);
  const dayCount = kept.some(l => sameDay(l.start, saturday)) ? 6 : 5;

  const days: TimetableDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(monday, i);
    const next = addDays(date, 1);
    const holiday = holidays.find(h => h.start < next && h.end > date);
    days.push({
      date,
      lessons: placeLessons(kept.filter(l => sameDay(l.start, date))),
      holiday: holiday?.label ?? null,
    });
  }

  let startHour = 8;
  let endHour = 17;
  for (const l of kept) {
    startHour = Math.min(startHour, l.start.getHours());
    endHour = Math.max(endHour, l.end.getHours() + (l.end.getMinutes() > 0 ? 1 : 0));
  }

  return { monday, days, startHour, endHour };
}

/** Position verticale en % de la plage horaire (pour un affichage qui suit la hauteur du module). */
export function percentOfDay(date: Date, startHour: number, endHour: number): number {
  const minutes = (date.getHours() - startHour) * 60 + date.getMinutes();
  return Math.min(100, Math.max(0, (minutes / ((endHour - startHour) * 60)) * 100));
}

/** Tolérance pour rattacher une séance à un cours : démarrée un peu avant la sonnerie. */
const SESSION_EARLY_MS = 15 * 60_000;

type SessionLike = { classId: string; groupId: string | null; startedAt: Date };
type LessonLike = Pick<TimetableLesson, 'id' | 'classId' | 'groupId' | 'start' | 'end'>;

/**
 * Rattache chaque séance enregistrée à UN cours au plus : même classe (et même groupe quand
 * les deux en précisent un), démarrée entre 15 min avant le début et la fin du cours.
 * Parmi les cours possibles, celui dont le début est le plus proche l'emporte : une séance
 * lancée à 14 h 37 revient au cours de 14 h 40, pas à celui de 13 h 40 qui se termine.
 * Un cours ne garde qu'une séance, la plus proche de son début.
 */
export function assignSessions<S extends SessionLike>(lessons: LessonLike[], sessions: S[]): Map<string, S> {
  const byLesson = new Map<string, S>();
  const gap = (l: LessonLike, s: S) => Math.abs(s.startedAt.getTime() - l.start.getTime());

  for (const s of sessions) {
    const t = s.startedAt.getTime();
    let best: LessonLike | null = null;
    for (const l of lessons) {
      if (!l.classId || l.classId !== s.classId) continue;
      if (l.groupId && s.groupId && l.groupId !== s.groupId) continue;
      if (t < l.start.getTime() - SESSION_EARLY_MS || t >= l.end.getTime()) continue;
      if (!best || gap(l, s) < gap(best, s)) best = l;
    }
    if (!best) continue;
    const already = byLesson.get(best.id);
    if (!already || gap(best, s) < gap(best, already)) byLesson.set(best.id, s);
  }
  return byLesson;
}
