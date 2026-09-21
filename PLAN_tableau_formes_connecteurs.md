# Plan — Tableau blanc : formes connectées, boutons, onglets, densité, post-its, calculatrice

Rédigé le 20/09/2026 à partir de la demande de Thomas (six points) et d'une lecture du code
(`gestion-classe-web/src/components/classroom/`, `src/lib/board*.ts`). Aucune ligne de code
n'est écrite : ce document sert à valider les choix avant de coder.

## 0. Ce que le code sait déjà faire (et qui conditionne le plan)

| Point | État actuel | Fichier |
|---|---|---|
| Formes | Objet `ShapeObject` à boîte (x, y, w, h), chemin SVG unique pour DOM et canvas. Pas de texte, pas de rotation à l'écran (`rotation` existe dans le modèle, sans interface). | `lib/boardShapes.ts`, `BoardObjectLayer.tsx` |
| Poignées | 8 carrés blancs bordés d'indigo, préhension par anneau de 12 px autour de l'objet. | `BoardObjectLayer.tsx` (CSS `.wbo__handle`) |
| Encre | Les traits (`Stroke`) vivent dans `page.strokes`, dessinés sur un canvas séparé des objets. Une sélection d'encre (`wb__inksel`) se déplace ou s'agrandit, mais rien ne lie un trait à un objet. | `Whiteboard.tsx` |
| Boutons | `interactions: { targetId, action: show/hide/toggle }[]` sur n'importe quel objet. Choix de la cible via un panneau latéral + bandeau « Touchez l'objet… ». | `lib/boardObjects.ts`, `BoardInteractionsPanel.tsx`, `BoardPickOverlay.tsx` |
| Tableaux | Un composant `Whiteboard` = un tableau (séance, tableau préparé `boardId`, ou brouillon local). Trois points d'ouverture : `BoardsPanel`, `Classroom`, `SessionDetail`. Un tableau préparé s'ouvre en classe par copie de ses pages dans la séance. | `Whiteboard.tsx`, `BoardsPanel.tsx`, `BoardLibraryDialog.tsx` |
| Densité | Jetons `--wb-btn` 60 → 52 → 44 px selon largeur et hauteur, menu contextuel 44 px (40 px en compact). | `wb-theme.css`, `BoardContextMenu.tsx` |
| Post-it | Un `TextObject` avec `background` coloré ; rien de plus. | `lib/boardText.ts` |
| Calculatrice | Widget `calc`, résultat affiché dans `.wbw__screen`, local au widget. | `objects/WidgetView.tsx` |

Point structurant : **toutes les données du tableau sont du JSON dans `board_pages`** (objets et
traits). Aucune des six demandes n'exige de migration SQL : on ajoute des champs optionnels et
on garde la lecture des anciens tableaux telle quelle. En revanche, chaque nouveau rendu doit
être fait **deux fois** : dans le DOM (`BoardObjectLayer`) et dans le canvas (`boardRender.ts`),
sinon les vignettes, l'export PDF et l'écran projeté divergent.

---

## 1. Formes : poignées, connecteurs, texte, encre attachée

### 1.1 Nouveau visuel de sélection (comme la capture)

- Contour de sélection fin (1,5 px) en violet, poignées d'angle rondes blanches à bord gris,
  poignées de milieu de côté en « pilule » (barres courtes), comme sur la capture.
- Quatre **boutons de connexion** ronds hors de la boîte (↑ → ↓ ←) et un bouton **rotation**
  (↻) sous le bouton ↓. Taille suivant la densité : 32 px en serré, 40 px en confort ; les 24 px
  de la capture sont trop petits pour un doigt sur TBI. Ils n'apparaissent que sur une forme seule sélectionnée,
  jamais en multi-sélection ni sur un objet verrouillé.
- La barre flottante actuelle (`BoardShapeToolbar`) reste, juste réalignée au-dessus de la forme,
  avec ses actions courantes en premier : commentaire/texte, verrou, dupliquer, supprimer, ⋯.
