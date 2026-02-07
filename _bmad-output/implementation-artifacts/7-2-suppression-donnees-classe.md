# Story 7.2: Suppression definitive des donnees d'une classe/annee

Status: review

## Story

As an **enseignant**,
I want **supprimer definitivement toutes les donnees d'une classe ou d'une annee**,
So that **je puisse faire le menage en fin d'annee scolaire**.

## Acceptance Criteria

1. **AC1:** Given j'ai une classe avec des eleves et seances, When je demande la suppression, Then une confirmation explicite avec recap (nombre eleves, seances) est demandee
2. **AC2:** Apres confirmation, toutes les donnees sont supprimees (classe, eleves, seances, events, correspondances)
3. **AC3:** Les donnees sont supprimees en local et sur le serveur
4. **AC4:** Given je veux supprimer toutes les donnees, When je selectionne "Supprimer toutes les donnees", Then toutes mes classes sont supprimees mais mon compte reste actif

## Tasks / Subtasks

- [x] Task 1: Service de suppression classe
  - [x] 1.1 Fonction deleteClassCompletely dans deleteService
  - [x] 1.2 Suppression cascade complete (events -> sessions -> plans -> mappings -> students -> class)
  - [x] 1.3 Suppression directe sur Supabase

- [x] Task 2: UI de suppression classe
  - [x] 2.1 Bouton supprimer sur ecran detail classe
  - [x] 2.2 Modal avec recap (nb eleves, seances, events)
  - [x] 2.3 Retour a l'ecran precedent apres suppression

- [x] Task 3: Option suppression totale
  - [x] 3.1 Fonction deleteAllUserData dans deleteService (pret pour ecran parametres futur)

## Dev Notes

### FR Couvert

- **FR42:** Suppression definitive des donnees d'une classe
- **NFR12:** Droit a l'oubli RGPD

### Implementation prevue

- Bouton "Supprimer la classe" sur l'ecran detail classe
- Modal de confirmation avec recap statistiques
- Suppression cascade complete
- Option "Supprimer toutes mes donnees" dans un ecran parametres

### References

- [Source: epics.md#Story-7.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- services/database/deleteService.ts (created) - deleteClassCompletely et deleteAllUserData
- services/database/index.ts (modified) - Export des fonctions
- app/(main)/classes/[id].tsx (modified) - Modal de suppression classe avec stats

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete |
