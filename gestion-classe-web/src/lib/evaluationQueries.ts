import { supabase } from './supabase';
import { getCurrentSchoolYear } from './constants';
import { describeGrades, effectiveGrade, studentAverage, toNumber, toTwenty, type GradeStatus } from './gradeStats';

// Buckets (memes noms que cote mobile / migrations)
const COPIES_BUCKET = 'assessment-copies';
const DOCS_BUCKET = 'assessment-docs';

export type AssessmentDocKind = 'subject' | 'correction';

/** Colonnes d'une eval, serie jointe incluse (le sujet peut venir de la serie). */
const ASSESSMENT_SELECT =
  '*, classes(name), assessment_series(id, user_id, name, level, school_year, subject_path, correction_path, created_at)';

const GRADE_SELECT =
  'id, assessment_id, student_id, grade, grade_raw, comment, status, is_validated, validated_at, updated_at';

/**
 * PostgREST plafonne une reponse a 1000 lignes (meme constante que `PAGE_SIZE` dans
 * Analytics.tsx et Classes.tsx, ou le probleme s'est deja pose sur `events`).
 */
const PAGE_SIZE = 1000;

export interface PageResult<T> { data: T[] | null; error: { message: string } | null }

/**
 * Parcourt toutes les pages d'une requete.
 *
 * Sans ca, une sauvegarde de plus de 1000 notes serait tronquee **sans aucune erreur** :
 * le fichier se telecharge, il a l'air complet, et il ne l'est pas. C'est precisement
 * le mode de defaillance contre lequel le carnet existe.
 */
export async function fetchAllPages<T>(
  build: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) return out;
  }
}

interface RawGradeRow {
  user_id: string;
  assessment_id: string;
  student_id: string;
  grade_raw: number | null;
  status: GradeStatus;
}

/**
 * Recalcule les notes /20 d'une evaluation apres un changement de bareme.
 *
 * `saveGrade` fige `grade = toTwenty(raw, bareme du moment)`. Changer le bareme ensuite
 * laisserait la note brute juste et le /20 faux : moyennes, statistiques, export et fiche
 * eleve mentiraient tous, sans rien afficher d'anormal.
 */
async function recomputeGradesForBareme(assessmentId: string, baremeTotal: number): Promise<void> {
  const rows = await fetchAllPages<RawGradeRow>(async (from, to) => {
    const r = await supabase
      .from('assessment_grades')
      .select('user_id, assessment_id, student_id, grade_raw, status')
      .eq('assessment_id', assessmentId)
      .range(from, to);
    return r as unknown as PageResult<RawGradeRow>;
  });

  const updates = rows
    .filter((r) => r.status === 'noted' && toNumber(r.grade_raw) !== null)
    .map((r) => ({
      user_id: r.user_id,
      assessment_id: r.assessment_id,
      student_id: r.student_id,
      grade_raw: toNumber(r.grade_raw),
      grade: toTwenty(toNumber(r.grade_raw), baremeTotal),
      status: r.status,
    }));
  if (updates.length === 0) return;

  // Un seul aller-retour ; les colonnes absentes de la charge (commentaire, details,
  // is_validated) ne sont pas touchees par le ON CONFLICT DO UPDATE.
  const { error } = await supabase
    .from('assessment_grades')
    .upsert(updates, { onConflict: 'assessment_id,student_id' });
  if (error) throw error;
}

export interface AssessmentRow {
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  subject: string | null;
  date: string | null;
  bareme_total: number | null;
  subject_path: string | null;
  correction_path: string | null;
  created_at: string;
  is_deleted: boolean;
  classes?: { name: string } | null;
  // Migration 039 (carnet de notes)
  series_id: string | null;
  period: number | null;
  school_year: string | null;
  coefficient: number;
  kind: AssessmentKind;
  group_id: string | null;
  counts_in_average: boolean;
  /** TRUE : les élèves de la classe voient leur note, le sujet et le corrigé (migration 040). */
  published_to_students: boolean;
  assessment_series?: AssessmentSeriesRow | null;
}

export type AssessmentKind = 'ecrit' | 'tp' | 'oral' | 'dm' | 'projet';

