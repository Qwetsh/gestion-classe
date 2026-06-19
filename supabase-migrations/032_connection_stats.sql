-- ============================================================
-- Migration 032 : Agrégat des connexions élève (métriques d'implication)
-- ============================================================
-- Dépend de la migration 030 (table student_connections).
--
-- get_connection_stats(p_class_id) : pour une classe du prof appelant,
-- renvoie par élève le nombre de connexions et la dernière connexion.
-- SECURITY DEFINER + contrôle d'appartenance via auth.uid() (le prof ne voit
-- que ses propres classes). Évite de rapatrier des milliers de lignes côté client.
-- ============================================================

CREATE OR REPLACE FUNCTION get_connection_stats(p_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  connection_count bigint,
  last_connected timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sc.student_id, COUNT(*)::bigint AS connection_count, MAX(sc.connected_at) AS last_connected
  FROM student_connections sc
  JOIN students s ON s.id = sc.student_id
  WHERE s.class_id = p_class_id
    AND s.user_id = auth.uid()
  GROUP BY sc.student_id;
$$;

GRANT EXECUTE ON FUNCTION get_connection_stats(uuid) TO authenticated;
