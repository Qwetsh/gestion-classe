/**
 * Version couleur au format téléphone d'un document imprimé (QR code de la première page) : ce que
 * le serveur a le droit de rendre. Fonctions pures, sans dépendance (lues aussi par le navigateur
 * du professeur et par ses tests : gestion-classe-web/src/lib/mobileVersion.ts, src/lib/__tests__).
 *
 *  - Jamais une correction, une copie modèle ni une évaluation : les réponses ne doivent pas être
 *    accessibles par un lien. Le titre est relu à chaque appel : un cours renommé après coup
 *    « … (correction) » n'est plus servi, même si son jeton existe.
 *  - D'un cours, seuls le texte et sa mise en page sortent : jamais ses écrans (les corrections
 *    projetées en classe), ses liens vers un site ou une app, ni les annotations du professeur.
 *    Les encarts (pages de tableau blanc), les zones d'écriture et les pointillés de réponse
 *    restent sur le serveur : ils ne servent à rien sur un téléphone.
 */

/** Jeton d'un lien : 20 caractères base64url (120 bits) à la création, jusqu'à 64 acceptés. */
export const MOBILE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Correction, corrigé, copie modèle ou évaluation, où que ce soit dans le titre (« (correction) » compris). */
const ANSWERS = /corr(?:ection|ig[ée])|copie\s+mod[èe]le|[ée]valuation/iu;

/** Autres noms d'un devoir noté, au début du titre : « Entraînement noté — … », « Contrôle — … », « DS 2 ». */
const GRADED = /^\s*(?:entra[îi]nements?\s+not[ée]s?|contr[ôo]les?|interro(?:gation)?s?|devoirs?\s+surveill[ée]s?|ds)(?![\p{L}])/iu;

/**
 * Le document de ce titre peut-il avoir une version téléphone ? Oui pour une fiche d'activité, ses
 * documents, ses extraits, sa fiche protocole, sa version adaptée, une fiche méthode ou un cours ;
 * non pour une correction, une copie modèle (les réponses d'un élève) ou une évaluation (sujet,
 * documents ou corrigé). Dans le doute, non : un titre qui parle de correction n'a pas de lien.
 */
export function mobileEligible(rawTitle: string): boolean {
  const title = rawTitle.normalize('NFC');
  return !ANSWERS.test(title) && !GRADED.test(title);
}

/** Copie modèle (les réponses d'un élève), où que ce soit dans le titre. */
const NEVER_SHARED = /copie\s+mod[èe]le/iu;

/**
 * Le document de ce titre peut-il sortir par un lien de partage (table `board_share_links`,
 * migration 092 : le lien que le professeur colle dans le cahier de texte) ? Oui pour tout ce que
 * le professeur choisit de donner : fiche, documents, correction d'activité (Thomas, 26/11/2026),
 * et aussi évaluation, entraînement noté ou devoir, sujet comme corrigé (Thomas, 27/11/2026 :
 * donner la correction de l'entraînement noté des 3e par Pronote). Le lien n'existe que si le
 * professeur le crée, document par document. Jamais une copie modèle : ce sont les réponses d'un
 * élève. Le QR code imprimé, lui, reste fermé aux corrections et aux évaluations (mobileEligible).
 */
export function shareEligible(rawTitle: string): boolean {
  return !NEVER_SHARED.test(rawTitle.normalize('NFC'));
}

/** Les deux sortes de liens : le QR code imprimé (090) et le lien de partage (092). */
export type LinkKind = 'qr' | 'share';

/** Le document de ce titre peut-il sortir par un lien de cette sorte ? */
export function linkEligible(kind: LinkKind, title: string): boolean {
  return kind === 'share' ? shareEligible(title) : mobileEligible(title);
}

/** Un cours désigné par son identifiant et son titre (relu en base au moment du choix). */
export interface CourseRef { id: string; title: string }

/**
 * Le document vers lequel pointe un lien de cette sorte : QR code imprimé (`qr`) ou lien de
 * partage collé dans le cahier de texte (`share`, qui peut aussi ouvrir une correction ou une
 * évaluation).
 * Toujours l'original de la bibliothèque : une copie posée pour une classe
 * (`lesson_boards.source_board_id`) renvoie à son original ; un original introuvable (supprimé
 * depuis) laisse la copie servir elle-même. Null si le cours ou son original ne peut pas sortir
 * par ce lien. Sert aussi au dépôt d'une version sur mesure (depot-cours, action "mobile").
 */
export function linkTarget(kind: LinkKind, course: CourseRef, original: CourseRef | null): string | null {
  if (!linkEligible(kind, course.title)) return null;
  if (original && original.id !== course.id) return linkEligible(kind, original.title) ? original.id : null;
  return course.id;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Nœuds qui ne sortent pas : encarts (tableau blanc), zones d'écriture, pointillés de réponse. */
const DROPPED = new Set(['encart', 'writingZone', 'dots']);
/**
 * Lien de partage : la fiche doit pouvoir s'imprimer telle qu'elle est distribuée, zones d'écriture
 * et pointillés compris (elles sont vides : les réponses d'un élève sont dans la copie modèle, qui
 * ne sort jamais). Les encarts restent sur le serveur.
 */
const DROPPED_SHARE = new Set(['encart']);

/** Profondeur au-delà de laquelle un document n'est pas relu en entier (on ne sert pas ce qu'on n'a pas vu). */
const MAX_DEPTH = 60;

/** Copie d'un nœud sans les nœuds retirés ; null si le document est trop profond. */
function prune(node: Record<string, unknown>, depth: number, dropped: Set<string>): Record<string, unknown> | null {
  if (depth > MAX_DEPTH) return null;
  if (!Array.isArray(node.content)) return { ...node };
  const content: unknown[] = [];
  for (const child of node.content) {
    if (!isRecord(child)) continue;
    if (typeof child.type === 'string' && dropped.has(child.type)) continue;
    const kept = prune(child, depth + 1, dropped);
    if (!kept) return null;
    content.push(kept);
  }
  // Un bloc vidé par le retrait (encadré qui ne portait qu'une zone d'écriture) garde un paragraphe :
  // le schéma de l'éditeur refuse certains conteneurs vides
  if (content.length === 0 && node.content.length > 0 && node.type !== 'paragraph' && node.type !== 'heading') content.push({ type: 'paragraph' });
  return { ...node, content };
}

/**
 * Ce qui sort d'un cours pour le téléphone : le texte et sa mise en page, sans encarts, zones
 * d'écriture ni pointillés (lien de partage : zones et pointillés gardés, pour imprimer la fiche).
 * Les écrans, les liens vers un site, le calque d'annotations et le numéro
 * d'enregistrement restent sur le serveur. Null : pas un cours rédigé, ou trop profond pour être
 * relu en entier.
 */
export function mobileDoc(doc: unknown, kind: LinkKind = 'qr'): { version: number; content: Record<string, unknown>; settings?: Record<string, unknown> } | null {
  if (!isRecord(doc) || typeof doc.version !== 'number' || !isRecord(doc.content)) return null;
  const content = prune(doc.content, 0, kind === 'share' ? DROPPED_SHARE : DROPPED);
  if (!content) return null;
  return isRecord(doc.settings)
    ? { version: doc.version, content, settings: doc.settings }
    : { version: doc.version, content };
}
