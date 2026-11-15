/**
 * Fichiers rattachés à une séquence de « Mes cours » (lot F1 de PLAN_mes_cours.md) : règles et
 * rangement, sans accès à la base (voir `courseFilesQueries.ts`).
 *
 * Un fichier appartient à une séquence par (niveau, nom de séquence), les deux champs qui rangent
 * déjà les cours. Le stockage est celui du projet : 1 Go en tout sur l'offre gratuite, d'où un
 * plafond par fichier, pas de vidéo, et une jauge.
 */

export interface CourseFile {
  id: string;
  /** Niveau de la séquence ; null = sans niveau. */
  level: string | null;
  /** Nom de la séquence. */
  chapter: string;
  name: string;
  storagePath: string;
  mime: string | null;
  size: number;
  createdAt: string;
}

/** Plafond d'un fichier (même valeur que le dossier de stockage, migration 078). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Stockage de l'offre gratuite de Supabase, pour toute l'organisation. */
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;

export type CourseFileKind = 'pdf' | 'image' | 'audio' | 'document' | 'text';

const EXTENSIONS: Record<CourseFileKind, string[]> = {
  pdf: ['pdf'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  audio: ['mp3', 'm4a', 'wav', 'ogg', 'oga', 'webm', 'aac', 'flac'],
  document: ['docx', 'doc', 'odt', 'pptx', 'ppt', 'odp', 'xlsx', 'xls', 'ods'],
  text: ['txt'],
};

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'wmv', 'm4v'];

/** Types proposés par le sélecteur de fichiers. */
export const ACCEPTED_FILES = Object.values(EXTENSIONS).flat().map((e) => `.${e}`).join(',');

export const extensionOf = (name: string): string => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/** Nature d'un fichier d'après son extension ; null s'il n'est pas accepté. */
export function courseFileKind(name: string): CourseFileKind | null {
  const ext = extensionOf(name);
  return (Object.keys(EXTENSIONS) as CourseFileKind[]).find((kind) => EXTENSIONS[kind].includes(ext)) ?? null;
}

/** « 1,4 Mo », « 320 Ko » */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} Go`;
}

/**
 * Raison de refuser un fichier, ou null s'il est accepté. `usedBytes` : stockage déjà occupé
 * (null si la jauge n'a pas répondu : seul le plafond par fichier s'applique alors).
 */
export function refuseCourseFile(file: { name: string; size: number }, usedBytes: number | null): string | null {
  const ext = extensionOf(file.name);
  if (VIDEO_EXTENSIONS.includes(ext)) return `« ${file.name} » est une vidéo : elles ne se déposent pas ici. Colle plutôt son lien dans le cours ou le tableau.`;
  if (!courseFileKind(file.name)) return `« ${file.name} » : ce type de fichier (${ext || 'sans extension'}) n'est pas accepté. PDF, images, sons et documents Word, PowerPoint ou Excel le sont.`;
  if (file.size > MAX_FILE_BYTES) return `« ${file.name} » pèse ${formatBytes(file.size)} : le plafond est de ${formatBytes(MAX_FILE_BYTES)} par fichier.`;
  if (file.size === 0) return `« ${file.name} » est vide.`;
  if (usedBytes !== null && usedBytes + file.size > STORAGE_QUOTA_BYTES) return `Plus assez de place pour « ${file.name} » : le stockage est presque plein (${formatBytes(usedBytes)} sur ${formatBytes(STORAGE_QUOTA_BYTES)}).`;
  return null;
}

/** Chemin du fichier dans le dossier de stockage : sans le nom d'origine, dont les accents gênent. */
export function storagePathFor(userId: string, fileId: string, name: string): string {
  const ext = extensionOf(name);
  return ext ? `${userId}/${fileId}.${ext}` : `${userId}/${fileId}`;
}

/** Identifie une séquence (niveau + nom) : envoi en cours, survol d'un dépôt. */
export const sequenceKey = (level: string | null, chapter: string): string => `${level ?? ''}|${chapter}`;

const byName = (a: CourseFile, b: CourseFile) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });

/** Fichiers d'une séquence, triés par nom. */
export function filesOfSequence(files: CourseFile[], level: string | null, chapter: string): CourseFile[] {
  return files.filter((f) => (f.level ?? null) === level && f.chapter === chapter).sort(byName);
}

/** Nom saisi pour renommer un fichier : son extension d'origine est remise si elle a été retirée. */
export function renamedFile(original: string, typed: string): string {
  const name = typed.trim();
  if (!name) return original;
  const ext = extensionOf(original);
  return ext && extensionOf(name) !== ext ? `${name}.${ext}` : name;
}

export type UsageLevel = 'ok' | 'warn' | 'full';

/** État de la jauge : à surveiller à partir de 80 %, plein à partir de 95 %. */
export function usageLevel(usedBytes: number): UsageLevel {
  const ratio = usedBytes / STORAGE_QUOTA_BYTES;
  return ratio >= 0.95 ? 'full' : ratio >= 0.8 ? 'warn' : 'ok';
}
