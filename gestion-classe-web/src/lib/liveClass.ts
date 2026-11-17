/**
 * En direct : à quel cours se rapporte la page (fonctions pures, testées dans __tests__/liveClass.test.ts).
 *
 *  - La séance : la plus récente démarrée sur le téléphone, si elle a moins de 2 h 15.
 *  - Le bandeau : les élèves de la classe (ou du demi-groupe) sans fiche sur la période, les absents
 *    notés dans la séance, et ceux qui sont sortis sans être revenus.
 */

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
  /** Sortis (infirmerie, toilettes…) sans retour noté. */
  sortis: { eleve: E; motif: string }[];
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
  const sortie = new Map<string, string | null>();
  for (const ev of [...evenements].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))) {
    if (ev.type === 'absence') absents.add(ev.student_id);
    else if (ev.type === 'sortie') sortie.set(ev.student_id, ev.subtype ?? 'autre');
    else if (ev.type === 'retour') sortie.set(ev.student_id, null);
  }
  const parNom = [...eleves].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
  return {
    pasConnectes: parNom.filter((e) => !connectes.has(e.id) && !absents.has(e.id)),
    absents: parNom.filter((e) => absents.has(e.id)),
    sortis: parNom
      .filter((e) => !absents.has(e.id) && sortie.get(e.id))
      .map((e) => ({ eleve: e, motif: MOTIFS_SORTIE[sortie.get(e.id) as string] ?? 'sorti' })),
  };
}

/** « Hôpital virtuel — Eve Amalle » → « Eve Amalle » ; un autre titre reste tel quel. */
export function nomPatient(titre: string | null | undefined): string {
  if (!titre) return 'Activité';
  const i = titre.lastIndexOf(' — ');
  return i >= 0 ? titre.slice(i + 3) : titre;
}
