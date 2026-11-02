/**
 * « Ajouter une copie » (migration 058) : préparer des pages dans le navigateur (photo, PDF,
 * webcam), puis les envoyer, soit avec la session du prof (import, webcam), soit par la page
 * publique /depot ouverte depuis le QR code (Edge Function depot-copie, avec un jeton).
 *
 * Même profil que le scan mobile (gestion-classe-mobile/services/copies/path.ts) : 2000 px au
 * plus sur le grand côté, JPEG 0,75, jamais agrandi, et repli à 0,5 au-delà de 4,5 Mo.
 */
import { supabase } from './supabase';
import { getPdfjs } from './pdfjs';

export const COPY_PROFILE = { maxLongEdge: 2000, jpegQuality: 0.75, fallbackQuality: 0.5, maxBytes: 4.5 * 1024 * 1024 };
const BUCKET = 'assessment-copies';

/** Taille de sortie : grand côté ramené à `max`, jamais agrandi. */
export function fitSize(width: number, height: number, max = COPY_PROFILE.maxLongEdge): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max || long === 0) return { width, height };
  const k = max / long;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

/** Taille du dessin après `quarterTurns` quarts de tour (dans le sens horaire). */
export function rotatedSize(width: number, height: number, quarterTurns: number): { width: number; height: number } {
  return ((quarterTurns % 4) + 4) % 2 === 1 ? { width: height, height: width } : { width, height };
}

/** Une page en attente d'envoi : la source d'origine et la rotation choisie. */
export interface DraftPage {
  id: string;
  source: Blob | HTMLCanvasElement;
  turns: number;
  /** Vignette (object URL), à libérer avec URL.revokeObjectURL. */
  preview: string;
  /** `source` est déjà un JPEG au profil d'envoi : sans rotation, il part tel quel. */
  prepared?: boolean;
}

let seq = 0;
export function draftId(): string {
  seq += 1;
  return `p${Date.now().toString(36)}${seq}`;
}

async function toBitmapSource(source: Blob | HTMLCanvasElement): Promise<CanvasImageSource & { width: number; height: number }> {
  if (source instanceof HTMLCanvasElement) return source;
  // imageOrientation : les photos de téléphone gardent le sens de leurs données EXIF.
  return createImageBitmap(source, { imageOrientation: 'from-image' });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image impossible à encoder'))), 'image/jpeg', quality),
  );
}

/** Page prête à l'envoi : tournée, réduite, en JPEG. */
export async function preparePage(source: Blob | HTMLCanvasElement, turns = 0): Promise<Blob> {
  const img = await toBitmapSource(source);
  const target = fitSize(img.width, img.height);
  const out = rotatedSize(target.width, target.height, turns);
  const canvas = document.createElement('canvas');
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((((turns % 4) + 4) % 4) * (Math.PI / 2));
  ctx.drawImage(img, -target.width / 2, -target.height / 2, target.width, target.height);
  if ('close' in img && typeof img.close === 'function') img.close();
  const blob = await canvasToBlob(canvas, COPY_PROFILE.jpegQuality);
  return blob.size <= COPY_PROFILE.maxBytes ? blob : canvasToBlob(canvas, COPY_PROFILE.fallbackQuality);
}

/** Page prête à l'envoi, sans réencoder une page déjà au profil et non tournée. */
export async function draftToUpload(d: DraftPage): Promise<Blob> {
  if (d.prepared && d.source instanceof Blob && ((d.turns % 4) + 4) % 4 === 0) return d.source;
  return preparePage(d.source, d.turns);
}

/** Une page par page de PDF, rendue à 2000 px sur le grand côté. */
export async function pdfToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = [];
  await eachPdfPage(file, async (canvas) => {
    out.push(canvas);
  });
  return out;
}

/** Rend les pages d'un PDF une à une (2000 px sur le grand côté). */
async function eachPdfPage(file: File, onPage: (canvas: HTMLCanvasElement) => Promise<void>): Promise<void> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: COPY_PROFILE.maxLongEdge / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdfjs-dist v5 : le type RenderParameters exige un cast (voir mémoire projet)
      await page.render({ canvasContext: ctx, viewport } as never).promise;
      await onPage(canvas);
    }
  } finally {
    await doc.destroy();
  }
}

/** Fichiers choisis (images et PDF) → pages en attente, dans l'ordre. */
export async function filesToDrafts(files: File[]): Promise<DraftPage[]> {
  const drafts: DraftPage[] = [];
  for (const f of files) {
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      for (const canvas of await pdfToCanvases(f)) {
        const preview = URL.createObjectURL(await canvasToBlob(canvas, 0.6));
        drafts.push({ id: draftId(), source: canvas, turns: 0, preview });
      }
    } else if (f.type.startsWith('image/')) {
      drafts.push({ id: draftId(), source: f, turns: 0, preview: URL.createObjectURL(f) });
    }
  }
  return drafts;
}

/** Ordre « naturel » des noms de fichiers : IMG_2 avant IMG_10. */
export function sortFilesByName<T extends { name: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }));
}

/** Un canvas → page au profil d'envoi, gardée en JPEG (le canvas est libéré). */
export async function canvasToPreparedDraft(canvas: HTMLCanvasElement): Promise<DraftPage> {
  const blob = await preparePage(canvas, 0);
  canvas.width = 0;
  canvas.height = 0;
  return { id: draftId(), source: blob, turns: 0, preview: URL.createObjectURL(blob), prepared: true };
}

/**
 * Comme filesToDrafts, pour le paquet d'une classe : chaque page de PDF est mise au profil
 * d'envoi tout de suite et son canvas libéré (une classe en canvas pèserait ~600 Mo).
 * Les fichiers sont pris dans l'ordre de leur nom.
 */
export async function filesToCompactDrafts(files: File[], onProgress?: (pages: number) => void): Promise<DraftPage[]> {
  const drafts: DraftPage[] = [];
  for (const f of sortFilesByName(files)) {
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      await eachPdfPage(f, async (canvas) => {
        drafts.push(await canvasToPreparedDraft(canvas));
        onProgress?.(drafts.length);
      });
    } else if (f.type.startsWith('image/')) {
      drafts.push({ id: draftId(), source: f, turns: 0, preview: URL.createObjectURL(f) });
      onProgress?.(drafts.length);
    }
  }
  return drafts;
}

/** Déplace l'élément `from` à la place `to` (réordonnancement des vignettes). */
export function movePage<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/* ---------- envoi avec la session du prof (import, webcam) ---------- */

/**
 * Range les pages après celles de l'élève (ou à leur place si `replace`), comme le scan mobile :
 * fichier `<user>/<éval>/<élève>/<id>.jpg` dans le bucket, puis une ligne assessment_copy_pages.
 */
