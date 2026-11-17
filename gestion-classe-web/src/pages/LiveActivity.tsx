import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { AnimatedCorrectionToggle } from '../components/productions/AnimatedCorrectionToggle';
import { useAuth } from '../hooks/useAuth';
import { hasAnimatedCorrection } from '../lib/animatedCorrection';
import {
  aBesoin,
  construireBandeau,
  elevesAvecFiche,
  patientsEnCours,
  regrouperFiches,
  type Bandeau,
  type EvenementLike,
  type Groupe,
  type Patient,
} from '../lib/liveClass';
import {
  ecrirePoints,
  fetchActivitiesPoints,
  fetchLiveRoster,
  fetchLiveSession,
  fetchLiveWorks,
  fetchPresenceEvents,
  fetchSentMessages,
  pointsDe,
  sendLiveMessage,
  type LiveMessage,
  type LiveMessageStyle,
  type LiveMorel,
  type LiveSession,
  type LiveStudent,
  type LiveWork,
} from '../lib/liveQueries';
import { fetchClassesForUser, type ClassInfo } from '../lib/liveSessionQueries';

/**
 * En direct : pendant le cours, depuis le téléphone, où en sont les groupes de la classe sur les activités
 * numériques (Hôpital virtuel, un patient par activité) : qui est en ligne, où il est, l'avancement du carnet,
 * et les questions posées au Docteur Morel (le bot d'aide). Se met à jour toute seule (lib/liveQueries.ts :
 * le résumé `_direct`).
 *
 * La classe est choisie d'office d'après la séance lancée sur le téléphone (lib/liveClass.ts), et un bandeau
 * dit qui n'est pas encore connecté, qui est absent ou sorti. Tous les patients de la classe tiennent sur la
 * même grille.
 */

const RAFRAICHIR = 15_000;
const EN_LIGNE = 2 * 60_000;
const RECENT = 10 * 60_000;

const LIEUX: Record<string, string> = {
  cabinet: 'Cabinet',
  laboratoire: 'Labo',
  attente: "Salle d'attente",
  irm: 'Imagerie',
  scanner: 'Imagerie',
};
const MODES: Record<string, string> = { direct: 'Accompagné', guide: 'Guidé', autonome: 'Autonome' };

const minutes = (ms: number) => Math.max(0, Math.round(ms / 60_000));
const heure = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function etat(maj: number, maintenant: number) {
  const d = maintenant - maj;
  if (d < EN_LIGNE) return { couleur: 'var(--pos)', texte: 'en ligne' };
  if (d < RECENT) return { couleur: 'var(--warn)', texte: `il y a ${minutes(d)} min` };
  return { couleur: 'var(--text-dim)', texte: `il y a ${minutes(d)} min` };
}

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

