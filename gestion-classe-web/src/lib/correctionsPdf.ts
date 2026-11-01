/**
 * Export PDF des corrections d'une éval, pour les imprimer : la même fiche que le Word du
 * Correcteur (generer_correction.py, build_word) — récapitulatif de classe et réussite par
 * question, puis une fiche par élève (questions, compétences en radar, forces, faiblesses,
 * commentaire). 1 fiche par page, 2 si le barème a 12 lignes ou moins (eleves_par_page).
 *
 * Données : assessment_grades.grade + details (format v1). Jamais la transcription ni les
 * points à arbitrer (réservés au prof). Aucun accès au DOM : testable et utilisable hors
 * navigateur.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { levelScore, type GradeDetails } from './gradeDetails';

export interface CorrectionSheet {
  pseudo: string;
  /** Note /20. */
  grade: number | null;
  validated: boolean;
  details: GradeDetails;
}

export interface CorrectionsPdfInput {
  assessmentName: string;
  /** Titre de l'éval dans le détail (« Volcans, séismes et roches »), s'il existe. */
  evaluationTitle?: string | null;
  className: string;
  sheets: CorrectionSheet[];
  /** Page de récapitulatif (classe entière) en tête. */
  summary: boolean;
}

/* ---------- texte ---------- */

// Les polices standard du PDF (Helvetica) ne connaissent que le jeu WinAnsi : au-delà, jsPDF
// passe toute la ligne en double octet et l'affichage casse. On ramène le reste à de l'ASCII.
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const REPLACEMENTS: Record<string, string> = {
  ' ': ' ', ' ': ' ', ' ': ' ', '‑': '-', '‐': '-', '−': '-',
  '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '⇒': '=>', '≠': '!=', '≈': '~', '×': 'x',
  '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '½': '1/2', '¼': '1/4', '¾': '3/4',
};

/** Texte imprimable avec les polices standard (accents, ’ œ — « » gardés). */
export function pdfText(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if (code === 0x09 || code === 0x0a || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) {
      out += ch;
    } else if (REPLACEMENTS[ch] !== undefined) {
      out += REPLACEMENTS[ch];
    } else if (code > 0xff) {
      // Lettre accentuée hors Latin-1 (ő, ć…) : sans l'accent ; le reste (emoji…) disparaît.
      out += ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
    }
  }
  return out;
}

export function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Appréciation de la note /20, comme le Correcteur. */
export function appreciation(n: number): string {
  return n >= 16 ? 'Très bien' : n >= 14 ? 'Bien' : n >= 12 ? 'Assez bien' : n >= 10 ? 'Satisfaisant' : n >= 7 ? 'Fragile' : 'Insuffisant';
}

/** 2 fiches par page quand le barème est court, comme `eleves_par_page` du Correcteur. */
export function sheetsPerPage(questionCount: number): 1 | 2 {
  return questionCount <= 12 ? 2 : 1;
}

/**
 * Réussite moyenne par ligne du barème, sur les fiches corrigées avec le même barème que la
 * première (mêmes libellés, même ordre).
 */
export function questionSuccess(sheets: CorrectionSheet[]): { label: string; bareme: number; rate: number }[] {
  const ref = sheets[0]?.details.questions ?? [];
  const same = sheets.filter(
    (s) => s.details.questions.length === ref.length && s.details.questions.every((q, i) => q.label === ref[i].label),
  );
  return ref.map((q, i) => {
    const got = same.reduce((sum, s) => sum + s.details.questions[i].points, 0);
    return { label: q.label, bareme: q.bareme, rate: q.bareme > 0 && same.length > 0 ? got / (q.bareme * same.length) : 0 };
  });
}

export function correctionsPdfName(className: string, assessmentName: string, single?: string): string {
  const slug = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `Correction_${slug(className)}_${slug(assessmentName)}${single ? `_${slug(single)}` : ''}.pdf`;
}

