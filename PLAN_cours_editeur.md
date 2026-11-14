# Plan — Éditeur de cours : modes Texte, Tableau et En classe

> 12/11/2026 — branche `feat/tableau-retours`. Rien n'est codé. Maquette cliquable :
> `gestion-classe-web/public/_maquettes/editeur-cours.html` (servie par Vite : `/gestion-classe/_maquettes/editeur-cours.html`).

## 1. Le besoin (Thomas)

- La préparation d'un tableau depuis l'ordinateur est pénible : l'interface est pensée pour
  le TBI (pastille, gros boutons) et le menu « … » est un fourre-tout où l'on se perd.
- Il veut **rédiger un cours comme dans Word / LibreOffice**, avec le même ressenti, et
  pouvoir **imprimer** ce cours (A4).
- Trois modes sur **le même document** :
  1. **Texte** : traitement de texte, ruban à la Word.
  2. **Tableau** : on dessine, on pose formes, flèches, boutons… **par-dessus** le texte.
     On passe librement de l'un à l'autre.
  3. **En classe** : plus d'édition ; animations et boutons d'action se jouent ; on écrit au
     stylet par-dessus ou dans les zones prévues ; le téléphone pilote. Ouvrable **pour tester**
     chez soi (l'encre est effacée à la sortie) ou **le jour J** depuis le calendrier de
     l'accueil (on attend toujours que le téléphone démarre la séance).
- Animations légères pour commencer : paragraphe qui apparaît au clic, mot caché (texte à
  trous), surlignage au fil du cours, bouton qui ouvre une définition / une image.

## 2. L'idée centrale : « la loupe qui fait la largeur du texte »

Le conflit : un cours imprimable est en **A4 portrait**, l'écran de classe est en **16:9
paysage**. Faire deux mises en page, c'est travailler deux fois ; projeter la page A4 entière,
c'est illisible (texte à ~16 px).

**Solution : il n'y a qu'un document, la feuille A4. En classe, l'écran n'affiche pas la page
entière : il affiche une bande de la largeur exacte de la colonne de texte, qui descend le long
du cours.**

Le calcul qui rend ça possible (TBI 1280 × 720) :

| | Papier | Écran en classe |
|---|---|---|
| Largeur de colonne (A4, marges 2,5 cm) | 16 cm | 1 280 px → **8 px par mm** |
| Texte 12 pt (≈ 4,2 mm) | lisible | **≈ 34 px** = le minimum « texte de page ≥ 34 px » du handoff TBI |
| Hauteur visible | — | 720 px = **9 cm de feuille** (≈ 18 lignes) |
| Un bloc 16:9 de la largeur de colonne | 16 × 9 cm | **exactement un écran** |

D'où trois briques qui s'emboîtent :

1. **La feuille** (mode Texte) : texte qui coule, titres, listes, images, tableaux, comme Word.
   Pages A4 visibles à l'écran (sauts de page), impression fidèle.
2. **Les encarts tableau** : un bloc qu'on insère dans le texte comme une image
   (Insertion › Encart tableau), au format 16:9 de la largeur de colonne. Sur papier c'est une
   figure (imprimée remplie, ou **vide** pour que l'élève la complète) ; en classe, quand on
   l'atteint, il **remplit l'écran au pixel près** : c'est un tableau blanc plein écran au
   milieu du cours. Les anciens tableaux (pages 16:9) deviennent des cours faits uniquement
   d'encarts : rien n'est perdu.
3. **Les zones d'écriture** : bloc « lignes Seyès / carreaux / blanc » d'une hauteur choisie.
   Imprimé, c'est la place laissée à l'élève ; en classe, c'est là qu'on écrit au stylet.

Et le **calque tableau** : tout ce qu'on pose en mode Tableau (encre, formes, flèches,
boutons, post-it) se place **au-dessus de la feuille**. Chaque élément est **ancré au
paragraphe** sous lui, comme une image « ancrée au paragraphe » dans Word : si l'on ajoute du
texte plus haut, la flèche descend avec son paragraphe au lieu de pointer dans le vide.

En classe :
- l'écran montre la bande de colonne ; **Suivant** (flèche, télécommande, téléphone) joue
  l'animation suivante visible, sinon descend d'un écran ; les sauts de page n'existent pas
  (ruban continu, un trait discret les signale) ;
- un geste « dézoomer » montre la feuille entière posée sur l'ardoise (vue d'ensemble), puis
  on revient à la bande ;
