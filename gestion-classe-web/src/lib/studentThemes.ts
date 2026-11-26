/**
 * Thèmes de l'espace élève (/eleve). Un thème est un habillage : couleurs, arrondis, police des
 * titres et un peu de décor, décrits dans `styles/eleve.css` (`.el[data-theme='…']`).
 *
 * Pour l'instant les thèmes sont tous libres et le choix est gardé sur l'appareil de l'élève
 * (localStorage) : rien n'est écrit en base. Quand des thèmes se débloqueront (idée de Thomas,
 * 26/11/2026), le choix et les droits passeront par le serveur ; `locked` est prévu pour cela.
 */

export type StudentThemeId = 'carnet' | 'cosmos' | 'arcade' | 'jungle';

export interface StudentTheme {
  id: StudentThemeId;
  name: string;
  /** Une ligne pour le choisir. */
  note: string;
  /** Aperçu dans le sélecteur, et couleur de fond de la page. */
  bg: string;
  surface: string;
  text: string;
  accent: string;
  /** Famille Google Fonts des titres, chargée seulement quand le thème est choisi. */
  font?: string;
}

export const STUDENT_THEMES: StudentTheme[] = [
  { id: 'carnet', name: 'Carnet', note: 'Clair et sobre', bg: '#F6F6F7', surface: '#FFFFFF', text: '#18181B', accent: '#4F46E5' },
  { id: 'cosmos', name: 'Cosmos', note: 'Nuit étoilée', bg: '#0B1026', surface: '#151B3B', text: '#EEF1FF', accent: '#8EA2FF', font: 'Space+Grotesk:wght@500;700' },
  { id: 'arcade', name: 'Arcade', note: 'Rétro, tout en pixels', bg: '#170F2E', surface: '#241846', text: '#F6F0FF', accent: '#FFD23F', font: 'Pixelify+Sans:wght@500;700' },
  { id: 'jungle', name: 'Jungle', note: 'Clair et végétal', bg: '#EEF5E8', surface: '#FFFFFF', text: '#16291B', accent: '#1F7A3A', font: 'Fredoka:wght@500;600;700' },
];

export const DEFAULT_STUDENT_THEME: StudentThemeId = 'carnet';

const KEY = 'gc-eleve-theme';

export const isStudentTheme = (value: unknown): value is StudentThemeId =>
  typeof value === 'string' && STUDENT_THEMES.some((t) => t.id === value);

export const studentTheme = (id: StudentThemeId): StudentTheme =>
  STUDENT_THEMES.find((t) => t.id === id) ?? STUDENT_THEMES[0];

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Le stockage du navigateur, s'il est disponible (navigation privée, réglages : il peut manquer). */
function browserStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Thème choisi sur cet appareil ; le thème de départ si rien n'est gardé ou si la valeur est inconnue. */
export function readStudentTheme(store: Store | null = browserStore()): StudentThemeId {
  try {
    const value = store?.getItem(KEY);
    return isStudentTheme(value) ? value : DEFAULT_STUDENT_THEME;
  } catch {
    return DEFAULT_STUDENT_THEME;
  }
}

/** Garde le thème sur cet appareil. Sans stockage, le choix ne vaut que pour la visite en cours. */
export function saveStudentTheme(id: StudentThemeId, store: Store | null = browserStore()): void {
  try {
    store?.setItem(KEY, id);
  } catch {
    /* stockage plein ou refusé : le thème reste appliqué pour cette visite */
  }
}

/** Adresse de la feuille de police d'un thème (Google Fonts, déjà la source des polices de l'app). */
export const studentThemeFontUrl = (theme: StudentTheme): string | null =>
  theme.font ? `https://fonts.googleapis.com/css2?family=${theme.font}&display=swap` : null;