- La rotation devient réelle **pour les formes seulement** dans ce lot : `rotation` existe déjà
  dans le modèle, il manque la poignée, la transformation CSS du cadre et la rotation dans
  `boardRender`. L'étendre aux images et textes touche tous les rendus canvas et l'éditeur de
  texte : plus tard. Les poignées de redimensionnement se désactivent pendant la rotation ;
  accrochage à 0/45/90° avec Maj. Les connecteurs s'ancrent sur la boîte tournée (coins
  recalculés), sinon la flèche part d'un coin fantôme.

### 1.2 Connecteurs (feature « chartboard »)

Nouveau type d'objet, indépendant des formes qu'il relie :

```ts
interface ConnectorObject extends BoardObjectBase {
  type: 'connector';
  from: ConnectorEnd; to: ConnectorEnd;
  route: 'curve' | 'straight' | 'elbow';   // courbe par défaut (comme la capture)
  heads: { start: boolean; end: boolean }; // flèche à la fin par défaut
  stroke: string; strokeWidth: number; dashed?: boolean;
  /** Décalage du point de contrôle (courbe) ou du coude, en unités, posé à la main. */
  bend?: { x: number; y: number };
  label?: string;                           // texte au milieu, optionnel
}
type ConnectorEnd =
  | { objectId: string; side: 'auto' | 'n' | 'e' | 's' | 'w' }
  | { x: number; y: number };               // extrémité libre
```

- **Géométrie dérivée, jamais stockée** : à chaque rendu, le point d'ancrage est recalculé à
  partir de la boîte courante de l'objet relié. Déplacer ou redimensionner une forme repositionne
  donc les connecteurs sans rien faire de plus (demande explicite de Thomas). `side: 'auto'`
  choisit le côté le plus proche de l'autre extrémité, réévalué à chaque déplacement.
- **Création depuis les boutons ↑→↓←** :
  - un **tap** crée une copie de la forme (même type, même style, sans texte) à une distance
    fixe dans cette direction, reliée par un connecteur ;
  - un **glisser** fait suivre un fantôme de la forme ; relâché dans le vide, il crée la copie à
    cet endroit, relâché sur une forme existante, il crée seulement le connecteur vers elle.
  Dans les deux cas, le connecteur est bien formé quel que soit le placement, parce que les côtés
  sont en `auto` : une cible posée en haut à gauche sera reliée par le côté gauche ou haut, pas
  par une flèche qui traverse la forme.
- **Contrôle après création** : sélectionner un connecteur montre trois poignées : les deux
  extrémités (à glisser pour rattacher à un autre objet, à un côté précis, ou pour libérer en
  point flottant) et le milieu (à glisser pour cintrer la courbe ou déplacer le coude). Barre
  flottante dédiée : tracé (courbe / droite / coudée), flèches (aucune, fin, deux bouts),
  couleur, épaisseur, pointillé, libellé, supprimer.
- Supprimer un objet supprime aussi les connecteurs qui lui sont attachés (une seule étape
  d'annulation), par cohérence avec l'encre attachée (décision 1). Copier-coller remappe les
  identifiants comme le fait déjà `cloneObjects` pour les interactions ; un connecteur n'est copié
  que si ses deux extrémités sont dans la sélection (ou libres).
- Les extrémités peuvent s'attacher à **n'importe quel objet à boîte** (image, texte, post-it,
  tableau, widget), pas seulement aux formes ; seuls les boutons ↑→↓← sont réservés aux formes.
- Sélection d'une courbe fine : le chemin est doublé d'un tracé invisible de 14 px de large pour
  le test de pointage, sinon il est impossible à attraper au doigt.
- Premier lot : tracés « courbe » et « droite » seulement ; « coudée » (routage orthogonal avec
  évitement) est reportée, c'est le morceau le plus coûteux pour le moins de valeur.
- Rendu canvas : même fonction de tracé (chemin) que le DOM, comme pour les formes.
- En classe (mode lecture), un connecteur est inerte, il ne se sélectionne pas.

### 1.3 Texte dans une forme

- `ShapeObject` gagne `text?: { html, size, font, color, align: 'center' }`. Le double-clic sur
  une forme ouvre l'éditeur de texte existant (le `contenteditable` de `BoardObjectLayer`, avec
  `BoardTextToolbar` : gras, couleur, taille), centré dans la boîte avec une marge de 8 %.