- l'encre de la séance est rangée dans la séance (comme aujourd'hui), jamais dans le cours
  préparé ; en mode test, elle est jetée à la sortie.

## 3. Interface d'édition (ordinateur) — le « feeling Word »

Repris de Word / LibreOffice, parce que c'est ce que la main connaît :

- **Barre de titre** : nom du cours, classe et date du cours (ex. « 5D · ven. 13 nov. »),
  état d'enregistrement (« Enregistré » automatique, comme Word en ligne), Annuler / Rétablir.
- **Ruban à onglets** (groupes étiquetés, grandes icônes pour les actions fréquentes) :
  - **Fichier** : enregistrer comme modèle, exporter PDF, imprimer, version élève (sans
    corrigé), propriétés.
  - **Accueil** : Presse-papiers · Police (famille, taille, gras, italique, souligné,
    couleur, surlignage) · Paragraphe (listes, alignement, retrait, interligne) · **Styles**
    (galerie : Normal, Titre 1, Titre 2, Définition, À retenir, Consigne, Exemple).
  - **Insertion** : Image · Tableau · **Encart tableau 16:9** · **Zone d'écriture** ·
    Équation · Saut de page · Lien.
  - **Dessin** (actif en mode Tableau) : sélection, stylo, surligneur, gomme, formes,
    flèches/connecteurs, post-it, widgets, couleurs et épaisseurs — les outils actuels du
    tableau, enfin rangés et étiquetés.
  - **Animations** : Apparaître au clic · Mot caché · Surligner au clic · Bouton → fenêtre ;
    volet **« Ordre des animations »** à droite (comme PowerPoint) pour réordonner les étapes.
  - **Affichage** : Texte / Tableau / En classe, zoom, règle, afficher les ancres,
    afficher la bande « écran de classe » (repère de ce qui tiendra à l'écran).
- **Règle** horizontale avec marges et retraits.
- **Barre d'état** (en bas, comme Word) : « Page 2 sur 4 · 412 mots · Écran 3 sur 9 »,
  boutons de mode **Texte | Tableau | ▶ En classe**, curseur de zoom.
- **Menu contextuel** (clic droit) à la Word : couper, copier, coller, style, animer…
- **Raccourcis Word** : Ctrl+B/I/U, Ctrl+Alt+1/2 (titres), Ctrl+Entrée (saut de page),
  Ctrl+Z/Y, Ctrl+P.

Le menu « … » actuel disparaît sur ordinateur : chaque entrée trouve sa place dans un onglet.
Le mode En classe garde l'interface minimale du TBI (pastille, gros boutons) et n'a pas de ruban.

## 4. Ce qui change dans les données

- Un cours = `boards` (inchangé) + un document : **flux de texte** (JSON ProseMirror :
  paragraphes, titres, listes, images, tableaux, encarts, zones d'écriture — chaque bloc porte
  un identifiant stable) + **calque** (objets et encre du tableau actuel, chacun avec son ancre
  `{ blockId, dx, dy }`).
- Les encarts tableau réutilisent le modèle de page actuel (`BoardPage` : encre, objets, fond,
  interactions) : rendu, export et commandes du téléphone restent les mêmes.
- Les états de séance (révélations, animations jouées) restent dans l'état de séance, jamais
  dans le cours préparé (règle actuelle).
- Stockage : une colonne JSONB sur `boards` (ou une table `board_documents`) — à trancher au
  lot 0 ; migration additive, rien ne casse les tableaux existants.

## 5. Choix technique proposé

- Éditeur de texte : **TipTap** (sur ProseMirror, licence MIT) — le standard pour un
  traitement de texte web : styles, listes, tableaux, images, raccourcis, collage depuis Word.
  Les blocs maison (encart, zone d'écriture, animations) sont des extensions TipTap.
- Pages A4 à l'écran : colonne continue + sauts de page calculés en mesurant les blocs (les
  extensions de pagination complètes de TipTap sont payantes) ; impression par le navigateur
  avec une feuille de style `@page A4` identique.
- Calque tableau : le code actuel (`BoardObjectLayer`, encre, connecteurs) monté par-dessus la
  colonne, coordonnées converties via l'ancre de bloc.

## 6. Découpage en lots

| Lot | Contenu | Résultat visible |
|---|---|---|
| 0 | Modèle de document, stockage, conversion des anciens tableaux en « cours d'encarts » | Un tableau existant s'ouvre toujours |
| 1 | **Mode Texte** : TipTap, feuille A4, ruban Accueil + Insertion (sans encarts), barre d'état, impression PDF | On rédige et imprime un cours |
| 2 | **Encarts tableau** et **zones d'écriture** dans le texte | Schémas 16:9 et place pour écrire |
| 3 | **Mode Tableau** : calque ancré au-dessus du texte, onglet Dessin (outils actuels rangés) | Flèches et annotations sur le cours |
| 4 | **Mode En classe** : bande de colonne, Suivant, dézoom, encre de séance, test effacé, téléphone, bouton du calendrier | Le cours se joue en classe |
| 5 | **Animations légères** + volet Ordre des animations | Apparition, mot caché, surlignage, bouton |
| 6 | Finitions : menu contextuel Word, raccourcis, galerie de styles complète, version élève | Le « feeling Word » complet |

Chaque lot est livrable seul (PR distincte, testée dans le navigateur).

## 7. Questions encore ouvertes

1. Marges et police par défaut : Word (2,5 cm, Calibri/Aptos 11) ou LibreOffice (2 cm,
   Liberation 12) ? Proposé : marges 2,5 cm, **12 pt** (c'est ce qui donne 34 px en classe),
   police lisible au TBI (Atkinson Hyperlegible, déjà embarquée).
2. Un cours préparé à partir d'un modèle (« Enregistrer comme modèle ») : utile dès le lot 1 ?
3. Version élève à l'impression : masquer le corrigé (mots cachés imprimés en pointillés,
   encarts imprimés vides) — automatique ou au choix à chaque impression ?

## 8. Avancement

### Étapes 0 et 1 — livrées le 12/11/2026 (branche `feat/tableau-retours`)

- **Migration 071** (`boards.doc` JSONB) appliquée en prod. `doc` NULL = tableau blanc classique.
- `lib/course/courseDoc.ts` (lecture, écriture, création, copie locale de secours),
  `lib/course/coursePage.ts` (géométrie A4 : 793,7 × 1122,52 px, marges 94,49 px, colonne 604,7 px).
- `components/course/` : `CourseEditor` (plein écran, barre de titre, règle, feuilles, barre
  d'état, enregistrement 1 s après la frappe + nouvel essai 15 s), `CourseRibbon` (Fichier,
  Accueil, Insertion, Affichage + onglets contextuels Tableau et Image), `coursePagination`
  (intercalaires avant le premier bloc qui déborde ; positions au sous-pixel ; titres solidaires
  du suivant), `courseExtensions` (TipTap 3.33 : StarterKit, TextStyleKit, TextAlign, Highlight,
  TableKit, Image → chemin du bucket `board-assets` + URL signée, encadrés, saut de page,
  UniqueID `blockId` sur les blocs), `OpenPreparedBoard` (choisit l'éditeur à l'ouverture).
- Points d'entrée : popover de l'emploi du temps (« 📄 Rédiger un cours » / « 📋 Tableau blanc »),
  « Mes tableaux » (+ Nouveau demande le type ; icônes 📄 / 📋). Copier un tableau de cours vers
  une autre classe copie aussi le document.
- Vérifié dans le navigateur : saisie, styles, pagination (aucun bloc ne déborde, saut de page,
  titre renvoyé avec son texte), rechargement depuis la base, image collée (envoi, affichage,
  50 %), tableau (onglet contextuel, ajout de ligne), mise en page d'impression (feuilles
  collées, intercalaires recalculés).
