/**
 * Import de fichiers (PDF, images) en pages de tableau blanc.
 * Chaque page de PDF devient une page du tableau avec l'image en fond ;
 * les images sont réduites puis envoyées dans le bucket privé board-assets.
 */
import { supabase } from './supabase';
import { BOARD_BUCKET, type BoardPage, type PageImage } from './boardRender';

const MAX_RENDER_WIDTH = 1800;
const JPEG_QUALITY = 0.86;

export interface ImportProgress { done: number; total: number; label: string }

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;
function getPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return lib;
    });
  }
  return pdfjsReady;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion JPEG impossible'))), 'image/jpeg', JPEG_QUALITY);
  });
}

/** Envoie une image (fichier ou blob collé) dans le bucket, redimensionnée si énorme. */
export async function uploadBoardImage(file: File | Blob, userId: string, sessionId: string): Promise<{ path: string; width: number; height: number }> {
  const asFile = file instanceof File ? file : new File([file], 'image.png', { type: file.type || 'image/png' });
  const page = await renderImage(asFile, userId, sessionId);
  if (!page.image) throw new Error("L'image n'a pas pu être préparée");
  return page.image;
}

/** Image de couverture d'un ticket à gratter. */
export const uploadCoverImage = uploadBoardImage;

/** Fichiers image (à insérer comme objets) et autres importables (PDF → pages). */
export const isImageFile = (f: File) => f.type.startsWith('image/');

async function uploadPageImage(userId: string, sessionId: string, pageId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${sessionId}/${pageId}.jpg`;
  const { error } = await supabase.storage.from(BOARD_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

async function pageFromCanvas(userId: string, sessionId: string, canvas: HTMLCanvasElement): Promise<BoardPage> {
  const id = uid();
  const blob = await canvasToJpeg(canvas);
  const path = await uploadPageImage(userId, sessionId, id, blob);
  const image: PageImage = { path, width: canvas.width, height: canvas.height };
  return { id, background: 'blank', strokes: [], objects: [], image };
}

async function renderPdfPages(file: File, userId: string, sessionId: string, onProgress: (p: ImportProgress) => void): Promise<BoardPage[]> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: BoardPage[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress({ done: i - 1, total: doc.numPages, label: `${file.name} · page ${i}/${doc.numPages}` });
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = MAX_RENDER_WIDTH / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdfjs-dist v5 : le type RenderParameters exige un cast (voir mémoire projet)
      await page.render({ canvasContext: ctx, viewport } as never).promise;
      pages.push(await pageFromCanvas(userId, sessionId, canvas));
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}

async function renderImage(file: File, userId: string, sessionId: string): Promise<BoardPage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Image illisible : ${file.name}`));
      el.src = url;
    });
    const ratio = Math.min(1, MAX_RENDER_WIDTH / img.width, MAX_RENDER_WIDTH / img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return pageFromCanvas(userId, sessionId, canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isImportableFile(file: File): boolean {
  return file.type === 'application/pdf' || file.type.startsWith('image/') || /\.pdf$/i.test(file.name);
}

/** Transforme des fichiers en pages de tableau (images déjà envoyées au serveur). */
export async function importFilesToPages(
  files: File[],
  userId: string,
  sessionId: string,
  onProgress: (p: ImportProgress) => void
): Promise<BoardPage[]> {
  const pages: BoardPage[] = [];
  for (const file of files) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      pages.push(...(await renderPdfPages(file, userId, sessionId, onProgress)));
    } else if (file.type.startsWith('image/')) {
      onProgress({ done: 0, total: 1, label: file.name });
      pages.push(await renderImage(file, userId, sessionId));
    }
  }
  return pages;
}
