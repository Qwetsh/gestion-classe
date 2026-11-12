/**
 * Blocs prêts à insérer (AUDIT_editeur_texte.md, lot T3) : des gabarits faits de contenu
 * ordinaire (tableaux, listes à cases, pointillés, barème) — une fois posés, ils se modifient
 * comme le reste du cours.
 */
import type { JSONContent } from '@tiptap/core';
import type { IconName } from './courseIcons';
import { COL_W } from '../../lib/course/coursePage';

const text = (t: string, bold = false): JSONContent => (bold ? { type: 'text', text: t, marks: [{ type: 'bold' }] } : { type: 'text', text: t });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content: content.length ? content : undefined });
const centered = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', attrs: { textAlign: 'center' }, content: content.length ? content : undefined });
const dots = (cm: number | null = null): JSONContent => ({ type: 'dots', attrs: { cm } });
const points = (value: number): JSONContent => ({ type: 'points', attrs: { value } });

const cell = (width: number, content: JSONContent[], colspan = 1): JSONContent => ({ type: 'tableCell', attrs: { colspan, rowspan: 1, colwidth: colspan === 1 ? [width] : null }, content });
const head = (width: number, content: JSONContent[]): JSONContent => ({ type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: [width] }, content });
const row = (...cells: JSONContent[]): JSONContent => ({ type: 'tableRow', content: cells });
const table = (...rows: JSONContent[]): JSONContent => ({ type: 'table', content: rows });

/** Largeurs de colonnes (px) dont la somme fait la colonne de texte. */
function widths(...parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0);
  const w = parts.map((x) => Math.floor((x / total) * COL_W));
  w[0] += Math.floor(COL_W) - w.reduce((a, b) => a + b, 0);
  return w;
}

export interface CourseBlock {
  id: string;
  label: string;
  hint: string;
  icon: IconName;
  build: () => JSONContent[];
}

export const COURSE_BLOCKS: CourseBlock[] = [
  {
    id: 'cartouche',
    label: 'Cartouche d’évaluation',
    hint: 'Nom, prénom, classe, date, note sur le total du barème, appréciation',
    icon: 'cartouche',
    build: () => {
      const [a, b, c, d] = widths(27, 27, 22, 24);
      return [
        table(
          row(
            cell(a, [p(text('Nom : ', true), dots())]),
            cell(b, [p(text('Prénom : ', true), dots())]),
            cell(c, [p(text('Classe : ', true), dots())]),
            cell(d, [p(text('Date : ', true), dots())]),
          ),
          row(
            cell(a, [p(text('Note : ', true), dots(1.4), text(' '), { type: 'pointsTotal' })]),
            cell(b + c + d, [p(text('Appréciation : ', true)), p(), p()], 3),
          ),
        ),
        p(),
      ];
    },
  },
  {
    id: 'question',
    label: 'Question avec barème',
    hint: 'Un énoncé, ses points à droite, des lignes pointillées pour répondre',
    icon: 'question',
    build: () => [
      p(text('Question 1 — ', true), text('Énoncé de la question.'), points(2)),
      { type: 'writingZone', attrs: { style: 'pointilles', lines: 3 } },
    ],
  },
  {
    id: 'qcm',
    label: 'QCM',
    hint: 'Une question et quatre réponses à cocher',
    icon: 'checklist',
    build: () => [
      p(text('Question 1 — ', true), text('Coche la bonne réponse.'), points(1)),
      {
        type: 'taskList',
        content: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'].map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(text(t))] })),
      },
    ],
  },
  {
    id: 'vraifaux',
    label: 'Vrai ou faux',
    hint: 'Un tableau d’affirmations avec les cases Vrai et Faux',
    icon: 'table',
    build: () => {
      const [a, b, c] = widths(74, 13, 13);
      const line = (n: number) => row(cell(a, [p(text(`Affirmation ${n}`))]), cell(b, [centered(text('☐'))]), cell(c, [centered(text('☐'))]));
      return [
        table(row(head(a, [p(text('Affirmation'))]), head(b, [centered(text('Vrai'))]), head(c, [centered(text('Faux'))])), line(1), line(2), line(3)),
        p(),
      ];
    },
  },
  {
    id: 'competences',
    label: 'Tableau de compétences',
    hint: 'Compétences évaluées et quatre niveaux de maîtrise (I, F, S, TB)',
    icon: 'competences',
    build: () => {
      const [a, b, c, d, e] = widths(60, 10, 10, 10, 10);
      const line = () => row(cell(a, [p()]), cell(b, [p()]), cell(c, [p()]), cell(d, [p()]), cell(e, [p()]));
      return [
        table(
          row(head(a, [p(text('Compétence évaluée'))]), head(b, [centered(text('I'))]), head(c, [centered(text('F'))]), head(d, [centered(text('S'))]), head(e, [centered(text('TB'))])),
          line(), line(), line(),
        ),
        p(),
      ];
    },
  },
  {
    id: 'libre',
    label: 'Encadré libre',
    hint: 'Un encadré dont on choisit le titre et la couleur',
    icon: 'callout',
    build: () => [
      { type: 'callout', attrs: { kind: 'libre', title: 'Vocabulaire', color: '#0EA5E9' }, content: [p()] },
    ],
  },
];
