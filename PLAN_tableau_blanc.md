# Épic 12 — Tableau blanc : feuille de route produit

> Document de cadrage rédigé le 10/09/2026 à partir des idées notées par Thomas. Rien n'est codé ici :
> on trie, on complète, on ordonne. Chaque idée d'origine est marquée **[T]**, chaque extrapolation **[+]**.
> Les liens avec l'existant renvoient au code réel (`gestion-classe-web/src/…`).

## 0. Ce qu'on a déjà (et qu'on ne recode pas)

| Brique | Où | Réutilisable pour |
|--------|----|-------------------|
| Encre stylet (pression, palme, gomme vraie, undo/redo, pages, fonds) | `components/classroom/Whiteboard.tsx`, `lib/boardRender.ts` | tout |
| Zones de texte type traitement de texte + raccourcis Word | `components/classroom/BoardTextLayer.tsx`, `lib/boardText.ts` | texte à trous, rideaux de zone, tableaux |
| Import PDF/image en fond de page, bucket `board-assets` | `lib/boardImport.ts` | import Word/PowerPoint (même sortie : pages) |
| Rendu canvas partagé (vignettes, relecture, export PDF) | `renderPageToCanvas` | export amélioré, navigateur de pages |
| **Rideau plein écran, minuteur, tirage au sort** pilotés depuis le téléphone | `pages/Classroom.tsx` + `lib/classroomProtocol.ts` (`curtain`, `timer`, `pick`) | à porter *dans* le tableau au lieu de par-dessus |
| Canal Realtime téléphone → écran (broadcast, non persisté) | `classroomProtocol.ts`, mobile `services/sync/classroomChannel.ts` | caméra du téléphone, kahoot, tirage au tableau |
| Outils `youtube`, `iframe`, `crossword`, `wordsearch`, `timeline`, `qrcode`, `pdfsplitter`, `fileconverter` | `src/tools/registry.ts` | à rendre *insérables* comme objets de page |
| Espace élève `/eleve` (code 6 chiffres, onglets par classe, Realtime maisons) | `pages/StudentDashboard.tsx` | kahoot V2, réponses d'élèves |
| Annales de Brevet (manifeste + bucket) | `lib/brevets.ts`, `customAnnales.ts` | onglet DNB du tableau |
| Photos de séance de groupe / TP | `lib/groupSessionPhotos.ts`, `tpTemplatePhotos.ts` | bibliothèque d'images « mes photos » |

Point clé : aujourd'hui une page = `{ background, strokes[], texts[], image? }`. **Presque tout ce qui suit consiste à généraliser cette page en une liste d'objets typés** (cf. § 2). C'est la décision structurante ; le reste en découle.

---

## 1. Idées triées par catégorie

### A. Navigation et document

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| A1 **[T]** | Navigateur de pages à droite, masquable | Vignettes rendues par `renderPageToCanvas` (déjà utilisé par `BoardPagesGallery`), rafraîchies avec un délai après modification. Glisser pour réordonner, dupliquer, supprimer, insérer après. Repli par un bouton et par raccourci (`N`). |
| A2 **[+]** | Aperçu au survol + saut par numéro | Sur TBI, taper `3` puis Entrée saute à la page 3 ; utile pendant un cours. |
| A3 **[+]** | Sections / chapitres de pages | Une couleur ou un titre par groupe de pages (« Rappels », « Activité 1 »…) affiché dans le navigateur. |
| A4 **[+]** | Page « infinie » optionnelle | Une page qui s'agrandit vers le bas (défilement), pour les démonstrations longues. À décider : par page, pas global — l'export PDF découpe alors en hauteur. |
| A5 **[+]** | Modèles de page | Fonds prédéfinis au-delà de blanc/quadrillage/lignes : Seyès, papier millimétré, portée musicale, carte muette, grille de mots, repère orthonormé, tableau périodique vide. C'est une simple extension de `Background` + `drawBackground`. |
| A6 **[+]** | Historique global et « retour à l'état de début de séance » | Snapshot automatique à l'ouverture ; bouton « revenir au début » (utile après une heure de cours pour la classe suivante). Se combine avec A7 des rideaux/tickets. |

