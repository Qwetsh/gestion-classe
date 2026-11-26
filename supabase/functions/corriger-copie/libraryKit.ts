/**
 * Kit de correction préparé depuis « Mes cours » (migration 095) : logique pure.
 *
 * Quand le Correcteur n'a pas envoyé de kit (push_grades.py --kit) mais que l'évaluation est
 * reliée à une activité de la bibliothèque, le bouton « Corriger » prépare lui-même un kit v1 :
 *  - le corrigé = le texte de la fiche, de ses documents et de sa correction (le rouge #C00000
 *    et le gris #606060 restent repérables : attendus et barème d'un côté, coups de pouce de
 *    l'autre), les images jointes à part ;
 *  - le barème = les lignes des copies déjà corrigées de la classe s'il y en a (la copie
 *    rattrapée est alors notée sur les mêmes lignes que le reste de la classe, et les copies de
 *    référence restent comparables) ; sinon un découpage lu dans la correction par Claude,
 *    vérifié ici (total = barème de l'évaluation) ;
 *  - les consignes et le calibrage = ceux du dernier kit envoyé par le Correcteur (ils décrivent
 *    la façon de noter de Thomas, pas une évaluation), ou des consignes par défaut.
 *
 * Aucun import : testé par vitest côté web (gestion-classe-web/src/lib/__tests__/libraryKit.test.ts).
 */

import type { CorrectionKit, KitQuestion } from './correction.ts';

// --------------------------------------------------------------------------- //
// Texte d'un cours (boards.doc, format TipTap)
// --------------------------------------------------------------------------- //

interface DocNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: DocNode[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Le rouge des corrections (#C00000) et ses voisins : rouge franc, peu de vert et de bleu. */
export function isCorrectionRed(color: unknown): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(color ?? '').trim());
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return r >= 0x99 && g <= 0x50 && b <= 0x50;
}

/** Le gris des coups de pouce (#606060), à l'exclusion des gris de légende voisins. */
export function isHintGrey(color: unknown): boolean {
  return /^#?606060$/i.test(String(color ?? '').trim());
}

export const RED_OPEN = '⟨rouge⟩';
export const RED_CLOSE = '⟨/rouge⟩';
export const GREY_OPEN = '⟨gris⟩';
export const GREY_CLOSE = '⟨/gris⟩';

/** Chemins des images d'un cours (bucket board-assets), dans l'ordre du document. */
export function docImagePaths(doc: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!isObj(n)) return;
    if (n.type === 'image' && isObj(n.attrs) && typeof n.attrs.path === 'string' && n.attrs.path !== '') out.push(n.attrs.path);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(isObj(doc) ? { content: doc.content } : null);
  return out;
}

function inlineText(nodes: DocNode[] | undefined, image: (path: string | null) => string): string {
  let s = '';
  for (const n of nodes ?? []) {
    if (n.type === 'text') {
      const color = (n.marks ?? []).find((m) => m.type === 'textStyle')?.attrs?.color;
      const t = n.text ?? '';
      s += isCorrectionRed(color) ? `${RED_OPEN}${t}${RED_CLOSE}` : isHintGrey(color) ? `${GREY_OPEN}${t}${GREY_CLOSE}` : t;
    } else if (n.type === 'hardBreak') {
      s += '\n';
    } else if (n.type === 'image') {
      s += image(typeof n.attrs?.path === 'string' ? (n.attrs.path as string) : null);
    } else if (n.content) {
      s += inlineText(n.content, image);
    }
  }
  // Deux morceaux rouges qui se suivent n'en font qu'un.
  return s.split(`${RED_CLOSE}${RED_OPEN}`).join('').split(`${GREY_CLOSE}${GREY_OPEN}`).join('');
}

/**
 * Texte lisible d'un cours : titres, paragraphes, listes, tableaux (cellules séparées par « | »).
 * `image(path)` donne le repère d'une image (« [Image 3] ») ; les pointillés sont omis.
 */
