/**
 * Classeur ouvert aux classes (PLAN_classeur_eleves.md, lot 1) : ce qu'une classe voit du classeur.
 * Fonctions pures, sans accès à la base.
 *
 * Fermé par défaut : une classe ne voit que ce que le professeur a ouvert, élément par élément. Un
 * élément est une activité (sa fiche, ses documents et son protocole s'ouvrent ensemble) ou une
 * page seule (page de garde, fiche de mémorisation, fiche méthode, mode d'emploi). La correction
 * d'une activité (sa copie modèle et son bilan) s'ouvre à part.
 *
 * La règle qui assemble le classeur (lib/binder.ts, par les titres) ne tourne que dans le
 * navigateur du professeur. Au moment d'ouvrir, il écrit dans la ligne (`released`) la liste exacte
 * de ce qui sort : les identifiants des cours et le texte du bilan. Tout ce qui décide ensuite de
 * ce que voit un élève part de cette liste, jamais d'un titre : un cours créé plus tard et nommé
 * « … (correction) » ne s'ouvre pas tout seul.
 */
import type { BinderPage, SheetRole } from './binder';
import type { Board } from './boardsQueries';
import { naturalCompare } from './courseLibrary';
import { openItems, ownedItems } from '../../../supabase/functions/classeur-eleve/release';
import { activityKeyOf } from './binderInk';
import type { InkRun, Summary, SummaryRuns } from './binderSummary';

/** Ce qui peut s'ouvrir à une classe. Liste fermée : une évaluation n'y est pas. */
export type ItemRole = 'activity' | 'cover' | 'memo' | 'method' | 'guide';

/** Pages qu'un élément peut porter, selon son rôle. Toute autre page reste fermée. */
const PAGE_ROLES: Record<ItemRole, SheetRole[]> = {
  activity: ['activity', 'documents'],
  cover: ['cover'],
  memo: ['memo'],
  method: ['method'],
  guide: ['guide'],
};

const ITEM_ROLE: Partial<Record<SheetRole, ItemRole>> = {
  activity: 'activity', documents: 'activity', cover: 'cover', memo: 'memo', method: 'method', guide: 'guide',
};

export interface ReleasedPage {
  /** Identifiant du cours collé sur la page. */
  board: string;
  role: SheetRole;
  /** Intitulé du sommaire (« Activité 2 — documents »). */
  label: string;
}

/** Un élément du classeur, tel qu'il est aujourd'hui dans la bibliothèque. */
export interface BinderItem {
  /** Cours d'ancrage : la fiche de l'activité, ou la page seule. */
  anchor: string;
  role: ItemRole;
  chapter: string | null;
  /** « Activité 2 », « Page de garde », « FM3 ». */
  label: string;
  /** Titre écrit à la main en haut de la fiche (« Activité 2 — L'importance d'un séisme »). */
  heading?: string;
  pages: ReleasedPage[];
  /** Copie modèle : les réponses écrites sur la fiche quand la correction est ouverte. */
  copy?: string;
  /** Bilan de l'activité, écrit sous la fiche quand la correction est ouverte. */
  summary?: Summary;
}

/** Ce qui sort pour une classe, écrit dans la ligne au moment d'ouvrir (`released`, version 1). */
export interface Released {
  v: 1;
  role: ItemRole;
  chapter: string | null;
  label: string;
  heading?: string;
  pages: ReleasedPage[];
  /** Présent seulement si la correction est ouverte. */
  correction?: { copy?: string; summary?: Summary };
}

/** Une ligne de `class_binder_items`. */
export interface BinderItemRow {
  id?: string;
  class_id: string;
  anchor_board_id: string;
  visible: boolean;
  correction_visible: boolean;
  released: unknown;
}

export interface ItemState {
  visible: boolean;
  correction: boolean;
}

const CLOSED: ItemState = { visible: false, correction: false };

// ---------------------------------------------------------------------------------------------
// Les éléments du classeur d'aujourd'hui
// ---------------------------------------------------------------------------------------------

/**
 * Éléments qu'on peut ouvrir à une classe, dans l'ordre du classeur. `pages` : le classeur complet
 * du professeur, sans ses bilans (buildBinder) ; `texts` : les bilans par séquence puis activité.
 * Une page sans ancre (évaluation) ou d'un rôle hors liste n'entre dans aucun élément.
 */
export function binderItems(pages: BinderPage[], texts: Map<string, SummaryRuns> = new Map()): BinderItem[] {
  const items = new Map<string, BinderItem>();
  for (const page of pages) {
    if (page.kind !== 'sheet' || !page.anchor) continue;
    const role = ITEM_ROLE[page.role];
    if (!role) continue;
    let item = items.get(page.anchor);
    if (!item) {
      item = { anchor: page.anchor, role, chapter: page.chapter, label: page.label, pages: [] };
      items.set(page.anchor, item);
    }
    if (item.role !== role || !PAGE_ROLES[role].includes(page.role)) continue;
    item.pages.push({ board: page.board.id, role: page.role, label: page.label });
    if (page.board.id === page.anchor) item.label = page.label;
    if (page.role === 'activity') {
      if (page.heading) item.heading = page.heading;
      if (page.companion) item.copy = page.companion.id;
    }
  }
  // Le bilan est rangé par séquence et par repère (« activite 2 ») : il ne va qu'à une activité qui a
  // sa fiche, et à aucune si deux activités de la séquence portent le même repère
  const keyOf = (item: BinderItem) => (item.role === 'activity' && item.chapter && item.pages.some((p) => p.role === 'activity') ? activityKeyOf(item.heading ?? item.label) : null);
  const uses = new Map<string, number>();
  for (const item of items.values()) {
    const key = keyOf(item);
    if (key) uses.set(`${item.chapter}|${key}`, (uses.get(`${item.chapter}|${key}`) ?? 0) + 1);
  }
  for (const item of items.values()) {
    const key = keyOf(item);
    if (!key || !item.chapter || uses.get(`${item.chapter}|${key}`) !== 1) continue;
    const summary = texts.get(item.chapter)?.get(key);
    if (summary && summary.paragraphs.length > 0) item.summary = summary;
  }
  return [...items.values()];
}

/** L'activité a-t-elle une correction à montrer à des élèves (copie modèle ou bilan) ? */
export const hasCorrection = (item: BinderItem): boolean => item.role === 'activity' && !!(item.copy || item.summary);

/** Ce qu'on écrit dans la ligne quand on ouvre l'élément ; la correction n'y est que si elle est ouverte. */
export function releasedOf(item: BinderItem, correction: boolean): Released {
  const out: Released = { v: 1, role: item.role, chapter: item.chapter, label: item.label, pages: item.pages.map((p) => ({ ...p })) };
  if (item.heading) out.heading = item.heading;
  if (correction && hasCorrection(item)) {
    out.correction = {};
    if (item.copy) out.correction.copy = item.copy;
    if (item.summary) out.correction.summary = { heading: item.summary.heading, paragraphs: item.summary.paragraphs.map((p) => p.map((r) => ({ ...r }))) };
  }
  return out;
}

/** Ligne à enregistrer pour un élément dans l'état voulu. Une correction ne s'ouvre pas sur une activité fermée. */
export function rowFor(item: BinderItem, classId: string, state: ItemState): BinderItemRow {
  const visible = state.visible;
  const correction = visible && state.correction && hasCorrection(item);
  return { class_id: classId, anchor_board_id: item.anchor, visible, correction_visible: correction, released: visible ? releasedOf(item, correction) : {} };
}

/**
 * « Toute la séquence » : sa page de garde et ses activités. Jamais une correction, ni la fiche de
 * mémorisation (elle contient toutes les réponses de la séquence), ni une évaluation.
 */
export function sequenceAnchors(items: BinderItem[], chapter: string): string[] {
  return items.filter((i) => i.chapter === chapter && (i.role === 'cover' || i.role === 'activity')).map((i) => i.anchor);
}

// ---------------------------------------------------------------------------------------------
// Lecture des lignes
// ---------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const SHEET_ROLES: SheetRole[] = ['guide', 'cover', 'activity', 'documents', 'evaluation', 'correction', 'method', 'summaries', 'memo'];

function parseRuns(value: unknown): InkRun[][] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p) => {
    if (!Array.isArray(p)) return [];
    const runs = p.flatMap((r): InkRun[] => (isRecord(r) && typeof r.text === 'string' ? [r.underline === true ? { text: r.text, underline: true } : { text: r.text }] : []));
    return runs.length > 0 ? [runs] : [];
  });
}

/** `released` relu depuis la base : null si la valeur n'est pas de la forme attendue (rien ne sort). */
export function parseReleased(value: unknown): Released | null {
  if (!isRecord(value) || value.v !== 1) return null;
  const role = value.role as ItemRole;
  if (typeof role !== 'string' || !Object.prototype.hasOwnProperty.call(PAGE_ROLES, role) || typeof value.label !== 'string' || !Array.isArray(value.pages)) return null;
  const pages = value.pages.flatMap((p): ReleasedPage[] => (
    isRecord(p) && typeof p.board === 'string' && typeof p.label === 'string' && SHEET_ROLES.includes(p.role as SheetRole) && PAGE_ROLES[role].includes(p.role as SheetRole)
      ? [{ board: p.board, role: p.role as SheetRole, label: p.label }]
      : []
  ));
  const out: Released = { v: 1, role, chapter: typeof value.chapter === 'string' ? value.chapter : null, label: value.label, pages };
  if (typeof value.heading === 'string') out.heading = value.heading;
  if (role === 'activity' && isRecord(value.correction)) {
    out.correction = {};
    if (typeof value.correction.copy === 'string') out.correction.copy = value.correction.copy;
    const s = value.correction.summary;
    if (isRecord(s) && typeof s.heading === 'string') {
      const paragraphs = parseRuns(s.paragraphs);
      if (paragraphs.length > 0) out.correction.summary = { heading: s.heading, paragraphs };
    }
  }
  return out;
}

/** État de chaque élément pour la classe, par cours d'ancrage. */
export function itemStates(rows: BinderItemRow[]): Map<string, ItemState> {
  const out = new Map<string, ItemState>();
  for (const r of rows) out.set(r.anchor_board_id, { visible: r.visible, correction: r.visible && r.correction_visible });
  return out;
}

export const stateOf = (states: Map<string, ItemState>, anchor: string | undefined): ItemState => (anchor ? states.get(anchor) ?? CLOSED : CLOSED);

// ---------------------------------------------------------------------------------------------
// Ce que la classe voit
// ---------------------------------------------------------------------------------------------

/**
 * Ce que le serveur rendrait pour ces lignes, calculé avec son propre code (release.ts) : il suit
 * les identifiants écrits dans la ligne, resserre aux cours du professeur (`boards` : sa
 * bibliothèque) et referme un cours devenu correction ou évaluation d'après son titre du jour.
 * L'aperçu du professeur part de là, pour montrer ce qui sort vraiment.
 */
export function servedEntries(rows: BinderItemRow[], boards: Pick<Board, 'id' | 'title'>[]): OpenEntry[] {
  return ownedItems(openItems(rows.filter((r) => r.visible)), new Map(boards.map((b) => [b.id, b.title])));
}

// ---------------------------------------------------------------------------------------------
// Vue de réglage : l'état de chaque page du classeur complet
// ---------------------------------------------------------------------------------------------

/** `open` : la classe la voit ; `closed` : pas encore ; `locked` : ne peut pas s'ouvrir (évaluation). */
export type PageAccess = 'open' | 'closed' | 'locked';

export function pageAccess(page: BinderPage, states: Map<string, ItemState>): PageAccess {
  if (page.kind === 'divider') return 'open';
  if (page.kind === 'ruled') {
    // Suite d'un bilan : elle suit la correction de son activité ; un bilan sans fiche ne s'ouvre pas
    if (!page.anchor) return 'locked';
    return stateOf(states, page.anchor).correction ? 'open' : 'closed';
  }
  if (!page.anchor || !ITEM_ROLE[page.role]) return 'locked';
  return stateOf(states, page.anchor).visible ? 'open' : 'closed';
}

// ---------------------------------------------------------------------------------------------
// Mise à jour : ce qui est écrit ne correspond plus au classeur d'aujourd'hui
// ---------------------------------------------------------------------------------------------

