# Plan — La suite : cours, tableau, modules

*14/11/2026. Spécification, pas de code. Coiffe `PLAN_cours_editeur.md`, `PLAN_preparation_semaine.md`,
`IDEES_actions_tableau.md` et `PLAN_espace_ressources.md` : il ne les remplace pas, il les ordonne.*

> État des lieux relevé sur master (PR #91, worktree `gc-worktrees/cours-claude`) par lecture du
> code et des plans. Rien n'a été essayé dans l'app pour ce document.

## 1. Le besoin (Thomas)

> Remplacer totalement Word / Excel, Genially, Plickers ; en partie Photoshop et OneDrive. Une
> interface simple pour voir et modifier mes cours depuis l'app. Des cours améliorés : animation
> directement dans « Tableau » (le déplacement des continents), des logiciels intégrés (un
> visualiseur du corps humain). Le tout sans tout mettre à la figure de l'utilisateur d'un coup :
> toutes ces fonctions disponibles et bien placées.

## 2. Où on en est (14/11/2026)

| Objectif | Niveau | Ce qui existe | Ce qui manque |
|---|---|---|---|
| Word | Avancé | TipTap 3 : styles, listes, tableaux fusionnés, images (rognage, banque Wikimedia), encadrés, zones Seyès, blocs de fiche, en-têtes et pieds, pagination A4, impression (dys, deux A5), import Word et PDF, versions, rechercher / remplacer, correcteur | Version élève / corrigé, menu clic droit, sommaire inséré, partage entre professeurs. Écartés par Thomas : équations, marges réglables, export Word |
| Genially — interactivité | Avancé | 22 actions de boutons en séquence, rideaux, tickets à gratter, textes à trous, zones cliquables, fenêtres, banque d'événements, 10 widgets, vidéo, site web, son | Glisser-déposer avec zones de dépôt, quiz corrigé tout seul, déclencheurs autres que le toucher (lot D de `IDEES_actions_tableau.md`, rien de codé) |
| Mes cours dans l'app | À mi-chemin | Cours à deux faces (feuille + pages projetées), bibliothèque niveau › chapitre, placement sur le calendrier, modèles, Claude qui écrit et dépose | Aucune entrée « Cours » dans le menu, pas de recherche repérée dans la bibliothèque, pas de chemin vers les tableaux de fin de séance |
| OneDrive | Amorcé | « Mes clouds » en lecture seule (OneDrive, Google Drive), aperçu PDF / Office / images | Aucun gestionnaire de fichiers interne (Épic 11 jamais codé), stockage déclaré pour les images seulement, plafond de 1 Go noté dans `PLAN_espace_ressources.md` |
| Photoshop (en partie) | Amorcé | Rognage, rotation, miroir, cadre — dans le mode Texte seulement ; un convertisseur dans Outils | Rien sur le tableau ; pas de détourage, de réglages, de floutage |
| Animation dans Tableau | Pas commencé | « Déplacer vers » (transition de 400 ms, sans trajectoire), « zoomer sur » (300 ms) | Étapes, trajectoires, lecture / pause, effets d'apparition |
| Logiciels intégrés | Pas commencé | L'objet « site web » (iframe enfermée) peut charger un visualiseur hébergé ailleurs — non essayé | Aucune 3D, aucun module embarqué |
| Plickers | Pas commencé | Canal temps réel écran ↔ téléphone, cartes QR par élève (PDF), scanner de documents ML Kit sur mobile | Cartes réponse, lecture de plusieurs cartes à la fois, question, histogramme, rangement par élève |
| Excel | Pas commencé | Le carnet de notes calcule des moyennes et exporte en XLSX | Aucune grille, aucune formule, aucun graphique tiré d'un tableau |
| Simplicité | Fragile | Accueil modulaire, onglets masquables | 14 entrées de menu, doublons, pas de recherche globale, visibilité réglée par appareil (stockage du navigateur) |

Quatre constats qui pèsent sur l'ordre des travaux :

1. **Ce qui date du 12 au 14/11 n'a pas servi en vraie classe.** Premier essai : 4C, lundi 16/11.
   Aucune impression papier n'est notée comme vérifiée dans les journaux.
2. **Le tableau blanc est un moteur maison** (`Whiteboard.tsx`, environ 4 400 lignes ;
   `BoardObjectLayer.tsx`, environ 1 600). Toute nouveauté ajoutée directement dedans coûte de
   plus en plus cher.
3. **Le mobile est en retard de fusion.** Son master date du 30/08 ; les branches s'empilent ;
   l'APK est à reconstruire (commande « Suivant » du cours). Plickers passe par lui.
4. **Les doublons de navigation existent déjà** : deux accès aux clouds et aux annales, des
   tableaux ouvrables à quatre endroits, « Productions » et « Groupes » encore réglables dans
   « Onglets visibles » alors qu'ils ont quitté le menu.

## 3. Les principes

| # | Principe | Ce que ça interdit |
|---|---|---|
| P1 | **Un foyer par notion.** Un cours, un fichier, une évaluation se trouvent à un endroit, et les autres accès y mènent | Un deuxième écran qui liste la même chose autrement |
| P2 | **Trois niveaux de visibilité.** Toujours visible : ce qui sert chaque jour. À la demande : un catalogue ou la recherche. Réglages : le reste | Un bouton de plus dans un ruban pour une fonction qui sert une fois par mois |
| P3 | **Un mécanisme commun plutôt que des fonctions isolées.** Animation = des étapes. Logiciel intégré, quiz, simulation = un module | Un type d'objet nouveau, avec son code propre dans `Whiteboard.tsx`, pour chaque idée |
| P4 | **Claude sait l'écrire.** Chaque nouveauté a un format vérifiable par un contrôle (`course:check`, `screens:check`) | Une fonction que seul un clic dans l'interface peut produire |
| P5 | **Éprouvé en classe avant de construire dessus** | Empiler une phase sur une autre jamais jouée devant des élèves |
| P6 | **Déménageable** (D8 de `PLAN_preparation_semaine.md`) : du JSON dans la base, des fichiers dans un dossier | Dépendre d'un service extérieur pour relire un cours |
| P7 | **RGPD et hors connexion** : rien de nominatif sur l'écran projeté ni sur une carte ; le téléphone travaille sans réseau | Une carte de vote portant un nom ; un scan qui exige le Wi-Fi du collège |

## 4. L'idée centrale : l'objet « module »

Animation sur mesure, visualiseur du corps humain, question de vote, simulation : aujourd'hui,
chacun demanderait un nouveau type d'objet dans le moteur du tableau. Le plan propose **un seul
type d'objet, `module`**, et un contrat :

| Le module reçoit | Le module rend |
|---|---|
| Sa configuration (écrite à la préparation) | Son état, à enregistrer avec la séance |
| Son état de séance, s'il y en a un | Une image fixe, pour l'aperçu et l'impression |
| Des commandes nommées (« montrer le cœur », « lancer », « étape suivante ») | La liste de ses commandes, pour les boutons d'action et le téléphone |

- **Enfermé et chargé à la demande** : un module vit dans un cadre isolé (comme l'objet « site
  web » actuel), ou dans un composant chargé seulement quand une page en contient un. L'app ne
  s'alourdit pas pour ceux qui n'en posent pas.
- **Une seule entrée d'interface** : Insertion › Module, qui ouvre un catalogue. Le ruban ne
  grossit pas quand le catalogue grossit (P2).
- **Jouable comme le reste** : une commande de module est une action de bouton de plus ; l'état
  suit la séance (`session_board_state`, migration 074) ; la règle « En classe » s'applique.

À trancher à la phase 3 : cadre isolé pour tous, ou composant React pour les modules maison.

## 5. Les phases

Chaque phase est livrable seule, en lots (une PR par lot ; une migration n'est appliquée qu'après
« Oui, applique-la »). Taille : P = petit, M = moyen, G = gros.

### Phase 0 — Valider et finir ce qui est engagé (M)

**But :** ne rien construire sur du non éprouvé (P5) ; finir la chaîne qui produit du contenu
chaque semaine.

**Contenu :**

- Les essais en classe du 16 au 25/11 et les quatre questions de l'étape 0 de
  `PLAN_preparation_semaine.md`.
- Étape 3 du même plan : gabarits d'écrans, `gc_ecrans.py`, `npm run screens:check`.
- Étape 4 : la skill « prépare ma semaine ».
- Mobile : fusionner les branches empilées, reconstruire l'APK.
- « Un seul visuel », lot 2 : supprimer l'ancien habillage tactile après l'essai sur le TBI.
- À contrôler : le tableau envoie du son dans `board-assets`, que la migration déclare pour les
  images seulement.

**Terminé quand** une semaine entière a été préparée par Claude d'une phrase, jouée en classe et
pilotée du téléphone, sans requête écrite à la main.

### Phase 1 — Le foyer : « Mes cours » et le ménage du menu (G)

**But :** voir et modifier ses cours depuis un seul endroit ; rendre tout le reste trouvable.
C'est la phase qui répond à « sans tout mettre à la figure ». **Détail : `PLAN_mes_cours.md`**
(neuf lots, C1 à F1).

| Lot | Contenu | Taille |
|---|---|---|
| 1a | **Page « Mes cours »** dans le menu : niveau › séquence › activité, à partir de `BoardsPanel`. Ouverture directe en Texte, Tableau ou En classe. Recherche dans les titres et dans le texte | M |
| 1b | **Vue par classe** : ce qui est placé, à venir et passé. **Tableaux de fin de séance** (étape 5 de `PLAN_preparation_semaine.md`) : la suite des séances, avec l'encre et ce qui a été révélé ; export PDF pour les absents | M |
| 1c | **Ménage du menu** : un seul accès aux clouds et aux annales, « Productions » et « Groupes » retirés des réglages, « En direct » renommé, visibilité des onglets rangée dans le compte et non dans le navigateur | P |
| 1d | **Recherche globale** (Ctrl+K) : cours, élèves, évaluations, outils, réglages | M |
| 1e | **Fichiers rattachés aux cours** : PDF, son, vidéo courte, rangés par séquence. Pas de gestionnaire de fichiers généraliste. Remplace l'Épic 11 | M |

Regroupement visé du menu (proposition, à valider sur maquette) :

| Entrée | Contient |
|---|---|
| Accueil | Emploi du temps, à faire |
| Mes cours | Bibliothèque, par classe, fins de séance, fichiers, annales, clouds |
| Classes | Classes, élèves, séances, plans |
| Évaluations | Carnet, fiches, copies, productions |
| Plus | Récompenses, Académie, Analyses, Outils, Pronote |

**Demande une migration** (1c : réglages par compte ; 1e : selon la décision de stockage).

**Terminé quand** Thomas ouvre « la correction de l'activité 3 avec la 4B » en trois clics, et
qu'aucune entrée du menu ne fait double emploi avec une autre.

### Phase 2 — L'animation par étapes (G)

**But :** déplacer les continents dans le mode Tableau, sans ligne de temps à apprendre.

**Le modèle :** une page porte une liste d'**étapes**. Une étape note, pour les objets qu'elle
concerne, leur position, leur rotation, leur taille et leur opacité. « Suivant » fait passer
d'une étape à la suivante en douceur. C'est le « Ordre des animations » de PowerPoint, déjà
envisagé au lot 5 de `PLAN_cours_editeur.md`.

**Contenu :**

- **Préparer :** un volet « Étapes ». On place les objets, on clique « Enregistrer l'étape » ; on
  les déplace, on enregistre la suivante. Durée réglable par étape.
- **Jouer :** Suivant et Précédent (clavier, télécommande, téléphone), lecture automatique, retour
  au début. L'état suit la séance.
- **Ce qui existe et sert de base :** l'action « déplacer vers », la transition de 400 ms, l'état
  de séance `moved`. Aucune bibliothèque d'animation n'est nécessaire au départ.
- **Téléphone :** la commande « Suivant » n'est entendue aujourd'hui que par la projection d'un
  cours, pas par le tableau blanc. À étendre.
- **Claude :** une étape s'écrit dans `gc_ecrans.py` et se contrôle dans `screens:check` (P4).
- **Plus tard :** trajectoire courbe, effets d'entrée nommés, déclenchement d'une étape par un
  bouton.

**Demande une migration** si les étapes ne tiennent pas dans `board_pages.meta` (à vérifier).

**Terminé quand** la dérive des continents, de la Pangée à aujourd'hui, se joue en quatre étapes
depuis le téléphone, sur un écran préparé par Claude et retouché par Thomas.

### Phase 3 — Les modules (G)

**But :** poser un logiciel dans une page de cours comme on pose une image.

| Lot | Contenu | Taille |
|---|---|---|
| 3a | **Le contrat** du § 4 : objet `module`, catalogue, commandes dans les boutons d'action, état dans la séance, image fixe | M |
| 3b | **Module « animation sur mesure »** : une page HTML enfermée, écrite par Claude pour ce que les objets ne savent pas faire (étape 6 de `PLAN_preparation_semaine.md`) | P |
| 3c | **Module « visualiseur 3D »** : modèle manipulable au doigt, parties nommées, commandes « montrer / isoler / annoter ». Premier contenu : le corps humain | G |
| 3d | Modules suivants, au besoin des séquences (tectonique, digestion, cellule…) | — |

**Points non vérifiés :** la tenue d'un modèle 3D sur l'ordinateur de la classe ; l'existence de
modèles anatomiques libres de droits et assez légers ; le poids de ces fichiers face au plafond de
stockage.

**Terminé quand** un corps humain se manipule sur le TBI, qu'un bouton de la page « montre le
cœur », et que la page s'imprime avec une image fixe.

### Phase 4 — Le vote par cartes (G, risqué)

**But :** remplacer Plickers : une question au tableau, chaque élève lève sa carte, le téléphone
lit toute la classe.

| Lot | Contenu | Taille |
|---|---|---|
| 4a | **Prototype hors de l'app**, comme pour le menu radial : lire 30 cartes depuis le fond de la salle avec le téléphone de Thomas. Critère proposé : au moins 95 % des cartes lues en moins de 10 secondes | M |
| 4b | **Les cartes** : une par élève, un numéro et jamais de nom (P7), quatre orientations pour quatre réponses ; PDF généré comme les cartes QR actuelles | P |
| 4c | **La question** : un module du tableau (énoncé, deux à quatre choix, bonne réponse). Le téléphone lance la lecture ; `/classe` affiche qui a répondu, puis l'histogramme, puis la bonne réponse | M |
| 4d | **Le rangement** : réponses gardées par élève et par séance, d'abord sur le téléphone, puis envoyées ; vue de suivi | M |
| 4e | **Relié aux codes d'élève** (demande de Thomas, 15/11/2026) : la carte d'un élève est rattachée à son code, celui de l'espace élève. Ce qu'il répond pendant les jeux lui revient donc, et peut être noté | M |

**Le risque est en 4a.** L'app mobile n'a aujourd'hui qu'un scanner de documents : lire plusieurs
marqueurs en vidéo demande un module natif de caméra, donc un nouvel APK, et la technique reste à
choisir. Si le prototype échoue, la phase s'arrête là et on cherche un repli (saisie rapide au
menu radial, par exemple).

