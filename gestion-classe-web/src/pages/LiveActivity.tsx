import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LegendeCases } from '../components/live/BandeCases';
import { CarteGroupe } from '../components/live/CarteGroupe';
import { EN_LIGNE_MS, heure, nomsDuGroupe, type ActionsGroupe, type GroupeAffiche } from '../components/live/commun';
import { IconeActualiser } from '../components/live/Icones';
import { PanneauMessage } from '../components/live/PanneauMessage';
import { TableauClasse } from '../components/live/TableauClasse';
import { VueGroupe } from '../components/live/VueGroupe';
import { AnimatedCorrectionToggle } from '../components/productions/AnimatedCorrectionToggle';
import { useAuth } from '../hooks/useAuth';
import { hasAnimatedCorrection } from '../lib/animatedCorrection';
import {
  bandeDeCases,
  lectures,
  legendeCarnet,
  minutesRestantes,
  raisonAVoir,
  texteLectures,
  type QuestionCarnet,
} from '../lib/liveCarnet';
import {
  ciblesPoints,
  construireBandeau,
  debutDuCours,
  elevesAvecFiche,
  fichesAffichees,
  MARGE_DEBUT_COURS_MS,
  patientsEnCours,
  regrouperFiches,
  type Bandeau,
  type EvenementLike,
  type Patient,
} from '../lib/liveClass';
import {
  ecrirePoints,
  fetchActivitiesPoints,
  fetchLiveRoster,
  fetchLiveSession,
  fetchLiveWorks,
  fetchPresenceEvents,
  fetchQuestionsCarnet,
  fetchSentMessages,
  pointsDe,
  sendLiveMessage,
  type LiveMessage,
  type LiveSession,
  type LiveStudent,
  type LiveWork,
} from '../lib/liveQueries';
import { fetchClassesForUser, type ClassInfo } from '../lib/liveSessionQueries';
import '../styles/en-direct.css';

/**
 * En direct : pendant le cours, où en sont les groupes de la classe sur les activités numériques (Hôpital virtuel,
 * un patient par activité). Téléphone : la classe en cartes, avec une bande de cases par carnet ; ordinateur
 * (≥ 1024 px) : un tableau de la classe, question par question. Un clic sur un groupe ouvre son carnet complet.
 * Se met à jour toute seule (lib/liveQueries.ts : le résumé `_direct`).
 *
 * La classe est choisie d'office d'après la séance lancée sur le téléphone (lib/liveClass.ts) ; la logique
 * d'affichage d'un groupe est dans lib/liveCarnet.ts.
 */

const RAFRAICHIR = 15_000;
const ORDINATEUR = '(min-width: 1024px)';

/**
 * En développement seulement : `?instant=2026-11-12T14:50` rejoue la page à ce moment-là (séance, fiches),
 * pour vérifier sur un vrai cours passé. Rien ne part alors vers les élèves.
 */
function useInstant(): number | null {
  const [params] = useSearchParams();
  if (!import.meta.env.DEV) return null;
  const t = Date.parse(params.get('instant') ?? '');
  return Number.isNaN(t) ? null : t;
}

function useEcranLarge(): boolean {
  return useSyncExternalStore(
    (rappel) => {
      const m = window.matchMedia(ORDINATEUR);
      m.addEventListener('change', rappel);
      return () => m.removeEventListener('change', rappel);
    },
    () => window.matchMedia(ORDINATEUR).matches,
    () => false,
  );
}

const prenom = (patient: string) => patient.split(' ')[0] || patient;

/**
 * Début de la période affichée (ms). « Ce cours » : la sonnerie de l'heure en cours + 2 min, ou les 2 dernières heures
 * avant la première heure du jour. Sinon, les n dernières minutes.
 */
function seuilDeLaPeriode(periode: 'cours' | number, maintenant: number): number {
  if (periode === 'cours') {
    const debut = debutDuCours(maintenant);
    return debut != null ? debut + MARGE_DEBUT_COURS_MS : maintenant - 120 * 60_000;
  }
  return maintenant - periode * 60_000;
}

