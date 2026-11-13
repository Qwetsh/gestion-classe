/**
 * Impressions adaptées (AUDIT_editeur_texte.md, lot T13) : version « dys » (texte plus grand et
 * plus aéré), deux exemplaires par feuille (demi-feuilles A5 à coller dans le cahier), couleur,
 * noir et blanc ou économie d'encre.
 *
 * Tout passe par des classes sur <body> posées juste avant `window.print()` et retirées après ;
 * la version adaptée change la mise en page : la pagination est recalculée avant l'impression.
 * Deux par feuille : une copie figée des feuilles, imprimée deux fois côte à côte, en A5 sur un
 * A4 paysage (rien n'est recalculé : c'est le cours tel qu'il s'imprime, réduit).
 */

export type PrintVersion = 'normal' | 'adapted';
export type PrintColor = 'color' | 'bw' | 'eco';

export interface PrintOptions {
  version: PrintVersion;
  /** Deux exemplaires de chaque page par feuille (A5 côte à côte). */
  twoUp: boolean;
  color: PrintColor;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = { version: 'normal', twoUp: false, color: 'color' };

const KEY = 'course-print-options';

export function loadPrintOptions(): PrintOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<PrintOptions> | null;
    return { ...DEFAULT_PRINT_OPTIONS, ...(raw ?? {}) };
  } catch { return DEFAULT_PRINT_OPTIONS; }
}

export function savePrintOptions(o: PrintOptions): void {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* stockage indisponible */ }
}

/** Classes de <body> correspondant aux options (la version normale en couleur n'en pose aucune). */
export function printClasses(o: PrintOptions): string[] {
  const c: string[] = [];
  if (o.version === 'adapted') c.push('ce-print-adapted');
  if (o.color === 'bw') c.push('ce-print-bw');
  if (o.color === 'eco') c.push('ce-print-eco');
  if (o.twoUp) c.push('ce-print-twoup');
  return c;
}

/** Facteur A4 → A5 (√½) : deux pages portrait côte à côte sur un A4 paysage. */
export const TWO_UP_SCALE = Math.SQRT1_2;

/**
 * Copie figée des feuilles, deux fois côte à côte, réduite en A5 : ajoutée dans `.ce-root` le
 * temps de l'impression (seule elle s'imprime alors), retirée ensuite.
 */
export function buildTwoUp(root: HTMLElement, sheets: HTMLElement, pages: number): () => void {
  const wrap = document.createElement('div');
  wrap.className = 'ce-twoup';
  wrap.style.height = `${pages * 210}mm`;
  for (const side of [0, 1]) {
    const copy = sheets.cloneNode(true) as HTMLElement;
    copy.classList.add('ce-twoup__copy');
    copy.removeAttribute('contenteditable');
    copy.querySelectorAll('[contenteditable]').forEach((el) => el.setAttribute('contenteditable', 'false'));
    copy.style.left = side === 0 ? '0' : '148.5mm';
    copy.style.transform = `scale(${TWO_UP_SCALE})`;
    wrap.appendChild(copy);
  }
  const cut = document.createElement('div');
  cut.className = 'ce-twoup__cut';
  wrap.appendChild(cut);
  root.appendChild(wrap);

  // Le format de page ne dépend pas d'une classe : on le pose le temps de l'impression
  const page = document.createElement('style');
  page.textContent = '@media print { @page { size: A4 landscape; margin: 0; } }';
  document.head.appendChild(page);

  return () => { wrap.remove(); page.remove(); };
}
