/**
 * Fichiers rattachés à une séquence (table `course_files` et dossier de stockage `course-files`,
 * migration 078). Lot F1 de PLAN_mes_cours.md.
 *
 * Table absente (migration non appliquée) : la liste est vide et `courseFilesUnavailable()` le dit,
 * pour que la page ne propose pas d'ajouter un fichier.
 */
import { supabase } from './supabase';
import { storagePathFor, type CourseFile } from './courseFiles';

const BUCKET = 'course-files';
const COLUMNS = 'id, level, chapter, name, storage_path, mime, size, created_at';

type Row = { id: string; level: string | null; chapter: string; name: string; storage_path: string; mime: string | null; size: number; created_at: string };

const fromRow = (r: Row): CourseFile => ({
  id: r.id, level: r.level, chapter: r.chapter, name: r.name, storagePath: r.storage_path, mime: r.mime, size: Number(r.size), createdAt: r.created_at,
});

let tableMissing = false;

const isMissingTable = (error: { message?: string; code?: string } | null): boolean =>
  !!error && (error.code === '42P01' || error.code === 'PGRST205' || /course_files/i.test(error.message ?? ''));

/** Vrai si la migration 078 n'est pas appliquée (détecté au premier appel). */
export const courseFilesUnavailable = (): boolean => tableMissing;

export async function listCourseFiles(userId: string): Promise<CourseFile[]> {
  if (tableMissing) return [];
  const { data, error } = await supabase.from('course_files').select(COLUMNS).eq('user_id', userId).order('name');
  if (isMissingTable(error)) {
    tableMissing = true;
    console.warn('[courseFiles] table « course_files » absente : migration 078 à appliquer');
    return [];
  }
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

const newId = (): string => crypto.randomUUID();

/**
 * Dépose un fichier dans une séquence : le contenu d'abord, sa ligne ensuite. Si la ligne ne
 * s'écrit pas, le contenu est retiré pour ne pas occuper de place sans être visible.
 */
export async function uploadCourseFile(userId: string, level: string | null, chapter: string, file: File): Promise<CourseFile> {
  const id = newId();
  const path = storagePathFor(userId, id, file.name);
  const mime = file.type || null;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime ?? undefined, upsert: false });
  if (uploadError) throw new Error(`Envoi de « ${file.name} » impossible : ${uploadError.message}`);
  const { data, error } = await supabase
    .from('course_files')
    .insert({ id, user_id: userId, level, chapter, name: file.name, storage_path: path, mime, size: file.size })
    .select(COLUMNS)
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw error;
  }
  return fromRow(data as Row);
}

/** Contenu d'un fichier, prêt pour la visionneuse ou le téléchargement. */
export async function downloadCourseFile(file: CourseFile): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET).download(file.storagePath);
  if (error || !data) throw new Error(`« ${file.name} » est introuvable dans le stockage.`);
  return new File([data], file.name, { type: file.mime ?? data.type });
}

export async function renameCourseFile(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('course_files').update({ name }).eq('id', id);
  if (error) throw error;
}

/** Supprime la ligne puis le contenu (dans cet ordre : un contenu orphelin ne se voit pas, une ligne sans contenu si). */
export async function deleteCourseFile(file: CourseFile): Promise<void> {
  const { error } = await supabase.from('course_files').delete().eq('id', file.id);
  if (error) throw error;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove([file.storagePath]);
  if (removeError) console.warn('[courseFiles] contenu non retiré du stockage :', removeError.message);
}

/** Les fichiers d'une séquence renommée la suivent (même filtre que `renameChapter` pour les cours). */
export async function renameFilesChapter(userId: string, level: string | null, from: string, to: string): Promise<void> {
  const next = to.trim();
  if (tableMissing || !next || next === from) return;
  const query = supabase.from('course_files').update({ chapter: next }).eq('user_id', userId).eq('chapter', from);
  const { error } = await (level === null ? query.is('level', null) : query.eq('level', level));
  if (isMissingTable(error)) { tableMissing = true; return; }
  if (error) throw error;
}

export interface StorageUsage {
  /** Tout le stockage du projet, en octets. */
  totalBytes: number;
  /** Dont les fichiers des séquences. */
  courseFilesBytes: number;
}

/** Jauge du stockage (fonction `storage_usage`, migration 078) ; null si elle ne répond pas. */
export async function fetchStorageUsage(): Promise<StorageUsage | null> {
  const { data, error } = await supabase.rpc('storage_usage');
  if (error) {
    if (error.code !== 'PGRST202' && error.code !== '42883') console.warn('[courseFiles] jauge de stockage :', error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { total_bytes: number; course_files_bytes: number } | null;
  return row ? { totalBytes: Number(row.total_bytes), courseFilesBytes: Number(row.course_files_bytes) } : null;
}