export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = {
  ecrit: 'Évaluation écrite',
  tp: 'TP',
  oral: 'Oral',
  dm: 'Devoir maison',
  projet: 'Projet',
};

/** Série : une même évaluation déclinée sur plusieurs classes. Porte le sujet et le corrigé. */
export interface AssessmentSeriesRow {
  id: string;
  user_id: string;
  name: string;
  level: string | null;
  school_year: string;
  subject_path: string | null;
  correction_path: string | null;
  created_at: string;
}

export interface CopyPageRow {
  id: string;
  assessment_id: string;
  student_id: string;
  page_order: number;
  storage_path: string;
  students?: { pseudo: string } | null;
}

export interface GradeRow {
  id: string;
  assessment_id: string;
  student_id: string;
  grade: number | null;
  grade_raw: number | null;
  comment: string | null;
  /**
   * Pourquoi il n'y a pas de note (migration 039). Distinct de `is_validated`,
   * qui reste le cycle de vie du pipeline de correction de copies scannées.
   */
  status: GradeStatus;
  is_validated: boolean;
  validated_at: string | null;
  updated_at: string | null;
  students?: { pseudo: string } | null;
}

export interface ClassRow {
  id: string;
  name: string;
}

/** Classes de l'utilisateur (pour le selecteur de creation d'eval). */
export async function fetchClasses(userId: string): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return (data || []) as ClassRow[];
}

export interface CreateAssessmentInput {
  userId: string;
  classId: string;
  name: string;
  subject?: string | null;
  date?: string | null;
  baremeTotal?: number;
  /** Trimestre. Par defaut : celui de trimester_settings, sinon deduit de la date du jour. */
  period?: number;
  schoolYear?: string;
  coefficient?: number;
  kind?: AssessmentKind;
  seriesId?: string | null;
  /** Demi-classe concernee (NULL = classe entiere). */
  groupId?: string | null;
  countsInAverage?: boolean;
}

/** Cree une evaluation depuis le web. Renvoie la ligne creee. */
export async function createAssessment(input: CreateAssessmentInput): Promise<AssessmentRow> {
  const fallback = await fetchCurrentPeriod(input.userId);
  const { data, error } = await supabase
    .from('written_assessments')
    .insert({
      user_id: input.userId,
      class_id: input.classId,
      name: input.name,
      subject: input.subject ?? null,
      date: input.date ?? null,
      bareme_total: input.baremeTotal ?? 20,
      period: input.period ?? fallback.period,
      school_year: input.schoolYear ?? fallback.schoolYear,
      coefficient: input.coefficient ?? 1,
      kind: input.kind ?? 'ecrit',
      series_id: input.seriesId ?? null,
      group_id: input.groupId ?? null,
      counts_in_average: input.countsInAverage ?? true,
    })
    .select(ASSESSMENT_SELECT)
    .single();
  if (error) throw error;
  return data as AssessmentRow;
}

/** Liste des evals (non supprimees) de l'utilisateur, classe incluse, recentes d'abord. */
export async function fetchAssessments(userId: string): Promise<AssessmentRow[]> {
  const { data, error } = await supabase
    .from('written_assessments')
    .select(ASSESSMENT_SELECT)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AssessmentRow[];
}

/** Pages de copies d'une eval, avec le pseudo de l'eleve, triees par eleve puis page. */
export async function fetchAssessmentCopies(assessmentId: string): Promise<CopyPageRow[]> {
  const { data, error } = await supabase
    .from('assessment_copy_pages')
    .select('id, assessment_id, student_id, page_order, storage_path, students(pseudo)')
    .eq('assessment_id', assessmentId)
    .order('student_id')
    .order('page_order');
  if (error) throw error;
  return (data || []) as unknown as CopyPageRow[];
}

/** Notes d'une eval (brouillon + validees), avec le pseudo. */
export async function fetchAssessmentGrades(assessmentId: string): Promise<GradeRow[]> {
  const { data, error } = await supabase
    .from('assessment_grades')
    .select(GRADE_SELECT + ', students(pseudo)')
    .eq('assessment_id', assessmentId);
  if (error) throw error;
  return (data || []) as unknown as GradeRow[];
}

