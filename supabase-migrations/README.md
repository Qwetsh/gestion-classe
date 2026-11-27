# Migrations de la base

Ce dossier garde, dans l'ordre, chaque changement de structure appliqué à la base de production (projet Supabase « Class'it »).

## Comment une migration arrive en production

Il n'y a pas d'application automatique. Une migration est appliquée à la main, par Claude, avec l'outil `apply_migration` du connecteur Supabase, sous le même nom que son fichier (sans `.sql`). Le fichier est commité dans la même PR que le code qui en dépend.

Règle : **pas de migration en production sans son fichier dans `master`**, et inversement. Le contrôle se fait en comparant ce dossier à la liste des migrations enregistrées (`list_migrations`).

Prochain numéro libre : **102**.

Après l'avoir appliquée, régénérer la description de la base que lit le code web, et la commiter dans la même PR :

```
cd gestion-classe-web
npm run db:types
```

Elle ne contient que les tables et fonctions utilisées par `src/` ; une colonne remplie par un déclencheur se déclare dans `REMPLIES_PAR_LA_BASE` (`scripts/gen-db-types.mjs`).

## Ce que ce dossier ne contient pas

- Les tables d'origine (`students`, `classes`, `sessions`, `events`…) et quelques fonctions anciennes, créées avant que ce dossier existe (pas de fichiers 001 et 002). Ce dossier ne suffit donc pas à reconstruire la base depuis zéro.
- La structure complète, elle, est exportée chaque nuit par la sauvegarde automatique (dépôt privé `gestion-classe-sauvegardes`, fichier `schema.sql`). C'est elle qui sert à reconstruire.
- Les tables des autres applications hébergées sur le même projet (jeu, parc matériel, bot, Groupit).
- `gestion-classe-web/supabase/migrations/` et `gestion-classe-web/sql/` : scripts plus anciens, gardés pour l'histoire. Ne rien y ajouter.

## Particularités à connaître

| Fichier | À savoir |
|---|---|
| `043_shared_schools.sql` | Appliquée le 25/09/2026. L'écran correspondant n'est pas dans l'application ; la migration 096 soumet l'adhésion à l'accord d'un administrateur. |
| `047` à `050` | Enregistrées en production sans numéro (`student_work_view`, `reward_icons`, `reward_unique_labels`, `select_student_bonus_robust`). |
| `067_student_work_honors.sql` | Enregistrée en production sous le nom `065_student_work_honors`. |
| `071_*` (deux fichiers) | Deux migrations portent le numéro 071 ; les deux sont appliquées. |
| `076` à `078` | Enregistrées en production sans numéro (`search_courses`, `lesson_board_source`, `course_files`). |
| `093_*` (deux fichiers) | Deux migrations portent le numéro 093 ; les deux sont appliquées. |
| `094` et `095` | Appliquées dans l'ordre inverse de leurs numéros, sans conséquence. |

## Règles pour écrire une migration

- **Sécurité par ligne sur toute nouvelle table**, avec un filtre sur le propriétaire (`user_id = auth.uid()`). Six enseignants partagent cette base.
- **« Connecté » ne veut pas dire « enseignant ».** Les connexions anonymes sont activées sur le projet : une règle ouverte au rôle `authenticated` vaut pour n'importe qui. Pour réserver une écriture aux enseignants, utiliser `is_real_account()` (migration 096).
- **Toute fonction ouverte aux élèves** (appelable sans connexion, avec un code à 6 chiffres) doit être `VOLATILE` et passer par `resolve_student_code`, `_student_work_resolve` ou `_student_code_gate` : sinon elle échappe au frein sur les essais de codes (migration 094).
- **Une fonction interne** (préfixe `_`) est fermée aux rôles `anon` et `authenticated` : `revoke all ... from public, anon, authenticated`.
- **Une fonction `SECURITY DEFINER`** fixe son `search_path` et ne se fie jamais à un identifiant de compte passé en paramètre : elle lit `auth.uid()`.
- Les fonctions `student_*` sont aussi appelées par des activités hébergées hors de l'application (l'Hôpital virtuel). Avant d'en modifier une, lire sa définition en production (`pg_get_functiondef`) : toutes ne sont pas dans ce dossier.

## Fonctions serveur

Leur code est dans `supabase/functions/`, et le réglage « jeton exigé ou non » de chacune dans `supabase/config.toml`, qui fait foi au déploiement.
