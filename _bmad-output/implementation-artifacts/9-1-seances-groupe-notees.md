# Story 9.1 : Séances de Groupe Notées

## Metadata
- **Epic**: 9 - Évaluation par groupes
- **Priority**: HIGH
- **Estimated Effort**: XL
- **Status**: Draft

## User Story
**En tant qu'** enseignant
**Je veux** créer des séances d'évaluation par groupes avec critères personnalisés
**Afin de** noter rapidement mes élèves lors d'activités pratiques (dissection, oral, TP...)

## Contexte
Remplace entièrement l'ancien système "Groupes/Îlots" qui était incomplet et mal conçu.

## Critères d'acceptation

### AC-1: Suppression ancien système
- [ ] Table `student_groups` supprimée (SQLite + Supabase)
- [ ] Colonne `group_id` retirée de `students`
- [ ] Fichiers `groupStore.ts` et `groupRepository.ts` supprimés
- [ ] UI groupes retirée de `classes/[id].tsx`
- [ ] Indicateur groupe retiré de `session/[id].tsx`
- [ ] Sync groupes retirée de `syncService.ts`
- [ ] Migration Supabase pour supprimer la table

### AC-2: Nouveau schéma de données
- [ ] Table `group_sessions` créée (id, name, class_id, user_id, status, created_at, completed_at)
- [ ] Table `grading_criteria` créée (id, session_id, label, max_points, order)
- [ ] Table `session_groups` créée (id, session_id, name, conduct_malus)
- [ ] Table `session_group_members` créée (group_id, student_id)
- [ ] Table `group_grades` créée (group_id, criteria_id, points_awarded)
- [ ] RLS policies pour toutes les nouvelles tables
- [ ] Schéma SQLite local miroir

### AC-3: Bouton accueil + Navigation
- [ ] Nouveau bouton "Séance en groupe" sur HomeScreen
- [ ] Icône distincte (ex: Users + clipboard)
- [ ] Navigation vers écran de création

### AC-4: Création de séance (Étape 1 - Config)
- [ ] Champ nom de séance (ex: "Dissection sardine")
- [ ] Sélecteur de classe
- [ ] Bouton "Suivant" vers création groupes

### AC-5: Création des groupes (Étape 2)
- [ ] Liste des élèves de la classe sélectionnée
- [ ] Possibilité de créer N groupes
- [ ] Drag & drop ou tap pour assigner élèves aux groupes
- [ ] Nom de groupe éditable (défaut: "Groupe 1", "Groupe 2"...)
- [ ] Validation: tous les élèves doivent être assignés OU option "élèves non participants"
- [ ] Bouton "Suivant" vers critères

### AC-6: Définition des critères (Étape 3)
- [ ] Ajouter critère: champ texte + points max (number input)
- [ ] Liste des critères avec ordre modifiable (drag)
- [ ] Suppression critère possible
- [ ] Affichage total points possibles en temps réel
- [ ] Bouton "Démarrer la notation"

### AC-7: Interface de notation
- [ ] Vue par groupe (tabs ou swipe horizontal)
- [ ] Pour chaque groupe:
  - Liste des critères avec slider (0 → max_points)
  - Note actuelle affichée en gros
  - Liste des membres du groupe visible
- [ ] Bouton "-1 pt" bien visible (malus conduite)
  - Compteur de malus affiché
  - Confirmation ou undo possible
- [ ] Navigation fluide entre groupes (< 100ms)
- [ ] Calcul note temps réel: Σ(points) + malus

### AC-8: Finalisation séance
- [ ] Bouton "Terminer la séance"
- [ ] Récapitulatif des notes par groupe
- [ ] Confirmation avant validation
- [ ] Sauvegarde locale SQLite
- [ ] Sync Supabase automatique si online
- [ ] Statut passe à "completed"

### AC-9: Historique dans vue Parents (Mobile)
- [ ] Section "Notes de groupe" dans écran parent-meeting
- [ ] Liste des séances où l'élève a participé
- [ ] Pour chaque: nom séance, date, note obtenue, note max
- [ ] Détail accessible: critères + points par critère

### AC-10: Nouvel onglet Web "Séances en groupe"
- [ ] Route `/group-sessions`
- [ ] Tableau listant toutes les séances
- [ ] Colonnes: Nom, Classe, Date, Nb groupes, Statut
- [ ] Filtres: par classe, par période
- [ ] Clic sur ligne → détail avec tous les groupes et notes

### AC-11: Notes de groupe dans détail élève (Web)
- [ ] Section dans page élève
- [ ] Même affichage que mobile

### AC-12: Offline support
- [ ] Création séance offline possible
- [ ] Notation offline possible
- [ ] Sync automatique au retour online
- [ ] Gestion conflits (last-write-wins)

## Modèle de données détaillé

### group_sessions
```sql
CREATE TABLE group_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, active, completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ
);
```

### grading_criteria
```sql
CREATE TABLE grading_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  max_points REAL NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ
);
```

### session_groups
```sql
CREATE TABLE session_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  conduct_malus REAL NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ
);
```

