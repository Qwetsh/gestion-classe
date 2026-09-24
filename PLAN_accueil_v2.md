# Plan — Accueil v2 : l'emploi du temps au centre

*Rédigé le 24/09/2026. Fait suite à `PLAN_accueil_modulaire.md` (grille déplaçable, livrée le 24/09/2026).*

## 1. Constat

L'accueil actuel est un tableau de **statistiques à consulter** ; rien n'y pousse à agir, et on ne l'utilise pas.

- « Élèves à suivre » (`kpi-alerts`) : un nombre, et un « Voir » vers `/students` en général. Doublon de « À regarder avant demain ».
- « À regarder avant demain » (`student-alerts`) : des noms, mais chaque ligne mène à `/students` ; la liste ne dépend pas de demain et ne se « traite » jamais.
- « Moyenne d'implication », « Moyenne par classe » : aucune décision n'en découle.
- « Séances de la semaine » : unité « stable » codée en dur (`KpiModules.tsx:41`).
- L'emploi du temps n'existe que si Pronote est connecté, et il est relégué en bas de page.

## 2. Principes (décidés avec Thomas)

1. **Zéro saisie sur l'accueil.** Pas de liste de tâches à tenir à jour : c'est trop lourd.
2. **Complémentaire de Pronote, jamais en doublon.** L'accueil montre ce que l'appli sait et que Pronote ne sait pas ; on ne refait pas son travail (devoirs, absences officielles, cahier de texte…).
3. **L'emploi du temps est le cœur de l'accueil** : en grand, **vue semaine**, en haut de page.
4. **Trois sources** : Pronote connecté, sinon import `.ics`, sinon saisie manuelle.
5. **Pronote est prioritaire** : s'il est connecté, on l'affiche même si un `.ics` a été importé (il est plus à jour).

## 3. Le fichier `.ics` exporté de Pronote

Analyse de `mesinformations.ics` (export du 24/09/2026, 13 703 lignes) :

| Élément | Constat |
|---|---|
| Période | `X-CALSTART` 31/08/2026 → `X-CALEND` 02/07/2027, soit l'année entière |
| Occurrences | **769 `VEVENT`, aucune `RRULE`** : chaque cours est écrit en entier (semaines A/B et exceptions déjà résolues) |
| Heures | `DTSTART:20260902T081500Z` en **UTC** ; il faut convertir en Europe/Paris |
| Statut | `CATEGORIES` : `Cours` (676), `Cours - Cours annulé` (58), `Cours - Accompagnement modifié` (18), `Cours - Réservation de matériel` (6), `Cours - Cours modifié`, `Cours - Cours maintenu`, `Cours - Exceptionnel` |
| Congés | `CATEGORIES:Jours fériés`, journée entière (`DTSTART;VALUE=DATE:`), `SUMMARY` = « Vacances » ou nom du férié ; `DTEND` exclusif |
| Classe entière | `SUMMARY:SCIENCES VIE & TERRE - 4D`, `DESCRIPTION` contient `Classe : 4D` |
| Demi-groupe | `SUMMARY:SCIENCES VIE & TERRE - [3°EP1] - <3E> 3°EP1`, `DESCRIPTION` contient `Groupe : [3°EP1]` et `Partie de classe : <3E> 3°EP1` |
| Préfixe annulé | `SUMMARY:Cours annulé : …` (à retirer avant de lire le nom) |
| Autres | `Matière :` (SVT, Physique-Chimie, Devoirs faits, Vie de classe), `Salle :` / `LOCATION`, `Accompagnant :` parfois |
| Identifiant | `UID:Cours-40048-1-<horodatage d'export>-Index-Education` |

Pièges du parseur :
- **Lignes repliées** (RFC 5545) : une ligne commençant par un espace prolonge la précédente. Il faut les déplier avant tout, car le repli tombe au milieu des mots (« C\n HARLES »).
- **Échappements** : `\n`, `\,`, `\;`, plus des entités HTML (`&amp\;`, `&lt\;`, `&gt\;`) dans `DESCRIPTION`.
- **`UID` instable** : il contient l'horodatage de l'export (`20260924T195501Z`). La **clé stable** est `Cours-40048-1`, c'est-à-dire l'UID sans ce segment (vérifier sur un second export).
- Paramètres de propriété (`SUMMARY;LANGUAGE=fr:`) : couper sur le premier `:` **après** les paramètres.

→ On écrit un petit parseur maison, sans dépendance, testé sur un extrait anonymisé de ce fichier.

## 4. Modèle de données

Migration **043_timetable.sql** (appliquée en prod le 24/09/2026) :

