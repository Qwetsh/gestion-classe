/**
 * Modèles de cours fournis (AUDIT_editeur_texte.md, lot T6) : des documents de départ faits de
 * contenu ordinaire, à compléter. S'y ajoutent les modèles personnels (cours enregistrés comme
 * modèle, colonne boards.is_template de la migration 072).
 */
import type { JSONContent } from '@tiptap/core';
import { COURSE_DOC_VERSION, emptyCourseDoc, type CourseDoc, type CourseSettings } from '../../lib/course/courseDoc';
import { pageGeometry } from '../../lib/course/coursePage';
import { COURSE_BLOCKS, activityCartouche } from './courseBlocks';

const text = (t: string, bold = false): JSONContent => (bold ? { type: 'text', text: t, marks: [{ type: 'bold' }] } : { type: 'text', text: t });
const italic = (t: string): JSONContent => ({ type: 'text', text: t, marks: [{ type: 'italic' }] });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content: content.length ? content : undefined });
const h = (level: 1 | 2 | 3, t: string): JSONContent => ({ type: 'heading', attrs: { level }, content: t ? [text(t)] : undefined });
const callout = (kind: string, ...content: JSONContent[]): JSONContent => ({ type: 'callout', attrs: { kind }, content: content.length ? content : [p()] });
const libre = (title: string, color: string, ...content: JSONContent[]): JSONContent => ({ type: 'callout', attrs: { kind: 'libre', title, color }, content: content.length ? content : [p()] });
const zone = (style: string, lines: number): JSONContent => ({ type: 'writingZone', attrs: { style, lines } });
const points = (value: number): JSONContent => ({ type: 'points', attrs: { value } });
const item = (...content: JSONContent[]): JSONContent => ({ type: 'listItem', content });
const ol = (...items: string[]): JSONContent => ({ type: 'orderedList', content: items.map((t) => item(p(text(t)))) });
const ul = (...items: string[]): JSONContent => ({ type: 'bulletList', content: items.map((t) => item(p(text(t)))) });
/** Encadré à cadre fin et titre en gras, comme sur les fiches Word (lot Q2). */
const fiche = (title: string, color: string, ...content: JSONContent[]): JSONContent => ({ type: 'callout', attrs: { kind: 'libre', title, color, frame: 'box', titleStyle: 'bold' }, content: content.length ? content : [p()] });
const colored = (t: string, color: string, bold = false): JSONContent => ({ type: 'text', text: t, marks: [...(bold ? [{ type: 'bold' }] : []), { type: 'textStyle', attrs: { color } }] });
const task = (...items: string[]): JSONContent => ({ type: 'taskList', content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(text(t))] })) });
const question = (n: number, ...content: JSONContent[]): JSONContent => ({ type: 'paragraph', attrs: { lineHeight: '1.38', spaceBefore: 8, spaceAfter: 5 }, content: [text(`${n}. `, true), ...content] });
const block = (id: string): JSONContent[] => COURSE_BLOCKS.find((b) => b.id === id)?.build() ?? [];

const doc = (content: JSONContent[], settings?: CourseSettings): CourseDoc => ({
  version: COURSE_DOC_VERSION,
  content: { type: 'doc', content },
  ...(settings ? { settings } : {}),
});

