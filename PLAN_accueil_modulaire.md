# Accueil modulaire — état des lieux et plan

> Rédigé le 23/09/2026. Objectif : rendre la page d'accueil (web bureau) composable —
> des « modules » que l'on place, retire, déplace et redimensionne soi-même.
> Rien n'est codé à ce stade : ce document sert de décision préalable.

---

## 1. État des lieux — comment les autres s'y prennent

### 1.1 Trois familles de solutions

| Famille | Exemples | Principe | Ce qu'on gagne | Ce qu'on paie |
|---|---|---|---|---|
| **A. Grille libre X/Y** | Grafana, Datadog, Metabase, Azure Portal | Canevas de 12 à 24 colonnes, chaque panneau a `{x, y, w, h}`, drag + poignée de redimensionnement, compactage automatique vers le haut | Liberté totale, c'est ce que les gens attendent d'un « dashboard » | Le responsive devient un vrai sujet : soit on stocke un layout par breakpoint, soit on accepte une dégradation automatique en 1 colonne |
| **B. Zones + empilement** | Notion, Home Assistant (vue « sections »), Jira dashboards | Des colonnes/zones fixes, on empile des blocs dedans, la largeur se choisit en nombre de colonnes, la hauteur est celle du contenu | Simple à écrire, mobile gratuit, impossible de casser la mise en page | Pas de contrôle fin de la hauteur, sensation « moins libre » |
| **C. Tailles prédéfinies** | Widgets iOS / Android / Windows, Google Finance | Chaque module déclare les formats qu'il sait rendre (S, M, L, XL), l'utilisateur choisit un format, pas des pixels | Chaque module reste toujours joli, aucun état visuel bâtard à déboguer | Moins souple ; il faut dessiner 2-3 variantes par module |

**Leçon la plus utile** : Home Assistant a commencé en placement libre (« masonry ») et est passé aux
*sections* — une grille contrainte à quelques colonnes avec redimensionnement par cellules — précisément
parce que le placement libre devenait ingérable sur téléphone et que les utilisateurs cassaient leurs
propres tableaux de bord. Grafana, lui, assume la grille libre… mais n'a pas de version mobile sérieuse.

Notre contexte (mobile-first, deux utilisateurs, une seule page concernée) penche vers **A contraint**
ou **C** — c'est le seul vrai arbitrage à trancher (§4).

### 1.2 Constantes qu'on retrouve partout

Quel que soit le modèle, les produits qui réussissent ça partagent cinq traits :

1. **Un mode édition explicite.** Hors édition : aucune poignée, aucun tremblement, aucun coût.
   On entre en édition par un bouton « Personnaliser », on en sort par « Terminé ».
2. **Un registre de modules déclaratif.** Chaque module dit qui il est : identifiant stable, titre,
   description, taille par défaut, tailles minimale et maximale, composant de rendu. C'est ce registre
   qui alimente la bibliothèque « Ajouter un module ».
3. **Les données sont séparées du placement.** Le layout ne contient que des identifiants et des
   coordonnées, jamais de données. Sinon la config devient impossible à faire évoluer.
4. **Le layout est versionné** (`version: 1`) et fusionné avec les défauts au chargement : un module
   ajouté par une mise à jour doit apparaître chez quelqu'un qui a déjà personnalisé sa page, et un
   module supprimé du code ne doit pas faire planter l'accueil.
5. **Un « Réinitialiser »** toujours accessible. C'est le filet de sécurité qui permet d'oser.

### 1.3 Les bibliothèques disponibles (septembre 2026)

