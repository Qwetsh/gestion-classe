/**
 * Tokens du tableau blanc — source unique DOM + canvas.
 * Scopé à la surface tableau : ne touche pas src/index.css ni les variables globales.
 * Deux teintes seulement sont héritées de l'app (select, accent) pour rester "cousin".
 */

export const WB = {
  // Bureau et papier
  desk: '#0D1015',
  desk2: '#12161D',
  paper: '#FFFFFF',
  paperWarm: '#FDFCFA',
  grid: '#DFE6EF',
  gridMajor: '#C3CFDF',
  seyes: '#B9C7E8',
  seyesMarge: '#E9A6C0',

  // Chrome
  chrome: '#171C24',
  chromeHover: '#212936',
  chromeSunk: '#1E2530',
  chromeLine: '#2E3846',
  onChrome: '#E7ECF3',
  onChromeDim: '#93A0B4',
  onChromeMute: '#6E7C92',

  // Accents (cousins de --color-primary-dark et --accent)
  select: '#4F46E5',
  selectSoft: 'rgba(79,70,229,.14)',
  accent: '#F97316',
  ok: '#059669',
  danger: '#DC2626',

  // Encres
  inks: ['#14181F', '#DC2626', '#1D4ED8', '#047857', '#F97316', '#7C3AED', '#DB2777', '#FFFFFF'] as const,
  inkWhiteStroke: '#C3CFDF',
  highlighters: ['#FDE047', '#86EFAC', '#7DD3FC', '#F9A8D4', '#FDBA74'] as const,
  highlighterAlpha: 0.38,
  strokeWidths: [3, 6, 10, 16] as const,
  pressureRange: 0.4,
  laser: '#FF2D2D',
  laserWidth: 9,
  laserFadeMs: 900,

  // Typographie
  fontUI: "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',Inter,system-ui,sans-serif",
  fontNum: "'Space Grotesk','IBM Plex Mono',monospace",
  sizeDisplay: 220,
  sizeWidgetTitle: 44,
  sizePage: 40,
  sizePageMin: 34,
  sizeMenu: 20,
  sizeLabel: 17,

  // Formes
  rPage: 3,
  rBtn: 14,
  rBar: 22,
  rPanel: 28,

  // Profondeur
  e1: '0 2px 6px -2px rgba(0,0,0,.7)',
  e2: '0 14px 30px -14px rgba(0,0,0,.9)',
  e3: '0 24px 48px -20px rgba(0,0,0,1)',
  paperEdge: '0 18px 40px -14px rgba(0,0,0,.75)',

  // Mouvement
  tFast: 90,
  t: 140,
  tPanel: 200,
  easing: 'cubic-bezier(.2,.8,.2,1)',
  tMoment: 560,

  // Cibles
  hitBar: 60,
  hitBarSecondary: 52,
  hitMenu: 44,
  handleVisual: 18,
  handleHit: 44,

  // Aspect "fait main léger" des formes
  handDrawnJitter: 1.5,
} as const;

/** Bloc :root scopé à .wb — à injecter une fois, à côté des blocs CSS existants. */
export const WB_CSS_VARS = `
.wb {
  --wb-desk: ${WB.desk};
  --wb-desk-2: ${WB.desk2};
  --wb-paper: ${WB.paper};
  --wb-paper-warm: ${WB.paperWarm};
  --wb-grid: ${WB.grid};
  --wb-grid-major: ${WB.gridMajor};
  --wb-seyes: ${WB.seyes};
  --wb-seyes-marge: ${WB.seyesMarge};
  --wb-chrome: ${WB.chrome};
  --wb-chrome-hover: ${WB.chromeHover};
  --wb-chrome-sunk: ${WB.chromeSunk};
  --wb-chrome-line: ${WB.chromeLine};
  --wb-on-chrome: ${WB.onChrome};
  --wb-on-chrome-dim: ${WB.onChromeDim};
  --wb-on-chrome-mute: ${WB.onChromeMute};
  --wb-select: ${WB.select};
  --wb-select-soft: ${WB.selectSoft};
  --wb-accent: ${WB.accent};
  --wb-ok: ${WB.ok};
  --wb-danger: ${WB.danger};
  --wb-r-page: ${WB.rPage}px;
  --wb-r-btn: ${WB.rBtn}px;
  --wb-r-bar: ${WB.rBar}px;
  --wb-r-panel: ${WB.rPanel}px;
  --wb-r-pill: 999px;
  --wb-e1: ${WB.e1};
  --wb-e2: ${WB.e2};
  --wb-e3: ${WB.e3};
  --wb-paper-edge: ${WB.paperEdge};
  --wb-t-fast: ${WB.tFast}ms;
  --wb-t: ${WB.t}ms;
  --wb-t-panel: ${WB.tPanel}ms;
  --wb-ease: ${WB.easing};
  --wb-font-ui: ${WB.fontUI};
  --wb-font-num: ${WB.fontNum};
}
`;
