/**
 * « Ajouter les copies de la classe » : un paquet de pages (PDF du photocopieur, dossier de
 * photos, webcam) découpé en copies de N pages et attribué aux élèves dans l'ordre de la liste.
 *
 * Logique pure, sans React ni Supabase : le paquet est une liste de copies, chacune avec ses
 * pages et son élève (ou aucun). Chaque opération rend une nouvelle liste.
 */

export interface Bundle<P> {
  id: string;
  pages: P[];
  /** Élève qui reçoit la copie ; `null` : copie à attribuer à la main ; UNNAMED : « Pas de nom ». */
  studentId: string | null;
}

/**
 * Copie rangée sans élève (« Pas de nom », migration 061), à identifier plus tard dans l'app.
 * Plusieurs copies peuvent l'être ; l'attribution dans l'ordre les laisse où elles sont.
 */
export const UNNAMED = '__pas_de_nom__';

let seq = 0;
export function bundleId(): string {
  seq += 1;
  return `b${Date.now().toString(36)}${seq}`;
}

/**
 * Nombre de pages proposé : le plus fréquent parmi les copies déjà rangées (à égalité, le plus
 * grand : une page de trop se voit mieux qu'une page coupée), sinon `fallback`.
 */
export function suggestPagesPerCopy(existingCounts: number[], fallback = 2): number {
  const freq = new Map<number, number>();
  for (const n of existingCounts) if (n > 0) freq.set(n, (freq.get(n) ?? 0) + 1);
  let best = 0;
  let bestFreq = 0;
  for (const [n, f] of freq) {
    if (f > bestFreq || (f === bestFreq && n > best)) {
      best = n;
      bestFreq = f;
    }
  }
  return best > 0 ? best : fallback;
}

/** Découpe les pages en copies de `perCopy` pages (la dernière peut être plus courte). */
export function splitIntoBundles<P>(pages: P[], perCopy: number, makeId: () => string = bundleId): Bundle<P>[] {
  const n = Math.max(1, Math.floor(perCopy));
  const out: Bundle<P>[] = [];
  for (let i = 0; i < pages.length; i += n) out.push({ id: makeId(), pages: pages.slice(i, i + n), studentId: null });
  return out;
}

/**
 * Attribue les copies dans l'ordre aux élèves de `order` (déjà filtrée : sans les absents ni
 * ceux qui ont déjà une copie). Les copies en trop restent sans élève.
 */
export function assignInOrder<P>(bundles: Bundle<P>[], order: string[]): Bundle<P>[] {
  let k = 0;
  return bundles.map((b) => (b.studentId === UNNAMED ? b : { ...b, studentId: order[k++] ?? null }));
}

/**
 * Réattribue les copies à partir de `index`, dans l'ordre de la liste, en reprenant après le
 * dernier élève attribué avant elles (un absent retiré décale toute la suite d'un cran).
 */
export function reassignFrom<P>(bundles: Bundle<P>[], index: number, order: string[]): Bundle<P>[] {
  const before = bundles
    .slice(0, index)
    .map((b) => b.studentId)
    .filter((id): id is string => !!id && id !== UNNAMED);
  const taken = new Set(before);
  const last = before.length ? order.indexOf(before[before.length - 1]) : -1;
  const free = order.slice(last + 1).filter((id) => !taken.has(id));
  let k = 0;
  return bundles.map((b, i) => (i < index || b.studentId === UNNAMED ? b : { ...b, studentId: free[k++] ?? null }));
}

/**
 * Donne la copie `id` à `studentId`. Si une autre copie avait cet élève, elle prend l'ancien
 * élève de `id` (échange) : glisser une copie sur un élève ne perd personne.
 */
export function assignBundle<P>(bundles: Bundle<P>[], id: string, studentId: string | null): Bundle<P>[] {
  const moving = bundles.find((b) => b.id === id);
  if (!moving) return bundles;
  // Une copie « Pas de nom » qui prend la place d'un élève lui laisse une copie à attribuer.
  const previous = moving.studentId === UNNAMED ? null : moving.studentId;
  return bundles.map((b) => {
    if (b.id === id) return { ...b, studentId };
    if (studentId !== null && studentId !== UNNAMED && b.studentId === studentId) return { ...b, studentId: previous };
    return b;
  });
}

/** Coupe la copie `id` avant la page `at` : la seconde moitié devient une copie sans élève. */
export function splitBundle<P>(bundles: Bundle<P>[], id: string, at: number, makeId: () => string = bundleId): Bundle<P>[] {
  const i = bundles.findIndex((b) => b.id === id);
  if (i < 0) return bundles;
  const b = bundles[i];
  if (at <= 0 || at >= b.pages.length) return bundles;
  const head = { ...b, pages: b.pages.slice(0, at) };
  const tail: Bundle<P> = { id: makeId(), pages: b.pages.slice(at), studentId: null };
  return [...bundles.slice(0, i), head, tail, ...bundles.slice(i + 1)];
}

/** Ajoute les pages de la copie suivante à `id` ; l'élève de la suivante redevient libre. */
export function mergeWithNext<P>(bundles: Bundle<P>[], id: string): Bundle<P>[] {
  const i = bundles.findIndex((b) => b.id === id);
  if (i < 0 || i >= bundles.length - 1) return bundles;
  const merged = { ...bundles[i], pages: [...bundles[i].pages, ...bundles[i + 1].pages] };
  return [...bundles.slice(0, i), merged, ...bundles.slice(i + 2)];
}

/**
 * Fait passer une page de bord dans la copie voisine : la première page vers la copie
 * précédente (`-1`), la dernière vers la suivante (`+1`). Une copie vidée disparaît.
 */
export function shiftEdgePage<P>(bundles: Bundle<P>[], id: string, direction: -1 | 1): Bundle<P>[] {
  const i = bundles.findIndex((b) => b.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= bundles.length) return bundles;
  const from = bundles[i];
  if (from.pages.length === 0) return bundles;
  const to = bundles[j];
  const next = [...bundles];
  if (direction === -1) {
    next[j] = { ...to, pages: [...to.pages, from.pages[0]] };
    next[i] = { ...from, pages: from.pages.slice(1) };
  } else {
    next[j] = { ...to, pages: [from.pages[from.pages.length - 1], ...to.pages] };
    next[i] = { ...from, pages: from.pages.slice(0, -1) };
  }
  return next.filter((b) => b.pages.length > 0);
}

/** Applique `fn` aux pages de la copie `id` ; une copie vidée disparaît. */
export function updatePages<P>(bundles: Bundle<P>[], id: string, fn: (pages: P[]) => P[]): Bundle<P>[] {
  return bundles
    .map((b) => (b.id === id ? { ...b, pages: fn(b.pages) } : b))
    .filter((b) => b.pages.length > 0);
}

/** Ajoute des pages à la copie de l'élève (webcam en file), ou crée sa copie. */
export function addPagesToStudent<P>(
  bundles: Bundle<P>[],
  studentId: string,
  pages: P[],
  makeId: () => string = bundleId,
): Bundle<P>[] {
  const i = bundles.findIndex((b) => b.studentId === studentId);
  if (i < 0) return [...bundles, { id: makeId(), pages, studentId }];
  return bundles.map((b, k) => (k === i ? { ...b, pages: [...b.pages, ...pages] } : b));
}

/** Prochain élève de `order` après `current` qui n'a pas encore de copie dans le paquet. */
export function nextStudentWithout<P>(bundles: Bundle<P>[], order: string[], current: string | null): string | null {
  const taken = new Set(bundles.map((b) => b.studentId).filter(Boolean));
  const start = current ? order.indexOf(current) + 1 : 0;
  for (let k = 0; k < order.length; k++) {
    const id = order[(start + k) % order.length];
    if (!taken.has(id) && id !== current) return id;
  }
  return null;
}

export interface SendCheck {
  /** Copies prêtes à partir (avec un élève, ou « Pas de nom »). */
  ready: number;
  /** Copies sans élève : elles ne partiront pas. */
  unassigned: number;
  /** Élèves qui doivent encore recevoir une version du sujet. */
  missingVersion: string[];
}

/**
 * Ce qui partira à « Envoyer tout ». Avec plusieurs versions du sujet connues, chaque élève
 * qui reçoit une copie doit avoir la sienne (le bouton « Corriger » en dépend).
 */
export function checkBeforeSend<P>(
  bundles: Bundle<P>[],
  versionOf: (studentId: string) => string,
  knownVersions: string[],
): SendCheck {
  const assigned = bundles.filter((b) => b.studentId !== null);
  const missingVersion =
    knownVersions.length >= 2
      ? assigned.map((b) => b.studentId as string).filter((id) => id !== UNNAMED && !versionOf(id).trim())
      : [];
  return { ready: assigned.length, unassigned: bundles.length - assigned.length, missingVersion };
}