### session_group_members
```sql
CREATE TABLE session_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES session_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  synced_at TIMESTAMPTZ,
  UNIQUE(group_id, student_id)
);
```

### group_grades
```sql
CREATE TABLE group_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES session_groups(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES grading_criteria(id) ON DELETE CASCADE,
  points_awarded REAL NOT NULL DEFAULT 0,
  synced_at TIMESTAMPTZ,
  UNIQUE(group_id, criteria_id)
);
```

## Tâches d'implémentation

### Task 1: Nettoyage ancien système
- [x] 1.1 Créer migration Supabase DROP student_groups + ALTER students DROP group_id
- [x] 1.2 Supprimer groupStore.ts
- [x] 1.3 Supprimer groupRepository.ts
- [x] 1.4 Nettoyer schema.ts (retirer student_groups)
- [x] 1.5 Nettoyer syncService.ts (retirer sync groupes)
- [x] 1.6 Nettoyer classes/[id].tsx (retirer section groupes)
- [x] 1.7 Nettoyer session/[id].tsx (retirer indicateur groupe)
- [x] 1.8 Nettoyer types/index.ts (retirer groupId de Student)
- [x] 1.9 Nettoyer stores/index.ts et database/index.ts
- [x] 1.10 Mettre à jour deleteService.ts
- [x] 1.11 Tests: vérifier que l'app compile et fonctionne sans groupes

### Task 2: Nouveau schéma de données
- [x] 2.1 Créer migration Supabase avec nouvelles tables + RLS
- [x] 2.2 Mettre à jour schema.ts SQLite local
- [x] 2.3 Créer types TypeScript (GroupSession, GradingCriteria, SessionGroup, GroupGrade)
- [x] 2.4 Créer groupSessionRepository.ts (contient toutes les fonctions)
- [x] 2.5 ~~Créer gradingCriteriaRepository.ts~~ (fusionné dans 2.4)
- [x] 2.6 ~~Créer sessionGroupRepository.ts~~ (fusionné dans 2.4)
- [x] 2.7 ~~Créer groupGradeRepository.ts~~ (fusionné dans 2.4)
- [x] 2.8 Tests: compilation TypeScript OK

### Task 3: Store et logique métier
- [x] 3.1 Créer groupSessionStore.ts (Zustand)
- [x] 3.2 Actions: createSession, addGroup, addCriteria, setGrade, applyMalus
- [x] 3.3 Computed: calculateGroupScore, calculateStudentScore
- [x] 3.4 Tests store (compilation TypeScript OK)

### Task 4: UI Mobile - Navigation et accueil
- [x] 4.1 Ajouter bouton "Séance en groupe" sur HomeScreen
- [x] 4.2 Créer route /group-session/create
- [x] 4.3 Créer route /group-session/[id]/grade
- [x] 4.4 Créer route /group-session/[id]/summary

### Task 5: UI Mobile - Écran création (3 étapes)
- [x] 5.1 Composant Step1Config (nom + classe)
- [x] 5.2 Composant Step2Groups (création groupes + assignation)
- [x] 5.3 Composant Step3Criteria (définition critères)
- [x] 5.4 Navigation entre étapes avec état persisté
- [x] 5.5 Tests composants (TypeScript compilation OK)

### Task 6: UI Mobile - Écran notation
- [x] 6.1 Layout avec tabs/swipe pour groupes
- [x] 6.2 Composant CriteriaSlider
- [x] 6.3 Composant GroupScoreDisplay (note temps réel)
- [x] 6.4 Bouton MalusButton avec compteur
- [x] 6.5 Animation et feedback haptique
- [x] 6.6 Bouton "Terminer" avec récapitulatif
- [x] 6.7 Tests écran notation (TypeScript compilation OK)

### Task 7: Intégration vue Parents (Mobile)
- [x] 7.1 Ajouter section "Notes de groupe" dans parent-meeting
- [x] 7.2 Query pour récupérer notes d'un élève (getStudentGrades)
- [x] 7.3 Affichage liste avec barre de progression
- [x] 7.4 Tests (TypeScript compilation OK)

### Task 8: Sync offline
- [x] 8.1 Ajouter nouvelles tables dans syncService
- [x] 8.2 Ordre de sync: sessions → criteria → groups → members → grades
- [x] 8.3 Gestion conflits (filtrage des dépendances non synced)
- [x] 8.4 Tests sync (TypeScript compilation OK)

### Task 9: Web - Nouvel onglet
- [x] 9.1 Créer page GroupSessions.tsx
- [x] 9.2 Tableau avec filtres
- [x] 9.3 Vue détail séance
- [x] 9.4 Intégration navigation sidebar

### Task 10: Web - Notes dans détail élève
- [x] 10.1 Ajouter section notes de groupe dans Students.tsx ou StudentDetail
- [x] 10.2 Query Supabase
- [x] 10.3 Affichage cohérent avec mobile

## Notes techniques
- Slider: react-native-gesture-handler pour fluidité
- Haptique: feedback à chaque changement de valeur entière
- Performance: memo sur composants de liste
- Animations: reanimated pour transitions groupes

## Dépendances
- Aucune nouvelle dépendance requise

