/**
 * Thèmes de l'espace élève (/eleve). Un thème est un habillage : couleurs, arrondis, police des
 * titres et un peu de décor, décrits dans `styles/eleve.css` (`.el[data-theme='…']`).
 *
 * Six thèmes sont libres ; les autres s'ouvrent avec le cours ou se gagnent (`unlock`, et
 * lib/studentThemeUnlocks.ts pour les droits de chaque élève). Le choix est gardé sur le serveur ;
 * l'appareil en garde une copie (localStorage), qui sert à l'écran de saisie du code.
 *
 * Thèmes illustrés (chantier d'essai du 26/11/2026) : un thème peut avoir une `scene`, un décor en
 * plusieurs plans rangé dans `src/themes-eleve/<id>/` avec sa feuille de styles. Elle n'est chargée
 * que si l'élève choisit ce thème (voir `components/student/StudentDecor.tsx`).
 */
import type { ComponentType } from 'react';

export type StudentThemeId = 'carnet' | 'cosmos' | 'arcade' | 'jungle' | 'fossiles' | 'volcan' | 'crepuscule' | 'savane' | 'abysses' | 'banquise' | 'stade' | 'ruche' | 'sommets' | 'orage' | 'microscope' | 'ville' | 'parquet' | 'adn' | 'seisme' | 'skate'
  | 'moyenage' | 'voyage' | 'fantasy' | 'conte' | 'theatre' | 'heros';

/** Famille d'un thème : sert à ranger l'écran « Mon thème ». */
export type StudentThemeGroup = 'univers' | 'nature' | 'sciences' | 'francais' | 'sport';

export const STUDENT_THEME_GROUPS: { id: StudentThemeGroup; name: string }[] = [
  { id: 'univers', name: 'Univers' },
  { id: 'nature', name: 'Animaux et nature' },
  { id: 'sciences', name: 'Sciences' },
  { id: 'francais', name: 'Français' },
  { id: 'sport', name: 'Sport' },
];

/**
 * Comment un thème s'obtient (migration 099, `_student_theme_kind` en base : les deux listes doivent
 * rester identiques, un test le contrôle) : libre, ouvert par le professeur avec le cours, ou gagné
 * par l'élève avec une carte à tampons remplie.
 */
export type StudentThemeUnlock = 'free' | 'class' | 'card';

export interface StudentTheme {
  id: StudentThemeId;
  name: string;
  group: StudentThemeGroup;
  unlock: StudentThemeUnlock;
  /** Une ligne pour le choisir. */
  note: string;
  /** Aperçu dans le sélecteur, et couleur de fond de la page. */
  bg: string;
  surface: string;
  text: string;
  accent: string;
  /** Famille Google Fonts des titres, chargée seulement quand le thème est choisi. */
  font?: string;
  /** Décor illustré du thème (et sa feuille de styles), chargé à la demande. */
  scene?: () => Promise<{ default: ComponentType }>;
  /** Le décor bouge (parallaxe ou animation d'ambiance) : dit dans le sélecteur. */
  animated?: boolean;
}