export async function uploadPagesAsTeacher(params: {
  userId: string;
  assessmentId: string;
  studentId: string;
  pages: Blob[];
  replace: boolean;
  onProgress?: (done: number) => void;
}): Promise<void> {
  const { userId, assessmentId, studentId, pages, replace } = params;
  const { data: existing, error: listError } = await supabase
    .from('assessment_copy_pages')
    .select('id, page_order, storage_path')
    .eq('assessment_id', assessmentId)
    .eq('student_id', studentId)
    .order('page_order', { ascending: false });
  if (listError) throw listError;

  // Les nouvelles pages d'abord, après les anciennes ; les anciennes ne partent qu'une fois
  // tout envoyé (un envoi qui casse en route ne fait rien perdre).
  let order = (existing?.[0]?.page_order as number | undefined) ?? 0;
  for (let i = 0; i < pages.length; i++) {
    const id = crypto.randomUUID();
    const path = `${userId}/${assessmentId}/${studentId}/${id}.jpg`;
    const { error: upError } = await supabase.storage.from(BUCKET).upload(path, pages[i], { contentType: 'image/jpeg' });
    if (upError) throw upError;
    order += 1;
    const { error } = await supabase.from('assessment_copy_pages').insert({
      id,
      user_id: userId,
      assessment_id: assessmentId,
      student_id: studentId,
      page_order: order,
      storage_path: path,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
    params.onProgress?.(i + 1);
  }

  if (replace && existing && existing.length > 0) {
    const { error } = await supabase.from('assessment_copy_pages').delete().in('id', existing.map((p) => p.id));
    if (error) throw error;
    const { error: rmError } = await supabase.storage.from(BUCKET).remove(existing.map((p) => p.storage_path));
    if (rmError) throw rmError;
  }
}

/* ---------- copies « Pas de nom » (migration 061) ---------- */

/** Une copie rangée sans élève, à identifier plus tard. */
export interface UnnamedCopy {
  copyId: string;
  createdAt: string;
  pages: { id: string; page_order: number; storage_path: string }[];
}

/** Regroupe les pages sans nom par copie, de la plus ancienne à la plus récente. */
export function groupUnnamed(
  rows: { id: string; copy_id: string; page_order: number; storage_path: string; created_at: string }[],
): UnnamedCopy[] {
  const by = new Map<string, UnnamedCopy>();
  for (const r of rows) {
    const c = by.get(r.copy_id) ?? { copyId: r.copy_id, createdAt: r.created_at, pages: [] };
    if (r.created_at < c.createdAt) c.createdAt = r.created_at;
    c.pages.push({ id: r.id, page_order: r.page_order, storage_path: r.storage_path });
    by.set(r.copy_id, c);
  }
  const out = [...by.values()];
  for (const c of out) c.pages.sort((a, b) => a.page_order - b.page_order);
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.copyId.localeCompare(b.copyId));
}

/** Copies sans nom d'une éval ; vide si la migration 061 n'est pas passée. */
export async function fetchUnnamedCopies(assessmentId: string): Promise<UnnamedCopy[]> {
  const { data, error } = await supabase
    .from('assessment_unnamed_pages')
    .select('id, copy_id, page_order, storage_path, created_at')
    .eq('assessment_id', assessmentId);
  if (error) return [];
  return groupUnnamed(data || []);
}

/** Range une copie sans élève : fichiers sous `<user>/<éval>/sans-nom/`. */
export async function uploadUnnamedAsTeacher(params: {
  userId: string;
  assessmentId: string;
  pages: Blob[];
  onProgress?: (done: number) => void;
}): Promise<string> {
  const copyId = crypto.randomUUID();
  for (let i = 0; i < params.pages.length; i++) {
    const id = crypto.randomUUID();
    const path = `${params.userId}/${params.assessmentId}/sans-nom/${id}.jpg`;
    const { error: upError } = await supabase.storage.from(BUCKET).upload(path, params.pages[i], { contentType: 'image/jpeg' });
    if (upError) throw upError;
    const { error } = await supabase.from('assessment_unnamed_pages').insert({
      id,
      user_id: params.userId,
      assessment_id: params.assessmentId,
      copy_id: copyId,
      page_order: i + 1,
      storage_path: path,
    });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
    params.onProgress?.(i + 1);
  }
  return copyId;
}

/** Donne une copie sans nom à un élève : ses pages passent après les siennes. */
export async function assignUnnamedCopy(copyId: string, studentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('assign_unnamed_copy', { p_copy_id: copyId, p_student_id: studentId });
  if (error) throw error;
  return data as number;
}

/** Supprime une copie sans nom (lignes puis fichiers). */
export async function deleteUnnamedCopy(copy: UnnamedCopy): Promise<void> {
  const { error } = await supabase.from('assessment_unnamed_pages').delete().eq('copy_id', copy.copyId);
  if (error) throw error;
  const { error: rmError } = await supabase.storage.from(BUCKET).remove(copy.pages.map((p) => p.storage_path));
  if (rmError) throw rmError;
}

/**
 * Version du sujet et copie adaptée, comme au scan mobile (assessment_grades, seules ces
 * colonnes : la note et le détail éventuels ne bougent pas).
 */
export async function saveCopyInfo(params: {
  userId: string;
  assessmentId: string;
  studentId: string;
  subjectVersion: string | null;
  isAdapted: boolean;
}): Promise<void> {
  const { error } = await supabase.from('assessment_grades').upsert(
    {
      user_id: params.userId,
      assessment_id: params.assessmentId,
      student_id: params.studentId,
      subject_version: params.subjectVersion,
      is_adapted: params.isAdapted,
    },
    { onConflict: 'assessment_id,student_id' },
  );
  if (error) throw error;
}

/* ---------- envoi par QR code (Edge Function depot-copie) ---------- */

export interface DepotToken {
  token: string;
  expires_at: string;
  max_pages: number;
  mode?: 'student' | 'class';
}

export interface DepotInfo {
  /** Jeton d'un élève, ou de toute l'éval (migration 061). Absent : ancienne fonction (élève). */
  mode?: 'student' | 'class';
  pseudo: string;
  class_name: string;
  assessment_name: string;
  pages_uploaded: number;
  max_pages: number;
  expires_at: string;
  /** Jeton de classe : élèves attendus et pages déjà rangées. */
  students?: { id: string; pseudo: string; pages: number }[];
  unnamed_copies?: number;
}

/** À qui va une page envoyée avec un jeton de classe. */
export type DepotTarget = { student_id: string } | { unnamed: true; copy_id?: string };

async function invokeDepot<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('depot-copie', { body });
  if (error) {
    let code = 'unknown';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        code = ((await ctx.json()) as { error?: string }).error ?? code;
      } catch {
        // corps non JSON
      }
    }
    throw new Error(code);
  }
  return data as T;
}

