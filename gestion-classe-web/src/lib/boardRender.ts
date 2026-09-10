/**
 * Modèle et rendu de l'encre du tableau blanc (mode « en classe »).
 * Partagé entre l'éditeur (Whiteboard) et la relecture (détail de séance, export PDF).
 *
 * Une page a un format fixe 16:9 en unités logiques : 1000 × 562,5.
 * L'éditeur affiche la page en « letterbox » dans l'écran, ce qui garantit que l'encre,
 * les fonds importés (PDF, image), les vignettes et l'export coïncident exactement.
 */
import { supabase } from './supabase';
import { renderTextBox, textBoxRect, type TextBox } from './boardText';
import { objectRect, type BoardObject } from './boardObjects';
import { renderShape } from './boardShapes';
import type { RenderRevealOptions } from './boardReveal';
import { renderMediaObject } from './boardMedia';
import { renderLibraryObject } from './boardLibrary';

export type Background = 'blank' | 'grid' | 'lines' | 'seyes' | 'graph' | 'axes' | 'dots';
export const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: 'blank', label: 'Blanc' },
  { id: 'grid', label: 'Quadrillage' },
  { id: 'lines', label: 'Lignes' },
  { id: 'seyes', label: 'Seyès (cahier)' },
  { id: 'graph', label: 'Papier millimétré' },
  { id: 'axes', label: 'Repère orthonormé' },
  { id: 'dots', label: 'Points' },
];

export interface Point { x: number; y: number; p: number }
export interface Stroke { id: string; tool: 'pen' | 'highlighter'; color: string; size: number; points: Point[] }
/** Image de fond (page de PDF ou photo) stockée dans le bucket privé board-assets. */
export interface PageImage { path: string; width: number; height: number }
export interface BoardPage {
  id: string;
  background: Background;
  strokes: Stroke[];
  image?: PageImage | null;
  /** Rideau de page : la page reste couverte tant qu'on ne la découvre pas. */
  curtain?: boolean;
  /** Objets de la page (texte, et bientôt formes, images…), dans l'ordre d'empilement. */
  objects: BoardObject[];
  /** Ancien champ (v1) : migré dans `objects` au chargement, jamais écrit. */
  texts?: TextBox[];
}

/**
 * Rendu canvas d'un objet, par type (partagé par l'export, les vignettes, la relecture).
 * `reveal` : version élève ('covered' : caches dessinés, trous masqués) ou corrigé ('revealed').
 */
export function renderObject(ctx: CanvasRenderingContext2D, o: BoardObject, scale: number, reveal: RenderRevealOptions = { mode: 'revealed' }) {
  ctx.save();
  if (o.opacity !== undefined) ctx.globalAlpha = o.opacity;
  const covered = reveal.mode === 'covered';
  switch (o.type) {
    case 'text':
      renderTextBox(ctx, o, scale, covered ? 'all' : undefined);
      break;
    case 'shape':
      renderShape(ctx, o, scale);
      break;
    case 'image': {
      const img = getLoadedImage(o.path);
      if (img) {
        ctx.save();
        if (o.rotation) {
          ctx.translate((o.x + o.w / 2) * scale, (o.y + o.h / 2) * scale);
          ctx.rotate((o.rotation * Math.PI) / 180);
          ctx.translate(-(o.x + o.w / 2) * scale, -(o.y + o.h / 2) * scale);
        }
        ctx.drawImage(img, o.x * scale, o.y * scale, o.w * scale, o.h * scale);
        ctx.restore();
      } else {
        // Image indisponible (hors ligne) : cadre gris
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(o.x * scale, o.y * scale, o.w * scale, o.h * scale);
      }
      break;
    }
    case 'library':
      renderLibraryObject(ctx, o, scale);
      break;
    default:
      renderMediaObject(ctx, o, scale);
  }
  if (covered && o.cover) renderCover(ctx, o, scale);
  ctx.restore();
}