export const STUDENT_THEMES: StudentTheme[] = [
  { id: 'carnet', name: 'Carnet', group: 'univers', unlock: 'free', note: 'Clair et sobre', bg: '#F6F6F7', surface: '#FFFFFF', text: '#18181B', accent: '#4F46E5' },
  { id: 'cosmos', name: 'Cosmos', group: 'univers', unlock: 'free', note: 'Nuit étoilée', bg: '#0B1026', surface: '#151B3B', text: '#EEF1FF', accent: '#8EA2FF', font: 'Space+Grotesk:wght@500;700', scene: () => import('../themes-eleve/cosmos'), animated: true },
  { id: 'arcade', name: 'Arcade', group: 'univers', unlock: 'free', note: 'Rétro, tout en pixels', bg: '#170F2E', surface: '#241846', text: '#F6F0FF', accent: '#FFD23F', font: 'Pixelify+Sans:wght@500;700', scene: () => import('../themes-eleve/arcade'), animated: true },
  { id: 'jungle', name: 'Jungle', group: 'nature', unlock: 'free', note: 'Sous la canopée', bg: '#EEF5E8', surface: '#FFFFFF', text: '#16291B', accent: '#1F7A3A', font: 'Fredoka:wght@500;600;700', scene: () => import('../themes-eleve/jungle'), animated: true },
  { id: 'fossiles', name: 'Fossiles', group: 'sciences', unlock: 'class', note: 'Une falaise et ses fossiles', bg: '#F0E2CC', surface: '#FBF3E4', text: '#33261A', accent: '#A4501C', font: 'Bitter:wght@600;700', scene: () => import('../themes-eleve/fossiles'), animated: true },
  { id: 'volcan', name: 'Volcan', group: 'sciences', unlock: 'class', note: 'La nuit, en éruption', bg: '#170C0A', surface: '#2A1613', text: '#FFF1E8', accent: '#FF6A2B', font: 'Bebas+Neue', scene: () => import('../themes-eleve/volcan'), animated: true },
  { id: 'crepuscule', name: 'Crépuscule', group: 'univers', unlock: 'free', note: 'Un ciel de dessin animé', bg: '#171A44', surface: '#232659', text: '#F5F2FF', accent: '#FF9DBB', font: 'M+PLUS+Rounded+1c:wght@700;800', scene: () => import('../themes-eleve/crepuscule'), animated: true },
  { id: 'savane', name: 'Savane', group: 'nature', unlock: 'card', note: 'Girafes et acacias', bg: '#FBE7C4', surface: '#FFFCF4', text: '#3A2410', accent: '#B4531A', font: 'Baloo+2:wght@600;700', scene: () => import('../themes-eleve/savane'), animated: true },
  { id: 'abysses', name: 'Abysses', group: 'nature', unlock: 'card', note: 'Méduses et baudroie', bg: '#06142B', surface: '#0E2244', text: '#EAF6FF', accent: '#4FE3D0', font: 'Sora:wght@600;700', scene: () => import('../themes-eleve/abysses'), animated: true },
  { id: 'banquise', name: 'Banquise', group: 'nature', unlock: 'card', note: 'Manchots et icebergs', bg: '#EAF4FB', surface: '#FFFFFF', text: '#0F2A3D', accent: '#0B6FA4', font: 'Quicksand:wght@600;700', scene: () => import('../themes-eleve/banquise'), animated: true },
  { id: 'stade', name: 'Stade', group: 'sport', unlock: 'free', note: 'Un soir de match', bg: '#0B1F17', surface: '#132E22', text: '#F1FFF6', accent: '#B8F24A', font: 'Barlow+Condensed:ital,wght@0,600;0,700;1,700', scene: () => import('../themes-eleve/stade'), animated: true },
  { id: 'ruche', name: 'Ruche', group: 'nature', unlock: 'card', note: 'Abeilles et miel', bg: '#FFF6DC', surface: '#FFFDF5', text: '#33240A', accent: '#9A5B00', font: 'Comfortaa:wght@700', scene: () => import('../themes-eleve/ruche'), animated: true },
  { id: 'sommets', name: 'Sommets', group: 'sport', unlock: 'card', note: 'Neige et grand air', bg: '#F1F5FA', surface: '#FFFFFF', text: '#14243A', accent: '#C2410C', font: 'Outfit:wght@600;700', scene: () => import('../themes-eleve/sommets'), animated: true },
  { id: 'orage', name: 'Orage', group: 'sciences', unlock: 'class', note: 'La station météo sous l’éclair', bg: '#131A2B', surface: '#1D2740', text: '#EEF3FF', accent: '#FFD84A', font: 'Rubik:wght@600;700', scene: () => import('../themes-eleve/orage'), animated: true },
  { id: 'microscope', name: 'Microscope', group: 'sciences', unlock: 'class', note: 'La vie dans une goutte d’eau', bg: '#F4EEFA', surface: '#FFFFFF', text: '#2A1B3D', accent: '#7A2FB8', font: 'Nunito:wght@700;800', scene: () => import('../themes-eleve/microscope'), animated: true },
  { id: 'ville', name: 'Ville la nuit', group: 'univers', unlock: 'card', note: 'Néons, toits et métro aérien', bg: '#120F26', surface: '#1C1838', text: '#F3F0FF', accent: '#FF5FA8', font: 'Chakra+Petch:wght@600;700', scene: () => import('../themes-eleve/ville'), animated: true },
  { id: 'parquet', name: 'Parquet', group: 'sport', unlock: 'card', note: 'Le gymnase, un jour de match', bg: '#FAEEDC', surface: '#FFFFFF', text: '#1E1B33', accent: '#1D4ED8', font: 'Lilita+One', scene: () => import('../themes-eleve/parquet'), animated: true },
  { id: 'adn', name: 'ADN', group: 'sciences', unlock: 'class', note: 'La double hélice au labo', bg: '#EDF6F5', surface: '#FFFFFF', text: '#0F2B2E', accent: '#0B7A75', font: 'Manrope:wght@700;800', scene: () => import('../themes-eleve/adn'), animated: true },
  { id: 'skate', name: 'Skatepark', group: 'sport', unlock: 'card', note: 'La rampe, le mur de graffs', bg: '#EEF0F4', surface: '#FFFFFF', text: '#1B1D2A', accent: '#C2185B', font: 'Bangers', scene: () => import('../themes-eleve/skate'), animated: true },
  { id: 'seisme', name: 'Sismographe', group: 'sciences', unlock: 'class', note: 'La faille, le foyer, le tracé', bg: '#F5F1E8', surface: '#FFFFFF', text: '#20242B', accent: '#C2261D', font: 'IBM+Plex+Mono:wght@600;700', scene: () => import('../themes-eleve/seisme'), animated: true },
  // Français (programme du collège), ouverts par le professeur avec le cours comme ceux de sciences
  { id: 'moyenage', name: 'Moyen Âge', group: 'francais', unlock: 'class', note: 'Le château et son tournoi', bg: '#EFE6D2', surface: '#FFFBF1', text: '#2A1E12', accent: '#1F4E8C', font: 'Uncial+Antiqua', scene: () => import('../themes-eleve/moyenage'), animated: true },
  { id: 'voyage', name: 'Voyage', group: 'francais', unlock: 'class', note: 'Cap vers l’inconnu', bg: '#F8EEDB', surface: '#FFFDF7', text: '#1F2B38', accent: '#1B5E8A', font: 'Kalam:wght@700', scene: () => import('../themes-eleve/voyage'), animated: true },
  { id: 'fantasy', name: 'Fantasy', group: 'francais', unlock: 'class', note: 'Îles volantes et dragon', bg: '#130F26', surface: '#1F1A3A', text: '#F3EFFF', accent: '#C6A6FF', font: 'Cinzel:wght@600;700', scene: () => import('../themes-eleve/fantasy'), animated: true },
  { id: 'conte', name: 'Conte', group: 'francais', unlock: 'class', note: 'Il était une fois, dans la forêt', bg: '#FBF1E6', surface: '#FFFFFF', text: '#2D2140', accent: '#9C2F6B', font: 'Lobster+Two:wght@700', scene: () => import('../themes-eleve/conte'), animated: true },
  { id: 'theatre', name: 'Théâtre', group: 'francais', unlock: 'class', note: 'Lever de rideau', bg: '#1A0C10', surface: '#2A161B', text: '#FFF3E9', accent: '#F2B544', font: 'Playfair+Display:wght@700;800', scene: () => import('../themes-eleve/theatre'), animated: true },
  { id: 'heros', name: 'Héros et monstres', group: 'francais', unlock: 'class', note: 'Les monstres des mythes grecs', bg: '#F6E6D2', surface: '#FFFBF5', text: '#2A1910', accent: '#9A3412', font: 'Marcellus', scene: () => import('../themes-eleve/heros'), animated: true },
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
