# Story 4.10: Menu radial - Enregistrer une remarque

Status: review

## Story

As an **enseignant**,
I want **enregistrer une remarque libre via le menu radial**,
So that **je puisse noter une observation personnalisee**.

## Acceptance Criteria

1. **AC1:** Given le menu radial est ouvert, When je glisse vers "Remarque" et relache, Then un champ de saisie texte apparait
2. **AC2:** Je peux saisir ma remarque et valider
3. **AC3:** Un evenement remarque avec le texte est cree
4. **AC4:** Un feedback haptique success confirme l'action

## Tasks / Subtasks

- [x] Task 1: Selection Remarque
  - [x] 1.1 Item "remarque" dans MENU_ITEMS
  - [x] 1.2 handleSelection detecte item remarque

- [x] Task 2: Modal Saisie
  - [x] 2.1 showRemarqueModal = true dans [id].tsx
  - [x] 2.2 TextInput pour saisie remarque
  - [x] 2.3 Bouton valider/annuler

- [x] Task 3: Creation Event
  - [x] 3.1 addEvent(studentId, 'remarque', null, remarqueText)
  - [x] 3.2 createEvent avec note

## Dev Notes

### FR Couverts

- **FR11:** Enregistrer remarque libre
- **FR17:** Feedback haptique

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
