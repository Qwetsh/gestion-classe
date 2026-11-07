import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ASSESSMENT_KIND_LABEL,
  createAssessment,
  fetchAssessments,
  fetchCarnet,
  fetchClasses,
  fetchCopyOverviews,
  fetchCurrentPeriod,
  saveGrade,
  type AssessmentRow,
  type CarnetStudent,
  type ClassRow,
  type GradeRow,
  fetchGradeBookExport,
  createAssessmentSeries,
  setGradeAdapted,
} from '../lib/evaluationQueries';
import type { CopyOverview } from '../lib/copyStatus';
import { carnetHeaderChip, hasCopies, neverScanned, type HeaderChip } from '../lib/assessmentGroups';
import {
  CELL_MARK_LABEL,
  cellMark,
  DEFAULT_PREFS,
  filterAssessments,
  hasUnsequenced,
  isFiltered,
  kindsPresent,
  NO_FILTERS,
  parsePrefs,
  sequencesPresent,
  type CarnetPrefs,
  type CellMark,
} from '../lib/carnetView';
import { ColumnHeader } from './carnet/ColumnHeader';
import { KindIcon } from './KindIcon';
import { fetchClassProductions, linkActivityToClass, type ActivityRow } from '../lib/productionsQueries';
import { cellToCorrect, firstToCorrect, productionColumns, type ProductionColumn } from '../lib/carnetProductions';
import { columnLabels, sameNameTarget } from '../lib/columnHeader';
import { StudentGradeModal } from './StudentGradeModal';
import { accommodationTags, accommodationTitle } from '../lib/accommodations';
import { AssessmentModal } from './AssessmentModal';
import { NewAssessmentChooser } from './NewAssessmentChooser';
import { MoreMenu } from './MoreMenu';
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
 *
 * Tout ce qui concerne UNE éval (réglages, sujet, copies, validation, publication, stats)
 * est sur sa fiche, ouverte depuis le nom de la colonne ; ici on saisit et on lit.
 */

const PERIODS = [1, 2, 3];

/** Préférences d'affichage (filtres, colonne Moyenne) : dans ce navigateur seulement. */
const PREFS_KEY = 'gc-carnet-prefs';

function readPrefs(): CarnetPrefs {
  try { return parsePrefs(window.localStorage.getItem(PREFS_KEY)); } catch { return DEFAULT_PREFS; }
}

const MARK_STYLE: Record<Exclude<CellMark, null>, { glyph: string; color: string }> = {
  draft: { glyph: '*', color: 'var(--warn)' },
  to_grade: { glyph: '●', color: 'var(--indigo)' },
  missing_copy: { glyph: '○', color: 'var(--text-dim)' },
};

const CHIP_COLORS: Record<HeaderChip['tone'], [string, string]> = {
  warn: ['var(--warn-soft)', 'var(--warn)'],
  info: ['var(--indigo-soft)', 'var(--indigo)'],
  ok: ['var(--pos-soft)', 'var(--pos)'],
  published: ['var(--pos)', '#fff'],
  neutral: ['var(--surface-3)', 'var(--text-muted)'],
};

/** Clé d'une cellule. */
const cellKey = (assessmentId: string, studentId: string) => `${assessmentId}|${studentId}`;

/** Affichage d'un nombre à la française, sans zéro décimal inutile. */
const showNum = (n: number) => String(n).replace('.', ',');

