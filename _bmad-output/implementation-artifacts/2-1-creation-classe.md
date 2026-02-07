# Story 2.1: Creation d'une classe

Status: complete

## Story

As an **enseignant**,
I want **creer une nouvelle classe**,
So that **je puisse organiser mes eleves par groupe**.

## Acceptance Criteria

1. **AC1:** L'enseignant connecte peut creer une classe avec un nom ✅
2. **AC2:** La classe apparait dans la liste des classes ✅
3. **AC3:** La classe est associee au compte utilisateur ✅
4. **AC4:** Un nom vide affiche un message d'erreur ✅

## Tasks / Subtasks

- [x] Task 1: Repository de classes (AC: 1, 2, 3)
  - [x] 1.1 Creer `services/database/classRepository.ts`
  - [x] 1.2 Implementer createClass, getClasses, getClassById, deleteClass

- [x] Task 2: Store Zustand pour les classes (AC: 1, 2)
  - [x] 2.1 Creer `stores/classStore.ts`
  - [x] 2.2 Actions: loadClasses, addClass, removeClassById

- [x] Task 3: Ecran liste des classes (AC: 2)
  - [x] 3.1 Mettre a jour `app/(main)/index.tsx` avec la liste
  - [x] 3.2 Bouton pour ajouter une classe

- [x] Task 4: Modal creation de classe (AC: 1, 4)
  - [x] 4.1 Modal integree dans index.tsx
  - [x] 4.2 Formulaire avec validation

## Dev Notes

### FR Couvert

- **FR27:** Creer / modifier / supprimer des classes (partie creation)

### References

- [Source: epics.md#Story-2.1]
- [Source: architecture.md#Data-Architecture]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)
- expo-crypto: Installe pour generation UUID

### Completion Notes List

1. Repository SQLite pour CRUD classes (createClass, getClassesByUserId, getClassById, updateClass, deleteClass)
2. Store Zustand classStore avec gestion d'etat
3. Ecran principal avec FlatList des classes
4. Modal de creation avec validation (nom requis)
5. Bouton + flottant pour ajouter une classe
6. Soft delete pour les classes (is_deleted flag)

### File List

**Database:**
- `services/database/classRepository.ts` - CRUD operations pour classes
- `services/database/index.ts` - Export du repository

**Stores:**
- `stores/classStore.ts` - State management pour classes
- `stores/index.ts` - Export du store

**App:**
- `app/(main)/index.tsx` - Ecran principal avec liste et modal
- `app/(main)/_layout.tsx` - Layout mis a jour

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story demarree |
| 2026-02-03 | Story implementee et completee |
