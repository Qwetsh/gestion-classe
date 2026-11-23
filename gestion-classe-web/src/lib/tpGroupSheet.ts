import { supabase } from './supabase';
import { fetchSessionPhotos, getPhotoUrl, type GroupSessionPhoto } from './groupSessionPhotos';

/**
 * Fiche du TP en groupes au bureau (PLAN_tp_groupes.md, lot 2) : tout ce que la séance de groupe
 * a produit au téléphone (groupes, barème, malus, commentaires, photos, faits de la séance), et
 * les notes du carnet de chaque membre. Les notes du carnet suivent les groupes par la base
 * (sync_group_session_assessment, migrations 063 et 087) ; une note ajustée à la main ne suit plus.
 */

export interface TpSession {
  id: string;
  name: string;
  status: string;
  className: string;
  classId: string;
  createdAt: string;
  completedAt: string | null;
  linkedSessionId: string | null;
  templateId: string | null;
  materials: string[];
}

export interface TpCriterion {
  id: string;
  label: string;
  max_points: number;
  display_order: number;
}

export interface TpMember {
  memberId: string;
  studentId: string;
  pseudo: string;
}

export interface TpGroup {
  id: string;
  name: string;
  displayOrder: number;
  conductMalus: number;
  comment: string;
  members: TpMember[];
  /** criteria_id → points ; un critère absent n'a pas encore été noté */
  grades: Record<string, number>;
}

export interface TpEvent {
  id: string;
  studentId: string;
  type: string;
  subtype: string | null;
  note: string | null;
  timestamp: string;
  tpGroupId: string | null;
}

export interface TpMemberGrade {
  gradeId: string;
  studentId: string;
  grade: number | null;
  gradeRaw: number | null;
  status: string;
  /** Total du groupe tel que la base l'a écrit dans le détail */
  groupTotal: number | null;
}

export interface TpSheetData {
  session: TpSession;
  criteria: TpCriterion[];
  groups: TpGroup[];
  photos: GroupSessionPhoto[];
  events: TpEvent[];
  assessmentId: string | null;
  memberGrades: Record<string, TpMemberGrade>;
}

/** Couleurs des îlots, les mêmes qu'au téléphone (utils/tpGroups.ts du mobile). */
export const TP_GROUP_COLORS = [
  { soft: '#EEF0FF', border: '#818CF8', text: '#3730A3' },
  { soft: '#E6F7F2', border: '#34B89A', text: '#0B5F4C' },
  { soft: '#FFF1E8', border: '#F59A5C', text: '#9A3A0E' },
  { soft: '#FDEDF4', border: '#E879A8', text: '#8C1D4F' },
  { soft: '#E8F4FD', border: '#5AAEE8', text: '#0E4F7E' },
  { soft: '#FEF6E0', border: '#E3B341', text: '#7A5300' },
  { soft: '#F1EDFE', border: '#A78BFA', text: '#5B21B6' },
  { soft: '#ECF7E4', border: '#7DBB52', text: '#3F6212' },
];

export function tpGroupColor(displayOrder: number) {
  const n = TP_GROUP_COLORS.length;
  return TP_GROUP_COLORS[((displayOrder % n) + n) % n];
}

/** Note du groupe : points des critères moins le malus conduite, jamais sous zéro. */
export function groupTotal(group: TpGroup, criteria: TpCriterion[]): number {
  const sum = criteria.reduce((s, c) => s + (group.grades[c.id] ?? 0), 0);
  return Math.max(0, sum - (group.conductMalus || 0));
}

/** Un groupe est noté quand chaque critère a reçu une note (zéro compris). */
export function isGroupGraded(group: TpGroup, criteria: TpCriterion[]): boolean {
  return criteria.length > 0 && criteria.every((c) => group.grades[c.id] !== undefined);
}

/** Pas du barème : demi-point, borné entre 0 et le maximum du critère. */
export function stepPoints(current: number, delta: number, max: number): number {
  const next = Math.round((current + delta) * 2) / 2;
  return Math.min(max, Math.max(0, next));
}

export function fmtNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Prénom seul d'un pseudo « Léa MA. » (étiquette d'une photo d'élève). */
export function firstName(pseudo: string): string {
  return pseudo.split(' ')[0] || pseudo;
}

