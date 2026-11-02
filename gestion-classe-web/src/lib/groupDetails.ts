/**
 * Détail d'une note de séance de groupe (migration 063) : {"v": 2, "type": "groupe", "groupe":
 * {nom, membres, criteres: [{label, points, max}], malus, total, bareme, seance_id}}. Écrit par la
 * base (sync_group_session_assessment), lu par la modale élève × éval. Logique pure, testée.
 */

export interface GroupCriterion {
  label: string;
  points: number;
  max: number;
}

export interface GroupDetails {
  nom: string;
  membres: string[];
  criteres: GroupCriterion[];
  malus: number;
  /** Note du groupe : points des critères moins le malus, sur `bareme`. */
  total: number;
  bareme: number;
  seanceId: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function parseGroupDetails(raw: unknown): GroupDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (d.type !== 'groupe' || !d.groupe || typeof d.groupe !== 'object') return null;
  const g = d.groupe as Record<string, unknown>;
  const total = num(g.total);
  const bareme = num(g.bareme);
  if (total === null || bareme === null) return null;
  return {
    nom: typeof g.nom === 'string' ? g.nom : '',
    membres: Array.isArray(g.membres) ? g.membres.filter((m): m is string => typeof m === 'string') : [],
    criteres: Array.isArray(g.criteres)
      ? g.criteres
          .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
          .map((c) => ({ label: typeof c.label === 'string' ? c.label : '—', points: num(c.points) ?? 0, max: num(c.max) ?? 0 }))
      : [],
    malus: num(g.malus) ?? 0,
    total,
    bareme,
    seanceId: typeof g.seance_id === 'string' ? g.seance_id : null,
  };
}

/**
 * La note de l'élève a été ajustée par le prof (elle ne suit plus le groupe) : même règle que la
 * base. Un statut autre que « noté » (absent…) compte comme un ajustement.
 */
export function isGroupGradeAdjusted(
  grade: { status: string | null; grade_raw: number | null } | null,
  details: GroupDetails | null,
): boolean {
  if (!grade || !details) return false;
  if (grade.status && grade.status !== 'noted') return true;
  return grade.grade_raw != null && Number(grade.grade_raw) !== details.total;
}
