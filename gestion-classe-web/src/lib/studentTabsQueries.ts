import { supabase } from './supabase';

// Visibilité des onglets de l'espace élève, par classe.
// Notes = toujours visible (non stocké). Maison = academy_config.enabled (séparé).
export interface StudentTabsConfig {
  show_stamps: boolean;
  show_annales: boolean;
}

export async function fetchStudentTabs(classId: string): Promise<StudentTabsConfig | null> {
  const { data } = await supabase
    .from('class_student_tabs')
    .select('show_stamps, show_annales')
    .eq('class_id', classId)
    .maybeSingle();
  return data;
}

export async function saveStudentTabs(
  classId: string,
  userId: string,
  config: StudentTabsConfig,
): Promise<void> {
  const { error } = await supabase
    .from('class_student_tabs')
    .upsert({
      class_id: classId,
      user_id: userId,
      show_stamps: config.show_stamps,
      show_annales: config.show_annales,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'class_id' });
  if (error) throw error;
}

// Applique la même config Tampons/Annales à toutes les classes du prof.
export async function applyStudentTabsToAll(
  userId: string,
  classIds: string[],
  config: StudentTabsConfig,
): Promise<void> {
  if (classIds.length === 0) return;
  const now = new Date().toISOString();
  const rows = classIds.map(class_id => ({
    class_id,
    user_id: userId,
    show_stamps: config.show_stamps,
    show_annales: config.show_annales,
    updated_at: now,
  }));
  const { error } = await supabase
    .from('class_student_tabs')
    .upsert(rows, { onConflict: 'class_id' });
  if (error) throw error;
}
