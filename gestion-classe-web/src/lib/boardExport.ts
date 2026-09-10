/**
 * Export PDF des pages du tableau blanc (une page A4 paysage par page du tableau).
 * Partagé par l'éditeur (pendant la séance) et la relecture (détail de séance).
 */
import jsPDF from 'jspdf';
import { BOARD_RATIO, renderPageToCanvas, type BoardPage } from './boardRender';
import type { RenderRevealOptions } from './boardReveal';

export interface BoardExportOptions extends RenderRevealOptions {
  /** Indices des pages à exporter (toutes si absent). */
  pageIndexes?: number[];
  /** Sans l'encre (pour une version « à compléter »). */
  hideInk?: boolean;
  /** Deux pages du tableau par feuille. */
  twoPerSheet?: boolean;
}

const FULL_W = 1920;
const FULL_H = Math.round(FULL_W / BOARD_RATIO);

export const pdfFileName = (name: string, suffix: string) => `${name.replace(/[^\w\dÀ-ÿ -]+/g, '')}-${suffix}.pdf`;

export async function exportBoardPdf(pages: BoardPage[], name: string, opts: BoardExportOptions): Promise<void> {
  const indexes = (opts.pageIndexes ?? pages.map((_, i) => i)).filter((i) => pages[i]);
  if (indexes.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageW = 297, pageH = 210, margin = 8;
  const perSheet = opts.twoPerSheet ? 2 : 1;
  const slotH = (pageH - margin * (perSheet + 1)) / perSheet;
  let w = pageW - margin * 2;
  let h = (w * FULL_H) / FULL_W;
  if (h > slotH) { h = slotH; w = (h * FULL_W) / FULL_H; }
  const x = (pageW - w) / 2;

  for (let k = 0; k < indexes.length; k++) {
    const slot = k % perSheet;
    if (k > 0 && slot === 0) doc.addPage();
    const y = perSheet === 1 ? (pageH - h) / 2 : margin + slot * (slotH + margin) + (slotH - h) / 2;
    const canvas = await renderPageToCanvas(pages[indexes[k]], FULL_W, { mode: opts.mode, hideInk: opts.hideInk });
    doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', x, y, w, h);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`${name} — page ${indexes[k] + 1}${opts.mode === 'covered' ? ' — à compléter' : ''}`, x, y + h + 4);
  }
  doc.save(pdfFileName(name, opts.mode === 'covered' ? 'eleve' : 'tableau'));
}
