# Groupes de classe — demi-classes en alternance

> Rédigé le 17/09/2026 avec Thomas, relu et corrigé le même jour (voir §0). Remplace le bricolage
> « une salle Groupe 1 + une salle Groupe 2 » par de vrais groupes d'élèves définis dans la classe,
> sélectionnables au démarrage d'une séance (mobile, PWA, mode en classe). Rien n'est codé ici.

---

## 0. Relecture du 17/09/2026 — ce qui a changé par rapport au premier jet

| # | Problème du premier jet | Correction |
|---|-------------------------|------------|
| 1 | Ajouter `group_id` dans `class_room_plans` cassait **tous les lecteurs existants** : trois `.single()` côté web (`liveSessionQueries.fetchSeatingPlan`, `Classes.tsx`, `Sessions.tsx`) auraient levé une erreur dès le premier plan de groupe, et un **ancien APK** (téléphone d'Aurélie) aurait échoué au pull des plans sur son `UNIQUE(class_id, room_id)` local. Ordre de déploiement impossible à garantir. | **Table séparée `class_group_plans`.** `class_room_plans` n'est pas touchée : ni drop de contrainte (vérifiée en prod : `class_room_plans_class_id_room_id_key`), ni recréation de table SQLite, ni index unique partiel, ni hasard de déploiement. Un vieil APK ignore simplement la nouvelle table. |
| 2 | « `handleEndYear` doit vider `class_group_members` ». | **Faux.** Le passage d'année est une suppression de classe (migration 033 : `students.class_id → NULL`). `class_groups.class_id` est en `ON DELETE CASCADE`, la liaison suit. Rien à faire. |
| 3 | « Roster figé pour la durée de la séance ». | Le roster n'est pas persisté : après un redémarrage de l'app, `loadActiveSession` le recalcule. Reformulé : **roster dérivé au chargement**, sans écoute des changements en cours de séance. |
| 4 | Transvasement → « libérer la place dans le plan de G1 ». Code à écrire deux fois (web, mobile) plus sync, pour un effet purement cosmétique. | Supprimé. Le rendu **filtre toujours les positions par le roster** (déjà nécessaire pour le repli sur le plan entier). Une position périmée est inoffensive et disparaît à la prochaine sauvegarde du plan. |
| 5 | Interrupteur « un élève peut être dans plusieurs groupes » dans l'UI V1. | Retiré de la V1. Le **modèle** reste une table de liaison (aucune migration le jour où on en a besoin), l'**UI** V1 est exclusive. Moins de code au lot 2. |
| 6 | Alternance basée sur « la dernière séance de la classe ». Une séance en classe entière (DS) entre deux demi-groupes cassait le cycle. | Alternance basée sur **la dernière séance de la classe ayant un `group_id`**. |
| 7 | Flag `rooms.archived` pour les fausses salles. | Hors périmètre. `sessions.room_id` est en `ON DELETE CASCADE` (vérifié en prod), donc **ne jamais supprimer** les fausses salles : les **renommer**. L'archivage des salles est une autre feature. |
| 8 | Index unique partiel + upsert. | Disparu avec la table séparée : `UNIQUE(class_id, room_id, group_id)` classique, l'upsert PostgREST `onConflict` fonctionne. |
| 9 | Champs de résultat de sync nommés « Groupes ». | Collision avec le label `Groupes` (TP) de `syncAll`. Nommer `classGroupsSync`, `classGroupMembersSync`, `classGroupPlansSync`, libellés « Groupes de classe », « Membres de groupe de classe », « Plans de groupe ». |
| 10 | Rien sur les conflits hors ligne de l'appartenance. | Ajouté en §7 : un élève peut se retrouver dans deux groupes après une fusion web/mobile ; la vue Répartition l'affiche dans les deux colonnes avec un point d'alerte, un tap règle le cas. |

---

## 1. Décisions prises (17/09/2026)

| Sujet | Décision |
|-------|----------|
| Nom du concept | **Groupes de classe** (`class_groups`). Jamais « groupes » tout court dans le code : le mot est pris par les groupes de TP. |
| Groupes de TP (séances de groupe) | **Intouchés.** `group_sessions`, `session_groups`, `session_group_members`, `group_grades`, `GroupSessionContext`, écran mobile `group-session/` : on ne change rien, on ne réutilise rien. |
| Appartenance | **Table de liaison** `class_group_members`. Le modèle autorise plusieurs groupes par élève ; l'UI V1 est exclusive (partition). |
| Où l'on crée et modifie les groupes | **Web ET mobile, livrés ensemble.** Obligatoire. |
| Transvasement | **Système dédié** : déplacer un élève d'un groupe à l'autre en un geste, échange 1 ↔ 1, sélection multiple. Détail en §5. |
| Plan de classe | **Plan par groupe optionnel** dans une table dédiée, repli sur le plan de la classe entière filtré. |
| Séance | `sessions.group_id` nullable. Null = classe entière. Grille **et** listes (tirage au sort, oral, absents) filtrées sur le groupe. |
| Présélection | **Alternance automatique** : au démarrage, l'app propose le groupe suivant celui de la dernière séance en groupe de la classe. Modifiable d'un tap. |
| Élève de l'autre groupe présent exceptionnellement | **V2** (« élève invité » en séance). En V1 il n'apparaît pas. |
| Fausses salles actuelles | **Renommées**, jamais supprimées (cascade sur les séances). |

---

## 2. Existant (à ne pas casser)

- **Historique** : une table `student_groups` + `students.group_id` a existé (migration mobile v6) puis a
  été **supprimée** en v7, remplacée par les groupes de TP. Ne pas ressusciter ces noms : la migration
  SQLite v7 fait un `DROP TABLE IF EXISTS student_groups`.
- **Groupes de TP** (ne pas confondre) :
  - Supabase : `group_sessions`, `session_groups`, `session_group_members`, `group_grades`, `grading_criteria`.
  - Mobile : `services/database/groupSessionRepository.ts`, `stores/groupSessionStore.ts`, `app/(main)/group-session/`, `components/groups/`.
  - Web : `contexts/GroupSessionContext.tsx`, `pages/GroupSessions.tsx`, `components/live-session/Group*.tsx`.
  - Ce sont des groupes **éphémères, propres à une séance de TP**, avec notation par critères. Les groupes
    de classe sont **durables, propres à la classe**, sans notation.
- **Séance** : `sessions(class_id, room_id, topic, notes, started_at, ended_at)`. Le mobile crée la séance
  en local (`sessionRepository.createSession`) et la pousse dans `syncSessions()` avec des colonnes
  explicites ; le pull (`pullFromServer`) lit aussi des colonnes explicites. `sessions.room_id` est en
  **`ON DELETE CASCADE`** (vérifié en prod le 17/09).
- **Plan de classe** : `class_room_plans(user_id, class_id, room_id, positions)` avec
  `UNIQUE(class_id, room_id)` en prod **et** en SQLite. `positions` = `{ "r,c": student_id }`. Lecteurs
  en `.single()` sur `(class_id, room_id)` : `liveSessionQueries.fetchSeatingPlan`, `Classes.tsx`,
  `Sessions.tsx`. Pull mobile : `WHERE class_id = ? AND room_id = ?`. **On ne touche pas à cette table.**
- **Séance mobile** (`app/(main)/session/[id].tsx`) : `students = studentsByClass[class_id]`, toute la
  classe. La grille n'affiche que les élèves placés, mais `presentStudents` (tirage au sort, évaluation
  orale, « tous absents ») prend toute la classe. **C'est le bug actuel du bricolage** : le tirage au sort
  peut sortir un élève de l'autre demi-groupe.
