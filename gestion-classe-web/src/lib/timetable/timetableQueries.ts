/**
 * Emploi du temps stocké (import .ics, plus tard saisie manuelle) et correspondance des libellés.
 * Tables : timetable_entries, timetable_label_links (migration 043).
 * Pronote en direct ne passe pas par ici, sauf pour la correspondance des libellés.
 */

import { supabase } from '../supabase';
import { clearPreference, fetchPreference, savePreference } from '../userPreferences';
import type { IcsEntry } from './icsParser';
import type { LabelLink } from './labelMatching';

/** Résumé du dernier import, gardé dans user_preferences (clé « timetable_import »). */
export interface TimetableImportInfo {
  importedAt: string;
  fileName: string;
  lessonCount: number;
  holidayCount: number;
  rangeStart: string | null;
  rangeEnd: string | null;
}

const IMPORT_INFO_KEY = 'timetable_import';
const CHUNK = 400;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ============================================
// Correspondance des libellés
// ============================================

export async function fetchLabelLinks(userId: string): Promise<LabelLink[]> {
  const { data, error } = await supabase
    .from('timetable_label_links')
    .select('label, class_id, group_id, ignored')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(r => ({
    label: r.label as string,
    classId: r.class_id as string | null,
    groupId: r.group_id as string | null,
    ignored: r.ignored as boolean,
  }));
}

export async function saveLabelLinks(userId: string, links: LabelLink[]): Promise<void> {
  if (links.length === 0) return;
  const now = new Date().toISOString();
  const rows = links.map(l => ({
    user_id: userId,
    label: l.label,
    class_id: l.ignored ? null : l.classId,
    group_id: l.ignored || !l.classId ? null : l.groupId,
    ignored: l.ignored || !l.classId,
    updated_at: now,
  }));
  for (const part of chunks(rows)) {
    const { error } = await supabase.from('timetable_label_links').upsert(part, { onConflict: 'user_id,label' });
    if (error) throw error;
  }
}

// ============================================
// Import .ics
// ============================================

/**
 * Synchronise les cours importés sur le contenu du fichier : mise à jour par external_id,
 * suppression de ceux qui ont disparu de l'export. La saisie manuelle n'est jamais touchée.
 */
export async function importIcsEntries(
  userId: string,
  entries: IcsEntry[],
  meta: { fileName: string; rangeStart: Date | null; rangeEnd: Date | null },
): Promise<{ saved: number; removed: number }> {
  const now = new Date().toISOString();
  // Un même UID en double dans le fichier ferait échouer l'upsert du lot entier
  const unique = [...new Map(entries.map(e => [e.externalId, e])).values()];

  const rows = unique.map(e => ({
    user_id: userId,
    source: 'ics',
    external_id: e.externalId,
    kind: e.kind,
    starts_at: e.startsAt.toISOString(),
    ends_at: e.endsAt.toISOString(),
    label: e.label,
    class_label: e.classLabel,
    subject: e.subject,
    room: e.room,
    status: e.status,
    updated_at: now,
  }));

  for (const part of chunks(rows)) {
    const { error } = await supabase
      .from('timetable_entries')
      .upsert(part, { onConflict: 'user_id,source,external_id' });
    if (error) throw error;
  }

  // Les lignes non réécrites par cet import ont disparu du fichier
  const keep = new Set(unique.map(e => e.externalId));
  const stale = await fetchStoredIds(userId, 'ics');
  const toRemove = stale.filter(r => !r.external_id || !keep.has(r.external_id)).map(r => r.id);
  for (const part of chunks(toRemove, 200)) {
    const { error } = await supabase.from('timetable_entries').delete().in('id', part);
    if (error) throw error;
  }

  const info: TimetableImportInfo = {
    importedAt: now,
    fileName: meta.fileName,
    lessonCount: unique.filter(e => e.kind === 'lesson').length,
    holidayCount: unique.filter(e => e.kind === 'holiday').length,
    rangeStart: meta.rangeStart?.toISOString() ?? null,
    rangeEnd: meta.rangeEnd?.toISOString() ?? null,
  };
  await savePreference(userId, IMPORT_INFO_KEY, info);

  return { saved: rows.length, removed: toRemove.length };
}

/** Identifiants des lignes d'une source (paginé : PostgREST plafonne à 1000 lignes par requête). */
async function fetchStoredIds(userId: string, source: 'ics' | 'manual'): Promise<{ id: string; external_id: string | null }[]> {
  const out: { id: string; external_id: string | null }[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select('id, external_id')
      .eq('user_id', userId)
      .eq('source', source)
      .order('id')
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data || []) as { id: string; external_id: string | null }[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function fetchImportInfo(userId: string): Promise<TimetableImportInfo | null> {
  return fetchPreference<TimetableImportInfo>(userId, IMPORT_INFO_KEY);
}

/** Retire tout l'emploi du temps importé (les correspondances sont gardées pour un prochain import). */
export async function deleteIcsEntries(userId: string): Promise<void> {
  const { error } = await supabase
    .from('timetable_entries')
    .delete()
    .eq('user_id', userId)
    .eq('source', 'ics');
  if (error) throw error;
  await clearPreference(userId, IMPORT_INFO_KEY);
}

/** Libellés des cours déjà importés, pour rouvrir la correspondance sans réimporter. */
export async function fetchStoredLessonLabels(
  userId: string,
): Promise<{ label: string; classLabel: string | null; subject: string | null }[]> {
  const out: { label: string; classLabel: string | null; subject: string | null }[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('timetable_entries')
      .select('label, class_label, subject')
      .eq('user_id', userId)
      .eq('kind', 'lesson')
      .order('id')
      .range(from, from + page - 1);
    if (error) throw error;
    for (const r of data || []) out.push({ label: r.label, classLabel: r.class_label, subject: r.subject });
    if (!data || data.length < page) break;
  }
  return out;
}

// ============================================
// Lecture pour l'affichage
// ============================================

export interface StoredTimetableEntry {
  id: string;
  kind: 'lesson' | 'holiday';
  starts_at: string;
  ends_at: string;
  label: string;
  class_label: string | null;
  subject: string | null;
  room: string | null;
  status: 'normal' | 'canceled' | 'modified' | 'exceptional';
}

/** Cours et congés qui touchent l'intervalle [from, to[ (un congé peut commencer avant). */
export async function fetchEntriesBetween(userId: string, from: Date, to: Date): Promise<StoredTimetableEntry[]> {
  const { data, error } = await supabase
    .from('timetable_entries')
    .select('id, kind, starts_at, ends_at, label, class_label, subject, room, status')
    .eq('user_id', userId)
    .lt('starts_at', to.toISOString())
    .gt('ends_at', from.toISOString())
    .order('starts_at');
  if (error) throw error;
  return (data || []) as StoredTimetableEntry[];
}
