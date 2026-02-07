# Story 4.6: Menu radial - Declenchement par long-press

Status: review

## Story

As an **enseignant**,
I want **declencher le menu radial en maintenant appuye sur un eleve**,
So that **je puisse acceder rapidement aux actions**.

## Acceptance Criteria

1. **AC1:** Given une seance est active et je vois le plan, When je maintiens appuye sur un eleve pendant 400ms, Then le menu radial apparait centre sur l'eleve
2. **AC2:** L'apparition prend moins de 100ms (NFR1)
3. **AC3:** Un feedback haptique medium confirme l'ouverture
4. **AC4:** Given j'appuie brievement (< 400ms), When je relache, Then le menu ne s'ouvre pas

## Tasks / Subtasks

- [x] Task 1: Detection Long Press (AC: 1, 4)
  - [x] 1.1 onTouchStart sur chaque cellule eleve
  - [x] 1.2 Timer 400ms pour declenchement
  - [x] 1.3 Annulation si onTouchEnd avant timer
  - [x] 1.4 Annulation si mouvement > 20px

- [x] Task 2: Cercle de Progression (AC: 1)
  - [x] 2.1 ProgressCircle component avec animation
  - [x] 2.2 Affiche pendant les 400ms d'attente
  - [x] 2.3 Position au doigt (coordonnees container)

- [x] Task 3: Ouverture Menu (AC: 1, 2)
  - [x] 3.1 RadialMenu component depuis prototype
  - [x] 3.2 openMenu(x, y) apres timer
  - [x] 3.3 Animation apparition < 100ms

- [x] Task 4: Feedback Haptique (AC: 3)
  - [x] 4.1 triggerMediumFeedback() dans useRadialMenu.openMenu()
  - [x] 4.2 triggerLightFeedback() au survol items
  - [x] 4.3 triggerSuccessFeedback() a la selection

- [x] Task 5: Conversion Coordonnees (BUG FIX)
  - [x] 5.1 containerRef + onLayout dans [id].tsx
  - [x] 5.2 toContainerCoords() pour conversion pageX/pageY
  - [x] 5.3 A tester sur device reel

## Dev Notes

### FR Couvert

- **FR7:** L'enseignant peut declencher le menu radial via long-press sur un eleve

### NFRs Concernes

- **NFR1:** Latence apparition menu radial < 100ms

### BUG CONNU

Le menu radial ne s'affichait pas au bon endroit car:
1. pageX/pageY sont des coordonnees ecran
2. Les composants sont positionnes dans contentWrapper (sous le header)
3. Fix: containerRef + onLayout + toContainerCoords()

### Implementation

- [id].tsx: onTouchStart/Move/End sur cellules
- ProgressCircle: cercle anime pendant long press
- RadialMenu: composant depuis prototype valide
- useRadialMenu: hook pour gestion etat menu

### References

- [Source: epics.md#Story-4.6]
- [Prototype: gestion-classe-proto/components/RadialMenu.tsx]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript: PASS
- Bug fix: conversion coordonnees implementee

### Completion Notes List

1. Touch events sur chaque cellule
2. Timer 400ms avec annulation
3. ProgressCircle anime
4. RadialMenu positionne (fix coordonnees)
5. A TESTER: haptics sur device

### File List

- `app/(main)/session/[id].tsx` - Touch handlers + ProgressCircle
- `components/radial/RadialMenu.tsx` - Menu radial
- `hooks/useRadialMenu.ts` - State management menu

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Fix coordonnees: containerRef + toContainerCoords |
