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

Retour du 14/11/2026 au soir, après l'essai de l'étape 0 :

> Le mode « En classe », là c'est juste le visuel de la version papier mais zoomé. Je veux
> vraiment un travail d'adaptation pour afficher que les éléments importants. Ce travail sera
> fait à chaque fois, et par Claude, avec moi derrière pour modifier ou améliorer.

Il veut aussi une vraie gomme (qui efface là où elle passe) et le bouton à menu radial
personnalisable.

## 2. Décisions

| # | Décision | Raison |
|---|---|---|
| D1 | **L'app est la seule source.** Un document créé dans l'app ne retourne jamais dans OneDrive | Une seule version à tenir à jour |
| D2 | **Migration par l'usage.** Une activité de OneDrive est convertie le jour où Thomas la demande. Pas de grand import | 76 dossiers d'activité : seuls ceux qui servent migrent, au rythme des semaines |
| D3 | **Des blocs, pas de page HTML libre.** La fiche est un document de l'éditeur de cours ; les écrans sont des pages de tableau blanc | Modifiable par Thomas dans l'app, encre de séance enregistrée, pilotable du téléphone |
| D4 | **Une activité = un cours à deux faces** (révisé le 14/11/2026). La *face papier* est le document, qui s'imprime. La *face écran* est une suite d'écrans 16:9, préparée par Claude pour chaque activité et retouchée par Thomas. La fiche zoomée n'est plus le tableau d'activité | Retour de Thomas : la feuille zoomée ne suffit pas. Le tableau blanc a déjà la vraie gomme, le menu radial, les réponses cachées, les boutons d'action et le minuteur ; la projection d'un cours n'en a aucun |
| D5 | **Un original par niveau, une copie par classe.** L'original vit dans la bibliothèque (niveau › chapitre) ; chaque cours du calendrier reçoit sa copie | Thomas corrige différemment selon la classe ; la copie d'une classe ne doit pas écraser l'original |
| D6 | **Le travail se lance dans Claude Code, sur le PC** | Seul endroit qui réunit les fichiers, le vérificateur `course:check` et l'accès à la base |
| D7 | **Claude ne modifie ni ne supprime rien sans demande.** Un créneau qui a déjà un document n'est jamais écrasé : Claude pose la question | Règle de sûreté de la skill `cours-gestion-classe` |
| D8 | **Rester déménageable.** Documents en JSON dans `boards.doc`, fichiers dans un dossier du stockage, rien d'autre | Une base personnelle reste possible plus tard |

Ce que l'essai de l'étape 0 a tranché :

- La fiche projetée suffit-elle comme « tableau d'activité » ? **Non** (14/11/2026) : d'où D4.
- Une fiche « proche du Word », et non identique, convient-elle ? En attente de l'impression.

Les deux surfaces de l'app, relevées dans le code le 14/11/2026 :

| | Tableau blanc | Projection d'un cours |
|---|---|---|
| Gomme qui découpe le trait | Oui | Non : elle supprime le trait entier |
| Bouton à menu radial personnalisable | Oui (8 quartiers, réglés par clic droit) | Non |
| Format | Écrans 16:9 | Bande de la feuille A4 |
| Réponse cachée, rideau, ticket à gratter, texte à trous | Oui | Non, rien n'est codé |
| Boutons d'action | Oui, 23 actions (montrer, zoomer, ouvrir une fenêtre, lancer un minuteur…) | Non |
| Minuteur, tirage, sonomètre, vidéo, page web | Oui | Non |
| S'imprime en fiche A4 | Non | Oui |
| Claude sait l'écrire | Pas encore (étape 3) | Oui |

## 3. Le modèle, avec ce qui existe

Aucune nouvelle table n'est nécessaire pour commencer.