/** Sans élève : jeton pour toute l'éval (« Ajouter les copies de la classe »). */
export const createDepotToken = (assessmentId: string, studentId: string | null) =>
  invokeDepot<DepotToken>({ action: 'create', assessment_id: assessmentId, ...(studentId ? { student_id: studentId } : {}) });

export const revokeDepotToken = (token: string) => invokeDepot<{ ok: true }>({ action: 'revoke', token });

export const fetchDepotInfo = (token: string) => invokeDepot<DepotInfo>({ action: 'info', token });

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Lecture impossible'));
    reader.readAsDataURL(blob);
  });
}

export async function uploadDepotPage(
  token: string,
  page: Blob,
  target?: DepotTarget,
): Promise<{ page_order: number; pages_uploaded: number; copy_id?: string }> {
  return invokeDepot({ action: 'upload', token, image: await blobToBase64(page), ...(target ?? {}) });
}

/** Lien du QR code : le jeton est dans le fragment (#), qui ne part jamais vers le serveur web. */
export function depotUrl(token: string, origin = window.location.origin): string {
  return `${origin}/gestion-classe/depot#${token}`;
}

const DEPOT_ERRORS: Record<string, string> = {
  expired: 'Ce QR code a expiré ou a été fermé sur l’ordinateur. Génère-en un nouveau.',
  expired_or_full: 'Ce QR code a expiré, a été fermé, ou a reçu le nombre maximum de pages.',
  too_large: 'Image trop lourde (5 Mo au plus).',
  bad_image: 'Image illisible : reprends la photo.',
  bad_student: 'Cet élève ne fait pas partie de cette éval.',
  bad_copy: 'Copie sans nom introuvable : recommence « Pas de nom ».',
};

export function describeDepotError(code: string): string {
  return DEPOT_ERRORS[code] ?? `Envoi impossible (${code}).`;
}
