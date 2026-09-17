# Handoff : Gestion de classe — refonte UX

## Vue d'ensemble

Refonte UX de l'application **Gestion de classe** (application enseignant, en français, pour le suivi de séances scolaires, notes d'implication des élèves, plans de salle et historique des séances).

Quatre écrans refondus :
1. **Accueil** (tableau de bord)
2. **Suivi élèves** (notes d'implication)
3. **Plan de salle** (placement des élèves)
4. **Séances** (historique + calendrier)

## À propos des fichiers joints

Les fichiers dans `source/` sont des **références de design créées en HTML/React** — des prototypes qui montrent le look visé et le comportement attendu, **pas du code de production à coller tel quel**.

L'objectif est de **recréer ces designs dans l'environnement existant de l'application cible** (React, Vue, SwiftUI, natif, etc.) en utilisant ses patterns et librairies établies. Si aucun environnement n'existe encore, choisir le framework le plus adapté et y implémenter les designs.

## Fidélité

**Haute fidélité (hifi)** — les maquettes sont pixel-perfect : couleurs finales, typographie définie, espacements précis, interactions fonctionnelles. Le développeur doit recréer l'UI fidèlement en utilisant les librairies et patterns existants de la codebase cible.

Là où la codebase a déjà un design system, **privilégier ses tokens** plutôt que de dupliquer ceux ci-dessous — les valeurs ci-dessous sont des **intentions** (ex : "un accent orange chaud", "un fond gris très clair").

---

## Design tokens

### Couleurs (thème clair, défaut)

| Token | Valeur | Usage |
|---|---|---|
| `--bg` | `#F6F7F9` | Fond de page |
| `--bg-alt` | `#EFF1F5` | Fond alternatif |
| `--surface` | `#FFFFFF` | Surface carte |
| `--surface-2` | `#FAFBFC` | Surface survol |
| `--surface-3` | `#F3F4F7` | Surface tertiaire (inputs, segments) |
| `--border` | `#E6E8EE` | Bordure standard |
| `--border-strong` | `#D4D8E1` | Bordure accentuée |
| `--text` | `#1A1D2E` | Texte principal |
| `--text-muted` | `#6B7280` | Texte secondaire |
| `--text-dim` | `#9CA3AF` | Texte désaturé |
| `--muted-2` | `#CBD0DB` | Élément graphique neutre |
| `--accent` | `#F97316` | Orange CTA (conservé de l'existant) |
| `--accent-soft` | `#FFE8D4` | Fond accent doux |
| `--indigo` | `#6366F1` | Sélection, accent secondaire |
| `--indigo-soft` | `#EEF0FF` | Fond indigo doux |
| `--pos` | `#059669` | Vert — implications positives |
| `--pos-soft` | `#E4F6ED` | Vert doux |
| `--neg` | `#DC2626` | Rouge — malus |
| `--neg-soft` | `#FDE8E8` | Rouge doux |
| `--warn` | `#D97706` | Orange attention |
| `--warn-soft` | `#FEF1D8` | Orange doux |

### Couleurs par classe (badges `ClassChip`)

Chaque classe a une couleur persistante utilisée dans le chip, les barres, les filtres et les sparklines. Voir `source/data.js`. Exemples : 3ème groupe 1 = `#6366F1`, 4ème E = `#3B82F6`, etc.

### Thème nocturne

Le toggle "Nocturne" remplace les tokens ci-dessus par une palette sombre (`--bg: #0E1116`, `--surface: #181C25`, etc.). Voir `source/app.css` sous `html[data-theme="nocturne"]`.

### Typographie

- **Display** (titres, valeurs numériques marquantes) : `Fraunces` (Google Fonts) — italique pour les h1, weight 500 pour les titres de cartes et valeurs KPI
- **Sans** (UI, texte courant) : `Inter` — weights 400, 500, 600, 700
- `font-variant-numeric: tabular-nums` sur toutes les valeurs numériques (notes, heures, compteurs)

Échelle :
- h1 écran : 40–52px, italique, weight 400 (Fraunces)
- Titres de cartes : 17–22px, weight 500 (Fraunces)
- Texte courant : 13–14px (Inter)
- Meta / labels : 11–12px, couleur `--text-muted`
- Uppercase labels : 10.5px, letter-spacing 0.04em, weight 600

### Rayons

- `--radius: 14px` — cartes principales
- `--radius-sm: 10px` — inputs, boutons
- `--radius-xs: 7px` — chips, petits éléments
- Pastilles rondes (avatars) : 50%

### Ombres

- `--shadow-1: 0 1px 2px rgba(20,25,40,0.04), 0 1px 3px rgba(20,25,40,0.02)` — élévation légère
- `--shadow-2: 0 6px 20px rgba(20,25,40,0.06), 0 2px 6px rgba(20,25,40,0.04)` — survol, modales

### Densités

- **Confort** (défaut) : gap 14px, hauteur de ligne 52px
- **Compact** : gap 10px, hauteur de ligne 44px

---

## Écrans

### 1. Accueil (`Dashboard`)

**Objectif** : donner en un coup d'œil l'état de la semaine et ce qui demande attention — pas un mur de compteurs.

**Layout** : nav top sticky → contenu en `max-width: 1400px` → deux lignes.
- **Hero row** (grille 1fr 1.1fr) : à gauche un titre "Bonsoir Thomas." (Fraunces 52px italique) + accroche en une phrase qui résume la journée de demain. À droite la carte "Prochaine séance" (class chip + date + topic + salle + élèves + 3 boutons d'action, avec un trait vertical accent 3px à gauche).
- **KPI row** (3 colonnes) : Moyenne d'implication · Élèves à suivre · Séances de la semaine. Chaque KPI a un `delta` (vs. période précédente) et un `hint`. La carte "Élèves à suivre" a un fond teinté warn.
- **Colonnes** (grille 1.4fr 1fr) :
  - **Gauche** : "À regarder avant demain" (liste d'élèves qui décrochent, chacun avec nom, classe, raison, note, delta) + "Séances récentes" (chaque row avec class chip, classe, date/heure, topic, breakdown visuel +/-/abs, total événements).
  - **Droite** : "Demain" (planner 3 créneaux, premier avec fond accent-soft) + "Raccourcis" (grille 2×2) + "Moyenne par classe" (barre horizontale par classe avec ligne médiane à 10/20).

**Remplacer** :
- Les 6 KPI opaques de l'original → 3 KPI **actionnables**. `666 implications` et `401 malus` sont des nombres orphelins sans contexte ; on les remplace par des métriques dérivées interprétables (moyenne, delta, elèves à suivre).
- "8 evts" par séance (non informatif) → breakdown `+/-/abs` en pastilles colorées.
- Raccourcis enterrés en bas → bloc dédié à droite.

### 2. Suivi élèves (`StudentTracking`)

**Objectif** : lire le **signal** de chaque élève (tendance, implication) rapidement, et pouvoir saisir un événement en 2 clics.

**Layout** : grille `260px 1fr`.
- **Sidebar classes** : liste avec pour chaque classe le `ClassChip`, label, nb d'élèves, moyenne, et un **ring de progression** de la moyenne /20 coloré par la classe.
- **Panneau principal** :
  - En-tête : grand `ClassChip` + nom + méta (X élèves · 24 séances · dernière : date) à gauche ; à droite la moyenne de classe en gros Fraunces 42px colorée par la classe + delta.
  - **Toolbar** : recherche, chips de filtre (Tous / À suivre / En tête avec count), tri (A-Z / Note / Tendance / Absences), switch grille/liste.
  - **Class strip** : distribution des notes en histogramme (barres 0..20/20 colorées rouge <8 / gris 8-12 / classe ≥12) + 4 indicateurs (Oral, Participation, Absences, Bonus).
  - **Grille élèves** (auto-fill minmax 220px) : cartes `StudentCard`.

**Carte élève** (`StudentCard`) — clé de la refonte :
1. Header : avatar initiales (fond classe color @ 22% + texte classe color), nom, ratio events, **note en Fraunces 28px à droite**.
2. **Sparkline 10 dernières séances** (`Sparkline` composant) sur axe centré à 0, avec points verts positifs / rouges négatifs, dernier point mis en avant. Sous la courbe : label "10 dernières séances" et **TrendBadge** (↗/↘/→ + delta).
3. **Breakdown** : 4 tokens `+` `−` `abs` `oral` avec valeur en gras et label en dessous, fond coloré par type (pos / neg / neutre / indigo).
4. Footer : bouton "Ajouter un événement" (pointillé, devient plein noir au survol) + bouton œil (fiche complète).
5. **Fond teinté par état** : dégradé vers `--neg-soft` si note <6, `--warn-soft` si <8, `--pos-soft` si ≥12.

**Popover ajout rapide** (`QuickMenu`) : Participation+ / Bonne réponse +2 / Malus −1 / Gros malus −2 / Absent / Oral noté. 2 clics depuis la carte.

**Vue liste alternative** (`StudentRow`) : colonnes élève / note / sparkline+trend / + / − / abs / oral / action. Pour la saisie rapide en séance.

### 3. Plan de salle (`RoomPlan`)

**Objectif** : voir la salle telle qu'elle est physiquement, placer les élèves en drag & drop, voir leur état en un coup d'œil.

**Layout** : grille `230px 1fr 280px`.
- **Sidebar classes** (comme écran 2 mais sans ring)
- **Canvas central** : onglets salles (Salle 210, 310, + nouvelle) → légende couleurs notes et tendance → grille `4 rangées × 6 colonnes` avec **allée au centre** (après colonne 3) → **bureau prof** + **tableau noir** en BAS.
- **Pool à droite** : liste des élèves non placés (drag source) + import CSV + ajouter élève.

**Bureaux** (`Seat`) — ne pas utiliser de gros blocs noirs hachurés comme la version actuelle. Chaque siège est :
- Une silhouette de **table en bois** (gradient `#E9D2B4 → #D4B089 → #B68E67`) avec bordure arrondie 6px et ombre "en relief" (`box-shadow: 0 2px 0 0 #8B6B51`)
- Une **chaise** derrière (barre marron courte au-dessus)
- Si vide : mêmes formes en pointillé `1.5px dashed var(--border-strong)` avec le n° de place en label
- Si occupée : **pastille élève** posée par-dessus

**Pastille élève** (`StudentPill`) :
- Barre verticale colorée à gauche (3px) selon la note : neg / warn / indigo / pos
- Initiales + flèche de tendance (↗/↘/→) en top row
- Nom (ellipsis)
- Note Fraunces 14px + **mini-sparkline 38×14** en bottom row
- Draggable

**Drag & drop** : HTML5 drag API. Dépose sur un siège occupé → échange. Dépose sur le pool → retire de la salle.

**Fond** : grille de 40×40px très légère (0.25 opacity) masquée en ellipse au centre, pour donner l'impression d'un sol.

**Peek card** (`PeekCard`) au clic sur un élève : avatar, nom, classe, grosse note + trend, sparkline large, 4 stats (+/−/abs/oral), boutons "Fiche complète" / "Événement".

### 4. Séances (`SessionsScreen`)

**Objectif** : voir l'historique et le planning des séances, pas juste une liste plate.

**Trois vues** :
- **Semaine** (défaut) : grille 6 colonnes (rail horaires 56px + 5 jours) × ~10 rangées horaires. Chaque séance est un bloc absolument positionné (top = offset heure, height = durée) avec bord gauche coloré par classe, fond `color @ 10%`, chip court (3G1...), heure, topic en 2 lignes, breakdown +/-/abs si hauteur >40px. Séances à venir en opacity 0.72. Col "aujourd'hui" a fond accent-soft.
- **Liste** : séances regroupées par jour (header italique Fraunces capitalisé), chaque row avec heure+durée / chip classe / classe+topic / grand nombre d'évts + **barre de répartition horizontale** (segments pos/neg/abs proportionnels) / tokens breakdown / chevron.
- **Mois** : grille 7 jours, chaque case avec n° du jour, count, et **points colorés** (un par classe présente ce jour-là).

**Filtres par classe** en rail au-dessus, chips cliquables avec pastille couleur classe.

**Panneau latéral de détail** (`SessionDetail`) : sheet 440px qui slide depuis la droite. Header avec class chip 42×42, classe, date, topic Fraunces 22px, 4 stats. Puis **timeline des événements** (colonne heure / dot coloré / "qui" + "quoi") avec ligne verticale reliant les points. Actions : Exporter / Modifier.

---

## Interactions & comportements

### Navigation
- Top nav sticky, 5 items : Accueil / Classes / Suivi élèves / Séances / Analyses (+ Plus).
- "Classes" ouvre le plan de salle (pas une page Classes séparée — à discuter avec le métier).

### États
- Toutes les cartes cliquables ont un état hover (fond `surface-2` ou translateY(-1px) + shadow-2).
- Les chips de filtre : état "off" (muted, bg transparent), "on" (bg text, couleur surface).
- Les segments (toolbar) : pill container bg `surface-3`, l'élément actif bg `surface` + shadow-1.

### Animations
- Slide-in du panneau latéral : `translateX(100%) → 0`, 0.22s, easing cubic-bezier(0.2, 0.8, 0.2, 1).
- Toast ajout événement : `translateY(10px) + opacity 0 → 0`, 0.2s ease-out.
- Transition de couleur / fond : 0.12s ease sur tous les boutons et rows.

### Drag & drop (plan de salle)
- HTML5 DnD natif. `setDragging({sid, from, seatId?})` au `dragstart`, `onDragOver` → `setDragOver(seatId)` pour feedback visuel (outline accent en pointillé). Au `drop` : si from=pool → placement direct ; si from=seat → swap.

### Filtre / tri (suivi élèves)
- Recherche instantanée (lowercase includes sur `name`).
- Tri client-side : A-Z (localeCompare), Note (desc), Tendance (delta desc), Absences (desc).

### Responsive
- Breakpoint 1100–1200px : les grilles 2 colonnes passent à 1 colonne. Sidebar devient statique (non sticky).

---

## State management

Principalement `useState` local par écran dans le prototype. Dans la codebase cible, probablement :
- État utilisateur courant + classes/élèves : store global (Redux / Zustand / Context / Pinia selon stack).
- Sélection d'écran / de classe / de session active : URL route params.
- Filtres/tri de l'écran Suivi : URL query params (pour partage + back/forward).
- Drag state (plan de salle) : local au composant.
- `history` par élève (sparkline) : dérivé côté serveur ou calculé à la volée des 10 dernières séances.

---

## Assets

Aucun asset externe en dehors de :
- **Google Fonts** : Fraunces + Inter (via CDN dans le prototype, à remplacer par self-hosting ou la méthode standard de la codebase).
- Icônes : tout est en SVG inline dans le composant `Icon` (`source/shared.jsx`). Le dev peut soit garder ce composant, soit substituer par sa librairie d'icônes préférée (Lucide, Heroicons...) — les noms utilisés mappent 1:1.

---

## Fichiers source

Dans `source/` :

| Fichier | Contenu |
|---|---|
| `Bibliotheque.html` | Point d'entrée. Monte React, définit les Tweaks persistés (density/theme/accent/screen), route entre les 4 écrans. |
| `app.css` | Tokens, layout général, dashboard, suivi élèves, tweaks panel, nav. |
| `room.css` | Styles plan de salle (bureaux, pastilles, canvas, pool, peek card). |
| `sessions.css` | Styles écran Séances (grille semaine, liste, mois, sheet de détail). |
| `data.js` | Données mock (classes, élèves, sessions récentes, à venir, élèves à suivre). À remplacer par l'API/store réel. |
| `shared.jsx` | Composants partagés : `TopNav`, `ClassChip`, `Sparkline`, `TrendBadge`, `Icon`. |
| `dashboard.jsx` | Écran Accueil. |
| `tracking.jsx` | Écran Suivi élèves (notes d'implication) : `StudentTracking`, `StudentCard`, `StudentRow`, `QuickMenu`, `Distribution`, `AvgRing`. |
| `roomplan.jsx` | Plan de salle : `RoomPlan`, `Seat`, `StudentPill`, `MiniSpark`, `PeekCard`. |
| `sessions.jsx` | Séances : `SessionsScreen`, `WeekView`, `ListView`, `MonthView`, `SessionDetail`. |

Ouvrir `Bibliotheque.html` directement dans un navigateur pour voir le prototype (les JSX sont transpilés côté client via Babel Standalone — en production évidemment à compiler en build time).

---

## Priorités de build suggérées

Si tout ne peut pas être fait d'un coup :
1. **Écran Suivi élèves** en premier — c'est celui utilisé en séance, gain UX le plus concret.
2. **Dashboard** ensuite — arrival point de l'app, premier impact.
3. **Plan de salle** — chantier plus gros à cause du DnD et du rendu isométrique.
4. **Séances** — peut se faire incrémentalement (liste d'abord, puis semaine, puis mois).

## Questions ouvertes pour le métier

- Le calcul exact de "tendance" (delta) doit être validé : ici on fait `moyenne des 5 dernières / moyenne des 5 précédentes`. Peut-être EWMA plus adapté ?
- Le seuil "À suivre" (note <8 OU delta <-0.3) à confirmer.
- La persistance des plans de salle (plusieurs dispositions par classe ? par salle ? par date ?).
- L'écran "Classes" top-nav ouvre actuellement le plan de salle — est-ce l'intention, ou faut-il un vrai hub Classes ?
