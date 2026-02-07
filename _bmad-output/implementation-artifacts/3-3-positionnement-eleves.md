# Story 3.3: Positionnement des eleves sur le plan

Status: complete

## Story

As an **enseignant**,
I want **positionner mes eleves sur le plan d'une salle**,
So that **je puisse retrouver visuellement chaque eleve pendant la seance**.

## Acceptance Criteria

1. **AC1:** Selectionner un eleve et le placer sur une case libre
2. **AC2:** La place affiche le pseudonyme de l'eleve
3. **AC3:** Message si la place est deja occupee

## Tasks / Subtasks

- [x] Task 1: Repository (AC: 1, 2)
  - [x] 1.1 classRoomPlanRepository.ts avec gestion positions
  - [x] 1.2 Positions stockees en JSON {row-col: studentId}
  - [x] 1.3 setStudentPosition, getStudentAtPosition

- [x] Task 2: Store (AC: 1, 2, 3)
  - [x] 2.1 planStore.ts avec loadPlan, setStudentPosition
  - [x] 2.2 Export depuis stores/index.ts

- [x] Task 3: UI (AC: 1, 2, 3)
  - [x] 3.1 Editeur de plan app/(main)/plan/[classId]/[roomId].tsx
  - [x] 3.2 Liste des eleves non places en bas
  - [x] 3.3 Selection eleve puis clic sur case
  - [x] 3.4 Alert si case occupee

## Dev Notes

### Interaction

1. Selectionner un eleve dans la liste du bas
2. L'eleve est surligne, les cases libres deviennent cliquables
3. Cliquer sur une case pour y placer l'eleve
4. L'eleve disparait de la liste et apparait sur le plan

### FR Couvert

- **FR25:** Positionner les eleves sur le plan d'une salle

### References

- [Source: epics.md#Story-3.3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Positions stockees en JSON dans class_room_plans
2. Interface intuitive: selection puis placement
3. Indication visuelle des cases disponibles
4. Compteur eleves places / total

### File List

**Database:**
- `services/database/classRoomPlanRepository.ts` - Gestion positions
- `services/database/index.ts` - Exports

**Stores:**
- `stores/planStore.ts` - State management plan
- `stores/index.ts` - Export

**App:**
- `app/(main)/plan/[classId]/[roomId].tsx` - Editeur de plan
- `app/(main)/classes/[id].tsx` - Lien vers plan par salle

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story implementee et completee |
