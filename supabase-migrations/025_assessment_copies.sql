-- Migration: Assessment Copies (scans de copies d'evaluations ecrites)
-- Description: Capturer les copies d'eval depuis le mobile, deja nominees par student_id,
--              pour alimenter le pipeline de correction PC (cf. PLAN_scan_copies.md).
-- Conventions: gen_random_uuid() (aligne sur migrations 020+), user_id denormalise + RLS auth.uid() = user_id,
--              storage policies clonees de student-photos (006_student_photos.sql).

-- ============================================================
-- 1. Evaluations ecrites (devoirs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.written_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- ex: "Eval Nutrition"
  subject TEXT,                       -- ex: "SVT"
  date DATE,
  bareme_total NUMERIC DEFAULT 20,    -- bareme brut (ex: 28), ramene /20 a la correction
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE public.written_assessments IS 'Evaluations ecrites scannees depuis le mobile pour correction PC';

-- ============================================================
-- 2. Pages de copies (1 ligne par page scannee)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_copy_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  page_order INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,         -- user_id/{assessmentId}/{studentId}/{page}.jpg
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, student_id, page_order)
);

COMMENT ON TABLE public.assessment_copy_pages IS 'Pages individuelles d''une copie scannee, liees a un eleve (nominees)';

CREATE INDEX IF NOT EXISTS idx_wa_user_id ON public.written_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_class_id ON public.written_assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_acp_assessment ON public.assessment_copy_pages(assessment_id);
CREATE INDEX IF NOT EXISTS idx_acp_student ON public.assessment_copy_pages(student_id);

-- ============================================================
-- 3. RLS (isolation par utilisateur)
-- ============================================================
ALTER TABLE public.written_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_copy_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own written_assessments" ON public.written_assessments;
DROP POLICY IF EXISTS "Users insert own written_assessments" ON public.written_assessments;
DROP POLICY IF EXISTS "Users update own written_assessments" ON public.written_assessments;
DROP POLICY IF EXISTS "Users delete own written_assessments" ON public.written_assessments;

CREATE POLICY "Users view own written_assessments" ON public.written_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own written_assessments" ON public.written_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own written_assessments" ON public.written_assessments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own written_assessments" ON public.written_assessments
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own copy_pages" ON public.assessment_copy_pages;
DROP POLICY IF EXISTS "Users insert own copy_pages" ON public.assessment_copy_pages;
DROP POLICY IF EXISTS "Users update own copy_pages" ON public.assessment_copy_pages;
DROP POLICY IF EXISTS "Users delete own copy_pages" ON public.assessment_copy_pages;

CREATE POLICY "Users view own copy_pages" ON public.assessment_copy_pages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own copy_pages" ON public.assessment_copy_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own copy_pages" ON public.assessment_copy_pages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own copy_pages" ON public.assessment_copy_pages
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. Bucket Storage prive `assessment-copies`
--    Separe de student-photos. Limite 5 Mo (copies HD ~2000px).
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assessment-copies',
  'assessment-copies',
  false,
  5242880,  -- 5 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Storage RLS Policies (pattern student-photos: user_id = 1er segment du path)
-- ============================================================
DROP POLICY IF EXISTS "Users can upload assessment copies" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own assessment copies" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own assessment copies" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own assessment copies" ON storage.objects;

CREATE POLICY "Users can upload assessment copies"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assessment-copies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own assessment copies"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assessment-copies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own assessment copies"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assessment-copies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own assessment copies"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assessment-copies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
