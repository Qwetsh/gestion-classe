# Plan — Actions des boutons, lot B : schéma cliquable

Rédigé le 20/09/2026 après le lot A (`PLAN_actions_lot_A.md`) et une lecture du code
(`lib/boardShapes.ts`, `lib/boardRecognize.ts`, `lib/boardMedia.ts`, `BoardObjectLayer.tsx`,
`Whiteboard.tsx` : vue et zoom, `BoardExportDialog.tsx` : patron de modale). Aucune ligne de code
n'est écrite : ce document sert à valider les choix avant de coder.

Scène visée (décision §7 des idées) : une image ou un dessin de la bibliothèque, des zones
invisibles posées sur ses parties, un tap = une fenêtre, un zoom, un déplacement, une révélation.

## 0. Ce que le code sait déjà faire

| Point | État actuel | Fichier |
|---|---|---|
| Formes | 15 `ShapeKind` dont `polygon` à `points[]` (sommets en fraction de la boîte), `fill: null` = creuse, `text` possible. `polygon` absent du catalogue : il ne vient que de la reconnaissance du stylo. | `lib/boardShapes.ts:14-63` |
| Reconnaissance | Trait fermé + stylet immobile 400 ms → forme standard ou `polygon` (max 8 sommets, très « redressé »). | `lib/boardRecognize.ts`, `Whiteboard.tsx:1784` |
| Hit-test | En lecture, un bouton est touchable sur **toute sa boîte** (`.is-playable`, enfants sans pointer-events). `shapeContainsPoint` (vrai test sur le chemin) existe mais n'est pas utilisé au tap. | `BoardObjectLayer.tsx:1559`, `lib/boardShapes.ts:232` |
| Vue | `view = { zoom, tx, ty }`, appliquée par `transform` CSS sur `.wb__view` ; zoom borné à [1, 4], `tx` forcé à 0 à zoom 1 ; **aucune animation**. Formule de cadrage disponible (`stageBox`, `textScale`). | `Whiteboard.tsx:238, 432, 2314, 3108` |
| Nouveau type d'objet | Checklist connue (union `MediaObject`, `mediaRect`, rendu DOM et canvas, libellés, barre, insertion, export `.gcboard`). Piège : `boardFile.ts` n'exporte que `image.path` et `cover.imagePath`. | `lib/boardMedia.ts`, `lib/boardFile.ts:34-56` |
| Images | Bucket `board-assets`, `uploadBoardImage`, `signedUrl` avec cache ; les URL sont résolues par le calque (`coverUrls`). | `lib/boardImport.ts`, `BoardObjectLayer.tsx:265` |
| Modale | Patron `.wbx` (voile + boîte, fermeture au clic hors et ✕), thème TBI dans `wb-theme.css:361`. | `BoardExportDialog.tsx:50-107` |
| État de séance | `RevealState` à 6 champs ; `fireInteractions` → `{ state, effects }` ; `recoverPage` et `loadRevealState` listent les champs un par un. | `lib/boardReveal.ts` |

Règles inchangées : l'état de séance ne s'écrit jamais dans le document ; tout nouveau visuel de
page se fait deux fois (DOM et canvas), sauf ce qui est purement de séance.

## 1. Zones cliquables invisibles

Pas de nouveau type : une **forme** avec un drapeau.

```ts
// lib/boardShapes.ts — ShapeObject
/** Zone cliquable : invisible en lecture, pointillé fin en édition. Sert de bouton sur un schéma. */
hotspot?: boolean;
```

- **Rendu** : en édition, contour pointillé fin indigo à 60 % et voile à 8 % ; en lecture, rien
  (ni contour ni fond). Canvas : rien du tout (vignettes et export ne montrent pas les zones).
- **Tap** : en lecture, la zone est touchable comme un bouton. Pour une ellipse ou un contour
  libre, le tap est validé avec `shapeContainsPoint` au relâchement ; hors du tracé mais dans la
  boîte, rien ne se passe. Pour un rectangle, la boîte suffit.
- **Création**, trois chemins :
  1. Catalogue des formes : deux entrées « Zone » (rectangle) et « Zone ovale », posées comme une
     forme, avec `hotspot: true` et `fill: null`.
  2. Menu contextuel de n'importe quelle forme : « Zone cliquable (invisible en lecture) » à cocher.
     C'est ce qui permet le **contour libre** : on dessine au stylo, le trait fermé devient un
     polygone, on le passe en zone.
  3. Entrée « Zone libre » du catalogue : le doigt trace le contour, les points bruts sont
     simplifiés (tolérance 1,5 % de la diagonale, 64 sommets max) en `polygon` sans passer par la
     reconnaissance, qui redresse trop.