/** Signed URL d'une page de copie (bucket prive assessment-copies). */
export async function getCopyUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(COPIES_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

/** Signed URL d'un document (sujet/correction, bucket prive assessment-docs). */
export async function getDocUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

function extOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type === 'application/pdf' ? 'pdf' : 'jpg';
}

/**
 * Upload du sujet ou de la correction depuis le web. Remplace l'ancien fichier si present
 * (chemin different -> on supprime l'orphelin), met a jour la colonne subject_path/correction_path.
 * Renvoie le storage_path enregistre.
 */
export async function uploadAssessmentDoc(
  userId: string,
  assessmentId: string,
  kind: AssessmentDocKind,
  file: File,
  previousPath: string | null,
): Promise<string> {
  const path = `${userId}/${assessmentId}/${kind}.${extOf(file)}`;

  const { error: upErr } = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (upErr) throw upErr;

  // Nettoie l'ancien fichier si l'extension a change (chemin different)
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(DOCS_BUCKET).remove([previousPath]);
  }

  const column = kind === 'subject' ? 'subject_path' : 'correction_path';
  const { error: updErr } = await supabase
    .from('written_assessments')
    .update({ [column]: path, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (updErr) throw updErr;

  return path;
}

/** Supprime un document (sujet/correction) : fichier Storage + colonne remise a null. */
export async function deleteAssessmentDoc(
  assessmentId: string,
  kind: AssessmentDocKind,
  path: string,
): Promise<void> {
  await supabase.storage.from(DOCS_BUCKET).remove([path]);
  const column = kind === 'subject' ? 'subject_path' : 'correction_path';
  const { error } = await supabase
    .from('written_assessments')
    .update({ [column]: null, updated_at: new Date().toISOString() })
    .eq('id', assessmentId);
  if (error) throw error;
}

/** Valide une note (is_validated = true). */
export async function validateGrade(gradeId: string): Promise<void> {
  const { error } = await supabase
    .from('assessment_grades')
    .update({ is_validated: true, validated_at: new Date().toISOString() })
    .eq('id', gradeId);
  if (error) throw error;
}

// ============================================================
// Carnet de notes (migration 039 — cf. PLAN_carnet_de_notes.md)
// ============================================================

export interface CurrentPeriod {
  period: number;
  schoolYear: string;
}

/**
 * Période courante. Source unique : `trimester_settings` (UNIQUE sur user_id).
 * Repli sur la date du jour si l'utilisateur n'a jamais réglé ses trimestres.
 */
export async function fetchCurrentPeriod(userId: string): Promise<CurrentPeriod> {
  const { data } = await supabase
    .from('trimester_settings')
    .select('current_trimester, school_year')
    .eq('user_id', userId)
    .maybeSingle();

  if (data?.current_trimester && data?.school_year) {
    return { period: data.current_trimester, schoolYear: data.school_year };
  }

  const month = new Date().getMonth() + 1;
  const period = month >= 8 && month <= 12 ? 1 : month <= 3 ? 2 : 3;
  return { period, schoolYear: getCurrentSchoolYear() };
}

/** Élève affiché dans une ligne du carnet. */
export interface CarnetStudent {
  id: string;
  pseudo: string;
}

export interface CarnetData {
  students: CarnetStudent[];
  assessments: AssessmentRow[];
  /** Toutes les notes des évals ci-dessus, tous élèves confondus. */
  grades: GradeRow[];
}

/**
 * Charge le carnet d'une classe pour une période : élèves, évaluations, notes.
 *
 * Les lignes sont les élèves **actuellement** rattachés à la classe : un élève détaché
 * au passage d'année (`class_id → SET NULL`) garde ses notes en base et sur sa fiche,
 * mais ne figure plus ici. Les évals supprimées (`is_deleted`) sont exclues.
 */
export async function fetchCarnet(
  userId: string,
  classId: string,
  schoolYear: string,
  period: number,
): Promise<CarnetData> {
  const [studentsRes, assessmentsRes] = await Promise.all([
    supabase
      .from('students')
      .select('id, pseudo')
      .eq('user_id', userId)
      .eq('class_id', classId)
      .order('pseudo'),
    supabase
      .from('written_assessments')
      .select(ASSESSMENT_SELECT)
      .eq('user_id', userId)
      .eq('class_id', classId)
      .eq('school_year', schoolYear)
      .eq('period', period)
      .eq('is_deleted', false)
      .order('date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
  ]);

  if (studentsRes.error) throw studentsRes.error;
  if (assessmentsRes.error) throw assessmentsRes.error;

  const assessments = (assessmentsRes.data || []) as unknown as AssessmentRow[];
  const ids = assessments.map((a) => a.id);

  // Pas d'éval : inutile d'interroger les notes avec un `in` vide.
  if (ids.length === 0) {
    return { students: (studentsRes.data || []) as CarnetStudent[], assessments, grades: [] };
  }

  const grades = await fetchAllPages<GradeRow>(async (from, to) => {
    const r = await supabase
      .from('assessment_grades')
      .select(GRADE_SELECT)
      .in('assessment_id', ids)
      .range(from, to);
    return r as unknown as PageResult<GradeRow>;
  });

  return {
    students: (studentsRes.data || []) as CarnetStudent[],
    assessments,
    grades,
  };
}

export interface SaveGradeInput {
  userId: string;
  assessmentId: string;
  studentId: string;
  /** Note brute sur le barème de l'éval, `null` si le statut n'en porte pas. */
  raw: number | null;
  /** Note ramenée /20, `null` de même. */
  grade: number | null;
  status: GradeStatus;
}

/**
 * Enregistre une cellule du carnet. S'appuie sur `UNIQUE (assessment_id, student_id)`
 * pour créer ou mettre à jour en un seul aller-retour.
 *
 * `is_validated` n'est volontairement pas touché : la validation reste le geste explicite
 * du pipeline de correction de copies.
 */
export async function saveGrade(input: SaveGradeInput): Promise<GradeRow> {
  const { data, error } = await supabase
    .from('assessment_grades')
    .upsert(
      {
        user_id: input.userId,
        assessment_id: input.assessmentId,
        student_id: input.studentId,
        grade: input.grade,
        grade_raw: input.raw,
        status: input.status,
      },
      { onConflict: 'assessment_id,student_id' },
    )
    .select(GRADE_SELECT)
    .single();
  if (error) throw error;
  return data as unknown as GradeRow;
}

export interface UpdateAssessmentInput {
  name?: string;
  subject?: string | null;
  date?: string | null;
  baremeTotal?: number;
  period?: number;
  coefficient?: number;
  kind?: AssessmentKind;
  countsInAverage?: boolean;
  publishedToStudents?: boolean;
}

/** Modifie une évaluation. Ne propage rien à sa série : la propagation est un geste explicite. */
export async function updateAssessment(assessmentId: string, patch: UpdateAssessmentInput): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.subject !== undefined) row.subject = patch.subject;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.baremeTotal !== undefined) row.bareme_total = patch.baremeTotal;
  if (patch.period !== undefined) row.period = patch.period;
  if (patch.coefficient !== undefined) row.coefficient = patch.coefficient;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.countsInAverage !== undefined) row.counts_in_average = patch.countsInAverage;
  if (patch.publishedToStudents !== undefined) row.published_to_students = patch.publishedToStudents;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from('written_assessments').update(row).eq('id', assessmentId);
  if (error) throw error;

  if (patch.baremeTotal !== undefined) await recomputeGradesForBareme(assessmentId, patch.baremeTotal);
}

