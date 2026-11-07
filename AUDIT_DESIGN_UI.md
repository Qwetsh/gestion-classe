# Audit UI/UX — Gestion Classe (web)

Date : 7 novembre 2026
Périmètre : https://qwetsh.github.io/gestion-classe/ (bureau 800 px et mobile 375 px), code source `gestion-classe-web/src` (tokens `index.css`, `Layout.tsx`, 22 pages).

**Méthode.** Deux passes. La première sur le code déployé (tokens, classes CSS, styles en ligne comptés). La seconde, connectée, en bureau 1440 px et en mobile 375 px sur : accueil, plan de salle (classe 3A), suivi élèves, séances, évaluations, récompenses, analyses, feuille « Plus », connexion, espace élève. Les débordements horizontaux ont été mesurés au pixel (`scrollWidth - innerWidth`). La section « Constats de la passe visuelle » en fin de document complète les points C1 à I10 avec ce qui a été vu à l'écran.

---

## Résumé

Le socle est bon : un design system tokenisé, une combinaison typographique moderne (Fraunces italique + Inter), une navigation à sections avec rail repliable et une tab bar mobile. L'impression générale est **moderne, 70 % pro**. Ce qui tire vers l'amateur n'est pas la direction artistique mais la discipline d'application : gris trop clairs et textes trop petits, trois couleurs d'action concurrentes, titres de page définis dix fois en ligne, 239 couleurs hexadécimales en dur contre 71 dans le design system, emojis mêlés aux icônes vectorielles.

