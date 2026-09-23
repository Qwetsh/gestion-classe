/**
 * Toutes les données de l'accueil, chargées une seule fois et partagées par les modules.
 * Un module ne requête jamais Supabase lui-même (sinon dix modules = dix fois les mêmes appels).
 * Extrait de l'ancien Dashboard.tsx (lot 0 de PLAN_accueil_modulaire.md).
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { pronoteFetcher } from '../../lib/pronoteFetcher';
import type { TimetableClassLesson, Timetable, RefreshInformation } from 'pawnote';
import { getMonday, isSameDay } from './homeHelpers';

// ---- Types ----

export interface DashClass { id: string; name: string; }

export interface RecentSession {
  id: string;
  class_id: string;
  class_name: string;
  started_at: string;
  ended_at: string | null;
  topic: string | null;
  events_count: number;
  pos_count: number;
  neg_count: number;
  abs_count: number;
}

export interface StudentAlert {
  id: string;
  pseudo: string;
  class_id: string;
  class_name: string;
  grade: number;
  trend: number;
  malus: number;
  absences: number;
  sessionsCount: number;
  reason: string;
}

export interface ClassAverage {
  class_id: string;
  class_name: string;
  average: number;
}

export interface PronoteLesson {
  id: string;
  startDate: Date;
  endDate: Date;
  subject?: string;
  teacherNames: string[];
  classrooms: string[];
  groupNames: string[];
  canceled: boolean;
  status?: string;
}

export interface WeekDay {
  date: Date;
  label: string;
  lessons: PronoteLesson[];
}

export interface HomeData {
  isLoading: boolean;

  // Supabase
  classes: DashClass[];
  classNames: string[];
  recentSessions: RecentSession[];
  studentAlerts: StudentAlert[];
  classAverages: ClassAverage[];
  avgImplication: number;
  alertCount: number;
  weekSessionsCount: number;
  weekSessionsDone: number;
  weekSessionsUpcoming: number;

  // Pronote
  pronoteConnected: boolean;
  pronoteLessons: PronoteLesson[];
  nextLesson: PronoteLesson | null;
  todayLessons: PronoteLesson[];
  tomorrowLessons: PronoteLesson[];
  weekDays: WeekDay[];
  viewedMonday: Date;
  isCurrentWeek: boolean;
  weekOffset: number;
  ttLoading: boolean;
  ttView: 'list' | 'calendar';
  setTtView: (v: 'list' | 'calendar') => void;
  loadWeek: (offset: number) => void;

  // Repères de temps, calculés une fois pour toute la page
  now: Date;
  tomorrow: Date;

  /** Ouvre l'ardoise libre (le tableau blanc vit dans la page, pas dans un module) */
  openBoard: () => void;
}

// ---- Pronote helpers ----

const PRONOTE_STORAGE_KEY = 'pronote_session';

interface StoredPronoteSession {
  token: string;
  username: string;
  url: string;
  kind: number;
  deviceUUID: string;
}

