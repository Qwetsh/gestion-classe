import { useState } from 'react';
import { ASSESSMENT_KIND_LABEL, type AssessmentKind, type CarnetStudent, type ClassRow } from '../lib/evaluationQueries';
import { accommodationTags, accommodationTitle } from '../lib/accommodations';
import { levelFromClassName } from '../lib/boardsQueries';

/** Affichage d'un nombre à la française, sans zéro décimal inutile. */
const showNum = (n: number) => String(n).replace('.', ',');

// ============================================================
// Modale création / édition d'une évaluation
// ============================================================

export interface AssessmentValues {
  name: string;
  bareme: number;
  coefficient: number;
  kind: AssessmentKind;
  date: string;
  countsInAverage: boolean;
  /** Titre court de l'en-tête de colonne du carnet ('' = le nom). Migration 060. */
  shortName: string;
  /** Séquence du programme ('' = aucune). Migration 060. */
  sequence: string;
  /** Création seulement : les classes sur lesquelles créer l'évaluation. */
  classIds?: string[];
  /** Édition seulement : répercuter sur les autres classes de la série. */
  applyToSeries?: boolean;
  /**
   * Édition seulement, quand le barème change et que des notes existent déjà :
   * `convert` met les notes brutes à la nouvelle échelle (15/20 → 7,5/10, moyenne
   * inchangée), `keep` les laisse telles quelles (le /20 change, donc la moyenne aussi).
   */
  baremeMode?: 'convert' | 'keep';
}

