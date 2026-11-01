-- Migration 055 : placement des élèves le jour de l'éval
-- Description : le Correcteur signale deux copies qui se ressemblent fortement quand les élèves
--   étaient voisins (Correcteur/scripts/voisins.py). Les plans de classe n'ont pas d'historique :
--   si le prof les modifie après l'éval, ou place ses élèves autrement ce jour-là, on comparerait
--   les mauvais voisins. On garde donc une PHOTO du placement, attachée à l'éval.
--
--   - Prise automatiquement par le téléphone au premier scan d'une copie de l'éval, à partir du
--     plan affiché en séance (source 'auto'). Une photo existante n'est jamais écrasée par une
--     prise automatique.
--   - « Placement spécial pour l'éval » au téléphone : le prof déplace des élèves dans la photo,
--     sans toucher au plan habituel de la classe (source 'manual').
--   - Le téléphone ne connaît pas les tables (notion du web) : un trigger complète nom, taille,
--     cases désactivées et tables depuis la salle quand ils manquent.
--   - Donnée de l'enseignant seulement : RLS propriétaire, aucune RPC élève ne la lit.

CREATE TABLE IF NOT EXISTS public.assessment_placements (
  assessment_id  uuid PRIMARY KEY REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id        uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_name      text,
  grid_rows      integer,
  grid_cols      integer,
  positions      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"r-c": student_id}, comme class_room_plans
  disabled_cells jsonb,                                -- ["r,c"], comme rooms
  table_groups   jsonb,                                -- [{"cells": ["r,c", "r,c"]}], comme rooms
  source         text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.assessment_placements IS
  'Photo du placement des élèves le jour d''une éval (voisins pour le Correcteur). auto = plan de la séance au premier scan ; manual = placement spécial corrigé au téléphone.';

CREATE INDEX IF NOT EXISTS idx_ap_user_id ON public.assessment_placements(user_id);

ALTER TABLE public.assessment_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own assessment_placements" ON public.assessment_placements;
DROP POLICY IF EXISTS "Users insert own assessment_placements" ON public.assessment_placements;
DROP POLICY IF EXISTS "Users update own assessment_placements" ON public.assessment_placements;
DROP POLICY IF EXISTS "Users delete own assessment_placements" ON public.assessment_placements;

CREATE POLICY "Users view own assessment_placements" ON public.assessment_placements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own assessment_placements" ON public.assessment_placements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own assessment_placements" ON public.assessment_placements
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own assessment_placements" ON public.assessment_placements
  FOR DELETE USING (auth.uid() = user_id);

-- Complète la photo depuis la salle (le téléphone n'envoie que la salle et les positions).
CREATE OR REPLACE FUNCTION public.assessment_placements_fill_room()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  NEW.updated_at := now();
  IF NEW.room_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT name, grid_rows, grid_cols, disabled_cells, table_groups INTO r
    FROM rooms WHERE id = NEW.room_id;
  IF FOUND THEN
    NEW.room_name      := COALESCE(NEW.room_name, r.name);
    NEW.grid_rows      := COALESCE(NEW.grid_rows, r.grid_rows);
    NEW.grid_cols      := COALESCE(NEW.grid_cols, r.grid_cols);
    NEW.disabled_cells := COALESCE(NEW.disabled_cells, r.disabled_cells, '[]'::jsonb);
    NEW.table_groups   := COALESCE(NEW.table_groups, r.table_groups, '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ap_fill_room ON public.assessment_placements;
CREATE TRIGGER trg_ap_fill_room
  BEFORE INSERT OR UPDATE ON public.assessment_placements
  FOR EACH ROW EXECUTE FUNCTION public.assessment_placements_fill_room();
