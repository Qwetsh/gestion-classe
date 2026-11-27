/**
 * Droits d'un élève sur les thèmes de son espace (migration 099).
 *
 * Trois familles (`unlock` dans lib/studentThemes.ts, et `_student_theme_kind` en base) :
 *  - libres : pour tous, dès le départ ;
 *  - de cours : ouverts par le professeur à toute la classe, quand la séquence commence ;
 *  - à gagner : un thème au choix par carte à tampons remplie.
 * C'est le serveur qui dit ce qui est ouvert, gagné et choisi ; il refuse un thème fermé. Le thème
 * choisi y est gardé : il suit l'élève d'un appareil à l'autre (l'appareil en garde une copie pour
 * l'écran de saisie du code).
 */
import { fromJson } from './dbJson';
import { supabase } from './supabase';
import { STUDENT_THEMES, isStudentTheme, type StudentThemeId } from './studentThemes';

export interface StudentThemeRights {
  /** Thèmes libres. */
  free: StudentThemeId[];
  /** Thèmes ouverts à la classe par le professeur. */
  opened: StudentThemeId[];
  /** Thèmes gagnés par l'élève. */
  earned: StudentThemeId[];
  /** Nombre de thèmes « à gagner » que l'élève peut encore choisir. */
  credits: number;
  /** Thème choisi, gardé par le serveur ; null si aucun (ou s'il s'est refermé). */
  chosen: StudentThemeId | null;
}

/** Sans réponse du serveur (hors ligne, base pas à jour) : seulement les thèmes libres. */
export const FREE_THEME_RIGHTS: StudentThemeRights = {
  free: STUDENT_THEMES.filter((t) => t.unlock === 'free').map((t) => t.id),
  opened: [],
  earned: [],
  credits: 0,
  chosen: null,
};

const themeList = (value: unknown): StudentThemeId[] => (Array.isArray(value) ? value.filter(isStudentTheme) : []);

/** Réponse d'une fonction de thème, relue prudemment ; null si ce n'est pas un état (code inconnu, erreur). */
export function parseThemeRights(raw: unknown): StudentThemeRights | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.free)) return null;
  const credits = Number(r.credits);
  return {
    free: themeList(r.free),
    opened: themeList(r.opened),
    earned: themeList(r.earned),
    credits: Number.isFinite(credits) && credits > 0 ? Math.floor(credits) : 0,
    chosen: isStudentTheme(r.chosen) ? r.chosen : null,
  };
}

/** Raison d'un refus du serveur (« locked », « no_credit »…), s'il y en a une. */
export function themeRightsError(raw: unknown): string | null {
  const error = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).error : null;
  return typeof error === 'string' ? error : null;
}

export const isThemeUnlocked = (rights: StudentThemeRights, id: StudentThemeId): boolean =>
  rights.free.includes(id) || rights.opened.includes(id) || rights.earned.includes(id);

/** Vrai si l'élève peut débloquer ce thème maintenant : un thème « à gagner », encore fermé, et il lui en reste un à choisir. */
export const canEarnTheme = (rights: StudentThemeRights, id: StudentThemeId): boolean =>
  rights.credits > 0 && !isThemeUnlocked(rights, id) && STUDENT_THEMES.some((t) => t.id === id && t.unlock === 'card');

/**
 * Thème à afficher à la connexion : celui gardé par le serveur ; sinon celui de l'appareil s'il est
 * ouvert à cet élève ; sinon le thème de départ.
 */
export function themeToApply(rights: StudentThemeRights, local: StudentThemeId, fallback: StudentThemeId): StudentThemeId {
  if (rights.chosen && isThemeUnlocked(rights, rights.chosen)) return rights.chosen;
  return isThemeUnlocked(rights, local) ? local : fallback;
}

/** Les droits de l'élève ; null si le serveur ne répond pas ou ne connaît pas le code. */
export async function fetchStudentThemeRights(code: string): Promise<StudentThemeRights | null> {
  const { data, error } = await supabase.rpc('get_student_themes', { p_code: code });
  if (error) return null;
  return parseThemeRights(fromJson<unknown>(data));
}

export interface ThemeChange {
  /** Les droits après l'appel, quand le serveur les a rendus. */
  rights: StudentThemeRights | null;
  /** Refus du serveur ou panne ; null si le changement est fait. */
  error: string | null;
}

/** Garde le thème choisi sur le serveur (le serveur refuse un thème fermé). */
export async function chooseStudentTheme(code: string, theme: StudentThemeId): Promise<ThemeChange> {
  const { data, error } = await supabase.rpc('set_student_theme', { p_code: code, p_theme: theme });
  if (error) return { rights: null, error: 'network' };
  const raw = fromJson<unknown>(data);
  return { rights: parseThemeRights(raw), error: themeRightsError(raw) };
}

/** Débloque un thème « à gagner » avec un thème restant à choisir, et le prend. */
export async function unlockStudentTheme(code: string, theme: StudentThemeId): Promise<ThemeChange> {
  const { data, error } = await supabase.rpc('unlock_student_theme', { p_code: code, p_theme: theme });
  if (error) return { rights: null, error: 'network' };
  const raw = fromJson<unknown>(data);
  return { rights: parseThemeRights(raw), error: themeRightsError(raw) };
}

/* ---------- côté professeur : les thèmes ouverts à une classe ---------- */

/** Thèmes ouverts à la classe. */
export async function fetchClassThemes(classId: string): Promise<StudentThemeId[]> {
  const { data, error } = await supabase.from('class_student_themes').select('theme_id').eq('class_id', classId);
  if (error) throw error;
  return (data ?? []).map((row) => row.theme_id).filter(isStudentTheme);
}

/** Ouvre ou referme un thème pour toute une classe. */
export async function setClassTheme(classId: string, userId: string, theme: StudentThemeId, open: boolean): Promise<void> {
  const { error } = open
    ? await supabase.from('class_student_themes').upsert({ class_id: classId, theme_id: theme, user_id: userId }, { onConflict: 'class_id,theme_id' })
    : await supabase.from('class_student_themes').delete().eq('class_id', classId).eq('theme_id', theme);
  if (error) throw error;
}
