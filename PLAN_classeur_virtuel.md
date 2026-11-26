# Plan — Classeur virtuel (essai avec les 4e)

19/11/2026 — demande de Thomas : reproduire à l'écran le classeur d'un élève, « vraiment » :
feuilles A5 collées sur les pages, corrections, bilans et titres en écriture manuscrite,
intercalaires, fiches méthode, fiches mémo… Essai sur le cours de 4e.

## 1. Le classeur réel, tel que Thomas l'a défini

Source : `OneDrive/Documents/Ecole/2026-2027/Mon classeur de SVT - mode d'emploi.docx` et les
documents de séquence (`4ème/Séquence n/…`).

- **Page 1** : le mode d'emploi (nom, classe, règles d'or, grille de notation /10).
- **Trois intercalaires, pas plus** :
  1. **Séquences** : pour chaque séquence, sa **page de garde** (« Introduction Séquence n » :
     objectifs, tableau des séances avec étoiles d'auto-évaluation et colonne « Collé ✓ »,
     compétences, bilan de la séquence), puis ses activités dans l'ordre ;
  2. **Fiches méthodes** : FM1 à FM9 ;
  3. **Je révise** : par séquence, la **feuille de bilans** (bilans recopiés en rouge) et la
     **fiche de mémorisation** (questions à gauche, réponses cachées sous des volets découpés).
- Règles de collage : chaque fiche est collée **par le bord gauche** (charnière), jamais au dos
  d'un cours ; les corrections sont faites **dans une autre couleur** ; les bilans sont
  **recopiés en entier, en rouge**.

## 2. Ce qui existe déjà

| Élément | En base (bibliothèque) | Hors base (OneDrive, .docx) |
|---|---|---|
| Fiches d'activité 4e S1-S2 | « Activité n — Titre », « (documents) », « (correction) » — complet (17 + 14 cours) | — |
| 4e S3-S6 | partiel (3 à 7 cours par séquence, peu de corrections) | — |
| Fiches méthode | FM1-FM9 (`category = 'methode'`) | — |
| Pages de garde | — | `Introduction Séquence 1/2.docx` |
| Feuilles de bilans | — (le bilan est dans chaque correction : encadré « Bilan à recopier en rouge ») | `Feuille_bilans_Sequence_1/2.docx` (+ `_CORRIGE`) |
| Fiches de mémorisation | — | `Fiche_memorisation_Sequence_1/2.docx` |
| Mode d'emploi | — | `Mon classeur de SVT - mode d'emploi.docx` |

Dans l'app : un rendu en lecture seule d'un cours (TipTap, `components/courses/CoursePeek.tsx`),
la police « écriture attachée » Playwrite FR Moderne (thème de cours, T16a), le rouge des bilans
`#C00000`.

**Choix pour l'essai : 4e, séquences 1 et 2**, les seules complètes (fiches, documents,
corrections, garde, bilans, mémo). Les séquences 3 à 6 s'ajouteront d'elles-mêmes quand leurs
documents seront en base.

## 3. Le principe

Le classeur n'est **pas une copie** : il est **assemblé à la volée** depuis la bibliothèque
(niveau, séquence, numéro d'activité lu dans le titre, suffixes « (documents) » /
« (correction) », rayons). Modifier une fiche dans « Mes cours » modifie le classeur. Aucune
nouvelle table pour l'essai.

Rendu « vrai classeur » :
- **feuille du classeur** : A4 à grands carreaux (Seyès), marge rouge, trous de perforation,
  léger grain de papier ; vue en double page sur ordinateur et au TBI, page seule sur téléphone ;
- **fiche collée** : la page A4 du cours réduite au format A5 (c'est exactement l'impression
  A5), posée sur la feuille avec une ombre, un très léger angle et une bande de colle sur le bord
  gauche ; un clic la **soulève sur sa charnière** pour voir le dessous (ou son verso) ;
- **manuscrit** : écriture attachée, avec de petites variations (angle, taille, hauteur de
  ligne) pour ne pas faire « police d'ordinateur » ; bleu pour le titre et les réponses de
  l'élève, **vert pour les corrections** (« autre couleur » : à confirmer), **rouge pour les
  bilans** ;