### B. Fichiers : import, export, formats

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| B1 **[T]** | Format natif ré-ouvrable | `.gcboard` = archive ZIP : `board.json` (pages + objets, version de schéma), `assets/` (images), `meta.json` (titre, classe, date). Import = même chemin que `boardImport`. Versionné dès le départ (`schemaVersion`), avec migrations de lecture. |
| B2 **[T]** | Export PDF amélioré | Choix des pages, avec/sans annotations, avec/sans rideaux (état « découvert » ou « couvert »), avec/sans corrigés des textes à trous, 1 ou 2 pages par feuille, filigrane classe + date. Utiliser `pdf-lib` déjà présent. |
| B3 **[T]** V2 | Import Word / PowerPoint / PDF avec vraie conversion | Trois niveaux à distinguer : (a) *image de page* — déjà fait pour PDF ; (b) *texte éditable* — DOCX via `mammoth` → HTML → une zone de texte par bloc (le nettoyeur `sanitizeBoardHtml` existe déjà) ; (c) *fidélité de mise en page* — passer par LibreOffice headless côté serveur (Edge Function ou petit service) qui produit PDF + texte positionné. PPTX : `pptx` → une page par diapositive, images extraites, textes en zones. |
| B4 **[T]** V2 | Import ActivInspire (`.flipchart`) | Format propriétaire binaire. Chemin réaliste : ActivInspire exporte en PDF ou en images → import existant. Un vrai convertisseur n'est pas raisonnable ; le noter comme « non-objectif » pour ne pas y perdre des semaines. |
| B5 **[+]** | Export image d'une page / d'une sélection | PNG/SVG d'une page ou des objets sélectionnés — pour coller dans un document, une fiche, l'espace ressources élève. |
| B6 **[+]** | Export vers l'espace ressources élève | Un clic « publier le tableau du jour » → PDF déposé dans `resources` du PLAN_espace_ressources, dossier de la séance, publié aux classes de la séance. C'est la jonction naturelle Epic 11 ↔ Epic 12. |
| B7 **[+]** | Sauvegarde continue nommée | Le tableau libre de l'accueil n'a qu'une clé `localStorage`. Prévoir une table `boards` (tableaux non liés à une séance, titre, classe optionnelle) : ouvrir « mon cours sur la photosynthèse » sans repartir d'une séance. |
| B8 **[+]** | Import depuis le presse-papiers | Coller une image, du texte riche (Word → HTML), une URL YouTube → objet du bon type. Gros gain quotidien pour peu de code. |

