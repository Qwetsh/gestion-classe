/**
 * Groupes de classe (demi-groupes durables) : groupes, appartenance, plans par groupe.
 *
 * À ne PAS confondre avec les groupes de TP (groupSessionQueries : session_groups,
 * session_group_members), éphémères et notés.
 *
 * Tables : class_groups, class_group_members, class_group_plans (migration 037).
 * class_room_plans n'est pas touchée : les plans de groupe vivent dans leur propre table.
 */
import { supabase } from './supabase';
import { autoSplit, type AutoSplitMode } from './sessionRoster';

export interface ClassGroupInfo {
  id: string;
  class_id: string;
  name: string;
  color: string | null; // clé de palette, pas un hex
  sort_order: number;
}

export interface ClassGroupMemberInfo {
  id: string;
  group_id: string;
  student_id: string;
}

export interface ClassGroupPlanInfo {
  id: string;
  class_id: string;
  room_id: string;
  group_id: string;
  positions: Record<string, string>;
}

// ============================================
// Groupes
// ============================================

export async function fetchClassGroups(classId: string): Promise<ClassGroupInfo[]> {
  const { data, error } = await supabase
    .from('class_groups')
    .select('id, class_id, name, color, sort_order')
    .eq('class_id', classId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as ClassGroupInfo[];
}

/** Tous les groupes de l'enseignant, pour les écrans qui listent plusieurs classes. */
export async function fetchClassGroupsForUser(userId: string): Promise<ClassGroupInfo[]> {
  const { data, error } = await supabase
    .from('class_groups')
    .select('id, class_id, name, color, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as ClassGroupInfo[];
}

export async function createClassGroup(
  userId: string,
  classId: string,
  name: string,
  options: { color?: string | null; sortOrder?: number } = {}
): Promise<ClassGroupInfo> {
  let sortOrder = options.sortOrder;
  if (sortOrder === undefined) {
    const { data } = await supabase
      .from('class_groups')
      .select('sort_order')
      .eq('class_id', classId)
      .order('sort_order', { ascending: false })
      .limit(1);
    sortOrder = data && data.length > 0 ? (data[0].sort_order as number) + 1 : 0;
  }
  const { data, error } = await supabase
    .from('class_groups')
    .insert({ user_id: userId, class_id: classId, name: name.trim(), color: options.color ?? null, sort_order: sortOrder })
    .select('id, class_id, name, color, sort_order')
    .single();
  if (error) throw error;
  return data as ClassGroupInfo;
}

export async function updateClassGroup(
  groupId: string,
  updates: { name?: string; color?: string | null; sort_order?: number }
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.color !== undefined) payload.color = updates.color;
  if (updates.sort_order !== undefined) payload.sort_order = updates.sort_order;
  const { error } = await supabase.from('class_groups').update(payload).eq('id', groupId);
  if (error) throw error;
}

/**
 * Supprime un groupe. Membres et plans de groupe partent en CASCADE ; les séances passées
 * du groupe redeviennent « classe entière » (sessions.group_id ON DELETE SET NULL).
 */
export async function deleteClassGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from('class_groups').delete().eq('id', groupId);
  if (error) throw error;
}

// ============================================
// Appartenance
// ============================================

export async function fetchGroupMembers(classId: string): Promise<ClassGroupMemberInfo[]> {
  const { data, error } = await supabase
    .from('class_group_members')
    .select('id, group_id, student_id, class_groups!inner(class_id)')
    .eq('class_groups.class_id', classId);
  if (error) throw error;
  return (data || []).map(r => ({ id: r.id, group_id: r.group_id, student_id: r.student_id }));
}

/** Ids des membres d'un groupe donné. */
export async function fetchMemberIds(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('class_group_members')
    .select('student_id')
    .eq('group_id', groupId);
  if (error) throw error;
  return (data || []).map(r => r.student_id as string);
}

