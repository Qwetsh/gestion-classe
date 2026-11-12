-- Migration 070 : corrections animées de l'hôpital virtuel, ouvertes par classe
-- Description : l'hôpital virtuel a, pour certains patients, une correction animée (Docteur Morel reprend le cas
--   devant la classe). Elles sont fermées par défaut ; le professeur les ouvre classe par classe, depuis la fiche de
--   l'activité du patient (panneau de la classe) ou depuis la page « En direct ». Choix de Thomas (12/11/2026).
--   - Un réglage par activité et par classe (table activity_class_settings, sur le modèle d'activity_assessments),
--     modifié par le professeur sous RLS (upsert direct, pas de RPC).
--   - L'application élève demande, avec les codes des élèves connectés et la liste des clés d'activité qui ont une
--     correction, celles qui sont ouvertes pour leur classe (RPC student_open_corrections). Une activité qui n'existe
--     pas encore (aucun envoi) n'est jamais ouverte.

CREATE TABLE IF NOT EXISTS public.activity_class_settings (
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  animated_correction_open boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, class_id)
);

ALTER TABLE public.activity_class_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_class_settings_user ON public.activity_class_settings;
CREATE POLICY activity_class_settings_user ON public.activity_class_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS activity_class_settings_updated_at ON public.activity_class_settings;
CREATE TRIGGER activity_class_settings_updated_at
  BEFORE UPDATE ON public.activity_class_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.activity_class_settings IS
  'Réglages d''une activité (application élève) pour une classe. Une ligne par activité et par classe, créée au premier réglage.';
COMMENT ON COLUMN public.activity_class_settings.animated_correction_open IS
  'Hôpital virtuel : la correction animée du patient de cette activité est ouverte aux élèves de cette classe.';

-- RPC élève : parmi `p_activity_keys`, les clés d'activité dont la correction animée est ouverte pour la classe des
-- élèves connectés. Renvoie {keys: [...]} ou {error: ...} (codes invalides). Rien d'autre n'est renvoyé.
CREATE OR REPLACE FUNCTION public.student_open_corrections(p_codes text[], p_activity_keys text[])
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_err text;
  v_user_id uuid;
  v_classes uuid[];
  v_keys json;
BEGIN
  SELECT r.err INTO v_err FROM public._student_work_resolve(p_codes) r LIMIT 1;
  IF v_err IS NOT NULL THEN
    RETURN json_build_object('error', v_err);
  END IF;
  IF COALESCE(array_length(p_activity_keys, 1), 0) > 50 THEN
    RETURN json_build_object('error', 'too_many_keys');
  END IF;

  SELECT min(r.user_id::text)::uuid, array_agg(DISTINCT r.class_id) FILTER (WHERE r.class_id IS NOT NULL)
  INTO v_user_id, v_classes
  FROM public._student_work_resolve(p_codes) r;

  IF v_classes IS NULL THEN
    RETURN json_build_object('keys', '[]'::json);
  END IF;

  SELECT COALESCE(json_agg(DISTINCT a.key), '[]'::json) INTO v_keys
  FROM public.activities a
  JOIN public.activity_class_settings s ON s.activity_id = a.id
  WHERE a.user_id = v_user_id
    AND NOT a.is_deleted
    AND a.key = ANY (p_activity_keys)
    AND s.class_id = ANY (v_classes)
    AND s.animated_correction_open;

  RETURN json_build_object('keys', v_keys);
END;
$$;

REVOKE ALL ON FUNCTION public.student_open_corrections(text[], text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.student_open_corrections(text[], text[]) TO anon, authenticated;
COMMENT ON FUNCTION public.student_open_corrections(text[], text[]) IS
  'Hôpital virtuel : parmi les clés d''activité données, celles dont la correction animée est ouverte pour la classe des élèves connectés (1 à 3 codes).';
