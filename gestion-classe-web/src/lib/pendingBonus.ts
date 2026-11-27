/**
 * Bonus choisis mais pas encore accordés. Choisir le bonus clôt la carte pleine et en ouvre une
 * nouvelle : sans ce relevé, le bonus en attente (sur la carte close) n'était plus affiché nulle part,
 * ni le bouton « Valider bonus ».
 */

export interface BonusSelectionRow {
  id: string;
  student_id: string;
  used_at: string | null;
  selected_at: string | null;
  label: string;
}

export interface PendingBonus {
  id: string;
  label: string;
  /** Autres bonus en attente pour le même élève (accordés ensuite, un à la fois). */
  others: number;
}

/** Par élève, le plus ancien bonus choisi et non accordé. */
export function pendingBonusByStudent(rows: BonusSelectionRow[]): Map<string, PendingBonus> {
  const byStudent = new Map<string, BonusSelectionRow[]>();
  for (const r of rows) {
    if (r.used_at) continue;
    const list = byStudent.get(r.student_id) ?? [];
    list.push(r);
    byStudent.set(r.student_id, list);
  }
  const out = new Map<string, PendingBonus>();
  for (const [studentId, list] of byStudent) {
    list.sort((a, b) => (a.selected_at ?? '').localeCompare(b.selected_at ?? ''));
    out.set(studentId, { id: list[0].id, label: list[0].label, others: list.length - 1 });
  }
  return out;
}
