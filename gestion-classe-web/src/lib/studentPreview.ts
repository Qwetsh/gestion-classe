/**
 * « Vision élève » (page /vision-eleve) : la liste des codes de connexion du professeur, rangée par
 * classe, pour ouvrir l'espace élève d'un élève dans un téléphone simulé.
 *
 * Seuls le pseudo (prénom et deux lettres) et le code sont lus : la page ne montre ni aménagement
 * ni note.
 */
import { supabase } from './supabase';
import { fetchAllPages } from './paging';

export interface PreviewStudent {
  id: string;
  pseudo: string;
  code: string;
  isWitness: boolean;
}

export interface PreviewClass {
  id: string;
  name: string;
  students: PreviewStudent[];
}

interface ClassRow { id: string; name: string }
interface StudentRow { id: string; pseudo: string; class_id: string | null; student_code: string | null; is_witness: boolean }

/** Un code de connexion valide : six chiffres. */
export const isStudentCode = (code: string | null | undefined): code is string => !!code && /^\d{6}$/.test(code);

/**
 * Classes triées par nom, élèves triés par pseudo ; l'élève témoin en tête de sa classe (c'est lui
 * qu'on ouvre pour voir tout ce que la classe peut voir). Un élève sans code valide ou sans classe
 * connue est laissé de côté ; une classe sans élève aussi.
 */
export function groupPreviewStudents(classes: ClassRow[], students: StudentRow[]): PreviewClass[] {
  const byClass = new Map<string, PreviewStudent[]>();
  for (const s of students) {
    if (!s.class_id || !isStudentCode(s.student_code)) continue;
    const list = byClass.get(s.class_id) ?? [];
    list.push({ id: s.id, pseudo: s.pseudo, code: s.student_code, isWitness: s.is_witness });
    byClass.set(s.class_id, list);
  }
  return [...classes]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
    .filter((c) => byClass.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      students: byClass.get(c.id)!.sort((a, b) =>
        a.isWitness !== b.isWitness ? (a.isWitness ? -1 : 1) : a.pseudo.localeCompare(b.pseudo, 'fr')),
    }));
}

/** Retire les accents et la casse, pour chercher « eloise » et trouver « Éloïse ». */
const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Filtre par pseudo, par code (début du code) ou par nom de classe (« 4B » garde toute la classe).
 * Une recherche vide rend la liste telle quelle.
 */
export function filterPreviewClasses(classes: PreviewClass[], query: string): PreviewClass[] {
  const q = fold(query.trim());
  if (!q) return classes;
  return classes
    .map((c) => {
      if (fold(c.name).replace(/\s/g, '') === q.replace(/\s/g, '')) return c;
      return { ...c, students: c.students.filter((s) => fold(s.pseudo).includes(q) || s.code.startsWith(q)) };
    })
    .filter((c) => c.students.length > 0);
}

/** Adresse de l'espace élève qui se connecte seul avec ce code (voir StudentDashboard, `?code=`). */
export function studentSpaceUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, '')}/eleve?code=${encodeURIComponent(code)}`;
}

/** Les classes du professeur et les codes de leurs élèves. */
export async function fetchPreviewClasses(userId: string): Promise<PreviewClass[]> {
  const [classes, students] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name')
      .eq('user_id', userId)
      .not('is_deleted', 'is', true),
    fetchAllPages<StudentRow>(async (from, to) => supabase
      .from('students')
      .select('id, pseudo, class_id, student_code, is_witness')
      .eq('user_id', userId)
      .not('is_deleted', 'is', true)
      .order('pseudo')
      .order('id')
      .range(from, to)),
  ]);
  if (classes.error) throw classes.error;
  return groupPreviewStudents(classes.data ?? [], students);
}
