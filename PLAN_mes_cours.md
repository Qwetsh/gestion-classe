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
| C1 — Page et bibliothèque | **Fusionné dans master le 14/11/2026** (PR #92) |
| C2 — Recherche | **Fusionné dans master le 14/11/2026** (PR #93, migration 076) |
| C3 — Provenance et placement | **Fusionné dans master le 14/11/2026** (PR #94, migration 077) |
| C4 — Par classe et fins de séance | **Fusionné dans master le 14/11/2026** (PR #95 ; la partie « passé » reste à voir après une vraie séance) |
| N1 — Ménage du menu | **Fusionné dans master le 14/11/2026** (PR #96) |
| N2 — Maquette du menu regroupé | **Fusionnée dans master le 15/11/2026** (PR #97) ; Thomas a retenu la variante A |
| N3 — Menu regroupé | **Fusionné dans master le 15/11/2026** (PR #97), après essai de Thomas dans la prévisualisation |
| R1 — Recherche globale | **Fusionné dans master le 15/11/2026** (PR #98), après essai de Thomas dans la prévisualisation |
| F1 — Fichiers | **Fusionné dans master le 15/11/2026** (PR #99, migration 078) ; la phase 1 est terminée |

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

### Lot C4 — vue par classe et fins de séance, codé le 14/11/2026 (branche `feat/mes-cours-par-classe`, empilée sur C3)

- **Deux vues** en tête de page : « Bibliothèque » et « Par classe » (`?vue=classes&classe=…`). La
  vue reste la même sous l'éditeur, et le bouton Précédent y revient.
- **Par classe** (`components/courses/ClassCourses.tsx`) : onglets des classes qui portent un
  document (et « Sans classe » s'il en reste), puis « À venir » (du plus proche au plus lointain) et
  « Passé » (du plus récent au plus ancien). Une ligne : date, demi-groupe, titre (ouvre la copie
  de la classe), essai en classe.
- **Lecture directe de `lesson_boards`** (`fetchPlacedDocuments`), sans passer par l'emploi du temps :
  un document dont le créneau a disparu reste trouvable. Une seule lecture sert aux pastilles de la
  bibliothèque et à cette vue.
- **Fin de séance** : un cours qu'une séance a joué (table `session_boards`) porte un bouton « Fin de
  séance » qui déplie, sous la ligne, la galerie existante (`BoardPagesGallery`) : pages annotées,
  agrandissement, export PDF. Un cours du jour passe dans « Passé » dès qu'une séance l'a joué.
- **« Voir les autres classes »** (`?activite=<original>`), dans le menu « ⋯ » d'une copie placée dans
  plusieurs classes : la même activité, une ligne par classe avec sa pastille.
- **Vérifié** : `tsc -b`, lint des fichiers touchés, 519 tests (dont le rangement à venir / passé et
  le choix de la séance). Dans le navigateur, avec les 10 documents réels : onglets 4A, 4B, 4C, 4D,
  5D ; les deux documents de la 4A ; les trois de la 4B, dont « 4B · lun. 16 nov. » sans menu (pas
  d'original) ; « Voir les autres classes » (4 lignes avec pastilles) ; Précédent ; essai en classe
  depuis la vue, puis retour sur la même classe.
- **Non vérifié, faute de données** : aucune séance n'est encore reliée à un document dans la base
  (0 ligne dans `session_boards`), et aucun document n'est passé. La section « Passé », le bouton
  « Fin de séance », la galerie dépliée et l'export PDF depuis cette vue restent à voir après les
  cours du 16 au 25/11.
- **Limite (risque 4 du § 6, confirmé)** : la galerie montre les pages de tableau de la séance. Un
  cours projeté en bande, sans pages projetées, ne laisse que de l'encre rangée à part
  (`session_boards.course_ink`) : elle n'apparaît pas ici, la galerie dit alors qu'aucune page n'a
  été laissée.
- **Limite** : au-delà de 1 000 documents placés, seuls les plus récents sont lus.

### Mise en ligne des lots C1 à C4 — 14/11/2026

PR #92, #93, #94 et #95 fusionnées dans master dans cet ordre (dernier commit `5b9f962`), déploiement
GitHub Pages réussi. À regarder en vraie séance : la section « Passé » et « Fin de séance » du lot C4.

### Lot N1 — ménage du menu, codé le 14/11/2026 (branche `feat/menu-menage`, depuis master)

- **Une seule liste des onglets masquables** (`lib/appTabs.ts`, avec tests) : elle sert au menu, aux
  Réglages et à la préférence du compte. « Productions » et « Groupes », qui avaient quitté le menu,
  n'ont plus de bascule ; un ancien réglage qui les cite est simplement ignoré.
- **Visibilité rangée dans le compte** (`user_preferences`, clé `hidden_tabs`, table de la migration
  042 : aucune migration). À la connexion, le réglage du compte fait foi ; s'il n'existe pas encore,
  celui de l'appareil y est envoyé (premier passage), sauf s'il ne masque rien. Un geste du
  professeur fait avant la réponse du compte l'emporte. Le stockage local reste comme copie hors
  connexion. Les autres réglages (établissement, thème…) restent sur l'appareil.
- **« En direct » devient « Activité en direct »** (menu et titre de la page) et peut être masqué.
  Le nom est un choix de Claude, pour le distinguer des séances en direct : à confirmer par Thomas.
- **Un seul lecteur PDF** : les annales (page du professeur et espace élève) passent par le lecteur
  commun `PdfReader` (pdfjs), via `components/clouds/PdfUrlReader.tsx` qui télécharge le fichier.
  L'aperçu natif dans une `<iframe>`, vide sur téléphone, ne sert plus que de repli si le
  téléchargement échoue.
- Libellés des Réglages accentués (« Récompenses », « Évaluations », « Académie »).
- **Vérifié** : `tsc -b`, 525 tests ; le lint ne signale aucune erreur nouvelle (les 6 qu'il relève
  dans ces fichiers existent sur master). Dans le navigateur : menu et libellé (non coupé, menu
  déplié) ; 9 bascules dans Réglages ; « Activité en direct » masqué → il quitte le menu et la ligne
  du compte est écrite ; stockage local vidé puis rechargement (comme un autre appareil) → l'onglet
  reste masqué ; rétabli. Annales : un sujet de 6 pages s'ouvre dans le lecteur commun.
- **Nettoyage** : la ligne `hidden_tabs` créée par l'essai a été supprimée du compte, pour que le
  premier appareil réel de Thomas y envoie son propre réglage.
- **Espace élève** : essayé par Thomas le 14/11/2026 dans la prévisualisation, le lecteur commun
  y fonctionne. PR #96 fusionnée dans la foulée (commit `800f70b`).
- **Non vérifié** : le repli sur l'aperçu natif.
- **Reste** : l'en-tête de l'aperçu des annales et la barre du lecteur proposent chacun un bouton
  « ouvrir dans un onglet » (doublon mineur).

### Lot N2 — maquette du menu regroupé, faite le 14/11/2026 (branche `docs/maquette-menu`)

Maquette cliquable : `gestion-classe-web/public/_maquettes/menu-regroupe.html`
(servie par Vite : `/gestion-classe/_maquettes/menu-regroupe.html`). Rien n'est branché.

- **Trois états à comparer** : « Aujourd'hui » (15 entrées en trois sections), « A · Menu dépliable »
  (5 entrées, celle où l'on se trouve montre ses pages), « B · Onglets en haut de page » (5 entrées,
  les pages d'une entrée deviennent des onglets sous le titre). Sur ordinateur et sur téléphone.
- **Regroupement proposé** (révisé par rapport au § 5) :

  | Entrée | Pages |
  |---|---|
  | Accueil | Accueil |
  | Mes cours | Bibliothèque et classes (la page actuelle), Mes TP, Annales, Mes clouds |
  | Classes | Classes et plans, Suivi élèves, Séances, Analyses |
  | Évaluations | Carnet et fiches, Activité en direct |
  | Plus | Récompenses, Académie, Outils, Pronote |

  Écart avec le premier jet : « Analyses » passe sous Classes (elle parle des élèves), et
  « Activité en direct » sous Évaluations (elle suit des productions).
- **Téléphone** : barre du bas Accueil, Cours, Classes, Évals, Plus ; les pages d'une entrée sont
  des puces sous le titre ; « Plus » ouvre une feuille de quatre pages (onze aujourd'hui).
- **Ne change pas** : les adresses, Réglages › Onglets visibles, les écrans sans menu.
- **Recommandation de Claude : la variante A.** Les pages ne changent pas, rien à réapprendre
  dedans, et moins de travail. La variante B ajoute une barre d'onglets à chaque page, par-dessus
  les deux vues de « Mes cours ».
- **Non montré** : l'entrée « Dev » (réservée à Thomas, elle irait sous Plus) ; le menu réduit aux
  icônes en variante A (les pages d'une entrée s'ouvriraient dans une fenêtre à côté de l'icône).
- **Vérifié dans le navigateur** : les trois états, le passage d'une entrée à l'autre, le
  téléphone, la feuille « Plus », le tableau « Où va chaque onglet » (15 lignes).

**Choix de Thomas (14/11/2026) : la variante A.** Les trois autres points n'ont pas reçu de réponse :
les propositions de Claude sont appliquées (Analyses sous Classes, Récompenses sous Plus, Cours et
Évals dans la barre du téléphone) et restent faciles à changer dans `lib/appNav.ts`.

### Lot N3 — menu regroupé, codé le 14/11/2026 (branche `feat/menu-regroupe`)

- **Une définition du menu** (`lib/appNav.ts`, avec tests) : cinq entrées et leurs pages, partagée
  par la barre latérale, la barre du bas du téléphone et les Réglages. Changer le regroupement,
  c'est modifier cette liste.
- **Barre latérale** (`Layout.tsx`) : l'entrée de la page affichée se déplie et montre ses pages ;
  les autres sont fermées, un clic mène à leur première page. Les titres « Vie de classe »,
  « Ressources » et « Développement » disparaissent. « Dev » est sous Plus, pour Thomas seul.
- **Page active** reconnue aussi sur ses sous-pages (`/sessions/42`, `/evaluations/…`,
  `/tools/…`) ; `/productions` et `/group-sessions`, sans entrée, allument « Carnet et fiches ».
- **Menu réduit aux icônes** : les pages de l'entrée courante sont ses icônes, entre deux filets.
- **Téléphone et tablette** : barre du bas Accueil, Cours, Classes, Évals, Plus ; les pages de
  l'entrée sont des puces sous la barre du haut ; « Plus » ouvre la feuille de ses pages, des
  Réglages et du retour.
- **Onglets masqués** : une page masquée quitte son entrée ; une entrée réduite à une page devient
  un lien simple ; une entrée vide disparaît. Les Réglages nomment chaque page avec son entrée
  (« Mes cours › Annales »), dans l'ordre du menu.
- **Les adresses ne changent pas.**
- **Vérifié** : `tsc -b`, 538 tests ; le lint ne signale aucune erreur nouvelle. Dans le navigateur :
  les cinq entrées, l'entrée courante dépliée (Mes cours, Classes, Plus avec Dev), « Séances »
  active, `/productions` rangé sous Évaluations, le menu réduit, le téléphone (barre, puces,
  feuille « Plus », pas de débordement), les libellés des Réglages.
- **Non vérifié** : le masquage d'un onglet dans le vrai menu (couvert par les tests seulement, pour
  ne pas écrire dans le compte de Thomas) ; une tablette ; un vrai téléphone.
- **Reste** : en menu réduit, l'icône de l'entrée « Classes » et celle de sa page « Classes et
  plans » sont les mêmes (idem Mes cours et Évaluations).

### Lot R1 — recherche globale, codé le 15/11/2026 (branche `feat/recherche-globale`, depuis master)

- **Une fenêtre pour aller partout** (`components/GlobalSearch.tsx`) : Ctrl+K, le bouton
  « Rechercher » en haut du menu, ou la loupe de la barre du haut sur téléphone.
- **Sept familles**, dans cet ordre : Pages, Cours, Classes, Élèves, Évaluations, Outils, Réglages.
  Six résultats au plus par famille. Sans rien de tapé : les pages du menu, comme un sommaire.
- **Même règle que la recherche de « Mes cours »** : sans casse ni accents, tous les mots demandés.
  Un titre qui commence par le mot cherché passe devant (`lib/globalSearch.ts`, avec tests).
- **Ce qui s'ouvre** : la page ; le cours (`/cours?ouvrir=…`) ; le plan de la classe
  (`/classes?class=…`) ; la fiche de l'élève (`/students?class=…&student=…`) ; la fiche de
  l'évaluation ; l'outil ; les Réglages sur la section trouvée.
- **Lecture en base** (`lib/globalSearchQueries.ts`) : cours de la bibliothèque, classes, élèves,
  évaluations — quatre lectures légères à la première ouverture, gardées une minute. Une lecture
  qui échoue retire seulement sa famille. Aucune migration.
- **Réglages** : sections décrites dans `lib/settingsSections.ts` (libellés accentués au passage :
  « Établissement », « Année scolaire », « Thème », « Données ») ; la fenêtre accepte une section
  d'ouverture.
- **Inactive quand un éditeur est ouvert** (cours, tableau blanc, présentation) : Ctrl+K reste à eux.
  Elle n'existe pas sur l'écran de classe ni dans l'espace élève, qui n'ont pas de menu : les
  pseudonymes des élèves n'y apparaissent donc jamais par ce biais.
- **Vérifié** : `tsc -b`, 548 tests ; le lint ne signale aucune erreur nouvelle. Dans le navigateur,
  avec les données réelles : ouverture par Ctrl+K et par le bouton ; sommaire des pages ; « wegener »
  (2 cours, titres entiers) ; « 4a » (classe, élèves, évaluations) ; « qr » (2 outils) ; « theme »
  puis Entrée (Réglages ouverts sur Thème) ; « annales » puis Entrée (page ouverte, entrée « Mes
  cours » dépliée) ; flèches, tour complet de la liste, Échap ; Ctrl+K sans effet sous le tableau
  blanc.
- **Essai de Thomas (15/11/2026)** : il devait ouvrir un élève, une évaluation et un cours depuis un
  résultat ; il a répondu « c'est bon ». PR #98 fusionnée dans la foulée (commit `c880825`).
- **Non vérifié** : la loupe sur un vrai téléphone ; ⌘K sur Mac.
- **Non fait** : la recherche dans le texte des cours reste dans « Mes cours » ; les copies placées
  sur un créneau ne sont pas proposées (elles se retrouvent par « Mes cours » › « Par classe »).

### Lot F1 — fichiers d'une séquence, codé le 15/11/2026 (branche `feat/cours-fichiers`, depuis master)

**Décision de stockage (Thomas, 15/11/2026)** : rester dans le stockage actuel, avec un plafond par
fichier et une jauge. Mesuré ce jour-là : environ 320 Mo occupés (copies d'évaluation 207 Mo, annales
78 Mo, images des cours 19 Mo, photos 8 Mo). L'organisation est sur l'offre gratuite : 1 Go de
stockage en tout (documentation Supabase), partagé avec son second projet.

- **Migration `078_course_files.sql`** (appliquée en prod le 15/11/2026) : table `course_files`, dossier de
  stockage privé `course-files` (20 Mo par fichier ; PDF, images, sons, documents Word / PowerPoint
  / Excel et leurs équivalents libres, texte ; pas de vidéo), fonction `storage_usage()` pour la
  jauge. Aucune clé étrangère vers `boards` (leçon de la migration 077).
- **Un fichier appartient à une séquence** par (niveau, nom de séquence), comme les cours. Renommer
  une séquence renomme aussi ses fichiers. Une séquence qui n'a plus que des fichiers reste affichée.
- **Dans la bibliothèque** : les fichiers d'une séquence sont listés sous ses cours
  (`components/courses/SequenceFiles.tsx`). Ajout par le menu « ⋯ » de la séquence, ou en glissant
  des fichiers sur elle. Un clic ouvre le fichier dans la visionneuse de « Mes clouds » (PDF, image,
  son ; un Word est converti en PDF à l'ouverture). Menu « ⋯ » : Télécharger, Renommer, Supprimer.
- **Refus expliqués** (`lib/courseFiles.ts`, avec tests) : vidéo (« colle son lien »), type non
  accepté, plus de 20 Mo, fichier vide, stockage presque plein.
- **Jauge** au pied de la bibliothèque : « Stockage : 320 Mo sur 1,00 Go », orange à 80 %, rouge à 95 %.
- **Sans la migration**, la bibliothèque s'affiche comme avant, sans fichiers ni jauge.
- **Vérifié** : `tsc -b`, lint sans erreur sur les fichiers touchés, 562 tests. Dans le navigateur,
  sans la migration : la page s'affiche, le menu d'une séquence ne propose pas d'ajouter un fichier,
  pas de jauge.
- **Vérifié après la migration**, avec un PDF d'essai glissé sur la séquence Wegener : survol
  signalé, « Envoi en cours… », fichier listé avec sa taille ; refus d'une vidéo, d'une archive et
  d'un fichier vide, chacun avec sa phrase ; ouverture dans la visionneuse (lecteur PDF, une page) ;
  renommage sans extension (elle est remise) ; suppression avec confirmation. La jauge affiche
  « 320 Mo sur 1,00 Go ». Après l'essai : aucune ligne dans `course_files`, aucun objet dans le
  dossier. Les pastilles de classes et l'accueil se chargent toujours (pas de régression des
  lectures existantes).
- **Non vérifié** : l'ajout par le menu « ⋯ » (sélecteur de fichiers du système) ; un vrai Word, une
  image, un son ; le téléchargement ; le renommage d'une séquence qui porte des fichiers ; une
  séquence qui n'a plus que des fichiers (couverte par un test) ; le téléphone.
- **Non fait** : « Reprendre depuis OneDrive » par la connexion aux clouds. Le dossier OneDrive de
  Thomas est synchronisé sur son ordinateur : le sélecteur de fichiers et le glisser-déposer y
  accèdent directement. Les séquences sans nom ne reçoivent pas de fichiers. Les fichiers ne sont
  pas cherchés par la recherche.
- **Constat** : la bibliothèque ne compte plus que les deux cours Wegener (les sept autres ont été
  supprimés entre-temps).

