-- Migration 056 : transcription des copies, gardée après la suppression des scans
-- Description : les scans d'une éval sont supprimés 30 jours après sa publication (migration 054).
--   Pour garder une trace de ce que l'élève a écrit, le Correcteur transcrit chaque copie pendant
--   la correction (texte mot pour mot, question par question) et push_grades.py l'envoie ici.
--
--   - Table à part, PAS une colonne de assessment_grades : `details` est lu par l'élève
--     (get_student_grades, migration 053) ; la transcription ne doit jamais l'être.
--     RLS propriétaire, aucune RPC élève ne lit cette table.
--   - Format v1 : {"v": 1, "items": [{"q": "Q1", "texte": "…"}, {"q": "Partie 2", "texte": "…"}]},
--     items dans l'ordre de la copie (Correcteur/.claude/skills/corriger/references/formats.md).
--   - La purge des scans (Edge Function purge-assessment-copies, « Supprimer maintenant » web et
--     mobile) ne supprime les pages d'un élève que s'il a une transcription ici.

CREATE TABLE IF NOT EXISTS public.assessment_copy_transcripts (
  assessment_id uuid NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript    jsonb NOT NULL CHECK (jsonb_typeof(transcript -> 'items') = 'array'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, student_id)
);

COMMENT ON TABLE public.assessment_copy_transcripts IS
  'Transcription mot pour mot des copies (Correcteur → push_grades.py). Visible du prof seul ; conditionne la suppression des scans.';

CREATE INDEX IF NOT EXISTS idx_act_user_id ON public.assessment_copy_transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_act_student_id ON public.assessment_copy_transcripts(student_id);

ALTER TABLE public.assessment_copy_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_copy_transcripts" ON public.assessment_copy_transcripts;
DROP POLICY IF EXISTS "Users insert own assessment_copy_transcripts" ON public.assessment_copy_transcripts;
DROP POLICY IF EXISTS "Users update own assessment_copy_transcripts" ON public.assessment_copy_transcripts;
DROP POLICY IF EXISTS "Users delete own assessment_copy_transcripts" ON public.assessment_copy_transcripts;

CREATE POLICY "Users view own assessment_copy_transcripts" ON public.assessment_copy_transcripts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assessment_copy_transcripts" ON public.assessment_copy_transcripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own assessment_copy_transcripts" ON public.assessment_copy_transcripts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own assessment_copy_transcripts" ON public.assessment_copy_transcripts
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.assessment_copy_transcripts_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_act_touch ON public.assessment_copy_transcripts;
CREATE TRIGGER trg_act_touch
  BEFORE UPDATE ON public.assessment_copy_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.assessment_copy_transcripts_touch();