export function LiveActivity() {
  const { user } = useAuth();
  const instant = useInstant();
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
  const [mesClasses, setMesClasses] = useState<ClassInfo[]>([]);
  const [depuis, setDepuis] = useState(120);
  // à qui écrire : un groupe (sur son patient), ou toute la classe sur les patients affichés (null = panneau fermé)
  const [cible, setCible] = useState<{ libelle: string; eleves: string[] | null; points?: number; activites: Patient[] } | null>(null);
  const [pointsDonnes, setPointsDonnes] = useState<LiveMessage[]>([]);
  const [envoyes, setEnvoyes] = useState<LiveMessage[]>([]);
  // chargés pour une classe (et un demi-groupe) / une séance donnée : `cle` dit pour laquelle
  const [rosterLu, setRosterLu] = useState<{ cle: string; eleves: LiveStudent[] } | null>(null);
  const [evenementsLus, setEvenementsLus] = useState<{ cle: string; evenements: EvenementLike[] } | null>(null);

  const chargerEnvoyes = useCallback(async () => {
    try {
      setEnvoyes(await fetchSentMessages(60));
    } catch {
      /* table absente ou réseau : la liste reste vide */
    }
  }, []);
  useEffect(() => { void chargerEnvoyes(); }, [chargerEnvoyes]);

  useEffect(() => {
    if (!user) return;
    fetchClassesForUser(user.id).then(setMesClasses).catch(() => { /* la liste se contente des classes des fiches */ });
  }, [user]);

  const charger = useCallback(async () => {
    const t = instant ?? Date.now();
    try {
      const [w, s] = await Promise.all([
        fetchLiveWorks(depuis, t),
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
  }, [depuis, instant, user]);

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

  // les fiches de la classe choisie, tous patients confondus
  const worksClasse = useMemo(() => (classeId ? works.filter((w) => w.class_id === classeId) : works), [works, classeId]);

  // les patients en cours dans la classe : filtre, bascules de correction, message à la classe
  const activites = useMemo(() => patientsEnCours(worksClasse), [worksClasse]);
  const filtre = activites.some((a) => a.id === patient) ? patient : '';
  const activitesAffichees = filtre ? activites.filter((a) => a.id === filtre) : activites;

  // une carte par groupe et par patient
  const groupes = useMemo(() => regrouperFiches(worksClasse, { patient: filtre }), [worksClasse, filtre]);

  // les points donnés sur ces patients : le total de chaque groupe, rechargé avec la page
  const idsActivites = useMemo(() => [...new Set(groupes.map((g) => g.activityId))].sort().join(','), [groupes]);
  const chargerPoints = useCallback(async () => {
    try {
      setPointsDonnes(await fetchActivitiesPoints(idsActivites ? idsActivites.split(',') : []));
    } catch {
      /* colonne absente ou réseau */
    }
  }, [idsActivites]);
  useEffect(() => { void chargerPoints(); }, [chargerPoints, maj]);

  // le bandeau : la liste de la classe (ou du demi-groupe de la séance) et les absences de la séance
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

  const enLigne = groupes.filter((g) => maintenant - g.maj < EN_LIGNE).length;
  const carnetsEnvoyes = groupes.filter((g) => g.w.direct?.envoye || g.statut !== 'draft').length;
  const plusieursPatients = new Set(groupes.map((g) => g.activityId)).size > 1;
  const questions = groupes
    .flatMap((g) => (g.w.direct?.morel ?? []).map((m) => ({ ...m, noms: g.noms, patient: g.patient })))
    .sort((a, b) => b.t - a.t);
  const pasComprises = questions.filter((q) => !q.compris).length;
  const correctionsAnimees = activitesAffichees.filter((a) => hasAnimatedCorrection(a.key));

  return (
    <Layout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 48px' }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Activité en direct</h1>
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            {maj ? `mis à jour à ${heure(maj)}, toutes les 15 s` : 'chargement…'}
          </span>
          <button onClick={() => void charger()} style={bouton}>Actualiser</button>
          {activitesAffichees.length > 0 && (
            <button
              onClick={() => setCible({ libelle: nomClasse ? `toute la ${nomClasse}` : 'tous les groupes', eleves: null, activites: activitesAffichees })}
              style={{ ...bouton, fontWeight: 600 }}
            >
              ✉ Message à {nomClasse ? `la ${nomClasse}` : 'tous'}
            </button>
          )}
        </header>

        {instant && (
          <p style={{ ...encart, background: 'var(--warn-soft)', color: 'var(--warn)', margin: '0 0 10px' }}>
            Relecture au {new Date(instant).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} (développement) : rien n'est envoyé aux élèves.
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          <select value={classeId} onChange={(e) => choisirClasse(e.target.value)} style={champ} aria-label="Classe">
            <option value="">Toutes les classes</option>
            {classes.map(([id, nom]) => <option key={id} value={id}>{nom}</option>)}
          </select>
          <select value={filtre} onChange={(e) => choisirPatient(e.target.value)} style={champ} aria-label="Patient">
            <option value="">{activites.length === 0 ? 'Aucun patient en cours' : 'Tous les patients'}</option>
            {activites.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
          <select value={depuis} onChange={(e) => setDepuis(Number(e.target.value))} style={champ} aria-label="Période">
            <option value={60}>Dernière heure</option>
            <option value={120}>2 dernières heures</option>
            <option value={480}>Aujourd'hui</option>
          </select>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 14px' }}>
          {seance
            ? seanceDeLaClasse
              ? `Classe de la séance démarrée à ${heure(Date.parse(seance.started_at))} sur le téléphone${seance.group_id ? ' (demi-groupe)' : ''}.`
              : `Séance en cours sur le téléphone : ${classes.find(([id]) => id === seance.class_id)?.[1] ?? 'une autre classe'}, démarrée à ${heure(Date.parse(seance.started_at))}.`
            : seance === null
              ? 'Pas de séance en cours sur le téléphone : choisis la classe.'
              : ''}
        </p>

        {correctionsAnimees.map((a) => (
          <div key={a.id} style={{ marginBottom: 6 }}>
            {correctionsAnimees.length > 1 && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{a.nom}</div>}
            <AnimatedCorrectionToggle activityId={a.id} classId={classeId || null} className={nomClasse || null} compact />
          </div>
        ))}

        {erreur && <p style={{ color: 'var(--neg)' }}>{erreur}</p>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <Chiffre valeur={`${enLigne} / ${groupes.length}`} libelle="groupes en ligne" />
          <Chiffre valeur={String(carnetsEnvoyes)} libelle="carnets envoyés" />
          <Chiffre valeur={String(questions.length)} libelle="questions à Morel" />
          <Chiffre valeur={String(pasComprises)} libelle="pas comprises" alerte={pasComprises > 0} />
        </div>

        {bandeau && <BandeauClasse b={bandeau} total={roster?.length ?? 0} />}

        {groupes.length === 0 && !erreur && (
          <p style={{ color: 'var(--text-muted)' }}>
            Aucun groupe n'a travaillé sur cette période. Les élèves apparaissent ici dès qu'ils sont connectés avec leur code et commencent à jouer.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {groupes.map((g) => (
            <CarteGroupe
              key={g.cle}
              g={g}
              maintenant={maintenant}
              points={pointsDe(pointsDonnes.filter((p) => p.activity_id === g.activityId), g.eleves, g.classId)}
              ecrire={(points) => setCible({ libelle: g.noms.join(', '), eleves: g.eleves, points, activites: [{ id: g.activityId, key: g.w.activities?.key ?? '', nom: g.patient }] })}
            />
          ))}
        </div>

        {envoyes.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Messages envoyés (dernière heure)</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {envoyes.map((m) => (
                <li key={m.id} style={{ ...ligne, background: STYLES[m.style].fond }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 40 }}>{heure(Date.parse(m.created_at))}</span>
                  <span style={{ flex: 1 }}>{m.points ? <strong>{ecrirePoints(Number(m.points))} · </strong> : null}{m.texte} <em style={{ color: 'var(--text-muted)' }}>— {m.signe}</em></span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.student_ids ? `${m.student_ids.length} élève(s)` : 'tous'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cible && (
          <PanneauMessage
            libelle={cible.libelle}
            pointsInit={cible.points ?? 0}
            pourTous={!cible.eleves}
            patients={cible.eleves ? [] : cible.activites.map((a) => a.nom)}
            fermer={() => setCible(null)}
            envoyer={async (texte, style, signe, points) => {
              if (instant) throw new Error("Relecture d'un cours passé : rien n'est envoyé.");
              // un message à la classe part pour chaque patient affiché ; un groupe, sur son propre patient
              await Promise.all(cible.activites.map((a) => sendLiveMessage({ activity_id: a.id, class_id: cible.eleves ? null : classeId || null, student_ids: cible.eleves, texte, style, signe, points })));
              setCible(null);
              void chargerEnvoyes();
              void chargerPoints();
            }}
          />
        )}

        {questions.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Toutes les questions au Docteur Morel</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {questions.slice(0, 60).map((q, i) => (
                <li key={i} style={{ ...ligne, background: q.compris ? 'var(--surface)' : 'var(--neg-soft)' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 40 }}>{heure(q.t)}</span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>{q.noms.join(', ')}</strong>
                    {plusieursPatients && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> ({q.patient})</span>} — {q.q}
                  </span>
                  <Etiquette m={q} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layout>
  );
}

const prenoms = (eleves: { pseudo: string }[]) => eleves.map((e) => e.pseudo).join(', ');

function BandeauClasse({ b, total }: { b: Bandeau<LiveStudent>; total: number }) {
  const rien = b.pasConnectes.length === 0 && b.absents.length === 0 && b.sortis.length === 0;
  return (
    <section aria-label="Élèves de la classe" style={{ ...carte, display: 'grid', gap: 4, marginBottom: 12, fontSize: 14, borderColor: b.pasConnectes.length ? 'var(--warn)' : 'var(--border)' }}>
      {rien && <span style={{ color: 'var(--pos)' }}>Les {total} élèves sont connectés.</span>}
      {b.pasConnectes.length > 0 && (
        <span><strong style={{ color: 'var(--warn)' }}>Pas encore connectés ({b.pasConnectes.length}) :</strong> {prenoms(b.pasConnectes)}</span>
      )}
      {b.absents.length > 0 && (
        <span><strong style={{ color: 'var(--text-muted)' }}>Absents ({b.absents.length}) :</strong> {prenoms(b.absents)}</span>
      )}
      {b.sortis.length > 0 && (
        <span><strong style={{ color: 'var(--text-muted)' }}>Sortis :</strong> {b.sortis.map((s) => `${s.eleve.pseudo} (${s.motif}, ${heure(s.depuis)})`).join(', ')}</span>
      )}
    </section>
  );
}


function CarteGroupe({ g, maintenant, points, ecrire }: { g: Groupe; maintenant: number; points: number; ecrire: (points?: number) => void }) {
  const d = g.w.direct;
  const e = etat(g.maj, maintenant);
  const avance = d?.sur ? Math.round((100 * (d.reponses ?? 0)) / d.sur) : null;
  return (
    <article style={{ ...carte, borderColor: aBesoin(g) ? 'var(--neg)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: e.couleur, flex: 'none' }} />
        <strong style={{ flex: 1, fontSize: 15 }}>{g.noms.join(', ')}</strong>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{g.classe} · {e.texte}</span>
        <button onClick={() => ecrire()} style={{ ...bouton, padding: '2px 8px', fontSize: 13 }} aria-label={`Envoyer un message à ${g.noms.join(', ')}`}>✉</button>
        <button onClick={() => ecrire(-1)} style={{ ...bouton, padding: '2px 7px', fontSize: 13, color: 'var(--neg)', fontWeight: 700 }} aria-label={`Retirer des points à ${g.noms.join(', ')}`}>−1</button>
        <button onClick={() => ecrire(1)} style={{ ...bouton, padding: '2px 7px', fontSize: 13, color: 'var(--pos)', fontWeight: 700 }} aria-label={`Donner des points à ${g.noms.join(', ')}`}>+1</button>
      </div>
      {points !== 0 && (
        <div style={{ ...encart, background: points < 0 ? 'var(--neg-soft)' : 'var(--pos-soft)', color: points < 0 ? 'var(--neg)' : 'var(--pos)', fontWeight: 700 }}>
          Points du service : {ecrirePoints(points)}
        </div>
      )}
      {d ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0' }}>
            <strong style={{ color: 'var(--indigo-ink)' }}>{g.patient}</strong> · <strong style={{ color: 'var(--text)' }}>{LIEUX[d.lieu ?? ''] ?? d.lieu ?? '—'}</strong>
            {d.mode ? ` · ${MODES[d.mode] ?? d.mode}` : ''}
          </div>
          {avance !== null && (
            <div style={{ margin: '6px 0' }}>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-alt)', overflow: 'hidden' }}>
                <div style={{ width: `${avance}%`, height: '100%', background: 'var(--indigo)' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span>{d.reponses}/{d.sur} questions</span>
                <Pastille ok={!!d.hypothese} texte="hypothèse" />
                <Pastille ok={!!d.conclusion} texte="conclusion" />
                <Pastille ok={!!d.envoye} texte="envoyé" />
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {d.examens?.length ?? 0} examens faits · {d.questionsPatient ?? 0} questions au patient
          </div>
          {d.dernierRefus && (
            <div style={{ ...encart, background: 'var(--warn-soft)', color: 'var(--warn)' }}>Labo : {d.dernierRefus}</div>
          )}
          {(d.morelIncomprises ?? 0) >= 2 && (
            <div style={{ ...encart, background: 'var(--neg-soft)', color: 'var(--neg)' }}>Morel ne le comprend pas : passe le voir.</div>
          )}
          {!!d.morel?.length && (
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 4 }}>
              {d.morel.slice(-4).reverse().map((m, i) => (
                <li key={i} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{heure(m.t)}</span>
                  <span style={{ flex: 1 }}>{m.q}</span>
                  <Etiquette m={m} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          <strong style={{ color: 'var(--indigo-ink)' }}>{g.patient}</strong> · Fiche {g.statut === 'draft' ? 'en cours' : 'envoyée'} (version du jeu sans suivi en direct).
        </div>
      )}
    </article>
  );
}

// Ce que voit l'élève : un grand message signé par un personnage de l'hôpital, jamais par le prof.
const SIGNES = ['Docteur Morel', 'Le chef de service', "L'infirmière en chef", "L'accueil de l'hôpital"];
const STYLES: Record<LiveMessageStyle, { nom: string; fond: string; texte: string }> = {
  alerte: { nom: 'Alerte (rouge)', fond: 'var(--neg-soft)', texte: 'var(--neg)' },
  info: { nom: 'Info', fond: 'var(--indigo-soft)', texte: 'var(--indigo-ink)' },
  bravo: { nom: 'Bravo', fond: 'var(--pos-soft)', texte: 'var(--pos)' },
};
const MODELES: Record<LiveMessageStyle, string[]> = {
  alerte: [
    'Arrête de parler, sinon 1 point en moins !',
    'Retourne au travail tout de suite.',
    'Le chef de service te surveille…',
    "Range ton téléphone, docteur.",
    'Moins de bruit dans le service, les patients se reposent !',
  ],
  info: [
    'Il te reste 10 minutes : pense à ta conclusion.',
    "N'oublie pas d'envoyer ton carnet.",
    "Tes analyses t'attendent au laboratoire.",
    'As-tu bien interrogé ton patient ?',
  ],
  bravo: ['Excellent travail, docteur !', 'Bravo, continue comme ça !', 'Le service est fier de toi.'],
};

const VALEURS = [-2, -1, -0.5, 0, 0.5, 1, 2];
const MOTIFS_MALUS = ['Bavardage', 'Tu ne travailles pas', 'Téléphone sorti', 'Comportement inadapté dans le service'];
const MOTIFS_BONUS = ['Excellent travail, docteur !', 'Belle démarche de médecin', 'Belle entraide dans le service'];

function PanneauMessage({ libelle, pointsInit, pourTous, patients, fermer, envoyer }: {
  libelle: string;
  pointsInit: number;
  pourTous: boolean;
  /** Message à la classe : les patients pour lesquels il part (un envoi par patient). */
  patients: string[];
  fermer: () => void;
  envoyer: (texte: string, style: LiveMessageStyle, signe: string, points: number) => Promise<void>;
}) {
  const [points, setPoints] = useState(pointsInit);
  const [style, setStyle] = useState<LiveMessageStyle>(pointsInit < 0 ? 'alerte' : pointsInit > 0 ? 'bravo' : 'alerte');
  const [signe, setSigne] = useState(pointsInit ? SIGNES[1] : SIGNES[0]);
  const [texte, setTexte] = useState('');
  const choisirPoints = (v: number) => {
    setPoints(v);
    if (v < 0) setStyle('alerte');
    if (v > 0) setStyle('bravo');
  };
  const modeles = points < 0 ? MOTIFS_MALUS : points > 0 ? MOTIFS_BONUS : MODELES[style];
  const texteFinal = texte.trim() || (points < 0 ? 'Malus du service' : points > 0 ? 'Bonus du service' : '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const partir = async () => {
    if (!texteFinal) return;
    setEnCours(true);
    setErreur(null);
    try {
      await envoyer(texteFinal, style, signe, points);
    } catch (e) {
      setErreur((e as Error).message);
      setEnCours(false);
    }
  };
  return (
    <div role="dialog" aria-label={`Message à ${libelle}`} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#18181b66', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={fermer}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...carte, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px 14px 0 0', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <strong style={{ flex: 1 }}>Message à {libelle}</strong>
          <button onClick={fermer} style={{ ...bouton, padding: '2px 8px' }} aria-label="Fermer">×</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(Object.keys(STYLES) as LiveMessageStyle[]).map((s) => (
            <button key={s} onClick={() => setStyle(s)} style={{ ...bouton, background: style === s ? STYLES[s].fond : 'var(--surface)', color: STYLES[s].texte, fontWeight: style === s ? 700 : 400, borderColor: style === s ? STYLES[s].texte : 'var(--border-strong)' }}>
              {STYLES[s].nom}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>Points :</span>
          {VALEURS.map((v) => (
            <button
              key={v}
              onClick={() => choisirPoints(v)}
              style={{ ...bouton, padding: '3px 8px', fontSize: 13, fontWeight: points === v ? 800 : 400,
                background: points === v ? (v < 0 ? 'var(--neg-soft)' : v > 0 ? 'var(--pos-soft)' : 'var(--bg-alt)') : 'var(--surface)',
                color: v < 0 ? 'var(--neg)' : v > 0 ? 'var(--pos)' : 'var(--text-muted)' }}
            >
              {v === 0 ? 'aucun' : ecrirePoints(v)}
            </button>
          ))}
        </div>
        {pourTous && patients.length > 1 && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>Envoyé aux joueurs de chaque patient : {patients.join(', ')}.</p>
        )}
        {points !== 0 && pourTous && (
          <p style={{ fontSize: 12, color: 'var(--warn)', margin: '0 0 8px' }}>Attention : ces points iront à chaque élève de {libelle}.</p>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {modeles.map((m) => (
            <button key={m} onClick={() => setTexte(m)} style={{ ...bouton, fontSize: 13, textAlign: 'left' }}>{m}</button>
          ))}
        </div>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={300} rows={3} placeholder="Ou écris ton message…" style={{ ...champ, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Signé{' '}
            <select value={signe} onChange={(e) => setSigne(e.target.value)} style={champ}>
              {SIGNES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <span style={{ flex: 1 }} />
          <button onClick={() => void partir()} disabled={!texteFinal || enCours} style={{ ...bouton, background: 'var(--accent-strong)', color: '#fff', borderColor: 'var(--accent-strong)', fontWeight: 700, opacity: !texteFinal || enCours ? 0.6 : 1 }}>
            {enCours ? 'Envoi…' : points ? `Envoyer (${ecrirePoints(points)})` : 'Envoyer'}
          </button>
        </div>
        {erreur && <p style={{ color: 'var(--neg)', fontSize: 13 }}>{erreur}</p>}
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 0' }}>
          L'élève le voit en grand dans le jeu d'ici 15 s, signé « {signe} ». Le message reste valable 20 minutes.
          {points !== 0 && ' Les points, eux, restent : ils s\'affichent dans son carnet et comptent dans la note à la correction.'}
        </p>
      </div>
    </div>
  );
}

function Etiquette({ m }: { m: LiveMorel }) {
  const style: CSSProperties = { fontSize: 11, padding: '1px 6px', borderRadius: 10, flex: 'none' };
  if (!m.compris) return <span style={{ ...style, background: 'var(--neg-soft)', color: 'var(--neg)' }}>pas compris</span>;
  return <span style={{ ...style, background: 'var(--indigo-soft)', color: 'var(--indigo-ink)' }}>indice {m.niveau}</span>;
}

function Pastille({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <span style={{ padding: '0 6px', borderRadius: 10, background: ok ? 'var(--pos-soft)' : 'var(--bg-alt)', color: ok ? 'var(--pos)' : 'var(--text-dim)' }}>
      {ok ? '✓ ' : ''}{texte}
    </span>
  );
}

function Chiffre({ valeur, libelle, alerte }: { valeur: string; libelle: string; alerte?: boolean }) {
  return (
    <div style={{ ...carte, padding: '8px 12px', minWidth: 120, borderColor: alerte ? 'var(--neg)' : 'var(--border)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: alerte ? 'var(--neg)' : 'var(--text)' }}>{valeur}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{libelle}</div>
    </div>
  );
}

const carte: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 };
const encart: CSSProperties = { fontSize: 12, borderRadius: 'var(--radius-sm)', padding: '4px 8px', marginTop: 6 };
const ligne: CSSProperties = { display: 'flex', gap: 8, alignItems: 'baseline', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 14 };
const champ: CSSProperties = { padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 14, maxWidth: '100%' };
const bouton: CSSProperties = { ...champ, cursor: 'pointer' };
