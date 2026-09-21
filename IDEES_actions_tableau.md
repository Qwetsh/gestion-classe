# Idées — Tableau blanc : boutons d'action et actions possibles

Rédigé le 20/09/2026 à la demande de Thomas : « on ne peut que afficher / cacher quelque chose,
j'aimerais développer cette option ». Phase d'idées, aucune ligne de code. Le document part de ce
que font Genially, ActivInspire, PowerPoint, Canva, SMART Notebook / Lumio et quelques autres,
puis propose ce qu'on peut reprendre dans notre tableau, classé par effort.

## 0. Ce que le tableau sait déjà faire

| Brique | État | Fichier |
|---|---|---|
| Bouton d'interaction | N'importe quel objet peut porter `interactions: { targetId, action }[]`, `action` ∈ `show`, `hide`, `toggle`. Choix de la cible en mode liaison (flèche + bulle). Déclenchement : tap en mode lecture (stylo, affichage) ; en mode Sélection, le tap sélectionne. | `lib/boardObjects.ts`, `lib/boardReveal.ts`, `BoardInteractionBubble.tsx` |
| Caché au départ | `hidden: true` sur la cible, état de séance dans `RevealState.shown`. | `lib/boardReveal.ts` |
| Caches | Rideau tirable, ticket à gratter (uni ou image) posés sur un objet. | `lib/boardReveal.ts` |
| Texte à trous | Trous `[data-gap]` révélés au tap. | `BoardObjectLayer.tsx` |
| Post-it replié | Dossier dépliable en séance. | `lib/boardText.ts` |
| Extracteur de mots | Tap sur un mot = copie déplaçable (livré le 20/09). | `Whiteboard.tsx` |
| Pages, onglets | Plusieurs pages par tableau, plusieurs tableaux en onglets, page allongée (scroll). | `BoardWorkspace.tsx` |
| Objets | Texte, forme, image, bibliothèque, tableau, équation, média (vidéo, site, son), lien, widgets (minuteur, dé, roue, bruit, calculatrice, jauge, groupes, horloge, feu tricolore, QR). | `lib/boardMedia.ts` |
| Instruments | Règle, équerre, rapporteur, projecteur (spot), clavier virtuel. | `lib/boardInstruments.ts` |

Point structurant inchangé : tout est du JSON dans `board_pages`. Ajouter des actions = étendre
`InteractionAction` et ajouter des champs optionnels ; aucune migration SQL. Les états de séance
(ce qui est montré, déplié, révélé) vivent dans `RevealState`, jamais dans le modèle.

## 1. Ce que font les autres

### Genially (le plus proche de notre « bouton »)

Onze interactivités, toutes posées sur n'importe quel élément :

| Interactivité | Ce que ça fait |
|---|---|
| Open a window | Fenêtre modale (texte, image, vidéo) par-dessus la page. |
| Tooltip | Étiquette au survol ou au focus clavier. |
| Go to page | Saute à une page du même genially. |
| Link | Ouvre une URL, un mail, un téléphone. |
| Play audio | Joue un son au clic. |
| Drag and drop | Élément déplaçable ; zones de dépôt avec bonne / mauvaise réponse. |
| Trigger an effect | Lance une animation (entrée, sortie, accent) sur un élément. |
| Zoom | Zoome sur un élément. |
| Show / Hide elements | Affiche ou masque un ou plusieurs éléments (= notre existant). |
| Scroll to element | Défile jusqu'à un élément (page longue). |
| Reveal (question / réponse) | Cartes à retourner, quiz avec feedback. |

À retenir : la **fenêtre** et **plusieurs cibles avec des actions différentes** sur un même bouton
sont ce qui fait la richesse de Genially. Le survol n'existe pas au TBI, donc pas de tooltip tel quel.

### ActivInspire (Promethean, le plus « tableau de classe »)

Plus de 200 actions dans l'Action Browser, regroupées :

