# Plan — Préparer la semaine avec Claude

*14/11/2026. Spécification, pas de code. Suite de `AUDIT_fiche_word.md` (Claude écrit les cours
dans l'app) et de `PLAN_cours_editeur.md` (l'éditeur de cours).*

## 1. Le besoin (Thomas)

> Quand je prépare mes cours de la semaine, je veux dire à Claude « prends l'activité X pour la
> classe Y » et retrouver dans Gestion Classe tout ce qu'il faut pour la séance.

Précisions du 14/11/2026 :

- À terme, presque plus de OneDrive : l'app, et le stockage de l'app, suffisent.
- Une communication simple : Thomas demande, Claude crée les documents et les place dans les
  bonnes séances, Thomas revient dessus si besoin dans l'éditeur de cours.
- Une base personnelle remplacera peut-être Supabase un jour, pas maintenant.

## 2. Décisions

| # | Décision | Raison |
|---|---|---|
| D1 | **L'app est la seule source.** Un document créé dans l'app ne retourne jamais dans OneDrive | Une seule version à tenir à jour |
| D2 | **Migration par l'usage.** Une activité de OneDrive est convertie le jour où Thomas la demande. Pas de grand import | 76 dossiers d'activité : seuls ceux qui servent migrent, au rythme des semaines |
| D3 | **Des blocs, pas de page HTML libre.** Tout est un document de l'éditeur de cours | Modifiable par Thomas, imprimable, projetable, encre de séance déjà enregistrée |
| D4 | **Deux documents par activité** : la *fiche* (imprimée et projetée pendant l'activité) et la *correction* (projetée à la séance suivante) | L'éditeur repose sur un document unique qui s'imprime et se projette ; le calendrier rattache un document par cours |
| D5 | **Un original par niveau, une copie par classe.** L'original vit dans la bibliothèque (niveau › chapitre) ; chaque cours du calendrier reçoit sa copie | Thomas corrige différemment selon la classe ; la copie d'une classe ne doit pas écraser l'original |
| D6 | **Le travail se lance dans Claude Code, sur le PC** | Seul endroit qui réunit les fichiers, le vérificateur `course:check` et l'accès à la base |
| D7 | **Claude ne modifie ni ne supprime rien sans demande.** Un créneau qui a déjà un document n'est jamais écrasé : Claude pose la question | Règle de sûreté de la skill `cours-gestion-classe` |
| D8 | **Rester déménageable.** Documents en JSON dans `boards.doc`, fichiers dans un dossier du stockage, rien d'autre | Une base personnelle reste possible plus tard |

À confirmer par l'essai de l'étape 0 :

- La fiche projetée suffit-elle comme « tableau d'activité » ?
- Une fiche « proche du Word », et non identique, convient-elle ?

## 3. Le modèle, avec ce qui existe

Aucune nouvelle table n'est nécessaire pour commencer.

| Notion | Où elle vit déjà |
|---|---|
| Séquence | `boards.chapter` (« Séquence 1 — Micro-organismes »), sous `boards.level` (« 3e ») |
| Activité | Deux lignes de `boards`, rangées dans la même séquence. Titres : « Activité 2 — L'activité du microbiote » et « Activité 2 — L'activité du microbiote (correction) » |
| Original | Ligne de `boards` sans classe (`class_id` vide) : visible dans la bibliothèque |
| Copie placée | Ligne de `boards` avec sa classe, reliée au cours par `lesson_boards` (clé : heure de début à la minute + libellé de l'emploi du temps). Elle n'apparaît pas dans la bibliothèque, mais sur le cours du calendrier |
| Cours du calendrier | `timetable_entries` ; le lien libellé → classe est dans `timetable_label_links` |
| Tableau de fin de séance | `session_boards` : la séance, le document joué, l'encre de séance (`course_ink`) |
| Images | Fichiers du stockage `board-assets`, cités par leur chemin dans le document |

Ce que les documents de l'éditeur remplacent :

| Fichier OneDrive | Dans l'app |
|---|---|
| `Fiche_eleve_….docx` | La fiche |
| `… Documents (élève).docx` | Les pages suivantes de la fiche (même document, une impression) |
| `…_ADAPTEE.docx` | Rien à créer : l'impression « version dys » de l'éditeur |
| `…_CORRIGE.docx` | La correction |
| `Fiche préparation ….docx` | Hors périmètre pour l'instant (voir § 7) |
| `Cahier_de_texte_….txt` | Hors périmètre : la skill « cahier de texte » existe à part |

## 4. Le dialogue

### Ce que Thomas dit

- « Prends l'activité 2 de la séquence 1 pour la 3B. »
- « Même chose pour toutes mes 3e. »
- « La correction jeudi plutôt que mardi pour la 3A. »
- « Prépare ma semaine : 3e → S1 A3, 4e → S2 A1. »

### Ce que Claude fait

1. **Trouver l'activité.** D'abord dans la bibliothèque de l'app. Si elle n'y est pas, dans le
   dossier OneDrive : Claude la convertit et crée les deux originaux (D2).
2. **Trouver les créneaux.** Les prochains cours de la classe dans l'emploi du temps, hors cours
   annulés. Par défaut : la fiche sur le prochain cours sans document, la correction sur le
   suivant. Les demi-groupes reçoivent chacun leur copie.
3. **Vérifier.** Chaque document passe par `npm run course:check` avant toute écriture.
4. **Placer.** Une copie de l'original par cours, reliée au cours.
5. **Rendre compte.**

### Le compte rendu

Un tableau court, toujours le même :

| Classe | Cours | Document | État |
|---|---|---|---|
| 3B | mar. 17 nov., 10 h | Activité 2 — fiche | Placé |
| 3B | jeu. 19 nov., 14 h | Activité 2 — correction | Placé |

Suivi de ce qui reste à faire à la main (par exemple : « 2 images à insérer »), et de ce que Claude
n'a pas pu vérifier (par exemple : le nombre de pages, qui ne se calcule qu'à l'affichage).

### Quand Claude pose une question

Une seule question, puis il s'arrête :

- le créneau visé a déjà un document ;
- l'activité est introuvable, ou deux dossiers lui ressemblent ;
- la classe n'a pas de cours à venir dans l'emploi du temps ;
- l'activité dure deux séances et l'ordre des créneaux n'est pas évident.

## 5. Les étapes

Chaque étape est livrable seule. Une PR par lot de code ; une migration n'est appliquée qu'après
« Oui, applique-la ».

### Étape 0 — Essai réel, sans code

**But :** juger sur pièce avant de construire.

**Prérequis :** la skill `cours-gestion-classe` (PR #66, #67 et #68, fusionnées le 14/11/2026).

**Contenu :**

- Thomas choisit une activité et une classe de la semaine suivante.
- Claude crée la fiche et la correction. La correction a les questions reprises et une zone
  d'écriture sous chacune, sans réponse cachée.
- Claude les place sur deux cours du calendrier, par des requêtes écrites à la main.
- Thomas imprime la fiche, la projette pendant l'activité, écrit au stylet pendant la correction.

**Terminé quand** Thomas a répondu à ces questions :

1. La fiche tient-elle sur une page ? Sinon, quelle taille de texte l'y fait tenir ?
2. La fiche projetée suffit-elle comme tableau d'activité ?
3. L'encre de la correction est-elle bien retrouvée dans la séance, après coup ?
4. Le document placé par Claude s'ouvre-t-il bien depuis le calendrier et depuis `/classe` ?

**Risque :** la séance doit être démarrée par le téléphone pour que l'encre soit gardée.

### Étape 1 — Claude envoie les images

**But :** lever le seul vrai blocage. Aujourd'hui Claude écrit dans la base, mais ne peut déposer
aucun fichier dans le stockage. La fiche Microbiote n'a pas d'image ; sa feuille de documents en a
3, son corrigé 6.

**Contenu :**

- **Jeton d'import personnel.** Thomas le crée dans Réglages et peut le révoquer. La base n'en
  garde qu'une empreinte.
- **Fonction serveur de dépôt.** Elle vérifie le jeton et n'écrit que dans le dossier de Thomas
  du stockage `board-assets`. Elle refuse tout ce qui n'est pas une image, et tout fichier trop
  lourd. Elle renvoie le chemin du fichier.
- **Côté skill.** Un bloc `Image(fichier)` : il envoie le fichier, puis cite son chemin dans le
  document. Les images d'un `.docx` sont extraites de son dossier `word/media`.
- **Côté vérificateur.** `course:check` refuse une image dont le chemin n'existe pas.

**Règles :**

- Le jeton est rangé dans un fichier local hors du dépôt. Il n'apparaît jamais dans la
  conversation ni dans un commit.
- Solution écartée : une clé d'administration sur le PC, trop puissante.

**Demande une migration** (table des jetons).

**Terminé quand** la feuille de documents de l'activité Microbiote est dans l'app, images
comprises, sans que Thomas ait glissé un seul fichier.

### Étape 2 — La skill « prépare ma semaine »

**But :** le dialogue du § 4 marche d'une phrase, sans requête écrite à la main.

**Contenu :**

- **Conversion d'une activité OneDrive.** Source, par ordre de préférence : le script
  `generate_fiche_….py` quand il existe (19 activités), sinon le `.docx`. La correction part du
  `_CORRIGE.docx`.
- **Lecture de l'emploi du temps** et proposition des créneaux.
- **Placement** : copie de l'original, lien au cours, une copie par classe et par demi-groupe.
- **Provenance.** Une colonne « copié depuis » sur le lien cours → document, pour savoir de quel
  original vient chaque copie. Elle sert aux étapes 4 et 5.
- **Relance sans doublon.** Redemander la même chose ne crée pas une deuxième copie.
- **Compte rendu** du § 4.
- **Corrections après coup** : déplacer un document vers un autre cours, le retirer d'un cours,
  toujours sur demande.

**Demande une migration** (la colonne de provenance).

**Terminé quand** « Prépare ma semaine : 3e → S1 A3, 4e → S2 A1 » produit tous les documents de
toutes les classes concernées, et que le relancer ne change rien.

### Étape 3 — La correction animée

**But :** les réponses sont dans la correction, cachées, et Thomas les révèle au clic.

**Dépend du lot 5 de `PLAN_cours_editeur.md`** (apparition au clic, mot caché), mené par la
session de l'éditeur. Ce plan n'y ajoute que deux choses :

- **Blocs « écran seulement » et « impression seulement »**, pour qu'un même document serve au
  papier et à l'écran sans doublon.
- **Côté skill** : un bloc `Reponse(...)` (cachée, révélée au clic) et la génération de la
  correction à partir du corrigé. Le vérificateur apprend ces blocs.

L'état des révélations d'une séance reste dans la séance, jamais dans le document : la copie de
la 3B repart cachée pour la 3A.

**Terminé quand** une correction générée par Claude se joue en classe : question, écriture au
stylet, révélation de la réponse, et que tout se retrouve dans la séance.

### Étape 4 — Retrouver les tableaux de fin de séance

**But :** l'encre est déjà gardée ; il manque le chemin pour y revenir.

**Contenu :**

- **Par classe** : la suite des séances, avec le document joué et son encre.
- **Par activité** : toutes les classes qui l'ont faite, côte à côte.
- **Export PDF** du document annoté, pour les absents.

**Terminé quand** Thomas retrouve « la correction de l'activité 2 avec la 3B » en trois clics.

### Étape 5 — Plus tard

- **Où en est chaque classe** : Claude propose l'activité suivante de la progression.
- **Animations HTML** : un bloc isolé, dans un encart, pour les animations que les blocs ne
  savent pas faire. La page est enfermée : elle ne peut rien lire de l'app.
- **Archivage de OneDrive** : marquer les dossiers migrés, puis les ranger.
- **Rédiger depuis le téléphone** : le bouton « Coller un cours rédigé par Claude » (voie B de
  `AUDIT_fiche_word.md`).
- **Base personnelle.**

## 6. Risques et points non vérifiés

| # | Point | Conséquence | Levé par |
|---|---|---|---|
| 1 | Marges fixes de 2,5 cm : une fiche de plus de 300 mots environ passe sur deux pages. Un texte plus petit n'a pas été essayé | La fiche ne ressemble plus au Word | Étape 0, question 1 |
| 2 | ~~Le placement d'un document sur un cours par Claude n'a jamais été essayé~~ | Levé le 14/11/2026 : huit copies placées, visibles sur le calendrier, « En classe » les ouvre | — |
| 3 | L'encre de séance n'a pas été vérifiée en vraie classe | Le besoin n° 4 de Thomas n'est pas acquis | Étape 0, question 3 |
| 4 | La séance doit être démarrée par le téléphone | Sans téléphone, rien n'est gardé | Connu, accepté pour l'instant |
| 5 | Le libellé d'un cours peut changer dans l'emploi du temps (Pronote) | Un document placé ne retrouverait plus son cours | À observer à l'étape 2 |
| 6 | Conversion d'un `.docx` sans script : mise en page complexe (colonnes, zones de texte) | Claude reconstruit à la main, plus lent | Étape 2 ; les cas rebelles sont signalés dans le compte rendu |

## 7. Questions ouvertes

1. **Fiche de préparation** (68 fichiers) : la garder dans OneDrive, ou verser ses points clés dans
   les notes du cours, qui s'affichent déjà sur le téléphone ?
2. **Corrigé avec barème** : le barème du professeur a-t-il sa place dans la correction projetée
   (bloc « impression seulement »), ou dans un document à part ?
3. **Activité sur deux séances** : la même copie sur les deux cours, ou une copie par cours ?

## 8. Avancement

| Étape | État |
|---|---|
| 0 — Essai réel | **En cours** depuis le 14/11/2026 : documents créés et placés (§ 9) ; reste le jugement de Thomas en classe |
| 1 — Images | À faire |
| 2 — Skill « prépare ma semaine » | À faire |
| 3 — Correction animée | À faire ; dépend du lot 5 de l'éditeur |
| 4 — Tableaux de fin de séance | À faire |
| 5 — Plus tard | — |

## 9. Étape 0 — ce qui a été fait (14/11/2026)

Activité choisie par Thomas : 4e, séquence 2, activité 3 « Wegener et la dérive des continents ».

**Créé.** Deux originaux dans la bibliothèque (4e › « Séquence 2 — Sous nos pieds, une Terre en
mouvement ») : la fiche (2 pages) et la correction (4 pages, zones au stylet, sans réponses).

**Placé.** Une copie par cours, pour les quatre classes :

| Classe | Fiche | Correction |
|---|---|---|
| 4A | mer. 18 nov., 8 h 15 | mer. 25 nov., 8 h 15 |
| 4B | ven. 20 nov., 8 h 15 | lun. 23 nov., 8 h 15 |
| 4C | lun. 16 nov., 10 h 15 | mar. 17 nov., 15 h 40 |
| 4D | mer. 18 nov., 10 h 15 | lun. 23 nov., 13 h 40 |

**Constats.**

| # | Constat | Suite |
|---|---|---|
| 1 | La source de vérité est le `.docx`, que Thomas retouche après le script `generate_fiche_….py` | Étape 2 : toujours comparer les deux |
| 2 | Avec les marges de 2,5 cm, la fiche Word de 2 pages en faisait 3 (le cadre du puzzle ne tenait plus en page 1) | Tenue sur 2 pages par une mise en page compacte : consigne 1 et Rappel à côté du cadre, encadrés en 10 pt comme dans Word, « Questions » en texte bleu. Marge restante : 22 px. À juger par Thomas |
| 3 | Envoyer un document par SQL oblige à le retaper en entier | Contourné par une requête compressée et une empreinte (`md5`) comparée au brouillon. **Étape 1 : la fonction de dépôt doit accepter les documents, pas seulement les images** |
| 4 | L'éditeur réécrit un document à la première ouverture (identifiants de blocs, numéro d'enregistrement, textes voisins fusionnés) : le texte ne change pas | Étape 2 : comparer le texte, pas l'empreinte, après une ouverture |
| 5 | La skill ne sait pas faire : cartouche à trois compétences, barème rouge en fin de question, cadre « à coller », encadrés en 10 pt | Étape 2 : les ajouter à `gc_cours.py` |
| 6 | La projection « En classe » n'appliquait pas la police ni la taille du cours | Corrigé, PR #81 |
| 7 | Une mise en page se mesure sans rien retaper : cours de test vide, puis chargement du brouillon dans l'éditeur ouvert | Étape 2 : en faire un contrôle « nombre de pages » |

**Reste à juger par Thomas** (les quatre questions de l'étape 0) : l'impression, la fiche projetée
comme tableau d'activité, l'encre retrouvée après la séance, l'ouverture depuis `/classe`.
