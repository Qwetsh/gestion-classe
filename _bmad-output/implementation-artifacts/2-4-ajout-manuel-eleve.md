# Story 2.4: Ajout manuel d'un eleve a une classe

Status: complete

## Story

As an **enseignant**,
I want **ajouter manuellement un eleve a une classe**,
So that **je puisse integrer un nouvel eleve en cours d'annee**.

## Acceptance Criteria

1. **AC1:** L'enseignant peut ajouter un eleve avec Nom et Prenom ✅
2. **AC2:** L'eleve est cree avec son pseudonyme automatiquement ✅
3. **AC3:** La correspondance est stockee localement ✅
4. **AC4:** L'eleve apparait dans la liste de la classe ✅

## Tasks / Subtasks

- [x] Task 1: Mise a jour du store (AC: 1, 2, 3)
  - [x] 1.1 Ajouter action addStudent dans studentStore
  - [x] 1.2 Creer l'eleve et le mapping en une fois

- [x] Task 2: UI Modal d'ajout (AC: 1, 4)
  - [x] 2.1 Modal avec champs Nom et Prenom
  - [x] 2.2 Validation (champs requis)
  - [x] 2.3 Bouton "+ Ajouter" dans l'ecran detail classe

## Dev Notes

### FR Couvert

- **FR28:** Ajouter / retirer des eleves d'une classe (partie ajout)

### References

- [Source: epics.md#Story-2.4]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Action addStudent ajoutee au studentStore
2. Creation automatique du pseudo et du mapping RGPD
3. Modal d'ajout avec champs Prenom/Nom
4. Validation des champs requis
5. Bouton "+ Ajouter" a cote de "Importer"
6. Liste triee alphabetiquement apres ajout

### File List

**Stores:**
- `stores/studentStore.ts` - Action addStudent ajoutee

**App:**
- `app/(main)/classes/[id].tsx` - Modal d'ajout + bouton

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story demarree |
| 2026-02-03 | Story implementee et completee |