| Famille | Actions typiques |
|---|---|
| Page | Page suivante / précédente / première / dernière, aller à la page N, réinitialiser la page. |
| Objet | Hidden / Toggle hidden (cible), Bring to front / Send to back, Position incrementally (déplace la cible de dx, dy), Size incrementally, Rotate, Change text value (écrit un texte dans la cible), Extract text (tap sur un mot = copie, ce qu'on vient de livrer), Drag a copy (cloneur), Fixed / Locked. |
| Document / média | Open website, Open document / file / sound, Insert link. |
| Outils | Ouvrir la caméra, règle / compas / rapporteur, calculatrice, dés, chrono, révélateur (screen reveal), spot, encre magique (gomme qui révèle une couche cachée). |
| Conteneurs | Un objet « conteneur » n'accepte que certains objets (par mot-clé ou identité) ; refusé = l'objet revient à sa place ; accepté = son de récompense. C'est le tri / classement auto-corrigé. |
| Restricteurs | Un objet ne bouge que horizontalement / verticalement / dans une zone, ou pas du tout. |
| Vote | Questions aux boîtiers (hors sujet, on a le téléphone). |

À retenir : les **conteneurs auto-correcteurs**, le **cloneur** et les actions **de mouvement /
d'écriture** sur une cible. ActivInspire lie aussi une action à un déclencheur autre que le tap
(le déclencheur est toujours le clic sur l'objet porteur, mais l'objet porteur peut être une zone
invisible).

### PowerPoint (ce que les collègues connaissent)

- Déclencheurs : une animation se lance « au clic de » tel objet (Trigger → On click of). Apparaître /
  disparaître combinés = notre afficher / masquer.
- Zoom de résumé / de section : une page « sommaire » cliquable qui renvoie vers une section et revient.
- Liens vers une diapositive, une URL, un fichier ; boutons d'action prêts (suivant, précédent, accueil).
- Animation Morph entre deux diapositives (transition d'état, pas action).

À retenir : le **retour automatique** après un zoom de section, et le fait que le bouton porte
**une séquence** d'animations, pas une seule.

### Canva

- Lien sur n'importe quel élément : page de la présentation, URL, mail.
- Hotspots sur une image : zones cliquables, visibles toujours / au survol / jamais.
- Pas d'afficher / masquer, pas de conteneurs : Canva reste un outil de mise en page.

À retenir : la **zone cliquable invisible** posée sur une image (hotspot), utile sur un schéma SVT.

### SMART Notebook / Lumio

- Cloneur infini : l'original reste, chaque glisser en sort une copie (manipulables, jetons, mots).
- Liens d'objet : page, fichier, site, son ; ombre d'écran (rideau de page) ; encre magique.
- Lumio : activités prêtes (retourner des cartes, étiquettes à révéler, tri, appariement, classement,
  jeu-questionnaire) faites côté élève.

À retenir : le **cloneur** est la version « objet » de notre extracteur de mots.

### Autres, en vrac

- H5P : « Drag the words » (= extracteur + conteneurs), « Mark the words », « Image hotspots »,
  « Memory », « Flashcards » ; feedback immédiat et score.
- OpenBoard (TBI libre, courant en collège) : lien d'objet vers page / site, cache, spot, masque.
- Keynote / Google Slides : liens vers diapositive et URL seulement.

## 2. Synthèse : les familles d'actions

En rangeant tout ce qui précède par ce que l'action **fait à la cible**, on obtient neuf familles.
Les trois premières existent chez nous en partie.

| # | Famille | Exemples | Chez nous aujourd'hui |
|---|---|---|---|
| A | Visibilité | afficher, masquer, basculer, révéler un cache, déplier un post-it | show / hide / toggle ; caches et post-its se manipulent à la main, pas par bouton |
| B | Navigation | page suivante / précédente / N, onglet, défiler jusqu'à un objet, retour | rien par bouton |
| C | Contenu ponctuel | fenêtre (texte, image, vidéo), zoom sur un objet, agrandir une image | rien |
| D | Média et liens | jouer un son, lancer / mettre en pause une vidéo, ouvrir un site, un fichier cloud | objets média cliquables, pas d'action « depuis un bouton » |
| E | Transformation | déplacer de dx, dy, aller à un point, tourner, agrandir, premier plan, changer le texte, changer la couleur | rien |
| F | Génération | dupliquer la cible (cloneur), extraire un mot, effacer les copies | extracteur de mots |
| G | Pédagogie / contrôle | conteneur qui accepte ou refuse, bonne / mauvaise réponse avec feedback, compteur de points, remise à zéro de la page | rien |
| H | Outils et widgets | démarrer le minuteur, lancer le dé, tourner la roue, ouvrir la calculatrice, allumer le spot, tirer un élève au sort | widgets manipulés à la main |
| I | Séquence et logique | plusieurs actions dans l'ordre, délai, « une seule fois », alterner à chaque tap, action au chargement de la page | multi-cibles, mais une action par cible et pas d'ordre |

## 3. Ce qu'on propose de reprendre, par effort

Critère de tri : utile en classe de SVT au collège, faisable au doigt sur TBI, sans migration.

### Lot 1 — peu d'effort, s'appuie sur l'existant (une semaine)

| Action | Famille | Usage en classe | Modèle |
|---|---|---|---|
| Révéler / recouvrir un cache | A | Un bouton « Réponse » ouvre le rideau posé sur la correction. | `action: 'reveal' \| 'cover'` sur une cible à `cover` ; passe par `revealObject` déjà écrit. |
| Déplier / replier un post-it | A | Un bouton « Aide » déplie le post-it de coup de pouce. | `action: 'unfold' \| 'fold'` ; `unfoldInSession` existe. |
| Aller à une page | B | Sommaire cliquable au début du tableau, boutons « Suite » sur un schéma. | `action: 'goto', page: number` ; pas de cible objet. |
| Page suivante / précédente | B | Boutons de navigation dans la page (utile en mode affichage). | `action: 'next' \| 'prev'`. |
| Jouer un son | D | Cri d'animal, bruit d'un phénomène, signal de fin. | `action: 'play'` sur une cible média audio ; ou `sound: url` sans cible (fichier du cloud). |
| Lancer / stopper un widget | H | Bouton « Top chrono » qui démarre le minuteur, « Tirage » qui lance le dé ou la roue. | `action: 'trigger'` sur une cible widget ; chaque widget expose une commande. |
| Séquence ordonnée | I | Un tap = masquer la question, afficher la réponse, aller à la page. | `interactions[]` est déjà une liste : l'ordre devient significatif, la bulle affiche la liste. |

### Lot 2 — effort moyen, nouvelles briques (deux à trois semaines)

| Action | Famille | Usage en classe | Ce qu'il faut |
|---|---|---|---|
| Fenêtre | C | Tap sur une cellule du schéma = fenêtre avec la définition et une photo. | Un objet « fenêtre » (`window`), invisible en lecture, ouvert en modale par-dessus la page ; son contenu = objets d'une mini-page. |
| Zoom sur un objet | C | Agrandir une image de microscope, un tableau de mesures. | `action: 'zoom'` : la vue anime le cadrage sur la cible, tap hors = retour. On a déjà le zoom de vue. |
| Zone cliquable invisible | (support) | Hotspots sur un schéma ou une photo : chaque organe est un bouton. | Une forme sans contour ni fond en lecture (`invisible: true`), visible en édition en pointillé. |
| Déplacer la cible | E | « Le globule sort du vaisseau », flèche qui avance d'un cran, jeton qui monte. | `action: 'move', dx, dy` ou `to: { x, y }`, animé ; revient avec « réinitialiser la page ». |
| Cloneur | F | Réserve infinie de jetons, d'étiquettes, de molécules. | `cloner: true` sur un objet : le glisser crée une copie et laisse l'original. Cousin direct de l'extracteur de mots. |
| Réinitialiser la page | G / I | Un bouton pour rejouer l'activité avec la classe suivante. | `action: 'reset'` : remet `RevealState` de la page à zéro et supprime les copies créées en séance. |
| Une seule fois / alterner | I | Bouton à usage unique, ou qui alterne deux états (jour / nuit). | `once: true` ; `toggle` généralisé à toute action. |

### Lot 3 — ambitieux, vrai gain pédagogique (un mois, à découper)

| Action | Famille | Usage en classe | Ce qu'il faut |
|---|---|---|---|
| Conteneurs auto-correcteurs | G | Tri (vivant / non vivant), classement (chaîne alimentaire), appariement mot / image, avec retour sonore et visuel. | Un objet « conteneur » avec règle d'acceptation (liste d'objets, ou mot-clé sur les textes) ; à la dépose : accepté = reste + son, refusé = revient. Une zone de dépôt réutilise le drag existant. |
| Bonne / mauvaise réponse | G | Deux boutons sous une question, feedback immédiat, score de la classe. | `action: 'feedback', kind: 'ok' \| 'ko'` avec message et son ; un compteur de page. |
| Actions au chargement | I | La page s'ouvre avec le minuteur lancé et la consigne affichée. | `page.onOpen: Interaction[]`. |
| Encre magique | A | Gomme qui révèle une couche cachée (radiographie, coupe). | Une couche d'objets « sous » un cache, la gomme creuse le cache. Proche du ticket à gratter, généralisé à une couche. |
| Écrire dans la cible | E | Bouton qui remplit un texte, une cellule de tableau, une légende. | `action: 'setText', text` ; sur `text`, `table` (cellule). |

### Écarté pour l'instant

- Tooltip au survol : pas de survol au doigt. Remplacé par la fenêtre au tap.
- Animations décoratives (entrée, rebond) : joli, sans valeur en classe, coûteux en canvas.
- Vote par boîtiers : on a le téléphone et le mode en classe.

## 4. Déclencheurs : pas seulement le tap

Aujourd'hui un bouton se déclenche au tap en mode lecture. Les autres outils montrent d'autres
départs, à envisager comme un champ `trigger` sur le bouton, `'tap'` par défaut :

| Déclencheur | Usage | Remarque |
|---|---|---|
| Tap (défaut) | tout | existant |
| Appui long | action « secondaire » du même bouton (ex : masquer) | déjà un geste connu du tableau |
| Dépose dans une zone | conteneurs, tri | c'est le drag and drop de Genially / ActivInspire |
| Ouverture de la page | mise en place automatique | lot 3 |
| Fin du minuteur | « Temps écoulé » affiche la correction | le widget émet un événement |
| Nième tap | révéler par étapes (1er tap : indice, 2e : réponse) | remplace une séquence de boutons |

## 5. Interface : comment ça se présente au prof

Ce qui marche aujourd'hui et qu'on garde : ⚡ → « Touchez l'objet… » → bulle. Ce qui change :

1. **La bulle devient un choix d'action à deux niveaux** : famille (Visibilité, Navigation, Contenu,
   Média, Déplacer, Outils), puis action. Six pastilles d'icônes, pas une liste de vingt lignes.
