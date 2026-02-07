# Story 4.9: Menu radial - Enregistrer une absence

Status: review

## Story

As an **enseignant**,
I want **enregistrer une absence via le menu radial**,
So that **je puisse noter qu'un eleve est absent**.

## Acceptance Criteria

1. **AC1:** Given le menu radial est ouvert, When je glisse vers "Absence" et relache, Then un evenement absence est cree
2. **AC2:** L'eleve est visuellement marque comme absent sur le plan
3. **AC3:** Un feedback haptique success confirme l'action

## Tasks / Subtasks

- [x] Task 1: Selection Absence
  - [x] 1.1 Item "absence" dans MENU_ITEMS
  - [x] 1.2 handleSelection detecte item absence

- [x] Task 2: Creation Event
  - [x] 2.1 addEvent(studentId, 'absence')
  - [x] 2.2 createEvent avec type absence

- [x] Task 3: Marquage Visuel (optionnel MVP)
  - [x] 3.1 Compteur absence affiche si > 0

## Dev Notes

### FR Couverts

- **FR10:** Enregistrer absence
- **FR17:** Feedback haptique

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
