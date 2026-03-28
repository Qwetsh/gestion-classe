# Story 1.3: Connexion enseignant

Status: complete

## Story

As an **enseignant**,
I want **me connecter a mon compte existant**,
So that **je puisse acceder a mes donnees**.

## Acceptance Criteria

1. **AC1:** Given je suis sur l'ecran de connexion, When je saisis mes identifiants corrects, Then je suis authentifie et redirige vers l'ecran principal
2. **AC2:** Given je saisis des identifiants incorrects, When je soumets le formulaire, Then un message d'erreur s'affiche et je reste sur l'ecran de connexion
3. **AC3:** Given le formulaire est vide, When je soumets, Then un message de validation s'affiche

## Tasks / Subtasks

- [x] Task 1: Ecran de connexion (AC: 1, 2, 3)
  - [x] 1.1 Formulaire email/password dans app/(auth)/login.tsx
  - [x] 1.2 Validation cote client (email requis, password requis)
  - [x] 1.3 Appel signIn via authStore
  - [x] 1.4 Gestion erreurs Supabase (identifiants incorrects)
  - [x] 1.5 Redirection vers /(main) apres succes

- [x] Task 2: Auth Store (AC: 1, 2)
  - [x] 2.1 Action signIn dans authStore.ts
  - [x] 2.2 Appel supabaseSignIn
  - [x] 2.3 Mise a jour state (isAuthenticated, user, error)

- [x] Task 3: Navigation (AC: 1)
  - [x] 3.1 Lien vers inscription si pas de compte
  - [x] 3.2 Router.replace vers main apres login

## Dev Notes

### FR Couvert

- **FR35:** Un utilisateur peut se connecter a son compte

### Implementation

Code implemente dans:
- `app/(auth)/login.tsx` - Ecran connexion complet
- `stores/authStore.ts` - signIn action
- `services/supabase/auth.ts` - supabaseSignIn

### File List

- `app/(auth)/login.tsx`
- `stores/authStore.ts`
- `services/supabase/auth.ts`

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-03-07 | Story creee - code existant valide comme complete |
