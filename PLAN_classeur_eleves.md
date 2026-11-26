# Plan — Le classeur ouvert aux élèves, activité par activité

22/11/2026 — demande de Thomas. Suite de `PLAN_classeur_virtuel.md` (son lot 4).
Version 2, après relecture critique (§ 7 : ce qui a changé et pourquoi).

## 1. La demande

- Le classeur ne sert aujourd'hui qu'au professeur. Les élèves doivent y accéder de deux façons :
  par l'espace élève (`/eleve`, code à 6 chiffres) et par un lien à poser dans Pronote, qui ne
  montre que le classeur.
- Un élève ne doit jamais voir ce que sa classe n'a pas encore fait : chaque page s'active ou non,
  **classe par classe**.
- Deux endroits pour activer : sur le classeur lui-même (vue du professeur), et dans la liste des
  activités de « Mes cours ».
- Une activité et sa correction s'activent **séparément**.
- Dans le classeur, la correction est cachée au départ. Un bouton « Afficher la correction » l'écrit
  sur la fiche, ou la montre sur la page suivante pour les activités qui s'y prêtent mal.
- Activer la correction fait aussi apparaître le bilan de l'activité.
- Même chose pour les évaluations et leur correction, sans jamais les montrer trop tôt.
- Le mécanisme doit servir aux classeurs des autres niveaux.

## 2. Ce que le code impose (vérifié le 22/11/2026)

1. **Tout est privé.** `boards` et `board_pages` ne sont lisibles que par leur professeur ; les
   images sont dans le bucket privé `board-assets`. Un élève n'a pas de compte : il faut un passage
   côté serveur, avec la clé de service (comme `student-doc`).
2. **Le classeur se construit dans le navigateur**, par les titres, à partir de toute la
   bibliothèque. La règle est longue : filtre des copies posées sur l'emploi du temps
   (`listBoards`), un seul original par titre, séquence admise seulement avec sa page de garde,
   variantes, activités, évaluations, versions adaptées écartées. La récrire en SQL serait une
   seconde vérité, sans moyen de la tester (le dépôt n'a que vitest).
3. **Le bilan a trois sources** : l'écran « Bilan » de la correction, celui de la fiche (4e S3 A2,
   S3 A3, S4 A1), et la « Feuille de bilans (correction) » de la séquence, qui contient les bilans
   de **toutes** ses activités (seule source en 4e S5 et S6). Envoyer cette feuille à l'élève
   livrerait les bilans des activités fermées.
4. **Un cours contient plus que sa fiche** : `doc.screens` (écrans, dont ceux de correction),
   `doc.links`, `doc.layer` (annotations du professeur, dessinées sur la fiche : 3 cours en ont).
   Un nœud « encart » ferait lire toutes les pages du cours. Rien de cela ne doit partir.
5. **Les « (correction) » sont des corrigés pour le professeur** (barème et consignes de notation
   mêlés aux réponses). La correction « sur la feuille » vient des copies modèles (12 en 4e).
   Aujourd'hui le classeur ne colle jamais la correction d'une activité : « la page suivante » est
   une page nouvelle.
