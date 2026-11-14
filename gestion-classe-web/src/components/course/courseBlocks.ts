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

/** Texte mis en forme : gras, italique, couleur, taille (pt), exposant. */
interface Look { b?: boolean; i?: boolean; color?: string; pt?: number; sup?: boolean }
const styled = (t: string, look: Look = {}): JSONContent => {
  const marks: JSONContent['marks'] = [];
  if (look.b) marks.push({ type: 'bold' });
  if (look.i) marks.push({ type: 'italic' });
  if (look.sup) marks.push({ type: 'superscript' });
  if (look.color || look.pt) marks.push({ type: 'textStyle', attrs: { ...(look.color ? { color: look.color } : {}), ...(look.pt ? { fontSize: `${look.pt}pt` } : {}) } });
  return marks.length ? { type: 'text', text: t, marks } : { type: 'text', text: t };
};
/** Paragraphe serré (cellules du cartouche). */
const tight = (align: 'left' | 'center', ...content: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  attrs: { ...(align === 'center' ? { textAlign: 'center' } : {}), spaceAfter: 0, lineHeight: '1.2' },
  content: content.length ? content : undefined,
});
/** Cellule sur plusieurs colonnes (`ws` : leurs largeurs) et lignes, fond et alignement vertical au choix. */
const box = (ws: number[], content: JSONContent[], opts: { rowspan?: number; bg?: string; middle?: boolean } = {}): JSONContent => ({
  type: 'tableCell',
  attrs: { colspan: ws.length, rowspan: opts.rowspan ?? 1, colwidth: ws, ...(opts.bg ? { backgroundColor: opts.bg } : {}), ...(opts.middle ? { verticalAlign: 'middle' } : {}) },
  content,
});

/**
 * Cartouche d'activité (lot Q2), sur le modèle des fiches Word de Thomas : bandeau de séquence à
 * gauche, titre et niveau, note et commentaire, compétences, durée et modalité, problématique,
 * objectifs. Précédé de la ligne Nom, Prénom, Classe, Date.
 */
export function activityCartouche(): JSONContent[] {
  const [a, b, c, d, e] = widths(17.6, 11, 23.7, 23.7, 24);
  const grey = '#595959';
  const comp = (label: string, color: string, ws: number[]) => box(ws, [
    tight('center', styled(label, { i: true, color, pt: 8 })),
    tight('center', styled('○  ○  ○  ○', { color: '#808080', pt: 9 })),
  ], { middle: true });
  const meta = (icon: string, label: string, value: string, last = false) => [
    styled(`${icon}\u00A0`, { pt: 9 }), styled(`${label}\u00A0: `, { b: true, pt: 9 }), styled(value + (last ? '' : '   |   '), { pt: 9 }),
  ];
  return [
    {
      type: 'paragraph',
      attrs: { spaceAfter: 4 },
      content: [
        styled('Nom : ', { color: grey, pt: 10 }), dots(2.6), styled('   Prénom : ', { color: grey, pt: 10 }), dots(2.6),
        styled('   Classe : ', { color: grey, pt: 10 }), dots(1.2), styled('   Date : ', { color: grey, pt: 10 }), styled('……/……/………', { color: grey, pt: 10 }),
      ],
    },
    {
      type: 'table',
      content: [
        row(
          box([a], [
            tight('center', styled('Séquence 1', { b: true, color: '#FFFFFF', pt: 10 })),
            tight('center', styled('Titre de la séquence', { i: true, color: '#FFFFFF', pt: 9 })),
            tight('center', styled('Type d’activité', { i: true, color: '#FFFFFF', pt: 9 })),
          ], { rowspan: 6, bg: '#1F4E79', middle: true }),
          box([b, c, d], [tight('center', styled('Activité 1 : titre de l’activité', { b: true, pt: 12 }))], { middle: true }),
          box([e], [tight('center', styled('3', { b: true, pt: 13 }), styled('e', { b: true, pt: 13, sup: true }))], { middle: true }),
        ),
        row(
          box([b], [tight('left', styled('Note :', { b: true, pt: 10 })), tight('left', styled('/20', { b: true, pt: 10 }))], { rowspan: 2, middle: true }),
          box([c, d, e], [tight('left', styled('Commentaire :', { b: true, pt: 10 }))]),
        ),
        row(
          comp('Pratiquer des démarches scientifiques', '#2E75B6', [c]),
          comp('Pratiquer des langages scientifiques', '#C00000', [d, e]),
        ),
        row(box([b, c, d, e], [tight('left',
          ...meta('⏱', 'Durée', '1 séance'), ...meta('👥', 'Modalité', 'Individuel'), ...meta('🔧', 'Matériel', 'doc. 1 à 3'), ...meta('📖', 'Méthodes', 'FM1', true),
        )], { bg: '#F2F2F2' })),
        row(box([b, c, d, e], [tight('left', styled('Problématique : ', { b: true }), styled('La question à laquelle l’activité répond ?', { i: true }))], { bg: '#FBE5E5' })),
        row(box([b, c, d, e], [
          tight('left', styled('🎯 À la fin de cette activité, tu seras capable de :', { b: true, color: '#1F3864', pt: 10 })),
          { type: 'bulletList', content: ['premier objectif ;', 'deuxième objectif.'].map((t) => ({ type: 'listItem', content: [tight('left', styled(t, { pt: 10 }))] })) },
        ], { bg: '#EAF1F9' })),
      ],
    },
  ];
}
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
    id: 'cartouche-activite',
    label: 'Cartouche d’activité',
    hint: 'Séquence, titre, niveau, note, compétences, durée, problématique et objectifs',
    icon: 'cartouche',
    build: () => [...activityCartouche(), p()],
  },
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