/** Suppression douce, cohérente avec le filtre `is_deleted` de `fetchAssessments`. */
export async function softDeleteAssessment(assessmentId: string): Promise<void> {
  const { error } = await supabase
    .from('written_assessments')
    .update({ is_deleted: true })
    .eq('id', assessmentId);
  if (error) throw error;
}

export interface CreateSeriesInput {
  userId: string;
  name: string;
  level: string | null;
  classIds: string[];
  subject?: string | null;
  date?: string | null;
  baremeTotal?: number;
  period?: number;
  schoolYear?: string;
  coefficient?: number;
  kind?: AssessmentKind;
  countsInAverage?: boolean;
}

/**
 * Crée une même évaluation sur plusieurs classes : une série, puis une ligne par classe.
 *
 * Le sujet et le corrigé sont portés par la série (chemin `user_id/series/{id}/…`),
 * jamais par un chemin partagé entre les lignes — celui-ci contient l'`assessmentId`
 * et laisserait des orphelins à la première suppression.
 */
export async function createAssessmentSeries(input: CreateSeriesInput): Promise<{
  series: AssessmentSeriesRow;
  assessments: AssessmentRow[];
}> {
  if (input.classIds.length === 0) throw new Error('Aucune classe sélectionnée.');

  const fallback = await fetchCurrentPeriod(input.userId);
  const schoolYear = input.schoolYear ?? fallback.schoolYear;

  const { data: series, error: seriesErr } = await supabase
    .from('assessment_series')
    .insert({
      user_id: input.userId,
      name: input.name,
      level: input.level,
      school_year: schoolYear,
    })
    .select('*')
    .single();
  if (seriesErr) throw seriesErr;

  const { data: rows, error: rowsErr } = await supabase
    .from('written_assessments')
    .insert(
      input.classIds.map((classId) => ({
        user_id: input.userId,
        class_id: classId,
        name: input.name,
        subject: input.subject ?? null,
        date: input.date ?? null,
        bareme_total: input.baremeTotal ?? 20,
        period: input.period ?? fallback.period,
        school_year: schoolYear,
        coefficient: input.coefficient ?? 1,
        kind: input.kind ?? 'ecrit',
        series_id: series.id,
        counts_in_average: input.countsInAverage ?? true,
      })),
    )
    .select(ASSESSMENT_SELECT);
  if (rowsErr) {
    // Sinon la serie reste en base sans aucune evaluation rattachee.
    await supabase.from('assessment_series').delete().eq('id', series.id);
    throw rowsErr;
  }

  return {
    series: series as AssessmentSeriesRow,
    assessments: (rows || []) as unknown as AssessmentRow[],
  };
}

