-- Lot 4b (PLAN_cours_editeur.md) : encre de la séance sur un cours rédigé.
--
-- Quand une séance part d'un cours (boards.doc non nul), l'écran de classe affiche le cours en
-- bande ; ce que le professeur écrit par-dessus pendant la séance est rangé ici, dans le lien
-- séance → tableau, jamais dans le cours préparé. Même format que le calque du cours
-- (doc.layer) : { "items": [...] }.
--
-- Additif : sans cette colonne, l'application garde l'encre sur l'ordinateur de la classe.

ALTER TABLE session_boards ADD COLUMN IF NOT EXISTS course_ink JSONB;

COMMENT ON COLUMN session_boards.course_ink IS
  'Encre de la séance posée sur un cours rédigé (format du calque : { items: [...] }), jamais copiée dans le cours.';
