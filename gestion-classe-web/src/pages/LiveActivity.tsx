import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Layout } from '../components/Layout';
import { fetchLiveWorks, type LiveMorel, type LiveWork } from '../lib/liveQueries';

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
      if (!g || t > g.maj) m.set(cle, { cle, noms, classe: cl, activite: w.activities?.title ?? '', maj: t, statut: w.status, w });
    }
    return [...m.values()].sort((a, b) => Number(aBesoin(b)) - Number(aBesoin(a)) || b.maj - a.maj);
  }, [works, actif, classe]);

  const enLigne = groupes.filter((g) => maintenant - g.maj < EN_LIGNE).length;
  const envoyes = groupes.filter((g) => g.w.direct?.envoye || g.statut !== 'draft').length;
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
          <Chiffre valeur={String(envoyes)} libelle="carnets envoyés" />
          <Chiffre valeur={String(questions.length)} libelle="questions à Morel" />
          <Chiffre valeur={String(pasComprises)} libelle="pas comprises" alerte={pasComprises > 0} />
        </div>

        {groupes.length === 0 && !erreur && (
          <p style={{ color: 'var(--text-muted)' }}>
            Aucun groupe n'a travaillé sur cette période. Les élèves apparaissent ici dès qu'ils sont connectés avec leur code et commencent à jouer.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {groupes.map((g) => <CarteGroupe key={g.cle} g={g} maintenant={maintenant} />)}
        </div>

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

function CarteGroupe({ g, maintenant }: { g: Groupe; maintenant: number }) {
  const d = g.w.direct;
  const e = etat(g.maj, maintenant);
  const avance = d?.sur ? Math.round((100 * (d.reponses ?? 0)) / d.sur) : null;
  return (
    <article style={{ ...carte, borderColor: aBesoin(g) ? 'var(--neg)' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: e.couleur, flex: 'none' }} />
        <strong style={{ flex: 1, fontSize: 15 }}>{g.noms.join(', ')}</strong>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{g.classe} · {e.texte}</span>
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
