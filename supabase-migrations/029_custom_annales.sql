-- Migration: Custom Annales (sujets d'annales ajoutes manuellement depuis l'app)
-- Description: Permettre a l'enseignante d'ajouter manuellement des sujets dans l'onglet
--              Annales (PDF uploade dans le bucket public `brevets`, sous-dossier custom/).
--              Cote eleve (/eleve, anonyme) : lecture seule.
-- Conventions: gen_random_uuid() (aligne sur migrations 020+). Lecture publique (anon + auth),
--              ecriture reservee aux utilisateurs authentifies (l'enseignante).

-- ============================================================
-- 1. Table des sujets ajoutes manuellement
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_annales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matiere TEXT NOT NULL,            -- SVT | Maths | Francais | Histoire-Geo-EMC | Physique-Chimie
  annee INTEGER NOT NULL,
  centre TEXT,                      -- ex: "Metropole"
  theme TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  code TEXT,
  file_path TEXT NOT NULL,          -- chemin dans le bucket `brevets` (ex: custom/<uuid>.pdf)
  url TEXT NOT NULL,                -- URL publique du PDF
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.custom_annales IS 'Sujets d''annales ajoutes manuellement via l''app (PDF dans bucket brevets)';

CREATE INDEX IF NOT EXISTS idx_custom_annales_annee ON public.custom_annales(annee);

-- ============================================================
-- 2. RLS : lecture publique, ecriture authentifiee
-- ============================================================
ALTER TABLE public.custom_annales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_annales_select_public" ON public.custom_annales;
DROP POLICY IF EXISTS "custom_annales_insert_auth" ON public.custom_annales;
DROP POLICY IF EXISTS "custom_annales_update_auth" ON public.custom_annales;
DROP POLICY IF EXISTS "custom_annales_delete_auth" ON public.custom_annales;

-- Tout le monde (eleves anonymes inclus) peut lire
CREATE POLICY "custom_annales_select_public" ON public.custom_annales
  FOR SELECT USING (true);

-- Seuls les utilisateurs connectes (l'enseignante) peuvent ecrire
CREATE POLICY "custom_annales_insert_auth" ON public.custom_annales
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "custom_annales_update_auth" ON public.custom_annales
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "custom_annales_delete_auth" ON public.custom_annales
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. Storage : autoriser l'upload dans le bucket public `brevets`
--    (lecture deja publique). Uniquement sous le prefixe custom/.
-- ============================================================
DROP POLICY IF EXISTS "brevets_custom_upload_auth" ON storage.objects;
DROP POLICY IF EXISTS "brevets_custom_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "brevets_custom_delete_auth" ON storage.objects;

CREATE POLICY "brevets_custom_upload_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'brevets'
  AND (storage.foldername(name))[1] = 'custom'
);

CREATE POLICY "brevets_custom_update_auth"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'brevets'
  AND (storage.foldername(name))[1] = 'custom'
);

CREATE POLICY "brevets_custom_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'brevets'
  AND (storage.foldername(name))[1] = 'custom'
);