- Écarts / limites : pas d'impression réelle testée (seulement la mise en page) ; lien saisi par
  `window.prompt` ; un paragraphe plus haut qu'une page ne se coupe pas (il déborde) ; « Lancer la
  séance » d'un cours rédigé ouvre un tableau vide tant que l'étape 4 n'est pas faite.

### Étape 2 — encarts tableau et zones d'écriture, livrée le 12/11/2026 (branche `feat/cours-encarts`)

- **Encart tableau** (nœud `encart`, `EncartView`, `encartStore`) : bloc 16:9 de la largeur de
  colonne (605 × 340 px = un écran en classe) qui pointe vers une page de `board_pages`
  (board_id = le tableau du cours, `pageId` dans le document). Aperçu dessiné par
  `renderPageToCanvas` ; double-clic ou « Modifier l'encart » ouvre le **tableau blanc en mode
  page seule** (`Whiteboard.onlyPageId` : ni navigateur, ni rail, ni nouvelle page, ni
  allongement, ni bulles de premier lancement ; stockage local `encart:<pageId>`). Le cours reste
  monté, masqué (`visibility: hidden`) pour garder sa pagination. Impression « rempli » ou
  « vide » (cadre seul, à compléter par l'élève).
- **Zone d'écriture** (nœud `writingZone`) : Seyès (8 mm + interlignes 2 mm + marge), carreaux
  5 mm, lignes 8 mm, blanc ; 1 à 40 lignes de 8 mm ; imprimée en couleur.
- Ruban : Insertion › Encart / Zone actifs ; onglets contextuels « Encart tableau » et « Zone
  d'écriture » ; l'onglet actif est calculé au rendu (plus d'effets) et un réglage resélectionne
  le bloc (ProseMirror remplace un bloc insécable modifié, la sélection sautait au voisin).
- Tableau blanc : « Retour » envoie les dernières modifications au serveur avant de fermer
  (aussi utile hors encarts).
- Copier un cours vers une autre classe garde les identifiants de pages (sinon les encarts de
  la copie pointeraient dans le vide).
- Vérifié dans le navigateur : insertion, dessin dans l'encart (2 traits en base dès la
  fermeture), aperçu au retour et après rechargement, réglages de zone, « imprimé vide ».
- Limites : un encart copié-collé dans le même cours partage sa page avec l'original ; les pages
  d'encarts supprimés restent en base (sans effet) ; impression réelle non testée ; la copie vers
  une autre classe n'a pas été testée dans le navigateur.

### Étape 3a — ruban du tableau blanc, faite le 12/11/2026 (branche `feat/tableau-ruban`)

Demande de Thomas : les fonctions du tableau lui plaisent, mais le visuel de création non →
l'habillage de l'éditeur de cours, adapté au tableau.

- `BoardRibbon.tsx` (+ `BoardStatusBar`) : barre de titre, onglets **Fichier, Accueil, Insertion,
  Page, Outils, Affichage**, groupes étiquetés, barre d'état (pages, zoom). Il réutilise les
  classes `ce-*` de `course.css` (variables partagées par `.ce-chrome`) et les icônes de
  `courseIcons.tsx` (une cinquantaine ajoutées).
- `Whiteboard` : prop `chrome` ('tbi' par défaut, 'ribbon'). Le ruban ne porte aucun geste : il
  reçoit une table d'actions par identifiant, construite à partir de `paletteBindings`, de
  `moreSections` et des actions qui n'avaient pas de bouton (presse-papiers, ordre, grouper,
  verrouiller, dupliquer / supprimer la page, rideau, hauteur, image PNG). Sous le ruban : pas de
  barre flottante, de pastille, de rail de pages ni de bulles ; barres d'objet posées sur l'objet.