2. **Actions sans cible** (aller à une page, son, page suivante) : ⚡ propose directement « Sans
   cible : … » avant de demander de toucher un objet.
3. **La liste des actions d'un bouton** est visible et réordonnable dans la bulle (glisser une
   ligne), avec « Tester » qui rejoue la séquence entière.
4. **Aperçu en édition** : un bouton porte déjà une pastille ⚡ ; les cibles cachées sont en
   fantôme. On ajoute une flèche fine bouton → cible affichée quand le bouton est sélectionné,
   comme le mode liaison mais figée.
5. **Menu contextuel** : garde « Bouton et interactions » avec les mêmes entrées, pour la souris.

## 5 bis. Banque d'événements (idée de Thomas, 20/09)

Une banque d'éléments **déjà munis de leur action**, qu'on ouvre comme la bibliothèque et qu'on
glisse-dépose sur la page. Si l'action a besoin d'une cible (afficher / masquer, révéler…), le
dépôt enchaîne directement sur le mode « choix de la cible » : bandeau + flèche + bulle, sans
passer par ⚡.

### Ce que ça change

- Aujourd'hui : poser un objet, le sélectionner, ⚡, toucher la cible, régler la bulle. Cinq gestes.
- Avec la banque : glisser l'élément, toucher la cible. Deux gestes, et le prof n'a plus à savoir
  ce qu'est un « bouton d'interaction » : il prend « Bouton Réponse » ou « Étiquette qui révèle ».