| Notion | Où elle vit déjà |
|---|---|
| Séquence | `boards.chapter` (« Séquence 1 — Micro-organismes »), sous `boards.level` (« 3e ») |
| Activité | Une ligne de `boards`, rangée dans sa séquence. Elle porte les deux faces |
| Face papier | `boards.doc`, le document de l'éditeur |
| Face écran | Des lignes de `board_pages` rattachées au même cours (`board_id`), une par écran. Leur ordre est écrit dans le document (`doc.screens`). Une page absente de cette liste reste une page d'encart |
| Original | Ligne de `boards` sans classe (`class_id` vide) : visible dans la bibliothèque |
| Copie placée | Ligne de `boards` avec sa classe, reliée au cours par `lesson_boards` (clé : heure de début à la minute + libellé de l'emploi du temps). Elle n'apparaît pas dans la bibliothèque, mais sur le cours du calendrier |
| Cours du calendrier | `timetable_entries` ; le lien libellé → classe est dans `timetable_label_links` |
| Tableau de fin de séance | Les écrans sont copiés dans la séance à son démarrage (`board_pages.session_id`) : l'encre y est enregistrée. `session_boards` garde le lien avec le cours d'origine |
| Images | Fichiers du stockage `board-assets`, cités par leur chemin dans le document |

Ce que les documents de l'éditeur remplacent :

| Fichier OneDrive | Dans l'app |
|---|---|
| `Fiche_eleve_….docx` | La fiche |
| `… Documents (élève).docx` | Les pages suivantes de la fiche (même document, une impression) |
| `…_ADAPTEE.docx` | Rien à créer : l'impression « version dys » de l'éditeur |
| `…_CORRIGE.docx` | Les réponses, cachées dans les écrans et révélées en classe |
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
   dossier OneDrive : Claude la convertit et crée l'original, avec sa fiche et ses écrans (D2, D4).
2. **Trouver les créneaux.** Les prochains cours de la classe dans l'emploi du temps, hors cours
   annulés. Par défaut : l'activité sur le prochain cours sans document ; si la correction se
   fait à la séance suivante, une copie aussi sur le cours suivant. Les demi-groupes reçoivent
   chacun leur copie.
3. **Vérifier.** La fiche passe par `npm run course:check`, les écrans par
   `npm run screens:check`, avant toute écriture.
4. **Placer.** Une copie de l'original par cours, reliée au cours.
5. **Rendre compte.**

### Le compte rendu

Un tableau court, toujours le même :

| Classe | Cours | Document | État |
|---|---|---|---|
| 3B | mar. 17 nov., 10 h | Activité 2 — fiche de 2 pages, 9 écrans | Placé |
| 3B | jeu. 19 nov., 14 h | Activité 2 — les mêmes écrans, pour la correction | Placé |

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

### Étape 1 — Claude envoie fichiers et documents

**But :** lever le blocage de l'envoi. Aujourd'hui Claude écrit dans la base par des requêtes,
mais ne peut déposer aucun fichier dans le stockage, et doit retaper en entier chaque document
qu'il envoie.

**Contenu :**

- **Jeton d'import personnel.** Thomas le crée dans Réglages et peut le révoquer. La base n'en
  garde qu'une empreinte.
- **Fonction serveur de dépôt.** Elle vérifie le jeton et n'écrit que dans l'espace de Thomas.
  Elle accepte trois choses : une image (vers le stockage `board-assets`), un document de cours,
  une suite d'écrans. Elle refuse le reste, et tout fichier trop lourd.
- **Elle ne crée que du neuf.** Remplacer un cours existant demande un paramètre explicite, et
  garde d'abord une version.
- **Côté skill.** Un bloc `Image(fichier)` : il envoie le fichier, puis cite son chemin. Les
  images d'un `.docx` sont extraites de son dossier `word/media`.
- **Côté vérificateur.** Une image dont le chemin n'existe pas est une erreur.

**Règles :**

- Le jeton est rangé dans un fichier local hors du dépôt. Il n'apparaît jamais dans la
  conversation ni dans un commit.
- Solution écartée : une clé d'administration sur le PC, trop puissante.

**Demande une migration** (table des jetons).

**Terminé quand** la feuille de documents de l'activité Microbiote est dans l'app, images
comprises, sans que Thomas ait glissé un seul fichier ni que Claude ait retapé le document.

### Étape 2 — Les écrans : le socle dans l'app

**But :** un cours peut porter des écrans, et la classe les ouvre à la place de la feuille zoomée.

**Contenu :**

- **La liste des écrans** est écrite dans le document (`doc.screens`, des identifiants de pages
  dans l'ordre). Pas de migration pour cela.
- **Ouverture.** « En classe » (depuis l'éditeur et depuis le calendrier) et l'écran `/classe`
  ouvrent les écrans dans le tableau blanc quand le cours en a. Sinon, la projection actuelle.
- **Retouche.** Dans l'éditeur, un accès « Écrans » (renommé « Tableau » le 14/11, voir plus bas) :
  le tableau blanc avec son ruban, pour
  modifier un écran, en ajouter, en supprimer, les réordonner.
- **Séance.** Au démarrage, les écrans sont copiés dans la séance : l'original reste intact,
  l'encre est enregistrée dans la séance. C'est le mécanisme actuel du tableau blanc.
- **Copie d'un cours** vers une autre classe : les écrans suivent.
- **Deux défauts du tableau blanc à corriger** (lus dans le code, à confirmer dans l'app) :
  - la couleur, le rideau et la hauteur d'une page ne sont pas enregistrés en base ;
  - l'état des révélations d'une séance reste sur l'ordinateur : il doit suivre la séance.

**Demande une migration** (état d'une page, révélations d'une séance).

**Terminé quand** un cours portant trois écrans faits à la main s'ouvre en écrans depuis le
calendrier et depuis `/classe`, et que l'encre et les révélations sont retrouvées sur un autre
ordinateur.

### Les trois modes d'un cours (décision du 14/11/2026, soir)

Thomas, après l'essai : quatre modes, c'était un de trop, et « Écrans » ne se distinguait pas
d'« En classe ». Le modèle est celui de Genially : un éditeur, une présentation.

| Mode | Rôle | Ce qu'on y voit |
|---|---|---|
| **Texte** | La feuille : ce que les élèves reçoivent, à imprimer et à coller | Le document A4. Un outil **Stylet** pour annoter l'imprimable si on veut le projeter tel quel |
| **Tableau** (l'ancien « Écrans ») | L'éditeur des pages projetées. Claude y dépose ses pages ; Thomas les retouche ou en crée de zéro | Les ficelles : rideaux à placer, textes à trous, actions |
| **En classe** | La présentation | Rideaux fermés, trous cachés, actions qui se jouent au toucher |

- **Lot 1, fait** : « Écrans » devient « Tableau » ; l'ancien mode « Tableau » (calque dessiné sur
  la feuille) n'est plus un mode mais l'outil Stylet du mode Texte. Aucun cours ne portait de
  dessin sur ce calque : rien n'est perdu, et le calque d'un cours qui en aurait reste lu.
- **Lot 2, fait** : « En classe » est une présentation. Règle validée par Thomas :

  | En classe | |
  |---|---|
  | Permis | Écrire, gommer, pointer au laser, tirer un rideau, révéler un trou, jouer une action, changer de page, ajouter une page blanche |
  | Bloqué | Déplacer, modifier ou supprimer ce qui a été préparé |
  | À l'ouverture | Rideaux fermés, trous cachés, objets cachés absents |
  | Encre et ajouts de la séance | Rangés dans la séance ; ce qu'on ajoute en classe reste déplaçable |
  | « Effacer la page » | Retire l'encre et les ajouts de la séance ; le préparé reste |

  Comment : en classe, le tableau est toujours « en lecture », quel que soit l'outil (avant, il
  fallait l'outil Stylo pour qu'un bouton se joue ou qu'un rideau s'ouvre au toucher). Les objets
  préparés sont verrouillés au moment où les pages sont copiées pour la classe (séance ou essai) :
  c'est le verrou ordinaire de l'application, que Thomas peut lever sur un objet (Accueil ›
  Disposition › Verrouiller). Hors de la classe, rien ne change : l'éditeur montre les ficelles
  avec l'outil Sélection.

  Limites connues : le ruban garde en classe ses commandes de préparation (insérer, rideau, fond) ;
  un tableau rouvert après la séance garde ses objets
  verrouillés (tout sélectionner, puis déverrouiller).

Dans le code et la skill, ces pages gardent leur nom d'origine : `doc.screens`, « écrans »,
`gc_envoi.py ecrans`. Seuls les libellés de l'application changent.

### Étape 3 — Les écrans : gabarits, générateur, vérificateur

**But :** Claude écrit les écrans d'une activité comme il écrit une fiche.

**Contenu :**

- **Les règles d'adaptation.** À l'écran : la problématique, les consignes raccourcies, les
  documents en grand, une question par écran, la place pour écrire, les réponses cachées, le
  bilan. Sur le papier seulement : cartouche, ligne d'identité, barème, « J'ai réussi ».
- **Une famille de gabarits**, pour que le texte tombe juste sans réglage à la main :

  | Gabarit | Contenu |
  |---|---|
  | Titre | Séquence, activité, problématique |
  | Situation | Texte court, image à côté |
  | Consigne | Verbe d'action en grand, étapes, minuteur |
  | Document | Image ou texte en grand, légende |
  | Question | Énoncé, zone pour écrire, réponse sous cache |
  | Tableau à compléter | Cases vides, réponse sous cache dans chaque case |
  | Calcul | Énoncé, zone à carreaux, résultat sous cache |
  | Bilan | Texte à trous ou zone pour écrire |

- **Lisibilité.** Une taille de texte minimale, fixée sur le TBI de Thomas (1280 × 720).
- **Le générateur** (`gc_ecrans.py`, dans la skill) : un écran s'écrit en une ligne par gabarit.
- **Le vérificateur** (`npm run screens:check`) : types d'objets connus, texte dans le format
  accepté par le tableau blanc, cibles des boutons et des caches existantes, images existantes,
  rien hors de l'écran.
- **Le contrôle de mise en page.** La hauteur d'un texte dépend de son contenu : seul un rendu le
  dit. Le brouillon est chargé dans un cours de test, et un contrôle signale les textes qui
  débordent ou se chevauchent.

**Terminé quand** les écrans de l'activité « Wegener » sont générés, vérifiés, joués en classe par
Thomas, et qu'il en retouche un dans l'app.

### Étape 4 — La skill « prépare ma semaine »

**But :** le dialogue du § 4 marche d'une phrase, sans requête écrite à la main.

**Contenu :**

- **Conversion d'une activité OneDrive** en un cours à deux faces. Source, par ordre de
  préférence : le `.docx` (Thomas le retouche après coup), aidé du script `generate_fiche_….py`
  quand il existe (19 activités). Les réponses viennent du `_CORRIGE.docx`.
- **Lecture de l'emploi du temps** et proposition des créneaux.
- **Placement** : copie de l'original, lien au cours, une copie par classe et par demi-groupe.
- **Provenance.** Une colonne « copié depuis » sur le lien cours → document, pour savoir de quel
  original vient chaque copie. Elle sert aux étapes 5 et 6.
- **Relance sans doublon.** Redemander la même chose ne crée pas une deuxième copie.
- **Compte rendu** du § 4, avec le nombre de pages de la fiche et le nombre d'écrans.
- **Corrections après coup** : déplacer un document vers un autre cours, le retirer d'un cours,
  toujours sur demande.
- **Les retouches de Thomas nourrissent la skill.** Quand il corrige un écran de la même façon
  deux fois, la règle entre dans les habitudes de la skill.
- **Les manques relevés à l'étape 0** : cartouche à trois compétences, barème en fin de question,
  cadre « à coller », encadrés en 10 pt, contrôle du nombre de pages.

**Demande une migration** (la colonne de provenance).

**Terminé quand** « Prépare ma semaine : 3e → S1 A3, 4e → S2 A1 » produit la fiche et les écrans de
toutes les classes concernées, et que le relancer ne change rien.

### Étape 5 — Retrouver les tableaux de fin de séance

**But :** l'encre est déjà gardée ; il manque le chemin pour y revenir.

**Contenu :**

- **Par classe** : la suite des séances, avec les écrans annotés et ce qui a été révélé.
- **Par activité** : toutes les classes qui l'ont faite, côte à côte.
- **Export PDF** des écrans annotés, pour les absents.

**Terminé quand** Thomas retrouve « la correction de l'activité 3 avec la 4B » en trois clics.

### Étape 6 — Plus tard

- **Où en est chaque classe** : Claude propose l'activité suivante de la progression.
- **Animations sur mesure** : le tableau blanc a déjà un objet « page web » ; y loger une
  animation HTML, enfermée, pour ce que les objets ne savent pas faire.
- **Import d'un fichier de tableau** : il casse les liens entre boutons et objets (lu dans le
  code) ; à corriger si ce chemin sert.
- **Archivage de OneDrive** : marquer les dossiers migrés, puis les ranger.
- **Rédiger depuis le téléphone** : le bouton « Coller un cours rédigé par Claude » (voie B de
  `AUDIT_fiche_word.md`).
- **Base personnelle.**

### Lot à part — La vraie gomme dans la projection actuelle

La projection d'un cours reste le repli quand un cours n'a pas d'écrans. Sa gomme supprime le
trait entier. Petit lot : y porter la découpe du tableau blanc. À faire si Thomas le demande
(question 5 du § 7).

## 6. Risques et points non vérifiés

| # | Point | Conséquence | Levé par |
|---|---|---|---|
| 1 | Marges fixes de 2,5 cm : une fiche de plus de 300 mots environ passe sur deux pages. Un texte plus petit n'a pas été essayé | La fiche ne ressemble plus au Word | Étape 0, question 1 |
| 2 | ~~Le placement d'un document sur un cours par Claude n'a jamais été essayé~~ | Levé le 14/11/2026 : huit copies placées, visibles sur le calendrier, « En classe » les ouvre | — |
| 3 | L'encre de séance n'a pas été vérifiée en vraie classe | Le besoin n° 4 de Thomas n'est pas acquis | Étape 0, question 3 |
| 4 | La séance doit être démarrée par le téléphone | Sans téléphone, rien n'est gardé | Connu, accepté pour l'instant |
| 5 | Le libellé d'un cours peut changer dans l'emploi du temps (Pronote) | Un document placé ne retrouverait plus son cours | À observer à l'étape 4 |
| 6 | Conversion d'un `.docx` sans script : mise en page complexe (colonnes, zones de texte) | Claude reconstruit à la main, plus lent | Étape 4 ; les cas rebelles sont signalés dans le compte rendu |
| 7 | Les écrans sont placés sans être vus : un texte long déborde ou en recouvre un autre | Écran illisible en classe | Étape 3 : gabarits et contrôle de mise en page |
| 8 | Trois défauts du tableau blanc lus dans le code, non constatés dans l'app (état de page non enregistré, révélations locales, import qui casse les liens) | Un écran préparé pourrait perdre son rideau ou sa hauteur | Étape 2 : les confirmer avant de corriger |
| 9 | Les séances du 16 au 25/11 se jouent avec la projection actuelle | Thomas juge l'essai sur un mode qu'il a déjà écarté | Accepté : seules l'impression et l'encre retrouvée restent à juger |

## 7. Questions ouvertes

1. **Fiche de préparation** (68 fichiers) : la garder dans OneDrive, ou verser ses points clés dans
   les notes du cours, qui s'affichent déjà sur le téléphone ?
2. **Corrigé avec barème** : le barème détaillé du professeur reste-t-il hors de l'app, ou
   va-t-il dans une page du cours réservée au professeur, jamais projetée ?
3. **Activité sur deux séances** : la même copie sur les deux cours, ou une copie par cours ?
   Aujourd'hui un document ne peut être relié qu'à un seul cours.
4. **Activité et correction** : les mêmes écrans, avec les réponses cachées (proposé), ou deux
   séries d'écrans ?
5. **Vraie gomme dans la projection actuelle** : la veut-il avant que les écrans existent ?

## 8. Avancement

| Étape | État |
|---|---|
| 0 — Essai réel | **En cours** depuis le 14/11/2026 : documents créés et placés (§ 9) ; reste le jugement de Thomas en classe |
| 1 — Envoi des fichiers et des documents | **Fait** le 14/11/2026 (PR #86, migration 075, fonction `depot-cours`) : jeton d'import créé dans Réglages, envoi par `gc_envoi.py`, essayé de bout en bout avec l'image du puzzle |
| 2 — Écrans : le socle | **Fait** le 14/11/2026 (PR #84 et #85, migration 074) : un cours porte des écrans (`doc.screens`), bouton « Écrans » (devenu « Tableau »), état de page et réponses révélées gardés en base |
| 3 — Écrans : gabarits, générateur, vérificateur | À faire |
| 4 — Skill « prépare ma semaine » | À faire |
| 5 — Tableaux de fin de séance | À faire |
| 6 — Plus tard | — |

Hors étapes, le 14/11/2026 :

- **Écrans Wegener.** 13 écrans écrits à la main et posés sur les deux originaux et les huit cours
  des 4e ; l'écran 5 montre le puzzle assemblé sous un rideau. Premier essai réel : 4C, lundi 16/11.
- **Un seul visuel** (demande de Thomas : la classe doit ressembler au mode Écrans). Lot 1, PR #87 :
  la classe s'ouvre avec le ruban, repliable, et garde la pastille. Lot 2, après essai sur le TBI :
  supprimer l'ancien habillage tactile.
- **Ruban : étiquettes et libellés coupés.** Le ruban des deux éditeurs (cours et tableau blanc)
  coupait l'étiquette des groupes dans presque tous les onglets. Corrigé : ruban de 104 px, libellés
  sur deux lignes au plus, pas de barre de défilement (molette et ombre au bord).

- **Trait décalé, onglet « Texte », pastille** (PR #89) : le tableau sort de la page agrandie des
  grands écrans ; la mise en forme du texte passe dans le ruban ; la pastille prend son habillage.
- **Trois modes** (voir « Les trois modes d'un cours », § 5) : lots 1 et 2 faits (PR #90 et #91) ;
  à essayer en vraie séance.

Révision du 14/11/2026 (soir) : l'ancienne étape 3, « la correction animée », disparaît. Elle
dépendait d'animations à construire dans l'éditeur de cours ; les écrans s'appuient sur les
réponses cachées du tableau blanc, qui existent.

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
| 1 | La source de vérité est le `.docx`, que Thomas retouche après le script `generate_fiche_….py` | Étape 4 : toujours comparer les deux |
| 2 | Avec les marges de 2,5 cm, la fiche Word de 2 pages en faisait 3 (le cadre du puzzle ne tenait plus en page 1) | Tenue sur 2 pages par une mise en page compacte : consigne 1 et Rappel à côté du cadre, encadrés en 10 pt comme dans Word, « Questions » en texte bleu. Marge restante : 22 px. À juger par Thomas |
| 3 | Envoyer un document par SQL oblige à le retaper en entier | Contourné par une requête compressée et une empreinte (`md5`) comparée au brouillon. **Étape 1 : la fonction de dépôt doit accepter les documents, pas seulement les images** |
| 4 | L'éditeur réécrit un document à la première ouverture (identifiants de blocs, numéro d'enregistrement, textes voisins fusionnés) : le texte ne change pas | Étape 4 : comparer le texte, pas l'empreinte, après une ouverture |
| 5 | La skill ne sait pas faire : cartouche à trois compétences, barème rouge en fin de question, cadre « à coller », encadrés en 10 pt | Étape 4 : les ajouter à `gc_cours.py` |
| 6 | La projection « En classe » n'appliquait pas la police ni la taille du cours | Corrigé, PR #81 |
| 8 | L'impression d'un cours sortait blanche (règle d'impression du plan de classe, valable pour toute l'app) | Corrigé, PR #82 |
| 9 | En projection, le bas du cours sautait sans fin (la pagination y tournait) | Corrigé, PR #82 |
| 10 | Thomas écarte la fiche zoomée comme tableau d'activité | Décision D4 révisée ; étapes 2 et 3 |
| 7 | Une mise en page se mesure sans rien retaper : cours de test vide, puis chargement du brouillon dans l'éditeur ouvert | Étape 4 : en faire un contrôle « nombre de pages » |

**Reste à juger par Thomas** (les quatre questions de l'étape 0) : l'impression, la fiche projetée
comme tableau d'activité, l'encre retrouvée après la séance, l'ouverture depuis `/classe`.
