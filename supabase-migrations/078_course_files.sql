-- Lot F1 de PLAN_mes_cours.md : fichiers rattachés à une séquence (page « Mes cours »).
--
-- Jusqu'ici, l'application ne gardait que des images (bucket board-assets) : un PDF de documents,
-- un enregistrement sonore ou la fiche Word d'origine restaient dans OneDrive. Cette migration
-- ajoute de quoi les ranger à côté des cours de leur séquence.
--
--   1. course_files : une ligne par fichier, rattachée à une séquence par (level, chapter), les
--      deux champs de texte qui rangent déjà les cours (boards.level, boards.chapter). Pas de clé
--      étrangère vers boards : une séquence n'est pas une ligne, et une seconde relation entre
--      deux tables lues ensemble casse ces lectures (voir la migration 077).
--   2. Dossier de stockage privé `course-files`, un sous-dossier par professeur, 20 Mo par
--      fichier. Pas de vidéo : elles restent des liens (l'offre gratuite donne 1 Go en tout).
--   3. storage_usage() : la taille totale du stockage du projet et celle de ce dossier, pour la
--      jauge affichée dans « Mes cours ». Elle ne rend que deux nombres.
--
-- Additif : sans cette migration, « Mes cours » ne propose simplement pas d'ajouter de fichier.

-- ---------------------------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.course_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level        TEXT,
  chapter      TEXT NOT NULL,
  name         TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime         TEXT,
  size         BIGINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.course_files IS
  'Fichiers rattachés à une séquence de « Mes cours » (PDF, son, document) ; le contenu est dans le dossier de stockage course-files.';
COMMENT ON COLUMN public.course_files.level IS 'Niveau de la séquence (même valeur que boards.level) ; NULL = sans niveau.';
COMMENT ON COLUMN public.course_files.chapter IS 'Nom de la séquence (même valeur que boards.chapter).';
COMMENT ON COLUMN public.course_files.storage_path IS 'Chemin dans le dossier course-files : <user_id>/<id>.<extension>.';

CREATE INDEX IF NOT EXISTS idx_course_files_sequence ON public.course_files (user_id, level, chapter);

ALTER TABLE public.course_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "course_files_own_rows" ON public.course_files;
CREATE POLICY "course_files_own_rows" ON public.course_files
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- 2. Dossier de stockage
-- ---------------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-files', 'course-files', false, 20971520,
  ARRAY[
    'application/pdf',
    'image/*',
    'audio/*',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/msword',
    'application/vnd.ms-powerpoint',
    'application/vnd.ms-excel'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own course files') THEN
    CREATE POLICY "Users can view own course files" ON storage.objects FOR SELECT
      USING (bucket_id = 'course-files' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload course files') THEN
    CREATE POLICY "Users can upload course files" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'course-files' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own course files') THEN
    CREATE POLICY "Users can update own course files" ON storage.objects FOR UPDATE
      USING (bucket_id = 'course-files' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own course files') THEN
    CREATE POLICY "Users can delete own course files" ON storage.objects FOR DELETE
      USING (bucket_id = 'course-files' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Jauge
-- ---------------------------------------------------------------------------------------------

-- Exécutée avec les droits de son auteur : les professeurs ne lisent pas storage.objects, et le
-- plafond de l'offre porte sur tout le projet. Elle ne rend que deux tailles, aucun nom de fichier.
CREATE OR REPLACE FUNCTION public.storage_usage()
RETURNS TABLE (total_bytes BIGINT, course_files_bytes BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(SUM((o.metadata ->> 'size')::bigint), 0)::bigint,
    COALESCE(SUM((o.metadata ->> 'size')::bigint) FILTER (WHERE o.bucket_id = 'course-files'), 0)::bigint
  FROM storage.objects o;
$$;

COMMENT ON FUNCTION public.storage_usage() IS
  'Taille totale du stockage du projet et celle du dossier course-files, en octets (jauge de « Mes cours »).';

REVOKE ALL ON FUNCTION public.storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_usage() TO authenticated;
