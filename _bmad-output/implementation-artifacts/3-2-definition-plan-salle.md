# Story 3.2: Definition du plan de salle (grille)

Status: complete

## Story

As an **enseignant**,
I want **definir la disposition des places dans une salle**,
So that **je puisse representer l'agencement reel de ma classe**.

## Acceptance Criteria

1. **AC1:** Definition d'une grille (rangees x colonnes)
2. **AC2:** Apercu visuel du plan
3. **AC3:** Modification des dimensions existantes

## Tasks / Subtasks

- [x] Task 1: Repository (AC: 1, 3)
  - [x] 1.1 updateRoomGrid dans roomRepository.ts
  - [x] 1.2 Valeurs par defaut: 6 rangees x 5 colonnes

- [x] Task 2: Store (AC: 1, 3)
  - [x] 2.1 updateRoomDimensions action dans roomStore

- [x] Task 3: UI (AC: 1, 2, 3)
  - [x] 3.1 Ecran detail salle app/(main)/rooms/[id].tsx
  - [x] 3.2 Apercu visuel de la grille
  - [x] 3.3 Modal modification dimensions
  - [x] 3.4 Validation dimensions (1-10)

## Dev Notes

### FR Couvert

- **FR24:** Definir le plan d'une salle (disposition des places)

### References

- [Source: epics.md#Story-3.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Grille par defaut 6x5 (typique salle de classe)
2. Dimensions modifiables entre 1 et 10
3. Apercu visuel avec zone "Tableau" en haut
4. Modal pour modifier rangees/colonnes

### File List

**Database:**
- `services/database/roomRepository.ts` - updateRoomGrid

**Stores:**
- `stores/roomStore.ts` - updateRoomDimensions

**App:**
- `app/(main)/rooms/[id].tsx` - Detail salle avec apercu grille

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story implementee et completee |
