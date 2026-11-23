-- ============================================================
-- Migration 086 : Accès d'une classe à son classeur (lien pour Pronote, onglet de l'espace élève)
-- ============================================================
-- PLAN_classeur_eleves.md, lots 2 et 3. La migration 085 dit CE QU'une classe voit du classeur ;
-- celle-ci dit PAR OÙ elle y entre.
--
-- Choix :
--  - Une ligne par classe, créée quand le professeur active un accès.
--  - link_token : jeton long et aléatoire (créé par le navigateur du professeur), porté par
--    l'adresse posée dans Pronote. Qui a le lien voit ce que la classe a d'ouvert, rien d'autre :
--    pas de donnée personnelle, pas d'évaluation. link_enabled coupe le lien sans le changer ;
--    régénérer le jeton rend l'ancienne adresse morte.
--  - tab_enabled : l'onglet « Classeur » de l'espace élève (/eleve), ouvert par le code de l'élève.
--    Ici plutôt que dans class_student_tabs, que PLAN_espace_eleve.md prévoit de remplacer.
--  - Aucune lecture pour un visiteur sans compte : l'élève passe par l'Edge Function
--    classeur-eleve, qui vérifie le jeton ou le code avec la clé de service.
--  - La politique prouve que la classe est au professeur qui écrit.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.class_binders (
  class_id     UUID PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_token   TEXT UNIQUE CHECK (link_token IS NULL OR link_token ~ '^[A-Za-z0-9_-]{32,64}$'),
  link_enabled BOOLEAN NOT NULL DEFAULT false,
  tab_enabled  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Pas de lien actif sans jeton
  CONSTRAINT class_binders_link CHECK (NOT link_enabled OR link_token IS NOT NULL)
);

COMMENT ON TABLE public.class_binders IS 'Accès d''une classe à son classeur virtuel : lien public (Pronote) et onglet de l''espace élève.';
COMMENT ON COLUMN public.class_binders.link_token IS 'Jeton de l''adresse /classeur/c/<jeton> ; long et aléatoire, régénérable';
COMMENT ON COLUMN public.class_binders.link_enabled IS 'Le lien répond ; faux : il est coupé sans être changé';
COMMENT ON COLUMN public.class_binders.tab_enabled IS 'Onglet « Classeur » de l''espace élève, ouvert par le code de l''élève';

CREATE INDEX IF NOT EXISTS idx_class_binders_user ON public.class_binders (user_id);

ALTER TABLE public.class_binders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_binders_select" ON public.class_binders;
CREATE POLICY "class_binders_select" ON public.class_binders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "class_binders_insert" ON public.class_binders;
CREATE POLICY "class_binders_insert" ON public.class_binders
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "class_binders_update" ON public.class_binders;
CREATE POLICY "class_binders_update" ON public.class_binders
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "class_binders_delete" ON public.class_binders;
CREATE POLICY "class_binders_delete" ON public.class_binders
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON public.class_binders FROM anon;
