import { supabase } from './supabase';

// Métriques d'implication : connexions des élèves à l'espace /eleve.

export interface ConnectionStat {
  count: number;
  last: string | null; // ISO timestamp de la dernière connexion
}

// Stats agrégées (count + dernière connexion) pour tous les élèves d'une classe.
export async function fetchConnectionStats(classId: string): Promise<Map<string, ConnectionStat>> {
  const map = new Map<string, ConnectionStat>();
  const { data, error } = await supabase.rpc('get_connection_stats', { p_class_id: classId });
  if (error) {
    console.error('Error fetching connection stats:', error);
    return map;
  }
  (data || []).forEach((r: { student_id: string; connection_count: number; last_connected: string | null }) => {
    map.set(r.student_id, { count: Number(r.connection_count), last: r.last_connected });
  });
  return map;
}

// Horodatages bruts des connexions d'un élève (pour la fiche détail).
export async function fetchStudentConnections(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('student_connections')
    .select('connected_at')
    .eq('student_id', studentId)
    .order('connected_at', { ascending: true });
  if (error) {
    console.error('Error fetching student connections:', error);
    return [];
  }
  return (data || []).map((r: { connected_at: string }) => r.connected_at);
}