### Contenu de la banque

Deux étages, comme la bibliothèque d'objets :

| Étage | Contenu | Stockage |
|---|---|---|
| Fournis | Une vingtaine de préréglages livrés avec l'app : « Bouton Réponse » (révèle un cache), « Afficher / masquer », « Suite → » (page suivante), « ← Retour », « Sommaire » (aller à la page N), « Zone cliquable » (hotspot invisible + fenêtre), « Point chaud » (rond + fenêtre), « Top chrono » (lance le minuteur), « Son » (joue un son), « Réservoir » (cloneur), « Tout remettre » (reset). | Code, comme `LIBRARY_ITEMS` |
| Les miens | Le prof sélectionne un objet déjà configuré sur sa page → clic droit → « Enregistrer dans mes événements… » : l'objet (style, texte, taille) et sa liste d'actions sont sauvés sous un nom. | Table `board_presets` (user_id, name, module, json) ou, plus simple au début, un JSON dans les préférences du compte |

### Ce qu'un préréglage contient

L'objet sans identifiant ni position, ses actions avec la cible **en attente** :

```ts
interface EventPreset {
  id: string; label: string; icon: string; module?: string;
  object: Omit<BoardObject, 'id' | 'x' | 'y'>;        // style, texte, forme, taille
  interactions: Array<Omit<Interaction, 'targetId'> & { needsTarget: boolean }>;
}
```

