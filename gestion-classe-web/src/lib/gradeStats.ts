/**
 * Carnet de notes — calculs (cf. PLAN_carnet_de_notes.md §4).
 *
 * Module pur : aucun accès réseau, aucune dépendance React. Toute la logique qui décide
 * si une note pèse dans une moyenne vit ici, et nulle part ailleurs — c'est l'endroit où
 * une erreur fausse un bulletin sans que personne ne s'en aperçoive.
 */

// ============================================================
// Types
// ============================================================

/**
 * Pourquoi il n'y a pas de note. Distinct de `is_validated`, qui est le cycle de vie
 * du pipeline de correction de copies scannées.
 *
 * - `noted`          : note attendue. `grade === null` = pas encore corrigée.
 * - `absent`         : l'élève n'était pas là. Exclu de la moyenne.
 * - `dispense`       : dispensé (arrivée en cours d'année, PAP, inaptitude). Exclu.
 * - `non_rendu`      : n'a pas rendu, sans sanction chiffrée. Exclu.
 * - `non_rendu_zero` : n'a pas rendu, compte comme un zéro.
 */
export type GradeStatus = 'noted' | 'absent' | 'dispense' | 'non_rendu' | 'non_rendu_zero';

export const GRADE_STATUSES: readonly GradeStatus[] = [
  'noted', 'absent', 'dispense', 'non_rendu', 'non_rendu_zero',
] as const;

/** Libellés courts affichés dans une cellule du carnet. */
export const STATUS_SHORT: Record<Exclude<GradeStatus, 'noted'>, string> = {
  absent: 'abs',
  dispense: 'disp',
  non_rendu: 'n.r.',
  non_rendu_zero: 'n.r. (0)',
};

/** Libellés longs (menus, légendes, export). */
export const STATUS_LABEL: Record<GradeStatus, string> = {
  noted: 'Notée',
  absent: 'Absent',
  dispense: 'Dispensé',
  non_rendu: 'Non rendu',
  non_rendu_zero: 'Non rendu (compte 0)',
};

/** Une note d'un élève à une évaluation, ramenée sur 20. */
export interface GradeEntry {
  studentId: string;
  /** Note /20, ou `null` si non renseignée. */
  grade: number | null;
  status: GradeStatus;
}

/** Ce qu'il faut d'une évaluation pour pondérer une moyenne. */
export interface AssessmentWeight {
  coefficient: number;
  countsInAverage: boolean;
}

export interface Histogram {
  /** Borne basse de la tranche (0, 2, 4 … 18). */
  from: number;
  /** Borne haute, incluse seulement pour la dernière tranche. */
  to: number;
  count: number;
}

export interface GradeStats {
  /** Nombre de notes entrant dans le calcul. */
  count: number;
  mean: number | null;
  median: number | null;
  /** Écart-type de population (et non d'échantillon). */
  stdDev: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
  /** Part de notes ≥ 10/20, entre 0 et 1. `null` si aucune note exploitable. */
  successRate: number | null;
  histogram: Histogram[];
  /** Effectifs par statut, sur l'ensemble des lignes fournies. */
  statusCounts: Record<GradeStatus, number>;
  /** Lignes de statut `noted` sans note saisie : le reste à corriger. */
  pending: number;
}

// ============================================================
// Conversion et admission d'une note
// ============================================================

/**
 * Convertit en nombre exploitable, ou `null`.
 *
 * Les colonnes `numeric` de Postgres peuvent revenir en chaîne selon le client et la
 * version : `Number.isFinite("12")` vaut `false`, ce qui **exclurait silencieusement
 * la note de la moyenne**. Tout ce qui vient de la base passe par ici.
 */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Ramène une note brute sur 20 selon le barème de l'évaluation.
 * Un barème absent, nul ou négatif est ignoré : la note brute est déjà sur 20.
 */
export function toTwenty(raw: number | null, baremeTotal: number | null | undefined): number | null {
  const r = toNumber(raw);
  if (r === null) return null;
  const b = toNumber(baremeTotal);
  if (b === null || b <= 0) return r;
  return (r * 20) / b;
}

/**
 * La valeur qui entre réellement dans une moyenne, ou `null` si la ligne en est exclue.
 *
 * C'est LA fonction à ne pas se tromper : un `absent` traité comme un zéro fait chuter
 * une moyenne de classe sans laisser de trace.
 */
export function effectiveGrade(entry: GradeEntry): number | null {
  switch (entry.status) {
    case 'non_rendu_zero':
      return 0;
    case 'absent':
    case 'dispense':
    case 'non_rendu':
      return null;
    case 'noted':
      // Pas encore corrigée : exclue tant qu'aucune note n'est saisie.
      return toNumber(entry.grade);
  }
}

/** Les valeurs retenues pour le calcul, triées — base de tous les indicateurs. */
function sortedValues(entries: readonly GradeEntry[]): number[] {
  const values: number[] = [];
  for (const e of entries) {
    const v = effectiveGrade(e);
    if (v !== null) values.push(v);
  }
  return values.sort((a, b) => a - b);
}

// ============================================================
// Indicateurs
// ============================================================

/**
 * Quantile par interpolation linéaire (méthode R-7, celle de `PERCENTILE.INC` d'Excel).
 * Ce choix garantit que l'export XLSX et l'écran affichent les mêmes chiffres.
 *
 * @param sorted - valeurs déjà triées par ordre croissant.
 * @param p - entre 0 et 1.
 */