6. **La fiche de mémorisation contient toutes les réponses** de la séquence (les volets ne sont
   qu'un cache). La page de garde liste les séances de la séquence, comme sur le papier.
7. **La base sert 7 professeurs.** Une ligne d'activation doit prouver que la classe et le cours
   appartiennent au même professeur ; `resolve_student_code` est appelable par un anonyme.
8. **Sur un téléphone, le texte d'une fiche s'affiche à 4,6 px** (écran de 390 px). Cadrée sans ses
   marges : environ 10 px en portrait, plus de 17 px en paysage. Sans ce mode de lecture, le lien
   Pronote ne sert à rien.
9. **Demi-groupes** : avec une activation par classe, le groupe B verrait l'activité et sa
   correction avant de l'avoir faite.
10. **Évaluations** : un « Entraînement noté » (3e S2) n'est reconnu ni comme évaluation ni comme
    activité ; il existe déjà une publication des évaluations du carnet (`published_to_students`,
    `corrections_withheld`), sans lien avec les cours.

## 3. Principes

- **Fermé par défaut, et rien ne s'ouvre sans un geste du professeur.** Un cours créé ou renommé
  demain en « … (correction) » ne sort pas tout seul.
- **Le serveur ne devine rien.** Il ne lit aucun titre. Il suit une liste d'identifiants que le
  professeur a ouverts, et vérifie qu'ils sont à lui.
- **La règle du classeur ne vit qu'à un endroit** : le navigateur du professeur. C'est lui qui, au
  moment d'activer, écrit ce qui est ouvert.
- **Une liste fermée de rôles** peut sortir : fiche, documents, protocole, copie modèle, page de
  garde, fiche de mémorisation, fiche méthode, mode d'emploi. Une évaluation n'en fait pas partie
  tant que son lot n'est pas fait.
- **Un seul classeur**, deux sources : la bibliothèque (professeur) ou la réponse du serveur
  (élève). Aucun titre de page fermée dans le sommaire de l'élève.
- **Jamais de donnée personnelle.** Versions adaptées hors du classeur (déjà le cas).

## 4. Le modèle

### `class_binder_items` — une ligne par (classe, élément ouvert)

L'élément est une **activité** (ancrée sur sa fiche), ou une page seule : page de garde, fiche de
mémorisation, fiche méthode, mode d'emploi.

| Colonne | Rôle |
|---|---|
| `id`, `user_id`, `class_id`, `anchor_board_id` | index unique (classe, ancre) ; cascade si la classe ou le cours est supprimé ; `group_id` pourra s'ajouter pour les demi-groupes |
| `visible` | l'activité est dans le classeur de la classe |
| `correction_visible` | la correction et le bilan y sont aussi |
| `released` (jsonb) | écrit par le navigateur du professeur à l'activation : `{ rôle, cours: [fiche, documents, protocole], correction: { copie, page }, bilan: [paragraphes] }` |
| `updated_at` | |

- La ligne garde des **identifiants** : le contenu des fiches reste lu en direct (une faute corrigée
  dans une fiche est visible aussitôt). Seul le **texte du bilan** est copié, parce qu'il vient
  d'écrans ou d'une feuille commune qu'on ne peut pas livrer.
- **Mise à jour** : à l'ouverture de `/classeur` pour une classe, le navigateur compare ce qui est
  écrit à ce que le classeur donnerait aujourd'hui (« 3 éléments à mettre à jour : documents
  ajoutés à l'activité 2, bilan modifié »). Il ne rajoute jamais seul une correction.
- **RLS** : écriture seulement si la classe et le cours appartiennent à `auth.uid()` (`EXISTS` sur
  `classes` et `boards`).

### `class_binders` — une ligne par classe
`link_token` (long, aléatoire), `link_enabled`, `tab_enabled` (onglet de l'espace élève). Le niveau
de la classe est lu dans son nom (`levelFromClassName`, déjà en place) ; il passera sur
`classes.level` quand le plan « Espace élève » du 14/09 sera fait.

### Edge Function `classeur-eleve`
- Entrée : un jeton de lien, ou un code élève (avec l'identifiant de fiche si le code en désigne
  plusieurs), ou la session du professeur et une classe (aperçu « Voir comme la 4A »).
- Deux appels : le **sommaire** des éléments ouverts, puis **une page à la demande**, revérifiée à
  chaque fois.
- Elle ne rend d'un cours que `{ version, content, settings }` : ni écrans, ni liens, ni calque.
  Elle refuse un cours qui contient un encart. Elle ne signe que des images dont le chemin commence
  par l'identifiant du professeur de la classe.
- Aucune fonction SQL nouvelle ouverte aux anonymes.

## 5. Les lots (une PR par lot)

### Lot 1 — Activer, côté professeur
Rien n'est ouvert aux élèves : ce lot ne peut rien faire fuiter.
- Migration : les deux tables et leurs politiques.
- `/classeur` : choix « Mon classeur (tout) » ou une classe du niveau. Pour une classe, deux
  interrupteurs par activité (« Activité », « Correction »), un par page seule ; « toute la
  séquence » ouvre les activités de la séquence, jamais les corrections, la fiche de mémorisation
  ni une évaluation. Une page fermée reste affichée, voilée.
- Écriture de `released` et passage de mise à jour.
- La fiche s'ouvre **vierge** ; « Afficher la correction » écrit les réponses de la copie modèle
  (le bouton existe déjà dans l'autre sens). Le bilan sous la fiche n'apparaît que si la correction
  est ouverte.
- Fonction pure `releaseBinder` et ses tests de fuite sous vitest : page fermée, correction fermée,
  bilan porté par la fiche, bilan venu de la feuille commune, évaluation, « Entraînement noté »,
  doublon de titre, copie posée sur l'emploi du temps.

### Lot 2 — Le lien pour Pronote (premier classeur vu par une classe)
- Edge Function `classeur-eleve` ; source « élève » passée au composant du classeur (liste,
  document, bilan, adresse d'image), qui ne lit plus la base directement.
- Page publique `/classeur/c/<jeton>`, chargée à part (aujourd'hui toutes les pages de
  l'application sont chargées d'un bloc). Sans menu, sans lien vers l'espace professeur.
- **Lecture sur téléphone** : fiche cadrée sans ses marges, pages tournées au doigt, zoom.
- Dans `/classeur` : « Lien pour Pronote » (copier, couper, régénérer) et « Voir comme la 4A ».
- Vérification en vrai : un cours fermé, une correction fermée, une autre classe, un jeton coupé.

### Lot 3 — L'onglet « Classeur » de l'espace élève
- Interrupteur par classe ; onglet dans `/eleve`, même classeur, ouvert par le code. L'élève témoin
  sert d'aperçu.

### Lot 4 — La grille dans « Mes cours »
- Deuxième zone d'activation : par séquence, une ligne par activité, une colonne par classe du
  niveau, deux coches par case. Mêmes lignes que le lot 1.

### Lot 5 — Les évaluations (à concevoir avec Thomas avant de coder)
- Marque explicite « évaluation » sur le cours (élargir `boards_category_check`), plutôt qu'un
  préfixe de titre.
- Ouverture par **niveau** plutôt que par classe (§ 6, question 5), sujet et correction séparés,
  jamais par une action de masse.
- À décider : relier ou non à la publication des évaluations du carnet, pour ne pas avoir deux
  interrupteurs qui disent des choses différentes.

### Plus tard
- Demi-groupes (`group_id` sur la ligne, code élève obligatoire pour savoir le groupe).
- Page de garde cochée seulement pour les activités ouvertes (demande de lire le tableau ligne par
  ligne ; d'ici là, la garde est montrée vierge aux élèves).
- Correction « page suivante » faite des écrans de correction projetés en classe.
- Proposition d'activation depuis l'emploi du temps, jamais automatique.
- Gardes, mémos et copies modèles des 3e et 5e.

## 6. Questions pour Thomas (choix par défaut entre parenthèses)

1. **Lien Pronote** : un lien par classe, sans code à taper (défaut) — ou un lien unique où l'élève
   tape son code ?
2. **« L'onglet activité »** : la bibliothèque de « Mes cours » (défaut, lot 4) — ou la vue « Par
   classe » ?
3. **Correction d'une activité sans copie modèle** (Wegener) : rien tant qu'une correction pour
   élèves n'existe pas (défaut) — ou le corrigé du professeur tel quel, barème compris ?
4. **Demi-groupes de 3e** : ouvrir quand les deux groupes ont fait l'activité (défaut, rien à
   coder) — ou gérer les groupes dès le début ?
5. **Évaluations** : ouvertes pour tout le niveau d'un coup, quand toutes les classes ont composé
   (défaut) — ou classe par classe, en sachant qu'un élève de 4A peut montrer le sujet à la 4C ?
6. **Couleur de la correction écrite sur la fiche** : bleu comme aujourd'hui (défaut) ou vert ?

## 7. Ce que la relecture a changé

| Version 1 | Version 2 | Raison |
|---|---|---|
| Le serveur retrouve correction et bilan par le titre (SQL) | Le navigateur du professeur écrit les identifiants ouverts ; le serveur les suit | Une correction créée plus tard serait sortie seule ; règle longue, impossible à tester en SQL |
| Une ligne par page | Une ligne par activité (documents et protocole suivent la fiche) | Thomas raisonne par activité ; des documents ajoutés après coup restaient fermés sans alerte |
| Le serveur envoie « les écrans Bilan » | Le texte du bilan est copié à l'activation | La feuille de bilans commune (S5, S6) aurait livré tous les bilans de la séquence |
| Le cours est envoyé tel quel | Seulement le texte et sa mise en page | Écrans de correction, liens et annotations du professeur sont dans le même document |
| Évaluations exclues par leur titre | Liste fermée de rôles ; marque explicite au lot 5 | « Entraînement noté » échappait au préfixe |
| Évaluations par classe, avec une alerte | Par niveau (question 5) | Un lien de classe circule entre classes |
| 6 lots, premier élève au lot 4 | 5 lots, premier élève au lot 2 | La grille de « Mes cours » passait avant tout usage réel |
| Lecture sur téléphone en fin de lot 4 | Dans le lot du lien | Texte à 4,6 px : c'est la condition d'usage |
| Niveau et onglet dans des tables à part | Niveau lu dans le nom ; onglet et lien dans `class_binders` | Cohérence avec le plan « Espace élève » du 14/09 |
| Politique `user_id = auth.uid()` | Preuve que classe et cours sont au même professeur | 7 professeurs dans la base |
| Tout envoyé d'un coup, images signées | Sommaire, puis page à la demande | Une adresse signée expire ; un classeur se lit longtemps |

## 8. État au 23/11/2026 (nuit du 22 au 23) : les cinq lots sont codés, rien n'est en service

Thomas a demandé les cinq lots à la suite, avec une vérification indépendante par lot. Tout est
codé, testé et commité sur des branches empilées. **Rien n'a été mis en production** : ni les
migrations, ni la fonction du serveur, ni la fusion sur `master`.

| Lot | Branche | Ce qu'il apporte | Relecture indépendante |
|---|---|---|---|
| 1 | `feat/classeur-activation` | Réglage par classe dans `/classeur`, migration 085 | 11 constats, corrigés |
| 2 | `feat/classeur-lien` | Lien pour Pronote, fonction `classeur-eleve`, lecture sur téléphone, migration 086 | Aucune fuite côté serveur ; 10 constats, corrigés |
| 3 | `feat/classeur-onglet-eleve` | Bouton « Mon classeur de SVT » dans `/eleve` | 3 régressions de `/eleve`, corrigées |
| 4 | `feat/classeur-grille` | Grille « Classeur des classes » dans Mes cours | Constats mineurs, corrigés |
| 5 | `feat/classeur-evals-eleves` | Évaluations, ouvertes pour tout le niveau | 4 défauts du réglage et un cas de renommage, corrigés |

Une seule PR pour les cinq lots : https://github.com/Qwetsh/gestion-classe/pull/167 (branche feat/classeur-eleves, 12 commits). Les corrections de chaque relecture sont dans les commits fix(classeur) qui suivent : fusionner une partie seulement mettrait en ligne des défauts connus. Les corrections de la dernière relecture (lot 5) n’ont pas été relues à leur tour.

### Ce qui a changé par rapport au plan (§ 4 et § 5)

- **Aperçu élève** : il passe par le code même du serveur (`supabase/functions/classeur-eleve/release.ts`,
  importé par le navigateur). Ce que Thomas voit dans « Aperçu élève » est ce que le serveur sert.
- **Le serveur lit les titres, mais seulement pour fermer.** Un cours ouvert puis récrit en
  correction, en copie modèle ou en évaluation est refermé d'après son titre du jour. Rien ne
  s'ouvre d'après un titre.
- **Évaluations** : pas de marque sur `boards` (`boards_category_check` n'est pas touché). Une
  évaluation est une ligne de rôle « evaluation », ouverte pour **toutes les classes du niveau**
  d'un geste confirmé, depuis la grille de Mes cours seulement. Le serveur exige que ses cours
  s'appellent « Évaluation … ». Pas de lien avec la publication des évaluations du carnet.
- **Onglet de l'espace élève** : ce n'est pas un onglet mais un bouton sous la barre (elle déborde
  déjà sur téléphone). Son réglage est dans `class_binders`, depuis `/classeur` › « Accès des élèves ».
- **Lecture sur téléphone** : mode de départ dès que la page entière serait illisible, debout ou
  couché. Limite : le bilan écrit sous une fiche est plus large que la fiche, il faut le faire glisser.
- **Page de garde** : montrée non cochée aux élèves (comme prévu au § 5, « Plus tard »).
- **Activité sans copie modèle** : sa correction n'ouvre que son bilan (question 3 : rien d'autre).

### Pour mettre en service (dans cet ordre)

1. Relire et fusionner la PR #167.
2. Appliquer les migrations `085_class_binder_items.sql` puis `086_class_binders.sql`. Elles ne
   créent que deux tables nouvelles. Elles ont été jouées en base réelle dans des transactions
   annulées : 12 puis 8 contrôles de politiques, tous bons.
3. Déployer l'Edge Function `classeur-eleve` (deux fichiers : `index.ts`, `release.ts`).
4. Dans `/classeur`, choisir une classe, ouvrir une activité, puis « Accès des élèves » › créer le
   lien, et l'ouvrir sur un téléphone. C'est le seul contrôle qui n'a pas pu être fait : la fonction
   n'a jamais tourné pour de vrai (pas de Deno sur le poste), seul son tri a été testé.

Tant que l'étape 2 n'est pas faite, `/classeur` marche comme avant et dit que le réglage par classe
n'est pas disponible. Tant que l'étape 3 n'est pas faite, chaque connexion d'élève fait une
demande qui échoue sans rien casser (une erreur dans la console du navigateur).

### Page d'essai locale (sans compte, sans base)

Le classeur, la grille, le lien et l'espace élève tournent sur des fiches de 4e copiées du disque :
`gestion-classe-web/course-drafts/_demo/` dans le worktree `gc-worktrees/classeur-eleves` (dossier
ignoré par git), avec une ligne d'import en tête de `src/main.tsx` qui n'est pas commitée.
Adresse : `http://localhost:5176/gestion-classe/classeur?niveau=4e&demo=1` (élève témoin fictif :
code 999999 sur `/eleve?demo=1`). `?demo=0` remet tout à zéro.

### Restes connus

- Demi-groupes de 3e : toujours par classe entière (question 4).
- Les 3e et 5e n'ont ni pages de garde ni copies modèles : pas de classeur pour elles.
- Un classeur de plus de 1000 lignes de réglage (toutes classes d'un niveau) dépasserait la lecture
  par défaut de la grille ; on en est loin (une soixantaine par classe).
- Chaque connexion d'élève, tous professeurs confondus, pose une question au serveur du classeur.
- Le bilan sous une fiche, en lecture sur téléphone, demande de glisser.
- Cocher la page de garde seulement pour les activités ouvertes n'est pas fait.

## 9. Mise en service du 23/11/2026 (sur demande de Thomas : « Mets en service »)

- Migrations `085_class_binder_items` et `086_class_binders` appliquées en production.
- Edge Function `classeur-eleve` déployée (version 1, sans vérification de jeton d'accès, comme
  `student-doc` : elle fait son propre contrôle par le jeton du lien ou le code de l'élève).
- PR #167 fusionnée dans `master` (commit f92437d), déployée par GitHub Pages.

**La fonction a tourné pour de vrai.** Essai fait avec un lien temporaire sur la 4A et une ligne
ouvrant l'activité 2 de la séquence 1, supprimés aussitôt après :
- refus : jeton inconnu, mal formé ou absent → 403 ; action inconnue → 400 ; question « ouvert ? »
  avec un code inconnu → `{ open: false }` en 200 ;
- le sommaire rend la classe, l'activité et ses deux pages (fiche, documents) ;
- chaque fiche sort avec `version`, `content`, `settings` seulement, et ses images signées se
  chargent ;
- glissés exprès dans la ligne, le corrigé, un sujet d'évaluation et la copie modèle (correction
  fermée) ne sortent pas : 403 ; une page non ouverte (page de garde) : 403 ;
- après suppression, le jeton ne répond plus.

**Reste à voir par Thomas, connecté :** le réglage dans `/classeur` (choisir une classe), la grille
de Mes cours › « Classeur des classes », la création du lien, le classeur sur un vrai téléphone, le
bouton « Mon classeur de SVT » dans l'espace élève (élève témoin). Rien de tout cela n'a été vu dans
l'application connectée : seulement sur la page d'essai locale.
