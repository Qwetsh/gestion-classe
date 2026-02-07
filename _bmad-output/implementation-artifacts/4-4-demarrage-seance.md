# Story 4.4: Demarrage d'une seance

Status: review

## Story

As an **enseignant**,
I want **demarrer officiellement une seance**,
So that **les actions soient horodatees et enregistrees**.

## Acceptance Criteria

1. **AC1:** Given j'ai selectionne classe et salle, When j'appuie sur "Demarrer la seance", Then une nouvelle seance est creee avec timestamp de debut
2. **AC2:** After demarrage, je suis sur l'ecran de seance active
3. **AC3:** After demarrage, je peux commencer a enregistrer des actions

## Tasks / Subtasks

- [x] Task 1: Bouton Demarrer (AC: 1)
  - [x] 1.1 Bouton dans start.tsx
  - [x] 1.2 Desactive si classe ou salle non selectionnee
  - [x] 1.3 Affiche ActivityIndicator pendant creation

- [x] Task 2: Creation Session (AC: 1)
  - [x] 2.1 sessionStore.startSession(userId, classId, roomId)
  - [x] 2.2 createSession dans sessionRepository avec timestamp

- [x] Task 3: Navigation (AC: 2)
  - [x] 3.1 router.replace vers /session/[id] apres creation

- [x] Task 4: Etat Seance Active (AC: 3)
  - [x] 4.1 isSessionActive = true dans store
  - [x] 4.2 activeSession disponible pour enregistrer events

## Dev Notes

### FR Couvert

- **FR4:** L'enseignant peut demarrer une nouvelle seance pour une classe/salle

### Implementation

- start.tsx: handleStartSession appelle startSession puis navigue
- sessionStore: startSession cree session et met a jour state
- sessionRepository: createSession insere en DB avec timestamp

### References

- [Source: epics.md#Story-4.4]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Tests sessionStore: startSession teste (9 tests pass)

### Completion Notes List

1. Bouton "Demarrer la seance" avec etat disabled
2. startSession cree session avec timestamp ISO
3. Navigation vers ecran seance active
4. State isSessionActive permet enregistrement events

### File List

- `app/(main)/session/start.tsx` - Bouton + handleStartSession
- `stores/sessionStore.ts` - startSession action
- `services/database/sessionRepository.ts` - createSession

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
