-- ============================================================
-- Migration 071 : Cours rédigés (éditeur « Texte » façon Word)
-- ============================================================
-- Voir PLAN_cours_editeur.md. Un cours est un tableau (`boards`) qui porte en plus un
-- document : un flux de texte (JSON ProseMirror / TipTap : titres, paragraphes, listes,
-- encadrés, images, tableaux…) mis en page sur des feuilles A4.
--
-- Choix :
--  - Colonne JSONB sur `boards` plutôt qu'une table à part : un cours = un document, lu et
--    écrit d'un bloc, et toutes les fonctions des tableaux (bibliothèque, tableaux de cours
--    065, droits RLS) restent valables sans rien changer.
--  - NULL = tableau classique (pages 16:9 dans board_pages) : rien ne change pour eux.
--    Plus tard (étape 2), les pages d'un tableau deviendront des « encarts » du document.
--  - Format : { "version": 1, "content": <JSON TipTap> }. Le numéro de version permet de
--    faire évoluer le format sans migration SQL.
-- ============================================================

ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS doc JSONB;

COMMENT ON COLUMN public.boards.doc IS 'Cours rédigé (éditeur Texte) : { version, content } au format TipTap ; NULL pour un tableau classique.';
