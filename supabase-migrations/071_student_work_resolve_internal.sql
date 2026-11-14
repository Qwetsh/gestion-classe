-- Migration 071 : la fonction interne _student_work_resolve n'est plus appelable par les clients
-- Description : _student_work_resolve (migration 046) sert aux RPC élèves (student_work_login, student_work_save,
--   student_work_honors, student_open_corrections), qui tournent avec les droits de leur propriétaire (SECURITY
--   DEFINER). Elle n'est pas faite pour être appelée de l'extérieur : avec un code élève valide, elle renvoie les
--   identifiants internes de l'élève, de sa classe et de son professeur. La migration 046 l'avait retirée au rôle
--   PUBLIC, mais Supabase donne aussi le droit d'exécution aux rôles anon et authenticated à la création d'une
--   fonction : il faut le leur retirer nommément. Aucune application ne l'appelait directement (vérifié le 12/11/2026).
--   Règle pour la suite : une fonction interne (préfixe _) se ferme avec REVOKE ... FROM PUBLIC, anon, authenticated.

REVOKE ALL ON FUNCTION public._student_work_resolve(text[]) FROM PUBLIC, anon, authenticated;
