import { useState, type CSSProperties } from 'react';
import { ecrirePoints, type LiveMessageStyle } from '../../lib/liveQueries';

/**
 * Le panneau d'envoi d'un message (et de points) aux élèves, depuis la page En direct. Les élèves le voient en
 * grand dans le jeu, signé par un personnage de l'hôpital.
 */
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

export function PanneauMessage({ libelle, pointsInit, pourTous, patients, elevesVises, fermer, envoyer }: {
  libelle: string;
  pointsInit: number;
  pourTous: boolean;
  /** Message à la classe : les patients pour lesquels il part (un envoi par patient). */
  patients: string[];
  /** Élèves qui recevraient les points. */
  elevesVises: number;
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
          <p style={{ fontSize: 12, color: 'var(--warn)', margin: '0 0 8px' }}>
            Attention : ces points iront à chacun des {elevesVises} élèves des groupes affichés, une seule fois, dans le carnet de son patient.
          </p>
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


const carte: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 };
const champ: CSSProperties = { padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', background: 'var(--surface)', fontSize: 14, maxWidth: '100%' };
const bouton: CSSProperties = { ...champ, cursor: 'pointer' };
