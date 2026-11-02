-- Migration 061 : QR code pour toute la classe et copies « Pas de nom »
-- Description : dans « Ajouter les copies de la classe », un seul QR code pour l'éval : le
--   téléphone enchaîne les élèves (page /depot), comme le scan mobile. Et une copie peut être
--   rangée sans élève (« Pas de nom »), pour être identifiée plus tard dans l'app.
--
--   1. Jeton de classe : `assessment_upload_tokens.student_id` devient facultatif. Sans élève, le
--      jeton vaut pour toute l'éval ; l'Edge Function depot-copie lui donne 60 min et 200 pages
--      (au lieu de 15 min et 8 pages), et vérifie chaque élève envoyé (élève attendu de l'éval).
--   2. Copies sans nom : table à part, `assessment_unnamed_pages`, pour que rien ne change pour
--      ceux qui lisent assessment_copy_pages (mobile, Correcteur, purge), où l'élève reste
--      obligatoire. Une copie = un `copy_id` ; fichiers sous `<user>/<éval>/sans-nom/<page>.jpg`.
--   3. `assign_unnamed_copy` : donne une copie sans nom à un élève (ses pages passent après les
--      siennes dans assessment_copy_pages, le fichier ne bouge pas), en une transaction.

-- ============================================================
-- 1. Jeton de classe
-- ============================================================
ALTER TABLE public.assessment_upload_tokens
  ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE public.assessment_upload_tokens
  DROP CONSTRAINT IF EXISTS assessment_upload_tokens_max_pages_check;
ALTER TABLE public.assessment_upload_tokens
  ADD CONSTRAINT assessment_upload_tokens_max_pages_check CHECK (max_pages BETWEEN 1 AND 300);

COMMENT ON TABLE public.assessment_upload_tokens IS
  'Jetons d''envoi de copie par QR code (Edge Function depot-copie), SHA-256 seul : un élève (15 min, 8 pages) ou, sans student_id, toute l''éval (60 min, 200 pages).';

-- ============================================================
-- 2. Copies « Pas de nom »
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_unnamed_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  copy_id       uuid NOT NULL,
  page_order    integer NOT NULL DEFAULT 1 CHECK (page_order >= 1),
  storage_path  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (copy_id, page_order)
);

COMMENT ON TABLE public.assessment_unnamed_pages IS
  'Pages de copies rangées sans élève (« Pas de nom »), à identifier dans l''app ; une copie = un copy_id. Fichier : <user>/<éval>/sans-nom/<page>.jpg.';

CREATE INDEX IF NOT EXISTS idx_aup_assessment ON public.assessment_unnamed_pages(assessment_id);
CREATE INDEX IF NOT EXISTS idx_aup_user ON public.assessment_unnamed_pages(user_id);

ALTER TABLE public.assessment_unnamed_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own unnamed_pages" ON public.assessment_unnamed_pages;
CREATE POLICY "Users view own unnamed_pages" ON public.assessment_unnamed_pages
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own unnamed_pages" ON public.assessment_unnamed_pages;
CREATE POLICY "Users insert own unnamed_pages" ON public.assessment_unnamed_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own unnamed_pages" ON public.assessment_unnamed_pages;
CREATE POLICY "Users update own unnamed_pages" ON public.assessment_unnamed_pages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own unnamed_pages" ON public.assessment_unnamed_pages;
CREATE POLICY "Users delete own unnamed_pages" ON public.assessment_unnamed_pages
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. Identifier une copie sans nom
-- ============================================================
-- SECURITY INVOKER : la RLS du prof s'applique (il ne voit que ses copies et ses élèves).
CREATE OR REPLACE FUNCTION public.assign_unnamed_copy(p_copy_id uuid, p_student_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assessment uuid;
  v_user uuid;
  v_last integer;
  v_moved integer;
BEGIN
  SELECT assessment_id, user_id INTO v_assessment, v_user
    FROM public.assessment_unnamed_pages
   WHERE copy_id = p_copy_id
   LIMIT 1;
  IF v_assessment IS NULL THEN
    RAISE EXCEPTION 'copy_not_found';
  END IF;

  PERFORM 1 FROM public.students WHERE id = p_student_id AND user_id = v_user;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'student_not_found';
  END IF;

  SELECT coalesce(max(page_order), 0) INTO v_last
    FROM public.assessment_copy_pages
   WHERE assessment_id = v_assessment AND student_id = p_student_id;

  INSERT INTO public.assessment_copy_pages (id, user_id, assessment_id, student_id, page_order, storage_path)
  SELECT id, user_id, assessment_id, p_student_id,
         v_last + row_number() OVER (ORDER BY page_order), storage_path
    FROM public.assessment_unnamed_pages
   WHERE copy_id = p_copy_id;
  GET DIAGNOSTICS v_moved = ROW_COUNT;

  DELETE FROM public.assessment_unnamed_pages WHERE copy_id = p_copy_id;
  RETURN v_moved;
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_unnamed_copy(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_unnamed_copy(uuid, uuid) TO authenticated;
