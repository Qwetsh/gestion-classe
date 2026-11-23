/**
 * Classeur des élèves : ce que le serveur rend (supabase/functions/classeur-eleve/release.ts) et le
 * classeur que le navigateur de l'élève en tire. Les deux bouts sont joués ici comme en vrai, sans
 * réseau : lignes de la classe → serveur → navigateur de l'élève.
 */
import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { buildBinder, type BinderPage } from '../binder';
import { binderItems, pagesFromReleased, releasedOf, rowFor, servedEntries, type BinderItem, type BinderItemRow } from '../binderRelease';
import { withSummaries, type InkRun, type SummaryRuns } from '../binderSummary';
import { boardIds, closedByTitle, imagePaths, openItems, ownedItems, ownedPaths, publicDoc, type ItemRow } from '../../../../supabase/functions/classeur-eleve/release';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ID = {
  guide: uuid(1), garde1: uuid(2), a1: uuid(3), a1Copie: uuid(4), a1Corr: uuid(5), a2: uuid(6), a2Docs: uuid(7), a2Proto: uuid(8),
  a2Copie: uuid(9), a10: uuid(10), evalSujet: uuid(11), evalCorr: uuid(12), memo1: uuid(13), bilans1: uuid(14), garde2: uuid(15),
  s2a1: uuid(16), fm1: uuid(17), fm2: uuid(18), autreProf: uuid(99),
};
const board = (id: string, title: string, level: string | null, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id, title, level, chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
});

const S1 = 'Séquence 1 — La Terre, une planète active';
const S2 = 'Séquence 2 — Sous nos pieds';

const library: Board[] = [
  board(ID.guide, 'Mon classeur de SVT — mode d’emploi', null, null),
  board(ID.garde1, 'Page de garde — Séquence 1', '4e', S1),
  board(ID.a1, 'Activité 1 — Volcans', '4e', S1),
  board(ID.a1Copie, 'Activité 1 — Volcans (copie modèle)', '4e', S1),
  board(ID.a1Corr, 'Activité 1 — Volcans (correction)', '4e', S1),
  board(ID.a2, 'Activité 2 — Séisme', '4e', S1),
  board(ID.a2Docs, 'Activité 2 — Séisme (documents)', '4e', S1),
  board(ID.a2Proto, 'Activité 2 — Séisme (protocole)', '4e', S1),
  board(ID.a2Copie, 'Activité 2 — Séisme (copie modèle)', '4e', S1),
  board(ID.a10, 'Activité 10 — Bilan de la séquence', '4e', S1),
  board(ID.evalSujet, 'Évaluation — La Terre', '4e', S1),
  board(ID.evalCorr, 'Évaluation — La Terre (correction)', '4e', S1),
  board(ID.memo1, 'Fiche de mémorisation — Séquence 1', '4e', S1),
  board(ID.bilans1, 'Feuille de bilans — Séquence 1 (correction)', '4e', S1),
  board(ID.garde2, 'Page de garde — Séquence 2', '4e', S2),
  board(ID.s2a1, 'Activité 1 — Plaques', '4e', S2),
  board(ID.fm2, 'FM2 — Construire un tableau', null, null, { category: 'methode' }),
  board(ID.fm1, 'FM1 — Lire une consigne', null, null, { category: 'methode' }),
];
const byId = new Map(library.map((b) => [b.id, b]));

const runs = (text: string): InkRun[][] => [[{ text }]];
const texts = new Map<string, SummaryRuns>([
  [S1, new Map([
    ['activite 1', { heading: 'Activité 1 — Volcans', paragraphs: runs('BILAN-A1') }],
    ['activite 2', { heading: 'Activité 2 — Séisme', paragraphs: runs('BILAN-A2') }],
    ['activite 10', { heading: 'Activité 10 — Bilan de la séquence', paragraphs: runs('BILAN-A10') }],
  ])],
  [S2, new Map([['activite 1', { heading: 'Activité 1 — Plaques', paragraphs: runs('BILAN-S2A1') }]])],
]);

const pages = buildBinder(library, '4e');
const items = binderItems(pages, texts);
const item = (anchor: string): BinderItem => items.find((i) => i.anchor === anchor)!;
const row = (anchor: string, visible: boolean, correction = false): BinderItemRow => rowFor(item(anchor), 'classe', { visible, correction });

