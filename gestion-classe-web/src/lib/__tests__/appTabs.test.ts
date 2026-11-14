import { describe, expect, it } from 'vitest';
import { MASKABLE_TABS, NO_HIDDEN_TABS, hasHiddenTab, sameHiddenTabs, sanitizeHiddenTabs } from '../appTabs';

describe('sanitizeHiddenTabs', () => {
  it('rend tous les onglets visibles pour un réglage absent ou illisible', () => {
    expect(sanitizeHiddenTabs(null)).toEqual(NO_HIDDEN_TABS);
    expect(sanitizeHiddenTabs('n’importe quoi')).toEqual(NO_HIDDEN_TABS);
    expect(sanitizeHiddenTabs(undefined)).toEqual(NO_HIDDEN_TABS);
  });

  it('garde les onglets masqués et ignore ceux qui ont quitté le menu', () => {
    const tabs = sanitizeHiddenTabs({ academy: true, tools: false, productions: true, 'group-sessions': true });
    expect(tabs.academy).toBe(true);
    expect(tabs.tools).toBe(false);
    expect(Object.keys(tabs)).toEqual(MASKABLE_TABS.map((t) => t.key));
    expect('productions' in tabs).toBe(false);
  });

  it('laisse visible un onglet ajouté depuis le réglage enregistré', () => {
    expect(sanitizeHiddenTabs({ rewards: true }).direct).toBe(false);
  });

  it('n’accepte que « vrai » comme valeur masquée', () => {
    expect(sanitizeHiddenTabs({ clouds: 'oui', pronote: 1 })).toEqual(NO_HIDDEN_TABS);
  });
});

describe('comparaisons', () => {
  it('dit si un onglet au moins est masqué', () => {
    expect(hasHiddenTab(NO_HIDDEN_TABS)).toBe(false);
    expect(hasHiddenTab({ ...NO_HIDDEN_TABS, direct: true })).toBe(true);
  });

  it('compare deux réglages onglet par onglet', () => {
    expect(sameHiddenTabs(NO_HIDDEN_TABS, sanitizeHiddenTabs({}))).toBe(true);
    expect(sameHiddenTabs(NO_HIDDEN_TABS, { ...NO_HIDDEN_TABS, tools: true })).toBe(false);
  });
});
