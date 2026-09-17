# Tableau blanc — plan de refonte UX

> Rédigé le 11/09/2026. Fait suite à `PLAN_tableau_blanc.md` (phases 0-8 livrées) : les fonctions
> sont là, l'interface ne suit plus. Ce document = diagnostic, benchmark, principes, cible, phasage.
> Rien n'est codé ici.

---

## 1. Diagnostic de l'existant

Source : `gestion-classe-web/src/components/classroom/Whiteboard.tsx` (2 769 lignes, barre aux lignes 2431-2676).

### 1.1 La barre unique

Une seule `.wb__bar` affiche en permanence **≈ 38 contrôles** répartis en 8 grappes :

| # | Grappe | Contrôles | Fréquence d'usage réelle |
|---|--------|-----------|--------------------------|
| 1 | Outils | sélection, stylo, surligneur, gomme, texte, formes, laser (7) | toutes les 5-15 s |
| 2 | Couleur | 4 pastilles + « plus » + formes auto (6) | toutes les 30 s |
| 3 | Épaisseur | S / M / L (3) | quelques fois par heure |
| 4 | Historique | annuler, rétablir, effacer la page (3) | quelques fois par heure |
| 5 | Fond | blanc, quadrillage, lignes (3) | 1 fois par page |
| 6 | Créer | insérer▾, image, ouvrir, enregistrer, recouvrir, export PDF, tirage au sort (7) | 0-3 fois par heure |
| 7 | Pages | précédente, suivante, nouvelle, navigateur (4 + compteur) | quelques fois par heure |
| 8 | Séance | ressources, recherche, clavier virtuel, réglages▾, fermer (5) | 0-1 fois par heure |

**Le problème n'est pas le nombre d'outils, c'est qu'ils sont tous au même niveau visuel.**
« Stylo » (200 usages/heure) a exactement la même taille, le même contraste et la même distance
au stylet que « Enregistrer le tableau » (1 usage/semaine). Sur un TBI en cours, cela oblige à
*lire* la barre au lieu de *viser*.

### 1.2 Les autres symptômes

1. **Le tiroir fourre-tout.** Le popover Réglages (l. 2647-2668) mélange 11 items sans parenté :
   gestes à deux doigts, position de la barre, latéralité, fond de page, règle, équerre, rapporteur,
   projecteur, mode affichage, zoom, et… le menu radial. C'est le signe classique d'une architecture
   de l'information saturée : tout ce qui n'entrait plus a été poussé là.
2. **La meilleure interaction est cachée.** `BoardRadialMenu` (8 quartiers, geste sous les deux doigts,
   commentaire du fichier : « même géométrie que le menu radial élève ») est le composant le plus adapté
   au TBI — et il n'est atteignable que par un item enfoui dans Réglages ou un geste non découvrable.
   C'est l'innovation maison du produit (cf. `CLAUDE.md` : action en < 2 s) et elle ne sert pas ici.
3. **Duplication.** Le fond de page existe deux fois (3 boutons dans la barre + un `<select>` dans Réglages).
4. **Pas de personnalisation.** Les seuls réglages d'interface sont `bar` (bas/gauche/droite) et
   `hand` (gauche/centre/droite), stockés dans `localStorage` (`classroom-board-tbi`, l. 171) donc
   **perdus d'un appareil à l'autre** : le PC du prof et le TBI de la salle ne partagent rien.
   Aucun moyen de masquer ce qu'on n'utilise jamais (un prof de français n'a pas besoin du rapporteur ;
   un prof de maths ne touchera jamais au micro).
5. **Le menu « Insérer » est une liste plate de 20 items** (tableau, vidéo, site, lien, son, micro,
   post-it, équation, + 10 widgets) sans regroupement, sans recherche, sans récents.
6. **Ce qui marche déjà et qu'il faut généraliser** : `BoardTextToolbar` et `BoardShapeToolbar`
   *remplacent* les grappes 2-5 quand on sélectionne un texte ou une forme (l. 2455-2513). Le bon
   réflexe est déjà dans le code — il est juste appliqué à 2 cas sur 10, et dans la barre au lieu
   d'être près de l'objet.
