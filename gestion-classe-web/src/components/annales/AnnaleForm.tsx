/**
 * Ajouter un sujet d'annale : le PDF va dans le bucket public `brevets` (sous-dossier custom/), la
 * fiche dans `custom_annales`. En SVT, le thème du programme range le sujet (proposé d'après le
 * titre, modifiable).
 */
import { useState } from 'react';
import { Modal } from '../Modal';
import type { Matiere } from '../../lib/brevets';
import { MATIERES, PROGRAMMES, guessProgramme, type Programme } from '../../lib/annalesLibrary';
import { addCustomAnnale, type BrevetItem } from '../../lib/customAnnales';

interface Props {
  /** Matière de l'onglet ouvert, proposée par défaut. */
  matiere: Matiere;
  onAdded: (item: BrevetItem) => void;
  onClose: () => void;
}

export function AnnaleForm({ matiere: initialMatiere, onAdded, onClose }: Props) {
  const [matiere, setMatiere] = useState<Matiere>(initialMatiere);
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [centre, setCentre] = useState('');
  const [theme, setTheme] = useState('');
  const [points, setPoints] = useState('');
  const [code, setCode] = useState('');
  // null = pas encore choisi : on suit ce que le titre laisse deviner
  const [programme, setProgramme] = useState<Programme | '' | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shownProgramme = programme ?? guessProgramme(theme) ?? '';

  const submit = async () => {
    const year = Number(annee);
    if (!theme.trim()) { setError('Indique le titre du sujet.'); return; }
    if (!Number.isInteger(year) || year < 1990 || year > 2100) { setError('Indique l’année de la session.'); return; }
    if (!file) { setError('Choisis le fichier PDF.'); return; }
    setBusy(true);
    setError(null);
    try {
      const item = await addCustomAnnale({
        matiere, annee: year, centre, theme, points: Number(points) || 0, code,
        programme: shownProgramme || null,
      }, file);
      onAdded(item);
    } catch (err) {
      console.error('Ajout annale :', err);
      setError('L’ajout a échoué. Vérifie ta connexion et réessaie.');
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Ajouter un sujet"
      size="lg"
      zIndex={60}
      footer={(
        <div className="flex items-center justify-end gap-2">
          {error && <span className="an-form__error" role="alert">{error}</span>}
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn--primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      )}
    >
      <div className="an-form">
        <label className="an-field">
          <span>Titre du sujet</span>
          <input className="an-input" value={theme} onChange={(e) => setTheme(e.target.value)} autoFocus placeholder="Le syndrome du museau blanc chez les chauves-souris" />
        </label>

        <div className="an-form__row">
          <label className="an-field">
            <span>Matière</span>
            <select className="an-input" value={matiere} onChange={(e) => setMatiere(e.target.value as Matiere)}>
              {MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="an-field an-field--short">
            <span>Session</span>
            <input className="an-input" inputMode="numeric" value={annee} onChange={(e) => setAnnee(e.target.value)} />
          </label>
        </div>

        {matiere === 'SVT' && (
          <label className="an-field">
            <span>Thème du programme</span>
            <select className="an-input" value={shownProgramme} onChange={(e) => setProgramme(e.target.value as Programme | '')}>
              <option value="">À classer</option>
              {PROGRAMMES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        )}

        <div className="an-form__row">
          <label className="an-field">
            <span>Centre <em>facultatif</em></span>
            <input className="an-input" value={centre} onChange={(e) => setCentre(e.target.value)} placeholder="Métropole" list="an-centres" />
            <datalist id="an-centres">
              {['Métropole', 'Amérique du Nord', 'Amérique du Sud', 'Asie', 'Centres étrangers', 'Polynésie', 'Nouvelle-Calédonie'].map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="an-field an-field--short">
            <span>Points <em>facultatif</em></span>
            <input className="an-input" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="25" />
          </label>
        </div>

        <label className="an-field">
          <span>Code <em>facultatif</em></span>
          <input className="an-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="26GENSCAN1" />
        </label>

        <label className="an-field">
          <span>Fichier PDF</span>
          <input type="file" accept="application/pdf" className="an-file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
    </Modal>
  );
}
