# Quelle plus-value pour quel contenu

Le tableau ne recopie pas la fiche : il montre ce que le papier ne sait pas montrer. Pour chaque
moment d'une séance de SVT, ce qui apporte vraiment quelque chose, et comment le faire
**aujourd'hui** avec `gc_ecrans.py` — ou ce qu'il faudra ajouter à l'app.

État de l'app au 15/11/2026 (lot A livré) : boutons et zones cliquables, enchaînement
« Suivant », objets cachés au départ, déplacements animés (0,4 s, en ligne droite), zoom sur une
zone, rideaux, tickets à gratter, textes à trous, fenêtres, flèches accrochées, dessins de la
bibliothèque, minuteur, dé, roue, vidéo, page web. Depuis le 16/11/2026 : **animations** (scène
HTML dessinée et animée, étapes pilotées par les boutons du tableau). Pas encore : 3D, graphique
de données, simulation à curseur, glisser-déposer élève, vote.

## Le moment de la séance → ce qui marche

| Moment | Plus-value | Aujourd'hui (`gc_ecrans`) | Plus tard |
|---|---|---|---|
| Ouverture, problématique | Découvrir la question ensemble ; susciter une hypothèse | `titre` + `ecran().rideau()`, `vrai_faux` sur les représentations initiales | Vote par cartes (phase 4) |
| Situation de départ | Une image forte en grand, une citation, l'actualité | `document(image=…)`, `loupe` sur un détail, `video` | — |
| Consigne | Étapes numérotées, temps visible | `consigne(…, minuteur=600)`, `coup_de_pouce` | — |
| **Processus dans le temps** (mitose, subduction, digestion, éruption, germination, dérive) | Voir les étapes s'enchaîner, revenir en arrière | **Une animation** (`gc_animation` + `e.animation(code)`) : c'est ce que Thomas attend (16/11/2026). `etapes` pour une simple suite de textes ; jamais des images qui glissent à la place d'une animation | — (Thomas réécrit titres et légendes lui-même : double-clic sur l'animation, panneau « Étapes ») |
| **Structure** (cellule, cœur, cerveau, fleur, globe, œil) | La légender devant la classe, désigner une partie | `schema` (étiquettes une à une), `schema(mode='toucher')`, `loupe` | Visualiseur 3D manipulable (lot B puis 3c) |
| **Données** (séismes, CO₂, températures, croissance) | La courbe qui se trace, lire une valeur | Image du graphique + `loupe` + révélation des lectures (`question`) | Module graphique animé (lot B) |
| Expérience, modèle | Montrer le montage, faire varier un facteur | `dessin` (verrerie), étapes du protocole, résultats sous rideau | Simulation à curseur (lot B) |
| Classer, trier, associer | Les élèves viennent placer les étiquettes | Étiquettes et `fleche` révélées une à une | Glisser-déposer avec zones (lot D) |
| **Idée fausse** (vigilances, `svt-cycle4.md` § 2) | La faire dire, puis la réfuter | `vrai_faux` (verdict + explication), `qcm` | Vote façon Plickers (phase 4) |
| Correction d'une question | La réponse attendue, par morceaux ; les erreurs fréquentes | `question` (réponses sous rideau), `tableau` (une ligne par toucher), `calcul` | — |
| Correction d'un schéma | Les légendes apparaissent une à une | `schema` avec l'image de la fiche | — |
| Différenciation | Une aide sans arrêter la classe | `coup_de_pouce`, `fenetre` + `bouton` | — |
| Navigation de la correction | Aller directement à la question 3 | `sommaire(…, position=1)` | — |
| Bilan | Le texte à trous complété par la classe | `bilan` + `e.trou()`, en rouge | — |

## Les manques, dans l'ordre où les ajouter

Ordre **proposé** par Claude le 15/11/2026, A (fait) puis B, C, D — **pas encore confirmé par
Thomas** : il avait décidé le même jour « l'animation d'abord » parmi les phases 2 à 4, et B passe
avant l'animation native (C). Lui faire trancher avant de commencer B.

- **B. Objet « module »** : une page HTML écrite par Claude, enfermée (iframe sandbox, sans
  accès à l'app), commandée par les boutons du tableau (« étape suivante »). **Commencé le
  16/11/2026 par l'objet « Animation »** (`PLAN_animations_tableau.md`, lot 1 : lecture et
  pilotage ; le code vit dans l'écran, sans fichier ni changement de `depot-cours`). Restent :
  banques de dessins par thème (lot 4) ; puis la 3D (three.js, à embarquer : le cadre n'a pas accès au réseau), les
  graphiques animés et les simulations, au format déjà validé par Thomas (« Voir sous nos
  pieds », globe de « Terre en mouvement »).
- **C. Animation par étapes native** (phase 2 de `PLAN_vision_suite.md`) : les objets du tableau
  ont une position par étape, « Suivant » les fait glisser ; Thomas peut retoucher sans Claude.
- **D. Glisser-déposer avec zones de réponse** (lot D de `IDEES_actions_tableau.md`).

## Limites connues du lot A (vérifiées dans l'app le 15/11/2026)

- Une flèche accrochée à un objet **ne suit pas** un objet déplacé par un bouton (le déplacement
  est un état de séance, pas une modification de l'objet) : ne pas accrocher de flèche à ce qui
  bouge.
- Les boutons ne réagissent qu'avec l'outil de sélection, pas avec le stylo actif.
- Les dessins de la bibliothèque sont des pictogrammes simples (le volcan est un triangle) :
  bien pour légender un principe, insuffisants comme illustration principale ; préférer une image.
- Le texte d'un bouton est centré et en gras : 50 caractères au plus sur 740 de large en 22.
