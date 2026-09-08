import { supabase } from './supabase';

/**
 * Changement de classe d'un élève en cours d'année.
 *
 * L'élève garde son identifiant, donc tout ce qui lui est accroché suit :
 * historique d'événements (rattaché aux séances de l'ancienne classe, ce qui
 * reste juste), carte à tampons, code de connexion, évaluations, notes.
 *
 * Ce qui est nettoyé / recopié au passage :
 * - plan de classe : retiré des placements de l'ancienne classe (sinon siège fantôme) ;
 * - maisons : son affectation est copiée dans la nouvelle classe (si le module
 *   y est activé) puis retirée de l'ancienne ;
 * - groupes des séances de groupe encore actives de l'ancienne classe : retiré.
 */
export interface TransferResult {
  seatRemoved: boolean;
  houseCopied: boolean;
  groupsLeft: number;
}

export async function transferStudent(
  studentId: string,
  toClassId: string,
  fromClassId: string | null,
): Promise<TransferResult> {
  const result: TransferResult = { seatRemoved: false, houseCopied: false, groupsLeft: 0 };
  if (fromClassId === toClassId) return result;

  // 1. Rattachement
  const { error } = await supabase
    .from('students')
    .update({ class_id: toClassId, updated_at: new Date().toISOString() })
    .eq('id', studentId);
  if (error) throw error;

  // Élève détaché (class_id NULL) : rien à nettoyer dans une ancienne classe.
  if (!fromClassId) return result;

  // 2. Plan de classe de l'ancienne classe : libérer la place
  const { data: plans } = await supabase
    .from('class_room_plans')
    .select('id, positions')
    .eq('class_id', fromClassId);
  for (const plan of plans || []) {
    const positions = (plan.positions || {}) as Record<string, string>;
    const entries = Object.entries(positions).filter(([, sid]) => sid !== studentId);
    if (entries.length === Object.keys(positions).length) continue;
    await supabase
      .from('class_room_plans')
      .update({ positions: Object.fromEntries(entries), updated_at: new Date().toISOString() })
      .eq('id', plan.id);
    result.seatRemoved = true;
  }

  // 3. Maison : copier dans la nouvelle classe si le module y est activé, puis retirer de l'ancienne
  const { data: assignment } = await supabase
    .from('academy_assignments')
    .select('house')
    .eq('student_id', studentId)
    .eq('class_id', fromClassId)
    .maybeSingle();
  if (assignment) {
    const { data: targetConfig } = await supabase
      .from('academy_config')
      .select('enabled')
      .eq('class_id', toClassId)
      .maybeSingle();
    if (targetConfig?.enabled) {
      const { error: upsertError } = await supabase
        .from('academy_assignments')
        .upsert({
          student_id: studentId,
          class_id: toClassId,
          house: assignment.house,
          assigned_by: 'transfer',
          override: true,
          assigned_at: new Date().toISOString(),
        }, { onConflict: 'student_id,class_id' });
      if (!upsertError) result.houseCopied = true;
    }
    await supabase
      .from('academy_assignments')
      .delete()
      .eq('student_id', studentId)
      .eq('class_id', fromClassId);
  }

  // 4. Groupes des séances de groupe encore actives de l'ancienne classe
  const { data: activeSessions } = await supabase
    .from('group_sessions')
    .select('id')
    .eq('class_id', fromClassId)
    .eq('status', 'active');
  const sessionIds = (activeSessions || []).map(s => s.id);
  if (sessionIds.length > 0) {
    const { data: groups } = await supabase
      .from('session_groups')
      .select('id')
      .in('session_id', sessionIds);
    const groupIds = (groups || []).map(g => g.id);
    if (groupIds.length > 0) {
      const { data: removed } = await supabase
        .from('session_group_members')
        .delete()
        .eq('student_id', studentId)
        .in('group_id', groupIds)
        .select('group_id');
      result.groupsLeft = (removed || []).length;
    }
  }

  return result;
}

/** Message de confirmation lisible après un transfert. */
export function describeTransfer(pseudo: string, className: string, r: TransferResult): string {
  const extras: string[] = [];
  if (r.seatRemoved) extras.push('place libérée dans l\'ancien plan');
  if (r.houseCopied) extras.push('maison conservée');
  if (r.groupsLeft > 0) extras.push('retiré de ses groupes');
  return `${pseudo} transféré(e) en ${className}${extras.length ? ` (${extras.join(', ')})` : ''}.`;
}
