-- 103 : les neuf derniers thèmes du catalogue de l'espace élève.
--
-- Pangée, Boîte de Pétri, Radiographie : thèmes de sciences, ouverts par le professeur avec le
-- cours, classe par classe. Rétro 84, Mur, Planche, Platines, Terminal, Bonbon : hors cours, à
-- gagner avec les tampons (ou ouverts à toute une classe par le professeur).
-- Seule la liste des familles est rejouée ; elle doit rester identique à celle de
-- lib/studentThemes.ts (un test le contrôle sur la dernière migration qui définit cette fonction).
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
    when p_theme in ('fossiles', 'volcan', 'orage', 'microscope', 'adn', 'seisme', 'pangee', 'petri', 'radio', 'moyenage', 'voyage', 'fantasy', 'conte', 'theatre', 'heros') then 'class'
    when p_theme in ('ville', 'savane', 'abysses', 'banquise', 'ruche', 'parquet', 'sommets', 'skate', 'retro', 'mur', 'planche', 'platines', 'terminal', 'bonbon') then 'card'
  end;
$function$;

revoke all on function public._student_theme_kind(text) from public, anon, authenticated;
