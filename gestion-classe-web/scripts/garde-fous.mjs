// Garde-fous de structure du code web. Deux règles, toutes deux « à cliquet » :
//
//   1. Aucun fichier de plus de 1 500 lignes ne grossit, et aucun nouveau fichier ne dépasse ce seuil.
//   2. Aucun nouvel accès à la base (supabase.from / rpc / storage / functions) n'est écrit hors de
//      src/lib/ : les pages et les composants passent par une fonction de src/lib/.
//
// L'existant est toléré : il est consigné dans garde-fous.json, et seul ce qui l'aggrave fait
// échouer le contrôle. Quand un fichier maigrit, `npm run garde-fous:maj` abaisse sa ligne.
//
//   node scripts/garde-fous.mjs          vérifie (lancé par `npm test`, donc par chaque PR)
//   node scripts/garde-fous.mjs --maj    réécrit garde-fous.json avec l'état actuel
//
// `--maj` enregistre aussi une hausse : c'est l'issue de secours pour un cas justifié, et elle se
// voit dans la PR (garde-fous.json change). Ne pas s'en servir pour faire passer une régression.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(RACINE, 'src');
const REFERENCE = join(RACINE, 'garde-fous.json');
const SEUIL_LIGNES = 1500;
const ACCES_BASE = /\bsupabase\s*\.\s*(?:from|rpc|storage|functions)\b/g;

function fichiersSource(dossier) {
  const trouves = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (entree.name !== '__tests__') trouves.push(...fichiersSource(chemin));
    } else if (/\.tsx?$/.test(entree.name) && !/\.(test|spec)\.tsx?$/.test(entree.name) && !entree.name.endsWith('.d.ts')) {
      trouves.push(chemin);
    }
  }
  return trouves;
}

function nombreDeLignes(texte) {
  if (texte === '') return 0;
  const lignes = texte.split('\n').length;
  return texte.endsWith('\n') ? lignes - 1 : lignes;
}

function trie(objet) {
  return Object.fromEntries(Object.entries(objet).sort(([a], [b]) => a.localeCompare(b)));
}

function etatActuel() {
  const grosFichiers = {};
  const accesBaseHorsLib = {};
  for (const chemin of fichiersSource(SRC)) {
    const nom = relative(RACINE, chemin).split('\\').join('/');
    const texte = readFileSync(chemin, 'utf8');
    const lignes = nombreDeLignes(texte);
    if (lignes > SEUIL_LIGNES) grosFichiers[nom] = lignes;
    if (!nom.startsWith('src/lib/')) {
      const acces = (texte.match(ACCES_BASE) ?? []).length;
      if (acces > 0) accesBaseHorsLib[nom] = acces;
    }
  }
  return { grosFichiers: trie(grosFichiers), accesBaseHorsLib: trie(accesBaseHorsLib) };
}

function compare(actuel, reference, messageNouveau, messageHausse) {
  const erreurs = [];
  const baisses = [];
  for (const [nom, valeur] of Object.entries(actuel)) {
    const admis = reference[nom];
    if (admis === undefined) erreurs.push(messageNouveau(nom, valeur));
    else if (valeur > admis) erreurs.push(messageHausse(nom, valeur, admis));
    else if (valeur < admis) baisses.push(`${nom} : ${admis} -> ${valeur}`);
  }
  for (const [nom, admis] of Object.entries(reference)) {
    if (actuel[nom] === undefined) baisses.push(`${nom} : ${admis} -> sorti de la liste`);
  }
  return { erreurs, baisses };
}

const actuel = etatActuel();

if (process.argv.includes('--maj')) {
  const contenu = {
    _lire: 'Tolérances des garde-fous de structure (scripts/garde-fous.mjs). Fichier écrit par `npm run garde-fous:maj` ; une valeur qui monte doit être justifiée dans la PR.',
    seuilLignes: SEUIL_LIGNES,
    ...actuel,
  };
  writeFileSync(REFERENCE, `${JSON.stringify(contenu, null, 2)}\n`, 'utf8');
  console.log(`garde-fous.json réécrit : ${Object.keys(actuel.grosFichiers).length} fichiers de plus de ${SEUIL_LIGNES} lignes, ${Object.keys(actuel.accesBaseHorsLib).length} fichiers hors de src/lib/ qui parlent à la base.`);
  process.exit(0);
}

const reference = JSON.parse(readFileSync(REFERENCE, 'utf8'));

const lignes = compare(
  actuel.grosFichiers,
  reference.grosFichiers,
  (nom, valeur) => `${nom} fait ${valeur} lignes : un nouveau fichier ne dépasse pas ${SEUIL_LIGNES} lignes. Le découper (logique dans src/lib/, sous-composants à part).`,
  (nom, valeur, admis) => `${nom} est passé de ${admis} à ${valeur} lignes : un fichier de plus de ${SEUIL_LIGNES} lignes ne grossit pas. Sortir du code de ce fichier avant d'en ajouter.`,
);
const acces = compare(
  actuel.accesBaseHorsLib,
  reference.accesBaseHorsLib,
  (nom, valeur) => `${nom} parle à la base (${valeur} appel(s) supabase) alors qu'il est hors de src/lib/. Écrire la requête dans une fonction de src/lib/ et l'appeler d'ici.`,
  (nom, valeur, admis) => `${nom} est passé de ${admis} à ${valeur} appels supabase directs. Écrire la nouvelle requête dans une fonction de src/lib/.`,
);

const erreurs = [...lignes.erreurs, ...acces.erreurs];
const baisses = [...lignes.baisses, ...acces.baisses];

if (erreurs.length > 0) {
  console.error('Garde-fous de structure : contrôle en échec.\n');
  for (const erreur of erreurs) console.error(`  - ${erreur}`);
  console.error('\nCas justifié (rare) : `npm run garde-fous:maj`, et dire pourquoi dans la PR.');
  process.exit(1);
}

console.log(`Garde-fous de structure : conformes (${Object.keys(actuel.grosFichiers).length} gros fichiers tolérés, ${Object.keys(actuel.accesBaseHorsLib).length} fichiers hors de src/lib/ qui parlent à la base).`);
if (baisses.length > 0) {
  console.log('Progrès à enregistrer par `npm run garde-fous:maj` :');
  for (const baisse of baisses) console.log(`  - ${baisse}`);
}