### C. Objets de page (le cœur)

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| C1 **[T]** | Formes géométriques | Palette : trait, flèche (simple/double), rectangle, carré, ellipse, cercle, triangle (quelconque, rectangle, isocèle), polygone régulier (n côtés), étoile, losange, parallélogramme, trapèze, arc, courbe de Bézier, accolade, bulle de dialogue, encadré arrondi. Propriétés : contour (couleur, épaisseur, pointillé), remplissage (uni, transparent, hachuré), rotation, verrouillage des proportions (Maj). Poignées de redimensionnement communes à tous les objets. |
| C2 **[T]** | Formes intelligentes (reconnaissance du tracé) | Reconnaître à main levée : **ligne droite, flèche, cercle/ellipse, rectangle/carré, triangle, losange, polygone fermé quelconque, arc, accolade**. Approche : simplification du tracé (Ramer–Douglas–Peucker) → nombre de sommets et fermeture → classification par règles (2 sommets = segment ; 3 = triangle ; 4 à angles ~90° = rectangle, côtés ~égaux = carré ; fermé et « rond » = ellipse, via l'écart au cercle ajusté ; 2 sommets + tête = flèche). Le `$1 recognizer`/`$P` (Wobbrock) en repli pour les formes libres. Déclenchement : *maintenir le stylet immobile 400 ms en fin de tracé* (comme Samsung Notes) **ou** mode « formes auto » activé. Toujours proposer « annuler la conversion » (le trait d'origine revient). |
| C3 **[+]** | Reconnaissance d'écriture manuscrite | Même logique que C2 pour le texte : tracé → texte via l'API Web `Handwriting Recognition` (Chrome, hors ligne) sinon `Tesseract.js`. Cible : une remarque écrite au stylet devient une zone de texte propre. Sert aussi à **la recherche sans clavier** (§ F). |
| C4 **[T]** | Tableaux | Objet `table` : lignes/colonnes, cellule = zone de texte (réutilise `BoardTextLayer`), fusion, bordures, en-tête coloré, ajouter/supprimer ligne/colonne depuis un menu contextuel. Remplissage rapide par collage TSV (Excel → tableau). Extrapolation : **tableau de comparaison à trous** (C8) et **tableau à compléter par la classe**. |
| C5 **[T]** | Plus de couleurs | Palette de 16 + roue/hexa + pipette + « couleurs récentes ». Palette *par matière* (schéma SVT : sang rouge/bleu, phloème/xylème…) enregistrée dans les réglages. |
| C6 **[+]** | Styles de trait | Pointillés, flèche en bout de trait libre, trait « laser » (disparaît après 2 s, pour pointer), trait qui se lisse (moyenne mobile) pour les mains qui tremblent au TBI. |
| C7 **[T]** | Texte à trous | Sur une zone de texte : « convertir en texte à trous » → on clique des mots → chaque mot devient un `gap` (masqué, bouton discret pour révéler ; révéler tout ; réinitialiser). Stockage : balise `<span data-gap="1">` dans le HTML existant, rendu canvas = rectangle blanc. Extrapolations : **mode « deviner »** où la classe propose et on tape la réponse ; **choix multiples** (le trou affiche 3 propositions) ; **mots mélangés** (les mots retirés forment une banque à replacer) ; export PDF « version élève » et « version corrigée ». |
| C8 **[T]** | Rideaux | Trois niveaux : rideau **plein écran** (existe déjà, piloté du téléphone) ; rideau **de page** (mémorisé par page : « cette page est couverte jusqu'à ce que je la découvre ») ; rideau **d'objet** (posé sur une zone de texte, une image, une cellule de tableau ; se découvre individuellement d'un clic ou en le faisant glisser). Extrapolations : rideau **progressif** (défiler vers le bas pour révéler ligne par ligne) ; rideau **par lot** (« découvrir toutes les réponses ») ; **projecteur** (tout est sombre sauf un cercle qu'on déplace — l'inverse du rideau, présent dans ActivInspire). |
| C9 **[T]** | Tickets à gratter | Sur un objet : « ticket à gratter » → choisir l'image de couverture ou une couleur unie → on gratte avec le doigt/stylet. Implémentation : masque alpha canvas (`destination-out`), seuil de révélation automatique à 70 %. Extrapolations : **grattage aléatoire** pour une loterie de récompenses (lien tampons/récompenses, § G) ; texture « argent » par défaut ; son de grattage optionnel. |
| C10 **[T]** | Réinitialiser rideaux et tickets | Bouton global « remettre à couvert » (page courante / tout le document) — état de révélation stocké **hors** de l'objet (`revealState` par session) pour que l'export « version élève » et la classe suivante partent de zéro. |
| C11 **[T]** | Images | Insertion par fichier, glisser-déposer, presse-papiers, URL, bibliothèque (§ E). Recadrage, rotation, opacité, « envoyer en fond de page ». Détourage automatique du fond blanc pour les schémas scannés. |
| C12 **[T]** | Son | Objet audio (fichier ou enregistrement micro direct), bouton lecture sur la page. Cas d'usage : dictée, langues, chant d'oiseau en SVT. |
| C13 **[T]** | Liens | Objet lien (URL ou vers une autre page du tableau) ; clic = ouvre en iframe (C14) ou en nouvel onglet. |
| C14 **[T]** | Sites en iframe, dessin par-dessus | Objet `web` : iframe redimensionnable, mode « interaction » (souris passe au site) / mode « annoter » (l'encre passe au-dessus). Attention : beaucoup de sites refusent l'iframe (`X-Frame-Options`) — prévoir un repli « capture d'écran » (ouvrir le site, capturer l'onglet via `getDisplayMedia`, coller l'image). Réutilise l'outil `iframe` du registre. |
| C15 **[T]** | Vidéos | YouTube (déjà un outil), fichier local, Peertube/Vimeo. Contrôles : lecture, boucle A–B, vitesse, **arrêt sur image → capture insérée en page** pour annoter. |
| C16 **[+]** | Sticky notes / post-its | Petites zones colorées repositionnables ; mode « brainstorm » où chaque élève envoie un post-it depuis `/eleve` (V2, § G). |
| C17 **[+]** | Objet « équation » | LaTeX via KaTeX, rendu en image pour le canvas. Indispensable en maths/physique, utile en SVT (bilans chimiques). |
| C18 **[+]** | Groupes, verrouillage, alignement | Grouper/dégrouper, verrouiller (un fond de schéma qu'on ne veut pas déplacer par erreur), aligner/distribuer, ordre z (avant/arrière), dupliquer (Ctrl+D), guides magnétiques. |

### D. Sélection et manipulation

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| D1 **[T]** | Outil sélection (`V`) | Rectangle de sélection ou lasso ; sélectionne encre, textes, formes, images. Poignées communes : déplacer, redimensionner (avec Maj = proportions), pivoter, supprimer, dupliquer. L'encre sélectionnée devient un objet manipulable (translation/échelle des points). |
| D2 **[T]** | Déplacer vs éditer une zone de texte sans hésitation | Règle proposée (à valider à la main) : **un clic simple sur une zone non active la sélectionne** (poignées) ; **glisser depuis n'importe où sur une zone sélectionnée la déplace** ; **double-clic ou clic dans une zone déjà sélectionnée place le curseur** ; au stylet, toucher = éditer, glisser = déplacer avec un seuil de 6 px. Bordure de préhension de 12 px autour de la zone qui déplace toujours. C'est le compromis Figma/PowerPoint, qui ne demande jamais deux essais. |
| D3 **[+]** | Menu contextuel (clic droit / appui long) | Voir § H — c'est là qu'atterrissent la plupart des actions objet. |
| D4 **[+]** | Presse-papiers interne | Copier/coller entre pages et entre tableaux, conservant les objets typés (pas une image aplatie). |

### E. Bibliothèques et ressources

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| E1 **[T]** | Bibliothèque d'objets pour enseignants | Objets SVG vectoriels, insérés comme formes (donc recolorables, redimensionnables). Catalogue initial à construire ensemble ; propositions : **verrerie et matériel de labo** (bécher, erlenmeyer, éprouvette, tube à essai, pipette, burette, loupe binoculaire, microscope, boîte de Petri, lame/lamelle, chauffe-ballon, entonnoir, pince, thermomètre, balance) ; **SVT** (cellule animale/végétale et organites, neurone, cœur, poumons, système digestif, squelette, fleur et ses pièces, graine, chromosome, ADN, virus/bactérie, chaîne alimentaire, cycle de l'eau, coupe géologique, volcan, plaques) ; **physique-chimie** (circuit : pile, lampe, interrupteur, résistance, ampèremètre ; optique : lentille, miroir, rayon ; symboles) ; **maths** (repère, cercle trigonométrique, solides, rapporteur, équerre, règle *manipulables*) ; **géographie** (cartes muettes France/Europe/monde, rose des vents) ; **langues/français** (bulles, schéma narratif, tableau de conjugaison vide) ; **générique** (flèches, étiquettes, encadrés, numéros, coche/croix, smileys, feux tricolores, échelle de niveaux). Sources libres : Wikimedia Commons, Servier Medical Art (CC-BY), BioRender interdit (licence), OpenClipart, Twemoji. |
| E2 **[T]** | Bibliothèque d'images | Onglets : *mes photos* (séances de groupe, TP — déjà en bucket), *mes imports*, *Unsplash/Pexels/Pixabay* (API gratuites, licence claire), *Wikimedia Commons* (API, licence affichée), *Canva* (connecteur disponible : chercher un design, l'exporter en PNG, l'insérer). Toujours stocker la source/licence avec l'image. |
| E3 **[T]** | Modules par matière | Plutôt que « une multitude », un **système de plugins** : un module = manifeste + objets + modèles de page + outils. Premiers modules : SVT (E1 + génotypes, arbres généalogiques *interactifs*, tableau de croisement), Maths (repère interactif GeoGebra en iframe, calculatrice, tableur), Physique (simulateurs PhET en iframe — libres et embarquables), Français (dictée audio, texte à trous, frise chronologique déjà existante), Histoire-géo (cartes, frise), Langues (dictionnaire d'images, audio), Musique (portée, métronome). Les outils déjà dans `src/tools` (mots croisés, mots mêlés, frise) deviennent insérables en page. |
| E4 **[T]** | Drives (Google, OneDrive) | Google Drive : connecteur déjà disponible côté Claude, mais côté app il faut OAuth + Picker API (simple, gratuit). OneDrive : Microsoft Graph + File Picker. Objectif : « insérer depuis Drive » dans le sélecteur d'images/PDF. Le repo est sous OneDrive : un simple « dossier surveillé » local n'est pas possible depuis le navigateur — l'API est la seule voie. |
| E5 **[T]** | DNB avec affichage adapté | Onglet « Annales » dans le tableau : le manifeste et le bucket existent. Affichage adapté = **une page par exercice** (découpage du PDF par repères), zoom sur l'énoncé, corrigé en rideau. Extrapolation : « exercice du jour » tiré au sort dans le manifeste. |
| E6 **[T]** | Base Notion | Oui, c'est faisable : l'API Notion (token d'intégration interne, lecture d'une base) est simple. Cas d'usage : une base Notion « banque d'exercices » ou « idées de schémas » → affichée comme bibliothèque dans le tableau, insertion d'une entrée (titre + contenu + image) comme objets. Il faut passer par une Edge Function Supabase pour ne pas exposer le token dans le navigateur. À préciser : quelles bases, quelles propriétés. |
| E7 **[+]** | Ressources institutionnelles | Éduthèque/Lumni Enseignement, BRNE, Édubase, PhET, GeoGebra, Wikipédia (extrait + image d'une page en un objet), Wiktionnaire (définition en un clic sur un mot du texte). |

### F. Interaction TBI et recherche

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| F1 **[T]** | Menu à deux doigts | Détection de 2 contacts simultanés (Pointer Events, déjà utilisés) → **menu radial** autour du point — c'est exactement le composant du prototype mobile (`RadialMenu.tsx`), l'innovation de l'app, à réutiliser tel quel en version TBI. Contenu proposé : outil (stylo/surligneur/gomme/texte/sélection), couleur, page suivante/précédente, rideau, annuler. Configurable. |
| F2 **[+]** | Gestes | Deux doigts : pincer = zoom, glisser = défilement/pan (en page infinie) ; paume posée = gomme large ; tap à deux doigts = annuler ; trois doigts = rétablir ; balayage 3 doigts = changer de page. Tous derrière un réglage « gestes TBI » car les TBI anciens gèrent mal le multi-touch. |
| F3 **[+]** | Barre d'outils déplaçable et « côté main » | Barre positionnable à gauche/droite/bas, gros boutons ; **mode « je suis à gauche du tableau »** qui rapproche tout d'un bord pour éviter de traverser l'écran. Mini-barre flottante qui suit le stylet (comme OneNote). |
| F4 **[+]** | Zoom et loupe | Zoom sur une zone (une photo de cahier, un détail de schéma), avec encre à l'échelle ; loupe temporaire à deux doigts. |
| F5 **[T]** | Recherche Internet et YouTube intégrée, sans clavier | Panneau de recherche : saisie **manuscrite** (C3) ou **vocale** (Web Speech API, très bonne en français dans Chrome) ou clavier virtuel gros boutons. Résultats en vignettes ; YouTube via Data API v3 (clé gratuite, quota large) ; web via Brave Search API (clé gratuite jusqu'à 2 000 requêtes/mois) ou Google Programmable Search. Insertion directe du résultat comme objet (vidéo, lien, image). |
| F6 **[+]** | Clavier virtuel intégré | Pour les rares saisies au TBI : clavier AZERTY à gros boutons, avec prédiction, qui apparaît près de la zone en édition. |
| F7 **[+]** | Pointeur et mise en avant | Trait laser (C6), projecteur (C8), **agrandir temporairement** un objet au centre de l'écran d'un double-tap. |

### G. Classe, téléphone et élèves

| # | Idée | Détail / extrapolation |
|---|------|------------------------|
| G1 **[T]** | Tirage au sort d'un élève depuis le tableau | La commande `pick` existe (téléphone → écran). Ajouter le déclenchement **depuis le tableau** (bouton + geste) avec les mêmes règles : sans remise dans la séance, exclure absents, animation roulette. Extrapolation : tirage d'un **groupe**, d'un **binôme**, ordre de passage. |
| G2 **[T]** | Caméra du téléphone en direct / photo | Deux modes. **Photo** : le mobile envoie une photo (bucket) → objet image sur la page en Realtime (une commande `photo` dans le protocole). **Vidéo directe** : WebRTC entre téléphone et écran, signalisation via le canal Realtime existant ; le flux est un objet `camera` qu'on peut geler (capture) puis annoter. Cas d'usage : montrer une copie, une manipulation. C'est la « visualiseur » des TBI, sans le matériel. |
| G3 **[T]** V2 | Kahoot-like avec `/eleve` | Objet `quiz` sur la page (question + choix) → les élèves répondent depuis `/eleve` (code déjà existant, Realtime déjà utilisé pour les maisons) → histogramme en direct sur le tableau, points reliés aux **tampons** et aux **maisons** (Epic 10). Extrapolations : nuage de mots (chacun envoie un mot), sondage, « envoyer un post-it », réponse dessinée (l'élève dessine sur son téléphone, s'affiche au tableau). |
| G4 **[+]** | Minuteur dans le tableau | Existe piloté du téléphone ; ajouter un objet `timer` posable sur la page (plusieurs, nommés : « groupe A », « groupe B »), un chronomètre, et une sonnerie. |
| G5 **[+]** | Feux de bruit / consignes | Objet « niveau sonore attendu » (silence, chuchotement, groupe), objet « consigne » plein écran. Petit mais très utilisé. |
| G6 **[+]** | Récompenses au tableau | Ticket à gratter de récompense (C9) tiré pour un élève ; « +1 tampon » depuis le tableau via le canal existant (l'app mobile reste la source de vérité des événements). |

### H. Menu contextuel (clic droit / appui long / deux doigts)

Un seul menu, dont le contenu dépend de ce qui est sous le pointeur :

| Cible | Entrées |
|-------|---------|
| Vide | Coller, Nouvelle zone de texte, Insérer (image, forme, tableau, vidéo, site, son, lien, objet de bibliothèque, équation), Fond de page, Rideau de page, Coller depuis Drive/Notion |
| Encre | Convertir en forme, Convertir en texte (C3), Lisser, Couleur, Épaisseur, Grouper, Supprimer |
| Texte | Couper/Copier/Coller, Mise en forme (sous-menu = barre actuelle), Texte à trous, Rideau sur cette zone, Ticket à gratter, Convertir en tableau, Verrouiller, Dupliquer, Ordre, Supprimer |
| Forme | Contour, Remplissage, Rotation, Aligner, Ordre, Convertir en encre (pour la gommer), Ajouter du texte dedans |
| Image | Recadrer, Envoyer en fond, Détourer le blanc, Rideau, Ticket à gratter, Enregistrer dans ma bibliothèque |
| Tableau | Ligne/colonne avant/après, Supprimer ligne/colonne, Fusionner, Bordures, Trous sur les cellules |
| Rideau/ticket | Découvrir, Recouvrir, Retirer, Tout réinitialiser |
| Sélection multiple | Grouper, Aligner, Distribuer, Même taille, Couleur, Supprimer |
| Page (navigateur) | Dupliquer, Insérer après, Rideau de page, Exporter cette page, Envoyer aux élèves |

Sur TBI, le même menu s'ouvre par **appui long** (500 ms) et par le **geste à deux doigts** (F1) ; il est radial dans ce cas.

### I. Outils rapides

| # | Idée |
|---|------|
| I1 **[T]** | Calculatrice (scientifique, avec historique collé en page), minuteur, chronomètre (G4) |
| I2 **[+]** | Règle, équerre, rapporteur, compas **manipulables** (rotation à deux doigts, le trait suit le bord de la règle) — les instruments d'ActivInspire/OpenBoard |
| I3 **[+]** | Dé (1 à N, plusieurs dés), pièce, roue de la fortune (élèves ou propositions), générateur de nombres, tirage de groupes |
| I4 **[+]** | Convertisseur d'unités, tableau périodique interactif, tableau de conjugaison, dictionnaire (Wiktionnaire) |
| I5 **[+]** | Capture d'écran d'une zone → image en page ; enregistrement vidéo de l'écran + audio (pour une correction envoyée aux absents, publiée dans l'espace ressources) |

---

## 2. Architecture cible (ce qui rend tout le reste possible)

### 2.1 Modèle : une page = une liste d'objets

```
BoardPage
  id, background, image?, curtain?: { covered: boolean }
  objects: BoardObject[]            -- ordre = ordre z
  strokes: Stroke[]                 -- conservés tels quels (calque encre), migrés en objets 'ink' à terme

BoardObject (commun)
  id, type, x, y, w, h, rotation, locked, groupId?, opacity
  reveal?: { kind: 'curtain' | 'scratch'; cover: { color } | { imagePath } }   -- rideau/ticket posé sur l'objet

types : 'text' (le TextBox actuel) | 'shape' | 'image' | 'table' | 'web' | 'video' | 'audio'
        | 'link' | 'equation' | 'sticky' | 'timer' | 'quiz' | 'camera' | 'library' (SVG) | 'ink' (groupe de traits)

Hors document (état de séance, non exporté) :
  revealState: Record<objectId | pageId, 'covered' | 'revealed' | maskDataUrl>
  gapState:    Record<objectId, revealedGapIds[]>
```

Trois conséquences :
- **Un seul système de sélection/poignées/menu contextuel** pour tous les types (D1, D2, H) — à faire *avant* les nouveaux objets, sinon chaque objet réinvente le sien.
- **Un seul rendu canvas** `renderObject(ctx, obj, scale)` par type pour l'export/vignettes ; les objets interactifs (web, vidéo) s'exportent par leur capture ou leur vignette.
- **Un seul format de fichier** (B1) = ce JSON + les assets.

### 2.2 Découpage du code

```
lib/board/
  model.ts          types + migrations de schéma (v1 = strokes/texts actuels → v2 objets)
  render/           un fichier par type d'objet (canvas)
  recognize/        formes (RDP + règles), écriture (API/Tesseract)
  io/               gcboard (zip), pdf export, imports (docx, pptx, presse-papiers)
components/board/
  Whiteboard.tsx            orchestration (garde la boucle d'encre actuelle, très performante)
  layers/ObjectLayer.tsx    rendu DOM des objets + sélection + poignées
  layers/InkLayer.tsx       les 3 canvas actuels
  objects/<Type>.tsx        un composant par type
  Toolbar/, ContextMenu/, PageNavigator/, RadialMenu/ (importé du proto)
  panels/ Search, Library, Annales, Notion, Drive
modules/<matiere>/          manifeste + objets SVG + modèles (E3)
```

Le Whiteboard actuel reste le noyau : la couche encre (pointer events, rejet de paume, coalescence) est ce qu'il y a de plus délicat et elle fonctionne — on ne la réécrit pas, on la met dans `InkLayer`.

### 2.3 Performance

- Objets DOM au-dessus des canvas (c'est déjà le cas pour le texte) : le navigateur gère le texte, l'iframe, la vidéo mieux qu'un canvas. Encre et formes « figées » restent sur canvas.
- Vignettes du navigateur : rendu différé (250 ms après la dernière modification), résolution 240 px, cache par `page.id + hash`.
- Sauvegarde : inchangée (locale immédiate, distante différée), mais `objects` en JSONB séparé de `strokes` pour ne pas renvoyer l'encre à chaque déplacement d'objet.
- Assets : toujours dans `board-assets` par utilisateur, référencés par chemin ; jamais de base64 dans le document.

### 2.4 Données

- `board_pages` : ajouter `objects JSONB` (comme `texts` aujourd'hui — `texts` sera migré dans `objects`), `curtain BOOLEAN`.
- `boards` (B7) : `id, user_id, title, class_id?, page_count, updated_at` + `board_pages.board_id` nullable en parallèle de `session_id`.
- `board_library_items` (E1/E2 « mes objets ») : `id, user_id, kind, title, path, tags[]`.
- Edge Functions : `notion-proxy` (E6), `search-proxy` (F5, cache les clés API), `convert-office` (B3 niveau c, plus tard).

---

## 3. Plan de mise en place (ordonné, chaque jalon utilisable en classe)

Chaque phase est livrable seule ; l'ordre est dicté par les dépendances techniques, pas par l'envie.

| Phase | Contenu | Pourquoi à ce moment |
|-------|---------|----------------------|
| **0. Fondations** | Modèle objets v2 + migration des textes existants ; `ObjectLayer` avec sélection (`V`), poignées communes, déplacement/redimension/rotation, ordre z, dupliquer/verrouiller ; **règle D2** pour le texte ; menu contextuel (souris + appui long) avec les entrées déjà possibles ; presse-papiers interne (D4) ; navigateur de pages (A1) | Tout le reste s'appuie dessus. Le navigateur de pages est le premier bénéfice visible et sert à tester la nouvelle structure. |
| **1. Formes** | Palette de formes (C1) ; formes intelligentes (C2) ; styles de trait (C6) ; palette de couleurs élargie (C5) ; sélection de l'encre comme objet | Après les fondations : les formes sont les premiers « nouveaux objets » et valident le patron. La reconnaissance est du pur calcul (`lib/board/recognize/shapes.ts`) testable hors navigateur. |
| **2. Révélation** | Rideau de page, rideau d'objet, ticket à gratter, texte à trous, réinitialisation globale ; export PDF avec choix des pages et « version élève / corrigée » (B2) | Le trio rideau/ticket/trous partage le même `revealState` et le même menu ; l'export doit le connaître. Fort impact en classe pour peu de risque. |
| **3. Fichiers** | Format `.gcboard` (B1) ; tableaux nommés hors séance (B7) ; import presse-papiers (B8) ; images (C11) avec bibliothèque « mes images » ; export image (B5) ; publication vers l'espace ressources (B6) | Le modèle est stable après les phases 1–2 : c'est le bon moment pour figer un format. B6 dépend de l'Epic 11. |
| **4. Médias et web** | Tableaux (C4) ; vidéos (C15), sites en iframe annotables (C14), son (C12), liens (C13), équations (C17), post-its (C16) ; outils rapides insérables (I1, I3, G4, G5) | Objets « riches » DOM ; chacun est indépendant, on peut les livrer un par un. |
| **5. TBI** | Menu radial à deux doigts (F1, import du proto), gestes (F2), barre déplaçable et côté main (F3), zoom/loupe (F4), instruments (I2), pointeur laser/projecteur (F7) | Demande le vrai TBI pour régler ; à faire quand les objets sont là pour que le menu radial ait quelque chose à piloter. |
| **6. Reconnaissance et recherche** | Écriture manuscrite → texte (C3) ; recherche web/YouTube/images intégrée avec saisie manuscrite et vocale (F5), clavier virtuel (F6), bibliothèques externes (E2 : Wikimedia, Unsplash ; E7) | Dépend de C3 pour la saisie sans clavier et de la phase 4 pour insérer les résultats. |
| **7. Bibliothèques et modules** | Bibliothèque d'objets SVG (E1) — commencer par verrerie + SVT ; système de modules (E3) ; Annales DNB (E5) ; Notion (E6) ; Drives (E4) | Contenu plus que code : à étaler ; l'infrastructure (objet `library`, panneau) vient en début de phase, le catalogue s'enrichit ensuite. |
| **8. Classe connectée** | Tirage au sort depuis le tableau (G1) ; photo depuis le téléphone (G2 photo) ; caméra en direct WebRTC (G2 vidéo) ; « +1 tampon » depuis le tableau (G6) | Le protocole existe ; la partie WebRTC est la plus technique du lot, la garder pour la fin de phase. |
| **9. V2 — imports et élèves** | Import DOCX/PPTX (B3 b puis c) ; quiz Kahoot-like, nuage de mots, post-its élèves (G3) reliés aux tampons et aux maisons | Gros chantiers transverses (Edge Functions, espace élève) ; à planifier quand les phases 0–8 sont stabilisées et qu'Aurélie utilise le tableau. |

Ordre de grandeur, pour se situer : phase 0 est la plus longue (c'est une refonte), les phases 1 à 4 sont chacune comparables à ce qui a été fait pour le texte cette semaine, les phases 5 à 8 dépendent surtout de l'accès au matériel et aux comptes API.

---

## 4. Ce qu'on ne fera pas (ou pas comme ça)

- **Convertisseur `.flipchart`** : format fermé, non documenté. Passage par PDF.
- **Reconnaissance d'écriture côté serveur payante** (Google Vision, MyScript) tant que l'API Web / Tesseract suffit ; à reconsidérer si la qualité déçoit sur TBI.
- **Iframe de n'importe quel site** : beaucoup refusent ; on documente le repli capture d'écran plutôt que de promettre.
- **Base64 dans les documents** : toujours des assets en bucket, sinon les tableaux deviennent illisibles et lents.
- **Réécrire la couche encre** : elle est validée (stylet, palme, 60 FPS) ; on l'encapsule.

## 5. À trancher avant la phase 0

| Question | Proposition |
|----------|-------------|
| L'encre devient-elle un objet dès la phase 0 ? | Non : garder `strokes` à part, rendre la *sélection* d'encre capable de la déplacer/redimensionner ; conversion en objet `ink` seulement lors d'un groupement. Moins de risque. |
| Rotation des zones de texte ? | Oui dans le modèle (champ `rotation`), non dans l'interface avant la phase 5 (le rendu canvas du texte tourné est simple, l'édition tournée en DOM l'est moins). |
| Tableau libre de l'accueil | Devient un `board` nommé « Brouillon » dès la phase 3 ; d'ici là, inchangé. |
| Déclencheur des formes intelligentes | Stylet immobile 400 ms en fin de tracé **et** bouton « formes auto » ; on garde le premier qui plaît au TBI. |
| Quelles bases Notion, quelles clés API (YouTube, Brave, Unsplash) | À lister par Thomas ; les clés vont dans les secrets des Edge Functions, jamais dans le front. |

---

## 6. Mode autonome (boucle sans Thomas) — convenu le 10/09/2026

Thomas s'absente ; les phases s'enchaînent en boucle (`/loop`). Règles pour ne jamais bloquer :

**Une itération = une phase (ou la suite de la phase en cours).** Chaque itération se termine par :
`npx tsc -b`, `eslint` sur les fichiers touchés, `npm run build`, banc d'essai Chrome des composants (comme pour les phases 0–2),
mise à jour de la mémoire (`project_whiteboard_roadmap`) et un compte rendu court dans la conversation. Jamais de commit ni de push.

**Ordre** : 3 (fichiers) → 4 (médias et web) → 5 (TBI, ce qui se règle sans le matériel : menu radial, barre déplaçable, zoom, instruments, projecteur) → 6 (reconnaissance d'écriture, recherche) → 7 (bibliothèques : infrastructure + premier catalogue verrerie/SVT en SVG) → 8 (classe connectée : tirage depuis le tableau, photo du téléphone, tampon ; WebRTC en dernier). La 9 (V2) n'est pas lancée sans Thomas.

**Décisions prises d'avance (ne pas demander)** :
- Base : écrire les migrations dans `supabase/migrations/`, **ne jamais les appliquer en prod** ; le code tolère leur absence (patron de `boardQueries`).
- Clés API (YouTube, Brave, Unsplash, Notion, Drive) : champ dans les réglages + Edge Function écrite mais non déployée ; la fonctionnalité affiche « clé à renseigner » tant qu'elle manque. Pas de clé inventée.
- Design : CSS minimal, un bloc par composant ; le visuel sera refait avec Claude Design.
- Formats : `.gcboard` = ZIP (JSZip est une dépendance acceptable ; `jszip` en UMD). DOCX/PPTX = phase 9, non lancés.
- Tout ce qui demande le TBI, le téléphone ou un compte (OAuth, Storage) est codé, testé au banc quand c'est possible, et listé « à essayer sur place » dans le compte rendu.
- En cas de doute d'interprétation : choisir l'option la plus simple qui respecte le plan, la noter dans le compte rendu.

**Arrêt** : à la fin de la phase 8, ou si une phase échoue deux itérations de suite (on laisse un état compilable et on attend Thomas).
