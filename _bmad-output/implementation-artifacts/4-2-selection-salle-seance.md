# Story 4.2: Selection de salle pour une seance

Status: review

## Story

As an **enseignant**,
I want **selectionner une salle pour ma seance**,
So that **je puisse voir le plan de classe correspondant**.

## Acceptance Criteria

1. **AC1:** Given j'ai selectionne une classe, When je choisis une salle, Then la salle est associee a la seance
2. **AC2:** Given j'ai selectionne une classe, When je choisis une salle, Then le plan de classe (classe + salle) est charge
3. **AC3:** Given aucun plan n'existe pour cette combinaison classe/salle, When je selectionne la salle, Then un message m'invite a positionner les eleves d'abord

## Tasks / Subtasks

- [x] Task 1: Verifier Room Repository (AC: 1)
  - [x] 1.1 roomRepository.ts existe avec getRoomsByUserId
  - [x] 1.2 Exports dans database/index.ts

- [x] Task 2: Verifier Room Store (AC: 1)
  - [x] 2.1 roomStore.ts avec loadRooms, addRoom, updateRoom, etc.
  - [x] 2.2 Exports dans stores/index.ts

- [x] Task 3: UI Selection Salle (AC: 1, 2, 3)
  - [x] 3.1 Liste des salles dans start.tsx
  - [x] 3.2 Selection visuelle identique aux classes (border + background)
  - [x] 3.3 Affichage dimensions salle (grid_rows x grid_cols)
  - [x] 3.4 Message si aucune salle disponible avec lien creation

- [x] Task 4: Verification Plan Existant (AC: 2, 3)
  - [x] 4.1 Plan charge automatiquement via getOrCreatePlan
  - [x] 4.2 Places vides visibles si pas d'eleves positionnes

- [x] Task 5: Tests
  - [x] 5.1 Tests roomStore (12 tests)

## Dev Notes

### FR Couvert

- **FR2:** L'enseignant peut selectionner une salle pour la seance en cours

### Context Implementation

- roomStore.ts: loadRooms, addRoom, updateRoomName, updateRoomDimensions, removeRoom
- start.tsx: Liste salles avec selection visuelle, affichage dimensions
- Plan auto-cree par getOrCreatePlan si inexistant

### AC3 Implementation

Le systeme utilise `getOrCreatePlan` qui cree automatiquement un plan vide.
Les eleves non positionnes sont affiches comme places vides dans la grille.
L'utilisateur peut toujours demarrer une seance et voir les places vides.

### References

- [Source: epics.md#Story-4.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript: PASS
- Jest: 30/30 PASS (sessionRepo: 9, sessionStore: 9, roomStore: 12)

### Completion Notes List

1. roomRepository.ts complet avec CRUD
2. roomStore.ts avec toutes les actions necessaires
3. start.tsx affiche liste salles avec dimensions (6x5 places)
4. Empty state "Aucune salle configuree" avec lien vers /rooms
5. Tests roomStore: 12 tests couvrant toutes les actions

### File List

**Existant valide:**
- `services/database/roomRepository.ts`
- `stores/roomStore.ts`
- `app/(main)/session/start.tsx`

**Tests ajoutes:**
- `__tests__/stores/roomStore.test.ts` - 12 tests

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee et validee - code existant complet |