/** Cache (rideau ou ticket) dessiné par-dessus l'objet : rectangle de couleur et étiquette. */
export function renderCover(ctx: CanvasRenderingContext2D, o: BoardObject, scale: number) {
  if (!o.cover) return;
  const r = objectBounds(o);
  ctx.save();
  ctx.fillStyle = o.cover.color;
  ctx.fillRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
  const label = o.cover.label ?? (o.cover.kind === 'scratch' ? 'Gratter' : '?');
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `600 ${Math.max(12, Math.min(r.h * 0.5, 28)) * scale}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, (r.x + r.w / 2) * scale, (r.y + r.h / 2) * scale);
  }
  ctx.restore();
}

/** Emprise dessinée d'un objet (sans marge de saisie). */
export function objectBounds(o: BoardObject): { x: number; y: number; w: number; h: number } {
  if (o.type === 'shape' || o.type === 'image' || o.type === 'library') return { x: o.x, y: o.y, w: Math.max(o.w, 1), h: Math.max(o.h, 1) };
  if (o.type === 'text') return textBoxRect(o);
  return objectRect(o);
}

export const BOARD_UNIT = 1000;
export const BOARD_RATIO = 16 / 9;
export const BOARD_PAGE_H = BOARD_UNIT / BOARD_RATIO; // 562.5
export const BOARD_BUCKET = 'board-assets';

export const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2 });

export function penWidth(stroke: Stroke, p: number): number {
  return stroke.size * (0.55 + 0.9 * p);
}

/** Rectangle (unités logiques) où l'image de fond est dessinée : « contain », centrée. */
export function imageRectUnits(img: PageImage): { x: number; y: number; w: number; h: number } {
  const ratio = img.width / img.height;
  let w = BOARD_UNIT;
  let h = w / ratio;
  if (h > BOARD_PAGE_H) {
    h = BOARD_PAGE_H;
    w = h * ratio;
  }
  return { x: (BOARD_UNIT - w) / 2, y: (BOARD_PAGE_H - h) / 2, w, h };
}

// ---- Chargement des images de fond (URL signées, cache mémoire) ----

const imageCache = new Map<string, Promise<HTMLImageElement>>();
/** Images déjà chargées, pour le rendu synchrone des objets. */
const loadedImages = new Map<string, HTMLImageElement>();

/** Image déjà en mémoire (après `loadPageImage`), sinon null. */
export function getLoadedImage(path: string): HTMLImageElement | null {
  return loadedImages.get(path) ?? null;
}

export function loadPageImage(path: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(path);
  if (cached) return cached;
  const promise = (async () => {
    const { data, error } = await supabase.storage.from(BOARD_BUCKET).createSignedUrl(path, 60 * 60 * 6);
    if (error || !data?.signedUrl) throw error ?? new Error('URL signée indisponible');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Image de fond introuvable : ${path}`));
      img.src = data.signedUrl;
    });
    loadedImages.set(path, img);
    return img;
  })();
  promise.catch(() => imageCache.delete(path));
  imageCache.set(path, promise);
  return promise;
}

// ---- Rendu ----

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  w: number,
  h: number,
  scale: number,
  image?: { el: HTMLImageElement; meta: PageImage } | null
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  if (bg === 'grid') {
    ctx.lineWidth = 1;
    const step = 25 * scale;
    for (let x = step; x < w; x += step) {
      ctx.strokeStyle = Math.round(x / step) % 4 === 0 ? '#CBD5E1' : '#E5E7EB';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.strokeStyle = Math.round(y / step) % 4 === 0 ? '#CBD5E1' : '#E5E7EB';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  } else if (bg === 'lines') {
    ctx.lineWidth = 1;
    const step = 40 * scale;
    ctx.strokeStyle = '#D1D5DB';
    for (let y = step; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  } else if (bg === 'seyes') {
    // Grands carreaux 8 mm avec 3 interlignes 2 mm, marge rouge : 1 mm = 4 unités ici
    const big = 32 * scale, small = big / 4;
    ctx.lineWidth = 1;
    for (let y = big; y < h; y += big) {
      for (let k = 1; k < 4; k++) { ctx.strokeStyle = '#DCE7F5'; ctx.beginPath(); ctx.moveTo(0, y - big + k * small); ctx.lineTo(w, y - big + k * small); ctx.stroke(); }
      ctx.strokeStyle = '#9DB7DC'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let x = big; x < w; x += big) { ctx.strokeStyle = '#9DB7DC'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.strokeStyle = '#E88A8A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(big * 3, 0); ctx.lineTo(big * 3, h); ctx.stroke();
  } else if (bg === 'graph') {
    const mm = 4 * scale;
    for (let x = mm; x < w; x += mm) { const n = Math.round(x / mm); ctx.strokeStyle = n % 10 === 0 ? '#8FB3D9' : n % 5 === 0 ? '#BBD3EA' : '#E1ECF6'; ctx.lineWidth = n % 10 === 0 ? 1.2 : 0.8; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = mm; y < h; y += mm) { const n = Math.round(y / mm); ctx.strokeStyle = n % 10 === 0 ? '#8FB3D9' : n % 5 === 0 ? '#BBD3EA' : '#E1ECF6'; ctx.lineWidth = n % 10 === 0 ? 1.2 : 0.8; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  } else if (bg === 'axes') {
    const step = 25 * scale;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#E5E7EB';
    for (let x = step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const ox = Math.round(w / 2 / step) * step, oy = Math.round(h / 2 / step) * step;
    ctx.strokeStyle = '#374151'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.moveTo(ox, 0); ctx.lineTo(ox, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - 10 * scale, oy - 6 * scale); ctx.lineTo(w, oy); ctx.lineTo(w - 10 * scale, oy + 6 * scale); ctx.moveTo(ox - 6 * scale, 10 * scale); ctx.lineTo(ox, 0); ctx.lineTo(ox + 6 * scale, 10 * scale); ctx.stroke();
    ctx.fillStyle = '#374151';
    for (let x = ox + step, i = 1; x < w - 12 * scale; x += step, i++) { ctx.beginPath(); ctx.moveTo(x, oy - 4 * scale); ctx.lineTo(x, oy + 4 * scale); ctx.stroke(); }
    for (let x = ox - step; x > 0; x -= step) { ctx.beginPath(); ctx.moveTo(x, oy - 4 * scale); ctx.lineTo(x, oy + 4 * scale); ctx.stroke(); }
    for (let y = oy + step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(ox - 4 * scale, y); ctx.lineTo(ox + 4 * scale, y); ctx.stroke(); }
    for (let y = oy - step; y > 12 * scale; y -= step) { ctx.beginPath(); ctx.moveTo(ox - 4 * scale, y); ctx.lineTo(ox + 4 * scale, y); ctx.stroke(); }
  } else if (bg === 'dots') {
    const step = 25 * scale;
    ctx.fillStyle = '#C7CDD8';
    for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) { ctx.beginPath(); ctx.arc(x, y, 1.4 * scale, 0, Math.PI * 2); ctx.fill(); }
  }
  if (image) {
    const r = imageRectUnits(image.meta);
    ctx.drawImage(image.el, r.x * scale, r.y * scale, r.w * scale, r.h * scale);
  }
}

/** Segment n du trait : de M(n-1) à M(n) en passant par p(n-1). n=1 : p0 → M1. */
export function drawPenSegment(ctx: CanvasRenderingContext2D, s: Stroke, n: number, scale: number) {
  const pts = s.points;
  const cur = pts[n];
  const prev = pts[n - 1];
  const m1 = mid(prev, cur);
  ctx.beginPath();
  if (n === 1) {
    ctx.moveTo(prev.x * scale, prev.y * scale);
    ctx.lineTo(m1.x * scale, m1.y * scale);
  } else {
    const m0 = mid(pts[n - 2], prev);
    ctx.moveTo(m0.x * scale, m0.y * scale);
    ctx.quadraticCurveTo(prev.x * scale, prev.y * scale, m1.x * scale, m1.y * scale);
  }
  ctx.lineWidth = penWidth(s, prev.p) * scale;
  ctx.stroke();
}

export function drawPenTail(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const pts = s.points;
  const n = pts.length;
  if (n < 2) return;
  const last = pts[n - 1];
  const m = mid(pts[n - 2], last);
  ctx.beginPath();
  ctx.moveTo(m.x * scale, m.y * scale);
  ctx.lineTo(last.x * scale, last.y * scale);
  ctx.lineWidth = penWidth(s, last.p) * scale;
  ctx.stroke();
}

export function setupStrokeStyle(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.globalAlpha = s.tool === 'highlighter' ? 0.32 : 1;
}

export function renderStroke(ctx: CanvasRenderingContext2D, s: Stroke, scale: number) {
  const pts = s.points;
  if (pts.length === 0) return;
  ctx.save();
  setupStrokeStyle(ctx, s);
  if (s.tool === 'highlighter') {
    ctx.lineWidth = s.size * scale;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
    for (let i = 1; i < pts.length - 1; i++) {
      const m = mid(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i].x * scale, pts[i].y * scale, m.x * scale, m.y * scale);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x * scale, last.y * scale);
    ctx.stroke();
  } else if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x * scale, pts[0].y * scale, (penWidth(s, pts[0].p) * scale) / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (let n = 1; n < pts.length; n++) drawPenSegment(ctx, s, n, scale);
    drawPenTail(ctx, s, scale);
  }
  ctx.restore();
}

/**
 * Rend une page complète (fond, image importée, traits) dans un canvas de la largeur donnée.
 * La hauteur découle du format 16:9. Charge l'image de fond si nécessaire.
 */
export async function renderPageToCanvas(page: BoardPage, width: number, reveal: RenderRevealOptions = { mode: 'revealed' }): Promise<HTMLCanvasElement> {
  const height = Math.round(width / BOARD_RATIO);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const scale = width / BOARD_UNIT;
  let image: { el: HTMLImageElement; meta: PageImage } | null = null;
  if (page.image) {
    try {
      image = { el: await loadPageImage(page.image.path), meta: page.image };
    } catch (err) {
      console.warn('[boardRender] image de fond indisponible :', err);
    }
  }
  // Les images des objets doivent être en mémoire avant le rendu (synchrone)
  await Promise.all(
    (page.objects ?? [])
      .map((o) => (o.type === 'image' ? o.path : o.type === 'equation' ? o.imagePath : null))
      .filter((p): p is string => !!p)
      .map((path) => loadPageImage(path).catch((err) => console.warn('[boardRender] image :', err)))
  );
  drawBackground(ctx, page.background, width, height, scale, image);
  if (!reveal.hideInk) for (const s of page.strokes) renderStroke(ctx, s, scale);
  // Les objets passent au-dessus de l'encre, comme dans l'éditeur (calque DOM au premier plan)
  for (const o of page.objects ?? []) renderObject(ctx, o, scale, reveal);
  return canvas;
}

const ERASE_RESAMPLE_STEP = 2.5;

/**
 * Gomme « vraie » : retire la portion du trait située dans le disque (x, y, radius)
 * et renvoie les morceaux restants (nouveaux traits), ou null si le trait n'est pas touché.
 * Le trait est d'abord rééchantillonné finement pour que la découpe suive le bord du disque,
 * même sur les traits rapides aux points espacés.
 */
export function eraseStrokeAt(s: Stroke, x: number, y: number, radius: number, newId: () => string): Stroke[] | null {
  const pts = s.points;
  if (pts.length === 0) return null;
  // Rayon effectif : on tient compte de l'épaisseur du trait pour que le rendu visuel corresponde
  const r = radius + s.size * 0.5;
  const r2 = r * r;

  // Test rapide : boîte englobante
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  if (x < minX - r || x > maxX + r || y < minY - r || y > maxY + r) return null;

  const inside = (p: Point) => { const dx = p.x - x, dy = p.y - y; return dx * dx + dy * dy <= r2; };

  // Rééchantillonnage
  const dense: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / ERASE_RESAMPLE_STEP));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      dense.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t });
    }
  }

  if (!dense.some(inside)) return null;

  // Découpe en morceaux hors du disque
  const pieces: Stroke[] = [];
  let current: Point[] = [];
  const flush = () => {
    if (current.length >= 2) pieces.push({ ...s, id: newId(), points: current });
    current = [];
  };
  for (const p of dense) {
    if (inside(p)) flush();
    else current.push(p);
  }
  flush();
  return pieces;
}

export function strokeHits(s: Stroke, x: number, y: number, radius: number): boolean {
  const r2 = radius * radius;
  const pts = s.points;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].x - x;
    const dy = pts[i].y - y;
    if (dx * dx + dy * dy <= r2) return true;
    if (i > 0) {
      // Distance au segment pour ne pas rater les traits rapides (points espacés)
      const ax = pts[i - 1].x, ay = pts[i - 1].y, bx = pts[i].x, by = pts[i].y;
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy;
      if (len2 > 0) {
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
        const px = ax + t * vx - x, py = ay + t * vy - y;
        if (px * px + py * py <= r2) return true;
      }
    }
  }
  return false;
}
