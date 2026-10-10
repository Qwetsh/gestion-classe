-- ============================================================
-- 049 — Récompenses : index uniques (user_id, label) déjà présents en production, versionnés ici
-- ============================================================
-- Ces deux index existent en production depuis le dédoublonnage des catégories (créés directement en base,
-- jamais versionnés). Ils expliquent les erreurs 23505 au push d'une catégorie ou d'un bonus créés hors ligne
-- par l'app mobile avec le même libellé qu'une ligne serveur (audit n°2 du 10/10/2026, AUDIT_RECOMPENSES.md).
-- Le mobile résout désormais ce conflit en adoptant la ligne serveur (remap des tampons) ; un environnement
-- neuf doit avoir les mêmes contraintes pour se comporter pareil.

CREATE UNIQUE INDEX IF NOT EXISTS unique_category_per_user ON public.stamp_categories (user_id, label);
CREATE UNIQUE INDEX IF NOT EXISTS unique_bonus_per_user ON public.bonuses (user_id, label);

COMMENT ON INDEX public.unique_category_per_user IS 'Un libellé de catégorie de tampon par enseignant (le libellé est la clé de dédoublonnage web/mobile).';
COMMENT ON INDEX public.unique_bonus_per_user IS 'Un libellé de bonus par enseignant.';