- Le texte se réduit automatiquement (taille mini 12) quand il ne tient plus, plutôt que de
  déborder ; l'utilisateur peut aussi agrandir la forme.
- Le rendu canvas réutilise `renderTextBox` de `boardText.ts` dans la boîte intérieure.
- Recherche (`boardSearch.ts`) et correcteur : le texte des formes entre dans l'index.

### 1.4 Encre attachée à une forme

- `Stroke` gagne `parentId?: string`. Un trait terminé dont **tous les points** sont dans la
  forme (test `isPointInPath` sur le chemin réel pour les formes fermées, donc l'intérieur d'une
  ellipse et non sa boîte ; 4 px de tolérance) est attaché à la forme fermée la plus haute qui le
  contient. Les lignes et flèches n'ont pas d'intérieur et ne capturent jamais d'encre.
- Déplacer la forme translate ses traits ; la redimensionner les met à l'échelle avec elle ; la
  supprimer supprime aussi ses traits (décision 1, avec Annuler). Les traits restent effaçables à
  la gomme.
- Historique : déplacer une forme avec son encre modifie objets **et** traits ; il faut une
  opération d'annulation combinée (`{ type: 'objects+strokes' }`), sur le modèle de `convert`
  qui existe déjà, sinon Annuler ne rend que la moitié du geste.
- Une entrée « Détacher l'encre » dans le menu de la forme, et « Attacher l'encre contenue »
  pour les tableaux existants (ou quand on dessine, puis qu'on pose la forme par-dessus).
- Le calque d'encre est un canvas unique : le déplacement se fait par réécriture des points du
  trait, exactement comme la sélection d'encre le fait aujourd'hui (`wb__inksel`). Pendant le
  glissement, on redessine à chaque `pointermove` ; c'est déjà le cas pour la sélection d'encre,
  donc pas de coût nouveau.

---

## 2. Boutons d'interaction : la flèche qui suit la souris

Comportement cible : depuis la barre de l'objet (⚡) ou le menu « Bouton et interactions »,
on entre en **mode liaison** :

1. Une flèche pointillée part du bouton et suit le pointeur (souris) ou le doigt pendant le
   glisser (TBI, qui n'a pas de survol). Les objets survolés se surlignent, le bouton lui-même
   et les objets non ciblables sont grisés.
2. Un tap sur la cible ouvre une **petite bulle** à côté d'elle : trois pastilles (Afficher,
   Masquer, Afficher / masquer), une case « caché au départ », **Valider** / Annuler. Valider crée
   l'interaction ; la flèche reste affichée en édition, en pointillé avec l'icône ⚡, pour montrer
   le lien.
3. Tap sur une flèche existante : la même bulle, avec **Supprimer**. Échap ou tap dans le vide
   annule le mode liaison. On peut enchaîner plusieurs cibles depuis le même bouton.

Choix techniques :

- La flèche est un **connecteur du lot 1** avec `route: 'curve'`, non persisté (dérivé de
  `interactions`), tracé en pointillé. Même code de géométrie, même poignées de survol. On ne
  duplique donc pas un système de flèches.
- Le panneau latéral `BoardInteractionsPanel` disparaît au profit de la bulle ; il reste
  un récapitulatif dans le menu contextuel (« Bouton et interactions (2) ») pour tester le bouton
  et voir la liste.
- Les flèches d'interaction ne s'affichent qu'en édition (jamais en classe ni à l'export), et
  seulement quand le bouton est sélectionné (décision 3). Un badge ⚡ avec le nombre de cibles
  reste visible sur le bouton non sélectionné, comme aujourd'hui.
- Les cibles « cachées au départ » sont des fantômes en édition : elles restent visibles et
  ciblables pendant la liaison, sinon on ne peut plus les relier une fois cachées.

---

## 3. Plusieurs tableaux ouverts : onglets

### Architecture