export function quantile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const h = (sorted.length - 1) * Math.min(Math.max(p, 0), 1);
  const lo = Math.floor(h);
  const frac = h - lo;
  if (frac === 0) return sorted[lo];
  return sorted[lo] + frac * (sorted[lo + 1] - sorted[lo]);
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Écart-type de population : on décrit une classe entière, pas un échantillon tiré d'elle. */
export function stdDev(values: readonly number[]): number | null {
  const m = mean(values);
  if (m === null) return null;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** 10 tranches de 2 points. La dernière inclut 20. */
export function histogram(values: readonly number[]): Histogram[] {
  const buckets: Histogram[] = Array.from({ length: 10 }, (_, i) => ({
    from: i * 2,
    to: i * 2 + 2,
    count: 0,
  }));
  for (const v of values) {
    const i = Math.min(9, Math.max(0, Math.floor(v / 2)));
    buckets[i].count += 1;
  }
  return buckets;
}

function emptyStatusCounts(): Record<GradeStatus, number> {
  return { noted: 0, absent: 0, dispense: 0, non_rendu: 0, non_rendu_zero: 0 };
}

/**
 * Statistiques d'une évaluation pour une classe.
 * Les lignes exclues (absent, dispensé, non rendu, pas encore corrigée) sortent du
 * dénominateur mais restent comptées dans `statusCounts`.
 */
export function describeGrades(entries: readonly GradeEntry[]): GradeStats {
  const values = sortedValues(entries);
  const statusCounts = emptyStatusCounts();
  let pending = 0;
  for (const e of entries) {
    statusCounts[e.status] += 1;
    if (e.status === 'noted' && effectiveGrade(e) === null) pending += 1;
  }

  return {
    count: values.length,
    mean: mean(values),
    median: quantile(values, 0.5),
    stdDev: stdDev(values),
    min: values.length ? values[0] : null,
    max: values.length ? values[values.length - 1] : null,
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    successRate: values.length ? values.filter((v) => v >= 10).length / values.length : null,
    histogram: histogram(values),
    statusCounts,
    pending,
  };
}

// ============================================================
// Moyennes pondérées
// ============================================================

export interface WeightedValue {
  value: number;
  coefficient: number;
}

/**
 * Moyenne pondérée. Les coefficients nuls ou négatifs sont ignorés : un coefficient 0
 * revient à ne pas compter l'évaluation, et un total de poids nul n'a pas de moyenne.
 */
export function weightedAverage(items: readonly WeightedValue[]): number | null {
  let sum = 0;
  let weight = 0;
  for (const it of items) {
    const c = toNumber(it.coefficient);
    const v = toNumber(it.value);
    if (c === null || c <= 0 || v === null) continue;
    sum += v * c;
    weight += c;
  }
  return weight > 0 ? sum / weight : null;
}

/**
 * Moyenne d'un élève sur une période : parcourt ses notes, écarte celles qui ne comptent
 * pas (statut exclu, évaluation `counts_in_average = false`, coefficient nul) et pondère.
 *
 * @param rows - les notes de l'élève, chacune accompagnée du poids de son évaluation.
 */
export function studentAverage(
  rows: readonly { entry: GradeEntry; assessment: AssessmentWeight }[],
): number | null {
  const items: WeightedValue[] = [];
  for (const { entry, assessment } of rows) {
    if (!assessment.countsInAverage) continue;
    const value = effectiveGrade(entry);
    if (value === null) continue;
    items.push({ value, coefficient: toNumber(assessment.coefficient) ?? 0 });
  }
  return weightedAverage(items);
}

// ============================================================
// Affichage
// ============================================================

/**
 * Formate une note ou un indicateur pour l'écran. Une valeur absente s'affiche « — »,
 * jamais `NaN` ni `0` : afficher un zéro pour « pas de données » est précisément
 * l'erreur qui fait croire à une classe en échec.
 */
export function formatGrade(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals).replace('.', ',');
}

/** Pourcentage affichable, « — » si indisponible. */
export function formatRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)} %`;
}

// ============================================================
// Saisie
// ============================================================

export interface ParsedCell {
  status: GradeStatus;
  /** Note brute saisie (sur le barème de l'évaluation), `null` si le statut n'en porte pas. */
  raw: number | null;
}

/** Raccourcis clavier d'un statut, saisis à la place d'un nombre. */
const STATUS_SHORTCUTS: Record<string, GradeStatus> = {
  a: 'absent',
  d: 'dispense',
  n: 'non_rendu',
  z: 'non_rendu_zero',
};

/**
 * Interprète ce qui a été tapé dans une cellule du carnet.
 *
 * Accepte la virgule comme séparateur décimal (c'est ce qu'on tape en français), les
 * espaces parasites, et les raccourcis de statut. Renvoie `null` si la saisie n'est pas
 * exploitable — l'appelant garde alors la valeur précédente et signale l'erreur.
 *
 * @param baremeTotal - barème de l'évaluation, pour rejeter une note hors bornes.
 */
export function parseGradeCell(input: string, baremeTotal: number | null | undefined): ParsedCell | null {
  const text = input.trim().toLowerCase();

  // Cellule vidée : on repasse en « pas encore corrigée », sans perdre la ligne.
  if (text === '') return { status: 'noted', raw: null };

  const shortcut = STATUS_SHORTCUTS[text];
  if (shortcut) return { status: shortcut, raw: null };

  const numeric = Number(text.replace(',', '.'));
  if (!Number.isFinite(numeric)) return null;

  const max = baremeTotal && baremeTotal > 0 ? baremeTotal : 20;
  if (numeric < 0 || numeric > max) return null;

  return { status: 'noted', raw: numeric };
}
