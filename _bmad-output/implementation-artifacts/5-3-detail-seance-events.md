# Story 5.3: Detail d'une seance avec evenements horodates

Status: review

## Story

As an **enseignant**,
I want **voir le detail d'une seance passee avec tous les evenements**,
So that **je puisse revoir ce qui s'est passe pendant le cours**.

## Acceptance Criteria

1. **AC1:** Given j'ai une seance terminee, When je consulte son detail, Then je vois tous les evenements de la seance
2. **AC2:** Chaque evenement affiche: heure exacte, eleve concerne, type d'action
3. **AC3:** Les evenements sont tries chronologiquement

## Tasks / Subtasks

- [x] Task 1: Store (AC: 1)
  - [x] 1.1 loadSessionDetail dans historyStore
  - [x] 1.2 sessionEvents: Event[]

- [x] Task 2: Ecran Detail Seance (AC: 1, 2, 3)
  - [x] 2.1 Creer app/(main)/history/[id].tsx
  - [x] 2.2 Afficher info seance (date, classe, salle, duree)
  - [x] 2.3 Liste events avec heure/eleve/type
  - [x] 2.4 Resume des totaux par type

## Dev Notes

### FR Couvert

- **FR19:** L'enseignant peut voir le detail d'une seance passee

### Implementation

- `app/(main)/history/[id].tsx` affiche:
  - Carte info seance (date, classe, salle, duree)
  - Resume avec badges compteurs par type
  - Liste chronologique des events avec heure/eleve/type/note/subtype

### References

- [Source: epics.md#Story-5.3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- stores/historyStore.ts (loadSessionDetail)
- app/(main)/history/[id].tsx (created)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete - status: review |