export async function loadTpSheet(sessionId: string): Promise<TpSheetData | null> {
  const [{ data: s, error: sErr }, { data: criteriaData, error: cErr }, { data: groupsData, error: gErr }, photos, { data: wa }] = await Promise.all([
    supabase
      .from('group_sessions')
      .select('id, name, status, class_id, created_at, completed_at, linked_session_id, template_id, materials, classes (name)')
      .eq('id', sessionId)
      .maybeSingle(),
    supabase.from('grading_criteria').select('id, label, max_points, display_order').eq('session_id', sessionId).order('display_order'),
    supabase.from('session_groups').select('id, name, conduct_malus, comment, display_order').eq('session_id', sessionId).order('display_order').order('name'),
    fetchSessionPhotos(sessionId),
    supabase.from('written_assessments').select('id').eq('group_session_id', sessionId).eq('is_deleted', false).maybeSingle(),
  ]);
  if (sErr) throw sErr;
  if (cErr) throw cErr;
  if (gErr) throw gErr;
  if (!s) return null;

  const groupIds = (groupsData ?? []).map((g) => g.id as string);
  const assessmentId = (wa?.id as string | undefined) ?? null;
  const [membersRes, gradesRes, eventsRes, agRes] = await Promise.all([
    groupIds.length
      ? supabase.from('session_group_members').select('id, group_id, student_id, students (pseudo)').in('group_id', groupIds)
      : Promise.resolve({ data: [], error: null }),
    groupIds.length
      ? supabase.from('group_grades').select('group_id, criteria_id, points_awarded').in('group_id', groupIds)
      : Promise.resolve({ data: [], error: null }),
    s.linked_session_id
      ? supabase.from('events').select('id, student_id, type, subtype, note, timestamp, tp_group_id').eq('session_id', s.linked_session_id).order('timestamp')
      : Promise.resolve({ data: [], error: null }),
    assessmentId
      ? supabase.from('assessment_grades').select('id, student_id, grade, grade_raw, status, details').eq('assessment_id', assessmentId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (gradesRes.error) throw gradesRes.error;

  const members = (membersRes.data ?? []) as unknown as { id: string; group_id: string; student_id: string; students: { pseudo: string } | null }[];
  const grades = (gradesRes.data ?? []) as { group_id: string; criteria_id: string; points_awarded: number }[];

  const groups: TpGroup[] = (groupsData ?? []).map((g, i) => ({
    id: g.id as string,
    name: g.name as string,
    displayOrder: (g.display_order as number | null) ?? i,
    conductMalus: Number(g.conduct_malus ?? 0),
    comment: (g.comment as string | null) ?? '',
    members: members
      .filter((m) => m.group_id === g.id)
      .map((m) => ({ memberId: m.id, studentId: m.student_id, pseudo: m.students?.pseudo ?? '?' }))
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr')),
    grades: Object.fromEntries(grades.filter((x) => x.group_id === g.id).map((x) => [x.criteria_id, Number(x.points_awarded)])),
  }));

  const events: TpEvent[] = ((eventsRes.data ?? []) as { id: string; student_id: string; type: string; subtype: string | null; note: string | null; timestamp: string; tp_group_id: string | null }[])
    .map((e) => ({ id: e.id, studentId: e.student_id, type: e.type, subtype: e.subtype, note: e.note, timestamp: e.timestamp, tpGroupId: e.tp_group_id }));

  const memberGrades: Record<string, TpMemberGrade> = {};
  for (const r of (agRes.data ?? []) as { id: string; student_id: string; grade: number | null; grade_raw: number | null; status: string; details: { groupe?: { total?: number } } | null }[]) {
    memberGrades[r.student_id] = {
      gradeId: r.id,
      studentId: r.student_id,
      grade: r.grade === null ? null : Number(r.grade),
      gradeRaw: r.grade_raw === null ? null : Number(r.grade_raw),
      status: r.status,
      groupTotal: r.details?.groupe?.total !== undefined ? Number(r.details.groupe.total) : null,
    };
  }

  return {
    session: {
      id: s.id as string,
      name: s.name as string,
      status: (s.status as string) ?? 'active',
      classId: s.class_id as string,
      className: (s.classes as unknown as { name: string } | null)?.name ?? 'Classe inconnue',
      createdAt: s.created_at as string,
      completedAt: (s.completed_at as string | null) ?? null,
      linkedSessionId: (s.linked_session_id as string | null) ?? null,
      templateId: (s.template_id as string | null) ?? null,
      materials: (s.materials as string[] | null) ?? [],
    },
    criteria: (criteriaData ?? []).map((c) => ({ ...c, max_points: Number(c.max_points) })) as TpCriterion[],
    groups,
    photos,
    events,
    assessmentId,
    memberGrades,
  };
}

export async function photoUrls(photos: GroupSessionPhoto[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(photos.map(async (p) => {
    const url = await getPhotoUrl(p.file_path);
    if (url) out[p.id] = url;
  }));
  return out;
}

export async function saveGroupGrade(groupId: string, criteriaId: string, points: number): Promise<void> {
  const { error } = await supabase
    .from('group_grades')
    .upsert({ group_id: groupId, criteria_id: criteriaId, points_awarded: points }, { onConflict: 'group_id,criteria_id' });
  if (error) throw error;
}

/** « Valider » : les critères jamais touchés comptent pour 0, le groupe passe en noté. */
export async function fillMissingGrades(groupId: string, criteriaIds: string[]): Promise<void> {
  if (criteriaIds.length === 0) return;
  const rows = criteriaIds.map((id) => ({ group_id: groupId, criteria_id: id, points_awarded: 0 }));
  const { error } = await supabase.from('group_grades').upsert(rows, { onConflict: 'group_id,criteria_id', ignoreDuplicates: true });
  if (error) throw error;
}

export async function saveGroupMalus(groupId: string, malus: number): Promise<void> {
  const { error } = await supabase.from('session_groups').update({ conduct_malus: malus }).eq('id', groupId);
  if (error) throw error;
}

export async function saveGroupComment(groupId: string, comment: string): Promise<void> {
  const { error } = await supabase.from('session_groups').update({ comment: comment.trim() ? comment : null }).eq('id', groupId);
  if (error) throw error;
}

export async function updateCriterion(id: string, patch: Partial<Pick<TpCriterion, 'label' | 'max_points'>>): Promise<void> {
  const { error } = await supabase.from('grading_criteria').update(patch).eq('id', id);
  if (error) throw error;
}

/** Baisser le maximum d'un critère ramène les points déjà donnés au-dessus. */
export async function clampCriterionGrades(criteriaId: string, max: number): Promise<void> {
  const { error } = await supabase.from('group_grades').update({ points_awarded: max }).eq('criteria_id', criteriaId).gt('points_awarded', max);
  if (error) throw error;
}

export async function addCriterion(sessionId: string, label: string, maxPoints: number, displayOrder: number): Promise<TpCriterion> {
  const { data, error } = await supabase
    .from('grading_criteria')
    .insert({ session_id: sessionId, label, max_points: maxPoints, display_order: displayOrder })
    .select('id, label, max_points, display_order')
    .single();
  if (error) throw error;
  return { ...(data as TpCriterion), max_points: Number(data.max_points) };
}

export async function deleteCriterion(id: string): Promise<void> {
  const { error: gErr } = await supabase.from('group_grades').delete().eq('criteria_id', id);
  if (gErr) throw gErr;
  const { error } = await supabase.from('grading_criteria').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Recopie le barème de la séance dans le TP de « Mes TP ». Les lignes existantes sont mises à
 * jour à leur place (même identifiant, rang par rang) : le téléphone, qui ne fait que mettre à
 * jour ou ajouter les critères de modèle qu'il connaît, ne se retrouve pas avec des doublons.
 */
export async function copyCriteriaToTemplate(templateId: string, criteria: TpCriterion[]): Promise<void> {
  const { data: existing, error } = await supabase
    .from('tp_template_criteria')
    .select('id, display_order')
    .eq('template_id', templateId)
    .order('display_order');
  if (error) throw error;
  const rows = existing ?? [];
  const sorted = [...criteria].sort((a, b) => a.display_order - b.display_order);
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];
    if (rows[i]) {
      const { error: uErr } = await supabase
        .from('tp_template_criteria')
        .update({ label: c.label, max_points: c.max_points, display_order: i })
        .eq('id', rows[i].id);
      if (uErr) throw uErr;
    } else {
      const { error: iErr } = await supabase
        .from('tp_template_criteria')
        .insert({ template_id: templateId, label: c.label, max_points: c.max_points, display_order: i });
      if (iErr) throw iErr;
    }
  }
  const surplus = rows.slice(sorted.length).map((r) => r.id);
  if (surplus.length) {
    const { error: dErr } = await supabase.from('tp_template_criteria').delete().in('id', surplus);
    if (dErr) throw dErr;
  }
}

export async function movePhotoToGroup(photoId: string, groupId: string | null): Promise<void> {
  const { error } = await supabase.from('group_session_photos').update({ group_id: groupId }).eq('id', photoId);
  if (error) throw error;
}

/**
 * Note d'un membre retouchée à la main (bouton « Ajuster ») : elle ne suit plus le groupe.
 * L'écrire égale à la note du groupe la remet sur le groupe : la base la fait suivre de nouveau.
 */
export async function saveMemberGrade(params: {
  userId: string;
  assessmentId: string;
  studentId: string;
  raw: number;
  bareme: number;
}): Promise<void> {
  const { error } = await supabase
    .from('assessment_grades')
    .upsert({
      user_id: params.userId,
      assessment_id: params.assessmentId,
      student_id: params.studentId,
      grade_raw: params.raw,
      grade: params.bareme > 0 ? Math.round((params.raw * 20 / params.bareme) * 100) / 100 : null,
      status: 'noted',
      is_validated: true,
      validated_at: new Date().toISOString(),
    }, { onConflict: 'assessment_id,student_id' });
  if (error) throw error;
}

/** Les faits de la séance qui concernent un groupe, dans l'ordre. */
export interface TimelineItem {
  at: string;
  text: string;
  tone: 'neutral' | 'pos' | 'neg';
}

const SORTIE_LABEL: Record<string, string> = {
  infirmerie: 'infirmerie',
  toilettes: 'toilettes',
  convocation: 'convocation',
  exclusion: 'exclusion',
};

export function groupTimeline(group: TpGroup, events: TpEvent[]): TimelineItem[] {
  const byStudent = new Map(group.members.map((m) => [m.studentId, m.pseudo]));
  const items: TimelineItem[] = [];
  // Points de groupe : un geste = un événement par présent, regroupés par minute et par sens.
  const groupPoints = new Map<string, { at: string; plus: boolean }>();
  for (const e of events) {
    if (e.tpGroupId === group.id && (e.type === 'participation' || e.type === 'bavardage')) {
      const key = `${e.timestamp.slice(0, 16)}|${e.type}`;
      if (!groupPoints.has(key)) groupPoints.set(key, { at: e.timestamp, plus: e.type === 'participation' });
      continue;
    }
    const who = byStudent.get(e.studentId);
    if (!who) continue;
    if (e.type === 'absence') items.push({ at: e.timestamp, text: `${who} absent(e)`, tone: 'neutral' });
    else if (e.type === 'sortie') {
      const back = events.find((r) => r.studentId === e.studentId && r.type === 'retour' && r.timestamp > e.timestamp);
      const why = e.subtype ? ` (${SORTIE_LABEL[e.subtype] ?? e.subtype})` : '';
      items.push({ at: e.timestamp, text: `${who} sorti(e)${why}${back ? `, revenu(e) à ${fmtTime(back.timestamp)}` : ''}`, tone: 'neutral' });
    } else if (e.type === 'participation' && !e.tpGroupId) items.push({ at: e.timestamp, text: `${who} : implication +`, tone: 'pos' });
    else if (e.type === 'bavardage' && !e.tpGroupId) items.push({ at: e.timestamp, text: `${who} : bavardage`, tone: 'neg' });
    else if (e.type === 'remarque' && e.note) items.push({ at: e.timestamp, text: `${who} : ${e.note}`, tone: 'neutral' });
  }
  for (const p of groupPoints.values()) {
    items.push({ at: p.at, text: p.plus ? 'Implication + pour tout le groupe' : 'Implication − pour tout le groupe', tone: p.plus ? 'pos' : 'neg' });
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

/** Absents de la séance (événement « absence » sans annulation : la ligne disparaît quand on annule). */
export function absentIds(events: TpEvent[]): Set<string> {
  return new Set(events.filter((e) => e.type === 'absence').map((e) => e.studentId));
}
