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

/**
 * HTML → PDF A4 portrait (marges 15 mm), texte découpé proprement entre les pages.
 *
 * L'élément remis à `doc.html()` ne doit porter **aucun décalage de position** : jsPDF le
 * clone dans son propre conteneur puis lui impose `position: relative`. Un `left: -10000px`
 * destiné à le cacher hors écran survit au clonage et repousse alors tout le contenu à
 * 10 000 px hors de la zone capturée — le PDF pèse son poids normal et toutes ses pages
 * sont blanches, sans la moindre erreur. Le décalage est donc porté par le PARENT, et on
 * passe l'enfant. (Mesuré : 0 % d'encre et 0 caractère avant, 1,2 % et 278 après.)
 */
export async function htmlToPdf(bodyHtml: string, name: string): Promise<File> {
  const holder = document.createElement('div');
  // Hors écran mais réellement mis en page (html2canvas a besoin d'une géométrie).
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  // 794 px ≈ 210 mm à 96 dpi : le contenu, sans position ni décalage.
  const content = document.createElement('div');
  content.className = 'gc-doc';
  content.style.cssText = 'width:794px;background:#fff;padding:0;';
  content.innerHTML = `<style>${PRINT_CSS}</style>${bodyHtml}`;
  holder.appendChild(content);
  document.body.appendChild(holder);
  try {
    // Une image encore en cours de décodage serait rendue vide dans le PDF.
    await Promise.all(
      [...content.querySelectorAll('img')].map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
      ),
    );
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    await doc.html(content, { margin: [15, 15, 15, 15], autoPaging: 'text', width: 180, windowWidth: 794, html2canvas: { useCORS: true, logging: false } });
    const bytes = doc.output('arraybuffer');
    return new File([bytes], `${name.replace(/\.[^.]+$/, '')}.pdf`, { type: 'application/pdf' });
  } finally {
    holder.remove();
  }
}

/** Pixels CSS (96 dpi) → millimètres, l'unité des pages jsPDF. */
const pxToMm = (px: number) => (px * 25.4) / 96;

/** Attend que toutes les images du conteneur soient décodées : sinon elles sortent vides. */
async function waitForImages(root: HTMLElement): Promise<void> {
  await Promise.all(
    [...root.querySelectorAll('img')].map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
    ),
  );
}

/**
 * Word (.docx) → PDF **par capture d'image**, page par page.
 *
 * `docx-preview` lit la mise en page du document (format et marges de page, colonnes,
 * styles, images positionnées, en-têtes) et la reconstitue dans le DOM, une `<section>`
 * par page Word. On photographie chaque section : le PDF est une image, donc sans texte
 * sélectionnable, mais il ressemble au document.
 *
 * C'est le contraire de la voie `mammoth` ci-dessous, qui n'extrait que la structure
 * (titres, paragraphes, tableaux) et redessine une page à elle : suffisant pour lire un
 * texte, inexploitable pour une fiche d'activité dont la mise en page porte le sens.
 */
async function docxToPdfRendered(file: File, onStep?: (label: string) => void): Promise<File> {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;background:#fff;';
  document.body.appendChild(holder);
  try {
    onStep?.('Mise en page du document Word…');
    const { renderAsync } = await import('docx-preview');
    await renderAsync(await file.arrayBuffer(), holder, undefined, {
      inWrapper: true,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      // Les images doivent être des data: URI pour survivre à la capture.
      useBase64URL: true,
      ignoreWidth: false,
      ignoreHeight: false,
    });
    await waitForImages(holder);

    const sections = [...holder.querySelectorAll<HTMLElement>('section')];
    if (sections.length === 0) throw new Error('Aucune page rendue');

    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    let doc: import('jspdf').jsPDF | null = null;

    for (const [i, section] of sections.entries()) {
      onStep?.(`Capture de la page ${i + 1}/${sections.length}…`);
      const canvas = await html2canvas(section, {
        // 2× : lisible à l'écran comme à l'impression, sans faire exploser le poids.
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const wMm = pxToMm(section.offsetWidth);
      const hMm = pxToMm(section.offsetHeight);
      const orientation = wMm > hMm ? 'landscape' : 'portrait';
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [wMm, hMm], orientation });
      else doc.addPage([wMm, hMm], orientation);
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, wMm, hMm);
    }

    const bytes = doc!.output('arraybuffer');
    return new File([bytes], `${file.name.replace(/\.[^.]+$/, '')}.pdf`, { type: 'application/pdf' });
  } finally {
    holder.remove();
  }
}

/**
 * Word (.docx) → PDF, entièrement dans le navigateur.
 *
 * On tente d'abord la capture fidèle ; si `docx-preview` cale sur un document, on retombe
 * sur l'extraction de structure, qui donne un résultat approximatif mais jamais vide.
 */
export async function docxToPdf(file: File, onStep?: (label: string) => void): Promise<File> {
  onStep?.('Lecture du document Word…');
  try {
    return await docxToPdfRendered(file, onStep);
  } catch (e) {
    console.warn('[docConvert] rendu fidèle impossible, repli sur l’extraction de structure', e);
    const html = await docxToHtml(file);
    onStep?.('Mise en page du PDF…');
    return htmlToPdf(html, file.name);
  }
}
