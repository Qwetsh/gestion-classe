# Migrations Supabase (base Class'it)

- Les migrations s'appliquent **à la main** sur Class'it (éditeur SQL ou MCP Supabase), sans CLI Supabase.
- Un fichier appliqué sur la base est ajouté à la branche principale **le jour même**, sous son numéro.
- **Prochain numéro libre : 072.**

## Particularités de la numérotation

- **065** (`065_lesson_boards`) est appliquée, mais son fichier est dans la PR #43, avec la fonctionnalité en cours.
- **067** (`067_student_work_honors`) a été appliquée par erreur sous le nom `065_student_work_honors` dans l'historique de la base.

## Règles

- Une fonction interne (préfixe `_`) se ferme avec `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;` : retirer seulement `PUBLIC` ne suffit pas, Supabase donne le droit d'exécution à `anon` et `authenticated` à la création (cf. 071).
- Les fonctions `student_*` sont appelées par l'Hôpital virtuel (dépôt `Qwetsh/hopital-virtuel`). Leur contrat est décrit dans `docs/lien-gestion-classe.md` de ce dépôt. Avant de mettre en ligne un changement de ces fonctions, lancer `npm run verifier-lien` dans le dépôt de l'hôpital.