export function LiveActivity() {
  const { user } = useAuth();
  const instant = useInstant();
  const ordi = useEcranLarge();
  const [params, setParams] = useSearchParams();
  const [works, setWorks] = useState<LiveWork[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maj, setMaj] = useState<number>(0);
  const [horloge, setHorloge] = useState(() => Date.now());
  const maintenant = instant ?? horloge;
  // la séance du téléphone (undefined : pas encore lue)
  const [seance, setSeance] = useState<LiveSession | null | undefined>(undefined);
  // les choix faits à la main, valables pour la séance pendant laquelle ils ont été faits : le cours suivant
  // (une nouvelle séance) reprend la main. classe : '' = toutes les classes ; patient : '' = tous.
  const [choix, setChoix] = useState<{ seanceId: string | null; classe?: string; patient?: string }>({ seanceId: null });
  const [changer, setChanger] = useState(false);
  const [mesClasses, setMesClasses] = useState<ClassInfo[]>([]);
  // 'cours' : depuis le début de l'heure de cours (+ 2 min) ; sinon un nombre de minutes
  const [periode, setPeriode] = useState<'cours' | number>('cours');
  // à qui écrire : un groupe (sur son patient), ou toute la classe sur les patients affichés (null = panneau fermé)
  const [cible, setCible] = useState<{ libelle: string; eleves: string[] | null; points?: number; activites: Patient[] } | null>(null);
  const [pointsDonnes, setPointsDonnes] = useState<LiveMessage[]>([]);
  const [envoyes, setEnvoyes] = useState<LiveMessage[]>([]);
  const [questionsCarnet, setQuestionsCarnet] = useState<Record<string, QuestionCarnet[]>>({});
  // chargés pour une classe (et un demi-groupe) / une séance donnée : `cle` dit pour laquelle
  const [rosterLu, setRosterLu] = useState<{ cle: string; eleves: LiveStudent[] } | null>(null);
  const [evenementsLus, setEvenementsLus] = useState<{ cle: string; evenements: EvenementLike[] } | null>(null);
  const basMorel = useRef<HTMLElement>(null);

  const chargerEnvoyes = useCallback(async () => {
    try {
      setEnvoyes(await fetchSentMessages(60));
    } catch {
      /* table absente ou réseau : la liste reste vide */
    }
  }, []);
  useEffect(() => { void chargerEnvoyes(); }, [chargerEnvoyes, maj]);

  useEffect(() => {
    if (!user) return;
    fetchClassesForUser(user.id).then(setMesClasses).catch(() => { /* la liste se contente des classes des fiches */ });
  }, [user]);

  const charger = useCallback(async () => {
    const t = instant ?? Date.now();
    const seuil = seuilDeLaPeriode(periode, t);
    try {
      const [w, s] = await Promise.all([
        fetchLiveWorks(Math.max(0, Math.ceil((t - seuil) / 60_000)), t),
        // séance illisible (réseau) : on garde la précédente plutôt que de perdre le choix de la classe
        user ? fetchLiveSession(user.id, t).catch(() => undefined) : Promise.resolve(null),
      ]);
      setWorks(w);
      if (s !== undefined) setSeance(s);
      setErreur(null);
      setMaj(Date.now());
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, [periode, instant, user]);

  useEffect(() => {
    void charger();
    const id = window.setInterval(() => {
      if (!document.hidden) void charger();
      setHorloge(Date.now());
    }, RAFRAICHIR);
    return () => window.clearInterval(id);
  }, [charger]);

  const seanceId = seance?.id ?? null;
  const choixValide = choix.seanceId === seanceId ? choix : { seanceId };
  const classeId = choixValide.classe ?? seance?.class_id ?? '';
  const patient = choixValide.patient ?? '';
  const choisirClasse = (classe: string) => setChoix({ seanceId, classe });
  const choisirPatient = (p: string) => setChoix({ ...choixValide, patient: p });
  const seanceDeLaClasse = seance && seance.class_id === classeId ? seance : null;

  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of mesClasses) m.set(c.id, c.name);
    for (const w of works) if (w.class_id) m.set(w.class_id, w.classes?.name ?? m.get(w.class_id) ?? '—');
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr', { numeric: true }));
  }, [mesClasses, works]);
  const nomClasse = classes.find(([id]) => id === classeId)?.[1] ?? '';

  // la liste de la classe, ou du demi-groupe de la séance : le bandeau, et le filtre des cartes par membres
  const groupeSeance = seanceDeLaClasse?.group_id ?? null;
  const cleRoster = classeId ? `${classeId}:${groupeSeance ?? ''}` : '';
  useEffect(() => {
    if (!classeId) return;
    let annule = false;
    fetchLiveRoster(classeId, groupeSeance)
      .then((eleves) => { if (!annule) setRosterLu({ cle: `${classeId}:${groupeSeance ?? ''}`, eleves }); })
      .catch(() => { /* réseau : pas de bandeau */ });
    return () => { annule = true; };
  }, [classeId, groupeSeance]);
  const roster = cleRoster && rosterLu?.cle === cleRoster ? rosterLu.eleves : null;

  // les fiches de la classe choisie, tous patients confondus, de la période (« Ce cours » : depuis la sonnerie + 2 min).
  // Séance d'un demi-groupe : seulement les groupes où il y a au moins un de ses membres (liste pas encore lue : tous).
  const seuil = seuilDeLaPeriode(periode, maintenant);
  const membres = useMemo(() => (groupeSeance && roster ? new Set(roster.map((e) => e.id)) : null), [groupeSeance, roster]);
  const worksClasse = useMemo(
    () => fichesAffichees(classeId ? works.filter((w) => w.class_id === classeId) : works, { depuis: seuil, membres }),
    [works, classeId, seuil, membres],
  );

  // les patients en cours dans la classe : filtre, bascules de correction, message à la classe
  const activites = useMemo(() => patientsEnCours(worksClasse), [worksClasse]);
  const filtre = activites.some((a) => a.id === patient) ? patient : '';
  const activitesAffichees = filtre ? activites.filter((a) => a.id === filtre) : activites;

  // les questions du carnet de chaque patient (definition.questions), lues une fois
  const idsPatients = useMemo(() => [...new Set(works.map((w) => w.activity_id))].sort().join(','), [works]);
  useEffect(() => {
    const manquants = idsPatients ? idsPatients.split(',').filter((id) => !(id in questionsCarnet)) : [];
    if (!manquants.length) return;
    let annule = false;
    fetchQuestionsCarnet(manquants)
      .then((q) => { if (!annule) setQuestionsCarnet((avant) => ({ ...avant, ...Object.fromEntries(manquants.map((id) => [id, q[id] ?? []])) })); })
      .catch(() => { /* réseau : pas de bande de cases */ });
    return () => { annule = true; };
  }, [idsPatients, questionsCarnet]);

  // une carte par groupe et par patient (tous les patients : les chiffres du filtre)
  const tousGroupes = useMemo(() => regrouperFiches(worksClasse), [worksClasse]);
  const groupes = useMemo(() => (filtre ? tousGroupes.filter((g) => g.activityId === filtre) : tousGroupes), [tousGroupes, filtre]);

  // les points donnés sur ces patients : le total de chaque groupe, rechargé avec la page
  const idsActivites = useMemo(() => [...new Set(tousGroupes.map((g) => g.activityId))].sort().join(','), [tousGroupes]);
  const chargerPoints = useCallback(async () => {
    try {
      setPointsDonnes(await fetchActivitiesPoints(idsActivites ? idsActivites.split(',') : []));
    } catch {
      /* colonne absente ou réseau */
    }
  }, [idsActivites]);
  useEffect(() => { void chargerPoints(); }, [chargerPoints, maj]);

  const affiche = useCallback(
    (g: (typeof tousGroupes)[number]): GroupeAffiche => {
      const questions = questionsCarnet[g.activityId] ?? [];
      return {
        g,
        questions,
        cases: bandeDeCases(questions, g.w.direct?.faites),
        legende: legendeCarnet(questions, g.w.direct),
        raison: raisonAVoir(g.w.direct),
        points: pointsDe(pointsDonnes.filter((p) => p.activity_id === g.activityId), g.eleves, g.classId),
      };
    },
    [questionsCarnet, pointsDonnes],
  );
  const affiches = useMemo(() => groupes.map(affiche), [groupes, affiche]);
  const aVoir = affiches.filter((a) => a.raison);
  const autres = affiches.filter((a) => !a.raison);


  // relus à chaque mise à jour : le prof note les absences pendant le cours
  const seanceEvenements = seanceDeLaClasse?.id ?? null;
  useEffect(() => {
    if (!seanceEvenements) return;
    let annule = false;
    fetchPresenceEvents(seanceEvenements)
      .then((evenements) => { if (!annule) setEvenementsLus({ cle: seanceEvenements, evenements }); })
      .catch(() => { /* réseau : pas d'absents affichés */ });
    return () => { annule = true; };
  }, [seanceEvenements, maj]);
  const evenements = useMemo(
    () => (seanceEvenements && evenementsLus?.cle === seanceEvenements ? evenementsLus.evenements : []),
    [seanceEvenements, evenementsLus],
  );

  const bandeau = useMemo(
    () => (roster ? construireBandeau(roster, elevesAvecFiche(worksClasse), evenements) : null),
    [roster, worksClasse, evenements],
  );

  // le groupe ouvert : dans l'adresse, pour que « retour » du téléphone le referme
  const cleOuverte = params.get('groupe');
  const ouvert = useMemo(() => {
    const g = cleOuverte ? tousGroupes.find((x) => x.cle === cleOuverte) : null;
    return g ? affiche(g) : null;
  }, [cleOuverte, tousGroupes, affiche]);
  const fermer = useCallback(() => {
    if (window.history.state?.idx > 0) window.history.back();
    else setParams((p) => { const n = new URLSearchParams(p); n.delete('groupe'); return n; }, { replace: true });
  }, [setParams]);

  const actions: ActionsGroupe = useMemo(() => ({
    ecrire: (a, points) => setCible({ libelle: a.g.noms.join(', '), eleves: a.g.eleves, points, activites: [{ id: a.g.activityId, key: a.g.w.activities?.key ?? '', nom: a.g.patient }] }),
    ouvrir: (a) => setParams((p) => { const n = new URLSearchParams(p); n.set('groupe', a.g.cle); return n; }),
  }), [setParams]);

  const enLigne = groupes.filter((g) => maintenant - g.maj < EN_LIGNE_MS).length;
  const carnetsEnvoyes = groupes.filter((g) => g.w.direct?.envoye || g.statut !== 'draft').length;
  const questions = groupes
    .flatMap((g) => (g.w.direct?.morel ?? []).map((m) => ({ ...m, noms: nomsDuGroupe(g), patient: g.patient, cle: g.cle })))
    .sort((a, b) => b.t - a.t);
  const pasComprises = questions.filter((q) => !q.compris).length;
  const plusieursPatients = activitesAffichees.length > 1;
  const correctionsAnimees = activitesAffichees.filter((a) => hasAnimatedCorrection(a.key));
  const messageClasse = () => setCible({ libelle: nomClasse ? `toute la ${nomClasse}` : 'tous les groupes', eleves: null, activites: activitesAffichees });
  const libelleMessageClasse = `Message à ${nomClasse ? `toute la ${nomClasse}` : 'tous les groupes'}`;

  // à qui part chaque message envoyé, et qui l'a lu
  const destinataires = (m: LiveMessage) => {
    if (!m.student_ids) return m.class_id ? `toute la ${classes.find(([id]) => id === m.class_id)?.[1] ?? 'classe'}` : 'tous';
    const vises = tousGroupes.filter((g) => m.student_ids!.some((id) => g.eleves.includes(id)));
    return vises.length === 1 ? nomsDuGroupe(vises[0]) : `${m.student_ids.length} élèves`;
  };

  const chiffres = (
    <>
      <Chiffre valeur={`${enLigne} / ${groupes.length}`} libelle="groupes en ligne" />
      <Chiffre valeur={String(aVoir.length)} libelle="à aller voir" alerte={aVoir.length > 0} />
      <Chiffre valeur={String(carnetsEnvoyes)} libelle={carnetsEnvoyes > 1 ? 'carnets envoyés' : 'carnet envoyé'} />
      <Chiffre valeur={String(questions.length)} libelle={`questions à Morel${pasComprises ? `, ${pasComprises} pas comprise${pasComprises > 1 ? 's' : ''}` : ''}`} />
    </>
  );

  const seanceBloc = (
    <div className={`ed-seance${seanceDeLaClasse ? '' : ' ed-seance--aucune'}`}>
      <div>
        {seanceDeLaClasse ? (
          <>
            <strong>{nomClasse} · séance de {heure(Date.parse(seanceDeLaClasse.started_at)).replace(':', ' h ')}{seanceDeLaClasse.group_id ? ' (demi-groupe)' : ''}</strong>
            <span>{ordi ? '' : 'classe prise sur ta séance du téléphone · '}{texteRestant(seanceDeLaClasse, maintenant)}</span>
          </>
        ) : (
          <>
            <strong>{nomClasse || 'Toutes les classes'}</strong>
            <span>
              {seance
                ? `séance en cours sur le téléphone : ${classes.find(([id]) => id === seance.class_id)?.[1] ?? 'une autre classe'}`
                : seance === null ? 'pas de séance en cours sur le téléphone' : 'lecture de la séance…'}
            </span>
          </>
        )}
      </div>
      <button className="ed-bouton" onClick={() => setChanger((v) => !v)} aria-expanded={changer}>{changer ? 'Fermer' : 'Changer'}</button>
    </div>
  );

  const debutCours = debutDuCours(maintenant);
  const reglages = changer && (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <select className="ed-champ" value={classeId} onChange={(e) => choisirClasse(e.target.value)} aria-label="Classe">
        <option value="">Toutes les classes</option>
        {classes.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
      </select>
      <select className="ed-champ" value={String(periode)} onChange={(e) => setPeriode(e.target.value === 'cours' ? 'cours' : Number(e.target.value))} aria-label="Période">
        <option value="cours">{debutCours ? `Ce cours (depuis ${heure(debutCours).replace(':', ' h ')})` : 'Ce cours (2 dernières heures)'}</option>
        <option value={60}>Dernière heure</option>
        <option value={120}>2 dernières heures</option>
        <option value={480}>Aujourd'hui</option>
      </select>
      {seance && seance.class_id !== classeId && (
        <button className="ed-lien" onClick={() => setChoix({ seanceId })}>Revenir à la classe de la séance</button>
      )}
    </div>
  );

  const segments = activites.length > 0 && (
    <div className="ed-segments" role="group" aria-label="Patient">
      <button aria-pressed={!filtre} onClick={() => choisirPatient('')}>Tous · {tousGroupes.length}</button>
      {activites.map((a) => (
        <button key={a.id} aria-pressed={filtre === a.id} onClick={() => choisirPatient(a.id)}>
          {ordi ? a.nom : prenom(a.nom)} · {tousGroupes.filter((g) => g.activityId === a.id).length}
        </button>
      ))}
    </div>
  );

  const corrections = correctionsAnimees.map((a) => (
    <AnimatedCorrectionToggle
      key={a.id}
      activityId={a.id}
      classId={classeId || null}
      className={nomClasse || null}
      compact
      sansExplication={ordi}
      libelle={plusieursPatients ? `Correction animée (${prenom(a.nom)})` : 'Correction animée'}
    />
  ));

  const majTexte = erreur ? 'erreur de lecture' : maj ? `mis à jour à ${heure(maj)}` : 'chargement…';
  const entete = (
    <header className="ed-entete">
      <div className="ed-largeur">
        <div className="ed-titre">
          <div>
            <h1>Activité en direct</h1>
            <div className="ed-maj"><span className={`ed-point ed-point--petit ${erreur ? 'ed-point--erreur' : 'ed-point--en-ligne'}`} aria-hidden />{majTexte}</div>
          </div>
          <button className="ed-bouton ed-bouton--carre" onClick={() => void charger()} aria-label="Actualiser"><IconeActualiser /></button>
        </div>
        {seanceBloc}
        {segments}
        {ordi && (
          <div className="ed-outils">
            {corrections}
            {activitesAffichees.length > 0 && <button className="ed-bouton ed-bouton--fort" onClick={messageClasse}>{libelleMessageClasse}</button>}
          </div>
        )}
        {reglages}
        {instant && (
          <div className="ed-releve">
            Relecture au {new Date(instant).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} (développement) : rien n'est envoyé aux élèves.
          </div>
        )}
        {erreur && <div className="ed-alerte">{erreur}</div>}
      </div>
    </header>
  );

  const listeMorel = (
    <section className="ed-boite" ref={basMorel}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2>Questions au Docteur Morel</h2>
        {pasComprises > 0 && <span style={{ fontSize: 12, color: 'var(--neg)', fontWeight: 600 }}>{pasComprises} pas comprise{pasComprises > 1 ? 's' : ''}</span>}
      </div>
      {questions.length === 0 && <p className="ed-vide">Aucune question pour l'instant.</p>}
      <ul className="ed-liste">
        {questions.slice(0, 60).map((q, i) => (
          <li key={i} className={`ed-question${q.compris ? '' : ' ed-question--neg'}`}>
            <div>
              <span className="ed-heure">{heure(q.t)}</span>
              <strong>{q.noms}{plusieursPatients ? ` (${prenom(q.patient)})` : ''}</strong>
              <span className={`ed-tag${q.compris ? '' : ' ed-tag--neg'}`}>{q.compris ? `indice ${q.niveau}` : 'pas compris'}</span>
            </div>
            <span>{q.q}</span>
          </li>
        ))}
      </ul>
    </section>
  );

  const listeEnvoyes = envoyes.length > 0 && (
    <section className="ed-boite">
      <h2>Messages envoyés</h2>
      <ul className="ed-liste">
        {envoyes.map((m) => {
          const lecture = texteLectures(lectures(m, tousGroupes));
          return (
            <li key={m.id} className="ed-envoi">
              <span className="ed-heure">{heure(Date.parse(m.created_at))}</span>
              <span>
                {m.points ? <strong style={{ color: Number(m.points) < 0 ? 'var(--neg)' : 'var(--pos)' }}>{ecrirePoints(Number(m.points))} </strong> : null}
                {m.texte} <em>· {destinataires(m)}</em>
              </span>
              {lecture && <span className={`ed-lu${lecture === 'lu' ? ' ed-lu--oui' : ''}`}>{lecture}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const vide = groupes.length === 0 && !erreur && (
    <p className="ed-vide">
      Aucun groupe n'a travaillé sur cette période. Les élèves apparaissent ici dès qu'ils sont connectés avec leur code et commencent à jouer.
    </p>
  );

  return (
    <Layout fullBleed>
      <div className={`ed${ordi ? ' ed-ordi' : ''}`}>
        {entete}
        {ordi ? (
          <div className="ed-largeur ed-corps">
            <div className="ed-haut">
              {chiffres}
              {bandeau && <BandeauClasse b={bandeau} total={roster?.length ?? 0} />}
            </div>
            {vide}
            <div className="ed-colonnes">
              {groupes.length > 0 && <TableauClasse groupes={[...aVoir, ...autres]} maintenant={maintenant} actions={actions} />}
              <aside className="ed-cote">
                {listeMorel}
                {listeEnvoyes}
              </aside>
            </div>
          </div>
        ) : (
          <>
            <div className={`ed-corps${activitesAffichees.length > 0 ? ' ed-corps--avec-bas' : ''}`}>
              <div className="ed-chiffres">{chiffres}</div>
              {bandeau && <BandeauClasse b={bandeau} total={roster?.length ?? 0} />}
              {vide}
              {aVoir.length > 0 && (
                <section className="ed-section ed-section--alerte">
                  <div className="ed-section-titre"><h2>À aller voir · {aVoir.length}</h2></div>
                  {aVoir.map((a) => <CarteGroupe key={a.g.cle} a={a} maintenant={maintenant} actions={actions} />)}
                </section>
              )}
              {autres.length > 0 && (
                <section className="ed-section">
                  <div className="ed-section-titre">
                    <h2>{aVoir.length ? `Les autres groupes · ${autres.length}` : `Les groupes · ${autres.length}`}</h2>
                    <span>les plus récents d'abord</span>
                  </div>
                  {autres.map((a) => <CarteGroupe key={a.g.cle} a={a} maintenant={maintenant} actions={actions} />)}
                </section>
              )}
              {affiches.some((a) => a.cases) && <LegendeCases />}
              {corrections.length > 0 && <div className="ed-reglages">{corrections}</div>}
              {listeMorel}
              {listeEnvoyes}
            </div>
            {activitesAffichees.length > 0 && (
              <div className="ed-bas">
                <button className="ed-bouton ed-bouton--fort" onClick={messageClasse}>{libelleMessageClasse}</button>
                <button className="ed-bouton" onClick={() => basMorel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Morel · {questions.length}</button>
              </div>
            )}
          </>
        )}

        {ouvert && (
          <VueGroupe
            a={ouvert}
            retour={nomClasse ? `La ${nomClasse}` : 'Tous les groupes'}
            maintenant={maintenant}
            messages={[...envoyes, ...pointsDonnes]}
            actions={actions}
            fermer={fermer}
          />
        )}

        {cible && (
          <PanneauMessage
            libelle={cible.libelle}
            pointsInit={cible.points ?? 0}
            pourTous={!cible.eleves}
            patients={cible.eleves ? [] : cible.activites.map((a) => a.nom)}
            elevesVises={cible.eleves ? cible.eleves.length : ciblesPoints(groupes).reduce((n, c) => n + c.eleves.length, 0)}
            fermer={() => setCible(null)}
            envoyer={async (texte, style, signe, points) => {
              if (instant) throw new Error("Relecture d'un cours passé : rien n'est envoyé.");
              // un groupe : sur son propre patient. La classe : un envoi par patient affiché ; avec des points, à ses
              // seuls élèves des groupes affichés, une fois chacun (ciblesPoints), sinon à toute la classe.
              const envois = cible.eleves
                ? [{ activity_id: cible.activites[0].id, class_id: null, student_ids: cible.eleves }]
                : points
                  ? ciblesPoints(groupes).map((c) => ({ activity_id: c.activityId, class_id: null, student_ids: c.eleves }))
                  : cible.activites.map((a) => ({ activity_id: a.id, class_id: classeId || null, student_ids: null }));
              await Promise.all(envois.map((e) => sendLiveMessage({ ...e, texte, style, signe, points })));
              setCible(null);
              void chargerEnvoyes();
              void chargerPoints();
            }}
          />
        )}
      </div>
    </Layout>
  );
}

function texteRestant(s: LiveSession, maintenant: number): string {
  if (s.ended_at && Date.parse(s.ended_at) <= maintenant) return `séance terminée à ${heure(Date.parse(s.ended_at))}`;
  const r = minutesRestantes(Date.parse(s.started_at), maintenant);
  return r > 0 ? `${r} min restantes` : `commencée il y a ${Math.round((maintenant - Date.parse(s.started_at)) / 60_000)} min`;
}

function BandeauClasse({ b, total }: { b: Bandeau<LiveStudent>; total: number }) {
  const noms = (e: { pseudo: string }[]) => e.map((x) => x.pseudo).join(', ');
  if (!b.pasConnectes.length && !b.absents.length && !b.sortis.length) {
    return <section aria-label="Élèves hors du jeu" className="ed-bandeau ed-bandeau--ok">Les {total} élèves sont connectés.</section>;
  }
  return (
    <dl aria-label="Élèves hors du jeu" className="ed-bandeau" style={{ margin: 0 }}>
      {b.pasConnectes.length > 0 && (
        <div><dt className="ed-hors--connexion">Pas encore connectés · {b.pasConnectes.length}</dt><dd>{noms(b.pasConnectes)}</dd></div>
      )}
      {b.absents.length > 0 && (
        <div><dt className="ed-hors--absent">{b.absents.length > 1 ? 'Absents' : 'Absent'} · {b.absents.length}</dt><dd>{noms(b.absents)} <small>(noté sur la séance)</small></dd></div>
      )}
      {b.sortis.length > 0 && (
        <div>
          <dt className="ed-hors--sortie">{b.sortis.length > 1 ? 'Sorties' : 'Sortie'} · {b.sortis.length}</dt>
          <dd>{b.sortis.map((s, i) => <span key={s.eleve.id}>{i ? ', ' : ''}{s.eleve.pseudo} <small>{s.motif} depuis {heure(s.depuis).replace(':', ' h ')}</small></span>)}</dd>
        </div>
      )}
    </dl>
  );
}

function Chiffre({ valeur, libelle, alerte }: { valeur: string; libelle: string; alerte?: boolean }) {
  return (
    <div className={`ed-chiffre${alerte ? ' ed-chiffre--alerte' : ''}`}>
      <b>{valeur}</b>
      <span>{libelle}</span>
    </div>
  );
}
