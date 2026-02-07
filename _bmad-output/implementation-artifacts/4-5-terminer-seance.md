# Story 4.5: Terminer une seance

Status: review

## Story

As an **enseignant**,
I want **terminer une seance en cours**,
So that **les donnees soient finalisees et pretes pour consultation**.

## Acceptance Criteria

1. **AC1:** Given une seance est en cours, When j'appuie sur "Terminer la seance", Then le timestamp de fin est enregistre
2. **AC2:** After terminer, la seance passe en statut "terminee"
3. **AC3:** After terminer, je suis redirige vers l'ecran d'accueil

## Tasks / Subtasks

- [x] Task 1: Bouton Terminer (AC: 1)
  - [x] 1.1 Bouton dans [id].tsx header
  - [x] 1.2 Appelle endCurrentSession

- [x] Task 2: Fin Session (AC: 1, 2)
  - [x] 2.1 sessionStore.endCurrentSession()
  - [x] 2.2 endSession dans repository met ended_at

- [x] Task 3: Navigation (AC: 3)
  - [x] 3.1 router.replace vers accueil apres fin

- [x] Task 4: Reset State (AC: 2)
  - [x] 4.1 isSessionActive = false
  - [x] 4.2 activeSession = null
  - [x] 4.3 events et counts reinitialises

## Dev Notes

### FR Couvert

- **FR5:** L'enseignant peut terminer une seance en cours

### Implementation

- [id].tsx: handleEndSession dans header
- sessionStore: endCurrentSession appelle endSession puis reset
- sessionRepository: endSession UPDATE ended_at

### References

- [Source: epics.md#Story-4.5]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Tests sessionStore: endCurrentSession teste

### Completion Notes List

1. Bouton "Terminer" dans header ecran seance
2. endSession met timestamp ended_at
3. Navigation retour accueil
4. State completement reset

### File List

- `app/(main)/session/[id].tsx` - Bouton terminer + handler
- `stores/sessionStore.ts` - endCurrentSession action
- `services/database/sessionRepository.ts` - endSession

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
