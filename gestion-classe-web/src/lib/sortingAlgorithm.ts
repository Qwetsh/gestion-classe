import { supabase } from './supabase';
import { HOUSES, type HouseId, fetchAssignments, saveAssignment } from './academyQueries';

// ============================================================
// Algorithme de répartition — Le Choixpeau Magique
// 4 étapes : A (scores) → B (prioritaire) → C (compromis) → D (départage)
// ============================================================

export interface StudentScores {
  student_id: string;
  pseudo: string;
  scores: Record<HouseId, number>;
  preferences: HouseId[];
  dominantHouse: HouseId;
}

export interface SortingResult {
  assignments: { student_id: string; pseudo: string; house: HouseId; method: 'priority' | 'compromise' | 'tiebreak' }[];
  unassigned: string[]; // student_ids without test
  overrides: { student_id: string; house: HouseId }[];
  quotas: Record<HouseId, number>;
  target: number;
  max: number;
}

// --- Step A: Calculate raw scores ---

export async function calculateStudentScores(classId: string): Promise<StudentScores[]> {
  // Get students
  const { data: students } = await supabase
    .from('students')
    .select('id, pseudo')
    .eq('class_id', classId);

  if (!students || students.length === 0) return [];

  const studentIds = students.map(s => s.id);

  // Get responses with answer weights
  const { data: responses } = await supabase
    .from('academy_responses')
    .select('student_id, answer_id, academy_answers(salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight)')
    .in('student_id', studentIds);

  // Get preferences
  const { data: preferences } = await supabase
    .from('academy_preferences')
    .select('student_id, house, rank')
    .in('student_id', studentIds);

  const results: StudentScores[] = [];

  for (const student of students) {
    const studentResponses = (responses || []).filter(r => r.student_id === student.id);
    if (studentResponses.length === 0) continue; // Skip students without test

    // Sum weights
    const scores: Record<HouseId, number> = { salamandre: 0, vouivre: 0, zephyr: 0, taisson: 0 };
    for (const r of studentResponses) {
      const w = r.academy_answers as any;
      if (!w) continue;
      scores.salamandre += w.salamandre_weight || 0;
      scores.vouivre += w.vouivre_weight || 0;
      scores.zephyr += w.zephyr_weight || 0;
      scores.taisson += w.taisson_weight || 0;
    }

    // Preferences sorted by rank
    const studentPrefs = (preferences || [])
      .filter(p => p.student_id === student.id)
      .sort((a, b) => a.rank - b.rank)
      .map(p => p.house as HouseId);

    // Dominant house = highest score
    const dominantHouse = HOUSES.reduce((best, h) =>
      scores[h] > scores[best] ? h : best, HOUSES[0]);

    results.push({
      student_id: student.id,
      pseudo: student.pseudo,
      scores,
      preferences: studentPrefs.length === 4 ? studentPrefs : [...HOUSES],
      dominantHouse,
    });
  }

  return results;
}

// --- Main sorting algorithm ---

export function runSortingAlgorithm(
  studentScores: StudentScores[],
  existingOverrides: { student_id: string; house: HouseId }[],
  totalStudents: number,
): SortingResult {
  const target = Math.ceil(totalStudents / 4);
  const max = Math.floor(target * 1.15);

  // Track house counts (start with overrides)
  const houseCounts: Record<HouseId, number> = { salamandre: 0, vouivre: 0, zephyr: 0, taisson: 0 };
  const overrideIds = new Set(existingOverrides.map(o => o.student_id));

  for (const o of existingOverrides) {
    houseCounts[o.house]++;
  }

  const assignments: SortingResult['assignments'] = [];
  const remaining = studentScores.filter(s => !overrideIds.has(s.student_id));

  const canAssign = (house: HouseId) => houseCounts[house] < max;

  // --- Step B: Priority assignment (dominant == pref #1) ---
  const afterB: StudentScores[] = [];

  for (const s of remaining) {
    if (s.dominantHouse === s.preferences[0] && canAssign(s.dominantHouse)) {
      assignments.push({ student_id: s.student_id, pseudo: s.pseudo, house: s.dominantHouse, method: 'priority' });
      houseCounts[s.dominantHouse]++;
    } else {
      afterB.push(s);
    }
  }

  // --- Step C: Compromise (score × preference rank weight) ---
  // Sort by best compromise score descending for fairness
  const compromiseScore = (s: StudentScores, house: HouseId): number => {
    const prefRank = s.preferences.indexOf(house);
    const rankWeight = prefRank >= 0 ? (4 - prefRank) : 0; // pref 1→4, pref 2→3, etc.
    return s.scores[house] * rankWeight;
  };

  const afterC: StudentScores[] = [];

  // Sort students by their best possible compromise score (highest first = most decisive)
  const sortedForC = [...afterB].sort((a, b) => {
    const bestA = Math.max(...HOUSES.filter(h => canAssign(h)).map(h => compromiseScore(a, h)));
    const bestB = Math.max(...HOUSES.filter(h => canAssign(h)).map(h => compromiseScore(b, h)));
    return bestB - bestA;
  });

  for (const s of sortedForC) {
    // Find best house by compromise score, avoiding pref #4 if possible
    const available = HOUSES.filter(h => canAssign(h));
    if (available.length === 0) {
      afterC.push(s);
      continue;
    }

    // Try without pref #4 first
    const withoutLast = available.filter(h => s.preferences.indexOf(h) !== 3);
    const candidates = withoutLast.length > 0 ? withoutLast : available;

    const bestHouse = candidates.reduce((best, h) =>
      compromiseScore(s, h) > compromiseScore(s, best) ? h : best, candidates[0]);

    assignments.push({ student_id: s.student_id, pseudo: s.pseudo, house: bestHouse, method: 'compromise' });
    houseCounts[bestHouse]++;
  }

  // --- Step D: Tiebreak (remaining students, assign by raw score) ---
  for (const s of afterC) {
    const available = HOUSES.filter(h => canAssign(h));
    if (available.length === 0) {
      // Force into least-full house
      const leastFull = HOUSES.reduce((best, h) =>
        houseCounts[h] < houseCounts[best] ? h : best, HOUSES[0]);
      assignments.push({ student_id: s.student_id, pseudo: s.pseudo, house: leastFull, method: 'tiebreak' });
      houseCounts[leastFull]++;
    } else {
      const bestHouse = available.reduce((best, h) =>
        s.scores[h] > s.scores[best] ? h : best, available[0]);
      assignments.push({ student_id: s.student_id, pseudo: s.pseudo, house: bestHouse, method: 'tiebreak' });
      houseCounts[bestHouse]++;
    }
  }

  return {
    assignments,
    unassigned: [],
    overrides: existingOverrides,
    quotas: houseCounts,
    target,
    max,
  };
}

// --- Save results to DB ---

export async function saveSortingResults(
  classId: string,
  assignments: SortingResult['assignments'],
): Promise<void> {
  // Get existing overrides to not overwrite them
  const existing = await fetchAssignments(classId);
  const overrideIds = new Set(existing.filter(a => a.override).map(a => a.student_id));

  for (const a of assignments) {
    if (overrideIds.has(a.student_id)) continue;
    await saveAssignment(a.student_id, classId, a.house, false);
  }
}
