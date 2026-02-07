# Story 1.2: Inscription enseignant

Status: complete

## Story

As an **enseignant**,
I want **creer un compte avec mon email et un mot de passe**,
So that **je puisse acceder a mon espace personnel**.

## Acceptance Criteria

1. **AC1:** L'ecran d'inscription affiche un formulaire avec email et mot de passe ✅
2. **AC2:** Le mot de passe doit faire minimum 8 caracteres (validation) ✅
3. **AC3:** Le compte est cree dans Supabase Auth apres soumission valide ✅
4. **AC4:** L'utilisateur est redirige vers l'ecran principal apres inscription ✅
5. **AC5:** Un message d'erreur s'affiche si l'email existe deja ✅
6. **AC6:** Un message d'erreur s'affiche si le format email est invalide ✅

## Tasks / Subtasks

- [x] Task 1: Configurer le client Supabase (AC: 3)
  - [x] 1.1 Installer @supabase/supabase-js
  - [x] 1.2 Creer `services/supabase/client.ts` avec configuration
  - [x] 1.3 Configurer SecureStore pour persistence des tokens

- [x] Task 2: Creer le service d'authentification (AC: 3, 5, 6)
  - [x] 2.1 Creer `services/supabase/auth.ts` avec fonctions signUp, signIn, signOut
  - [x] 2.2 Implementer la gestion d'erreurs avec messages en francais

- [x] Task 3: Creer l'ecran d'inscription (AC: 1, 2)
  - [x] 3.1 Creer `app/(auth)/register.tsx`
  - [x] 3.2 Implementer le formulaire avec validation
  - [x] 3.3 Ajouter le lien depuis login vers register

- [x] Task 4: Integrer l'authentification dans le store (AC: 4)
  - [x] 4.1 Mettre a jour `stores/authStore.ts` avec Supabase
  - [x] 4.2 Implementer la redirection apres inscription

- [x] Task 5: Gerer les erreurs et feedback (AC: 5, 6)
  - [x] 5.1 Afficher les erreurs de validation inline
  - [x] 5.2 Afficher les erreurs Supabase (email existe, etc.)

## Dev Notes

### Mode Demo

L'application fonctionne en mode demo si Supabase n'est pas configure:
- Les credentials Supabase sont optionnels
- Sans `.env`, l'auth simule des comptes locaux
- Permet de tester l'UI sans backend

### Configuration Supabase

Pour activer l'authentification reelle:

1. Creer un projet sur https://supabase.com
2. Copier `.env.example` vers `.env`
3. Remplir `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Validation

- Email: format regex standard
- Mot de passe: minimum 8 caracteres
- Confirmation: doit correspondre au mot de passe
- Messages d'erreur en francais

### FR Couvert

- **FR34:** Un utilisateur peut creer un compte

### References

- [Source: prd.md#Gestion-des-Utilisateurs]
- [Source: architecture.md#Authentication-Security]
- [Source: epics.md#Story-1.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)
- Supabase client: configured with SecureStore adapter

### Completion Notes List

1. @supabase/supabase-js installe
2. Client Supabase avec SecureStore pour persistence tokens
3. Service auth avec signUp, signIn, signOut, getSession, getCurrentUser
4. Messages d'erreur traduits en francais
5. Ecran inscription avec validation complete
6. Ecran connexion mis a jour avec design tokens
7. AuthStore Zustand integre avec Supabase
8. Navigation entre login et register fonctionnelle
9. Mode demo si Supabase non configure

### File List

**Services:**
- `services/supabase/client.ts` - Client Supabase avec SecureStore
- `services/supabase/auth.ts` - Fonctions d'authentification
- `services/supabase/index.ts` - Exports

**Stores:**
- `stores/authStore.ts` - Store Zustand mis a jour

**Screens:**
- `app/(auth)/login.tsx` - Ecran connexion ameliore
- `app/(auth)/register.tsx` - Nouvel ecran inscription
- `app/(auth)/_layout.tsx` - Layout avec register
- `app/(main)/index.tsx` - Ecran principal ameliore

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story creee et implementee |
| 2026-02-03 | Story completee |
