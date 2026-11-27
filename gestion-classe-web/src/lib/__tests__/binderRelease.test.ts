import { describe, expect, it } from 'vitest';
import type { Board } from '../boardsQueries';
import { buildBinder, type BinderPage } from '../binder';
import {
  binderItems, bulkChanges, bulkState, bulkTargets, hasCorrection, itemStates, pageAccess, pagesFromReleased, parseReleased, releasedOf, rowFor, sequenceAnchors, servedEntries, staleAction, staleRows,
  type BinderItem, type BinderItemRow,
} from '../binderRelease';
import { withSummaries, type InkRun, type SummaryRuns } from '../binderSummary';

// Les cours ont de vrais identifiants (le serveur n'en accepte pas d'autres) ; les tests les nomment
const NAMES: string[] = [];
const ID = (name: string): string => {
  let i = NAMES.indexOf(name);
  if (i < 0) i = NAMES.push(name) - 1;
  return `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
};
const NAME = (id: string): string => NAMES[Number(id.slice(-12)) - 1] ?? id;

const board = (name: string, title: string, level: string | null, chapter: string | null, extra: Partial<Board> = {}): Board => ({
  id: ID(name), title, level, chapter, class_id: null, created_at: '2026-11-01T08:00:00Z', updated_at: '2026-11-01T08:00:00Z', ...extra,
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
const without = (...names: string[]) => library.filter((b) => !names.includes(NAME(b.id)));

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
const find = (list: BinderItem[], name: string): BinderItem => list.find((i) => i.anchor === ID(name))!;
const item = (name: string): BinderItem => find(items, name);
const CLASS = 'classe-4a';
const row = (name: string, visible: boolean, correction = false): BinderItemRow => rowFor(item(name), CLASS, { visible, correction });
const page = (name: string, role: string, label = 'x') => ({ board: ID(name), role, label });

/**
 * Ce que la classe reçoit, mis en page comme à l'écran : les cours (par leur nom de test) et tout le
 * texte écrit à la main. `lib` : la bibliothèque du jour (le serveur relit les titres pour refermer).
 */
function seen(rows: BinderItemRow[], lib: Board[] = library) {
  const byId = new Map(lib.map((b) => [b.id, b]));
  const released = pagesFromReleased(servedEntries(rows, lib), (id) => byId.get(id));
  const out = withSummaries(released.pages, released.texts, (p) => p.map((r) => r));
  const boards = out.flatMap((p) => (p.kind === 'sheet' ? [p.board.id, ...(p.companion ? [p.companion.id] : [])] : [])).map(NAME);
  const ink = JSON.stringify(out.map((p) => (p.kind === 'sheet' ? [p.summary, p.above] : p.kind === 'ruled' ? p.lines : null)));
  return { out, boards, ink };
}

describe('binderItems', () => {
  it('range les pages par activité, sur l’ancre de la fiche', () => {
    expect(item('a2').pages.map((p) => NAME(p.board))).toEqual(['a2', 'a2-proto', 'a2-docs']);
    expect(item('a2')).toMatchObject({ role: 'activity', chapter: S1, label: 'Activité 2', heading: 'Activité 2 — Séisme', copy: ID('a2-copie') });
    expect(item('a2').summary?.paragraphs).toEqual(runs('BILAN-A2'));
  });

  it('une page seule est son propre élément', () => {
    expect(items.filter((i) => i.role !== 'activity' && i.role !== 'evaluation').map((i) => [NAME(i.anchor), i.role])).toEqual([
      ['guide', 'guide'], ['garde1', 'cover'], ['garde5', 'cover'], ['fm1', 'method'], ['memo1', 'memo'],
    ]);
  });

  it('ni entraînement noté, ni correction d’activité, ni version adaptée, ni feuille de bilans', () => {
    const all = JSON.stringify(items);
    for (const name of ['entr', 'entr-corr', 'a1-corr', 'a2-adapt', 'bilans1']) expect(all, name).not.toContain(ID(name));
  });

  it('une évaluation est un élément à part : son sujet et ses documents, son corrigé pour la correction', () => {
    expect(item('eval')).toMatchObject({ role: 'evaluation', chapter: S1, label: 'Évaluation', heading: 'Évaluation — La Terre', correctionPage: { board: ID('eval-corr'), role: 'correction' } });
    expect(item('eval').pages.map((p) => NAME(p.board))).toEqual(['eval', 'eval-docs']);
    expect(item('eval').summary).toBeUndefined();
    expect(hasCorrection(item('eval'))).toBe(true);
    // Aucune page d'évaluation dans un autre élément
    const others = JSON.stringify(items.filter((i) => i.role !== 'evaluation'));
    for (const name of ['eval', 'eval-docs', 'eval-corr']) expect(others, name).not.toContain(ID(name));
  });

  it('dit si une activité a une correction pour des élèves', () => {
    expect(hasCorrection(item('a1'))).toBe(true);
    expect(hasCorrection(item('s5a1'))).toBe(false);
    expect(hasCorrection(item('garde1'))).toBe(false);
  });
});

describe('ce que la classe voit — rien ne sort sans avoir été ouvert', () => {
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

  it('une évaluation ouverte : son sujet et ses documents ; son corrigé seulement avec la correction', () => {
    expect(seen([row('eval', true)]).boards).toEqual(['eval', 'eval-docs']);
    expect(seen([row('eval', true, true)]).boards).toEqual(['eval', 'eval-docs', 'eval-corr']);
    // Une ligne incohérente (corrigé écrit, correction fermée) ne le sort pas
    const incoherent: BinderItemRow = { ...row('eval', true), released: releasedOf(item('eval'), true) };
    expect(seen([incoherent]).boards).toEqual(['eval', 'eval-docs']);
    // Le sujet récrit en autre chose referme toute l'évaluation
    const retitled = library.map((b) => (b.id === ID('eval') ? { ...b, title: 'Activité 9 — Révisions' } : b));
    expect(seen([row('eval', true, true)], retitled).boards).toEqual([]);
  });

  it('« toute la séquence » n’ouvre jamais une évaluation, même avec toutes les corrections', () => {
    const all = sequenceAnchors(items, S1).map((a) => rowFor(items.find((i) => i.anchor === a)!, CLASS, { visible: true, correction: true }));
    const { boards } = seen(all);
    for (const name of ['eval', 'eval-docs', 'eval-corr', 'memo1']) expect(boards).not.toContain(name);
  });

  it('une évaluation ne sort que par sa propre ligne, jamais glissée dans une activité', () => {
    const forged: BinderItemRow[] = [
      { class_id: CLASS, anchor_board_id: ID('eval'), visible: true, correction_visible: true, released: { v: 1, role: 'cover', chapter: S1, label: 'Évaluation', pages: [page('eval', 'cover')] } },
      { class_id: CLASS, anchor_board_id: ID('eval'), visible: true, correction_visible: true, released: { v: 1, role: 'activity', chapter: S1, label: 'Évaluation', pages: [page('eval', 'evaluation'), page('eval-corr', 'correction')] } },
      // Déguisée en activité : son titre du jour la referme
      { class_id: CLASS, anchor_board_id: ID('eval'), visible: true, correction_visible: true, released: { v: 1, role: 'activity', chapter: S1, label: 'x', pages: [page('eval', 'activity'), page('eval-docs', 'documents')] } },
      { class_id: CLASS, anchor_board_id: ID('a1'), visible: true, correction_visible: true, released: { v: 1, role: 'activity', chapter: S1, label: 'x', pages: [page('a1', 'activity'), page('eval', 'documents'), page('eval-corr', 'activity'), page('a1-corr', 'documents')], correction: { copy: ID('eval-corr') } } },
    ];
    for (const r of forged) {
      const { boards } = seen([r]);
      for (const name of ['eval', 'eval-docs', 'eval-corr', 'a1-corr']) expect(boards).not.toContain(name);
    }
    expect(seen([forged[3]]).boards).toEqual(['a1']);
    // Et une activité ne se glisse pas dans une évaluation
    const reverse: BinderItemRow = {
      class_id: CLASS, anchor_board_id: ID('eval'), visible: true, correction_visible: true,
      released: { v: 1, role: 'evaluation', chapter: S1, label: 'Évaluation', pages: [page('eval', 'evaluation'), page('a1', 'documents'), page('a1-corr', 'documents')], correction: { copy: ID('a1-copie'), page: page('a1-corr', 'correction') } },
    };
    expect(seen([reverse]).boards).toEqual(['eval']);
  });

  it('un cours ouvert puis récrit en correction ou en évaluation se referme tout seul', () => {
    const old = [row('a2', true), row('a1', true, true)];
    const retitle = (name: string, title: string) => library.map((b) => (b.id === ID(name) ? { ...b, title } : b));
    // La feuille de documents devient une correction
    const docs = retitle('a2-docs', 'Activité 2 — Séisme (correction)');
    expect(seen(old, docs).boards).toEqual(['a1', 'a1-copie', 'a2', 'a2-proto']);
    expect(staleRows(binderItems(buildBinder(docs, '4e'), texts), [old[0]]).map((s) => s.reason)).toEqual(['pages']);
    // La fiche elle-même devient la correction, ou une évaluation : toute l'activité se referme
    expect(seen(old, retitle('a2', 'Activité 2 — Séisme (correction)')).boards).toEqual(['a1', 'a1-copie']);
    expect(seen(old, retitle('a2', 'Évaluation — Les séismes')).boards).toEqual(['a1', 'a1-copie']);
    expect(seen(old, retitle('a2', 'Activité 2 — Séisme, corrigé du professeur')).boards).toEqual(['a1', 'a1-copie']);
    // La copie modèle devient le corrigé du professeur : elle ne s'écrit plus sur la fiche
    expect(seen(old, retitle('a1-copie', 'Activité 1 — Volcans (correction)')).boards).toEqual(['a1', 'a2', 'a2-proto', 'a2-docs']);
    // Un simple changement d'intitulé ne referme rien
    expect(seen(old, retitle('a2-docs', 'Activité 2 — Mesurer un séisme (documents)')).boards).toEqual(['a1', 'a1-copie', 'a2', 'a2-proto', 'a2-docs']);
  });

  it('une page d’un rôle que l’activité ne peut pas porter ne sort pas, même citée', () => {
    const forged: BinderItemRow = { ...row('a1', true), released: { ...releasedOf(item('a1'), false), pages: [page('a1', 'activity'), page('a1-corr', 'correction'), page('eval', 'evaluation')] } };
    expect(seen([forged]).boards).toEqual(['a1']);
  });

  it('un cours cité par deux lignes n’est collé qu’une fois, toujours au même endroit', () => {
    const twice: BinderItemRow = { ...row('a3', true), released: { ...releasedOf(item('a3'), false), pages: [page('a3', 'activity'), page('a2-docs', 'documents')] } };
    const one = seen([row('a2', true), twice]).boards;
    expect(one.filter((b) => b === 'a2-docs')).toHaveLength(1);
    expect(seen([twice, row('a2', true)]).boards).toEqual(one);
  });

  it('tout ouvert : les pages sont dans l’ordre du classeur du professeur', () => {
    const all = items.map((i) => rowFor(i, CLASS, { visible: true, correction: true }));
    const byId = new Map(library.map((b) => [b.id, b]));
    const teacher = pages.flatMap((p) => (p.kind === 'divider' ? [p.key] : p.kind === 'sheet' && p.anchor ? [p.key] : []));
    const student = pagesFromReleased(servedEntries(all.reverse(), library), (id) => byId.get(id)).pages.map((p) => p.key);
    expect(student).toEqual(teacher);
  });

  it('une ancre qui n’est pas une page de la ligne, ou pas un cours de la bibliothèque, n’ouvre rien', () => {
    for (const name of ['copie-emploi-du-temps', 'entr', 'a1-corr', 'bilans1']) {
      const forged: BinderItemRow = { class_id: CLASS, anchor_board_id: ID(name), visible: true, correction_visible: true, released: releasedOf({ ...item('a1'), anchor: ID(name) }, true) };
      expect(seen([forged]).boards, name).toEqual([]);
    }
    // Un cours qui n'est plus au professeur (supprimé, ou d'un autre) : rien
    expect(seen([row('a1', true, true)], without('a1')).boards).toEqual([]);
    expect(seen([row('a1', true, true)], without('a1-copie')).boards).toEqual(['a1']);
  });

  it('des documents ajoutés après l’ouverture restent fermés tant que la ligne n’est pas mise à jour', () => {
    const before = find(binderItems(buildBinder(without('a2-docs'), '4e'), texts), 'a2');
    const old = rowFor(before, CLASS, { visible: true, correction: false });
    expect(seen([old]).boards).toEqual(['a2', 'a2-proto']);
  });

  it('une copie modèle créée après l’ouverture de la correction ne s’ajoute pas seule', () => {
    const before = find(binderItems(buildBinder(without('a2-copie'), '4e'), texts), 'a2');
    const old = rowFor(before, CLASS, { visible: true, correction: true });
    expect(seen([old]).boards).not.toContain('a2-copie');
  });

  it('le bilan montré est celui qui a été copié à l’ouverture', () => {
    const old = row('a2', true, true);
    const edited = new Map(texts);
    edited.set(S1, new Map([...texts.get(S1)!, ['activite 2', { heading: 'Activité 2 — Séisme', paragraphs: runs('BILAN-RETOUCHE') }]]));
    // On ne relit pas les bilans d'aujourd'hui : seulement la ligne
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
      expect(sequenceAnchors(found, S1).map(NAME), title).toEqual(['g']);
    }
  });

  it('la copie modèle écrite avec des accents décomposés reste la copie de sa fiche', () => {
    const found = anchors([board('f', 'Activité 1 — Volcans', '4e', S1), board('c', 'Activité 1 — Volcans (copie modèle)'.normalize('NFD'), '4e', S1)]);
    expect(find(found, 'f')).toMatchObject({ copy: ID('c'), pages: [{ board: ID('f') }] });
  });

  it('deux activités de même repère dans une séquence : aucun bilan, plutôt que le mauvais', () => {
    const found = anchors([board('s', 'Activité 2 — Séisme', '4e', S1), board('v', 'Activité 2 — Volcans', '4e', S1)]);
    expect(found.filter((i) => i.role === 'activity').map((i) => [NAME(i.anchor), i.summary])).toEqual([['s', undefined], ['v', undefined]]);
  });

  it('des documents sans fiche ne portent pas le bilan de l’activité', () => {
    const found = anchors([board('d', 'Activité 2 — Séisme (documents)', '4e', S1)]);
    expect(find(found, 'd')).toMatchObject({ role: 'activity' });
    expect(find(found, 'd').summary).toBeUndefined();
    expect(hasCorrection(find(found, 'd'))).toBe(false);
  });
});

describe('sequenceAnchors', () => {
  it('la page de garde et les activités, jamais la fiche de mémorisation ni l’évaluation', () => {
    expect(sequenceAnchors(items, S1).map(NAME)).toEqual(['garde1', 'a1', 'a2', 'a3']);
  });
});

describe('cases « tout » de la grille', () => {
  // Le groupe d'une séquence dans la grille : tout ce qui porte la séquence, sauf la fiche de mémorisation
  const seq = items.filter((i) => i.chapter === S1 && i.role !== 'memo');
  const names = (changes: { item: BinderItem }[]) => changes.map((c) => NAME(c.item.anchor));

  it('« Tout » d’une séquence : la page de garde et les activités, jamais l’évaluation', () => {
    expect(seq.some((i) => i.role === 'evaluation')).toBe(true);
    expect(bulkTargets(seq, 'items').map((i) => NAME(i.anchor))).toEqual(sequenceAnchors(items, S1).map(NAME));
    expect(bulkTargets(seq, 'corrections').map((i) => NAME(i.anchor))).toEqual(['a1', 'a2', 'a3']);
  });

  it('cocher ouvre seulement ce qui est fermé, sans les corrections', () => {
    const states = itemStates([row('a1', true, true)]);
    const changes = bulkChanges(seq, states, 'items', true);
    expect(names(changes)).toEqual(['garde1', 'a2', 'a3']);
    expect(changes.every((c) => c.state.visible && !c.state.correction)).toBe(true);
    expect(bulkState(seq, states, 'items')).toBe('some');
  });

  it('décocher ferme tout, corrections comprises, et ne touche pas à l’évaluation', () => {
    const states = itemStates([row('garde1', true), row('a1', true, true), row('eval', true)]);
    const changes = bulkChanges(seq, states, 'items', false);
    expect(names(changes)).toEqual(['garde1', 'a1']);
    expect(changes.every((c) => !c.state.visible && !c.state.correction)).toBe(true);
  });

  it('« Corrections » cochée ouvre chaque correction avec son activité ; décochée, laisse les activités ouvertes', () => {
    const states = itemStates([row('a1', true)]);
    const open = bulkChanges(seq, states, 'corrections', true);
    expect(names(open)).toEqual(['a1', 'a2', 'a3']);
    expect(open.every((c) => c.state.visible && c.state.correction)).toBe(true);

    const all = itemStates(open.map((c) => rowFor(c.item, CLASS, c.state)));
    expect(bulkState(seq, all, 'corrections')).toBe('all');
    const close = bulkChanges(seq, all, 'corrections', false);
    expect(close.every((c) => c.state.visible && !c.state.correction)).toBe(true);
    expect(names(close)).toEqual(['a1', 'a2', 'a3']);
  });

  it('une correction ouverte se referme même si l’activité n’en a plus', () => {
    const bare = { ...item('a1'), copy: undefined, summary: undefined };
    const states = new Map([[bare.anchor, { visible: true, correction: true }]]);
    expect(bulkTargets([bare], 'corrections')).toEqual([]);
    expect(bulkChanges([bare], states, 'corrections', false)).toEqual([{ item: bare, state: { visible: true, correction: false } }]);
  });

  it('les fiches méthodes et « Je révise » se cochent d’un bloc', () => {
    const methods = items.filter((i) => i.role === 'method');
    expect(bulkState(methods, new Map(), 'items')).toBe('none');
    expect(names(bulkChanges(methods, new Map(), 'items', true))).toEqual(['fm1']);
    expect(bulkState(methods, itemStates([row('fm1', true)]), 'items')).toBe('all');
  });
});

describe('parseReleased', () => {
  it('refuse ce qui n’a pas la forme attendue', () => {
    expect(parseReleased({})).toBeNull();
    expect(parseReleased(null)).toBeNull();
    expect(parseReleased({ v: 2, role: 'activity', label: 'x', pages: [] })).toBeNull();
    expect(parseReleased({ v: 1, role: 'correction', label: 'x', pages: [] })).toBeNull();
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
    const before = binderItems(buildBinder(without('a2-docs', 'a1-copie'), '4e'), texts);
    const old = [
      rowFor(find(before, 'a2'), CLASS, { visible: true, correction: false }),
      rowFor(find(before, 'a1'), CLASS, { visible: true, correction: true }),
      { class_id: CLASS, anchor_board_id: ID('supprime'), visible: true, correction_visible: false, released: releasedOf({ ...item('a3'), anchor: ID('supprime') }, false) },
    ];
    expect(staleRows(items, old).map((s) => [NAME(s.row.anchor_board_id), s.reason])).toEqual([['a2', 'pages'], ['a1', 'correction'], ['supprime', 'gone']]);
  });
});

describe('staleAction — « Mettre à jour » n’ouvre jamais une évaluation à une seule classe', () => {
  it('une activité ouverte puis transformée en évaluation est refermée, pas récrite', () => {
    // « Activité 3 » ouverte à la classe avec sa correction, puis renommée en évaluation avec sa copie
    const before = [...without('a3'), board('a3', 'Activité 3 — Wegener', '4e', S1), board('a3-copie', 'Activité 3 — Wegener (copie modèle)', '4e', S1)];
    const old = rowFor(find(binderItems(buildBinder(before, '4e'), texts), 'a3'), CLASS, { visible: true, correction: true });
    expect(seen([old], before).boards).toEqual(['a3', 'a3-copie']);
    const after = before.map((b) => (b.id === ID('a3') ? { ...b, title: 'Évaluation — Wegener' } : b.id === ID('a3-copie') ? { ...b, title: 'Évaluation — Wegener (copie modèle)' } : b))
      .filter((b) => !['eval', 'eval-docs', 'eval-corr'].includes(NAME(b.id)));
    // Le serveur referme tout de suite la ligne d'activité
    expect(seen([old], after).boards).toEqual([]);
    const [stale] = staleRows(binderItems(buildBinder(after, '4e'), texts), [old]);
    expect(stale.item?.role).toBe('evaluation');
    expect(staleAction(stale)).toBe('close');
  });

  it('une évaluation ouverte et périmée se met à jour pour tout le niveau, pas ici', () => {
    const before = binderItems(buildBinder(without('eval-docs'), '4e'), texts);
    const old = rowFor(find(before, 'eval'), CLASS, { visible: true, correction: false });
    const [stale] = staleRows(items, [old]);
    expect(stale.reason).toBe('pages');
    expect(staleAction(stale)).toBe('level');
  });

  it('une activité périmée se récrit ; un cours sorti du classeur est retiré', () => {
    const before = binderItems(buildBinder(without('a2-docs'), '4e'), texts);
    const [docs] = staleRows(items, [rowFor(find(before, 'a2'), CLASS, { visible: true, correction: false })]);
    expect(staleAction(docs)).toBe('rewrite');
    const [gone] = staleRows(binderItems(buildBinder(without('a2', 'a2-docs', 'a2-proto', 'a2-copie', 'a2-adapt'), '4e'), texts), [row('a2', true)]);
    expect(staleAction(gone)).toBe('remove');
  });
});

describe('pageAccess', () => {
  const states = itemStates([row('a2', true), row('a1', true, true)]);
  const full: BinderPage[] = withSummaries(pages, texts, (p) => p.flatMap((r) => Array.from({ length: 8 }, () => r)));
  const access = (name: string) => pageAccess(full.find((p) => p.key === ID(name))!, states);

  it('suit l’état de l’activité pour toutes ses pages', () => {
    expect(access('a2')).toBe('open');
    expect(access('a2-docs')).toBe('open');
    expect(access('a3')).toBe('closed');
    expect(access('memo1')).toBe('closed');
  });

  it('une évaluation suit sa propre ligne, son corrigé suit sa correction', () => {
    expect(access('eval')).toBe('closed');
    expect(access('eval-docs')).toBe('closed');
    expect(access('eval-corr')).toBe('closed');
    const opened = itemStates([row('eval', true)]);
    const at = (name: string) => pageAccess(full.find((p) => p.key === ID(name))!, opened);
    expect([at('eval'), at('eval-docs'), at('eval-corr')]).toEqual(['open', 'open', 'closed']);
    expect(pageAccess(full.find((p) => p.key === ID('eval-corr'))!, itemStates([row('eval', true, true)]))).toBe('open');
  });

  it('une page sans ancre (entraînement noté, titre douteux) ne peut pas s’ouvrir', () => {
    const odd = buildBinder([...library, board('odd', 'Activité 7 — Volcans (correction) v2', '4e', S1)], '4e');
    expect(pageAccess(odd.find((p) => p.key === ID('odd'))!, states)).toBe('locked');
  });

  it('la suite d’un bilan suit la correction ; un bilan sans fiche reste fermé', () => {
    const suite = (name: string) => full.find((p) => p.kind === 'ruled' && p.anchor === ID(name))!;
    expect(pageAccess(suite('a1'), states)).toBe('open');
    expect(pageAccess(suite('a3'), states)).toBe('closed');
    expect(pageAccess(full.find((p) => p.kind === 'ruled' && !p.anchor)!, states)).toBe('locked');
  });
});
