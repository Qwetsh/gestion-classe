# Audit — Feature « Récompenses » (carte à tampons)

Date : 2026-09-12. Périmètre : Supabase (migrations 011-013, RLS, RPC), mobile (SQLite, `stampRepository`, `syncService` push/pull, `stampStore`, écrans séance + fiche élève), web prof (`rewardsQueries`, `Rewards.tsx`, `Students.tsx`), PWA élève (`StudentDashboard.tsx`).

État prod au moment de l'audit (lecture seule) : 267 cartes, 149 tampons, 4 profs, 0 doublon de catégorie, 0 trou dans les cartes **côté serveur**, 1 bonus en attente. **2 cartes portent la trace d'un trou passé** (tampon n°2 posé avant le n°1) : élèves `aa1c5503…` (slot 2 le 08/09, slot 1 le 10/09) et `f579193b…` (slot 2 à 11:44, slot 1 à 13:24 le 10/09).

---

## A. Critiques — perte ou corruption de données

### A0. Chaque pull détruit les tampons locaux non encore poussés (prouvé)
Le pull des cartes fait `INSERT OR REPLACE INTO stamp_cards` pour **chaque** carte serveur, y compris celles déjà présentes localement avec le même id. En SQLite, `REPLACE` = DELETE + INSERT, et le DELETE déclenche `ON DELETE CASCADE` sur `stamps` et `bonus_selections` (test reproduit avec SQLite 3.49 : après le REPLACE d'une carte au même id, la table `stamps` est vide). Les tampons déjà synchronisés sont réinsérés juste après par le pull des `stamps` ; les tampons **non synchronisés** (hors ligne, timeout, premier tampon d'une nouvelle carte — cf. B1) sont détruits, puis le push qui suit ne trouve plus rien à envoyer.

Comme `syncStore.sync()` fait pull → push, et que la sync auto tourne au lancement de l'app : **tout tampon qui n'a pas réussi son push immédiat est perdu au lancement suivant.** C'est très probablement la cause principale des « soucis de sync » ressentis. Les 5 tables tampons sont les seules du pull à utiliser `INSERT OR REPLACE` ; les autres (classes, sessions, events…) font `SELECT` existe ? `UPDATE` : `INSERT`, ce qui est le pattern sûr.

Fichiers : `services/sync/syncService.ts:2059-2064` (et 1981, 2016, 2099, 2138), `services/database/schema.ts:262,278`.

### A1. Le pull écrase silencieusement les tampons/cartes créés hors ligne (cas conflit)
`syncStore.sync()` fait **pull puis push**. Le pull fait `INSERT OR REPLACE` dans des tables SQLite qui ont des contraintes `UNIQUE(card_id, slot_number)` et `UNIQUE(student_id, card_number)`. `REPLACE` supprime la ligne locale en conflit sur *n'importe quelle* contrainte unique, y compris une ligne jamais poussée.

