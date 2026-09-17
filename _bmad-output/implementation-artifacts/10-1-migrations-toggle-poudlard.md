# Story 10.1 : Migrations BDD & Toggle — Module Quatre Maisons

## Metadata
- **Epic**: 10 - Module "L'Académie des Quatre Lumières"
- **Priority**: HIGH
- **Estimated Effort**: L
- **Status**: Draft

## User Story
**En tant qu'** enseignante
**Je veux** activer/désactiver un mode "Quatre Maisons" par classe
**Afin de** gérer un système de maisons (Salamandre, Vouivre, Zéphyr, Taisson) pour les classes concernées, sans impacter les autres

## Contexte
Module isolé inspiré de l'univers "L'Académie des Quatre Lumières" (univers fantasy original, pas de référence directe à Harry Potter). S'intègre à l'existant (groupes, notes) sans modifier les fonctionnalités actuelles. Le toggle contrôle toute la visibilité côté élève.

### Les 4 Maisons
| Maison | Élément | Vertu | Couleurs |
|--------|---------|-------|----------|
| Salamandre | Flamme | Courage | Rouge-or |
| Vouivre | Onde | Astuce | Vert-argent |
| Zéphyr | Souffle | Savoir | Bleu-bronze |
| Taisson | Glèbe | Loyauté | Or-noir |

### Artefact de répartition
Le **Diadème des Affinités** (remplace le concept du Choixpeau).

## Critères d'acceptation

### AC-1: Nouvelles tables BDD
- [ ] Table `academy_config` créée (id, class_id, user_id, enabled BOOLEAN, created_at)
  - UNIQUE(class_id) — une seule config par classe
- [ ] Table `academy_questions` créée (id, question_order INTEGER, question_text TEXT, created_at)
- [ ] Table `academy_answers` créée (id, question_id FK, answer_text TEXT, display_order INTEGER, salamandre_weight REAL, vouivre_weight REAL, zephyr_weight REAL, taisson_weight REAL)
- [ ] Table `academy_responses` créée (id, student_id FK, question_id FK, answer_id FK, submitted_at)
  - UNIQUE(student_id, question_id) — un élève ne répond qu'une fois par question
- [ ] Table `academy_preferences` créée (id, student_id FK, house TEXT, rank INTEGER 1-4, submitted_at)
  - UNIQUE(student_id, house) — une seule préférence par maison
- [ ] Table `academy_assignments` créée (id, student_id FK, class_id FK, house TEXT NOT NULL, assigned_by TEXT DEFAULT 'algorithm', override BOOLEAN DEFAULT false, assigned_at)
  - UNIQUE(student_id, class_id)
  - CHECK house IN ('salamandre', 'vouivre', 'zephyr', 'taisson')
- [ ] Table `academy_house_bonuses` créée (id, class_id FK, user_id FK, house TEXT, points REAL, label TEXT, visible BOOLEAN DEFAULT false, created_at, revealed_at)
- [ ] Table `academy_session_coefficients` créée (id, group_session_id FK UNIQUE, coefficient REAL DEFAULT 1.0)
  - Lien vers group_sessions existante
- [ ] RLS policies sur toutes les tables (user_id based, hiérarchique via class_id)
- [ ] Migration Supabase créée

### AC-2: RPC élève
- [ ] Fonction `get_student_academy(p_code VARCHAR(6))` créée (SECURITY DEFINER)
  - Retourne : config enabled, house assignée, test complété ou non, points de la maison, classement 4 maisons
- [ ] Fonction `submit_academy_test(p_code VARCHAR(6), p_responses JSONB, p_preferences JSONB)` créée
  - Vérifie que le test n'a pas déjà été soumis
  - Insère réponses et préférences en une transaction

### AC-3: Toggle par classe
- [ ] UI toggle dans la page classe (web) pour activer/désactiver le module
- [ ] Quand désactivé : aucun contenu Quatre Maisons visible côté élève
- [ ] Quand activé : onglet dédié apparaît dans StudentDashboard

### AC-4: Seed des 20 questions
- [ ] Script SQL de seed avec 20 questions style Pottermore (Wizarding World)
- [ ] Tonalité cérémonielle, questions sur la personnalité/les valeurs/les réactions
- [ ] 4 réponses par question avec pondérations par maison (chaque réponse favorise 1-2 maisons)
- [ ] Question finale (question 21) : classement des 4 maisons par préférence (gérée côté front, pas en BDD questions)

## Tâches d'implémentation

### Task 1: Migration Supabase
- [ ] 1.1 Créer fichier migration `supabase-migrations/014_academy_module.sql`
- [ ] 1.2 Tables academy_config, academy_questions, academy_answers
- [ ] 1.3 Tables academy_responses, academy_preferences
- [ ] 1.4 Tables academy_assignments, academy_house_bonuses
- [ ] 1.5 Table academy_session_coefficients
- [ ] 1.6 RLS policies pour toutes les tables
- [ ] 1.7 RPC `get_student_academy`
- [ ] 1.8 RPC `submit_academy_test`

### Task 2: Seed questions
- [ ] 2.1 Rédiger 20 questions style Pottermore avec 4 réponses chacune
- [ ] 2.2 Pondérations réalistes par maison (0-3 par maison par réponse)
- [ ] 2.3 Insérer via migration ou script seed séparé

### Task 3: Toggle UI (Web)
- [ ] 3.1 Ajouter toggle dans la page classe existante
- [ ] 3.2 Query Supabase pour lire/écrire academy_config
- [ ] 3.3 Conditionner l'affichage de l'onglet dans StudentDashboard

## Notes techniques
- Tables préfixées `academy_` pour isolation claire
- Le coefficient est stocké séparément de group_sessions pour ne pas toucher au schéma existant
- RPC SECURITY DEFINER pour accès élève sans auth Supabase
- Les maisons sont identifiées par leurs IDs : `salamandre`, `vouivre`, `zephyr`, `taisson`
