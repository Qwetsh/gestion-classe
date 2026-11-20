/**
 * Classeur virtuel (lot 1) : géométrie d'une feuille du classeur et lecture des fiches collées.
 */
import type { Board } from '../../lib/boardsQueries';
import { fetchCourseDoc, type CourseDoc } from '../../lib/course/courseDoc';

/** Une page A4 imprimée en A5. */
export const A5_SCALE = 148 / 210;

/** Trous normalisés d'une feuille perforée 4 trous (ISO 838), centres en mm depuis le haut. */
export const HOLES_MM = [28.5, 108.5, 188.5, 268.5];

/** Documents déjà lus, par cours et date de modification (un cours retouché est relu). */
const cache = new Map<string, Promise<CourseDoc | null>>();

/** Document d'une fiche collée (null : tableau blanc, pas de feuille à imprimer). */
export function loadSheetDoc(board: Board): Promise<CourseDoc | null> {
  const key = `${board.id}|${board.updated_at}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = board.is_course === false ? Promise.resolve(null) : fetchCourseDoc(board.id);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}
