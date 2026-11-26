/**
 * Annales du brevet, rangées comme « Mes cours » : une matière à la fois, des sections repliables,
 * une ligne par sujet. En SVT, par thème du programme (ou par session) ; ailleurs, par session.
 *
 * Deux sources fusionnées : le catalogue statique (`brevets.ts`, généré) et les sujets ajoutés
 * depuis l'app (`custom_annales`, partagés avec l'espace élève).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Layout } from '../components/Layout';
import { AnnaleList } from '../components/annales/AnnaleList';
import { AnnaleViewer } from '../components/annales/AnnaleViewer';
import { AnnaleForm } from '../components/annales/AnnaleForm';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import { brevets, type Matiere } from '../lib/brevets';
import { fetchCustomAnnales, deleteCustomAnnale, AnnaleNotOwnedError, type BrevetItem } from '../lib/customAnnales';
import { MATIERES, filterAnnales, groupAnnales, matiereOf, type AnnaleView } from '../lib/annalesLibrary';
import '../styles/mes-cours.css';
import '../styles/annales.css';

const PREFS_KEY = 'annales-prefs';

interface Prefs { matiere: Matiere; view: AnnaleView }

function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<Prefs>;
    return {
      matiere: p.matiere && MATIERES.includes(p.matiere) ? p.matiere : 'SVT',
      view: p.view === 'session' ? 'session' : 'programme',
    };
  } catch {
    return { matiere: 'SVT', view: 'programme' };
  }
}

export function Brevets() {
  const { toast, confirm } = useUIFeedback();
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [query, setQuery] = useState('');
  const [custom, setCustom] = useState<BrevetItem[]>([]);
  const [opened, setOpened] = useState<BrevetItem | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchCustomAnnales().then(setCustom).catch((e) => console.error('Annales ajoutées :', e));
  }, []);

  const updatePrefs = (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
      return next;
    });
  };

  const all = useMemo<BrevetItem[]>(() => [...custom, ...brevets], [custom]);
  const counts = useMemo(() => {
    const c = new Map<Matiere, number>();
    for (const b of all) c.set(matiereOf(b), (c.get(matiereOf(b)) ?? 0) + 1);
    return c;
  }, [all]);

  const { matiere } = prefs;
  // Le classement par thème du programme n'existe qu'en SVT
  const view: AnnaleView = matiere === 'SVT' ? prefs.view : 'session';
  const ofMatiere = useMemo(() => all.filter((b) => matiereOf(b) === matiere), [all, matiere]);
  const shown = useMemo(() => filterAnnales(ofMatiere, query), [ofMatiere, query]);
  const sections = useMemo(() => groupAnnales(shown, view), [shown, view]);
  const showPoints = useMemo(() => new Set(ofMatiere.map((b) => b.points)).size > 1, [ofMatiere]);
  const searching = query.trim().length > 0;

  const closeViewer = useCallback(() => setOpened(null), []);

  const copyLink = async (b: BrevetItem) => {
    try {
      await navigator.clipboard.writeText(b.url);
      toast('Lien du sujet copié.', 'success');
    } catch {
      toast('Copie impossible : ouvre le sujet dans un onglet et copie son adresse.');
    }
  };

  const remove = async (b: BrevetItem) => {
    const ok = await confirm({
      title: 'Supprimer ce sujet ?',
      message: `« ${b.theme} » et son PDF seront supprimés, pour toi comme pour les élèves.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCustomAnnale(b);
      setCustom((prev) => prev.filter((c) => c.id !== b.id));
    } catch (err) {
      console.error('Suppression annale :', err);
      toast(err instanceof AnnaleNotOwnedError ? err.message : 'La suppression a échoué.');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Annales du brevet</h1>
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>+ Ajouter un sujet</button>
        </div>

        <div className="mc-views an-subjects" role="tablist" aria-label="Matière">
          {MATIERES.filter((m) => counts.has(m)).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={matiere === m} className="mc-view" onClick={() => updatePrefs({ matiere: m })}>
              {m}
            </button>
          ))}
        </div>

        <div className="an-toolbar">
          <label className="mc-search">
            <Search size={16} className="mc-search__icon" aria-hidden />
            <input
              type="search"
              className="mc-search__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              placeholder={matiere === 'SVT' ? 'Chercher un sujet : séisme, génétique, 2024…' : 'Chercher un centre, une année…'}
              aria-label={`Chercher dans les annales de ${matiere}`}
            />
          </label>
          {matiere === 'SVT' && (
            <div className="mc-views" role="tablist" aria-label="Rangement">
              <button type="button" role="tab" aria-selected={view === 'programme'} className="mc-view" onClick={() => updatePrefs({ view: 'programme' })}>Par thème</button>
              <button type="button" role="tab" aria-selected={view === 'session'} className="mc-view" onClick={() => updatePrefs({ view: 'session' })}>Par session</button>
            </div>
          )}
        </div>

        {searching && shown.length === 0 && (
          <div className="mc-empty">Aucun sujet de {matiere} ne correspond à « {query.trim()} ».</div>
        )}

        {sections.length > 0 && (
          <AnnaleList
            scope={`${matiere}:${view}`}
            sections={sections}
            view={view}
            showPoints={showPoints}
            expandAll={searching}
            onOpen={setOpened}
            onNewTab={(b) => window.open(b.url, '_blank', 'noopener,noreferrer')}
            onCopyLink={(b) => void copyLink(b)}
            onDelete={(b) => void remove(b)}
          />
        )}
      </div>

      {opened && <AnnaleViewer annale={opened} onClose={closeViewer} />}

      {adding && (
        <AnnaleForm
          matiere={matiere}
          onClose={() => setAdding(false)}
          onAdded={(item) => {
            setCustom((prev) => [item, ...prev]);
            setAdding(false);
            updatePrefs({ matiere: matiereOf(item) });
            toast(`Sujet ajouté : « ${item.theme} ».`, 'success');
          }}
        />
      )}
    </Layout>
  );
}