- Nouveau composant `BoardWorkspace` qui remplace le montage direct de `Whiteboard` aux trois
  points d'ouverture. Il tient une liste d'onglets `{ key, kind: 'session' | 'board' | 'draft',
  title, boardId? }` et rend un `Whiteboard` **par onglet, tous montés**, les inactifs masqués
  (`display: none`). Ainsi chaque tableau garde son état (page courante, zoom, sélection, timer
  des widgets) et sa sauvegarde indépendante, déjà rattachée à `sessionId`/`boardId`.
- Barre d'onglets de 36 px en haut (34 px en compact) : titre, pastille « projeté » sur l'onglet
  projeté en mode classe, × pour fermer, + pour ouvrir (Tableau préparé…, Brouillon, Nouveau
  tableau). Raccourci **Ctrl+Alt+→ / ←** (Ctrl+Tab est réservé par le navigateur et ne peut pas
  être intercepté). Masquée en mode affichage.
- `Whiteboard` reçoit une prop `active` : les écouteurs globaux (clavier à `window`, collage,
  redimensionnement, Realtime) ne réagissent que dans l'onglet actif. Sans cela, Ctrl+Z dans un
  onglet annulerait aussi dans les onglets masqués, et un collage irait dans tous les tableaux.
- Le dialogue « Ouvrir un tableau » propose deux verbes : **Ouvrir dans un onglet** (nouveau,
  sans toucher au tableau courant) et **Copier dans ce tableau** (comportement actuel, conservé
  pour préparer une séance).
- Copier-coller entre onglets fonctionne d'emblée : le presse-papiers interne (`boardClipboard`)
  est au niveau du module, pas du composant. On ajoute « Envoyer la page vers… » dans le menu de
  page pour déplacer une page entre onglets.
- Limite : 6 onglets. Chaque `Whiteboard` monte trois canvas plein écran ; au-delà, on prévient.
  Les onglets ouverts sont mémorisés par séance (`localStorage`) pour survivre à un rechargement.

### En classe (décision 2 : plusieurs tableaux projetables)

- L'écran `/classe` projette **l'onglet actif**, quel qu'il soit. Aujourd'hui il ne suit que
  `board_pages` de la séance ; il faut :
  - une commande `{ kind: 'board', ref: { sessionId } | { boardId } }` dans `classroomProtocol.ts`,
    envoyée par le bus à chaque changement d'onglet, pour que l'écran charge les pages du bon
    tableau et s'abonne à ses changements ;
  - le brouillon local (`remote: false`) n'est pas projetable tel quel : l'onglet le signale
    (« local, non projeté ») et propose « Enregistrer comme tableau » pour le rendre projetable ;
  - les commandes du téléphone (page suivante, rideau…) visent le tableau projeté.
- Le bandeau des élèves et le tirage au sort restent liés à la séance, pas au tableau.
- Effort : +1 jour sur le lot F par rapport à la version « seule la séance est projetée ».

---

## 4. Réduire la taille des menus

Constat : au palier compact (≤ 1366 px ou ≤ 800 px de haut, donc en 720p), les cibles font
44 px, les menus 40 px avec 6 px de marge, la barre 5 px de marge interne. C'est le plancher du
handoff, mais Thomas le trouve encore trop aéré.

- Nouveau palier **« serré »** appliqué en 720p (hauteur ≤ 800 px) : boutons 40 px, icônes
  20 px, espace entre boutons 4 px, marge de barre 3 px, rayon 10 px. Menu contextuel : lignes
  36 px, marge 4 px 10 px, largeur mini 200 px, séparateurs 4 px. Panneau d'insertion et bulles :
  marge 4 px, lignes 36 px. Barre flottante des objets : 36 px.
- Un réglage **Densité** (Confort / Normal / Serré) dans « Plus ⋯ › Réglages », mémorisé sur
  l'appareil, qui force un palier quelle que soit la taille d'écran. C'est aussi ce qu'attend le
  point D de la feuille de route (préférences par compte) : le réglage sera synchronisé plus tard.
