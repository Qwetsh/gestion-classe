# Story 6.2: Stockage local persistant

Status: review

## Story

As an **enseignant**,
I want **que mes donnees saisies hors ligne soient stockees de maniere fiable**,
So that **je ne perde jamais de donnees**.

## Acceptance Criteria

1. **AC1:** Given je suis en mode offline et j'enregistre des actions, When les donnees sont creees, Then elles sont immediatement persistees dans SQLite local
2. **AC2:** Les donnees survivent a un crash ou redemarrage de l'app (NFR14)
3. **AC3:** Given je ferme l'app en mode offline, When je la rouvre, Then toutes mes donnees offline sont toujours presentes

## Tasks / Subtasks

- [x] Task 1: Architecture SQLite
  - [x] 1.1 Toutes les tables en SQLite local (deja fait)
  - [x] 1.2 Pas de dependance reseau pour les operations CRUD

- [x] Task 2: Persistance immediate
  - [x] 2.1 expo-sqlite avec journal_mode=WAL
  - [x] 2.2 Chaque operation est une transaction atomique

## Dev Notes

### FR Couvert

- **FR30:** Donnees stockees localement
- **NFR13:** 0 perte de donnees
- **NFR14:** Donnees persistees immediatement

### Implementation

Cette story est deja couverte par l'architecture existante:
- Toutes les donnees sont stockees en SQLite local
- Pas d'appels reseau pour les operations CRUD
- expo-sqlite persiste les donnees immediatement
- Les repositories utilisent des transactions pour l'atomicite

### Tables SQLite

| Table | Description |
|-------|-------------|
| classes | Classes de l'enseignant |
| students | Eleves avec pseudo RGPD |
| local_student_mappings | Mapping local prenom/nom |
| rooms | Salles configurees |
| class_room_plans | Plans de classe par salle |
| sessions | Seances (actives et terminees) |
| events | Evenements (participation, etc.) |

### References

- [Source: epics.md#Story-6.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### File List

Code existant - pas de modification necessaire:
- services/database/*.ts (repositories SQLite)
- services/database/migrations.ts (init DB)

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-04 | Story creee - code existant valide |
