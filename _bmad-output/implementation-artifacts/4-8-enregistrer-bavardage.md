# Story 4.8: Menu radial - Enregistrer un bavardage

Status: review

## Story

As an **enseignant**,
I want **enregistrer un bavardage via le menu radial**,
So that **je puisse noter qu'un eleve a bavarde**.

## Acceptance Criteria

1. **AC1:** Given le menu radial est ouvert, When je glisse vers "Bavardage" et relache, Then un evenement bavardage (-1) est cree
2. **AC2:** Le compteur de bavardages de l'eleve s'incremente
3. **AC3:** Un feedback haptique success confirme l'action

## Tasks / Subtasks

- [x] Task 1: Selection Bavardage
  - [x] 1.1 Item "bavardage" dans MENU_ITEMS
  - [x] 1.2 handleSelection detecte item bavardage

- [x] Task 2: Creation Event
  - [x] 2.1 addEvent(studentId, 'bavardage')
  - [x] 2.2 createEvent avec type bavardage

- [x] Task 3: Compteur
  - [x] 3.1 eventCountsByStudent[studentId].bavardage++

## Dev Notes

### FR Couverts

- **FR9:** Enregistrer bavardage (-1)
- **FR17:** Feedback haptique
- **FR20:** Compteur bavardages visible

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