export function AssessmentModal({
  title, className, initial, classes, currentClassId, seriesId, onSubmit, onClose, onDelete,
  students, adaptedIds, onToggleAdapted, gradeRaws, sequences = [], defaultSequence = '',
}: {
  title: string;
  className: string;
  initial?: AssessmentValues;
  /** Toutes les classes de l'utilisateur (création multi-classes). */
  classes?: ClassRow[];
  currentClassId?: string;
  /** Série de l'évaluation en cours d'édition, si elle en a une. */
  seriesId?: string | null;
  onSubmit: (values: AssessmentValues) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  /** Édition : élèves de la classe, pour cocher les aménagements. */
  students?: CarnetStudent[];
  adaptedIds?: Set<string>;
  /** Écrit immédiatement : un aménagement coché ne doit pas dépendre du bouton Enregistrer. */
  onToggleAdapted?: (studentId: string, value: boolean) => Promise<void>;
  /** Notes brutes déjà saisies : sert à décider quoi faire d'un changement de barème. */
  gradeRaws?: number[];
  /** Séquences déjà utilisées dans la classe : proposées à la saisie. */
  sequences?: string[];
  /** Création : séquence pré-remplie (celle du filtre du carnet). */
  defaultSequence?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [bareme, setBareme] = useState(String(initial?.bareme ?? 20));
  const [coefficient, setCoefficient] = useState(String(initial?.coefficient ?? 1));
  const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? 'ecrit');
  /** Éval créée par une séance de groupe (migration 063) : type et barème suivent la séance. */
  const fromGroupSession = initial?.kind === 'groupe';
  const [date, setDate] = useState(initial?.date ?? '');
  const [countsInAverage, setCountsInAverage] = useState(initial?.countsInAverage ?? true);
  const [shortName, setShortName] = useState(initial?.shortName ?? '');
  const [sequence, setSequence] = useState(initial?.sequence ?? defaultSequence);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Création multi-classes ---
  const level = levelFromClassName(className);
  /** Classes du même niveau, celle en cours exclue : la proposition par défaut. */
  const sameLevel = (classes ?? []).filter(
    (c) => c.id !== currentClassId && level !== null && levelFromClassName(c.name) === level,
  );
  const canSpread = !!classes && !!currentClassId && classes.length > 1;
  const [spread, setSpread] = useState(false);
  const [targets, setTargets] = useState<string[]>(() => sameLevel.map((c) => c.id));
  const toggleTarget = (id: string) =>
    setTargets((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // --- Propagation à la série (édition) ---
  const [applyToSeries, setApplyToSeries] = useState(false);

  // --- Changement de barème avec des notes déjà saisies ---
  const oldBareme = initial?.bareme ?? null;
  const parsedBareme = Number(bareme.replace(',', '.'));
  const noteCount = gradeRaws?.length ?? 0;
  const maxRaw = noteCount > 0 ? Math.max(...(gradeRaws as number[])) : null;
  const baremeChanged =
    oldBareme !== null && Number.isFinite(parsedBareme) && parsedBareme > 0 && parsedBareme !== oldBareme;
  /** Garder les notes brutes est impossible si l'une d'elles dépasse le nouveau barème. */
  const canKeepRaw = maxRaw === null || maxRaw <= parsedBareme;
  /** Étape de confirmation : on ne touche pas aux notes sans le dire. */
  const [askBareme, setAskBareme] = useState(false);

  const run = async (baremeMode?: 'convert' | 'keep') => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Donne un nom à l’évaluation.'); return; }
    const b = Number(bareme.replace(',', '.'));
    const c = Number(coefficient.replace(',', '.'));
    if (!Number.isFinite(b) || b <= 0) { setError('Barème invalide.'); return; }
    if (!Number.isFinite(c) || c < 0) { setError('Coefficient invalide.'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: trimmed, bareme: b, coefficient: c, kind, date, countsInAverage,
        shortName: shortName.trim(), sequence: sequence.trim(),
        classIds: canSpread && spread && currentClassId ? [currentClassId, ...targets] : undefined,
        applyToSeries,
        baremeMode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
      setBusy(false);
      setAskBareme(false);
    }
  };

  const submit = async () => {
    // Changer le barème de 20 à 10 sans rien dire diviserait (ou doublerait) des moyennes
    // déjà lues et recopiées. On demande, une fois, avant d'écrire.
    if (baremeChanged && noteCount > 0) { setError(null); setAskBareme(true); return; }
    await run();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 440, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: 'var(--shadow-2)' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>{title}</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>{className}</p>

        {error && (
          <div style={{ background: 'var(--neg-soft)', color: 'var(--neg)', padding: '6px 10px', borderRadius: 8, fontSize: 12, marginTop: 12 }}>
            {error}
          </div>
        )}

        <label style={lbl}>Nom</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Éval Nutrition" style={inp} autoFocus />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="assessment-short-name">Titre court <span style={{ fontWeight: 400 }}>(en-tête du carnet)</span></label>
            <input id="assessment-short-name" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder={name.trim() ? name.trim().slice(0, 14) : 'Éval 1'} maxLength={24} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="assessment-sequence">Séquence</label>
            <input id="assessment-sequence" value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="Séquence 1" list="assessment-sequences" style={inp} />
            <datalist id="assessment-sequences">
              {sequences.map((q) => <option key={q} value={q} />)}
            </datalist>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)} style={inp} disabled={fromGroupSession}>
              {(Object.keys(ASSESSMENT_KIND_LABEL) as AssessmentKind[])
                .filter((k) => k !== 'groupe' || fromGroupSession)
                .map((k) => (
                  <option key={k} value={k}>{ASSESSMENT_KIND_LABEL[k]}</option>
                ))}
            </select>
          </div>
          <div style={{ width: 130 }}>
            <label style={lbl}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Barème</label>
            <input value={bareme} onChange={(e) => setBareme(e.target.value)} inputMode="decimal" style={inp} disabled={fromGroupSession} title={fromGroupSession ? 'Somme des critères de la séance de groupe' : undefined} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Coefficient</label>
            <input value={coefficient} onChange={(e) => setCoefficient(e.target.value)} inputMode="decimal" style={inp} />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={countsInAverage} onChange={(e) => setCountsInAverage(e.target.checked)} />
          Compte dans la moyenne
        </label>

        {/* Création : dupliquer l'évaluation sur d'autres classes */}
        {canSpread && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={spread} onChange={(e) => setSpread(e.target.checked)} />
              Créer aussi sur d’autres classes
            </label>

            {spread && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                  {level
                    ? `Niveau ${level} détecté : les classes de ${level} sont pré-cochées.`
                    : 'Niveau non reconnu d’après le nom de la classe : coche les classes à la main.'}
                </div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
                  {(classes ?? []).filter((c) => c.id !== currentClassId).map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', padding: '3px 0', cursor: 'pointer' }}>
                      <input type="checkbox" checked={targets.includes(c.id)} onChange={() => toggleTarget(c.id)} />
                      {c.name}
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  {targets.length === 0
                    ? `Aucune autre classe cochée : l’évaluation ne sera créée que sur ${className}.`
                    : `${targets.length + 1} évaluations liées seront créées (${className} incluse). Le sujet et le corrigé seront communs ; les dates restent modifiables classe par classe.`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Édition : répercuter sur les autres classes de la série */}
        {seriesId && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={applyToSeries} onChange={(e) => setApplyToSeries(e.target.checked)} />
              Appliquer aux autres classes de la série
            </label>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Nom, titre court, séquence, type, barème, coefficient et prise en compte dans la
              moyenne. La date reste propre à chaque classe.
            </div>
          </div>
        )}

        {/* Édition : aménagements élève par élève */}
        {initial && students && students.length > 0 && onToggleAdapted && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Évaluation adaptée pour…</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Coche les élèves dont le devoir ou l’activité a été aménagé. La note compte
              dans la moyenne comme les autres ; la cellule porte un ✻ dans le carnet.
              Au clavier : <strong>*</strong> dans la cellule. Enregistré immédiatement.
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginTop: 8 }}>
              {students.map((st) => (
                <label
                  key={st.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)', padding: '3px 0', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={adaptedIds?.has(st.id) ?? false}
                    onChange={(e) => { void onToggleAdapted(st.id, e.target.checked); }}
                  />
                  {st.pseudo}
                  {accommodationTags(st).map((tag) => (
                    <span key={tag} title={accommodationTitle(st)} style={tagStyle}>{tag}</span>
                  ))}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Changement de barème : que deviennent les notes déjà saisies ? */}
        {askBareme && (
          <div style={{ marginTop: 16, border: '1px solid var(--warn)', background: 'var(--surface-3)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              Le barème passe de {showNum(Number(oldBareme))} à {showNum(parsedBareme)}.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              {noteCount} note{noteCount > 1 ? 's sont' : ' est'} déjà saisie{noteCount > 1 ? 's' : ''}.
              Que faut-il en faire ?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <button onClick={() => { void run('convert'); }} disabled={busy} style={{ ...btnPrimary, textAlign: 'left' }}>
                Convertir les notes — une note de {showNum(Number(oldBareme))} devient{' '}
                {showNum(Math.round(parsedBareme * 100) / 100)} ; les moyennes ne bougent pas.
              </button>
              <button
                onClick={() => { void run('keep'); }}
                disabled={busy || !canKeepRaw}
                title={canKeepRaw ? undefined : `Une note vaut ${showNum(Number(maxRaw))}, au-dessus du nouveau barème.`}
                style={{ ...btnGhost, textAlign: 'left', opacity: canKeepRaw ? 1 : 0.5 }}
              >
                Garder les notes telles quelles — les /20 et les moyennes changent.
                {!canKeepRaw && ` Impossible : une note vaut ${showNum(Number(maxRaw))}.`}
              </button>
              <button onClick={() => setAskBareme(false)} disabled={busy} style={{ ...btnGhost, textAlign: 'left' }}>
                Revenir en arrière
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
          {onDelete ? (
            <button onClick={() => { void onDelete(); }} style={btnDanger}>Supprimer</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnGhost}>Annuler</button>
            <button onClick={() => { void submit(); }} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles (alignés sur le carnet)
// ============================================================

/** Petite pastille PAP / PPRE / PAI à côté d'un nom d'élève. */
const tagStyle: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--indigo)',
  background: 'var(--indigo-soft)', borderRadius: 999, padding: '1px 6px',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 4px',
};
const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14,
};
const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
const btnDanger: React.CSSProperties = { ...btnBase, background: 'var(--neg-soft)', color: 'var(--neg)' };
