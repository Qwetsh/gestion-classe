/**
 * Onglets du menu que l'on peut masquer (Réglages › Onglets visibles). Lot N1 de PLAN_mes_cours.md.
 *
 * Une seule liste sert au menu, aux réglages et à la préférence rangée dans le compte
 * (`user_preferences`, clé `hidden_tabs`) : le choix suit le professeur d'un appareil à l'autre.
 * La clé d'un onglet est son adresse sans la barre (« /rewards » → `rewards`).
 */

export const MASKABLE_TABS = [
  { key: 'rewards', label: 'Récompenses' },
  { key: 'evaluations', label: 'Évaluations' },
  { key: 'direct', label: 'Activité en direct' },
  { key: 'academy', label: 'Académie' },
  { key: 'tp-templates', label: 'Mes TP' },
  { key: 'brevets', label: 'Annales' },
  { key: 'clouds', label: 'Mes clouds' },
  { key: 'tools', label: 'Outils' },
  { key: 'pronote', label: 'Pronote' },
] as const;

export type MaskableTab = (typeof MASKABLE_TABS)[number]['key'];

/** Pour chaque onglet masquable : vrai s'il est masqué. */
export type HiddenTabs = Record<MaskableTab, boolean>;

/** Clé de la préférence dans le compte. */
export const HIDDEN_TABS_PREFERENCE = 'hidden_tabs';

export const NO_HIDDEN_TABS: HiddenTabs = Object.fromEntries(MASKABLE_TABS.map((t) => [t.key, false])) as HiddenTabs;

/**
 * Réglage lu depuis le stockage ou le compte, ramené aux onglets d'aujourd'hui : une clé inconnue
 * (onglet retiré du menu, comme « Productions » ou « Groupes ») est ignorée, une clé absente
 * (onglet ajouté depuis) vaut « visible ».
 */
export function sanitizeHiddenTabs(raw: unknown): HiddenTabs {
  const source = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(MASKABLE_TABS.map((t) => [t.key, source[t.key] === true])) as HiddenTabs;
}

export const hasHiddenTab = (tabs: HiddenTabs): boolean => MASKABLE_TABS.some((t) => tabs[t.key]);

export const sameHiddenTabs = (a: HiddenTabs, b: HiddenTabs): boolean => MASKABLE_TABS.every((t) => a[t.key] === b[t.key]);
