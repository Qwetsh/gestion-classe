import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { buildBinder, type BinderPage } from '../binder';
import {
  binderItems, hasCorrection, itemStates, pageAccess, parseReleased, releaseBinder, releasedOf, rowFor, sequenceAnchors, staleRows,
  type BinderItem, type BinderItemRow,
} from '../binderRelease';
import { withSummaries, type InkRun, type SummaryRuns } from '../binderSummary';

const board = (id: string, title: string, level: string | null, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id, title, level, chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — La Terre, une planète active';
const S5 = 'Séquence 5 — Le système reproducteur';

const library: Board[] = [
  board('guide', 'Mon classeur de SVT — mode d’emploi', null, null),
  board('garde1', 'Page de garde — Séquence 1', '4e', S1),
  board('a1', 'Activité 1 — Volcans', '4e', S1),
  board('a1-copie', 'Activité 1 — Volcans (copie modèle)', '4e', S1),
  board('a1-corr', 'Activité 1 — Volcans (correction)', '4e', S1),
  board('a2', 'Activité 2 — Séisme', '4e', S1),
  board('a2-docs', 'Activité 2 — Séisme (documents)', '4e', S1),
  board('a2-proto', 'Activité 2 — Séisme (protocole)', '4e', S1),
  board('a2-copie', 'Activité 2 — Séisme (copie modèle)', '4e', S1),
  board('a2-adapt', 'Activité 2 — Séisme (adaptée)', '4e', S1),
  board('a3', 'Activité 3 — Wegener', '4e', S1),
  board('eval', 'Évaluation — La Terre', '4e', S1),
  board('eval-docs', 'Évaluation — La Terre (documents)', '4e', S1),
  board('eval-corr', 'Évaluation — La Terre (correction)', '4e', S1),
  board('entr', 'Entraînement noté — Lire un graphique', '4e', S1),
  board('entr-corr', 'Entraînement noté — Lire un graphique (correction)', '4e', S1),
  board('memo1', 'Fiche de mémorisation — Séquence 1', '4e', S1),
  board('bilans1', 'Feuille de bilans — Séquence 1 (correction)', '4e', S1),
  board('garde5', 'Page de garde — Séquence 5', '4e', S5),
  board('s5a1', 'Activité 1 — La puberté', '4e', S5),
  board('fm1', 'FM1 — Lire une consigne', null, null, { category: 'methode' }),
];

const runs = (text: string): InkRun[][] => [[{ text }]];
/** Bilans du classeur complet : ceux d'une feuille commune (S1 : trois activités) et un bilan sans fiche. */
const texts = new Map<string, SummaryRuns>([
  [S1, new Map([
    ['activite 1', { heading: 'Activité 1 — Volcans', paragraphs: runs('BILAN-A1') }],
    ['activite 2', { heading: 'Activité 2 — Séisme', paragraphs: runs('BILAN-A2') }],
    ['activite 3', { heading: 'Activité 3 — Wegener', paragraphs: runs('BILAN-A3') }],
    ['activite 9', { heading: 'Activité 9 — Sans fiche', paragraphs: runs('BILAN-ORPHELIN') }],
  ])],
]);

const pages = buildBinder(library, '4e');
const items = binderItems(pages, texts);
const item = (anchor: string): BinderItem => items.find((i) => i.anchor === anchor)!;
const CLASS = 'classe-4a';
const row = (anchor: string, visible: boolean, correction = false): BinderItemRow => rowFor(item(anchor), CLASS, { visible, correction });

/** Ce que la classe reçoit, mis en page comme à l'écran : identifiants des cours et tout le texte écrit à la main. */
function seen(rows: BinderItemRow[]) {
  const released = releaseBinder(pages, rows);
  const out = withSummaries(released.pages, released.texts, (p) => p.map((r) => r));
  const boards = out.flatMap((p) => (p.kind === 'sheet' ? [p.board.id, ...(p.companion ? [p.companion.id] : [])] : []));
  const ink = JSON.stringify(out.map((p) => (p.kind === 'sheet' ? [p.summary, p.above] : p.kind === 'ruled' ? p.lines : null)));
  return { out, boards, ink };
}

describe('binderItems', () => {
  it('range les pages par activité, sur l’ancre de la fiche', () => {
    expect(item('a2').pages.map((p) => p.board)).toEqual(['a2', 'a2-proto', 'a2-docs']);
    expect(item('a2')).toMatchObject({ role: 'activity', chapter: S1, label: 'Activité 2', heading: 'Activité 2 — Séisme', copy: 'a2-copie' });
    expect(item('a2').summary?.paragraphs).toEqual(runs('BILAN-A2'));
  });

  it('une page seule est son propre élément', () => {
    expect(items.filter((i) => i.role !== 'activity').map((i) => [i.anchor, i.role])).toEqual([
      ['guide', 'guide'], ['garde1', 'cover'], ['garde5', 'cover'], ['fm1', 'method'], ['memo1', 'memo'],
    ]);
  });

  it('ni évaluation, ni entraînement noté, ni correction, ni version adaptée, ni feuille de bilans', () => {
    const all = JSON.stringify(items);
    for (const id of ['eval', 'eval-docs', 'eval-corr', 'entr', 'entr-corr', 'a1-corr', 'a2-adapt', 'bilans1']) expect(all).not.toContain(`"${id}"`);
  });

  it('dit si une activité a une correction pour des élèves', () => {
    expect(hasCorrection(item('a1'))).toBe(true);
    expect(hasCorrection(item('s5a1'))).toBe(false);
    expect(hasCorrection(item('garde1'))).toBe(false);
  });
});

describe('releaseBinder — rien ne sort sans avoir été ouvert', () => {
  it('fermé par défaut : aucune fiche, seulement les intercalaires', () => {
    const { out, ink } = seen([]);
    expect(out.every((p) => p.kind === 'divider')).toBe(true);
    expect(ink).not.toContain('BILAN');
  });

  it('une ligne non visible ne montre rien', () => {
    expect(seen([row('a2', false)]).boards).toEqual([]);
  });

  it('une activité ouverte : sa fiche, son protocole et ses documents, sans copie modèle ni bilan', () => {
    const { boards, ink } = seen([row('a2', true)]);
    expect(boards).toEqual(['a2', 'a2-proto', 'a2-docs']);
    expect(ink).not.toContain('BILAN');
  });

  it('la correction ouverte ajoute la copie modèle et le bilan de cette activité seulement', () => {
    const { boards, ink } = seen([row('a2', true, true), row('a1', true)]);
    expect(boards).toEqual(['a1', 'a2', 'a2-copie', 'a2-proto', 'a2-docs']);
    expect(ink).toContain('BILAN-A2');
    // La feuille de bilans commune contient ceux de toute la séquence : aucun autre ne sort
    expect(ink).not.toContain('BILAN-A1');
    expect(ink).not.toContain('BILAN-A3');
    expect(ink).not.toContain('BILAN-ORPHELIN');
  });

  it('une correction ne s’ouvre pas sur une activité fermée', () => {
    const r = rowFor(item('a2'), CLASS, { visible: false, correction: true });
    expect(r).toMatchObject({ visible: false, correction_visible: false, released: {} });
    expect(seen([r]).boards).toEqual([]);
  });

  it('une évaluation ne sort jamais, même avec une ligne écrite à la main', () => {
    const forged: BinderItemRow[] = [
      { class_id: CLASS, anchor_board_id: 'eval', visible: true, correction_visible: true, released: { v: 1, role: 'activity', chapter: S1, label: 'Évaluation', pages: [{ board: 'eval', role: 'evaluation', label: 'Évaluation' }, { board: 'eval-corr', role: 'correction', label: 'x' }] } },
      { class_id: CLASS, anchor_board_id: 'eval', visible: true, correction_visible: false, released: { v: 1, role: 'evaluation', chapter: S1, label: 'Évaluation', pages: [{ board: 'eval', role: 'evaluation', label: 'Évaluation' }] } },
    ];
    for (const r of forged) expect(seen([r]).boards).toEqual([]);
  });

  it('une ligne qui cite la page d’une autre activité ne l’ouvre pas', () => {
    const forged: BinderItemRow = { ...row('a1', true), released: { ...releasedOf(item('a1'), false), pages: [{ board: 'a1', role: 'activity', label: 'Activité 1' }, { board: 'a3', role: 'activity', label: 'Activité 3' }] } };
    expect(seen([forged]).boards).toEqual(['a1']);
  });

  it('une ancre absente du classeur (doublon écarté, copie posée sur l’emploi du temps, entraînement noté) n’ouvre rien', () => {
    for (const anchor of ['copie-emploi-du-temps', 'entr', 'a1-corr', 'bilans1']) {
      const forged: BinderItemRow = { class_id: CLASS, anchor_board_id: anchor, visible: true, correction_visible: true, released: releasedOf({ ...item('a1'), anchor }, true) };
      expect(seen([forged]).boards).toEqual([]);
    }
  });

  it('des documents ajoutés après l’ouverture restent fermés tant que la ligne n’est pas mise à jour', () => {
    const before = binderItems(buildBinder(library.filter((b) => b.id !== 'a2-docs'), '4e'), texts).find((i) => i.anchor === 'a2')!;
    const old = rowFor(before, CLASS, { visible: true, correction: false });
    expect(seen([old]).boards).toEqual(['a2', 'a2-proto']);
  });

  it('une copie modèle créée après l’ouverture de la correction ne s’ajoute pas seule', () => {
    const before = binderItems(buildBinder(library.filter((b) => b.id !== 'a2-copie'), '4e'), texts).find((i) => i.anchor === 'a2')!;
    const old = rowFor(before, CLASS, { visible: true, correction: true });
    expect(seen([old]).boards).not.toContain('a2-copie');
  });

  it('le bilan montré est celui qui a été copié à l’ouverture', () => {
    const old = row('a2', true, true);
    const edited = new Map(texts);
    edited.set(S1, new Map([...texts.get(S1)!, ['activite 2', { heading: 'Activité 2 — Séisme', paragraphs: runs('BILAN-RETOUCHE') }]]));
    // releaseBinder ne relit pas les bilans d'aujourd'hui : seulement la ligne
    expect(seen([old]).ink).toContain('BILAN-A2');
    expect(seen([old]).ink).not.toContain('RETOUCHE');
    expect(staleRows(binderItems(pages, edited), [old]).map((s) => s.reason)).toEqual(['correction']);
  });

  it('la fiche de mémorisation et les fiches méthode ne s’ouvrent que par leur propre ligne', () => {
    expect(seen([row('a1', true), row('a2', true)]).boards).not.toContain('memo1');
    expect(seen([row('memo1', true), row('fm1', true), row('guide', true)]).boards).toEqual(['guide', 'fm1', 'memo1']);
  });
});

describe('titres tordus — rien ne s’ouvre par erreur', () => {
  const lib = (extra: Board[]) => [board('g', 'Page de garde — Séquence 1', '4e', S1), ...extra];
  const anchors = (extra: Board[], t = texts) => binderItems(buildBinder(lib(extra), '4e'), t);

  it('un suffixe non reconnu ou un titre douteux ne devient pas une activité à ouvrir', () => {
    const nfd = 'Activité 1 — Volcans (copie modèle)'.normalize('NFD');
    const cases = [nfd, 'Activité 1 — Volcans (adaptée)'.normalize('NFD'), 'Activité 1 — Volcans (corrigée)', 'Activité 1 — Volcans (correction) v2', 'Activité 1 — Volcans - correction', 'Activité 1 — Volcans (correction prof)', 'Activité 6 — Évaluation finale'];
    for (const title of cases) {
      const found = anchors([board('x', title, '4e', S1)]);
      expect(found.filter((i) => i.role === 'activity'), title).toEqual([]);
      expect(sequenceAnchors(found, S1), title).toEqual(['g']);
    }
  });

  it('la copie modèle écrite avec des accents décomposés reste la copie de sa fiche', () => {
    const found = anchors([board('f', 'Activité 1 — Volcans', '4e', S1), board('c', 'Activité 1 — Volcans (copie modèle)'.normalize('NFD'), '4e', S1)]);
    expect(found.find((i) => i.anchor === 'f')).toMatchObject({ copy: 'c', pages: [{ board: 'f' }] });
  });

  it('deux activités de même repère dans une séquence : aucun bilan, plutôt que le mauvais', () => {
    const found = anchors([board('s', 'Activité 2 — Séisme', '4e', S1), board('v', 'Activité 2 — Volcans', '4e', S1)]);
    expect(found.filter((i) => i.role === 'activity').map((i) => [i.anchor, i.summary])).toEqual([['s', undefined], ['v', undefined]]);
  });

  it('des documents sans fiche ne portent pas le bilan de l’activité', () => {
    const found = anchors([board('d', 'Activité 2 — Séisme (documents)', '4e', S1)]);
    expect(found.find((i) => i.anchor === 'd')).toMatchObject({ role: 'activity' });
    expect(found.find((i) => i.anchor === 'd')!.summary).toBeUndefined();
    expect(hasCorrection(found.find((i) => i.anchor === 'd')!)).toBe(false);
  });
});

describe('sequenceAnchors', () => {
  it('la page de garde et les activités, jamais la fiche de mémorisation ni l’évaluation', () => {
    expect(sequenceAnchors(items, S1)).toEqual(['garde1', 'a1', 'a2', 'a3']);
  });
});

describe('parseReleased', () => {
  it('refuse ce qui n’a pas la forme attendue', () => {
    expect(parseReleased({})).toBeNull();
    expect(parseReleased(null)).toBeNull();
    expect(parseReleased({ v: 2, role: 'activity', label: 'x', pages: [] })).toBeNull();
    expect(parseReleased({ v: 1, role: 'evaluation', label: 'x', pages: [] })).toBeNull();
    // Noms hérités de tout objet : ce ne sont pas des rôles
    for (const role of ['constructor', 'toString', '__proto__']) expect(parseReleased({ v: 1, role, label: 'x', pages: [{ board: 'b', role: 'activity', label: 'x' }] })).toBeNull();
  });

  it('écarte les pages d’un rôle que l’élément ne peut pas porter, et la correction d’une page seule', () => {
    const r = parseReleased({ v: 1, role: 'cover', chapter: S1, label: 'Page de garde', pages: [{ board: 'g', role: 'cover', label: 'Page de garde' }, { board: 'x', role: 'correction', label: 'x' }], correction: { copy: 'c' } });
    expect(r?.pages.map((p) => p.board)).toEqual(['g']);
    expect(r?.correction).toBeUndefined();
  });

  it('relit ce que releasedOf écrit, quel que soit l’ordre des clés', () => {
    const written = releasedOf(item('a2'), true);
    const shuffled = JSON.parse(JSON.stringify(written, Object.keys(written).sort().reverse().concat(['board', 'role', 'label', 'copy', 'summary', 'heading', 'paragraphs', 'text', 'underline'])));
    expect(parseReleased(shuffled)).toEqual(written);
  });
});

describe('staleRows', () => {
  it('rien à signaler quand les lignes disent ce que dit le classeur', () => {
    expect(staleRows(items, [row('a1', true, true), row('a2', true), row('garde1', true), row('a3', false)])).toEqual([]);
  });

  it('signale des documents ajoutés, une correction changée, un cours retiré du classeur', () => {
    const without = binderItems(buildBinder(library.filter((b) => b.id !== 'a2-docs' && b.id !== 'a1-copie'), '4e'), texts);
    const old = [
      rowFor(without.find((i) => i.anchor === 'a2')!, CLASS, { visible: true, correction: false }),
      rowFor(without.find((i) => i.anchor === 'a1')!, CLASS, { visible: true, correction: true }),
      { class_id: CLASS, anchor_board_id: 'supprime', visible: true, correction_visible: false, released: releasedOf({ ...item('a3'), anchor: 'supprime' }, false) },
    ];
    expect(staleRows(items, old).map((s) => [s.row.anchor_board_id, s.reason])).toEqual([['a2', 'pages'], ['a1', 'correction'], ['supprime', 'gone']]);
  });
});

describe('pageAccess', () => {
  const states = itemStates([row('a2', true), row('a1', true, true)]);
  const full: BinderPage[] = withSummaries(pages, texts, (p) => p.flatMap((r) => Array.from({ length: 8 }, () => r)));
  const access = (key: string) => pageAccess(full.find((p) => p.key === key)!, states);

  it('suit l’état de l’activité pour toutes ses pages', () => {
    expect(access('a2')).toBe('open');
    expect(access('a2-docs')).toBe('open');
    expect(access('a3')).toBe('closed');
    expect(access('memo1')).toBe('closed');
  });

  it('une évaluation ne peut pas s’ouvrir', () => {
    expect(access('eval')).toBe('locked');
    expect(access('eval-docs')).toBe('locked');
    expect(access('eval-corr')).toBe('locked');
  });

  it('la suite d’un bilan suit la correction ; un bilan sans fiche reste fermé', () => {
    const suite = (anchor: string) => full.find((p) => p.kind === 'ruled' && p.anchor === anchor)!;
    expect(pageAccess(suite('a1'), states)).toBe('open');
    expect(pageAccess(suite('a3'), states)).toBe('closed');
    expect(pageAccess(full.find((p) => p.kind === 'ruled' && !p.anchor)!, states)).toBe('locked');
  });
});
