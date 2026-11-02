-- Migration 063 : les séances de groupe dans le carnet (hub Évaluations, phase 3)
-- Description : PLAN_hub_evaluations.md, phase 3. Une séance de groupe TERMINÉE (group_sessions,
--   notée sur critères en séance, web ou mobile) devient une évaluation du carnet :
--   written_assessments.kind = 'groupe', reliée par group_session_id, et une note par membre
--   (assessment_grades) = total du groupe (points des critères − malus), sur la somme des critères.
--
--   - Synchronisation en base, par déclencheurs : le mobile et le web écrivent dans les mêmes
--     tables (group_sessions, grading_criteria, session_groups, session_group_members,
--     group_grades) ; toute modification d'une séance terminée met l'éval à jour. Une séance en
--     cours n'est pas touchée (le déclencheur s'arrête aussitôt).
--   - Note individuelle ajustable : une note dont le prof a changé la valeur (note brute ≠ total
--     du groupe enregistré dans son détail) ou le statut (absent…) n'est plus recalculée ; seul son
--     détail (critères, membres) suit la séance.
--   - Réglages de l'éval à la création : nom de la séance (« TP de groupe du JJ/MM » pour le nom
--     par défaut), date de fin, trimestre et année courants du prof, coefficient 1, HORS moyenne
--     (choix de Thomas, 02/11/2026), non publiée. Ensuite, le prof les change comme pour toute éval ;
--     seul le barème suit les critères.
--   - Suppression : supprimer la séance met l'éval à la corbeille (is_deleted, réversible) ;
--     supprimer l'éval dans le carnet ne la fait pas réapparaître.
--   - Détail de la note (assessment_grades.details) : {"v": 2, "type": "groupe", "groupe": {nom,
--     membres, criteres: [{label, points, max}], malus, total, bareme, seance_id}}. La lecture des
--     corrections v1 l'ignore : l'élève ne voit que la note.
--   - Historique (migration 061) : une version remplacée a pour auteur 'groupe' si c'était la note du
--     groupe, 'prof' si le prof l'avait ajustée (note ≠ total du groupe, ou statut absent…).
--
--   Les séances déjà terminées ne sont PAS versées par cette migration : c'est la commande
--   « Bascule » plus bas, lancée à part avec l'accord de Thomas.
--
-- Retour arrière :
--   DROP TRIGGER IF EXISTS trg_group_sessions_sync ON public.group_sessions;
--   DROP TRIGGER IF EXISTS trg_grading_criteria_sync ON public.grading_criteria;
--   DROP TRIGGER IF EXISTS trg_session_groups_sync ON public.session_groups;
--   DROP TRIGGER IF EXISTS trg_session_group_members_sync ON public.session_group_members;
--   DROP TRIGGER IF EXISTS trg_group_grades_sync ON public.group_grades;
--   DROP TRIGGER IF EXISTS trg_group_sessions_trash ON public.group_sessions;
--   DROP FUNCTION IF EXISTS public.group_session_sync_trigger(), public.group_session_trash_trigger(),
--     public.sync_group_session_assessment(uuid);
--   UPDATE public.written_assessments SET is_deleted = true WHERE kind = 'groupe';  -- (évals créées)
--   puis remettre la contrainte de kind et la fonction d'archivage de 061.

-- ------------------------------------------------------------------
-- 1. Type 'groupe' et lien vers la séance
-- ------------------------------------------------------------------
ALTER TABLE public.written_assessments DROP CONSTRAINT IF EXISTS written_assessments_kind_check;
ALTER TABLE public.written_assessments ADD CONSTRAINT written_assessments_kind_check
  CHECK (kind = ANY (ARRAY['ecrit', 'tp', 'oral', 'dm', 'projet', 'groupe']));

ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS group_session_id uuid REFERENCES public.group_sessions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.written_assessments.group_session_id IS
  'Séance de groupe dont cette éval (kind = groupe) reprend les notes ; NULL sinon.';

-- Une séance = au plus une éval vivante.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_group_session
  ON public.written_assessments (group_session_id)
  WHERE group_session_id IS NOT NULL AND NOT is_deleted;

-- ------------------------------------------------------------------
-- 2. Historique : auteur 'groupe'
-- ------------------------------------------------------------------
ALTER TABLE public.assessment_grade_revisions DROP CONSTRAINT IF EXISTS assessment_grade_revisions_source_check;
ALTER TABLE public.assessment_grade_revisions ADD CONSTRAINT assessment_grade_revisions_source_check
  CHECK (source IN ('prof', 'ia', 'correcteur', 'groupe'));

