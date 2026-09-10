/**
 * Objets « médias » du tableau blanc : tableau, vidéo, site web, son, lien, équation, widgets
 * (minuteur, dé, roue, niveau sonore, calculatrice).
 *
 * Ces objets vivent dans le DOM (iframe, lecteur audio, contenteditable…) ; sur canvas
 * (vignettes, export PDF) on dessine une représentation fidèle mais statique : le tableau
 * avec ses cellules, une vignette sombre pour une vidéo, une puce pour un lien, etc.
 */
import { supabase } from './supabase';
import type { BoardObjectBase } from './boardObjects';
import { BOARD_BUCKET, getLoadedImage } from './boardRender';
import { LINE_HEIGHT, fontCss, renderTextBox, textBoxHeight, type TextBox } from './boardText';

// ---- Types ----

export interface TableObject extends BoardObjectBase {
  type: 'table';
  rows: number;
  cols: number;
  /** HTML restreint par cellule (voir boardText), `cells[r][c]`. */
  cells: string[][];
  /** Première ligne en en-tête (fond teinté, gras). */
  header: boolean;
  size: number;
  font: string;
  color: string;
  /** Largeur des colonnes, en fraction de la largeur (somme = 1). */
  colWidths?: number[];
}

export interface VideoObject extends BoardObjectBase {
  type: 'video';
  h: number;
  url: string;
  provider: 'youtube' | 'embed';
  title?: string;
}

export interface WebObject extends BoardObjectBase {
  type: 'web';
  h: number;
  url: string;
  /** Vrai : la souris passe au site ; faux : on annote par-dessus. */
  interactive?: boolean;
  title?: string;
}

export interface AudioObject extends BoardObjectBase {
  type: 'audio';
  h: number;
  path: string;
  label?: string;
}

export interface LinkObject extends BoardObjectBase {
  type: 'link';
  url: string;
  label: string;
  size: number;
}

export type WidgetKind = 'timer' | 'dice' | 'wheel' | 'noise' | 'calc';

export interface WidgetObject extends BoardObjectBase {
  type: 'widget';
  h: number;
  widget: WidgetKind;
  /** Réglages persistants du widget (durée, faces, entrées de la roue, niveau…). */
  config: { seconds?: number; faces?: number; entries?: string[]; level?: number; label?: string };
}

export interface EquationObject extends BoardObjectBase {
  type: 'equation';
  h: number;
  latex: string;
  size: number;
  color: string;
  /** Rendu rasterisé dans le bucket (pour les vignettes et l'export). */
  imagePath?: string;
}

export type MediaObject = TableObject | VideoObject | WebObject | AudioObject | LinkObject | WidgetObject | EquationObject;

export const WIDGET_LABELS: Record<WidgetKind, string> = {
  timer: 'Minuteur',
  dice: 'Dé',
  wheel: 'Roue',
  noise: 'Niveau sonore',
  calc: 'Calculatrice',
};

export const NOISE_LEVELS = [
  { label: 'Silence', color: '#DC2626', icon: '🤫' },
  { label: 'Chuchoter', color: '#F59E0B', icon: '🤏' },
  { label: 'Parler doucement', color: '#10B981', icon: '💬' },
  { label: 'Travail de groupe', color: '#3B82F6', icon: '👥' },
];

// ---- URL ----

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/;

export function youtubeId(url: string): string | null {
  const m = YT_RE.exec(url);
  return m ? m[1] : null;
}

/** Ajoute https:// si absent ; null si ce n'est pas une URL. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^[a-z]+:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const looksLikeUrl = (text: string) => normalizeUrl(text) !== null && !/\s/.test(text.trim());

/** URL à mettre dans l'iframe d'une vidéo. */
export function videoEmbedUrl(o: VideoObject): string {
  if (o.provider === 'youtube') {
    const id = youtubeId(o.url);
    if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
  }
  return o.url;
}

/** Objet vidéo ou lien selon l'URL collée. */
export function objectForUrl(url: string): { type: 'video'; provider: 'youtube' | 'embed' } | { type: 'link' } {
  if (youtubeId(url)) return { type: 'video', provider: 'youtube' };
  if (/vimeo\.com\/\d+|peertube|dailymotion\.com\/video/i.test(url)) return { type: 'video', provider: 'embed' };
  return { type: 'link' };
}

// ---- Fichiers du bucket (son, équations) ----

const urlCache = new Map<string, Promise<string>>();

