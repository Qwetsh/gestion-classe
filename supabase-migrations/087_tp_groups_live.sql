-- 087 — TP en groupes, lot 1 (mobile) : îlots, points de groupe, photos par groupe.
-- Voir PLAN_tp_groupes.md.
--
-- 1. session_groups : position de l'îlot sur le fond libre (0..1, NULL = rangement auto),
--    commentaire au groupe, ordre d'affichage (donne aussi la couleur de l'îlot).
-- 2. events.tp_group_id : le point vient d'un geste « tout le groupe ». Pas de clé étrangère :
--    l'événement part en direct, parfois avant que le groupe n'atteigne le serveur.
-- 3. group_session_photos : photo d'un groupe (NULL = toute la classe), auteur (prof / élève),
--    politique UPDATE manquante (l'upsert du téléphone en a besoin).
-- 4. sync_group_session_assessment : identique à la 063, plus le commentaire au groupe dans
--    details.groupe.commentaire. Règle de Thomas (23/11/2026) : un absent au TP GARDE la note
--    de son groupe (seuls les points d'implication de groupe vont aux présents). Changer un
--    élève de groupe (UPDATE de sa ligne de membre) lui donne la note de son nouveau groupe.

ALTER TABLE public.session_groups
  ADD COLUMN IF NOT EXISTS position_x real,
  ADD COLUMN IF NOT EXISTS position_y real,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.session_groups
  DROP CONSTRAINT IF EXISTS session_groups_position_check;
ALTER TABLE public.session_groups
  ADD CONSTRAINT session_groups_position_check CHECK (
    (position_x IS NULL OR (position_x >= 0 AND position_x <= 1))
    AND (position_y IS NULL OR (position_y >= 0 AND position_y <= 1))
  );

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tp_group_id uuid;
CREATE INDEX IF NOT EXISTS idx_events_tp_group ON public.events (tp_group_id) WHERE tp_group_id IS NOT NULL;

ALTER TABLE public.group_session_photos
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.session_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'teacher',
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;

ALTER TABLE public.group_session_photos
  DROP CONSTRAINT IF EXISTS group_session_photos_author_check;
ALTER TABLE public.group_session_photos
  ADD CONSTRAINT group_session_photos_author_check CHECK (author IN ('teacher', 'student'));

CREATE INDEX IF NOT EXISTS idx_gsp_group ON public.group_session_photos (group_id);

DROP POLICY IF EXISTS gsp_update ON public.group_session_photos;
CREATE POLICY gsp_update ON public.group_session_photos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.group_sessions gs
            WHERE gs.id = group_session_photos.session_id AND gs.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_sessions gs
            WHERE gs.id = group_session_photos.session_id AND gs.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Carnet : commentaire au groupe dans le détail (le reste est la fonction de la 063)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_group_session_assessment(p_session_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT sg.id, sg.name, coalesce(sg.conduct_malus, 0)::numeric AS malus, sg.comment
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
      'total', v_total, 'bareme', v_bareme, 'seance_id', s.id, 'commentaire', g.comment));

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
        UPDATE public.assessment_grades
        SET grade_raw = v_total, grade = v_twenty, details = v_details
        WHERE id = ex.id
          AND (grade_raw IS DISTINCT FROM v_total OR grade IS DISTINCT FROM v_twenty OR details IS DISTINCT FROM v_details);
      ELSE
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
$function$;