/**
 * Chemin effectif d'un document : celui de l'éval si elle en a un, sinon celui de sa série.
 * Une éval de série hérite du sujet commun sans le dupliquer.
 */
export function effectiveDocPath(
  assessment: Pick<AssessmentRow, 'subject_path' | 'correction_path' | 'assessment_series'>,
  kind: AssessmentDocKind,
): string | null {
  const own = kind === 'subject' ? assessment.subject_path : assessment.correction_path;
  if (own) return own;
  const series = assessment.assessment_series;
  if (!series) return null;
  return kind === 'subject' ? series.subject_path : series.correction_path;
}

// ============================================================
// Export du carnet (lot 3) — cf. PLAN_carnet_de_notes.md §6.2
// ============================================================

/** Un élève dans une feuille d'export. */
export interface ExportStudent {
  id: string;
  pseudo: string;
  /**
   * `false` si l'élève n'est plus rattaché à cette classe (changement de classe en cours
   * d'année, ou détachement au passage d'année) mais y a laissé des notes. Ces notes
   * doivent figurer dans la sauvegarde : elles existent en base.
   */
  attached: boolean;
}

export interface ExportClass {
  classId: string;
  className: string;
  students: ExportStudent[];
  assessments: AssessmentRow[];
  /** Clé `${assessment_id}|${student_id}`. */
  grades: Map<string, GradeRow>;
}

export interface GradeBookExport {
  /** Années couvertes, de la plus ancienne à la plus récente. */
  schoolYears: string[];
  classes: ExportClass[];
  totalGrades: number;
  /** Date de l'évaluation la plus ancienne : depuis quand la sauvegarde couvre réellement. */
  coverageFrom: string | null;
  /** Nombre d'élèves présents dans l'export sans être rattachés à la classe. */
  detachedCount: number;
}

/**
 * Charge le carnet à sauvegarder : toutes les classes, toutes les périodes, et
 * au choix l'année courante seule ou tout l'historique.
 *
 * Deux règles non négociables ici, parce que c'est *la* requête de la sauvegarde :
 * - **tout est paginé** : au-delà de 1000 lignes, une requête simple tronque en silence ;
 * - **on suit l'élève, pas la classe** : un élève qui a changé de classe ou qui a été
 *   détaché au passage d'année garde ses notes, et elles doivent sortir dans le fichier.
 */
