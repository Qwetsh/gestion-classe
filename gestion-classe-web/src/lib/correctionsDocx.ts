import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { appreciation, fmt, questionSuccess, type CorrectionSheet } from './correctionsPdf';
import { questionRate } from './gradeDetails';

/**
 * Fiches de correction en Word (hub Évaluations, phase 5) : le même contenu que le PDF
 * (correctionsPdf.ts) — récapitulatif de la classe puis une fiche par élève — mais modifiable,
 * pour retoucher un commentaire avant d'imprimer. `docx` produit le fichier dans le navigateur.
 */

export interface CorrectionsDocxInput {
  assessmentName: string;
  evaluationTitle?: string | null;
  className: string;
  sheets: CorrectionSheet[];
  summary: boolean;
}

const FONT = 'Calibri';
const BLUE = '2E86AB';
const GREY = '6E6E6E';

function run(text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}): TextRun {
  return new TextRun({ text, font: FONT, bold: opts.bold, italics: opts.italics, color: opts.color, size: (opts.size ?? 10) * 2 });
}

function para(children: TextRun[], opts: { spacingAfter?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({ children, spacing: { after: opts.spacingAfter ?? 80 }, alignment: opts.align });
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function cell(text: string, opts: { bold?: boolean; fill?: string; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string } = {}): TableCell {
  return new TableCell({
    borders: BORDERS,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: opts.align, children: [run(text, { bold: opts.bold, color: opts.color, size: 9 })] })],
  });
}

/** Couleur de réussite d'une question, comme le PDF : vert, orange, rouge. */
function rateFill(rate: number): string {
  return rate >= 0.75 ? 'D9F2E3' : rate >= 0.5 ? 'FCEFD4' : 'F9DCDC';
}

function title(input: CorrectionsDocxInput): string {
  return `${input.evaluationTitle || input.assessmentName} · ${input.className}`;
}

function summarySection(input: CorrectionsDocxInput): (Paragraph | Table)[] {
  const graded = input.sheets.filter((s) => s.grade !== null);
  const mean = graded.length ? graded.reduce((sum, s) => sum + (s.grade ?? 0), 0) / graded.length : null;
  const out: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(`Récapitulatif · ${title(input)}`, { bold: true, size: 15, color: BLUE })], spacing: { after: 120 } }),
    para([run(`${input.sheets.length} copie${input.sheets.length > 1 ? 's' : ''}`), run(mean !== null ? ` · moyenne ${fmt(Math.round(mean * 10) / 10)}/20` : '')]),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [cell('Élève', { bold: true, fill: 'E7F1F6', width: 60 }), cell('Note /20', { bold: true, fill: 'E7F1F6', width: 20, align: AlignmentType.RIGHT }), cell('Appréciation', { bold: true, fill: 'E7F1F6', width: 20 })] }),
        ...input.sheets.map((s) => new TableRow({ children: [
          cell(s.pseudo + (s.validated ? '' : ' (brouillon)')),
          cell(fmt(s.grade), { align: AlignmentType.RIGHT, bold: true }),
          cell(s.grade !== null ? appreciation(s.grade) : '—'),
        ] })),
      ],
    }),
  ];
  const success = questionSuccess(input.sheets);
  if (success.length > 0) {
    out.push(
      para([run('Réussite par question', { bold: true, size: 11, color: BLUE })], { spacingAfter: 60 }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ tableHeader: true, children: [cell('Question', { bold: true, fill: 'E7F1F6', width: 70 }), cell('Barème', { bold: true, fill: 'E7F1F6', width: 15, align: AlignmentType.RIGHT }), cell('Réussite', { bold: true, fill: 'E7F1F6', width: 15, align: AlignmentType.RIGHT })] }),
          ...success.map((q) => new TableRow({ children: [
            cell(q.label),
            cell(fmt(q.bareme), { align: AlignmentType.RIGHT }),
            cell(`${Math.round(q.rate * 100)} %`, { align: AlignmentType.RIGHT, fill: rateFill(q.rate) }),
          ] })),
        ],
      }),
    );
  }
  return out;
}

function sheetSection(input: CorrectionsDocxInput, s: CorrectionSheet): (Paragraph | Table)[] {
  const d = s.details;
  const raw = d.noteBrute !== null && d.baremeTotal !== null ? ` (${fmt(d.noteBrute)}/${fmt(d.baremeTotal)})` : '';
  const out: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [run(s.pseudo, { bold: true, size: 15, color: BLUE })], spacing: { after: 40 } }),
    para([run(title(input), { color: GREY, size: 9 })]),
    para([
      run(`Note : ${fmt(s.grade)}/20`, { bold: true, size: 12 }),
      run(raw, { color: GREY }),
      run(s.grade !== null ? ` · ${appreciation(s.grade)}` : ''),
      run(s.validated ? '' : ' · brouillon', { color: 'B7791F', italics: true }),
    ], { spacingAfter: 120 }),
  ];
  if (d.questions.length > 0) {
    out.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ tableHeader: true, children: [cell('Question', { bold: true, fill: 'E7F1F6', width: 30 }), cell('Points', { bold: true, fill: 'E7F1F6', width: 12, align: AlignmentType.RIGHT }), cell('Commentaire', { bold: true, fill: 'E7F1F6', width: 58 })] }),
        ...d.questions.map((q) => new TableRow({ children: [
          cell(q.label),
          cell(`${fmt(q.points)}/${fmt(q.bareme)}`, { align: AlignmentType.RIGHT, bold: true, fill: rateFill(questionRate(q)) }),
          cell(q.commentaire || ''),
        ] })),
      ],
    }));
  }
  if (d.competences.length > 0) {
    out.push(para([run('Compétences', { bold: true, size: 11, color: BLUE })], { spacingAfter: 40 }));
    for (const c of d.competences) out.push(para([run(`${c.nom} : `, { bold: true }), run(c.niveau ?? '—')], { spacingAfter: 20 }));
  }
  for (const [label, text] of [['Points forts', d.forces], ['À travailler', d.faiblesses], ['Commentaire', d.commentaire]] as const) {
    if (text) out.push(para([run(`${label} : `, { bold: true }), run(text)], { spacingAfter: 80 }));
  }
  return out;
}

export function buildCorrectionsDocx(input: CorrectionsDocxInput): Document {
  const blocks: (Paragraph | Table)[][] = [];
  if (input.summary && input.sheets.length > 1) blocks.push(summarySection(input));
  for (const s of input.sheets) blocks.push(sheetSection(input, s));
  const children: (Paragraph | Table)[] = [];
  blocks.forEach((b, i) => {
    if (i > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...b);
  });
  return new Document({
    creator: 'Gestion Classe',
    title: title(input),
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
}

export async function correctionsDocxBlob(input: CorrectionsDocxInput): Promise<Blob> {
  return Packer.toBlob(buildCorrectionsDocx(input));
}
