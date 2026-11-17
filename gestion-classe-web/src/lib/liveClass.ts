/**
 * En direct : la logique de la page, hors de l'affichage (fonctions pures, testées dans __tests__/liveClass.test.ts).
 *
 *  - La séance : la plus récente démarrée sur le téléphone, si elle a moins de 2 h 15.
 *  - La liste de la classe : sans élèves supprimés ni témoins, limitée au demi-groupe de la séance.
 *  - Le bandeau : les élèves sans fiche sur la période, les absents notés dans la séance, et ceux qui sont
 *    sortis sans être revenus (motif et heure).
 *  - Les cartes : une par groupe et par patient, tous les patients de la classe ensemble.
 *  - La période « Ce cours » : les groupes actifs depuis le début de l'heure de cours (horaires du collège), et
 *    seulement ceux du demi-groupe quand la séance en a un.
 */
import type { LiveWork } from './liveQueries';
import { resolveSessionRoster } from './sessionRoster';

/**
 * Âge maximal de la séance retenue. Les cours durent 55 min, une double heure jusqu'à 2 h avec la récréation.
 * Au-delà, c'est une séance jamais terminée (téléphone éteint, synchro perdue : 3C du 13/11 restée ouverte des
 * jours) : on ne la prend pas pour le cours en cours. `fetchActiveSession` (6 h) sert l'écran de classe, pas ici.
 */
export const MAX_LIVE_SESSION_MS = 2 * 60 * 60_000 + 15 * 60_000;

/** Une séance terminée reste retenue un quart d'heure : le temps de finir de regarder après la sonnerie. */
export const APRES_FIN_MS = 15 * 60_000;

export interface SeanceLike {
  started_at: string;
  ended_at: string | null;
}

/**
 * La séance du cours en cours parmi celles de l'enseignant, ou null.
 * Seule la dernière démarrée compte : Thomas enchaîne les séances, et une séance fermée en retard (3E du 13/11,
 * fermée quand 3A a démarré) s'efface d'elle-même devant la suivante.
 */
export function choisirSeance<S extends SeanceLike>(seances: S[], maintenant: number): S | null {
  let derniere: S | null = null;
  for (const s of seances) {
    const debut = Date.parse(s.started_at);
    if (Number.isNaN(debut) || debut > maintenant) continue;
    if (!derniere || debut > Date.parse(derniere.started_at)) derniere = s;
  }
  if (!derniere) return null;
  if (maintenant - Date.parse(derniere.started_at) > MAX_LIVE_SESSION_MS) return null;
  if (derniere.ended_at && maintenant - Date.parse(derniere.ended_at) > APRES_FIN_MS) return null;
  return derniere;
}

export interface EleveLike {
  id: string;
  pseudo: string;
}

/**
 * Les élèves suivis : ceux de la classe sans les supprimés ni les témoins, et, si la séance est en demi-groupe,
 * ses seuls membres (règles de lib/sessionRoster.ts).
 */
export function listeDeClasse<E extends EleveLike & { is_deleted?: boolean | null; is_witness?: boolean | null }>(
  eleves: E[],
  groupId: string | null,
  membres: Iterable<string> | null,
): EleveLike[] {
  const classe = eleves.filter((e) => !e.is_deleted && !e.is_witness).map((e) => ({ id: e.id, pseudo: e.pseudo }));
  return resolveSessionRoster({ classStudents: classe, groupId, memberIds: membres }).students;
}

export interface EvenementLike {
  student_id: string;
  type: string;
  subtype: string | null;
  timestamp: string;
}

export interface Bandeau<E extends EleveLike> {
  /** Élèves sans fiche sur la période (ni absents) : à aller voir. */
  pasConnectes: E[];
  /** Notés absents dans la séance. */
  absents: E[];
  /** Sortis (infirmerie, toilettes…) sans retour noté, avec l'heure de la sortie (ms). */
  sortis: { eleve: E; motif: string; depuis: number }[];
}

const MOTIFS_SORTIE: Record<string, string> = {
  infirmerie: 'infirmerie',
  toilettes: 'toilettes',
  vie_scolaire: 'vie scolaire',
};

/**
 * @param eleves la liste de la classe, ou du demi-groupe de la séance
 * @param avecFiche élèves qui ont une fiche sur la période (une fiche par élève, binôme compris)
 * @param evenements événements de la séance (vide sans séance pour cette classe)
 */
