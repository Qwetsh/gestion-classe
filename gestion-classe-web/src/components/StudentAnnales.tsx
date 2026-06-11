import { useEffect, useMemo, useState } from 'react';
import { brevets, type Brevet, type Matiere } from '../lib/brevets';

// Palette du dashboard élève (StudentDashboard.tsx) — dupliquée ici pour
// éviter un import circulaire dashboard <-> composant.
const T = {
  card: '#2a2018',
  cardBorder: '#3a2e22',
  surface: '#1e1712',
  text: '#e8dcc8',
  textMuted: '#a09080',
  textDim: '#6a5c4e',
  gold: '#d4a843',
  goldBright: '#e8c066',
  indigo: '#a5b4fc',
  indigoSoft: '#1e1b4b',
} as const;

const ANNEES = Array.from(new Set(brevets.map((b) => b.annee))).sort((a, b) => b - a);

// Matière d'un sujet (entrées historiques sans champ = SVT)
const matiereOf = (b: Brevet): Matiere => b.matiere ?? 'SVT';

const MATIERE_ORDER: Matiere[] = ['SVT', 'Maths', 'Français', 'Histoire-Géo-EMC', 'Physique-Chimie'];
const MATIERES = MATIERE_ORDER.filter((m) => brevets.some((b) => matiereOf(b) === m));

const MATIERE_ICONS: Record<Matiere, string> = {
  'SVT': '🧬',
  'Maths': '📐',
  'Français': '✒️',
  'Histoire-Géo-EMC': '🗺️',
  'Physique-Chimie': '⚗️',
};

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function StudentAnnales() {
  const [query, setQuery] = useState('');
  const [annee, setAnnee] = useState<number | 'all'>('all');
  const [matiere, setMatiere] = useState<Matiere | 'all'>('all');
  const [preview, setPreview] = useState<Brevet | null>(null);

  // Fermeture de la modale au clavier (Échap)
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

  return (
    <div>
      {/* En-tête */}
      <div style={{
        background: T.card, borderRadius: '16px', padding: '16px',
        marginBottom: '12px', border: `1px solid ${T.cardBorder}`, textAlign: 'center',
      }}>
        <p style={{ color: T.goldBright, fontSize: '18px', fontWeight: 700, margin: 0 }}>
          📚 Annales du Brevet
        </p>
        <p style={{ color: T.textMuted, fontSize: '12px', marginTop: '4px' }}>
          {filtered.length} sujet{filtered.length > 1 ? 's' : ''} pour t'entraîner
          {matiere !== 'all' ? ` en ${matiere}` : ''}
        </p>
      </div>

      {/* Filtres matière */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        <FilterChip active={matiere === 'all'} onClick={() => setMatiere('all')}>Toutes</FilterChip>
        {MATIERES.map((m) => (
          <FilterChip key={m} active={matiere === m} onClick={() => setMatiere(m)}>
            {MATIERE_ICONS[m]} {m}
          </FilterChip>
        ))}
      </div>

      {/* Filtres année */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        <FilterChip active={annee === 'all'} onClick={() => setAnnee('all')}>Toutes années</FilterChip>
        {ANNEES.map((a) => (
          <FilterChip key={a} active={annee === a} onClick={() => setAnnee(a)}>{a}</FilterChip>
        ))}
      </div>

      {/* Recherche */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un thème, un centre…"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 14px',
          marginBottom: '12px', borderRadius: '10px',
          border: `1px solid ${T.cardBorder}`, background: T.surface,
          color: T.text, fontSize: '14px', outline: 'none',
        }}
      />

      {filtered.length === 0 && (
        <p style={{ color: T.textMuted, textAlign: 'center', padding: '32px 0', fontSize: '13px' }}>
          Aucune annale ne correspond à ta recherche.
        </p>
      )}

      {/* Liste groupée par session */}
      {groupes.map(([an, items]) => (
        <div key={an} style={{ marginBottom: '16px' }}>
          <p style={{
            color: T.textDim, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            margin: '0 0 8px 4px',
          }}>
            Session {an} · {items.length} sujet{items.length > 1 ? 's' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((b) => (
              <div key={b.url} style={{
                background: T.card, borderRadius: '12px', padding: '12px',
                border: `1px solid ${T.cardBorder}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: T.indigo,
                    background: T.indigoSoft, borderRadius: '6px', padding: '2px 8px',
                    flexShrink: 0,
                  }}>
                    {MATIERE_ICONS[matiereOf(b)]} {matiereOf(b)}
                  </span>
                  <span style={{
                    fontSize: '11px', color: T.textDim,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {b.centre}
                  </span>
                </div>
                <p style={{ color: T.text, fontSize: '14px', fontWeight: 600, margin: '0 0 10px', lineHeight: 1.35 }}>
                  {b.theme}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPreview(b)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      background: T.gold, color: '#1a1410',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Visualiser
                  </button>
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ouvrir dans un nouvel onglet"
                    style={{
                      padding: '8px 14px', borderRadius: '8px',
                      border: `1px solid ${T.cardBorder}`, background: T.surface,
                      color: T.textMuted, fontSize: '13px', textDecoration: 'none',
                    }}
                  >
                    ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modale de visualisation PDF */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column',
            padding: '12px', boxSizing: 'border-box',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              maxWidth: 1100, width: '100%', margin: '0 auto',
              background: T.card, borderRadius: '16px',
              border: `1px solid ${T.cardBorder}`,
              overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${T.cardBorder}`,
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  color: T.text, fontSize: '14px', fontWeight: 700, margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {preview.theme}
                </p>
                <p style={{
                  color: T.textDim, fontSize: '11px', margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {matiereOf(preview)} · {preview.centre} · {preview.annee}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 12px', borderRadius: '8px',
                    background: T.gold, color: '#1a1410',
                    fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  Ouvrir ↗
                </a>
                <button
                  onClick={() => setPreview(null)}
                  title="Fermer (Échap)"
                  style={{
                    width: '34px', height: '34px', borderRadius: '8px',
                    border: `1px solid ${T.cardBorder}`, background: T.surface,
                    color: T.textMuted, fontSize: '16px', cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <iframe
              src={preview.url}
              title={preview.theme}
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: '8px',
        border: `1px solid ${active ? T.gold : T.cardBorder}`,
        background: active ? T.gold : T.surface,
        color: active ? '#1a1410' : T.textMuted,
        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
}