export function docToText(doc: unknown, image: (path: string | null) => string = () => '[Image]'): string {
  const lines: string[] = [];
  const block = (n: DocNode, prefix = '') => {
    switch (n.type) {
      case 'paragraph': {
        const t = inlineText(n.content, image).trim();
        if (t) lines.push(prefix + t);
        return;
      }
      case 'heading': {
        const t = inlineText(n.content, image).trim();
        if (t) lines.push(`${'#'.repeat(Math.min(6, Number(n.attrs?.level ?? 2)) + 1)} ${t}`);
        return;
      }
      case 'image':
        lines.push(prefix + image(typeof n.attrs?.path === 'string' ? (n.attrs.path as string) : null));
        return;
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        (n.content ?? []).forEach((item, i) => {
          const mark = n.type === 'orderedList' ? `${i + 1}. ` : '- ';
          const before = lines.length;
          (item.content ?? []).forEach((c) => block(c, prefix));
          if (lines.length > before) lines[before] = lines[before].replace(prefix, prefix + mark);
        });
        return;
      case 'table':
        for (const row of n.content ?? []) {
          const cells = (row.content ?? []).map((cell) => {
            const inner: string[] = [];
            const saved = lines.length;
            (cell.content ?? []).forEach((c) => block(c));
            inner.push(...lines.splice(saved));
            return inner.join(' / ');
          });
          if (cells.some((c) => c.trim())) lines.push(prefix + '| ' + cells.join(' | ') + ' |');
        }
        return;
      case 'dots':
      case 'horizontalRule':
      case 'pageBreak':
        return;
      default:
        if (n.content) n.content.forEach((c) => block(c, prefix));
        else if (n.type === 'text' && n.text?.trim()) lines.push(prefix + n.text.trim());
    }
  };
  if (isObj(doc) && Array.isArray(doc.content)) (doc.content as DocNode[]).forEach((n) => block(n));
  return lines.join('\n');
}

// --------------------------------------------------------------------------- //
// Corrigé : fiche, documents, correction
// --------------------------------------------------------------------------- //

export interface LibraryBoard {
  id: string;
  title: string;
  doc: unknown;
  level?: string | null;
  updated_at?: string | null;
}

/** Nombre d'images jointes au plus (au-delà, le repère dit qu'elle n'est pas transmise). */
export const MAX_LIBRARY_IMAGES = 12;

/**
 * Corrigé du kit et images à joindre. Les images sont numérotées dans l'ordre du texte (sujet,
 * documents, correction) ; une même image (même chemin) garde son numéro.
 */
