-- ============================================================
-- Migration 043 : Emploi du temps hors Pronote en direct
-- ============================================================
-- Cf. PLAN_accueil_v2.md. Sources de l'emploi du temps, par priorité :
--   1. Pronote connecté (lu en direct, rien n'est stocké ici) ;
--   2. import d'un export .ics de Pronote   -> timetable_entries.source = 'ics' ;
--   3. saisie manuelle d'une semaine type    -> timetable_entries.source = 'manual' (lot 4).
--
-- Choix :
--  - Les cours ne portent PAS de class_id : ils gardent le libellé Pronote (« 4D », « 3°EP1 »)
--    et la correspondance libellé -> classe/groupe vit dans timetable_label_links. Corriger une
--    correspondance ne réécrit donc aucun cours, et Pronote en direct réutilise la même table.
--  - external_id = UID Pronote sans l'horodatage d'export (« Cours-40048-1 ») : clé stable qui
--    permet de réimporter en mettant à jour au lieu de dupliquer.
-- ============================================================

-- 1. Cours et congés
CREATE TABLE IF NOT EXISTS public.timetable_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL CHECK (source IN ('ics', 'manual')),
  external_id TEXT,
  kind        TEXT NOT NULL DEFAULT 'lesson' CHECK (kind IN ('lesson', 'holiday')),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  label       TEXT NOT NULL,
  class_label TEXT,
  subject     TEXT,
  room        TEXT,
  status      TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'canceled', 'modified', 'exceptional')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source, external_id)
);

COMMENT ON TABLE public.timetable_entries IS 'Emploi du temps importé (.ics Pronote) ou saisi. Ignoré quand Pronote est connecté.';
COMMENT ON COLUMN public.timetable_entries.label IS 'Clé de correspondance : demi-groupe s''il y en a un (« 3°EP1 »), sinon classe (« 4D »), ou nom du congé';
COMMENT ON COLUMN public.timetable_entries.class_label IS 'Classe Pronote de rattachement (« 3E » pour « 3°EP1 ») ; NULL pour un congé';
COMMENT ON COLUMN public.timetable_entries.ends_at IS 'Exclusif pour les congés (lendemain du dernier jour)';

CREATE INDEX IF NOT EXISTS idx_timetable_entries_user_start ON public.timetable_entries (user_id, starts_at);

-- 2. Correspondance libellé Pronote -> classe / groupe
CREATE TABLE IF NOT EXISTS public.timetable_label_links (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  class_id   UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  group_id   UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  ignored    BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, label)
);

COMMENT ON TABLE public.timetable_label_links IS 'Libellé Pronote (« 4D », « 3°EP1 ») -> classe et demi-groupe de l''application. Partagée par l''import .ics et Pronote en direct.';
COMMENT ON COLUMN public.timetable_label_links.ignored IS 'Pas une de mes classes (ex. Devoirs faits) : le cours reste affiché, sans lien';

-- 3. RLS : chacun ses lignes
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_label_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "timetable_entries_own_rows" ON public.timetable_entries;
CREATE POLICY "timetable_entries_own_rows" ON public.timetable_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "timetable_label_links_own_rows" ON public.timetable_label_links;
CREATE POLICY "timetable_label_links_own_rows" ON public.timetable_label_links
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
