/**
 * `npm run screens:check` : contrôle les écrans de cours de `course-drafts/ecrans/*.json` (dossier
 * ignoré par git) et écrit, à côté de chacun, `<nom>.report.txt`. Un fichier sans erreur peut être
 * envoyé par `gc_envoi.py ecrans`. Sans fichier, rien n'est testé (le test passe aussi dans
 * `npm test`). Voir lib/course/screensCheck.ts pour ce qui est contrôlé.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkScreens } from '../../../lib/course/screensCheck';

const DIR = join('course-drafts', 'ecrans');
const drafts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];

describe.runIf(drafts.length > 0)('écrans de cours', () => {
  it.each(drafts)('%s', (file) => {
    const base = join(DIR, file.replace(/\.json$/, ''));
    let content: unknown;
    try { content = JSON.parse(readFileSync(join(DIR, file), 'utf8')); } catch (err) {
      writeFileSync(`${base}.report.txt`, `ERREUR : JSON illisible — ${String(err)}\n`);
      throw new Error(`${file} : JSON illisible — ${String(err)}`);
    }
    const { errors, warnings, pages, objects } = checkScreens(content);
    const lines = [
      `Écrans : ${file}`,
      `${pages} écran${pages > 1 ? 's' : ''}, ${objects} objet${objects > 1 ? 's' : ''}`,
      errors.length ? `${errors.length} ERREUR(S) :` : 'Aucune erreur.',
      ...errors.map((e) => `  ✗ ${e}`),
      ...(warnings.length ? [`${warnings.length} avertissement(s) — à regarder dans l'application :`, ...warnings.map((w) => `  ! ${w}`)] : []),
    ];
    writeFileSync(`${base}.report.txt`, lines.join('\n') + '\n');
    expect(errors, lines.join('\n')).toEqual([]);
  });
});

it.skipIf(drafts.length > 0)('aucun écran dans course-drafts/ecrans/', () => { expect(drafts).toEqual([]); });
