-- Migration 057 : bouton « Corriger » (une copie corrigée par l'API Claude)
-- Description : une copie scannée en retard (élève sans note) ou reprise est corrigée dans l'app,
--   comme le reste de la classe l'a été dans le Correcteur, par l'Edge Function `corriger-copie`.
--
--   - assessment_correction_kits : le « kit » de correction d'une éval × classe (barème, corrigé,
--     calibrage, harmonisation, consignes), écrit par build_kit.py et envoyé par
--     `push_grades.py --kit`. Format v1 (Correcteur/scripts/build_kit.py). Le corrigé ne doit
--     JAMAIS être lu par un élève : RLS propriétaire, aucune RPC élève ne lit cette table.
--   - assessment_ai_corrections : une ligne par appel (journal) : état (running → done | error),
--     modèle, tokens, coût estimé, et les points « à arbitrer » signalés par Claude. Ces derniers
--     sont réservés au prof : ils ne vont PAS dans assessment_grades.details, que l'élève lit.
--     Seule l'Edge Function écrit (service_role) ; le prof lit et peut supprimer.

CREATE TABLE IF NOT EXISTS public.assessment_correction_kits (
  assessment_id uuid PRIMARY KEY REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kit           jsonb NOT NULL CHECK (
                  (kit ->> 'v') = '1'
                  AND jsonb_typeof(kit -> 'bareme' -> 'questions') = 'array'
                  AND jsonb_array_length(kit -> 'bareme' -> 'questions') > 0
                ),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_correction_kits IS
  'Kit de correction d''une éval (Correcteur build_kit.py → push_grades.py --kit) pour le bouton « Corriger ». Contient le corrigé : prof seul.';

CREATE INDEX IF NOT EXISTS idx_ack_user_id ON public.assessment_correction_kits(user_id);

ALTER TABLE public.assessment_correction_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_correction_kits" ON public.assessment_correction_kits;
DROP POLICY IF EXISTS "Users insert own assessment_correction_kits" ON public.assessment_correction_kits;
DROP POLICY IF EXISTS "Users update own assessment_correction_kits" ON public.assessment_correction_kits;
DROP POLICY IF EXISTS "Users delete own assessment_correction_kits" ON public.assessment_correction_kits;

CREATE POLICY "Users view own assessment_correction_kits" ON public.assessment_correction_kits
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assessment_correction_kits" ON public.assessment_correction_kits
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own assessment_correction_kits" ON public.assessment_correction_kits
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own assessment_correction_kits" ON public.assessment_correction_kits
  FOR DELETE USING (auth.uid() = user_id);

-- Même fonction de mise à jour de updated_at que les transcriptions (migration 056).
DROP TRIGGER IF EXISTS trg_ack_touch ON public.assessment_correction_kits;
CREATE TRIGGER trg_ack_touch
  BEFORE UPDATE ON public.assessment_correction_kits
  FOR EACH ROW EXECUTE FUNCTION public.assessment_copy_transcripts_touch();


CREATE TABLE IF NOT EXISTS public.assessment_ai_corrections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id         uuid NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  student_id            uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode                  text NOT NULL CHECK (mode IN ('corriger', 'recorriger')),
  status                text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'error')),
  error                 text,
  model                 text,
  attempts              integer NOT NULL DEFAULT 0,
  input_tokens          integer,
  output_tokens         integer,
  cache_creation_tokens integer,
  cache_read_tokens     integer,
  cost_usd              numeric(8, 4),
  grade                 numeric,
  a_arbitrer            jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(a_arbitrer) = 'array'),
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz
);

COMMENT ON TABLE public.assessment_ai_corrections IS
  'Journal du bouton « Corriger » (Edge Function corriger-copie) : un appel Claude par ligne, coût, points à arbitrer. Prof seul.';

CREATE INDEX IF NOT EXISTS idx_aac_assessment_student
  ON public.assessment_ai_corrections(assessment_id, student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_aac_user_id ON public.assessment_ai_corrections(user_id);

ALTER TABLE public.assessment_ai_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_ai_corrections" ON public.assessment_ai_corrections;
DROP POLICY IF EXISTS "Users delete own assessment_ai_corrections" ON public.assessment_ai_corrections;

CREATE POLICY "Users view own assessment_ai_corrections" ON public.assessment_ai_corrections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users delete own assessment_ai_corrections" ON public.assessment_ai_corrections
  FOR DELETE USING (auth.uid() = user_id);
