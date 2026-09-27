/**
 * Contraintes de placement (migration 045, table seating_constraints), propres à une classe.
 * Le calcul lui-même est dans seatingAuto.ts (pur).
 */
import { supabase } from './supabase';
import type { SeatingConstraint, SeatingConstraintKind } from './seatingAuto';

const COLUMNS = 'id, class_id, student_id, kind, other_student_id, params';

type Row = {
  id: string;
  class_id: string;
  student_id: string;
  kind: SeatingConstraintKind;
  other_student_id: string | null;
  params: { minDistance?: number } | null;
};

export interface StoredSeatingConstraint extends SeatingConstraint {
  class_id: string;
}

function fromRow(r: Row): StoredSeatingConstraint {
  return {
    id: r.id,
    class_id: r.class_id,
    student_id: r.student_id,
    kind: r.kind,
    other_student_id: r.other_student_id,
    params: r.params ?? null,
  };
}

/** Table absente ou erreur : liste vide, le générateur fonctionne sans contrainte. */
export async function fetchSeatingConstraints(classId: string): Promise<StoredSeatingConstraint[]> {
  const { data, error } = await supabase
    .from('seating_constraints')
    .select(COLUMNS)
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
  if (error) {
    console.warn('[seatingConstraints] lecture impossible :', error.message);
    return [];
  }
  return ((data || []) as Row[]).map(fromRow);
}

export async function addSeatingConstraint(
  userId: string,
  classId: string,
  input: { student_id: string; kind: SeatingConstraintKind; other_student_id?: string | null; params?: { minDistance?: number } | null },
): Promise<StoredSeatingConstraint> {
  const { data, error } = await supabase
    .from('seating_constraints')
    .insert({
      user_id: userId,
      class_id: classId,
      student_id: input.student_id,
      kind: input.kind,
      other_student_id: input.other_student_id ?? null,
      params: input.params ?? {},
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function deleteSeatingConstraint(id: string): Promise<void> {
  const { error } = await supabase.from('seating_constraints').delete().eq('id', id);
  if (error) throw error;
}
