/**
 * Logique pure du bouton « Corriger » (Edge Function corriger-copie, migration 057) : schéma de
 * sortie demandé à Claude, vérification de sa réponse, note /20, niveaux de compétence, détail
 * v1, choix des copies de référence, texte envoyé, coût estimé.
 *
 * Aucun import : ce fichier est aussi testé par vitest côté web
 * (gestion-classe-web/src/lib/__tests__/aiCorrection.test.ts). Les calculs reprennent à
 * l'identique le Correcteur (scripts/generer_correction.py : note_sur_20, validate --check,
 * build_details), pour qu'une copie corrigée ici ne se distingue pas du reste de la classe.
 */

export interface KitQuestion {
  label: string;
  bareme: number;
  competences?: string[];
}

/** Kit v1 écrit par Correcteur/scripts/build_kit.py, rangé dans assessment_correction_kits. */
export interface CorrectionKit {
  v: 1;
  evaluation?: string | null;
  niveau?: string | null;
  classe?: string | null;
  version?: string | null;
  bareme: { competences: Record<string, string>; questions: KitQuestion[] };
  corrige: string;
  calibrage?: string;
  harmonisation?: string;
  consignes: string;
}

export interface TranscriptItem {
  q: string;
  texte: string;
}

export interface Arbitrage {
  question: string;
  note_mise: number;
  raison: string;
}

/** Réponse de Claude une fois vérifiée, lignes dans l'ordre du barème. */
export interface CorrectionOutput {
  questions: { points: number; commentaire: string }[];
  forces: string;
  faiblesses: string;
  commentaire: string;
  transcription: TranscriptItem[];
  a_arbitrer: Arbitrage[];
}

export const NIVEAUX = ['Insuffisante', 'Fragile', 'Satisfaisante', 'Très bonne maîtrise'] as const;

/** Clé de la ligne i du barème dans la sortie : L01, L02… */
export function lineKey(i: number): string {
  return `L${String(i + 1).padStart(2, '0')}`;
}

/**
 * Schéma JSON de la sortie structurée. Les sorties structurées ne savent pas imposer la longueur
 * d'un tableau : les lignes du barème sont donc des propriétés obligatoires (L01…Lnn), ce qui
 * garantit une note par ligne, ni plus ni moins. La vérification serveur reste la référence
 * (bornes, multiples de 0,25, champs vides : non exprimables dans le schéma).
 */
export function buildOutputSchema(questions: KitQuestion[]): Record<string, unknown> {
  const line = (q: KitQuestion) => ({
    type: 'object',
    description: `${q.label} (sur ${q.bareme})`,
    properties: {
      points: { type: 'number', description: `Entre 0 et ${q.bareme}, multiple de 0,25` },
      commentaire: { type: 'string' },
    },
    required: ['points', 'commentaire'],
    additionalProperties: false,
  });
  const keys = questions.map((_, i) => lineKey(i));
  return {
    type: 'object',
    properties: {
      questions: {
        type: 'object',
        description: 'Une entrée par ligne du barème (L01 = première ligne).',
        properties: Object.fromEntries(questions.map((q, i) => [keys[i], line(q)])),
        required: keys,
        additionalProperties: false,
      },
      forces: { type: 'string' },
      faiblesses: { type: 'string' },
      commentaire: { type: 'string' },
      transcription: {
        type: 'array',
        items: {
          type: 'object',
          properties: { q: { type: 'string' }, texte: { type: 'string' } },
          required: ['q', 'texte'],
          additionalProperties: false,
        },
      },
      a_arbitrer: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            note_mise: { type: 'number' },
            raison: { type: 'string' },
          },
          required: ['question', 'note_mise', 'raison'],
          additionalProperties: false,
        },
      },
    },
    required: ['questions', 'forces', 'faiblesses', 'commentaire', 'transcription', 'a_arbitrer'],
    additionalProperties: false,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const filled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Vérifie la réponse de Claude comme `generer_correction.py --check` : une note par ligne, points
 * entre 0 et le maximum de la ligne, multiples de 0,25, commentaires et appréciations non vides,
 * transcription non vide. Accepte les lignes en objet (L01…, le schéma) ou en tableau.
 */
export function validateOutput(
  raw: unknown,
  questions: KitQuestion[],
): { ok: true; value: CorrectionOutput } | { ok: false; errors: string[] } {
  if (!isObj(raw)) return { ok: false, errors: ['réponse non JSON'] };
  const errors: string[] = [];

  const lines = Array.isArray(raw.questions)
    ? raw.questions
    : isObj(raw.questions)
      ? questions.map((_, i) => (raw.questions as Record<string, unknown>)[lineKey(i)])
      : null;
  const out: CorrectionOutput['questions'] = [];
  if (!lines) {
    errors.push('« questions » manquant');
  } else {
    const extra = isObj(raw.questions) ? Object.keys(raw.questions).length : lines.length;
    if (extra !== questions.length || lines.some((l) => l === undefined)) {
      errors.push(`${extra} ligne(s) notée(s), le barème en compte ${questions.length}`);
    }
    questions.forEach((q, i) => {
      const item = lines[i];
      if (!isObj(item)) return;
      const pts = item.points;
      if (typeof pts !== 'number' || !Number.isFinite(pts) || pts < 0 || pts > q.bareme) {
        errors.push(`${q.label} : ${String(pts)} pt hors barème (0 à ${q.bareme})`);
      } else if (Math.round(pts * 4) !== pts * 4) {
        errors.push(`${q.label} : ${pts} n'est pas un multiple de 0,25`);
      }
      if (!filled(item.commentaire)) errors.push(`${q.label} : commentaire vide`);
      out.push({ points: typeof pts === 'number' ? pts : 0, commentaire: String(item.commentaire ?? '').trim() });
    });
  }

  for (const champ of ['forces', 'faiblesses', 'commentaire'] as const) {
    if (!filled(raw[champ])) errors.push(`champ « ${champ} » vide`);
  }

  const tr = raw.transcription;
  const transcriptionOk =
    Array.isArray(tr) && tr.length > 0 && tr.every((t) => isObj(t) && typeof t.q === 'string' && typeof t.texte === 'string');
  if (!transcriptionOk) errors.push('transcription vide ou mal formée');

  const arb = Array.isArray(raw.a_arbitrer) ? raw.a_arbitrer : [];
  if (!Array.isArray(raw.a_arbitrer)) errors.push('« a_arbitrer » manquant');

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      questions: out,
      forces: (raw.forces as string).trim(),
      faiblesses: (raw.faiblesses as string).trim(),
      commentaire: (raw.commentaire as string).trim(),
      transcription: (tr as TranscriptItem[]).map((t) => ({ q: t.q, texte: t.texte })),
      a_arbitrer: arb
        .filter(isObj)
        .map((a) => ({
          question: String(a.question ?? ''),
          note_mise: typeof a.note_mise === 'number' ? a.note_mise : Number(a.note_mise) || 0,
          raison: String(a.raison ?? ''),
        })),
    },
  };
}

/** Note /20 arrondie au demi-point SUPÉRIEUR (calibrage Thomas), comme note_sur_20 du Correcteur. */
export function noteSur20(brut: number, total: number): number {
  const x = (brut * 20) / total;
  return Math.ceil(Number((x * 2).toFixed(6))) / 2;
}

/** Niveau d'une compétence d'après la part des points obtenus aux lignes qui lui sont rattachées. */
export function niveau(ratio: number): (typeof NIVEAUX)[number] {
  const r = Number(ratio.toFixed(6));
  if (r >= 0.8) return 'Très bonne maîtrise';
  if (r >= 0.6) return 'Satisfaisante';
  if (r >= 0.4) return 'Fragile';
  return 'Insuffisante';
}

/** Niveaux de compétence, dans l'ordre du barème. Une compétence sans ligne rattachée est omise. */
export function competenceLevels(
  kit: Pick<CorrectionKit, 'bareme'>,
  points: number[],
): { nom: string; niveau: string }[] {
  const out: { nom: string; niveau: string }[] = [];
  for (const nom of Object.keys(kit.bareme.competences)) {
    let got = 0;
    let max = 0;
    kit.bareme.questions.forEach((q, i) => {
      if ((q.competences ?? []).includes(nom)) {
        got += points[i] ?? 0;
        max += q.bareme;
      }
    });
    if (max > 0) out.push({ nom, niveau: niveau(got / max) });
  }
  return out;
}

export interface GradeFromCorrection {
  grade: number;
  grade_raw: number;
  comment: string;
  details: Record<string, unknown>;
}

