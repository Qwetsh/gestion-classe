import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ASSESSMENT_KIND_LABEL,
  createAssessment,
  fetchCarnet,
  fetchClasses,
  fetchCurrentPeriod,
  saveGrade,
  softDeleteAssessment,
  updateAssessment,
  type AssessmentKind,
  type AssessmentRow,
  type CarnetStudent,
  type ClassRow,
  type GradeRow,
  fetchGradeBookExport,
  createAssessmentSeries,
  updateSeriesAssessments,
} from '../lib/evaluationQueries';
import { AssessmentStatsPanel } from './AssessmentStatsPanel';
import { levelFromClassName } from '../lib/boardsQueries';
import { exportGradeBookPdf, exportGradeBookXlsx } from '../lib/gradeExport';
import {
  describeGrades,
  formatGrade,
  parseGradeCell,
  STATUS_SHORT,
  studentAverage,
  toTwenty,
  type GradeEntry,
  type GradeStatus,
} from '../lib/gradeStats';

/**
 * Carnet de notes : tableau élèves × évaluations (cf. PLAN_carnet_de_notes.md, lot 2).
 *
 * Le critère n°1 est la vitesse de saisie : remplir une colonne de 28 notes doit prendre
 * moins de deux minutes sans toucher la souris. Tout le reste en découle — navigation au
 * clavier, écriture différée, raccourcis de statut.
 */

const PERIODS = [1, 2, 3];

/** Clé d'une cellule. */
const cellKey = (assessmentId: string, studentId: string) => `${assessmentId}|${studentId}`;

/** Affichage d'un nombre à la française, sans zéro décimal inutile. */
const showNum = (n: number) => String(n).replace('.', ',');

/** Ce qu'affiche une cellule au repos, d'après la note enregistrée. */
function cellText(row: GradeRow | undefined): string {
  if (!row) return '';
  if (row.status !== 'noted') return STATUS_SHORT[row.status];
  if (row.grade_raw !== null && row.grade_raw !== undefined) return showNum(row.grade_raw);
  return '';
}

