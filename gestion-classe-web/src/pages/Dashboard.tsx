import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { ClassChip } from '../components/design-system';
import { LiveSessionLauncher } from '../components/live-session/LiveSessionLauncher';
import { GroupSessionLauncher } from '../components/live-session/GroupSessionLauncher';
import { pronoteFetcher } from '../lib/pronoteFetcher';
import type { TimetableClassLesson, Timetable, RefreshInformation } from 'pawnote';

// ---- Shared helpers ----

const COLOR_PALETTE = ['#6366F1','#EC4899','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EF4444','#14B8A6','#F97316','#06B6D4','#84CC16','#E879F9','#FB923C'];

function getClassLabel(name: string): string {
  return name.replace(/ème groupe /i, 'G').replace(/ème /i, '').substring(0, 3);
}

function getClassColor(className: string, allClassNames: string[]): string {
  const idx = allClassNames.indexOf(className);
  return COLOR_PALETTE[(idx >= 0 ? idx : 0) % COLOR_PALETTE.length];
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

interface PronoteLesson {
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

// ---- Time helpers ----

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'matin';
  if (h < 14) return 'midi';
  if (h < 18) return 'après-midi';
  return 'fin de journée';
}

function formatDayFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ---- Types ----

interface DashClass { id: string; name: string; }

interface RecentSession {
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

interface StudentAlert {
  id: string;
  pseudo: string;
  class_id: string;
  class_name: string;
  grade: number;
  trend: number; // delta from previous trimester or recent trend
  malus: number;
  absences: number;
  sessionsCount: number;
  reason: string;
}

interface ClassAverage {
  class_id: string;
  class_name: string;
  average: number;
}

// ============================================================
// Dashboard Component
// ============================================================

export function Dashboard() {
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
  // Pronote state
  const [pronoteConnected, setPronoteConnected] = useState(false);
  const [pronoteLessons, setPronoteLessons] = useState<PronoteLesson[]>([]);
  const pronoteAttempted = useRef(false);

  const classNames = classes.map(c => c.name);

  // ---- Load Pronote data ----

  useEffect(() => {
    if (pronoteAttempted.current) return;
    pronoteAttempted.current = true;

    const stored = loadStoredPronoteSession();
    if (!stored) return;

    (async () => {
      try {
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

        // Load current week timetable
        const startDay = sess.instance?.firstMonday || sess.instance?.firstDate;
        if (startDay) {
          const weekStart = getMonday(new Date());
          const weekNum = pw.translateToWeekNumber(weekStart, new Date(startDay));
          const timetable = await pw.timetableFromWeek(sess, weekNum);
          const parsed = parseLessons(timetable);
          setPronoteLessons(parsed);
        }

        setPronoteConnected(true);
      } catch (err) {
        console.error('Dashboard Pronote auto-reconnect failed:', err);
        // Silent fail — Pronote sections just won't show
      }
    })();
  }, []);

  // ---- Compute Pronote-derived data ----

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Next lesson (from now onwards)
  const nextLesson = pronoteLessons
    .filter(l => !l.canceled && l.startDate > now)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0] || null;

  // Tomorrow's lessons
  const tomorrowLessons = pronoteLessons
    .filter(l => !l.canceled && isSameDay(l.startDate, tomorrow))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Count tomorrow's unique rooms
  const tomorrowRooms = new Set(tomorrowLessons.flatMap(l => l.classrooms));

  // ---- Load Supabase data ----

  useEffect(() => {
    if (!user) return;

    (async () => {
      setIsLoading(true);

      try {
        // 1. Load classes
        const { data: classesData } = await supabase
          .from('classes').select('id, name').eq('user_id', user.id).order('name');
        const cls = (classesData || []) as DashClass[];
        setClasses(cls);

        // 2. Load recent sessions (10 derniers jours)
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        const { data: sessionsData } = await supabase
          .from('sessions')
          .select('id, class_id, started_at, ended_at, topic, classes (name)')
          .eq('user_id', user.id)
          .gte('started_at', tenDaysAgo.toISOString())
          .order('started_at', { ascending: false })
          .limit(5);

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

        // 3. Week sessions count
        const monday = getMonday(new Date());
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        const { data: weekSessions } = await supabase
          .from('sessions')
          .select('id, started_at, ended_at')
          .eq('user_id', user.id)
          .gte('started_at', monday.toISOString())
          .lte('started_at', sunday.toISOString());

        const wSessions = weekSessions || [];
        setWeekSessionsCount(wSessions.length);
        setWeekSessionsDone(wSessions.filter(s => s.ended_at).length);
        setWeekSessionsUpcoming(wSessions.filter(s => !s.ended_at && new Date(s.started_at) > now).length);

        // 4. Load all students + events for grade calculations
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, pseudo, class_id, classes (name)')
          .eq('user_id', user.id);

        if (studentsData && studentsData.length > 0) {
          // Load class configs
          const classIds = cls.map(c => c.id);
          const { data: configsData } = await supabase
            .from('class_trimester_config').select('*').in('class_id', classIds);
          const configMap = new Map<string, any>();
          (configsData || []).forEach(c => configMap.set(c.class_id, c));

          // Load events for all students
          const studentIds = studentsData.map(s => s.id);
          const { data: allEventsData } = await supabase
            .from('events')
            .select('student_id, type, session_id')
            .in('student_id', studentIds);

          // Load manual participations
          const { data: manualPartData } = await supabase
            .from('manual_participations')
            .select('student_id, count')
            .in('student_id', studentIds);

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

  // ---- Rendering ----

  if (isLoading) {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 256 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--indigo)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement...</span>
          </div>
        </div>
      </Layout>
    );
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // KPI stability indicator
  const weekStability = weekSessionsCount === 0 ? 'stable'
    : weekSessionsDone > 0 ? 'stable' : 'stable';

  return (
    <Layout>
      <div className="dash">
        {/* ---- Hero row ---- */}
        <div className="dash__hero-row">
          {/* Left: greeting */}
          <div className="dash__hero">
            <div className="dash__date-badge">
              {formatDayFr(now)} · {getTimeOfDay()}
            </div>
            <h1 className="dash__greeting">
              {getGreeting()}, Thomas.
            </h1>
            {pronoteConnected && nextLesson ? (
              <p className="dash__subtitle">
                {isSameDay(nextLesson.startDate, tomorrow) ? 'Demain' : 'Prochaine séance'},{' '}
                {tomorrowLessons.length > 0 ? (
                  <>{tomorrowLessons.length} séances. Commence par <strong>{nextLesson.groupNames[0] || nextLesson.subject || 'Cours'}</strong>, {formatTime(nextLesson.startDate)}.</>
                ) : (
                  <>commence par <strong>{nextLesson.groupNames[0] || nextLesson.subject || 'Cours'}</strong>, {formatTime(nextLesson.startDate)}.</>
                )}
              </p>
            ) : (
              <p className="dash__subtitle">
                Voici un aperçu de votre activité.
              </p>
            )}
          </div>

          {/* Right: prochaine séance (Pronote only) */}
          {pronoteConnected && nextLesson && (
            <div className="dash__next-card">
              <div className="dash__next-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--indigo)' }}>
                  PROCHAINE SÉANCE
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {nextLesson.startDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ClassChip
                    label={getClassLabel(nextLesson.groupNames[0] || 'C')}
                    color={getClassColor(nextLesson.groupNames[0] || '', classNames)}
                    size={36}
                  />
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{nextLesson.groupNames[0] || nextLesson.subject || 'Cours'}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em' }}>
                  {formatTime(nextLesson.startDate)}
                </span>
              </div>

              {nextLesson.subject && (
                <div style={{ background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text)', marginBottom: 12, fontFamily: 'var(--font-display)', fontStyle: 'italic' }}>
                  {nextLesson.subject}
                </div>
              )}

              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                {nextLesson.classrooms.length > 0 && (
                  <span>Salle {nextLesson.classrooms[0]}</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Link to="/sessions" className="dash__next-btn dash__next-btn--primary">
                  Ouvrir la séance
                </Link>
                <Link to="/classes" className="dash__next-btn">Plan de classe</Link>
              </div>
            </div>
          )}
        </div>

        {/* ---- Launchers ---- */}
        <LiveSessionLauncher />
        <GroupSessionLauncher />

        {/* ---- KPI row ---- */}
        <div className="dash__kpis">
          <div className="dash__kpi">
            <div className="dash__kpi-label">Moyenne d'implication</div>
            <div className="dash__kpi-value">
              {avgImplication.toFixed(1)}<span className="dash__kpi-unit">/20</span>
            </div>
            <div className="dash__kpi-hint">
              <span style={{ color: avgImplication >= 10 ? 'var(--pos)' : 'var(--neg)', fontSize: 11, fontWeight: 600 }}>
                T3 en cours
              </span>
            </div>
          </div>

          <div className="dash__kpi" style={{ borderLeft: '3px solid var(--warn)' }}>
            <div className="dash__kpi-label">Élèves à suivre</div>
            <div className="dash__kpi-value" style={{ color: alertCount > 0 ? 'var(--warn)' : 'var(--pos)' }}>
              {alertCount}
            </div>
            {alertCount > 0 && (
              <div className="dash__kpi-hint">
                <span style={{ color: 'var(--pos)', fontSize: 11, fontWeight: 600 }}>
                  Décrochage ou absences répétées
                </span>
              </div>
            )}
          </div>

          <div className="dash__kpi">
            <div className="dash__kpi-label">Séances de la semaine</div>
            <div className="dash__kpi-value">{weekSessionsCount}</div>
            <div className="dash__kpi-hint">
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                → {weekStability} · {weekSessionsDone} faites · {weekSessionsUpcoming} à venir
              </span>
            </div>
          </div>
        </div>

        {/* ---- Two-column body ---- */}
        <div className="dash__body">
          {/* LEFT column */}
          <div className="dash__left">
            {/* À regarder avant demain */}
            {studentAlerts.length > 0 && (
              <div className="dash__card">
                <div className="dash__card-head">
                  <div>
                    <h2 className="dash__card-title">À regarder avant demain</h2>
                    <p className="dash__card-sub">Élèves qui décrochent ou multiplient les absences</p>
                  </div>
                  <Link to="/students" className="dash__card-link">Voir tous →</Link>
                </div>

                <div className="dash__alerts">
                  {studentAlerts.map((alert) => (
                    <div key={alert.id} className="dash__alert-row">
                      <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: alert.grade < 5 ? 'var(--neg)' : alert.grade < 8 ? 'var(--warn)' : 'var(--text-dim)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{alert.pseudo}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {getClassLabel(alert.class_name)} · {alert.reason}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.02em' }}>
                          {alert.grade.toFixed(1)}<span style={{ fontSize: 11, color: 'var(--text-dim)' }}>/20</span>
                        </div>
                        {alert.trend !== 0 && (
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--neg)' }}>
                            ↘ {alert.trend.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <span style={{ color: 'var(--text-dim)', fontSize: 14, flexShrink: 0 }}>›</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Séances récentes */}
            <div className="dash__card">
              <div className="dash__card-head">
                <div>
                  <h2 className="dash__card-title">Séances récentes</h2>
                  <p className="dash__card-sub">10 derniers jours · {recentSessions.length} séances</p>
                </div>
                <Link to="/sessions" className="dash__card-link">Tout l'historique →</Link>
              </div>

              {recentSessions.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: 13 }}>Aucune séance récente</p>
                </div>
              ) : (
                <div className="dash__sessions">
                  {recentSessions.map((session) => {
                    const color = getClassColor(session.class_name, classNames);
                    return (
                      <div key={session.id} className="dash__session-row">
                        <ClassChip label={getClassLabel(session.class_name)} color={color} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {session.class_name}
                            <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 12 }}>·</span>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                              {formatDate(session.started_at)}
                            </span>
                          </div>
                          {session.topic && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {session.topic}
                            </div>
                          )}
                        </div>
                        {/* Mini event badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {session.pos_count > 0 && (
                            <span className="dash__evt-badge dash__evt-badge--pos">{session.pos_count}</span>
                          )}
                          {session.neg_count > 0 && (
                            <span className="dash__evt-badge dash__evt-badge--neg">{session.neg_count}</span>
                          )}
                          {session.abs_count > 0 && (
                            <span className="dash__evt-badge dash__evt-badge--abs">{session.abs_count} abs</span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 32 }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>{session.events_count}</div>
                          <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>ÉVÉNEMENTS</div>
                        </div>
                        <span style={{ color: 'var(--text-dim)', fontSize: 14, flexShrink: 0 }}>›</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT column */}
          <div className="dash__right">
            {/* Demain (Pronote only) */}
            {pronoteConnected && tomorrowLessons.length > 0 && (
              <div className="dash__card">
                <div className="dash__card-head">
                  <div>
                    <h2 className="dash__card-title">Demain · {tomorrow.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                    <p className="dash__card-sub">{tomorrowLessons.length} séances · {tomorrowRooms.size} salles</p>
                  </div>
                </div>
                <div className="dash__tomorrow">
                  {tomorrowLessons.map((lesson, i) => {
                    const isFirst = i === 0;
                    const color = getClassColor(lesson.groupNames[0] || '', classNames);
                    return (
                      <div key={lesson.id} className={`dash__tomorrow-row ${isFirst ? 'dash__tomorrow-row--next' : ''}`}>
                        <div className="dash__tomorrow-time">
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>
                            {formatTime(lesson.startDate)}
                          </span>
                          {isFirst && (
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--indigo)', letterSpacing: '0.05em' }}>
                              PROCHAINE
                            </span>
                          )}
                        </div>
                        <ClassChip label={getClassLabel(lesson.groupNames[0] || 'C')} color={color} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{lesson.groupNames[0] || lesson.subject || 'Cours'}</div>
                          {lesson.subject && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lesson.subject}
                            </div>
                          )}
                          {lesson.classrooms.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              Salle {lesson.classrooms[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Raccourcis */}
            <div className="dash__card">
              <div className="dash__card-head">
                <h2 className="dash__card-title">Raccourcis</h2>
              </div>
              <div className="dash__shortcuts">
                <Link to="/group-sessions" className="dash__shortcut">
                  <span className="dash__shortcut-icon">👥</span>
                  <div>
                    <div className="dash__shortcut-title">Groupes</div>
                    <div className="dash__shortcut-sub">Sessions de groupe</div>
                  </div>
                </Link>
                <Link to="/tools" className="dash__shortcut">
                  <span className="dash__shortcut-icon">🧰</span>
                  <div>
                    <div className="dash__shortcut-title">Outils</div>
                    <div className="dash__shortcut-sub">Boîte à outils</div>
                  </div>
                </Link>
                <Link to="/students" className="dash__shortcut">
                  <span className="dash__shortcut-icon">👥</span>
                  <div>
                    <div className="dash__shortcut-title">Suivi élèves</div>
                    <div className="dash__shortcut-sub">Notes d'implication</div>
                  </div>
                </Link>
                <Link to="/classes" className="dash__shortcut">
                  <span className="dash__shortcut-icon">🗺</span>
                  <div>
                    <div className="dash__shortcut-title">Plans de classe</div>
                    <div className="dash__shortcut-sub">{classes.length} classes</div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Moyenne par classe */}
            {classAverages.length > 0 && (
              <div className="dash__card">
                <div className="dash__card-head">
                  <div>
                    <h2 className="dash__card-title">Moyenne par classe</h2>
                    <p className="dash__card-sub">T3 en cours</p>
                  </div>
                </div>
                <div className="dash__class-avgs">
                  {classAverages.sort((a, b) => b.average - a.average).map((ca) => {
                    const color = getClassColor(ca.class_name, classNames);
                    const pct = (ca.average / 20) * 100;
                    return (
                      <div key={ca.class_id} className="dash__class-avg-row">
                        <ClassChip label={getClassLabel(ca.class_name)} color={color} size={24} />
                        <span className="dash__class-avg-name">{ca.class_name}</span>
                        <div className="dash__class-avg-bar">
                          <div className="dash__class-avg-fill" style={{ width: `${pct}%`, background: pct < 40 ? 'var(--neg)' : color }} />
                        </div>
                        <span className="dash__class-avg-val">{ca.average.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
