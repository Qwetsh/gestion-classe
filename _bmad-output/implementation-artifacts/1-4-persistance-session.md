# Story 1.4: Persistance de la session

Status: complete

## Story

As an **enseignant**,
I want **rester connecte entre les sessions**,
So that **je n'aie pas a me reconnecter a chaque ouverture de l'app**.

## Acceptance Criteria

1. **AC1:** Au demarrage de l'app, la session existante est verifiee ✅
2. **AC2:** Si une session valide existe, redirection vers l'ecran principal ✅
3. **AC3:** Si pas de session ou session expiree, redirection vers login ✅
4. **AC4:** Un ecran de chargement s'affiche pendant la verification ✅
5. **AC5:** Les tokens sont stockes de maniere securisee (SecureStore) ✅

## Tasks / Subtasks

- [x] Task 1: Creer un ecran de chargement initial (AC: 4)
  - [x] 1.1 Modifier `app/index.tsx` pour afficher un loader
  - [x] 1.2 Ajouter le logo/nom de l'app

- [x] Task 2: Implementer la verification de session au demarrage (AC: 1, 2, 3)
  - [x] 2.1 Appeler `checkAuth()` au montage de l'app
  - [x] 2.2 Rediriger selon le resultat

- [x] Task 3: Gerer les etats de chargement (AC: 4)
  - [x] 3.1 Ajouter `isInitialized` au store
  - [x] 3.2 `isLoading: true` par defaut pour afficher le loader

## Dev Notes

### Flux de demarrage

```
App Start
    ↓
index.tsx (Loading Screen)
    ↓
checkAuth() appelé
    ↓
Supabase getCurrentUser()
    ↓
┌─────────────────┬──────────────────┐
│ User trouvé     │ Pas de user      │
│       ↓         │       ↓          │
│ /(main)         │ /(auth)/login    │
└─────────────────┴──────────────────┘
```

### SecureStore

Les tokens Supabase sont automatiquement stockés dans SecureStore via l'adapter configuré dans `services/supabase/client.ts`.

### FR Couvert

- Partie de FR35 (session persistante)

### References

- [Source: epics.md#Story-1.4]
- [Source: architecture.md#Authentication-Security]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Ecran de chargement avec logo et spinner
2. Verification auth automatique au demarrage
3. Redirection conditionnelle (main ou login)
4. Flag `isInitialized` pour tracker l'etat
5. `isLoading: true` par defaut pour UX fluide

### File List

- `app/index.tsx` - Ecran de chargement + logique auth
- `stores/authStore.ts` - Ajout isInitialized, isLoading=true par defaut

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story implementee et completee |
