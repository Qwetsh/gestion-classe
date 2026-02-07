# Story 4.3: Affichage du plan de classe en seance

Status: review

## Story

As an **enseignant**,
I want **voir le plan de classe avec mes eleves positionnes**,
So that **je puisse identifier rapidement chaque eleve**.

## Acceptance Criteria

1. **AC1:** Given j'ai selectionne classe et salle avec un plan existant, When le plan s'affiche, Then chaque eleve est visible a sa position avec son pseudonyme
2. **AC2:** Le chargement prend moins de 500ms (NFR5)
3. **AC3:** Les zones tactiles font minimum 44x44 pixels (NFR17)

## Tasks / Subtasks

- [x] Task 1: Charger le plan (AC: 1, 2)
  - [x] 1.1 planStore.loadPlan charge le plan classe/salle
  - [x] 1.2 getOrCreatePlan dans planRepository

- [x] Task 2: Affichage grille (AC: 1, 3)
  - [x] 2.1 Grille dans [id].tsx avec dimensions room
  - [x] 2.2 Cellules avec pseudonyme eleve si positionne
  - [x] 2.3 Cellules vides si pas d'eleve
  - [x] 2.4 Taille minimum 44x44px respectee

- [x] Task 3: Performance (AC: 2)
  - [x] 3.1 Chargement async des donnees
  - [x] 3.2 ActivityIndicator pendant chargement

## Dev Notes

### FR Couvert

- **FR3:** L'enseignant peut voir le plan de classe avec les eleves positionnes

### NFRs Concernes

- **NFR5:** Temps de chargement plan < 500ms
- **NFR17:** Taille minimale zones tactiles 44x44 pixels

### Implementation

- `app/(main)/session/[id].tsx` affiche la grille
- Utilise `currentRoom.grid_rows` x `currentRoom.grid_cols`
- Positions eleves depuis `currentPlan.positions`
- Cellules calculees pour remplir l'ecran avec min 44x44px

### References

- [Source: epics.md#Story-4.3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Code existant valide dans [id].tsx

### Completion Notes List

1. Plan charge via loadPlan(classId, roomId)
2. Grille generee depuis dimensions salle
3. Eleves affiches avec pseudo ou cellule vide
4. Minimum 44x44px respecte via calcul dynamique

### File List

- `app/(main)/session/[id].tsx` - Ecran seance avec grille
- `stores/planStore.ts` - loadPlan
- `services/database/planRepository.ts` - getOrCreatePlan

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
