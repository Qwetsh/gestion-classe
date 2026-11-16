/**
 * Annales (page `/brevets`) : rangement des sujets comme « Mes cours » — une matière à la fois,
 * des sections repliables, une ligne par sujet. Fonctions pures, sans accès à la base.
 *
 * En SVT, les sujets se rangent par thème du programme du cycle 4 (on cherche un sujet pour le
 * chapitre en cours) ; dans les autres matières, par session.
 */
import type { Brevet, Matiere } from './brevets';
import { naturalCompare } from './courseLibrary';
import { tpSearchWords } from './tpLibrary';

/** Ordre des onglets : la matière de Thomas d'abord. */
export const MATIERES: Matiere[] = ['SVT', 'Physique-Chimie', 'Maths', 'Français', 'Histoire-Géo-EMC'];

export type Programme = 'planete' | 'vivant' | 'corps';

export const PROGRAMMES: { key: Programme; label: string }[] = [
  { key: 'planete', label: 'Planète Terre, environnement et action humaine' },
  { key: 'vivant', label: 'Le vivant et son évolution' },
  { key: 'corps', label: 'Le corps humain et la santé' },
];

/**
 * Thème principal de chaque sujet SVT du catalogue, d'après son contenu (questions lues dans le
 * PDF quand le titre ne suffisait pas). Un sujet ajouté depuis l'app porte le sien en base.
 */
const SVT_PROGRAMME: Record<string, Programme> = {
  '26GENSCAA1': 'planete', // îlot de chaleur urbain
  '26GENSCAN1': 'vivant', // syndrome du museau blanc
  '26GENSCMEAG1': 'planete', // réchauffement et inondation
  '25GENSCAN1': 'planete', // vers de terre, sol et pratiques agricoles
  '25GENSCAA1': 'planete', // volcans, énergie
  '25GENSCMEAG1': 'planete', // doryphores et cultures
  '25GENSCPO1': 'planete', // pêche durable
  '24GENSCAN1': 'vivant', // oiseaux-éléphants
  '24GENSCG11': 'corps', // paludisme
  '24GENSCPO1': 'vivant', // pucerons et plantes
  '24GENSCPO3': 'planete', // coquille Saint-Jacques : pêche
  '23GENSCAN1': 'vivant', // maïs : nutrition de la plante, sol compacté
  '23GENSCAA1': 'planete', // Chili, séismes
  '23GENSCG11': 'planete', // El Niño
  '23GENSCMEAG1': 'vivant', // idotée et algue rouge
  '23GENSCMEAG3': 'vivant', // phénylcétonurie (génétique)
  '23GENSCNC1': 'planete', // surpêche
  '23GENSCPO1': 'vivant', // spiruline : classification, culture
  '23GENSCPO3': 'planete', // risque cyclonique
  '22GENSCAN1': 'planete', // tsunami
  '22GENSCAS1': 'vivant', // évolution des pins
  '22GENSCAA1': 'planete', // coccinelle asiatique introduite
  '22GENSCG11': 'planete', // gobemouche et changement climatique
  '22GENSCMEAG2': 'vivant', // récifs coralliens, symbiose
  '22GENSCMEAG1': 'vivant', // tortues, sexe et température
  '22GENSCMEAG3': 'corps', // IST
  '22GENSCNC1': 'vivant', // blanchissement des coraux
  '22GENSCPO1': 'corps', // testostérone
  '22GENSCPO3': 'vivant', // scolytes : sève, xylème, phloème
  '21GENSCAN1': 'corps', // fertilité, PMA
  '21GENSCAA1': 'planete', // sol salé
  '21GENSCMEAG1': 'vivant', // photosynthèse
  '21GENSCMEAG3': 'planete', // séisme
};

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const GUESS: [Programme, RegExp][] = [
  ['corps', /sante|\bist\b|hormon|fertilit|contracep|puberte|vaccin|immun|nerv|muscle|sommeil|digest|sang|microbiote|alimentation humaine|tabac|alcool/],
  ['planete', /seism|volcan|tsunami|climat|cyclon|meteo|\bsols?\b|peche|ressource|energie|inondation|risque|pollution|eau potable|agricult/],
  ['vivant', /evolution|espece|genet|reproduction|photosynth|cellule|adn|biodiversit|plante|parente|fossil/],
];

/** Thème du programme deviné d'après le titre ; null si rien ne permet de trancher. */
export function guessProgramme(title: string): Programme | null {
  const t = fold(title);
  for (const [key, re] of GUESS) if (re.test(t)) return key;
  return null;
}

/** Ce qu'il faut d'un sujet pour le ranger (statique ou ajouté). */
export type AnnaleItem = Brevet & { programme?: Programme | null };

export const matiereOf = (b: Brevet): Matiere => b.matiere ?? 'SVT';

export function programmeOf(b: AnnaleItem): Programme | null {
  return b.programme ?? SVT_PROGRAMME[b.code] ?? guessProgramme(b.theme);
}

const MATIERE_PREFIX = /^(mathematiques|histoire-geo-emc|physique-chimie|francais|svt)\b\s*/;

/**
 * Titre et précision d'une ligne. En SVT le titre du sujet dit tout ; ailleurs le catalogue n'a
 * qu'un intitulé générique (« Mathématiques · juin »), donc le centre devient le titre et le reste
 * (« compréhension · juin ») la précision.
 */
export function annaleLabel(b: Brevet): { title: string; detail: string } {
  const theme = b.theme.trim();
  const folded = fold(theme);
  if (!MATIERE_PREFIX.test(folded)) return { title: theme, detail: b.centre };
  const cut = folded.match(MATIERE_PREFIX)?.[0].length ?? 0;
  const rest = theme.slice(cut).replace(/^[·\s-]+/, '').trim();
  return { title: b.centre || theme, detail: rest };
}

/** Recherche : chaque mot doit se trouver dans le titre, le centre, le code ou l'année. */
export function filterAnnales<T extends Brevet>(items: T[], query: string): T[] {
  const words = tpSearchWords(query);
  if (words.length === 0) return items;
  return items.filter((b) => {
    const hay = fold(`${b.theme} ${b.centre} ${b.code} ${b.annee}`);
    return words.every((w) => hay.includes(w));
  });
}

export interface AnnaleSection<T> {
  key: string;
  label: string;
  items: T[];
}

export type AnnaleView = 'programme' | 'session';

const bySessionThenCentre = (a: Brevet, b: Brevet) =>
  b.annee - a.annee || naturalCompare(a.centre, b.centre) || naturalCompare(a.theme, b.theme);

/**
 * Sections d'une matière. `programme` : les trois thèmes dans l'ordre du programme, puis « À
 * classer » ; sujets du plus récent au plus ancien. `session` : une section par année, la plus
 * récente d'abord ; sujets par centre.
 */
export function groupAnnales<T extends AnnaleItem>(items: T[], view: AnnaleView): AnnaleSection<T>[] {
  const sorted = [...items].sort(bySessionThenCentre);
  if (view === 'programme') {
    const sections = [...PROGRAMMES.map((p) => ({ key: p.key as string, label: p.label })), { key: 'autre', label: 'À classer' }]
      .map((s) => ({ ...s, items: sorted.filter((b) => (programmeOf(b) ?? 'autre') === s.key) }));
    return sections.filter((s) => s.items.length > 0);
  }
  const years = Array.from(new Set(sorted.map((b) => b.annee)));
  return years.map((y) => ({ key: String(y), label: `Session ${y}`, items: sorted.filter((b) => b.annee === y) }));
}
