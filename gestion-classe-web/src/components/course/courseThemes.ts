/**
 * Thèmes des cours (AUDIT_editeur_texte.md, lot T16a) : couleurs des titres et des encadrés,
 * police des titres. Un thème est un jeu de variables CSS posées sur `.ce-flow` ; course.css
 * les lit avec, pour valeur de repli, le thème « Classique » (l'apparence d'avant le lot T16).
 *
 * Le thème est rangé dans le cours (`doc.settings.theme`) : il voyage avec lui (autre
 * ordinateur, copie, modèle). Le thème « par défaut » est un réglage de l'ordinateur, posé sur
 * les nouveaux cours à leur création.
 */
import type { CSSProperties } from 'react';
import type { CourseDoc } from '../../lib/course/courseDoc';

export type CourseThemeId = 'classique' | 'sobre' | 'nature' | 'chaleureux' | 'ecolier';

interface ThemeColors {
  h1: string; h2: string; h3: string;
  /** Police des titres (null : celle du texte). */
  headFont: string | null;
  def: { line: string; bg: string; ink: string };
  ret: { line: string; bg: string; ink: string };
  con: { bg: string; text: string; ink: string };
  ex: { line: string; bg: string; ink: string };
}

export interface CourseTheme extends ThemeColors {
  id: CourseThemeId;
  label: string;
  hint: string;
}

const CLASSIQUE: ThemeColors = {
  h1: '#1E3A8A', h2: '#3730A3', h3: '#4338CA', headFont: null,
  def: { line: '#10B981', bg: '#ECFDF5', ink: '#047857' },
  ret: { line: '#F59E0B', bg: '#FEF3C7', ink: '#B45309' },
  con: { bg: '#EFF6FF', text: '#1E3A8A', ink: '#2563EB' },
  ex: { line: '#8B5CF6', bg: '#F5F3FF', ink: '#6D28D9' },
};

export const COURSE_THEMES: CourseTheme[] = [
  { id: 'classique', label: 'Classique', hint: 'Bleu, encadrés colorés (l’apparence d’origine)', ...CLASSIQUE },
  {
    id: 'sobre', label: 'Sobre', hint: 'Noir et gris : propre à la photocopie',
    h1: '#111827', h2: '#111827', h3: '#374151', headFont: null,
    def: { line: '#111827', bg: '#FFFFFF', ink: '#111827' },
    ret: { line: '#111827', bg: '#F3F4F6', ink: '#111827' },
    con: { bg: '#F9FAFB', text: '#111827', ink: '#374151' },
    ex: { line: '#6B7280', bg: '#FFFFFF', ink: '#374151' },
  },
  {
    id: 'nature', label: 'Nature', hint: 'Verts et bleu-vert',
    h1: '#14532D', h2: '#15803D', h3: '#0F766E', headFont: null,
    def: { line: '#0D9488', bg: '#F0FDFA', ink: '#0F766E' },
    ret: { line: '#65A30D', bg: '#F7FEE7', ink: '#3F6212' },
    con: { bg: '#ECFDF5', text: '#14532D', ink: '#15803D' },
    ex: { line: '#0891B2', bg: '#ECFEFF', ink: '#0E7490' },
  },
  {
    id: 'chaleureux', label: 'Chaleureux', hint: 'Orangés et roses',
    h1: '#9A3412', h2: '#C2410C', h3: '#B45309', headFont: null,
    def: { line: '#E11D48', bg: '#FFF1F2', ink: '#BE123C' },
    ret: { line: '#EA580C', bg: '#FFF7ED', ink: '#C2410C' },
    con: { bg: '#FEFCE8', text: '#713F12', ink: '#A16207' },
    ex: { line: '#D946EF', bg: '#FDF4FF', ink: '#A21CAF' },
  },
  {
    id: 'ecolier', label: 'Écolier', hint: 'Titres en écriture attachée, rouge et bleu du cahier',
    ...CLASSIQUE,
    h1: '#B91C1C', h2: '#1D4ED8', h3: '#15803D', headFont: '"Playwrite FR Moderne", cursive',
  },
];

export const themeById = (id: string | undefined): CourseTheme =>
  COURSE_THEMES.find((t) => t.id === id) ?? COURSE_THEMES[0];

/** Variables CSS du thème, à poser sur `.ce-flow` (rien pour « Classique » : les valeurs de repli). */
export function themeStyle(id: string | undefined): CSSProperties {
  const t = themeById(id);
  if (t.id === 'classique') return {};
  const v: Record<string, string> = {
    '--ce-h1': t.h1, '--ce-h2': t.h2, '--ce-h3': t.h3,
    '--ce-def-line': t.def.line, '--ce-def-bg': t.def.bg, '--ce-def-ink': t.def.ink,
    '--ce-ret-line': t.ret.line, '--ce-ret-bg': t.ret.bg, '--ce-ret-ink': t.ret.ink,
    '--ce-con-bg': t.con.bg, '--ce-con-text': t.con.text, '--ce-con-ink': t.con.ink,
    '--ce-ex-line': t.ex.line, '--ce-ex-bg': t.ex.bg, '--ce-ex-ink': t.ex.ink,
  };
  if (t.headFont) v['--ce-head-font'] = t.headFont;
  return v as CSSProperties;
}

// ---- Thème des nouveaux cours (réglage de l'ordinateur) ----

const DEFAULT_KEY = 'course-default-theme';

export function defaultThemeId(): CourseThemeId | null {
  try {
    const v = localStorage.getItem(DEFAULT_KEY);
    return COURSE_THEMES.some((t) => t.id === v) ? (v as CourseThemeId) : null;
  } catch { return null; }
}

export function setDefaultThemeId(id: CourseThemeId): void {
  try {
    if (id === 'classique') localStorage.removeItem(DEFAULT_KEY);
    else localStorage.setItem(DEFAULT_KEY, id);
  } catch { /* stockage indisponible */ }
}

/** Nouveau cours : le thème par défaut de l'ordinateur, sauf si le modèle en a déjà un. */
export function withDefaultTheme(doc: CourseDoc): CourseDoc {
  const id = defaultThemeId();
  if (!id || doc.settings?.theme) return doc;
  return { ...doc, settings: { ...(doc.settings ?? {}), theme: id } };
}
