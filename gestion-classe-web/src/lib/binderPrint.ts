/**
 * Classeur virtuel : imprimer une fiche collée ou un bilan (demande de Thomas, 23/11/2026 : un
 * élève absent retrouve sa fiche et l'imprime ; le professeur aussi).
 *
 * Rien n'est relu ni recalculé : on imprime ce qui est à l'écran. Une fiche est déjà mise en page
 * en feuilles A4 (le rendu de l'éditeur de cours) ; on en prend une copie figée par page, décalée
 * pour montrer cette page-là, comme le fait la fiche collée quand on la retourne. Un bilan est
 * imprimé tel qu'il est écrit dans le classeur : en rouge, ligne par ligne.
 *
 * Les pages sont posées dans un bloc à part, seul visible à l'impression (styles :
 * `classeur-eleves.css`, `.bd-print`), puis retirées.
 */
import type { InkLine } from './binderSummary';
import { PAGE_H, SHEET_GAP } from './course/coursePage';

/** Lignes d'un bilan par page imprimée (lignes de 8 mm sur une feuille A4, marges comprises). */
const BILAN_LINES = 30;

/**
 * Une page A4 par feuille de la fiche. `sheets` : le bloc des feuilles déjà mises en page
 * (`.ce-sheets`). Les volets de la fiche de mémorisation ne s'impriment pas : c'est la fiche telle
 * qu'elle est distribuée, avant découpage.
 */
export function sheetPrintPages(sheets: HTMLElement): HTMLElement[] {
  const count = Math.max(1, sheets.querySelectorAll(':scope > .ce-sheet').length);
  return Array.from({ length: count }, (_, i) => {
    const page = document.createElement('div');
    // `bd-glued` : les styles de l'écriture de l'élève sur la fiche valent aussi à l'impression
    page.className = 'bd-print__page bd-glued';
    const copy = sheets.cloneNode(true) as HTMLElement;
    for (const flap of copy.querySelectorAll('.bd-flap, .bd-flap__hole')) flap.remove();
    copy.style.transform = `translateY(${-i * (PAGE_H + SHEET_GAP)}px)`;
    copy.style.transformOrigin = '0 0';
    page.appendChild(copy);
    return page;
  });
}

/** Pages d'un bilan : son titre, puis ses lignes telles qu'elles sont écrites dans le classeur. */
export function bilanPrintPages(title: string, lines: InkLine[]): HTMLElement[] {
  const pages: HTMLElement[] = [];
  for (let from = 0; from < lines.length || from === 0; from += BILAN_LINES) {
    const page = document.createElement('div');
    page.className = 'bd-print__page bd-print__bilan';
    if (from === 0) {
      const heading = document.createElement('h1');
      heading.textContent = title;
      page.appendChild(heading);
    }
    for (const line of lines.slice(from, from + BILAN_LINES)) {
      const row = document.createElement('div');
      row.className = 'bd-print__line';
      for (const run of line) {
        const part = document.createElement(run.underline ? 'u' : 'span');
        part.textContent = run.text;
        row.appendChild(part);
      }
      page.appendChild(row);
    }
    pages.push(page);
  }
  return pages;
}

/**
 * Attend que la fiche ait fini de se mettre en page (après un passage de vierge à corrigée, ou
 * juste après son affichage) : même nombre de feuilles, même hauteur de texte et images chargées
 * pendant un demi-seconde. Au pire, on imprime au bout de `timeout`.
 */
export function whenSettled(root: HTMLElement, ready: () => boolean = () => true, timeout = 4000): Promise<void> {
  return new Promise((resolve) => {
    const started = Date.now();
    let last = '';
    let stable = 0;
    const tick = () => {
      const flow = root.querySelector<HTMLElement>('.ce-flow');
      const images = [...root.querySelectorAll('img')];
      const mark = `${root.querySelectorAll('.ce-sheet').length}|${flow?.scrollHeight ?? 0}|${images.filter((img) => img.complete).length}/${images.length}`;
      const settled = !!root.querySelector('.ce-doc') && ready() && images.every((img) => img.complete);
      stable = settled && mark === last ? stable + 1 : 0;
      last = mark;
      if (stable >= 6 || Date.now() - started > timeout) resolve();
      else window.setTimeout(tick, 80);
    };
    tick();
  });
}

/** Imprime ces pages, seules, sous ce titre (le nom proposé pour un PDF). */
export function printPages(pages: HTMLElement[], title: string): void {
  if (pages.length === 0) return;
  // Un bloc resté d'une impression dont la fin n'a pas été signalée
  document.querySelector('.bd-print')?.remove();
  const root = document.createElement('div');
  root.className = 'bd-print';
  root.append(...pages);
  document.body.appendChild(root);
  document.body.classList.add('bd-printing');
  const before = document.title;
  document.title = title;
  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    root.remove();
    document.body.classList.remove('bd-printing');
    document.title = before;
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