**Demande une migration** (4d).

**Terminé quand** une question posée en classe donne son histogramme en moins de 30 secondes et
que les réponses se retrouvent sur la fiche de chaque élève.

**À préciser au début de la phase** (lecture de Claude, à confirmer) : « les jeux » désigne-t-il les
questions posées au tableau, les activités numériques comme l'Hôpital virtuel, ou les deux ? Et
« noter » : une note dans le carnet, des points de maison, ou les deux ?

### Fil continu — petits lots à intercaler

| Lot | Remplace | Taille |
|---|---|---|
| Version élève / corrigé à l'impression ; menu clic droit ; sommaire inséré | Word | P chacun |
| Glisser-déposer avec zones de dépôt, bonne / mauvaise réponse (lot D) | Genially | M |
| **Atelier image** commun au cours et au tableau : rogner, pivoter, détourer, luminosité / contraste, flouter, légender | Photoshop | M |

Retirés le 15/11/2026 (décisions du § 7) : les tableaux qui calculent, et le partage d'un cours
entre professeurs. Le contenu de l'atelier image dépend de la question encore ouverte du § 7.

## 6. Risques et points non vérifiés

| # | Point | Conséquence | Levé par |
|---|---|---|---|
| 1 | Les modes Texte / Tableau / En classe n'ont jamais servi en séance | Tout le plan repose dessus | Phase 0 |
| 2 | `Whiteboard.tsx` grossit à chaque ajout | Phases 2 et 3 lentes et fragiles | Les étapes et les modules vivent hors du composant ; un découpage préalable est à estimer en 2 |
| 3 | Lecture des cartes à distance | La phase 4 peut ne pas aboutir | Lot 4a, avant tout autre travail |
| 4 | Stockage : 1 Go pour toute l'organisation, environ 320 Mo occupés le 15/11/2026 | Pas de vidéos ; les modèles 3D de la phase 3 devront rester légers | Décidé : on reste sur l'offre gratuite, avec 20 Mo par fichier et une jauge. À revoir avant 3c |
| 5 | Le mobile n'est pas fusionné | Chaque phase qui touche le téléphone repart d'une branche instable | Phase 0 |
| 6 | Le menu regroupé change les habitudes | Thomas et Aurélie cherchent leurs pages | Maquette validée avant 1c ; anciennes adresses conservées |
| 7 | Un module enfermé reçoit mal le stylet et le doigt | Visualiseur inutilisable au TBI | Essai dès 3a, sur le TBI |
| 8 | Cet état des lieux vient d'une lecture du code | Un « absent » peut exister sous un autre nom | Vérifier chaque point au début de sa phase |

