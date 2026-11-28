-- 102 : six thèmes de l'espace élève pour le programme de français (Moyen Âge, Voyage, Fantasy,
-- Conte, Théâtre, Héros et monstres).
--
-- Comme les thèmes de sciences, ils sont « ouverts par le professeur avec le cours », classe par
-- classe (table class_student_themes, migration 099). Rien d'autre ne change : seule la liste des
-- familles est rejouée. Elle doit rester identique à celle de lib/studentThemes.ts (un test le
-- contrôle sur la dernière migration qui définit cette fonction).
--
-- Rejouable.

create or replace function public._student_theme_kind(p_theme text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when p_theme in ('carnet', 'cosmos', 'jungle', 'arcade', 'stade', 'crepuscule') then 'free'
    when p_theme in ('fossiles', 'volcan', 'orage', 'microscope', 'adn', 'seisme', 'moyenage', 'voyage', 'fantasy', 'conte', 'theatre', 'heros') then 'class'
    when p_theme in ('ville', 'savane', 'abysses', 'banquise', 'ruche', 'parquet', 'sommets', 'skate') then 'card'
  end;
$function$;

revoke all on function public._student_theme_kind(text) from public, anon, authenticated;
