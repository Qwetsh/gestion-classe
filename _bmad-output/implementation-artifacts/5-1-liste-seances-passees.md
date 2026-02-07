# Story 5.1: Liste des seances passees

Status: review

## Story

As an **enseignant**,
I want **consulter la liste de mes seances passees**,
So that **je puisse retrouver une seance specifique**.

## Acceptance Criteria

1. **AC1:** Given j'ai effectue des seances, When j'accede a l'historique des seances, Then je vois la liste de toutes mes seances
2. **AC2:** Chaque seance affiche: date, classe, salle, duree
3. **AC3:** Les seances sont triees par date decroissante (plus recentes en haut)
4. **AC4:** Given je n'ai aucune seance, When j'accede a l'historique, Then un message m'indique qu'il n'y a pas encore de seances

## Tasks / Subtasks

- [x] Task 1: Repository (AC: 1, 3)
  - [x] 1.1 getSessionsByUserId existe dans sessionRepository
  - [x] 1.2 Tri par started_at DESC

- [x] Task 2: Store (AC: 1)
  - [x] 2.1 Creer historyStore avec loadSessionHistory
  - [x] 2.2 State sessions: Session[]

- [x] Task 3: Ecran Historique (AC: 1, 2, 3, 4)
  - [x] 3.1 Creer app/(main)/history/index.tsx
  - [x] 3.2 FlatList des seances
  - [x] 3.3 Afficher date, classe, salle, duree
  - [x] 3.4 Empty state si aucune seance

- [x] Task 4: Navigation
  - [x] 4.1 Lien depuis ecran accueil (bouton "Historique des seances")
  - [x] 4.2 Navigation vers detail seance (app/(main)/history/[id].tsx)

## Dev Notes

### FR Couvert

- **FR6:** L'enseignant peut consulter la liste des seances passees

### Implementation

- `stores/historyStore.ts`: Nouveau store dedie a l'historique
  - loadSessionHistory(userId): Charge les seances terminees
  - loadSessionsByClass(classId): Charge par classe
  - loadSessionDetail(sessionId): Charge une seance + ses events
  - loadStudentHistory(studentId): Charge les events d'un eleve
- `app/(main)/history/index.tsx`: Liste des seances passees
- `app/(main)/history/[id].tsx`: Detail d'une seance avec resume et events
- Bouton "Historique des seances" ajoute sur l'ecran d'accueil

### References

- [Source: epics.md#Story-5.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- stores/historyStore.ts (created)
- stores/index.ts (modified - export historyStore)
- app/(main)/history/index.tsx (created)
- app/(main)/history/[id].tsx (created)
- app/(main)/index.tsx (modified - bouton historique)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete - status: review |
