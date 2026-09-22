# PLAN — Carnet de notes

> Rédigé le 22/09/2026, **révisé le même jour** après relecture critique (voir §11 pour le
> détail des corrections). Objectif : disposer d'une copie des notes élèves **hors Pronote**,
> conformément à la consigne reçue.

---

## 1. Objectif et parti pris

**Besoin exprimé :** ne pas avoir Pronote comme unique dépôt des notes.

**Parti pris retenu (décision du 22/09/2026) : saisie dans l'app d'abord.**
Les notes se tapent dans le carnet de l'app, puis sont recopiées dans Pronote.
Pronote reste le support officiel vis-à-vis de l'administration et des familles ;
l'app devient l'outil de travail **et** la sauvegarde.

### Ce qui satisfait réellement la consigne — et à quel moment

Point important, mal formulé dans la première version de ce plan :

| Niveau | Protège contre | Livré au |
|---|---|---|
| Notes saisies dans l'app (Supabase) | **Compromission ou indisponibilité de Pronote** ← la consigne | **Lot 2** |
| Export fichier téléchargé localement | Perte du compte Supabase, fausse manip, erreur de l'app | Lot 3 |
| Dépôt automatique OneDrive | Oubli d'exporter, perte du PC | Lot 5 (confort) |

**La consigne du collège est honorée dès le lot 2**, pas au lot « sauvegarde ».
Les notes sont alors dans un second système, indépendant de Pronote. Tout le reste est
de la défense en profondeur — utile, mais pas le chemin critique. Conséquence directe :
**livrer 1+2 vite**, ne pas bloquer la valeur derrière l'export.

Autres conséquences du parti pris :
- pas de dépendance à une API Pronote fragile (voir §7) ;
- la saisie doit être **rapide**, sinon la feature meurt — c'est le critère n°1, et il est
  mesuré (§8) ;
- l'export doit fonctionner **sans aucune dépendance externe** : un téléchargement de fichier,
  d'abord. OneDrive ensuite (§6.3).

### Décisions actées

