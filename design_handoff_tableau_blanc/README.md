# Handoff design — Tableau blanc (Épic 12)
## Lots A et B

Maquettes : `Tableau blanc — canevas.dc.html` — bloc **1a** (Lot A, écran-témoin 1920 × 1080)
bloc **2a** (Lot B, le geste), bloc **3a** (Lot C, les objets), bloc **4a** (Lot D, la classe) bloc **5a** (Lot E, les panneaux) et bloc **6a** (Lot F, finitions).
Rédigé le 10/09/2026.

---

## 0. État de la source — À JOUR (11/09/2026)

Le code du tableau blanc est sur `master` : 20 composants dans
`gestion-classe-web/src/components/classroom/` (+ 6 vues d'objet), 21 modules `lib/board*.ts`,
et `PLAN_tableau_blanc.md` à la racine. Les vrais sélecteurs ont été relevés et le patch est
écrit contre eux : **`design_handoff_tableau_blanc/wb-theme.css`**.

Deux corrections par rapport aux préfixes supposés des lots A→F : le **menu contextuel** est
`.wbm` (et non `.wbc__*`), `.wbc` étant le **sélecteur de couleur** ; le **navigateur de pages**
est `.wbn`, `.wbp` étant le **tirage au sort**. Les tables « classes touchées » de chaque lot
sont remplacées par la table § 8 ci-dessous. Ce qui est certain et vérifié dans le dépôt : les variables globales de
`src/index.css` (`--accent: #F97316`, `--color-primary-dark: #4F46E5`, `--pos: #059669`,
`--neg: #DC2626`, `--radius: 14px`, `--density-row: 52px`) et les tokens mobiles de
`components/live-session/directionB.ts`. Le tableau leur emprunte deux teintes et rien d'autre.

---

## 1. La direction : papier posé sur ardoise

Un seul parti : **la page est la seule surface claire de l'écran.** Le bureau, la barre, les panneaux
et le rail de pages reculent dans un graphite dense et froid. Trois conséquences, toutes tirées des
principes du § 5 du brief :

1. **Projection.** Un vidéoprojecteur écrase les gris moyens et fait baver les flous. La palette
   n'a donc que trois familles — bureau (≈ 6 % de luminance), papier (100 %), encre — et aucune
   valeur intermédiaire. Le contraste page/bureau est de 18:1.
2. **Six mètres.** Le seul élément blanc du chrome est **l'outil actif**. Un élève au fond, comme
   Aurélie de biais, repère l'outil courant sans lire une icône.
3. **Discrétion (Freeform).** Le chrome sombre sur bureau sombre disparaît visuellement dès qu'on
   regarde la page ; il ne réapparaît que quand on le cherche.

Ce que le tableau **ne prend pas** au reste de l'app : sa densité, ses rayons de 14 px partout, son
fond `#F6F7F9`. Ce qu'il **prend** : `--accent` orange et `--color-primary-dark` indigo, pour que les
événements de séance (implication, malus, sortie, absence) gardent exactement les mêmes couleurs
d'un écran à l'autre. Cousin, pas clone.

---

## 2. Tokens

À définir dans **`src/components/classroom/theme.ts`** (fourni : `theme.ts` à côté de ce README) et
dans un bloc `:root` **scopé à `.wb`**. `src/index.css` n'est pas touché.

### Bureau et papier
| Token | Valeur | Usage |
|---|---|---|
| `--wb-desk` | `#0D1015` | fond hors page (`.wb__stage`) |
| `--wb-desk-2` | `#12161D` | rail de pages, gouttières |
| `--wb-paper` | `#FFFFFF` | page |
| `--wb-paper-warm` | `#FDFCFA` | fond « papier » alternatif |
| `--wb-grid` | `#DFE6EF` | quadrillage 1 px, pas 50 px |
| `--wb-grid-major` | `#C3CFDF` | ligne forte, pas 250 px |
| `--wb-seyes` | `#B9C7E8` | Seyès, interlignes |
| `--wb-seyes-marge` | `#E9A6C0` | marge Seyès |
| `--wb-paper-edge` | `0 18px 40px -14px rgba(0,0,0,.75)` | ombre de la page |

### Chrome
| Token | Valeur | Usage |
|---|---|---|
| `--wb-chrome` | `#171C24` | barre, tiroirs, menus, panneaux |
| `--wb-chrome-hover` | `#212936` | survol de bouton |
| `--wb-chrome-sunk` | `#1E2530` | boutons secondaires, pilules neutres |
| `--wb-chrome-line` | `#2E3846` | bordures 1 px, séparateurs |
| `--wb-on-chrome` | `#E7ECF3` | icônes et libellés |
| `--wb-on-chrome-dim` | `#93A0B4` | rangée secondaire, méta |
| `--wb-on-chrome-mute` | `#6E7C92` | intitulés de section |

### Accents (cousins de l'app)
| Token | Valeur | Hérite de | Usage |
|---|---|---|---|
| `--wb-select` | `#4F46E5` | `--color-primary-dark` | sélection, poignées, page active, bascules |
| `--wb-select-soft` | `rgba(79,70,229,.14)` | — | rectangle de sélection, survol de vignette |
| `--wb-accent` | `#F97316` | `--accent` | ajout, enregistrement, moments, alerte de bruit |
| `--wb-ok` | `#059669` | `--pos` | présence, réussite, révélation validée |
| `--wb-danger` | `#DC2626` | `--neg` | supprimer, effacer, erreur |

### Encres et surligneurs
Encres : `#14181F` `#DC2626` `#1D4ED8` `#047857` `#F97316` `#7C3AED` `#DB2777` `#FFFFFF`
(le blanc est cerné d'un liseré `#C3CFDF` sur papier blanc).
Surligneurs à 38 % d'opacité : `#FDE047` `#86EFAC` `#7DD3FC` `#F9A8D4` `#FDBA74`.
Épaisseurs de trait : **3 / 6 / 10 / 16 px** (page à 100 %), pression ±40 % autour de la valeur.
Laser : `#FF2D2D`, 9 px, disparition en 900 ms.

### Typographie
| Rôle | Police | Taille (page 1920) |
|---|---|---|
| Affichage (minuteur, tirage, sonomètre) | Space Grotesk 600, chiffres tabulaires | 220 px |
| Titre de widget | Atkinson Hyperlegible Next 800 | 44 px |
| Texte de page | Atkinson Hyperlegible Next 400/700 | 40 px défaut, **34 px plancher** |
| Ligne de menu | Atkinson Hyperlegible Next 500 | 20 px sur ligne 44 px |
| Étiquette, badge, barre | Atkinson Hyperlegible Next 600 | 17 px plancher absolu |

**Pourquoi ces deux-là.** Atkinson Hyperlegible Next est dessinée pour la distinction des caractères
en basse lisibilité (I/l/1, O/0, a/e) : c'est exactement le problème d'un texte lu à six mètres sur
une image projetée. Space Grotesk fournit des chiffres tabulaires larges qui ne dansent pas dans un
décompte. Les deux sont sous licence libre et **doivent être embarquées en .woff2** dans
`gestion-classe-web/public/fonts/` avec un `@font-face` local — aucun appel CDN (réseau du collège).
Inter et IBM Plex Mono restent en repli dans la pile.

### Rayons, profondeur, mouvement
`--wb-r-page: 3px` · `--wb-r-btn: 14px` · `--wb-r-bar: 22px` · `--wb-r-panel: 28px` · `--wb-r-pill: 999px`

`--wb-e1: 0 2px 6px -2px rgba(0,0,0,.7)` (posé) ·
`--wb-e2: 0 14px 30px -14px rgba(0,0,0,.9)` (barre, tiroir) ·
`--wb-e3: 0 24px 48px -20px rgba(0,0,0,1)` (panneau plein écran).
**Trois ombres, pas une de plus. Aucun `backdrop-filter`, aucun `filter: blur`** au-dessus de
`.wb__stage` : coût GPU pendant le tracé et bavure au vidéoprojecteur.

`--wb-t-fast: 90ms` (survol, actif) · `--wb-t: 140ms cubic-bezier(.2,.8,.2,1)` (tiroir, menu) ·
`--wb-t-panel: 200ms` · moments 480–700 ms. **L'encre, la gomme et le laser ne sont jamais animés.**

### Cibles
Barre principale 60 px · rangée secondaire 52 px · menus et poignées de vignette 44 px ·
poignées de sélection 18 px visuels / **44 px de zone tactile**.

---

## 3. Décisions du lot, et pourquoi

1. **Chrome sombre conservé, hiérarchie ajoutée.** La barre actuelle aligne tout à 52 px sans
   hiérarchie. Elle devient **quatre grappes** dans une seule pilule : *encre* (sélection, stylo,
   surligneur, gomme, laser — 60 px), *créer* (texte, formes, insérer — 60 px), *page et historique*
   (annuler, rétablir, fonds, pages — 60 px), *séance* (recherche, ressources, clavier, réglages,
   fermer — 52 px, teinte atténuée). Ce qu'on touche cent fois par heure est plus grand et à gauche
   du groupe ; ce qu'on touche deux fois par heure est plus petit et au bout.
   **→ demande un changement de JSX** : introduire des conteneurs de grappe et des séparateurs.
2. **Le tiroir remplace les rangées permanentes.** Couleurs et épaisseurs n'existent que quand un
   outil d'encre est actif, dans un tiroir ancré au bouton, et **se ferment au premier contact du
   stylet sur la page** (principe 3). Le chrome permanent perd une rangée entière.
3. **L'outil actif porte la couleur courante** (pastille dans le coin du bouton) : le lien
   outil ↔ couleur est visible sans ouvrir le tiroir.
4. **Rien au centre-haut.** Contexte à gauche, état de séance à droite, zoom en bas à gauche —
   la bande centrale haute reste vide, c'est celle que le corps de l'enseignant masque.
5. **Sélection indigo, action orange.** Deux accents seulement, hérités de l'app. L'indigo ne sert
   jamais à une action, l'orange ne sert jamais à un état de sélection.
6. **Fait main léger** pour les formes et la bibliothèque : jointures arrondies, angles à peine
   désalignés, épaisseur constante — accueillant sans paraître brouillon. À implémenter dans
   `boardShapes.ts` par un décalage déterministe (seed par objet, ±1,5 px) pour que la forme soit
   **identique entre le rendu écran, la vignette et l'export PDF**.
7. **Muet.** Aucun son : décision confirmée. Les moments passent par la couleur et le mouvement.

---

## 4. Correspondance avec le code (à revérifier sur la branche)

| Fichier / bloc CSS | Ce que le lot A change |
|---|---|
| `components/classroom/` — bloc `.wb__*` | `--wb-desk` en fond de `.wb__stage`, ombre de page `--wb-paper-edge`, badge de zoom en pilule 44 px |
| bloc `.wbt__*` (barre) | réécriture complète : grappes, tailles 60/52, états, tiroir ancré — **JSX à modifier** |
| bloc `.wbo__*` (objets, sélection) | poignées 18 px `--wb-select` sur fond blanc, zone tactile 44 px — détail complet au lot B |
| bloc `.wbp__*` (pages) | rail `--wb-desk-2`, vignette active cerclée `--wb-select`, numéro en coin |
| `lib/boardRender.ts` | couleurs de fonds : `--wb-grid`, `--wb-grid-major`, `--wb-seyes`, `--wb-seyes-marge` ; graisse 1 px logique |
| `lib/boardShapes.ts` | palette d'encre, épaisseurs 3/6/10/16, décalage « fait main » déterministe |
| `lib/boardText.ts` | pile de polices embarquées, plancher 34 px |
| `pages/Classroom.tsx` (`classroom__*`, `seat*`) | même palette ; traité au lot D |

**Contrainte tenue :** tous les tokens visuels utilisés par le canvas sont exportés depuis
`theme.ts` et consommés à la fois par le CSS (via un bloc `:root` généré) et par les fonctions de
rendu — une seule source, donc écran, vignettes et export PDF restent identiques.

---

## 5. Ce qui reste à faire avant le lot B

- Pousser la branche du tableau blanc : sans elle, le patch global ne peut pas être écrit
  contre les vrais blocs `const CSS = \`…\``.
- Décider du jeu d'icônes. Recommandation : **icônes maison, grille 24, trait 2 px, bouts ronds**
  (celles de la maquette). Lucide est trop fin (1,5–2 px sur 24) pour six mètres et son stylo,
  sa gomme et son surligneur se confondent à distance. ~28 icônes à dessiner, livrées en un
  composant `WbIcon` unique.
- Récupérer les .woff2 des deux familles et les poser dans `public/fonts/`.


---

# Lot B — Le geste

Direction validée. Ce lot fige ce qu'on touche cent fois par heure.

## B.1 Barre d'outils

**Ordre invariable des grappes** : `encre` → `créer` → `page` → `séance`. Il se relit de haut en
bas en vertical, de gauche à droite en horizontal ; changer de position ne réapprend rien.

| Grappe | Contenu | Cible |
|---|---|---|
| encre | sélection, stylo, surligneur, gomme, laser | 60 px |
| créer | texte, formes, insérer | 60 px |
| page | annuler, rétablir, fonds, pages | 60 px |
| séance | recherche, ressources, clavier, réglages, fermer | 52 px, `--wb-on-chrome-dim` |

- Marge au bord : **24 px**, jamais flottante au centre.
- En horizontal, la barre est **décalée du côté de la main** (défaut : droite), pas centrée —
  et l'offset tient compte du rail de pages (196 px) pour rester dans la zone utile.
- Le **tiroir** (couleurs, épaisseurs, pression) s'ouvre du côté de la page, ancré au bouton actif,
  et se ferme au premier `pointerdown` sur la page.
- Pendant le tracé : `opacity: .4` sur la barre en `--wb-t-fast`, retour au relâchement.
  Une opacité, pas une translation : aucun relayout au-dessus de l'encre.

**→ JSX à modifier** : conteneurs de grappe + séparateurs ; attribut de position
(`data-wb-bar="bottom|left|right"`) et de côté de main sur la racine `.wb`.

## B.2 Sélection

| Élément | Spécification |
|---|---|
| Cadre | 3 px `--wb-select`, rayon 5 px, offset 9 px autour de l'objet |
| Poignées | 18 px visibles (blanc, liseré 3 px `--wb-select`), **44 px de zone tactile** |
| Barre d'objet | 44 px de haut, ancrée 62 px sous le cadre : déplacer · verrouiller · supprimer |
| Sélection multiple | même cadre autour de l'union + pilule « N objets » au coin bas-droit |
| Rectangle de sélection | 2 px pointillé `--wb-select`, fond `--wb-select-soft` |
| Encre sélectionnée | cadre **pointillé** sans poignées d'échelle + étiquette « encre » |
| Verrouillé | cadre et cadenas en `--wb-on-chrome-dim`, aucune poignée |

Poignée blanche à liseré indigo : un carré indigo plein disparaît sur du texte indigo, un carré
blanc nu disparaît sur le papier. Le liseré règle les deux cas.

## B.3 Menu contextuel

Lignes **44 px**, texte 20 px, icône 22 px à gauche, largeur 320 px, rayon 20 px, `--wb-e3`.
Sept lignes maximum avant un séparateur. **Le destructif est toujours en dernier, en `#FCA5A5`,
après un séparateur** — jamais adjacent à une action fréquente.

## B.4 Menu radial TBI

Homothétie ×1,6 de `WebRadialMenu.tsx` (PWA), dont la géométrie est reprise telle quelle :

| Grandeur | PWA | TBI |
|---|---|---|
| rayon intérieur | 36 | **58** |
| rayon des libellés | 92 | **148** |
| rayon extérieur | 134 | **214** |
| disque central | 35 | **56** |
| gap angulaire | 2° | **2°** |
| quartiers | 4 | **8** |

Repos `--wb-chrome` ; quartier engagé rempli de **la couleur de l'outil** à 88 % (même code
couleur que le tiroir) ; disque blanc central = annuler ; ouverture 180 ms
`cubic-bezier(.34,1.56,.64,1)`, identique à la PWA. Contenu : outils et navigation uniquement —
**aucune action destructive** dans un menu qu'on ouvre d'un appui à deux doigts.

## B.5 Curseurs

| Outil | Curseur |
|---|---|
| Sélection | flèche pleine noire, liseré blanc 1,2 px |
| Stylo | croix fine + pastille de la couleur courante |
| Gomme | cercle **à la taille réelle de la gomme**, suit le stylet |
| Laser | point `--wb-laser` + halo 35 % |
| Texte | barre en I |
| Redimensionner | diagonale orientée par la poignée |

Au doigt, aucun curseur : l'outil actif est annoncé par le bouton blanc et le tiroir.

## B.6 Forme intelligente — 560 ms

1. **0 ms** — le tracé brut est affiché, rien n'est différé.
2. **+180 ms** — la forme reconnue apparaît en pointillé `--wb-select` sous le tracé, qui tombe à
   35 % d'opacité ; pilule du nom de la forme.
3. **+560 ms** — la forme se pose : dépassement d'échelle 1,04 puis retour, le tracé disparaît.
   Le rendu conserve le **fait main léger** (`handDrawnJitter: 1.5`, seed par objet).

Pilule « Annuler la forme » 4 s ; un nouveau trait pendant ce délai annule aussi.
**Aucune boîte de dialogue.**

## B.7 Classes touchées (à revérifier sur la branche)

| Bloc CSS | Changement |
|---|---|
| `.wbt__*` | grappes, tailles 60/52, états, ancrage du tiroir, opacité pendant le tracé — **JSX** |
| `.wbo__*` | cadre, 8 poignées, zone tactile 44 px, barre d'objet, états verrouillé / multiple |
| `.wbs__*` | rectangle de sélection, cadre d'encre pointillé |
| `.wbc__*` | menu contextuel : lignes 44 px, séparateurs, destructif isolé |
| `.wbr__*` | menu radial : rayons ×1,6, remplissage par couleur d'outil |
| `.wb__stage` | curseurs par outil (`cursor: url(...)`), curseur gomme dessiné en canvas |
| `boardShapes.ts` | reconnaissance : timings 180/560 ms, dépassement 1,04, jitter conservé |


---

# Lot C — Les objets

## C.1 Barre de texte

**Une rangée de 52 px, huit groupes** : police · corps (− 40 +) · G I S S̶ · couleur de texte +
surligneur · alignements · listes · « … ».
Le bouton « … » déplie une **seconde rangée** : exposant, indice, casse, retraits, interligne,
**Texte à trous** (en `--wb-accent`, c'est une action pédagogique, pas une mise en forme).
La seconde rangée se replie dès que le curseur retourne dans le texte.

Chaque pastille montre l'état réel (la couleur de texte porte un trait de sa couleur, l'épaisseur
montre son épaisseur) : on lit le réglage sans ouvrir de menu.

**→ JSX à modifier** : découpage en groupes + repli de la seconde rangée (`.wbt__row2`).

## C.2 Barre de forme

Quatre réglages : **contour, épaisseur, pointillés, remplissage**. Chacun est une pilule de 52 px
avec aperçu à gauche et libellé à droite — au TBI on vise une pilule, pas une icône nue.

## C.3 Palette unique

Un seul popover pour stylo, texte, contour, remplissage :
8 encres (56 px) + 5 surligneurs (44 px) + « Sans remplissage ».
**Pas de sélecteur libre** : au tableau on choisit, on ne compose pas. Sélection = anneau blanc
double (`0 0 0 3px --wb-chrome, 0 0 0 6px #FFF`), visible sur toutes les teintes.
Ancré au bouton qui l'ouvre, fermé au premier contact sur la page.

## C.4 Palette de formes

14 formes, grille de 7 × 2 tuiles de 82 × 72, fond `--wb-chrome-sunk`, trait 3 px.
Toutes dessinées en **fait main léger** — la palette montre ce que la page produira.

## C.5 Objets de page — grammaire commune

1. Le contenu occupe **toute** la boîte ; aucun cadre décoratif permanent.
2. L'étiquette de type (32 px, coin haut-gauche, `rgba(23,28,36,.92)`) n'apparaît **qu'au survol**.
3. Les actions propres à l'objet vivent dans une barre de 44 px ancrée à l'objet, jamais dans la
   barre principale.
4. Tout ce qu'un **élève** peut déclencher est surdimensionné : lecture vidéo 88 px, lecture son
   96 px, lien en pilule indigo 60 px.

| Objet | Décision |
|---|---|
| Image | poignées d'angle proportionnelles ; dupliquer / remplacer / détourer |
| Tableau | en-tête plein `#14181F`, filets 2 px, cellule active cerclée `--wb-select` |
| Vidéo | bouton 88 px, barre de lecture 56 px, progression `--wb-accent` |
| Site web | bascule **Annoter / Interagir** dans le bandeau, jamais dans un réglage |
| Équation | rendue en noir d'encre, corps lié au texte de page |
| Son | pastille `--wb-accent` de 96 px + durée en chiffres tabulaires |
| Lien | pilule `#EEF0FF` / bord `--wb-select` — seul objet cliquable par les élèves |
| Post-it | 4 pastels, rotation ± 2°, ombre courte, texte ≥ 24 px |
| Bibliothèque | vignettes 132 px sur **fond blanc**, une seule épaisseur de trait, fait main léger |

## C.6 Navigateur de pages

Colonne 196 px, vignettes 156 × 88, numéro en **coin** (26 px) et non sur la vignette.
Page active : anneau 3 px `--wb-select` + étiquette « active ».
Réordonnancement : inclinaison −2°, ombre `--wb-e3`, **ligne d'insertion 4 px `--wb-accent`**.
Appui long → menu contextuel du lot B.

## C.7 Classes touchées (à revérifier sur la branche)

| Bloc CSS | Changement |
|---|---|
| `.wbt__*` (texte) | groupes, seconde rangée repliable, pastilles d'aperçu — **JSX** |
| `.wbs__*` (formes) | 4 pilules d'aperçu, palette 7 × 2 |
| `.wbc__*` / palette | popover unique partagé (encres, surligneurs, sans remplissage) |
| `.wbo__*` (objets) | étiquette de type au survol, barre d'objet 44 px, cibles élèves surdimensionnées |
| `.wblb__*` (bibliothèque) | vignettes 132 px fond blanc, onglets de matière en pilules 44 px |
| `.wbp__*` (pages) | numéro en coin, anneau actif, ligne d'insertion orange |
| `boardShapes.ts` / `boardLibrary.ts` | 14 formes et 62 dessins au même jitter, une seule épaisseur |


---

# Lot D — La classe

Règle de cadrage du lot : **un seul point d'attention par écran**, dimensionné pour le fond de la
salle. Le chiffre qui compte fait 190–220 px ; tout le reste tient dans son ombre.

## D.1 Widgets

Un widget est une **carte de papier** : blanc, filet d'encre 2 px, rayon 16 px, un seul contenu.
Ni titre décoratif, ni icône d'ambiance.

| Widget | Décision |
|---|---|
| Minuteur | chiffres Space Grotesk tabulaires, barre de progression en encre pleine ; **aucune animation à la seconde** |
| Fin de minuteur | la carte entière passe en `--wb-danger`, 3 pulsations (480 ms) puis repos |
| Sonomètre | barres 26 px, seuil = filet, dépassement en `--wb-accent` |
| Alerte de bruit | la carte **devient** le message (rouge plein, 52 px), pas d'icône |
| Consigne sonore | 4 niveaux empilés, l'actif est plein, les autres se retirent en `#F1F5F9` |
| Feu tricolore | horizontal (plus lisible de loin), feux éteints à 12 % de leur teinte |
| Dé | lancer 480 ms, trois rebonds, **jamais de rotation 3D** (bave au vidéoprojecteur) |
| Roue | quartiers pastel + filets d'encre, aiguille `--wb-accent` en haut |
| Groupes | cartes encadrées, pseudonymes 19 px — jamais une ligne de tableur |
| QR code | 150 px minimum, libellé obligatoire à côté |

## D.2 Tirage au sort

Trois temps : **défilement 1,4 s → ralenti → nom posé**.
Pendant le défilement : fenêtre fixe bordée `--wb-accent` (3 px haut et bas), les noms passent
dedans, le nom central à 88 px, les voisins dégradés en `--wb-on-chrome-mute`.
Au résultat : **le cadre entier passe en `--wb-accent`**, nom à 150 px en `#140A02`,
trois actions seulement (+1 tampon · Retirer · Fermer) et le rappel « sans remise · N restants ».
Absents exclus de la liste en amont. **Ni confettis ni son.**

## D.3 Révélation

Une seule grammaire : **ce qui est masqué est opaque et mat** — jamais un flou, qui à six mètres
ressemble à une panne d'affichage.

| Objet | Spécification |
|---|---|
| Rideau de page | voile `--wb-chrome-sunk` + poignée `--wb-accent` de 14 px sur toute la largeur |
| Rideau d'objet | pavé `--wb-chrome-sunk`, « ? » 64 px blanc, un tap découvre |
| Ticket à gratter | bandes obliques blanches à 115°, se gratte au doigt |
| Texte à trous | case blanche, soulignement d'encre 4 px, le mot apparaît en encre |
| Projecteur | disque **net** de 164 px, bord franc, reste du plateau à 94 % d'opacité |

## D.4 Mode affichage

Même palette, sans chrome : la page occupe l'écran, les widgets sont posés dessus.
Un seul rappel de sortie, **en haut à droite** (hors de la zone masquée par le corps).
Titre de séance 82 px, consigne 40 px.

## D.5 Écran projeté `/classe`

Cartes d'élèves **blanches sur bureau graphite** : pseudonyme 24 px, badges en pilules de 28 px,
absent en carte grisée à 65 %, sortie cerclée 4 px `#6366F1` avec durée.
Couleurs d'événement **strictement** celles de l'app (`--color-participation`, `--color-bavardage`,
`--color-absence`, `--color-sortie`, `--color-remarque`) — c'est le point de contact le plus visible
entre le tableau et le reste du produit.
Colonne de droite : minuteur 130 px, puis Tirer au sort (`--wb-accent`), Rideau, Tableau — cibles 80 px.
Bandeau d'événement reçu du téléphone : 96 px de haut, **6 s**, annulable.

## D.6 Caméra

Le flux occupe la boîte. Trois éléments de chrome : pastille « EN DIRECT » rouge (les élèves
doivent savoir qu'on filme), déclencheur 88 px, « Coller sur la page ».
La capture se pose là où était le cadre — **aucune fenêtre de confirmation**.

## D.7 Classes touchées (à revérifier sur la branche)

| Bloc CSS | Changement |
|---|---|
| `.wbw__*` (widgets) | carte papier, filet 2 px, échelles 190/96/52, états pleins |
| `.wbsr__*` (tirage) | fenêtre de défilement, écran de résultat orange, 3 actions |
| `.wbe__*` / `.wbx__*` (révélation) | rideaux, ticket, trous, projecteur — opaque, jamais de flou |
| `.wbcam__*` | pastille EN DIRECT, déclencheur 88 px |
| `pages/Classroom.tsx` (`classroom__*`, `seat*`) | cartes blanches, badges 28 px, colonne d'actions 80 px, bandeau 96 px |


---

# Lot E — Les panneaux

Règle commune : un panneau est **une feuille de graphite posée sur le plateau**
(`--wb-chrome`, rayon 28, `--wb-e3`, marge de 24 px au bord de l'écran), la page reste visible
derrière à 18 % d'opacité. **Une seule feuille ouverte à la fois**, ouverture 200 ms,
fermeture au premier contact du stylet sur la page (sauf le clavier, qui est un outil de saisie).
En-tête de 88–104 px : titre 28–34 px à gauche, fermeture 56–60 px à droite.

## E.1 Insérer

Plein écran, deux sections seulement : **« Sur la page »** (12 tuiles de 196 px) et
**« Pour la classe »** (widgets, tuiles de 150 px). Icône 56 px au-dessus du mot 24 px :
à six mètres l'icône porte, de près le mot tranche. Champ de recherche d'objet dans l'en-tête.

## E.2 Recherche

Champ de **88 px de haut, texte 34 px** — on tape debout, à bout de bras.
Deux entrées à côté : **dictée** (`--wb-danger`, parce qu'elle enregistre) et **écriture au stylet**.
Onglets Images / Web / Vidéos en pilules de 56 px ; grille 4 × 2.
Un seul bouton par résultat, **Insérer** (`--wb-accent`), qui pose l'objet au centre de la page
et referme le panneau.

## E.3 Ressources

Feuille de 1200 × 860, rail de gauche 320 px : Bibliothèque · Annales du Brevet · Notion · Drive ·
Mes tableaux (lignes de 64 px). Vignettes **sur fond blanc** de 170 px — le dessin se présente sur
du papier. Hors ligne : bibliothèque et tableaux restent actifs, Notion et Drive s'estompent.

## E.4 Export PDF

900 × 760. Deux cartes exclusives en haut — **Version élève** (masqué reste masqué) /
**Version corrigée** (rideaux ouverts) — puis la grille de pages : vignette cochée = anneau 3 px
`--wb-select` + case pleine ; non retenue = 40 % d'opacité et case vide.
Action principale `--wb-accent`, **avec le compte dans le libellé** (« Exporter 5 pages »).

## E.5 Réglages

620 × 760, trois sections : **Barre** (position, côté de la main), **Stylet** (pression, paume
ignorée, formes intelligentes), **Fond par défaut** (4 vignettes). Bascules 56 × 32,
lignes de 60–64 px. Aucun réglage caché derrière un sous-menu.

## E.6 Clavier virtuel

Touches **120 × 88**, rayon 16, lettres capitales 30 px. Accents français (É È À Ç) **sur la rangée
principale**, pas derrière un appui long. Entrée en `--wb-select`, Maj / 123 / Fermer en
`--wb-desk`. Posé au bord bas, il laisse toujours voir la ligne en cours d'écriture.

## E.7 Classes touchées (à revérifier sur la branche)

| Bloc CSS | Changement |
|---|---|
| `.wbi__*` (insérer) | deux sections, tuiles 196 / 150, icône + mot |
| `.wbn-inst__*` / recherche | champ 88 px, dictée rouge, stylet, onglets pilules, action unique |
| `.wblb__*` (ressources) | rail 320 px, vignettes fond blanc 170 px, état hors ligne |
| `.wbx__*` (export) | cartes élève / corrigée, grille de pages cochables, compte dans le bouton |
| `.wba__*` (réglages) | 3 sections, bascules 56 × 32, lignes 60–64 px |
| `.wbk__*` (clavier) | touches 120 × 88, accents en rangée principale |


---

# Lot F — Finitions

Principe unique du lot : **rien n'interrompt le cours.** Aucun modal, aucune confirmation,
aucun message qu'il faut lire pour continuer à écrire.

## F.1 États vides

| Cas | Traitement |
|---|---|
| Page vierge | deux lignes centrées en `--wb-grid-major` — « Écrivez. » / « Deux doigts pour les outils. » ; **ni illustration ni bouton**, elles s'effacent au premier trait |
| Recherche sans résultat | le terme cherché est répété dans le titre + **une seule** sortie (« Chercher sur le Web ») |
| Widget de classe sans séance | « Aucune classe en séance. » + action `--wb-accent` « Ouvrir une séance » |

Jamais d'illustration décorative : à six mètres elle ne se lit pas et elle prend la place du texte.

## F.2 Chargement

**Squelettes à la forme du contenu** (`#1B212B` sur `--wb-chrome`), pulsation 1,4 s.
**Aucun spinner plein écran, et jamais rien au-dessus de la page** : la page reste utilisable
pendant que les panneaux chargent.

## F.3 Erreurs — trois niveaux

1. **État persistant** (hors ligne) → pilule de 44 px au bord bas, pastille `--wb-accent` :
   « Hors ligne — tout est enregistré sur ce poste. » On continue d'écrire.
2. **Action requise** (enregistrement impossible) → carte 60 px ancrée **en haut à droite**,
   bordure `--wb-danger`, un bouton « Réessayer ». Loin de la main, loin de la zone d'écriture.
3. **Objet en échec** (vidéo indisponible) → l'erreur reste **dans l'objet**, à sa place et à sa
   taille : cadre pointillé `--wb-danger`, fond `#FEF2F2`, action « Remplacer ».

**Le destructif n'est jamais confirmé** : il agit, puis une barre « Page effacée » + **Annuler**
reste 8 s. Une confirmation coûte un geste à chaque fois ; un rappel ne coûte rien quand on ne
s'est pas trompé.

## F.4 Premier lancement

**Trois bulles ancrées**, une par geste vital (menu radial, rail de pages, côté de la main),
affichées simultanément ; **un trait sur la page les fait toutes disparaître.**
Pas de séquence, pas de « suivant » : le premier lancement a lieu devant une classe.

## F.5 Accessibilité

| Vérification | Valeur |
|---|---|
| Texte de page sur papier | ≥ 4,5:1 (encre la plus claire : 8,6:1) |
| Libellé de barre | `#E7ECF3` / `#171C24` = 11,9:1 |
| Rangée secondaire | `#93A0B4` / `#171C24` = 5,6:1 |
| Statut | **jamais la couleur seule** — pastille + mot |
| Cibles | 44 px minimum, 60 px sur la barre |
| `prefers-reduced-motion` | les moments deviennent un fondu de 120 ms |
| Focus clavier | anneau 3 px `--wb-accent`, détaché de 3 px ; **tout est atteignable au clavier** |

## F.6 Micro-copie

Quatre règles : **vocabulaire du métier** (page, séance, classe — jamais « canvas », « slide »,
« board », « workspace ») · **infinitif pour les actions** · **jamais d'excuse ni d'emoji** ·
**dire ce qui se passe, pas ce qui a échoué techniquement**. Une phrase par message.

| Ne pas écrire | Écrire |
|---|---|
| « Une erreur est survenue lors de la synchronisation du board. » | « Hors ligne — tout est enregistré sur ce poste. » |
| « Êtes-vous sûr de vouloir effacer cette page ? » | « Page effacée. » + Annuler |
| « Oups ! Il n'y a rien ici pour le moment 🙂 » | « Aucune classe en séance. » + Ouvrir une séance |
| « Exporter le board en PDF (5 slides sélectionnées) » | « Exporter 5 pages » |

## F.7 Classes touchées (à revérifier sur la branche)

| Bloc CSS | Changement |
|---|---|
| `.wb__stage` | état vide de page, squelettes, pilule hors ligne au bord bas |
| `.wbn-inst__*` | carte d'erreur haut-droite, barre « Annuler » 8 s |
| `.wbo__*` | état d'échec dans l'objet (cadre pointillé rouge, action Remplacer) |
| `.wb__onboarding` (nouveau) | trois bulles ancrées, disparition au premier `pointerdown` |
| tous | anneau de focus, `prefers-reduced-motion`, cibles 44/60 px |


---

# Patch global — `wb-theme.css`

**Pose.** Déposer `wb-theme.css` à côté de `Whiteboard.tsx` et ajouter une ligne :

```ts
// gestion-classe-web/src/components/classroom/Whiteboard.tsx
import './wb-theme.css';
```

Rien d'autre à modifier pour l'essentiel du reskin. Les blocs `const CSS = \`…\`` des composants
restent **intacts** : ils sont injectés en `<style>` au rendu, donc après une feuille de `<head>` ;
le patch gagne par la spécificité (sélecteur doublé `.wbm.wbm`, ou ancêtre `.wb …`), sans un seul
`!important`. Le reskin se retire en supprimant l'import.

## 8. Correspondance réelle des sélecteurs

| Fichier | Préfixe | Ce que le patch change |
|---|---|---|
| `Whiteboard.tsx` | `.wb`, `.wb__stage`, `.wb__bar`, `.wb__group`, `.wb__btn`, `.wb__swatch`, `.wb__select`, `.wb__zoom`, `.wb__curtain` | plateau graphite, barre 60/52 en grappes, outil actif inversé en blanc, pastilles 44 px, badge de zoom en pilule |
| `BoardObjectLayer.tsx` | `.wbo__*` | cadre 3 px `--wb-select` en `outline-offset`, poignées 18 px visibles / 44 px tactiles (`::before`), verrouillé en gris |
| `BoardContextMenu.tsx` | `.wbm` | 320 px, lignes 44 px, texte 20 px, destructif isolé |
| `BoardRadialMenu.tsx` | `.wbr` | couleurs et typo ; **la géométrie ×1,6 se fait dans le TSX** (voir ci-dessous) |
| `BoardColorPicker.tsx` | `.wbc`, `.wbc__panel` | palette unique, pastilles 44 px, anneau blanc double |
| `BoardShapeToolbar.tsx` | `.wbs__*` | tuiles 72 px, actif inversé |
| `BoardTextToolbar.tsx` | *(réutilise `.wb__group` / `.wb__btn` / `.wb__select` / `.wb__swatch`)* | hérite du patch de barre ; la seconde rangée « … » reste à ajouter côté TSX |
| `BoardPageNavigator.tsx` | `.wbn__*` | rail `--wb-desk-2`, numéro en coin, anneau actif, ligne d'insertion orange |
| `BoardInstruments.tsx` + `Whiteboard.tsx` | `.wbi__*` | panneau 20 px, lignes 52 px, actif inversé |
| `objects/WidgetView.tsx` | `.wbw__*` | chrome graphite, chiffres en `--wb-font-num`, feu tricolore sur carte `#14181F` |
| `objects/TableView.tsx` | `.wbt` | filets 2 px, en-tête plein noir, cellule active cerclée indigo |
| `BoardExportDialog.tsx` | `.wbx__*` | cartes élève / corrigée, pages cochées en anneau indigo, action orange 76 px |
| `BoardSearchPanel.tsx` | `.wbsr__*` | champ 88 px / 34 px, dictée rouge, onglets pilules 56 px, action unique orange |
| `BoardLibraryPanel.tsx` | `.wblb__*` | onglets pilules 44 px, vignettes 132 px fond blanc |
| `BoardPickOverlay.tsx` | `.wbp__*` | nom jusqu'à 150 px, action orange 76 px |
| `BoardCameraOverlay.tsx` | `.wbcam__*` | barre 60 px, action orange |
| `BoardKeyboard.tsx` | `.wbk__*` | touches 120 × 88, lettres 30 px, Entrée indigo |

## 9. Ce que le CSS ne peut pas faire — 5 retouches TSX

1. **`BoardRadialMenu.tsx`** — remplacer les trois constantes par la géométrie TBI :
   `const INNER = 58; const OUTER = 214; const LABEL_R = 148;` (le `GAP` de 2° est déjà bon).
   Les décalages de libellé `ly - 10` / `ly + 16` passent à `ly - 16` / `ly + 24`.
2. **`Whiteboard.tsx`** — ajouter `wb__group--session` au dernier groupe de la barre (recherche,
   ressources, clavier, réglages, fermer) pour la grappe atténuée à 52 px.
3. **`Whiteboard.tsx`** — poser/retirer la classe `is-drawing` sur `.wb` aux `pointerdown` /
   `pointerup` du tracé : c'est ce qui fait reculer la barre à 40 % pendant l'écriture.
4. **`BoardKeyboard.tsx`** — ajouter É È À Ç à la rangée principale (aujourd'hui absents).
5. **`BoardTextToolbar.tsx`** — seconde rangée repliable derrière « … » (exposant, indice, casse,
   retraits, texte à trous). Facultatif : sans elle, la barre reste sur une rangée plus longue.

Le reste des lots — états vides, squelettes, erreurs à trois niveaux, bulles de premier lancement —
est du markup à ajouter ; le patch fournit déjà `.wb-skel`, l'anneau de focus et
`prefers-reduced-motion`.
