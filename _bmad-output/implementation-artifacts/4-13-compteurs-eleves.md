# Story 4.13: Compteurs visibles par eleve

Status: review

## Story

As an **enseignant**,
I want **voir les compteurs de participations et bavardages de chaque eleve**,
So that **je puisse suivre leur comportement pendant la seance**.

## Acceptance Criteria

1. **AC1:** Given une seance est active, When je regarde le plan de classe, Then chaque eleve affiche ses compteurs (ex: "+3 / -1")
2. **AC2:** Les compteurs se mettent a jour instantanement apres chaque action

## Tasks / Subtasks

- [x] Task 1: Affichage Compteurs
  - [x] 1.1 eventCountsByStudent dans sessionStore
  - [x] 1.2 Affichage +X / -Y sur cellule eleve

- [x] Task 2: Mise a jour Instantanee
  - [x] 2.1 addEvent met a jour compteurs dans store
  - [x] 2.2 Re-render automatique via Zustand

## Dev Notes

### FR Couvert

- **FR20:** Compteur participations/bavardages visible par eleve

### Implementation

- eventCountsByStudent: Record<studentId, { participation, bavardage, absence, remarque, sortie }>
- addEvent incremente immediatement apres creation event
- Cellule eleve affiche: `+${participation} / -${bavardage}`

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