7. **Le mode affichage existe** (`displayMode` masque toute la barre) : la brique « écran propre pour
   la classe » est là, elle n'est pas exploitée comme état de premier rang.

---

## 2. Benchmark — ce que font les autres

| Produit | Ce qu'on retient |
|---------|------------------|
| **SMART Notebook** | La barre est **personnalisable** : un engrenage ouvre une fenêtre « outils affichés / outils disponibles », le prof compose sa barre. C'est le standard du marché depuis 15 ans et la première demande des enseignants. |
| **ActivInspire** | Même idée (« toolboxes » personnalisées) mais reproche récurrent : *trop* d'onglets aux fonctions combinées, les nouveaux se perdent. Personnalisation ≠ empilement : il faut un défaut sobre. |
| **tldraw / Figma / Freeform** | Découpage en **zones** : outils en bas au centre, propriétés du sélectionné dans un panneau contextuel, navigation en bas à gauche, menu en haut à gauche. Le *style panel* n'affiche que ce qui concerne la sélection courante ; barre contextuelle posée **au-dessus de l'objet**. |
| **Classroomscreen** | Les widgets (minuteur, dé, roue, sonomètre, feu tricolore…) ne vivent pas dans une barre : on les pose sur l'écran, on les déplace, on les redimensionne, et **on enregistre un écran prêt à l'emploi** pour la semaine suivante. La notion de *préréglage de séance* est leur vrai produit. |
| **ViewSonic / Vibe (retours terrain)** | Le frottement n° 1 mesuré : devoir repasser par la barre à chaque changement pointeur → stylo → surligneur. Les bonnes solutions annotent **sans changer de mode** (le doigt montre, le stylet écrit). |
| **Marking menus (Kurtenbach, Autodesk ; Big Medium)** | Les menus radiaux battent les listes dès 8 items, parce que le geste passe en **mémoire musculaire** : l'expert finit par sélectionner *sans regarder*. Trois principes : auto-révélation, guidage, répétition (le guidage est la répétition du geste final). Limite ferme : **8 items maximum**, et il faut **invoquer le menu sur l'objet**, pas via un bouton distant. |

