# Plan — Animations dans le tableau

Demande de Thomas, le 16/11/2026, après la première séance jouée avec un tableau (3e D, correction
« Patiente 2, Mme Eve Amalle ») : le frottis cliquable a plu, mais les « animations » faites
d'images que des boutons déplacent « ne vont pas du tout ». Il attend la qualité du fichier
« Comment les anticorps nous défendent-ils ? » (HTML autonome : scène vectorielle redessinée à
chaque image, dix étapes, légende), mais **intégrée au tableau**, et **facile à réécrire après
coup** (« il y aura toujours des trucs à personnaliser d'une activité à l'autre »).

C'est le lot B de `.claude/skills/tableau-seance/plus-value.md` (« objet module »), commencé par le
cas le plus demandé. Phase 2 de `PLAN_vision_suite.md` (l'animation d'abord).

## 1. Principe

Un nouvel objet du tableau, **« Animation »** (`type: 'animation'`, `lib/boardAnimation.ts`) :

- son **code HTML vit dans l'objet** (`code`, 300 000 caractères au plus). Il suit la page :
  copies posées sur un cours, versions, annuler / rétablir. Ni fichier, ni changement du stockage,
  ni changement de la fonction `depot-cours` ;
- il est joué dans un **cadre isolé** : `sandbox="allow-scripts"` (origine opaque : ni session, ni
  stockage, ni accès à la page) et une politique de contenu qui interdit tout réseau. Le code
  d'une animation ne peut rien lire ni rien envoyer ;
- **pas de barre ni de boutons à lui** : il se pose sur l'écran comme une image. En classe, le
  pointeur ne lui parvient pas (on écrit par-dessus) ; ce sont les **boutons du tableau** qui le
  pilotent — actions « Étape suivante », « Étape précédente », « Rejouer l'étape » ;
- l'**étape en cours** est un état de séance (`RevealState.steps`), gardé et remis à zéro comme le
  reste (rideaux, objets déplacés).

### Contrat « gc-anim » (version 1)

Un HTML qui le suit se pilote étape par étape ; un HTML quelconque est joué tel quel (une seule
étape, pointeur transmis en classe).

- étapes déclarées dans
  `<script type="application/json" id="gc-anim">{"version":1,"ratio":1.9,"steps":[{"id","title","caption"}]}</script>`
  — **les textes sont séparés du dessin** : c'est ce bloc que le lot 2 fera modifier sans code ;
- messages reçus : `{ gc:'anim', cmd:'init'|'goto', step }`, `replay`, `play`, `pause`, `toggle` ;
- message émis au chargement : `{ gc:'anim', ev:'ready', steps }`.

Côté fabrication (skill `cours-gestion-classe`) : `gc_animation.py` assemble le gabarit, le lecteur
(`animation/lecteur.js`), les outils de dessin, une **banque de dessins par thème**
(`animation/banque/immunite.js`) et la scène (`GC.play({ id: { dur, draw(t) } })`).
`gc_ecrans` : `e.animation(code)` pose un écran entier avec ses trois boutons.

## 2. Lots

| Lot | Contenu | État |
|---|---|---|
| 1 | Objet « Animation » : lecture, pilotage par les boutons, insertion d'un fichier HTML (Insertion › Médias), contrôle `screens:check`, générateur ; animation des anticorps reprise sur le lecteur | en ligne depuis le 16/11/2026 (PR #110) |
| 2 | Retoucher sans code : panneau « Étapes » (titre, légende avec mots clés en gras, masquer, ordre, aperçu de l'étape) ouvert par un double-clic, le bouton « Étapes » de la barre ou le clic droit ; onglet « Code » (fichier entier, remplacement par un autre fichier) | fait le 16/11/2026 |
| 3 | `/classe` et téléphone (l'étape suit sur l'afficheur), image de l'animation dans les vignettes et l'export PDF (aujourd'hui : une carte « ▶ Animation ») | à faire |
| 4 | Banques de dessins par thème (géologie, cellule, digestion…), règle « un mécanisme = une animation » dans le procédé « tableau de séance » | banque « immunité » faite, le reste au fil des tableaux |

## 3. Vérifié

Lot 1 :

- `npx tsc -b`, tests (modèle, état de séance, contrôle des écrans, générateur).
- Dans l'application (cours d'essai, mode « En classe ») : « Suivant » × 3 amène à l'étape 4 / 10,
  « Précédent » et « Rejouer » répondent, l'étape est gardée dans l'état de séance ; insertion d'un
  fichier HTML par le ruban (animation + trois boutons), annulation.
- Hors de l'application : les dix étapes photographiées (`gc_animation.apercu`), et l'animation
  jouée dans un cadre isolé identique (sandbox + politique de contenu).

Lot 2, dans l'application (cours d'essai, mode Tableau) : titre réécrit, légende complétée, étape
montée d'un rang, étape masquée, « Enregistrer » ; le bloc de données relu dans l'écran porte les
quatre retouches ; Ctrl+Z revient à l'état d'avant en un seul pas ; onglet « Code ». La barre d'un
objet qui occupe l'écran ne passe plus derrière le ruban.

## 4. À faire par Thomas, à savoir

- Essayer sur le TBI : lisibilité des étiquettes de la scène (le cadre fait 960 sur 1000 de large),
  rythme des étapes.
- L'animation est posée sur l'original de la correction « Mme Eve Amalle » (écran de la question 7)
  depuis le 16/11/2026.
- Une retouche faite dans une copie posée sur un cours ne remonte pas dans l'original, et
  inversement : chaque écran porte son propre code.
- Le cours « Essai — animation des anticorps (à supprimer) » (niveau Autre, chapitre Essais) est
  dans « Mes cours » : à supprimer après l'essai.
