import { supabase } from './supabase';

// Visibilité des onglets de l'espace élève, par classe.
// Implication = toujours visible (non stocké). Maison = academy_config.enabled (séparé).
export interface StudentTabsConfig {
  show_stamps: boolean;
  show_annales: boolean;
  /**
   * Onglet « Mes notes ». OFF par défaut : ouvrir les notes aux élèves est une décision
   * explicite. Second verrou au niveau de chaque évaluation
   * (`written_assessments.published_to_students`).
   */
  show_grades: boolean;
}

export async function fetchStudentTabs(classId: string): Promise<StudentTabsConfig | null> {
  const { data } = await supabase
    .from('class_student_tabs')
    .select('show_stamps, show_annales, show_grades')
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
      show_grades: config.show_grades,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'class_id' });
  if (error) throw error;
}

// Applique la même config Tampons/Annales/Notes à toutes les classes du prof.
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
    show_grades: config.show_grades,
    updated_at: now,
  }));
  const { error } = await supabase
    .from('class_student_tabs')
    .upsert(rows, { onConflict: 'class_id' });
  if (error) throw error;
}
