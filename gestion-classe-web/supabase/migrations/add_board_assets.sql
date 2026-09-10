-- Mode « en classe » : import d'un PDF ou d'une image en fond de page du tableau blanc.
-- Les rendus (une image par page) vont dans un bucket privé, par utilisateur.

ALTER TABLE board_pages ADD COLUMN IF NOT EXISTS image JSONB;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('board-assets', 'board-assets', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own board assets') THEN
    CREATE POLICY "Users can view own board assets" ON storage.objects FOR SELECT
      USING (bucket_id = 'board-assets' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload board assets') THEN
    CREATE POLICY "Users can upload board assets" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'board-assets' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own board assets') THEN
    CREATE POLICY "Users can update own board assets" ON storage.objects FOR UPDATE
      USING (bucket_id = 'board-assets' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own board assets') THEN
    CREATE POLICY "Users can delete own board assets" ON storage.objects FOR DELETE
      USING (bucket_id = 'board-assets' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
END
$$;