- **Web** : éditeur de plan dans `pages/Classes.tsx` (pool « Non placés » = `unplacedStudents`),
  session live via `contexts/LiveSessionContext.tsx` (`selectClass` → `selectRoom` → `createSession`),
  mode en classe `pages/Classroom.tsx` (`fetchStudentsForClass` + `fetchSeatingPlan(class, room)`),
  détail de séance `pages/Sessions.tsx` (recharge le plan par `room_id`).
- **Transfert d'élève entre classes** (`lib/studentTransferQueries.ts`) : retire l'élève des plans de
  l'ancienne classe. À compléter : le retirer aussi des groupes de l'ancienne classe.
- **Passage d'année** = suppression de la classe (`students.class_id → NULL`, migration 033). Les groupes
  suivent la classe par cascade, rien à ajouter.
- **Suppressions hors ligne** : table SQLite `pending_deletions(table_name, record_id)` +
  `getPendingDeletedIds(tables)` dans le pull. À alimenter pour groupes, membres et plans de groupe.
- **Sync mobile** (`syncAll`) : ordre Classes → Élèves → Salles → Plans → Séances → Événements → (TP) →
  (tampons). Les groupes de classe s'insèrent **après Élèves**, les plans de groupe **après Plans**.

---

## 3. Modèle de données

