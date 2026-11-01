-- Migration 058 : « Ajouter une copie » depuis l'ordinateur, envoi par QR code
-- Description : dans « Voir les copies », le prof ajoute la copie d'un élève après les autres
--   (import d'images ou de PDF, webcam, ou QR code vers son téléphone). Import et webcam passent
--   par sa session (bucket assessment-copies, RLS du dossier <user_id>/). Le QR code ouvre une page
--   publique, sans connexion : elle n'écrit que par l'Edge Function `depot-copie`, avec un jeton.
--
--   - Jeton aléatoire (32 octets), seul son SHA-256 est rangé ici. Il vaut pour UN élève d'UNE
--     éval, expire au bout de 15 min, plafonne le nombre de pages, et le prof le révoque en
--     fermant la fenêtre. Il ne donne aucun accès en lecture (la page publique ne voit que le
--     pseudo, la classe et le nom de l'éval).
--   - Seule l'Edge Function lit et écrit (service_role) ; le prof peut lire ses jetons.

CREATE TABLE IF NOT EXISTS public.assessment_upload_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash     text NOT NULL UNIQUE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id  uuid NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL,
  max_pages      integer NOT NULL DEFAULT 8 CHECK (max_pages BETWEEN 1 AND 20),
  pages_uploaded integer NOT NULL DEFAULT 0 CHECK (pages_uploaded >= 0),
  revoked_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_upload_tokens IS
  'Jetons d''envoi de copie par QR code (Edge Function depot-copie) : un élève, une éval, 15 min, SHA-256 seul.';

CREATE INDEX IF NOT EXISTS idx_aut_user_id ON public.assessment_upload_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_aut_assessment_student ON public.assessment_upload_tokens(assessment_id, student_id);

ALTER TABLE public.assessment_upload_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_upload_tokens" ON public.assessment_upload_tokens;
CREATE POLICY "Users view own assessment_upload_tokens" ON public.assessment_upload_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Comptage atomique d'une page reçue : refuse au-delà du plafond, après expiration ou révocation.
CREATE OR REPLACE FUNCTION public.claim_upload_token_page(p_token_hash text)
RETURNS TABLE (user_id uuid, assessment_id uuid, student_id uuid, page_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  UPDATE public.assessment_upload_tokens t
     SET pages_uploaded = t.pages_uploaded + 1
   WHERE t.token_hash = p_token_hash
     AND t.revoked_at IS NULL
     AND t.expires_at > now()
     AND t.pages_uploaded < t.max_pages
  RETURNING t.user_id, t.assessment_id, t.student_id, t.pages_uploaded;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_upload_token_page(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_upload_token_page(text) TO service_role;