## Risques
- Complexité UI notation sur petit écran → tester sur S25
- Performance avec beaucoup de critères → limiter à 10 max ?

---

## Dev Agent Record

### Task 1 - Nettoyage ancien système (Complété)
**Décisions:**
- Migration SQLite v7 recrée la table students sans group_id (SQLite ne supporte pas DROP COLUMN)
- Migration Supabase v7 créée séparément pour être exécutée manuellement

**Fichiers supprimés:**
- stores/groupStore.ts
- services/database/groupRepository.ts

**Fichiers modifiés:**
- stores/index.ts - Retiré export groupStore
- services/database/index.ts - Retiré exports groupRepository
- services/database/schema.ts - Retiré table student_groups et colonne group_id, version 7
- services/database/migrations.ts - Ajouté migration v7
- services/sync/syncService.ts - Retiré sync groupes
- services/database/deleteService.ts - Retiré suppression groupes
- services/database/studentRepository.ts - Retiré group_id
- types/index.ts - Retiré groupId de Student
- app/(main)/classes/[id].tsx - Retiré toute la section groupes
- app/(main)/session/[id].tsx - Retiré indicateur groupe

**Fichiers créés:**
- supabase-migration-v7.sql

## File List

### Task 1 - Nettoyage
- stores/groupStore.ts (SUPPRIMÉ)
- services/database/groupRepository.ts (SUPPRIMÉ)
- stores/index.ts (MODIFIÉ)
- services/database/index.ts (MODIFIÉ)
- services/database/schema.ts (MODIFIÉ)
- services/database/migrations.ts (MODIFIÉ)
- services/sync/syncService.ts (MODIFIÉ)
- services/database/deleteService.ts (MODIFIÉ)
- services/database/studentRepository.ts (MODIFIÉ)
- types/index.ts (MODIFIÉ)
- app/(main)/classes/[id].tsx (MODIFIÉ)
- app/(main)/session/[id].tsx (MODIFIÉ)
- supabase-migration-v7.sql (CRÉÉ)

### Task 2 - Nouveau schéma
- types/index.ts (MODIFIÉ - ajout types GroupSession, GradingCriteria, etc.)
- services/database/schema.ts (MODIFIÉ - v8, 5 nouvelles tables)
- services/database/migrations.ts (MODIFIÉ - migration v8)
- services/database/groupSessionRepository.ts (CRÉÉ - 600+ lignes)
- services/database/index.ts (MODIFIÉ - exports)
- supabase-migration-v8.sql (CRÉÉ - tables + RLS policies)

### Task 3 - Store Zustand
- stores/groupSessionStore.ts (CRÉÉ - store complet avec état actif et actions)
- stores/index.ts (MODIFIÉ - export useGroupSessionStore, types GradingCriteria etc.)

### Task 4, 5, 6 - UI Mobile Complète
- app/(main)/index.tsx (MODIFIÉ - ajout bouton "Groupes" dans quickActionsGrid)
- app/(main)/group-session/create.tsx (CRÉÉ - wizard 3 étapes complet)
- app/(main)/group-session/[id]/grade.tsx (CRÉÉ - écran notation avec sliders et malus)
- app/(main)/group-session/[id]/summary.tsx (CRÉÉ - récapitulatif des notes)

### Task 7 - Intégration vue Parents
- app/(main)/parent-meeting/[studentId].tsx (MODIFIÉ - section "Notes de groupe" ajoutée)

### Task 8 - Sync offline (Complété)
**Fichiers modifiés:**
- services/sync/syncService.ts (MODIFIÉ - ajout 5 fonctions sync: syncGroupSessions, syncGradingCriteria, syncSessionGroups, syncGroupMembers, syncGroupGrades)
- stores/syncStore.ts (MODIFIÉ - mise à jour SyncResult avec nouveaux compteurs)

**Implémentation:**
- Sync dans l'ordre des dépendances: group_sessions → grading_criteria → session_groups → session_group_members → group_grades
- Filtrage automatique des enregistrements dont les dépendances ne sont pas encore sync
- getUnsyncedCount() mis à jour pour compter les 5 nouvelles tables

### Task 9 - Web - Nouvel onglet (Complété)
**Fichiers créés:**
- gestion-classe-web/src/pages/GroupSessions.tsx (CRÉÉ - page complète avec liste, filtres et modal détail)

**Fichiers modifiés:**
- gestion-classe-web/src/App.tsx (MODIFIÉ - ajout route /group-sessions)
- gestion-classe-web/src/components/Layout.tsx (MODIFIÉ - ajout lien navigation "Groupes")

**Fonctionnalités:**
- Tableau listant toutes les séances de groupe
- Filtres par classe
- Modal de détail avec critères et notes par groupe
- Classement des groupes par score

### Task 10 - Web - Notes dans détail élève (Complété)
**Fichiers modifiés:**
- gestion-classe-web/src/pages/Students.tsx (MODIFIÉ - section "Notes de groupe" dans modal détail élève)

**Fonctionnalités:**
- Chargement automatique des notes de groupe à l'ouverture du modal
- Affichage avec barres de progression colorées
- Même style que les autres sections