## 7. Décisions de Thomas et question ouverte

Décisions du 15/11/2026 :

| Sujet | Décision |
|---|---|
| Excel | Peu utilisé, pas important : rien à construire. Le carnet de notes suffit |
| Plickers | Oui, les cartes papier lues par le téléphone. À relier aux codes d'élève, pour récupérer ce qui se passe pendant les jeux et, éventuellement, le noter (lot 4e) |
| Partage de cours entre professeurs | Hors périmètre |
| Ordre des phases 2, 3 et 4 | L'animation d'abord |
| Stockage | Rester dans le stockage actuel : 20 Mo par fichier, pas de vidéo, une jauge |

Encore ouverte :

1. **Photoshop :** quels gestes précis (détourer, légender, flouter des visages, assembler) ?

## 8. Avancement

| Phase | État |
|---|---|
| 0 — Valider | En cours : essais en classe du 16 au 25/11 ; vérificateur d'écrans (`npm run screens:check`), gabarits et générateur (`gc_ecrans.py`) faits le 15/11/2026 ; skill « prépare ma semaine » écrite et fonction `depot-cours` v2 déployée le 15/11/2026 (premier placement réel à faire) ; restent le contrôle par rendu automatique, la fusion du mobile |
| 1 — Le foyer | **Terminée le 15/11/2026** : lots C1 à C4, N1 à N3, R1 et F1 en ligne (PR #92 à #99) ; détail dans `PLAN_mes_cours.md`. À regarder en vraie séance : « Passé » et « Fin de séance » |
| 2 — Animation par étapes | À faire |
| 3 — Modules | À faire |
| 4 — Vote par cartes | À faire |
| Fil continu | À faire |
