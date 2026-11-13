/**
 * Importer un fichier dans un cours (AUDIT_editeur_texte.md, lot T10a).
 *
 * - Word (.docx) : `mammoth` en tire un HTML structuré (titres, listes, tableaux, images, gras,
 *   italique, souligné, barré), que l'éditeur colle ensuite comme un collage « Adapter au cours »
 *   (lot T5) : même nettoyage, images rapatriées dans le stockage du cours. Ce que mammoth ne
 *   reprend pas : couleurs, alignements, colonnes, zones de texte, en-têtes, équations.
 * - PDF : chaque page devient une image du cours (pdfjs).
 *
 * Un cours créé « à partir d'un fichier Word » passe le fichier à l'éditeur par une petite file
 * d'attente en mémoire : l'import se fait à l'ouverture, avec l'éditeur et ses outils.
 */
import { getPdfjs } from '../pdfjs';

export const isDocxFile = (f: File) =>
  /\.docx$/i.test(f.name) || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** Ancien format Word (.doc) : mammoth ne sait pas le lire. */
export const isOldDocFile = (f: File) => /\.doc$/i.test(f.name) || f.type === 'application/msword';
export const isPdfFile = (f: File) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';

/** Correspondances de styles Word → titres du cours (noms anglais et français). */
const STYLE_MAP = [
  "p[style-name='Title'] => h1.ce-doc-title:fresh",
  "p[style-name='Titre'] => h1.ce-doc-title:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Sous-titre'] => h2:fresh",
  'u => u',
  'strike => s',
];

export async function docxToCourseHtml(file: Blob): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: STYLE_MAP });
  return shiftHeadings(result.value);
}

/**
 * Le Titre 1 du cours est le titre du chapitre. Un document Word qui a un paragraphe « Titre »
 * l'utilise pour cela : ses « Titre 1 » sont alors des parties (Titre 2 du cours), ses « Titre 2 »
 * des sous-parties. Sans paragraphe « Titre », les niveaux de Word sont gardés.
 */
export function shiftHeadings(html: string): string {
  if (!html.includes('ce-doc-title')) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    if (h.classList.contains('ce-doc-title')) { h.removeAttribute('class'); return; }
    const level = Math.min(3, Number(h.tagName.slice(1)) + 1);
    const next = doc.createElement(`h${level}`);
    next.innerHTML = h.innerHTML;
    h.replaceWith(next);
  });
  return doc.body.innerHTML;
}

/** Au-delà, on demande confirmation : chaque page est une image à envoyer. */
export const PDF_PAGES_WARN = 20;
/** Plafond : un cours n'est pas un classeur de 200 pages. */
export const PDF_PAGES_MAX = 60;

/** Nombre de pages d'un PDF (avant de lancer l'import). */
export async function pdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  try { return doc.numPages; } finally { await doc.destroy(); }
}

/** Pages d'un PDF en images JPEG (1 600 px de large, fond blanc), dans l'ordre. */
export async function pdfToImages(file: File, onPage?: (done: number, total: number) => void, maxPages = PDF_PAGES_MAX): Promise<Blob[]> {
  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: Blob[] = [];
  try {
    const total = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= total; i++) {
      onPage?.(i - 1, total);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1600 / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // pdfjs-dist v5 : le type RenderParameters exige un cast (voir mémoire projet)
      await page.render({ canvasContext: ctx, viewport } as never).promise;
      out.push(await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Page illisible'))), 'image/jpeg', 0.86)));
    }
    onPage?.(total, total);
  } finally {
    await doc.destroy();
  }
  return out;
}

// ---- File d'attente : « Nouveau cours à partir d'un fichier Word » ----

const pending = new Map<string, File>();

export function queueCourseImport(boardId: string, file: File): void {
  pending.set(boardId, file);
}

/** Le fichier à importer à l'ouverture de ce cours (une seule fois). */
export function takeCourseImport(boardId: string): File | null {
  const f = pending.get(boardId) ?? null;
  pending.delete(boardId);
  return f;
}
