# À LIRE EN PREMIER — Claude Code

Tu implémentes un **reskin complet du tableau blanc** de `Qwetsh/gestion-classe` (branche `master`,
app dans `gestion-classe-web/`). Le design est fait, spécifié et déjà écrit en CSS contre les vrais
sélecteurs du dépôt. Ton travail est de **poser le patch, faire les retouches TSX que le CSS ne peut
pas couvrir, et ajouter le markup manquant** — pas de redessiner.

## Ordre de lecture

1. **Ce fichier** — la commande, les garde-fous, l'ordre des étapes.
2. `wb-theme.css` — le patch. C'est lui qui fait 80 % du travail.
3. `README.md` — la spécification des six lots (A→F) : chaque décision, chaque valeur, et pourquoi.
   Les sections **§ 8** (correspondance réelle des sélecteurs) et **§ 9** (les 5 retouches TSX) sont
   celles qui te concernent directement.
4. `theme.ts` — les tokens, source unique DOM ↔ canvas.
5. `Tableau blanc - canevas.dc.html` — les maquettes. **Référence visuelle uniquement**, pas du code
   à copier : c'est un fichier HTML autonome, il n'a rien à voir avec l'architecture de l'app.
   Ouvre-le dans un navigateur pour voir à quoi doit ressembler le résultat. Les blocs sont
   numérotés `1a` (lot A) à `6a` (lot F), le plus récent en haut.

---

## Contexte produit — à ne pas perdre de vue

C'est un **tableau blanc pour TBI**, utilisé debout, devant une classe de collège, avec un stylet ou
au doigt, projeté sur un écran que les élèves du fond regardent à six mètres. Ce n'est pas une app de
bureau. Trois conséquences qui expliquent presque toutes les valeurs du patch :

- **Les cibles sont grandes** : 60 px sur la barre principale, 52 px sur la rangée secondaire,
  44 px partout ailleurs. Ne les réduis jamais pour « gagner de la place ».
- **Le texte est grand** : 34 px plancher sur la page, 17 px plancher absolu pour une étiquette.
- **Rien n'interrompt le cours** : aucune boîte de dialogue, aucune confirmation. Le destructif agit
  puis propose « Annuler » pendant 8 s.

La direction visuelle s'appelle **« papier posé sur ardoise »** : la page est la seule surface claire
de l'écran, tout le chrome recule dans un graphite dense. L'outil actif est le **seul élément blanc
du chrome** — c'est ce qui permet de le repérer d'un coup d'œil depuis le fond de la salle. Si tu
dois arbitrer sur un détail non spécifié, tranche dans ce sens.

---

## Étape 1 — Poser le patch (5 minutes, aucun risque)

```bash
cp wb-theme.css gestion-classe-web/src/components/classroom/wb-theme.css
```

Puis une seule ligne dans `gestion-classe-web/src/components/classroom/Whiteboard.tsx`, avec les
autres imports :

```ts
import './wb-theme.css';
```

**Ne touche pas aux blocs `const CSS = \`…\`` des composants.** Ils sont injectés en `<style>` au
rendu, donc après une feuille de `<head>` ; le patch gagne par la spécificité (sélecteur doublé
`.wbm.wbm`, ou ancêtre `.wb …`), sans un seul `!important`. C'est volontaire : le reskin se retire
en supprimant l'import, et les composants restent lisibles. Si une règle ne prend pas, **augmente la
spécificité dans `wb-theme.css`** — ne va pas éditer le bloc d'origine.

Vérifie visuellement à ce stade : le plateau doit passer au graphite, la barre doit s'arrondir,
l'outil actif doit devenir blanc. Si ce n'est pas le cas, l'import n'est pas pris.

## Étape 2 — Les polices

Deux familles libres, à **embarquer** (le réseau du collège filtre les CDN — aucun `<link>` vers
Google Fonts) :

| Famille | Usage | Fichier attendu |
|---|---|---|
| Atkinson Hyperlegible Next | tout ce qui se lit | `public/fonts/AtkinsonHyperlegibleNext-Variable.woff2` |
| Space Grotesk | chiffres tabulaires (minuteur, tirage, sonomètre, numéros de page) | `public/fonts/SpaceGrotesk-Variable.woff2` |

Les `@font-face` sont **déjà dans `wb-theme.css`** et pointent sur ces deux chemins : il te suffit de
déposer les fichiers. Les deux sont sous licence SIL OFL. Si tu n'obtiens que des fichiers statiques
au lieu des variables, adapte les `@font-face` en conséquence (et dis-le dans ton compte rendu).

Sans ces fichiers, tout retombe sur Inter et **la lisibilité à six mètres est perdue** : c'est la
raison d'être du choix typographique, pas une préférence esthétique.

## Étape 3 — Les 5 retouches TSX

Détaillées en **§ 9 du README**. Résumé, par ordre d'importance :

