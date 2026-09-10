# Brief pour Claude Design — Tableau blanc (Épic 12)

> Rédigé le 10/09/2026. **Périmètre strict : la feature « tableau blanc » et l'écran projeté qui l'héberge.**
> Le reste de l'application (web enseignant, mobile, espace élève) n'est **pas** concerné et ne doit pas être
> touché — ni ses écrans, ni ses variables CSS globales.
>
> Point de départ assumé : la mécanique est faite et fonctionne ; **le visuel, le ressenti, la pâte graphique
> et l'UX sont à considérer comme non faits.** Tout le CSS actuel du tableau est un échafaudage écrit pour
> être jeté.

## 1. Ce qu'est le tableau blanc

Un **tableau blanc de classe** projeté au TBI (tableau interactif) ou au vidéoprojecteur, utilisé par un
enseignant de collège **debout devant l'écran, au stylet et au doigt**, pendant qu'une classe de 25 élèves
le regarde. Il remplace ActivInspire / OpenBoard, et fait aussi office d'**écran de classe** (à la
ClassroomScreen) entre deux moments de cours.

Il s'ouvre depuis deux endroits :

| Contexte | Chemin | Particularité |
|---|---|---|
| **En séance** | `/classe` (mode « en classe ») → bouton Tableau | Relié à la séance : élèves présents, tirage au sort, photo et caméra du téléphone, pages enregistrées avec la séance |
| **Hors séance** | Accueil → « Mes tableaux » (Brouillon ou tableau nommé) | Préparation, reprise d'un cours, écran d'accueil de salle |

