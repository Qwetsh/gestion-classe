# Story 8.3: Consultation des classes et eleves

Status: review

## Story

As an **enseignant**,
I want **consulter mes classes et eleves sur le web**,
So that **je puisse voir mes donnees sur grand ecran**.

## Acceptance Criteria

1. **AC1:** Given je suis connecte au dashboard, When j'accede a la section "Classes", Then je vois la liste de toutes mes classes
2. **AC2:** Je peux voir les eleves de chaque classe (pseudonymes)
3. **AC3:** Le contraste respecte WCAG AA (NFR18)

## Tasks / Subtasks

- [x] Task 1: Page Classes
  - [x] 1.1 Liste des classes avec compteur d'eleves
  - [x] 1.2 Selection d'une classe

- [x] Task 2: Panel Eleves
  - [x] 2.1 Liste des eleves de la classe selectionnee
  - [x] 2.2 Affichage du pseudo

- [x] Task 3: Accessibilite
  - [x] 3.1 Contraste suffisant (couleurs du theme)
  - [x] 3.2 Navigation au clavier

## Dev Notes

### Implementation

- Layout split: liste classes / panel eleves
- Chargement des eleves au clic sur une classe
- Pseudos affiches (pas de donnees personnelles)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- src/pages/Classes.tsx

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee et implementee |