/** Ce que le serveur rend pour ces lignes : la base range les JSON à sa façon, d'où l'aller-retour. */
function served(rows: BinderItemRow[], owned: string[] = library.map((b) => b.id)) {
  const fromDb = JSON.parse(JSON.stringify(rows)) as ItemRow[];
  const kept = ownedItems(openItems(fromDb.filter((r) => r.visible)), new Map(owned.map((id) => [id, byId.get(id)?.title ?? ''])));
  return { items: kept, ids: boardIds(kept) };
}

/** Pages mises en page (bilans compris), réduites à ce qui se voit. */
const shape = (list: BinderPage[], t: Map<string, SummaryRuns>) => withSummaries(list, t, (p) => p.map((r) => r)).map((p) => (
  p.kind === 'divider' ? `— ${p.section}`
    : p.kind === 'ruled' ? `lignes ${p.label} ${JSON.stringify(p.lines)}`
    : `${p.board.id.slice(-2)} ${p.role} [${p.label}] ${p.chapter ?? ''} ${p.heading ?? ''} copie=${p.companion?.id.slice(-2) ?? '-'} bilan=${JSON.stringify(p.summary ?? null)}${JSON.stringify(p.above ?? null)}`
));

describe('le classeur de l’élève est celui de l’aperçu du professeur', () => {
  const cases: Record<string, BinderItemRow[]> = {
    'rien d’ouvert': [],
    'une activité': [row(ID.a2, true)],
    'activité et correction': [row(ID.a2, true, true), row(ID.a1, true)],
    'toute une séquence, dans le désordre': [row(ID.a10, true), row(ID.a2, true, true), row(ID.garde1, true), row(ID.a1, true, true)],
    'deux séquences, méthodes, mémo, mode d’emploi': [
      row(ID.s2a1, true, true), row(ID.fm2, true), row(ID.memo1, true), row(ID.garde2, true), row(ID.a1, true), row(ID.fm1, true), row(ID.guide, true), row(ID.garde1, true),
    ],
    'lignes fermées mêlées': [row(ID.a1, false), row(ID.a2, true), row(ID.memo1, false)],
    'une évaluation et son corrigé': [row(ID.evalSujet, true, true), row(ID.a1, true), row(ID.garde1, true)],
    'une évaluation sans son corrigé': [row(ID.evalSujet, true)],
  };
  for (const [name, rows] of Object.entries(cases)) {
    it(name, () => {
      const teacher = pagesFromReleased(servedEntries(rows, library), (id) => byId.get(id));
      const { items: open } = served(rows);
      const student = pagesFromReleased(open, (id) => byId.get(id));
      expect(shape(student.pages, student.texts)).toEqual(shape(teacher.pages, teacher.texts));
    });
  }
});