Deux utilisateurs : **Thomas** (créateur, SVT, TBI quotidien, aime les outils denses et rapides) et
**Aurélie** (Français, doit pouvoir s'en servir sans explication). Et 25 spectateurs : les élèves, à 3–8 m.

## 2. Ce qu'on demande

1. Une **identité visuelle complète** pour cette surface : palette, typographie, icônes, formes, profondeur,
   mouvement, états — pensée pour un écran vu de loin et touché de près.
2. La **maquette de chaque élément** listé au § 4, avec ses états (repos, survol, actif, désactivé, en cours,
   erreur), dans un canevas Claude Design (`.dc.html`), comme le handoff mobile précédent.
3. Un **handoff** (`design_handoff_tableau_blanc/README.md`) : tokens, correspondance avec les classes CSS
   existantes, décisions et justifications.
4. L'**implémentation**, bloc CSS par bloc CSS (§ 6), sans toucher à la logique.

**Hors périmètre, à ne pas modifier** : les fonctionnalités et le modèle de données (ils marchent), les
écrans du web enseignant, le mobile, l'espace élève, les variables CSS globales de
`gestion-classe-web/src/index.css` (le tableau ne s'en sert quasiment pas — voir § 6).

## 3. Les références — ce qu'il faut leur voler

Le critère n'est pas « joli » mais **le ressenti sous la main et la lisibilité à six mètres**.

- **Freeform (Apple)** — la référence du *feeling* : encre qui répond instantanément, interface qui s'efface
  pendant le tracé, barre flottante minimale, poignées et sélection d'une grande finesse. À voler : la
  discrétion, la qualité des états de sélection, les micro-animations.
- **tldraw / Excalidraw** — la barre d'outils horizontale claire à raccourcis, le menu contextuel sobre, la
  palette de couleurs ramassée ; le style « fait main » d'Excalidraw pour les formes est une piste
  intéressante en classe (moins intimidant qu'un vectoriel parfait). À voler : la lisibilité des icônes, le
  curseur qui annonce toujours ce qu'il va faire.
- **Goodnotes / Samsung Notes** — le respect du stylet : épaisseur, pression, formes qui « claquent en place »
  à la reconnaissance, gestes à deux doigts, gomme, laser.
- **FigJam / Miro** — les widgets posés sur la page et le sentiment d'espace de travail vivant ; les post-its.
- **ClassroomScreen** — l'usage « écran de classe » : un fond, des widgets gros et lisibles, rien d'autre.
  À voler : la lisibilité à 6 m, les widgets qui se suffisent, le fond qui habille la salle.
- **Kahoot** — l'énergie des moments rares : compte à rebours, suspense du tirage, couleur qui explose, puis
  retour au calme.
- **À ne pas imiter** : ActivInspire, OpenBoard, SMART Notebook — interfaces surchargées, icônes illisibles à
  distance. Ce sont les logiciels que celui-ci remplace.

## 4. L'inventaire à habiller

Tout ce qui suit existe et fonctionne. Chaque ligne est un objet de design.

### Le plateau
- La **page** (format 16:9, « letterbox » dans l'écran) et ses **fonds** : blanc, quadrillage, lignes, Seyès
  avec marge, papier millimétré, repère orthonormé, points. Les fonds sont dessinés en canvas
  (`lib/boardRender.ts`) : couleurs et graisses à revoir pour la projection.
- L'**encre** : stylo (pression), surligneur, gomme (avec son cercle qui suit le stylet), **pointeur laser**
  (trait rouge qui s'efface).
- Le **zoom** (badge « 150 % — Vue entière ») et le **plein écran**.

### Barre d'outils et navigation
- La **barre principale** : outils (sélection, stylo, surligneur, gomme, texte, formes, laser), couleurs,
  épaisseurs, annuler/rétablir/effacer, fonds, pages, import, enregistrement, recherche, ressources,
  clavier virtuel, réglages, fermeture. Positionnable **en bas, à gauche, à droite**, et alignable du côté
  de la main. Aujourd'hui : barre sombre, boutons 52 px, tout au même niveau — à hiérarchiser.
- Le **navigateur de pages** (colonne de vignettes à droite, masquable) : vignette active, réordonnancement,
  numéros, boutons monter/descendre/ajouter.
- Le **menu radial TBI** (`BoardRadialMenu`) : 8 quartiers sous les deux doigts. Même géométrie que le menu
  radial élève de la PWA — à harmoniser avec lui.
- Le **menu contextuel** (clic droit / appui long) : listes d'actions selon la cible, lignes de 44 px.

### Objets de page et leur manipulation
- **Zones de texte** (traitement de texte complet) avec leur **barre de mise en forme** : police, taille,
  gras/italique/souligné/barré, exposant/indice, couleurs, surligneurs, alignements, listes, retraits, casse,
  texte à trous. C'est la barre la plus chargée : elle demande une vraie hiérarchie.
- **Formes** (14 : ligne, flèches, rectangle, ellipse, triangle, losange, étoile…) et leur barre : contour,
  épaisseur, pointillés, remplissage. Plus la **palette de formes** (grille) et les **formes intelligentes**
  (un tracé à main levée devient une forme : moment à mettre en scène).
- **Images**, **tableaux**, **vidéos** (YouTube), **sites web en iframe** (mode annoter / interagir),
  **son**, **liens**, **équations LaTeX**, **post-its**, **objets de bibliothèque** (62 dessins : verrerie,
  cellules, circuits, repères…).
- La **mécanique de sélection commune** : cadre, 8 poignées, poignée de déplacement, croix de suppression,
  cadenas, sélection multiple, rectangle de sélection, cadre de l'encre sélectionnée. **C'est le cœur du
  ressenti** : c'est ce qu'on touche cent fois par heure.

### Révélation (le pédagogique)
- **Rideau de page** (voile qu'on tire vers le bas pour découvrir ligne à ligne), **rideau d'objet**
  (« ? » sur une réponse), **ticket à gratter** (couleur ou image, texture d'argent), **texte à trous**
  (case blanche soulignée, révélée d'un tap), **projecteur** (tout sombre sauf un disque).

### Widgets d'écran de classe
Minuteur, horloge, **sonomètre au micro** (barre + seuil + alerte « Trop de bruit »), consigne sonore
(4 niveaux), feu tricolore, dé, roue, **groupes aléatoires**, QR code, calculatrice. Ce sont les objets les
plus vus par les élèves : ils doivent être **beaux de loin**.

### Panneaux plein écran
- **Insérer** (grille d'objets), **Ressources** (bibliothèque par matière, annales de Brevet, Notion, Drive),
  **Recherche** (web / vidéos / images, avec dictée et écriture au stylet), **Export PDF** (choix des pages,
  version élève / corrigée), **clavier virtuel** AZERTY à grosses touches.

### Moments de classe
- **Tirage au sort** (roulette de prénoms, 1 / binôme / trio, sans remise, absents exclus, « +1 tampon »).
- **Caméra du téléphone** en direct, avec capture sur la page.
- **Mode affichage** : barre et panneaux masqués, plein écran — l'écran de classe.

### L'écran projeté qui l'héberge (`pages/Classroom.tsx`)
Plan de classe en direct (élèves, compteurs, badges absent / sortie), **minuteur**, **tirage**, **rideau**
plein écran, bandeau d'événement reçu du téléphone. Même famille visuelle que le tableau.

## 5. Principes propres à cette surface

1. **Lisible à six mètres.** Tout ce qui est vu par les élèves (widgets, tirage, minuteur, textes de page)
   se conçoit pour le fond de la salle : tailles minimales, contrastes forts, un seul point d'attention.
2. **La main devant le tableau.** L'enseignant est debout, de côté, un bras sur l'écran : commandes au bord,
   du côté de la main, cibles ≥ 52 px, rien d'important au centre-haut (il le masque avec son corps).
3. **Le stylet est roi.** Aucune interface ne gêne l'encre : les panneaux se ferment seuls, les outils
   s'effacent pendant le tracé, le retour à l'écriture est immédiat, aucune animation ne retarde un trait.
4. **Calme par défaut, énergie sur commande.** Le plateau est sobre ; le tirage au sort, la fin du minuteur,
   la reconnaissance d'une forme, l'alerte de bruit peuvent être spectaculaires — parce qu'ils sont rares.
5. **Trois contextes de lumière.** Salle éclairée, salle sombre, et **projection** (contraste maximal, pas de
   gris moyens ni de flous qui bavent au vidéoprojecteur).
6. **Dignité des élèves.** Les prénoms affichés sont des pseudonymes (« Prénom + 2 lettres ») : typographie
   qui les rend lisibles et agréables, jamais des lignes de tableur.
7. **Français d'abord.** Espaces insécables, guillemets « », accents en capitales, libellés courts.
8. **Cousin, pas clone.** Le tableau doit se sentir de la même famille que le reste de l'app (couleurs
   d'événements, ton) sans que le reste ait à changer : il peut avoir sa propre densité et sa propre
   profondeur, adaptées au TBI.

## 6. Contraintes techniques (le reskin ne doit rien casser)

- **Tout le CSS du tableau est déjà isolé** : chaque composant de `src/components/classroom/` porte son
  propre bloc `const CSS = \`…\`` en fin de fichier (25 fichiers, ~236 classes, préfixes `wb__`, `wbo__`,
  `wbw__`, `wbt__`, `wbc__`, `wbs__`, `wbi__`, `wbx__`, `wblb__`, `wbsr__`, `wbk__`, `wbp__`, `wbcam__`,
  `wbn-inst__`, `wbe__`, `wba__`, `wbl__`, `wbq__`, `wbr__`, `wbsp__`). **On remplace bloc par bloc, sans
  toucher au JSX ni à la logique** ; quand le JSX doit changer (hiérarchie d'une barre, regroupement de
  boutons), le dire explicitement dans le handoff.
- **`pages/Classroom.tsx`** a un bloc CSS unique (classes `classroom__*`, `seat*`) : même traitement.
- **Le rendu canvas est du code, pas du CSS** : fonds de page, encre, formes, texte, aperçus d'objets sont
  dessinés dans `lib/boardRender.ts`, `boardShapes.ts`, `boardText.ts`, `boardMedia.ts`, `boardLibrary.ts`.
  Les couleurs et graisses de ces fonctions font partie du design et doivent être livrées comme tokens.
  **Contrainte forte** : ce que le canvas dessine doit rester identique à ce que le DOM affiche (l'export PDF
  et les vignettes passent par le canvas).
- **Ne pas modifier** `src/index.css` ni les variables globales : le tableau doit rester autonome. S'il a
  besoin de tokens, les définir dans un fichier propre (ex. `src/components/classroom/theme.ts` ou un bloc
  `:root` scopé à `.wb`).
- **Polices** : Inter aujourd'hui, IBM Plex Mono pour les chiffres. Libres d'être remplacées, mais toute
  police doit être **embarquée** (le réseau du collège filtre les CDN) et rester lisible à distance.
- **Performance** : 60 FPS obligatoires pendant le tracé. Éviter ombres portées larges, flous (`backdrop-filter`)
  et transitions sur les couches au-dessus de l'encre (`.wb__stage`, `.wbo__*`).
- **Tailles** : cibles tactiles ≥ 52 px sur la barre, ≥ 44 px dans les menus ; le TBI n'est pas précis.

## 7. Plan de travail (lots livrables seuls)

| Lot | Contenu | Pourquoi dans cet ordre |
|---|---|---|
| **A. Direction et fondations** | Palette (3 contextes de lumière), typographie et échelle « à distance », icônes, rayons, profondeur, mouvement, sons ; appliqués à un écran-témoin : le plateau avec sa barre | Tout le reste en découle ; se juge à l'œil sur un vrai écran |
| **B. Le geste** | Barre d'outils (3 positions, côté main), sélection et poignées, menu contextuel, menu radial, curseurs, retours de l'encre et des formes intelligentes | Ce qu'on touche cent fois par heure : c'est là que se gagne le ressenti |
| **C. Les objets** | Barres texte et formes, palette de couleurs, objets (texte, forme, image, tableau, vidéo, site, son, lien, équation, post-it, bibliothèque), navigateur de pages | La plus grande masse d'écrans, une fois le geste arrêté |
| **D. La classe** | Widgets d'écran de classe, mode affichage, révélation (rideaux, tickets, trous, projecteur), tirage au sort, caméra, écran projeté `/classe` | Ce que voient les élèves : cadrage « lisible à 6 m » |
| **E. Les panneaux** | Insérer, Ressources, Recherche, Export PDF, clavier virtuel, réglages | Utilisés hors du flux d'écriture, moins critiques |
| **F. Finitions** | États vides, erreurs, chargement, premier lancement, accessibilité (contraste, tailles, clavier), micro-copie | Ce qui fait passer de « propre » à « fini » |

Pour chaque lot : maquettes en canevas Claude Design, section de handoff (tokens, classes touchées,
décisions), puis implémentation avec `npx tsc -b`, `eslint` et `npm run build` verts.

## 8. Références du dépôt

| Quoi | Où |
|---|---|
| Feuille de route et état de la feature (phases 0 à 8) | `PLAN_tableau_blanc.md` |
| Code du tableau | `gestion-classe-web/src/components/classroom/` (+ `objects/`) |
| Écran projeté | `gestion-classe-web/src/pages/Classroom.tsx` |
| Rendu canvas (fonds, encre, formes, texte, objets) | `gestion-classe-web/src/lib/board*.ts` |
| Handoff design précédent (mobile), pour le format attendu | `design_handoff_reskin_direction_b/README.md` |
| Menu radial élève à harmoniser | `src/components/live-session/WebRadialMenu.tsx` |
| Captures d'inspiration déjà collectées | `ExempleMenuRadial.png`, `Exemple background.png`, `Exemple particule.png` |
| PRD, architecture, UX d'origine | `_bmad-output/planning-artifacts/` |