| # | Question | Décision |
|---|---|---|
| D1 | Source de vérité | Saisie dans l'app, recopie manuelle dans Pronote |
| D2 | Périmètre | Notes chiffrées + coefficients + duplication sur un niveau + statistiques |
| D3 | Sauvegarde | Export XLSX/PDF **téléchargé** ; dépôt OneDrive en complément |
| D4 | Mobile | Lot ultérieur (web d'abord) |
| D5 | Compétences (niveaux de maîtrise) | Hors périmètre — `details JSONB` reste disponible pour plus tard |
| D6 | Visibilité élève | Non au MVP. À rouvrir via `class_student_tabs` si besoin |

### Décisions encore ouvertes — à trancher par Thomas

| # | Question | Pourquoi ça compte |
|---|---|---|
| **O1** | Un « non rendu » compte-t-il comme un zéro ? | Change les moyennes. Choix pédagogique, pas technique (§4) |
| **O2** | Que fait-on des notes du trimestre 1 déjà dans Pronote ? | Sans réponse, la sauvegarde est partielle sans que rien ne l'indique (§10) |
| **O3** | Une éval de demi-classe affiche-t-elle la classe entière ou le seul groupe ? | Détermine les lignes du carnet (§5.2) |

---

## 2. État des lieux — ce qui existe déjà

La feature n'est pas à créer de zéro : l'essentiel du schéma est posé depuis les migrations 025/026.

| Brique | Origine | Contenu |
|---|---|---|
| `written_assessments` | migration 025 | `class_id`, `name`, `subject`, `date`, `bareme_total`, `subject_path`, `correction_path`, `is_deleted` |
| `assessment_grades` | migration 026 | `grade` (/20), `grade_raw`, `comment`, `details JSONB`, `is_validated`, `validated_at`, `UNIQUE (assessment_id, student_id)` |
| `assessment_copy_pages` | migration 025 | scans de copies nominés par élève |
| `trimester_settings` | migration 003 | **`current_trimester` + `school_year` — source unique de la période courante** |
| `trimester_grades` | migration 003 | note de participation archivée par trimestre |
| `oral_evaluations` | migration 010 | note d'oral 1-5 par trimestre |
| Page `/evaluations` | `pages/Evaluations.tsx` (429 l.) | une éval à la fois : sujet, corrigé, copies, notes |
| `lib/evaluationQueries.ts` | — | `fetchAssessments` (filtre déjà `is_deleted = false`), `createAssessment`, `fetchAssessmentGrades`, `validateGrade`, `uploadAssessmentDoc` |
| `getCurrentSchoolYear()` | `lib/liveSessionQueries.ts` | helper d'année scolaire déjà utilisé partout |
| `xlsx` | `package.json` | déjà en dépendance (import élèves) → réutilisable pour l'export |
| `levelFromClassName()` | `lib/boardsQueries.ts:40` | `"5e2"` → `"5e"`. **Ne reconnaît que 6/5/4/3, rend `null` sinon** |
| `lib/oneDrive.ts` | — | MSAL + Graph, **lecture seule**, et **`clientId` Azure non renseigné à ce jour** |
| `lib/generateReport.ts` | — | génération PDF existante, modèle à suivre |

### Ce qui manque

1. **La vue carnet** — aujourd'hui une éval à la fois ; il faut le tableau `élèves × évals`.
2. **Des évals sans scan** — `assessment_grades` est aujourd'hui l'aboutissement du pipeline
   de correction de copies. La majorité des notes n'auront jamais de copie scannée.
3. **Périodes et coefficients** — absents de `written_assessments` → aucune moyenne calculable.
4. **La série d'évals** — `class_id` est `NOT NULL` et mono-classe.
5. **Le motif d'absence de note** — `grade NULL` ne distingue pas *absent*, *dispensé*,
   *non rendu* et *pas encore corrigé*.
6. **L'export** — rien n'existe.

---

## 3. Modèle de données — migration 039

### 3.1 Le schéma

```sql
-- ============================================================
-- 1. Série : une même éval déclinée sur plusieurs classes d'un niveau
--    Porte le sujet et le corrigé : ils sont communs par nature.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.assessment_series (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  level           TEXT,              -- "5e", "4e"… ou NULL (sélection manuelle)
  school_year     VARCHAR(9) NOT NULL,
  subject_path    TEXT,              -- user_id/series/{seriesId}/subject.pdf
  correction_path TEXT,              -- user_id/series/{seriesId}/correction.pdf
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. Évaluation : période, coefficient, type, rattachement série
-- ============================================================
ALTER TABLE public.written_assessments
  ADD COLUMN IF NOT EXISTS series_id         UUID REFERENCES public.assessment_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period            SMALLINT,
  ADD COLUMN IF NOT EXISTS school_year       VARCHAR(9),
  ADD COLUMN IF NOT EXISTS coefficient       NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS kind              TEXT NOT NULL DEFAULT 'ecrit',  -- ecrit|tp|oral|dm|projet
  ADD COLUMN IF NOT EXISTS group_id          UUID REFERENCES public.class_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS counts_in_average BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 3. Note : motif d'absence de note (absent != zéro)
--    N.B. `status` ne dit PAS si la note est validée : c'est `is_validated`,
--    qui reste le cycle de vie du pipeline de correction de copies.
-- ============================================================
ALTER TABLE public.assessment_grades
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'noted';
  -- noted | absent | dispense | non_rendu
  -- « pas encore corrigé » = status 'noted' ET grade IS NULL. Pas de 4e valeur.

-- ============================================================
-- 4. BACKFILL — sans ça, les évals existantes disparaissent du carnet
-- ============================================================
UPDATE public.written_assessments wa
SET school_year = COALESCE(
      wa.school_year,
      (SELECT ts.school_year FROM public.trimester_settings ts WHERE ts.user_id = wa.user_id),
      '2026-2027'
    ),
    period = COALESCE(
      wa.period,
      (SELECT ts.current_trimester FROM public.trimester_settings ts WHERE ts.user_id = wa.user_id),
      1
    )
WHERE wa.school_year IS NULL OR wa.period IS NULL;
```

**RLS** : cloner le pattern 025/026 (`auth.uid() = user_id`, 4 policies, `DROP POLICY IF EXISTS`
avant chaque `CREATE` pour l'idempotence) sur `assessment_series`.

**Index** : `idx_wa_series ON written_assessments(series_id)`,
`idx_wa_period ON written_assessments(user_id, school_year, period)`.

**Trigger `updated_at`** sur `assessment_grades` : pour une pièce censée faire foi, savoir
*quand* une note a été modifiée n'est pas un luxe. La colonne existe et n'est alimentée
par rien aujourd'hui.

### 3.2 Pourquoi une série plutôt qu'un `class_id` nullable

Chaque classe garde **sa** ligne `written_assessments`, reliées par `series_id` :

- `assessment_copy_pages`, `assessment_grades` et les RLS existantes fonctionnent sans retouche ;
- chaque classe a sa **date** propre (les 5e2 passent l'éval le jeudi, les 5e4 le lundi) ;
- un barème peut être ajusté sur une classe sans casser les autres ;
- les statistiques inter-classes se font par `GROUP BY class_id` sur la série.

### 3.3 Le sujet et le corrigé appartiennent à la série

Le chemin actuel est `${userId}/${assessmentId}/${kind}.${ext}` (`evaluationQueries.ts:158`) :
**il contient l'id d'une évaluation**. Faire pointer les membres d'une série vers un même
chemin ferait vivre le fichier sous l'id de l'un d'eux ; sa suppression laisserait les autres
sur un orphelin, et il faudrait un comptage de références à la main avant chaque suppression.

→ **`subject_path` / `correction_path` sont portés par `assessment_series`**, sous
`${userId}/series/${seriesId}/${kind}.${ext}`. Une éval lit son propre chemin, sinon celui
de sa série. Les colonnes existantes sur `written_assessments` restent pour les évals
hors série. Aucun comptage de références, aucune suppression conditionnelle.

### 3.4 Une seule source pour l'année scolaire et la période

`trimester_settings` (`current_trimester`, `school_year`) est **la** source ; `getCurrentSchoolYear()`
en est le repli. Ces valeurs sont **pré-remplies** à la création d'une éval et modifiables,
jamais saisies à la main. Ne pas introduire de quatrième convention.

---

## 4. Statistiques

Module `lib/gradeStats.ts` : pur, testable, sans accès réseau — le volume est dérisoire
(≈30 notes × ~10 évals par classe) et la logique évoluera.

**Par éval et par classe :** moyenne, médiane, écart-type (population), min, max, Q1/Q3,
taux de réussite (% ≥ 10/20), histogramme par tranches de 2 points, effectifs par statut.

**Par série :** les mêmes indicateurs par classe, côte à côte, plus la moyenne de niveau.
C'est la vue qui répond à « est-ce que mes 5e2 ont décroché ? ».

**Par élève et par période :** moyenne pondérée par les coefficients, hors
`counts_in_average = false`, + écart à la moyenne de classe.

**Règles de calcul, à respecter dans chaque fonction :**
- `absent` et `dispense` → **exclus** du dénominateur ;
- `noted` sans note (pas encore corrigé) → **exclu** du dénominateur ;
- `non_rendu` → **selon le réglage O1** (par défaut : compte comme zéro, modifiable dans
  les préférences ; le statut reste visible pour pouvoir requalifier) ;
- aucune note exploitable → afficher « — », jamais `NaN` ni `0`.

Pour les graphiques, charger la skill `dataviz` avant d'écrire le rendu.

---

## 5. Écrans

### 5.1 Web — `/evaluations`, nouvel onglet « Carnet »

La page actuelle devient l'onglet **« Éval »** ; un onglet **« Carnet »** est ajouté.

```
┌──────────────────────────────────────────────────────────────────┐
│  Carnet    [ 5e2 ▾ ]  [ Trimestre 1 ▾ ]        [ + Éval ] [ ⬇ ]  │
├──────────────────────────────────────────────────────────────────┤
│                    │ Éval 1 │ TP 2  │ DM 1  │ Éval 2 │  Moyenne  │
│                    │ coef 2 │ coef 1│ coef 1│ coef 2 │           │
├────────────────────┼────────┼───────┼───────┼────────┼───────────┤
│ Alice D.           │  14,5  │  16   │  12   │  [__]  │   14,5    │
│ Bastien M.         │   8    │  abs  │  11   │  [__]  │    9,0    │
│ Chloé R.           │  17    │  15,5 │  n.r. │  [__]  │   12,8    │
├────────────────────┼────────┼───────┼───────┼────────┼───────────┤
│ Moyenne classe     │  12,4  │  13,1 │  11,8 │   —    │   12,6    │
│ Médiane            │  12,0  │  13,5 │  12,0 │   —    │           │
└──────────────────────────────────────────────────────────────────┘
```

**Saisie clavier — le point critique.**
- `Entrée` / `↓` → élève suivant, cellule en édition ; `Tab` → éval suivante, même élève ;
- `a` absent, `d` dispensé, `n` non rendu ;
- virgule et point acceptés comme séparateur décimal ;
- si `bareme_total ≠ 20` : on saisit la **note brute** (`grade_raw`), le /20 calculé s'affiche en gris ;
- écriture différée (~400 ms) **avec flush obligatoire sur blur, démontage et `beforeunload`** —
  sinon la dernière note saisie est perdue en quittant la page ;
- rejet visuel immédiat si note > barème ou < 0.

Clic sur l'en-tête d'une éval → panneau latéral : renommer, coef, date, période, type,
`counts_in_average`, statistiques + histogramme, sujet/corrigé, copies scannées.

Le carnet filtre `is_deleted = false` (comme `fetchAssessments`) et
`school_year = <année courante>`.

### 5.2 Quelles lignes affiche le carnet

Règle explicite, à implémenter telle quelle :
- **élèves actuellement rattachés à la classe** (`students.class_id = <classe>`), triés par `pseudo` ;
- une éval avec `group_id` n'affiche que les élèves du groupe — **sous réserve de O3** ;
- un élève arrivé après l'éval : ligne présente, cellule vide, statut par défaut `dispense`
  (il ne doit pas être pénalisé pour une éval qu'il n'a pas passée) ;
- un élève **détaché** (`class_id → SET NULL` au passage d'année, cf. `project_year_transition`) :
  ses notes existent toujours en base et restent visibles sur sa fiche, mais il ne figure plus
  dans le carnet de la classe. À vérifier explicitement au premier passage d'année.

### 5.3 Création d'une éval — duplication sur le niveau

```
Classes concernées
  ( ) Cette classe seulement          [ 5e2 ▾ ]
  (•) Toutes les classes de 5e        ☑ 5e1  ☑ 5e2  ☑ 5e4  ☐ 5e5
      → crée 3 évaluations liées (sujet et barème communs, dates modifiables ensuite)
```

Le niveau vient de `levelFromClassName()`. **Celle-ci ne reconnaît que 6/5/4/3 et rend `null`
pour un AP, un club ou une remédiation** → dans ce cas, pas de proposition par niveau :
on dégrade en **sélection manuelle multi-classes**, qui doit donc exister de toute façon.

Modifier coefficient, barème ou sujet d'une éval de série propose
**« appliquer aux N classes de la série ? »**. Jamais de propagation silencieuse.

### 5.4 Fiche élève — `pages/Students.tsx`

Bloc **« Notes »** à côté de la participation et de l'oral : évals de la période avec note,
coef, moyenne de classe, écart, et moyenne générale pondérée.

### 5.5 Mobile — lot ultérieur (D4)

Saisie depuis le plan de classe (oral, TP) via bottom sheet Direction B, offline-first.
Hors périmètre des lots 1 à 6.

---

## 6. Export et sauvegarde

### 6.1 Ce qu'on protège, et dans quel ordre

Rappel du §1 : les notes sont déjà hors Pronote dès qu'elles sont saisies. L'export protège
d'autre chose (perte du compte Supabase, fausse manip) et se construit **du plus fiable
au plus confortable**.

### 6.2 Export local — aucune dépendance (lot 3)

**XLSX** (via `xlsx`, déjà présent) : un onglet par classe (élèves × évals + moyennes),
un onglet « Récapitulatif » (moyenne par élève et par période), un onglet « Métadonnées »
(date d'export, année scolaire, compte, nombre de notes) — indispensable pour établir
l'antériorité d'un export.

**PDF** (via `pdf-lib`, sur le modèle de `lib/generateReport.ts`) : version imprimable,
horodatée en pied de page.

> Rappel projet : `pdf-lib.save()` renvoie un `Uint8Array<ArrayBufferLike>` incompatible avec
> `BlobPart` en TS 5.9 → `bytes.buffer as ArrayBuffer`.

Ces deux exports se **téléchargent**. Ils fonctionnent sans compte tiers, sans réseau autre
que Supabase, sans configuration. C'est le filet réel.

### 6.3 Dépôt OneDrive — confort, et dépendance non vérifiée (lot 5)

⚠️ **`lib/oneDrive.ts` est en lecture seule et son `clientId` Azure n'est toujours pas
renseigné** (cf. `project_onedrive_resources` : flux OAuth jamais testé de bout en bout).
Ce lot ne peut donc pas être planifié comme acquis, et **rien d'autre ne doit en dépendre**.

À ajouter :

```ts
export async function uploadOneDrive(
  token: string, folderPath: string, fileName: string, content: Blob
): Promise<OneDriveItem>
```

→ `PUT /me/drive/root:/{folderPath}/{fileName}:/content` (suffisant sous 4 Mo, très largement
le cas ici : pas de session d'upload fragmentée).

```
OneDrive/Gestion classe/Notes/2026-2027/notes_2026-09-22.xlsx
```

**Déclenchement** : au chargement du Carnet, si le dernier dépôt réussi (mémorisé en
`localStorage`) date de plus de 7 jours **et** que `connectOneDrive(keys, false)` rend une
session, export + upload silencieux, avec un discret « Sauvegardé le … ». Plus un bouton
« Sauvegarder maintenant ».

Snapshots **horodatés, jamais écrasés**.

**Échec silencieux interdit.** Token MSAL expiré (`OneDriveExpiredError` existe déjà), réseau,
quota : un bandeau persistant doit le dire. Une sauvegarde qu'on croit active et qui ne tourne
plus depuis trois mois est pire que pas de sauvegarde.

### 6.4 Données personnelles

`students` ne contient qu'un `pseudo` (prénom + 2 lettres du nom) : il n'y a pas de nom complet
à protéger dans l'export — la pseudonymisation est native au modèle. Deux points réels :

- l'export doit rester **ré-appariable** à tes élèves, sinon il ne sert à rien : le `pseudo`
  suffit puisqu'il vient de l'import Pronote/Excel. Ne pas « anonymiser » davantage ;
- un fichier de notes déposé dans un OneDrive personnel reste une donnée scolaire :
  dossier non partagé, et ne pas y ajouter de commentaires d'appréciation au-delà du nécessaire.

---

## 7. Pronote — ce qui est possible, ce qui ne l'est pas

`pawnote` expose `gradebook()`, `gradesOverview()` et `evaluations()`
(`node_modules/pawnote/dist/index.d.ts`), **mais pour un compte élève ou parent** : les notes
*reçues*. Le compte ici est `AccountKind.TEACHER` (8), et la saisie professeur passe par
d'autres requêtes que pawnote ne modélise pas.

**Aucun import automatique au périmètre de ce plan.** La décision D1 rend la dépendance inutile.

Filets possibles plus tard, par coût croissant :
1. **import du XLSX/CSV exporté par Pronote** — la logique d'import Excel existe déjà
   (import élèves), rapprochement par `pseudo` comme au passage d'année ;
2. exploration du trafic d'un compte prof — non recommandé : casse à chaque mise à jour de Pronote.

La page `/pronote` reste inchangée (connexion + emploi du temps).

---

## 8. Critères d'acceptation

La feature n'est pas « finie » tant que ceci n'est pas vrai :

| # | Critère | Mesure |
|---|---|---|
| A1 | **Saisir 28 notes prend moins de 2 minutes, sans toucher la souris** | Chronométré sur une vraie classe. Aligné sur la culture du projet (≤ 2 s par action) |
| A2 | Quitter la page juste après une frappe ne perd pas la note | Test manuel : taper, `Ctrl+W` immédiat, rouvrir |
| A3 | Un élève absent ne fait pas baisser sa moyenne | Test unitaire `gradeStats` |
| A4 | Les évals créées avant la migration 039 restent visibles | Vérifié en prod après backfill |
| A5 | L'export téléchargé se rouvre dans Excel et contient toutes les notes | Test manuel, une fois par trimestre |
| A6 | Un échec de dépôt OneDrive est visible à l'écran | Test : révoquer le token, recharger |

---

## 9. Découpage en lots

| Lot | Contenu | Charge estimée |
|---|---|---|
| **1 — Socle** | Migration 039 (série, période, coef, kind, status, **backfill**, trigger `updated_at`) + RLS + index. Extension de `lib/evaluationQueries.ts`. `lib/gradeStats.ts` **avec tests unitaires**. | ~1 j |
| **2 — Carnet web** | Onglet « Carnet » : tableau, saisie clavier (A1, A2), statuts, moyennes/médianes en pied. **→ consigne du collège honorée ici.** | ~2 j |
| **3 — Export local** | XLSX + PDF téléchargés. Aucune dépendance externe. | ~1 j |
| **4 — Séries & stats** | Création multi-classes (par niveau ou manuelle), propagation explicite, panneau stats + histogramme, comparaison inter-classes. | ~1,5 j |
| **5 — Dépôt OneDrive** | `uploadOneDrive()`, dépôt hebdomadaire, bandeau d'échec. **Bloqué tant que le `clientId` Azure n'est pas fourni et le flux OAuth validé.** | ~0,5 j + déblocage |
| **6 — Fiche élève** | Bloc « Notes » dans `Students.tsx`, moyenne pondérée, écart à la classe. | ~0,5 j |
| **7 — Mobile** *(ultérieur)* | Saisie depuis le plan de classe, offline-first, tables à ajouter au jeu de sync. | — |

Ordre imposé : 1 → 2 (le reste peut se réordonner). Le lot 5 ne doit bloquer aucun autre.

---

## 10. Reprise de l'existant — à trancher (O2)

On est le **22/09/2026**, le trimestre 1 est commencé. Sans import, les notes déjà saisies
dans Pronote ne seront pas dans l'app : la sauvegarde démarrerait **incomplète**, et rien
ne le signalerait — c'est précisément le scénario contre lequel la feature est censée protéger.

Trois positions possibles :
1. **Ressaisir** le trimestre 1 dans le carnet (quelques dizaines de notes, une soirée) ;
2. **Assumer** que la sauvegarde démarre à sa mise en service — et l'afficher explicitement
   dans l'onglet Métadonnées de l'export (« couverture à partir du … ») ;
3. **Développer l'import CSV** dès le lot 3, ce qui rouvre partiellement D1.

Recommandation : **2 pour démarrer, 1 quand tu as un moment.** Le 3 n'a de sens que si
l'export Pronote s'avère propre — à vérifier sur un vrai fichier avant de s'y engager.

---

## 11. Vigilances

- **`status` n'est pas `is_validated`.** `status` dit pourquoi il n'y a pas de note ;
  `is_validated` est le cycle de vie du pipeline de scan. Ne jamais les mélanger (§3.1).
- **`absent` n'est pas `0`.** À vérifier dans chaque fonction de `gradeStats.ts` — c'est
  l'erreur qui fausse une moyenne sans que personne ne s'en aperçoive.
- **Backfill obligatoire** dans la migration, sinon les évals existantes sortent de l'écran.
- **Sujet/corrigé : sur la série**, jamais un chemin partagé entre lignes (§3.3).
- **Passage d'année.** Les notes sont rattachées à `student_id`, pas à la classe : elles
  survivent comme les tampons (cf. `project_year_transition`). Filtrer sur `school_year`
  pour ne pas mélanger les millésimes.
- **Groupes de classe.** `group_id` est prévu au schéma mais **non exploité** avant que O3
  soit tranché et que les lots 3-5 de `PLAN_groupes_classe.md` soient livrés.
- **Ne pas dépendre de Pronote.** Toute la valeur vient de ce que ça fonctionne quand
  Pronote ne fonctionne plus. Corollaire : **ne pas dépendre de OneDrive non plus.**

---

## 12. Corrections apportées à la v1 de ce plan (22/09/2026)

Relecture critique. Ce qui a changé et pourquoi :

| # | Défaut de la v1 | Correction |
|---|---|---|
| 1 | Le lot « sauvegarde » reposait entièrement sur OneDrive, intégration jamais testée et sans `clientId` | Export local téléchargé en lot 3 ; OneDrive isolé en lot 5, bloquant personne (§6) |
| 2 | « Lot 4 = objectif atteint » — faux | La consigne est honorée au **lot 2** : les notes sont alors hors Pronote (§1) |
| 3 | `status` contenait `a_corriger`, en recouvrement avec `is_validated` | `a_corriger` supprimé = `grade IS NULL AND status='noted'` (§3.1) |
| 4 | Migration sans backfill → évals existantes invisibles | `UPDATE` de backfill dans la migration (§3.1) |
| 5 | Sujet de série : chemin partagé + comptage de références manuel | `subject_path` porté par la série, chemin dédié (§3.3) |
| 6 | 4ᵉ convention d'année scolaire introduite | `trimester_settings` = source unique (§3.4) |
| 7 | « non rendu = 0 » décidé unilatéralement | Devient la question ouverte O1, réglable (§4) |
| 8 | Vigilance RGPD sur des noms complets… qui n'existent pas en base | Remplacée par les deux vrais points (§6.4) |
| 9 | Lignes du carnet jamais définies | Règle explicite + question O3 (§5.2) |
| 10 | Reprise du trimestre déjà entamé non traitée | Nouveau §10 + question O2 |
| 11 | `is_deleted` non mentionné | Filtré dans le carnet (§5.1) |
| 12 | Debounce sans flush → dernière note perdue | Flush sur blur / démontage / `beforeunload` (§5.1), critère A2 |
| 13 | Ni estimation ni critère d'acceptation | §8 et charges au §9 |
| 14 | Duplication par niveau supposée toujours possible | `levelFromClassName` rend `null` hors 6/5/4/3 → sélection manuelle (§5.3) |
| 15 | `updated_at` alimenté par rien | Trigger ajouté (§3.1) |
