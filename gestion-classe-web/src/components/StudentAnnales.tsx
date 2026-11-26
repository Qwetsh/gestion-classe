import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ExternalLink, Search, X } from 'lucide-react';
import { PdfUrlReader } from './clouds/PdfUrlReader';
import { brevets, type Brevet, type Matiere } from '../lib/brevets';
import { fetchCustomAnnales, type BrevetItem } from '../lib/customAnnales';

/**
 * Annales du brevet dans l'espace élève (Cours › Annales). Direction A : une recherche, deux menus
 * (matière, année), puis une session ouverte à la fois et huit sujets d'abord — l'ancienne page
 * affichait les 186 sujets d'un bloc, soit 29 écrans de haut sur un téléphone.
 *
 * Les couleurs viennent de `styles/eleve.css` (racine `.el`).
 */

// Matière d'un sujet (entrées historiques sans champ = SVT)
const matiereOf = (b: Brevet): Matiere => b.matiere ?? 'SVT';

const MATIERE_ORDER: Matiere[] = ['SVT', 'Maths', 'Français', 'Histoire-Géo-EMC', 'Physique-Chimie'];

/** Sujets montrés d'abord dans une session. */
const FIRST = 8;

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function StudentAnnales() {
  const [query, setQuery] = useState('');
  const [annee, setAnnee] = useState<number | 'all'>('all');
  const [matiere, setMatiere] = useState<Matiere | 'all'>('all');
  const [preview, setPreview] = useState<Brevet | null>(null);
  /** Session dépliée : `undefined` tant que l'élève n'a rien touché (la plus récente est ouverte), `null` si toutes sont repliées. */
  const [openYear, setOpenYear] = useState<number | null | undefined>(undefined);
  /** Sessions dont tous les sujets sont affichés. */
  const [whole, setWhole] = useState<Record<number, boolean>>({});

  // Sujets ajoutés manuellement par l'enseignante (lecture seule côté élève)
  const [custom, setCustom] = useState<BrevetItem[]>([]);
  useEffect(() => {
    fetchCustomAnnales().then(setCustom).catch((e) => console.error('Annales custom:', e));
  }, []);

  const allBrevets = useMemo<BrevetItem[]>(() => [...custom, ...brevets], [custom]);
  const ANNEES = useMemo(
    () => Array.from(new Set(allBrevets.map((b) => b.annee))).sort((a, b) => b - a),
    [allBrevets],
  );
  const MATIERES = useMemo(
    () => MATIERE_ORDER.filter((m) => allBrevets.some((b) => matiereOf(b) === m)),
    [allBrevets],
  );

  // Fermeture du lecteur au clavier (Échap)
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const searching = query.trim() !== '';
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return allBrevets.filter((b) => {
      if (matiere !== 'all' && matiereOf(b) !== matiere) return false;
      if (annee !== 'all' && b.annee !== annee) return false;
      if (!q) return true;
      return normalize(`${b.theme} ${b.centre} ${b.code} ${b.annee}`).includes(q);
    });
  }, [allBrevets, query, annee, matiere]);

  const groupes = useMemo(() => {
    const map = new Map<number, BrevetItem[]>();
    for (const b of filtered) {
      if (!map.has(b.annee)) map.set(b.annee, []);
      map.get(b.annee)!.push(b);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <>
      <div className="el-head__titles">
        <h1 className="el-h1" style={{ fontSize: 22, lineHeight: '28px' }}>Annales du brevet</h1>
        <span className="el-label" style={{ fontSize: 14 }}>
          {filtered.length} sujet{filtered.length > 1 ? 's' : ''} pour t’entraîner
        </span>
      </div>

      <label className="el-search">
        <Search size={20} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un thème, un centre…"
          aria-label="Rechercher un thème ou un centre"
        />
      </label>

      <div className="el-grid2">
        <select className="el-select" aria-label="Matière" value={matiere} onChange={(e) => setMatiere(e.target.value as Matiere | 'all')}>
          <option value="all">Toutes les matières</option>
          {MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="el-select" aria-label="Année" value={String(annee)} onChange={(e) => setAnnee(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">Toutes les années</option>
          {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {filtered.length === 0 && (
        <div className="el-card el-empty"><p>Aucun sujet ne correspond à ta recherche.</p></div>
      )}

      {/* Une session ouverte à la fois ; une recherche les ouvre toutes */}
      {groupes.map(([an, items], index) => {
        const open = searching || (openYear === undefined ? index === 0 : openYear === an);
        const shown = whole[an] || searching ? items : items.slice(0, FIRST);
        const hidden = items.length - shown.length;
        return (
          <section key={an} className="el-card">
            <button
              type="button"
              className="el-row"
              aria-expanded={open}
              onClick={() => setOpenYear(open ? null : an)}
              style={open ? undefined : { borderBottom: 0 }}
            >
              <span className="el-row__body"><span className="el-row__title" style={{ fontWeight: 700 }}>Session {an}</span></span>
              <span className="el-row__end el-label">{items.length} sujet{items.length > 1 ? 's' : ''}</span>
              <ChevronRight size={20} className="el-row__chev" aria-hidden style={{ transform: open ? 'rotate(90deg)' : undefined }} />
            </button>
            {open && shown.map((b) => (
              <button key={b.url} type="button" className="el-row" onClick={() => setPreview(b)}>
                <span className="el-row__body" style={{ gap: 4 }}>
                  <span className="el-row__title">{b.theme}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span className="el-chip">{matiereOf(b)}</span>
                    <span className="el-row__meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.centre}</span>
                  </span>
                </span>
                <ChevronRight size={20} className="el-row__chev" aria-hidden />
              </button>
            ))}
            {open && hidden > 0 && (
              <button
                type="button"
                className="el-row"
                onClick={() => setWhole((w) => ({ ...w, [an]: true }))}
                style={{ justifyContent: 'center', color: 'var(--el-indigo)', fontSize: 14, fontWeight: 600 }}
              >
                Afficher {hidden === 1 ? 'le dernier sujet' : `les ${hidden} autres sujets`} de {an}
              </button>
            )}
          </section>
        );
      })}

      {/* Lecteur d'un sujet, par-dessus la page */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(24, 24, 27, 0.6)',
            display: 'flex', flexDirection: 'column',
            padding: 'max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom))', boxSizing: 'border-box',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={preview.theme}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
              maxWidth: 1100, width: '100%', margin: '0 auto',
              background: 'var(--el-surface)', borderRadius: 8,
              border: '1px solid var(--el-line)', overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, padding: '8px 8px 8px 16px', borderBottom: '1px solid var(--el-line)',
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  color: 'var(--el-text)', fontSize: 15, fontWeight: 600, margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {preview.theme}
                </p>
                <p style={{
                  color: 'var(--el-dim)', fontSize: 13, margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {matiereOf(preview)} · {preview.centre} · {preview.annee}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="el-btn"
                  title="Ouvrir dans un nouvel onglet"
                  aria-label="Ouvrir le sujet dans un nouvel onglet"
                  style={{ padding: 0, width: 44 }}
                >
                  <ExternalLink size={20} aria-hidden />
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="el-btn"
                  title="Fermer (Échap)"
                  aria-label="Fermer"
                  style={{ padding: 0, width: 44 }}
                >
                  <X size={20} aria-hidden />
                </button>
              </div>
            </div>
            {/* Lecteur commun (pdfjs) : il s'affiche aussi sur téléphone, où l'aperçu natif reste vide */}
            <PdfUrlReader url={preview.url} name={preview.theme} />
          </div>
        </div>
      )}
    </>
  );
}