- **intercalaires** : feuilles cartonnées de couleur avec onglet qui dépasse sur le côté ; les
  onglets restent visibles et cliquables pour sauter d'une partie à l'autre ;
- **fiche de mémorisation interactive** : les volets se soulèvent un par un, comme sur le papier
  (on peut réviser dans le classeur virtuel).

## 4. Lots (une PR par lot)

### Lot 0 — Mettre les documents manquants en base (sans code)
- Importer en cours rédigés (skill `cours-gestion-classe`, vérification `course:check`) :
  mode d'emploi, pages de garde S1-S2, feuilles de bilans S1-S2, fiches de mémorisation S1-S2.
- Repérer, dans les corrections, **la couleur qui marque les réponses** : c'est elle qui passera
  en manuscrit au lot 2.

**Fait le 19/11/2026.** Neuf cours créés en base (jeton d'import, `course:check` sans erreur),
textes repris mot pour mot des .docx et de `generate_docs_classeur_Sequence_2.py` (script de
conversion : brouillons dans `gc-worktrees/tableau/gestion-classe-web/course-drafts/classeur-*`) :

| Cours | id | Pages |
|---|---|---|
| Mon classeur de SVT — mode d'emploi (sans niveau) | `32d966b6…` | 1 |
| Page de garde — Séquence 1 / 2 | `e5ff535e…` / `ff4c467d…` | 1 / 1 |
| Feuille de bilans — Séquence 1 / 2 (élève, zones de lignes) | `6d23df06…` / `e673ebb0…` | 2 / 2 |
| Feuille de bilans — Séquence 1 / 2 (correction) (mots clés soulignés) | `4a782044…` / `4d96f5f4…` | 2 / 2 |
| Fiche de mémorisation — Séquence 1 / 2 | `e8ca7840…` / `c1359cef…` | 2 / 2 |

- **Pas de rayon** : la colonne `boards.category` n'accepte que `methode` (contrainte
  `boards_category_check`) ; l'élargir demande une migration. Ces cours sont donc reconnus par
  leur **titre** (« Page de garde — », « Feuille de bilans — », « Fiche de mémorisation — »), comme
  les suffixes « (documents) » / « (correction) » ; ils apparaissent dans « Mes cours » sous leur
  séquence.
- Séquence 1 : la feuille corrigée .docx portait d'anciens titres et problématiques pour les
  activités 1 et 2 ; la version en base reprend ceux de la feuille élève, avec les textes du corrigé.
- Feuilles de bilans sur deux pages (une seule en Word) : les marges de l'app (2,5 cm) sont plus
  larges que celles des .docx (0,8 à 1,5 cm). Les fiches de mémorisation faisaient déjà deux pages.