- Une zone se relie comme tout bouton (⚡, bandeau, bulle). Le badge ⚡ reste visible en édition.
- La barre « Forme » garde ses réglages ; sur une zone, contour et fond sont grisés.

## 2. Fenêtre

Nouveau membre de `MediaObject` :

```ts
// lib/boardMedia.ts
export interface WindowObject extends BoardObjectBase {
  type: 'window';
  h: number;
  title: string;
  /** HTML restreint (même sanitizeBoardHtml que les zones de texte). */
  html: string;
  imagePath?: string;
  imageW?: number;
  imageH?: number;
}
```

- **Sur la page** : en édition, une carte « 🗔 Titre » de 220 × 60 unités (comme un lien), avec le
  badge « caché » ; en lecture, rien. Elle sert de cible à l'action `window`.
- **Édition du contenu** : double-clic ou barre → boîte modale d'édition : champ titre, zone de
  texte riche (l'éditeur des zones de texte, gras / couleur), bouton « Image… » (input fichier
  caché, upload dans `board-assets`, comme le ticket à gratter image), aperçu, Valider.
- **En lecture** : l'action `window` ouvre `BoardWindowDialog` sur le patron `.wbx` : titre, image
  à gauche ou dessus selon le format, texte, ✕ ; fermeture au tap hors boîte ou ✕. Une seule
  fenêtre ouverte à la fois ; l'ouvrir de nouveau la remplace.
- **Action** : `window` (famille « Contenu », icône 🗔), cible = objet fenêtre ; `actionsFor` la
  propose sur une cible `window` uniquement. Effet `{ kind: 'window', targetId }`, état React
  éphémère `openWindow: string | null` dans le tableau, jamais persisté.
- Checklist du nouveau type suivie ligne par ligne, avec les deux oublis à ne pas reproduire :
  préchargement d'image dans `boardRender.ts:428` (pour rien : la fenêtre ne se dessine pas au
  canvas, mais le chemin doit passer par `boardFile.ts` pour l'export `.gcboard`) et
  `boardFile.ts:34-56` élargi à `window.imagePath` (et, au passage, `equation.imagePath`).

## 3. Zoom sur un objet

- **Action** `zoomTo` (famille « Vue », icône 🔍), cible = n'importe quel objet visible. Effet
  `{ kind: 'zoom', targetId }`.
- **Cadrage** : rect de la cible → vue qui la centre avec 10 % de marge, zoom borné à [1,05 ; 4]
  (jamais exactement 1, sinon `tx` est écrasé). Le canvas n'est pas redessiné au zoom : au-delà de
  2 × l'encre pixellise, c'est accepté pour ce lot.
- **Animation** : `animateView(target, 300 ms)` par `requestAnimationFrame` avec interpolation de
  `{ zoom, tx, ty }` et courbe ease-out ; annulée par tout `pointerdown` sur la scène (pincement,
  stylo) ; 120 ms si `prefers-reduced-motion`.
- **Retour** : la vue précédente est mémorisée dans une ref ; un tap sur la scène **hors d'un
  bouton** (ni `.is-playable`, ni zone) ramène à cette vue, animé. `Ctrl+0` et « Vue entière »
  font pareil. Un second `zoomTo` pendant un zoom remplace la cible sans empiler.

## 4. Déplacer une cible, animé

- **État de séance** : 7ᵉ champ `moved: Record<string, { dx: number; dy: number }>` dans
  `RevealState`, à ajouter dans `EMPTY_REVEAL`, `emptyReveal`, `loadRevealState`, `recoverPage`.
- **Actions** (famille « Déplacer », icône ↗) :
  - `moveTo` : la cible va à un point de la page, `params: { x, y }` (coin haut-gauche visé). Dans
    la bulle, « Choisir la destination… » ouvre un bandeau « Touchez l'endroit où la cible doit
    aller » ; un fantôme de la cible suit le doigt, le tap fixe le point.
  - `moveBy` : décalage `params: { dx, dy }` par quatre flèches et un pas (25, 50, 100 unités),
    utile pour « avancer d'un cran » à chaque tap.
  - `moveBack` : retour à la position du document (efface `moved[id]`).