| Priorité | Points |
|---|---|
| Critique | 5 (contrastes, tailles de texte mobile, cibles tactiles, zoom bloqué, débordements mobile) |
| Important | 10 code (couleur d'action, titres, couleurs en dur, états des boutons, rayons, graisses, polices chargées, emojis, modales, langue) + 4 visuels (bulle flottante, CTA variable, surcharge de commandes mobile, EDT mobile) |
| Cosmétique | 7 code + 4 visuels |

---

## À conserver (ce qui fonctionne)

- **Tokens centralisés** dans `index.css` (`--bg`, `--surface`, `--text`, `--indigo`, `--accent`, `--radius`, ombres). C'est la bonne base ; tout le reste de l'audit consiste à s'y tenir.
- **Couple typographique Fraunces italique (titres) + Inter (corps)** : contraste serif/sans contemporain, style éditorial. Les grands chiffres en Fraunces 500 avec `tabular-nums` (moyennes, KPI) sont une vraie signature.
- **Palette neutre froide** (`#F6F7F9` / blanc / `#1A1D2E`) avec ombres très douces (`0 1px 2px` à 4 %) : rendu propre, pas de « carton » gris.
- **Barre latérale à trois sections** (principal / Vie de classe / Ressources), rail 64 px sous 1440 px, mémorisé. **Tab bar mobile** 4 onglets + « Plus » : bon choix pour l'usage téléphone.
- **`focus-visible` global** : contour 2 px indigo, décalage 2 px. Rare dans un projet solo, à garder.
- **Zoom grand écran** (`zoom: 1.08` à 1920 px, `1.15` à 2400 px) : adapté à ton 32 pouces.
- **Page de connexion** : carte 448 px centrée, champs 44 px, bouton 48 px, hiérarchie logo → titre → formulaire → CTA. Rien à reprendre sur la structure.
- **Espace élève** (parchemin / or, Cormorant) : univers cohérent, volontairement distinct de l'outil prof ; contraste or sur brun 8,2:1.
- **Plan de classe** : tables bois en dégradé, grille en filigrane masquée radialement, pastilles élèves avec barre de couleur. C'est l'écran le plus « produit » de l'app.

---

## CRITIQUE

### C1. Contrastes insuffisants sur le texte secondaire (WCAG AA)

**Constat (mesuré sur les tokens déployés)**

| Usage | Couleurs | Ratio | Verdict |
|---|---|---|---|
| `--text-dim` sur blanc (hints, libellés de section sidebar 10 px, dates, compteurs) | `#9CA3AF` / `#FFFFFF` | 2,54 | échec |
| Onglet inactif de la tab bar mobile (11 px) | `#9CA3AF` / `#FFFFFF` | 2,54 | échec |
| Texte blanc sur bouton accent orange (`.btn--accent`) | `#FFFFFF` / `#F97316` | 2,80 | échec |
| Avertissement sur fond doux | `#D97706` / `#FEF1D8` | 2,85 | échec |
| Lien / texte indigo sur blanc | `#6366F1` / `#FFFFFF` | 4,47 | échec (seuil 4,5) |
| Bouton gradient fin de course | `#FFFFFF` / `#8B5CF6` | 4,23 | échec |
| `--text-muted` sur blanc | `#6B7280` / `#FFFFFF` | 4,83 | OK |
| `--text-muted` sur `--bg` | `#6B7280` / `#F6F7F9` | 4,51 | OK (limite) |

**Pourquoi c'est un problème.** `--text-dim` porte de l'information (dates, « 3 élèves », sections de menu, hints KPI). Sur un téléphone en extérieur ou en classe lumineuse, 2,5:1 est illisible. L'orange accent sert de CTA sur 9 boutons : le libellé disparaît.

**Correction**
- `--text-dim` : réserver aux éléments non textuels (icônes décoratives, bordures). Pour tout texte, passer à `--text-muted` `#6B7280` (4,83) ; si tu veux garder un troisième niveau textuel, `#7C8494` (≈ 4,5 sur blanc).
- Tab bar inactive : `#6B7280`. Active : garder `#4F46E5` (6,29).
- Liens et texte indigo : `#4F46E5` (6,29) au lieu de `#6366F1`. Garder `#6366F1` pour les fonds, icônes et bordures.
- `.btn--accent` : fond `#C2410C` (blanc dessus = 5,18) ou, mieux, inverser en « soft » : texte `--accent-ink` `#9A3412` sur `--accent-soft` `#FFE8D4` (6,17).
- `--warn` sur `--warn-soft` : texte `#B45309` (4,49, limite) ; `--pos` sur `--pos-soft` : `#047857` (4,88).
- Bouton gradient : voir I1, le remplacer par un aplat `#4F46E5`.

### C2. Texte trop petit, surtout pour un usage mobile-first

**Constat.** Corps à 14 px (`body`). Tailles en ligne dans les `.tsx` : 220 × 12 px, 131 × 11 px, 62 × 12,5 px, 57 × 10 px, 27 × 11,5 px, 18 × 9 px, 6 × 9,5 px, 6 × 8 px, 2 × 7,5 px. Classes Tailwind : 295 × `text-xs` (12 px). Les libellés de section de la sidebar sont à 10 px, les hints KPI à 11,5 px, les actions d'en-tête sur mobile à 11 px.

**Pourquoi.** Sur un S26 Ultra tenu à bout de bras, 11 px correspond à ~2 mm de hauteur de x. Les recommandations courantes : 16 px de corps sur mobile, 12 px minimum pour tout texte lu, 10-11 px uniquement pour des badges non essentiels. Les demi-pixels (12,5 / 11,5 / 10,5) prouvent que l'échelle n'existe pas : on ajuste au coup par coup.

**Correction**
- Échelle unique, en entiers : **11 / 12 / 13 / 14 / 16 / 18 / 22 / 28 / 40**. Supprimer 7,5 à 10,5 et tous les demi-pixels.
- `body` à 15 px sous 768 px (ou 16 px), 14 px sur bureau est acceptable vu le zoom grand écran.
- Champs de formulaire à 16 px sur mobile (évite aussi le zoom automatique d'iOS).
- Plancher : 12 px pour tout texte informatif, 11 px uniquement pour les badges `.break` et compteurs.

### C3. Cibles tactiles sous 44 px

**Constat.** `.btn` : padding 9 × 14 px, police 13 px → ~36 px de haut. Sur mobile, `.track-header__actions .btn` descend à 6 × 10 px / 11 px → ~28 px. Boutons icône en ligne : 23 occurrences entre 24 et 32 px (notifications, réglages, avatar 30 px, actions de ligne de classe 24 px). Onglets de la tab bar : ~50 px, OK.

**Pourquoi.** Apple recommande 44 pt, Android 48 dp. En dessous, erreurs de tap et double-tap ; sur une app dont la promesse est « une action en moins de 2 secondes », c'est contradictoire.

**Correction**
- Sous 768 px : `.btn { min-height: 44px; padding: 10px 16px; font-size: 14px }`. Ne jamais réduire les boutons sur mobile, réduire leur nombre (regrouper dans un menu « ⋯ »).
- Boutons icône : zone de tap 40 × 40 px minimum (visuel 24 px, padding 8 px), 44 px sur mobile.
- Lignes de liste (`--density-row: 52px`) : OK, garder.

### C4. Zoom utilisateur bloqué

**Constat.** `index.html` : `<meta name="viewport" content="… user-scalable=no …">`.

**Pourquoi.** Empêche le pincement pour agrandir (WCAG 1.4.4). Combiné à C2, un collègue presbyte n'a aucune issue. Le mode PWA plein écran ne dépend pas de cet attribut.

**Correction.** Supprimer `user-scalable=no` ; garder `viewport-fit=cover`. Si le pincement gêne le plan de classe ou le tableau, bloquer le geste localement avec `touch-action: none` sur ces canevas uniquement.

### C5. Responsive inégal d'une page à l'autre (confirmé à l'écran)

**Mesuré à 375 px.** Débordement horizontal de la page : Plan de salle **+180 px**, Récompenses **+59 px**, Analyses +4 px ; accueil, séances, suivi élèves, évaluations : 0. Sur Plan de salle, la barre d'outils (Vue tableau, Lier les tables, Couleur de table, Malus, Imprimer…) dépasse à droite et ses libellés se cassent sur trois lignes. Sur Récompenses, le tableau est coupé et les noms passent sur deux lignes.

**Constat dans le code.** Le `Layout` est responsive (sidebar → topbar sous 1024 px, tab bar sous 768 px, paddings 28 → 18 → 12 px). Mais 13 pages sur 22 ne contiennent aucune règle mobile (ni `isMobile`, ni préfixe `md:`/`sm:`, ni media query dédiée) : Sessions, Productions, Pronote, GroupSessions, Clouds, Evaluations, Dashboard (celui-ci est couvert par le CSS `.dash__*`), etc. Grilles à colonnes fixes en pixels dans les pages : `'300px 1fr'`, `'260px 1fr'`, `'1fr 140px 1fr 90px 90px'`, `'minmax(0,1fr) 320px'`. 10 tableaux HTML pour 6 conteneurs à défilement horizontal.

**Pourquoi.** Une grille `300px 1fr` sur 375 px laisse 75 px à la colonne principale. Un tableau sans `overflow-x: auto` déborde et casse la largeur de la page (scroll horizontal global, tab bar décalée).

**Correction**
- Règle générale : toute grille à colonne fixe passe en `grid-template-columns: 1fr` sous 768 px (ou `minmax(0, 1fr)` pour éviter le débordement des enfants).
- Tout `<table>` enveloppé dans `<div style="overflow-x:auto; -webkit-overflow-scrolling:touch">` avec une largeur minimale ; ou transformé en liste de cartes sous 640 px comme fait pour `.dash__srow`.
- `html, body { overflow-x: hidden }` comme filet de sécurité pendant la transition.
- Prioriser les écrans utilisés depuis le téléphone : accueil, séances, suivi élèves, évaluations.

---

## IMPORTANT

### I1. Trois couleurs d'action concurrentes

**Constat.** `.btn--primary` = noir `#1A1D2E` (5 usages), `.btn--accent` = orange `#F97316` (9 usages), `.btn--ghost` (45 usages). En parallèle : bouton de connexion et avatar en dégradé indigo → violet (`#6366F1 → #8B5CF6`), liens et état actif en indigo, chips sélectionnés en noir, `theme-color` et logo en indigo. Les boutons sont par ailleurs définis en ligne (5 fonds différents hors classes `.btn`) et en utilitaires Tailwind.

**Pourquoi.** L'utilisateur ne peut pas apprendre « quelle couleur = action principale ». Noir et orange se disputent la hiérarchie sur une même page, l'indigo arrive en troisième sur la connexion. Le dégradé violet date (2020-2021) et contraste mal (C1).

**Correction.** Une hiérarchie à trois niveaux, point final :
- Primaire : aplat `#4F46E5`, texte blanc, hover `#4338CA`, `active` translateY(1px). Un seul par écran.
- Secondaire : `.btn--ghost` actuel (fond blanc, bordure `--border-strong` `#D4D8E1` plutôt que `--border` pour qu'il se détache).
- Destructif : rouge `#DC2626` plein ou ghost rouge.
- L'orange reste **couleur d'accent sémantique** (alertes, éléments à traiter, barres KPI), jamais un fond de bouton.
- Supprimer les dégradés (bouton de connexion, avatar, logo) : aplat `#4F46E5`.

### I2. Titres de page définis dix fois, sur deux échelles

**Constat.** Style de `<h1>` inline répété à l'identique dans 10 pages (`Fraunces 400 italique 40 px, letter-spacing -0,02 em`). Trois pages à 24 px / 600 non italique (Évaluations, Productions, AssessmentSheet), Académie à 28 px, accueil à 44 px (`.dash__title`), Toolbox en `text-xl font-bold` (Inter), Students « Notes d'implication » et Classroom sans style du tout. La classe `.page-title` existe (40 px) mais n'est utilisée que dans Classes.

**Pourquoi.** Deux pages consécutives changent de ton (italique éditorial vs gras utilitaire) ; sur mobile seuls `.track-header h1` (24 px) et `.dash__title` (32 px) sont réduits, les 10 titres inline restent à 40 px sur 375 px.

**Correction.** Une seule classe :
```css
.page-title { font: italic 400 40px/1 var(--font-display); letter-spacing: -0.02em }
@media (max-width: 640px) { .page-title { font-size: 28px } }
```
Supprimer tous les styles inline de `<h1>`. Les sous-titres de section en Fraunces 500 18 px (`.gc-card__title`) sont bons, les conserver.

### I3. 239 couleurs hexadécimales en dur dans les composants

**Constat.** 239 hex distincts dans les `.tsx` contre 71 dans `index.css`. Les plus fréquents hors tokens : `#1F2937` (75), `#374151` (61), `#111827` (44), `#E5E7EB` (56), `#D1D5DB` (26), `#3B82F6` (26), `#EF4444` (30), `#10B981` (20), `#F59E0B` (21). Ce sont les gris et couleurs **Tailwind par défaut**, qui coexistent avec les tokens maison (`#1A1D2E`, `#E6E8EE`, `#DC2626`, `#059669`, `#D97706`). La tab bar mobile elle-même utilise `#E5E7EB` / `#1F2433` / `#9CA3AF` au lieu de `--border` / `--text` / `--text-muted`.

**Pourquoi.** Deux systèmes de gris côte à côte produisent des bordures et textes « presque pareils », ce que l'œil perçoit comme du flou sans savoir pourquoi. Et aucun thème sombre ou réglage de contraste ne sera jamais possible.

**Correction**
- Remplacement mécanique : `#1F2937|#111827|#1F2433 → var(--text)`, `#374151|#4B5563|#6B7280 → var(--text-muted)`, `#E5E7EB|#D1D5DB → var(--border)`, `#F9FAFB|#F3F4F6 → var(--surface-2/3)`, `#EF4444 → var(--neg)`, `#10B981|#22C55E → var(--pos)`, `#F59E0B|#FBBF24 → var(--warn)`, `#3B82F6 → var(--indigo)`.
- Garde-fou : règle ESLint `no-restricted-syntax` sur les littéraux `#[0-9a-f]{6}` dans `src/pages` et `src/components` (exceptions : palettes de classes, Académie).
- Les palettes volontairement distinctes (Académie `tokens.css`, espace élève, couleurs de classe) restent telles quelles.

### I4. États des boutons incomplets

**Constat.**
- Hover primaire = `opacity: 0.88` ; pas d'état `:active` ; `disabled` = `opacity: 0.6` global. Résultat visible sur la connexion : le bouton « Se connecter » apparaît lavande délavé au chargement (désactivé tant que les champs sont vides) et ressemble à un bouton cassé.
- 7 boutons gèrent leur hover en `onMouseEnter`/`onMouseLeave` JS : inopérant au doigt, pas d'équivalent clavier.
- Les actions de ligne de classe (renommer / supprimer) n'apparaissent qu'au survol (`opacity: 0`) : invisibles sur tactile, sauf `focus-within`.

**Correction**
- États CSS complets pour `.btn` : `:hover` (fond assombri de 8 %), `:active` (translateY(1px), ombre 0), `:focus-visible` (déjà global), `:disabled` (fond `--surface-3`, texte `--text-dim`, pas d'opacité, curseur `not-allowed`).
- Bouton de connexion : laisser actif et valider à la soumission ; un CTA grisé à l'arrivée est une mauvaise première impression.
- Supprimer les hovers JS au profit de classes.
- Sous 768 px : actions de ligne toujours visibles (opacité 0,55 comme fait pour `.gc-cell__info`) ou derrière un appui long / menu.

### I5. Rayons : un token, quinze valeurs

**Constat.** Tokens : `--radius` 14, `--radius-sm` 10, `--radius-xs` 7 ; mais `--radius-md` 12, et `--radius-lg` = `--radius-xl` = `--radius-2xl` = 14 (alias inutiles). En ligne : 86 × 8 px, 55 × 6 px, 54 × 10 px, 53 × 12 px, 19 × 16 px, 17 × 2 px, 12 × 4 px, 11 × 7 px, 23 × 999 ; 408 utilitaires `rounded-*` Tailwind ; `.btn` à 9 px, chips à 7 px, toast à 10 px, panneau notifications à 12 px.

**Pourquoi.** Des cartes à 14 px contenant des boutons à 9 px et des badges à 5 px, à côté d'un panneau à 12 px : l'œil enregistre un manque de netteté. Règle classique : rayon interne = rayon externe − padding.

**Correction.** Trois valeurs + pilule : **6 px** (badges, chips, inputs compacts), **10 px** (boutons, inputs, toasts, menus), **14 px** (cartes, modales, feuilles), **9999** (avatars, pilules). Supprimer `--radius-md/lg/xl/2xl`, mapper `rounded-lg → 10`, `rounded-xl/2xl → 14`.

### I6. Graisses synthétiques

**Constat.** Inter est chargé en 400 / 500 / 600 / 700. Le code utilise `fontWeight: 800` (16 fois) et `900` (1 fois) ; 206 × 700 et 227 × 600 en ligne.

**Pourquoi.** 800 et 900 sont « faux-gras » synthétisés par le navigateur : empâtement, lettres qui se touchent. L'abondance de 700 réduit la hiérarchie : quand tout est gras, rien ne l'est.

**Correction.** Plafonner à 700. Règle : 700 pour les valeurs clés (notes, compteurs), 600 pour les libellés et boutons, 500 pour les lignes de liste, 400 pour le corps.

### I7. Quatre familles de polices chargées sur toutes les pages

**Constat.** `index.html` charge Fraunces (6 variantes, axe optique 9..144), Inter (4), Cormorant Garamond (5), IM Fell English (2), IM Fell English SC (1), sur la page de connexion comme partout. Cormorant et IM Fell ne servent que l'Académie et l'espace élève.

**Pourquoi.** ~300-400 Ko de polices avant le premier rendu sur un réseau de collège ; `display=swap` provoque un « flash » Georgia → Fraunces sur les titres.

**Correction.** Garder Fraunces + Inter en global (et réduire Fraunces à `ital,wght@0,400;0,500;1,400`). Charger Cormorant et IM Fell via un `<link>` injecté par le composant `academy-root` / `StudentDashboard` uniquement. Précharger le fichier Fraunces italique 400 (`<link rel="preload" as="font">`) pour supprimer le flash sur le titre de page.

### I8. Emojis mêlés aux icônes vectorielles

**Constat.** Icônes SVG trait 1,6 px dans la navigation (très bien) mais emojis dans l'interface : « 🚪 Déconnexion », ℹ️ ⚠️ ✅ (annonces), 🐛 💡 💬 (retours), ✉️ 📧 (connexion), plus d'autres dans les pages.

**Pourquoi.** Le rendu dépend de l'OS (Samsung One UI ≠ Windows 11 ≠ iOS), la couleur n'est pas contrôlable, l'alignement optique avec le texte est aléatoire. C'est le signal « amateur » le plus immédiat.

**Correction.** `lucide-react` est déjà une dépendance : `LogOut`, `Info`, `AlertTriangle`, `CheckCircle2`, `Bug`, `Lightbulb`, `MessageSquare`, `Mail`, taille 16, `strokeWidth 1.75`, couleur `currentColor`. Les emojis restent acceptables dans l'espace élève et les récompenses si c'est un choix d'univers.

### I9. Modales : un composant partagé, trente-trois overlays ad hoc

**Constat.** `Modal.tsx` (Escape, tailles sm → 6xl, z-index) est importé 8 fois ; 33 fichiers posent leur propre `position: fixed; inset: 0`. Deux largeurs maximales de feuille latérale (`.sheet` 440 px, modale `gc-sgm` 760 px), fonds d'overlay différents (`rgba(15,23,42,.35)` tab bar, `rgba(20,25,40,.35)` sheet).

**Correction.** Tout passe par `Modal` (ou un `Sheet` latéral partagé) : un seul overlay `rgba(20,25,40,0.4)`, un seul rayon 14 px, fermeture Escape et clic extérieur garanties, et sur mobile un comportement unique (plein écran sous 640 px, feuille basse à coins 20 px pour les choix courts).

### I10. Langue du document

**Constat.** `<html lang="en">` pour une interface entièrement en français.

**Pourquoi.** Lecteurs d'écran en voix anglaise, césures et guillemets automatiques anglais, correcteur du navigateur en anglais dans les champs « Remarque ».

**Correction.** `lang="fr"`. Une ligne.

---

## COSMÉTIQUE

- **K1. Favicon** : `vite.svg` par défaut dans l'onglet. Remplacer par l'icône « GC » déjà utilisée pour `apple-touch-icon` (export SVG du logo de la sidebar).
- **K2. Logo « GC »** : Fraunces 700 dans la sidebar, Inter gras (`font-bold` sans `fontFamily`) sur la page de connexion. Harmoniser sur Fraunces 600.
- **K3. Dégradé indigo → violet** (logo, avatar, bouton) : rendu « SaaS 2021 ». Aplat `#4F46E5` + ombre `--shadow-glow` réduite à 12 % d'opacité.
- **K4. Grille d'espacement** : paddings à 5, 7, 9, 11, 13 px, gaps à 3 et 6 px. Passer sur une grille de 4 px (4 / 8 / 12 / 16 / 24 / 32) ; `--gap` 14 → 16, `.btn` 9 × 14 → 10 × 16.
- **K5. `transition: all 0.15s`** global sur `a`, `input`, `select`, `textarea` : anime aussi largeur et position, ce qui fait « glisser » certaines mises en page au chargement. Limiter à `color, background-color, border-color, box-shadow, opacity`.
- **K6. Longueur de ligne** : `.gc-main--reading` à 1320 px sans limite sur les blocs de texte (notes, consignes, remarques). Limiter les paragraphes à `max-width: 68ch` (~640 px).
- **K7. Pied de connexion** : « Gestion Classe v1.0 » en `--text-dim` 12 px. Soit supprimer, soit le passer en `--text-muted` et y mettre une information utile (date du dernier déploiement).

---

## Constats de la passe visuelle (connecté)

### Ce qui fonctionne, vu à l'écran

- **Accueil bureau** : l'œil va bien à l'emploi du temps de la semaine, cellules colorées par classe avec compteurs +/−/abs. La date en exergue (« samedi 7 novembre · après-midi ») au-dessus du titre est un bon détail.
- **Accueil mobile** : la carte « Démarrer une séance » avec bouton lecture vert, puis les deux raccourcis (Travail de groupe, Épreuve), sont exactement ce qu'il faut en premier écran de téléphone.
- **Séances** : en-têtes de jour en Fraunces italique (« Vendredi 6 Novembre »), heure en grand chiffre serif, durée en dessous, barre de progression des événements. C'est la liste la plus réussie de l'app.
- **Suivi élèves bureau** : en-tête de classe avec la moyenne 11,0/20 en Fraunces 42 px indigo, distribution des notes en histogramme, quatre indicateurs, cartes élèves avec sparkline. Dense mais lisible.
- **Plan de salle** : canevas, tables bois, panneau « Non placés » avec moyenne par élève, légende de tendance. Rien à reprendre sur le fond.
- **Feuille « Plus » mobile** : liste simple à 15 px, icônes alignées, poignée. Propre.
- **Analyses** : cartes KPI avec pastille colorée par type, chips de période et de classe.

### V1. Bulle de feedback flottante qui masque le contenu — important

**Constat.** Le bouton rond indigo (feedback) en bas à droite recouvre, en bureau, la liste « Non placés » du plan de salle, la dernière colonne des évaluations et la dernière carte élève. En mobile il couvre les badges de la dernière ligne de séance (« 4B · 22 évts · +9 −5 8 abs ») et les cellules du tableau de notes. Il est de plus en dégradé alors que le reste de l'interface est plat.

**Correction.** Le retirer des écrans de travail : le mettre dans le menu avatar et dans la feuille « Plus » (entrée « Envoyer un retour »). Si tu le gardes flottant : 40 px, aplat `#4F46E5`, uniquement sur l'accueil, et masqué dès qu'une liste ou un tableau défile.

### V2. La couleur du bouton principal change à chaque page — confirme I1

| Page | Action principale | Couleur |
|---|---|---|
| Séances | + Nouvelle séance | orange plein |
| Suivi élèves | Passer au trimestre suivant | orange plein |
| Analyses | Générer rapport PDF | dégradé indigo → violet |
| Évaluations | + Évaluation | indigo plat |
| Récompenses | Personnaliser / Réinitialiser | ghost gris / ghost rouge |
| Plan de salle | Sauvegarder | orange pâle, texte blanc (désactivé) |
| Accueil mobile | Démarrer une séance | vert |

**Pourquoi.** Cinq pages, cinq conventions. Le cas le plus gênant : sur Suivi élèves, « Passer au trimestre suivant », action rare et irréversible, est le seul bouton orange de l'écran, donc le plus visible, au-dessus de quatre boutons ghost d'usage quotidien (Bulletin IA, QR, Cartes QR, Codes élèves). Sur Plan de salle, « Sauvegarder » désactivé affiche du blanc sur orange à 40 % : illisible.

**Correction.** Appliquer I1 : une action principale par page en indigo plat `#4F46E5` ; « Passer au trimestre suivant » devient un ghost rouge ou passe dans un menu « ⋯ » ; « Sauvegarder » désactivé = fond `--surface-3`, texte `--text-dim`, bordure `--border`.

### V3. Mobile : trop de commandes avant le premier contenu — important

**Constat.** Suivi élèves à 375 px : titre, cinq boutons d'action sur trois lignes, bandeau d'alerte ambre avec bouton, bande de classes, en-tête de classe, recherche, chips, segmenté, deux boutons de vue. Le premier élève apparaît après **≈ 520 px** sur 812, soit sous la ligne de flottaison. Séances : les 12 chips de filtre par classe s'enroulent sur trois lignes (≈ 120 px). Évaluations : trois `<select>` natifs empilés plus deux cases à cocher avant le tableau, qui commence à 57 % de la hauteur. Analyses : « 7 jours » se casse sur deux lignes dans sa pilule.

**Correction.**
- Boutons d'en-tête sous 768 px : un seul visible (l'action principale), le reste dans un menu « ⋯ » 44 px.
- Chips de classes (Séances, Analyses) : bande horizontale défilante sur une ligne (`overflow-x: auto; flex-wrap: nowrap`), avec dégradé de bord droit pour signaler la suite (la bande de Suivi élèves coupe net sur « I » de 4A).
- Filtres d'Évaluations : regroupés derrière un bouton « Filtres » qui ouvre une feuille basse ; les `<select>` natifs remplacés par les chips/segmentés déjà utilisés ailleurs (incohérence de composant : ce sont les seuls contrôles natifs non stylés de l'app).
- Bandeau « anciens élèves non réaffectés » : fermable, et placé sous le contenu plutôt qu'au-dessus.
- `white-space: nowrap` sur les pilules de période.

### V4. Emploi du temps de la semaine illisible à 375 px — important

**Constat.** Cinq colonnes de jour sur 343 px utiles : les cellules montrent « 4B +3 −2 » puis « Seque… », le libellé de séance est tronqué dès le quatrième caractère. Les chiffres font ≈ 9 px.

**Correction.** Sous 640 px, afficher **le jour courant** (ou aujourd'hui + demain) en pleine largeur, avec un sélecteur de jour en chips (L M M J V) au-dessus ; la vue semaine reste pour la tablette et le bureau. Le module « Démarrer une séance » juste au-dessus suggère déjà cet usage « maintenant ».

### V5. Accueil bureau : une carte vide et un KPI orphelin — cosmétique

**Constat.** Sous « Moyenne par classe », une carte blanche contenant un grand rectangle gris avec barre de défilement (module « Mes tableaux » ou aperçu non chargé). La carte « Moyenne d'implication 11,7/20 » est seule sur sa ligne, calée à droite, avec les deux tiers de la ligne vides.

**Correction.** Afficher un état vide explicite dans le module (« Aucun tableau · + Nouveau ») plutôt qu'un rectangle gris ; donner au KPI implication une place en largeur 1/3 à côté de « Moyenne par classe », ou le fondre dans la carte des moyennes.

### V6. Récompenses : 300 boutons « + Tampon » et des emojis dans le tableau — cosmétique

**Constat.** La vue d'ensemble liste tous les élèves (312) avec un bouton indigo plein « + Tampon » par ligne : 300 CTA identiques transforment la couleur d'action en bruit de fond. La colonne « Carte » affiche un emoji 🏷 suivi de « n°1 », les noms sont des liens indigo soulignés au survol.

**Correction.** Bouton ghost compact (icône +) sur chaque ligne, le plein indigo réservé à l'action de la ligne survolée ou sélectionnée ; icône Lucide `Ticket` ou `Stamp` à la place de l'emoji ; noms en `--text` 600 (le clic sur la ligne suffit).

### V7. Analyses : vert hors palette — confirme I3

**Constat.** Le graphique « Comparaison Filles / Garçons » utilise un vert vif (`#22C55E`, Tailwind) alors que la palette définit `--pos` `#059669` ; les KPI en haut utilisent les bonnes couleurs douces. Sur la même page coexistent donc deux verts.

**Correction.** Passer les séries Recharts sur les tokens (`var(--pos)`, `var(--indigo)`, `var(--warn)`) ; pour une comparaison filles/garçons, deux teintes neutres de la même couleur (`#4F46E5` et `#A5B4FC`) plutôt qu'un vert qui connote « bon ».

### V8. Encart « Pronote non connecté » permanent — cosmétique

**Constat.** En bas de la barre latérale, un encart ambre avec lien « Connecter » est affiché en permanence sur toutes les pages dès que Pronote n'est pas connecté. Il est la seule surface colorée de la colonne, donc l'œil y revient à chaque page.

**Correction.** L'afficher une fois par session (fermable), ou le réduire à une pastille d'état grise sur l'entrée « Pronote » du menu.

---

## Impression générale

**Moderne.** Tokens, Fraunces italique en titre, cartes blanches à bordure 1 px plutôt qu'ombres lourdes, surfaces `#F6F7F9`, chiffres tabulaires, rail repliable, zoom grand écran : le vocabulaire est celui des outils actuels (Linear, Notion, Arc). L'espace élève et le plan de classe montrent une vraie intention visuelle.

**Pro à 70 %.** Les 30 % restants ne demandent pas de redesign : ce sont des corrections de discipline (C1, C2, I1, I2, I3, I8 couvrent l'essentiel) qui se font par recherche-remplacement et deux ou trois règles CSS. Ce qui fait « amateur » aujourd'hui : un CTA grisé à l'arrivée, du gris clair à 10-11 px partout, des emojis à côté d'icônes fines, et des pages qui ne se ressemblent pas d'un titre à l'autre.

## Ordre d'exécution conseillé

1. **Une demi-journée, zéro risque** : C4 (`user-scalable`), I10 (`lang`), K1 (favicon), C1 (changer 5 valeurs de tokens + `#6366F1 → #4F46E5` sur le texte), I6 (plafonner les graisses), V1 (bulle de feedback hors des écrans de travail), C5 (les deux débordements mesurés : barre d'outils du plan de salle et tableau des récompenses).
2. **Une journée** : I2 (`.page-title` partout), I1 + V2 (hiérarchie des boutons, une action principale par page, suppression des dégradés), I4 (états `.btn`, bouton de connexion actif), I8 (emojis → Lucide), V3 (chips en bande défilante, actions d'en-tête derrière « ⋯ » sur mobile).
3. **Deux à trois jours, téléphone en main** : C2 (échelle de tailles), C3 (cibles 44 px), V4 (vue jour de l'EDT sous 640 px), I3 + V7 (couleurs en dur), I5 (rayons), I9 (modales), V5, V6, V8.

---

## Journal

**Palier 1 appliqué le 7 novembre 2026** (branche `feat/design-palier-1`, créée depuis `master`) :
- C4 : `user-scalable=no` retiré du viewport. I10 : `<html lang="fr">`. K1 : favicon `public/favicon.svg` (carré indigo « GC ») à la place de `vite.svg`.
- C1 : tokens décalés d'un cran (`--text-muted` `#4B5563`, `--text-dim` `#6B7280`, `--pos` `#047857`, `--warn` `#B45309`), nouveau `--indigo-ink` `#4F46E5` pour tout texte indigo (32 règles CSS, liens de connexion, tab bar), nouveau `--accent-strong` `#C2410C` comme fond de `.btn--accent`. Libellés de section du menu à 11 px. Tab bar et feuille « Plus » tokenisées (plus de gris Tailwind en dur).
- I6 : `fontWeight` 800/900 plafonnés à 700 dans 14 fichiers.
- V1 : bouton flottant supprimé ; `FeedbackButton` devient `FeedbackDialog` (contrôlé), ouvert depuis « Envoyer un retour » dans le menu avatar et dans la feuille « Plus ».
- C5 : barre d'outils du plan de salle en `.plan-toolbar` (retour à la ligne, libellés insécables) et en-tête Récompenses en `flex-wrap` ; vérifié par injection sur le site en ligne à 375 px : largeur de page 555 → 375 et 434 → 375. Filet `overflow-x: hidden` sur `html, body` sous 768 px.
- Vérifié : `tsc -b` et `vite build` passent ; page de connexion contrôlée sur le serveur local (langue, viewport, favicon, tokens, absence de bulle). Les écrans connectés n'ont pas été revus visuellement après modification.
