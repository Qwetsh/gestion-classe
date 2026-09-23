/**
 * Registre des modules de l'accueil.
 * Ajouter un module = ajouter une entrée ici (+ une entrée dans DEFAULT_HOME_LAYOUT
 * si on veut lui donner une place par défaut) — rien d'autre à toucher.
 */

import type { ComponentType } from 'react';
import type { HomeData } from './HomeDataContext';
import { KpiImplicationModule, KpiAlertsModule, KpiSessionsModule } from './modules/KpiModules';
import { QuickActionsModule } from './modules/QuickActionsModule';
import { StudentAlertsModule } from './modules/StudentAlertsModule';
import { RecentSessionsModule } from './modules/RecentSessionsModule';
import { NextLessonModule } from './modules/NextLessonModule';
import { ClassAveragesModule } from './modules/ClassAveragesModule';
import { BoardsModule } from './modules/BoardsModule';
import { TimetableModule } from './modules/TimetableModule';

export interface HomeModuleDef {
  /** identifiant stable, utilisé dans la disposition enregistrée — ne jamais le renommer */
  id: string;
  title: string;
  /** phrase affichée dans la bibliothèque « Ajouter un module » */
  description: string;
  icon: string;
  minW: number;
  minH: number;
  Component: ComponentType;
  /** un module sans donnée pertinente n'est pas rendu et ne réserve pas de place */
  isAvailable?: (data: HomeData) => boolean;
}

export const HOME_MODULES: HomeModuleDef[] = [
  {
    id: 'quick-actions',
    title: 'Raccourcis',
    description: 'Accès direct aux groupes, au tableau blanc, aux outils, au suivi et aux plans de classe.',
    icon: 'grid',
    minW: 4, minH: 4,
    Component: QuickActionsModule,
  },
  {
    id: 'kpi-implication',
    title: "Moyenne d'implication",
    description: "Moyenne générale d'implication sur le trimestre en cours.",
    icon: 'chart',
    minW: 3, minH: 6,
    Component: KpiImplicationModule,
  },
  {
    id: 'kpi-alerts',
    title: 'Élèves à suivre',
    description: "Nombre d'élèves en décrochage ou aux absences répétées.",
    icon: 'alert',
    minW: 3, minH: 6,
    Component: KpiAlertsModule,
  },
  {
    id: 'kpi-sessions',
    title: 'Séances de la semaine',
    description: 'Séances faites et à venir sur la semaine en cours.',
    icon: 'calendar',
    minW: 3, minH: 6,
    Component: KpiSessionsModule,
  },
  {
    id: 'student-alerts',
    title: 'À regarder avant demain',
    description: 'Les cinq élèves qui décrochent ou multiplient les absences.',
    icon: 'students',
    minW: 4, minH: 9,
    Component: StudentAlertsModule,
    isAvailable: d => d.studentAlerts.length > 0,
  },
  {
    id: 'recent-sessions',
    title: 'Séances récentes',
    description: 'Les dernières séances avec leurs bonus, malus et absences.',
    icon: 'calendar',
    minW: 5, minH: 9,
    Component: RecentSessionsModule,
  },
  {
    id: 'next-lesson',
    title: 'Prochaine séance',
    description: 'Le prochain cours de l\'emploi du temps Pronote, avec accès direct à la séance.',
    icon: 'calendar',
    minW: 3, minH: 8,
    Component: NextLessonModule,
    isAvailable: d => d.pronoteConnected && !!d.nextLesson,
  },
  {
    id: 'class-averages',
    title: 'Moyenne par classe',
    description: 'Comparaison des moyennes d\'implication, classe par classe.',
    icon: 'chart',
    minW: 3, minH: 8,
    Component: ClassAveragesModule,
    isAvailable: d => d.classAverages.length > 0,
  },
  {
    id: 'boards',
    title: 'Mes tableaux',
    description: 'Les cours préparés à l\'avance, rangés par niveau et chapitre.',
    icon: 'pen',
    minW: 3, minH: 9,
    Component: BoardsModule,
  },
  {
    id: 'timetable',
    title: 'Emploi du temps',
    description: 'La semaine Pronote en liste ou en calendrier.',
    icon: 'calendar',
    minW: 4, minH: 6,
    Component: TimetableModule,
  },
];

export const HOME_MODULE_IDS = HOME_MODULES.map(m => m.id);

export function getHomeModule(id: string): HomeModuleDef | undefined {
  return HOME_MODULES.find(m => m.id === id);
}
