# Story 4.11: Menu radial - Sous-menu Sortie

Status: review

## Story

As an **enseignant**,
I want **acceder au sous-menu Sortie**,
So that **je puisse enregistrer differents types de sorties**.

## Acceptance Criteria

1. **AC1:** Given le menu radial est ouvert, When je survole "Sortie" pendant 300ms, Then le sous-menu s'ouvre avec 4 options
2. **AC2:** L'animation est fluide a 60 FPS (NFR2)
3. **AC3:** Un feedback haptique light confirme l'ouverture du sous-menu

## Tasks / Subtasks

- [x] Task 1: Item Sortie avec SubItems
  - [x] 1.1 MENU_ITEMS inclut sortie avec subItems
  - [x] 1.2 4 sous-items: infirmerie, toilettes, convocation, exclusion

- [x] Task 2: Detection Survol
  - [x] 2.1 SUBMENU_HOVER_DELAY = 300ms
  - [x] 2.2 submenuTimeoutRef pour delai

- [x] Task 3: Ouverture Sous-menu
  - [x] 3.1 openSubmenu(item) dans useRadialMenu
  - [x] 3.2 Animation submenuScale + submenuOpacity
  - [x] 3.3 triggerLightFeedback()

## Dev Notes

### FR Couvert

- **FR12:** Acceder sous-menu Sortie

### NFRs Concernes

- **NFR2:** Frame rate 60 FPS (animations natives)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
