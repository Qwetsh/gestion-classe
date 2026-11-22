/**
 * Classeur ouvert aux classes : ce que le serveur a le droit de rendre. Fonctions pures, sans
 * dépendance (lues aussi par les tests du navigateur : gestion-classe-web/src/lib/__tests__).
 *
 * Le serveur ne lit AUCUN titre. Il part des lignes `class_binder_items` de la classe, écrites par
 * le navigateur du professeur au moment où il a ouvert une activité (`released` : la liste exacte
 * des cours qui sortent, et le texte du bilan). Il ne fait que resserrer :
 *  - une ligne non visible ne rend rien ;
 *  - la correction (copie modèle, bilan) ne sort que si `correction_visible` ;
 *  - seuls passent les rôles d'une liste fermée (une évaluation n'en fait pas partie) ;
 *  - d'un cours, seuls le texte et sa mise en page sortent : jamais ses écrans (les corrections
 *    projetées en classe), ses liens, ni les annotations du professeur.
 */

/** Ce qui peut s'ouvrir à une classe, et les pages que chaque élément peut porter. */
export const PAGE_ROLES: Record<string, string[]> = {
  activity: ['activity', 'documents'],
  cover: ['cover'],
  memo: ['memo'],
  method: ['method'],
  guide: ['guide'],
};

export interface ItemRow {
  anchor_board_id: string;
  visible: boolean;
  correction_visible: boolean;
  released: unknown;
}

export interface OpenPage { board: string; role: string; label: string }
export interface InkRun { text: string; underline?: boolean }
export interface OpenSummary { heading: string; paragraphs: InkRun[][] }

/** Un élément ouvert à la classe, tel qu'il est rendu au navigateur de l'élève. */
export interface OpenItem {
  anchor: string;
  correction: boolean;
  released: {
    v: 1;
    role: string;
    chapter: string | null;
    label: string;
    heading?: string;
    pages: OpenPage[];
    correction?: { copy?: string; summary?: OpenSummary };
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const short = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length <= max ? v : null);

function parseSummary(value: unknown): OpenSummary | undefined {
  if (!isRecord(value)) return undefined;
  const heading = short(value.heading, 300);
  if (heading === null || !Array.isArray(value.paragraphs) || value.paragraphs.length > 80) return undefined;
  const paragraphs: InkRun[][] = [];
  for (const p of value.paragraphs) {
    if (!Array.isArray(p)) continue;
    const runs: InkRun[] = [];
    for (const r of p) {
      if (!isRecord(r)) continue;
      const text = short(r.text, 4000);
      if (text !== null) runs.push(r.underline === true ? { text, underline: true } : { text });
    }
    if (runs.length > 0) paragraphs.push(runs);
  }
  return paragraphs.length > 0 ? { heading, paragraphs } : undefined;
}

/**
 * Éléments ouverts à la classe, relus et resserrés. Une ligne mal formée, d'un rôle hors liste, ou
 * dont la page d'ancrage manque, ne rend rien.
 */
export function openItems(rows: ItemRow[]): OpenItem[] {
  const out: OpenItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.visible !== true || !isUuid(row.anchor_board_id) || seen.has(row.anchor_board_id)) continue;
    const r = row.released;
    if (!isRecord(r) || r.v !== 1 || typeof r.role !== 'string') continue;
    const allowed = Object.prototype.hasOwnProperty.call(PAGE_ROLES, r.role) ? PAGE_ROLES[r.role] : null;
    const label = short(r.label, 300);
    if (!allowed || label === null || !Array.isArray(r.pages) || r.pages.length > 40) continue;
    const pages: OpenPage[] = [];
    for (const p of r.pages) {
      if (!isRecord(p) || !isUuid(p.board) || typeof p.role !== 'string' || !allowed.includes(p.role)) continue;
      const pageLabel = short(p.label, 300);
      if (pageLabel !== null && !pages.some((q) => q.board === p.board)) pages.push({ board: p.board, role: p.role, label: pageLabel });
    }
    // L'ancre est la page par laquelle le professeur a ouvert l'élément : sans elle, rien
    if (!pages.some((p) => p.board === row.anchor_board_id)) continue;
    const released: OpenItem['released'] = { v: 1, role: r.role, chapter: short(r.chapter, 300), label, pages };
    const heading = short(r.heading, 300);
    if (heading !== null) released.heading = heading;
    const correction = row.correction_visible === true && r.role === 'activity';
    if (correction && isRecord(r.correction)) {
      const c: { copy?: string; summary?: OpenSummary } = {};
      if (isUuid(r.correction.copy)) c.copy = r.correction.copy;
      const summary = parseSummary(r.correction.summary);
      if (summary) c.summary = summary;
      if (c.copy || c.summary) released.correction = c;
    }
    seen.add(row.anchor_board_id);
    out.push({ anchor: row.anchor_board_id, correction, released });
  }
  return out;
}

