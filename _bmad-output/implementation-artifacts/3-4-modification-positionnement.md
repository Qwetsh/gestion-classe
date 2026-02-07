# Story 3.4: Modification du positionnement

Status: complete

## Story

As an **enseignant**,
I want **modifier le positionnement des eleves**,
So that **je puisse reorganiser ma classe en cours d'annee**.

## Acceptance Criteria

1. **AC1:** Deplacer un eleve vers une autre place
2. **AC2:** L'ancienne place devient libre
3. **AC3:** Retirer un eleve du plan

## Tasks / Subtasks

- [x] Task 1: Repository (AC: 1, 2, 3)
  - [x] 1.1 removeStudentFromPlan dans classRoomPlanRepository
  - [x] 1.2 clearPositions pour reinitialiser

- [x] Task 2: Store (AC: 1, 2, 3)
  - [x] 2.1 removeStudentFromPlan action dans planStore
  - [x] 2.2 clearAllPositions action

- [x] Task 3: UI (AC: 1, 2, 3)
  - [x] 3.1 Clic sur eleve place = dialog retirer
  - [x] 3.2 Bouton "Reinitialiser" en header
  - [x] 3.3 L'eleve retourne dans la liste non places

## Dev Notes

### Interaction

- Cliquer sur une case occupee affiche un dialog:
  - Nom de l'eleve
  - Bouton "Retirer" pour liberer la place
- Bouton "Reinitialiser" remet tous les eleves dans la liste

### FR Couvert

- **FR26:** Modifier le positionnement des eleves

### References

- [Source: epics.md#Story-3.4]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Dialog de confirmation pour retrait
2. Reinitialisation complete du plan
3. Retour automatique dans la liste non places
4. Persistance immediate des changements

### File List

**Database:**
- `services/database/classRoomPlanRepository.ts` - removeStudentFromPlan, clearPositions

**Stores:**
- `stores/planStore.ts` - removeStudentFromPlan, clearAllPositions

**App:**
- `app/(main)/plan/[classId]/[roomId].tsx` - Interactions modification

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story implementee et completee |
