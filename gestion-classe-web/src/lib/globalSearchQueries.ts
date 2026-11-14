/**
 * Ce que la recherche globale lit en base : cours de la bibliothèque, classes, élèves, évaluations.
 * Quatre lectures légères, lancées à la première ouverture de la fenêtre et gardées une minute.
 * Une lecture qui échoue retire seulement sa famille de résultats.
 */
import { supabase } from './supabase';
import { listBoards } from './boardsQueries';
import { courseHref } from './courseLibrary';
import { fetchAssessments } from './evaluationQueries';
import { tools } from '../tools/registry';
import type { SearchItem } from './globalSearch';

const FRESH_MS = 60_000;

let cache: { userId: string; at: number; items: SearchItem[] } | null = null;

/** Oublie les résultats gardés (après une création ou une suppression faite ailleurs dans la page). */
export const clearSearchCache = (): void => { cache = null; };

const settled = <T,>(result: PromiseSettledResult<T>, fallback: T, what: string): T => {
  if (result.status === 'fulfilled') return result.value;
  console.warn(`[globalSearch] ${what} :`, result.reason);
  return fallback;
};

const shortDate = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null;

export function toolItems(): SearchItem[] {
  return tools.map((t) => ({ kind: 'tool' as const, id: t.id, title: t.name, hint: t.description, keywords: (t.tags ?? []).join(' '), href: `/tools/${t.id}` }));
}

async function fetchClassesAndStudents(userId: string): Promise<SearchItem[]> {
  const [classes, students] = await Promise.all([
    supabase.from('classes').select('id, name').eq('user_id', userId).order('name'),
    supabase.from('students').select('id, pseudo, class_id').eq('user_id', userId).order('pseudo'),
  ]);
  if (classes.error) throw classes.error;
  if (students.error) throw students.error;
  const classRows = (classes.data ?? []) as { id: string; name: string }[];
  const names = new Map(classRows.map((c) => [c.id, c.name]));
  return [
    ...classRows.map((c) => ({ kind: 'class' as const, id: c.id, title: c.name, hint: 'Classes et plans', href: `/classes?class=${c.id}` })),
    // Élèves détachés de toute classe (fin d'année) : ils n'ont plus de fiche à ouvrir
    ...((students.data ?? []) as { id: string; pseudo: string; class_id: string | null }[])
      .filter((s) => s.class_id !== null)
      .map((s) => ({ kind: 'student' as const, id: s.id, title: s.pseudo, hint: names.get(s.class_id!) ?? undefined, href: `/students?class=${s.class_id}&student=${s.id}` })),
  ];
}

/** Tout ce que l'on peut chercher hors pages et réglages (qui ne demandent aucune lecture). */
export async function fetchSearchItems(userId: string): Promise<SearchItem[]> {
  if (cache && cache.userId === userId && Date.now() - cache.at < FRESH_MS) return cache.items;
  const [boards, people, assessments] = await Promise.allSettled([
    listBoards(userId),
    fetchClassesAndStudents(userId),
    fetchAssessments(userId),
  ]);
  const items: SearchItem[] = [
    ...settled(boards, [], 'cours').map((b) => ({
      kind: 'course' as const,
      id: b.id,
      title: b.title,
      hint: [b.level, b.chapter].filter(Boolean).join(' · ') || undefined,
      href: courseHref(b.id),
    })),
    ...settled(people, [], 'classes et élèves'),
    ...settled(assessments, [], 'évaluations').map((a) => ({
      kind: 'assessment' as const,
      id: a.id,
      title: a.name,
      hint: [a.classes?.name, shortDate(a.date)].filter(Boolean).join(' · ') || undefined,
      href: `/evaluations/${a.id}`,
    })),
    ...toolItems(),
  ];
  cache = { userId, at: Date.now(), items };
  return items;
}
