# Story 6.4: Synchronisation manuelle

Status: review

## Story

As an **enseignant**,
I want **pouvoir declencher manuellement une synchronisation**,
So that **je puisse forcer l'envoi de mes donnees quand je le souhaite**.

## Acceptance Criteria

1. **AC1:** Given j'ai une connexion internet, When j'appuie sur le bouton "Synchroniser", Then toutes les donnees non synchronisees sont envoyees
2. **AC2:** Un message confirme le succes ou indique les erreurs
3. **AC3:** Je vois le nombre d'elements synchronises
4. **AC4:** Given je n'ai pas de connexion, When j'appuie sur "Synchroniser", Then un message m'indique que la connexion est indisponible

## Tasks / Subtasks

- [x] Task 1: UI Bouton Sync
  - [x] 1.1 Ajouter bouton sur ecran accueil
  - [x] 1.2 Badge avec nombre d'elements non sync

- [x] Task 2: Action de sync
  - [x] 2.1 Appeler syncService.syncAll()
  - [x] 2.2 Afficher resultat (succes/erreur/nombre)

- [x] Task 3: Gestion offline
  - [x] 3.1 Desactiver bouton si offline
  - [x] 3.2 Message "Connexion indisponible"

## Dev Notes

### FR Couvert

- **FR32:** Synchronisation manuelle

### Implementation prevue

- Bouton "Synchroniser" sur ecran accueil
- Badge indiquant le nombre d'elements en attente
- Modal de resultat apres sync
- Depend de syncService (story 6.3)

### References

- [Source: epics.md#Story-6.4]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- components/SyncButton.tsx (created) - Bouton sync avec badge et modal resultat
- components/index.ts (modified) - Ajout export SyncButton
- app/(main)/index.tsx (modified) - Ajout du SyncButton sur l'ecran d'accueil

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete |
