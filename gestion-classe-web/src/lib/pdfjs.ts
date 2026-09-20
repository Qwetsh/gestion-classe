/**
 * Chargement paresseux et partagé de pdfjs-dist (une seule instance, worker configuré une fois).
 * Utilisé par l'import de pages du tableau, les outils PDF et le lecteur de « Mes clouds ».
 */
let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;

export function getPdfjs() {
  if (!pdfjsReady) {
    pdfjsReady = import('pdfjs-dist').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      return lib;
    });
  }
  return pdfjsReady;
}
