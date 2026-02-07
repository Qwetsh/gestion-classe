# Story 4.12: Sous-menu Sortie - Infirmerie, Toilettes, Convocation, Exclusion

Status: review

## Story

As an **enseignant**,
I want **enregistrer les differents types de sortie**,
So that **je puisse tracer precisement les mouvements d'eleves**.

## Acceptance Criteria

1. **AC1:** Given le sous-menu Sortie est ouvert, When je selectionne "Infirmerie", Then un evenement sortie_infirmerie est cree
2. **AC2:** Selection "Toilettes" cree evenement sortie_toilettes
3. **AC3:** Selection "Convocation" cree evenement convocation
4. **AC4:** Selection "Exclusion" cree evenement exclusion
5. **AC5:** Chaque selection declenche un feedback haptique success

## Tasks / Subtasks

- [x] Task 1: SubItems Configuration
  - [x] 1.1 SORTIE_SUBTYPES dans constants
  - [x] 1.2 subItems dans item sortie

- [x] Task 2: Selection Sous-menu
  - [x] 2.1 handleSelection gere menuState === 'submenu'
  - [x] 2.2 parentId inclus dans selection

- [x] Task 3: Creation Events
  - [x] 3.1 addEvent avec type 'sortie' et subtype
  - [x] 3.2 createEvent stocke subtype

## Dev Notes

### FR Couverts

- **FR13:** Sortie infirmerie
- **FR14:** Sortie toilettes
- **FR15:** Convocation
- **FR16:** Exclusion
- **FR17:** Feedback haptique

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