**Synthèse :** les deux familles de solutions sont (a) *personnalisation explicite* (SMART) et
(b) *contexte + geste* (tldraw, marking menus). Elles ne s'opposent pas, elles répondent à deux
publics : Thomas (expert, veut la vitesse) et Aurélie (veut retrouver ses 6 outils et rien d'autre).
On prend les deux.

---

## 3. Principes de la refonte

1. **Trois fréquences, trois traitements.**
   - *À chaque instant* (stylo, gomme, couleur, annuler) → toujours visible, gros, sous la main.
   - *Par page / par activité* (fond, insérer, pages, recouvrir) → à un geste ou un clic de distance.
   - *Par séance / rare* (export, enregistrer, réglages, instruments) → dans un menu nommé, assumé comme tel.
2. **Le contexte fait le tri.** Rien qui ne serve pas maintenant. Épaisseur de gomme seulement en mode
   gomme, propriétés de forme seulement sur une forme sélectionnée — et **près de l'objet**, pas à 80 cm
   en bas de l'écran (sur un TBI de 200 cm, la distance de parcours est un coût réel).
3. **Le geste est le raccourci.** Le menu radial devient l'accès principal des experts : appui long sur
   la toile, ou deux doigts, ou bouton du stylet → 8 quartiers, mémorisables. Il ne remplace jamais la
   barre, il la double.
4. **Le prof compose son tableau.** Une barre par défaut volontairement courte + un mode « Personnaliser »
   où l'on ajoute/retire/réordonne. Réglages **synchronisés par compte** (Supabase), pas par appareil.
5. **Un défaut sobre vaut mieux qu'un défaut complet.** Ce qui est masqué par défaut reste atteignable
   par le menu « Plus » et par raccourci clavier : on ne perd aucune fonction, on perd du bruit.
6. **L'écran appartient à la classe.** Le mode affichage (barre masquée) est un état de premier rang,
   accessible d'un geste, avec retour immédiat.

---

## 4. Interface cible

### 4.1 Zones

```
┌───────────────────────────────────────────────────────────────┐
│ ⌂ Tableau ▾   Classe 5eB · Page 3/7            🔍   ⛶   ✕     │  ← bandeau fin (rare, atténué)
│                                                               │
│                                                               │
│                    ┌──────────────────┐                       │
│                    │  [T] A A  ▦  🗑   │ ← barre contextuelle  │
│                    │ ╔══════════════╗ │    posée sur l'objet   │
│                    │ ║   objet      ║ │                       │
│                    │ ╚══════════════╝ │                       │
│                    └──────────────────┘                       │
│                                                               │
│   ⟲ ⟳                                              ▭▭▭▭       │  ← navigateur de pages
│                                                    ▭▭▭▭       │    (repliable, inchangé)
│        ┌────────────────────────────────────┐                 │
│        │ ✥ ✎ ▨ ⌫ T ◻ ✦ │ ● ● ● ● │ ⊕ │ ⋯ │                 │  ← barre principale
│        └────────────────────────────────────┘                 │    ≤ 14 contrôles
└───────────────────────────────────────────────────────────────┘
```

- **Barre principale (≤ 14)** : les 7 outils + 4 pastilles de couleur + « Insérer ⊕ » + « Plus ⋯ ».
  L'épaisseur passe en *sous-réglage de l'outil actif* (appui long sur l'outil, ou petit rail qui
  n'apparaît que pour stylo/surligneur/gomme). Fond de page → dans le menu de page. Annuler/Rétablir →
  coin bas opposé à la main (déjà connu : `tbi.hand`), là où ils ne gênent pas l'écriture.
- **Barre contextuelle flottante** : généralisation de `BoardTextToolbar`/`BoardShapeToolbar` à *tous*
  les objets (image, tableau, widget, objet de bibliothèque, encre sélectionnée), positionnée au-dessus
  de la sélection façon tldraw. Supprime d'un coup 6 à 10 boutons de la barre principale.
- **Menu « Plus ⋯ »** : un vrai menu structuré et nommé, en 4 sections — *Page* (fond, nouvelle,
  dupliquer, recouvrir), *Fichier* (ouvrir, enregistrer, export PDF, publier aux élèves),
  *Instruments* (règle, équerre, rapporteur, projecteur, clavier virtuel), *Séance* (ressources,
  tirage au sort, mode affichage, réglages). Le fourre-tout actuel disparaît.
- **Menu radial** : 8 quartiers, invoqué **sur la toile** (appui long / deux doigts / bouton stylet).
  Contenu par défaut : Stylo, Surligneur, Gomme, Annuler, Couleur, Insérer, Page suivante, Laser.
  **Personnalisable** — c'est la vraie réponse à « je veux mon interface ».

### 4.2 Ce qui devient personnalisable

| Réglage | Défaut | Stockage |
|---------|--------|----------|
| Outils visibles dans la barre principale | les 7 | `board_ui_prefs` (Supabase, par compte) |
| Contenu des 8 quartiers du menu radial | cf. ci-dessus | idem |
| Position de la barre + latéralité | bas / droitier | idem (aujourd'hui localStorage seulement) |
| Widgets « épinglés » (minuteur, dé, roue…) | aucun | idem |
| Palette de couleurs (par matière) | 4 couleurs | idem — déjà prévu en C5 du plan d'origine |
| Densité (compact / confort TBI) | ✅ automatique : 60 px ≥ 1600, 52 px ≥ 1280, 44 px ≥ 900, 40 px en dessous ; un écran tactile garde un plancher de 48 px | réglage manuel en phase D |

Un écran « Personnaliser la barre » façon SMART : deux colonnes *Affichés* / *Disponibles*,
glisser-déposer, bouton « Réinitialiser ». Plus trois **profils prêts** (« Écriture simple »,
« Sciences », « Tout ») pour qu'Aurélie n'ait à faire aucun choix le premier jour.

---

## 5. Plan par phases

Chaque phase est livrable seule et améliore l'UX même si on s'arrête là.

### Phase A — Dégraisser (aucune fonction perdue) — ✅ livrée le 11/09/2026
1. Supprimer la duplication du fond de page (garder le menu, retirer les 3 boutons de la barre).
2. Épaisseur : n'afficher le rail que pour stylo / surligneur / gomme (déjà à moitié fait), et le
   réduire à un seul bouton qui ouvre les 3 tailles au survol/appui long.
3. Déplacer *ouvrir / enregistrer / export / recouvrir / tirage / ressources / clavier* dans un menu
   « Plus ⋯ » structuré en 4 sections ; vider le popover Réglages de tout ce qui n'est pas un réglage.
4. Sortir Annuler/Rétablir de la barre → paire flottante du côté opposé à la main.

*Résultat obtenu : 14 boutons dans la barre (7 outils, épaisseur, insérer, page ◀ ▶ ▤, plus, fermer)
+ le sélecteur de couleur, contre ≈ 38 avant. Nouveau composant `BoardMoreMenu.tsx` (sections
Page / Fichier / Instruments / Séance / Réglages) ; l'ancien popover Réglages fourre-tout a disparu.*

### Phase B — Contexte — ✅ livrée le 12/09/2026
5. ✅ `BoardFloatingToolbar.tsx` : suit l'objet (`data-obj`) en boucle d'animation, bascule sous
   l'objet s'il n'y a pas la place au-dessus, se replie en 2 rangées sous 940 px. Surface distincte
   (fond creusé + liseré accent), libellé de type, flèche vers l'objet. Texte et formes migrés :
   la barre principale ne bouge plus quand on sélectionne (mesuré 752 × 70 avant comme après).
6. ✅ `BoardObjectToolbar.tsx` : barre commune pour image (remplacer, fond de page), tableau
   (lignes / colonnes / en-tête, sur la cellule active), site (annoter / interagir), équation
   (modifier), widget et médias ; actions communes (dupliquer, avancer / reculer, rideau, verrou,
   supprimer). L'objet de bibliothèque garde la barre des formes. L'encre sélectionnée a sa barre
   flottante « Encre · n traits » (convertir en texte, PNG, supprimer) ; les boutons `wb__inksel-*`
   en dur ont disparu, seule la poignée d'échelle reste sur le cadre.
7. ✅ Menu contextuel : appui long sur l'encre sélectionnée (comme sur un objet et sur la toile) ;
   le menu de l'objet offre aussi « Remplacer l'image… » et « Modifier l'équation ». Les quatre
   menus (objet, toile, encre, page) passent tous par `BoardContextMenu`.

### Phase C — Le geste
> **Révisé le 16/09/2026 après test en classe (TBI 1280×720).** Le geste à deux doigts était
> inutilisable : le cadre tactile détecte les doigts l'un après l'autre, la tape rapide à deux
> doigts déclenchait Annuler, le premier doigt laissait un point d'encre. Décision de Thomas :
> **pastille flottante** (`BoardPalette`, déplaçable par simple glissé, mémorisée) qui ouvre le menu
> radial autour d'elle d'une tape ; dans le menu, glisser le disque central déplace le tout
> (l'appui long a été essayé puis retiré : pas fiable, et « appuyer puis bouger » est le réflexe). Les tapes à
> deux/trois doigts sont supprimées (pincer-zoomer conservé). Menu mis à l'échelle de l'écran
> (×0,68 en 720p) et contenu dans la scène hors barre. Éditeur des 8 quartiers
> (`BoardPaletteEditor`, catalogue dans `lib/boardRadialPalette.ts`, localStorage
> `classroom-board-radial`). ✅ Points 8 et 10 faits sous cette forme ; le bouton du stylet reste à faire.
8. ~~Invoquer `BoardRadialMenu` par appui long sur la toile et par le bouton latéral du stylet ;
   conserver le geste à deux doigts.~~ Retirer l'item « Menu radial » de Réglages. ✅
9. Ajouter le glissé-relâché directionnel sans lever (marking menu) et l'apprentissage : les labels
   n'apparaissent qu'après 300 ms, pour que l'expert parte sans attendre l'affichage.
10. Réglage « ce que je mets dans mon menu radial » (8 emplacements, liste d'actions disponibles). ✅

### Phase D — Personnalisation et synchronisation
11. Table `board_ui_prefs` (user_id, JSON, updated_at) + migration + hook `useBoardPrefs`,
    avec repli `localStorage` hors ligne. Reprise des clés `classroom-board-tbi` existantes.
12. Écran « Personnaliser la barre » (affichés / disponibles, glisser-déposer, réinitialiser).
13. Les 3 profils prêts (« Écriture simple », « Sciences », « Tout »).

### Phase E — Préparer sa séance (inspiration Classroomscreen)
14. Widgets épinglables : une rangée de raccourcis vers les widgets favoris plutôt que 10 items
    noyés dans « Insérer ».
15. « Insérer » repensé : 4 sections (Média, Contenu, Outils de classe, Widgets), champ de recherche,
    ligne « récents ».
16. Modèles de tableau : ouvrir une séance sur une mise en page préparée (rappel B7/A5 du plan d'origine).

### Phase F — Finition
17. Mode affichage accessible d'un geste (touche `F` ou quartier radial), pastille de retour discrète.
18. Passe visuelle sur `wb-theme.css` / `design_handoff_tableau_blanc` : hiérarchie de contraste
    (outils = pleins ; actions rares = atténuées), cibles ≥ 48 px en densité TBI, états actifs lisibles
    à 3 m de distance.
19. Rappel d'apprentissage : les raccourcis clavier existants (V/P/S/E/T/F/L/N, Ctrl+K…) affichés
    dans les info-bulles et dans un écran d'aide — aujourd'hui ils ne sont que dans les `title`.

**Ordre recommandé : A → B → C → D**, les phases E et F ensuite. A seule règle 70 % du ressenti
« trop de boutons » et ne coûte presque rien ; C est celle qui rend le tableau *agréable* pour Thomas ;
D est celle qui le rend *adoptable* par Aurélie.

---

## 6. Décisions tranchées (11/09/2026)

1. **Épaisseur du trait** : bouton unique déroulant. ✅ fait (phase A).
2. **Annuler/Rétablir** : paire flottante dans le coin opposé à la barre. ✅ fait (phase A).
3. **Stockage des préférences** : table Supabase par compte (`board_ui_prefs`) + repli `localStorage`
   hors ligne → à faire en phase D.
4. **Menu radial** : on garde les **8 quartiers** existants (pas d'alignement sur les 4 directions
   de la PWA élève) → phase C.
5. **Navigateur de pages** : inchangé pour l'instant (panneau latéral).

## 7. Mesure du résultat

| Indicateur | Aujourd'hui | Cible |
|------------|-------------|-------|
| Contrôles visibles au repos | ≈ 38 | ≤ 14 |
| Items dans le menu Réglages | 11 hétérogènes | 4-5 vrais réglages |
| Gestes pour écrire en rouge épais | 3 clics | 1 geste radial |
| Gestes pour insérer un minuteur | 2 clics + lecture d'une liste de 20 | 1 clic (widget épinglé) |
| Distance stylet pour changer d'outil (TBI) | barre en bas = jusqu'à 1 m | ~0 (menu radial sous la main) |
| Réglages conservés entre PC et TBI | non | oui |

---

## 8. Sources

- [tldraw — UI components & contextual toolbar](https://tldraw.dev/sdk-features/ui-components)
- [Big Medium — Touch Means a New Chance for Radial Menus](https://bigmedium.com/ideas/radial-menus-for-touch-ui.html)
- [Kurtenbach — The Design and Evaluation of Marking Menus](https://www.research.autodesk.com/app/uploads/2023/03/the-design-and-evaluation.pdf_recHpUp1v9dc1n2CJ.pdf)
- [Teq — Top 7 tools in the SMART Notebook toolbar (personnalisation)](https://teq-dev.teq.com/top-7-tools-smart-notebook/)
- [SMART — ActivInspire vs SMART Notebook](https://www.smarttech.com/education/resources/blog/reasons-to-replace-activinspire-with-smart-notebook)
- [Classroomscreen — widgets](https://classroomscreen.com/widgets)
- [ViewSonic — Interactive whiteboards in the classroom, 5 tips](https://www.viewsonic.com/library/education/interactive-whiteboards-in-the-classroom-5-tips-for-teachers/)
