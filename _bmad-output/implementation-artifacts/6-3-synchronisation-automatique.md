# Story 6.3: Synchronisation automatique

Status: review

## Story

As an **enseignant**,
I want **que mes donnees se synchronisent automatiquement quand je retrouve la connexion**,
So that **je n'aie pas a y penser**.

## Acceptance Criteria

1. **AC1:** Given j'ai des donnees non synchronisees et je retrouve la connexion, When je termine une seance, Then les donnees sont automatiquement envoyees vers Supabase
2. **AC2:** Un indicateur de sync s'affiche brievement
3. **AC3:** Les donnees locales sont marquees comme synchronisees (synced_at)
4. **AC4:** Given deux appareils ont modifie la meme donnee offline, When la synchronisation se produit, Then le conflit est resolu automatiquement (last-write-wins)

## Tasks / Subtasks

- [x] Task 1: Service de synchronisation
  - [x] 1.1 Creer services/sync/syncService.ts
  - [x] 1.2 Detecter donnees non sync (synced_at IS NULL)
  - [x] 1.3 Push vers Supabase avec upsert (last-write-wins)

- [x] Task 2: Trigger automatique
  - [x] 2.1 Sync quand connexion retrouvee
  - [x] 2.2 Sync a la fin d'une seance

- [x] Task 3: Indicateur de sync
  - [x] 3.1 Composant SyncButton (montre isSyncing state)
  - [x] 3.2 Afficher pendant la sync

- [x] Task 4: Mise a jour synced_at
  - [x] 4.1 Marquer les enregistrements comme synchronises

## Dev Notes

### FR Couvert

- **FR31:** Synchronisation automatique
- **NFR15:** Resolution de conflits last-write-wins

### Implementation prevue

- Service de sync qui:
  1. Query les enregistrements ou synced_at IS NULL
  2. Upsert vers Supabase (on conflict = update)
  3. Update synced_at localement
- Ecoute les changements de connexion via networkStore
- Sync apres endSession

### Tables Supabase requises

- classes, students, rooms, class_room_plans, sessions, events
- Colonnes: id, user_id, created_at, updated_at, ...
- RLS: user_id = auth.uid()

### References

- [Source: epics.md#Story-6.3]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- services/sync/syncService.ts (created) - Service de sync avec upsert last-write-wins
- services/sync/index.ts (created) - Exports du service
- services/index.ts (modified) - Ajout export sync
- stores/syncStore.ts (created) - State management pour la sync
- stores/index.ts (modified) - Ajout export syncStore
- hooks/useAutoSync.ts (created) - Hook pour auto-sync (network restored + session end)
- hooks/index.ts (modified) - Ajout export useAutoSync
- app/_layout.tsx (modified) - Activation du useAutoSync

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete |
