/**
 * `npm run course:check` (lot Q3) : contrôle les brouillons de cours de `course-drafts/*.json`
 * (dossier ignoré par git) et, pour chacun sans erreur, écrit `<nom>.sql`, la requête qui crée le
 * cours. Le compte propriétaire est lu dans `course-drafts/owner.txt` (identifiant Supabase).
 * Sans brouillon, rien n'est testé (le test passe aussi dans `npm test`).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSchema } from '@tiptap/core';
import { courseExtensions } from '../courseExtensions';
import { checkCourseDraft, draftInsertSQL, type CourseDraft } from '../courseCheck';
import { COURSE_ICONS } from '../courseIconSet';

const DIR = 'course-drafts';
const drafts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
const owner = existsSync(join(DIR, 'owner.txt')) ? readFileSync(join(DIR, 'owner.txt'), 'utf8').trim() : '';

const noop = () => undefined;
const schema = getSchema(courseExtensions(noop, { boardId: '', onEdit: noop }, noop, { getMode: () => 'adapt', onDroppedImages: noop, onDuplicateEncart: noop, onImageFiles: noop }));

describe.runIf(drafts.length > 0)('brouillons de cours', () => {
  it.each(drafts)('%s', (file) => {
    const base = join(DIR, file.replace(/\.json$/, ''));
    let draft: CourseDraft;
    try { draft = JSON.parse(readFileSync(join(DIR, file), 'utf8')) as CourseDraft; } catch (err) {
      writeFileSync(`${base}.report.txt`, `ERREUR : JSON illisible — ${String(err)}\n`);
      throw new Error(`${file} : JSON illisible — ${String(err)}`);
    }
    const { errors, warnings, words = 0 } = checkCourseDraft(schema, draft, new Set(COURSE_ICONS.map((i) => i.name)));
    const lines = [
      `Brouillon : ${file}`,
      `Titre : ${draft.title}`,
      `Longueur : ${words} mots${words > 300 ? ' — une fiche avec cartouche passe sur deux pages au-delà de 300 mots environ' : ''}`,
      errors.length ? `${errors.length} ERREUR(S) :` : 'Aucune erreur.',
      ...errors.map((e) => `  ✗ ${e}`),
      ...(warnings.length ? [`${warnings.length} avertissement(s) :`, ...warnings.map((w) => `  ! ${w}`)] : []),
    ];
    if (!errors.length) {
      if (owner) { writeFileSync(`${base}.sql`, draftInsertSQL(draft, owner) + '\n'); lines.push(`Requête prête : ${base}.sql`); }
      else lines.push(`Pas de requête : écrire l'identifiant du compte dans ${DIR}/owner.txt`);
    }
    writeFileSync(`${base}.report.txt`, lines.join('\n') + '\n');
    expect(errors, lines.join('\n')).toEqual([]);
  });
});

it.skipIf(drafts.length > 0)('aucun brouillon dans course-drafts/', () => { expect(drafts).toEqual([]); });