- **Rendu** : `transform: translate(dx·scale, dy·scale)` sur le cadre, combiné à la rotation, avec
  `transition: transform 400 ms ease-out` posée seulement quand `moved` change en lecture (pas en
  édition, où le déplacement est instantané). Le tap suit le cadre transformé. `objectRect` ne
  bouge pas : le lasso et le menu contextuel restent sur la position du document, c'est voulu.
- Canvas : jamais (état de séance). `reset` efface `moved` de la page via `recoverPage`.

## 5. Modèle : ce qui change dans les types

```ts
// lib/boardObjects.ts
export type InteractionAction = … | 'window' | 'zoomTo' | 'moveTo' | 'moveBy' | 'moveBack';
export interface Interaction {
  action: InteractionAction;
  targetId?: string;
  params?: { pageId?: string; x?: number; y?: number; dx?: number; dy?: number };
  once?: boolean;
}
// familles ajoutées : content (🗔 Contenu : window), view (🔍 Vue : zoomTo), motion (↗ Déplacer : moveTo, moveBy, moveBack)

// lib/boardReveal.ts
export type InteractionEffect = … | { kind: 'window'; targetId: string } | { kind: 'zoom'; targetId: string };
// moveTo / moveBy / moveBack modifient l'état (state.moved), pas d'effet.
```

`fireInteractions` gagne un `case` par action ; le `default` ne sert plus qu'aux commandes de
widget et de son. `actionsFor` : `window` sur une fenêtre, `zoomTo` et les trois déplacements sur
tout objet visible sauf une fenêtre et un connecteur.

## 6. Fichiers touchés

| Fichier | Changement |
|---|---|
| `lib/boardShapes.ts` | `hotspot`, entrées « Zone », « Zone ovale », « Zone libre » du catalogue, `simplifyContour(points)`. |
| `lib/boardMedia.ts` | `WindowObject`, union, `mediaRect`, `renderMediaObject` (carte en édition seulement… voir §7), libellé. |
| `lib/boardObjects.ts` | actions, familles, `params`, `actionsFor`, `describeInteraction` (« Déplacer vers (420, 310) »). |
| `lib/boardReveal.ts` | `moved`, effets `window` et `zoom`, `fireInteractions`, `recoverPage`, `loadRevealState`. |
| `lib/boardFile.ts` | chemins d'assets centralisés : image, cover, équation, fenêtre. |
| `lib/__tests__/boardReveal.test.ts`, `boardShapes.test.ts` | déplacements, effets, `simplifyContour`, `shapeContainsPoint` sur une zone. |
| `BoardObjectLayer.tsx` | rendu zone (édition / lecture), tap validé par le chemin, `translate` + transition, vue fenêtre fermée, double-clic fenêtre. |
| `objects/WindowView.tsx` (nouveau) | carte fermée sur la page. |
| `BoardWindowDialog.tsx` (nouveau) | modale de lecture et modale d'édition (deux modes du même composant). |
| `BoardInteractionBubble.tsx` | familles Contenu, Vue, Déplacer ; choix de destination ; flèches et pas pour `moveBy`. |
| `Whiteboard.tsx` | `animateView`, `zoomToObject`, retour au tap, `openWindow`, bandeau « Touchez la destination », tracé « Zone libre », menu contextuel « Zone cliquable », insertion « Fenêtre ». |
| `BoardShapeToolbar.tsx` | réglages grisés sur une zone. |
| `wb-theme.css` | classe `.wbwin` ajoutée aux modales thématisées. |

Aucune migration. Mobile non concerné.

## 7. Découpage et ordre

1. **Modèle + moteur + tests** : actions, `params`, `moved`, effets, `simplifyContour`.
2. **Zones cliquables** : drapeau, rendu, tap par chemin, catalogue, menu contextuel, tracé libre.
3. **Déplacer** : rendu `translate` + transition, bulle (destination, flèches), `reset`.
4. **Zoom** : `animateView`, cadrage, retour au tap.
5. **Fenêtre** : type, carte, modale de lecture, modale d'édition, insertion, export `.gcboard`.
6. Vérification navigateur sur le brouillon : image + trois zones (rectangle, ovale, libre), fenêtre
   sur une zone, zoom sur une autre, déplacement sur la troisième, remise à zéro.