/** Titre de l'éval écrit par le Correcteur dans le détail (`details.evaluation`), s'il y en a un. */
export function evaluationTitle(rawDetails: unknown[]): string | null {
  for (const d of rawDetails) {
    const t = d && typeof d === 'object' ? (d as { evaluation?: unknown }).evaluation : null;
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return null;
}

/* ---------- mise en page ---------- */

const MARGIN = 12;
const BLUE: [number, number, number] = [46, 134, 171]; // #2E86AB, couleur du radar du Correcteur
const BLUE_FILL: [number, number, number] = [207, 230, 239];
const GREY: [number, number, number] = [110, 110, 110];

type Doc = jsPDF & { lastAutoTable?: { finalY: number } };

function heading(doc: Doc, text: string, y: number, size: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(34, 34, 34);
  doc.text(pdfText(text), MARGIN, y);
  return y + size * 0.45;
}

function paragraph(doc: Doc, parts: { text: string; bold?: boolean }[], y: number, width: number, size = 8): number {
  // Un libellé en gras puis le texte, sur des lignes coupées à la largeur.
  doc.setFontSize(size);
  const lineH = size * 0.42;
  const label = parts.find((p) => p.bold)?.text ?? '';
  const body = parts.filter((p) => !p.bold).map((p) => p.text).join('');
  doc.setFont('helvetica', 'bold');
  const labelW = label ? doc.getTextWidth(pdfText(label)) : 0;
  doc.setFont('helvetica', 'normal');
  const lines: string[] = doc.splitTextToSize(pdfText(body), width - labelW);
  const first = lines.shift() ?? '';
  const rest: string[] = lines.length ? doc.splitTextToSize(lines.join(' '), width) : [];
  doc.setTextColor(34, 34, 34);
  if (label) {
    doc.setFont('helvetica', 'bold');
    doc.text(pdfText(label), MARGIN, y);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(first, MARGIN + labelW, y);
  rest.forEach((l, i) => doc.text(l, MARGIN, y + lineH * (i + 1)));
  return y + lineH * (rest.length + 1) + 1.2;
}

/**
 * Radar des compétences (axes dans l'ordre du barème, 4 niveaux), dessiné en vecteurs.
 * Les libellés passent à la ligne pour tenir entre `left` et `right` (bords de la zone).
 */
export function drawRadar(
  doc: Doc,
  comps: GradeDetails['competences'],
  cx: number,
  cy: number,
  r: number,
  bounds: { left: number; right: number },
): void {
  const n = comps.length;
  if (n < 3) return; // un radar à 1 ou 2 axes ne veut rien dire : la liste écrite suffit
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => [cx + Math.cos(angle(i)) * (r * v) / 4, cy + Math.sin(angle(i)) * (r * v) / 4] as const;
  const polygon = (pts: (readonly [number, number])[], style: 'S' | 'FD') => {
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
    doc.lines(segs, pts[0][0], pts[0][1], [1, 1], style, true);
  };

  doc.setLineWidth(0.15);
  doc.setDrawColor(200, 200, 200);
  for (let lvl = 1; lvl <= 4; lvl++) polygon(comps.map((_, i) => point(i, lvl)), 'S');
  comps.forEach((_, i) => {
    const [x, y] = point(i, 4);
    doc.line(cx, cy, x, y);
  });

  const values = comps.map((c, i) => point(i, levelScore(c.niveau)));
  doc.setDrawColor(...BLUE);
  doc.setFillColor(...BLUE_FILL);
  doc.setLineWidth(0.5);
  polygon(values, 'FD');
  doc.setFillColor(...BLUE);
  values.forEach(([x, y]) => doc.circle(x, y, 0.7, 'F'));

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(...GREY);
  ['Insuff.', 'Fragile', 'Satisf.', 'T.B.M.'].forEach((lab, k) => doc.text(lab, cx + 1, cy - (r * (k + 1)) / 4 - 0.6));
  doc.setFontSize(6.5);
  doc.setTextColor(34, 34, 34);
  const lineH = 2.6;
  comps.forEach((c, i) => {
    const a = angle(i);
    const cos = Math.cos(a);
    const x = cx + cos * (r + 2.5);
    const align = Math.abs(cos) < 0.2 ? 'center' : cos > 0 ? 'left' : 'right';
    const room = align === 'left' ? bounds.right - x : align === 'right' ? x - bounds.left : Math.min(x - bounds.left, bounds.right - x) * 2;
    const lines: string[] = doc.splitTextToSize(pdfText(c.nom), Math.max(12, room));
    // Au-dessus du radar, le bloc remonte ; au-dessous, il descend ; sur les côtés, il est centré.
    const sin = Math.sin(a);
    const yEdge = cy + sin * (r + 2.5);
    const y = sin < -0.2 ? yEdge - (lines.length - 1) * lineH - 0.5 : sin > 0.2 ? yEdge + 2.2 : yEdge + 1 - ((lines.length - 1) * lineH) / 2;
    doc.text(lines, x, y, { align });
  });
}

/** Une fiche élève à partir de `y` ; renvoie le bas de la fiche. */
function drawSheet(doc: Doc, s: CorrectionSheet, input: CorrectionsPdfInput, y: number): number {
  const pageW = doc.internal.pageSize.getWidth();
  const width = pageW - 2 * MARGIN;
  const d = s.details;
  const total = d.baremeTotal ?? d.questions.reduce((sum, q) => sum + q.bareme, 0);

  y = heading(doc, `${s.pseudo}  —  ${fmt(s.grade)}/20`, y + 4, 12) + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(pdfText(`${input.evaluationTitle || input.assessmentName} — ${input.className}${d.version ? ` — sujet ${d.version}` : ''}`), MARGIN, y);
  y += 4;
  if (d.noteForcee) {
    y = paragraph(doc, [{ text: `Note fixée par ton professeur. Le détail ci-dessous (${fmt(d.noteBrute)}/${fmt(total)}) sert à repérer ce qui est réussi et ce qui reste à travailler.` }], y, width);
  } else if (Math.abs(total - 20) > 1e-9 && d.noteBrute !== null) {
    y = paragraph(doc, [{ text: `Note brute : ${fmt(d.noteBrute)}/${fmt(total)}` }], y, width);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Question', 'Pts', 'Bar.', 'Commentaire']],
    body: d.questions.map((q) => [pdfText(q.label), fmt(q.points), fmt(q.bareme), pdfText(q.commentaire)]),
    styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak', textColor: [34, 34, 34] },
    headStyles: { fillColor: BLUE, textColor: 255, fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 43 }, 1: { cellWidth: 9, halign: 'center' }, 2: { cellWidth: 9, halign: 'center' } },
    rowPageBreak: 'avoid',
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 4;

  // Compétences, forces, faiblesses, commentaire à gauche ; radar à droite.
  const radarW = 72;
  const textW = width - radarW - 4;
  const top = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(34, 34, 34);
  doc.text('COMPÉTENCES', MARGIN, y + 1);
  y += 5;
  for (const c of d.competences) y = paragraph(doc, [{ text: `${c.nom} : ${c.niveau ?? '—'}` }], y, textW);
  y += 1;
  for (const [label, text] of [['FORCES : ', d.forces], ['FAIBLESSES : ', d.faiblesses], ['COMMENTAIRE : ', d.commentaire]] as const) {
    if (text) y = paragraph(doc, [{ text: label, bold: true }, { text }], y, textW);
  }
  const radarBottom = top + 50;
  if (d.competences.length >= 3) {
    drawRadar(doc, d.competences, MARGIN + textW + 4 + radarW / 2, top + 24, 15, {
      left: MARGIN + textW + 3,
      right: pageW - MARGIN,
    });
  }
  return Math.max(y, d.competences.length >= 3 ? radarBottom : y);
}

/** Hauteur d'une fiche, mesurée en la dessinant sur un document jetable. */
function measureSheet(s: CorrectionSheet, input: CorrectionsPdfInput): number {
  const scratch = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  return drawSheet(scratch, s, input, MARGIN) - MARGIN;
}

function drawSummary(doc: Doc, input: CorrectionsPdfInput): void {
  const sheets = input.sheets;
  const total = sheets[0]?.details.baremeTotal ?? sheets[0]?.details.questions.reduce((s, q) => s + q.bareme, 0) ?? 20;
  const sur20 = Math.abs(total - 20) < 1e-9;
  let y = heading(doc, `Correction — ${input.evaluationTitle || input.assessmentName}`, MARGIN + 6, 16) + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  const named = input.evaluationTitle && input.evaluationTitle !== input.assessmentName ? `${input.assessmentName} — ` : '';
  doc.text(pdfText(`${named}Classe de ${input.className} — ${sur20 ? 'Barème : /20' : `Barème : /${fmt(total)} ramené sur /20`}`), MARGIN, y);
  y = heading(doc, 'Récapitulatif', y + 9, 12) + 1;

  const sorted = [...sheets].sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1));
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [sur20 ? ['Élève', '/20', 'Appréciation'] : ['Élève', `/${fmt(total)}`, '/20', 'Appréciation']],
    body: sorted.map((s) => {
      const app = s.grade === null ? '—' : appreciation(s.grade) + (s.validated ? '' : ' (brouillon)');
      return sur20 ? [pdfText(s.pseudo), fmt(s.grade), app] : [pdfText(s.pseudo), fmt(s.details.noteBrute), fmt(s.grade), app];
    }),
    styles: { fontSize: 8, cellPadding: 1.3 },
    headStyles: { fillColor: BLUE, textColor: 255 },
  });
  y = (doc.lastAutoTable?.finalY ?? y) + 5;

  const notes = sheets.map((s) => s.grade).filter((g): g is number => g !== null);
  if (notes.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(34, 34, 34);
    const mean = notes.reduce((a, b) => a + b, 0) / notes.length;
    doc.text(
      `Moyenne : ${mean.toFixed(1).replace('.', ',')}/20  |  Max : ${fmt(Math.max(...notes))}/20  |  Min : ${fmt(Math.min(...notes))}/20  |  Copies corrigées : ${notes.length}`,
      MARGIN, y,
    );
    y += 6;
  }

  const success = questionSuccess(sheets);
  if (success.length > 0) {
    y = heading(doc, 'Réussite par question', y + 2, 10) + 1;
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Question', 'Barème', 'Réussite moyenne']],
      body: success.map((q) => [pdfText(q.label), fmt(q.bareme), `${Math.round(q.rate * 100)} %`]),
      styles: { fontSize: 7.5, cellPadding: 1.1 },
      headStyles: { fillColor: BLUE, textColor: 255 },
      columnStyles: { 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'center', cellWidth: 32 } },
    });
  }
}