describe('openItems — le serveur ne rend que ce qui est ouvert', () => {
  it('une ligne fermée ou mal formée ne rend rien', () => {
    expect(openItems([{ anchor_board_id: ID.a1, visible: false, correction_visible: false, released: releasedOf(item(ID.a1), false) }])).toEqual([]);
    expect(openItems([{ anchor_board_id: ID.a1, visible: true, correction_visible: false, released: {} }])).toEqual([]);
    expect(openItems([{ anchor_board_id: ID.a1, visible: true, correction_visible: false, released: null }])).toEqual([]);
    expect(openItems([{ anchor_board_id: 'pas-un-identifiant', visible: true, correction_visible: false, released: releasedOf(item(ID.a1), false) }])).toEqual([]);
  });

  it('la correction écrite dans la ligne ne sort pas si elle n’est pas ouverte', () => {
    // Ligne incohérente : released porte la correction alors que correction_visible est faux
    const forged: ItemRow = { anchor_board_id: ID.a2, visible: true, correction_visible: false, released: releasedOf(item(ID.a2), true) };
    const [open] = openItems([forged]);
    expect(open.correction).toBe(false);
    expect(open.released.correction).toBeUndefined();
    expect(boardIds([open])).not.toContain(ID.a2Copie);
    expect(JSON.stringify(open)).not.toContain('BILAN');
  });

  it('la correction ouverte sort : la copie modèle et le bilan de cette activité', () => {
    const { items: open, ids } = served([row(ID.a2, true, true)]);
    expect(open[0].released.correction).toEqual({ copy: ID.a2Copie, summary: { heading: 'Activité 2 — Séisme', paragraphs: runs('BILAN-A2') } });
    expect(ids.sort()).toEqual([ID.a2, ID.a2Copie, ID.a2Docs, ID.a2Proto].sort());
  });

  it('une évaluation ne sort pas, quelle que soit la ligne', () => {
    const page = { board: ID.evalSujet, role: 'evaluation', label: 'Évaluation' };
    const corr = { board: ID.evalCorr, role: 'correction', label: 'Évaluation — correction' };
    const forged: ItemRow[] = [
      { anchor_board_id: ID.evalSujet, visible: true, correction_visible: true, released: { v: 1, role: 'correction', chapter: S1, label: 'Évaluation', pages: [page, corr] } },
      { anchor_board_id: ID.evalSujet, visible: true, correction_visible: true, released: { v: 1, role: 'activity', chapter: S1, label: 'Évaluation', pages: [page, corr] } },
      { anchor_board_id: ID.a1, visible: true, correction_visible: true, released: { v: 1, role: 'activity', chapter: S1, label: 'Activité 1', pages: [{ board: ID.a1, role: 'activity', label: 'Activité 1' }, page, corr] } },
      { anchor_board_id: ID.evalSujet, visible: true, correction_visible: true, released: { v: 1, role: 'constructor', chapter: S1, label: 'x', pages: [page] } },
      { anchor_board_id: ID.evalSujet, visible: true, correction_visible: true, released: { v: 1, role: '__proto__', chapter: S1, label: 'x', pages: [page] } },
    ];
    for (const r of forged) {
      // Comme le serveur : lecture de la ligne, puis propriété et titres du jour
      const ids = boardIds(ownedItems(openItems([r]), new Map(library.map((b) => [b.id, b.title]))));
      expect(ids).not.toContain(ID.evalSujet);
      expect(ids).not.toContain(ID.evalCorr);
    }
  });

  it('une évaluation sort par sa propre ligne : le sujet, puis le corrigé si la correction est ouverte', () => {
    const sujet = { board: ID.evalSujet, role: 'evaluation', label: 'Évaluation' };
    const released = { v: 1, role: 'evaluation', chapter: S1, label: 'Évaluation', pages: [sujet], correction: { page: { board: ID.evalCorr, role: 'correction', label: 'Évaluation — correction' } } };
    const line = (correction_visible: boolean): BinderItemRow => ({ class_id: 'classe', anchor_board_id: ID.evalSujet, visible: true, correction_visible, released });
    expect(served([line(false)]).ids).toEqual([ID.evalSujet]);
    expect(served([line(true)]).ids).toEqual([ID.evalSujet, ID.evalCorr]);
    // Le corrigé d'une activité ne passe pas pour celui d'une évaluation
    const wrong = { ...line(true), released: { ...released, correction: { page: { board: ID.a1Corr, role: 'correction', label: 'x' } } } };
    expect(served([wrong]).ids).toEqual([ID.evalSujet]);
  });

  it('une page seule n’a jamais de correction', () => {
    const forged: ItemRow = { anchor_board_id: ID.garde1, visible: true, correction_visible: true, released: { ...releasedOf(item(ID.garde1), false), correction: { copy: ID.a1Copie, summary: { heading: 'x', paragraphs: runs('BILAN-A1') } } } };
    const [open] = openItems([forged]);
    expect(open.released.correction).toBeUndefined();
    expect(boardIds([open])).toEqual([ID.garde1]);
  });

  it('deux lignes pour la même ancre : une seule compte', () => {
    expect(openItems([row(ID.a1, true), row(ID.a1, true, true)] as ItemRow[])).toHaveLength(1);
  });
});