- `timetable_entries` : `source` (ics | manual), `external_id` (clé stable), `kind` (lesson | holiday), `starts_at`, `ends_at`, `label`, `class_label`, `subject`, `room`, `status` (normal | canceled | modified | exceptional). Unicité `(user_id, source, external_id)`.
- `timetable_label_links` : `(user_id, label)` → `class_id`, `group_id`, `ignored`.
- **Écart avec la première version du plan** : les cours ne portent **pas** de `class_id`/`group_id`. Ils gardent le libellé Pronote, et la correspondance est résolue à la lecture via `timetable_label_links`. Corriger une correspondance ne réécrit donc aucun cours.
- Le résumé du dernier import (date, fichier, nombre de cours, période) est rangé dans `user_preferences`, clé `timetable_import`.

- La **semaine type manuelle** (lot 4) est stockée dans `user_preferences` (clé `timetable_pattern`) : pas de nouvelle table, elle sert seulement à générer les `timetable_entries`.
- La **source active** est calculée, pas stockée : Pronote si la session Pronote est valide, sinon `timetable_entries`.
- Les libellés Pronote en direct (`groupNames`) passent par les mêmes `timetable_label_links`, ce qui unifie la correspondance.

## 5. Découpage en lots

### Lot 1 — Import `.ics` et correspondance des classes ✅ livré le 24/09/2026
- `lib/timetable/icsParser.ts` : dépliage, échappements, extraction des VEVENT → `{ externalId, kind, startsAt, endsAt, label, subject, room, status }`. **Tests** sur un extrait du vrai fichier (cours normal, annulé, demi-groupe, vacances, ligne repliée au milieu d'un mot).
- `lib/timetable/labelMatching.ts` : propose une correspondance automatique. « 4D » → classe dont le nom finit par « 4D » ; « <3E> 3°EP1 » → classe 3E puis groupe dont le nom contient « 1 » (ou « EP1 »), à défaut classe 3E entière. **Tests** unitaires.
- Écran d'import (dans Réglages › Emploi du temps, plus un bouton sur l'accueil quand il n'y a aucune source) :
  1. dépôt du fichier ;
  2. résumé (« 711 cours, 8 congés, du 31/08 au 02/07 ») ;
  3. tableau de correspondance libellé → classe/groupe/« ignorer », pré-rempli ;
  4. enregistrement.
- **Réimport** = synchronisation : upsert par `external_id`, suppression des entrées `source='ics'` absentes du nouveau fichier. La saisie manuelle n'est jamais touchée.
- Migration 043.

### Lot 2 — Grand emploi du temps de la semaine sur l'accueil ✅ livré le 24/09/2026
- Nouveau module `week-timetable` qui **remplace** `timetable`, sur toute la largeur en haut de page.
  - *Réalisé* : `lib/timetable/weekView.ts` (répartition par jour, cours superposés côte à côte, annulé remplacé masqué, congés), semaine unifiée calculée dans `HomeDataContext` (`week`, `weekSource`, `weekLoading`), `modules/WeekTimetableModule.tsx`, ancien `TimetableModule.tsx` supprimé. `HOME_LAYOUT_VERSION` = 2 avec `upgradeLayout` : une disposition v1 personnalisée est **conservée**, décalée sous l'emploi du temps (pas de retour aux défauts).
- Couche d'accès unique `useTimetableWeek(weekOffset)` → `TimetableLesson[]`, quelle que soit la source (Pronote en direct, ou `timetable_entries`). Les modules ne savent pas d'où vient l'emploi du temps.
- Affichage : 5 colonnes (lundi à vendredi, plus le samedi s'il y a des cours), axe horaire de 8 h à 18 h, **aujourd'hui mis en avant**, **ligne rouge à l'heure actuelle**, navigation semaine précédente/suivante, bouton « Aujourd'hui ».
- Cours : pastille de couleur de la classe, nom, salle, heures. Cours **annulé** barré et atténué ; **vacances/fériés** en bandeau grisé sur la colonne.
- Petite mention de la source (« Pronote · en direct » / « Importé le 24/09 ») avec un lien pour réimporter.
- Aucune source : un état vide avec deux choix, « Importer un fichier .ics » / « Saisir ma semaine ».

### Lot 3 — Enrichir chaque cours (la complémentarité) ✅ livré le 24/09/2026
Pour chaque cours relié à une classe, on superpose ce que seule l'appli connaît :

| Cours | On affiche | Clic |
|---|---|---|
| **Passé** avec séance enregistrée | sujet de la séance, pastilles +bonus / −malus / absences | ouvre `/sessions/:id` |
| **Passé** sans séance | rien (Pronote suffit) | — |
| **En cours** | mis en valeur ; compteurs en direct si une séance est ouverte | « Lancer le mode classe » |
| **À venir** | dernier tableau utilisé avec cette classe (`session_boards` de sa dernière séance) | menu : plan de classe, tableau, démarrer la séance |

- Rapprochement cours ↔ séance : même `class_id` (et `group_id` s'il est défini) et chevauchement horaire, avec une tolérance de 15 min (une séance démarrée en avance ou en retard).
  - *Réalisé* : `assignSessions` (weekView.ts) rattache chaque séance à **un seul** cours, celui dont le début est le plus proche (cas réels du 22/09 : séance lancée à 14 h 37 → cours de 14 h 40, pas celui de 13 h 40 ; séance de 15 h 48 → réunion de 15 h 40, pas le cours de 16 h 10).
  - Sur la case : un cours fait affiche son bilan (+bonus −malus abs, sujet) à la place de l'heure et de la salle.
  - Clic sur un cours → `LessonPopover` (portail) : séance enregistrée + « Voir la séance », dernier tableau projeté (ouvre `BoardWorkspace` via `openBoard(board)`), élèves à surveiller de la classe (liste complète des alertes, plus la top 5), boutons Mode classe (aujourd'hui), Plan de classe, Élèves.
  - Liens profonds ajoutés : `/classes?class=<id>` et `/students?class=<id>&student=<id>` (ouvre la fiche).
  - Requêtes : `lib/timetable/enrichmentQueries.ts` (séances de la semaine affichée + compteurs, dernier tableau par classe via `session_boards`).
- Toutes les requêtes vivent dans `HomeDataContext` (règle du lot 0 de l'accueil modulaire).
- Les alertes élèves ne disparaissent pas : elles réapparaissent **par classe**, dans le détail d'un cours à venir (« 2 élèves à surveiller : Léa M., Noah B. »), chaque nom menant à sa fiche.

### Lot 4 — Saisie manuelle de la semaine type
- Éditeur de semaine type : créneaux (jour, début, fin, classe ou groupe, salle, semaine A / B / toutes).
- Réglages : date de début de l'année, parité de la semaine A, zone de vacances (A/B/C), à partir du calendrier scolaire officiel intégré en dur pour 2026-2027.
- Génération des `timetable_entries` (`source='manual'`) jusqu'à la fin de l'année, en sautant les vacances ; une modification de la semaine type régénère les cours **futurs** seulement.
- Si un `.ics` est importé ensuite, on propose de remplacer la saisie manuelle.

### Lot 5 — Nettoyage de l'accueil
- Retirer du registre : `kpi-alerts`, `student-alerts` (fondus dans le lot 3), `kpi-implication`, `kpi-sessions`.
- `class-averages` : retiré de la disposition par défaut (il reste dans la bibliothèque). Le déplacer vers Analytics est à discuter.
- `next-lesson` : absorbé par le grand emploi du temps (le cours à venir y est déjà mis en avant), donc retiré.
- Nouvelle `DEFAULT_HOME_LAYOUT` : `week-timetable` (12 colonnes, en haut), puis `quick-actions`, `recent-sessions`, `boards`.
- Passer `HOME_LAYOUT_VERSION` à 2 : `mergeLayout` remplace alors les dispositions enregistrées par les nouveaux défauts (comportement existant). Les identifiants retirés doivent être ignorés sans erreur.
- Nettoyer `HomeDataContext` des calculs devenus inutiles (`avgImplication`, `alertCount`, `weekSessions*`).

## 6. Hors périmètre (volontairement)
- Liste de tâches ou toute saisie sur l'accueil.
- Devoirs, cahier de texte, absences officielles : c'est le rôle de Pronote.
- Abonnement à une URL iCal distante (Pronote n'en fournit pas de stable) : on réimporte le fichier.
- Emploi du temps sur mobile : les données seront prêtes (Supabase), mais l'affichage attendra un plan à part.

## 7. Points à vérifier en cours de route
- **Doublons annulé / remplacé** (constaté dans l'export) : un cours annulé et un cours « Réservation de matériel » peuvent occuper le même créneau avec le même libellé et deux UID différents (ex. 3°EP1 le 03/09 à 15 h 40). Au lot 2, masquer l'annulé quand un cours non annulé du même libellé le chevauche.
- Stabilité de la clé `Cours-XXXXX-N` entre deux exports (faire un second export plus tard et comparer).
- « Devoirs faits 6D » et « Vie de classe 5D » : les proposer par défaut comme « ignorer » ou comme classe ? Probablement « ignorer » pour Devoirs faits, et relier Vie de classe à la classe 5D.
- Aurélie : sans Pronote, elle passe par l'import `.ics` (son export Pronote doit avoir le même format).
