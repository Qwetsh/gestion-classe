# Story 1.7: Structure de base de donnees locale (SQLite)

Status: complete

## Story

As an **enseignant**,
I want **que l'app puisse stocker des donnees localement**,
So that **je puisse utiliser l'app hors connexion et proteger les noms complets de mes eleves**.

## Acceptance Criteria

1. **AC1:** Une base SQLite locale est initialisee au premier lancement ✅
2. **AC2:** La structure inclut les tables pour students, classes, rooms, sessions, events ✅
3. **AC3:** Une table `local_student_mapping` stocke la correspondance pseudonyme <-> nom complet ✅
4. **AC4:** La table de correspondance n'est jamais synchronisee vers le serveur ✅
5. **AC5:** Les migrations s'executent automatiquement ✅

## Tasks / Subtasks

- [x] Task 1: Configurer expo-sqlite (AC: 1)
  - [x] 1.1 Creer `services/database/client.ts` pour l'instance DB
  - [x] 1.2 Initialiser la DB au demarrage de l'app via useDatabase hook

- [x] Task 2: Definir le schema (AC: 2, 3)
  - [x] 2.1 Creer `services/database/schema.ts` avec les definitions de tables
  - [x] 2.2 Inclure la table `local_student_mapping` (LOCAL ONLY)

- [x] Task 3: Implementer les migrations (AC: 5)
  - [x] 3.1 Creer `services/database/migrations.ts`
  - [x] 3.2 Executer les migrations au demarrage via _layout.tsx

- [x] Task 4: Hook useDatabase
  - [x] 4.1 Creer `hooks/useDatabase.ts`
  - [x] 4.2 Integrer dans le root layout

## Dev Notes

### Schema complet

```sql
-- Tables synchronisees avec Supabase
classes (id, user_id, name, created_at, updated_at, synced_at, is_deleted)
students (id, user_id, pseudo, class_id, created_at, updated_at, synced_at, is_deleted)
rooms (id, user_id, name, grid_rows, grid_cols, created_at, updated_at, synced_at, is_deleted)
class_room_plans (id, class_id, room_id, positions, created_at, updated_at, synced_at)
sessions (id, user_id, class_id, room_id, started_at, ended_at, synced_at)
events (id, session_id, student_id, type, subtype, note, timestamp, synced_at)

-- LOCAL ONLY (jamais synchronisee - RGPD)
local_student_mapping (id, student_id, first_name, last_name, full_name, created_at)
```

### Flux d'initialisation

```
App Start
    ↓
_layout.tsx
    ↓
useDatabase() hook
    ↓
initializeDatabase()
    ↓
Check schema_version
    ↓
Run migrations if needed
    ↓
App ready
```

### FR Couverts

- **FR38:** Stockage pseudonymise (pseudo dans students)
- **FR40:** Table de correspondance locale uniquement (local_student_mapping)
- **NFR8:** Table de correspondance jamais synchronisee

### References

- [Source: architecture.md#Data-Architecture]
- [Source: epics.md#Story-1.7]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)

### Completion Notes List

1. Client SQLite avec helpers (executeSql, queryAll, queryFirst, executeTransaction)
2. Schema complet avec 7 tables + indexes
3. Table local_student_mapping pour RGPD (jamais sync)
4. Systeme de migrations versionne
5. Hook useDatabase pour initialisation
6. Integration dans _layout.tsx
7. Ecran de chargement pendant init DB

### File List

**Database:**
- `services/database/client.ts` - Client SQLite singleton
- `services/database/schema.ts` - Definitions de schema
- `services/database/migrations.ts` - Systeme de migrations
- `services/database/index.ts` - Exports

**Hooks:**
- `hooks/useDatabase.ts` - Hook d'initialisation
- `hooks/index.ts` - Exports

**App:**
- `app/_layout.tsx` - Integration useDatabase

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story implementee et completee |