export async function fetchGradeBookExport(
  userId: string,
  schoolYear: string | null,
): Promise<GradeBookExport> {
  const [classRows, studentRows, assessments, allGrades] = await Promise.all([
    fetchAllPages<ClassRow>(async (from, to) => {
      const r = await supabase.from('classes').select('id, name').eq('user_id', userId)
        .order('name').range(from, to);
      return r as unknown as PageResult<ClassRow>;
    }),
    // Tous les élèves, y compris ceux dont `class_id` est NULL (détachés).
    fetchAllPages<{ id: string; pseudo: string; class_id: string | null }>(async (from, to) => {
      const r = await supabase.from('students').select('id, pseudo, class_id')
        .eq('user_id', userId).order('pseudo').range(from, to);
      return r as unknown as PageResult<{ id: string; pseudo: string; class_id: string | null }>;
    }),
    fetchAllPages<AssessmentRow>(async (from, to) => {
      let q = supabase.from('written_assessments').select(ASSESSMENT_SELECT)
        .eq('user_id', userId).eq('is_deleted', false);
      if (schoolYear) q = q.eq('school_year', schoolYear);
      const r = await q
        .order('school_year', { ascending: true })
        .order('period', { ascending: true })
        .order('date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .range(from, to);
      return r as unknown as PageResult<AssessmentRow>;
    }),
    fetchAllPages<GradeRow>(async (from, to) => {
      const r = await supabase.from('assessment_grades').select(GRADE_SELECT)
        .eq('user_id', userId).range(from, to);
      return r as unknown as PageResult<GradeRow>;
    }),
  ]);

  const assessmentIds = new Set(assessments.map((a) => a.id));
  const grades = allGrades.filter((g) => assessmentIds.has(g.assessment_id));

  const pseudoById = new Map(studentRows.map((s) => [s.id, s.pseudo]));

  const gradesByAssessment = new Map<string, GradeRow[]>();
  for (const g of grades) {
    const list = gradesByAssessment.get(g.assessment_id) ?? [];
    list.push(g);
    gradesByAssessment.set(g.assessment_id, list);
  }

  let detachedCount = 0;

  const classes: ExportClass[] = classRows.map((c) => {
    const classAssessments = assessments.filter((a) => a.class_id === c.id);
    const cellGrades = new Map<string, GradeRow>();
    /** Élèves ayant une note sur une éval de cette classe, quel que soit leur rattachement. */
    const withGrades = new Set<string>();

    for (const a of classAssessments) {
      for (const g of gradesByAssessment.get(a.id) ?? []) {
        cellGrades.set(`${g.assessment_id}|${g.student_id}`, g);
        withGrades.add(g.student_id);
      }
    }

    const attached = studentRows.filter((s) => s.class_id === c.id);
    const attachedIds = new Set(attached.map((s) => s.id));

    const extras: ExportStudent[] = [...withGrades]
      .filter((id) => !attachedIds.has(id))
      .map((id) => ({ id, pseudo: pseudoById.get(id) ?? '(élève supprimé)', attached: false }))
      .sort((a, b) => a.pseudo.localeCompare(b.pseudo));
    detachedCount += extras.length;

    return {
      classId: c.id,
      className: c.name,
      students: [
        ...attached.map((s) => ({ id: s.id, pseudo: s.pseudo, attached: true })),
        ...extras,
      ],
      assessments: classAssessments,
      grades: cellGrades,
    };
  });

  const dates = assessments
    .map((a) => a.date ?? a.created_at.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();

  return {
    schoolYears: [...new Set(assessments.map((a) => a.school_year).filter((y): y is string => !!y))].sort(),
    classes: classes.filter((c) => c.assessments.length > 0),
    totalGrades: grades.length,
    coverageFrom: dates[0] ?? null,
    detachedCount,
  };
}

// ============================================================
// Fiche élève : bloc « Notes » (lot 6)
// ============================================================

export interface StudentGradeLine {
  assessment: AssessmentRow;
  /** Nom de la classe où l'évaluation a eu lieu. */
  className: string;
  /** `true` si l'évaluation appartient à une autre classe que celle de l'élève aujourd'hui. */
  fromOtherClass: boolean;
  /** La note de l'élève, `null` si rien n'a été saisi pour lui. */
  grade: GradeRow | null;
  /** Moyenne de la classe à cette évaluation, pour situer l'élève. */
  classMean: number | null;
  /** Écart à la moyenne de classe, `null` si l'un des deux manque. */
  gap: number | null;
}

export interface StudentGradeReport {
  lines: StudentGradeLine[];
  /** Moyenne pondérée de l'élève par trimestre (clé 1, 2, 3). */
  averageByPeriod: Record<number, number | null>;
  /** Moyenne pondérée sur toute l'année. */
  yearAverage: number | null;
}

/**
 * Notes d'un élève sur une année scolaire, avec la moyenne de classe de chaque évaluation.
 *
 * Deux choix explicites :
 * - ne filtre PAS sur `is_validated` : cette vue est celle de l'enseignant, et une note
 *   tapée au carnet est validée par construction (`is_validated` ne concerne que le
 *   pipeline de correction de copies scannées) ;
 * - **suit l'élève** : on part de ses notes, pas de sa classe actuelle, sinon tout ce
 *   qu'il a fait avant un changement de classe disparaîtrait de sa fiche.
 */
export async function fetchStudentGradeReport(
  userId: string,
  studentId: string,
  classId: string | null,
  schoolYear: string,
): Promise<StudentGradeReport> {
  const [allAssessments, ownGrades] = await Promise.all([
    fetchAllPages<AssessmentRow>(async (from, to) => {
      const r = await supabase.from('written_assessments').select(ASSESSMENT_SELECT)
        .eq('user_id', userId).eq('school_year', schoolYear).eq('is_deleted', false)
        .order('period', { ascending: true })
        .order('date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .range(from, to);
      return r as unknown as PageResult<AssessmentRow>;
    }),
    fetchAllPages<GradeRow>(async (from, to) => {
      const r = await supabase.from('assessment_grades').select(GRADE_SELECT)
        .eq('student_id', studentId).range(from, to);
      return r as unknown as PageResult<GradeRow>;
    }),
  ]);

  const gradedIds = new Set(ownGrades.map((g) => g.assessment_id));
  // Les évals de sa classe actuelle (même sans note : « non corrigée »),
  // plus toutes celles où il a une note, y compris dans une classe qu'il a quittée.
  const relevant = allAssessments.filter((a) => a.class_id === classId || gradedIds.has(a.id));
  if (relevant.length === 0) {
    return { lines: [], averageByPeriod: { 1: null, 2: null, 3: null }, yearAverage: null };
  }

  const ids = relevant.map((a) => a.id);
  const classGrades = await fetchAllPages<GradeRow>(async (from, to) => {
    const r = await supabase.from('assessment_grades').select(GRADE_SELECT)
      .in('assessment_id', ids).range(from, to);
    return r as unknown as PageResult<GradeRow>;
  });

  const byAssessment = new Map<string, GradeRow[]>();
  for (const g of classGrades) {
    const list = byAssessment.get(g.assessment_id) ?? [];
    list.push(g);
    byAssessment.set(g.assessment_id, list);
  }

  const lines: StudentGradeLine[] = relevant.map((a) => {
    const all = byAssessment.get(a.id) ?? [];
    const mine = all.find((g) => g.student_id === studentId) ?? null;

    const stats = describeGrades(
      all.map((g) => ({ studentId: g.student_id, grade: g.grade, status: g.status })),
    );
    const own = mine ? effectiveGrade({ studentId, grade: mine.grade, status: mine.status }) : null;

    return {
      assessment: a,
      className: a.classes?.name ?? '—',
      fromOtherClass: a.class_id !== classId,
      grade: mine,
      classMean: stats.mean,
      gap: own !== null && stats.mean !== null ? own - stats.mean : null,
    };
  });

  const averageFor = (period: number | null) =>
    studentAverage(
      lines
        .filter((l) => period === null || l.assessment.period === period)
        .map((l) => ({
          entry: {
            studentId,
            grade: l.grade?.grade ?? null,
            status: l.grade?.status ?? 'noted',
          },
          assessment: {
            coefficient: toNumber(l.assessment.coefficient) ?? 0,
            countsInAverage: l.assessment.counts_in_average,
          },
        })),
    );

  return {
    lines,
    averageByPeriod: { 1: averageFor(1), 2: averageFor(2), 3: averageFor(3) },
    yearAverage: averageFor(null),
  };
}

// ============================================================
// Séries : propagation et comparaison inter-classes (lot 4)
// ============================================================

/**
 * Applique une modification à **toutes** les évaluations d'une série.
 *
 * Volontairement séparé de `updateAssessment` : propager est un geste explicite,
 * jamais un effet de bord de la modification d'une classe.
 */
export async function updateSeriesAssessments(
  seriesId: string,
  patch: UpdateAssessmentInput,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.subject !== undefined) row.subject = patch.subject;
  if (patch.baremeTotal !== undefined) row.bareme_total = patch.baremeTotal;
  if (patch.period !== undefined) row.period = patch.period;
  if (patch.coefficient !== undefined) row.coefficient = patch.coefficient;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.countsInAverage !== undefined) row.counts_in_average = patch.countsInAverage;
  // La date n'est jamais propagée : chaque classe passe l'évaluation son jour.
  if (Object.keys(row).length === 0) return;

  const { data, error } = await supabase
    .from('written_assessments')
    .update(row)
    .eq('series_id', seriesId)
    .eq('is_deleted', false)
    .select('id');
  if (error) throw error;

  if (patch.baremeTotal !== undefined) {
    const bareme = patch.baremeTotal;
    for (const a of (data || []) as { id: string }[]) {
      await recomputeGradesForBareme(a.id, bareme);
    }
  }
}

/** Une classe de la série, avec les notes de ses élèves à cette évaluation. */
export interface SeriesClassRow {
  assessmentId: string;
  classId: string;
  className: string;
  date: string | null;
  /** Une entrée par élève de la classe, y compris ceux sans note. */
  entries: { grade: number | null; status: string }[];
}

/**
 * Les notes de toutes les classes d'une série, pour comparer un même devoir
 * d'une classe à l'autre.
 */
export async function fetchSeriesComparison(userId: string, seriesId: string): Promise<SeriesClassRow[]> {
  const { data: assessmentRows, error: aErr } = await supabase
    .from('written_assessments')
    .select('id, class_id, date, classes(name)')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .eq('is_deleted', false);
  if (aErr) throw aErr;

  const assessments = (assessmentRows || []) as unknown as {
    id: string; class_id: string; date: string | null; classes?: { name: string } | null;
  }[];
  if (assessments.length === 0) return [];

  const classIds = [...new Set(assessments.map((a) => a.class_id))];
  const [studentsRes, gradesRes] = await Promise.all([
    supabase.from('students').select('id, class_id').eq('user_id', userId).in('class_id', classIds),
    supabase.from('assessment_grades').select('assessment_id, student_id, grade, status')
      .in('assessment_id', assessments.map((a) => a.id)),
  ]);
  if (studentsRes.error) throw studentsRes.error;
  if (gradesRes.error) throw gradesRes.error;

  const studentsByClass = new Map<string, string[]>();
  for (const s of (studentsRes.data || []) as { id: string; class_id: string }[]) {
    const list = studentsByClass.get(s.class_id) ?? [];
    list.push(s.id);
    studentsByClass.set(s.class_id, list);
  }

  const gradeByCell = new Map<string, { grade: number | null; status: string }>();
  for (const g of (gradesRes.data || []) as {
    assessment_id: string; student_id: string; grade: number | null; status: string;
  }[]) {
    gradeByCell.set(`${g.assessment_id}|${g.student_id}`, { grade: g.grade, status: g.status });
  }

  return assessments
    .map((a) => ({
      assessmentId: a.id,
      classId: a.class_id,
      className: a.classes?.name ?? '—',
      date: a.date,
      entries: (studentsByClass.get(a.class_id) ?? []).map(
        (sid) => gradeByCell.get(`${a.id}|${sid}`) ?? { grade: null, status: 'noted' },
      ),
    }))
    .sort((x, y) => x.className.localeCompare(y.className));
}

