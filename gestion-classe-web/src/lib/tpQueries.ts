/**
 * Lectures et écritures de « Mes TP » (tables tp_templates, tp_template_criteria ; migration 079
 * pour le rangement et la fiche complète).
 */
import { supabase } from './supabase';

export interface TpCriterion {
  id?: string;
  label: string;
  max_points: number;
  hint: string | null;
}

export interface Tp {
  id: string;
  name: string;
  color: string;
  theme: string | null;
  level: string | null;
  chapter: string | null;
  /** Numéro de l'activité de « Mes cours » qui fait faire ce TP (« 3 », « 3a », « bonus ») ; migration 081. */
  activity: string | null;
  problem: string | null;
  duration_min: number | null;
  modality: string | null;
  materials: string[];
  protocol: string[];
  safety: string[];
  criteria: TpCriterion[];
  created_at: string;
  /** Séances de groupe lancées avec ce modèle. */
  usage_count: number;
}

/** Ce que l'on enregistre d'un TP (formulaire, duplication). */
export type TpDraft = Omit<Tp, 'id' | 'created_at' | 'usage_count'>;

export interface TpUsage {
  session_id: string;
  session_name: string;
  class_name: string;
  completed_at: string | null;
  /** Réussite moyenne des groupes, en pourcentage ; null si aucune note. */
  success_pct: number | null;
}

const COLUMNS = 'id, name, color, theme, level, chapter, activity, problem, duration_min, modality, materials, protocol, safety, created_at, tp_template_criteria (id, label, max_points, hint, display_order)';

interface Row {
  id: string; name: string; color: string | null; theme: string | null; level: string | null; chapter: string | null;
  activity: string | null; problem: string | null; duration_min: number | null; modality: string | null;
  materials: string[] | null; protocol: string[] | null; safety: string[] | null; created_at: string;
  tp_template_criteria: { id: string; label: string; max_points: number; hint: string | null; display_order: number }[] | null;
}