### 3.1 Supabase — `supabase-migrations/037_class_groups.sql`

```sql
CREATE TABLE public.class_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT,                      -- clé de palette (ex. 'blue'), pas un hex
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);

CREATE TABLE public.class_group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, student_id)
);

-- Plans de groupe : table dédiée, class_room_plans reste intacte.
CREATE TABLE public.class_group_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  group_id    UUID NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  positions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  UNIQUE(class_id, room_id, group_id)
);

ALTER TABLE public.sessions
  ADD COLUMN group_id UUID REFERENCES public.class_groups(id) ON DELETE SET NULL;
```

- RLS : `class_groups` et `class_group_plans` sur `user_id = auth.uid()` (même schéma que
  `class_room_plans`) ; `class_group_members` via `EXISTS (SELECT 1 FROM class_groups g WHERE g.id =
  group_id AND g.user_id = auth.uid())`, comme `group_session_photos`.
- Index : `class_groups(class_id)`, `class_group_members(group_id)`, `class_group_members(student_id)`,
  `class_group_plans(class_id, room_id)`, `sessions(group_id)`.
- `class_group_members.id` (pas de PK composite) pour que `pending_deletions` et le remap de la sync
  travaillent par id comme partout ailleurs.
- `class_groups.user_id` est redondant avec `classes.user_id`, mais garde des RLS simples et homogènes
  avec le reste de la base.
- Realtime : si `Classroom.tsx` doit réagir à un changement de groupe en cours de séance (rare), la
  table `sessions` est déjà dans la publication ; il suffit d'ajouter `group_id` au `select`.

### 3.2 SQLite mobile — `schema.ts` v15 + migration `fromVersion < 15`

```sql
CREATE TABLE IF NOT EXISTS class_groups (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, class_id TEXT NOT NULL,
  name TEXT NOT NULL, color TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT, synced_at TEXT,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS class_group_members (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL, student_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), synced_at TEXT,
  FOREIGN KEY (group_id) REFERENCES class_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(group_id, student_id)
);
CREATE TABLE IF NOT EXISTS class_group_plans (
  id TEXT PRIMARY KEY, class_id TEXT NOT NULL, room_id TEXT NOT NULL, group_id TEXT NOT NULL,
  positions TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT, synced_at TEXT,
  FOREIGN KEY (group_id) REFERENCES class_groups(id) ON DELETE CASCADE,
  UNIQUE(class_id, room_id, group_id)
);
ALTER TABLE sessions ADD COLUMN group_id TEXT;
```

- Trois `CREATE TABLE` + un `ALTER TABLE ADD COLUMN` : migration triviale, pas de recréation de table.
- Piège connu (mémoire `project_sqlite_replace_cascade`) : **aucun `INSERT OR REPLACE`** sur
  `class_groups` (cascade sur membres et plans). Utiliser `upsertLocalRow`.
- Pas de FK sur `sessions.group_id` en SQLite (comme pour les autres colonnes optionnelles) : le pull
  reflète le `SET NULL` serveur.

### 3.3 Types partagés

- Mobile `types/index.ts` : `ClassGroup { id, user_id, class_id, name, color, sort_order }`,
  `ClassGroupMember { id, group_id, student_id }`, `ClassGroupPlan { id, class_id, room_id, group_id,
  positions }`, `Session.group_id: string | null`.
