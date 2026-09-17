# Audit de rentrée 2026-2027 — Bugs & UX

> Audit réalisé le 29/08/2026. Couverture : compilation + tests des deux apps, advisors Supabase (prod),
> audit approfondi de Students.tsx, Evaluations, Brevets, Pronote, TpTemplates, liveSessionQueries,
> sync mobile (syncService, useAutoSync, migrations SQLite). Non couverts en profondeur (limite de session
> atteinte pendant l'audit) : Analytics, Academy, Rewards, StudentDashboard, écrans mobiles UI, Layout détaillé.

## 🔴 Critiques — à corriger avant la rentrée

1. **`gestion-classe-web/src/lib/liveSessionQueries.ts:251` — `getCurrentTrimester()` renvoie toujours 1.**
   `if (month >= 9 || month <= 12)` est vrai pour tous les mois (il fallait `&&`). Toutes les évaluations
   orales de l'année écoulée ont été enregistrées/lues/supprimées comme « trimestre 1 ».
   → Corriger le `||` en `&&`, et vérifier/requalifier les `oral_evaluations` existantes en base.

2. **`gestion-classe-mobile/services/sync/syncService.ts:1196` — `occupiedSlots.set(...)` sur un `Set`.**
   `.set` n'existe pas sur `Set` (il fallait `.add`). Dès que le serveur possède déjà des tampons pour une
   carte, la sync des tampons crashe (TypeError). La résolution de conflits web/mobile des cartes à tampons
   n'a jamais fonctionné. (Erreur visible via `npx tsc --noEmit`.)

3. **`gestion-classe-mobile/stores/authStore.ts:37,43` — `.catch()` sur un builder Supabase.**
   Le builder ne s'exécute qu'au `then`/`await` ; l'appel `.catch` jette une TypeError avalée par le
   try/catch englobant → les RPC `track_user_activity` et `log_device_connection` ne partent **jamais**
   depuis mobile. Les métriques de connexion mobile sont silencieusement mortes.
   → `supabase.rpc(...).then(undefined, () => {})` ou `void (async () => { await ... })().catch(...)`.

4. **`gestion-classe-web/src/pages/Students.tsx:1059-1122` — `handleEndYear` : ~15 suppressions sans aucun
   contrôle d'erreur.** supabase-js ne throw pas ; si une étape échoue à mi-parcours (réseau, RLS, FK,
   limite d'URL du `.in()` avec des centaines d'UUID), on obtient un état hybride irrécupérable avec un
   toast de succès. C'est l'action la plus destructive de l'app.
   → Idéalement : déplacer toute la clôture dans une fonction Postgres (RPC) transactionnelle.

5. **`gestion-classe-web/src/pages/TpTemplates.tsx:383-387` — sauvegarde des critères = delete puis insert
   non transactionnels.** Si le delete réussit et l'insert échoue (réseau), le barème est définitivement
   perdu. Aggravé par `handleOpenEdit` (l.327) qui ouvre la modale avec un critère vide si le chargement
   échoue → l'enregistrement écrase les vrais critères. → upsert/RPC transactionnelle + vérifier les erreurs.

6. **`gestion-classe-web/src/lib/pronoteFetcher.ts:10,38` — proxy Pronote appelé sans Authorization.**
   Si l'Edge Function `pronote-proxy` a `verify_jwt` désactivé (nécessaire pour que ça marche telle
   qu'appelée), c'est un proxy SSRF ouvert sur Internet (`?url=` arbitraire), utilisable par n'importe qui
   aux frais du projet. → Vérifier la config, exiger le JWT + une allowlist de domaines Pronote.
   Aussi : jeton Pronote (compte prof) stocké en clair en localStorage alors que l'UI affirme
   « Vos données ne sont pas stockées » (Pronote.tsx:31-40 vs l.551).