describe('closedByTitle — le titre du jour ne fait que refermer', () => {
  it('une page ouverte ne peut pas s’appeler correction, copie modèle, version adaptée, extraits ou évaluation', () => {
    for (const title of ['Activité 2 — Séisme', 'Activité 2 — Séisme (documents)', 'Activité 2 — Séisme (protocole)', 'Activité 10 — Bilan de la séquence', 'Activité bonus — Modéliser']) {
      expect(closedByTitle(title, 'page'), title).toBe(false);
    }
    for (const title of ['Activité 2 — Séisme (correction)', 'Activité 2 — Séisme (corrigé)', 'Activité 2 — Séisme (copie modèle)', 'Activité 2 — Séisme (adaptée)', 'Activité 2 — Séisme (extraits)', 'Évaluation — La Terre', 'Évaluation — La Terre (documents)', 'Activité 2 — Séisme - correction', 'Activité 2 — Séisme (correction) v2', 'Activité 6 — Évaluation finale', 'Activité 2 — Séisme (copie modèle)'.normalize('NFD')]) {
      expect(closedByTitle(title, 'page'), title).toBe(true);
    }
  });

  it('dans une évaluation, tout doit s’appeler « Évaluation … », et le corrigé « (correction) »', () => {
    expect(closedByTitle('Évaluation — La Terre', 'page', 'evaluation')).toBe(false);
    expect(closedByTitle('Évaluation — La Terre (documents)', 'page', 'evaluation')).toBe(false);
    expect(closedByTitle('Évaluation — La Terre (correction)', 'correction', 'evaluation')).toBe(false);
    expect(closedByTitle('Évaluation — La Terre (copie modèle)', 'copy', 'evaluation')).toBe(false);
    for (const [title, kind] of [
      ['Activité 2 — Séisme', 'page'], ['Évaluation — La Terre (correction)', 'page'], ['Évaluation — La Terre', 'correction'],
      ['Activité 2 — Séisme (correction)', 'correction'], ['Évaluation — La Terre, corrigé', 'page'], ['Évaluation — La Terre (documents)', 'copy'],
    ] as const) expect(closedByTitle(title, kind, 'evaluation'), `${title} / ${kind}`).toBe(true);
    // Et le corrigé d'une évaluation ne sort jamais d'une activité
    expect(closedByTitle('Évaluation — La Terre (correction)', 'correction', 'activity')).toBe(true);
  });

  it('une copie modèle doit toujours s’appeler ainsi', () => {
    expect(closedByTitle('Activité 2 — Séisme (copie modèle)', 'copy')).toBe(false);
    expect(closedByTitle('Activité 2 — Séisme (copie modèle)'.normalize('NFD'), 'copy')).toBe(false);
    for (const title of ['Activité 2 — Séisme (correction)', 'Activité 2 — Séisme', 'Évaluation — La Terre (copie modèle)']) expect(closedByTitle(title, 'copy'), title).toBe(true);
  });

  it('un cours renommé hors du classeur ne reste pas servi comme activité', () => {
    for (const title of ['Entraînement noté — Lire un graphique', 'Contrôle — Lire un graphique', 'Éval — Lire un graphique', 'DS n°2', 'Lire un graphique']) {
      expect(closedByTitle(title, 'page'), title).toBe(true);
      expect(closedByTitle(`${title} (copie modèle)`, 'copy'), title).toBe(true);
    }
  });

  it('une page seule garde son nom ; le reste de son titre est libre', () => {
    expect(closedByTitle('Page de garde — Séquence 1', 'page', 'cover')).toBe(false);
    expect(closedByTitle('Fiche de mémorisation — Séquence 1', 'page', 'memo')).toBe(false);
    expect(closedByTitle('Mon classeur de SVT — mode d’emploi', 'page', 'guide')).toBe(false);
    // Une fiche méthode peut parler de correction ou d'évaluation
    for (const title of ['FM1 — Lire une consigne', 'FM5 — Préparer une évaluation', 'FM4 — Corriger sa copie']) expect(closedByTitle(title, 'page', 'method'), title).toBe(false);
    expect(closedByTitle('Page de garde — Séquence 1 : préparer l’évaluation', 'page', 'cover')).toBe(false);
    // Renommée, ou citée pour ce qu'elle n'est pas
    expect(closedByTitle('Activité 1 — Volcans (correction)', 'page', 'cover')).toBe(true);
    expect(closedByTitle('Page de garde — Séquence 1 (correction)', 'page', 'cover')).toBe(true);
    expect(closedByTitle('Évaluation — La Terre', 'page', 'memo')).toBe(true);
    expect(closedByTitle('Page de garde — Séquence 1', 'copy', 'cover')).toBe(true);
    expect(closedByTitle('FM1 — Lire une consigne', 'copy', 'method')).toBe(true);
  });

  it('le classeur du professeur ne propose d’ouvrir que ce que le serveur sert, et tout ce qu’il sert', () => {
    // Une seule règle des titres (release.ts), lue par binder.ts : ce contrôle garde les deux bouts accordés
    const titleOf = (id: string) => byId.get(id)!.title;
    const cited = new Set<string>();
    for (const it of items) {
      for (const p of it.pages) { cited.add(p.board); expect(closedByTitle(titleOf(p.board), 'page', it.role), titleOf(p.board)).toBe(false); }
      if (it.copy) { cited.add(it.copy); expect(closedByTitle(titleOf(it.copy), 'copy', it.role), titleOf(it.copy)).toBe(false); }
      if (it.correctionPage) { cited.add(it.correctionPage.board); expect(closedByTitle(titleOf(it.correctionPage.board), 'correction', it.role)).toBe(false); }
    }
    // Ce que le classeur n'ouvre pas (corrigé d'activité, feuille de bilans) ne passe sous aucun rôle de page
    for (const b of library.filter((x) => !cited.has(x.id))) {
      for (const role of ['activity', 'evaluation', 'cover', 'memo', 'guide']) expect(closedByTitle(b.title, 'page', role), `${b.title} / ${role}`).toBe(true);
    }
  });
});

