# Story 5.4: Historique des seances par classe

Status: review

## Story

As an **enseignant**,
I want **filtrer l'historique des seances par classe**,
So that **je puisse consulter les seances d'une classe specifique**.

## Acceptance Criteria

1. **AC1:** Given j'ai plusieurs classes avec des seances, When je filtre par une classe specifique, Then seules les seances de cette classe s'affichent
2. **AC2:** Je peux facilement basculer entre les classes

## Tasks / Subtasks

- [x] Task 1: UI Filtre
  - [x] 1.1 Ajouter selecteur classe en haut de l'ecran historique (chips horizontales)
  - [x] 1.2 Option "Toutes" par defaut

- [x] Task 2: Logique filtrage
  - [x] 2.1 loadSessionsByClass existe dans historyStore
  - [x] 2.2 Appliquer filtre sur changement de selection

## Dev Notes

### FR Couvert

- **FR21:** L'enseignant peut filtrer l'historique par classe

### Implementation

- Ajout d'un ScrollView horizontal avec chips de filtre
- Chip "Toutes" pour afficher toutes les seances
- Une chip par classe avec style actif/inactif
- useEffect pour recharger les sessions quand le filtre change
- loadSessionsByClass(classId) utilise pour le filtrage

### References

- [Source: epics.md#Story-5.4]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

- app/(main)/history/index.tsx (modified - filter chips)
- stores/historyStore.ts (loadSessionsByClass already existed)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee |
| 2026-02-04 | Implementation complete - status: review |
