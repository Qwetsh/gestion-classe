# Story 2.5: Retrait d'un eleve d'une classe

Status: complete

## Story

As an **enseignant**,
I want **retirer un eleve d'une classe**,
So that **je puisse gerer les departs en cours d'annee**.

## Acceptance Criteria

1. **AC1:** L'enseignant peut retirer un eleve de la classe ✅
2. **AC2:** L'eleve n'apparait plus dans cette classe ✅
3. **AC3:** Les donnees historiques sont conservees ✅ (soft delete)
4. **AC4:** Une confirmation est demandee avant retrait ✅

## Tasks / Subtasks

- [x] Task 1: UI de retrait (AC: 1, 2, 4)
  - [x] 1.1 Long press sur un eleve pour retirer
  - [x] 1.2 Alert de confirmation avec message explicite

- [x] Task 2: Verification (AC: 3)
  - [x] 2.1 Soft delete (is_deleted flag) - deja implemente
  - [x] 2.2 Donnees conservees pour historique futur

## Dev Notes

### Interaction

- Maintenir appuye 500ms sur un eleve pour voir le dialog de confirmation
- Texte "Maintenir pour retirer" visible a droite de chaque eleve

### FR Couvert

- **FR28:** Ajouter / retirer des eleves d'une classe (partie retrait)

### References

- [Source: epics.md#Story-2.5]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Long press (500ms) sur eleve pour declencher retrait
2. Alert de confirmation avec nom de l'eleve
3. Soft delete via removeStudent existant
4. Hint visuel "Maintenir pour retirer" sur chaque ligne
5. Feedback visuel au press (pressed state)

### File List

**App:**
- `app/(main)/classes/[id].tsx` - Long press + confirmation alert

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story demarree |
| 2026-02-03 | Story implementee et completee |
