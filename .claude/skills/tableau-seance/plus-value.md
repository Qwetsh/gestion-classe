# Quelle plus-value pour quel moment

Le tableau ne recopie pas la fiche : il montre ce que le papier ne sait pas montrer. Pour chaque
moment d'une séance de SVT, ce qui apporte vraiment quelque chose, et avec quel outil. Les animations
(animation, scène riche) ne sont jamais fabriqués sans l'accord de Thomas à leur numéro (voir
`SKILL.md`, § 3) : ils se **proposent** avec un storyboard.

## État de l'app (21/11/2026)

- **Écrans** (lot A, 15/11) : boutons et zones cliquables, « Suivant », objets cachés au départ,
  déplacements, zoom sur une zone, rideaux, tickets à gratter, textes à trous, fenêtres, flèches,
  dessins de la bibliothèque, minuteur, dé, roue, vidéo, page web.
- **Animations** (16/11) : scène HTML dessinée et animée, étapes pilotées par les boutons du tableau
  et le « Suivant » du téléphone ; légendes retouchables par Thomas (panneau « Étapes »).
- **Scènes riches** (21/11) : 3D three.js (modèles GLB qu'on fait tourner au doigt, caméra qui se
  déplace, étiquettes qui suivent le modèle), photos et sons joints, graphiques Chart.js.
