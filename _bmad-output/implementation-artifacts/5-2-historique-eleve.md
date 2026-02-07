# Story 5.2: Historique d'un eleve specifique

Status: review

## Story

As an **enseignant**,
I want **consulter l'historique complet d'un eleve**,
So that **je puisse voir son comportement sur la duree**.

## Acceptance Criteria

1. **AC1:** Given j'ai un eleve avec des evenements enregistres, When je consulte son historique, Then je vois tous ses evenements
2. **AC2:** Chaque evenement affiche: type, date, seance associee
3. **AC3:** Je vois un resume (total participations, total bavardages, etc.)

## Tasks / Subtasks

- [x] Task 1: Navigation vers historique eleve
  - [x] 1.1 Depuis ecran classe, tap sur eleve navigue vers historique
  - [x] 1.2 Route app/(main)/students/[id]/history.tsx

- [x] Task 2: Ecran historique eleve
  - [x] 2.1 Charger events via loadStudentHistory (historyStore)
  - [x] 2.2 Afficher resume: compteurs par type (badges colores)
  - [x] 2.3 Liste des events avec date/heure/type/note

## Dev Notes

### FR Couvert

- **FR18:** L'enseignant peut consulter l'historique d'un eleve

### Implementation

- `app/(main)/students/[id]/history.tsx`: Ecran historique eleve
  - Carte info eleve avec avatar
  - Resume avec badges compteurs par type (5 types)
  - Liste chronologique des events (plus recents en premier)
- `app/(main)/classes/[id].tsx`: Navigation sur tap eleve -> historique
  - Chevron ajoute pour indiquer la navigation
  - Long press conserve pour retirer l'eleve

### References

- [Source: epics.md#Story-5.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- app/(main)/students/[id]/history.tsx (created)
- app/(main)/classes/[id].tsx (modified - navigation + chevron)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete - status: review |
