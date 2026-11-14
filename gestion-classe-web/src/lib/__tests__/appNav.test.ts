import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, activeGroup, isPageActive, pageKey, settingsLabel, singlePageLabel, visibleGroups } from '../appNav';
import { MASKABLE_TABS } from '../appTabs';

const all = () => true;
const hiding = (...keys: string[]) => (key: string) => !keys.includes(key);

describe('définition du menu', () => {
  it('compte cinq entrées et ne cite chaque adresse qu’une fois', () => {
    expect(NAV_GROUPS.map((g) => g.label)).toEqual(['Accueil', 'Mes cours', 'Classes', 'Évaluations', 'Plus']);
    const paths = NAV_GROUPS.flatMap((g) => g.pages.map((p) => p.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('place chaque onglet masquable dans une entrée', () => {
    const keys = NAV_GROUPS.flatMap((g) => g.pages.map(pageKey));
    for (const tab of MASKABLE_TABS) expect(keys).toContain(tab.key);
  });
});

describe('visibleGroups', () => {
  it('cache la page Dev à qui n’est pas développeur', () => {
    const more = (isDev: boolean) => visibleGroups(all, isDev).find((g) => g.id === 'more')!.pages.map((p) => p.path);
    expect(more(false)).not.toContain('/dev');
    expect(more(true)).toContain('/dev');
  });

  it('retire une page masquée de son entrée', () => {
    const courses = visibleGroups(hiding('brevets', 'clouds'), false).find((g) => g.id === 'courses')!;
    expect(courses.pages.map((p) => p.path)).toEqual(['/cours', '/tp-templates']);
  });

  it('retire une entrée dont toutes les pages sont masquées', () => {
    const groups = visibleGroups(hiding('rewards', 'academy', 'tools', 'pronote'), false);
    expect(groups.map((g) => g.id)).toEqual(['home', 'courses', 'classes', 'evaluations']);
  });

  it('ne modifie pas la définition', () => {
    visibleGroups(hiding('brevets'), false);
    expect(NAV_GROUPS.find((g) => g.id === 'courses')!.pages).toHaveLength(4);
  });
});

describe('page et entrée actives', () => {
  const groups = visibleGroups(all, true);
  const group = (pathname: string) => activeGroup(groups, pathname)?.id ?? null;

  it('reconnaît une page et ses sous-pages', () => {
    expect(group('/sessions')).toBe('classes');
    expect(group('/sessions/42')).toBe('classes');
    expect(group('/evaluations/abc')).toBe('evaluations');
    expect(group('/tools/qr')).toBe('more');
  });

  it('ne confond pas l’accueil avec les autres pages', () => {
    expect(group('/')).toBe('home');
    expect(isPageActive(NAV_GROUPS[0].pages[0], '/cours')).toBe(false);
  });

  it('ne confond pas deux adresses qui commencent pareil', () => {
    expect(group('/classes')).toBe('classes');
    expect(group('/classe')).toBeNull();
  });

  it('range les pages sans entrée sous leur page d’accueil', () => {
    expect(group('/productions')).toBe('evaluations');
    expect(group('/group-sessions')).toBe('evaluations');
  });
});

describe('libellés', () => {
  it('garde le nom de l’entrée quand il ne lui reste que sa page principale', () => {
    const courses = visibleGroups(hiding('tp-templates', 'brevets', 'clouds'), false).find((g) => g.id === 'courses')!;
    expect(singlePageLabel(courses)).toBe('Mes cours');
  });

  it('prend le nom de la page quand ce n’est pas la principale, et toujours pour « Plus »', () => {
    const evals = visibleGroups(hiding('evaluations'), false).find((g) => g.id === 'evaluations')!;
    expect(singlePageLabel(evals)).toBe('Activité en direct');
    const more = visibleGroups(hiding('academy', 'tools', 'pronote'), false).find((g) => g.id === 'more')!;
    expect(singlePageLabel(more)).toBe('Récompenses');
  });

  it('nomme une page des Réglages avec son entrée', () => {
    expect(settingsLabel('brevets')).toBe('Mes cours › Annales');
    expect(settingsLabel('evaluations')).toBe('Évaluations › Carnet et fiches');
    expect(settingsLabel('inconnue')).toBeNull();
  });
});
