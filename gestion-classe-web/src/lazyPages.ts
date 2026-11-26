/**
 * Les pages de l'app, chargées à la demande (voir `lib/lazyPage.ts`).
 *
 * `Login` reste dans le morceau de départ : c'est la première page vue, et elle est petite.
 * Les pages enseignant sont préchargées en tâche de fond une fois l'enseignant connecté
 * (`preloadTeacherPages`), pour qu'ouvrir « En classe » ou une autre page ne fasse pas attendre
 * sur un réseau de collège. Les pages élèves ne déclenchent pas ce préchargement.
 */
import { lazyPage, preloadWhenIdle } from './lib/lazyPage';

const load = {
  dashboard: () => import('./pages/Dashboard'),
  analytics: () => import('./pages/Analytics'),
  classes: () => import('./pages/Classes'),
  sessions: () => import('./pages/Sessions'),
  sessionDetail: () => import('./pages/SessionDetail'),
  journal: () => import('./pages/Journal'),
  groupSessions: () => import('./pages/GroupSessions'),
  tpTemplates: () => import('./pages/TpTemplates'),
  devPanel: () => import('./pages/DevPanel'),
  toolbox: () => import('./pages/Toolbox'),
  students: () => import('./pages/Students'),
  rewards: () => import('./pages/Rewards'),
  studentDashboard: () => import('./pages/StudentDashboard'),
  studentBinder: () => import('./pages/StudentBinder'),
  mobileDocument: () => import('./pages/MobileDocument'),
  classroom: () => import('./pages/Classroom'),
  pronote: () => import('./pages/Pronote'),
  academy: () => import('./pages/Academy'),
  brevets: () => import('./pages/Brevets'),
  clouds: () => import('./pages/Clouds'),
  courses: () => import('./pages/Courses'),
  binder: () => import('./pages/Binder'),
  evaluations: () => import('./pages/Evaluations'),
  assessmentSheet: () => import('./pages/AssessmentSheet'),
  productions: () => import('./pages/Productions'),
  liveActivity: () => import('./pages/LiveActivity'),
  copyDepot: () => import('./pages/CopyDepot'),
};

// Pages élèves et pages publiques
export const StudentDashboard = lazyPage(load.studentDashboard, 'StudentDashboard');
export const StudentBinder = lazyPage(load.studentBinder, 'StudentBinder');
export const MobileDocument = lazyPage(load.mobileDocument, 'MobileDocument');
export const CopyDepot = lazyPage(load.copyDepot, 'CopyDepot');

// Pages enseignant
export const Dashboard = lazyPage(load.dashboard, 'Dashboard');
export const Analytics = lazyPage(load.analytics, 'Analytics');
export const Classes = lazyPage(load.classes, 'Classes');
export const Sessions = lazyPage(load.sessions, 'Sessions');
export const SessionDetail = lazyPage(load.sessionDetail, 'SessionDetail');
export const Journal = lazyPage(load.journal, 'Journal');
export const GroupSessions = lazyPage(load.groupSessions, 'GroupSessions');
export const TpTemplates = lazyPage(load.tpTemplates, 'TpTemplates');
export const DevPanel = lazyPage(load.devPanel, 'DevPanel');
export const ToolGrid = lazyPage(load.toolbox, 'ToolGrid');
export const ToolView = lazyPage(load.toolbox, 'ToolView');
export const Students = lazyPage(load.students, 'Students');
export const Rewards = lazyPage(load.rewards, 'Rewards');
export const Classroom = lazyPage(load.classroom, 'Classroom');
export const Pronote = lazyPage(load.pronote, 'Pronote');
export const Academy = lazyPage(load.academy, 'Academy');
export const Brevets = lazyPage(load.brevets, 'Brevets');
export const Clouds = lazyPage(load.clouds, 'Clouds');
export const Courses = lazyPage(load.courses, 'Courses');
export const Binder = lazyPage(load.binder, 'Binder');
export const Evaluations = lazyPage(load.evaluations, 'Evaluations');
export const AssessmentSheet = lazyPage(load.assessmentSheet, 'AssessmentSheet');
export const Productions = lazyPage(load.productions, 'Productions');
export const LiveActivity = lazyPage(load.liveActivity, 'LiveActivity');

let teacherPagesPreloaded = false;

/**
 * Précharge les pages enseignant en tâche de fond, une fois par onglet. Les plus utilisées en
 * séance passent en premier. Le panneau de développement n'est pas préchargé.
 */
export function preloadTeacherPages(): void {
  if (teacherPagesPreloaded) return;
  teacherPagesPreloaded = true;
  preloadWhenIdle([
    load.dashboard,
    load.classroom,
    load.courses,
    load.classes,
    load.students,
    load.sessions,
    load.sessionDetail,
    load.evaluations,
    load.assessmentSheet,
    load.productions,
    load.liveActivity,
    load.journal,
    load.binder,
    load.groupSessions,
    load.tpTemplates,
    load.brevets,
    load.rewards,
    load.academy,
    load.analytics,
    load.toolbox,
    load.clouds,
    load.pronote,
  ]);
}
