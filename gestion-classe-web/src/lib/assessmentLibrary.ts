/**
 * Évaluation du carnet reliée à une activité de « Mes cours » (migration 095) : fonctions pures,
 * sans accès à la base.
 *
 * La fenêtre « Nouvelle évaluation » propose une séquence de la bibliothèque, puis une activité de
 * cette séquence (lib/activitySuggest.ts : pickableActivities). L'évaluation garde les identifiants
 * de la fiche, de ses documents et de sa correction ; le bouton « Corriger » lit la fiche et la
 * correction quand le Correcteur n'a pas envoyé de kit.
 */
import type { ActivityGroup } from './courseLibrary';
import type { PickableSequence } from './activitySuggest';

/** Les trois cours de l'activité choisie ; null = rôle absent de la bibliothèque. */
export interface LibraryLink {
  boardId: string | null;
  documentsId: string | null;
  correctionId: string | null;
}

export const NO_LIBRARY_LINK: LibraryLink = { boardId: null, documentsId: null, correctionId: null };

export const hasLibraryLink = (l: LibraryLink | null | undefined): boolean =>
  !!l && (l.boardId !== null || l.documentsId !== null || l.correctionId !== null);

/** Lien d'une activité de la bibliothèque : sa fiche, ses documents et sa correction. */
export function linkFromGroup(group: ActivityGroup): LibraryLink {
  const id = (variant: string) => group.members.find((m) => m.variant === variant)?.board.id ?? null;
  return { boardId: id('fiche'), documentsId: id('documents'), correctionId: id('correction') };
}

/** Lien lu sur une ligne de written_assessments (colonnes absentes avant la migration : aucun lien). */
export function linkFromRow(row: {
  library_board_id?: string | null;
  library_documents_board_id?: string | null;
  library_correction_board_id?: string | null;
}): LibraryLink {
  return {
    boardId: row.library_board_id ?? null,
    documentsId: row.library_documents_board_id ?? null,
    correctionId: row.library_correction_board_id ?? null,
  };
}

export interface LibraryColumns {
  library_board_id?: string | null;
  library_documents_board_id?: string | null;
  library_correction_board_id?: string | null;
}

/**
 * Colonnes à écrire pour un insert ou un update. À la création, rien n'est envoyé sans activité :
 * une base sans la migration 095 accepte alors l'insert. En modification (`clear` vrai), un lien
 * vide efface les trois colonnes ; `undefined` ne touche à rien.
 */
export function libraryColumns(link: LibraryLink | null | undefined, clear = false): LibraryColumns {
  if (link === undefined) return {};
  if (!hasLibraryLink(link) && !clear) return {};
  const l = link ?? NO_LIBRARY_LINK;
  return {
    library_board_id: l.boardId,
    library_documents_board_id: l.documentsId,
    library_correction_board_id: l.correctionId,
  };
}

/** Deux liens désignent-ils les mêmes cours ? */
export const sameLink = (a: LibraryLink, b: LibraryLink): boolean =>
  a.boardId === b.boardId && a.documentsId === b.documentsId && a.correctionId === b.correctionId;

/**
 * Activité de la bibliothèque qui correspond à un lien enregistré (édition) : celle qui contient
 * l'un de ses cours. Null si aucun de ses cours n'existe plus dans la liste.
 */
export function findLinkedActivity(
  sequences: PickableSequence[],
  link: LibraryLink | null | undefined,
): { chapter: string; group: ActivityGroup } | null {
  if (!hasLibraryLink(link)) return null;
  const ids = new Set([link!.boardId, link!.correctionId, link!.documentsId].filter((x): x is string => !!x));
  for (const s of sequences) {
    for (const g of s.groups) {
      if (g.members.some((m) => ids.has(m.board.id))) return { chapter: s.chapter, group: g };
    }
  }
  return null;
}

/**
 * Séquence de la bibliothèque qui correspond au texte libre de l'évaluation (migration 060) :
 * même nom, ou « Séquence 2 » pour « Séquence 2 — Le système immunitaire ». Null sinon.
 */
export function matchLibrarySequence(sequences: PickableSequence[], text: string): string | null {
  const norm = (s: string) => s.normalize('NFC').replace(/[’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('fr');
  const t = norm(text);
  if (!t) return null;
  const exact = sequences.find((s) => norm(s.chapter) === t);
  if (exact) return exact.chapter;
  const num = /^s[ée]quence\s+(\d+)$/i.exec(t);
  if (!num) return null;
  const found = sequences.filter((s) => new RegExp(`^s[ée]quence\\s+${num[1]}(?!\\d)`, 'i').test(norm(s.chapter)));
  return found.length === 1 ? found[0].chapter : null;
}

/** Les évaluations de la séquence d'abord : c'est ce qu'on relie le plus souvent à une éval du carnet. */
export function groupsForAssessment(sequence: PickableSequence | undefined): ActivityGroup[] {
  if (!sequence) return [];
  return [...sequence.groups.filter((g) => g.evaluation), ...sequence.groups.filter((g) => !g.evaluation)];
}

// ---------------------------------------------------------------------------------------------
// Kits de correction : résumé affiché au-dessus des copies
// ---------------------------------------------------------------------------------------------

/** Ligne lue dans assessment_correction_kits (chemins JSON du kit). */
export interface KitSummaryRow {
  version_key: string;
  source: string | null;
  questions: unknown;
  library: unknown;
}

export interface KitSummary {
  versionKey: string;
  /** correcteur = push_grades.py --kit ; bibliotheque = préparé depuis la correction de l'activité. */
  source: 'correcteur' | 'bibliotheque';
  lines: { label: string; bareme: number }[];
  total: number;
  /** Kit de la bibliothèque : barème repris des copies déjà corrigées, ou lu par Claude. */
  baremeFrom: 'copies' | 'claude' | null;
  correctionId: string | null;
  /** Date de la correction quand le kit a été préparé (pour dire qu'elle a changé depuis). */
  correctionUpdatedAt: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function summarizeKit(row: KitSummaryRow): KitSummary {
  const lines = (Array.isArray(row.questions) ? row.questions : [])
    .filter(isRecord)
    .map((q) => ({ label: String(q.label ?? ''), bareme: typeof q.bareme === 'number' ? q.bareme : 0 }));
  const lib = isRecord(row.library) ? row.library : null;
  const from = lib?.bareme_from;
  return {
    versionKey: row.version_key ?? '',
    source: row.source === 'bibliotheque' ? 'bibliotheque' : 'correcteur',
    lines,
    total: Math.round(lines.reduce((s, l) => s + l.bareme, 0) * 100) / 100,
    baremeFrom: from === 'copies' || from === 'claude' ? from : null,
    correctionId: typeof lib?.correction_board_id === 'string' ? lib.correction_board_id : null,
    correctionUpdatedAt: typeof lib?.correction_updated_at === 'string' ? lib.correction_updated_at : null,
  };
}

/** La correction a-t-elle été retouchée après la préparation du kit ? */
export function correctionChangedSince(kit: KitSummary, correctionUpdatedAt: string | null | undefined): boolean {
  if (kit.source !== 'bibliotheque' || !kit.correctionUpdatedAt || !correctionUpdatedAt) return false;
  return new Date(correctionUpdatedAt).getTime() > new Date(kit.correctionUpdatedAt).getTime();
}

/**
 * Texte de séquence enregistré sur l'évaluation (migration 060) pour une séquence de la
 * bibliothèque : « Séquence 2 » pour « Séquence 2 — Le système immunitaire », comme les
 * évaluations déjà saisies (le filtre du carnet ne se dédouble pas) ; le nom entier sinon.
 */
export function sequenceLabel(chapter: string): string {
  const m = /^\s*(s[ée]quence)\s+(\d+)(?!\d)/i.exec(chapter.normalize('NFC'));
  return m ? `Séquence ${m[2]}` : chapter.trim();
}

/**
 * Cours de Mes cours qui tient lieu de sujet (la fiche) ou de corrigé (la correction) d'une éval
 * reliée à une activité, quand aucun fichier n'a été ajouté à la main. Pour une série, la
 * première éval reliée suffit (le lien suit la série).
 */
export function linkedDocBoardId(
  rows: { library_board_id?: string | null; library_correction_board_id?: string | null }[],
  kind: 'subject' | 'correction',
): string | null {
  for (const r of rows) {
    const id = kind === 'subject' ? r.library_board_id : r.library_correction_board_id;
    if (id) return id;
  }
  return null;
}

/**
 * Cours d'une activité proposés comme sujet ou corrigé (« Choisir dans Mes cours ») : tous sauf
 * la copie modèle et les extraits, le rôle attendu en tête et mis en avant (la fiche pour le
 * sujet, la correction pour le corrigé).
 */
export function pickableMembers(
  group: ActivityGroup,
  kind: 'subject' | 'correction',
): { variant: ActivityGroup['members'][number]['variant']; board: ActivityGroup['members'][number]['board']; preferred: boolean }[] {
  const wanted = kind === 'subject' ? 'fiche' : 'correction';
  const usable = group.members.filter((m) => m.variant !== 'copie' && m.variant !== 'extraits');
  return [
    ...usable.filter((m) => m.variant === wanted).map((m) => ({ ...m, preferred: true })),
    ...usable.filter((m) => m.variant !== wanted).map((m) => ({ ...m, preferred: false })),
  ];
}

/** Documents de l'activité d'un sujet choisi : ils accompagnent la fiche pour « Corriger ». */
export function documentsOf(group: ActivityGroup): string | null {
  return group.members.find((m) => m.variant === 'documents')?.board.id ?? null;
}
