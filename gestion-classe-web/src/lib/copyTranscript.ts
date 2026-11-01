/**
 * Transcription d'une copie (assessment_copy_transcripts, migration 056) : texte de l'élève
 * recopié mot pour mot par le Correcteur, question par question, dans l'ordre de la copie.
 * Visible du prof seul ; c'est la trace qui reste quand les scans sont supprimés.
 *
 * Format v1 : {"v": 1, "items": [{"q": "Q1", "texte": "…"}, {"q": "Partie 2", "texte": "…"}]}
 * Le JSON vient d'un script : on le lit défensivement, comme `details` (gradeDetails.ts).
 */

import type { DetailQuestion } from './gradeDetails';

export interface TranscriptItem {
  q: string;
  texte: string;
}

/** Lit une transcription brute ; `null` s'il n'y a aucun passage. */
export function parseTranscript(raw: unknown): TranscriptItem[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const items = (raw as Record<string, unknown>).items;
  if (!Array.isArray(items)) return null;
  const out = items
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      q: typeof i.q === 'string' ? i.q.trim() : '',
      texte: typeof i.texte === 'string' ? i.texte : '',
    }))
    .filter((i) => i.q || i.texte.trim());
  return out.length > 0 ? out : null;
}

/**
 * Clé de rapprochement entre un passage transcrit et les questions du barème :
 * « Q1 » ↔ « Q1 Magma et lave », « Partie 2 » ↔ « P2 · J'observe ».
 */
export function questionKey(label: string): string {
  const s = label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^partie\s*(\d+)/, 'p$1');
  const first = s.split(/[\s·.:,;)–—-]+/)[0] ?? '';
  return first;
}

export interface TranscriptBlock {
  /** Libellé du passage (« Q1 », « Partie 2 »), ou de la question si rien n'a été transcrit. */
  q: string;
  /** Texte de l'élève ; `null` = question du barème sans réponse transcrite. */
  texte: string | null;
  /** Questions du barème auxquelles répond ce passage (points et commentaire). */
  questions: DetailQuestion[];
}

/**
 * Met chaque passage en face des questions qu'il traite, dans l'ordre de la copie. Une question
 * n'est rattachée qu'au premier passage qui la vise (une réponse coupée sur deux pages ne compte
 * pas deux fois). Les questions sans passage viennent ensuite, marquées « pas de réponse ».
 */
export function alignTranscript(items: TranscriptItem[], questions: DetailQuestion[]): TranscriptBlock[] {
  const used = new Set<DetailQuestion>();
  const blocks: TranscriptBlock[] = items.map((item) => {
    const key = questionKey(item.q);
    const matched = key ? questions.filter((q) => !used.has(q) && questionKey(q.label) === key) : [];
    for (const q of matched) used.add(q);
    return { q: item.q || '—', texte: item.texte, questions: matched };
  });
  for (const q of questions) {
    if (!used.has(q)) blocks.push({ q: q.label, texte: null, questions: [q] });
  }
  return blocks;
}

// ============================================================
// Suppression des scans : seulement pour les copies transcrites
// ============================================================

export interface PurgePlan {
  /** Fichiers à supprimer (élèves qui ont une transcription). */
  paths: string[];
  /** Élèves dont on supprime les pages. */
  purgedStudents: string[];
  /** Élèves qui ont des pages mais pas de transcription : leurs scans restent. */
  keptStudents: string[];
}

/** Partage les pages d'une éval entre celles qu'on peut supprimer et celles qu'on garde. */
export function planCopyPurge(
  pages: { student_id: string; storage_path: string }[],
  transcribed: ReadonlySet<string>,
): PurgePlan {
  const paths: string[] = [];
  const purged = new Set<string>();
  const kept = new Set<string>();
  for (const p of pages) {
    if (transcribed.has(p.student_id)) {
      paths.push(p.storage_path);
      purged.add(p.student_id);
    } else {
      kept.add(p.student_id);
    }
  }
  return { paths, purgedStudents: [...purged], keptStudents: [...kept] };
}

/** « 3 copies sans transcription : scans conservés ». */
export function describeKeptCopies(n: number): string {
  return n > 1 ? `${n} copies sans transcription : scans conservés` : '1 copie sans transcription : scans conservés';
}
