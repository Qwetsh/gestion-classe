# Plan — Actions des boutons, lot A : séquences et actions sans nouvel objet

Rédigé le 20/09/2026 à partir de `IDEES_actions_tableau.md` (décisions §7 et §9) et d'une lecture
du code (`lib/boardReveal.ts`, `lib/boardObjects.ts`, `BoardInteractionBubble.tsx`,
`Whiteboard.tsx`, `objects/WidgetView.tsx`, `objects/AudioView.tsx`). Aucune ligne de code n'est
écrite : ce document sert à valider les choix avant de coder.

## 0. Ce que le code sait déjà faire (et qui conditionne le plan)

| Point | État actuel | Fichier |
|---|---|---|
| Modèle | `interactions: { targetId: string; action: 'show' \| 'hide' \| 'toggle' }[]` sur tout objet ; `hidden` sur la cible. | `lib/boardObjects.ts:50-58` |
| Moteur | `fireInteractions(state, trigger, objects)` : fonction pure, écrit `state.shown[targetId]`. `isObjectVisible = shown[id] ?? !hidden`. | `lib/boardReveal.ts:94-110` |
| État de séance | `RevealState { pages, objects, gaps, shown, unfolded? }`, un seul state React pour tout le tableau, persisté en localStorage par `sessionId`. Aucune remise à zéro automatique ; `recoverPage(state, page)` nettoie une page. | `lib/boardReveal.ts:35-78, 115-129` |
| Déclenchement | Tap capturé en `play` (stylo, affichage) → `onFire(id)` → `fireObject` → `setReveal(fireInteractions(...))`. | `BoardObjectLayer.tsx`, `Whiteboard.tsx:1562` |
| Réglage | ⚡ → `startLinking` → bandeau + flèche → `onTargetPicked` → `openBubble` → bulle (3 pastilles + « caché au début ») → `confirmBubble`. Tester = valider puis tirer. | `Whiteboard.tsx:1603-1664, 3390-3406` |
| Pages | `setPageIndex` appelé à cinq endroits avec les bornes recopiées ; pas de `goToPage`. Les pages ont un `id`. | `Whiteboard.tsx:339, 2616, 2724, 3383, 3531` |
| Caches / post-its | `revealObject(id, true \| null)` découvre / recouvre ; `unfoldInSession(id)` déplie en séance, **pas de repli de séance** (`collapsed` du document seulement). | `Whiteboard.tsx:1796, 2189` |
| Widgets | État de marche local au composant (`running`, `roll()`, `spin()`), aucune commande extérieure ; `onConfig` écrit dans le document (pas d'annulation souhaitée). | `objects/WidgetView.tsx` |
| Audio | `<audio controls>` natif sans ref ni commande. Vidéo YouTube en iframe sans API. | `objects/AudioView.tsx`, `EmbedView.tsx` |
| Canvas | Ne connaît pas `RevealState` : vignettes et export ignorent ce qu'un bouton a montré. Voulu. | `lib/boardRender.ts:437` |
| Tests | `boardReveal.test.ts` ne couvre que le rideau ; `fireInteractions` n'est pas testé. | `lib/__tests__` |

Deux règles héritées : **l'état de séance ne s'écrit jamais dans le document** (sinon pas
d'annulation et tableau préparé sali), et **le double rendu DOM / canvas** n'est pas concerné par
ce lot (aucun nouvel objet, aucun nouveau visuel de page).

## 1. Modèle : une séquence d'actions typées, sans migration

```ts
// lib/boardObjects.ts
export type InteractionAction =
  | 'show' | 'hide' | 'toggle'        // visibilité (existant)
  | 'reveal' | 'cover'                // cache de la cible : découvrir / recouvrir
  | 'unfold' | 'fold'                 // post-it de la cible : déplier / replier (séance)
  | 'goto' | 'next' | 'prev'          // pages ; goto : params.pageId
  | 'play' | 'pause' | 'playToggle'   // média audio de la cible
  | 'start' | 'stop' | 'startToggle'  // minuteur, sonomètre (cible widget)
  | 'roll'                            // dé, roue, tirage de groupes (cible widget)
  | 'reset';                          // page courante : recoverPage + arrêt des widgets

export interface Interaction {
  action: InteractionAction;
  /** Absent pour goto / next / prev / reset. */
  targetId?: string;
  params?: { pageId?: string };
  /** Ne se déclenche qu'une fois par séance (état dans RevealState.fired). */
  once?: boolean;
}
```

- **Compatibilité** : les objets existants ont `targetId` + `action` ∈ show/hide/toggle, ils
  restent valides sans conversion. `INTERACTION_LABELS` reste un `Record<InteractionAction, string>`
  exhaustif : le compilateur pointe chaque endroit à compléter.
- **Cible par type** : `actionsFor(target: BoardObject | null): InteractionAction[]` dans
  `boardObjects.ts` décide ce que la bulle propose. Sans cible : goto, next, prev, reset. Tout
  objet : show, hide, toggle. Objet avec `cover` : reveal, cover. Texte à fond coloré : unfold,
  fold. Audio : play, pause, playToggle. Widget timer / meter : start, stop, startToggle. Widget
  dice / wheel / groups : roll.
- **Pages par `id`** (`params.pageId`), jamais par index : `movePage`, `deletePage`,
  `insertPageAfter` ne cassent rien ; page supprimée = action ignorée (comme une cible disparue).
- `cloneObjects` remappe déjà `targetId` ; il remappe aussi `params.pageId` uniquement lors d'une
  duplication de page (même tableau, id de la copie), sinon inchangé.

## 2. Moteur : `fireInteractions` reste pur et rend des effets

```ts
// lib/boardReveal.ts
export type InteractionEffect =
  | { kind: 'page'; pageId: string }
  | { kind: 'pageDelta'; delta: -1 | 1 }
  | { kind: 'command'; targetId: string; command: 'play' | 'pause' | 'playToggle' | 'start' | 'stop' | 'startToggle' | 'roll' }
  | { kind: 'reset' };

export function fireInteractions(
  state: RevealState, trigger: BoardObject, objects: BoardObject[],
): { state: RevealState; effects: InteractionEffect[] }
```

- Dans l'ordre de `interactions[]` : les actions d'état (`show/hide/toggle` → `shown`,
  `reveal/cover` → `objects[id] = true` / supprimé, `unfold/fold` → `unfolded[id]` posé / retiré)
  modifient l'état ; les autres produisent un effet. **L'état d'abord, les effets ensuite** : un
  `goto` suivi d'un `show` agit bien sur la page de départ (pièges du rapport : `fireObject` lit
  `pageIndexRef`).
- `once` : `RevealState.fired: Record<string, true>` clé `${triggerId}:${index}` ; ignoré ensuite.
- `RevealState.unfolded` devient obligatoire dans `EMPTY_REVEAL`, `loadRevealState`, `recoverPage`
  **et** `recoverAll` (bug actuel : `recoverAll` l'oublie). `fired` suit la même règle.
- Pas de ré-entrance : un bouton ne déclenche jamais un autre bouton (aucune action « tirer »),
  donc pas de boucle possible. Profondeur 1 par construction.
- **Tests** (`boardReveal.test.ts`) : compat show/hide/toggle ; reveal/cover ; unfold/fold ; goto
  produit l'effet et ne touche pas l'état ; ordre état → effets ; cible disparue ignorée ; `once`
  ne rejoue pas ; `reset` produit l'effet ; `recoverAll` efface `unfolded` et `fired`.

## 3. Exécution des effets dans le tableau

`fireObject` (`Whiteboard.tsx:1562`) devient le seul exécuteur :

| Effet | Exécution |
|---|---|
| `page` | `goToPage(indexOf(pageId))` — **nouvelle fonction `goToPage(i)`** bornée, qui remplace les cinq `setPageIndex` recopiés (clavier, radial, rail, navigateur, effets). |
| `pageDelta` | `goToPage(pageIndexRef.current + delta)`. |
| `command` | `setCommands(c => ({ ...c, [targetId]: { command, at: Date.now() } }))` — **state React éphémère**, ni dans `RevealState` ni persisté (sinon un rechargement relancerait le minuteur). Passé à `BoardObjectLayer` → `WidgetView` / `AudioView` via une prop `command`. |
| `reset` | `setReveal(r => recoverPage(r, page))` + `stop` sur tous les widgets de la page + arrêt des audios. |

- **Widgets** (`WidgetView.tsx`) : prop `command?: { command; at }`, un `useEffect([command?.at])`
  par sous-widget qui appelle ce qui existe déjà en local : timer `setRunning`, dice `roll()`,
  wheel `spin()`, groups `draw()`, meter `start()/stop()`. Rien n'est écrit dans `config`.
- **Audio** (`AudioView.tsx`) : `useRef<HTMLAudioElement>` + même `useEffect` → `play()` /
  `pause()`. La vidéo YouTube est **hors lot** (API iframe à brancher, `enablejsapi`) ; la bulle
  ne propose pas play sur une vidéo.
- Le tap accidentel pendant l'écriture (`play` inclut le simple choix du stylo) : `reset` et `goto`
  sont les seules actions à conséquence ; on garde le comportement actuel, le prof place ces
  boutons volontairement. Pas de confirmation.

## 4. Bulle : deux niveaux, séquence visible

`BoardInteractionBubble.tsx` est réécrite (101 lignes aujourd'hui, ~250 après) :

```
⚡ Quand on touche le bouton, [Cible]        (ou « ce bouton », sans cible)
┌ Familles ──────────────────────────────────────────────┐
│ 👁 Visibilité  🎭 Cache  📌 Post-it  📄 Page  🔊 Média  ⏱ Outil │  ← seulement celles que la cible permet
└────────────────────────────────────────────────────────┘
  (○ Afficher  ○ Masquer  ● Basculer)                       ← actions de la famille
  ☐ caché au début de la séance                            ← seulement pour Visibilité
  Page cible : [ 1 · 2 · 3 · 4 ]                           ← seulement pour goto
  ☐ une seule fois
────────────────────────────────────────────────────────────
 Actions du bouton (3)                                       ← séquence existante
  1. Masquer · Question         ↑ ↓ ✕
  2. Afficher · Réponse         ↑ ↓ ✕
  3. Page suivante              ↑ ↓ ✕
────────────────────────────────────────────────────────────
 [Supprimer]  [▶ Tester]              [Annuler]  [Valider]
```

- Familles calculées par `actionsFor(target)` ; une seule famille = pas de première ligne.
- La séquence est celle du bouton entier, pas seulement l'interaction en cours ; ↑ ↓ ✕ écrivent
  dans le document (`patchObject`), comme aujourd'hui `removeInteraction`.
- **Tester** ne valide plus d'abord : il joue la séquence courante **avec** le brouillon, sans
  écrire, et sans exécuter les effets de page (sinon la bulle se démonte, piège du rapport). Un
  petit texte « (les changements de page ne sont pas joués) » quand la séquence en contient.
- Largeur 360 px, mêmes positions qu'aujourd'hui, `Escape` / `Enter` conservés.

## 5. Deux chemins d'entrée

1. **Avec cible (inchangé)** : ⚡ ou menu contextuel → bandeau « Touchez l'objet… » → tap sur la
   cible → bulle avec les familles permises par cette cible. Le flux validé par Thomas ne bouge pas.
2. **Sans cible (nouveau)** : le bandeau gagne un bouton **« Sans cible ▾ »** (page suivante,
   précédente, aller à la page…, réinitialiser la page) qui ouvre la bulle ancrée sur le bouton
   lui-même, sans passer par le choix. Le menu contextuel « Bouton et interactions » propose
   les mêmes entrées directement.

Ce second chemin est aussi celui qu'utilisera la banque d'événements (lot C) : action déjà
choisie, cible à toucher ou non.

## 6. Aperçu en édition

- Flèches fantômes (`ghostLinks`) : une par interaction **avec cible**, étiquette
  `INTERACTION_LABELS[action]`. Les actions sans cible n'ont pas de flèche ; elles apparaissent
  dans la pastille ⚡ du bouton sous forme de compteur (« ⚡ 3 »).
- Menu contextuel : une entrée par action de la séquence, `Afficher · Réponse`,
  `Aller à la page 3`, `Réinitialiser la page` ; ouvre la bulle sur cette ligne.
- Mode aperçu complet (jouer sans passer en lecture) : **hors lot**, rattaché au chantier
  « édition / en classe » (décision §9 des idées).

## 7. Fichiers touchés

| Fichier | Changement |
|---|---|
| `lib/boardObjects.ts` | `InteractionAction`, `Interaction`, `INTERACTION_LABELS`, `actionsFor`, `cloneObjects` (pageId). |
| `lib/boardReveal.ts` | `RevealState.fired`, `unfolded` obligatoire, `InteractionEffect`, `fireInteractions` → `{ state, effects }`, `recoverAll` corrigé (déplacé ici depuis Whiteboard). |
| `lib/__tests__/boardReveal.test.ts` | ~12 cas sur `fireInteractions` et la remise à zéro. |
| `components/classroom/BoardInteractionBubble.tsx` | Réécriture (familles, séquence, options). |
| `components/classroom/Whiteboard.tsx` | `goToPage`, `commands`, `fireObject` avec effets, bulle sans cible, bandeau « Sans cible », menu contextuel, `ghostLinks`, `onTest` sans validation. |
| `components/classroom/BoardObjectLayer.tsx` | Prop `commands` transmise aux vues widget / audio ; badge « ⚡ n ». |
| `components/classroom/objects/WidgetView.tsx` | Prop `command`, effets par sous-widget. |
| `components/classroom/objects/AudioView.tsx` | Ref + prop `command`. |
| `IDEES_actions_tableau.md` | Renvoi vers ce plan. |

Aucune migration, aucun changement du canvas, aucune modification du mobile.

## 8. Découpage et ordre

1. **Modèle + moteur + tests** (`boardObjects.ts`, `boardReveal.ts`) — indépendant de l'UI, compile
   avec l'UI actuelle grâce à `INTERACTION_LABELS` étendu.
2. **Exécution** (`goToPage`, `commands`, `fireObject`, widgets, audio).
3. **Bulle** en deux niveaux avec séquence.
4. **Chemin sans cible** (bandeau, menu contextuel) et aperçu (flèches, badge).
5. Vérification dans le navigateur sur le brouillon : bouton Réponse (rideau), Suite (page),
   Top chrono (minuteur), séquence de trois actions, une seule fois, réinitialiser.

Estimation : quatre à cinq sessions de travail. Le lot B (schéma cliquable) s'appuie sur 1 et 2.

## 8 bis. Livraison (20/09/2026)

Lot A livré en un commit sur `feat/tableau-formes-connecteurs`, conforme au plan avec ces écarts :

- Le miroir `revealRef` et les commandes `commands` (état éphémère, compteur `commandSeq`) vivent
  dans `Whiteboard.tsx` ; `fireObject(id, { draft, skipPages })` sert aussi à « Tester ».
- `reset` envoie aussi la commande `reset` à tous les widgets et sons de la page (minuteur remis,
  dé et roue effacés, sonomètre arrêté, son au début).
- Le tirage de groupes (`roll` sur le widget groupes) écrit les groupes dans le document, comme le
  bouton du widget : c'est le résultat qu'on garde.
- La bulle affiche la famille seulement s'il y en a plusieurs ; « caché au début » n'apparaît que
  pour Visibilité avec cible ; le choix de page est une rangée de numéros.
- Vérifié dans le navigateur sur le brouillon : bulle sans cible (page, remise à zéro), séquence
  « basculer + aller à la page 2 » jouée au tap (cible affichée, page 2), badge « ⚡ 2 »,
  annulation, bulle sur un minuteur (familles Visibilité + Outil), « Tester » qui lance le
  minuteur sans écrire. Tests vitest : 44 (dont 12 nouveaux), tsc et eslint propres.
- Non testé en direct : audio (lecture / pause), dé, roue, sonomètre, « une seule fois » au tap.

## 9. Points à valider avant de coder

1. **« Replier » un post-it par bouton** : nouveau champ de séance (`unfolded[id]` retiré). OK ?
2. **Vidéo hors lot** : play / pause seulement sur l'audio pour l'instant. OK ?
3. **Tester sans valider** : changement de comportement par rapport à aujourd'hui (où Tester
   écrit d'abord). Je propose de ne plus écrire. OK ?
4. **Nom des actions dans la bulle** : « Découvrir / Recouvrir » pour les caches, « Déplier /
   Replier » pour les post-its, « Lancer / Arrêter » pour le minuteur, « Tirer » pour dé, roue et
   groupes. À ajuster si un mot te parle mieux.
