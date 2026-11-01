# Plan — Ergonomie des onglets « Évaluations » et « Productions »

> Rédigé le 01/11/2026 après lecture du code web (`gestion-classe-web/src/pages/Evaluations.tsx`,
> `components/CarnetTab.tsx`, `CopyViewer.tsx`, `AssessmentStatsPanel.tsx`, `pages/Productions.tsx`,
> `components/productions/*`) et des plans `PLAN_carnet_de_notes.md` et `PLAN_copies_evaluation.md`.
> Objectif : **réorganiser, pas ajouter**. Chaque action à un seul endroit évident.
> Statut : disposition **validée par Thomas le 01/11/2026** (« Oui, lance l'étape 1 »).
> - Étape 1 **codée le 01/11/2026** (branche `feat/ergonomie-fiche`) : fiche `/evaluations/:id`
>   (`pages/AssessmentSheet.tsx`), corps commun `components/AssessmentDetail.tsx` (sujet, corrigé,
>   lignes de classe avec Voir / Valider la classe / Publier, menu ⋯ des scans, visionneuse),
>   `AssessmentModal` et `AssessmentStatsBody` extraits, « Corriger avec Claude », lien « fiche ↗ »
>   dans l'en-tête de colonne du Carnet, retour vers la même classe et le même trimestre.
>   L'onglet Éval reste en place. tsc + vitest OK ; pas encore vérifié connecté dans le navigateur.
>   Mise à jour avec master le 01/11/2026 (PR #13 export PDF et #15 kit par version intégrées).
>   **Vérifié connecté le 01/11/2026** (Chrome, données réelles) : Carnet → « fiche ↗ » → fiche (en-tête,
>   Modifier, lignes de classe avec Fermer / Publier / Exporter en PDF, visionneuse, statistiques), onglet Éval →
>   « Fiche complète ↗ », retour « ← Carnet » sur la bonne classe et le bon trimestre. Aucune copie scannée en
>   prod à ce jour : le chemin « pages scannées » de la visionneuse n'a pas pu être exercé sur des données réelles
>   (code inchangé par rapport à master).
>   À reprendre à l'étape 3 (vocabulaire) : pour une éval jamais scannée, la ligne de classe dit « 0/29 scannée »
>   et la liste des élèves « Manquante » ; dire plutôt « 24/29 notées » et ne pas marquer de copie manquante.
> - Questions Q1 à Q5 (§4) toujours ouvertes : elles conditionnent les étapes 2 à 4.

---

## 1. Inventaire — ce qu'il y a aujourd'hui (constaté dans le code)

### 1.1 Onglet Évaluations › sous-onglet **Carnet** (`CarnetTab.tsx`, 1 166 lignes)

| Zone | Contenu | Sert à |
|---|---|---|
| Menu gauche | Liste des classes | Choisir la classe |
| Barre | T1 / T2 / T3, année, état « Enregistré », **⬆ Importer Pronote**, **⬇ Sauvegarder**, **+ Évaluation** | Trimestre, import CSV Pronote, export xlsx/pdf de toute l'année, créer une éval |
| Grille | Élèves × évals, saisie clavier (`a d n z *`, Entrée, Tab, Échap), `*` orange = brouillon du Correcteur, ✻ = adaptée, moyenne élève, moyenne/médiane de classe | **Saisir** les notes sans copie, **lire** une colonne pour la recopier dans Pronote |
| En-tête de colonne | Nom (clic → modale Modifier), coef · barème, lien **stats**, « N à corriger » | Modifier l'éval, ouvrir les stats |
| Modale **Modifier l'évaluation** | Nom, type, date, barème (avec conversion des notes), coef, compte dans la moyenne, **« Visible par les élèves »**, appliquer à la série, aménagements par élève, **Supprimer** | Réglages de l'éval |
| Modale **Nouvelle évaluation** | Nom, type, date, barème, coef, compte dans la moyenne, « Créer aussi sur d'autres classes » (série) | Créer |
| Panneau **Stats** | Moyenne, médiane, écart-type, min/max, ≥ 10, quartiles, histogramme, effectifs par statut, comparaison des classes de la série, bouton Modifier | Lire les stats |
| Modale Import Pronote, modale Sauvegarder | CSV Pronote → carnet ; export xlsx/pdf | Rattrapage T1 ; sauvegarde hors Pronote |

### 1.2 Onglet Évaluations › sous-onglet **Éval** (`Evaluations.tsx`, 672 lignes)

| Zone | Contenu | Sert à |
|---|---|---|
| Liste gauche | **Toutes** les évals de **toutes** les années et classes, repliées par série, chip d'étape (Pas de copie / Scan en cours / Scannée / Corrigée / Validée / Publiée), bouton **+ Nouvelle** | Choisir une éval, créer |
| Modale **+ Nouvelle** | Nom, classe, matière, barème (**sans** type, date, coef, série) | Créer (2e formulaire, incomplet) |
| Cartes **Sujet** / **Correction** | Ouvrir, Remplacer, Supprimer, Ajouter (PDF/image, conversion docx) | Déposer le sujet et le corrigé |
| Tableau **Copies** (une ligne par classe) | Séance, chip d'étape, résumé « 22/26 scannées · 2 absents · 20 notées · 20 validées », rétention (« Scans supprimés le … », **Garder 30 j de plus**, **Supprimer maintenant**), boutons **Voir les copies / Voir les notes**, **Publier / Dépublier** | Suivre, publier, gérer les scans |
| **Visionneuse** (`CopyViewer.tsx`) | Gauche : **Valider toute la classe (n)**, filtres Tous/Scannées/Manquantes/Absents, liste élèves avec note (`*` = brouillon), badges (version, Adaptée, Annotée, pages, Correction…, ⚑ à arbitrer). Droite : ↑ ↓, note, **Valider la note**, **Ajouter une copie**, **Corriger / Recorriger** (API Claude), **Ouvrir ↗**, encadré du dernier appel Claude, vignettes + page (zoom), panneau **Correction / Transcription** (détail par question, radar) | Relire, valider, rattraper une copie |
| Fenêtre **Ajouter une copie** (`AddCopyDialog.tsx`) | Importer / Webcam / QR code, version du sujet, adaptée, remplacer | Rattrapage d'une copie |

### 1.3 Onglet **Productions** (`Productions.tsx`, 424 lignes + `WorkCorrection.tsx`, 404 lignes)

| Zone | Contenu | Sert à |
|---|---|---|
| Liste gauche | Activités (titre, niveau · séquence · barème, « envois fermés ») | Choisir l'activité |
| Carte 1 — activité | Titre, clé, version de définition, nb de questions, barème, **Corrigé attendu**, **Fermer / Rouvrir les envois** | Réglages de l'activité |
| Carte 2 — classe | Sélecteur de classe, compteurs par statut (Envoyée / Corrigée / Validée / Brouillon / Rien reçu), **Actualiser** | Choisir la classe |
| Carte 3 — actions | Texte « n corrigées sur m reçues · Carnet : éval liée… », **Exporter pour Claude**, **Importer la correction Claude**, **Imprimer les copies corrigées**, **Envoyer / Mettre à jour les notes au carnet** | Correction par fichier, impression, envoi au carnet |
| Tableau | Élève, statut, binôme, dernier envoi, nb d'envois, note (ou « auto x / y »), bouton **Lire / Revoir / Corriger** | Ouvrir une fiche |
| Fenêtre **Correction** (`WorkCorrection.tsx`) | Critères à cocher, Auto / Tout / Rien, remarque par question, compétences, conseils, corrigé attendu, historique des envois, **Enregistrer**, **Enregistrer pour le binôme**, **Valider** (fige la fiche), **Rouvrir**, **Supprimer cette copie**, Alt+← → | Corriger à la main |
| Bandeau rouge global (`HeldWorksAlert.tsx`) | « Envois fermés mais des élèves travaillent », **Rouvrir et récupérer** | Rattraper une séance |

---

## 2. Ce qui cloche (vérifié dans le code, pas supposé)

### Redondances
| # | Même action, deux endroits | Où |
|---|---|---|
| R1 | **Publier aux élèves** : bouton « Publier / Dépublier » (Éval, avec garde-fou « n brouillons ») **et** case « Visible par les élèves » dans la modale Modifier du Carnet (sans garde-fou). Même colonne `published_to_students`. | `Evaluations.tsx:261`, `CarnetTab.tsx:961` |
| R2 | **Créer une évaluation** : « + Évaluation » (Carnet, formulaire complet, série multi-classes) **et** « + Nouvelle » (Éval, formulaire réduit : ni type, ni date, ni coef, ni série). | `CarnetTab.tsx:694`, `Evaluations.tsx:604` |
| R3 | **Valider les brouillons** : « Valider toute la classe » et « Valider la note » dans la visionneuse ; et taper dans une cellule du Carnet valide aussi (sans le dire autrement que par une infobulle). | `CopyViewer.tsx:283,382`, `CarnetTab.tsx:593` |
| R4 | **État d'avancement** dit avec trois vocabulaires : chip « Corrigée » (Éval = des brouillons sont arrivés), « n à corriger » (Carnet = n élèves sans note), `*` « brouillon » (Carnet et visionneuse). | `copyStatus.ts`, `CarnetTab.tsx:546` |
| R5 | **Le mot « Corriger »** : en Productions = corriger à la main ; dans la visionneuse = lancer l'API Claude. **Le mot « Valider »** : en Productions = figer la fiche de l'élève ; en Évaluations = rendre la note publiable. | |

### Mal placé ou éclaté
| # | Problème |
|---|---|
| P1 | Une éval est coupée en deux : **réglages, stats, suppression** dans le Carnet (clic sur l'en-tête) ; **sujet, corrigé, copies, validation, publication** dans Éval. Pour renommer l'éval dont on regarde les copies, il faut changer d'onglet, retrouver la classe et le trimestre. |
| P2 | La liste « Éval » affiche **toutes les années** sans filtre (`fetchAssessments` ne filtre ni l'année ni le trimestre) : elle grossira sans fin. Elle mélange aussi les TP venus de Productions (cartes Sujet/Correction vides, pas de copies). |
| P3 | Le Carnet renvoie vers l'autre onglet pour un geste courant (« à valider (onglet Éval) »). |
| P4 | Les liens de **rétention des scans** (« Garder 30 j de plus », « Supprimer maintenant ») sont affichés en permanence sur chaque ligne de classe, alors qu'ils servent une fois par trimestre au plus. |
| P5 | « Valider toute la classe » est **dans** la visionneuse (colonne de gauche), « Publier » est **au-dessus** dans le tableau des classes : les deux gestes qui s'enchaînent ne sont pas côte à côte. |
| P6 | En Productions, **trois cartes empilées** (activité, classe, actions) avant le tableau, et six boutons dont deux (« Exporter pour Claude » / « Importer la correction Claude ») correspondent à l'ancien flux par fichier. |
| P7 | « ⬆ Importer Pronote » (CSV) est en pleine barre du Carnet : il servait à rapatrier le T1 déjà saisi dans Pronote ; le flux réel est désormais app → Pronote à la main. |
| P8 | Le bouton **stats** et « n à corriger » sous chaque en-tête de colonne chargent la grille. |

### Ce qui est bien et ne bouge pas
La grille du Carnet et sa saisie clavier ; la visionneuse (pages, zoom, ↑ ↓, Correction / Transcription, ⚑ à arbitrer) ; « Ajouter une copie » ; la fenêtre de correction des Productions ; le bandeau « envois fermés » ; l'export de sauvegarde ; le calcul d'état `copyStatus.ts`. Rien de la chaîne scan → Correcteur → valider → publier ne change de fond.

---

## 3. Proposition : un Carnet, et **une fiche par évaluation**

Principe : l'onglet Évaluations n'a plus deux sous-onglets qui se partagent une éval, mais **une grille** (le Carnet) et **une fiche** par éval qui regroupe tout ce qui la concerne. Chaque geste de Thomas a un seul endroit :

| Geste | Où |
|---|---|
| Créer l'éval (web) | Carnet › **+ Évaluation** (le seul formulaire ; « + Nouvelle » de l'onglet Éval disparaît) |
| Déposer le sujet / le corrigé | Fiche › Sujet & corrigé |
| Voir où en sont les copies, classe par classe | Carnet (chip dans l'en-tête de colonne) et Fiche › Copies |
| Relire, valider, rattraper une copie, « Corriger avec Claude » | Fiche › Voir les copies (visionneuse, inchangée) |
| Valider la classe puis publier | Fiche › ligne de la classe : **[Valider la classe (n)] [Publier]** côte à côte |
| Saisir une note à la main, lire une colonne pour Pronote | Carnet (grille) |
| Renommer, barème, coef, aménagements, supprimer | Fiche › **Modifier** (formulaire actuel **sans** la case « Visible par les élèves ») |
| Stats et comparaison des classes | Fiche › Statistiques |
| Sauvegarder, importer Pronote | Carnet › menu **⋯** (« Sauvegarder les notes », « Importer un export Pronote ») |

### 3.1 Maquette — onglet Évaluations (vue Carnet, inchangée dans sa grille)

```
Évaluations                                                     5e2 · T1 · 2026-2027
┌────────┐ ┌───────────────────────────────────────────────────────────────────────┐
│ 5e1    │ │ [T1] [T2] [T3]                       Enregistré   [⋯ ▾]  [+ Évaluation]│
│▌5e2    │ ├───────────────────────────────────────────────────────────────────────┤
│ 5e4    │ │            │ Éval Nutrition ↗ │ TP Respiration ↗│ DM 1 ↗   │ Moyenne  │
│ 4e3    │ │            │ coef 2 · /28      │ coef 1 · /10    │ coef 1   │          │
│ …      │ │            │ ● À valider (3)   │ ● Publiée       │ 4 sans   │          │
│        │ │            │                   │                 │  note    │          │
│        │ ├────────────┼───────────────────┼─────────────────┼──────────┼──────────┤
│        │ │ Alice D.   │   14,5*           │   8             │  [__]    │  12,3    │
│        │ │ …          │                   │                 │          │          │
└────────┘ └───────────────────────────────────────────────────────────────────────┘
  ⋯ ▾ = Sauvegarder les notes (xlsx / pdf) · Importer un export Pronote
  ↗ sur le nom = ouvre la fiche de l'éval. Le lien « stats » et « n à corriger » disparaissent de
  l'en-tête ; la chip d'état des copies (déjà calculée) prend leur place, « n sans note » pour les
  évals sans copie.
```

### 3.2 Maquette — la fiche d'une éval (pleine page, `/evaluations/<id>`, bouton ← Carnet)

```
← Carnet 5e2 · T1
Éval Nutrition                                   [Modifier] [Supprimer]
Évaluation écrite · 5e1, 5e2, 5e4 · /28 · coef 2 · T1 · sujet et corrigé communs

┌ Sujet ──────────────────────┐ ┌ Corrigé ───────────────────────┐
│ [Ouvrir] [Remplacer] [×]    │ │ [+ Ajouter (PDF ou image)]      │
└─────────────────────────────┘ └────────────────────────────────┘

Copies et notes      scan (téléphone) → Correcteur (PC) → valider → publier
┌──────────────────────────────────────────────────────────────────────────────┐
│ 5e1  jeu. 2 oct.  ● Validée    26/26 scannées · 26 validées                  │
│                   [Voir les copies]                      [Publier]           │
│ 5e2  lun. 6 oct.  ● À valider  24/26 scannées · 2 absents · 3 brouillons     │
│                   [Voir les copies] [Valider la classe (3)] [Publier]        │
│ 5e4  mar. 7 oct.  ● Publiée    25/26 · 1 absent · scans supprimés dans 12 j ⋯│
│                   [Voir les copies]                      [Dépublier]         │
└──────────────────────────────────────────────────────────────────────────────┘
  ⋯ sur la ligne = « Garder 30 j de plus » / « Supprimer les scans maintenant » (plus en clair)

[ Visionneuse de la classe ouverte — inchangée, sans le bouton « Valider toute la classe »
  qui est remonté sur la ligne de la classe ; « Corriger » devient « Corriger avec Claude » ]

Statistiques (repliable)
  Moyenne 12,4 · Médiane 12 · … · histogramme · comparaison 5e1 / 5e2 / 5e4
```

**« Exporter en PDF »** (PR #13, fusionnée le 01/11/2026) : sur la ligne de chaque classe, à droite de
« Publier » (récapitulatif de la classe + une fiche par élève, fenêtre `ExportCorrectionsDialog`) ; et dans la
visionneuse, bouton « PDF » dans la barre de l'élève affiché (sa fiche seule). La ligne de classe suit
l'ordre Voir les copies · Valider la classe · Publier · Exporter en PDF · ⋯. « Valider la classe » reprend
l'avertissement « copie faite sur une autre version du sujet » de la PR #15.

Pour un **TP venu de Productions** (ou un oral, un DM sans copie), la section Copies est remplacée par une ligne « Notes saisies dans le Carnet » ou « Notes envoyées depuis Productions → ouvrir », et la publication se fait au même endroit (ligne de la classe).

### 3.3 Ce qui disparaît, ce qui bouge

| Disparaît | Remplacé par |
|---|---|
| Sous-onglet « Éval » et sa liste de toutes les années | Fiche ouverte depuis l'en-tête de colonne du Carnet |
| Modale « + Nouvelle » (Éval) | « + Évaluation » du Carnet |
| Case « Visible par les élèves » (modale Modifier) | Bouton Publier de la fiche (seul endroit) |
| Lien « stats » + « n à corriger » dans chaque en-tête | Chip d'état dans l'en-tête ; stats dans la fiche |
| « Valider toute la classe » dans la visionneuse | « Valider la classe (n) » sur la ligne de la classe |
| Liens de rétention toujours visibles | Menu ⋯ de la ligne de classe |
| Boutons « ⬆ Importer Pronote » et « ⬇ Sauvegarder » en barre | Menu ⋯ du Carnet |
| Infobulle « à valider (onglet Éval) » | « Brouillon du Correcteur : à valider dans la fiche » |

Vocabulaire unifié des étapes : **Pas de copie · Scan 18/26 · Scannée · À valider (n) · Validée · Publiée** (la chip « Corrigée » devient « À valider (n) », qui dit quoi faire).

### 3.4 Productions — alléger sans changer le fond

```
Productions
┌ Activités ─┐ ┌─────────────────────────────────────────────────────────────────┐
│▌Terre en   │ │ Terre en mouvement           [Corrigé attendu ✓] [Fermer les envois]│
│  mouvement │ │ clé TEM · v2 · 6 questions · /10                                  │
│ …          │ ├─────────────────────────────────────────────────────────────────┤
│            │ │ Classe [5e2 ▾]  Envoyée 18 · Corrigée 6 · Validée 0 · Rien reçu 2 │
│            │ │ 6 corrigées sur 24 · carnet : « Terre en mouvement » lié           │
│            │ │        [Imprimer les corrigées] [Envoyer au carnet (6)] [⋯ ▾]     │
│            │ ├─────────────────────────────────────────────────────────────────┤
│            │ │ Élève │ Statut │ Binôme │ Dernier envoi │ Envois │ Note │ [Ouvrir] │
└────────────┘ └─────────────────────────────────────────────────────────────────┘
  ⋯ ▾ = Actualiser · Exporter pour Claude · Importer la correction Claude
```

- Deux blocs au lieu de trois : l'activité, puis la classe avec ses compteurs **et** ses actions.
- « Exporter / Importer pour Claude » et « Actualiser » passent dans un menu ⋯ (voir Q3).
- Le bouton de ligne devient « Ouvrir » (la fenêtre dit elle-même s'il reste à corriger), pour ne plus avoir deux « Corriger » qui ne font pas la même chose. Dans la visionneuse des copies, le bouton de l'API devient **« Corriger avec Claude »**.
- Les mots « Valider » (Productions : fige la fiche de l'élève) et « Valider » (fiche d'éval : la note devient publiable) restent : la première amène à « Envoyer au carnet », qui crée des notes déjà validées, donc la chaîne est cohérente. Le sous-titre de la fenêtre de correction le dira en clair.
- Productions reste un onglet à part : c'est un flux vivant (envois ouverts / fermés, bandeau) qui n'a rien d'une copie scannée.

### 3.5 Mise en œuvre par étapes (une PR par étape, rien de cassé entre deux)

| Étape | Contenu | Touche |
|---|---|---|
| 1 | **Fiche d'éval** : nouvelle route `/evaluations/:id` (série ou éval seule) qui reprend le détail actuel de l'onglet Éval (sujet, corrigé, copies, visionneuse) + Modifier / Supprimer + Statistiques ; « Valider la classe » remonté sur la ligne ; menu ⋯ rétention ; « Corriger avec Claude ». L'onglet Éval reste en place pendant cette étape. | `Evaluations.tsx` → `pages/AssessmentSheet.tsx`, `CopyViewer.tsx` (retrait du bouton), `App.tsx` |
| 2 | **Carnet** : en-tête de colonne → chip d'état + lien vers la fiche ; retrait de « stats », « n à corriger », de la case « Visible par les élèves » ; menu ⋯ (Sauvegarder, Importer Pronote) ; retour de la fiche vers la même classe / le même trimestre (état dans l'URL). | `CarnetTab.tsx`, `Evaluations.tsx` |
| 3 | **Retrait de l'onglet Éval** et de « + Nouvelle » ; la page Évaluations = Carnet seul. Vocabulaire des étapes (« À valider (n) »). | `Evaluations.tsx`, `copyStatus.ts` + tests |
| 4 | **Productions** : deux blocs, menu ⋯, « Ouvrir ». | `Productions.tsx` |

Tests : vitest existants (`copyStatus`, `gradeStats`, `aiCorrectionUi`…) + `tsc -b` + `npm run build` ; vérification dans le navigateur de la chaîne complète (voir les copies → Corriger avec Claude → Ajouter une copie → valider → publier) avant chaque fusion. Aucune migration.

---

## 4. Questions pour Thomas (à trancher avant de coder)

- **Q1. La liste « Éval » disparaît-elle vraiment ?** Avec la fiche, on y accède depuis le Carnet (classe × trimestre). Si tu tiens à une vue « toutes mes évals en cours, toutes classes », je peux garder une liste **réduite à l'année scolaire courante** en tête du Carnet, mais c'est un endroit de plus.
- **Q2. « Importer Pronote » (CSV)** : encore utile, ou à ranger dans le menu ⋯ (proposé) ?
- **Q3. Productions : « Exporter pour Claude » / « Importer la correction Claude »** : tu t'en sers encore, ou on les range dans le menu ⋯ (proposé) ? Si plus du tout, je les enlève de l'écran (le code reste).
- **Q4. Fiche en pleine page** (avec bouton ← Carnet) ou **en panneau** par-dessus le Carnet ? Pleine page proposée : la visionneuse a besoin de toute la largeur.
- **Q5. Vocabulaire** : « À valider (3) » à la place de « Corrigée », « n sans note » à la place de « n à corriger », « Corriger avec Claude » — ça te parle ?