- **Couleurs des corrections (9 sur 9)** : réponses attendues en rouge `#C00000` (le bilan aussi) ;
  remarques pour le professeur (barème, tolérances, « Exiger l'unité… ») en gris `#606060` → au
  lot 2, le rouge passe en écriture manuscrite et le gris est masqué.

### Lot 1 — Le classeur qui se feuillette
- Page `/classeur?niveau=4e` (entrée dans « Mes cours », pas dans le menu).
- `lib/binder.ts` (pur, testé) : liste ordonnée des feuilles à partir de la bibliothèque :
  mode d'emploi → intercalaire « Séquences » → pour chaque séquence : garde, puis pour chaque
  activité : feuille(s) avec la fiche et ses documents collés → intercalaire « Fiches
  méthodes » → FM1-FM9 → intercalaire « Je révise » → bilans + mémo par séquence.
- Rendu : feuille Seyès, fiche A5 collée en lecture seule (moteur de `CoursePeek`), une fiche
  de deux pages = deux A5 l'une sous l'autre ou recto/verso (au choix de Thomas), sommaire
  latéral, flèches et clavier, double page / page seule.

**Fait le 20/11/2026 (PR #125, fusionnée et déployée le 20/11/2026).** Réponses de Thomas : pour lui seul d'abord, classeur
« parfait ». Choix faits sans réponse aux questions 2 à 4 : feuille A4 Seyès perforée 4 trous, **une
fiche A5 par page** (34 mm du bord perforé, 30 mm du haut pour le futur titre manuscrit), un cours de
deux pages = **fiche recto verso** (« Voir le verso »), documents sur la page suivante, **évaluations
hors du classeur**, fiche **vierge** collée (la correction viendra en écriture au lot 2).
- `lib/binder.ts` (11 tests), `components/binder/` (BinderLeaf, GluedSheet, binderSheet), `pages/Binder.tsx`,
  `styles/classeur.css` ; bouton « Classeur » dans Mes cours.
- Pas d'angle de collage : la pagination mesure à l'écran, une rotation fausserait les pages.
- Fiches de plus de deux pages (S1 A1 : 4 pages, ses documents : 7) : bouton « Page 1 / n ».

### Lot 2 — L'écriture de l'élève
- Titre de chaque activité écrit à la main en haut de la feuille, date de la séance si la classe
  l'a faite (lien `session_boards`).
- Fiche collée = la **correction** dont les réponses passent en écriture manuscrite verte et les
  pointillés vides disparaissent (la fiche vierge reste visible d'un clic : « avant / après »).
- Feuille de bilans : chaque bilan recopié en rouge, à la main, depuis l'encadré « Bilan à
  recopier » de la correction.
- Page de garde : « Collé ✓ » coché et étoiles remplies pour les activités faites.

**Fait le 20/11/2026 (PR #126, fusionnée et déployée le 20/11/2026).** Codé et testé (737 tests),
rendu contrôlé sur une page d'essai locale alimentée par les brouillons (pas sur la vraie page
`/classeur` : session expirée) : cases « Collé ✓ »
cochées sur la page de garde, bilans recopiés en rouge sur la feuille de bilans depuis sa version
« (correction) » (`lib/binderInk.ts`), bouton « Voir la fiche vierge », titre manuscrit au-dessus
des fiches d'activité.

**Constat qui change le lot** : les « (correction) » des activités sont des **corrigés pour le
professeur**. Les réponses y sont mêlées, dans le même rouge, au barème et aux consignes de notation
(« Exiger l'unité », « Points bien placés (1,5) : tolérance… », « Accepter aussi… ») ; les tableaux
restent parfois vides, les réponses listées dessous. La note du lot 0 (« rouge = réponses, gris =
remarques ») était fausse. On ne peut donc pas en tirer mécaniquement une fiche remplie par un élève.
**Décision de Thomas (20/11/2026) : écrire des copies modèles.** Une « Activité n — Titre (copie
modèle) » ne reprend pas la fiche : elle liste les réponses d'un élève (écriture attachée, bleu),
une par paragraphe, dans l'ordre des zones à remplir de la fiche (cellules vides, pointillés, zones
de lignes ; un tiret seul laisse une zone vide ; le texte gris en tête de paragraphe est un repère
ignoré). Le classeur les écrit dans la fiche (`modelAnswers`, `fillSheet`). Outil de rédaction :
script `copies_modeles.py` (brouillons `course-drafts/copie-*.json`). Faites et en base :
4e S1 A1 (`5dc03b1b…`), A2 (`38b98d19…`), A3 (`6b328f96…`), A4 (`9bf6ecb4…`), bonus (`ea927e5a…`) ; S2 A1
(`4f4be231…`), A2 (`7cb8e8e2…`), A4 (`8e29309f…`). **Pas de copie pour S2 A3 (Wegener)** : sa fiche n'a
aucune zone à remplir. Dans une cellule l'écriture est en 8 pt ; seules les cases de « J'ai réussi »
sont cochées. Aperçu à feuilleter (photos de la page d'essai) : https://claude.ai/artifact/VxGEBS6Cu9Qdg9o38hj2Xn
Limite : les questions sans zone sur la fiche (réponse écrite sur la feuille du classeur, ex. S1 A2
questions 1 et 2) ne sont pas montrées.

### Lot 3 — Les gestes du papier
- Fiche qui se soulève sur sa charnière ; tourne-page animé (60 FPS, rien de lourd).
- Fiche de mémorisation à volets : soulever un volet, cocher ☐ ; en option, retenir ses coches.

**Fait le 20/11/2026 (PR #127, non fusionnée).** Volets de la fiche de mémorisation (rabattus sur
les réponses, un clic les soulève ; `MemoFlaps`, `lib/binderFlaps.ts`), page qui se tourne (feuille
vierge qui pivote par-dessus les pages), fiche collée qui se soulève au survol (ombre). Volets et
page tournante sont posés par-dessus le rendu : jamais de transformation sur le cours (la pagination
se mesure à l'écran). Pas fait : cocher les cases d'essais, retenir les volets soulevés, vraie
charnière pour voir le verso. Vérifié sur la page d'essai locale seulement.

**Réponses de Thomas aux questions du § 5 (20/11/2026)** : une fiche A5 par page ; corrections de
l'élève **en vert** ; **évaluations dans le classeur, avec leur correction**. Fait le jour même (PR
#128, empilée sur #127, non fusionnée) : l'évaluation suit les activités de sa séquence (sujet,
documents, correction du professeur) ; encre verte prête pour une copie modèle d'évaluation.
**Constat** : les sujets d'évaluation de 4e S1-S2 n'ont aucune zone à remplir (réponses sur copie),
donc rien n'est encore écrit en vert. **Prochain vrai manque** : écrire sur la feuille du classeur
elle-même (réponses des questions sans zone, fiche Wegener, copies d'évaluation corrigées en vert).

**Classeur de 4e complet jusqu'à la séquence 6 (20/11/2026, demande de Thomas : « on fait
l'ensemble du classeur de 4ème »).** Vingt cours créés en base pour les séquences 3 à 6 : page de
garde, feuille de bilans (+ correction), fiche de mémorisation (16 cours), et 4 copies modèles (S4
A1, S5 A2, S5 A3, S6 A5). Contenu préparé par quatre assistants (un par séquence) à partir des
dossiers OneDrive et des fiches, relu puis assemblé (`_classeur_4e_sources/` : `seq_N.json` avec
leurs notes « sources / inventé / doutes », scripts de génération). **À faire relire par Thomas** :
- Séquence 3 : les trois bilans sont entièrement rédigés (aucune trace écrite du professeur) ;
  l'activité 1 n'a pas de fiche élève ; pas d'évaluation trouvée.
- Séquence 4 : copie de l'activité 1 (grenouille) écrite sans avoir vu l'application ; bilan de
  l'activité 2 repris du corrigé (ne parle que des drogues).
- Séquence 5 : bilans A1, A2, A4 rédigés d'après les fiches de préparation ; copie A2 déduite des
  phrases à trous (documents introuvables) ; le corrigé A3 dit « Urètre : passage de l'urine ».
  Pas de copie pour A4 (exercice « relier »).
- Séquence 6 : les fichiers « Activité 5/6 (cours).txt » sont vides, bilans rédigés ; dans la copie
  A5, les lignes implant et stérilisation et les colonnes « réversibilité / pour qui » ne viennent
  d'aucun document ; le livret AMP (2018) est antérieur à la loi de bioéthique de 2021.
Restent hors classeur : « Séquence — Les ressources » (une fiche, pas de garde), séquences 7 et 8
(pas en base).

### Lot 4 — Si l'essai plaît
- Ouvrir le classeur aux élèves dans l'espace élève (« classeur de référence » pour rattraper
  une absence), limité aux activités déjà faites par sa classe ; jamais d'information
  personnelle (PAP, notes…).
- Impression ou PDF du classeur d'une séquence (pour un absent).
- Autres niveaux (3e, 5e) quand leurs gardes, bilans et mémos sont en base.

## 5. Questions pour Thomas (avant le lot 1)

1. **Pour qui d'abord ?** Vous seul (avoir le classeur modèle sous les yeux, le projeter), ou
   déjà les élèves (rattraper une absence) ?
2. **Le papier du classeur** : feuilles A4 grands carreaux ? Une fiche A5 par page (le bas
   reste libre), ou deux A5 par page ? Les documents A5 sont-ils collés sous la fiche, en face,
   ou au dos ?
3. **Couleurs de l'élève** : réponses en bleu et corrections en vert, c'est bien la règle ?
4. **Évaluations** : sont-elles dans le classeur (et où), ou à part ?
5. **Qui écrit** : un classeur « parfait » (toutes les réponses justes) suffit-il pour l'essai ?
   Le vrai classeur d'un élève (ses réponses scannées) est une autre affaire, plus tard.
