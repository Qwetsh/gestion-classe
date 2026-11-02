import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiCorrectionStartError,
  fetchAiCorrection,
  fetchAssessmentCopies,
  fetchAssessmentGrades,
  fetchAssessmentTranscripts,
  fetchExpectedStudents,
  fetchKitVersions,
  fetchLatestAiCorrections,
  getCopyUrls,
  hasCorrectionKit,
  startAiCorrection,
  validateGrade,
  type AssessmentRow,
  type CopyPageRow,
  type GradeRow,
  type RosterStudent,
} from '../lib/evaluationQueries';
import { parseTranscript, type TranscriptItem } from '../lib/copyTranscript';
import {
  COST_HINT,
  correctionMode,
  describeStartError,
  isApiGrade,
  isRunActive,
  mentionsOtherVersion,
  type AiCorrectionRun,
} from '../lib/aiCorrection';

/**
 * Les copies et les notes d'une éval pour une classe, et les gestes qui s'y appliquent :
 * valider une note, corriger ou recorriger avec Claude (et suivre la correction en cours).
 * Partagé par la visionneuse de la fiche (CopyViewer) et la modale élève × éval du carnet,
 * pour qu'un même geste fasse exactement la même chose aux deux endroits.
 */

export type CopyRowState = 'scanned' | 'absent' | 'missing';

export interface CopyRow {
  student: RosterStudent;
  pages: CopyPageRow[];
  grade: GradeRow | null;
  /** Transcription du Correcteur (migration 056) : reste quand les scans sont supprimés. */
  transcript: TranscriptItem[] | null;
  state: CopyRowState;
}

export const NO_COPY = new Set(['absent', 'dispense', 'non_rendu', 'non_rendu_zero']);

/** On ouvre un élève s'il y a une copie à regarder ou une correction à relire. */
export function isSelectable(r: CopyRow): boolean {
  return r.state === 'scanned' || r.grade?.grade != null || !!r.grade?.details || !!r.transcript;
}

export function useAssessmentCopies(
  assessment: AssessmentRow,
  options: {
    onError: (message: string) => void;
    /** Une note, une validation ou une copie a changé : à répercuter ailleurs (carnet, fiche). */
    onChanged?: () => void;
    /** Change quand le parent veut un rechargement (validation de la classe, purge…). */
    refreshKey?: number;
    /** Appelé après chaque chargement, avec les lignes à jour. */
    onLoaded?: (rows: CopyRow[]) => void;
  },
) {
  const { onError, onChanged, refreshKey = 0 } = options;
  const [rows, setRows] = useState<CopyRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Bouton « Corriger » (migration 057) : kit envoyé par le Correcteur, dernier appel par élève.
  const [hasKit, setHasKit] = useState(false);
  // Versions du sujet qui ont un kit (une copie d'une autre version n'a pas le bon barème).
  const [kitVersions, setKitVersions] = useState<string[]>([]);
  const [aiRuns, setAiRuns] = useState<Record<string, AiCorrectionRun>>({});
  const [startingId, setStartingId] = useState<string | null>(null);

  // La ligne de l'éval est relue à chaque rechargement du parent ; on ne recharge les copies
  // que si l'éval change ou si le parent le demande (refreshKey), pas à chaque nouvel objet.
  const assessmentRef = useRef(assessment);
  assessmentRef.current = assessment;
  const onLoadedRef = useRef(options.onLoaded);
  onLoadedRef.current = options.onLoaded;

  const load = useCallback(async () => {
    const a = assessmentRef.current;
    setLoading(true);
    try {
      const [roster, copies, grades, transcripts, kit, runs, versions] = await Promise.all([
        fetchExpectedStudents([a]),
        fetchAssessmentCopies(a.id),
        fetchAssessmentGrades(a.id),
        fetchAssessmentTranscripts(a.id),
        hasCorrectionKit(a.id),
        fetchLatestAiCorrections(a.id),
        fetchKitVersions(a.id),
      ]);
      setHasKit(kit);
      setKitVersions(versions);
      setAiRuns(runs);
      const gradeBy = new Map(grades.map((g) => [g.student_id, g]));
      const next: CopyRow[] = (roster[a.id] ?? []).map((student) => {
        const pages = copies
          .filter((c) => c.student_id === student.id)
          .sort((x, y) => x.page_order - y.page_order);
        const grade = gradeBy.get(student.id) ?? null;
        const transcript = parseTranscript(transcripts[student.id]);
        // Une copie dont les scans sont supprimés reste « scannée » : sa transcription la remplace.
        const state: CopyRowState =
          pages.length > 0 || transcript ? 'scanned' : grade && NO_COPY.has(grade.status) ? 'absent' : 'missing';
        return { student, pages, grade, transcript, state };
      });
      setRows(next);
      onLoadedRef.current?.(next);
      setUrls(await getCopyUrls(copies.map((c) => c.storage_path)));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Copies introuvables');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.id, refreshKey, onError]);

  useEffect(() => { load(); }, [load]);

  /** Remplace la note d'un élève dans les lignes (après une saisie dans la modale, par exemple). */
  const replaceGrade = useCallback((row: GradeRow) => {
    setRows((prev) => prev.map((r) => (r.student.id === row.student_id ? { ...r, grade: { ...r.grade, ...row } } : r)));
  }, []);

  /** Valide une note en brouillon. Renvoie false si le prof a renoncé ou en cas d'échec. */
  const validate = useCallback(async (g: GradeRow): Promise<boolean> => {
    // Claude a signalé une copie faite sur une autre version du sujet : la note vient d'un autre barème.
    const run = aiRuns[g.student_id];
    if (
      run?.status === 'done' &&
      isApiGrade(g.details) &&
      mentionsOtherVersion(run.a_arbitrer) &&
      !window.confirm('Claude signale que cette copie semble faite sur une autre version du sujet : la note a pu être calculée sur le mauvais barème. Valider quand même ?')
    ) {
      return false;
    }
    try {
      await validateGrade(g.id);
      setRows((prev) => prev.map((r) => (r.grade?.id === g.id ? { ...r, grade: { ...g, is_validated: true } } : r)));
      onChanged?.();
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Échec de la validation');
      return false;
    }
  }, [aiRuns, onChanged, onError]);

  // Suit les corrections en cours ; à la fin, recharge les notes et la transcription.
  const activeRunIds = Object.values(aiRuns).filter((r) => isRunActive(r)).map((r) => r.id).join(',');
  useEffect(() => {
    if (!activeRunIds) return;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await Promise.all(activeRunIds.split(',').map((id) => fetchAiCorrection(id)));
        const finished = fresh.filter((r): r is AiCorrectionRun => !!r && r.status !== 'running');
        if (finished.length === 0) return;
        setAiRuns((prev) => ({ ...prev, ...Object.fromEntries(finished.map((r) => [r.student_id, r])) }));
        if (finished.some((r) => r.status === 'done')) {
          await load();
          onChanged?.();
        }
      } catch {
        // réseau : on réessaie au prochain tour
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeRunIds, load, onChanged]);

  /** Corrige (copie sans note) ou recorrige (copie notée) avec Claude, après confirmation. */
  const correct = useCallback(async (r: CopyRow) => {
    const mode = correctionMode({ pages: r.pages.length, grade: r.grade });
    if (!mode) return;
    const validated = mode === 'recorriger' && !!r.grade?.is_validated;
    const question = validated
      ? `La note de ${r.student.pseudo} est validée. La recorriger la repasse en brouillon (invisible pour l’élève) jusqu’à ce que tu la valides de nouveau. La version actuelle reste dans l’historique.\n\nRecorriger avec Claude (${COST_HINT} de crédits API) ?`
      : mode === 'recorriger'
        ? `Recorriger la copie de ${r.student.pseudo} avec Claude (${COST_HINT} de crédits API) ? La note actuelle sera remplacée (en brouillon) et gardée dans l’historique.`
        : `Corriger la copie de ${r.student.pseudo} avec Claude (${COST_HINT} de crédits API) ? La note arrive en brouillon.`;
    if (!window.confirm(question)) return;
    setStartingId(r.student.id);
    try {
      const runId = await startAiCorrection({
        assessmentId: assessmentRef.current.id,
        studentId: r.student.id,
        mode,
        confirmValidated: validated,
      });
      const run = await fetchAiCorrection(runId);
      if (run) setAiRuns((prev) => ({ ...prev, [run.student_id]: run }));
    } catch (e) {
      onError(e instanceof AiCorrectionStartError ? describeStartError(e.code, e.info) : e instanceof Error ? e.message : 'Correction impossible');
      if (e instanceof AiCorrectionStartError && e.code === 'already_running') load();
    } finally {
      setStartingId(null);
    }
  }, [load, onError]);

  const knownVersions = useMemo(
    () => Array.from(new Set([...rows.map((r) => r.grade?.subject_version), ...kitVersions].filter((v): v is string => !!v))).sort(),
    [rows, kitVersions],
  );
  // Aucune copie scannée ni transcrite : les notes ont été saisies à la main.
  const anyScanned = rows.some((r) => r.state === 'scanned');

  /** Suit un appel lancé ailleurs (correction en lot) : il est relu toutes les 4 s comme les autres. */
  const trackRun = useCallback((run: AiCorrectionRun) => {
    setAiRuns((prev) => ({ ...prev, [run.student_id]: run }));
  }, []);

  return { rows, urls, loading, hasKit, aiRuns, startingId, knownVersions, anyScanned, load, validate, correct, replaceGrade, trackRun };
}
