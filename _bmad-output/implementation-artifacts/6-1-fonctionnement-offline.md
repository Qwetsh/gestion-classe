# Story 6.1: Fonctionnement offline complet

Status: review

## Story

As an **enseignant**,
I want **utiliser toutes les fonctionnalites de l'app sans connexion internet**,
So that **je puisse travailler meme dans des zones sans reseau**.

## Acceptance Criteria

1. **AC1:** Given je suis connecte et je perds la connexion internet, When j'utilise l'application, Then toutes les fonctionnalites restent disponibles
2. **AC2:** Aucune erreur reseau n'est affichee a l'utilisateur
3. **AC3:** Un indicateur discret montre le mode offline
4. **AC4:** Given je lance l'app sans connexion (apres une premiere connexion), When j'utilise l'application, Then je peux creer des seances et enregistrer des actions normalement

## Tasks / Subtasks

- [x] Task 1: Detection statut reseau
  - [x] 1.1 Installer @react-native-community/netinfo
  - [x] 1.2 Creer store networkStore
  - [x] 1.3 Hook useIsOffline

- [x] Task 2: Indicateur offline
  - [x] 2.1 Composant OfflineIndicator
  - [x] 2.2 Ajouter dans _layout.tsx principal

- [x] Task 3: Architecture offline-first
  - [x] 3.1 Toutes les donnees stockees localement (SQLite) - deja fait
  - [x] 3.2 Aucune fonctionnalite ne depend du reseau - deja fait

## Dev Notes

### FR Couvert

- **FR29:** L'enseignant peut utiliser l'app sans connexion
- **NFR16:** Offline complet

### Implementation

- `stores/networkStore.ts`: Detection statut reseau via NetInfo
  - isConnected, isInternetReachable, connectionType
  - initialize() pour demarrer l'ecoute
  - useIsOffline() hook de commodite
- `components/OfflineIndicator.tsx`: Bandeau discret en haut
  - Animation fade in/out
  - Affiche "Mode hors-ligne" quand offline
- `app/_layout.tsx`: Initialisation reseau + OfflineIndicator

### References

- [Source: epics.md#Story-6.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- stores/networkStore.ts (created)
- stores/index.ts (export networkStore)
- components/OfflineIndicator.tsx (created)
- components/index.ts (export OfflineIndicator)
- app/_layout.tsx (modified - network init + indicator)
- package.json (@react-native-community/netinfo)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete - status: review |
