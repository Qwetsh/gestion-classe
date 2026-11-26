import { supabase } from './supabaseUntyped';
import { activityIndex, sameStudentBoards, studentBoardsOfTp, type ActivityBoard, type TpStudentBoards } from './tpLibrary';

/**
 * Onglet TP des élèves (PLAN_tp_groupes.md, lot 3 ; migration 088) : le serveur ne montre à un
 * élève que les cours écrits dans tp_templates.student_boards, jamais un cours choisi d'après son
 * titre. C'est donc le navigateur du professeur qui les écrit, quand il a sa bibliothèque sous les
 * yeux (Mes TP, Mes cours) : fiche, protocole et documents de l'activité reliée au TP.
 * Seules les lignes qui changent sont écrites ; une erreur n'interrompt rien (on réessaiera à la
 * prochaine ouverture).
 */
export async function syncTpStudentBoards(userId: string, boards: ActivityBoard[]): Promise<number> {
  const { data, error } = await supabase
    .from('tp_templates')
    .select('id, level, chapter, activity, student_boards')
    .eq('user_id', userId);
  if (error) throw error;
  const index = activityIndex(boards);
  let written = 0;
  for (const tp of (data ?? []) as { id: string; level: string | null; chapter: string | null; activity: string | null; student_boards: TpStudentBoards | null }[]) {
    const next = studentBoardsOfTp(tp, boards, index);
    if (sameStudentBoards(next, tp.student_boards)) continue;
    const { error: uErr } = await supabase.from('tp_templates').update({ student_boards: next }).eq('id', tp.id);
    if (uErr) throw uErr;
    written += 1;
  }
  return written;
}
