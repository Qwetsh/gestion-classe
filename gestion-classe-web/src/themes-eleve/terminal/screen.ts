/**
 * L'écran du thème « Terminal » : les programmes qui s'y écrivent, et leur minutage.
 *
 * Tout tourne sur un même cycle de 40 s (`CYCLE`) : chaque ligne, chaque curseur, la disquette et
 * le voyant du lecteur ont une animation CSS de 40 s qui part au même instant ; ils restent donc
 * calés les uns sur les autres. Les étapes de chaque animation dépendent de la longueur du texte
 * et de l'instant où la ligne commence : elles sont calculées ici (`SCREEN_CSS`, posé dans une
 * balise <style> par la scène) plutôt qu'écrites à la main dans `theme.css`.
 *
 * Une ligne « type » s'écrit caractère par caractère (sa largeur grandit d'un caractère à la fois,
 * la police est à chasse fixe) avec un curseur au bout ; une ligne « show » s'affiche d'un coup
 * (sortie d'un programme) ; « bar » est une barre de progression ; « gap » laisse des lignes vides.
 * À la fin d'un programme, l'écran défile ligne par ligne vers le haut et le suivant commence.
 */

export const CYCLE = 40;
export const LINE = 12;

export type Row =
  | { kind: 'type'; text: string; at: number; cps?: number }
  | { kind: 'show'; text: string; at: number }
  | { kind: 'bar'; at: number; fill: number }
  | { kind: 'gap'; rows: number };

export type Program = { from: number; to: number; rows: Row[]; cat?: { from: number; to: number } };

/** Les trois programmes du cycle. */
export const PROGRAMS: Program[] = [
  {
    from: 0.3,
    to: 13.2,
    rows: [
      { kind: 'type', text: '> BONJOUR !', at: 0.6, cps: 9 },
      { kind: 'type', text: '> CHARGEMENT DU COURS...', at: 2.4, cps: 14 },
      { kind: 'bar', at: 4.6, fill: 3 },
      { kind: 'type', text: '> SVT.EXE', at: 8.6, cps: 9 },
      { kind: 'type', text: 'PRÊT ! BONNE SÉANCE.', at: 10, cps: 40 },
      { kind: 'type', text: '>', at: 11, cps: 99 },
    ],
  },
  {
    from: 13.9,
    to: 24,
    rows: [
      { kind: 'type', text: '> TYPE MONTAGNE.TXT', at: 14.3, cps: 12 },
      { kind: 'show', text: '    /\\       \\ | /', at: 16.2 },
      { kind: 'show', text: '   /  \\  /\\  - O -', at: 16.45 },
      { kind: 'show', text: '  / /\\ \\/  \\ / | \\', at: 16.7 },
      { kind: 'show', text: ' /_/__\\_\\___\\______', at: 16.95 },
      { kind: 'type', text: '>', at: 17.6, cps: 99 },
    ],
  },
  {
    from: 26,
    to: 37.4,
    cat: { from: 27.6, to: 33.6 },
    rows: [
      { kind: 'type', text: 'A:\\> CHAT.EXE', at: 26.4, cps: 9 },
      { kind: 'gap', rows: 3 },
      { kind: 'type', text: '> MIAOU !', at: 34, cps: 9 },
      { kind: 'type', text: '>', at: 35.4, cps: 99 },
    ],
  },
];

/** La disquette s'enfonce, le voyant s'allume, la disquette ressort (en secondes du cycle). */
const DISK = { in: 24.6, inEnd: 25.4, ledOff: 36.8, out: 37.6, outEnd: 38.2 };

const pc = (s: number) => `${Math.min(100, Math.max(0, (s / CYCLE) * 100)).toFixed(3)}%`;
const S = "[data-scene='terminal']";
const anim = (name: string, timing = 'linear') => `animation: ${name} ${CYCLE}s ${timing} infinite;`;

/** Visible (1) entre deux instants, caché (0) ailleurs, sans fondu. */
function windowFrames(name: string, on: number, off: number | null): string {
  const end = off === null ? '100% { opacity: 1; }' : `${pc(off)}, 100% { opacity: 0; }`;
  return `@keyframes ${name} { 0% { opacity: 0; } ${pc(on)} { opacity: 1; } ${end} }`;
}

