import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { visibleGroups } from '../appNav';
import { flattenGroups, pageItems, searchItems, settingItems, type SearchItem } from '../globalSearch';

const item = (kind: SearchItem['kind'], id: string, title: string, hint?: string, keywords?: string): SearchItem => ({ kind, id, title, hint, keywords, href: `/${id}` });

const items: SearchItem[] = [
  ...pageItems(visibleGroups(() => true, false)),
  item('course', 'c1', 'Activité 3 — Wegener et la dérive des continents', '4e · Séquence 2'),
  item('course', 'c2', 'Les séismes', '4e · Séquence 2'),
  item('class', 'k1', '4A', 'Classe'),
  item('class', 'k2', '4B', 'Classe'),
  item('student', 's1', 'Léa Ma', '4A'),
  item('student', 's2', 'Malo Du', '4B'),
  item('assessment', 'e1', 'Évaluation séismes', '4A · 12 nov.'),
  item('tool', 't1', 'QR Code', 'Générer un QR code', 'lien partage'),
  ...settingItems(),
];

const titles = (query: string, kind?: SearchItem['kind']) =>
  searchItems(items, query).filter((g) => !kind || g.kind === kind).flatMap((g) => g.items.map((i) => i.title));

describe('pageItems', () => {
  it('nomme une page avec son entrée, et l’accueil par son nom', () => {
    const pages = pageItems(visibleGroups(() => true, false));
    expect(pages.find((p) => p.href === '/brevets')).toMatchObject({ title: 'Annales', hint: 'Mes cours' });
    expect(pages.find((p) => p.href === '/')).toMatchObject({ title: 'Accueil', hint: undefined });
  });

  it('ne propose pas une page masquée', () => {
    const pages = pageItems(visibleGroups((key) => key !== 'academy', false));
    expect(pages.some((p) => p.href === '/academy')).toBe(false);
  });
});

describe('searchItems', () => {
  it('sans rien de tapé, propose les pages dans l’ordre du menu', () => {
    const groups = searchItems(items, '   ');
    expect(groups.map((g) => g.kind)).toEqual(['page']);
    expect(groups[0].items[0].title).toBe('Accueil');
  });

  it('ignore la casse et les accents', () => {
    expect(titles('SEISMES', 'course')).toEqual(['Les séismes']);
    expect(titles('eval seismes', 'assessment')).toEqual(['Évaluation séismes']);
  });

  it('exige tous les mots, dans le titre ou la précision', () => {
    expect(titles('wegener 4e', 'course')).toEqual(['Activité 3 — Wegener et la dérive des continents']);
    expect(titles('wegener 3e')).toEqual([]);
  });

  it('range les familles dans l’ordre prévu', () => {
    expect(searchItems(items, '4a').map((g) => g.kind)).toEqual(['class', 'student', 'assessment']);
  });

  it('place d’abord le titre qui commence par le mot cherché', () => {
    // « Malo Du » commence par « ma » ; dans « Léa Ma », c'est le second mot
    expect(titles('ma', 'student')).toEqual(['Malo Du', 'Léa Ma']);
  });

  it('trouve un outil par ses mots-clés et un réglage par les siens', () => {
    expect(titles('partage', 'tool')).toEqual(['QR Code']);
    expect(titles('sombre', 'setting')).toEqual(['Thème']);
  });

  it('limite chaque famille', () => {
    const many = Array.from({ length: 12 }, (_, i) => item('student', `x${i}`, `Élève ${i + 1}`, '4A'));
    const groups = searchItems(many, 'eleve', 5);
    expect(groups[0].items).toHaveLength(5);
    expect(groups[0].items.map((i) => i.title)).toEqual(['Élève 1', 'Élève 2', 'Élève 3', 'Élève 4', 'Élève 5']);
  });

  it('met les résultats à plat dans l’ordre affiché', () => {
    const flat = flattenGroups(searchItems(items, '4a'));
    expect(flat.map((i) => i.title)).toEqual(['4A', 'Léa Ma', 'Évaluation séismes']);
  });
});
