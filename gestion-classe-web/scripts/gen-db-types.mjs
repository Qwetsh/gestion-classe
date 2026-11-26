// Génère src/lib/database.types.ts : la description de la base, lue par TypeScript.
//
//   npm run db:types            (demande d'être connecté : `npx supabase login`)
//
// Le client Supabase (src/lib/supabase.ts) est créé avec ce type. Une table, une colonne ou une
// fonction mal nommée dans une requête devient alors une erreur de compilation, au lieu d'une
// erreur chez l'utilisateur.
//
// Le projet Supabase est partagé avec d'autres applications, et ce dépôt est public : on ne garde
// que les tables, vues et fonctions que le code de src/ utilise (`.from('…')`, `.rpc('…')`).
// Conséquence : après avoir écrit une requête sur une table ou une fonction encore jamais utilisée,
// ou après une migration, relancer `npm run db:types`.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RACINE, 'src');
const SORTIE = join(SRC, 'lib', 'database.types.ts');
const PROJET = 'djodkjysovalpufgevrr';
const VERSION_CLI = '3.4.0';
// Colonnes obligatoires que la base remplit elle-même par un déclencheur : le générateur les
// croit requises à l'insertion, on les y rend facultatives.
const REMPLIES_PAR_LA_BASE = { students: ['identity_id'] };

function fichiersSource(dossier) {
  const trouves = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) trouves.push(...fichiersSource(chemin));
    else if (/\.tsx?$/.test(entree.name) && chemin !== SORTIE) trouves.push(chemin);
  }
  return trouves;
}

/** Noms passés à `.from(…)` ou `.rpc(…)` quelque part dans src/. */
function nomsUtilises() {
  const noms = new Set();
  const motif = /\.(?:from|rpc)\(\s*['"`]([a-z_0-9]+)['"`]/g;
  for (const chemin of fichiersSource(SRC)) {
    for (const trouve of readFileSync(chemin, 'utf8').matchAll(motif)) noms.add(trouve[1]);
  }
  return noms;
}

/** Rend facultatives, dans le bloc `Insert` de leur table, les colonnes remplies par la base. */
function assouplit(texte) {
  let sortie = texte;
  for (const [table, colonnes] of Object.entries(REMPLIES_PAR_LA_BASE)) {
    const debut = sortie.indexOf(`\n      ${table}: {\n`);
    const insert = debut < 0 ? -1 : sortie.indexOf('\n        Insert: {\n', debut);
    const fin = insert < 0 ? -1 : sortie.indexOf('\n        }\n', insert);
    if (fin < 0) continue;
    let bloc = sortie.slice(insert, fin);
    for (const colonne of colonnes) bloc = bloc.replace(`\n          ${colonne}: `, `\n          ${colonne}?: `);
    sortie = sortie.slice(0, insert) + bloc + sortie.slice(fin);
  }
  return sortie;
}

/** Retire des sections Tables, Views et Functions les entrées dont le nom n'est pas utilisé. */
function elague(texte, utilises) {
  const lignes = texte.split('\n');
  const sortie = [];
  const bilan = { Tables: [0, 0], Views: [0, 0], Functions: [0, 0] };
  let section = null;
  let garde = true;
  for (const ligne of lignes) {
    const debutSection = ligne.match(/^    (Tables|Views|Functions|Enums|CompositeTypes): /);
    if (debutSection) {
      section = bilan[debutSection[1]] ? debutSection[1] : null;
      garde = true;
      sortie.push(ligne);
      continue;
    }
    if (section && /^    \}/.test(ligne)) {
      section = null;
      garde = true;
      sortie.push(ligne);
      continue;
    }
    if (section) {
      const entree = ligne.match(/^      ([a-z_0-9]+):/);
      if (entree) {
        garde = utilises.has(entree[1]);
        bilan[section][garde ? 0 : 1] += 1;
      }
    }
    if (garde) sortie.push(ligne);
  }
  return { texte: sortie.join('\n'), bilan };
}

const brut = execFileSync(
  'npx',
  ['--yes', `supabase@${VERSION_CLI}`, 'gen', 'types', 'typescript', '--project-id', PROJET, '--schema', 'public'],
  { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
);
if (!brut.includes('export type Database')) {
  console.error('La commande supabase n’a pas rendu de types. Es-tu connecté (`npx supabase login`) ?');
  process.exit(1);
}

const { texte, bilan } = elague(brut.replace(/\r\n/g, '\n'), nomsUtilises());
const entete = [
  '// Fichier généré par `npm run db:types` (scripts/gen-db-types.mjs). Ne pas le modifier à la main.',
  '// Description de la base, limitée aux tables, vues et fonctions utilisées par src/.',
  '',
].join('\n');
writeFileSync(SORTIE, entete + assouplit(texte).trimEnd() + '\n', 'utf8');

for (const [section, [gardees, retirees]] of Object.entries(bilan)) {
  console.log(`${section} : ${gardees} gardées, ${retirees} retirées (non utilisées par src/).`);
}
console.log(`Écrit : ${SORTIE}`);
