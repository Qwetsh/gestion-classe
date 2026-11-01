import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createAssessment,
  fetchCarnet,
  fetchClasses,
  fetchCurrentPeriod,
  saveGrade,
  softDeleteAssessment,
  updateAssessment,
  type AssessmentRow,
  type CarnetStudent,
  type ClassRow,
  type GradeRow,
  fetchGradeBookExport,
  createAssessmentSeries,
  updateSeriesAssessments,
  setGradeAdapted,
  rescaleGradesForBareme,
} from '../lib/evaluationQueries';
import { accommodationTags, accommodationTitle } from '../lib/accommodations';
import { AssessmentStatsPanel } from './AssessmentStatsPanel';
import { AssessmentModal } from './AssessmentModal';
import { PronoteImportModal } from './PronoteImportModal';
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
  // Retour depuis la fiche d'une éval : on rouvre la même classe et le même trimestre.
  const [searchParams] = useSearchParams();
  const requestedClassId = searchParams.get('classe');
  const requestedPeriod = Number(searchParams.get('t'));

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState(requestedClassId ?? '');
  const [period, setPeriod] = useState(PERIODS.includes(requestedPeriod) ? requestedPeriod : 1);
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
  const [showPronote, setShowPronote] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportAllYears, setExportAllYears] = useState(false);

  const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map());
  /** Miroir de `grades` : lu dans les callbacks sans les faire dépendre de chaque note. */
  const gradesRef = useRef(grades);
  gradesRef.current = grades;
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
        setClassId((prev) => (prev && rows.some((c) => c.id === prev) ? prev : rows[0]?.id || ''));
        if (!PERIODS.includes(requestedPeriod)) setPeriod(current.period);
        setSchoolYear(current.schoolYear);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Chargement impossible');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Évaluation adaptée (migration 041)
  // ----------------------------------------------------------

  /**
   * Marque le devoir comme adapté (ou non) pour un élève.
   *
   * On vide d'abord la file d'écriture : la ligne revient du serveur telle qu'elle est
   * en base, et écraser l'état avec une note encore en vol la ferait disparaître à l'écran.
   */
  const toggleAdapted = useCallback(async (assessmentId: string, studentId: string, next?: boolean) => {
    await flush();
    const key = cellKey(assessmentId, studentId);
    const current = gradesRef.current.get(key)?.is_adapted ?? false;
    try {
      const row = await setGradeAdapted(userId, assessmentId, studentId, next ?? !current);
      setGrades((prev) => new Map(prev).set(cellKey(row.assessment_id, row.student_id), row));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’aménagement');
    }
  }, [flush, userId, onError]);

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
    } else if (e.key === '*') {
      // Aménagement : marqué au clavier, sans quitter la colonne en cours de saisie.
      e.preventDefault();
      const a = assessments[assessmentIndex];
      const st = students[studentIndex];
      if (a && st) void toggleAdapted(a.id, st.id);
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

  /** Élèves pour qui cette évaluation est marquée adaptée. */
  const adaptedIds = useCallback(
    (assessmentId: string) =>
      new Set(
        students.filter((s) => grades.get(cellKey(assessmentId, s.id))?.is_adapted).map((s) => s.id),
      ),
    [students, grades],
  );

  /** Notes brutes saisies sur une éval : de quoi juger un changement de barème. */
  const rawGradesOf = useCallback(
    (assessmentId: string) =>
      students
        .map((s) => grades.get(cellKey(assessmentId, s.id)))
        .filter((row) => row?.status === 'noted' && row.grade_raw !== null)
        .map((row) => Number(row!.grade_raw)),
    [students, grades],
  );

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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 190px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
      {/* Menu des classes : une classe est un lieu, pas une option de liste déroulante. */}
      <nav style={sidebar}>
        <div style={sidebarTitle}>Classes</div>
        {classes.length === 0 ? (
          <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>Aucune classe</div>
        ) : (
          classes.map((c) => {
            const on = c.id === classId;
            return (
              <button
                key={c.id}
                onClick={() => { void flush(); setClassId(c.id); }}
                aria-current={on ? 'page' : undefined}
                style={{
                  ...classBtn,
                  background: on ? 'var(--indigo-soft)' : 'transparent',
                  color: on ? 'var(--indigo)' : 'var(--text)',
                  borderLeftColor: on ? 'var(--indigo)' : 'transparent',
                  fontWeight: on ? 700 : 500,
                }}
              >
                {c.name}
              </button>
            );
          })
        )}
      </nav>

      <div style={{ minWidth: 0 }}>
      {/* Barre d'outils */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
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

        <button onClick={() => { void flush(); setShowPronote(true); }} style={btnGhost} disabled={!classId || !schoolYear || students.length === 0}>
          ⬆ Importer Pronote
        </button>

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
                    <th key={a.id} style={{ ...th, ...colSep, minWidth: 92 }}>
                      <button
                        onClick={() => { void flush(); setEditing(a); }}
                        style={headerBtn}
                        title="Modifier cette évaluation (nom, barème, coefficient, aménagements…)"
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text)', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 3 }}>
                          {a.name}
                        </span>
                      </button>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>
                        coef {showNum(Number(a.coefficient))} · /{showNum(Number(a.bareme_total ?? 20))}
                        {!a.counts_in_average && ' · hors moy.'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                        <button onClick={() => setStatsFor(a)} style={statsBtn} title="Statistiques de cette évaluation">
                          stats
                        </button>
                        <Link
                          to={`/evaluations/${a.id}`}
                          onClick={() => { void flush(); }}
                          style={{ ...statsBtn, color: 'var(--indigo)', textDecoration: 'none' }}
                          title="Fiche de l’évaluation : sujet, corrigé, copies, validation, publication, statistiques"
                        >
                          fiche ↗
                        </Link>
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
                    <td style={{ ...td, ...stickyCol, textAlign: 'left', fontWeight: 500 }}>
                      {s.pseudo}
                      {accommodationTags(s).map((tag) => (
                        <span key={tag} title={accommodationTitle(s)} style={tagStyle}>{tag}</span>
                      ))}
                    </td>
                    {assessments.map((a, ai) => {
                      const key = cellKey(a.id, s.id);
                      const row = grades.get(key);
                      const draft = drafts[key];
                      const value = draft !== undefined ? draft : cellText(row);
                      const isStatus = draft === undefined && row && row.status !== 'noted';
                      const bad = invalid[key];
                      const adapted = !!row?.is_adapted;
                      // Brouillon du Correcteur : compte pour le prof, invisible pour l'élève (053).
                      const pending = draft === undefined && !!row && row.grade != null && !row.is_validated;
                      return (
                        <td key={a.id} style={{ ...td, ...colSep, padding: 0, position: 'relative' }}>
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
                            aria-label={`${s.pseudo} — ${a.name}${adapted ? ' (évaluation adaptée)' : ''}${pending ? ' (brouillon à valider)' : ''}`}
                            title={pending ? 'Brouillon du Correcteur : à valider dans la fiche de l’évaluation (fiche ↗) pour que l’élève le voie. Le modifier ici le valide.' : undefined}
                            style={{
                              width: '100%', boxSizing: 'border-box', textAlign: 'center',
                              padding: '8px 4px', border: 'none', outline: 'none',
                              background: bad ? 'var(--neg-soft)' : 'transparent',
                              color: bad ? 'var(--neg)'
                                : isStatus ? 'var(--text-dim)'
                                : pending ? 'var(--warn)'
                                : 'var(--text)',
                              fontSize: 13,
                              fontWeight: isStatus ? 400 : 600,
                              fontStyle: isStatus ? 'italic' : 'normal',
                            }}
                          />
                          {pending && (
                            <span
                              aria-hidden
                              style={{ position: 'absolute', top: 1, left: 3, fontSize: 10, color: 'var(--warn)', pointerEvents: 'none' }}
                            >
                              *
                            </span>
                          )}
                          {adapted && (
                            <span
                              title={`Évaluation adaptée pour ${s.pseudo}`}
                              style={{ position: 'absolute', top: 1, right: 3, fontSize: 10, color: 'var(--indigo)', pointerEvents: 'none' }}
                            >
                              ✻
                            </span>
                          )}
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
                  <td key={a.id} style={{ ...tdFoot, ...colSep }}>
                    {formatGrade(columnStats.get(a.id)?.mean ?? null)}
                  </td>
                ))}
                <td style={{ ...tdFoot, background: 'var(--surface-3)' }}>{formatGrade(classAverage)}</td>
              </tr>
              <tr>
                <td style={{ ...tdFoot, ...stickyCol, textAlign: 'left', fontWeight: 400 }}>Médiane</td>
                {assessments.map((a) => (
                  <td key={a.id} style={{ ...tdFoot, ...colSep, fontWeight: 400 }}>
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
          {' '}<strong>z</strong> non rendu comptant 0 · <strong>*</strong> évaluation adaptée (✻) ·
          {' '}<strong>Échap</strong> : annuler la frappe
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

      {showPronote && (
        <PronoteImportModal
          userId={userId}
          classId={classId}
          className={className}
          period={period}
          schoolYear={schoolYear}
          students={students}
          assessments={assessments}
          grades={grades}
          onClose={() => setShowPronote(false)}
          onDone={load}
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
            publishedToStudents: editing.published_to_students,
          }}
          students={students}
          adaptedIds={adaptedIds(editing.id)}
          onToggleAdapted={(studentId, value) => toggleAdapted(editing.id, studentId, value)}
          gradeRaws={rawGradesOf(editing.id)}
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
            const oldBareme = Number(editing.bareme_total ?? 20);
            const convert = values.baremeMode === 'convert' && values.bareme !== oldBareme;
            // La date et la publication restent propres à la classe : chaque groupe passe
            // l'éval son jour, et on publie une classe quand SES copies sont corrigées.
            const ownFields = {
              date: values.date || null,
              publishedToStudents: values.publishedToStudents,
            };

            if (values.applyToSeries && editing.series_id) {
              // La série d'abord : elle lit les anciens barèmes avant de les écraser, et
              // convertit chaque classe une seule fois — celle-ci comprise.
              await updateSeriesAssessments(editing.series_id, patch, { rescaleRaw: convert });
              await updateAssessment(editing.id, ownFields);
            } else {
              await updateAssessment(editing.id, { ...patch, ...ownFields });
              if (convert) await rescaleGradesForBareme(editing.id, oldBareme, values.bareme);
            }
            setEditing(null);
            await load();
          }}
        />
      )}
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
/** Filet vertical entre deux évaluations : assez présent pour guider l'œil le long
 *  d'une colonne, assez discret pour ne pas quadriller le tableau. */
const colSep: React.CSSProperties = {
  borderLeft: '1px solid var(--border)',
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
const sidebar: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
  overflow: 'hidden', position: 'sticky', top: 12,
};
const sidebarTitle: React.CSSProperties = {
  padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em',
};
const classBtn: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px',
  border: 'none', borderLeft: '3px solid transparent', cursor: 'pointer',
  fontSize: 13, fontFamily: 'inherit',
};
/** Petite pastille PAP / PPRE / PAI à côté d'un nom d'élève. */
const tagStyle: React.CSSProperties = {
  marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--indigo)',
  background: 'var(--indigo-soft)', borderRadius: 999, padding: '1px 6px',
};
const statsBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: '2px 0 0', cursor: 'pointer',
  fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'inherit',
  textDecoration: 'underline', textUnderlineOffset: 2,
};
const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
