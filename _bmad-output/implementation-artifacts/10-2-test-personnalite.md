# Story 10.2 : Test de Personnalité — Le Diadème des Affinités

## Metadata
- **Epic**: 10 - Module "L'Académie des Quatre Lumières"
- **Priority**: HIGH
- **Estimated Effort**: L
- **Status**: Draft
- **Depends on**: 10-1

## User Story
**En tant qu'** élève
**Je veux** passer un test de personnalité via le Diadème des Affinités
**Afin de** découvrir dans quelle Maison je suis réparti(e)

## Contexte
Test QCM 20 questions + classement des 4 maisons par préférence. Accessible depuis un onglet dédié dans la PWA élève (`/eleve`). Une seule soumission possible, verrouillage après. Questions inspirées de Pottermore : scénarios, valeurs, préférences, réactions instinctives.

## Design de référence
Fichiers du handoff Claude Design : `harrypotter/project/src/student-test.jsx`
- Ambiance : fond étoilé, bougies flottantes, parchemin déroulant
- Écran intro : "Approche, jeune apprenti·e…" avec bouton "Que le Diadème parle"
- Questions une par une avec barre de progression dorée
- Classement final drag & drop avec blasons miniatures
- Écran soumission : astrolabe animé "Le Diadème réfléchit…"
- Écran attente : sceau "Sceau apposé" avec date cérémonie

### Design tokens (tokens.css)
- Fonts : `--font-display` (Cormorant Garamond), `--font-body` (IM Fell English), `--font-mono` (IM Fell English SC)
- Couleurs : palette ink/parchment/gold + couleurs par maison (flamme, onde, souffle, glèbe)
- Animations : `flicker`, `drift`, `twinkle`, `scroll-unfurl`

## Critères d'acceptation

### AC-1: Accès au test
- [ ] Nouvel onglet dans StudentDashboard (visible uniquement si toggle actif pour la classe)
- [ ] Si test non passé → affichage du questionnaire
- [ ] Si test passé → redirection vers vue "Ma Maison" (story 10-6)

### AC-2: Interface du questionnaire
- [ ] Écran intro avec parchemin déroulant (animation scroll-unfurl), texte cérémoniel
- [ ] Affichage question par question (une à la fois, transition animée)
- [ ] 4 choix par question, sélection unique, auto-avance après 600ms
- [ ] Bouton retour pour modifier une réponse précédente
- [ ] Barre de progression dorée segmentée (question X/21)
- [ ] Fond étoilé (Starfield) + bougies flottantes (FloatingCandles)
- [ ] Typographie Cormorant Garamond pour les questions, IM Fell English pour les réponses

### AC-3: Question finale — Classement des maisons
- [ ] Question 21 : "Classe les quatre Maisons selon ton inclination"
- [ ] Sous-texte : "Le Diadème en tiendra compte — sans pour autant s'y plier"
- [ ] Interface drag & drop + boutons ▲▼ pour mobile (comme dans le proto)
- [ ] Chaque maison affichée avec blason SVG miniature + nom + élément + vertu
- [ ] Numérotation en chiffres romains (I, II, III, IV)
- [ ] Validation : les 4 positions doivent être remplies

### AC-4: Soumission et verrouillage
- [ ] Bouton "Remettre mon cœur au Diadème" sur la dernière étape
- [ ] Écran soumission : astrolabe animé tournant + texte "Le Diadème réfléchit…"
- [ ] Appel RPC `submit_academy_test` avec toutes les réponses + préférences
- [ ] Verrouillage : impossible de repasser le test (vérification côté serveur)

### AC-5: Écran d'attente post-test
- [ ] Sceau de cire avec lettre "Q" (composant WaxSeal)
- [ ] Texte "Sceau apposé" + "Ta Maison te sera révélée lors de la prochaine cérémonie"
- [ ] Indicateur date/heure de cérémonie (si configuré par l'enseignante, sinon "En attente")

## Tâches d'implémentation

### Task 1: Onglet dans StudentDashboard
- [ ] 1.1 Ajouter onglet conditionnel dans StudentDashboard.tsx
- [ ] 1.2 Appel RPC `get_student_academy` pour déterminer l'état
- [ ] 1.3 Routing interne : questionnaire / attente / ma-maison

### Task 2: Design system Quatre Maisons
- [ ] 2.1 Créer `gestion-classe-web/src/components/academy/tokens.css` — design tokens du handoff
- [ ] 2.2 Composant `Starfield.tsx` — ciel étoilé animé
- [ ] 2.3 Composant `FloatingCandles.tsx` — bougies flottantes
- [ ] 2.4 Composant `Ornament.tsx` — filets décoratifs (line, diamond, fleur)
- [ ] 2.5 Composant `WaxSeal.tsx` — sceau de cire
- [ ] 2.6 Composant `HouseCrest.tsx` — blasons SVG des 4 maisons (CrestFrame + Salamandre/Vouivre/Zéphyr/Taisson)
- [ ] 2.7 Composant `RollingNumber.tsx` — compteur animé
- [ ] 2.8 Composant `GoldParticles.tsx` — particules dorées pour le reveal
- [ ] 2.9 Données `houses.ts` — constantes des 4 maisons (id, name, element, motto, virtue, colors, etc.)

### Task 3: Composant Questionnaire
- [ ] 3.1 Composant `AcademyQuiz.tsx` — état local des 21 réponses, phases (intro/question/ranking/submitting/waiting)
- [ ] 3.2 Composant `IntroScreen.tsx` — parchemin déroulant avec texte cérémoniel
- [ ] 3.3 Composant `QuestionScreen.tsx` — affichage question + 4 choix avec transition
- [ ] 3.4 Composant `RankingScreen.tsx` — question finale drag/tap-to-rank
- [ ] 3.5 Composant `SubmittingScreen.tsx` — astrolabe animé
- [ ] 3.6 Composant `WaitingScreen.tsx` — sceau apposé
- [ ] 3.7 Barre de progression segmentée dorée

### Task 4: Soumission
- [ ] 4.1 Validation côté client (toutes questions répondues + classement complet)
- [ ] 4.2 Appel RPC `submit_academy_test`
- [ ] 4.3 Gestion erreurs (test déjà soumis, réseau)

## Notes techniques
- Questions chargées une seule fois au montage, stockées en état local
- Toutes les réponses envoyées en un seul appel RPC (pas de sauvegarde partielle)
- Les composants visuels du design system (Starfield, Candles, etc.) sont partagés entre le test et la vue post-test
- Google Fonts : Cormorant Garamond + IM Fell English chargées via `<link>` ou @import