Au dépôt : `addObject` avec la position du doigt, puis pour chaque interaction `needsTarget`,
`startLinking` avec l'action **déjà choisie** (la bulle ne demande que la cible et « caché au
départ »). Deux cibles à choisir = deux bandeaux à la suite, « 1 / 2 » puis « 2 / 2 ».

### Où ça se range

Un onglet **« Événements »** dans le panneau Ressources, à côté de Bibliothèque / Annales /
Notion / Drive : même panneau, même geste de dépôt, même recherche. Aussi accessible depuis le
menu radial (pastille « Événements ») pour ne pas ouvrir tout le panneau en classe.

### Dépendances

La banque ne vaut que par la variété des actions disponibles : elle vient **après** le lot 1
(nouvelles actions) et **avec** le schéma cliquable (hotspots + fenêtre), qui fournit ses
préréglages les plus utiles.

## 6. Modèle cible (pour cadrer, pas pour coder maintenant)

```ts
type InteractionAction =
  | 'show' | 'hide' | 'toggle'          // existant
  | 'reveal' | 'cover'                  // caches
  | 'unfold' | 'fold'                   // post-its
  | 'goto' | 'next' | 'prev'            // pages (goto : page)
  | 'play' | 'pause'                    // médias (cible média ou son)
  | 'trigger'                           // widget (start minuteur, lancer dé…)
  | 'zoom' | 'window'                   // contenu
  | 'move' | 'setText'                  // transformation (dx, dy | to ; text)
  | 'reset';                            // page

interface Interaction {
  targetId?: string;                    // absent pour goto / next / prev / reset / son externe
  action: InteractionAction;
  params?: Record<string, unknown>;     // page, dx, dy, text, url…
  once?: boolean;
}

interface BoardObjectBase {
  interactions?: Interaction[];         // ordre = séquence
  trigger?: 'tap' | 'long' | 'drop' | 'open';
  invisible?: boolean;                  // hotspot
  cloner?: boolean;
}
```

`RevealState` gagne `moved: Record<id, {x, y}>`, `clones: id[]`, `counters`. Tout reste de l'état de
séance, remis à zéro par `reset`, jamais écrit dans `board_pages`.

## 7. Décisions prises le 20/09/2026

| # | Question | Décision |
|---|---|---|
| 1 | Scène de classe prioritaire | **Le schéma cliquable** (hotspots + fenêtre), puis le reste. |
| 2 | Une action à plusieurs cibles, ou une séquence | **Séquence** ordonnée d'actions par bouton. |
| 3 | Déplacement d'une cible | **Animé**. |
| 4 | Sons | Banque intégrée si les fichiers sont légers ; secondaire, pas dans les premiers lots. |
| 5 | Actions depuis le téléphone (mode en classe) | Pas tranché : à revoir une fois les actions en place. |
| + | Banque d'événements | Ajoutée au plan (§ 5 bis), livrée avec le schéma cliquable. |

## 8. Ordre proposé après décisions

### Lot A — Socle : séquences et nouvelles actions sans nouvel objet

Étendre `Interaction` (action + params + ordre), la bulle en deux niveaux, et les actions qui ne
demandent aucun nouvel objet : révéler / recouvrir un cache, déplier / replier un post-it, aller à
une page, suivant / précédent, lancer un widget, jouer un son d'un média déjà posé, réinitialiser
la page. Le canvas projeté ne change pas.

### Lot B — Schéma cliquable

1. **Zone cliquable invisible** : forme sans contour ni fond en lecture, pointillé en édition,
   posée sur une image ou un dessin de la bibliothèque. Un tap = ses actions.