export function construireBandeau<E extends EleveLike>(
  eleves: E[],
  avecFiche: Iterable<string>,
  evenements: EvenementLike[],
): Bandeau<E> {
  const connectes = new Set(avecFiche);
  const absents = new Set<string>();
  const sortie = new Map<string, { motif: string; depuis: number } | null>();
  for (const ev of [...evenements].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    if (ev.type === 'absence') absents.add(ev.student_id);
    else if (ev.type === 'sortie') sortie.set(ev.student_id, { motif: MOTIFS_SORTIE[ev.subtype ?? ''] ?? 'sorti', depuis: Date.parse(ev.timestamp) });
    else if (ev.type === 'retour') sortie.set(ev.student_id, null);
  }
  const parNom = [...eleves].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
  return {
    pasConnectes: parNom.filter((e) => !connectes.has(e.id) && !absents.has(e.id)),
    absents: parNom.filter((e) => absents.has(e.id)),
    sortis: parNom.flatMap((e) => {
      const s = sortie.get(e.id);
      return s && !absents.has(e.id) ? [{ eleve: e, ...s }] : [];
    }),
  };
}

/** Élèves qui ont une fiche parmi `works` (une fiche par élève, binôme compris). */
export const elevesAvecFiche = (works: Pick<LiveWork, 'student_id'>[]) => new Set(works.map((w) => w.student_id));

/** « Hôpital virtuel — Eve Amalle » → « Eve Amalle » ; un autre titre reste tel quel. */
export function nomPatient(titre: string | null | undefined): string {
  if (!titre) return 'Activité';
  const i = titre.lastIndexOf(' — ');
  return i >= 0 ? titre.slice(i + 3) : titre;
}

/** Un patient (une activité) en cours. */
export interface Patient {
  id: string;
  key: string;
  nom: string;
}

