-- 101 : l'application sait si le compte connecté peut lancer « Corriger avec Claude ».
--
-- La liste ai_correction_allowed_users (migration 083) reste invisible depuis l'application :
-- cette fonction ne répond que pour le compte connecté (auth.uid()), par oui ou par non.
-- Le bouton est masqué pour les autres comptes ; la fonction serveur corriger-copie continue
-- de vérifier elle-même la liste avant toute correction.

CREATE OR REPLACE FUNCTION public.can_use_ai_correction()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM ai_correction_allowed_users WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.can_use_ai_correction() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_use_ai_correction() TO authenticated;