CREATE OR REPLACE FUNCTION public.assessment_grades_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.assessment_grade_revisions
    (grade_id, user_id, assessment_id, student_id, source, grade, grade_raw, status, comment,
     details, was_validated, version_at)
  VALUES
    (OLD.id, OLD.user_id, OLD.assessment_id, OLD.student_id,
     CASE
       WHEN OLD.details ->> 'type' = 'groupe' AND OLD.status = 'noted'
            AND OLD.grade_raw IS NOT DISTINCT FROM (OLD.details #>> '{groupe,total}')::numeric THEN 'groupe'
       WHEN OLD.details ->> 'type' = 'groupe' THEN 'prof'
       WHEN OLD.details ->> 'source' = 'api' THEN 'ia'
       WHEN OLD.details IS NOT NULL THEN 'correcteur'
       ELSE 'prof'
     END,
     OLD.grade, OLD.grade_raw, OLD.status, OLD.comment, OLD.details,
     coalesce(OLD.is_validated, false), coalesce(OLD.updated_at, OLD.created_at));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.assessment_grades_archive() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------
-- 3. Synchronisation d'une séance terminée → éval du carnet
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_group_session_assessment(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s            public.group_sessions%ROWTYPE;
  v_assessment uuid;
  v_bareme     numeric;
  v_date       date;
  v_name       text;
  v_period     integer;
  v_year       varchar;
  g            record;
  m            record;
  v_crit       jsonb;
  v_members    jsonb;
  v_points     numeric;
  v_total      numeric;
  v_details    jsonb;
  v_twenty     numeric;
  ex           public.assessment_grades%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.group_sessions WHERE id = p_session_id;
  IF NOT FOUND OR s.status IS DISTINCT FROM 'completed' THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(max_points), 0) INTO v_bareme FROM public.grading_criteria WHERE session_id = s.id;
  IF v_bareme <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_assessment
  FROM public.written_assessments
  WHERE group_session_id = s.id AND NOT is_deleted;

  IF v_assessment IS NULL THEN
    -- Le prof a supprimé l'éval : on ne la recrée pas.
    IF EXISTS (SELECT 1 FROM public.written_assessments WHERE group_session_id = s.id AND is_deleted) THEN
      RETURN NULL;
    END IF;
    v_date := coalesce(s.completed_at, s.created_at)::date;
    v_name := CASE
      WHEN coalesce(btrim(s.name), '') IN ('', 'Séance de groupe') THEN 'TP de groupe du ' || to_char(v_date, 'DD/MM')
      ELSE s.name
    END;
    SELECT current_trimester, school_year INTO v_period, v_year
    FROM public.trimester_settings WHERE user_id = s.user_id;
    v_year := coalesce(v_year,
      CASE WHEN extract(month FROM v_date) >= 8
        THEN extract(year FROM v_date)::int || '-' || (extract(year FROM v_date)::int + 1)
        ELSE (extract(year FROM v_date)::int - 1) || '-' || extract(year FROM v_date)::int
      END);
    INSERT INTO public.written_assessments
      (user_id, class_id, name, date, bareme_total, period, school_year, coefficient, kind,
       counts_in_average, published_to_students, group_session_id)
    VALUES
      (s.user_id, s.class_id, v_name, v_date, v_bareme, coalesce(v_period, 1), v_year, 1, 'groupe',
       false, false, s.id)
    RETURNING id INTO v_assessment;
  ELSE
    UPDATE public.written_assessments SET bareme_total = v_bareme
    WHERE id = v_assessment AND bareme_total IS DISTINCT FROM v_bareme;
  END IF;

  FOR g IN
    SELECT sg.id, sg.name, coalesce(sg.conduct_malus, 0)::numeric AS malus
    FROM public.session_groups sg WHERE sg.session_id = s.id
  LOOP
    SELECT coalesce(sum(coalesce(gg.points_awarded, 0)), 0),
           coalesce(jsonb_agg(jsonb_build_object('label', c.label, 'points', coalesce(gg.points_awarded, 0), 'max', c.max_points)
                              ORDER BY c.display_order), '[]'::jsonb)
      INTO v_points, v_crit
    FROM public.grading_criteria c
    LEFT JOIN public.group_grades gg ON gg.criteria_id = c.id AND gg.group_id = g.id
    WHERE c.session_id = s.id;

    v_total := greatest(0, v_points - g.malus);
    v_twenty := round(v_total * 20 / v_bareme, 2);

    SELECT coalesce(jsonb_agg(st.pseudo ORDER BY st.pseudo), '[]'::jsonb) INTO v_members
    FROM public.session_group_members sgm JOIN public.students st ON st.id = sgm.student_id
    WHERE sgm.group_id = g.id;

    v_details := jsonb_build_object('v', 2, 'type', 'groupe', 'groupe', jsonb_build_object(
      'nom', g.name, 'membres', v_members, 'criteres', v_crit, 'malus', g.malus,
      'total', v_total, 'bareme', v_bareme, 'seance_id', s.id));

    FOR m IN SELECT student_id FROM public.session_group_members WHERE group_id = g.id LOOP
      SELECT * INTO ex FROM public.assessment_grades
      WHERE assessment_id = v_assessment AND student_id = m.student_id;
      IF NOT FOUND THEN
        INSERT INTO public.assessment_grades
          (user_id, assessment_id, student_id, grade, grade_raw, status, details, is_validated, validated_at)
        VALUES
          (s.user_id, v_assessment, m.student_id, v_twenty, v_total, 'noted', v_details, true, now());
      ELSIF ex.status = 'noted'
            AND (ex.grade_raw IS NULL OR ex.grade_raw = (ex.details #>> '{groupe,total}')::numeric) THEN
        -- Note encore égale au total du groupe : elle suit la séance.
        UPDATE public.assessment_grades
        SET grade_raw = v_total, grade = v_twenty, details = v_details
        WHERE id = ex.id
          AND (grade_raw IS DISTINCT FROM v_total OR grade IS DISTINCT FROM v_twenty OR details IS DISTINCT FROM v_details);
      ELSE
        -- Note ajustée par le prof (ou statut absent…) : on la garde, seul le détail suit ; son /20
        -- suit le barème si les critères ont changé.
        UPDATE public.assessment_grades
        SET details = v_details,
            grade = CASE WHEN ex.status = 'noted' AND ex.grade_raw IS NOT NULL
                         THEN round(ex.grade_raw * 20 / v_bareme, 2) ELSE ex.grade END
        WHERE id = ex.id
          AND (details IS DISTINCT FROM v_details
               OR (ex.status = 'noted' AND ex.grade_raw IS NOT NULL AND grade IS DISTINCT FROM round(ex.grade_raw * 20 / v_bareme, 2)));
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_assessment;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_group_session_assessment(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.group_session_sync_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session uuid;
  v_group   uuid;
BEGIN
  IF TG_TABLE_NAME = 'group_sessions' THEN
    v_session := NEW.id;
  ELSIF TG_TABLE_NAME IN ('grading_criteria', 'session_groups') THEN
    v_session := CASE WHEN TG_OP = 'DELETE' THEN OLD.session_id ELSE NEW.session_id END;
  ELSE
    v_group := CASE WHEN TG_OP = 'DELETE' THEN OLD.group_id ELSE NEW.group_id END;
    SELECT session_id INTO v_session FROM public.session_groups WHERE id = v_group;
  END IF;
  IF v_session IS NOT NULL THEN
    PERFORM public.sync_group_session_assessment(v_session);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.group_session_sync_trigger() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.group_session_trash_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.written_assessments SET is_deleted = true
  WHERE group_session_id = OLD.id AND NOT is_deleted;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.group_session_trash_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_sessions_sync ON public.group_sessions;
CREATE TRIGGER trg_group_sessions_sync AFTER INSERT OR UPDATE ON public.group_sessions
  FOR EACH ROW EXECUTE FUNCTION public.group_session_sync_trigger();

DROP TRIGGER IF EXISTS trg_grading_criteria_sync ON public.grading_criteria;
CREATE TRIGGER trg_grading_criteria_sync AFTER INSERT OR UPDATE OR DELETE ON public.grading_criteria
  FOR EACH ROW EXECUTE FUNCTION public.group_session_sync_trigger();

DROP TRIGGER IF EXISTS trg_session_groups_sync ON public.session_groups;
CREATE TRIGGER trg_session_groups_sync AFTER INSERT OR UPDATE OR DELETE ON public.session_groups
  FOR EACH ROW EXECUTE FUNCTION public.group_session_sync_trigger();

DROP TRIGGER IF EXISTS trg_session_group_members_sync ON public.session_group_members;
CREATE TRIGGER trg_session_group_members_sync AFTER INSERT OR UPDATE OR DELETE ON public.session_group_members
  FOR EACH ROW EXECUTE FUNCTION public.group_session_sync_trigger();

DROP TRIGGER IF EXISTS trg_group_grades_sync ON public.group_grades;
CREATE TRIGGER trg_group_grades_sync AFTER INSERT OR UPDATE OR DELETE ON public.group_grades
  FOR EACH ROW EXECUTE FUNCTION public.group_session_sync_trigger();

DROP TRIGGER IF EXISTS trg_group_sessions_trash ON public.group_sessions;
CREATE TRIGGER trg_group_sessions_trash BEFORE DELETE ON public.group_sessions
  FOR EACH ROW EXECUTE FUNCTION public.group_session_trash_trigger();

-- ------------------------------------------------------------------
-- Bascule (À LANCER À PART, avec l'accord de Thomas) : verse les séances déjà terminées de SON
-- compte (les autres comptes de l'application ne reçoivent que leurs séances à venir) :
--   SELECT public.sync_group_session_assessment(id) FROM public.group_sessions
--   WHERE status = 'completed' AND user_id = '<id du compte de Thomas>';
-- Rejouable : une séance déjà versée est seulement mise à jour.
-- ------------------------------------------------------------------
