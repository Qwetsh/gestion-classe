# Story 7.1: Suppression definitive des donnees d'un eleve

Status: review

## Story

As an **enseignant**,
I want **supprimer definitivement toutes les donnees d'un eleve**,
So that **je puisse respecter le droit a l'oubli RGPD**.

## Acceptance Criteria

1. **AC1:** Given j'ai un eleve avec des donnees, When je demande la suppression definitive, Then une confirmation explicite est demandee ("Cette action est irreversible")
2. **AC2:** Apres confirmation, toutes les donnees de l'eleve sont supprimees (local + serveur + correspondance + events cascade)
3. **AC3:** L'eleve n'apparait plus nulle part dans l'application
4. **AC4:** Given je suis offline, When je supprime un eleve, Then la suppression locale est effectuee et la suppression serveur est mise en file d'attente

## Tasks / Subtasks

- [x] Task 1: Service de suppression
  - [x] 1.1 Fonction deleteStudentCompletely dans deleteService
  - [x] 1.2 Suppression cascade des events
  - [x] 1.3 Suppression de la correspondance locale
  - [x] 1.4 Suppression directe sur Supabase si connecte

- [x] Task 2: UI de suppression
  - [x] 2.1 Bouton supprimer sur ecran historique eleve
  - [x] 2.2 Modal de confirmation explicite avec stats
  - [x] 2.3 Retour a l'ecran precedent apres suppression

- [x] Task 3: Sync suppression
  - [x] 3.1 Suppression directe sur Supabase lors de l'action

## Dev Notes

### FR Couvert

- **FR41:** Suppression definitive des donnees d'un eleve
- **NFR12:** Droit a l'oubli RGPD

### Implementation prevue

- Bouton "Supprimer l'eleve" sur l'ecran historique eleve
- Modal de confirmation avec message explicite
- Suppression cascade: events -> local_student_mappings -> student
- Pour la sync Supabase, utiliser is_deleted flag ou queue de suppression

### References

- [Source: epics.md#Story-7.1]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- services/database/deleteService.ts (created) - Service de suppression RGPD complete
- services/database/index.ts (modified) - Export des fonctions de suppression
- app/(main)/students/[id]/history.tsx (modified) - Bouton et modal de suppression eleve

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete |
