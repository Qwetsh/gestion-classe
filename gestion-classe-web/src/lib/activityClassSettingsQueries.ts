import { supabase } from './supabase';

// Réglages d'une activité pour une classe (table activity_class_settings, migration 070).
// Une ligne par activité et par classe, créée au premier réglage ; absente = valeurs par défaut.

/** La correction animée de cette activité est-elle ouverte pour cette classe ? (fermée par défaut) */
export async function fetchAnimatedCorrectionOpen(activityId: string, classId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('activity_class_settings')
    .select('animated_correction_open')
    .eq('activity_id', activityId)
    .eq('class_id', classId)
    .maybeSingle();
  if (error) throw error;
  return !!data?.animated_correction_open;
}

/** Ouvre ou ferme la correction animée de cette activité pour cette classe. */
export async function setAnimatedCorrectionOpen(
  activityId: string,
  classId: string,
  userId: string,
  open: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('activity_class_settings')
    .upsert({
      activity_id: activityId,
      class_id: classId,
      user_id: userId,
      animated_correction_open: open,
    }, { onConflict: 'activity_id,class_id' });
  if (error) throw error;
}