- Tout passe par les jetons `--wb-*` déjà en place ; les composants qui ont encore des tailles en
  dur (menu contextuel, panneau d'insertion, `BoardInteractionsPanel`, barres flottantes) sont
  branchés sur ces jetons pour que le réglage les touche tous.

---

## 5. Post-it repliable

- `TextObject` gagne `collapsed?: boolean` (uniquement significatif avec `background`).
- Un petit bouton « – » discret dans le coin haut droit du post-it (visible au survol ou quand le
  post-it est sélectionné, 22 px, ne masque pas le texte). Replié, le post-it devient une pastille
  de 160 × 36 px de la même couleur avec la première ligne du texte en gras et une icône « + ».
- La pastille reste un objet normal : elle se déplace (anneau de préhension et fond de la
  pastille), se sélectionne, se supprime. Un tap sur la pastille (ou « + ») déploie.
- En classe, un tap déploie aussi (un « indice » à révéler), mais cet état est un **état de
  séance** (dans `RevealState`, comme les rideaux), pas une modification de l'objet : le post-it
  préparé replié le reste pour la classe suivante, et « Tout recouvrir » le replie.
- Le bouton « – » ne dépend pas du survol (inexistant sur TBI) : il est visible dès que le
  post-it est sélectionné, et toujours visible en petit (16 px, 40 % d'opacité) sinon.
- Rendu canvas : la pastille est dessinée telle quelle (l'export montre ce que l'écran montre).

---

## 6. Calculatrice : le résultat devient un objet

- Le résultat (`= 21`) devient **saisissable** : glisser depuis le résultat fait suivre une
  étiquette au pointeur ; relâcher sur la page crée une zone de texte « 21 » (décision 4 ; avec
  Maj, l'expression complète « 7 × 3 = 21 ») au point de dépôt, dans la police et la couleur
  courantes. Nombres au format français (virgule décimale), via `Intl.NumberFormat('fr-FR')`.
- Le glisser passe par les événements pointeur (pas le drag-and-drop HTML5, qui ne marche pas au
  doigt sur le TBI) : au `pointerdown` sur le résultat, on retient le pointeur, une étiquette
  suit, et au relâchement on convertit le point écran en unités de page.
- Fallback sans glisser (TBI, stylet capricieux) : un bouton « ⤓ Poser sur la page » à droite du
  résultat, qui pose l'étiquette juste sous la calculatrice.
- Le même mécanisme sert aux autres widgets qui produisent une valeur : dé (le tirage), roue (le
  choix), groupes (la liste des groupes en tableau), minuteur (le temps restant, pour figer un
  score). C'est un seul composant `WidgetResult` réutilisé.

---

## 7. Propositions au-delà de la demande (à trier)

Dans le sens des six points, ce que le tableau gagnerait sans beaucoup de code en plus :

1. **Guides d'alignement et aimantation** pendant le déplacement (bords et centres alignés avec
   les objets voisins, accroche à la grille quand un fond quadrillé est actif). Indispensable dès
   qu'on enchaîne des formes connectées : sans ça, les schémas sont tordus.
2. **Grouper / dégrouper** (Ctrl+G) : généralise l'encre attachée à tous les objets (une forme,
   son texte, ses traits, ses connecteurs). Le lot 1.4 est en fait un cas particulier de groupe.
3. **Mode carte mentale** : une forme centrale, ↵ crée un enfant connecté, Tab un frère, avec
   disposition automatique en éventail. Réutilise entièrement les connecteurs.
4. **Actions de bouton supplémentaires** : « aller à la page N », « tirer le rideau », « jouer
   un son », « lancer le minuteur », « révéler les trous ». Le modèle `InteractionAction` est une
   simple union, l'ajout est mécanique une fois la bulle du lot 2 en place.
5. **Vue côte à côte** de deux onglets (comparer une correction et une copie, un avant/après).
6. **Styles de forme rapides** : quatre thèmes (contour, plein clair, plein sombre, pointillé)
   d'un tap sur la barre, plutôt que couleur + remplissage + épaisseur séparés.
7. **Résultat de widget projeté** : en mode classe, « poser sur la page » envoie aussi l'objet à
   l'écran projeté (le tableau est déjà synchronisé, c'est gratuit).
8. **Post-it : couleurs et empilement** : palette de six couleurs sur la barre, et « ranger les
   post-its » qui les aligne en colonne repliés sur le bord de la page.
