# Plan — « Mes cours » : le foyer des cours et le ménage du menu

*14/11/2026. Spécification, pas de code. Détaille la phase 1 de `PLAN_vision_suite.md`.
Code lu sur master (PR #91, worktree `gc-worktrees/cours-claude`) ; rien n'a été essayé dans l'app.*

## 1. Le besoin

Thomas veut « une interface simple de visualisation et de modification de mes cours directement
depuis l'app », et des fonctions « disponibles et bien placées » plutôt qu'étalées.

Aujourd'hui, un cours se trouve à trois endroits qui ne se connaissent pas :

| Où | Ce qu'on y voit | Ce qu'on n'y voit pas |
|---|---|---|
| Module « Mes tableaux » de l'accueil (`BoardsPanel.tsx`) | Les originaux, par niveau › chapitre | Les copies placées sur un cours (écartées par `listBoards`), aucune recherche, aucun ordre stable |
| Calendrier de l'accueil (`LessonPopover.tsx`) | La copie placée sur un créneau de la semaine affichée | Les autres semaines, l'original d'où vient la copie |
| Détail d'une séance (`SessionDetail.tsx`) | Les pages annotées de cette séance (`BoardPagesGallery`) | Le chemin pour y arriver depuis le cours ou depuis la classe |

Il n'y a aucune entrée « Cours » dans le menu, et rien ne dit de quel original vient une copie.

## 2. Ce que le code permet déjà

| Besoin | Déjà là | Fichier |
|---|---|---|
| Lister les originaux | `listBoards` (sans les copies placées ni les modèles) | `lib/boardsQueries.ts` |
| Créer, renommer, ranger, supprimer | `createBoard`, `createCourse`, `updateBoard`, `deleteBoard`, formulaire `BoardMetaForm` | `BoardsPanel.tsx`, `lib/course/courseDoc.ts` |
| Ouvrir dans le bon éditeur, ou en présentation | `OpenPreparedBoard` (`present` pour « En classe ») | `components/course/OpenPreparedBoard.tsx` |
| Placer une copie sur un créneau | `createLessonBoard(userId, cours, sourceBoardId)` | `lib/timetable/lessonBoardsQueries.ts` |
| Savoir dans quelles séances un cours a servi | `fetchBoardUsages` (table `session_boards`) | `lib/boardsQueries.ts` |
| Voir les pages annotées d'une séance | `BoardPagesGallery` | `components/classroom/` |
| Réglages rangés dans le compte | `user_preferences` (migration 042), `savePreference` | `lib/userPreferences.ts` |
| Aperçu de PDF et de fichiers Office | `CloudFileViewer`, `PdfReader` | `components/clouds/` |

Ce qui manque dans les données : **la provenance** (de quel original vient une copie placée), et
un moyen de **chercher dans le texte** d'un cours (`boards.doc`, JSON).

## 3. Décisions proposées

| # | Décision | Raison |
|---|---|---|
| M1 | **Une page `/cours`, « Mes cours », dans le menu**, juste sous Accueil | Un foyer par notion (P1 du plan d'ensemble) |
| M2 | **Deux vues, pas plus** : *Bibliothèque* (les originaux, niveau › séquence › activité) et *Par classe* (ce qui est placé, à venir et passé) | La première sert à préparer, la seconde à retrouver |
| M3 | **Les tableaux blancs seuls restent dans la même liste**, avec leur icône | Un seul endroit où chercher ; ce sont aussi des supports de cours |
| M4 | **La séquence reste un texte** (`boards.chapter`) pour l'instant. Renommer une séquence renomme le champ sur tous ses cours | Pas de table à créer ; elle viendra avec la progression (« où en est chaque classe ») |
| M5 | **Ordre des séquences et des activités : tri naturel sur le titre** (« Activité 2 » avant « Activité 10 ») | Aujourd'hui l'ordre est celui de la dernière modification : il bouge à chaque retouche |
| M6 | **La provenance est une colonne** : `lesson_boards.source_board_id`, vide si l'original a disparu | Prévue à l'étape 4 de `PLAN_preparation_semaine.md` ; avancée ici parce que les deux vues en dépendent |
| M7 | **Un cours s'ouvre par une adresse** : `/cours?ouvrir=<id>&mode=texte|tableau|classe` | La recherche, le compte rendu de Claude et le calendrier pointent tous au même endroit |
| M8 | **Le module « Mes tableaux » de l'accueil devient « Repris récemment »** : les trois derniers cours ouverts et un lien vers la page | L'accueil garde un raccourci sans faire doublon |
| M9 | **Une ligne ne montre que ce qui sert à décider** : titre, type, classes où il est placé. Le reste est dans un menu « ⋯ » | Règles de `AUDIT_DENSITE_INFOS.md` (jamais de « 0 », pas de sous-titre de page) |
| M10 | **Sur téléphone : consulter et lancer, pas rédiger** | L'éditeur est pensé pour l'ordinateur |

## 4. La page

### Vue « Bibliothèque »

- **En haut :** un champ de recherche, « + Nouveau » (le formulaire actuel, inchangé), « Brouillon ».
- **La liste :** niveau (replié ou non, mémorisé) › séquence › activités. La séquence est un titre
  de groupe ; clic droit ou « ⋯ » pour la renommer.
- **Une ligne d'activité :**
  - icône du type (cours rédigé, tableau blanc) ;
  - titre — un clic ouvre en mode Texte (ou le tableau blanc) ;
  - pastilles des classes où une copie est placée, aux couleurs de `lib/classColors.ts` ;
    une pastille mène à la copie de cette classe ;
  - « ▶ » pour l'essayer en classe (mode test) ;
  - « ⋯ » : Placer sur un cours…, Dupliquer, Enregistrer comme modèle, Renommer / ranger,
    Supprimer.
- **« Placer sur un cours… »** : on choisit une classe, la page propose ses prochains créneaux
  sans document, on coche, une copie est créée par créneau. Un créneau déjà pris n'est jamais
  écrasé (D7).

### Vue « Par classe »

- **Un sélecteur de classe** (et de demi-groupe quand la classe en a).
- **À venir :** les créneaux qui ont un document, du plus proche au plus lointain.
- **Passé :** les créneaux joués, du plus récent au plus ancien. Chaque ligne dit si une séance a
  eu lieu ; si oui, elle ouvre **le tableau de fin de séance** (pages annotées, ce qui a été
  révélé) et propose **Exporter en PDF** pour les absents.
- **Par activité :** depuis une ligne, « Voir les autres classes » montre la même activité dans
  toutes les classes qui l'ont faite, côte à côte.
- Cette vue lit `lesson_boards` directement, pas l'emploi du temps : un document dont le libellé
  Pronote a changé reste trouvable ici, alors qu'il disparaît du calendrier (risque 5 de
  `PLAN_preparation_semaine.md`).

### Recherche

- **Dans les titres :** immédiate, sur la liste déjà chargée.
- **Dans le texte :** une fonction de la base qui extrait le texte du document et le compare,
  sans tenir compte des accents ni de la casse. Elle renvoie le cours et un extrait.
- **Dans les pages projetées** (texte des objets de `board_pages`) : second temps.

## 5. Les lots

Une PR par lot. Une migration n'est appliquée qu'après « Oui, applique-la ».

| Lot | Contenu | Migration | Taille |
|---|---|---|---|
| **C1** | Page `/cours` et son entrée de menu. Vue Bibliothèque reprise de `BoardsPanel` (formulaire extrait dans son fichier), tri naturel, renommer une séquence, adresse d'ouverture (M7), ligne à menu « ⋯ ». Le module de l'accueil devient « Repris récemment » | Non | M |
| **C2** | Recherche : titres, puis texte des cours | Oui (une fonction, aucune table) | P |
| **C3** | Provenance (`source_board_id`), pastilles de classes, « Placer sur un cours… » depuis la bibliothèque. Rattrapage des dix copies existantes par leur titre | Oui (une colonne) | M |
| **C4** | Vue « Par classe » : à venir, passé, tableau de fin de séance, « Voir les autres classes », export PDF | Non | M |
| **N1** | Ménage sans changer les habitudes : visibilité des onglets rangée dans le compte ; bascules mortes « Productions » et « Groupes » retirées ; « En direct » masquable et renommé ; un seul lecteur PDF | Non | P |
| **N2** | Maquette du menu regroupé (`public/_maquettes/`), à valider par Thomas | — | P |
| **N3** | Menu regroupé selon la maquette ; les anciennes adresses restent valables | Non | M |
| **R1** | Recherche globale : cours, classes, élèves, évaluations, outils, pages, réglages. Inactive quand un éditeur est ouvert (le tableau blanc a déjà son Ctrl+K) | Non | M |
| **F1** | Fichiers rattachés à une séquence : PDF, son, vidéo courte ; aperçu par les lecteurs existants ; « Reprendre depuis OneDrive » ; jauge d'espace | Oui (une table, un dossier de stockage) | M |

**Ordre proposé :** C1 → C2 → C3 → C4, puis N1, N2, N3, R1. F1 attend la décision de stockage
(question 4 du plan d'ensemble).

**Dépendances :**

- C3 livre la colonne dont a besoin l'étape 4 de `PLAN_preparation_semaine.md` : la skill
  « prépare ma semaine » devra la remplir.
- C4 ne montre l'encre que pour les séances démarrées au téléphone (limite connue).
- N3 ne commence qu'après la maquette N2.

### Lot C1 — ce qui est terminé quand

Thomas ouvre « Mes cours » depuis le menu, trouve l'activité Wegener sous 4e › Séquence 2, l'ouvre
en Texte, revient, la lance en test, et une adresse copiée depuis la barre du navigateur rouvre le
même cours. L'accueil n'affiche plus la liste complète.

### Lot C3 — ce qui est terminé quand

La ligne Wegener porte les pastilles 4A, 4B, 4C, 4D ; « Placer sur un cours… » pose une copie sur
un créneau libre de la 4A, et refuse un créneau déjà pris.

### Lot C4 — ce qui est terminé quand

« La correction de l'activité 3 avec la 4B » s'ouvre en trois clics depuis le menu, avec l'encre
de la séance, et sort en PDF.

## 6. Risques et points non vérifiés

| # | Point | Conséquence | Levé par |
|---|---|---|---|
| 1 | Le nombre de cours et de tableaux déjà en base, et si leurs chapitres sont remplis, n'a pas été mesuré | Une bibliothèque mal rangée dès l'ouverture | Compter avant C1 ; prévoir un groupe « À ranger » |
| 2 | La recherche dans le texte lit du JSON à chaque demande | Lente si les cours se comptent par centaines | Mesurer à C2 ; sinon une colonne de texte remplie à l'enregistrement |
| 3 | Le rattrapage de la provenance par le titre peut se tromper | Une pastille sur la mauvaise activité | Dix copies seulement : liste montrée à Thomas avant écriture |
| 4 | `BoardPagesGallery` n'a pas été lu en détail : affiche-t-il un cours sans pages projetées (encre rangée dans `session_boards.course_ink`) ? | Tableau de fin de séance vide pour ces cours | À vérifier au début de C4 |
| 5 | L'éditeur s'ouvre aujourd'hui par-dessus l'accueil, sans adresse | Le bouton Précédent du navigateur ne ferme pas l'éditeur | À traiter dans C1 avec M7 |
| 6 | Renommer une séquence touche plusieurs cours d'un coup | Une faute de frappe crée une séquence en double | Renommage par le titre de groupe uniquement ; la saisie libre du formulaire propose les séquences existantes |
| 7 | Un cours placé puis supprimé de l'emploi du temps | Document invisible au calendrier | La vue « Par classe » le montre toujours (§ 4) |

## 7. Questions ouvertes

1. **Le nom :** « Mes cours », avec les tableaux blancs seuls dedans (proposé), ou deux listes ?
2. **L'accueil :** « Repris récemment » (proposé), ou plus de module du tout ?
3. **Les copies placées :** seulement dans « Par classe » et par leurs pastilles (proposé), ou
   aussi dépliées sous l'original dans la bibliothèque ?
4. **Le tri naturel** suffit-il, ou veux-tu ranger les activités à la main ?
5. **Téléphone :** consulter et lancer seulement (proposé) ?

## 8. Avancement

| Lot | État |
|---|---|
| C1 — Page et bibliothèque | **Fait** le 14/11/2026 (branche `feat/mes-cours`, worktree `gc-worktrees/mes-cours`), pas encore commité |
| C2 — Recherche | **Codé** le 14/11/2026 (branche `feat/mes-cours-recherche`), pas commité ; migration 076 appliquée en prod le 14/11/2026 |
| C3 — Provenance et placement | **Codé** le 14/11/2026 (branche `feat/mes-cours-provenance`), pas commité ; migration 077 (sans clé étrangère) et rattrapage appliqués en prod le 14/11/2026 |
| C4 — Par classe et fins de séance | À faire |
| N1 — Ménage du menu | À faire |
| N2 / N3 — Menu regroupé | À faire |
| R1 — Recherche globale | À faire |
| F1 — Fichiers | En attente de la décision de stockage |

### Lot C1 — page et bibliothèque, fait le 14/11/2026 (branche `feat/mes-cours`)

- **Page `/cours`** (`pages/Courses.tsx`) et entrée « Mes cours » du menu, sous Accueil (dans
  « Plus » sur téléphone). Bibliothèque `components/courses/CourseLibrary.tsx` : niveau › séquence ›
  activité, tri naturel (`lib/courseLibrary.ts`, avec tests), niveaux repliables.
- **Une ligne** : type, titre (ouvre en Texte), « ▶ » pour l'essai en classe (cours rédigés), menu
  « ⋯ » : Dupliquer, Enregistrer comme modèle, Renommer / ranger, Supprimer. Suppression par la
  fenêtre de confirmation de l'application (plus de `window.confirm`).
- **Séquence** : « ⋯ » › Renommer la séquence, saisie sur place ; une seule requête
  (`renameChapter`), qui ne touche pas la date de modification. Le formulaire propose les
  séquences existantes du niveau.
- **Adresse d'ouverture** : `/cours?ouvrir=<id>&mode=texte|tableau|classe`, `ouvrir=brouillon` pour
  l'ardoise. Le bouton Précédent referme l'éditeur ; « Fermer » revient d'où l'on vient (accueil ou
  bibliothèque). Un cours hors bibliothèque (copie placée) est lu par son identifiant
  (`fetchBoard`) ; un identifiant inconnu affiche « introuvable » et revient à la liste.
- **Éditeur de cours** : retiré sans « Fermer » (bouton Précédent), il envoie quand même ce qui
  attendait ; `startInScreens` l'ouvre sur ses pages projetées.
- **Accueil** : le module `boards` devient « Repris récemment » (trois derniers cours retouchés,
  Brouillon, lien « Mes cours »). `BoardsPanel.tsx` est supprimé, son formulaire extrait dans
  `components/courses/BoardMetaForm.tsx`. Libellés « Mes tableaux » remplacés par « Mes cours ».
- **Vérifié** : `tsc -b`, 493 tests, et dans le navigateur avec le compte de Thomas : liste (9 cours,
  4 niveaux), ouverture et fermeture du brouillon (bouton, adresse, Précédent, depuis l'accueil),
  essai en classe de la fiche Wegener, création d'un cours d'essai, texte saisi puis Précédent
  (retrouvé à la réouverture), mode Tableau par adresse, duplication, renommage de séquence,
  suppression des deux cours d'essai, adresse d'un cours supprimé, affichage téléphone (375 px).
- **Non vérifié** : « Enregistrer comme modèle », « Renommer, ranger » sur un cours existant,
  duplication d'un tableau blanc seul, adresse d'une copie placée sur un créneau, vrai téléphone.
- **Constat** : la bibliothèque compte 9 cours, dont 5 sans niveau (plusieurs brouillons : « gfds »,
  « gfh », « rty », « test »). Le risque 1 du § 6 est levé : rien à migrer, un peu de ménage à faire.
- **Écart** : l'erreur de lint de `Layout.tsx` (un `any`, ligne 226) existait avant ce lot.

### Lot C2 — recherche, codé le 14/11/2026 (branche `feat/mes-cours-recherche`, empilée sur C1)

- **Champ de recherche** en tête de la page. Sans casse ni accents ; tous les mots demandés doivent
  être présents ; Échap efface.
- **Titres, séquences et niveaux** : à chaque frappe, sur la liste chargée (`filterBoards`). La
  bibliothèque garde son rangement et déplie tous les niveaux pendant la recherche.
- **Texte des cours rédigés** : fonction `search_courses` (migration `076_search_courses.sql`), appelée
  0,3 s après la dernière frappe. Section « Dans le texte » : titre du cours et extrait, mots trouvés
  surlignés. Seuls les cours de la bibliothèque y figurent (pas les copies placées).
- **Sans la migration** : la recherche se limite aux titres, sans message d'erreur (un avertissement
  dans la console).
- **Vérifié** : `tsc -b`, 505 tests (dont `courseSearch.test.ts`). Dans le navigateur : « derive
  wegener » (2 cours), « 3e microb » (1 cours, par le niveau), terme absent (« Aucun cours ne
  correspond »), Échap. La requête de la fonction, essayée en lecture seule sur la base : 11 cours
  rédigés, 10 avec du texte, le plus long de 4 462 caractères ; « Dérive WEGENER » en trouve 10
  (les 2 originaux et les 8 copies placées) ; longueurs du texte et de sa version repliée égales.
- **Migration 076 appliquée en prod le 14/11/2026.** Vérifié ensuite dans le navigateur : « demarches
  scientifiques » (absents de tout titre) affiche la fiche Wegener dans « Dans le texte », avec
  l'extrait et les trois mots surlignés.
- **Non fait** : le texte des pages projetées n'est pas cherché (second temps du § 4).
- Le risque 2 du § 6 est levé pour l'instant : la recherche lit une dizaine de cours courts.

### Lot C3 — provenance et placement, codé le 14/11/2026 (branche `feat/mes-cours-provenance`, empilée sur C2)

- **Migration `077_lesson_board_source.sql`** : `lesson_boards.source_board_id` et son index, **sans clé
  étrangère** (voir l'incident plus bas). Appliquée en prod le 14/11/2026.
- **Écriture de la provenance** (`createLessonBoard`) : une copie faite depuis la bibliothèque note
  son original ; une copie faite depuis le tableau d'un autre cours (« copier vers les autres
  classes ») garde l'original de celui-ci. Sans la migration, le cours est placé quand même.
- **Pastilles de classes** sur chaque original (`lib/coursePlacements.ts`, avec tests) : une par
  classe, à la couleur de son niveau ; elle ouvre la copie du prochain cours de cette classe, sinon
  du dernier passé ; l'infobulle donne les dates.
- **« Placer sur un cours… »** (`PlaceCourseDialog.tsx`), dans le menu « ⋯ » : onglets de classes (celle
  du niveau du cours d'abord), prochains cours sur 5 semaines, cases à cocher sur plusieurs classes à
  la fois ; un créneau qui a déjà un document est grisé, avec son titre. La copie garde le titre de
  l'activité (avant : « 4A · mer. 18 nov. »).
- **Créneaux lus dans l'emploi du temps enregistré** (import .ics). Pronote en direct n'est pas lu ici.
- **Vérifié** : `tsc -b`, lint des fichiers touchés, 511 tests. Dans le navigateur, sans la
  migration : la page s'affiche sans pastille et sans erreur ; la fenêtre de placement de la fiche
  Wegener s'ouvre sur la 4A, grise les 18 et 25 novembre (déjà pris) et propose les cinq cours
  suivants ; fermée sans rien placer.
- **Rattrapage fait** le 14/11/2026 : 8 copies « Wegener » ont chacune un seul original du même titre. Deux
  tableaux créés à la main sur un créneau (« 4B · lun. 16 nov. », « 5D · lun. 16 nov. ») n'ont pas
  d'original et restent sans provenance.
- **Vérifié après la migration** : pastilles 4A, 4B, 4C, 4D sur la fiche Wegener et sur sa correction.
  Avec un cours d'essai : placé sur le cours de la 3A du 18 décembre, la pastille « 3A » apparaît,
  elle ouvre la copie (même titre que l'original), la base porte bien l'original. Les deux lignes
  d'essai ont été supprimées ; la base est revenue à ses 10 liens, dont 8 avec original.
- **Incident du 14/11/2026.** La première version de la migration ajoutait une clé étrangère
  `source_board_id → boards`. C'était une seconde relation entre `lesson_boards` et `boards` : les
  lectures `lesson_boards → boards(...)` de l'application en ligne sont devenues ambiguës pour
  PostgREST (PGRST201) et ont échoué pendant quelques minutes — documents absents du calendrier
  et de `/classe`. Repéré par l'échec du placement d'essai, corrigé en retirant la contrainte
  (la colonne et ses valeurs sont restées). Le fichier 077 décrit l'état final ; un commentaire
  garde-fou est posé à côté de la lecture concernée (`lessonBoardsQueries.ts`). L'application
  mobile ne lit pas cette table.
- **Conséquence** : la colonne peut désigner un original supprimé. Sans effet aujourd'hui (une
  pastille ne s'affiche que sur un original présent) ; à garder en tête pour le lot C4.