- **Sites pilotables** (21/11) : une page qui suit le contrat « gc-anim » avance avec le tableau
  (l'hôpital virtuel : présentation du patient, correction de Docteur Morel).
- **Pas encore** : glisser-déposer par les élèves, vote façon Plickers.

## Le moment de la séance → ce qui marche

| Moment | Plus-value | écran / site sans code nouveau | animation à proposer (storyboard) |
|---|---|---|---|
| Ouverture, problématique | Découvrir la question ensemble ; susciter une hypothèse | `titre` + rideau ; `vrai_faux` sur les représentations initiales | — |
| Situation de départ | Une image forte, une citation, l'actualité ; un cas concret | `document(image=…)`, `loupe`, `video` ; site : hôpital `?presentation=<fiche>` (le patient en 3D, ses symptômes) | Scène 3D : le personnage de la situation, gros plans sur ce qui compte |
| Consigne | Étapes numérotées, temps visible | `consigne(…, minuteur=600)`, `coup_de_pouce` | — |
| **Processus dans le temps** (mitose, subduction, digestion, éruption, germination, dérive, réaction immunitaire) | Voir les étapes s'enchaîner, revenir en arrière | `etapes` pour une simple suite de textes | **Animation** (niveau anticorps) : c'est ce que Thomas attend pour un mécanisme |
| **Structure** (cellule, cœur, cerveau, fleur, globe, œil, squelette) | La légender devant la classe, la tourner, désigner une partie | `schema` (étiquettes une à une, ou au toucher), `loupe` | **Scène 3D** : modèle qu'on fait tourner, étiquettes qui suivent, gros plans par étape |
| **Observation au microscope** (frottis, levures, cellules) | Chercher, puis trouver ensemble | `loupe` sur la photo, frottis cliquable (a plu, 16/11) | **Photo animée** : la lame qui se rapproche, les cellules entourées une à une, avec leur vraie position (données de l'hôpital) |
| **Données** (séismes, CO₂, températures, croissance, analyses de sang) | La courbe qui se trace, lire une valeur, comparer au témoin | Image du graphique + `loupe` + lectures sous cache (`question`) | **Graphique** Chart.js qui se trace étape par étape ; barres patient / témoin qui montent |
| Expérience, modèle | Montrer le montage, faire varier un facteur | `dessin` (verrerie), étapes du protocole, résultats sous rideau | **Simulation** à curseur ; animation du montage |
| Classer, trier, associer | Les élèves viennent placer les étiquettes | Étiquettes et `fleche` révélées une à une | (glisser-déposer : pas encore dans l'app) |
| **Idée fausse** (vigilances, `svt-cycle4.md` § 2) | La faire dire, puis la réfuter | `vrai_faux` (verdict + explication), `qcm` | Animation qui montre pourquoi c'est faux |
| Correction d'une question | La réponse attendue, par morceaux ; les erreurs fréquentes | `question` (réponses sous cache), `tableau`, `calcul` ; site : hôpital `?correction=<id>` (Docteur Morel, avec les voix) | — |
| Correction d'un schéma | Les légendes apparaissent une à une | `schema` avec l'image de la fiche | Scène 3D légendée |
| Différenciation | Une aide sans arrêter la classe | `coup_de_pouce`, `fenetre` + `bouton` | — |
| Navigation | Aller directement à la question 3 | `sommaire(…, position=1)` | — |
| Bilan | Le texte à trous complété par la classe | `bilan` + `e.trou()`, en rouge | — |

## Ressources disponibles

**Hôpital virtuel** (`C:/dev/hopital-virtuel`, en ligne : `https://hopital-virtuel.vercel.app/`,
`gc_ecrans.HOPITAL`) — 3e, séquence 2 (système immunitaire) :

- Pages pilotables : `?presentation=<fiche>` (le patient, ses examens, sans les réponses) et
  `?correction=<id>` (Docteur Morel, répliques et voix ; ouverte quand le tableau l'affiche).
- Patients (fiches `content/patients/`) : **Eve Amalle** (`eve-amalle`, modèle `fille-fievreuse` :
  fièvre, gorge, ganglions, frottis, anticorps — mononucléose, A2 ; correction `eve`), **Yves Apabien**
  (`yve-apabien`, modèle `ado-fatigue` : main blessée, pus, phagocytose, frottis — première réaction
  immunitaire, A1 ; correction `yve`), **Eva Quesine** (`eva-quesine`, modèle `dame-agee` :
  vaccination, rappel, Pasteur — A4).
- Modèles 3D GLB (compressés meshopt, 0,1 à 0,9 Mo, `public/models/`) : les patients ci-dessus,
  `garcon`, `fille`, `nora`, `docteur-morel`, `infirmier` ; animaux `souris`, `poule`, `lapin`,
  `grenouille` ; `plante`. Les personnages ont un squelette (os `Head`, `RightHand`…) et des
  animations (`Walking`, `Armature|clip0|baselayer`).
- Photos : corps (`public/images/corps/` : gorge normale / angine, cou normal / ganglions, œil
  normal / rouge, tympan normal / otite ; repères des zones dans `content/corps.json`), lames
  (`public/images/lames/frottis-yve.jpg`, 260 µm de large, cellules repérées dans
  `content/lames/frottis-yve.json` ; `pus-yve.jpg`), frottis de mononucléose, radios, IRM et scanners.
  Crédits et licences : `docs/credits-images.md` de l'hôpital.

**Autres** : app « Terre en mouvement » (globe 3D, 4e ; source dans OneDrive, en ligne sur
Vercel — demander l'adresse à Thomas avant de l'intégrer), animation « Voir sous nos pieds »,
app « Le microbiote ». Ressources libres (3D, données) : `svt-cycle4.md` § 4.

## Ce qui reste à ajouter à l'app

- **Glisser-déposer avec zones de réponse** (lot D de `IDEES_actions_tableau.md`).
- **Vote façon Plickers** (phase 4 de `PLAN_vision_suite.md`).
- Des pages pilotables dans les autres sites de Thomas (Terre en mouvement…) : chantier à proposer.

## Limites connues (vérifiées dans l'app)

- Une flèche accrochée à un objet **ne suit pas** un objet déplacé par un bouton : ne pas accrocher
  de flèche à ce qui bouge.
- Les boutons ne réagissent qu'avec l'outil de sélection, pas avec le stylo actif.
- Les dessins de la bibliothèque sont des pictogrammes simples : bien pour légender un principe,
  insuffisants comme illustration principale ; préférer une image ou une animation.
- Le texte d'un bouton est centré et en gras : 50 caractères au plus sur 740 de large en 22.
- Une scène 3D interactive (`interactif=True`) prend le pointeur : on n'écrit plus par-dessus au
  stylet. La garder pour l'écran où l'on fait tourner le modèle.
- L'aperçu 3D local (Chrome sans carte graphique) est lent : `attente=25000`.
