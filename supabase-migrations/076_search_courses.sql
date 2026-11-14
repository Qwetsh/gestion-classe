-- Lot C2 de PLAN_mes_cours.md : chercher dans le texte des cours rédigés (page « Mes cours »).
--
-- Le texte d'un cours est rangé en JSON (boards.doc, format de l'éditeur) : aucune requête de
-- l'application ne peut y chercher un mot. Ces deux fonctions le font côté base, sans table ni
-- colonne de plus : le texte est extrait à la demande. Avec quelques dizaines de cours, c'est
-- immédiat ; si la bibliothèque se compte un jour en centaines, on rangera le texte dans une
-- colonne remplie à l'enregistrement (risque 2 du plan).
--
--   - gc_search_fold : minuscules et lettres sans accent. Un caractère pour un : une position
--     trouvée dans le texte replié est la même dans le texte d'origine (sert à l'extrait).
--   - search_courses : les cours du professeur connecté dont le texte contient tous les mots
--     demandés (deux lettres au moins), avec un extrait autour du premier mot trouvé.
--
-- Lecture seule, exécutée avec les droits de l'appelant : les règles d'accès de `boards`
-- s'appliquent. Additif : sans cette migration, la page ne cherche que dans les titres.

CREATE OR REPLACE FUNCTION public.gc_search_fold(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    lower(coalesce(p, '')),
    'àâäáãéèêëíìîïóòôöõúùûüçñ’',
    'aaaaaeeeeiiiiooooouuuucn'''
  );
$$;

COMMENT ON FUNCTION public.gc_search_fold(text) IS
  'Texte en minuscules sans accents, de même longueur que l''original (recherche de « Mes cours »).';

CREATE OR REPLACE FUNCTION public.search_courses(p_query text)
RETURNS TABLE (board_id uuid, excerpt text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH words AS (
    SELECT DISTINCT w
    FROM unnest(string_to_array(public.gc_search_fold(btrim(p_query)), ' ')) AS w
    WHERE length(w) >= 2
  ),
  texts AS (
    SELECT b.id,
           (
             -- Les nœuds de texte de l'éditeur, dans l'ordre du document
             SELECT string_agg(t.v #>> '{}', ' ' ORDER BY t.ord)
             FROM jsonb_path_query(b.doc -> 'content', 'strict $.** ? (@.type == "text").text', '{}', true)
                  WITH ORDINALITY AS t(v, ord)
           ) AS body
    FROM public.boards b
    WHERE b.user_id = auth.uid()
      AND b.doc IS NOT NULL
  ),
  folded AS (
    SELECT id, body, public.gc_search_fold(body) AS fold
    FROM texts
    WHERE body IS NOT NULL
  )
  SELECT f.id,
         substring(f.body FROM greatest(1, (SELECT min(position(w IN f.fold)) FROM words) - 50) FOR 180)
  FROM folded f
  WHERE EXISTS (SELECT 1 FROM words)
    AND NOT EXISTS (SELECT 1 FROM words WHERE position(w IN f.fold) = 0)
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_courses(text) IS
  'Cours rédigés de l''appelant dont le texte contient tous les mots de la demande, avec un extrait.';

REVOKE ALL ON FUNCTION public.search_courses(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_courses(text) TO authenticated;