export function buildLibraryCorrige(
  parts: { sujet: LibraryBoard | null; documents: LibraryBoard | null; correction: LibraryBoard },
  maxImages = MAX_LIBRARY_IMAGES,
): { corrige: string; images: string[] } {
  const images: string[] = [];
  const image = (path: string | null) => {
    if (!path) return '[Image]';
    let i = images.indexOf(path);
    if (i === -1) {
      if (images.length >= maxImages) return '[Image non transmise]';
      images.push(path);
      i = images.length - 1;
    }
    return `[Image ${i + 1}]`;
  };
  const section = (heading: string, b: LibraryBoard | null) => {
    if (!b) return [];
    const text = docToText(b.doc, image).trim();
    return text ? [`### ${heading} — « ${b.title} »`, text] : [];
  };
  const corrige = [
    'Corrigé tiré de la bibliothèque de cours de Thomas (sujet, documents et correction de l\'activité).',
    `Dans la correction, le texte entre ${RED_OPEN} et ${RED_CLOSE} est écrit en rouge : réponses attendues, barème et consignes de notation.`,
    `Le texte entre ${GREY_OPEN} et ${GREY_CLOSE} est en gris : des coups de pouce donnés aux élèves, pas des attendus.`,
    '« [Image n] » renvoie à l\'image n jointe après ce bloc. Les tableaux sont écrits ligne par ligne, cellules séparées par « | ».',
    '',
    ...section('Sujet distribué aux élèves', parts.sujet),
    '',
    ...section('Documents', parts.documents),
    '',
    ...section('Correction', parts.correction),
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { corrige, images };
}

// --------------------------------------------------------------------------- //
// Barème
// --------------------------------------------------------------------------- //

export interface Bareme {
  competences: Record<string, string>;
  questions: KitQuestion[];
}

const versionKey = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

export interface GradedCopy {
  details: unknown;
  is_validated?: boolean;
  subject_version?: string | null;
}

/**
 * Barème des copies déjà corrigées de la classe : la suite de lignes (libellé, maximum,
 * compétences) la plus fréquente parmi les détails v1, en ne comptant que la version du sujet de
 * l'élève quand elle est connue. Les copies validées par Thomas comptent double. Null s'il n'y en a
 * aucune.
 */
export function baremeFromGrades(copies: GradedCopy[], studentVersion: string | null = null): Bareme | null {
  const mine = versionKey(studentVersion);
  const tally = new Map<string, { weight: number; questions: KitQuestion[] }>();
  for (const c of copies) {
    if (mine && versionKey(c.subject_version) && versionKey(c.subject_version) !== mine) continue;
    if (!isObj(c.details) || !Array.isArray(c.details.questions) || c.details.questions.length === 0) continue;
    const qs: KitQuestion[] = [];
    let ok = true;
    for (const q of c.details.questions as unknown[]) {
      if (!isObj(q) || typeof q.label !== 'string' || !q.label.trim() || typeof q.bareme !== 'number' || !(q.bareme > 0)) { ok = false; break; }
      const comps = Array.isArray(q.competences) ? q.competences.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
      qs.push({ label: q.label, bareme: q.bareme, competences: comps });
    }
    if (!ok) continue;
    const key = JSON.stringify(qs);
    const cur = tally.get(key) ?? { weight: 0, questions: qs };
    cur.weight += c.is_validated ? 2 : 1;
    tally.set(key, cur);
  }
  let best: { weight: number; questions: KitQuestion[] } | null = null;
  for (const t of tally.values()) if (!best || t.weight > best.weight) best = t;
  if (!best) return null;
  return { competences: competencesOf(best.questions), questions: best.questions };
}

function competencesOf(questions: KitQuestion[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of questions) for (const c of q.competences ?? []) out[c] = c;
  return out;
}

/** Schéma de la sortie structurée demandée à Claude pour découper le barème. */
export function buildBaremeSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Court : « Q1 — Frontières de plaques », « Partie 2 — Raisonnement »' },
            bareme: { type: 'number', description: 'Points de la ligne, multiple de 0,25' },
            competences: { type: 'array', items: { type: 'string' } },
          },
          required: ['label', 'bareme', 'competences'],
          additionalProperties: false,
        },
      },
      remarque: { type: 'string', description: 'Ce qui a été difficile à découper, ou chaîne vide.' },
    },
    required: ['questions', 'remarque'],
    additionalProperties: false,
  };
}

const fr = (x: number) => String(x).replace('.', ',');

/** Consigne du découpage du barème, après le corrigé. */
export function formatBaremeTask(total: number): string {
  return [
    'Découpe le barème de cette évaluation en lignes notées, dans l\'ordre du sujet.',
    'Une ligne par question ou sous-question qui porte des points (« /1.5 », « 2 pts »…) ; une partie notée en bloc',
    '(« Partie 2 … /10 ») forme une seule ligne, sauf si la correction la détaille en critères chiffrés : une ligne par critère.',
    'Libellés courts et distincts, commençant par le numéro de la question. Points en multiples de 0,25.',
    'Compétences : seulement celles que la correction nomme pour la ligne, sinon une liste vide.',
    `Le total doit faire exactement ${fr(total)} points, le barème de l'évaluation. S'il ne tombe pas juste, garde les points`,
    'écrits dans la correction et explique l\'écart dans « remarque ».',
  ].join(' ');
}

/** Vérifie le barème découpé par Claude ; le total doit être celui de l'évaluation. */
export function validateBareme(
  raw: unknown,
  expectedTotal: number,
): { ok: true; value: Bareme } | { ok: false; errors: string[] } {
  if (!isObj(raw) || !Array.isArray(raw.questions)) return { ok: false, errors: ['réponse sans « questions »'] };
  const errors: string[] = [];
  const questions: KitQuestion[] = [];
  const seen = new Set<string>();
  (raw.questions as unknown[]).forEach((q, i) => {
    if (!isObj(q)) { errors.push(`ligne ${i + 1} illisible`); return; }
    const label = typeof q.label === 'string' ? q.label.trim() : '';
    const pts = q.bareme;
    if (!label) errors.push(`ligne ${i + 1} sans libellé`);
    else if (seen.has(label.toLowerCase())) errors.push(`libellé en double : ${label}`);
    seen.add(label.toLowerCase());
    if (typeof pts !== 'number' || !Number.isFinite(pts) || pts <= 0) errors.push(`${label || `ligne ${i + 1}`} : points invalides`);
    else if (Math.round(pts * 4) !== pts * 4) errors.push(`${label} : ${fr(pts)} n'est pas un multiple de 0,25`);
    const comps = Array.isArray(q.competences) ? q.competences.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];
    questions.push({ label, bareme: typeof pts === 'number' ? pts : 0, competences: comps });
  });
  if (questions.length === 0) errors.push('aucune ligne de barème');
  const total = questions.reduce((s, q) => s + q.bareme, 0);
  if (errors.length === 0 && Math.abs(total - expectedTotal) > 1e-6) {
    const remarque = typeof raw.remarque === 'string' && raw.remarque.trim() ? ` (${raw.remarque.trim()})` : '';
    errors.push(`le barème lu dans la correction fait ${fr(total)} points, l'évaluation est notée sur ${fr(expectedTotal)}${remarque}`);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { competences: competencesOf(questions), questions } };
}

