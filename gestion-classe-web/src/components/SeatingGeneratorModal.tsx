/**
 * Génération automatique du plan de classe sous contraintes.
 *
 * Deux volets :
 *  - les CONTRAINTES par élève (« Léa devant », « Noah pas à côté de Tom »), durables,
 *    enregistrées dans seating_constraints (migration 045) ;
 *  - les RÈGLES de la classe (PAP devant, alterner, éloigner les bavards…), cochées
 *    à chaque génération et mémorisées par navigateur.
 *
 * « Générer » calcule un plan (seatingAuto.ts), l'applique dans l'éditeur (non enregistré :
 * l'enseignant retouche à la main puis clique Sauvegarder) et liste ce qui n'a pas pu
 * être respecté.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { useUIFeedback } from '../contexts/UIFeedbackContext';
import {
  DEFAULT_RULES,
  PAIR_KINDS,
  constraintLabel,
  generateSeating,
  seededRng,
  type Positions,
  type SeatingConstraint,
  type SeatingConstraintKind,
  type SeatingResult,
  type SeatingRoomInfo,
  type SeatingRules,
  type SeatingStudentInfo,
} from '../lib/seatingAuto';
import {
  addSeatingConstraint,
  deleteSeatingConstraint,
  fetchSeatingConstraints,
  type StoredSeatingConstraint,
} from '../lib/seatingConstraintsQueries';

const KINDS: { kind: SeatingConstraintKind; label: string; help: string }[] = [
  { kind: 'front', label: 'devant', help: 'Dans les rangées proches du tableau (vue, audition, attention)' },
  { kind: 'back', label: 'au fond', help: 'Dans les rangées du fond' },
  { kind: 'not_back', label: 'pas au fond', help: 'N’importe où sauf les rangées du fond' },
  { kind: 'edge', label: 'au bord', help: 'Colonne extrême : près du mur ou de la fenêtre' },
  { kind: 'center', label: 'au centre', help: 'Colonne centrale, face au tableau' },
  { kind: 'alone', label: 'seul à sa table', help: 'Aucun voisin immédiat sur sa rangée' },
  { kind: 'fixed', label: 'place fixe', help: 'Garde la place qu’il occupe sur le plan actuel' },
  { kind: 'next_to', label: 'à côté de…', help: 'Voisins immédiats sur la même rangée (binôme, tutorat)' },
  { kind: 'not_next_to', label: 'pas à côté de…', help: 'Ni voisins, ni l’un devant l’autre, ni en diagonale' },
  { kind: 'far_from', label: 'éloigné de…', help: 'Au moins 3 places d’écart dans toutes les directions' },
];

const RULES: { key: keyof SeatingRules; label: string; help: string }[] = [
  { key: 'accommodationsFront', label: 'Élèves PAP / PPRE / PAI devant', help: 'Utilise les aménagements renseignés sur la fiche élève' },
  { key: 'separateTalkers', label: 'Éloigner les bavards les uns des autres', help: 'D’après les malus du trimestre en cours' },
  { key: 'mixLevels', label: 'Mélanger les niveaux', help: 'Pas deux élèves fragiles (note de comportement < 10) côte à côte' },
  { key: 'alternateGender', label: 'Alterner filles / garçons', help: 'Voisins de genre différent quand c’est possible' },
  { key: 'newNeighbors', label: 'Nouveaux voisins', help: 'Évite de reformer les binômes du plan actuel' },
  { key: 'fillFromFront', label: 'Remplir depuis l’avant', help: 'Les places libres restent au fond (décoché : réparties dans toute la salle)' },
  { key: 'keepPlaced', label: 'Garder les élèves déjà placés', help: 'Ne place que les élèves « non placés » ; les autres ne bougent pas' },
];

const RULES_STORAGE_KEY = 'gc_seating_rules';
const selectCls = 'w-full px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--indigo)]';

function loadRules(): SeatingRules {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) return { ...DEFAULT_RULES, ...JSON.parse(raw) };
  } catch { /* stockage indisponible */ }
  return DEFAULT_RULES;
}

interface Props {
  userId: string;
  classId: string;
  students: SeatingStudentInfo[];
  room: SeatingRoomInfo & { name: string };
  currentPositions: Positions;
  onApply: (positions: Positions) => void;
  onClose: () => void;
}

export function SeatingGeneratorModal({ userId, classId, students, room, currentPositions, onApply, onClose }: Props) {
  const { toast } = useUIFeedback();
  const [constraints, setConstraints] = useState<StoredSeatingConstraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<SeatingRules>(loadRules);
  const [result, setResult] = useState<SeatingResult | null>(null);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));

  // Formulaire d'ajout
  const [studentId, setStudentId] = useState('');
  const [kind, setKind] = useState<SeatingConstraintKind>('front');
  const [otherId, setOtherId] = useState('');
  const [adding, setAdding] = useState(false);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const sorted = useMemo(() => [...students].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr')), [students]);
  const isPair = PAIR_KINDS.has(kind);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSeatingConstraints(classId)
      .then((rows) => { if (!cancelled) setConstraints(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId]);

  useEffect(() => {
    try { localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules)); } catch { /* stockage indisponible */ }
  }, [rules]);

  const handleAdd = async () => {
    if (!studentId) return;
    if (isPair && (!otherId || otherId === studentId)) return;
    const duplicate = constraints.some((c) => c.student_id === studentId && c.kind === kind && (c.other_student_id ?? null) === (isPair ? otherId : null));
    if (duplicate) { toast('Cette contrainte existe déjà.', 'info'); return; }
    setAdding(true);
    try {
      const created = await addSeatingConstraint(userId, classId, {
        student_id: studentId,
        kind,
        other_student_id: isPair ? otherId : null,
        params: kind === 'far_from' ? { minDistance: 3 } : null,
      });
      setConstraints((prev) => [...prev, created]);
      setOtherId('');
    } catch (err) {
      console.error(err);
      toast('Impossible d’enregistrer la contrainte.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = constraints;
    setConstraints((c) => c.filter((x) => x.id !== id));
    try {
      await deleteSeatingConstraint(id);
    } catch (err) {
      console.error(err);
      setConstraints(prev);
      toast('Suppression impossible.');
    }
  };

  const run = (newSeed?: number) => {
    const s = newSeed ?? seed;
    setSeed(s);
    const res = generateSeating({
      students,
      room,
      constraints: constraints as SeatingConstraint[],
      rules,
      currentPositions,
      rng: seededRng(s),
    });
    setResult(res);
    onApply(res.positions);
  };

  const describe = (c: SeatingConstraint) => {
    const a = byId.get(c.student_id)?.pseudo ?? '?';
    const b = c.other_student_id ? byId.get(c.other_student_id)?.pseudo ?? '?' : null;
    return b ? `${a} ${constraintLabel(c.kind)} ${b}` : `${a} · ${constraintLabel(c.kind)}`;
  };

  const seatsAvailable = room.grid_rows * room.grid_cols - (room.disabled_cells?.length ?? 0);

  return (
    <Modal isOpen onClose={onClose} title="Générer le plan de classe" icon={<span>✨</span>} size="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
          {students.length} élèves · {seatsAvailable} places dans « {room.name} ». Le plan généré remplace celui de l'éditeur :
          retouchez-le à la main si besoin, puis cliquez « Sauvegarder ».
        </p>

        {/* Contraintes par élève */}
        <section>
          <SectionTitle>Contraintes par élève</SectionTitle>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            Durables : elles restent attachées à la classe et servent pour toutes les salles.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isPair ? '1fr auto 1fr auto' : '1fr auto auto', gap: 6, alignItems: 'center' }}>
            <select className={selectCls} value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Élève">
              <option value="">Élève…</option>
              {sorted.map((s) => <option key={s.id} value={s.id}>{s.pseudo}</option>)}
            </select>
            <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as SeatingConstraintKind)} aria-label="Contrainte" title={KINDS.find((k) => k.kind === kind)?.help}>
              {KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
            {isPair && (
              <select className={selectCls} value={otherId} onChange={(e) => setOtherId(e.target.value)} aria-label="Autre élève">
                <option value="">Autre élève…</option>
                {sorted.filter((s) => s.id !== studentId).map((s) => <option key={s.id} value={s.id}>{s.pseudo}</option>)}
              </select>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleAdd}
              disabled={adding || !studentId || (isPair && !otherId)}
              style={{ fontSize: 13 }}
            >
              + Ajouter
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4 }}>{KINDS.find((k) => k.kind === kind)?.help}</div>

          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Chargement…</div>
          ) : constraints.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Aucune contrainte pour cette classe.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {constraints.map((c) => {
                const violated = result?.violations.some((v) => v.constraintId === c.id);
                return (
                  <li
                    key={c.id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999,
                      background: violated ? 'var(--neg-soft)' : 'var(--surface-2)', color: violated ? 'var(--neg)' : 'var(--text)',
                      fontSize: 12.5, border: '1px solid var(--border)',
                    }}
                    title={violated ? 'Non respectée sur le dernier plan généré' : undefined}
                  >
                    {violated && <span aria-hidden>⚠</span>}
                    <span>{describe(c)}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      aria-label="Supprimer la contrainte"
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0 }}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Règles de la classe */}
        <section>
          <SectionTitle>Règles</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 4 }}>
            {RULES.map((r) => (
              <label key={r.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer', padding: '4px 6px', borderRadius: 6 }} title={r.help}>
                <input
                  type="checkbox"
                  checked={rules[r.key]}
                  onChange={(e) => setRules((prev) => ({ ...prev, [r.key]: e.target.checked }))}
                  style={{ marginTop: 3 }}
                />
                <span>
                  <span style={{ display: 'block', fontWeight: 600 }}>{r.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{r.help}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Résultat */}
        {result && (
          <section>
            <SectionTitle>Résultat</SectionTitle>
            {result.unplaced.length > 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--neg)', margin: '0 0 6px' }}>
                {result.unplaced.length} élève{result.unplaced.length > 1 ? 's' : ''} sans place (salle trop petite) :{' '}
                {result.unplaced.map((id) => byId.get(id)?.pseudo ?? '?').join(', ')}
              </p>
            )}
            {result.violations.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--pos)', margin: 0 }}>✓ Toutes les contraintes et règles sont respectées.</p>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                  {result.violations.length} point{result.violations.length > 1 ? 's' : ''} non respecté{result.violations.length > 1 ? 's' : ''} :
                  relancez avec « Autre proposition » ou retouchez à la main.
                </p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {result.violations.slice(0, 12).map((v, i) => (
                    <li key={i} style={{ color: v.constraintId.startsWith('rule:') ? 'var(--text-muted)' : 'var(--neg)' }}>{v.message}</li>
                  ))}
                  {result.violations.length > 12 && <li style={{ color: 'var(--text-dim)' }}>… et {result.violations.length - 12} autres</li>}
                </ul>
              </>
            )}
          </section>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>{result ? 'Fermer' : 'Annuler'}</button>
        {result && (
          <button type="button" className="btn btn--ghost" onClick={() => run(Math.floor(Math.random() * 1e9))} disabled={students.length === 0}>
            Autre proposition
          </button>
        )}
        <button type="button" className="btn btn--accent" onClick={() => run()} disabled={students.length === 0 || loading}>
          {result ? 'Regénérer' : 'Générer'}
        </button>
      </div>
    </Modal>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>
      {children}
    </div>
  );
}