/** Le PDF complet (récapitulatif facultatif, puis les fiches). */
export function buildCorrectionsPdf(input: CorrectionsPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' }) as Doc;
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  let started = false;
  if (input.summary && input.sheets.length > 0) {
    drawSummary(doc, input);
    started = true;
  }

  const perPage = sheetsPerPage(Math.max(0, ...input.sheets.map((s) => s.details.questions.length)));
  let y = MARGIN;
  let onPage = 0;
  for (const s of input.sheets) {
    const fitsBelow = perPage === 2 && onPage === 1 && y + 6 + measureSheet(s, input) <= pageH - MARGIN - 8;
    if (fitsBelow) {
      // Trait de séparation, à découper : deux élèves sur la même feuille.
      doc.setDrawColor(170, 170, 170);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 3, pageW - MARGIN, y + 3);
      doc.setLineDashPattern([], 0);
      y = drawSheet(doc, s, input, y + 4);
      onPage = 2;
    } else {
      if (started) doc.addPage();
      started = true;
      y = drawSheet(doc, s, input, MARGIN);
      onPage = 1;
    }
  }

  if (!started) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Aucune correction à exporter.', MARGIN, MARGIN + 8);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(pdfText(`${input.evaluationTitle || input.assessmentName} — ${input.className}`), MARGIN, pageH - 6);
    doc.text(`${i}/${pages}`, pageW - MARGIN, pageH - 6, { align: 'right' });
  }
  return doc;
}