- Thème clair par variables (`.wb--ribbon` + `body.wb-ribbon-on` pour les couches portalées) dans
  `wb-theme.css` : bureau gris clair, page avec marges, chrome blanc, boutons de 36 px.
- Ruban actif pour : tableaux préparés et brouillon ouverts depuis l'accueil / Mes tableaux,
  encarts de cours. **La classe (`/classe`) garde l'habillage tactile.** Affichage › « Tactile
  (TBI) » y revient (choix mémorisé, `classroom-board-chrome`) ; retour par Plus › Réglages.
- Vérifié dans le navigateur : rendu, outils, forme + barre d'objet claire, onglets, post-it,
  nouvelle page, fond quadrillé, volet des pages, bascule tactile ↔ ruban, encart (« Revenir au
  cours », onglet « Fond »).
- Reste (étape 3b) : le calque tableau **par-dessus le texte du cours**, ancré aux paragraphes.
  Les barres d'objet (texte, forme…) et les panneaux (Ressources, Rechercher) n'ont que les
  couleurs du thème clair, pas encore une mise en forme « ruban ».

### Étape 3b — mode Tableau, faite le 14/11/2026 (branche `feat/cours-mode-tableau`)

> **Depuis le 14/11/2026 au soir**, ce calque n'est plus un mode : c'est l'outil « Stylet » du
> mode Texte. « Tableau » désigne désormais les pages projetées du cours (l'ancien « Écrans »).
> Voir `PLAN_preparation_semaine.md`, « Les trois modes d'un cours ».

Choix de Thomas : un **calque léger** propre au cours plutôt que le tableau blanc complet
(4 300 lignes, plein écran, hauteur de page non enregistrée, toile trop grande pour un long
cours). Le tableau blanc de la classe n'est pas touché ; les outils riches (widgets, boutons,
connecteurs, post-it) restent dans les encarts 16:9.

