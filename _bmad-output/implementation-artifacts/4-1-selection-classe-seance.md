# Story 4.1: Selection de classe pour une seance

Status: review

## Story

As an **enseignant**,
I want **selectionner une classe pour ma seance**,
So that **je puisse travailler avec le bon groupe d'eleves**.

## Acceptance Criteria

1. **AC1:** Given je suis connecte et j'ai des classes, When je demarre une nouvelle seance, Then la liste de mes classes s'affiche
2. **AC2:** Given la liste s'affiche, When je selectionne une classe, Then la classe est marquee comme selectionnee visuellement
3. **AC3:** Given je n'ai aucune classe, When je tente de demarrer une seance, Then un message m'invite a creer une classe d'abord

## Tasks / Subtasks

- [x] Task 1: Session Repository (AC: 1)
  - [x] 1.1 Verifier sessionRepository.ts existe avec createSession, getActiveSession
  - [x] 1.2 Verifier exports dans database/index.ts

- [x] Task 2: Session Store Zustand (AC: 1, 2)
  - [x] 2.1 Verifier sessionStore.ts avec startSession, loadActiveSession
  - [x] 2.2 Verifier exports dans stores/index.ts

- [x] Task 3: Ecran Start Session (AC: 1, 2, 3)
  - [x] 3.1 Ecran app/(main)/session/start.tsx avec liste classes
  - [x] 3.2 Selection visuelle de classe (border + background)
  - [x] 3.3 Message si aucune classe disponible
  - [x] 3.4 Lien pour creer une classe si liste vide

- [x] Task 4: Navigation (AC: 1)
  - [x] 4.1 Bouton "Demarrer une seance" sur ecran d'accueil
  - [x] 4.2 Navigation vers /session/start

- [x] Task 5: Tests
  - [x] 5.1 Test unitaire sessionRepository (9 tests)
  - [x] 5.2 Test unitaire sessionStore (9 tests)
  - [x] 5.3 Configuration Jest + ts-jest

## Dev Notes

### FR Couvert

- **FR1:** L'enseignant peut selectionner une classe parmi sa liste de classes

### NFRs Concernes

- **NFR5:** Temps de chargement plan < 500ms

### Context Implementation

Code existant valide:
- `services/database/sessionRepository.ts` - CRUD sessions complet
- `stores/sessionStore.ts` - State management avec startSession, endSession, addEvent
- `app/(main)/session/start.tsx` - Ecran demarrage avec selection classe/salle

### References

- [Source: epics.md#Story-4.1]
- [Architecture: architecture.md#Session-Management]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)
- Jest tests: 18/18 PASS (sessionRepository: 9, sessionStore: 9)

### Completion Notes List

1. **sessionRepository.ts** - CRUD complet: createSession, endSession, getActiveSession, getSessionsByUserId, getSessionsByClassId, deleteSession
2. **sessionStore.ts** - Zustand store avec startSession, endCurrentSession, loadActiveSession, addEvent, clearSession
3. **start.tsx** - Ecran selection classe/salle avec:
   - Liste des classes avec selection visuelle (border vert + background)
   - Empty state "Aucune classe disponible" avec lien creation
   - Liste des salles avec meme pattern
   - Bouton "Demarrer la seance" desactive sans selection
4. **Navigation** - Bouton sur ecran accueil + detection session active
5. **Tests unitaires** - Configuration Jest + ts-jest, 18 tests passent

### File List

**Database:**
- `services/database/sessionRepository.ts` - CRUD sessions
- `services/database/eventRepository.ts` - CRUD events
- `services/database/index.ts` - Exports

**Stores:**
- `stores/sessionStore.ts` - State management sessions/events
- `stores/index.ts` - Exports

**App:**
- `app/(main)/session/start.tsx` - Ecran demarrage seance
- `app/(main)/session/[id].tsx` - Ecran seance active
- `app/(main)/index.tsx` - Bouton demarrer/reprendre seance

**Tests:**
- `__tests__/stores/sessionStore.test.ts` - 9 tests
- `__tests__/services/database/sessionRepository.test.ts` - 9 tests
- `jest.config.js` - Configuration Jest
- `jest.setup.js` - Setup mocks Expo

**Config:**
- `package.json` - Scripts test, devDependencies Jest

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee depuis epics.md |
| 2026-02-04 | Code existant valide, tests crees (18/18 pass), story complete |
