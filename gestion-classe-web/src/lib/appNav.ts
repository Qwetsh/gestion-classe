/**
 * Menu regroupé (lot N3 de PLAN_mes_cours.md, variante A de la maquette `_maquettes/menu-regroupe.html`).
 *
 * Cinq entrées. Celle où l'on se trouve se déplie et montre ses pages ; les autres restent fermées.
 * Les adresses des pages ne changent pas. Une page masquée dans Réglages › Onglets visibles quitte
 * son entrée ; une entrée dont toutes les pages sont masquées disparaît.
 *
 * Définition pure, partagée par la barre latérale, la barre du bas du téléphone et les Réglages.
 */

export interface NavPage {
  path: string;
  /** Nom de la page dans son entrée (« Carnet et fiches » sous Évaluations). */
  label: string;
  icon: string;
  /** Autres adresses qui appartiennent à cette page (pages sans entrée de menu). */
  also?: string[];
  /** Visible du seul développeur. */
  devOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  /** Libellé court de la barre du bas, sur téléphone. */
  short: string;
  icon: string;
  pages: NavPage[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'home', label: 'Accueil', short: 'Accueil', icon: 'home', pages: [
    { path: '/', label: 'Accueil', icon: 'home' },
  ] },
  { id: 'courses', label: 'Mes cours', short: 'Cours', icon: 'courses', pages: [
    { path: '/cours', label: 'Bibliothèque et classes', icon: 'courses' },
    { path: '/tp-templates', label: 'Mes TP', icon: 'flask' },
    { path: '/brevets', label: 'Annales', icon: 'book' },
    { path: '/clouds', label: 'Mes clouds', icon: 'cloud' },
  ] },
  { id: 'classes', label: 'Classes', short: 'Classes', icon: 'classes', pages: [
    { path: '/classes', label: 'Classes et plans', icon: 'classes' },
    { path: '/students', label: 'Suivi élèves', icon: 'students' },
    { path: '/vision-eleve', label: 'Vision élève', icon: 'phone' },
    { path: '/sessions', label: 'Séances', icon: 'sessions' },
    { path: '/cahier-de-texte', label: 'Cahier de texte', icon: 'journal' },
    { path: '/analytics', label: 'Analyses', icon: 'analytics' },
  ] },
  { id: 'evaluations', label: 'Évaluations', short: 'Évals', icon: 'evaluations', pages: [
    // TP de groupe et productions n'ont plus d'entrée : ils vivent dans le carnet et les fiches
    { path: '/evaluations', label: 'Carnet et fiches', icon: 'evaluations', also: ['/productions', '/group-sessions'] },
    { path: '/direct', label: 'Activité en direct', icon: 'direct' },
  ] },
  { id: 'more', label: 'Plus', short: 'Plus', icon: 'more', pages: [
    { path: '/rewards', label: 'Récompenses', icon: 'star' },
    { path: '/academy', label: 'Académie', icon: 'academy' },
    { path: '/tools', label: 'Outils', icon: 'wrench' },
    { path: '/pronote', label: 'Pronote', icon: 'link' },
    { path: '/dev', label: 'Dev', icon: 'dev', devOnly: true },
  ] },
];

/** Entrée « Plus » : un fourre-tout sans page principale. */
export const MORE_GROUP_ID = 'more';

/** Clé d'une page dans Réglages › Onglets visibles : son adresse sans la barre. */
export const pageKey = (page: Pick<NavPage, 'path'>): string => page.path.slice(1);

/** Les entrées telles qu'un professeur les voit : pages masquées retirées, entrées vides retirées. */
export function visibleGroups(isTabVisible: (key: string) => boolean, isDev: boolean): NavGroup[] {
  return NAV_GROUPS
    .map((group) => ({ ...group, pages: group.pages.filter((p) => (p.devOnly ? isDev : isTabVisible(pageKey(p)))) }))
    .filter((group) => group.pages.length > 0);
}

const under = (pathname: string, path: string): boolean =>
  path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`);

/** La page est celle affichée (ou l'une de ses sous-pages : « /sessions/42 » pour Séances). */
export function isPageActive(page: NavPage, pathname: string): boolean {
  return under(pathname, page.path) || (page.also ?? []).some((path) => under(pathname, path));
}

/** Entrée de la page affichée, ou null (page hors menu). */
export function activeGroup(groups: NavGroup[], pathname: string): NavGroup | null {
  return groups.find((group) => group.pages.some((p) => isPageActive(p, pathname))) ?? null;
}

/**
 * Libellé d'une entrée réduite à une seule page visible : le nom de l'entrée quand il reste sa
 * page principale (« Mes cours »), sinon le nom de la page qui reste (« Annales », et toujours
 * pour « Plus », qui n'a pas de page principale).
 */
export function singlePageLabel(group: NavGroup): string {
  const page = group.pages[0];
  const original = NAV_GROUPS.find((g) => g.id === group.id);
  const isMain = group.id !== MORE_GROUP_ID && original?.pages[0].path === page.path;
  return isMain ? group.label : page.label;
}

/** Libellé d'une page dans les Réglages : « Mes cours › Annales » ; null si elle n'est pas au menu. */
export function settingsLabel(key: string): string | null {
  for (const group of NAV_GROUPS) {
    const page = group.pages.find((p) => pageKey(p) === key);
    if (page) return group.pages.length > 1 ? `${group.label} › ${page.label}` : page.label;
  }
  return null;
}