function loadStoredPronoteSession(): StoredPronoteSession | null {
  try {
    const raw = localStorage.getItem(PRONOTE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function savePronoteSession(info: RefreshInformation, deviceUUID: string) {
  localStorage.setItem(PRONOTE_STORAGE_KEY, JSON.stringify({
    token: info.token, username: info.username,
    url: info.url, kind: info.kind, deviceUUID,
  }));
}

function parseLessons(timetable: Timetable): PronoteLesson[] {
  return timetable.classes
    .filter((c): c is TimetableClassLesson => c.is === 'lesson')
    .map(lesson => ({
      id: lesson.id,
      startDate: new Date(lesson.startDate),
      endDate: new Date(lesson.endDate),
      subject: lesson.subject?.name,
      teacherNames: lesson.teacherNames || [],
      classrooms: lesson.classrooms || [],
      groupNames: lesson.groupNames || [],
      canceled: lesson.canceled,
      status: lesson.status,
    }));
}

// ---- Contexte ----

const HomeDataContext = createContext<HomeData | null>(null);

export function useHomeData(): HomeData {
  const ctx = useContext(HomeDataContext);
  if (!ctx) throw new Error('useHomeData doit être utilisé dans un HomeDataProvider');
  return ctx;
}

export function HomeDataProvider({ children, onOpenBoard }: { children: ReactNode; onOpenBoard: () => void }) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  // Core data
  const [classes, setClasses] = useState<DashClass[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [studentAlerts, setStudentAlerts] = useState<StudentAlert[]>([]);
  const [classAverages, setClassAverages] = useState<ClassAverage[]>([]);

  // KPIs
  const [avgImplication, setAvgImplication] = useState<number>(0);
  const [alertCount, setAlertCount] = useState<number>(0);
  const [weekSessionsCount, setWeekSessionsCount] = useState<number>(0);
  const [weekSessionsDone, setWeekSessionsDone] = useState<number>(0);
  const [weekSessionsUpcoming, setWeekSessionsUpcoming] = useState<number>(0);

  // Pronote
  const [pronoteConnected, setPronoteConnected] = useState(false);
  const [pronoteLessons, setPronoteLessons] = useState<PronoteLesson[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttView, setTtView] = useState<'list' | 'calendar'>('list');
  const pronoteAttempted = useRef(false);
  const pronoteSessionRef = useRef<any>(null);
  const pawnoteRef = useRef<any>(null);
  const pronoteFirstDay = useRef<Date | null>(null);

  const classNames = classes.map(c => c.name);

  // ---- Load Pronote data ----

  useEffect(() => {
    if (pronoteAttempted.current) return;
    pronoteAttempted.current = true;

    const stored = loadStoredPronoteSession();
    if (!stored) return;

    // Timeout to avoid blocking if Pronote is slow
    const PRONOTE_TIMEOUT = 8000;

    const pronotePromise = (async () => {
      const pw = await import('pawnote');
      const sess = pw.createSessionHandle(pronoteFetcher);
      const refreshInfo = await pw.loginToken(sess, {
        url: stored.url,
        kind: stored.kind as typeof pw.AccountKind[keyof typeof pw.AccountKind],
        username: stored.username,
        token: stored.token,
        deviceUUID: stored.deviceUUID,
      });

      savePronoteSession(refreshInfo, stored.deviceUUID);
      pronoteSessionRef.current = sess;
      pawnoteRef.current = pw;

      // Load current week timetable
      const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
      if (startDay) {
        pronoteFirstDay.current = new Date(startDay);
        const weekStart = getMonday(new Date());
        const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
        const timetable = await pw.timetableFromWeek(sess, weekNum);
        setPronoteLessons(parseLessons(timetable));
      }

      setPronoteConnected(true);
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Pronote timeout')), PRONOTE_TIMEOUT)
    );

    Promise.race([pronotePromise, timeoutPromise]).catch(err => {
      console.error('Dashboard Pronote auto-reconnect failed:', err);
      // Silent fail — Pronote sections just won't show
    });
  }, []);

  // ---- Load specific week ----

  const loadWeek = async (offset: number) => {
    const pw = pawnoteRef.current;
    const sess = pronoteSessionRef.current;
    const firstDay = pronoteFirstDay.current;
    if (!pw || !sess || !firstDay) return;

    setTtLoading(true);
    try {
      const targetMonday = getMonday(new Date());
      targetMonday.setDate(targetMonday.getDate() + offset * 7);
      const weekNum = pw.translateToWeekNumber(targetMonday, firstDay);
      const timetable = await pw.timetableFromWeek(sess, weekNum);
      setPronoteLessons(parseLessons(timetable));
      setWeekOffset(offset);
    } catch (err) {
      console.error('Failed to load week:', err);
    } finally {
      setTtLoading(false);
    }
  };

  // ---- Compute Pronote-derived data ----

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextLesson = pronoteLessons
    .filter(l => !l.canceled && l.startDate > now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] || null;

  const viewedMonday = getMonday(now);
  viewedMonday.setDate(viewedMonday.getDate() + weekOffset * 7);
  const isCurrentWeek = weekOffset === 0;

  const todayLessons = isCurrentWeek
    ? pronoteLessons
        .filter(l => isSameDay(l.startDate, now))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    : [];

  const tomorrowLessons = pronoteLessons
    .filter(l => !l.canceled && isSameDay(l.startDate, tomorrow))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const weekDays: WeekDay[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(viewedMonday);
    d.setDate(d.getDate() + i);
    weekDays.push({
      date: d,
      label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      lessons: pronoteLessons
        .filter(l => isSameDay(l.startDate, d))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    });
  }

  // ---- Load Supabase data ----

  useEffect(() => {
    if (!user) return;

    (async () => {
      setIsLoading(true);

      try {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const monday = getMonday(new Date());
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);

        // Parallel batch 1: all independent queries
        const [
          { data: classesData },
          { data: sessionsData },
          { data: weekSessions },
          { data: studentsData },
        ] = await Promise.all([
          supabase.from('classes').select('id, name').eq('user_id', user.id).order('name'),
          supabase.from('sessions')
            .select('id, class_id, started_at, ended_at, topic, classes (name)')
            .eq('user_id', user.id)
            .gte('started_at', tenDaysAgo.toISOString())
            .order('started_at', { ascending: false })
            .limit(5),
          supabase.from('sessions')
            .select('id, started_at, ended_at')
            .eq('user_id', user.id)
            .gte('started_at', monday.toISOString())
            .lte('started_at', sunday.toISOString()),
          supabase.from('students')
            .select('id, pseudo, class_id, classes (name)')
            .eq('user_id', user.id),
        ]);

        const cls = (classesData || []) as DashClass[];
        setClasses(cls);

        // Week sessions
        const wSessions = weekSessions || [];
        setWeekSessionsCount(wSessions.length);
        setWeekSessionsDone(wSessions.filter(s => s.ended_at).length);
        setWeekSessionsUpcoming(wSessions.filter(s => !s.ended_at && new Date(s.started_at) > new Date()).length);

        // Recent sessions — need events for those sessions
        if (sessionsData && sessionsData.length > 0) {
          const sessionIds = sessionsData.map(s => s.id);
          const { data: eventsData } = await supabase
            .from('events').select('session_id, type').in('session_id', sessionIds);

          const sessions: RecentSession[] = sessionsData.map(s => {
            const evts = (eventsData || []).filter(e => e.session_id === s.id);
            return {
              id: s.id,
              class_id: s.class_id,
              class_name: (s.classes as any)?.name || 'Classe inconnue',
              started_at: s.started_at,
              ended_at: s.ended_at,
              topic: s.topic || null,
              events_count: evts.length,
              pos_count: evts.filter(e => e.type === 'participation').length,
              neg_count: evts.filter(e => e.type === 'bavardage').length,
              abs_count: evts.filter(e => e.type === 'absence').length,
            };
          });
          setRecentSessions(sessions);
        }

        // Grade calculations
        if (studentsData && studentsData.length > 0) {
          const classIds = cls.map(c => c.id);

          // Parallel batch 2: config + events (via sessions join) + manual participations (via user_id)
          const [
            { data: configsData },
            { data: allEventsData },
            { data: manualPartData },
          ] = await Promise.all([
            supabase.from('class_trimester_config').select('*').in('class_id', classIds),
            supabase.from('events').select('student_id, type, session_id, sessions!inner(user_id)').eq('sessions.user_id', user.id),
            supabase.from('manual_participations').select('student_id, count').eq('user_id', user.id),
          ]);

          const configMap = new Map<string, any>();
          (configsData || []).forEach(c => configMap.set(c.class_id, c));

          // Calculate grades per student
          const eventsByStudent = new Map<string, any[]>();
          (allEventsData || []).forEach(e => {
            const arr = eventsByStudent.get(e.student_id) || [];
            arr.push(e);
            eventsByStudent.set(e.student_id, arr);
          });

          const manualByStudent = new Map<string, number>();
          (manualPartData || []).forEach(mp => {
            manualByStudent.set(mp.student_id, (manualByStudent.get(mp.student_id) || 0) + mp.count);
          });

          // Count sessions per student (unique session_ids in events)
          const sessionsByStudent = new Map<string, Set<string>>();
          (allEventsData || []).forEach(e => {
            const set = sessionsByStudent.get(e.student_id) || new Set();
            set.add(e.session_id);
            sessionsByStudent.set(e.student_id, set);
          });

          const studentGrades: { id: string; pseudo: string; class_id: string; class_name: string; grade: number; malus: number; absences: number; sessionsCount: number; participations: number; }[] = [];

          studentsData.forEach(student => {
            const evts = eventsByStudent.get(student.id) || [];
            const participations = evts.filter((e: any) => e.type === 'participation').length;
            const malusCount = evts.filter((e: any) => e.type === 'bavardage').length;
            const absences = evts.filter((e: any) => e.type === 'absence').length;
            const manualPart = manualByStudent.get(student.id) || 0;
            const totalPart = participations + manualPart;
            const sessCount = sessionsByStudent.get(student.id)?.size || 0;

            const config = configMap.get(student.class_id);
            const targetPart = config?.target_participations || 15;
            const totalSessionsExpected = config?.total_sessions_expected || 60;
            const malusPenalty = config?.bavardage_penalty ?? false;
            const baseGrade = config?.base_grade ?? null;

            const effectivePart = malusPenalty ? Math.max(0, totalPart - malusCount) : totalPart;
            const reductionPerAbsence = targetPart / totalSessionsExpected;
            const adjustedTarget = Math.max(1, targetPart - (absences * reductionPerAbsence));

            let grade: number;
            if (baseGrade !== null && baseGrade > 0) {
              const modifier = malusPenalty ? totalPart - malusCount : totalPart;
              grade = Math.min(20, Math.max(0, baseGrade + modifier));
            } else {
              grade = Math.min(20, Math.max(0, (effectivePart / adjustedTarget) * 20));
            }

            studentGrades.push({
              id: student.id,
              pseudo: student.pseudo,
              class_id: student.class_id,
              class_name: (student.classes as any)?.name || 'Classe inconnue',
              grade,
              malus: malusCount,
              absences,
              sessionsCount: sessCount,
              participations: totalPart,
            });
          });

          // Compute class averages
          const gradesByClass = new Map<string, number[]>();
          studentGrades.forEach(sg => {
            const arr = gradesByClass.get(sg.class_id) || [];
            arr.push(sg.grade);
            gradesByClass.set(sg.class_id, arr);
          });

          const avgList: ClassAverage[] = cls.map(c => {
            const grades = gradesByClass.get(c.id) || [];
            const avg = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
            return { class_id: c.id, class_name: c.name, average: avg };
          }).filter(a => a.average > 0);
          setClassAverages(avgList);

          // Global average
          const allGrades = studentGrades.map(sg => sg.grade);
          const globalAvg = allGrades.length > 0 ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length : 0;
          setAvgImplication(globalAvg);

          // Students to watch: low grade, many malus, recent absences
          const alerts: StudentAlert[] = studentGrades
            .filter(sg => sg.grade < 8 || sg.malus >= 4 || sg.absences >= 2)
            .map(sg => {
              let reason = '';
              if (sg.grade < 5) reason = `${sg.malus} malus sur ${sg.sessionsCount} séances`;
              else if (sg.absences >= 2) reason = `${sg.absences} absences consécutives`;
              else if (sg.malus >= 4) reason = `${sg.malus} malus, ${sg.participations === 0 ? '0 participation' : sg.participations + ' participations'}`;
              else reason = `En recul depuis ${sg.sessionsCount} séances`;

              return {
                id: sg.id,
                pseudo: sg.pseudo,
                class_id: sg.class_id,
                class_name: sg.class_name,
                grade: sg.grade,
                trend: -(sg.malus * 0.5 + sg.absences * 0.3), // Approximate trend
                malus: sg.malus,
                absences: sg.absences,
                sessionsCount: sg.sessionsCount,
                reason,
              };
            })
            .sort((a, b) => a.grade - b.grade)
            .slice(0, 5);

          setStudentAlerts(alerts);
          setAlertCount(alerts.length);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const value: HomeData = {
    isLoading,
    classes,
    classNames,
    recentSessions,
    studentAlerts,
    classAverages,
    avgImplication,
    alertCount,
    weekSessionsCount,
    weekSessionsDone,
    weekSessionsUpcoming,
    pronoteConnected,
    pronoteLessons,
    nextLesson,
    todayLessons,
    tomorrowLessons,
    weekDays,
    viewedMonday,
    isCurrentWeek,
    weekOffset,
    ttLoading,
    ttView,
    setTtView,
    loadWeek,
    now,
    tomorrow,
    openBoard: onOpenBoard,
  };

  return <HomeDataContext.Provider value={value}>{children}</HomeDataContext.Provider>;
}