- Web : mêmes formes dans un nouveau `lib/classGroupQueries.ts` (CRUD + transvasement + plans de
  groupe), importé par `Classes.tsx`, `liveSessionQueries.ts`, `Classroom.tsx`, `Sessions.tsx`.

---

## 4. Règles de résolution (les mêmes partout : mobile, PWA, TBI)

| Question | Règle |
|----------|-------|
| Quels élèves dans la séance ? | `group_id` null → toute la classe. Sinon → membres du groupe. Cette liste (le **roster**) alimente **la grille et toutes les listes** (présents, tirage au sort, oral, non évalués, compteur d'absents). |
| Quel plan ? | 1) `class_group_plans(class, room, group)` s'il existe **et a au moins une position** ; 2) sinon `class_room_plans(class, room)` ; 3) sinon grille vide. Dans tous les cas les positions sont **filtrées par le roster** au rendu : un id hors roster = place vide. |
| Élève membre mais non placé ? | Dans les listes, pas sur la grille. Même comportement qu'aujourd'hui pour un élève non placé. |
| Groupe présélectionné ? | Dernière séance de la classe **avec un `group_id` non null** (`ORDER BY started_at DESC LIMIT 1`). Si elle existe avec le groupe G, proposer le groupe suivant dans `sort_order` (cyclique). Si aucune séance en groupe n'existe, proposer « Classe entière ». Jamais imposé. |
| Quand le roster est-il calculé ? | Au chargement de la séance (démarrage **ou** restauration après redémarrage), à partir de l'appartenance locale du moment. Pas d'écoute des changements en cours de séance. |
| Un élève est dans plusieurs groupes ? | Toléré par le modèle. L'UI V1 le signale (§5) et le résout d'un tap. |

Une fonction pure `resolveSessionRoster({ classStudents, memberIds, groupPlan, classPlan })` → `{ students,
positions }` dans le mobile (`utils/sessionRoster.ts`) et son jumeau web (`lib/sessionRoster.ts`), avec
tests unitaires. Une fonction pure `nextGroupForClass(groups, lastGroupSession)` pour l'alternance, testée aussi.

---

## 5. Transvasement (le cœur de l'UX)

Objectif : passer Amina de G1 à G2 en **un geste**, sur web comme sur mobile, sans passer par
« retirer » puis « ajouter ».

### 5.1 Vue « Répartition » (web et mobile)

- Un écran par classe, **une colonne par groupe** + une colonne « Non affecté ». Chaque élève est
  une pastille (pseudo, photo si dispo). En-tête de colonne : nom, couleur, effectif.
- **Partition** : un élève est dans une seule colonne. Si la base dit le contraire (fusion hors ligne,
  §7), la pastille apparaît dans chaque colonne avec un point d'alerte ; un tap sur l'une d'elles le
  garde là et le retire des autres.
- **Gestes de transvasement** :
  - Web : **glisser-déposer** d'une colonne à l'autre (même bibliothèque que le plan de classe).
    Clic sur la pastille → menu « Déplacer vers G2 », « Non affecté ».
  - Mobile : **tap sur la pastille → elle passe dans l'autre groupe** quand il n'y a que deux groupes.
    Au-delà : tap → bottom sheet avec la liste des groupes cibles. Appui long → sélection multiple,
    puis barre d'action « Déplacer vers… ».
  - **Échange 1 ↔ 1** : sélectionner un élève de G1 puis un élève de G2 → bouton « Échanger ».
- **Équilibre** : effectifs sous les en-têtes ; bouton « Équilibrer » qui déplace les non affectés vers le
  groupe le moins nombreux.
- **Répartition automatique** (à la création ou quand tout est « Non affecté ») : « Moitié
  alphabétique », « Alternée » (1 sur 2), « Aléatoire ». Prévisualisée avant validation.
- **Annuler** : `UndoBanner` (existant côté live-session web) après chaque déplacement ;
  mobile : toast « Amina → Groupe 2 · Annuler ».
