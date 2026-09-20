/**
 * Conversion de documents dans le navigateur, sans serveur : Word (.docx) → HTML (mammoth,
 * images incluses en base64) → PDF A4 (jsPDF + html2canvas, pagination automatique).
 * Sert quand le cloud ne sait pas convertir lui-même (fichier Word déposé tel quel dans Google
 * Drive, fichier local dans l'outil Convertisseur). OneDrive et les Google Docs natifs sont
 * convertis côté serveur, avec une bien meilleure fidélité : voir `oneDrive.ts` / `googleDrive.ts`.
 */

/** Seul .docx est convertible ici (le vieux .doc binaire et .odt ne le sont pas). */
export const isDocx = (name: string) => /\.docx$/i.test(name);

/** Document Word → HTML sémantique (titres, listes, tableaux, images en data URI). */
export async function docxToHtml(file: Blob): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}

/** Feuille de style appliquée au document avant rasterisation (proche d'une page Word). */
const PRINT_CSS = `
  * { box-sizing: border-box; }
  body, .gc-doc { margin: 0; }
  .gc-doc { font: 11pt/1.45 "Calibri", "Carlito", "Segoe UI", Arial, sans-serif; color: #111; background: #fff; word-wrap: break-word; }
  .gc-doc h1 { font-size: 20pt; margin: 14pt 0 6pt; }
  .gc-doc h2 { font-size: 16pt; margin: 12pt 0 5pt; }
  .gc-doc h3 { font-size: 13pt; margin: 10pt 0 4pt; }
  .gc-doc p { margin: 0 0 6pt; }
  .gc-doc img { max-width: 100%; height: auto; }
  .gc-doc table { border-collapse: collapse; max-width: 100%; margin: 6pt 0; }
  .gc-doc td, .gc-doc th { border: 1px solid #888; padding: 2pt 5pt; vertical-align: top; }
  .gc-doc ul, .gc-doc ol { margin: 0 0 6pt; padding-left: 22pt; }
`;

/** Page HTML autonome (pour affichage dans une iframe). */
export function wrapDocumentHtml(bodyHtml: string, title: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>${PRINT_CSS} body { padding: 24px; max-width: 820px; margin: 0 auto; }</style></head><body><div class="gc-doc">${bodyHtml}</div></body></html>`;
}

/** HTML → PDF A4 portrait (marges 15 mm), texte découpé proprement entre les pages. */
export async function htmlToPdf(bodyHtml: string, name: string): Promise<File> {
  const holder = document.createElement('div');
  // Hors écran mais rendu (html2canvas a besoin d'une mise en page réelle) ; 794 px ≈ 210 mm à 96 dpi
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  holder.innerHTML = `<style>${PRINT_CSS}</style><div class="gc-doc" style="padding:0">${bodyHtml}</div>`;
  document.body.appendChild(holder);
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    await doc.html(holder, { margin: [15, 15, 15, 15], autoPaging: 'text', width: 180, windowWidth: 794, html2canvas: { useCORS: true, logging: false } });
    const bytes = doc.output('arraybuffer');
    return new File([bytes], `${name.replace(/\.[^.]+$/, '')}.pdf`, { type: 'application/pdf' });
  } finally {
    holder.remove();
  }
}

/** Word (.docx) → PDF, entièrement dans le navigateur. */
export async function docxToPdf(file: File, onStep?: (label: string) => void): Promise<File> {
  onStep?.('Lecture du document Word…');
  const html = await docxToHtml(file);
  onStep?.('Mise en page du PDF…');
  return htmlToPdf(html, file.name);
}
