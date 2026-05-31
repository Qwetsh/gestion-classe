import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Layout } from '../components/Layout';
import { brevets, type Brevet, type Matiere } from '../lib/brevets';

const ANNEES = Array.from(new Set(brevets.map((b) => b.annee))).sort((a, b) => b - a);

// Matière d'un sujet (entrées historiques sans champ = SVT)
const matiereOf = (b: Brevet): Matiere => b.matiere ?? 'SVT';

// Ordre d'affichage des onglets matière, restreint à celles réellement présentes
const MATIERE_ORDER: Matiere[] = ['SVT', 'Maths', 'Français', 'Histoire-Géo-EMC', 'Physique-Chimie'];
const MATIERES = MATIERE_ORDER.filter((m) => brevets.some((b) => matiereOf(b) === m));

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function Brevets() {
  const [query, setQuery] = useState('');
  const [annee, setAnnee] = useState<number | 'all'>('all');
  const [matiere, setMatiere] = useState<Matiere | 'all'>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [preview, setPreview] = useState<Brevet | null>(null);

  // Fermeture de la modale de visualisation au clavier (Échap)
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return brevets.filter((b) => {
      if (matiere !== 'all' && matiereOf(b) !== matiere) return false;
      if (annee !== 'all' && b.annee !== annee) return false;
      if (!q) return true;
      return normalize(`${b.theme} ${b.centre} ${b.code} ${b.annee}`).includes(q);
    });
  }, [query, annee, matiere]);

  const groupes = useMemo(() => {
    const map = new Map<number, Brevet[]>();
    for (const b of filtered) {
      if (!map.has(b.annee)) map.set(b.annee, []);
      map.get(b.annee)!.push(b);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const copyLink = async (url: string, code: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      /* clipboard indisponible */
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1
            className="text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 40, letterSpacing: '-0.02em', fontStyle: 'italic' }}
          >
            Annales Brevet
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            {filtered.length} sujet{filtered.length > 1 ? 's' : ''} de DNB
            {matiere !== 'all' ? ` — ${matiere}` : ' — toutes matières'}
          </p>
        </div>

        {/* Onglets matière */}
        {MATIERES.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Chip active={matiere === 'all'} onClick={() => setMatiere('all')}>Toutes matières</Chip>
            {MATIERES.map((m) => (
              <Chip key={m} active={matiere === m} onClick={() => setMatiere(m)}>{m}</Chip>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un thème, un centre, un code…"
            className="flex-1 min-w-[220px] px-4 py-2 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--indigo)]"
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
          <div className="flex flex-wrap gap-1.5">
            <Chip active={annee === 'all'} onClick={() => setAnnee('all')}>Toutes</Chip>
            {ANNEES.map((a) => (
              <Chip key={a} active={annee === a} onClick={() => setAnnee(a)}>{a}</Chip>
            ))}
          </div>
        </div>

        {filtered.length === 0 && (
          <p className="text-[var(--text-muted)] py-12 text-center">Aucune annale ne correspond à la recherche.</p>
        )}

        {groupes.map(([an, items]) => (
          <section key={an} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)]">
              Session {an} · {items.length} sujet{items.length > 1 ? 's' : ''}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((b) => (
                <div
                  key={b.url}
                  className="flex flex-col p-4 bg-[var(--surface)] border border-[var(--border)]"
                  style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-1)' }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {matiere === 'all' && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 text-[var(--indigo)] shrink-0"
                          style={{ background: 'var(--indigo-soft)', borderRadius: 'var(--radius-sm)' }}
                        >
                          {matiereOf(b)}
                        </span>
                      )}
                      <span className="text-xs font-medium text-[var(--text-dim)] truncate">
                        {b.centre}
                      </span>
                    </div>
                    {b.points > 0 && (
                      <span className="text-xs text-[var(--text-dim)] tabular-nums shrink-0">{b.points} pts</span>
                    )}
                  </div>

                  <h3 className="font-semibold text-[var(--text)] leading-snug flex-1">{b.theme}</h3>
                  {b.code && <p className="text-xs text-[var(--text-dim)] mt-1 font-mono">{b.code}</p>}

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setPreview(b)}
                      className="flex-1 text-center text-sm font-medium py-2 text-white transition-opacity hover:opacity-90"
                      style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-sm)' }}
                    >
                      Visualiser
                    </button>
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir dans un nouvel onglet"
                      className="px-3 py-2 text-sm bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] transition-colors"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      ↗
                    </a>
                    <button
                      onClick={() => copyLink(b.url, b.code || b.theme)}
                      title="Copier le lien direct"
                      className="px-3 py-2 text-sm bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] transition-colors"
                      style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                      {copied === (b.code || b.theme) ? 'Copié ✓' : 'Lien'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Modale de visualisation PDF */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column',
            padding: 24, boxSizing: 'border-box',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              maxWidth: 1100, width: '100%', margin: '0 auto',
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            {/* En-tête modale */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text)] truncate">{preview.theme}</div>
                <div className="text-xs text-[var(--text-dim)] truncate">
                  {preview.centre} · {preview.annee}{preview.code ? ` · ${preview.code}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium py-2 px-3 text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-sm)' }}
                >
                  Ouvrir dans un onglet ↗
                </a>
                <button
                  onClick={() => setPreview(null)}
                  title="Fermer (Échap)"
                  className="w-9 h-9 flex items-center justify-center text-lg bg-[var(--surface-3)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)] transition-colors"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                >
                  ×
                </button>
              </div>
            </div>
            {/* Viewer PDF natif */}
            <iframe
              src={preview.url}
              title={preview.theme}
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm font-medium transition-colors border"
      style={{
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--indigo)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-muted)',
        borderColor: active ? 'var(--indigo)' : 'var(--border)',
      }}
    >
      {children}
    </button>
  );
}