2. **Fenêtre** : nouvel objet `window`, invisible en lecture, ouvert en modale par-dessus la page
   (texte, image, vidéo, objet de bibliothèque). Fermeture au tap hors fenêtre ou ✕. Action
   `window` sur une zone ou un bouton.
3. **Zoom sur un objet** : action `zoom`, cadrage animé sur la cible, retour au tap hors.
4. **Déplacer une cible**, animé (300 ms, glissé), avec retour par « réinitialiser ».

### Lot C — Banque d'événements

Onglet « Événements » dans Ressources, une vingtaine de préréglages fournis (dont ceux du schéma
cliquable), dépôt qui enchaîne sur le choix de cible, « Enregistrer dans mes événements » depuis
le menu contextuel.

### Lot D — Ensuite, à réordonner

Cloneur, conteneurs auto-correcteurs, bonne / mauvaise réponse, actions à l'ouverture de la page,
encre magique, déclencheurs (appui long, dépose, fin du minuteur), banque de sons, commandes
depuis le téléphone.

## 9. Décisions complémentaires (20/09/2026, suite)

| # | Question | Décision |
|---|---|---|
| 1 | Fenêtre | **Contenu simple** : un texte + une image (ou un objet de bibliothèque). Pas de mini-page. |
| 2 | Zone cliquable | **Tout** : rectangle, ellipse et contour libre dessiné au doigt (via les formes automatiques du stylo). |
| 3 | Mode aperçu en édition | **Oui**, mais ça s'inscrit dans un vrai travail à mener sur la frontière **mode édition / mode en classe** : quels gestes, quels outils, quel affichage dans chacun. À traiter comme un chantier UX à part, avant ou avec le lot B. |
| + | Onglet Événements | Retenu tel quel **pour l'instant** ; l'UI sera retravaillée plus tard, cet onglet compris. |

Plans et bilans : `PLAN_actions_lot_A.md` (lot A, 20/09/2026), `PLAN_actions_lot_B.md` (lot B, 20/09/2026), `PLAN_actions_lot_C.md` (lot C, 21/09/2026). Reste ensuite le cadrage du
chantier « édition / en classe » qui conditionne le lot B et le mode aperçu.

## Sources consultées

- Genially : [Interactive elements in Genially](https://help.genially.com/en_us/interactive-elements-in-genially-HJLKqDBnj), [How to set up interactivity](https://help.genially.com/en_us/how-to-set-up-interactivity-in-genially-BJHrqwSho), [Tooltip interactivity](https://help.genially.com/en_us/how-to-set-up-tooltip-interactivity-in-genially-HJcYcPBhj), [Interactions and animations](https://genially.com/features/interactions-and-animations/)
- ActivInspire : [Adding Actions to ActivInspire Flipcharts (PDF)](https://teachtechtime.weebly.com/uploads/2/6/8/3/26832490/actions.pdf), [Action Browser](https://www.iorad.com/player/128188/Action-Browser---ActivInspire), [ActivInspire User Guide (PDF)](https://learn.prometheanworld.com/wp-content/uploads/2023/03/Getting-Started-with-ActivInspire_April23.pdf), [In Touch: ActivInspire Actions](https://wsfcsintouch.blogspot.com/2009/06/activinspire-actions.html)
- PowerPoint : [Use Animation Triggers](https://www.howtogeek.com/powerpoint-animation-triggers-interactive/), [Triggers for appear / disappear](https://nutsandboltsspeedtraining.com/powerpoint-tutorials/triggers-for-appear-disappear-animations-in-powerpoint/), [Interactive PowerPoint, teacher's guide](https://www.classpoint.io/blog/how-to-make-an-interactive-powerpoint)
- Canva : [Interactive content ideas](https://www.canva.com/learn/interactive-content-ideas/), [Interactive presentations with Canva](https://8designers.com/blog/how-do-i-make-my-canva-presentation-interactive), [Clickable buttons in Canva](https://www.oreateai.com/blog/making-your-canva-designs-interactive-adding-clickable-buttons/402e824514ad2c45243d78f640121162)
- SMART : [Using the infinite cloner (Notebook 21)](https://support.smarttech.com/docs/software/notebook/notebook-21/en/creating-lessons/using-infinite-cloner.cshtml), [Lumio teacher guide](https://support.smarttech.com/docs/software/lumio/en/teacher-guide/default.cshtml)
