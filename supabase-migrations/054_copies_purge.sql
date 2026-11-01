-- Migration 054 : suppression automatique des scans de copies (lot 4 de PLAN_copies_evaluation.md)
-- Description : les scans de copies portent le nom et l'écriture des élèves (RGPD) et pèsent
--   lourd. Décision de Thomas (01/11/2026) : on les supprime 30 jours après la publication de
--   l'éval — pas avant, pour laisser le temps d'une contestation —, prolongeable de 30 jours.
--   Seuls les SCANS partent (fichiers du bucket + lignes assessment_copy_pages) : l'éval, les
--   notes et leur détail restent.
--
--   - published_at / copies_purge_at sont posés par trigger à la publication ; dépublier
--     suspend la suppression (copies_purge_at = NULL), republier relance 30 jours.
--   - Une page scannée APRÈS la date prévue (copie rendue en retard) repousse la suppression
--     de 30 jours : on ne détruit jamais une copie la nuit qui suit son scan.
--   - Supabase interdit d'effacer les fichiers en SQL (trigger storage.protect_objects_delete) :
--     la suppression passe par l'Edge Function `purge-assessment-copies`, appelée chaque nuit
--     par pg_cron via pg_net. Elle s'authentifie par un jeton tiré au hasard et rangé dans
--     Vault, vérifié par une fonction que seul service_role peut appeler.

-- ============================================================
-- 1. Dates
-- ============================================================
ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS copies_purge_at timestamptz,
  ADD COLUMN IF NOT EXISTS copies_purged_at timestamptz;

COMMENT ON COLUMN public.written_assessments.published_at IS
  'Dernière publication aux élèves (posée par trigger).';
COMMENT ON COLUMN public.written_assessments.copies_purge_at IS
  'Date à partir de laquelle les scans de copies sont supprimés (publication + 30 j, prolongeable). NULL = jamais (pas publiée).';
COMMENT ON COLUMN public.written_assessments.copies_purged_at IS
  'Date de la dernière suppression des scans (Edge Function purge-assessment-copies ou bouton du prof).';

CREATE INDEX IF NOT EXISTS idx_wa_copies_purge_due
  ON public.written_assessments(copies_purge_at)
  WHERE copies_purge_at IS NOT NULL AND copies_purged_at IS NULL;

-- Rattrapage des évals déjà publiées (aucune n'a de scan au 01/11/2026).
UPDATE public.written_assessments
   SET published_at = COALESCE(published_at, updated_at, created_at),
       copies_purge_at = COALESCE(copies_purge_at, COALESCE(updated_at, created_at) + interval '30 days')
 WHERE published_to_students;

-- ============================================================
-- 2. Publication → date de suppression
-- ============================================================
CREATE OR REPLACE FUNCTION public.written_assessments_schedule_copies_purge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.published_to_students AND (TG_OP = 'INSERT' OR NOT COALESCE(OLD.published_to_students, false)) THEN
    NEW.published_at := now();
    NEW.copies_purge_at := GREATEST(COALESCE(NEW.copies_purge_at, '-infinity'::timestamptz), now() + interval '30 days');
    -- Réarme la purge : des scans ont pu être supprimés à la main avant la publication.
    NEW.copies_purged_at := NULL;
  ELSIF TG_OP = 'UPDATE' AND NOT NEW.published_to_students AND COALESCE(OLD.published_to_students, false) THEN
    NEW.copies_purge_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_wa_schedule_copies_purge ON public.written_assessments;
CREATE TRIGGER trg_wa_schedule_copies_purge
  BEFORE INSERT OR UPDATE OF published_to_students ON public.written_assessments
  FOR EACH ROW EXECUTE FUNCTION public.written_assessments_schedule_copies_purge();

-- ============================================================
-- 3. Copie scannée en retard → la suppression attend 30 jours de plus
-- ============================================================
CREATE OR REPLACE FUNCTION public.assessment_copy_pages_delay_purge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE written_assessments
     SET copies_purge_at = GREATEST(copies_purge_at, now() + interval '30 days'),
         copies_purged_at = NULL
   WHERE id = NEW.assessment_id
     AND copies_purge_at IS NOT NULL
     AND (copies_purge_at < now() + interval '30 days' OR copies_purged_at IS NOT NULL);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_acp_delay_purge ON public.assessment_copy_pages;
CREATE TRIGGER trg_acp_delay_purge
  AFTER INSERT ON public.assessment_copy_pages
  FOR EACH ROW EXECUTE FUNCTION public.assessment_copy_pages_delay_purge();

-- ============================================================
-- 4. Jeton de l'Edge Function (Vault) + vérification réservée à service_role
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'purge_copies_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'purge_copies_token',
      'Jeton envoyé par pg_cron à l''Edge Function purge-assessment-copies (migration 054).'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.purge_copies_token_ok(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
     WHERE name = 'purge_copies_token' AND decrypted_secret = p_token
  );
$function$;

REVOKE ALL ON FUNCTION public.purge_copies_token_ok(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_copies_token_ok(text) TO service_role;

-- ============================================================
-- 5. Chaque nuit à 3 h 15 (UTC)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-assessment-copies') THEN
    PERFORM cron.unschedule('purge-assessment-copies');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-assessment-copies',
  '15 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://djodkjysovalpufgevrr.supabase.co/functions/v1/purge-assessment-copies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'purge_copies_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

-- ============================================================
-- Note d'application (01/11/2026)
-- ============================================================
-- La remise à NULL de copies_purged_at à la publication a été ajoutée après coup et appliquée en
-- prod par une seconde migration, « 054_copies_purge_republish_reset », qui a aussi effacé le
-- copies_purged_at posé par le premier essai de la fonction sur une éval sans aucun scan :
--   UPDATE public.written_assessments SET copies_purged_at = NULL
--    WHERE copies_purged_at IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM public.assessment_copy_pages p WHERE p.assessment_id = written_assessments.id);
-- Ce fichier contient l'état final de la fonction : le rejouer sur une base neuve suffit.