Estimation : cinq à six sessions. La fenêtre est le morceau le plus lourd (un type complet) ; elle
vient en dernier pour que zones, zoom et déplacement soient utilisables avant.

## 8. Points à valider avant de coder

1. **Zone à contour libre** : deux chemins proposés, « Zone libre » du catalogue (tracé brut
   simplifié) et forme reconnue au stylo puis passée en zone. Garder les deux, ou seulement le
   second (plus simple, mais le contour est redressé) ?
2. **Fenêtre invisible en lecture** : la carte ne s'affiche qu'en édition ; en classe, seule
   l'action l'ouvre. Alternative : la carte reste visible et s'ouvre aussi au tap direct. Je
   propose invisible, c'est le schéma qui porte les zones.
3. **Zoom au-delà de 2 ×** : l'encre et les images de fond pixellisent (les canvas ne sont pas
   redessinés). Accepter pour ce lot, ou plafonner le zoom automatique à 2 × ?
4. **Déplacer : hit-test** : le tap suit l'objet déplacé, mais le lasso et le menu contextuel
   restent sur la position du document. Acceptable en séance ?
5. **Texte de la fenêtre** : éditeur riche des zones de texte (gras, couleur, listes), ou un simple
   texte brut ? Je propose l'éditeur riche, déjà écrit.

## 9. Décisions prises le 20/09/2026

| # | Question | Décision |
|---|---|---|
| 1 | Contour libre | **Les deux** : « Zone libre » du catalogue (tracé brut simplifié) et forme reconnue au stylo passée en zone. |
| 2 | Fenêtre en lecture | **Invisible**, ouverte uniquement par l'action. |
| 3 | Zoom au-delà de 2 × | **Accepté** (pixellisation de l'encre tolérée). |
| 4 | Lasso et menu sur un objet déplacé | **Acceptable** : ils restent sur la position du document. |
| 5 | Texte de la fenêtre | **Éditeur riche** des zones de texte. |

## 10. Livraison (20/09/2026)

Lot B livré en un commit sur `feat/tableau-formes-connecteurs`, conforme au plan avec ces écarts :

- **Animation de vue écrite directement sur l'élément** `.wb__view` (transformation CSS image par
  image, `will-change` le temps de l'animation), l'état React n'étant posé qu'à la fin : un rendu
  du tableau coûte ~200 ms, trop pour 60 images / s. Sur l'instance Chrome de test, une image
  transformée coûte ~1 s (trois canvas de 2220 × 3199 sans composition GPU apparente) : le zoom y
  saute à la vue finale au lieu de glisser. **À vérifier sur le TBI et le portable de Thomas** ;
  le même coût touche déjà le pincer-zoomer.
- Retour du zoom : tap sans déplacement, hors bouton et hors commande, en lecture ; aussi `Ctrl+0`
  et « Vue entière » (entrée radiale) quand un zoom de bouton est actif.
- Action par défaut d'une nouvelle étape : basculer si permis, sinon la première action possible
  (une fenêtre : ouvrir).
- Tap sur une zone ovale ou libre validé par `shapeContainsPoint` (tolérance 4 unités) ; un
  rectangle se contente de sa boîte.
- La fenêtre ne s'ouvre qu'en lecture ; « Tester » depuis la bulle l'ouvre aussi (effet joué).
- Vérifié dans le navigateur sur le brouillon : catalogue avec « Zone cliquable », « Zone ovale »,
  « Zone libre » ; zone ovale posée par glisser (badge « zone », pointillé), reliée en `zoomTo`
  (familles Visibilité / Vue / Déplacer) ; tap au centre = zoom (échelle 2,29), tap au coin de la
  boîte hors ellipse = rien, tap hors bouton = retour ; `moveBy` +50 sur un post-it (translation
  animée, badge « ⚡ 2 ») ; fenêtre insérée par le menu Insérer, éditée (titre, texte gras),
  reliée à un bouton (seule action « Ouvrir »), ouverte au tap avec titre et texte. Tests
  vitest : 49 ; tsc et eslint propres.
- Non testé en direct : tracé « Zone libre » au doigt, « Zone cliquable » par le menu contextuel
  d'une forme reconnue, `moveTo` avec choix de la destination, image dans la fenêtre, export
  `.gcboard` avec une fenêtre.