Scénarios concrets :
- Web et mobile (hors ligne) tamponnent le même élève → même slot → au pull, le tampon mobile (non poussé) est remplacé par celui du web. Perdu sans message.
- Le mobile crée la carte n°1 localement (`getOrCreateActiveCard`, dès l'ouverture de la fiche élève) alors que le web / le RPC élève l'a déjà créée avec un autre UUID → au pull, la carte locale est remplacée → ses tampons non poussés deviennent orphelins (cascade FK ou ligne orpheline selon le comportement de REPLACE).
- Le remapping prévu dans `syncStampCards` (« serverId !== card.id ») ne sert à rien : il tourne dans le push, **après** que le pull a déjà écrasé.

Fichiers : `stores/syncStore.ts:80-100`, `services/sync/syncService.ts:2059-2100`, `services/database/schema.ts:249,265`.

### A2. Auto-collision dans `syncStamps` → tampon décalé d'une case (le bug « case vide au milieu »)
`syncStamps` récupère les slots occupés côté serveur **sans les `id`** (`select('card_id, slot_number')`). Si un tampon local est déjà sur le serveur mais encore marqué `synced_at IS NULL` localement, il entre en collision *avec lui-même* → renuméroté vers le slot suivant → `upsert` avec le même id → le tampon **se déplace** sur le serveur et laisse le slot d'origine vide.

Quand `synced_at` reste NULL alors que le serveur a le tampon :
- `awardStamp` fait un `upsert` immédiat ; sur le réseau du collège, un timeout *après* que Supabase a appliqué l'écriture donne `stampErr` → pas de `synced_at`.
- Course : `syncStamps` lit les non-synchronisés, `awardStamp` pousse en parallèle, `syncStamps` relit le serveur → collision.

C'est le mécanisme le plus cohérent avec les 2 cartes prod où le slot 2 est daté avant le slot 1. Fichier : `services/sync/syncService.ts:1233-1268`.

### A3. Suppressions mobile de tampons non propagées si hors ligne (tampons « zombies »)
`deleteStamp` et `removeLastStamp` suppriment en SQLite puis tentent un `delete` Supabase direct. Hors ligne, rien n'est mis dans `pending_deletions` (contrairement aux événements) → au prochain pull, le tampon revient. Pire : si le prof a entre-temps posé un nouveau tampon dans le slot libéré, A1 s'applique et c'est le *nouveau* tampon qui est écrasé par le zombie.
Idem pour `deleteStampCategory` / `deleteBonus` (non branchés en UI mobile, mais présents). Fichier : `services/database/stampRepository.ts:395-455`.

### A4. `awardStamp` web : slot = `count + 1` au lieu du premier slot libre, et `.single()` ignoré
- Après une suppression au milieu (web `removeStamp` ou mobile `deleteStamp`), `count + 1` pointe sur un slot déjà occupé → `duplicate key value violates unique constraint` → l'attribution web échoue avec une erreur brute. Le mobile, lui, prend le premier slot libre (comportement correct).
- `let { data: card } = ...eq('status','active').single()` : l'erreur de `.single()` est ignorée. S'il y a 0 ou 2 cartes actives, `card` est null → le code crée une carte `max+1` → possibilité de 2 cartes actives pour un élève, que `.single()` fera ensuite échouer partout (web, RPC, mobile fallback).
Fichier : `gestion-classe-web/src/lib/rewardsQueries.ts:449-503`.

---

## B. Majeurs — incohérences de synchronisation visibles

### B1. Push immédiat du premier tampon d'une nouvelle carte échoue systématiquement
Dans `awardStamp` mobile, le tampon est poussé **avant** la carte. Si la carte n'existe pas encore sur le serveur, le `upsert` du tampon échoue (FK `card_id`), puis la carte est poussée. Le tampon n'arrive sur le serveur qu'au prochain `syncAll`, c'est-à-dire au **prochain lancement de l'app** (B2). Résultat : la PWA élève et le site ne voient pas le tampon pendant des heures/jours. Fichier : `stampRepository.ts:335-360`.

### B2. Aucune sync périodique ni Realtime pour les tampons
- Mobile : sync auto **une seule fois par lancement** (`app/(main)/index.tsx:96`). Un tampon donné sur le web n'apparaît sur le téléphone qu'après redémarrage (ou sync manuelle).
- Après un pull, le cache `stampStore.activeCards` n'est pas invalidé → la fiche élève peut afficher l'ancienne carte même après sync.
- Web `Rewards.tsx` et PWA `StudentDashboard` : aucune souscription `postgres_changes` sur `stamps`/`stamp_cards`/`bonus_selections` ; rafraîchissement uniquement après une action locale ou un rechargement.

### B3. Dédoublonnage par label des catégories → FK cassées et pull interrompu
- `cleanupDuplicateCategories` (appelé à chaque `loadCategories`) supprime localement des catégories qui peuvent être référencées par des tampons → `FOREIGN KEY constraint failed` → `loadCategories` tombe dans le `catch` → **liste de catégories vide dans le modal double-tap**.
- Le pull des catégories déduplique aussi par label ; un tampon serveur qui référence la catégorie « perdante » fait échouer son `INSERT OR REPLACE` (FK) → l'exception remonte au `catch` global → **le reste du pull des tampons et des bonus_selections est abandonné**.
- Cause racine : double seed. `seedDefaultStampData` (mobile) sème 19 catégories locales si SQLite est vide, sans regarder le serveur ; `seedDefaultData` (web) sème sur Supabase. Un nouvel utilisateur qui ouvre le mobile avant le premier pull obtient 38 catégories serveur. Prod : 0 doublon aujourd'hui (nettoyé), mais le mécanisme est intact.
Fichiers : `stampRepository.ts:95-170`, `syncService.ts:1970-1985`, `stampStore.ts:48-58`.

### B4. `initializeCardsForClass` peut échouer pour toute la classe
Insère `card_number = 1` pour tout élève sans carte *active*. Un élève dont la carte n°1 est terminée (bonus choisi) sans carte n°2 → violation `UNIQUE(student_id, card_number)` → tout le batch est rejeté. Prod : 0 cas aujourd'hui (le RPC `get_student_stamps` crée la carte suivante à la volée), mais dormant. Fichier : `rewardsQueries.ts:640-675`.

### B5. Le RPC de lecture élève écrit en base
`get_student_stamps` crée une carte si l'élève n'en a pas d'active. Effet de bord dans un GET appelé à chaque ouverture de la PWA ; et cette carte n'arrive sur le mobile qu'au pull → entre-temps le mobile peut créer sa propre carte n+1 → conflit `(student_id, card_number)` → A1. Fichier : `supabase-migrations/013_fix_missing_next_card.sql`.

### B6. Double attribution possible sur mobile (séance)
Dans `session/[id].tsx`, le `onPress` d'une catégorie n'a pas de garde `isProcessing` (contrairement à `history.tsx`). Deux appuis rapides = deux tampons. Prod : 14 cartes ont ≥ 2 tampons dans la même minute — à recouper avec l'usage réel.

---

## C. Mineurs / sécurité

- **RLS** : les policies INSERT/UPDATE de `stamps`, `stamp_cards`, `bonus_selections` ne vérifient que `user_id = auth.uid()`, pas que `card_id`/`student_id` appartiennent au même prof. Un prof authentifié pourrait écrire sur la carte d'un élève d'un autre prof s'il connaît l'UUID. Impact faible (2 utilisateurs), mais à durcir.
- **RPC `SECURITY DEFINER`** sans `SET search_path = public` (recommandation Supabase advisor).
- **Code élève 6 caractères** utilisé comme seul secret sur des RPC anonymes, sans rate limiting côté base.
- `fetchStudentStampOverview` : `.in('card_id', allCardIds)` avec potentiellement des centaines d'UUID dans l'URL — OK aujourd'hui, à surveiller.
- `getOrCreateActiveCard` mobile : `WHERE status='active' LIMIT 1` sans `ORDER BY` — indéterminé s'il y a deux cartes actives.
- `getCompletedCards` mobile : `LEFT JOIN bonus_selections` → affiche encore les cartes « completed sans bonus » (cas censé ne plus exister depuis 012).

---

## D. Revue senior des corrections (2ᵉ passe) et plan révisé

### Points découverts à la relecture (absents de la 1ʳᵉ passe)

- **N1 = A0** ci-dessus : le REPLACE + cascade frappe à chaque pull, pas seulement en cas de conflit d'UUID. Impact bien plus large que ce que j'avais écrit en A1.
- **N2 — L'upsert de la carte dans `awardStamp` rétrograde une carte terminée.** À chaque tampon, le mobile pousse `{ status: 'active', completed_at: null }` sur la carte. Si l'élève a choisi son bonus entre-temps (carte `completed` + carte n+1 créée par le RPC) et que le mobile, pas encore à jour, tamponne → la carte terminée repasse `active` avec sa `bonus_selection` → deux cartes actives → `.single()` échoue partout (web, RPC, fallback mobile). `stampRepository.ts:350-357`.
- **N3 — Blocage définitif de la sync d'un élève après un « Réinitialiser » web.** Le reset supprime les cartes côté serveur. Au pull, la carte locale (absente du serveur) est *skippée* si elle a des tampons non poussés (`syncService.ts:2043-2050`) ; au push, ces tampons sont filtrés car leur carte n'existe pas sur le serveur (`syncService.ts:1225-1230`). La carte locale reste `active`, `getOrCreateActiveCard` continue de la choisir, et **tous les tampons suivants de cet élève posés depuis le mobile ne partent plus jamais**, sans erreur visible.
- **N4 — Perte silencieuse « carte pleine »** : dans `syncStamps`, un tampon qui ne trouve pas de slot est marqué `synced_at` et abandonné (`syncService.ts:1256-1261`). Un tampon attribué disparaît sans trace ni message.
- **N5 — Le pull ignore `pending_deletions`.** Même après la correction A3, le pull (qui précède le flush) réinsèrera localement le tampon supprimé hors ligne ; il faut exclure du pull les `record_id` en attente de suppression.
- **N6 — Policies UPDATE sans `WITH CHECK`** sur les 5 tables (seulement `USING`) : un UPDATE peut en théorie réaffecter `user_id` à un autre compte.

### Verdict sur chaque proposition de la 1ʳᵉ passe

| # | Proposition initiale | Verdict | Correction |
|---|---|---|---|
| 1 | Inverser pull→push en push→pull | **Rejetée telle quelle** | Inverser l'ordre global touche toutes les tables (le pull purge les classes disparues avant que le push n'envoie des événements orphelins) : régression probable. La vraie correction est locale : réécrire le pull des 5 tables tampons sur le pattern déjà utilisé par `classes`/`sessions`/`events` (`SELECT` → `UPDATE` ou `INSERT`, jamais `REPLACE`), avec, avant l'écriture, le remapping de carte extrait de `syncStampCards` et une renumérotation des tampons locaux non poussés en conflit de slot. Corrige A0 + A1 d'un bloc. |
| 2 | `syncStamps` : récupérer les `id` serveur | **OK, incomplète** | Ajouter : ne jamais marquer `synced_at` un tampon abandonné (N4) — le déplacer vers la carte active suivante ou le remonter en erreur de sync visible. |
| 3 | Suppressions via `pending_deletions` | **OK, incomplète** | Sans N5, le tampon revient localement jusqu'au pull suivant. Ajouter l'exclusion dans le pull (les 5 tables). |
| 4 | Web `awardStamp` : premier slot libre + `.maybeSingle()` | **OK, sous-dimensionnée** | La cible propre est un RPC Postgres `award_stamp(p_student_id, p_category_id)` transactionnel (choix de la carte active + du slot sous verrou, `ORDER BY card_number DESC`), appelé par le web et par le mobile quand il est en ligne. Élimine les courses web/mobile. À défaut : réessayer sur erreur `23505`. |
| 5 | Mobile : pousser la carte avant le tampon | **OK, incomplète** | Surtout : ne plus envoyer `status`/`completed_at` (N2). Utiliser `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` : crée la carte si absente, ne touche jamais une carte existante. |
| 6 | Sync au focus + Realtime web/PWA | **Sur-dimensionnée** | PWA élève : anonyme, la RLS bloque le Realtime → polling du RPC toutes les 30 s onglet visible suffit. Web prof : Realtime possible mais nécessite `ALTER PUBLICATION supabase_realtime ADD TABLE stamps, stamp_cards, bonus_selections` (migration oubliée dans la 1ʳᵉ passe). Mobile : un pull complet au focus est trop lourd ; faire un pull ciblé (cartes + tampons + sélections d'un seul élève) à l'ouverture de la fiche, et invalider `stampStore.activeCards`. |
| 7 | Seed unique, retirer `cleanupDuplicateCategories` | **OK, à nuancer** | Ne pas retirer brutalement : des doublons peuvent encore exister dans des SQLite locaux. Version sûre : `UPDATE stamps SET category_id = <gardée> WHERE category_id IN (<doublons>)` avant le `DELETE`. Retirer le dédoublonnage par label **dans le pull** (source des FK cassées) ; garder celui d'affichage web (inoffensif). |
| 8 | `initializeCardsForClass` → `max + 1` | **OK, mais** | Le bouton « Initialiser » n'a plus de raison d'être : `awardStamp` (web/mobile) et le RPC élève créent les cartes à la volée. Le supprimer réduit la surface de bugs. |
| 9 | Garde `isProcessing` en séance | **OK** | — |
| 10 | Durcir la RLS + `search_path` | **OK, incomplète** | Ajouter `WITH CHECK` sur les policies UPDATE (N6). Vérifier que le push mobile passe toujours (`students.user_id = auth.uid()` : oui). |

### Plan révisé

**P0 — arrêter la perte de données (un seul lot, à livrer ensemble, avec un APK)**
1. Pull des 5 tables tampons réécrit sans `REPLACE`, avec remapping de carte et renumérotation avant écriture, et exclusion des `pending_deletions` (A0, A1, N5).
2. `syncStamps` : `select('id, card_id, slot_number')`, exclusion des ids en cours, plus jamais de marquage `synced` d'un tampon abandonné (A2, N4).
3. `awardStamp` mobile : carte poussée avant le tampon, en `ignoreDuplicates`, sans `status`/`completed_at` (B1, N2).
4. Suppressions de tampons via `pending_deletions` (A3).
5. Carte locale absente du serveur avec enfants non poussés : la re-pousser (`synced_at = NULL`) au lieu de la skipper (N3). À combiner avec un remapping vers la carte active serveur si elle existe déjà avec un autre id.

**P1 — cohérence web**
6. RPC `award_stamp` transactionnel, utilisé par le web (et le mobile en ligne) (A4).
7. Garde `isProcessing` en séance (B6). Suppression du bouton « Initialiser » ou `max + 1` (B4).

**P2 — fraîcheur et robustesse**
8. Pull ciblé à l'ouverture de la fiche élève + invalidation du cache ; polling PWA ; publication Realtime + souscription web prof (B2).
9. Seed unique + nettoyage sûr des doublons (B3).
10. RLS avec sous-requête sur `students`, `WITH CHECK` sur UPDATE, `SET search_path` sur les RPC (C, N6).

## E. Réalisation de P0 (2026-09-12)

Livré dans `gestion-classe-mobile` (à embarquer dans un APK) :

| Correction | Fichier | Détail |
|---|---|---|
| A0 / A1 / N5 | `services/sync/syncService.ts` (pull 14-18) | Plus aucun `INSERT OR REPLACE` : helper `upsertLocalRow` (SELECT → UPDATE/INSERT). Carte locale en conflit `(student_id, card_number)` → `remapLocalCard` (changement d'id sous `PRAGMA defer_foreign_keys`, pas de DELETE donc pas de cascade). Tampon local non poussé en conflit de slot → décalé vers un emplacement libre, jamais écrasé. Ids présents dans `pending_deletions` ignorés. Un tampon en échec n'interrompt plus le pull des autres. Plus de dédoublonnage par libellé des catégories au pull (source des FK cassées) ; catégorie/bonus disparus du serveur → `SET NULL` sur les enfants avant suppression. |
| N3 | idem (pull 16) | Carte absente du serveur avec tampons non poussés → `synced_at = NULL` (re-poussée puis remappée au push) au lieu d'être skippée pour toujours. |
| A2 / N4 | `syncService.ts` (`syncStamps`) | Slots serveur récupérés **avec `id`** : un tampon ne peut plus entrer en collision avec lui-même. Carte pleine → tampon déplacé vers la carte active suivante (poussé au sync d'après) ; sinon il reste en attente, **jamais marqué synchronisé**. |
| Push cartes | `syncService.ts` (`syncStampCards`) | Remapping via `remapLocalCard` ; `upsert` en `ignoreDuplicates` (création seule : `status`/`completed_at` restent pilotés par le serveur). |
| B1 / N2 | `services/database/stampRepository.ts` (`awardStamp`) | Carte poussée **avant** le tampon, en `ignoreDuplicates`, uniquement si elle n'est pas déjà synchronisée ; tampon poussé seulement si la carte est sur le serveur. Choix du slot par `firstFreeSlot`. Repli « carte pleine » : `.maybeSingle()` + `ORDER BY card_number DESC`, sans `REPLACE`. |
| A3 | `stampRepository.ts` (`deleteStamp`, `removeLastStamp`) | Suppression mise dans `pending_deletions` avant le DELETE local, tentative immédiate, entrée retirée si succès. `removeLastStamp` retire le dernier tampon **attribué** (`awarded_at`), pas le slot le plus haut. |
| — | `utils/stampSlots.ts`, `__tests__/utils/stampSlots.test.ts` | Fonction pure de choix d'emplacement + 5 tests. |

Vérifications : `npx tsc --noEmit` OK, `npx jest` 97/97. Pas de changement de schéma SQLite ni de dépendance native : le dev client suffit pour tester, l'APK de prod doit être rebuildé.

**À tester sur téléphone avant diffusion** (scénarios ciblés) :
1. Mode avion → tampon sur un élève → réseau → lancer l'app : le tampon doit apparaître sur le web (avant : détruit).
2. Tampon web + tampon mobile hors ligne sur le même élève → sync : les deux présents, slots 1 et 2, sans trou.
3. Retirer un tampon depuis le mobile hors ligne → sync : il ne revient pas.
4. Élève à 10/10 → choix du bonus sur la PWA → tampon depuis le mobile : atterrit sur la carte n°2, la carte n°1 reste `completed`.
5. « Réinitialiser » un élève sur le web puis tampon mobile → sync : le tampon arrive sur la nouvelle carte n°1.

## F. Réalisation de P1 (2026-09-12)

| Correction | Où | Détail |
|---|---|---|
| A4 | `supabase-migrations/034_award_stamp_rpc.sql` (**appliquée en prod**), `gestion-classe-web/src/lib/rewardsQueries.ts` | RPC `award_stamp(p_student_id, p_category_id)` `SECURITY INVOKER` + `SET search_path` : carte active la plus récente (créée si absente), premier emplacement libre via `generate_series`, `pg_advisory_xact_lock` par élève. Le web l'appelle ; plus de `count + 1` ni de `.single()` ignoré. Le mobile garde son chemin local (offline-first) : les conflits sont désormais résolus par la sync P0. |
| B6 | `gestion-classe-mobile/app/(main)/session/[id].tsx` | Garde `isAwardingStamp` + bouton désactivé pendant l'écriture. |
| B4 | `rewardsQueries.ts`, `Rewards.tsx` | Bouton « Initialiser les cartes » et `initializeCardsForClass` supprimés : les cartes sont créées à la volée (RPC web, mobile, espace élève). |

Reste P2 : pull ciblé fiche élève + invalidation du cache, polling PWA, publication Realtime + souscription web, seed unique + nettoyage sûr des doublons, RLS (`WITH CHECK`, sous-requête `students`), `search_path` sur les RPC 011-013.

**Avant P0, un contrôle utile** : sur le téléphone de Thomas et d'Aurélie, exporter `SELECT * FROM stamps WHERE synced_at IS NULL` et `SELECT * FROM stamp_cards WHERE synced_at IS NULL` — ce sont les tampons qui seront détruits au prochain lancement si P0 n'est pas livré avant.

Requête SQL de contrôle des trous côté serveur :

```sql
SELECT card_id, count(*) n, max(slot_number) max_slot
FROM stamps GROUP BY card_id HAVING max(slot_number) <> count(*);
```
