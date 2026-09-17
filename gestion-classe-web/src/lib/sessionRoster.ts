/**
 * Règles de résolution d'une séance en groupe de classe (fonctions pures).
 * Jumeau de gestion-classe-mobile/utils/sessionRoster.ts (testé là-bas) : garder les deux identiques.
 *
 *  - Roster : group_id null -> toute la classe ; sinon -> membres du groupe.
 *    Cette liste alimente la grille ET toutes les listes (présents, tirage au sort, oral...).
 *  - Plan : plan de groupe s'il existe et a au moins une position, sinon plan de la classe
 *    entière, sinon rien. Dans tous les cas les positions sont filtrées par le roster :
 *    un id hors roster = place vide (élève de l'autre groupe, élève supprimé, position périmée).
 *  - Alternance : le groupe proposé est le suivant (cyclique, ordre sort_order puis nom) de
 *    celui de la dernière séance EN GROUPE de la classe. Sans séance en groupe : classe entière.
 */

export type RosterPositions = Record<string, string>; // "row,col" -> student_id

export type RosterPlanSource = 'group-plan' | 'class-plan' | 'none';

export interface ResolveRosterInput<S extends { id: string }> {
  classStudents: S[];
  /** Groupe de la séance ; null = classe entière */
  groupId: string | null;
  /** Ids des membres du groupe (ignoré quand groupId est null) */
  memberIds?: Iterable<string> | null;
  /** class_group_plans(classe, salle, groupe) */
  groupPlanPositions?: RosterPositions | null;
  /** class_room_plans(classe, salle) */
  classPlanPositions?: RosterPositions | null;
}

export interface SessionRoster<S extends { id: string }> {
  students: S[];
  positions: RosterPositions;
  planSource: RosterPlanSource;
}

function hasPositions(p: RosterPositions | null | undefined): p is RosterPositions {
  return !!p && Object.keys(p).length > 0;
}

export function resolveSessionRoster<S extends { id: string }>(
  input: ResolveRosterInput<S>
): SessionRoster<S> {
  const { classStudents, groupId } = input;

  let students: S[];
  if (groupId) {
    const members = new Set(input.memberIds ?? []);
    students = classStudents.filter(s => members.has(s.id));
  } else {
    students = classStudents;
  }

  let source: RosterPlanSource = 'none';
  let raw: RosterPositions = {};
  if (groupId && hasPositions(input.groupPlanPositions)) {
    source = 'group-plan';
    raw = input.groupPlanPositions;
  } else if (hasPositions(input.classPlanPositions)) {
    source = 'class-plan';
    raw = input.classPlanPositions;
  }

  const rosterIds = new Set(students.map(s => s.id));
  const positions: RosterPositions = {};
  for (const [cell, studentId] of Object.entries(raw)) {
    if (rosterIds.has(studentId)) positions[cell] = studentId;
  }

  return { students, positions, planSource: source };
}

export interface GroupLike {
  id: string;
  name: string;
  sort_order: number;
}

/** Ordre d'affichage des groupes : sort_order puis nom. */
export function sortClassGroups<G extends GroupLike>(groups: G[]): G[] {
  return [...groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'fr'));
}

/**
 * Groupe à présélectionner au démarrage d'une séance.
 * @param lastGroupId groupe de la dernière séance EN GROUPE de la classe (null si aucune)
 * @returns id du groupe proposé, ou null pour « classe entière »
 */
export function nextGroupForClass(groups: GroupLike[], lastGroupId: string | null): string | null {
  if (groups.length === 0 || !lastGroupId) return null;
  const ordered = sortClassGroups(groups);
  const idx = ordered.findIndex(g => g.id === lastGroupId);
  if (idx === -1) return null; // groupe supprimé depuis : on ne devine pas
  return ordered[(idx + 1) % ordered.length].id;
}

/**
 * Répartition automatique d'une liste d'élèves en n groupes (fonction pure).
 *  - 'alphabetical' : tranches consécutives (A-L / M-Z)
 *  - 'alternate'    : 1 sur n (A->G1, B->G2, C->G1...)
 *  - 'random'       : mélange puis tranches (rng injectable pour les tests)
 * Renvoie un tableau de n listes d'ids, effectifs équilibrés à 1 près.
 */
export type AutoSplitMode = 'alphabetical' | 'alternate' | 'random';

export function autoSplit<S extends { id: string; pseudo: string }>(
  students: S[],
  groupCount: number,
  mode: AutoSplitMode,
  rng: () => number = Math.random
): string[][] {
  const n = Math.max(1, Math.floor(groupCount));
  const buckets: string[][] = Array.from({ length: n }, () => []);
  if (students.length === 0) return buckets;

  const ordered = [...students].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
  if (mode === 'random') {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }
  }

  if (mode === 'alternate') {
    ordered.forEach((s, i) => buckets[i % n].push(s.id));
    return buckets;
  }

  // tranches consécutives, les premières tranches prennent le reste
  const base = Math.floor(ordered.length / n);
  const extra = ordered.length % n;
  let cursor = 0;
  for (let g = 0; g < n; g++) {
    const size = base + (g < extra ? 1 : 0);
    buckets[g] = ordered.slice(cursor, cursor + size).map(s => s.id);
    cursor += size;
  }
  return buckets;
}
