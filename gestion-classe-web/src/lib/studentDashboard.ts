/** Ce que rend la RPC `get_student_dashboard` à l'espace élève (/eleve). */
export interface DashboardData {
  pseudo: string;
  class_name: string;
  trimester: number;
  school_year: string;
  is_witness?: boolean;
  tabs?: { stamps: boolean; annales: boolean };
  grade: number;
  participations: number;
  malus: number;
  absences: number;
  target: number;
  class_rank: number;
  class_total: number;
  overall_rank: number;
  overall_total: number;
  top10_class: { rank: number; grade: number }[];
  top10_overall: { rank: number; grade: number }[];
  my_class_rank_among_classes: number;
  total_classes: number;
  my_class_avg: number;
  all_classes_ranking: { rank: number; class_name: string; avg_grade: number; student_count: number }[];
}

/** Rang écrit comme on le dit : « 1er », « 6e ». */
export const ordinal = (n: number): string => (n === 1 ? '1er' : `${n}e`);
