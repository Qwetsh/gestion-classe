/**
 * Classeur ouvert aux classes : ce que le serveur a le droit de rendre. Fonctions pures, sans
 * dépendance (lues aussi par les tests du navigateur : gestion-classe-web/src/lib/__tests__).
 *
 * Le serveur n'ouvre rien d'après un titre. Il part des lignes `class_binder_items` de la classe,
 * écrites par le navigateur du professeur au moment où il a ouvert une activité (`released` : la
 * liste exacte des cours qui sortent, et le texte du bilan). Il ne fait que resserrer :
 *  - un cours cité qui porte aujourd'hui un titre de correction, de copie modèle ou d'évaluation
 *    (renommé après coup) est refermé : le titre ne sert qu'à fermer, jamais à ouvrir ;
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
  // Ordre fixe : un cours cité par deux lignes va toujours à la même (l'aperçu du professeur fait pareil)
  const sorted = [...rows].sort((a, b) => (String(a.anchor_board_id) < String(b.anchor_board_id) ? -1 : String(a.anchor_board_id) > String(b.anchor_board_id) ? 1 : 0));
  for (const row of sorted) {
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

/** Variante lue à la fin d'un titre, comme dans le navigateur (courseLibrary.ts, VARIANT_SUFFIX). */
const TITLE_SUFFIX = /\s*\((correction|corrig[ée]|documents?|extraits?|copie mod[èe]le|adapt[ée]e?|protocoles?)\)\s*$/i;
/** Titre qui parle de correction, de copie modèle ou d'évaluation (binder.ts, UNSURE_TITLE). */
const UNSURE_TITLE = /corr(?:ection|ig[ée])|copie\s+mod[èe]le|[ée]valuation/iu;

/**
 * Le titre d'aujourd'hui dit-il que ce cours n'a plus sa place ? Une page ouverte (fiche,
 * documents, protocole, page seule) ne peut pas s'appeler correction, copie modèle, version adaptée,
 * extraits ou évaluation ; une copie modèle doit toujours s'appeler ainsi. Le professeur a pu
 * récrire un cours ouvert pour en faire autre chose : son identifiant est resté dans la ligne.
 */
export function closedByTitle(rawTitle: string, kind: 'page' | 'copy'): boolean {
  const title = rawTitle.normalize('NFC');
  const m = TITLE_SUFFIX.exec(title);
  const word = m ? m[1].toLowerCase() : '';
  const base = m ? title.slice(0, m.index) : title;
  if (kind === 'copy') return !word.startsWith('copie') || UNSURE_TITLE.test(base);
  if (word !== '' && !word.startsWith('doc') && !word.startsWith('proto')) return true;
  return UNSURE_TITLE.test(base);
}

/**
 * Ne garde que ce qui appartient au professeur de la classe, et que son titre d'aujourd'hui ne
 * referme pas (`owned` : le titre de chaque cours de la liste dont il est le propriétaire). Une
 * ligne ne prouve que son ancre : les autres identifiants qu'elle cite sont revérifiés ici.
 */
export function ownedItems(items: OpenItem[], owned: Map<string, string>): OpenItem[] {
  const open = (id: string, kind: 'page' | 'copy') => { const title = owned.get(id); return title !== undefined && !closedByTitle(title, kind); };
  const out: OpenItem[] = [];
  for (const item of items) {
    if (!open(item.anchor, 'page')) continue;
    const pages = item.released.pages.filter((p) => open(p.board, 'page'));
    const released = { ...item.released, pages };
    if (released.correction?.copy && !open(released.correction.copy, 'copy')) {
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

/** Parcourt un document ; rend faux s'il est trop profond pour être lu en entier (on ne sert pas ce qu'on n'a pas vu). */
function walk(node: unknown, visit: (n: Record<string, unknown>) => void, depth = 0): boolean {
  if (!isRecord(node)) return true;
  if (depth > 60) return false;
  visit(node);
  let whole = true;
  if (Array.isArray(node.content)) for (const child of node.content) whole = walk(child, visit, depth + 1) && whole;
  return whole;
}

/**
 * Ce qui sort d'un cours : le texte et sa mise en page. Les écrans, les liens, le calque d'annotations
 * et le numéro d'enregistrement restent sur le serveur. Null : pas un cours rédigé, ou un cours qui
 * porte un encart (ses pages de tableau ne sont pas servies : on préfère ne rien montrer), ou trop
 * profond pour être relu en entier.
 */
export function publicDoc(doc: unknown): { version: number; content: Record<string, unknown>; settings?: Record<string, unknown> } | null {
  if (!isRecord(doc) || typeof doc.version !== 'number' || !isRecord(doc.content)) return null;
  let encart = false;
  const whole = walk(doc.content, (n) => { if (n.type === 'encart') encart = true; });
  if (encart || !whole) return null;
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