describe('ownedItems — rien d’un autre professeur', () => {
  const titles = new Map(library.map((b) => [b.id, b.title]));

  it('une page ou une copie modèle qui n’est pas au professeur de la classe est retirée', () => {
    const forged: ItemRow = {
      anchor_board_id: ID.a1, visible: true, correction_visible: true,
      released: { v: 1, role: 'activity', chapter: S1, label: 'Activité 1', pages: [{ board: ID.a1, role: 'activity', label: 'Activité 1' }, { board: ID.autreProf, role: 'documents', label: 'x' }], correction: { copy: ID.autreProf } },
    };
    const kept = ownedItems(openItems([forged]), titles);
    expect(boardIds(kept)).toEqual([ID.a1]);
    expect(kept[0].released.correction).toBeUndefined();
  });

  it('une ancre qui n’est pas au professeur de la classe ne rend rien', () => {
    const forged: ItemRow = { anchor_board_id: ID.autreProf, visible: true, correction_visible: false, released: { v: 1, role: 'cover', chapter: S1, label: 'x', pages: [{ board: ID.autreProf, role: 'cover', label: 'x' }] } };
    expect(ownedItems(openItems([forged]), titles)).toEqual([]);
  });

  it('la copie retirée laisse le bilan, qui est du texte écrit par le professeur', () => {
    const kept = served([row(ID.a2, true, true)], library.map((b) => b.id).filter((id) => id !== ID.a2Copie)).items;
    expect(kept[0].released.correction).toEqual({ summary: { heading: 'Activité 2 — Séisme', paragraphs: runs('BILAN-A2') } });
  });
});

describe('publicDoc — d’un cours, seulement le texte et sa mise en page', () => {
  const content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Consigne' }] }, { type: 'image', attrs: { path: 'prof/import/a.jpg' } }] };

  it('écrans, liens, annotations et numéro d’enregistrement restent sur le serveur', () => {
    const doc = publicDoc({ version: 1, content, settings: { fontSize: 12 }, screens: ['ecran-correction'], links: [{ url: 'https://exemple.fr' }], layer: { items: [{ text: 'REPONSE' }] }, rev: 'abc' });
    expect(doc).toEqual({ version: 1, content, settings: { fontSize: 12 } });
    expect(JSON.stringify(doc)).not.toMatch(/ecran-correction|exemple\.fr|REPONSE|abc/);
  });

  it('un cours qui porte un encart, ou qui n’est pas un cours rédigé, ne sort pas', () => {
    expect(publicDoc({ version: 1, content: { type: 'doc', content: [{ type: 'table', content: [{ type: 'encart', attrs: { pageId: 'p' } }] }] } })).toBeNull();
    expect(publicDoc(null)).toBeNull();
    expect(publicDoc({ content })).toBeNull();
    expect(publicDoc({ version: 1 })).toBeNull();
  });

  it('un cours trop profond pour être relu en entier ne sort pas (un encart pourrait s’y cacher)', () => {
    const nest = (depth: number, leaf: unknown): unknown => (depth === 0 ? leaf : { type: 'x', content: [nest(depth - 1, leaf)] });
    expect(publicDoc({ version: 1, content: nest(40, { type: 'paragraph' }) })).not.toBeNull();
    expect(publicDoc({ version: 1, content: nest(80, { type: 'encart' }) })).toBeNull();
    expect(publicDoc({ version: 1, content: nest(80, { type: 'paragraph' }) })).toBeNull();
  });

  it('les images ne sont signées que sous le dossier du professeur', () => {
    const deep = { type: 'doc', content: [{ type: 'table', content: [{ type: 'image', attrs: { path: 'prof/import/a.jpg' } }, { type: 'image', attrs: { path: 'autre/import/b.jpg' } }, { type: 'image', attrs: { src: 'https://exemple.fr/c.png' } }] }] };
    expect(imagePaths(deep)).toEqual(['prof/import/a.jpg', 'autre/import/b.jpg']);
    expect(ownedPaths(['prof/import/a.jpg', 'autre/import/b.jpg', 'prof/../autre/c.jpg', 'profx/d.jpg', 'prof//e.jpg', 'prof\\f.jpg'], 'prof')).toEqual(['prof/import/a.jpg']);
  });
});
