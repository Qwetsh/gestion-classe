# Story 10.5 : Points de Maison & Coefficients

## Metadata
- **Epic**: 10 - Module "L'Académie des Quatre Lumières"
- **Priority**: HIGH
- **Estimated Effort**: M
- **Status**: Draft
- **Depends on**: 10-1, 10-4

## User Story
**En tant qu'** enseignante
**Je veux** que les notes de groupe alimentent automatiquement les points des Maisons avec un coefficient configurable
**Afin de** lier les activités pédagogiques au système de Maisons

## Contexte
Quand le module est actif sur une classe, les sessions de groupe créent automatiquement 4 groupes = 4 Maisons (Salamandre, Vouivre, Zéphyr, Taisson). Les notes obtenues, multipliées par le coefficient de la session, s'ajoutent aux points de la Maison.

## Critères d'acceptation

### AC-1: Auto-création des groupes Maisons
- [ ] Quand une session de groupe est créée pour une classe avec module actif :
  - 4 groupes auto-créés : Salamandre, Vouivre, Zéphyr, Taisson
  - Élèves auto-assignés à leur Maison respective (via academy_assignments)
  - Élèves sans Maison → non assignés (ajout manuel possible)
- [ ] Les noms de groupes ne sont pas éditables (ce sont les Maisons)
- [ ] Pas de création/suppression de groupe manuelle sur une classe avec module actif

### AC-2: Coefficient par session
- [ ] Champ coefficient affiché lors de la création d'une session de groupe (module actif)
- [ ] Valeur décimale (0.5, 1.0, 1.5, 2.0, etc.), défaut 1.0
- [ ] Sauvegardé dans academy_session_coefficients
- [ ] Éditable aussi depuis le dashboard enseignante (story 10-4)
- [ ] Champ visible uniquement quand module actif sur la classe

### AC-3: Calcul des points de Maison
- [ ] Points Maison = Σ (note_session × coefficient_session) + Σ (bonus_visibles)
- [ ] note_session = score du groupe Maison dans la group_session (somme critères - malus)
- [ ] Seuls les bonus avec visible=true sont comptabilisés
- [ ] Le calcul est effectué côté requête (RPC ou query composée)

### AC-4: Intégration web — création session de groupe
- [ ] Détection automatique si la classe sélectionnée a le module actif
- [ ] Si oui : skip l'étape de création manuelle des groupes
- [ ] Groupes créés automatiquement avec élèves pré-assignés
- [ ] Affichage du champ coefficient

### AC-5: Intégration mobile — création session de groupe
- [ ] Même logique que web pour la création auto des groupes
- [ ] Champ coefficient dans l'écran de configuration
- [ ] L'écran Step2Groups (assignation manuelle) est skip pour les classes avec module actif

## Tâches d'implémentation

### Task 1: Logique auto-création groupes (Web)
- [ ] 1.1 Dans GroupSessions.tsx ou context : détecter classe avec module actif
- [ ] 1.2 Créer les 4 groupes automatiquement (Salamandre, Vouivre, Zéphyr, Taisson)
- [ ] 1.3 Assigner les élèves selon academy_assignments
- [ ] 1.4 Lister les élèves sans Maison pour ajout manuel
- [ ] 1.5 Sauvegarder coefficient dans academy_session_coefficients

### Task 2: Logique auto-création groupes (Mobile)
- [ ] 2.1 Dans groupSessionStore.ts : détecter classe avec module actif via academy_config
- [ ] 2.2 Modifier le flow de création pour skip Step2Groups
- [ ] 2.3 Auto-créer les groupes et assigner les élèves
- [ ] 2.4 Ajouter champ coefficient dans Step1Config (conditionnel)

### Task 3: Calcul des points
- [ ] 3.1 RPC `calculate_house_points(p_class_id UUID)` ou query composée
- [ ] 3.2 Jointure : academy_assignments → session_group_members → group_grades + academy_session_coefficients
- [ ] 3.3 Ajout bonus visibles depuis academy_house_bonuses
- [ ] 3.4 Retourne : [{house, total_points, grade_points, bonus_points}]

## Notes techniques
- La logique Quatre Maisons dans la création de session est un branchement conditionnel, pas un remplacement
- Les classes sans module actif continuent de fonctionner exactement comme avant
- Le coefficient n'existe que pour le module, pas besoin de l'ajouter au schéma group_sessions