function buildCss(): string {
  const out: string[] = [];
  PROGRAMS.forEach((prog, p) => {
    const scrollEnd = prog.to + 0.7;
    out.push(
      `${S} .tm-prog-${p} { ${anim(`tm-prog-${p}`)} }`,
      `@keyframes tm-prog-${p} {
  0%, ${pc(prog.from - 0.01)} { opacity: 0; transform: translateY(0); }
  ${pc(prog.from)} { opacity: 1; transform: translateY(0); }
  ${pc(prog.to)} { opacity: 1; transform: translateY(0); animation-timing-function: steps(7, end); }
  ${pc(scrollEnd)} { opacity: 1; transform: translateY(-${7 * LINE}px); }
  ${pc(scrollEnd + 0.01)}, 100% { opacity: 0; transform: translateY(0); }
}`,
    );
    const starts = prog.rows.map((r) => (r.kind === 'gap' ? null : r.at));
    prog.rows.forEach((row, j) => {
      const sel = `${S} .tm-r-${p}-${j}`;
      if (row.kind === 'gap') return;
      if (row.kind === 'show') {
        out.push(`${sel} { ${anim(`tm-s-${p}-${j}`, 'step-end')} }`, windowFrames(`tm-s-${p}-${j}`, row.at, null));
        return;
      }
      if (row.kind === 'bar') {
        const full = row.at + row.fill;
        out.push(
          `${sel} { ${anim(`tm-s-${p}-${j}`, 'step-end')} }`,
          windowFrames(`tm-s-${p}-${j}`, row.at, null),
          `${sel} .tm-fill { ${anim(`tm-f-${p}-${j}`)} }`,
          `@keyframes tm-f-${p}-${j} { 0%, ${pc(row.at)} { width: 0; animation-timing-function: steps(10, end); } ${pc(full)}, 100% { width: 10ch; } }`,
          `${sel} .tm-pc { ${anim(`tm-pc-${p}-${j}`, 'step-end')} }`,
          windowFrames(`tm-pc-${p}-${j}`, full + 0.2, null),
        );
        return;
      }
      const n = [...row.text].length;
      const typed = row.at + n / (row.cps ?? 10);
      const next = starts.slice(j + 1).find((s): s is number => s !== null) ?? scrollEnd;
      out.push(
        `${sel} .tm-tx { ${anim(`tm-w-${p}-${j}`)} }`,
        `@keyframes tm-w-${p}-${j} { 0%, ${pc(row.at)} { width: 0; animation-timing-function: steps(${n}, end); } ${pc(typed)}, 100% { width: ${n}ch; } }`,
        `${sel} .tm-cur { ${anim(`tm-c-${p}-${j}`, 'step-end')} }`,
        windowFrames(`tm-c-${p}-${j}`, row.at, next),
      );
    });
    if (prog.cat) {
      const steps = 36;
      out.push(
        `${S} .tm-prog-${p} .tm-catwalk { ${anim(`tm-cw-${p}`)} }`,
        `@keyframes tm-cw-${p} {
  0%, ${pc(prog.cat.from)} { transform: translateX(140px); animation-timing-function: steps(${steps}, end); }
  ${pc(prog.cat.to)}, 100% { transform: translateX(-52px); }
}`,
      );
    }
  });
  out.push(
    `${S} .tm-disk { ${anim('tm-disk')} }`,
    `@keyframes tm-disk {
  0%, ${pc(DISK.in)} { transform: translateY(0); animation-timing-function: cubic-bezier(0.5, 0, 0.8, 0.6); }
  ${pc(DISK.inEnd)} { transform: translateY(37px); }
  ${pc(DISK.out)} { transform: translateY(37px); animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1); }
  ${pc(DISK.outEnd - 0.25)} { transform: translateY(-5px); animation-timing-function: ease-in-out; }
  ${pc(DISK.outEnd)}, 100% { transform: translateY(0); }
}`,
    `${S} .tm-led { ${anim('tm-led')} }`,
    `@keyframes tm-led {
  0%, ${pc(DISK.inEnd)} { opacity: 0; }
  ${pc(DISK.inEnd + 0.3)} { opacity: 1; }
  ${pc(DISK.inEnd + 2)} { opacity: 0.7; }
  ${pc(DISK.inEnd + 3.5)} { opacity: 1; }
  ${pc(DISK.ledOff - 0.3)} { opacity: 1; }
  ${pc(DISK.ledOff)}, 100% { opacity: 0; }
}`,
  );
  return out.join('\n');
}

export const SCREEN_CSS = buildCss();
