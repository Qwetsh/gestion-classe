import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Layout } from '../components/Layout';
import { fetchLiveWorks, fetchSentMessages, sendLiveMessage, type LiveMessage, type LiveMessageStyle, type LiveMorel, type LiveWork } from '../lib/liveQueries';

/**
 * En direct : pendant le cours, depuis le téléphone, où en sont les groupes d'une activité numérique
 * (Hôpital virtuel) : qui est en ligne, où il est, l'avancement du carnet, et les questions posées au
 * Docteur Morel (le bot d'aide). Se met à jour toute seule (lib/liveQueries.ts : le résumé `_direct`).
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

interface Groupe {
  cle: string;
  noms: string[];
  eleves: string[];
  classId: string | null;
  classe: string;
  activite: string;
  maj: number;
  statut: string;
  w: LiveWork;
}

const minutes = (ms: number) => Math.max(0, Math.round(ms / 60_000));
const heure = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function etat(maj: number, maintenant: number) {
  const d = maintenant - maj;
  if (d < EN_LIGNE) return { couleur: 'var(--pos)', texte: 'en ligne' };
  if (d < RECENT) return { couleur: 'var(--warn)', texte: `il y a ${minutes(d)} min` };
  return { couleur: 'var(--text-dim)', texte: `il y a ${minutes(d)} min` };
}

// un groupe a sans doute besoin du prof : Morel ne l'a pas compris deux fois de suite, ou le labo vient de refuser
const aBesoin = (g: Groupe) => (g.w.direct?.morelIncomprises ?? 0) >= 2 || !!g.w.direct?.dernierRefus;

export function LiveActivity() {
  const [works, setWorks] = useState<LiveWork[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maj, setMaj] = useState<number>(0);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [activite, setActivite] = useState<string>('');
  const [classe, setClasse] = useState<string>('');
  const [depuis, setDepuis] = useState(120);
  // à qui écrire : un groupe, ou tous les groupes affichés (null = panneau fermé)
  const [cible, setCible] = useState<{ libelle: string; eleves: string[] | null } | null>(null);
  const [envoyes, setEnvoyes] = useState<LiveMessage[]>([]);
  const chargerEnvoyes = useCallback(async () => {
    try {
      setEnvoyes(await fetchSentMessages(60));
    } catch {
      /* table absente ou réseau : la liste reste vide */
    }
  }, []);
  useEffect(() => { void chargerEnvoyes(); }, [chargerEnvoyes]);

  const charger = useCallback(async () => {
    try {
      setWorks(await fetchLiveWorks(depuis));
      setErreur(null);
      setMaj(Date.now());
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, [depuis]);

  useEffect(() => {
    void charger();
    const id = window.setInterval(() => {
      if (!document.hidden) void charger();
      setMaintenant(Date.now());
    }, RAFRAICHIR);
    return () => window.clearInterval(id);
  }, [charger]);

  const activites = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of works) m.set(w.activity_id, w.activities?.title ?? 'Activité');
    return [...m.entries()];
  }, [works]);
  const actif = activite || activites[0]?.[0] || '';

  const classes = useMemo(
    () => [...new Set(works.filter((w) => w.activity_id === actif).map((w) => w.classes?.name ?? '—'))].sort(),
    [works, actif],
  );

  // une carte par groupe (binôme, trio : une fiche par élève, même group_key)
  const groupes = useMemo(() => {
    const m = new Map<string, Groupe>();
    for (const w of works) {
      if (w.activity_id !== actif) continue;
      const cl = w.classes?.name ?? '—';
      if (classe && cl !== classe) continue;
      const cle = w.group_key ?? w.id;
      const t = Math.max(Date.parse(w.updated_at), w.direct?.t ?? 0);
      const g = m.get(cle);
      const noms = w.direct?.equipe?.length ? w.direct.equipe : w.group_pseudos?.length ? w.group_pseudos : [w.students?.pseudo ?? '?'];
      const eleves = [...new Set([...(g?.eleves ?? []), w.student_id])];
      if (!g || t > g.maj) m.set(cle, { cle, noms, eleves, classId: w.class_id, classe: cl, activite: w.activities?.title ?? '', maj: t, statut: w.status, w });
      else g.eleves = eleves;
    }
    return [...m.values()].sort((a, b) => Number(aBesoin(b)) - Number(aBesoin(a)) || b.maj - a.maj);
  }, [works, actif, classe]);

  const enLigne = groupes.filter((g) => maintenant - g.maj < EN_LIGNE).length;
  const classeId = classe ? groupes.find((g) => g.classe === classe)?.classId ?? null : null;
  const carnetsEnvoyes = groupes.filter((g) => g.w.direct?.envoye || g.statut !== 'draft').length;
  const questions = groupes
    .flatMap((g) => (g.w.direct?.morel ?? []).map((m) => ({ ...m, noms: g.noms })))
    .sort((a, b) => b.t - a.t);
  const pasComprises = questions.filter((q) => !q.compris).length;

  return (
    <Layout>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 16px 48px' }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>En direct</h1>
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            {maj ? `mis à jour à ${heure(maj)}, toutes les 15 s` : 'chargement…'}
          </span>
          <button onClick={() => void charger()} style={bouton}>Actualiser</button>
          {actif && (
            <button onClick={() => setCible({ libelle: classe ? `toute la ${classe}` : 'tous les groupes', eleves: null })} style={{ ...bouton, fontWeight: 600 }}>
              ✉ Message à {classe ? `la ${classe}` : 'tous'}
            </button>
          )}
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <select value={actif} onChange={(e) => { setActivite(e.target.value); setClasse(''); }} style={champ} aria-label="Activité">
            {activites.length === 0 && <option value="">Aucune activité en cours</option>}
            {activites.map(([id, titre]) => <option key={id} value={id}>{titre}</option>)}
          </select>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} style={champ} aria-label="Classe">
            <option value="">Toutes les classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={depuis} onChange={(e) => setDepuis(Number(e.target.value))} style={champ} aria-label="Période">
            <option value={60}>Dernière heure</option>
            <option value={120}>2 dernières heures</option>
            <option value={480}>Aujourd'hui</option>
          </select>
        </div>

        {erreur && <p style={{ color: 'var(--neg)' }}>{erreur}</p>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <Chiffre valeur={`${enLigne} / ${groupes.length}`} libelle="groupes en ligne" />
          <Chiffre valeur={String(carnetsEnvoyes)} libelle="carnets envoyés" />
          <Chiffre valeur={String(questions.length)} libelle="questions à Morel" />
          <Chiffre valeur={String(pasComprises)} libelle="pas comprises" alerte={pasComprises > 0} />
        </div>

        {groupes.length === 0 && !erreur && (
          <p style={{ color: 'var(--text-muted)' }}>
            Aucun groupe n'a travaillé sur cette période. Les élèves apparaissent ici dès qu'ils sont connectés avec leur code et commencent à jouer.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {groupes.map((g) => (
            <CarteGroupe key={g.cle} g={g} maintenant={maintenant} ecrire={() => setCible({ libelle: g.noms.join(', '), eleves: g.eleves })} />
          ))}
        </div>

        {envoyes.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Messages envoyés (dernière heure)</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {envoyes.map((m) => (
                <li key={m.id} style={{ ...ligne, background: STYLES[m.style].fond }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, minWidth: 40 }}>{heure(Date.parse(m.created_at))}</span>
                  <span style={{ flex: 1 }}>{m.texte} <em style={{ color: 'var(--text-muted)' }}>— {m.signe}</em></span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.student_ids ? `${m.student_ids.length} élève(s)` : 'tous'}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cible && actif && (
          <PanneauMessage
            libelle={cible.libelle}
            fermer={() => setCible(null)}
            envoyer={async (texte, style, signe) => {
              await sendLiveMessage({ activity_id: actif, class_id: cible.eleves ? null : classeId, student_ids: cible.eleves, texte, style, signe });
              setCible(null);
              void chargerEnvoyes();
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
                    <strong style={{ fontSize: 13 }}>{q.noms.join(', ')}</strong> — {q.q}
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

function CarteGroupe({ g, maintenant, ecrire }: { g: Groupe; maintenant: number; ecrire: () => void }) {
  const d = g.w.direct;
  const e = etat(g.maj, maintenant);
  const avance = d?.sur ? Math.round((100 * (d.reponses ?? 0)) / d.sur) : null;
  return (
    <article style={{ ...carte, borderColor: aBesoin(g) ? 'var(--neg)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: e.couleur, flex: 'none' }} />
        <strong style={{ flex: 1, fontSize: 15 }}>{g.noms.join(', ')}</strong>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{g.classe} · {e.texte}</span>
        <button onClick={ecrire} style={{ ...bouton, padding: '2px 8px', fontSize: 13 }} aria-label={`Envoyer un message à ${g.noms.join(', ')}`}>✉</button>
      </div>
      {d ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '6px 0' }}>
            {d.patient} · <strong style={{ color: 'var(--text)' }}>{LIEUX[d.lieu ?? ''] ?? d.lieu ?? '—'}</strong>
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
          Fiche {g.statut === 'draft' ? 'en cours' : 'envoyée'} (version du jeu sans suivi en direct).
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

function PanneauMessage({ libelle, fermer, envoyer }: { libelle: string; fermer: () => void; envoyer: (texte: string, style: LiveMessageStyle, signe: string) => Promise<void> }) {
  const [style, setStyle] = useState<LiveMessageStyle>('alerte');
  const [signe, setSigne] = useState(SIGNES[0]);
  const [texte, setTexte] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const partir = async () => {
    if (!texte.trim()) return;
    setEnCours(true);
    setErreur(null);
    try {
      await envoyer(texte, style, signe);
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {MODELES[style].map((m) => (
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
          <button onClick={() => void partir()} disabled={!texte.trim() || enCours} style={{ ...bouton, background: 'var(--accent-strong)', color: '#fff', borderColor: 'var(--accent-strong)', fontWeight: 700, opacity: !texte.trim() || enCours ? 0.6 : 1 }}>
            {enCours ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
        {erreur && <p style={{ color: 'var(--neg)', fontSize: 13 }}>{erreur}</p>}
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '10px 0 0' }}>
          L'élève le voit en grand dans le jeu d'ici 15 s, signé « {signe} ». Le message reste valable 20 minutes.
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
