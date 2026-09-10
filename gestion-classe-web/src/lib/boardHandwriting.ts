/**
 * Écriture manuscrite → texte.
 *
 * 1. API Web « Handwriting Recognition » (Chrome, modèle local, hors ligne) quand elle existe :
 *    on lui donne les traits (points horodatés), elle rend du texte.
 * 2. Sinon Tesseract.js (OCR) sur une image des traits : plus lent, moins bon sur l'écriture
 *    cursive, mais partout. Les fichiers de langue sont téléchargés à la première utilisation.
 */
import type { Stroke } from './boardRender';

interface HandwritingPoint { x: number; y: number; t: number }
interface HandwritingStrokeLike { addPoint(p: HandwritingPoint): void }
interface HandwritingDrawing {
  addStroke(s: HandwritingStrokeLike): void;
  getPrediction(): Promise<{ text: string }[]>;
}
interface HandwritingRecognizer {
  startDrawing(hints?: { recognitionType?: string; inputType?: string; textContext?: string; alternatives?: number }): HandwritingDrawing;
  finish(): void;
}
interface NavigatorWithHandwriting extends Navigator {
  createHandwritingRecognizer?: (constraint: { languages: string[] }) => Promise<HandwritingRecognizer>;
  queryHandwritingRecognizer?: (constraint: { languages: string[] }) => Promise<unknown | null>;
}
declare const HandwritingStroke: { new (): HandwritingStrokeLike } | undefined;

export type HandwritingEngine = 'native' | 'tesseract' | 'none';

let nativeChecked: Promise<boolean> | null = null;

/** L'API native est-elle disponible pour le français ? */
export function hasNativeHandwriting(): Promise<boolean> {
  if (nativeChecked) return nativeChecked;
  nativeChecked = (async () => {
    const nav = navigator as NavigatorWithHandwriting;
    if (!nav.createHandwritingRecognizer || typeof HandwritingStroke === 'undefined') return false;
    try {
      if (nav.queryHandwritingRecognizer) return (await nav.queryHandwritingRecognizer({ languages: ['fr'] })) !== null;
      return true;
    } catch {
      return false;
    }
  })();
  return nativeChecked;
}

async function recognizeNative(strokes: Stroke[]): Promise<string> {
  const nav = navigator as NavigatorWithHandwriting;
  if (!nav.createHandwritingRecognizer || typeof HandwritingStroke === 'undefined') throw new Error('API indisponible');
  const rec = await nav.createHandwritingRecognizer({ languages: ['fr'] });
  try {
    const drawing = rec.startDrawing({ recognitionType: 'text', inputType: 'stylus', alternatives: 1 });
    let t = 0;
    for (const s of strokes) {
      const hs = new HandwritingStroke();
      for (const p of s.points) hs.addPoint({ x: p.x, y: p.y, t: (t += 8) });
      drawing.addStroke(hs);
      t += 120;
    }
    const preds = await drawing.getPrediction();
    return preds[0]?.text ?? '';
  } finally {
    rec.finish();
  }
}

/** Image en noir sur blanc des traits, pour l'OCR (résolution ~ 3 px par unité). */
export function strokesToImage(strokes: Stroke[], pxPerUnit = 3, pad = 12): HTMLCanvasElement {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) for (const p of s.points) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const canvas = document.createElement('canvas');
  if (!Number.isFinite(minX)) { canvas.width = canvas.height = 1; return canvas; }
  canvas.width = Math.ceil((maxX - minX + pad * 2) * pxPerUnit);
  canvas.height = Math.ceil((maxY - minY + pad * 2) * pxPerUnit);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#000000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.lineWidth = Math.max(2, s.size * 0.8 * pxPerUnit);
    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = (p.x - minX + pad) * pxPerUnit, y = (p.y - minY + pad) * pxPerUnit;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    if (s.points.length === 1) { const p = s.points[0]; ctx.arc((p.x - minX + pad) * pxPerUnit, (p.y - minY + pad) * pxPerUnit, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.stroke();
  }
  return canvas;
}

async function recognizeTesseract(canvas: HTMLCanvasElement, onProgress?: (label: string) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  onProgress?.('Chargement du moteur de reconnaissance…');
  const worker = await createWorker('fra', 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status && typeof m.progress === 'number') onProgress?.(`${m.status} ${Math.round(m.progress * 100)} %`);
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export interface HandwritingResult { text: string; engine: HandwritingEngine }

/** Reconnaît le texte écrit dans ces traits. Texte vide si rien n'est lisible. */
export async function recognizeHandwriting(strokes: Stroke[], onProgress?: (label: string) => void): Promise<HandwritingResult> {
  if (strokes.length === 0) return { text: '', engine: 'none' };
  if (await hasNativeHandwriting()) {
    try {
      const text = await recognizeNative(strokes);
      if (text.trim()) return { text: text.trim(), engine: 'native' };
    } catch (err) {
      console.warn('[handwriting] API native :', err);
    }
  }
  const text = await recognizeTesseract(strokesToImage(strokes), onProgress);
  return { text, engine: 'tesseract' };
}
