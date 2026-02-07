# Story 8.4: Consultation des seances et historiques

Status: review

## Story

As an **enseignant**,
I want **consulter l'historique des seances sur le web**,
So that **je puisse analyser les donnees sur un ecran confortable**.

## Acceptance Criteria

1. **AC1:** Given je suis connecte au dashboard, When j'accede a la section "Seances", Then je vois la liste de toutes mes seances synchronisees
2. **AC2:** Je peux consulter le detail d'une seance (evenements horodates)
3. **AC3:** Je peux filtrer par classe

## Tasks / Subtasks

- [x] Task 1: Page Seances
  - [x] 1.1 Liste des seances avec stats (participations, bavardages)
  - [x] 1.2 Filtres par classe
  - [x] 1.3 Lien vers detail

- [x] Task 2: Page Detail Seance
  - [x] 2.1 Resume avec totaux par type
  - [x] 2.2 Liste des evenements horodates
  - [x] 2.3 Affichage pseudo eleve et type d'action

## Dev Notes

### Implementation

- Liste avec chips de filtre par classe
- Detail avec timeline des evenements
- Badges colores par type d'evenement

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- src/pages/Sessions.tsx
- src/pages/SessionDetail.tsx

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee et implementee |