export interface BuiltinTemplate {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  build: () => CourseDoc;
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'vierge',
    label: 'Document vierge',
    hint: 'Une page blanche avec un titre',
    emoji: '📄',
    build: emptyCourseDoc,
  },
  {
    id: 'cours',
    label: 'Cours',
    hint: 'Problématique, parties numérotées, définitions et « À retenir »',
    emoji: '📘',
    build: () => doc([
      h(1, 'Titre du chapitre'),
      p(text('Problématique : ', true), italic('la question à laquelle le chapitre répond.')),
      h(2, 'Première partie'),
      p(text('Texte du cours.')),
      callout('definition', p(text('Mot', true), text(' : sa définition.'))),
      h(2, 'Deuxième partie'),
      p(text('Texte du cours.')),
      callout('exemple', p(text('Un exemple.'))),
      h(2, 'Bilan'),
      callout('retenir', p(text('Ce qu’il faut retenir du chapitre.'))),
    ], { numbering: 'roman' }),
  },
  {
    id: 'activite',
    label: 'Fiche d’activité',
    hint: 'Consigne, documents, questions avec des lignes pour répondre',
    emoji: '📝',
    build: () => doc([
      h(1, 'Activité — titre'),
      p(text('Nom : ', true), { type: 'dots', attrs: { cm: 6 } }, text('   Classe : ', true), { type: 'dots', attrs: { cm: 2.5 } }),
      callout('consigne', p(text('Lis les documents puis réponds aux questions.'))),
      h(2, 'Documents'),
      p(italic('Insérez ici un texte, une image, un schéma ou un encart tableau.')),
      h(2, 'Questions'),
      p(text('1. ', true), text('Première question.')),
      zone('lignes', 3),
      p(text('2. ', true), text('Deuxième question.')),
      zone('lignes', 3),
      p(text('3. ', true), text('Troisième question.')),
      zone('lignes', 4),
    ]),
  },
  {
    id: 'activite-cartouche',
    label: 'Fiche à cartouche',
    hint: 'Le cartouche des fiches SVT, situation de départ, rappel, questions, bonus et « J’ai réussi »',
    emoji: '🧪',
    build: () => doc([
      ...activityCartouche(pageGeometry('etroites').colW),
      p(text('Situation de départ : ', true), text('ce que les élèves savent déjà, et la question qui se pose.')),
      fiche('', '#B8860B', p(colored('💡 Rappel : ', '#8B6F00', true), colored('une méthode ou une notion utile pour cette activité.', '#5C4A00'))),
      h(2, 'Questions'),
      question(1, text('À partir du '), text('document 1', true), text(', '), text('explique', true), text(' …')),
      question(2, text('À partir des documents 2 et 3, '), text('explique', true), text(' …')),
      fiche('★ Pour aller plus loin (question expert, bonus)', '#7030A0', p(text('Une question pour aller plus loin.'))),
      fiche('✅ J’ai réussi l’activité si je peux :', '#548235', task('premier objectif ;', 'deuxième objectif ;', 'rédiger des phrases complètes, sans recopier les documents mot à mot.')),
    ], { font: 'Arial, Helvetica, sans-serif', fontSize: 11, firstPageBlank: true, theme: 'fiche', margins: 'etroites' }),
  },
  {
    id: 'evaluation',
    label: 'Évaluation',
    hint: 'Cartouche, exercices avec barème, QCM et compétences évaluées',
    emoji: '✅',
    build: () => doc([
      ...block('cartouche'),
      h(1, 'Évaluation — titre'),
      callout('consigne', p(text('Lis chaque question jusqu’au bout avant de répondre.'))),
      h(2, 'Exercice 1'),
      p(text('Question 1 — ', true), text('Énoncé de la question.'), points(2)),
      zone('pointilles', 3),
      p(text('Question 2 — ', true), text('Énoncé de la question.'), points(3)),
      zone('pointilles', 4),
      h(2, 'Exercice 2'),
      ...block('qcm'),
      h(2, 'Compétences évaluées'),
      ...block('competences'),
    ]),
  },
  {
    id: 'methode',
    label: 'Fiche méthode',
    hint: 'Objectif, étapes numérotées, exemple et pièges à éviter',
    emoji: '🧭',
    build: () => doc([
      h(1, 'Méthode — Comment…'),
      callout('retenir', p(text('Objectif : ', true), text('ce que la méthode permet de faire.'))),
      h(2, 'Les étapes'),
      ol('Première étape.', 'Deuxième étape.', 'Troisième étape.'),
      callout('exemple', p(text('La méthode appliquée à un exemple.'))),
      libre('Les pièges à éviter', '#EF4444', p(text('Une erreur fréquente.'))),
    ]),
  },
  {
    id: 'tp',
    label: 'Compte rendu de TP',
    hint: 'Problème, matériel, protocole, résultats et conclusion',
    emoji: '🔬',
    build: () => doc([
      h(1, 'TP — titre'),
      p(text('Nom : ', true), { type: 'dots', attrs: { cm: 6 } }, text('   Classe : ', true), { type: 'dots', attrs: { cm: 2.5 } }),
      h(2, 'Problème'),
      p(italic('La question à laquelle l’expérience doit répondre.')),
      h(2, 'Hypothèse'),
      zone('lignes', 2),
      h(2, 'Matériel'),
      ul('Matériel 1', 'Matériel 2'),
      h(2, 'Protocole'),
      ol('Première étape.', 'Deuxième étape.', 'Troisième étape.'),
      h(2, 'Résultats'),
      zone('carreaux', 8),
      h(2, 'Conclusion'),
      zone('lignes', 4),
    ], { numbering: 'alpha' }),
  },
];
