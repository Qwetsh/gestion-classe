# Story 10.6 : Vue Élève "Ma Maison" + Realtime

## Metadata
- **Epic**: 10 - Module "L'Académie des Quatre Lumières"
- **Priority**: HIGH
- **Estimated Effort**: L
- **Status**: Draft
- **Depends on**: 10-1, 10-2, 10-5

## User Story
**En tant qu'** élève réparti dans une Maison
**Je veux** voir ma Maison, ses points et le classement en temps réel
**Afin de** suivre la compétition entre les quatre Maisons

## Contexte
Vue dans l'onglet dédié de StudentDashboard, affichée après la répartition. Le temps réel est nécessaire pour le moment de révélation des bonus cachés par l'enseignante (événement ponctuel mais spectaculaire en classe).

## Design de référence
Fichier handoff : `harrypotter/project/src/student-post.jsx`
- Fond étoilé avec dégradé teinté de la couleur de la Maison
- Révélation du blason : scale(0.2) rotate(-30deg) → scale(1) rotate(0) avec particules dorées
- Nom de la Maison en dégradé or→couleur maison, taille 44px
- Devise + vertu sous le nom
- Encart points : compteur RollingNumber 72px, rang en chiffres romains
- 3 autres Maisons en miniature avec delta de points et rang
- Indicateur "Mise à jour en direct" (point vert pulsant)

## Critères d'acceptation

### AC-1: Révélation de la Maison
- [ ] Animation d'entrée du blason : scale + rotation + particules dorées (GoldParticles)
- [ ] Nom de la Maison en dégradé gold→couleur maison
- [ ] Devise en français + vertu affichées sous le nom
- [ ] Séquence temporisée : blason (0.3s) → nom (0.8s) → devise (1.2s) → points (1.4s) → classement (1.8s)

### AC-2: Points et classement
- [ ] Total des points de la Maison affiché en grand (RollingNumber, 72px)
- [ ] Rang parmi les 4 (Ier/IIe/IIIe/IVe rang sur IV)
- [ ] Les 3 autres Maisons en miniature : blason réduit, nom, points, delta, rang
- [ ] Delta coloré : vert si en avance, rouge si en retard

### AC-3: Mise à jour temps réel
- [ ] Supabase Realtime configuré sur la table academy_house_bonuses
- [ ] Quand un bonus passe de caché → visible : recalcul automatique des points
- [ ] Compteur RollingNumber animé lors de la mise à jour (duration 2.5s)
- [ ] Indicateur "Mise à jour en direct" (point vert pulsant + texte)

### AC-4: Animation de révélation bonus
- [ ] Quand un bonus est révélé en direct : les compteurs défilent
- [ ] Transition fluide des rangs si le classement change
- [ ] Le tout sans rechargement de page

### AC-5: États de la vue
- [ ] Module désactivé → onglet invisible
- [ ] Module activé + test non passé → questionnaire (story 10-2)
- [ ] Module activé + test passé + pas réparti → écran d'attente (sceau)
- [ ] Module activé + test passé + réparti → vue "Ma Maison"

## Tâches d'implémentation

### Task 1: Configuration Supabase Realtime
- [ ] 1.1 Activer Realtime sur la table academy_house_bonuses
- [ ] 1.2 Configurer le channel dans le composant élève
- [ ] 1.3 Listener sur UPDATE (visible: false → true) filtré par class_id

### Task 2: Composant "Ma Maison"
- [ ] 2.1 Composant `MyHouse.tsx` dans `gestion-classe-web/src/components/academy/`
- [ ] 2.2 Animation d'entrée séquencée (blason → nom → points → classement)
- [ ] 2.3 Fond étoilé teinté couleur maison (radial-gradient dynamique)
- [ ] 2.4 Réutilisation HouseCrest avec glow=true

### Task 3: Classement des maisons
- [ ] 3.1 Composant `HouseLeaderboard.tsx` — les 3 autres maisons en miniature
- [ ] 3.2 Appel RPC pour les points des 4 maisons
- [ ] 3.3 Delta coloré et rang pour chaque maison
- [ ] 3.4 Mise en évidence de la maison de l'élève

### Task 4: Realtime et animations
- [ ] 4.1 Hook `useHousePointsRealtime(classId)` — subscribe aux changements bonus
- [ ] 4.2 Recalcul des points quand un bonus est révélé
- [ ] 4.3 RollingNumber pour transitions de points
- [ ] 4.4 Indicateur "Mise à jour en direct"

### Task 5: Intégration dans StudentDashboard
- [ ] 5.1 Ajouter onglet conditionnel dans StudentDashboard.tsx
- [ ] 5.2 Routing interne selon l'état (test, attente, maison)
- [ ] 5.3 Cleanup des subscriptions Realtime au démontage

## Notes techniques
- Supabase Realtime utilise WebSocket — vérifier que le plan Supabase le supporte
- L'animation de reveal est LE moment clé (Aurélie révèle les bonus devant la classe entière)
- Polling de fallback si Realtime non disponible (toutes les 10s)
- Composants partagés avec le design system créé en 10-2