export async function addMember(groupId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('class_group_members')
    .upsert({ group_id: groupId, student_id: studentId }, { onConflict: 'group_id,student_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeMember(groupId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('class_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('student_id', studentId);
  if (error) throw error;
}

/**
 * Transvasement EXCLUSIF : l'élève quitte tous les groupes de la classe et rejoint
 * `toGroupId` (null = « non affecté »). C'est LE geste de la vue Répartition.
 */
export async function moveStudent(classId: string, studentId: string, toGroupId: string | null): Promise<void> {
  const groups = await fetchClassGroups(classId);
  const otherIds = groups.map(g => g.id).filter(id => id !== toGroupId);
  if (otherIds.length > 0) {
    const { error } = await supabase
      .from('class_group_members')
      .delete()
      .eq('student_id', studentId)
      .in('group_id', otherIds);
    if (error) throw error;
  }
  if (toGroupId) await addMember(toGroupId, studentId);
}

/** Échange 1 <-> 1 : A prend la place de B et inversement (exclusif). */
export async function swapStudents(
  classId: string,
  studentA: string,
  groupA: string | null,
  studentB: string,
  groupB: string | null
): Promise<void> {
  await moveStudent(classId, studentA, groupB);
  await moveStudent(classId, studentB, groupA);
}

/**
 * Remplace l'effectif d'un groupe (répartition automatique, import depuis un plan de salle).
 * Ajoute les manquants, retire les autres, ne touche pas à ceux déjà présents.
 */
export async function replaceMembers(groupId: string, studentIds: string[]): Promise<void> {
  const wanted = new Set(studentIds);
  const current = await fetchMemberIds(groupId);
  const toRemove = current.filter(id => !wanted.has(id));
  const toAdd = studentIds.filter(id => !current.includes(id));
  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('class_group_members')
      .delete()
      .eq('group_id', groupId)
      .in('student_id', toRemove);
    if (error) throw error;
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('class_group_members')
      .upsert(toAdd.map(sid => ({ group_id: groupId, student_id: sid })), { onConflict: 'group_id,student_id', ignoreDuplicates: true });
    if (error) throw error;
  }
}

/**
 * Répartition automatique : vide et re-remplit chaque groupe (dans l'ordre donné) avec les
 * élèves fournis. Exclusive par construction.
 */
export async function applyAutoSplit(
  groups: ClassGroupInfo[],
  students: { id: string; pseudo: string }[],
  mode: AutoSplitMode
): Promise<void> {
  const buckets = autoSplit(students, groups.length, mode);
  for (let i = 0; i < groups.length; i++) {
    await replaceMembers(groups[i].id, buckets[i]);
  }
}

/** Élèves placés dans le plan de classe (classe, salle) — pour importer un groupe depuis une fausse salle. */
export async function fetchRoomPlanStudentIds(classId: string, roomId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('class_room_plans')
    .select('positions')
    .eq('class_id', classId)
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  const positions = (data?.positions || {}) as Record<string, string>;
  return [...new Set(Object.values(positions))];
}

/**
 * Crée un groupe à partir des élèves placés dans un plan de salle existant
 * (migration du bricolage « une salle par groupe »).
 */
export async function createGroupFromRoomPlan(
  userId: string,
  classId: string,
  roomId: string,
  name: string
): Promise<ClassGroupInfo> {
  const studentIds = await fetchRoomPlanStudentIds(classId, roomId);
  const group = await createClassGroup(userId, classId, name);
  if (studentIds.length > 0) await replaceMembers(group.id, studentIds);
  return group;
}

// ============================================
// Plans par groupe
// ============================================

export async function fetchGroupPlan(
  classId: string,
  roomId: string,
  groupId: string
): Promise<ClassGroupPlanInfo | null> {
  const { data, error } = await supabase
    .from('class_group_plans')
    .select('id, class_id, room_id, group_id, positions')
    .eq('class_id', classId)
    .eq('room_id', roomId)
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, positions: (data.positions || {}) as Record<string, string> } as ClassGroupPlanInfo;
}

export async function saveGroupPlan(
  userId: string,
  classId: string,
  roomId: string,
  groupId: string,
  positions: Record<string, string>
): Promise<void> {
  const { error } = await supabase
    .from('class_group_plans')
    .upsert(
      { user_id: userId, class_id: classId, room_id: roomId, group_id: groupId, positions, updated_at: new Date().toISOString() },
      { onConflict: 'class_id,room_id,group_id' }
    );
  if (error) throw error;
}

export async function deleteGroupPlan(classId: string, roomId: string, groupId: string): Promise<void> {
  const { error } = await supabase
    .from('class_group_plans')
    .delete()
    .eq('class_id', classId)
    .eq('room_id', roomId)
    .eq('group_id', groupId);
  if (error) throw error;
}

// ============================================
// Séances
// ============================================

/** Groupe de la dernière séance EN GROUPE de la classe (pour l'alternance), null sinon. */
export async function fetchLastGroupIdForClass(classId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('group_id')
    .eq('class_id', classId)
    .not('group_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.group_id as string | null) ?? null;
}