/** Note, note brute et détail v1 (forme de build_details du Correcteur, + "source": "api"). */
export function buildGrade(kit: CorrectionKit, out: CorrectionOutput): GradeFromCorrection {
  const questions = kit.bareme.questions;
  const total = questions.reduce((s, q) => s + q.bareme, 0);
  const points = out.questions.map((q) => q.points);
  const brut = points.reduce((s, p) => s + p, 0);
  return {
    grade: noteSur20(brut, total),
    grade_raw: brut,
    comment: out.commentaire,
    details: {
      v: 1,
      evaluation: kit.evaluation ?? null,
      version: kit.version ?? null,
      bareme_total: total,
      note_brute: brut,
      note_forcee: false,
      questions: questions.map((q, i) => ({
        label: q.label,
        bareme: q.bareme,
        points: points[i],
        commentaire: out.questions[i].commentaire,
        competences: q.competences ?? [],
      })),
      competences: competenceLevels(kit, points),
      forces: out.forces,
      faiblesses: out.faiblesses,
      commentaire: out.commentaire,
      source: 'api',
    },
  };
}

// --------------------------------------------------------------------------- //
// Version du sujet (migration 059 : un kit par version)
// --------------------------------------------------------------------------- //

/** Version normalisée : « V4 » et « v4 » sont la même ; vide = pas de version. */
export function versionKey(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

export type KitChoice<K> =
  | { ok: true; kit: K }
  | { ok: false; error: 'no_kit' | 'version_unknown' | 'no_kit_for_version' | 'kit_version_unsure'; versions: string[] };

/**
 * Kit à utiliser pour la copie d'un élève, sans jamais deviner :
 *  - version de l'élève connue : le kit de cette version ; à défaut, un kit sans version, mais
 *    seulement si d'autres élèves de l'éval ont cette même version et aucune autre (sinon on ne
 *    sait pas sur quel sujet le kit a été écrit) ;
 *  - version inconnue : le kit s'il n'y en a qu'un, sinon refus.
 * `classVersions` : versions saisies pour les AUTRES élèves de l'éval.
 */
export function pickKit<K extends { version_key: string }>(
  kits: K[],
  studentVersion: string | null | undefined,
  classVersions: (string | null | undefined)[],
): KitChoice<K> {
  const versions = kits.map((k) => k.version_key).filter(Boolean).sort();
  if (kits.length === 0) return { ok: false, error: 'no_kit', versions };
  const mine = versionKey(studentVersion);
  if (!mine) return kits.length === 1 ? { ok: true, kit: kits[0] } : { ok: false, error: 'version_unknown', versions };

  const exact = kits.find((k) => k.version_key === mine);
  if (exact) return { ok: true, kit: exact };
  const unversioned = kits.find((k) => !k.version_key);
  if (!unversioned || versions.length > 0) return { ok: false, error: 'no_kit_for_version', versions };
  const others = new Set(classVersions.map(versionKey).filter(Boolean));
  return others.size === 1 && others.has(mine)
    ? { ok: true, kit: unversioned }
    : { ok: false, error: 'kit_version_unsure', versions };
}

/** Claude signale-t-il, dans ses points à arbitrer, une copie faite sur une autre version du sujet ? */
export function mentionsOtherVersion(arbitrages: { question?: string; raison?: string }[]): boolean {
  return arbitrages.some((a) =>
    /\bversion\b|\bv\s?\d+\b|autre sujet|ancien sujet|sujet diff[ée]rent|pas le m[êe]me sujet/i.test(`${a.question ?? ''} ${a.raison ?? ''}`),
  );
}

// --------------------------------------------------------------------------- //
// Copies de référence
// --------------------------------------------------------------------------- //

export interface ReferenceCandidate {
  student_id: string;
  grade: number;
  is_validated: boolean;
  details: unknown;
  transcript: TranscriptItem[] | null;
  /** Version du sujet saisie pour cet élève (assessment_grades.subject_version). */
  subject_version?: string | null;
}

interface RefQuestion {
  label: string;
  bareme: number;
  points: number;
  commentaire: string;
}

function refQuestions(details: unknown): RefQuestion[] | null {
  if (!isObj(details) || !Array.isArray(details.questions)) return null;
  return details.questions as RefQuestion[];
}

/**
 * Jusqu'à `n` copies de référence de la même éval, réparties sur l'éventail des notes.
 * Seules comptent les copies corrigées sur le même barème (mêmes lignes, dans le même ordre),
 * hors l'élève à corriger. Priorité : validées avec transcription, brouillons avec transcription,
 * validées sans, brouillons sans — on prend des groupes entiers jusqu'à en avoir `n`, puis on
 * retient `n` notes réparties du plus bas au plus haut.
 */
export function pickReferences(
  candidates: ReferenceCandidate[],
  kit: Pick<CorrectionKit, 'bareme'>,
  excludeStudentId: string,
  n = 5,
  studentVersion: string | null = null,
): ReferenceCandidate[] {
  const labels = kit.bareme.questions.map((q) => q.label);
  const mine = versionKey(studentVersion);
  const usable = candidates.filter((c) => {
    if (c.student_id === excludeStudentId || !Number.isFinite(c.grade)) return false;
    // Une copie d'une autre version déclarée n'est pas une référence, même si le barème coïncide.
    const theirs = versionKey(c.subject_version);
    if (mine && theirs && theirs !== mine) return false;
    const qs = refQuestions(c.details);
    return !!qs && qs.length === labels.length && qs.every((q, i) => q?.label === labels[i]);
  });
  const tier = (c: ReferenceCandidate) => (c.transcript?.length ? 0 : 2) + (c.is_validated ? 0 : 1);
  const pool: ReferenceCandidate[] = [];
  for (let t = 0; t < 4 && pool.length < n; t++) pool.push(...usable.filter((c) => tier(c) === t));

  const sorted = [...pool].sort((a, b) => a.grade - b.grade || a.student_id.localeCompare(b.student_id));
  if (sorted.length <= n) return sorted;
  const picked = new Set<number>();
  for (let i = 0; i < n; i++) picked.add(Math.round((i * (sorted.length - 1)) / (n - 1)));
  return [...picked].sort((a, b) => a - b).map((i) => sorted[i]);
}

const fr = (x: number) => String(x).replace('.', ',');

/**
 * Une copie de référence en texte : ce que l'élève a écrit, puis les points et commentaires mis.
 * Ni nom ni commentaire général (il commence par le prénom de l'élève) : rien qui identifie un
 * autre élève ne part dans la requête.
 */
export function formatReference(ref: ReferenceCandidate, index: number): string {
  const d = ref.details as Record<string, unknown>;
  const lines = [`### Copie de référence ${index + 1} — ${fr(ref.grade)}/20${ref.is_validated ? ' (validée par Thomas)' : ''}`];
  if (ref.transcript?.length) {
    lines.push('', 'Ce que l\'élève a écrit :');
    for (const t of ref.transcript) lines.push(`[${t.q}] ${t.texte || '(vide)'}`);
  } else {
    lines.push('', '(Pas de transcription pour cette copie.)');
  }
  lines.push('', 'Correction :');
  for (const q of refQuestions(d) ?? []) lines.push(`- ${q.label} : ${fr(q.points)}/${fr(q.bareme)} — ${q.commentaire}`);
  if (filled(d.forces)) lines.push(`Forces : ${d.forces}`);
  if (filled(d.faiblesses)) lines.push(`Faiblesses : ${d.faiblesses}`);
  return lines.join('\n');
}

/** Bloc stable (mis en cache) : barème, corrigé, calibrage, harmonisation. */
export function formatKitBlock(kit: CorrectionKit): string {
  const lines = [`# Évaluation : ${kit.evaluation ?? '?'}${kit.niveau ? ` (${kit.niveau})` : ''}`, '', '## Barème'];
  kit.bareme.questions.forEach((q, i) => {
    const comps = q.competences?.length ? ` — ${q.competences.join(', ')}` : '';
    lines.push(`${lineKey(i)}. ${q.label} : sur ${fr(q.bareme)}${comps}`);
  });
  const total = kit.bareme.questions.reduce((s, q) => s + q.bareme, 0);
  lines.push(`Total : ${fr(total)} points.`, '', '## Corrigé', kit.corrige.trim());
  if (kit.calibrage?.trim()) lines.push('', '## Calibrage de Thomas', kit.calibrage.trim());
  lines.push('', '## Règles d\'harmonisation de cette évaluation', kit.harmonisation?.trim() || 'Aucune.');
  return lines.join('\n');
}

/** Consigne finale, après les pages de la copie. */
export function formatTask(prenom: string, pages: number, lines: number): string {
  return [
    `Voici les ${pages} page(s) de la copie de ${prenom || 'l\'élève'}, dans l'ordre.`,
    `Corrige-la selon le barème (${lines} lignes, L01 à ${lineKey(lines - 1)}), comme les copies de référence,`,
    'transcris-la, et signale dans « a_arbitrer » ce que Thomas doit trancher.',
  ].join(' ');
}

// --------------------------------------------------------------------------- //
// Coût
// --------------------------------------------------------------------------- //

/** Tarif Claude Opus 5.5 en $ par million de tokens (écriture du cache 5 min = 1,25 × l'entrée). */
export const OPUS_55_PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };

export interface UsageTotals {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
}

export function estimateCostUsd(u: UsageTotals, price = OPUS_55_PRICE): number {
  const cost =
    (u.input_tokens * price.input +
      u.output_tokens * price.output +
      u.cache_creation_tokens * price.cacheWrite +
      u.cache_read_tokens * price.cacheRead) /
    1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}