interface PendingEdit {
  assessmentId: string;
  studentId: string;
  text: string;
  baremeTotal: number | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function CarnetTab({ userId, account, onError }: {
  userId: string;
  account: string;
  onError: (message: string) => void;
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState(1);
  const [schoolYear, setSchoolYear] = useState('');

  const [students, setStudents] = useState<CarnetStudent[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [grades, setGrades] = useState<Map<string, GradeRow>>(new Map());
  const [loading, setLoading] = useState(true);

  /** Texte en cours de frappe, par cellule. Absent = on affiche la valeur enregistrée. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** Cellules dont la saisie est invalide (note hors barème, charabia). */
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AssessmentRow | null>(null);
  const [statsFor, setStatsFor] = useState<AssessmentRow | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportAllYears, setExportAllYears] = useState(false);

  const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map());
  const pendingRef = useRef<Map<string, PendingEdit>>(new Map());
  const timerRef = useRef<number | null>(null);

  // ----------------------------------------------------------
  // Chargement
  // ----------------------------------------------------------

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const [rows, current] = await Promise.all([fetchClasses(userId), fetchCurrentPeriod(userId)]);
        if (!alive) return;
        setClasses(rows);
        setClassId((prev) => prev || rows[0]?.id || '');
        setPeriod(current.period);
        setSchoolYear(current.schoolYear);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Chargement impossible');
      }
    })();
    return () => { alive = false; };
  }, [userId, onError]);

  const load = useCallback(async () => {
    if (!userId || !classId || !schoolYear) return;
    setLoading(true);
    try {
      const data = await fetchCarnet(userId, classId, schoolYear, period);
      setStudents(data.students);
      setAssessments(data.assessments);
      setGrades(new Map(data.grades.map((g) => [cellKey(g.assessment_id, g.student_id), g])));
      setDrafts({});
      setInvalid({});
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Chargement du carnet impossible');
    } finally {
      setLoading(false);
    }
  }, [userId, classId, period, schoolYear, onError]);

  useEffect(() => { load(); }, [load]);

  // ----------------------------------------------------------
  // Écriture différée — et son filet de sécurité
  // ----------------------------------------------------------

  /**
   * Envoie toutes les saisies en attente. Appelée par le minuteur, au blur d'une cellule,
   * au démontage et avant la fermeture de l'onglet : une note tapée ne doit jamais être
   * perdue parce qu'on a quitté la page trop vite.
   */
  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const batch = [...pendingRef.current.values()];
    pendingRef.current.clear();
    if (batch.length === 0) return;

    setSaveState('saving');
    try {
      const saved = await Promise.all(
        batch.map((edit) => {
          const parsed = parseGradeCell(edit.text, edit.baremeTotal);
          // Déjà filtré à la frappe ; par sécurité on n'envoie pas une saisie invalide.
          if (!parsed) return null;
          return saveGrade({
            userId,
            assessmentId: edit.assessmentId,
            studentId: edit.studentId,
            raw: parsed.raw,
            grade: parsed.status === 'noted' ? toTwenty(parsed.raw, edit.baremeTotal) : null,
            status: parsed.status,
          });
        }),
      );
      setGrades((prev) => {
        const next = new Map(prev);
        for (const row of saved) {
          if (row) next.set(cellKey(row.assessment_id, row.student_id), row);
        }
        return next;
      });
      setDrafts((prev) => {
        const next = { ...prev };
        for (const edit of batch) delete next[cellKey(edit.assessmentId, edit.studentId)];
        return next;
      });
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      onError(e instanceof Error ? e.message : 'Enregistrement impossible');
    }
  }, [userId, onError]);

  // Démontage : on vide la file avant de partir.
  useEffect(() => () => { void flush(); }, [flush]);

  // Fermeture de l'onglet : on tente l'envoi et on prévient si quelque chose reste en vol.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingRef.current.size === 0) return;
      void flush();
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void flush(); }, 400);
  }, [flush]);

  const handleChange = (assessment: AssessmentRow, studentId: string, text: string) => {
    const key = cellKey(assessment.id, studentId);
    setDrafts((prev) => ({ ...prev, [key]: text }));

    const parsed = parseGradeCell(text, assessment.bareme_total);
    if (!parsed) {
      // Saisie refusée : on garde ce qui est tapé, on le signale, on n'enregistre rien.
      setInvalid((prev) => ({ ...prev, [key]: true }));
      pendingRef.current.delete(key);
      return;
    }
    setInvalid((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
    pendingRef.current.set(key, {
      assessmentId: assessment.id,
      studentId,
      text,
      baremeTotal: assessment.bareme_total,
    });
    scheduleFlush();
  };

  // ----------------------------------------------------------
  // Navigation clavier
  // ----------------------------------------------------------

  const focusCell = (assessmentIndex: number, studentIndex: number) => {
    const a = assessments[assessmentIndex];
    const s = students[studentIndex];
    if (!a || !s) return;
    const el = inputsRef.current.get(cellKey(a.id, s.id));
    if (el) { el.focus(); el.select(); }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    assessmentIndex: number,
    studentIndex: number,
  ) => {
    // Tab suit l'ordre du DOM (ligne par ligne) : éval suivante, même élève. Rien à faire.
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(assessmentIndex, Math.min(studentIndex + 1, students.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(assessmentIndex, Math.max(studentIndex - 1, 0));
    } else if (e.key === 'Escape') {
      // Abandon : on oublie la frappe en cours et on réaffiche la valeur enregistrée.
      e.preventDefault();
      const a = assessments[assessmentIndex];
      const st = students[studentIndex];
      // La colonne a pu disparaître pendant la frappe (suppression d'une évaluation).
      if (!a || !st) return;
      const key = cellKey(a.id, st.id);
      pendingRef.current.delete(key);
      setDrafts((prev) => { const next = { ...prev }; delete next[key]; return next; });
      setInvalid((prev) => ({ ...prev, [key]: false }));
      e.currentTarget.blur();
    }
  };

  // ----------------------------------------------------------
  // Statistiques
  // ----------------------------------------------------------

  const entriesFor = useCallback(
    (assessmentId: string): GradeEntry[] =>
      students.map((s) => {
        const row = grades.get(cellKey(assessmentId, s.id));
        return {
          studentId: s.id,
          grade: row?.grade ?? null,
          status: (row?.status ?? 'noted') as GradeStatus,
        };
      }),
    [students, grades],
  );

  const columnStats = useMemo(
    () => new Map(assessments.map((a) => [a.id, describeGrades(entriesFor(a.id))])),
    [assessments, entriesFor],
  );

  const averageFor = useCallback(
    (studentId: string) =>
      studentAverage(
        assessments.map((a) => {
          const row = grades.get(cellKey(a.id, studentId));
          return {
            entry: {
              studentId,
              grade: row?.grade ?? null,
              status: (row?.status ?? 'noted') as GradeStatus,
            },
            assessment: { coefficient: Number(a.coefficient) || 0, countsInAverage: a.counts_in_average },
          };
        }),
      ),
    [assessments, grades],
  );

  /** Moyenne de classe : moyenne des moyennes d'élèves qui en ont une. */
  const classAverage = useMemo(() => {
    const values = students.map((s) => averageFor(s.id)).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [students, averageFor]);

  // ----------------------------------------------------------
  // Export (lot 3) — toute l'année, toutes les classes
  // ----------------------------------------------------------

  const runExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(true);
    try {
      // Une saisie en attente doit partir avant qu'on fabrique le fichier,
      // sinon la sauvegarde ne contient pas la derniere note tapee.
      await flush();
      const data = await fetchGradeBookExport(userId, exportAllYears ? null : schoolYear);
      if (format === 'xlsx') exportGradeBookXlsx(data, account);
      else exportGradeBookPdf(data, account);
      setShowExport(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExporting(false);
    }
  };

  // ----------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------

  const className = classes.find((c) => c.id === classId)?.name ?? '';

  return (
    <div>
      {/* Barre d'outils */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={classId} onChange={(e) => { void flush(); setClassId(e.target.value); }} style={select}>
          {classes.length === 0 && <option value="">Aucune classe</option>}
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => { void flush(); setPeriod(p); }}
              style={{
                ...btnBase,
                background: p === period ? 'var(--indigo)' : 'var(--surface-3)',
                color: p === period ? '#fff' : 'var(--text)',
                border: p === period ? '1px solid transparent' : '1px solid var(--border)',
              }}
            >
              T{p}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{schoolYear}</span>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: saveState === 'error' ? 'var(--neg)' : 'var(--text-dim)', minWidth: 92, textAlign: 'right' }}>
          {saveState === 'saving' ? 'Enregistrement…'
            : saveState === 'saved' ? 'Enregistré'
            : saveState === 'error' ? 'Échec' : ''}
        </span>

        <button onClick={() => setShowExport(true)} style={btnGhost} disabled={!schoolYear}>
          ⬇ Sauvegarder
        </button>

        <button onClick={() => setShowCreate(true)} style={btnPrimary} disabled={!classId}>
          + Évaluation
        </button>
      </div>

      {showExport && (
        <div onClick={() => !exporting && setShowExport(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 460, maxWidth: '92vw', boxShadow: 'var(--shadow-2)' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
              Sauvegarder les notes
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Exporte <strong>toutes les classes et les trois trimestres</strong>
              {exportAllYears ? ' de toutes les années enregistrées' : ` de l’année ${schoolYear}`},
              pas seulement ce qui est affiché. Les élèves ayant changé de classe en cours d’année
              y figurent avec les notes de leur ancienne classe. Le fichier se télécharge sur ce
              PC : range-le ailleurs que sur la machine qui l’a produit.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={exportAllYears} onChange={(e) => setExportAllYears(e.target.checked)} />
              Inclure les années scolaires précédentes
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { void runExport('xlsx'); }} disabled={exporting} style={{ ...btnPrimary, flex: 1, opacity: exporting ? 0.6 : 1 }}>
                {exporting ? 'Préparation…' : 'Excel (.xlsx)'}
              </button>
              <button onClick={() => { void runExport('pdf'); }} disabled={exporting} style={{ ...btnGhost, flex: 1, opacity: exporting ? 0.6 : 1 }}>
                {exporting ? 'Préparation…' : 'PDF imprimable'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button onClick={() => setShowExport(false)} disabled={exporting} style={btnGhost}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={emptyBox}>Chargement…</div>
      ) : students.length === 0 ? (
        <div style={emptyBox}>
          Aucun élève dans {className || 'cette classe'}. Importe la liste depuis l’onglet Classes.
        </div>
      ) : assessments.length === 0 ? (
        <div style={emptyBox}>
          Aucune évaluation au trimestre {period}. Clique « + Évaluation » pour créer la première.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, ...stickyCol, textAlign: 'left', minWidth: 180 }}>Élève</th>
                {assessments.map((a) => {
                  const stats = columnStats.get(a.id);
                  return (
                    <th key={a.id} style={{ ...th, minWidth: 92 }}>
                      <button onClick={() => setStatsFor(a)} style={headerBtn} title="Statistiques de cette évaluation">
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                      </button>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>
                        coef {showNum(Number(a.coefficient))} · /{showNum(Number(a.bareme_total ?? 20))}
                        {!a.counts_in_average && ' · hors moy.'}
                      </div>
                      {stats && stats.pending > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--warn)', fontWeight: 400 }}>
                          {stats.pending} à corriger
                        </div>
                      )}
                    </th>
                  );
                })}
                <th style={{ ...th, minWidth: 90, background: 'var(--surface-3)' }}>Moyenne</th>
              </tr>
            </thead>

            <tbody>
              {students.map((s, si) => {
                const avg = averageFor(s.id);
                return (
                  <tr key={s.id}>
                    <td style={{ ...td, ...stickyCol, textAlign: 'left', fontWeight: 500 }}>{s.pseudo}</td>
                    {assessments.map((a, ai) => {
                      const key = cellKey(a.id, s.id);
                      const row = grades.get(key);
                      const draft = drafts[key];
                      const value = draft !== undefined ? draft : cellText(row);
                      const isStatus = draft === undefined && row && row.status !== 'noted';
                      const bad = invalid[key];
                      return (
                        <td key={a.id} style={{ ...td, padding: 0 }}>
                          <input
                            ref={(el) => {
                              if (el) inputsRef.current.set(key, el);
                              else inputsRef.current.delete(key);
                            }}
                            value={value}
                            onChange={(e) => handleChange(a, s.id, e.target.value)}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={() => { void flush(); }}
                            onKeyDown={(e) => handleKeyDown(e, ai, si)}
                            inputMode="decimal"
                            aria-label={`${s.pseudo} — ${a.name}`}
                            style={{
                              width: '100%', boxSizing: 'border-box', textAlign: 'center',
                              padding: '8px 4px', border: 'none', outline: 'none',
                              background: bad ? 'var(--neg-soft)' : 'transparent',
                              color: bad ? 'var(--neg)'
                                : isStatus ? 'var(--text-dim)'
                                : 'var(--text)',
                              fontSize: 13,
                              fontWeight: isStatus ? 400 : 600,
                              fontStyle: isStatus ? 'italic' : 'normal',
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={{ ...td, background: 'var(--surface-3)', fontWeight: 700 }}>
                      {formatGrade(avg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td style={{ ...tdFoot, ...stickyCol, textAlign: 'left' }}>Moyenne classe</td>
                {assessments.map((a) => (
                  <td key={a.id} style={tdFoot}>{formatGrade(columnStats.get(a.id)?.mean ?? null)}</td>
                ))}
                <td style={{ ...tdFoot, background: 'var(--surface-3)' }}>{formatGrade(classAverage)}</td>
              </tr>
              <tr>
                <td style={{ ...tdFoot, ...stickyCol, textAlign: 'left', fontWeight: 400 }}>Médiane</td>
                {assessments.map((a) => (
                  <td key={a.id} style={{ ...tdFoot, fontWeight: 400 }}>
                    {formatGrade(columnStats.get(a.id)?.median ?? null)}
                  </td>
                ))}
                <td style={{ ...tdFoot, background: 'var(--surface-3)' }} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Aide-mémoire de saisie */}
      {assessments.length > 0 && students.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          <strong>Entrée</strong> ou <strong>↓</strong> : élève suivant · <strong>Tab</strong> : évaluation suivante ·
          {' '}<strong>a</strong> absent · <strong>d</strong> dispensé · <strong>n</strong> non rendu ·
          {' '}<strong>z</strong> non rendu comptant 0 · <strong>Échap</strong> : annuler la frappe
        </p>
      )}

      {statsFor && (
        <AssessmentStatsPanel
          assessment={statsFor}
          entries={entriesFor(statsFor.id)}
          stats={columnStats.get(statsFor.id) ?? describeGrades([])}
          userId={userId}
          onClose={() => setStatsFor(null)}
          onEdit={() => { setEditing(statsFor); setStatsFor(null); }}
        />
      )}

      {showCreate && (
        <AssessmentModal
          title="Nouvelle évaluation"
          className={className}
          classes={classes}
          currentClassId={classId}
          onClose={() => setShowCreate(false)}
          onSubmit={async (values) => {
            const targets = values.classIds ?? [classId];
            if (targets.length > 1) {
              // Même évaluation sur plusieurs classes : une série les relie.
              await createAssessmentSeries({
                userId,
                name: values.name,
                level: levelFromClassName(className),
                classIds: targets,
                baremeTotal: values.bareme,
                coefficient: values.coefficient,
                kind: values.kind,
                date: values.date || null,
                period,
                schoolYear,
                countsInAverage: values.countsInAverage,
              });
            } else {
              await createAssessment({
                userId,
                classId: targets[0],
                name: values.name,
                baremeTotal: values.bareme,
                coefficient: values.coefficient,
                kind: values.kind,
                date: values.date || null,
                period,
                schoolYear,
                countsInAverage: values.countsInAverage,
              });
            }
            setShowCreate(false);
            await load();
          }}
        />
      )}

      {editing && (
        <AssessmentModal
          title="Modifier l’évaluation"
          className={className}
          initial={{
            name: editing.name,
            bareme: Number(editing.bareme_total ?? 20),
            coefficient: Number(editing.coefficient),
            kind: editing.kind,
            date: editing.date ?? '',
            countsInAverage: editing.counts_in_average,
          }}
          onDelete={async () => {
            if (!window.confirm(`Supprimer « ${editing.name} » et ses notes du carnet ?`)) return;
            await softDeleteAssessment(editing.id);
            setEditing(null);
            await load();
          }}
          onClose={() => setEditing(null)}
          seriesId={editing.series_id}
          onSubmit={async (values) => {
            const patch = {
              name: values.name,
              baremeTotal: values.bareme,
              coefficient: values.coefficient,
              kind: values.kind,
              countsInAverage: values.countsInAverage,
            };
            // La date reste propre à la classe : chaque groupe passe l'éval son jour.
            await updateAssessment(editing.id, { ...patch, date: values.date || null });
            if (values.applyToSeries && editing.series_id) {
              await updateSeriesAssessments(editing.series_id, patch);
            }
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modale création / édition d'une évaluation
// ============================================================

interface AssessmentValues {
  name: string;
  bareme: number;
  coefficient: number;
  kind: AssessmentKind;
  date: string;
  countsInAverage: boolean;
  /** Création seulement : les classes sur lesquelles créer l'évaluation. */
  classIds?: string[];
  /** Édition seulement : répercuter sur les autres classes de la série. */
  applyToSeries?: boolean;
}

function AssessmentModal({
  title, className, initial, classes, currentClassId, seriesId, onSubmit, onClose, onDelete,
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
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [bareme, setBareme] = useState(String(initial?.bareme ?? 20));
  const [coefficient, setCoefficient] = useState(String(initial?.coefficient ?? 1));
  const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? 'ecrit');
  const [date, setDate] = useState(initial?.date ?? '');
  const [countsInAverage, setCountsInAverage] = useState(initial?.countsInAverage ?? true);
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

  const submit = async () => {
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
        classIds: canSpread && spread && currentClassId ? [currentClassId, ...targets] : undefined,
        applyToSeries,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible');
      setBusy(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: 440, maxWidth: '92vw', boxShadow: 'var(--shadow-2)' }}>
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
            <label style={lbl}>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as AssessmentKind)} style={inp}>
              {(Object.keys(ASSESSMENT_KIND_LABEL) as AssessmentKind[]).map((k) => (
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
            <input value={bareme} onChange={(e) => setBareme(e.target.value)} inputMode="decimal" style={inp} />
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
              Nom, type, barème, coefficient et prise en compte dans la moyenne. La date reste
              propre à chaque classe.
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
// Styles (alignés sur le reste de la page Évaluations)
// ============================================================

const th: React.CSSProperties = {
  padding: '8px 6px', textAlign: 'center', fontSize: 12, fontWeight: 600,
  color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
  background: 'var(--surface)', verticalAlign: 'bottom',
};
const td: React.CSSProperties = {
  padding: '6px', textAlign: 'center', borderBottom: '1px solid var(--border)', color: 'var(--text)',
};
const tdFoot: React.CSSProperties = {
  padding: '8px 6px', textAlign: 'center', borderTop: '2px solid var(--border)',
  fontWeight: 600, color: 'var(--text-muted)', fontSize: 12,
};
const stickyCol: React.CSSProperties = {
  position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1,
};
const headerBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
};
const emptyBox: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
  padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14,
};
const select: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--text)', fontSize: 13,
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
