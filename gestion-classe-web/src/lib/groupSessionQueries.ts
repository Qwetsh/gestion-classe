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
    .select('id, name')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const templates: TpTemplate[] = [];
  for (const t of data) {
    const { data: criteria } = await supabase
      .from('tp_template_criteria')
      .select('id, label, max_points, display_order')
      .eq('template_id', t.id)
      .order('display_order');
    templates.push({ ...t, criteria: criteria || [] });
  }
  return templates;
}

export async function createGroupSession(
  userId: string,
  classId: string,
  name: string,
  criteria: { label: string; max_points: number }[],
  groups: { name: string; memberIds: string[] }[]
): Promise<string> {
  // 1. Create session
  const { data: session, error: sessionError } = await supabase
    .from('group_sessions')
    .insert({ user_id: userId, class_id: classId, name, status: 'active', created_at: new Date().toISOString() })
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

  // 3. Insert groups + members
  for (const g of groups) {
    const { data: grp, error: grpError } = await supabase
      .from('session_groups')
      .insert({ session_id: sessionId, name: g.name, conduct_malus: 0 })
      .select('id')
      .single();
    if (grpError) throw grpError;

    if (g.memberIds.length > 0) {
      const memberRows = g.memberIds.map(sid => ({ group_id: grp.id, student_id: sid }));
      const { error: memError } = await supabase
        .from('session_group_members')
        .insert(memberRows);
      if (memError) throw memError;
    }

    // Initialize grades to 0
    if (insertedCriteria) {
      const gradeRows = insertedCriteria.map(c => ({
        group_id: grp.id,
        criteria_id: c.id,
        points_awarded: 0,
      }));
      const { error: gradeError } = await supabase
        .from('group_grades')
        .insert(gradeRows);
      if (gradeError) throw gradeError;
    }
  }

  return sessionId;
}

export async function loadGroupSession(sessionId: string): Promise<GroupSessionData> {
  const { data: session, error: sErr } = await supabase
    .from('group_sessions')
    .select('id, name, status')
    .eq('id', sessionId)
    .single();
  if (sErr) throw sErr;

  const { data: criteria } = await supabase
    .from('grading_criteria')
    .select('id, label, max_points, display_order')
    .eq('session_id', sessionId)
    .order('display_order');

  const { data: groups } = await supabase
    .from('session_groups')
    .select('id, name, conduct_malus')
    .eq('session_id', sessionId);

  const groupsData: GroupData[] = [];
  for (const g of groups || []) {
    const { data: members } = await supabase
      .from('session_group_members')
      .select('student_id, students(pseudo)')
      .eq('group_id', g.id);

    const { data: grades } = await supabase
      .from('group_grades')
      .select('criteria_id, points_awarded')
      .eq('group_id', g.id);

    groupsData.push({
      ...g,
      members: (members || []).map((m: any) => ({
        student_id: m.student_id,
        pseudo: m.students?.pseudo || '?',
      })),
      grades: grades || [],
    });
  }

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