- Une opération de transvasement = **une transaction** : `DELETE` des anciennes lignes de liaison de
  l'élève dans cette classe + `INSERT` de la nouvelle (web : une RPC `move_class_group_member` ou deux
  requêtes enchaînées ; mobile : `withTransactionAsync` + `pending_deletions`).

### 5.2 Effets de bord d'un transvasement

- **Plans** : aucun. Les positions périmées sont filtrées au rendu (§4) et nettoyées à la prochaine
  sauvegarde du plan concerné. L'éditeur de plan de groupe montre l'élève arrivant dans « Non placés ».
- **Séance en cours** : le roster n'est pas recalculé tant que la séance n'est pas rechargée.
- **Historique** : rien ne change, les événements sont par élève et par séance.

### 5.3 Mobile : où ça vit

- `app/(main)/classes/[id].tsx` : nouvelle section **« Groupes »** entre « Élèves » et « Plan de
  classe » : liste des groupes (nom, couleur, effectif) + bouton « Gérer ». État vide : « Aucun groupe.
  Créer des demi-groupes » → crée G1/G2 en répartition alphabétique, prêts à ajuster.
- Nouvel écran `app/(main)/classes/[id]/groups.tsx` : la vue Répartition (§5.1). Création / renommage /
  couleur / suppression d'un groupe dans un bottom sheet (composants `components/ui/` du reskin
  Direction B). Suppression d'un groupe : confirmation explicite « Les séances passées de ce groupe
  redeviendront "classe entière" » ; membres et plans de groupe supprimés en cascade, `pending_deletions`
  alimentée pour le groupe (le serveur cascade le reste).
- Tout écrit en local (`synced_at NULL`) et part à la prochaine sync, comme les classes et élèves.

---

## 6. Web — fichiers touchés

| Fichier | Changement |
|---------|-----------|
| `supabase-migrations/037_class_groups.sql` | §3.1 |
| `lib/classGroupQueries.ts` (nouveau) | `fetchClassGroups(classId)`, `fetchGroupMembers(classId)`, `createGroup`, `updateGroup`, `deleteGroup`, `moveStudent(classId, studentId, toGroupId \| null)` (exclusif), `swapStudents`, `autoSplit(classId, mode)`, `fetchGroupPlan`, `saveGroupPlan` (upsert `onConflict: 'class_id,room_id,group_id'`). |
| `lib/sessionRoster.ts` (nouveau) | `resolveSessionRoster`, `nextGroupForClass` + tests. |
| `pages/Classes.tsx` | Sous-onglet **« Groupes »** dans la barre latérale de la classe (au-dessus de « Ce que voient les élèves ») ouvrant la vue Répartition (`components/class-groups/GroupSplitter.tsx`). Dans l'éditeur de plan : **sélecteur « Classe entière / G1 / G2 »** à côté de la salle. Avec un groupe : lecture/écriture dans `class_group_plans`, `unplacedStudents` = membres non placés, bouton « Partir du plan de la classe entière » (copie filtrée). Suppression de salle : rien à ajouter (cascade). |
| `lib/liveSessionQueries.ts` | `fetchSeatingPlan(classId, roomId, groupId)` : si `groupId`, tente `class_group_plans` puis repli sur l'existant. `createSession(..., groupId)`. |
| `contexts/LiveSessionContext.tsx` | Étape `select-group` entre `selectClass` et `selectRoom`, **sautée** si la classe n'a aucun groupe. Présélection par alternance. `selectedGroup` dans l'état, badge dans `FlowHeader`. Le roster filtré est passé à `RecordingView` et `StudentPickerSheet`. |
| `components/live-session/ClassGroupPicker.tsx` (nouveau) | Chips « Classe entière / G1 / G2 » avec effectif. Nommé ainsi pour ne pas croiser `GroupClassSelector.tsx` (TP). |
| `pages/Classroom.tsx` | Ajoute `group_id` au `select` de la séance, charge les membres, applique `resolveSessionRoster`. |
| `pages/Sessions.tsx` | Badge « · Groupe 1 » dans la liste et le détail ; le détail utilise `fetchSeatingPlan` avec `group_id`. |
| `pages/Analytics.tsx` | Rien en V1. |
| `lib/studentTransferQueries.ts` | Étape 2 bis : `DELETE FROM class_group_members WHERE student_id = ? AND group_id IN (SELECT id FROM class_groups WHERE class_id = ancienne)`. |

