-- Migration 081 : activité de la bibliothèque qui utilise un TP
--
-- Un TP de « Mes TP » se relie à l'activité de « Mes cours » qui le fait faire, par le numéro de
-- l'activité dans sa séquence : même niveau, même séquence (`chapter`), titre « Activité <n> — … ».
-- C'est la règle de rangement de la bibliothèque (lib/courseLibrary.ts) : le lien tient quand une
-- activité est réimportée, et un TP dont l'activité n'est pas encore en ligne s'y relie à son arrivée.
--
-- Valeurs : le numéro tel qu'il est écrit dans le titre (« 3 », « 3a », « bonus »). NULL = aucune.
-- Le mobile lit et écrit des colonnes nommées de tp_templates : non touché.

ALTER TABLE public.tp_templates ADD COLUMN IF NOT EXISTS activity TEXT;
