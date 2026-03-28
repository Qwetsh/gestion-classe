# Story 1.5: Deconnexion enseignant

Status: complete

## Story

As an **enseignant**,
I want **me deconnecter de mon compte**,
So that **je puisse securiser mes donnees si je partage mon appareil**.

## Acceptance Criteria

1. **AC1:** Given je suis connecte, When j'appuie sur le bouton de deconnexion, Then ma session est terminee
2. **AC2:** Given je me deconnecte, When la deconnexion est complete, Then mes tokens sont supprimes du SecureStore
3. **AC3:** Given je me deconnecte, When la deconnexion est complete, Then je suis redirige vers l'ecran de connexion

## Tasks / Subtasks

- [x] Task 1: Bouton deconnexion (AC: 1, 3)
  - [x] 1.1 Bouton logout dans app/(main)/index.tsx
  - [x] 1.2 Appel handleLogout -> signOut
  - [x] 1.3 Redirection vers /(auth)/login

- [x] Task 2: Auth Store (AC: 1, 2)
  - [x] 2.1 Action signOut dans authStore.ts
  - [x] 2.2 Appel supabaseSignOut (supprime tokens SecureStore)
  - [x] 2.3 Reset state (isAuthenticated: false, user: null)

- [x] Task 3: Supabase Auth Service (AC: 2)
  - [x] 3.1 Fonction signOut dans services/supabase/auth.ts
  - [x] 3.2 Appel supabase.auth.signOut()

## Dev Notes

### FR Couvert

- **FR36:** Un utilisateur peut se deconnecter

### Implementation

Code implemente dans:
- `app/(main)/index.tsx` - handleLogout avec bouton
- `stores/authStore.ts` - signOut action
- `services/supabase/auth.ts` - supabaseSignOut

### File List

- `app/(main)/index.tsx`
- `stores/authStore.ts`
- `services/supabase/auth.ts`

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-03-07 | Story creee - code existant valide comme complete |