// --------------------------------------------------------------------------- //
// Kit
// --------------------------------------------------------------------------- //

/** Consignes par défaut, quand aucun kit du Correcteur n'a encore été envoyé. */
export const DEFAULT_CONSIGNES = [
  '# Consignes de correction (bouton « Corriger » de Gestion Classe)',
  '',
  'Tu corriges la copie d\'un élève de collège (SVT, 5e à 3e) pour son professeur. Tes commentaires seront lus par',
  'un enfant de 11 à 15 ans : courts, bienveillants, précis sur ce qui manque.',
  '',
  'Tu reçois le barème (lignes notées, avec leur maximum), le corrigé de l\'évaluation, éventuellement des copies de',
  'référence déjà corrigées, puis les pages scannées de la copie.',
  '',
  '- Note chaque ligne du barème, entre 0 et son maximum, par multiples de 0,25.',
  '- Le corrigé dit ce qui est attendu ; une réponse juste formulée autrement vaut les points.',
  '- Ne note pas l\'orthographe, sauf si le corrigé le demande.',
  '- Transcris fidèlement ce que l\'élève a écrit, question par question.',
  '- Signale dans « a_arbitrer » tout ce que le professeur doit trancher : écriture illisible, réponse ambiguë,',
  '  copie qui ne semble pas faite sur ce sujet.',
].join('\n');

export interface LibraryKitInput {
  evaluation: string;
  niveau: string | null;
  version: string | null;
  bareme: Bareme;
  baremeFrom: 'copies' | 'claude';
  corrige: string;
  images: string[];
  /** Dernier kit du Correcteur de Thomas (consignes, calibrage), s'il y en a un. */
  base: { consignes?: unknown; calibrage?: unknown } | null;
  correction: { id: string; updated_at?: string | null };
}

/** Kit v1 marqué « bibliotheque », rangé dans assessment_correction_kits. */
export interface LibraryKit extends CorrectionKit {
  source: 'bibliotheque';
  library: {
    correction_board_id: string;
    correction_updated_at: string | null;
    bareme_from: 'copies' | 'claude';
    images: string[];
  };
}

export function buildLibraryKit(input: LibraryKitInput): LibraryKit {
  const consignes = typeof input.base?.consignes === 'string' && input.base.consignes.trim() ? input.base.consignes : DEFAULT_CONSIGNES;
  const calibrage = typeof input.base?.calibrage === 'string' ? input.base.calibrage : '';
  return {
    v: 1,
    source: 'bibliotheque',
    evaluation: input.evaluation,
    niveau: input.niveau,
    classe: null,
    version: input.version,
    bareme: input.bareme,
    corrige: input.corrige,
    calibrage,
    harmonisation: '',
    consignes,
    library: {
      correction_board_id: input.correction.id,
      correction_updated_at: input.correction.updated_at ?? null,
      bareme_from: input.baremeFrom,
      images: input.images,
    },
  };
}

/** Kit préparé depuis la bibliothèque (et non envoyé par le Correcteur) ? */
export function isLibraryKit(kit: unknown): kit is LibraryKit {
  return isObj(kit) && kit.source === 'bibliotheque';
}

/** Images à joindre après le bloc du kit (kit de la bibliothèque seulement). */
export function libraryImages(kit: unknown): string[] {
  if (!isLibraryKit(kit) || !isObj(kit.library) || !Array.isArray(kit.library.images)) return [];
  return kit.library.images.filter((p): p is string => typeof p === 'string' && p !== '');
}