- **Calque SVG** (`CourseLayer.tsx`) posé dans `.ce-sheets` au-dessus du texte : il suit le zoom
  et le défilement, reste net à tout zoom et s'imprime avec le cours (sans la sélection).
- **Rangé dans le cours** (`doc.layer.items`, `lib/course/courseLayer.ts`) : versions, copies,
  modèles, garde-fou d'enregistrement et aperçu des versions le suivent sans migration.
- **Ancrage** : chaque élément est accroché au bloc de premier niveau sous son origine
  (`blockId` + décalage vertical `dy`, x absolu) ; il descend avec son paragraphe quand du texte
  est ajouté plus haut ; si le bloc disparaît, il reste à sa dernière place connue. Déplacer un
  élément le réancre au bloc d'arrivée.
- **Mode** Texte / Tableau (barre d'état, Affichage) ; en mode Tableau, le texte est en lecture
  seule et l'onglet contextuel **Dessin** s'ouvre : Sélection (déplacer, Suppr), Stylo,
  Surligneur, Gomme, Trait, Flèche, Rectangle, Ellipse, Texte (double-clic pour modifier),
  7 couleurs, 3 épaisseurs, Annuler / Rétablir propres au calque (Ctrl+Z / Ctrl+Y), Tout effacer.
- Vérifié dans le navigateur : tracés des 5 types, ajout de 4 lignes en haut du cours (paragraphe
  et annotations descendent tous de 125 px), gomme, Ctrl+Z, déplacement de 100 px puis Suppr,
  enregistrement dans le cours et réouverture identique. Tests unitaires de l'ancrage.

**Non vérifié** : stylet et doigt sur tablette (événements pointeur, `touch-action: none`) ;
impression ; un annotation posée à cheval sur un saut de page (elle suit son bloc, qui peut
changer de page). Lot suivant : 4, mode En classe (bande de colonne, Suivant, encre de séance).

### Lot 4a — mode En classe (présentation), fait le 14/11/2026 (branche `feat/cours-en-classe`)

- **« ▶ En classe »** (barre d'état, Affichage) ouvre `CoursePresenter.tsx` en plein écran, avec le
  cours tel qu'à l'instant du clic.
- **Bande de la largeur de la colonne** (+ 18 px de marge de chaque côté) : sur un écran de
  1 280 px, le texte 12 pt est agrandi 2 fois. Pas de pages : les sauts deviennent un trait
  discret.
- **Suivant / Précédent** : flèches, espace, Entrée, Page suivante / précédente (télécommandes),
  boutons ◀ ▶ ; molette pour un réglage fin ; Début / Fin. Pas d'un écran moins 56 px (la
  dernière ligne reste visible). **Un encart 16:9** atteint en descendant est calé en haut et
  remplit l'écran (même s'il faut descendre d'un quart d'écran de plus).
