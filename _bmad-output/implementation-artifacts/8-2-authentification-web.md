# Story 8.2: Authentification web

Status: review

## Story

As an **enseignant**,
I want **me connecter au dashboard avec mon compte existant**,
So that **je puisse acceder a mes donnees depuis un navigateur**.

## Acceptance Criteria

1. **AC1:** Given j'ai un compte cree via l'app mobile, When je me connecte sur le dashboard web, Then j'accede a mon espace personnel
2. **AC2:** Je vois les memes donnees que sur mobile (synchronisees)
3. **AC3:** Given je ne suis pas connecte, When j'accede au dashboard, Then je suis redirige vers la page de connexion

## Tasks / Subtasks

- [x] Task 1: Page de connexion
  - [x] 1.1 Formulaire email/password
  - [x] 1.2 Gestion des erreurs
  - [x] 1.3 Redirection apres connexion

- [x] Task 2: Protection des routes
  - [x] 2.1 Composant ProtectedRoute
  - [x] 2.2 Redirection vers login si non connecte

- [x] Task 3: Deconnexion
  - [x] 3.1 Bouton deconnexion dans le header
  - [x] 3.2 Retour a la page de login

## Dev Notes

### Implementation

- useAuth hook avec Supabase Auth
- ProtectedRoute wrapper pour les routes privees
- Session persistee via Supabase

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- src/pages/Login.tsx
- src/hooks/useAuth.ts
- src/components/ProtectedRoute.tsx

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee et implementee |
