# Story 10.4 : Dashboard Enseignante — Registre du Professeur

## Metadata
- **Epic**: 10 - Module "L'Académie des Quatre Lumières"
- **Priority**: HIGH
- **Estimated Effort**: XL
- **Status**: Draft
- **Depends on**: 10-1, 10-3

## User Story
**En tant qu'** enseignante
**Je veux** un dashboard dédié pour gérer le module Quatre Maisons de chaque classe
**Afin de** suivre la répartition, les points des maisons, et gérer les bonus

## Contexte
Page web desktop "Registre du Professeur". Esthétique grimoire nocturne : fond étoilé, panneaux parchemin, dorures, sceaux de cire. Visible dans la sidebar uniquement si au moins une classe a le module actif.

## Design de référence
Fichier handoff : `harrypotter/project/src/teacher-dashboard.jsx`
- Header : astrolabe + titre "Registre du Professeur · Classe des Quatre Maisons" + sceau de cire
- 4 panneaux parchemin (HousePanel) avec blason, points, rang, bonus cachés
- Podium des maisons (barres proportionnelles)
- Zone d'attribution : toggle par maison/par élève, slider points, toggle visible/caché
- Sidebar droite : actions rapides (reveal, réponses brutes, réaffectation) + journal de cérémonie
- Modals : roster par maison, attribution bonus, réaffectation, réponses brutes
- Overlay de reveal : vignette + particules dorées + shake des panneaux

## Critères d'acceptation

### AC-1: Navigation et accès
- [ ] Nouvelle route `/academy` dans le web
- [ ] Lien dans la sidebar (visible si ≥1 classe avec module actif)
- [ ] Sélecteur de classe en haut (filtre sur classes avec module actif)

### AC-2: Vue d'ensemble des 4 Maisons
- [ ] 4 panneaux parchemin (parchment-bg + parchment-edges) avec blason SVG
- [ ] Chaque panneau : nom maison, devise, nombre d'élèves, total points, rang
- [ ] Leader avec couronne dorée SVG
- [ ] Points = notes de groupe pondérées (× coefficient) + bonus visibles
- [ ] Indication "+ ? · caché" si bonus cachés en attente
- [ ] Hover : translation -3px

### AC-3: Podium
- [ ] 4 barres proportionnelles ordonnées par points
- [ ] Numérotation rang romain (Ier, IIe, IIIe, IVe)
- [ ] Blason miniature au-dessus de chaque barre
- [ ] Compteur RollingNumber animé

### AC-4: Liste des élèves par maison (modal)
- [ ] Clic sur panneau maison → modal roster
- [ ] Blason + description + devise en latin
- [ ] Liste avec avatar initiales, nom pseudonymisé
- [ ] Select pour réaffecter directement depuis le roster

### AC-5: Réaffectation manuelle (modal)
- [ ] Grille : nom élève / maison actuelle / select nouvelle maison
- [ ] Override=true, bypass du quota
- [ ] Mise à jour immédiate

### AC-6: Réponses brutes (modal)
- [ ] Liste d'élèves à gauche, détail à droite
- [ ] Pour chaque question : texte question, réponse choisie, pondérations
- [ ] Scores totaux par maison

### AC-7: Lancer la répartition
- [ ] Bouton dans la sidebar "Actions rapides"
- [ ] Affiche nb élèves ayant passé le test vs total
- [ ] Preview du résultat dans un modal avant validation
- [ ] Confirmation avant écriture

### AC-8: Gestion des bonus
- [ ] Zone d'attribution : toggle par maison / par élève
- [ ] Sélection maison cible (4 boutons avec blason miniature) ou select élève
- [ ] Slider points (-50 à +100, step 5)
- [ ] Toggle visible/caché avec explication contextuelle
- [ ] Bouton "Inscrire au registre" pour valider
- [ ] Récapitulatif des bonus cachés en attente par maison

### AC-9: Reveal des bonus cachés
- [ ] Bouton "Révéler les bonus cachés" (doré, proéminent)
- [ ] Désactivé si aucun bonus caché
- [ ] Animation reveal : vignette assombrissante + shake des panneaux + particules dorées
- [ ] Les points se mettent à jour avec RollingNumber (2.5s)
- [ ] Passe les bonus cachés en visible=true en BDD
- [ ] Pousse l'update en temps réel aux élèves (story 10-6)

### AC-10: Coefficient sur sessions de groupe
- [ ] Section sessions de groupe de cette classe dans le dashboard
- [ ] Champ coefficient décimal éditable par session
- [ ] Sauvegardé dans academy_session_coefficients
- [ ] Visible uniquement quand module actif

### AC-11: Élèves sans test
- [ ] Liste des élèves n'ayant pas encore passé le test
- [ ] Possibilité de les assigner manuellement (override)

## Tâches d'implémentation

### Task 1: Page et routing
- [ ] 1.1 Créer `gestion-classe-web/src/pages/Academy.tsx`
- [ ] 1.2 Ajouter route `/academy` dans App.tsx
- [ ] 1.3 Ajouter lien conditionnel dans Layout.tsx

### Task 2: Queries Supabase
- [ ] 2.1 Créer `gestion-classe-web/src/lib/academyQueries.ts`
- [ ] 2.2 Fonctions : fetchAcademyConfig, fetchAssignments, fetchBonuses, fetchTestResponses
- [ ] 2.3 Fonctions : saveAssignment, saveBonus, revealBonuses, saveCoefficient
- [ ] 2.4 Fonction : calculateHousePoints (notes pondérées + bonus visibles)

### Task 3: Composants dashboard
- [ ] 3.1 `HousePanel.tsx` — panneau parchemin avec blason et points
- [ ] 3.2 `Podium.tsx` — classement barres proportionnelles
- [ ] 3.3 `AwardZone.tsx` — attribution points (toggle maison/élève, slider, visible/caché)
- [ ] 3.4 `HouseRosterModal.tsx` — liste élèves par maison
- [ ] 3.5 `ReassignModal.tsx` — réaffectation manuelle
- [ ] 3.6 `RawResponsesModal.tsx` — réponses brutes au test
- [ ] 3.7 `SortingLauncher.tsx` — lancement algo + preview
- [ ] 3.8 `BonusRevealOverlay.tsx` — animation reveal (vignette + particules + shake)
- [ ] 3.9 `CoefficientEditor.tsx` — édition coefficients sessions
- [ ] 3.10 `SidePanel.tsx` — panneau actions rapides + journal

### Task 4: Intégration algorithme
- [ ] 4.1 Import de sortingAlgorithm.ts (story 10-3)
- [ ] 4.2 Preview des résultats dans un modal
- [ ] 4.3 Validation et écriture en BDD

## Notes techniques
- Composants réutilisent le design system créé en 10-2 (Starfield, HouseCrest, Ornament, etc.)
- Dashboard = page web uniquement (pas mobile)
- Calcul des points côté client pour réactivité
- Les modals suivent le pattern ModalShell du handoff (parchemin, bouton fermeture, ornement)
