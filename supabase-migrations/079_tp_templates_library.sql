-- « Mes TP » rangé comme « Mes cours » : niveau › séquence › TP, et une fiche de TP complète.
--
-- Jusqu'ici, un modèle de TP n'était qu'un nom, une couleur, un thème libre, du matériel et un
-- barème. Cette migration ajoute ce qu'il faut pour le ranger et le préparer :
--
--   1. level, chapter : les deux champs de texte qui rangent déjà les cours (boards.level,
--      boards.chapter), mêmes valeurs (« 5e », « Séquence 4 — La nutrition des animaux »).
--   2. problem, duration_min, modality, protocol, safety : problématique, durée, organisation
--      (binôme, groupe…), étapes du protocole et consignes de sécurité.
--   3. tp_template_criteria.hint : ce qu'on attend pour avoir les points d'un critère.
--
-- Additif : l'application mobile n'écrit et ne lit que ses colonnes (id, name, label…), elle
-- n'est pas touchée. Sans cette migration, la page « Mes TP » range tout dans « Sans niveau ».

ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS chapter TEXT;
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS problem TEXT;
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS duration_min INTEGER;
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS modality TEXT;
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS protocol TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE tp_templates ADD COLUMN IF NOT EXISTS safety TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE tp_template_criteria ADD COLUMN IF NOT EXISTS hint TEXT;

CREATE INDEX IF NOT EXISTS idx_tp_templates_user_level ON tp_templates(user_id, level, chapter);
