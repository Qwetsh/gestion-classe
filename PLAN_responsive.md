# Plan « Adaptatif » — app web sur tous les formats d'écran

24/09/2026 · branche `feat/responsive` (partie de `feat/accueil-v2`)

## Contexte

Écrans de Thomas : 32" en 2560×1440 à 100 % (principal), 1920×1080, 1080×1920 (vertical) ; téléphone S26 Ultra (≈ 412 px CSS).
Avant : contenu plafonné à 1320 px (1600 pour Classes), textes fixes en px (10,5–13 px), aucune règle au-delà de 1440 px.
Pages les plus gênantes : Classes, Suivi élèves, Séances, Analyses.

## Formats

| Format | Largeur | Comportement |
|---|---|---|
| Téléphone | < 640 | tab bar, 1 colonne, marges 12 px |
| Tablette | 640–1023 | topbar, pas de barre latérale |
| Portable | 1024–1439 | barre latérale en icônes (rail) |
| Bureau | 1440–1919 | barre latérale complète |
| Grand écran (`3xl`) | ≥ 1920 | contenu zoomé ×1,08, pleine largeur |
| Très grand (`4xl`) | ≥ 2400 | contenu zoomé ×1,15, pleine largeur |

## Temps 1 — socle (fait)

- `Layout` : classes `gc-main--bleed` / `--fluid` / `--reading` au lieu du `maxWidth` en ligne.
  Pages de travail passées en `fluid` (pleine largeur) : Accueil, Classes, Suivi élèves, Séances, Séance détail, Analyses, Récompenses, Groupes, Évaluations.
  Pages de lecture plafonnées : 1320 px, 1440 px à partir de 1920.
- `index.css` : seuils Tailwind `3xl` (120rem) et `4xl` (150rem) dans `@theme` ; section « Adaptatif ».
- Agrandissement grand écran par `zoom` CSS sur `.gc-main--padded` (pas sur `--bleed` : tableau blanc).
  Vérifié : infobulles Recharts correctement placées sous zoom.
  Pas de zoom sur `html` : `100vh` de la barre latérale déborderait.
- Barre latérale : 236 px / 252 px et textes plus grands en 3xl / 4xl.
- Classes : bureaux plafonnés à 170 px, panneaux latéraux 220 / 300 px en 3xl ; mode une colonne aussi pour une fenêtre PC étroite (`useIsNarrowViewport`), pas seulement pour le tactile.
- Suivi élèves : `.page--tracking` ne plafonne plus (1520 px inopérant) ni ne double les marges.
- Séances (liste) : jours en colonnes CSS (`columns: 620px`), ordre chronologique de haut en bas.
- Analyses : notes d'oral et filles/garçons côte à côte en 3xl.

## Temps 2 — utiliser la place (à faire)

- Suivi élèves : fiche élève dans un panneau à droite (au lieu d'une fenêtre qui se superpose) en 3xl.
- Séances : vue semaine plus haute (créneaux plus grands) ; séance sélectionnée dans un panneau à droite en 4xl.
- Analyses : graphiques en 3 colonnes en 4xl (évolution, répartition, comparaison par classe).
- Séance détail : cartes `3xl:grid-cols-4`.

## Temps 3 — téléphone (à faire)

- Séances : vue « jour » à la place de la vue semaine sous 640 px (≈ 60 px par jour aujourd'hui).
- Fiche élève (Students.tsx l.2603, 2833, 3091) : grilles 4-5 colonnes → 2 colonnes sous 640 px.
- Analyses : chiffres clés en 2 colonnes serrés si valeurs longues.

## Points d'attention

- Styles en ligne `fontSize: 12` (≈ 790 occurrences) : ne suivent que le zoom, pas de rem.
- Fenêtres (portails vers `body`) : hors de `.gc-main`, donc non zoomées.
- `react-grid-layout` (mode édition de l'accueil modulaire) : à retester sous zoom (glisser/redimensionner).
