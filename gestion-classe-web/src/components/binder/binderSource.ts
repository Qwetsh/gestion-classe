/**
 * Classeur virtuel : d'où viennent les fiches collées. Le professeur les lit dans sa bibliothèque
 * (table `boards`, à travers son compte) ; un élève n'a pas de compte et les reçoit du serveur, qui
 * ne rend que ce que sa classe a le droit de voir (lib/studentBinder.ts).
 */
import { createContext } from 'react';
import type { Board } from '../../lib/boardsQueries';
import type { CourseDoc } from '../../lib/course/courseDoc';
import { loadSheetDoc } from './binderSheet';

export interface BinderSource {
  /** Document d'une fiche (null : pas de feuille à imprimer). */
  loadDoc: (board: Board) => Promise<CourseDoc | null>;
}

export const BinderSourceContext = createContext<BinderSource>({ loadDoc: loadSheetDoc });
