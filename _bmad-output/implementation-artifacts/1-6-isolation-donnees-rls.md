# Story 1.6: Isolation des donnees utilisateur (RLS)

Status: complete

## Story

As an **enseignant**,
I want **que mes donnees soient isolees des autres utilisateurs**,
So that **personne d'autre ne puisse voir mes classes et eleves**.

## Acceptance Criteria

1. **AC1:** Given deux enseignants A et B avec leurs propres donnees, When l'enseignant A consulte ses donnees, Then il ne voit que ses propres classes, eleves et seances
2. **AC2:** Given l'enseignant A tente d'acceder aux donnees de B, When la requete est executee, Then aucune donnee de B n'est retournee
3. **AC3:** Given RLS est active, When un utilisateur fait une requete, Then auth.uid() est automatiquement verifie

## Tasks / Subtasks

- [x] Task 1: Activer RLS sur toutes les tables (AC: 1, 2, 3)
  - [x] 1.1 ALTER TABLE ... ENABLE ROW LEVEL SECURITY sur classes
  - [x] 1.2 ALTER TABLE ... ENABLE ROW LEVEL SECURITY sur students
  - [x] 1.3 ALTER TABLE ... ENABLE ROW LEVEL SECURITY sur rooms
  - [x] 1.4 ALTER TABLE ... ENABLE ROW LEVEL SECURITY sur class_room_plans
  - [x] 1.5 ALTER TABLE ... ENABLE ROW LEVEL SECURITY sur sessions
  - [x] 1.6 ALTER TABLE ... ENABLE ROW LEVEL SECURITY sur events

- [x] Task 2: Policies SELECT (AC: 1, 2)
  - [x] 2.1 Policy "Users can view own classes" - auth.uid() = user_id
  - [x] 2.2 Policy "Users can view own students" - auth.uid() = user_id
  - [x] 2.3 Policy "Users can view own rooms" - auth.uid() = user_id
  - [x] 2.4 Policy "Users can view own class_room_plans" - via class ownership
  - [x] 2.5 Policy "Users can view own sessions" - auth.uid() = user_id
  - [x] 2.6 Policy "Users can view own events" - via session ownership

- [x] Task 3: Policies INSERT/UPDATE/DELETE (AC: 3)
  - [x] 3.1 INSERT WITH CHECK (auth.uid() = user_id) sur toutes tables
  - [x] 3.2 UPDATE USING (auth.uid() = user_id) sur toutes tables
  - [x] 3.3 DELETE USING (auth.uid() = user_id) sur toutes tables

## Dev Notes

### FRs Couverts

- **FR37:** Chaque utilisateur a ses propres donnees isolees
- **NFR11:** Isolation complete des donnees entre utilisateurs

### Implementation

24 policies RLS implementees dans:
- `supabase-schema.sql` - Schema complet avec RLS

### Tables protegees

| Table | Policies |
|-------|----------|
| classes | SELECT, INSERT, UPDATE, DELETE |
| students | SELECT, INSERT, UPDATE, DELETE |
| rooms | SELECT, INSERT, UPDATE, DELETE |
| class_room_plans | SELECT, INSERT, UPDATE, DELETE (via class) |
| sessions | SELECT, INSERT, UPDATE, DELETE |
| events | SELECT, INSERT, UPDATE, DELETE (via session) |

### File List

- `supabase-schema.sql`

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-03-07 | Story creee - code existant valide comme complete |
