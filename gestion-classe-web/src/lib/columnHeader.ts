import { levelFromClassName } from './boardsQueries';
import { headerTitle, shortDate } from './carnetView';
import type { AssessmentKind, AssessmentRow } from './evaluationQueries';

/**
 * En-têtes de colonnes du carnet (variante B validée le 02/11/2026) : titre lisible, ligne
 * d'infos courte, et rattachement d'une éval à la même éval passée par une autre classe
 * (série), proposé d'office quand les noms sont identiques.
 */

const KIND_SHORT: Record<AssessmentKind, string> = {
  ecrit: 'Écrit',
  dm: 'DM',
  tp: 'TP',
  oral: 'Oral',
  projet: 'Projet',
  groupe: 'Groupe',
};

/** Nom comparable : sans accents, casse, ponctuation ni espaces multiples. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const GROUP_AUTO_NAME = /^TP de groupe du \d{2}\/\d{2}$/i;

export interface ColumnLabel {
  /** Ce que la colonne affiche (deux lignes au plus). */
  title: string;
  /** « Groupe · 22/09 · /10 », plus « · coef 2 » quand le coefficient n'est pas 1. */
  meta: string;
  coefficient: number | null;
}

type LabelInput = Pick<AssessmentRow, 'id' | 'name' | 'kind' | 'date' | 'bareme_total' | 'coefficient'> & {
  short_name?: string | null;
};

/**
 * Titres des colonnes affichées. Un TP de groupe nommé automatiquement (« TP de groupe du
 * 22/09 ») devient « TP de groupe » : la date est déjà sur la ligne d'infos. Deux séances le
 * même jour sont numérotées dans l'ordre des colonnes (« · 1 », « · 2 »).
 */
export function columnLabels(items: readonly LabelInput[]): Map<string, ColumnLabel> {
  const out = new Map<string, ColumnLabel>();
  const autoGroup = (a: LabelInput) => a.kind === 'groupe' && !a.short_name?.trim() && GROUP_AUTO_NAME.test(a.name.trim());
  const perDay = new Map<string, number>();
  for (const a of items) if (autoGroup(a)) perDay.set(a.date ?? '', (perDay.get(a.date ?? '') ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const a of items) {
    let title = headerTitle(a);
    if (autoGroup(a)) {
      const day = a.date ?? '';
      const n = (seen.get(day) ?? 0) + 1;
      seen.set(day, n);
      title = (perDay.get(day) ?? 0) > 1 ? `TP de groupe · ${n}` : 'TP de groupe';
    }
    const coef = Number(a.coefficient);
    const parts = [KIND_SHORT[a.kind] ?? a.kind];
    const date = shortDate(a.date);
    if (date) parts.push(date);
    parts.push(`/${String(Number(a.bareme_total ?? 20)).replace('.', ',')}`);
    out.set(a.id, { title, meta: parts.join(' · '), coefficient: Number.isFinite(coef) && coef !== 1 ? coef : null });
  }
  return out;
}

/** Une cible de rattachement : une série existante, ou une éval seule d'une autre classe. */
export interface RelinkTarget {
  key: string;
  seriesId: string | null;
  /** Évals de la cible (une seule pour une éval seule). */
  assessmentIds: string[];
  name: string;
  classNames: string[];
  kind: AssessmentKind;
  bareme: number;
  coefficient: number;
  date: string | null;
  period: number | null;
  /** Même nom que l'éval à relier (une des évals de la cible au moins). */
  sameName: boolean;
}

type RelinkInput = Pick<
  AssessmentRow,
  'id' | 'name' | 'kind' | 'date' | 'bareme_total' | 'coefficient' | 'class_id' | 'series_id' | 'school_year' | 'period'
> & { classes?: { name: string } | null; assessment_series?: { name: string } | null };

/**
 * Évals de même niveau, même année et même type dans les autres classes, regroupées par série,
 * celles de même nom d'abord, puis celles du même trimestre. Exclut la série de l'éval elle-même
 * et toute cible qui contient déjà une éval de sa classe. Pas de TP de groupe : il suit sa séance.
 */
export function relinkTargets(current: RelinkInput, all: readonly RelinkInput[]): RelinkTarget[] {
  if (current.kind === 'groupe') return [];
  const level = levelFromClassName(current.classes?.name ?? '');
  const mine = normalizeName(current.name);
  const groups = new Map<string, RelinkInput[]>();
  for (const a of all) {
    if (a.id === current.id || a.kind !== current.kind || a.school_year !== current.school_year) continue;
    if (current.series_id && a.series_id === current.series_id) continue;
    if (level === null || levelFromClassName(a.classes?.name ?? '') !== level) continue;
    const key = a.series_id ? `s:${a.series_id}` : `a:${a.id}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const targets: RelinkTarget[] = [];
  for (const [key, items] of groups) {
    if (items.some((a) => a.class_id === current.class_id)) continue;
    const first = items[0];
    targets.push({
      key,
      seriesId: first.series_id ?? null,
      assessmentIds: items.map((a) => a.id),
      name: first.assessment_series?.name || first.name,
      classNames: items.map((a) => a.classes?.name ?? '?').sort((x, y) => x.localeCompare(y, 'fr')),
      kind: first.kind,
      bareme: Number(first.bareme_total ?? 20),
      coefficient: Number(first.coefficient),
      date: first.date,
      period: first.period,
      sameName: items.some((a) => normalizeName(a.name) === mine) || (!!first.assessment_series?.name && normalizeName(first.assessment_series.name) === mine),
    });
  }
  const samePeriod = (t: RelinkTarget) => (t.period === current.period ? 1 : 0);
  return targets.sort((x, y) =>
    Number(y.sameName) - Number(x.sameName)
    || samePeriod(y) - samePeriod(x)
    || (y.date ?? '').localeCompare(x.date ?? ''));
}

/** La cible de même nom à proposer d'office, s'il y en a une. */
export function sameNameTarget(current: RelinkInput, all: readonly RelinkInput[]): RelinkTarget | null {
  return relinkTargets(current, all).find((t) => t.sameName) ?? null;
}