const DISMISSED_KEY = 'gc.carnet.relinkDismissed';
function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

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
  const navigate = useNavigate();
  const requestedClassId = searchParams.get('classe');
  const requestedPeriod = Number(searchParams.get('t'));

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState(requestedClassId ?? '');
  const [period, setPeriod] = useState(PERIODS.includes(requestedPeriod) ? requestedPeriod : 1);
  const [schoolYear, setSchoolYear] = useState('');
  /** Trimestre en cours (réglages) : celui où une production pas encore au carnet entrera. */
  const [currentPeriod, setCurrentPeriod] = useState<number | null>(null);

  const [students, setStudents] = useState<CarnetStudent[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [grades, setGrades] = useState<Map<string, GradeRow>>(new Map());
  /** État des copies et des brouillons par éval : la pastille sous le nom de la colonne. */
  const [overviews, setOverviews] = useState<Record<string, CopyOverview>>({});
  /** Élèves qui ont une copie (pages ou transcription), par éval : l'indicateur « copie manquante ». */
  const [copyKeys, setCopyKeys] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  /** Productions numériques envoyées par la classe : colonnes « À corriger », même sans éval au carnet. */
  const [productions, setProductions] = useState<(Awaited<ReturnType<typeof fetchClassProductions>> & { classId: string }) | null>(null);
  const classIdRef = useRef(classId);
  classIdRef.current = classId;
  /** Création de l'éval d'une production avant d'ouvrir sa correction. */
  const [openingProduction, setOpeningProduction] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<CarnetPrefs>(readPrefs);
  useEffect(() => {
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* navigation privée */ }
  }, [prefs]);
  const filters = prefs.filters;
  const setFilter = <K extends keyof CarnetPrefs['filters']>(k: K, v: CarnetPrefs['filters'][K]) =>
    setPrefs((p) => ({ ...p, filters: { ...p.filters, [k]: v } }));

  /** Toutes les évals de l'utilisateur : taille des séries et rattachement « même nom ». */
  const [allAssessments, setAllAssessments] = useState<AssessmentRow[]>([]);
  /** Suggestions « même nom » écartées (« Ce n'est pas la même éval »), sur ce navigateur. */
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);
  const dismissSuggestion = (id: string) => setDismissed((prev) => {
    const next = new Set(prev).add(id);
    try { window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next])); } catch { /* navigation privée */ }
    return next;
  });

  /** Bouton « i » d'une cellule : la modale élève × éval. */
  const [detail, setDetail] = useState<{ assessment: AssessmentRow; studentId: string } | null>(null);

  /** Texte en cours de frappe, par cellule. Absent = on affiche la valeur enregistrée. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  /** Cellules dont la saisie est invalide (note hors barème, charabia). */
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const [showCreate, setShowCreate] = useState(false);
  /** « + Évaluation » : d'abord le type (phase 6), puis le formulaire pour une éval classique. */
  const [choosingType, setChoosingType] = useState(false);
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
        setCurrentPeriod(current.period);
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
      // Les séries et les suggestions de rattachement n'empêchent pas d'afficher la grille.
      fetchAssessments(userId).then(setAllAssessments).catch(() => setAllAssessments([]));
      // Les productions envoyées non plus : leurs colonnes arrivent après. Une réponse arrivée
      // après un changement de classe est ignorée (sinon les productions d'une autre classe s'affichent).
      const forClass = classId;
      fetchClassProductions(classId)
        .then((p) => { if (classIdRef.current === forClass) setProductions({ ...p, classId: forClass }); })
        .catch(() => { if (classIdRef.current === forClass) setProductions(null); });
      // L'état des copies n'empêche pas d'afficher la grille : il arrive après.
      fetchCopyOverviews(data.assessments)
        .then((d) => { setOverviews(d.overviews); setCopyKeys(d.copyKeys); })
        .catch(() => { setOverviews({}); setCopyKeys({}); });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Chargement du carnet impossible');
    } finally {
      setLoading(false);
    }
  }, [userId, classId, period, schoolYear, onError]);

  useEffect(() => { load(); }, [load]);

  /** Les colonnes affichées : les évals du trimestre, moins celles écartées par les filtres. */
  const visible = useMemo(() => filterAssessments(assessments, filters), [assessments, filters]);
  const filtered = isFiltered(filters);
  const labels = useMemo(() => columnLabels(visible), [visible]);
  const seriesSize = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allAssessments) if (a.series_id) m.set(a.series_id, (m.get(a.series_id) ?? 0) + 1);
    return m;
  }, [allAssessments]);
  /** Même nom dans une autre classe, pas encore reliée : proposé dans l'en-tête de la colonne. */
  const suggestions = useMemo(() => {
    const m = new Map<string, ReturnType<typeof sameNameTarget>>();
    if (allAssessments.length === 0) return m;
    for (const a of visible) {
      if (a.series_id || dismissed.has(a.id)) continue;
      const t = sameNameTarget(a, allAssessments);
      if (t) m.set(a.id, t);
    }
    return m;
  }, [visible, allAssessments, dismissed]);

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
  // Productions numériques : « À corriger » dès le premier envoi
  // ----------------------------------------------------------

  const prodColumns = useMemo(
    () => (productions && productions.classId === classId
      ? productionColumns(productions.activities, productions.works, productions.links)
      : []),
    [productions, classId],
  );
  /** Éval liée → sa colonne de production (cellules « À corriger »). */
  const prodByAssessment = useMemo(() => {
    const m = new Map<string, ProductionColumn<ActivityRow>>();
    for (const c of prodColumns) if (c.assessmentId) m.set(c.assessmentId, c);
    return m;
  }, [prodColumns]);
  /**
   * Activités envoyées par la classe mais sans éval au carnet : une colonne « en attente », au
   * trimestre en cours (celui où l'éval sera créée), sauf si les filtres l'écartent.
   */
  const pendingColumns = useMemo(() => {
    if (currentPeriod === null || period !== currentPeriod) return [];
    if (filters.kind !== 'all' && filters.kind !== 'tp') return [];
    if (filters.published === 'yes') return [];
    return prodColumns.filter((c) => {
      if (c.assessmentId) return false;
      // Aucune ligne du carnet concernée (élève parti de la classe) : pas de colonne vide.
      if (!students.some((st) => c.works.has(st.id))) return false;
      if (filters.sequence === 'all') return true;
      return (c.activity.sequence ?? '') === filters.sequence;
    });
  }, [prodColumns, currentPeriod, period, filters, students]);

  /**
   * Ouvre la correction d'une production (celle d'un élève, sinon la liste) dans la fiche de son éval.
   * Une activité pas encore au carnet y entre d'abord, comme avec « + Évaluation → Production
   * numérique » : TP, coefficient 1, barème de l'activité, notes des productions déjà corrigées.
   */
  const openProduction = useCallback(async (column: ProductionColumn<ActivityRow>, studentId: string | null) => {
    await flush();
    const query = studentId ? `?eleve=${encodeURIComponent(studentId)}` : '';
    if (column.assessmentId) { navigate(`/evaluations/${column.assessmentId}${query}`); return; }
    setOpeningProduction(column.activity.id);
    try {
      const r = await linkActivityToClass({ userId, activity: column.activity, classId });
      navigate(`/evaluations/${r.assessmentId}${query}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Impossible d’ouvrir la production');
      setOpeningProduction(null);
    }
  }, [flush, navigate, userId, classId, onError]);

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
    const a = visible[assessmentIndex];
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
      const a = visible[assessmentIndex];
      const st = students[studentIndex];
      if (a && st) void toggleAdapted(a.id, st.id);
    } else if (e.key === 'Escape') {
      // Abandon : on oublie la frappe en cours et on réaffiche la valeur enregistrée.
      e.preventDefault();
      const a = visible[assessmentIndex];
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
        visible.map((a) => {
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
    [visible, grades],
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
    <div className="gc-carnet">
      {/* Menu des classes : une classe est un lieu, pas une option de liste déroulante.
          Sur téléphone, il devient une rangée qui défile (index.css, .gc-carnet). */}
      <nav className="gc-carnet__classes" aria-label="Classes">
        <div className="gc-carnet__classes-title">Classes</div>
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
                className={`gc-carnet__class${on ? ' is-on' : ''}`}
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

        <MoreMenu
          label="⋯"
          title="Sauvegarder les notes, importer un export Pronote"
          items={[
            { label: 'Sauvegarder les notes (Excel, PDF)', onClick: () => setShowExport(true), disabled: !schoolYear, title: 'Toutes les classes et les trois trimestres de l’année' },
            { label: 'Importer un export Pronote (CSV)', onClick: () => { void flush(); setShowPronote(true); }, disabled: !classId || !schoolYear || students.length === 0, title: 'Dans la classe et le trimestre affichés' },
          ]}
        />

        <button onClick={() => setChoosingType(true)} style={btnPrimary} disabled={!classId}>
          + Évaluation
        </button>
      </div>

      {/* Filtres des colonnes : type, séquence, publication ; colonne Moyenne facultative. */}
      {assessments.length > 0 && (() => {
        const kinds = kindsPresent(assessments);
        const sequences = sequencesPresent(assessments);
        const noSeq = hasUnsequenced(assessments);
        return (
          <div className="gc-carnet__filters" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            {kinds.length > 1 && (
              <label style={filterLabel}>
                Type
                <select value={filters.kind} onChange={(e) => setFilter('kind', e.target.value as CarnetPrefs['filters']['kind'])} style={filterSelect}>
                  <option value="all">Tous</option>
                  {kinds.map((k) => <option key={k} value={k}>{ASSESSMENT_KIND_LABEL[k]}</option>)}
                </select>
              </label>
            )}
            {(sequences.length > 0 || filters.sequence !== 'all') && (
              <label style={filterLabel}>
                Séquence
                <select value={filters.sequence} onChange={(e) => setFilter('sequence', e.target.value)} style={filterSelect}>
                  <option value="all">Toutes</option>
                  {sequences.map((q) => <option key={q} value={q}>{q}</option>)}
                  {noSeq && sequences.length > 0 && <option value="">Sans séquence</option>}
                  {filters.sequence !== 'all' && filters.sequence !== '' && !sequences.includes(filters.sequence) && (
                    <option value={filters.sequence}>{filters.sequence}</option>
                  )}
                </select>
              </label>
            )}
            <label style={filterLabel}>
              Publication
              <select value={filters.published} onChange={(e) => setFilter('published', e.target.value as CarnetPrefs['filters']['published'])} style={filterSelect}>
                <option value="all">Toutes</option>
                <option value="yes">Publiées</option>
                <option value="no">Non publiées</option>
              </select>
            </label>
            <label style={{ ...filterLabel, cursor: 'pointer' }}>
              <input type="checkbox" checked={prefs.showAverage} onChange={(e) => setPrefs((p) => ({ ...p, showAverage: e.target.checked }))} />
              Colonne moyenne
            </label>
            <label style={{ ...filterLabel, cursor: 'pointer' }} title="Avancement, hors moyenne, coefficient et classes reliées dans chaque en-tête (toujours visibles dans le menu ▾)">
              <input type="checkbox" checked={prefs.showColumnDetails} onChange={(e) => setPrefs((p) => ({ ...p, showColumnDetails: e.target.checked }))} />
              Détails des colonnes
            </label>
            {filtered && (
              <button onClick={() => setPrefs((p) => ({ ...p, filters: NO_FILTERS }))} style={linkBtn}>
                Tout afficher ({visible.length}/{assessments.length})
              </button>
            )}
          </div>
        );
      })()}

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
      ) : assessments.length === 0 && pendingColumns.length === 0 ? (
        <div style={emptyBox}>
          Aucune évaluation au trimestre {period}. Clique « + Évaluation » pour créer la première.
        </div>
      ) : visible.length === 0 && pendingColumns.length === 0 ? (
        <div style={emptyBox}>
          Aucune évaluation du trimestre {period} ne correspond aux filtres.{' '}
          <button onClick={() => setPrefs((p) => ({ ...p, filters: NO_FILTERS }))} style={linkBtn}>Tout afficher</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th className="gc-carnet__name-col" style={{ ...th, ...stickyCol, textAlign: 'left' }}>Élève</th>
                {visible.map((a) => {
                  const chip = carnetHeaderChip(overviews[a.id], columnStats.get(a.id)?.pending ?? 0);
                  const label = labels.get(a.id);
                  if (!label) return null;
                  return (
                    <th key={a.id} style={{ ...th, ...colSep, minWidth: 112, maxWidth: 168, textAlign: 'left', verticalAlign: 'top', fontWeight: 400 }}>
                      <ColumnHeader
                        assessment={a}
                        label={label}
                        chip={chip ? { label: chip.label, background: CHIP_COLORS[chip.tone][0], color: CHIP_COLORS[chip.tone][1] } : null}
                        showDetails={prefs.showColumnDetails}
                        seriesSize={a.series_id ? seriesSize.get(a.series_id) ?? 1 : 0}
                        suggestion={suggestions.get(a.id) ?? null}
                        toCorrect={(() => {
                          const col = prodByAssessment.get(a.id);
                          if (!col) return null;
                          const gradeOf = (sid: string) => grades.get(cellKey(a.id, sid));
                          const count = students.filter((st) => cellToCorrect(col.works.get(st.id), gradeOf(st.id))).length;
                          if (count === 0) return null;
                          return { count, onOpen: () => { void openProduction(col, firstToCorrect(col, students, gradeOf)); } };
                        })()}
                        all={allAssessments}
                        userId={userId}
                        onOpen={() => { void flush(); }}
                        onDismissSuggestion={() => dismissSuggestion(a.id)}
                        onChanged={() => { void load(); }}
                        onError={onError}
                      />
                    </th>
                  );
                })}
                {pendingColumns.map((c) => {
                  const busy = openingProduction === c.activity.id;
                  const first = firstToCorrect(c, students);
                  // Compteurs sur les lignes affichées : un élève parti de la classe garde sa production
                  // (visible dans la fiche) mais n'a pas de ligne ici.
                  const sent = students.filter((st) => c.works.has(st.id)).length;
                  const todoCount = students.filter((st) => c.works.get(st.id)?.status === 'submitted').length;
                  return (
                    <th key={`prod-${c.activity.id}`} className="gc-carnet__pending-col" style={{ ...th, ...colSep, minWidth: 112, maxWidth: 168, textAlign: 'left', verticalAlign: 'top', fontWeight: 400 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', marginTop: 1 }}><KindIcon kind="tp" size={13} /></span>
                        <button
                          type="button"
                          className="gc-colhead__title"
                          disabled={busy}
                          onClick={() => { void openProduction(c, first); }}
                          title={`${c.activity.title} — productions envoyées, pas encore au carnet.\nOuvrir la correction : l’éval entre au carnet (TP, coef. 1, /${c.activity.bareme_total}).`}
                        >
                          {c.activity.title}
                        </button>
                      </div>
                      <div className="gc-colhead__meta">
                        Production · /{showNum(Number(c.activity.bareme_total))} · {sent} envoi{sent > 1 ? 's' : ''}
                      </div>
                      <div className="gc-colhead__pills">
                        {todoCount > 0 && (
                          <button type="button" className="gc-pill gc-pill--todo" disabled={busy} onClick={() => { void openProduction(c, first); }} title="Ouvrir la correction des productions">
                            {busy ? 'Ouverture…' : `À corriger · ${todoCount}`}
                          </button>
                        )}
                        <span className="gc-pill gc-pill--pending" title="Aucune éval au carnet pour cette activité : elle sera créée à l’ouverture de la correction">pas au carnet</span>
                      </div>
                    </th>
                  );
                })}
                {prefs.showAverage && (
                  <th style={{ ...th, minWidth: 72, background: 'var(--surface-3)' }} title={filtered ? 'Moyenne pondérée des colonnes affichées seulement' : 'Moyenne pondérée du trimestre'}>
                    {filtered ? 'Moy. (filtre)' : 'Moyenne'}
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {students.map((s, si) => {
                const avg = averageFor(s.id);
                return (
                  <tr key={s.id}>
                    <td className="gc-carnet__name-col" style={{ ...td, ...stickyCol, textAlign: 'left', fontWeight: 500 }} title={s.pseudo}>
                      <span className="gc-carnet__name">{s.pseudo}</span>
                      {accommodationTags(s).map((tag) => (
                        <span key={tag} title={accommodationTitle(s)} style={tagStyle}>{tag}</span>
                      ))}
                    </td>
                    {visible.map((a, ai) => {
                      const key = cellKey(a.id, s.id);
                      const row = grades.get(key);
                      const draft = drafts[key];
                      const value = draft !== undefined ? draft : cellText(row);
                      const isStatus = draft === undefined && row && row.status !== 'noted';
                      const bad = invalid[key];
                      const adapted = !!row?.is_adapted;
                      // Brouillon du Correcteur ou de Claude : compte pour le prof, invisible pour l'élève (053).
                      const pending = draft === undefined && !!row && row.grade != null && !row.is_validated;
                      const mark = draft === undefined ? cellMark(a, row, !!copyKeys[a.id]?.has(s.id), overviews[a.id]) : null;
                      const prodCol = prodByAssessment.get(a.id);
                      const todo = draft === undefined && !!prodCol && cellToCorrect(prodCol.works.get(s.id), row);
                      return (
                        <td key={a.id} className={`gc-cell${todo ? ' gc-cell--todo' : ''}`} style={{ ...td, ...colSep, padding: 0, position: 'relative' }}>
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
                            aria-label={`${s.pseudo} — ${a.name}${adapted ? ' (évaluation adaptée)' : ''}${mark ? ` (${CELL_MARK_LABEL[mark]})` : ''}`}
                            title={pending
                              ? 'Brouillon du Correcteur ou de Claude : à valider (bouton « i » ou fiche de l’éval) pour que l’élève le voie. Le modifier ici le valide.'
                              : mark ? CELL_MARK_LABEL[mark].replace(/^./, (c) => c.toUpperCase()) : undefined}
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
                          {todo && prodCol && (
                            <button
                              type="button"
                              tabIndex={-1}
                              className="gc-cell__todo"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { void openProduction(prodCol, s.id); }}
                              title={`Production de ${s.pseudo} envoyée, pas encore corrigée : ouvrir sa correction`}
                            >
                              À corriger
                            </button>
                          )}
                          {mark && !todo && (
                            <span
                              aria-hidden
                              style={{ position: 'absolute', top: 1, left: 3, fontSize: mark === 'draft' ? 10 : 8, color: MARK_STYLE[mark].color, pointerEvents: 'none' }}
                            >
                              {MARK_STYLE[mark].glyph}
                            </span>
                          )}
                          {(
                            <button
                              type="button"
                              tabIndex={-1}
                              className="gc-cell__info"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => { e.currentTarget.blur(); void flush(); setDetail({ assessment: a, studentId: s.id }); }}
                              aria-label={`Détail : ${s.pseudo}, ${a.name}`}
                              title="Détail : note, copie, correction, historique"
                            >
                              i
                            </button>
                          )}
                          {adapted && (
                            <span
                              title={`Évaluation adaptée pour ${s.pseudo}`}
                              style={{ position: 'absolute', top: 1, right: 3, fontSize: 11, color: 'var(--indigo)', pointerEvents: 'none' }}
                            >
                              ✻
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {pendingColumns.map((c) => {
                      const w = c.works.get(s.id);
                      const busy = openingProduction === c.activity.id;
                      return (
                        <td key={`prod-${c.activity.id}`} className="gc-cell gc-carnet__pending-col" style={{ ...td, ...colSep, padding: 0, position: 'relative', height: 33 }}>
                          {w?.status === 'submitted' ? (
                            <button
                              type="button"
                              tabIndex={-1}
                              className="gc-cell__todo"
                              disabled={busy}
                              onClick={() => { void openProduction(c, s.id); }}
                              title={`Production de ${s.pseudo} envoyée, pas encore corrigée : ouvrir sa correction`}
                            >
                              À corriger
                            </button>
                          ) : w ? (
                            <button
                              type="button"
                              tabIndex={-1}
                              className="gc-cell__pending"
                              disabled={busy}
                              onClick={() => { void openProduction(c, s.id); }}
                              title={`Production de ${s.pseudo} corrigée, note pas encore au carnet : ouvrir sa correction`}
                            >
                              {w.total_points != null ? showNum(Number(w.total_points)) : 'corrigée'}
                            </button>
                          ) : null}
                        </td>
                      );
                    })}
                    {prefs.showAverage && (
                      <td style={{ ...td, background: 'var(--surface-3)', fontWeight: 700 }}>
                        {formatGrade(avg)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td style={{ ...tdFoot, ...stickyCol, textAlign: 'left' }}>Moyenne classe</td>
                {visible.map((a) => (
                  <td key={a.id} style={{ ...tdFoot, ...colSep }}>
                    {formatGrade(columnStats.get(a.id)?.mean ?? null)}
                  </td>
                ))}
                {pendingColumns.map((c) => <td key={`prod-${c.activity.id}`} style={{ ...tdFoot, ...colSep }}>—</td>)}
                {prefs.showAverage && <td style={{ ...tdFoot, background: 'var(--surface-3)' }}>{formatGrade(classAverage)}</td>}
              </tr>
              <tr>
                <td style={{ ...tdFoot, ...stickyCol, textAlign: 'left', fontWeight: 400 }}>Médiane</td>
                {visible.map((a) => (
                  <td key={a.id} style={{ ...tdFoot, ...colSep, fontWeight: 400 }}>
                    {formatGrade(columnStats.get(a.id)?.median ?? null)}
                  </td>
                ))}
                {pendingColumns.map((c) => <td key={`prod-${c.activity.id}`} style={{ ...tdFoot, ...colSep, fontWeight: 400 }}>—</td>)}
                {prefs.showAverage && <td style={{ ...tdFoot, background: 'var(--surface-3)' }} />}
              </tr>
              {visible.some((a) => hasCopies(a) && overviews[a.id] && !neverScanned(overviews[a.id])) && (
                <tr>
                  <td style={{ ...tdFoot, ...stickyCol, textAlign: 'left', fontWeight: 400 }} title="Élèves présents dont la copie n’est ni scannée ni transcrite">
                    Copies manquantes
                  </td>
                  {visible.map((a) => {
                    const o = overviews[a.id];
                    const counted = hasCopies(a) && o && !neverScanned(o);
                    return (
                      <td key={a.id} style={{ ...tdFoot, ...colSep, fontWeight: 400, color: counted && o.missing > 0 ? 'var(--warn)' : undefined }}>
                        {counted ? o.missing : '—'}
                      </td>
                    );
                  })}
                  {pendingColumns.map((c) => <td key={`prod-${c.activity.id}`} style={{ ...tdFoot, ...colSep, fontWeight: 400 }}>—</td>)}
                  {prefs.showAverage && <td style={{ ...tdFoot, background: 'var(--surface-3)' }} />}
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {/* Aide-mémoire de saisie */}
      {(assessments.length > 0 || pendingColumns.length > 0) && students.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 10 }}>
          <strong>Entrée</strong> ou <strong>↓</strong> : élève suivant · <strong>Tab</strong> : évaluation suivante ·
          {' '}<strong>a</strong> absent · <strong>d</strong> dispensé · <strong>n</strong> non rendu ·
          {' '}<strong>z</strong> non rendu comptant 0 · <strong>*</strong> évaluation adaptée (✻) ·
          {' '}<strong>Échap</strong> : annuler la frappe ·
          {' '}<strong style={{ color: 'var(--warn)' }}>*</strong> brouillon à valider ·
          {' '}<strong style={{ color: 'var(--indigo)' }}>●</strong> copie à corriger ·
          {' '}<strong>○</strong> copie manquante ·
          {' '}<strong style={{ color: 'var(--indigo)' }}>À corriger</strong> : production envoyée, un clic ouvre sa correction ·
          {' '}<strong>i</strong> (au survol d’une note) : détail de l’élève (copie, correction, historique)
        </p>
      )}

      {detail && (
        <StudentGradeModal
          assessment={detail.assessment}
          studentId={detail.studentId}
          onError={onError}
          onClose={(changed) => { setDetail(null); if (changed) void load(); }}
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

      {choosingType && (
        <NewAssessmentChooser
          userId={userId}
          classId={classId}
          className={className}
          onClassic={() => { setChoosingType(false); setShowCreate(true); }}
          onClose={() => setChoosingType(false)}
        />
      )}

      {showCreate && (
        <AssessmentModal
          title="Nouvelle évaluation"
          className={className}
          classes={classes}
          currentClassId={classId}
          sequences={sequencesPresent(assessments)}
          defaultSequence={filters.sequence !== 'all' ? filters.sequence : ''}
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
                shortName: values.shortName,
                sequence: values.sequence,
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
                shortName: values.shortName,
                sequence: values.sequence,
              });
            }
            setShowCreate(false);
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
const emptyBox: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 40, textAlign: 'center', color: 'var(--text-dim)', fontSize: 14,
};
const filterLabel: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 };
const filterSelect: React.CSSProperties = {
  padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
};
const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  color: 'var(--indigo)', fontFamily: 'inherit',
};
/** Petite pastille PAP / PPRE / PAI à côté d'un nom d'élève. */
const tagStyle: React.CSSProperties = {
  marginLeft: 6, fontSize: 11, fontWeight: 700, color: 'var(--indigo)',
  background: 'var(--indigo-soft)', borderRadius: 999, padding: '1px 6px',
};
const btnBase: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent',
};
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'var(--indigo-ink)', color: '#fff' };
const btnGhost: React.CSSProperties = { ...btnBase, background: 'var(--surface-3)', color: 'var(--text)', border: '1px solid var(--border)' };