- **Vue d'ensemble** (O) : tout le cours, la bande encadrée ; un clic ramène la bande à cet endroit.
- Annotations du mode Tableau affichées ; **encre de séance** (stylo, surligneur, gomme,
  4 couleurs, tout effacer) au-dessus, **mode test** : jamais enregistrée, perdue en quittant.
  Plein écran (F), Quitter (Échap). Barre d'outils discrète (transparente hors survol).
- Calque rendu plus robuste au passage : tracé en cours lu dans une référence (des événements
  rapprochés arrivent avant le rendu), capture du pointeur protégée.
- Vérifié dans le navigateur à 1 280 × 720 : bande (police du cours), arrêt sur l'encart en
  3 pas, Précédent, vue d'ensemble + clic, encre tracée puis disparue, cours inchangé en base.

**Constat** : aujourd'hui, un cours lancé dans `/classe` (« Lancer la séance », ou rattachement
automatique à la séance) n'envoie à l'écran que les pages de ses encarts (`copyBoardPages`) : le
texte et les annotations sont perdus. **Tranche 4b** : `/classe` affiche le présentateur quand le
tableau de la séance est un cours, encre de séance enregistrée dans la séance. Puis 4c
(commandes Suivant / Précédent / vue d'ensemble depuis le téléphone, protocole web + mobile),
4d (bouton du calendrier), 4e (dessiner dans un encart en classe sans toucher au cours préparé).

### Lot 4b — le cours dans l'écran de classe, fait le 14/11/2026 (branche `feat/cours-en-classe-seance`)

- **`/classe`** (`pages/Classroom.tsx`) : quand le tableau de la séance (« Lancer la séance » ou
  rattachement automatique) est un cours rédigé, l'écran affiche le présentateur
  (`CourseSessionView.tsx`) au lieu de verser le cours dans le tableau blanc (qui n'en gardait
  que les encarts). Tant que le type du tableau n'est pas connu, rien ne s'affiche (pour ne pas
  verser un cours par erreur). La séance garde le lien vers le cours (`linkSessionBoard`), sans
  copie des encarts.
- **Encre de la séance** rangée dans la séance : `session_boards.course_ink` (migration 073), avec
  une copie sur l'ordinateur de la classe ; enregistrée 1,2 s après le dernier trait et en
  quittant la vue ; rechargée au retour (page rechargée, B puis B). Jamais dans le cours préparé.
- Présentateur « intégré » : badge « Séance », pas de bouton Quitter (B revient au plan), F laissé
  à la page, sous les surimpressions (minuteur, tirage, rideau).
- Vérifié dans le navigateur : vue de séance montée sur un cours de test (annotations préparées,
  badge, encre tracée, gardée sur l'ordinateur, rechargée après démontage ; cours inchangé en
  base). **Non vérifié** : le parcours complet avec une vraie séance démarrée au téléphone
  (pas de fausse séance créée en base, pour ne pas en laisser une sur le téléphone) ;
  l'enregistrement serveur, qui attend la migration 073.

### Lot 4c — télécommande du téléphone, fait le 14/11/2026 (branche `feat/cours-classe-telephone`)

- Nouvelle commande du canal de classe : `{ kind: 'nav', action: 'next' | 'prev' | 'overview' }`,
  identique dans `lib/classroomProtocol.ts` (web) et `services/sync/classroomChannel.ts` (mobile).
- Web : le cours affiché dans `/classe` l'écoute (écran suivant, précédent, vue d'ensemble ;
  Suivant quitte la vue d'ensemble) ; reçue pendant que le plan est affiché, elle remontre le cours.
- Mobile (PR à part dans gestion-classe-mobile, branche `feat/cours-classe-nav`) : section
  « Cours projeté » dans la feuille « Écran de la classe » : Précédent, **Suivant** (grand bouton),
  Vue d'ensemble ; « Tableau blanc » devient « Tableau ou cours ». **APK à reconstruire.**
- Vérifié : côté web, avec un canal simulé (Suivant ×2, Précédent, vue d'ensemble, Suivant qui en
  sort, autres commandes ignorées) ; côté mobile, compilation TypeScript. **Non vérifié** : le
  téléphone réel (APK pas encore construit).

### Lot 4d — « En classe » depuis le calendrier, fait le 14/11/2026 (branche `feat/cours-calendrier`)

- Détail d'un cours de l'emploi du temps (`LessonPopover.tsx`) : quand le tableau préparé du cours
  est un **cours rédigé**, un lien **« ▶ En classe »** ouvre directement la présentation (mode
  test : pastille TEST, encre effacée en quittant, Échap revient à l'accueil). Disponible aussi
  pour un cours passé (revoir ce qui a été projeté) ; Copier / Supprimer restent réservés aux cours
  à venir.
- Le type est lu avec la liste des tableaux de la semaine (`lesson_boards` → `boards.doc->version`,
  champ `isCourse`), sans requête de plus à l'ouverture du détail.
- `openBoard({ …, present: true })` → `OpenPreparedBoard` (`present`) charge le cours et ouvre
  `CoursePresenter` au lieu de l'éditeur.
- Le jour J ne change pas : « Lancer la séance » ouvre `/classe` et le cours s'affiche quand le
  téléphone démarre la séance (4b), qui le fait avancer (4c) ; l'infobulle le dit pour un cours.
- Vérifié dans le navigateur : cours de test créé sur un créneau de la semaine suivante, lien
  affiché, présentation ouverte en mode test, Échap, puis cours supprimé (base vérifiée vide).
  Reste du lot 4 : 4e (dessiner dans un encart en classe sans toucher au cours préparé).

### Lot 4e — dessiner dans un encart en classe, fait le 14/11/2026 (branche `feat/cours-encarts-classe`)

- Dans la présentation, un encart entièrement à l'écran fait apparaître **« ✎ Encart »** dans la
  barre (ou double-clic sur l'encart, outil Main) : il s'ouvre dans le **tableau blanc tactile**,
  sur sa seule page, avec tous les outils (stylo, formes, texte, insertions…), en partant du
  contenu préparé.
- **En séance** : la page est rangée dans la séance (`board_pages.session_id`, même identifiant
  de page que l'encart), jamais dans le cours préparé ; stockage local par séance et par encart
  (`encart-seance:<séance>:<page>`). Au retour (« Revenir au cours ») et au rechargement, la
  présentation affiche la version de la séance. Aucune migration.
- **En mode test** : copie en mémoire seulement (ni serveur ni stockage local), perdue en quittant.
- Pendant qu'un encart est ouvert, le clavier et les commandes du téléphone ne font pas bouger le
  cours dessous.
- Technique : `Whiteboard` reçoit `localKey` (`null` = aucun stockage local) et `initialPage`, et
  rend ses pages à la fermeture ; `encartStore` garde des versions par séance / par essai
  (`setEncartOverrides`), que `EncartView` affiche à la place de l'encart préparé (option `scope`).
- Vérifié dans le navigateur (mode test) : encart préparé avec un trait, ouvert en classe par le
  bouton et par double-clic, second trait, retour : la présentation montre les deux traits, la base
  n'en garde qu'un (cours inchangé) ; après Quitter puis réouverture, seul le trait préparé reste ;
  flèches et Début ignorés pendant l'édition. **Non vérifié** : l'enregistrement dans une vraie
  séance (la clé étrangère `board_pages.session_id → sessions` interdit une séance factice).
