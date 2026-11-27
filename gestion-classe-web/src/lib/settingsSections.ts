/**
 * Sections de la fenêtre Réglages : une seule liste pour la fenêtre elle-même et pour la recherche
 * globale, qui peut ouvrir les Réglages sur une section précise (lot R1 de PLAN_mes_cours.md).
 */

export type SettingsSectionKey = 'tabs' | 'home' | 'timetable' | 'establishment' | 'teacher' | 'schoolYear' | 'import' | 'data';

export interface SettingsSection {
  key: SettingsSectionKey;
  label: string;
  /** Mots que l'on tape pour trouver la section, en plus de son nom. */
  keywords: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { key: 'tabs', label: 'Onglets visibles', keywords: 'menu masquer afficher pages' },
  { key: 'home', label: "Page d'accueil", keywords: 'modules disposition widgets' },
  { key: 'timetable', label: 'Emploi du temps', keywords: 'ics import pronote calendrier' },
  { key: 'establishment', label: 'Établissement', keywords: 'collège adresse téléphone' },
  { key: 'teacher', label: 'Profil enseignant', keywords: 'nom matière fonction' },
  { key: 'schoolYear', label: 'Année scolaire', keywords: 'trimestre période' },
  { key: 'import', label: 'Jeton d’import', keywords: 'claude dépôt cours clé' },
  { key: 'data', label: 'Données', keywords: 'export sauvegarde effacer stockage' },
];

export const settingsSectionLabel = (key: SettingsSectionKey): string =>
  SETTINGS_SECTIONS.find((s) => s.key === key)?.label ?? key;