9. **Raccourci de connexion** : Ctrl + glisser depuis le bord d'une forme trace un connecteur
   sans passer par les boutons latéraux, pour la souris.
10. **Réglage de densité par appareil** (lot 4) : le TBI du collège en « Normal », le portable
    en « Serré », sans avoir à changer à chaque fois.

---

## 8. Découpage en lots et ordre proposé

| Lot | Contenu | Dépend de | Effort |
|---|---|---|---|
| A | Densité « serré » + réglage Densité (§4) | — | ½ j |
| B | Post-it repliable (§5) + résultat de calculatrice et des widgets (§6) | — | 1 j |
| C | Formes : nouvelles poignées, rotation, texte dans la forme, encre attachée (§1.1, 1.3, 1.4) | — | 2 j |
| D | Connecteurs : modèle, rendu DOM + canvas, boutons latéraux, poignées et barre (§1.2) | C | 4 j |
| E | Boutons d'interaction en mode liaison, bulle, suppression (§2) | D | 1,5 j |
| F | Onglets multi-tableaux, prop `active`, projection de l'onglet actif, page vers un autre onglet (§3) | — | 3,5 j |
| G | Guides d'alignement, grouper (§7.1, 7.2) | C | 1,5 j |
| 0 | Socle : Vitest + tests des fonctions pures (géométrie des connecteurs, contenance de l'encre, `settleCurtain`), commit du travail du 20/09 | — | ½ j |

Ordre retenu (décision 5) : **0, A, B, C, D, E, G, F**. A et B sont des gains rapides. C → D → E
forment la colonne vertébrale « schémas » et se testent ensemble sur un vrai cours (schéma
fonctionnel de SVT) ; G suit tout de suite parce que sans aimantation, les schémas connectés
sont tordus. F (onglets) vient en dernier : c'est le lot le plus risqué (écouteurs globaux,
mémoire, projection) et il n'est pas nécessaire aux autres.

Chaque lot se termine par : `npx tsc -b`, ESLint, un test sur le brouillon en 720p (fenêtre
1280 × 720) et un export PDF d'une page contenant les nouveaux objets.

## 8 bis. Livraison (nuit du 20 au 21/09/2026)

Tous les lots sont codés sur la branche `feat/tableau-formes-connecteurs`, un commit par lot,
`npx tsc -b`, ESLint, Vitest (36 tests) et `vite build` au vert, chaque lot vérifié dans le
navigateur sur le brouillon. Ce qui diffère du plan ou reste à faire :

- **Lot F, projection** : sur l'écran `/classe`, le tableau est écrit directement sur le TBI ;
  ce qui est affiché est l'onglet actif. Il n'y a donc pas de commande `board` à ajouter au
  protocole : seul l'onglet actif reçoit les commandes du téléphone (photo, caméra), le clavier
  et le collage. « Envoyer la page vers un autre onglet » n'est pas fait (copier-coller entre
  onglets marche déjà).
- **Lot D** : tracé « coudé » reporté comme prévu ; les têtes de flèche ne se dessinent pas
  au-delà du bord de la forme.
- **Lot C** : rotation des formes seulement (pas des images ni des textes).
- **Lot B** : résultat de calculatrice = « 21 » ; avec Maj, l'expression complète n'est pas
  faite (le glisser pose toujours la valeur seule).