---

## 7. Mobile — fichiers touchés

| Fichier | Changement |
|---------|-----------|
| `services/database/schema.ts`, `migrations.ts` | v15 (§3.2). |
| `services/database/classGroupRepository.ts` (nouveau) | CRUD local + `moveStudent`, `swapStudents`, `getGroupsByClassId`, `getMembersByClassId`, `getMemberIds(groupId)`, `getGroupPlan`, `saveGroupPlan`. |
| `services/database/classRoomPlanRepository.ts` | **Inchangé.** |
| `services/database/sessionRepository.ts` | `createSession(..., groupId)`, `getLastGroupSessionForClass(classId)`. |
| `services/database/deleteService.ts` | Suppression de groupe → `pending_deletions('class_groups', id)`. |
| `services/sync/syncService.ts` | Push : `syncClassGroups(userId)` et `syncClassGroupMembers()` après `syncStudents` ; `syncClassGroupPlans(userId)` après `syncPlans` (upsert `onConflict: 'class_id,room_id,group_id'`, bien plus simple que `syncPlans`) ; `syncSessions` pousse `group_id`. Pull : groupes, membres, plans de groupe après les élèves, avec `pendingDeleted` ; sessions avec `group_id` dans le `select`. Nouveaux champs de `SyncResult` : `classGroupsSync`, `classGroupMembersSync`, `classGroupPlansSync`. |
| `stores/classGroupStore.ts` (nouveau) | `groupsByClass`, `membersByClass`, actions de §5 avec mise à jour optimiste. |
| `stores/sessionStore.ts` | `startSession(userId, classId, roomId, groupId, topic)` ; `roster` calculé dans `startSession` et `loadActiveSession` via `resolveSessionRoster`. |
| `stores/planStore.ts` | `loadPlan(classId, roomId, groupId)` applique la règle de repli. |
| `utils/sessionRoster.ts` (nouveau) | `resolveSessionRoster`, `nextGroupForClass` + tests dans `__tests__/`. |
| `app/(main)/session/start.tsx` | Étape **« Groupe »** (chips, effectifs, présélection alternée) insérée après la classe, seulement si la classe a des groupes ; numérotation des étapes dynamique. Résumé du footer : « 3e2 · Groupe 1 · Salle 12 ». |
| `app/(main)/session/[id].tsx` | `students` = `roster.students` au lieu de `studentsByClass[class_id]` ; `positions` = `roster.positions`. Corrige au passage le tirage au sort. Badge du groupe dans l'en-tête. |
| `app/(main)/plan/[classId]/[roomId].tsx` | Sélecteur « Classe entière / G1 / G2 » en haut ; avec un groupe, lecture/écriture dans `class_group_plans`, `unplacedStudents` filtré, bouton « Partir du plan de la classe entière ». |
| `app/(main)/classes/[id].tsx` + `classes/[id]/groups.tsx` | §5.3 |
| `app/(main)/history/index.tsx`, `[id].tsx` | Badge du groupe (map `groupId → name` comme `roomMap`). |
| `types/index.ts` | §3.3 |

Sync — points d'attention :
- Les groupes créés sur mobile ont un `id` UUID généré localement, poussé tel quel (comme les classes).
- Membres : upsert serveur `onConflict: 'group_id,student_id'`, id serveur remappé en local si différent.
- **Conflit hors ligne** : Thomas déplace Amina G1 → G2 sur mobile hors ligne pendant qu'Aurélie… non,
  Aurélie n'a pas ses classes. Cas réel : Thomas sur web puis sur mobile hors ligne. Après fusion, Amina
  peut être membre de G1 et de G2. Aucune perte de données, la vue Répartition le montre et un tap règle.
  Le roster d'une séance prend l'élève dès qu'il est membre du groupe choisi.