/** Identifiants des cours que la classe peut lire : les pages ouvertes, et la copie modèle si la correction l'est. */
export function boardIds(items: OpenItem[]): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    for (const p of item.released.pages) ids.add(p.board);
    if (item.released.correction?.copy) ids.add(item.released.correction.copy);
  }
  return [...ids];
}

/**
 * Ne garde que ce qui appartient au professeur de la classe (`owned` : les cours de la liste dont
 * il est le propriétaire). Une ligne ne prouve que son ancre : les autres identifiants qu'elle cite
 * sont revérifiés ici.
 */
export function ownedItems(items: OpenItem[], owned: Set<string>): OpenItem[] {
  const out: OpenItem[] = [];
  for (const item of items) {
    if (!owned.has(item.anchor)) continue;
    const pages = item.released.pages.filter((p) => owned.has(p.board));
    const released = { ...item.released, pages };
    if (released.correction?.copy && !owned.has(released.correction.copy)) {
      const { copy: _copy, ...rest } = released.correction;
      void _copy;
      if (rest.summary) released.correction = rest; else delete released.correction;
    }
    out.push({ ...item, released });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Le document d'un cours, tel qu'il sort
// ---------------------------------------------------------------------------------------------

function walk(node: unknown, visit: (n: Record<string, unknown>) => void, depth = 0): void {
  if (!isRecord(node) || depth > 60) return;
  visit(node);
  if (Array.isArray(node.content)) for (const child of node.content) walk(child, visit, depth + 1);
}

/**
 * Ce qui sort d'un cours : le texte et sa mise en page. Les écrans, les liens, le calque d'annotations
 * et le numéro d'enregistrement restent sur le serveur. Null : pas un cours rédigé, ou un cours qui
 * porte un encart (ses pages de tableau ne sont pas servies : on préfère ne rien montrer).
 */
export function publicDoc(doc: unknown): { version: number; content: Record<string, unknown>; settings?: Record<string, unknown> } | null {
  if (!isRecord(doc) || typeof doc.version !== 'number' || !isRecord(doc.content)) return null;
  let encart = false;
  walk(doc.content, (n) => { if (n.type === 'encart') encart = true; });
  if (encart) return null;
  return isRecord(doc.settings)
    ? { version: doc.version, content: doc.content, settings: doc.settings }
    : { version: doc.version, content: doc.content };
}

/** Chemins de stockage des images d'un document (nœuds `image`, attribut `path`). */
export function imagePaths(content: unknown): string[] {
  const paths = new Set<string>();
  walk(content, (n) => {
    if (n.type === 'image' && isRecord(n.attrs) && typeof n.attrs.path === 'string' && n.attrs.path !== '') paths.add(n.attrs.path);
  });
  return [...paths];
}

/** Ne garde que les fichiers rangés sous le dossier du professeur (`<son identifiant>/…`), sans remontée de dossier. */
export function ownedPaths(paths: string[], ownerId: string): string[] {
  return paths.filter((p) => p.startsWith(`${ownerId}/`) && !p.split('/').some((part) => part === '..' || part === '.' || part === '') && !p.includes('\\'));
}