/** Les patients des fiches, par ordre alphabétique : filtre, bascules de correction, message à la classe. */
export function patientsEnCours(works: LiveWork[]): Patient[] {
  const m = new Map<string, Patient>();
  for (const w of works) {
    if (!m.has(w.activity_id)) m.set(w.activity_id, { id: w.activity_id, key: w.activities?.key ?? '', nom: nomPatient(w.activities?.title) });
  }
  return [...m.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

/**
 * Les heures de cours du collège, en heure locale : les mêmes que l'hôpital (src/classe/horaires.ts de
 * hopital-virtuel, SEANCES).
 */
export const CRENEAUX: readonly (readonly [string, string])[] = [
  ['08:13', '09:10'],
  ['09:10', '10:05'],
  ['10:17', '11:15'],
  ['11:15', '12:10'],
  ['13:37', '14:35'],
  ['14:35', '15:30'],
  ['15:40', '16:35'],
];

/** Marge après la sonnerie : les fiches de l'heure d'avant s'enregistrent encore une minute ou deux. */
export const MARGE_DEBUT_COURS_MS = 2 * 60_000;

/**
 * Début (ms) de l'heure de cours en cours à `maintenant`, en heure locale. Pile à la sonnerie, c'est l'heure qui
 * commence. Hors d'une heure (récréation, midi, soir) : la dernière heure commencée ce jour-là. Avant la première
 * heure du jour : null (la page reprend alors les 2 dernières heures).
 */
export function debutDuCours(maintenant: number): number | null {
  const jour = new Date(maintenant);
  jour.setHours(0, 0, 0, 0);
  let debut: number | null = null;
  for (const [hm] of CRENEAUX) {
    const [h, m] = hm.split(':').map(Number);
    const t = new Date(jour);
    t.setHours(h, m, 0, 0);
    if (t.getTime() <= maintenant) debut = t.getTime();
  }
  return debut;
}

/** Dernier signe de vie d'une fiche (ms) : sa dernière sauvegarde ou le dernier résumé en direct. */
export const derniereActivite = (w: Pick<LiveWork, 'updated_at' | 'direct'>) => Math.max(Date.parse(w.updated_at), w.direct?.t ?? 0);

const cleDuGroupe = (w: Pick<LiveWork, 'activity_id' | 'group_key' | 'id'>) => `${w.activity_id}:${w.group_key ?? w.id}`;

/**
 * Les fiches à afficher, groupe par groupe (un groupe = même patient et même group_key) : on garde toutes les fiches
 * d'un groupe ou aucune.
 *  - `depuis` (ms) : le groupe a eu une activité depuis (le plus récent signe de vie de ses fiches, comme `maj`).
 *  - `membres` : au moins un élève du groupe en fait partie (le demi-groupe de la séance). null : pas de filtre.
 */
export function fichesAffichees<W extends Pick<LiveWork, 'id' | 'activity_id' | 'group_key' | 'student_id' | 'updated_at' | 'direct'>>(
  works: W[],
  filtres: { depuis?: number | null; membres?: ReadonlySet<string> | null },
): W[] {
  const { depuis, membres } = filtres;
  if (depuis == null && !membres) return works;
  const groupes = new Map<string, { maj: number; membre: boolean }>();
  for (const w of works) {
    const cle = cleDuGroupe(w);
    const g = groupes.get(cle) ?? { maj: 0, membre: false };
    g.maj = Math.max(g.maj, derniereActivite(w));
    g.membre ||= !!membres?.has(w.student_id);
    groupes.set(cle, g);
  }
  return works.filter((w) => {
    const g = groupes.get(cleDuGroupe(w))!;
    return (depuis == null || g.maj >= depuis) && (!membres || g.membre);
  });
}

/** Une carte : un groupe (binôme, trio) sur un patient. */
export interface Groupe {
  cle: string;
  noms: string[];
  eleves: string[];
  classId: string | null;
  classe: string;
  activityId: string;
  patient: string;
  /** Dernier signe de vie du groupe (ms). */
  maj: number;
  statut: string;
  /** La fiche la plus récente du groupe. */
  w: LiveWork;
}

/** Un groupe a sans doute besoin du prof : Morel ne l'a pas compris deux fois de suite, ou le labo vient de refuser. */
export const aBesoin = (g: Groupe) => (g.w.direct?.morelIncomprises ?? 0) >= 2 || !!g.w.direct?.dernierRefus;

/**
 * Une carte par groupe et par patient : les membres d'un groupe ont chacun leur fiche, avec le même group_key,
 * et ce group_key se retrouve d'un patient à l'autre. Filtres facultatifs : la classe, le patient ('' = tous).
 * Ordre : les groupes qui ont besoin du prof d'abord, puis les plus récents.
 */
export function regrouperFiches(works: LiveWork[], filtres: { classeId?: string; patient?: string } = {}): Groupe[] {
  const m = new Map<string, Groupe>();
  for (const w of works) {
    if (filtres.classeId && w.class_id !== filtres.classeId) continue;
    if (filtres.patient && w.activity_id !== filtres.patient) continue;
    const cle = cleDuGroupe(w);
    const t = derniereActivite(w);
    const g = m.get(cle);
    const eleves = [...new Set([...(g?.eleves ?? []), w.student_id])];
    if (!g || t > g.maj) {
      const noms = w.direct?.equipe?.length ? w.direct.equipe : w.group_pseudos?.length ? w.group_pseudos : [w.students?.pseudo ?? '?'];
      m.set(cle, { cle, noms, eleves, classId: w.class_id, classe: w.classes?.name ?? '—', activityId: w.activity_id, patient: nomPatient(w.activities?.title), maj: t, statut: w.status, w });
    } else g.eleves = eleves;
  }
  return [...m.values()].sort((a, b) => Number(aBesoin(b)) - Number(aBesoin(a)) || b.maj - a.maj);
}

/**
 * Message à la classe AVEC des points : une ligne live_messages par patient, qui vise par leur id les élèves des
 * groupes affichés sur ce patient (sans class_id). Une ligne « toute la classe » donnerait les points à tout élève
 * qui ouvre ce patient, même un autre jour (student_live_points, migration 069). Un élève qui a une fiche sur deux
 * patients dans la vue n'est visé que sur le plus récent : il prend les points une seule fois.
 */
export function ciblesPoints(groupes: Pick<Groupe, 'activityId' | 'eleves' | 'maj'>[]): { activityId: string; eleves: string[] }[] {
  const dernier = new Map<string, { activityId: string; maj: number }>();
  for (const g of groupes) {
    for (const e of g.eleves) {
      const d = dernier.get(e);
      if (!d || g.maj > d.maj) dernier.set(e, { activityId: g.activityId, maj: g.maj });
    }
  }
  const parPatient = new Map<string, string[]>();
  for (const [e, d] of dernier) parPatient.set(d.activityId, [...(parPatient.get(d.activityId) ?? []), e]);
  return [...parPatient.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([activityId, eleves]) => ({ activityId, eleves: eleves.sort() }));
}
