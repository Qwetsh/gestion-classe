import { supabase } from './supabase';

export interface TpTemplate {
  id: string;
  name: string;
  criteria: TpTemplateCriteria[];
}

export interface TpTemplateCriteria {
  id: string;
  label: string;
  max_points: number;
  display_order: number;
}

export interface GroupSessionData {
  id: string;
  name: string;
  status: string;
  criteria: CriteriaData[];
  groups: GroupData[];
}

export interface CriteriaData {
  id: string;
  label: string;
  max_points: number;
  display_order: number;
}

export interface GroupData {
  id: string;
  name: string;
  conduct_malus: number;
  members: { student_id: string; pseudo: string }[];
  grades: { criteria_id: string; points_awarded: number }[];
}

export async function fetchTpTemplates(userId: string): Promise<TpTemplate[]> {
  const { data, error } = await supabase
    .from('tp_templates')
    .select('id, name, tp_template_criteria (id, label, max_points, display_order)')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  if (!data || data.length === 0) return [];

  return data.map((t: any) => ({
    id: t.id,
    name: t.name,
    criteria: (t.tp_template_criteria || []).sort((a: any, b: any) => a.display_order - b.display_order),
  }));
}

export async function createGroupSession(
  userId: string,
  classId: string,
  name: string,
  criteria: { label: string; max_points: number }[],
  groups: { name: string; memberIds: string[] }[],
  templateId?: string | null,
): Promise<string> {
  // 1. Create session
  const insertPayload: Record<string, unknown> = { user_id: userId, class_id: classId, name, status: 'active', created_at: new Date().toISOString() };
  if (templateId) insertPayload.template_id = templateId;
  const { data: session, error: sessionError } = await supabase
    .from('group_sessions')
    .insert(insertPayload)
    .select('id')
    .single();
  if (sessionError) throw sessionError;
  const sessionId = session.id;

  // 2. Insert criteria
  const criteriaRows = criteria.map((c, i) => ({
    session_id: sessionId,
    label: c.label,
    max_points: c.max_points,
    display_order: i,
  }));
  const { data: insertedCriteria, error: criteriaError } = await supabase
    .from('grading_criteria')
    .insert(criteriaRows)
    .select('id, label, max_points, display_order');
  if (criteriaError) throw criteriaError;

  // 3. Insert all groups in one batch
  const groupRows = groups.map(g => ({ session_id: sessionId, name: g.name, conduct_malus: 0 }));
  const { data: insertedGroups, error: grpError } = await supabase
    .from('session_groups')
    .insert(groupRows)
    .select('id');
  if (grpError) throw grpError;

  // 4. Batch insert all members and grades in parallel
  const allMemberRows: { group_id: string; student_id: string }[] = [];
  const allGradeRows: { group_id: string; criteria_id: string; points_awarded: number }[] = [];

  (insertedGroups || []).forEach((grp, i) => {
    const g = groups[i];
    g.memberIds.forEach(sid => allMemberRows.push({ group_id: grp.id, student_id: sid }));
    if (insertedCriteria) {
      insertedCriteria.forEach(c => allGradeRows.push({ group_id: grp.id, criteria_id: c.id, points_awarded: 0 }));
    }
  });

  const batchInserts: Promise<any>[] = [];
  if (allMemberRows.length > 0) {
    batchInserts.push(
      Promise.resolve(supabase.from('session_group_members').insert(allMemberRows)).then(({ error }) => { if (error) throw error; })
    );
  }
  if (allGradeRows.length > 0) {
    batchInserts.push(
      Promise.resolve(supabase.from('group_grades').insert(allGradeRows)).then(({ error }) => { if (error) throw error; })
    );
  }
  await Promise.all(batchInserts);

  return sessionId;
}

export async function loadGroupSession(sessionId: string): Promise<GroupSessionData> {
  // Parallel: session + criteria + groups (with nested members and grades)
  const [
    { data: session, error: sErr },
    { data: criteria },
    { data: groups },
  ] = await Promise.all([
    supabase.from('group_sessions').select('id, name, status').eq('id', sessionId).single(),
    supabase.from('grading_criteria').select('id, label, max_points, display_order').eq('session_id', sessionId).order('display_order'),
    supabase.from('session_groups').select('id, name, conduct_malus').eq('session_id', sessionId),
  ]);
  if (sErr) throw sErr;

  const groupIds = (groups || []).map(g => g.id);

  let allMembers: any[] = [];
  let allGrades: any[] = [];

  if (groupIds.length > 0) {
    // Batch fetch all members and grades in parallel
    const [{ data: membersData }, { data: gradesData }] = await Promise.all([
      supabase.from('session_group_members').select('group_id, student_id, students(pseudo)').in('group_id', groupIds),
      supabase.from('group_grades').select('group_id, criteria_id, points_awarded').in('group_id', groupIds),
    ]);
    allMembers = membersData || [];
    allGrades = gradesData || [];
  }

  const groupsData: GroupData[] = (groups || []).map(g => ({
    ...g,
    members: allMembers
      .filter(m => m.group_id === g.id)
      .map((m: any) => ({ student_id: m.student_id, pseudo: m.students?.pseudo || '?' })),
    grades: allGrades
      .filter(gr => gr.group_id === g.id)
      .map((gr: any) => ({ criteria_id: gr.criteria_id, points_awarded: gr.points_awarded })),
  }));

  return {
    ...session,
    criteria: criteria || [],
    groups: groupsData,
  };
}

export async function updateGrade(
  groupId: string,
  criteriaId: string,
  points: number
): Promise<void> {
  // Upsert: try update first, then insert
  const { data: existing } = await supabase
    .from('group_grades')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('criteria_id', criteriaId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('group_grades')
      .update({ points_awarded: points })
      .eq('group_id', groupId)
      .eq('criteria_id', criteriaId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('group_grades')
      .insert({ group_id: groupId, criteria_id: criteriaId, points_awarded: points });
    if (error) throw error;
  }
}

export async function updateMalus(groupId: string, malus: number): Promise<void> {
  const { error } = await supabase
    .from('session_groups')
    .update({ conduct_malus: malus })
    .eq('id', groupId);
  if (error) throw error;
}

export async function completeGroupSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('group_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (error) throw error;
}