/** URL signée d'un fichier du bucket (6 h, mise en cache). */
export function signedUrl(path: string): Promise<string> {
  const cached = urlCache.get(path);
  if (cached) return cached;
  const p = (async () => {
    const { data, error } = await supabase.storage.from(BOARD_BUCKET).createSignedUrl(path, 60 * 60 * 6);
    if (error || !data?.signedUrl) throw error ?? new Error('URL signée indisponible');
    return data.signedUrl;
  })();
  p.catch(() => urlCache.delete(path));
  urlCache.set(path, p);
  return p;
}

export async function uploadBoardFile(blob: Blob, userId: string, sessionId: string, ext: string, contentType: string): Promise<string> {
  const path = `${userId}/${sessionId}/${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from(BOARD_BUCKET).upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

// ---- Tableaux ----

export const TABLE_CELL_PAD = 0.35; // en em

export function emptyTable(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => '<div><br></div>'));
}

export function tableColWidths(o: TableObject): number[] {
  const w = o.colWidths && o.colWidths.length === o.cols ? o.colWidths : Array.from({ length: o.cols }, () => 1 / o.cols);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((v) => v / sum);
}

function cellBox(o: TableObject, r: number, c: number, x: number, y: number, w: number): TextBox {
  return { id: `${o.id}-${r}-${c}`, x, y, w, size: o.size, font: o.font, color: o.color, html: o.cells[r]?.[c] ?? '' };
}

/** Hauteur de chaque ligne, en unités (la plus haute cellule, plus la marge). */
export function tableRowHeights(o: TableObject): number[] {
  const widths = tableColWidths(o);
  const pad = o.size * TABLE_CELL_PAD;
  return Array.from({ length: o.rows }, (_, r) => {
    let h = o.size * LINE_HEIGHT;
    for (let c = 0; c < o.cols; c++) {
      const cw = widths[c] * o.w - pad * 2;
      h = Math.max(h, textBoxHeight(cellBox(o, r, c, 0, 0, Math.max(20, cw))));
    }
    return h + pad * 2;
  });
}

export const tableHeight = (o: TableObject) => tableRowHeights(o).reduce((a, b) => a + b, 0);

export function insertTableRow(o: TableObject, at: number): TableObject {
  const cells = o.cells.map((row) => [...row]);
  cells.splice(at, 0, Array.from({ length: o.cols }, () => '<div><br></div>'));
  return { ...o, rows: o.rows + 1, cells };
}

export function removeTableRow(o: TableObject, at: number): TableObject {
  if (o.rows <= 1) return o;
  const cells = o.cells.filter((_, i) => i !== at);
  return { ...o, rows: o.rows - 1, cells };
}

export function insertTableCol(o: TableObject, at: number): TableObject {
  const cells = o.cells.map((row) => { const next = [...row]; next.splice(at, 0, '<div><br></div>'); return next; });
  const widths = tableColWidths(o);
  const nw = [...widths];
  nw.splice(at, 0, 1 / o.cols);
  return { ...o, cols: o.cols + 1, cells, colWidths: nw };
}

export function removeTableCol(o: TableObject, at: number): TableObject {
  if (o.cols <= 1) return o;
  const cells = o.cells.map((row) => row.filter((_, i) => i !== at));
  const widths = tableColWidths(o).filter((_, i) => i !== at);
  return { ...o, cols: o.cols - 1, cells, colWidths: widths };
}

/** Tableau depuis du texte tabulé (Excel, LibreOffice : colonnes = tabulations, lignes = retours). */
export function tableFromTsv(text: string): { rows: number; cols: number; cells: string[][] } | null {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2 || !lines.some((l) => l.includes('\t'))) return null;
  const rows = lines.map((l) => l.split('\t'));
  const cols = Math.max(...rows.map((r) => r.length));
  const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
  const cells = rows.map((r) => Array.from({ length: cols }, (_, i) => `<div>${esc(r[i] ?? '') || '<br>'}</div>`));
  return { rows: rows.length, cols, cells };
}

// ---- Emprise ----

export function mediaRect(o: MediaObject): { x: number; y: number; w: number; h: number } {
  switch (o.type) {
    case 'table':
      return { x: o.x, y: o.y, w: o.w, h: tableHeight(o) };
    case 'link':
      return { x: o.x, y: o.y, w: o.w, h: o.size * 1.9 };
    default:
      return { x: o.x, y: o.y, w: o.w, h: o.h };
  }
}

// ---- Rendu canvas ----

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function labelBox(ctx: CanvasRenderingContext2D, o: { x: number; y: number; w: number }, h: number, scale: number, fill: string, text: string, sub?: string, textColor = '#F9FAFB') {
  roundRect(ctx, o.x * scale, o.y * scale, o.w * scale, h * scale, 8 * scale);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fs = Math.max(12, Math.min(h * 0.28, 30)) * scale;
  ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
  ctx.fillText(text, (o.x + o.w / 2) * scale, (o.y + h / 2 - (sub ? h * 0.08 : 0)) * scale, o.w * scale * 0.9);
  if (sub) {
    ctx.font = `400 ${fs * 0.55}px Inter, system-ui, sans-serif`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(sub, (o.x + o.w / 2) * scale, (o.y + h / 2 + h * 0.16) * scale, o.w * scale * 0.9);
    ctx.globalAlpha = 1;
  }
}

export function renderMediaObject(ctx: CanvasRenderingContext2D, o: MediaObject, scale: number) {
  ctx.save();
  switch (o.type) {
    case 'table': {
      const widths = tableColWidths(o);
      const heights = tableRowHeights(o);
      const pad = o.size * TABLE_CELL_PAD;
      let y = o.y;
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.strokeStyle = '#374151';
      for (let r = 0; r < o.rows; r++) {
        let x = o.x;
        for (let c = 0; c < o.cols; c++) {
          const cw = widths[c] * o.w;
          if (o.header && r === 0) {
            ctx.fillStyle = '#E5E7EB';
            ctx.fillRect(x * scale, y * scale, cw * scale, heights[r] * scale);
          }
          ctx.strokeRect(x * scale, y * scale, cw * scale, heights[r] * scale);
          const box = cellBox(o, r, c, x + pad, y + pad, Math.max(20, cw - pad * 2));
          if (o.header && r === 0) box.html = `<b>${box.html}</b>`;
          renderTextBox(ctx, box, scale);
          x += cw;
        }
        y += heights[r];
      }
      break;
    }
    case 'video':
      labelBox(ctx, o, o.h, scale, '#111827', '▶  Vidéo', o.title ?? o.url);
      break;
    case 'web':
      labelBox(ctx, o, o.h, scale, '#F3F4F6', o.title ?? 'Site web', o.url, '#1F2937');
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      roundRect(ctx, o.x * scale, o.y * scale, o.w * scale, o.h * scale, 8 * scale);
      ctx.stroke();
      break;
    case 'audio':
      labelBox(ctx, o, o.h, scale, '#1F2937', `🔊  ${o.label ?? 'Son'}`);
      break;
    case 'link': {
      const h = o.size * 1.9;
      roundRect(ctx, o.x * scale, o.y * scale, o.w * scale, h * scale, (h / 2) * scale);
      ctx.fillStyle = '#E0E7FF';
      ctx.fill();
      ctx.fillStyle = '#3730A3';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${o.size * scale}px ${fontCss('sans')}`;
      ctx.fillText(`🔗 ${o.label}`, (o.x + o.size * 0.6) * scale, (o.y + h / 2) * scale, (o.w - o.size * 1.2) * scale);
      break;
    }
    case 'widget': {
      const sub = o.widget === 'timer' && o.config.seconds ? `${Math.floor(o.config.seconds / 60)} min ${o.config.seconds % 60 ? `${o.config.seconds % 60} s` : ''}`.trim()
        : o.widget === 'noise' ? NOISE_LEVELS[o.config.level ?? 0]?.label
        : o.widget === 'dice' ? `${o.config.faces ?? 6} faces`
        : o.widget === 'wheel' ? `${(o.config.entries ?? []).length} entrées` : undefined;
      labelBox(ctx, o, o.h, scale, o.widget === 'noise' ? NOISE_LEVELS[o.config.level ?? 0]?.color ?? '#1F2937' : '#312E81', o.config.label ?? WIDGET_LABELS[o.widget], sub);
      break;
    }
    case 'equation': {
      const img = o.imagePath ? getLoadedImage(o.imagePath) : null;
      if (img) {
        ctx.drawImage(img, o.x * scale, o.y * scale, o.w * scale, o.h * scale);
      } else {
        ctx.fillStyle = o.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `italic ${o.size * scale}px "Times New Roman", serif`;
        ctx.fillText(o.latex, o.x * scale, (o.y + o.h / 2) * scale, o.w * scale);
      }
      break;
    }
  }
  ctx.restore();
}
