# Story 8.1: Initialisation du projet web

Status: review

## Story

As a **developpeur**,
I want **un projet web configure avec Vite et React**,
So that **je puisse developper le dashboard**.

## Acceptance Criteria

1. **AC1:** Given aucun projet web n'existe, When j'initialise le projet, Then un projet Vite + React + TypeScript est cree
2. **AC2:** React Router est configure pour la navigation
3. **AC3:** Le client Supabase est configure
4. **AC4:** Le projet demarre sans erreur

## Tasks / Subtasks

- [x] Task 1: Creation du projet
  - [x] 1.1 npm create vite avec template react-ts
  - [x] 1.2 Installation des dependances

- [x] Task 2: Configuration
  - [x] 2.1 TailwindCSS v4 avec @tailwindcss/vite
  - [x] 2.2 React Router DOM
  - [x] 2.3 Client Supabase

- [x] Task 3: Structure
  - [x] 3.1 Dossiers src/pages, src/components, src/hooks, src/lib
  - [x] 3.2 Theme CSS correspondant a l'app mobile

## Dev Notes

### Stack technique

- Vite 6.x
- React 18
- TypeScript
- TailwindCSS v4
- React Router DOM
- @supabase/supabase-js

### Fichiers crees

- gestion-classe-web/ (nouveau projet)
- src/lib/supabase.ts - Client Supabase
- src/hooks/useAuth.ts - Hook d'authentification
- src/components/Layout.tsx - Layout avec navigation
- src/components/ProtectedRoute.tsx - Route protegee

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- gestion-classe-web/ (nouveau projet complet)
- vite.config.ts (Tailwind plugin)
- src/index.css (Tailwind + theme)
- src/App.tsx (Router setup)
- src/lib/supabase.ts
- src/hooks/useAuth.ts
- src/components/Layout.tsx
- src/components/ProtectedRoute.tsx

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee et implementee |
