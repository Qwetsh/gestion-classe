/** Imprimer un bilan : il est reconstitué en entier, à partir de n'importe laquelle des pages où il est écrit. */
import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { buildBinder } from '../binder';
import { ABOVE_MAX, UNDER_LINES, summaryAt, withSummaries, type InkLine, type InkRun, type SummaryRuns } from '../binderSummary';

const board = (id: string, title: string, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id, title, level: chapter ? '4e' : null, chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — La Terre';
const library: Board[] = [
  board('garde', 'Page de garde — Séquence 1', S1),
  board('a1', 'Activité 1 — Volcans', S1),
  board('a2', 'Activité 2 — Séisme', S1),
  board('a2-docs', 'Activité 2 — Séisme (documents)', S1),
  board('a3', 'Activité 3 — Wegener', S1),
  board('a3-docs', 'Activité 3 — Wegener (documents)', S1),
  board('a5', 'Activité 5 — Sans bilan', S1),
];

/** Un bilan de `n` lignes : chaque paragraphe donne une ligne « nom-rang ». */
const bilan = (name: string, n: number): InkRun[][] => Array.from({ length: n }, (_, i) => [{ text: `${name}-${i + 1}` }]);
const texts = new Map<string, SummaryRuns>([[S1, new Map([
  ['activite 1', { heading: 'Activité 1 — Volcans', paragraphs: bilan('A1', 3) }],
  // Trop long pour tenir sous la fiche : la fin passe au-dessus de la feuille de documents
  ['activite 2', { heading: 'Activité 2 — Séisme', paragraphs: bilan('A2', UNDER_LINES + 4) }],
  // Trop long même pour le haut de la feuille de documents : feuilles de lignes
  ['activite 3', { heading: 'Activité 3 — Wegener', paragraphs: bilan('A3', UNDER_LINES + ABOVE_MAX + 40) }],
  // Activité sans fiche dans le classeur
  ['activite 4', { heading: 'Activité 4 — Sans fiche', paragraphs: bilan('A4', 40) }],
])]]);

const pages = withSummaries(buildBinder(library, '4e'), texts, (p) => p.map((r) => r));
const at = (pick: (i: number) => boolean) => pages.findIndex((_, i) => pick(i));
const text = (lines: InkLine[]) => lines.map((l) => l.map((r) => r.text).join(''));
const names = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}-${i + 1}`);
const key = (k: string) => at((i) => pages[i].key === k);

describe('summaryAt', () => {
  it('un bilan court tient sous sa fiche', () => {
    const b = summaryAt(pages, key('a1'))!;
    expect(b.title).toBe('Activité 1 — Volcans');
    expect(text(b.lines)).toEqual(names('A1', 3));
  });

  it('un bilan qui finit au-dessus de la feuille de documents est rendu entier, depuis l’une ou l’autre page', () => {
    const fromSheet = summaryAt(pages, key('a2'))!;
    const fromDocs = summaryAt(pages, key('a2-docs'))!;
    expect(text(fromSheet.lines)).toEqual(names('A2', UNDER_LINES + 4));
    expect(fromDocs).toEqual(fromSheet);
    // Les deux pages portent bien chacune un morceau
    const sheet = pages[key('a2')];
    const docs = pages[key('a2-docs')];
    expect(sheet.kind === 'sheet' && sheet.summary?.length).toBe(UNDER_LINES);
    expect(docs.kind === 'sheet' && docs.above?.length).toBe(4);
  });

  it('un bilan qui continue sur des feuilles de lignes est rendu entier, depuis chacune d’elles', () => {
    const whole = names('A3', UNDER_LINES + ABOVE_MAX + 40);
    const ruled = pages.flatMap((p, i) => (p.kind === 'ruled' && p.key.startsWith('a3:bilan:') ? [i] : []));
    expect(ruled.length).toBeGreaterThan(1);
    for (const i of [key('a3'), ...ruled]) {
      const b = summaryAt(pages, i)!;
      expect(b.title, pages[i].key).toBe('Activité 3 — Wegener');
      expect(text(b.lines), pages[i].key).toEqual(whole);
    }
    // La feuille de documents de l'activité 3 ne porte rien : elle n'a pas de bilan à imprimer
    expect(summaryAt(pages, key('a3-docs'))).toBeNull();
  });

  it('le bilan d’une activité sans fiche est rendu entier, sans celui des autres', () => {
    const own = pages.flatMap((p, i) => (p.kind === 'ruled' && !/:bilan:\d+$/.test(p.key) ? [i] : []));
    expect(own.length).toBeGreaterThan(1);
    for (const i of own) {
      const b = summaryAt(pages, i)!;
      expect(b.title).toBe('Activité 4 — Sans fiche');
      expect(text(b.lines)).toEqual(names('A4', 40));
    }
  });

  it('une page sans bilan, ou un intercalaire, ne rend rien', () => {
    expect(summaryAt(pages, key('a5'))).toBeNull();
    expect(summaryAt(pages, key('garde'))).toBeNull();
    expect(summaryAt(pages, key('divider:sequences'))).toBeNull();
    expect(summaryAt(pages, 999)).toBeNull();
  });
});
