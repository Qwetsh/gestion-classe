-- Migration: Assessment grades + subject/correction documents
-- Description: Notes d'eval (informatives, table dediee) + fichiers sujet/corrige (PDF) consultables sur le web.
--              Onglet web "Evaluations" : sujet, correction, copies, notes (brouillon -> validees).
-- Conventions: gen_random_uuid(), user_id denormalise + RLS auth.uid() = user_id, idempotent.

-- ============================================================
-- 1. Fichiers sujet / correction attaches a une eval (uploades depuis le web)
-- ============================================================
ALTER TABLE public.written_assessments ADD COLUMN IF NOT EXISTS subject_path TEXT;
ALTER TABLE public.written_assessments ADD COLUMN IF NOT EXISTS correction_path TEXT;

COMMENT ON COLUMN public.written_assessments.subject_path IS 'Chemin Storage du sujet (bucket assessment-docs), uploade depuis le web';
COMMENT ON COLUMN public.written_assessments.correction_path IS 'Chemin Storage de la correction de reference (bucket assessment-docs)';

-- ============================================================
-- 2. Notes par eleve par eval (informatives : n'alimentent PAS trimester_grades)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  grade NUMERIC,                    -- note ramenee /20
  grade_raw NUMERIC,                -- note brute / bareme_total (optionnel)
  comment TEXT,                     -- commentaire general
  details JSONB,                    -- detail par question / competences (sortie du pipeline)
  is_validated BOOLEAN NOT NULL DEFAULT FALSE,  -- brouillon tant que non valide sur le web
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  UNIQUE (assessment_id, student_id)
);

COMMENT ON TABLE public.assessment_grades IS 'Notes d''eval par eleve (informatives). Brouillon push PC -> validation web -> visible fiche eleve.';

CREATE INDEX IF NOT EXISTS idx_ag_user_id ON public.assessment_grades(user_id);
CREATE INDEX IF NOT EXISTS idx_ag_assessment ON public.assessment_grades(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ag_student ON public.assessment_grades(student_id);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE public.assessment_grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_grades" ON public.assessment_grades;
DROP POLICY IF EXISTS "Users insert own assessment_grades" ON public.assessment_grades;
DROP POLICY IF EXISTS "Users update own assessment_grades" ON public.assessment_grades;
DROP POLICY IF EXISTS "Users delete own assessment_grades" ON public.assessment_grades;

CREATE POLICY "Users view own assessment_grades" ON public.assessment_grades
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assessment_grades" ON public.assessment_grades
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own assessment_grades" ON public.assessment_grades
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own assessment_grades" ON public.assessment_grades
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. Bucket prive `assessment-docs` (sujet + correction : PDF ou images, ~20 Mo)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessment-docs',
  'assessment-docs',
  false,
  20971520,  -- 20 Mo (PDF multi-pages)
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Storage RLS Policies (pattern user_id = 1er segment du path)
-- ============================================================
DROP POLICY IF EXISTS "Users can upload assessment docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own assessment docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own assessment docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own assessment docs" ON storage.objects;

CREATE POLICY "Users can upload assessment docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assessment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own assessment docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assessment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own assessment docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assessment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own assessment docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assessment-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