7. **Base de prod partagée avec un projet de jeu, tables ouvertes en anon.** Les tables `characters`,
   `chests`, `games`, `monsters`, `quests`, `shops`, `map_hexes`, `players`, `questions`… ont des policies
   `anon` CRUD **sans aucune condition** : quiconque extrait la clé publique du bundle peut tout lire/écrire/
   supprimer. Elles cohabitent avec les données élèves dans le même projet Supabase (Class'it).
   → Déplacer ce projet dans une autre base, ou verrouiller les policies.

8. **`gestion-classe-web/src/pages/Students.tsx:365-375` — corruption possible des `trimester_boundaries`.**
   Erreur réseau ignorée → `boundariesData` undefined → insertion d'un nouveau boundary « maintenant »
   (non awaitée, sans upsert) → doublons possibles → compteurs de participation remis à zéro en plein
   trimestre + notes calculées depuis l'epoch pour le rendu en cours. Le double-mount StrictMode peut aussi
   créer 2 boundaries. → contrainte UNIQUE (user_id, trimester, school_year) + upsert + gestion d'erreur.

## 🟠 Majeurs

- **Students.tsx:786** — le « rapport du trimestre » agrège les événements de TOUTE l'année (filtre
  `trimesterStartDate` manquant malgré le commentaire). Faux dès le T2.
- **Students.tsx:1206, 2955** — le modal élève affiche « Événements du trimestre (N) » mais la requête
  n'a aucun filtre de date : c'est toute l'année. Incohérent avec les compteurs juste au-dessus.
- **Students.tsx:1176-1232** — race condition : cliquer élève A puis vite élève B peut afficher la fiche
  de B avec les événements/tampons de A. Même motif dans Evaluations.tsx:120 (copies/notes de la mauvaise
  éval), TpTemplates.tsx:187 (détail du mauvais TP), Pronote.tsx:353 (cours de la mauvaise semaine),
  Students.tsx:598 (stats de connexion de la mauvaise classe). → pattern commun : garde-fou par
  numéro de séquence ou AbortController.
- **Students.tsx:1316** — `addManualParticipation` : insert non vérifié, échec 100 % silencieux (le modal
  se ferme, le prof croit la participation enregistrée).
- **Students.tsx:868** — `handleNextTrimester` : settings avancés puis insert du boundary non garanti →
  trimestre sans borne de début.
- **syncService.ts (mobile) `pullFromServer` ~l.1404** — un élève déplacé vers une autre classe sur le web
  n'est jamais mis à jour sur mobile (l'UPDATE ne touche que `is_deleted`/`synced_at`, pas `class_id`
  ni `pseudo`). Il reste affiché dans son ancienne classe.
- **migrations.ts (mobile) l.262 — `students.class_id NOT NULL` en SQLite** alors que le passage d'année
  met `class_id = NULL` côté serveur : entre la clôture et le ré-import, les élèves conservés ne peuvent
  pas redescendre sur mobile (échec d'INSERT silencieux, loggé seulement).
- **syncAll (mobile)** — une seule erreur (ex. FK sur un événement orphelin après la clôture d'année côté
  web) fait échouer toute la chaîne à chaque tentative : la file devient « empoisonnée » et plus rien ne
  se synchronise. → isoler les erreurs par table/ligne, marquer les lignes en échec.
- **customAnnales.ts:104** — suppression : l'échec du remove Storage est ignoré alors que le bucket est
  public → PDF orphelin accessible à jamais, sans trace dans l'UI.
- **Pronote.tsx:396-405** — le filtrage des cours compare seulement jour-de-semaine + heure, jamais la
  date (le `dayDate` calculé n'est pas utilisé) ; les cours du samedi sont invisibles.

## 🟡 Mineurs (sélection)

- Students.tsx : chips de filtre qui excluent les témoins mais liste qui les affiche (l.640 vs 655) ;
  « Note de base 10/20 » affichée en mode objectif (l.1750) ; « /25 sessions » en dur (l.1904) ;
  tri « Tendance » qui trie par participations (l.1858) ; pagination sans clé de tri secondaire (l.417) ;
  « Aujourd'hui/Hier » calculés en périodes de 24 h (l.160) ; double comptage T3 possible dans le rapport
  de fin d'année (l.924) ; `student_connections` jamais purgées à la clôture (les stats cumulent les années).
- Evaluations.tsx : double fetch après upload (l.164) ; erreurs de chargement avalées (l.84) ;
  fichiers Storage orphelins à la suppression (evaluationQueries.ts:186).
- Brevets.tsx : `annee`/`points` non validés → « Session 0 » ou « Session NaN » (l.406).
- TpTemplates.tsx : stats de liste muettes en cas d'erreur (l.148) ; photos orphelines à la suppression
  d'un modèle (l.476) ; mutation directe du state (l.419).
- Mobile : test `sessionLifecycle.test.ts` cassé — le mock de `services/database/client` ne déclare pas
  `executeTransaction` (à ajouter au mock) ; pull des classes : un renommage côté web ne redescend jamais.

## 🗄️ Supabase (advisors prod — aucune table sans RLS ✅)

- Protection « leaked password » désactivée (auth) → activer, c'est gratuit.
- 15 fonctions avec `search_path` mutable, 12 fonctions SECURITY DEFINER exécutables par `anon`
  (`get_student_dashboard`, `submit_academy_test`, `get_connection_stats`, `get_table_row_counts`,
  `parc_equipement_public`…) → vérifier que chacune est bien censée être publique, fixer
  `SET search_path = ''` partout.
- Extension installée dans le schéma `public`.

## ✅ Sains / vérifiés

- `tsc -b` web : OK. 89/90 tests mobile OK.
- RLS multi-tenant des tables de classe : policies scoped (pas de fuite inter-profs détectée).
- `getCurrentSchoolYear()` bascule correctement en septembre (web : `month >= 8`… attention, deux
  implémentations coexistent : Students.tsx bascule en août, liveSessionQueries.ts en septembre — à unifier).
- Pull mobile : garde-fous corrects contre la perte de données sur erreur réseau.
- Navigation web : 5 entrées principales + « Plus », conforme au design handoff.

## 🎨 UX / design

**Points forts** : le design handoff (Acceuil.png, rendu plandeclasse.png, Modalepourséance.png) est
d'un très bon niveau — hiérarchie claire du Dashboard (prochaine séance en héros, « À regarder avant
demain », raccourcis), métaphore pupitre/étiquettes du plan de classe lisible et chaleureuse, timeline de
séance sobre et scannable. La navigation 5+Plus est le bon choix pour 17 pages.

**Recommandations priorisées** :
1. **Balayage des accents** : de nombreux libellés/toasts sont sans accents (« Annee cloturee »,
   « Evenements », « Aucun critere », fichier « Acceuil.png »…). Pour un outil destiné à une prof de
   français, c'est le défaut le plus visible et le moins cher à corriger. Grep `Annee|Evenement|eleve`
   dans les chaînes UI.
2. **Stratégie d'erreur globale** : le motif n°1 de tout l'audit est l'échec silencieux (insert/delete
   non vérifiés + toast de succès). Créer un helper `unwrap(await supabase...)` qui throw + un toast
   d'erreur générique, et l'utiliser partout. Ça transforme 15 bugs en 1 correctif.
3. **Pattern anti-race-condition** : un petit hook `useLatest`/AbortController réutilisable pour toutes
   les modales de détail (élève, éval, TP, Pronote).
4. **États vides/chargement** : plusieurs pages affichent « 0 critère · 0 séance » ou « Aucune classe »
   en cas d'erreur réseau — distinguer visuellement « vide » de « erreur ».
5. **Cohérence des périodes** : unifier le calcul trimestre/année scolaire dans UN module partagé
   (web + mobile), piloté par `trimester_settings` plutôt que par la date calendaire.

## 📋 Checklist rentrée

- [ ] Corriger les 3 bugs « one-liner » : `getCurrentTrimester` (&&), `occupiedSlots.add`, `.catch` authStore.
- [ ] Synchroniser les mobiles AVANT toute clôture/modification massive côté web (file empoisonnée sinon).
- [ ] Rendre `students.class_id` nullable dans SQLite mobile (+ migration) et mettre à jour `class_id`
      au pull.
- [ ] Activer la protection leaked-password Supabase.
- [ ] Isoler ou verrouiller les tables du projet de jeu.
- [ ] Vérifier `verify_jwt` de l'Edge Function `pronote-proxy`.
- [ ] Requalifier les `oral_evaluations` mal trimestrées en base.
