import type { CopyOverview, CopyStage } from './copyStatus';
import { effectiveDocPath, type AssessmentDocKind, type AssessmentRow } from './evaluationQueries';

/**
 * Une évaluation telle que le prof la pense : *un* devoir, même s'il existe une ligne
 * par classe en base. Les lignes d'une même série sont repliées en une seule entrée ;
 * le sujet et le corrigé sont communs, seules les copies et les notes sont par classe.
 * Logique pure, partagée par la liste des évals et la fiche d'une éval.
 */
export interface AssessmentGroup {
  key: string;
  name: string;
  /** NULL pour une éval d'une seule classe, créée hors série. */
  seriesId: string | null;
  /** Une entrée par classe, triée par nom de classe. */
  items: AssessmentRow[];
}

export const STAGE_ORDER: CopyStage[] = ['vide', 'scan', 'scannee', 'corrigee', 'validee', 'publiee'];

export function groupKeyOf(a: Pick<AssessmentRow, 'id' | 'series_id'>): string {
  return a.series_id ? `series:${a.series_id}` : `solo:${a.id}`;
}

export function groupAssessments(rows: AssessmentRow[]): AssessmentGroup[] {
  const map = new Map<string, AssessmentGroup>();
  for (const a of rows) {
    const key = groupKeyOf(a);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: a.assessment_series?.name ?? a.name,
        seriesId: a.series_id,
        items: [],
      });
    }
    map.get(key)!.items.push(a);
  }
  for (const g of map.values()) {
    g.items.sort((x, y) => (x.classes?.name ?? '').localeCompare(y.classes?.name ?? ''));
  }
  return [...map.values()];
}

/** Le groupe qui contient une éval donnée (série entière, ou l'éval seule). */
export function groupOf(rows: AssessmentRow[], assessmentId: string): AssessmentGroup | null {
  const target = rows.find((a) => a.id === assessmentId);
  if (!target) return null;
  const key = groupKeyOf(target);
  return groupAssessments(rows.filter((a) => groupKeyOf(a) === key))[0] ?? null;
}

/**
 * Étape d'une éval repliée sur plusieurs classes : la moins avancée des classes qui ont
 * des copies (une série n'est « scannée » que si toutes ses classes le sont).
 */
export function groupStage(group: AssessmentGroup, overviews: Record<string, CopyOverview>): CopyStage | null {
  const stages = group.items
    .map((a) => overviews[a.id])
    .filter((o): o is CopyOverview => !!o && (o.stage !== 'vide' || o.scanned > 0))
    .map((o) => o.stage);
  if (stages.length === 0) return null;
  return stages.reduce((min, st) => (STAGE_ORDER.indexOf(st) < STAGE_ORDER.indexOf(min) ? st : min));
}

/** Chemin du document à afficher pour un groupe : celui de la série, sinon celui de l'éval. */
export function groupDocPath(group: AssessmentGroup, kind: AssessmentDocKind): string | null {
  const series = group.items[0]?.assessment_series ?? null;
  if (group.seriesId && series) {
    const shared = kind === 'subject' ? series.subject_path : series.correction_path;
    if (shared) return shared;
  }
  for (const a of group.items) {
    const own = effectiveDocPath(a, kind);
    if (own) return own;
  }
  return null;
}

/** « jeu. 2 oct. » : la date d'une séance ou d'une éval, telle qu'on la lit sur une ligne de classe. */
export function formatSession(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Il y a quelque chose à ouvrir : des copies scannées ou des notes (brouillons compris). */
export function hasCopyContent(o: CopyOverview | undefined): boolean {
  return !!o && (o.scanned > 0 || o.graded > 0 || o.transcribed > 0);
}

/** Les copies ne concernent que l'écrit et le devoir maison. */
export function hasCopies(a: Pick<AssessmentRow, 'kind'>): boolean {
  return a.kind === 'ecrit' || a.kind === 'dm';
}

/** Brouillons du Correcteur qui attendent la validation du prof, pour une classe. */
export function pendingDrafts(o: CopyOverview | undefined): number {
  return o ? Math.max(0, o.graded - o.validated) : 0;
}

/**
 * Libellé court de l'étape, tel qu'on le lit dans un en-tête : il dit quoi faire plutôt
 * que ce qui a été fait (« À valider (3) » plutôt que « Corrigée »).
 */
export function stageLabel(o: CopyOverview): string {
  switch (o.stage) {
    case 'vide': return 'Pas de copie';
    case 'scan': return `Scan ${o.scanned}/${o.total}`;
    case 'scannee': return 'Scannée';
    case 'corrigee': {
      const n = pendingDrafts(o);
      return n > 0 ? `À valider (${n})` : 'Corrigée';
    }
    case 'validee': return 'Validée';
    case 'publiee': return 'Publiée';
  }
}
