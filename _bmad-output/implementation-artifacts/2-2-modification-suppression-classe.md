# Story 2.2: Modification et suppression d'une classe

Status: complete

## Story

As an **enseignant**,
I want **modifier ou supprimer une classe existante**,
So that **je puisse corriger des erreurs ou retirer des classes obsoletes**.

## Acceptance Criteria

1. **AC1:** L'enseignant peut modifier le nom d'une classe existante ✅
2. **AC2:** Le nouveau nom est enregistre et affiche ✅
3. **AC3:** L'enseignant peut supprimer une classe ✅
4. **AC4:** Une confirmation est demandee avant suppression ✅

## Tasks / Subtasks

- [x] Task 1: Ecran detail de classe
  - [x] 1.1 Creer `app/(main)/classes/[id].tsx`
  - [x] 1.2 Afficher nom, date creation, section eleves (vide)

- [x] Task 2: Modification du nom (AC: 1, 2)
  - [x] 2.1 Modal de modification avec pre-remplissage
  - [x] 2.2 Validation et sauvegarde via classStore

- [x] Task 3: Suppression avec confirmation (AC: 3, 4)
  - [x] 3.1 Bouton supprimer avec Alert de confirmation
  - [x] 3.2 Retour a la liste apres suppression

- [x] Task 4: Navigation
  - [x] 4.1 Navigation depuis la liste vers le detail
  - [x] 4.2 Mise a jour du layout principal

## Dev Notes

### FR Couvert

- **FR27:** Creer / modifier / supprimer des classes (parties modification/suppression)

### References

- [Source: epics.md#Story-2.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Ecran detail de classe avec header et navigation retour
2. Affichage des informations (nom, date creation)
3. Section eleves preparee (vide pour l'instant)
4. Modal de modification avec validation
5. Suppression avec Alert de confirmation native
6. Zone de danger pour action destructive
7. Navigation fluide liste <-> detail

### File List

**App:**
- `app/(main)/classes/[id].tsx` - Ecran detail classe (NOUVEAU)
- `app/(main)/_layout.tsx` - Route ajoutee
- `app/(main)/index.tsx` - Navigation vers detail

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story demarree |
| 2026-02-03 | Story implementee et completee |
