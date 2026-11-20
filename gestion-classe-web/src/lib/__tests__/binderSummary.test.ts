import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import type { Board } from '../boardsQueries';
import { buildBinder, type BinderPage } from '../binder';
import {
  ABOVE_MAX, RULED_LINES_TITLED, SUMMARY_LEAD, UNDER_LINES, summaryRuns, withSummaries, wrapInk, type InkLine, type SummaryRuns,
} from '../binderSummary';

let n = 0;
const board = (title: string, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id: `b${++n}`, title, level: '4e', chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — La Terre';
/** Une lettre = 1 de largeur : une ligne fait au plus `width` caractères. */
const measure = (text: string) => text.length;

const flat = (line: InkLine) => line.map((r) => r.text).join('');

describe('wrapInk', () => {
  it('coupe aux espaces, sans dépasser la largeur', () => {
    const lines = wrapInk([[{ text: 'un deux trois quatre cinq six' }]], 12, measure);
    expect(lines.map(flat)).toEqual(['un deux', 'trois quatre', 'cinq six']);
    for (const l of lines) expect(flat(l).length).toBeLessThanOrEqual(12);
  });

  it('écrit « Bilan : » devant le premier paragraphe seulement, souligné', () => {
    const lines = wrapInk([[{ text: 'Les éruptions' }], [{ text: 'Second paragraphe' }]], 40, measure, SUMMARY_LEAD);
    expect(flat(lines[0])).toBe('Bilan : Les éruptions');
    expect(lines[0][0]).toEqual({ text: 'Bilan :', underline: true });
    expect(flat(lines[1])).toBe('Second paragraphe');
  });

  it('garde les mots clés soulignés, espaces comprises entre deux mots soulignés', () => {
    const lines = wrapInk([[{ text: 'Le ' }, { text: 'magma visqueux', underline: true }, { text: ' explose.' }]], 40, measure);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual([{ text: 'Le ' }, { text: 'magma visqueux', underline: true }, { text: ' explose.' }]);
    expect(flat(lines[0])).toBe('Le magma visqueux explose.');
  });

  it('ne laisse pas une ponctuation double commencer une ligne', () => {
    const lines = wrapInk([[{ text: 'abcdefghij :' }]], 10, measure);
    expect(lines.map(flat)).toEqual(['abcdefghij :']);
  });

  it('garde entier un mot plus large que la ligne', () => {
    const lines = wrapInk([[{ text: 'anticonstitutionnellement ok' }]], 8, measure);
    expect(lines.map(flat)).toEqual(['anticonstitutionnellement', 'ok']);
  });
});

describe('summaryRuns', () => {
  const cell = (...paras: JSONContent[]): JSONContent => ({ type: 'tableCell', content: paras });
  const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
  const t = (text: string, underline = false): JSONContent => ({ type: 'text', text, ...(underline ? { marks: [{ type: 'underline' }] } : {}) });
  const doc = (...tables: JSONContent[]): JSONContent => ({ type: 'doc', content: tables });
  const table = (title: string, ...bilan: JSONContent[]): JSONContent => ({
    type: 'table',
    content: [{ type: 'tableRow', content: [cell(p(t(`${title}   —   Pourquoi ?`)))] }, { type: 'tableRow', content: [cell(p(t('Bilan :')), ...bilan)] }],
  });

  it('lit l’intitulé de l’activité et ses paragraphes, mots soulignés compris', () => {
    const runs = summaryRuns(doc(table('Activité 1 — Deux types', p(t('Le '), t('magma', true), t(' coule.')))));
    expect(runs.get('activite 1')).toEqual({
      heading: 'Activité 1 — Deux types',
      paragraphs: [[{ text: 'Le ' }, { text: 'magma', underline: true }, { text: ' coule.' }]],
    });
  });

  it('ignore une activité sans bilan', () => {
    expect(summaryRuns(doc(table('Activité 1 — Vide'))).size).toBe(0);
  });
});

describe('withSummaries', () => {
  const lines = (count: number): InkLine[] => Array.from({ length: count }, (_, i) => [{ text: `ligne ${i + 1}` }]);
  /** Un bilan de `count` lignes : la coupe est simulée, une ligne par paragraphe. */
  const wrap = (paragraphs: { text: string }[][]) => paragraphs.map((r) => [...r]);
  const bilan = (heading: string, count: number) => ({ heading, paragraphs: lines(count) });
  const texts = (entries: Record<string, ReturnType<typeof bilan>>): Map<string, SummaryRuns> => new Map([[S1, new Map(Object.entries(entries))]]);

  const library: Board[] = [
    board('Page de garde — Séquence 1', S1),
    board('Activité 1 — Volcans', S1), board('Activité 1 — Volcans (documents)', S1),
    board('Activité 2 — Séisme', S1), board('Activité 2 — Séisme (documents)', S1),
    board('Activité 4 — Roches', S1),
    board('Évaluation — La Terre', S1),
  ];
  const labels = (pages: BinderPage[]) => pages.map((p) => (p.kind === 'divider' ? `[${p.section}]` : p.label));
  const sheet = (pages: BinderPage[], label: string) => {
    const page = pages.find((p) => p.kind !== 'divider' && p.label === label);
    if (!page || page.kind !== 'sheet') throw new Error(`pas de feuille « ${label} »`);
    return page;
  };

  it('écrit un bilan court sous la fiche, sans page de plus', () => {
    const base = buildBinder(library, '4e');
    const pages = withSummaries(base, texts({ 'activite 1': bilan('Activité 1 — Volcans', 3) }), wrap);
    expect(sheet(pages, 'Activité 1').summary).toHaveLength(3);
    expect(pages).toHaveLength(base.length);
  });

  it('finit un bilan long au-dessus de la feuille de documents', () => {
    const pages = withSummaries(buildBinder(library, '4e'), texts({ 'activite 1': bilan('Activité 1 — Volcans', UNDER_LINES + 3) }), wrap);
    expect(sheet(pages, 'Activité 1').summary).toHaveLength(UNDER_LINES);
    expect(sheet(pages, 'Activité 1 — documents').above).toHaveLength(3);
    expect(pages.some((p) => p.kind === 'ruled' && /suite/.test(p.label))).toBe(false);
  });

  it('passe sur une feuille de lignes quand la fin ne tient pas au-dessus des documents', () => {
    const pages = withSummaries(buildBinder(library, '4e'), texts({ 'activite 1': bilan('Activité 1 — Volcans', UNDER_LINES + ABOVE_MAX + 1) }), wrap);
    expect(sheet(pages, 'Activité 1 — documents').above).toBeUndefined();
    const suite = pages.find((p) => p.kind === 'ruled' && /suite du bilan/.test(p.label));
    expect(suite && suite.kind === 'ruled' && suite.lines).toHaveLength(ABOVE_MAX + 1);
    // la feuille de lignes vient juste après la fiche, avant ses documents
    const order = labels(pages);
    expect(order.indexOf('Activité 1 — suite du bilan')).toBe(order.indexOf('Activité 1') + 1);
  });

  it('un bilan sans documents à la suite prend une feuille de lignes', () => {
    const pages = withSummaries(buildBinder(library, '4e'), texts({ 'activite 4': bilan('Activité 4 — Roches', UNDER_LINES + 2) }), wrap);
    expect(sheet(pages, 'Activité 4').summary).toHaveLength(UNDER_LINES);
    expect(labels(pages)).toContain('Activité 4 — suite du bilan');
  });

  it('donne sa propre feuille au bilan d’une activité sans fiche, à sa place', () => {
    const pages = withSummaries(buildBinder(library, '4e'), texts({ 'activite 3': bilan('Activité 3 — Répartition', 4) }), wrap);
    const order = labels(pages);
    const own = pages.find((p) => p.kind === 'ruled' && p.heading === 'Activité 3 — Répartition');
    expect(own?.kind === 'ruled' && own.lines).toHaveLength(4);
    // entre l'activité 2 (et ses documents) et l'activité 4
    expect(order.indexOf('Activité 3 — bilan')).toBeGreaterThan(order.indexOf('Activité 2 — documents'));
    expect(order.indexOf('Activité 3 — bilan')).toBeLessThan(order.indexOf('Activité 4'));
  });

  it('un bilan sans fiche, après la dernière activité, passe avant l’évaluation', () => {
    const pages = withSummaries(buildBinder(library, '4e'), texts({ 'activite 6': bilan('Activité 6 — Fin', 2) }), wrap);
    const order = labels(pages);
    expect(order.indexOf('Activité 6 — bilan')).toBeGreaterThan(order.indexOf('Activité 4'));
    expect(order.indexOf('Activité 6 — bilan')).toBeLessThan(order.indexOf('Évaluation'));
  });

  it('coupe un très long bilan sans fiche en plusieurs feuilles, le titre en haut de la première', () => {
    const pages = withSummaries(buildBinder(library, '4e'), texts({ 'activite 6': bilan('Activité 6 — Fin', RULED_LINES_TITLED + 5) }), wrap);
    const own = pages.filter((p) => p.kind === 'ruled');
    expect(own).toHaveLength(2);
    expect(own[0].kind === 'ruled' && own[0].lines).toHaveLength(RULED_LINES_TITLED);
    expect(own[1].kind === 'ruled' && own[1].heading).toBeUndefined();
  });

  it('sans bilan, le classeur est inchangé', () => {
    const base = buildBinder(library, '4e');
    expect(withSummaries(base, new Map(), wrap)).toEqual(base);
  });
});