- Suppression : `pending_deletions` pour `class_groups` (cascade serveur) et pour un membre retiré
  (`class_group_members`), sinon le pull les ressuscite.

---

## 8. Migration du bricolage actuel

Dans la vue Répartition (web et mobile), bouton **« Créer un groupe à partir d'un plan de salle »** :
choisir une salle → les élèves placés dans `class_room_plans(classe, salle)` deviennent membres du
nouveau groupe. Fait deux fois (salle « Groupe 1 », salle « Groupe 2 »), Thomas retrouve sa répartition,
puis copie chaque plan vers `class_group_plans(classe, vraie salle, Gx)` avec « Partir du plan de … » et
**renomme** les fausses salles (« zz Ancien Groupe 1 ») pour qu'elles tombent en bas des listes. Ne pas
les supprimer : `sessions.room_id ON DELETE CASCADE` effacerait leurs séances.

---

## 9. Découpage en lots

| Lot | Contenu | Livrable |
|-----|---------|----------|
| **1 · Socle** ✅ 17/09/2026 | Migration 037 appliquée en prod (RLS vérifiée), SQLite v15, types, `utils/sessionRoster.ts` (+ jumeau web `lib/sessionRoster.ts`, 16 tests), `lib/classGroupQueries.ts`, `services/database/classGroupRepository.ts`, sync push/pull des groupes, membres et plans de groupe, `sessions.group_id` dans push/pull, `fetchSeatingPlan`/`createSession` web avec `groupId` optionnel. | Base prête, aucune UI. `tsc` mobile et `tsc -b` web au vert, 113 tests Jest. Le round-trip réel web → mobile → web se vérifie au lot 2 (première UI qui écrit). |
| **2 · Répartition** ✅ 17/09/2026 | Web : `components/class-groups/GroupSplitter.tsx` (modale depuis la barre latérale de Classes, bouton « Groupes de classe »), glisser-déposer entre colonnes, sélection + « Déplacer vers », échange 1 ↔ 1, équilibrer, auto-split, création depuis un plan de salle, annulation. Mobile : `stores/classGroupStore.ts`, écran `classes/[id]/groups.tsx` (tap = changement de groupe à 2 groupes, appui long = sélection, sheets création/édition/auto-split/import), section « Groupes » dans la fiche classe. Palette partagée `classGroupColors` (clé, pas hex). | `tsc` mobile et `tsc -b` web au vert, ESLint web propre sur les nouveaux fichiers. **À vérifier sur téléphone** : round-trip web → mobile → web (première UI qui écrit). |
| **3 · Séance** | Étape Groupe dans `start.tsx` + alternance, roster dans `session/[id].tsx`, badge historique, `LiveSessionContext` + `ClassGroupPicker`, `Classroom.tsx`, `Sessions.tsx`. | Séance en demi-groupe de bout en bout, TBI compris. |
| **4 · Plans par groupe** | Sélecteur de groupe dans les deux éditeurs de plan, copie depuis le plan entier. | Les fausses salles ne servent plus. |
| **5 · Nettoyage** | Transfert d'élève, APK + build EAS hors OneDrive, migration du bricolage de Thomas. | Livraison. |

Lots 1 → 3 sont le minimum utile ; le lot 4 remplace vraiment le bricolage. Aucun lot n'impose d'ordre
de déploiement web/mobile : un ancien APK ignore les nouvelles tables et la colonne `group_id`.

---

## 10. Reporté en V2

- **Élève invité** : un élève de l'autre groupe présent exceptionnellement, ajouté à la séance en cours
  depuis une liste « Autres élèves de la classe », posé sur une place libre.
- Multi-appartenance dans l'UI (un élève dans plusieurs groupes volontairement).
- Archivage des salles (`rooms.archived`) pour cacher les salles obsolètes sans perdre les séances.
- Filtre « Groupe » dans Analytics et export.
- Groupes visibles dans l'espace élève (« Tu es en Groupe 2 »).
- Rotation personnalisée (calendrier A/B du collège).