| Lib | État | Pour nous |
|---|---|---|
| **react-grid-layout** | Standard de fait (c'est ce qui fait tourner Grafana). Drag, resize, collisions, compactage, breakpoints responsive intégrés. Sous React 19 il subsiste un avertissement console bénin sur les `key` ; un fork communautaire `react-grid-layout-19` existe si ça devient gênant. | **Candidat n°1** si on part sur la grille libre. ~30 kB, sans dépendance lourde. |
| **gridstack.js** | TypeScript pur, très complet, orienté dashboard. Mais API héritée de l'époque jQuery et wrappers React tiers (non officiels côté React 19). | Pas d'avantage décisif sur RGL pour nous, et un wrapper de plus à maintenir. |
| **dnd-kit** | Bas niveau, excellent pour le tri et le glisser-déposer, mais **ne fait pas le redimensionnement** : il faudrait l'écrire. `snapgrid` (communauté) tente de reconstruire RGL par-dessus. | Bon choix seulement si on renonce au resize libre (modèle C). |
| **Fait maison** (CSS Grid + Pointer Events) | ~300 à 400 lignes pour du drag + resize par cellules, si on se limite à une grille à pas discrets sans compactage automatique. | Défendable pour le modèle C (déplacer + choisir une taille), déconseillé pour A : collisions et compactage sont exactement là où on perd des journées. |

Sources : [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) ·
[retour d'expérience ilert](https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice) ·
[gridstack.js](https://gridstackjs.com/) ·
[comparatif drag & drop React 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) ·
[dnd-kit — discussion sur le cas dashboard](https://github.com/clauderic/dnd-kit/discussions/1560)

---

## 2. Ce que ça donne dans notre projet

### 2.1 Point de départ

`pages/Dashboard.tsx` fait aujourd'hui ~1 100 lignes et mélange trois choses :
le chargement des données (Supabase + Pronote), le calcul des indicateurs, et le rendu de huit blocs
distincts. C'est ce mélange — pas le manque de bibliothèque — qui empêche la personnalisation.
Le découpage vaut d'être fait **même si on s'arrête là** : il rend l'accueil lisible et testable.

Blocs déjà présents, qui deviennent les huit premiers modules :

| Module | Source actuelle | Taille par défaut (grille 12 col.) |
|---|---|---|
| `kpi-implication` | carte KPI moyenne | 4 × 2 |
| `kpi-alerts` | carte KPI élèves à suivre | 4 × 2 |
| `kpi-sessions` | carte KPI séances de la semaine | 4 × 2 |
| `quick-actions` | bande « Raccourcis » | 12 × 2 |
| `student-alerts` | « À regarder avant demain » | 8 × 6 |
| `recent-sessions` | « Séances récentes » | 8 × 6 |
| `timetable` | Emploi du temps (liste/calendrier Pronote) | 8 × 8 |
| `next-lesson` | « Prochaine séance » | 4 × 4 |
| `class-averages` | « Moyenne par classe » | 4 × 5 |
| `boards` | « Mes tableaux » (`BoardsPanel`) | 4 × 6 |

Candidats évidents pour la suite : dernières notes du carnet, récompenses du jour, bloc-notes libre,
compteur de séances par classe, raccourci « reprendre la dernière séance ».

### 2.2 Architecture proposée

```
src/components/home/
  homeModules.tsx        registre : id, titre, description, tailles, composant
  HomeDataContext.tsx    useHomeData() : toutes les requêtes de l'accueil, une seule fois
  HomeGrid.tsx           rendu de la grille + mode édition
  ModuleLibrary.tsx      tiroir « Ajouter un module »
  modules/
    StudentAlertsModule.tsx
    RecentSessionsModule.tsx
    TimetableModule.tsx
    ...
```

**Registre** — un module se déclare une fois, tout le reste en découle (bibliothèque, défauts, rendu) :

```ts
export interface HomeModuleDef {
  id: string;                       // identifiant stable, jamais renommé
  title: string;
  description: string;              // affiché dans la bibliothèque
  icon: string;
  default: { w: number; h: number };
  minW?: number; minH?: number; maxW?: number; maxH?: number;
  Component: React.FC<{ height: number; compact: boolean }>;
}
```

**Données** — `HomeDataProvider` reprend telles quelles les requêtes actuelles du Dashboard et les
expose par contexte. Un module ne requête rien lui-même (sinon huit modules = huit fois les mêmes
appels Supabase). Les modules coûteux et optionnels (Pronote) restent chargés à la demande.

**Persistance** — nouvelle table générique, qui resservira pour les préférences du tableau blanc
(lot D de la roadmap tableau, aujourd'hui en attente faute d'endroit où stocker des prefs par compte) :

```sql
-- supabase-migrations/042_user_preferences.sql
create table user_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table user_preferences enable row level security;
create policy "own prefs" on user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Valeur stockée sous la clé `home_layout` :

```json
{
  "version": 1,
  "items": [
    { "i": "kpi-implication", "x": 0, "y": 0, "w": 4, "h": 2 },
    { "i": "student-alerts",  "x": 0, "y": 2, "w": 8, "h": 6 }
  ],
  "hidden": ["timetable"]
}
```

Lecture : cache `localStorage` d'abord (affichage immédiat, et l'app doit rester utilisable hors ligne),
puis rafraîchissement depuis Supabase. Écriture : différée de ~800 ms après la dernière manipulation,
dernier écrivain gagnant via `updated_at` — pas de fusion fine, le conflit PC/téléphone est rare et
sans gravité ici.

**Fusion avec les défauts** au chargement : tout module du registre absent du layout enregistré et
non listé dans `hidden` est ajouté en bas ; tout identifiant inconnu du registre est ignoré
silencieusement. C'est ce qui permet de livrer de nouveaux modules sans casser une page personnalisée.

**Mode édition** — bouton « Personnaliser » à côté du titre « Accueil ». En édition : grille visible,
poignées de redimensionnement, croix de retrait, tiroir des modules disponibles, boutons
« Réinitialiser » et « Terminé ». Hors édition, `HomeGrid` rend une simple grille CSS : zéro surcoût.

**Responsive** — on ne stocke **qu'un seul** layout (bureau, 12 colonnes). En dessous de 1100 px, la
grille s'aplatit en une colonne dans l'ordre de lecture du layout (haut→bas, gauche→droite) et
l'édition de position est désactivée — sur téléphone, seuls « masquer » et « réordonner » ont du sens.
C'est exactement le compromis retenu par Home Assistant, et ça nous évite de maintenir trois layouts.

### 2.3 Ce qui devient plus simple ensuite

- `Dashboard.tsx` retombe à ~150 lignes (en-tête + `HomeGrid`).
- La table `user_preferences` débloque les préférences par compte du tableau blanc.
- Chaque nouveau chantier (carnet, récompenses) peut livrer son module d'accueil sans toucher au reste.

---

## 3. Découpage en lots

| Lot | Contenu | Visible par l'utilisateur ? | Dépendance ajoutée |
|---|---|---|---|
| **0 — Socle** ✅ | `useHomeData`, registre, extraction des 10 modules, rendu en grille CSS 12 colonnes | Non (iso-visuel) | Aucune |
| **1 — Persistance** ✅ | Migration 042, hook `useUserPreference`, cache local, fusion avec les défauts, bouton « Réinitialiser » | Masquer / afficher un module | Aucune |
| **2 — Édition** ✅ | Mode édition, déplacement, redimensionnement, bibliothèque « Ajouter un module » | Oui, cœur de la demande | `react-grid-layout` (ou maison, cf. §4) |
| **3 — Finitions** | Options par module (nombre de lignes, classe filtrée…) stockées dans l'item, réordonnancement mobile, aperçus dans la bibliothèque | Oui | Aucune |
| **4 — Extension** | Nouveaux modules (carnet de notes, récompenses, bloc-notes), reprise de `user_preferences` pour le tableau blanc | Oui | Aucune |

Les lots 0 et 1 ont une valeur propre même si le 2 est repoussé : l'accueil devient lisible et chacun
peut déjà masquer ce qui ne le concerne pas (Aurélie n'a pas les mêmes blocs utiles que Thomas).

---

## 4. Décisions prises (23/09/2026)

1. **Modèle de disposition : grille libre 12 colonnes** (modèle A), via `react-grid-layout`.
   On assume le déplacement libre et le redimensionnement continu en largeur **et** en hauteur ;
   chaque module borne ses tailles (`minW`/`minH`) pour éviter les rendus tronqués.
2. **Une seule disposition par compte.** Pas de layout séparé par appareil : sous 1100 px la grille
   s'aplatit automatiquement en une colonne dans l'ordre de lecture, où l'on peut masquer et
   réordonner mais pas repositionner.
3. **Portée : l'accueil d'abord**, mais la table `user_preferences` est volontairement générique
   (couple `key`/`value` JSON) pour resservir ailleurs — préférences du tableau blanc, et plus tard
   d'autres pages si le besoin se confirme.

## 5. Risques identifiés

- **react-grid-layout sous React 19** : avertissement console connu ; à vérifier concrètement au lot 2,
  bascule vers le fork `react-grid-layout-19` si nécessaire. Point de non-retour faible : l'interface
  `{x, y, w, h}` est la même partout, changer de moteur ne touche pas le registre ni la persistance.
- **Modules à contenu long** (emploi du temps, séances récentes) : dans une grille, la hauteur est
  imposée ; il faut prévoir un défilement interne et un `minH` honnête, sinon le contenu est tronqué.
- **Modules à état** (« Mes tableaux » ouvre le `BoardWorkspace` plein écran) : vérifier qu'un module
  peut ouvrir une surcouche sans être démonté par un re-rendu de la grille.
- **Bundle** : le build principal pèse déjà 3,7 Mo ; +30 kB est négligeable, mais c'est l'occasion de
  charger les modules lourds à la demande.

---

## 6. Journal

### Lot 0 — livré le 23/09/2026

`src/components/home/` : `homeHelpers.tsx`, `homeLayout.ts`, `HomeDataContext.tsx`,
`homeModules.tsx`, `HomeGrid.tsx`, `modules/` (10 modules), `__tests__/homeLayout.test.ts` (13 tests).
`pages/Dashboard.tsx` passe de ~1 100 à ~75 lignes.

Choix faits en cours de route :
- **granularité de la grille** : `HOME_ROW_HEIGHT = 20`, `HOME_GAP = 12` (hauteur d'un module = 32h − 12).
  Calibré à l'écran pour retrouver la page du 23/09 sans trou ni contenu tronqué.
- **compactage vertical écrit à la main** (`compactLayout`) plutôt qu'attendre react-grid-layout :
  il sert dès maintenant à combler la place d'un module indisponible (Pronote déconnecté → la carte
  « Prochaine séance » disparaît et la colonne remonte) et il est couvert par les tests.
- **disponibilité déclarée par module** (`isAvailable`) : un module sans donnée pertinente n'est ni
  rendu ni provisionné en espace.
- **aplatissement sous 1100 px** via `matchMedia` : une colonne, hauteurs naturelles, pas de scroll interne.
- les modules qui débordent de leur cellule **défilent sur eux-mêmes**, en-tête de carte collant.

Non fait à ce stade (lots suivants) : la disposition n'est ni enregistrée ni modifiable — elle vient
toujours de `DEFAULT_HOME_LAYOUT` via `mergeLayout(null, ...)` dans `Dashboard.tsx`.

### Lots 1 et 2 — livrés le 23/09/2026

Entrée par **Réglages › Page d'accueil** (et non par un bouton sur la page, à la demande de Thomas) :
interrupteur par module, « Personnaliser la disposition », « Réinitialiser ».

- `supabase-migrations/042_user_preferences.sql` : table générique `(user_id, key, value jsonb)` + RLS.
  **Pas encore appliquée en prod** — tant qu'elle manque, `src/lib/userPreferences.ts` détecte l'absence
  de table et bascule silencieusement sur le cache localStorage (la personnalisation marche déjà,
  mais reste locale à l'appareil).
- `src/components/home/homeLayoutStore.ts` : état partagé entre la grille et la modale de réglages
  (`useSyncExternalStore`, pas de provider), écriture différée de 800 ms, écriture immédiate en
  sortant du mode édition.
- `HomeGrid` : hors édition, grille CSS inchangée ; en édition, `react-grid-layout` **v2** — API
  `gridConfig` / `dragConfig` / `resizeConfig`, très différente de la v1 documentée partout
  (`cols`, `draggableHandle`… n'existent plus). Les types v1 (`@types/react-grid-layout`) ont été
  désinstallés : la v2 embarque les siens.
- `HomeEditBar` : bibliothèque des modules retirés, réinitialisation, sortie du mode.
- Poignée de déplacement **flottante** au-dessus du module (et non insérée dans sa hauteur), pour que
  la taille vue en édition soit la taille réelle. Un module sans donnée affiche « Rien à afficher
  pour l'instant » au lieu de disparaître, sinon on ne pourrait plus le placer.
- **Granularité de la grille revue** : `HOME_ROW_HEIGHT` 20 → 8 px (gouttière 12), soit un cran de
  20 px au redimensionnement. Avec l'ancien cran de 32 px, la moitié des modules débordaient de
  11 à 15 px et affichaient une barre de défilement parasite.

Vérifié dans le navigateur : redimensionnement (4×4 → 6×7), retrait par la croix, remise depuis la
bibliothèque, réinitialisation, sortie du mode — chaque étape relue dans la préférence enregistrée.

Reste : appliquer la migration 042 pour que la disposition suive le compte d'un appareil à l'autre ;
lot 3 (options par module, réordonnancement mobile) et lot 4 (nouveaux modules).