- **Lot 0** : le brouillon qui gagnait des pages fantômes n'a pas été reproduit pendant la nuit
  (aucune page n'est apparue en cinq heures de tests) ; à surveiller.
- **Non fait** : navigation clavier dans le menu radial, `dx` de `CurtainSlide` toujours dans le
  modèle, tableau blanc mobile (aucun de ces lots ne touche l'application Expo).

## 9. Décisions prises le 20/09/2026

1. **Encre attachée** : supprimer la forme supprime ses traits (Annuler les rend). Étendu aux
   connecteurs par cohérence.
2. **Onglets en classe** : plusieurs tableaux projetables, l'onglet actif est projeté (§3).
3. **Flèches d'interaction** : visibles seulement quand le bouton est sélectionné.
4. **Résultat de calculatrice** : « 21 » seul ; l'expression complète avec Maj.
5. **Ordre des lots** : 0, A, B, C, D, E, G, F (§8).

## 10. Analyse critique du plan (relecture du 20/09)

Ce qui manquait ou était fragile dans la première version, et ce qui a été corrigé ci-dessus :

- **Annuler à moitié.** Déplacer une forme avec son encre touche deux historiques (objets,
  traits). Sans opération combinée, Annuler rend la forme mais pas l'encre. Ajouté en §1.4.
- **Onglets masqués qui réagissent.** `Whiteboard` pose des écouteurs sur `window` (clavier,
  collage). Six instances montées = six réactions à Ctrl+Z. Prop `active` ajoutée en §3, et c'est
  la raison pour laquelle F passe en dernier.
- **Ctrl+Tab** est réservé par le navigateur : remplacé par Ctrl+Alt+→/←.
- **Contenance dans la boîte au lieu de la forme** : un trait dans le coin d'une ellipse aurait
  été attaché à l'ellipse. Test sur le chemin réel (§1.4).
- **Flèches impossibles à attraper** au doigt : zone de pointage élargie (§1.2).
- **Post-it déplié en classe** : l'écrire dans l'objet aurait cassé la préparation du cours.
  État de séance à la place (§5).
- **Survol sur TBI** : le bouton « – » du post-it et les boutons latéraux des formes ne peuvent
  pas dépendre du survol ; visibles à la sélection, tailles tactiles (§1.1, §5).
- **Rotation** : restreinte aux formes, sinon le lot C double de taille.
- **Routage coudé** : reporté ; c'est l'algorithme le plus lourd du lot D.
- **Effort sous-estimé** sur D et F (+1 j chacun) ; lot 0 ajouté (tests des fonctions pures,
  commit du travail en cours), car le tableau n'a aucun test unitaire aujourd'hui et la
  géométrie des connecteurs est exactement le genre de code qui en a besoin.

Ce qui reste ouvert et sera tranché en codant :

- **Ordre d'empilement des connecteurs** : au-dessus des formes (lisible) ou entre elles (comme la
  capture) ? Proposition : au-dessus, sauf que les flèches ne se dessinent jamais par-dessus le
  texte d'une forme, parce qu'elles s'arrêtent à son bord.
- **Brouillon et pages fantômes** : pendant les tests du 20/09, le brouillon local est passé de
  deux à quatre pages sans action identifiée, et un post-it est apparu. Soit un usage parallèle
  dans le même navigateur, soit un défaut de persistance du brouillon (`classroom-board-free`).
  À vérifier **avant** le lot F, qui multiplie les tableaux montés et donc les sauvegardes.
- **Mémoire des onglets** : six tableaux montés = dix-huit canvas plein écran ; si le TBI du
  collège (souvent un PC modeste) souffre, démonter les onglets inactifs après cinq minutes en
  gardant leur état sérialisé, et les remonter à la demande.
- **Texte des formes dans la recherche et le correcteur** : prévu en §1.3, à ne pas oublier dans
  `boardSearch.ts` et `BoardSpellChecker`.

Retour sur le travail livré le 20/09 (rideau vertical, sous-menus, insertion, widgets
déplaçables), à corriger dans le lot 0 :

- Le menu contextuel n'a pas de navigation au clavier (flèches, Entrée) ; peu grave sur TBI,
  gênant au portable.
- Sur TBI, un tap sur une entrée à sous-menu l'ouvre, mais rien ne le referme sans fermer tout
  le menu ; un second tap sur l'entrée devrait le refermer.
- La bande de préhension des widgets prend 1 em en haut : sur le QR code et l'horloge, le contenu
  descend d'autant ; à vérifier visuellement sur chaque widget et ajuster les hauteurs par
  défaut dans `insertWidget`.
- Le champ `dx` de `CurtainSlide` reste dans le modèle et dans les états déjà enregistrés ; à
  nettoyer (migration douce : ignorer à la lecture, ne plus écrire) quand on touchera à
  `boardReveal.ts`.