/** Écriture canonique (clés triées) : la base range les clés d'un JSON dans son ordre à elle. */
function canon(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * `gone` : le cours d'ancrage n'est plus dans le classeur ; `pages` : les pages de l'élément ont
 * changé (documents ajoutés, titre) ; `correction` : la copie modèle ou le bilan ont changé.
 */
export type StaleReason = 'gone' | 'pages' | 'correction';

export interface StaleRow {
  row: BinderItemRow;
  reason: StaleReason;
  /** L'élément d'aujourd'hui ; absent si le cours n'est plus dans le classeur. */
  item?: BinderItem;
  label: string;
}

/**
 * Lignes ouvertes dont le contenu écrit ne correspond plus au classeur d'aujourd'hui. Rien n'est
 * corrigé tout seul : le professeur valide la mise à jour (une correction ne s'ajoute jamais seule).
 */
export function staleRows(items: BinderItem[], rows: BinderItemRow[]): StaleRow[] {
  const byAnchor = new Map(items.map((i) => [i.anchor, i]));
  const out: StaleRow[] = [];
  for (const row of rows) {
    if (!row.visible) continue;
    const written = parseReleased(row.released);
    const item = byAnchor.get(row.anchor_board_id);
    if (!item) { out.push({ row, reason: 'gone', label: written?.label ?? 'Page retirée' }); continue; }
    const now = releasedOf(item, row.correction_visible);
    if (written && canon(written) === canon(now)) continue;
    const { correction: a, ...restA } = written ?? ({} as Partial<Released>);
    const { correction: b, ...restB } = now;
    out.push({ row, item, label: item.label, reason: canon(restA) !== canon(restB) ? 'pages' : canon(a) !== canon(b) ? 'correction' : 'pages' });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Le classeur de l'élève, reconstruit à partir de ce que le serveur rend
// ---------------------------------------------------------------------------------------------

/** Un élément ouvert, tel que le serveur le rend (supabase/functions/classeur-eleve/release.ts). */
export interface OpenEntry {
  anchor: string;
  correction: boolean;
  released: unknown;
}

/**
 * Pages du classeur d'une classe, à partir de ses seuls éléments ouverts : aucun titre de la
 * bibliothèque n'est lu ici, l'élève ne la reçoit pas. Même ordre que le classeur du professeur :
 * mode d'emploi, « Séquences » (par séquence : la page de garde, puis les activités), « Fiches
 * méthodes », « Je révise ». `boardOf` : le cours d'un identifiant (rendu par le serveur, ou pris
 * dans la bibliothèque pour l'aperçu du professeur) ; une page dont le cours manque est laissée de
 * côté. À passer ensuite dans `withSummaries` avec les `texts` rendus ici : les bilans des
 * corrections ouvertes, tels qu'ils ont été copiés à l'ouverture, et aucun autre.
 */
export function pagesFromReleased(entries: OpenEntry[], boardOf: (id: string) => Board | undefined): { pages: BinderPage[]; texts: Map<string, SummaryRuns> } {
  const taken = new Set<string>();
  // Ordre fixe, celui du serveur : un cours cité par deux éléments va toujours au même
  const sorted = [...entries].sort((a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : 0));
  const items = sorted.flatMap((e) => {
    const parsed = parseReleased(e.released);
    // L'ancre est la page par laquelle l'élément a été ouvert : sans elle, rien
    if (!parsed || !parsed.pages.some((p) => p.board === e.anchor)) return [];
    // Un cours n'est collé qu'une fois dans le classeur
    const pages = parsed.pages.filter((p) => !taken.has(p.board));
    for (const p of pages) taken.add(p.board);
    return [{ anchor: e.anchor, correction: e.correction && parsed.role === 'activity', released: { ...parsed, pages } }];
  });
  const texts = new Map<string, SummaryRuns>();
  const sheets = (item: (typeof items)[number], section: 'sequences' | 'methodes' | 'revise' | null): BinderPage[] => {
    const { released } = item;
    const copy = item.correction && released.correction?.copy ? boardOf(released.correction.copy) : undefined;
    return released.pages.flatMap((p): BinderPage[] => {
      const board = boardOf(p.board);
      if (!board) return [];
      const base = { kind: 'sheet' as const, key: board.id, section, chapter: released.chapter, label: p.label, board, role: p.role, anchor: item.anchor };
      if (p.role !== 'activity') return [base];
      const heading = released.heading ?? board.title;
      const summary = item.correction ? released.correction?.summary : undefined;
      const key = activityKeyOf(heading);
      if (summary && key && released.chapter) {
        const bilans = texts.get(released.chapter) ?? new Map<string, Summary>();
        bilans.set(key, summary);
        texts.set(released.chapter, bilans);
      }
      return [{ ...base, heading, ...(copy ? { companion: copy } : {}) }];
    });
  };
  const of = (role: ItemRole) => items.filter((i) => i.released.role === role);
  const pages: BinderPage[] = [];

  for (const item of of('guide')) pages.push(...sheets(item, null));

  pages.push({ kind: 'divider', key: 'divider:sequences', section: 'sequences' });
  const inSequences = [...of('cover'), ...of('activity')].filter((i) => i.released.chapter);
  const chapters = [...new Set(inSequences.map((i) => i.released.chapter!))].sort(naturalCompare);
  for (const chapter of chapters) {
    for (const item of of('cover').filter((i) => i.released.chapter === chapter)) pages.push(...sheets(item, 'sequences'));
    const activities = of('activity')
      .filter((i) => i.released.chapter === chapter)
      .sort((a, b) => naturalCompare(a.released.heading ?? a.released.label, b.released.heading ?? b.released.label));
    for (const item of activities) pages.push(...sheets(item, 'sequences'));
  }

  pages.push({ kind: 'divider', key: 'divider:methodes', section: 'methodes' });
  for (const item of of('method').sort((a, b) => naturalCompare(a.released.label, b.released.label))) pages.push(...sheets(item, 'methodes'));

  pages.push({ kind: 'divider', key: 'divider:revise', section: 'revise' });
  for (const item of of('memo').sort((a, b) => naturalCompare(a.released.chapter ?? '', b.released.chapter ?? ''))) pages.push(...sheets(item, 'revise'));

  return { pages, texts };
}
