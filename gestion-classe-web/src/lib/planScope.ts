/**
 * Plan de classe « de la classe entière » ou « d'un groupe de classe » (PLAN_groupes_classe.md, lot 4).
 *
 * L'éditeur de plan travaille sur une portée : la classe entière (`class_room_plans`) ou un de ses
 * groupes (`class_group_plans`). Ces fonctions pures disent quels élèves on y place et quelles
 * positions on garde ; les lectures et écritures sont dans `classesPageQueries.ts`.
 */

/** Positions d'un plan : « ligne-colonne » → identifiant d'élève. */
export type PlanPositions = Record<string, string>;

/** Les élèves à placer : ceux du groupe, ou toute la classe quand aucun groupe n'est choisi. */
export function studentsInScope<S extends { id: string }>(
  students: readonly S[],
  members: readonly { group_id: string; student_id: string }[],
  groupId: string | null,
): S[] {
  if (!groupId) return [...students];
  const inGroup = new Set(members.filter((m) => m.group_id === groupId).map((m) => m.student_id));
  return students.filter((s) => inGroup.has(s.id));
}

/** Ne garde que les places occupées par un de ces élèves (élève parti du groupe, de la classe, supprimé). */
export function keepPlacedStudents(positions: PlanPositions | null | undefined, students: readonly { id: string }[]): PlanPositions {
  const ids = new Set(students.map((s) => s.id));
  const kept: PlanPositions = {};
  for (const [cell, studentId] of Object.entries(positions ?? {})) {
    if (ids.has(studentId)) kept[cell] = studentId;
  }
  return kept;
}

/** Effectif de chaque groupe. */
export function groupSizes(members: readonly { group_id: string }[]): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const m of members) sizes[m.group_id] = (sizes[m.group_id] ?? 0) + 1;
  return sizes;
}