1. **`BoardRadialMenu.tsx` — géométrie TBI.** Remplacer `INNER = 44`, `OUTER = 150`, `LABEL_R = 100`
   par `58`, `214`, `148`. Les décalages de libellé `ly - 10` / `ly + 16` passent à `ly - 16` /
   `ly + 24`. Le `GAP` de 2° est déjà bon. C'est une homothétie ×1,6 de la géométrie de
   `WebRadialMenu.tsx` (le menu radial élève de la PWA) : garde ce rapport si tu dois ajuster.
2. **`Whiteboard.tsx` — classe `is-drawing`.** Poser la classe sur `.wb` au `pointerdown` du tracé,
   la retirer au `pointerup`. C'est ce qui fait reculer la barre à 40 % pendant l'écriture. Une
   opacité, pas une translation : pas de relayout au-dessus de l'encre pendant le geste.
3. **`Whiteboard.tsx` — classe `wb__group--session`.** À ajouter sur le dernier `.wb__group` de la
   barre (recherche, ressources, clavier, réglages, fermer) : c'est la grappe atténuée à 52 px.
   L'ordre des grappes est **encre → créer → page → séance** et ne doit jamais changer.
4. **`BoardKeyboard.tsx` — accents.** Ajouter É È À Ç à la rangée principale. Aujourd'hui ils sont
   absents ; ils ne doivent pas se retrouver derrière un appui long.
5. **`BoardTextToolbar.tsx` — seconde rangée repliable** derrière un bouton « … » : exposant, indice,
   casse, retraits, texte à trous. Facultatif — sans elle la barre reste sur une rangée plus longue,
   ce qui est acceptable. Fais-le en dernier.

## Étape 4 — Le markup manquant (lot F)

Le patch fournit déjà `.wb-skel`, l'anneau de focus et `prefers-reduced-motion`. Restent à écrire,
tous spécifiés au **lot F du README** :

- **État vide de page** : deux lignes centrées en `--wb-grid-major`, « Écrivez. » puis « Deux doigts
  pour les outils. » Ni illustration, ni bouton. Elles disparaissent au premier trait.
- **Squelettes de chargement** : classe `.wb-skel` sur les blocs en attente, à la forme du contenu.
  Jamais de spinner plein écran, jamais rien au-dessus de la page.
- **Erreurs à trois niveaux** : pilule « Hors ligne » au bord bas · carte « Enregistrement
  impossible » ancrée en haut à droite · échec d'objet **dans** l'objet. Aucun modal.
- **Barre « Annuler » 8 s** après une action destructive, à la place de toute confirmation.
- **Premier lancement** : trois bulles ancrées, affichées simultanément, que le premier
  `pointerdown` sur la page fait toutes disparaître. Pas de séquence, pas de « suivant ».

Micro-copie : vocabulaire du métier (**page, séance, classe** — jamais « board », « slide »,
« canvas », « workspace »), infinitif pour les actions, aucune excuse, aucun emoji, une phrase par
message. Le tableau avant/après est en **§ F.6**.

## Étape 5 — Le canvas (optionnel, plus profond)

Pas encore fait et pas couvert par le patch : `lib/boardRender.ts`, `boardShapes.ts` et
`boardText.ts` dessinent en canvas et n'ont donc aucune idée du CSS. Pour que **l'écran, les
vignettes et l'export PDF restent identiques**, ils doivent lire les mêmes valeurs que le DOM :

- Importer `theme.ts` (fourni) et y prendre les couleurs de fonds de page (`grid`, `gridMajor`,
  `seyes`, `seyesMarge`), les encres, les épaisseurs `[3, 6, 10, 16]`, le plancher de 34 px.
- Le rendu « fait main léger » des formes (`handDrawnJitter: 1.5`) doit être **déterministe**,
  seedé par l'id de l'objet — sinon la forme change entre l'écran, la vignette et le PDF.

Traite cette étape séparément et seulement après que le reste soit en place.

---

## Garde-fous

- **Ne réduis aucune cible tactile** sous 44 px, ni le texte de page sous 34 px.
- **N'ajoute aucune boîte de dialogue de confirmation**, même pour supprimer.
- **Pas de `backdrop-filter`, pas de `filter: blur` large** au-dessus de `.wb__stage` : coût GPU
  pendant le tracé et bavure au vidéoprojecteur. Trois ombres nettes existent, elles suffisent.
- **Rien ne s'anime entre la pointe du stylet et l'encre.** Encre, gomme et laser ne sont jamais
  différés, jamais transitionnés.
- **Deux accents seulement** : indigo `#4F46E5` pour la sélection et l'état, orange `#F97316` pour
  l'action et les moments. L'indigo n'est jamais une action, l'orange n'est jamais une sélection.
  Ils sont hérités de `--color-primary-dark` et `--accent` de l'app : ne les redéfinis pas.
- **Ne touche pas à `src/index.css`** ni aux variables globales de l'app. Tout le reskin est scopé
  au tableau.

## Compte rendu attendu

À la fin, liste : ce qui est posé, ce qui a dû être adapté et pourquoi, ce qui reste. Signale
explicitement toute règle du patch qui n'a pas pris (sélecteur qui a changé depuis le relevé du
11/09/2026) plutôt que de la contourner en douce avec un `!important`.