const fromRow = (r: Row, usage = 0): Tp => ({
  id: r.id,
  name: r.name,
  color: r.color || 'green',
  theme: r.theme,
  level: r.level,
  chapter: r.chapter,
  activity: r.activity ?? null,
  problem: r.problem,
  duration_min: r.duration_min,
  modality: r.modality,
  materials: r.materials ?? [],
  protocol: r.protocol ?? [],
  safety: r.safety ?? [],
  criteria: [...(r.tp_template_criteria ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .map((c) => ({ id: c.id, label: c.label, max_points: Number(c.max_points), hint: c.hint })),
  created_at: r.created_at,
  usage_count: usage,
});

export async function listTps(userId: string): Promise<Tp[]> {
  const { data, error } = await supabase.from('tp_templates').select(COLUMNS).eq('user_id', userId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];
  const { data: used } = await supabase.from('group_sessions').select('template_id').in('template_id', rows.map((r) => r.id));
  const counts = new Map<string, number>();
  for (const u of used ?? []) counts.set(u.template_id, (counts.get(u.template_id) ?? 0) + 1);
  return rows.map((r) => fromRow(r, counts.get(r.id) ?? 0));
}

const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);

/** Crée (sans `id`) ou met à jour un TP et remplace son barème. Rend l'identifiant. */
export async function saveTp(userId: string, draft: TpDraft, id?: string): Promise<string> {
  const row = {
    name: draft.name.trim(),
    color: draft.color || 'green',
    theme: draft.theme?.trim() || null,
    level: draft.level || null,
    chapter: draft.chapter?.trim() || null,
    activity: draft.activity?.trim().toLowerCase() || null,
    problem: draft.problem?.trim() || null,
    duration_min: draft.duration_min && draft.duration_min > 0 ? Math.round(draft.duration_min) : null,
    modality: draft.modality?.trim() || null,
    materials: clean(draft.materials),
    protocol: clean(draft.protocol),
    safety: clean(draft.safety),
  };
  let templateId = id;
  if (templateId) {
    const { error } = await supabase.from('tp_templates').update(row).eq('id', templateId);
    if (error) throw error;
    const { error: delErr } = await supabase.from('tp_template_criteria').delete().eq('template_id', templateId);
    if (delErr) throw delErr;
  } else {
    const { data, error } = await supabase.from('tp_templates').insert({ ...row, user_id: userId }).select('id').single();
    if (error) throw error;
    templateId = data.id as string;
  }
  const criteria = draft.criteria
    .filter((c) => c.label.trim())
    .map((c, i) => ({ template_id: templateId, label: c.label.trim(), max_points: Number(c.max_points) || 0, hint: c.hint?.trim() || null, display_order: i }));
  if (criteria.length > 0) {
    const { error } = await supabase.from('tp_template_criteria').insert(criteria);
    if (error) throw error;
  }
  return templateId!;
}

/** Ce que « Mes cours » montre d'un TP : de quoi le relier à son activité et l'ouvrir. */
export interface TpRef {
  id: string;
  name: string;
  level: string | null;
  chapter: string | null;
  activity: string | null;
}

/** TP reliés à une activité (lecture légère pour « Mes cours »). */
export async function listTpRefs(userId: string): Promise<TpRef[]> {
  const { data, error } = await supabase
    .from('tp_templates')
    .select('id, name, level, chapter, activity')
    .eq('user_id', userId)
    .not('activity', 'is', null);
  if (error) throw error;
  return (data ?? []) as TpRef[];
}

export async function deleteTp(id: string): Promise<void> {
  const { error } = await supabase.from('tp_templates').delete().eq('id', id);
  if (error) throw error;
}

/** Les dix dernières séances de groupe lancées avec ce modèle, et la réussite moyenne des groupes. */
export async function fetchTpUsages(templateId: string): Promise<TpUsage[]> {
  const { data: sessions, error } = await supabase
    .from('group_sessions')
    .select('id, name, completed_at, classes(name)')
    .eq('template_id', templateId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id as string);
  // Trois lectures en tout, au lieu de trois par séance et par groupe
  const [{ data: criteria }, { data: groups }] = await Promise.all([
    supabase.from('grading_criteria').select('session_id, max_points').in('session_id', ids),
    supabase.from('session_groups').select('id, session_id').in('session_id', ids),
  ]);
  const groupIds = (groups ?? []).map((g) => g.id as string);
  const { data: grades } = groupIds.length > 0
    ? await supabase.from('group_grades').select('group_id, points_awarded').in('group_id', groupIds)
    : { data: [] as { group_id: string; points_awarded: number }[] };

  const maxBySession = new Map<string, number>();
  for (const c of criteria ?? []) maxBySession.set(c.session_id, (maxBySession.get(c.session_id) ?? 0) + Number(c.max_points));
  const pointsByGroup = new Map<string, { total: number; graded: boolean }>();
  for (const g of grades ?? []) {
    const cur = pointsByGroup.get(g.group_id) ?? { total: 0, graded: false };
    pointsByGroup.set(g.group_id, { total: cur.total + Number(g.points_awarded), graded: true });
  }
  return sessions.map((s) => {
    const max = maxBySession.get(s.id) ?? 0;
    const pcts = (groups ?? [])
      .filter((g) => g.session_id === s.id && pointsByGroup.get(g.id)?.graded)
      .map((g) => (max > 0 ? (pointsByGroup.get(g.id)!.total / max) * 100 : 0));
    const cls = (s as unknown as { classes: { name: string } | { name: string }[] | null }).classes;
    const className = Array.isArray(cls) ? cls[0]?.name : cls?.name;
    return {
      session_id: s.id,
      session_name: s.name,
      class_name: className ?? '?',
      completed_at: s.completed_at,
      success_pct: pcts.length > 0 && max > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
    };
  });
}
