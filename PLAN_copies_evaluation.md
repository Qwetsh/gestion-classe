# Plan — Chaîne « copies d'évaluation » : scan mobile → correction PC → retour élève

> Rédigé le 01/11/2026 après lecture du code (web, mobile, Supabase en prod, Correcteur).
> Remplace `PLAN_scan_copies.md` (v1 partiellement codée, jamais utilisée).
> Statut : **validé par Thomas le 01/11/2026** (réponses aux 4 questions en §3) — lot 1 en cours.

---

## 0. Ce qui existe déjà (constaté, pas supposé)

| Élément | État réel |
|---|---|
| Tables `written_assessments`, `assessment_copy_pages`, `assessment_grades`, `assessment_series` | En prod (migrations 025, 026, 039-041). 22 évals, 399 notes, **0 page scannée**, **0 `details` rempli**, **0 note `is_validated`**, 7 évals publiées. |
| Buckets `assessment-copies` (privé, 5 Mo, jpeg/png/webp/heic) et `assessment-docs` | En prod. |
| Mobile : `services/copies/` (upload, file hors ligne JSON, purge), `stores/assessmentStore.ts`, écrans `app/(main)/assessments/{index,scan}.tsx` | **Codé mais inaccessible** : l'onglet est `HIDDEN_TAB` et aucun bouton n'y mène. D'où les 0 page. Capture = `expo-image-picker` (pas de détection de bords), compression à l'envoi (2000 px, qualité 0,8 → souvent 0,6 à 1 Mo/page). |
| Web : onglet « Évaluations » (`pages/Evaluations.tsx`, `lib/evaluationQueries.ts`) | Liste les évals (repliées par série), sujet et corrigé, copies par élève (URL signées), notes brouillon → bouton « Valider la note » une par une, carnet de notes. Pas d'état global par éval, pas de détail par question. |
| Élève : `get_student_grades(p_code, p_student_id)` + `components/StudentGrades.tsx` | Renvoie note, commentaire, statut des évals **publiées**, **sans regarder `is_validated`** et sans `details`. Pas de radar. |
| `pg_cron` + `pg_net` | Installés (1 job groupit). Utilisables pour la purge. |
| Correcteur : `sync_copies.py`, `push_grades.py`, `generer_correction.py` | `sync_copies` écrit `docs/<Eval>/<Classe>/<pseudo>_p<n>.jpg` + `_manifest.json` (élèves scannés seulement). `push_grades` envoie note, note brute et commentaire en brouillon, **pas le détail**. Le dossier Correcteur **n'est pas un dépôt git**. |

Point de vigilance : un brouillon envoyé par `push_grades.py` sur une éval **déjà publiée** est aujourd'hui visible immédiatement par l'élève. Le lot 3 corrige ça.

---

## 1. Lots livrables (un lot = une branche, une PR par dépôt concerné)

### Lot 1 — Scanner les copies sur le téléphone  *(le gros du gain)*
**Dépôts** : mobile `feat/scan-copies` (depuis `feat/reskin-direction-b`) + web/Supabase `feat/copies-schema` (migration 052).

Parcours :
1. En séance, bouton **« Copies »** dans la barre d'outils (à côté de « Oral »). Voir question Q1 pour le menu radial.
2. Choix de l'éval de la classe : celle du jour ou liée à la séance est présélectionnée ; sinon liste des évals écrites récentes ; ou **« Nouvelle éval »** (nom + barème, date du jour, trimestre courant), créée même hors ligne (UUID généré sur le téléphone, insertion mise en file).
3. Liste de la classe : **✓ scannée (n pages)** / **reste** / **absent**, compteur « 18/26 », filtre « reste ». Appui long → marquer absent (écrit `assessment_grades.status = 'absent'`).
4. Appui sur un élève → **scanner de documents ML Kit** (Google, natif Android) : détection des bords, prise auto, redressement, recadrage, plusieurs pages d'affilée, reprise et réordonnancement dans son interface.
5. Écran de relecture : vignettes, reprendre / supprimer / déplacer une page, et trois réglages par élève : **version du sujet** (v4, v5… mémorisée d'un élève à l'autre), **version adaptée** (`is_adapted`), **copie déjà annotée**. Bouton « Valider la copie » → élève suivant proposé directement.
6. Compression à la capture (~1600 px de large, JPEG ≈ 0,7, visé 300-500 Ko/page — à mesurer sur de vraies copies ; Claude réduit de toute façon les images à ~1568 px).
7. **File d'envoi robuste** : pages copiées dans le stockage persistant de l'app avant tout, envoi page par page avec reprises espacées, relance au retour du réseau et au retour au premier plan, bandeau « 12 pages en attente ». Noms de fichiers uniques (`<uuid>.jpg`) pour que réordonner ou remplacer une page ne casse rien.

Migration 052 : `written_assessments.session_id` (lien séance, facultatif) ; `assessment_grades.subject_version text`, `assessment_grades.copy_annotated boolean`.

Contraintes : nouvelle dépendance native (module Expo du scanner ML Kit, version compatible SDK 54 à vérifier) → **rebuild du dev client et de l'APK** (hors OneDrive, cf. CLAUDE.md). Le module ML Kit se télécharge via les services Google au premier usage : à faire une fois sur un réseau ouvert, pas au collège.

Tests : jest (file d'attente, ordre des pages, compression, état de la liste), test manuel sur le S26 Ultra avec coupure réseau en plein envoi.

### Lot 2 — Récupérer les copies sur le PC sans extraction
**Dépôts** : web `feat/copies-suivi` + scripts du Correcteur (hors git → copie de sauvegarde avant modification).

- Onglet web « Évaluations » : tableau par éval × classe avec l'état **Scannée x/y · Corrigée · Validée · Publiée** (calculé, pas stocké), la séance liée, et une visionneuse de copies par élève (pages dans l'ordre, zoom, élève suivant/précédent, liste des non-scannés et des absents).
- `sync_copies.py` :
  - `--series <id>` (toutes les classes d'une éval en une fois) et `--dest <dossier de l'éval>` pour écrire directement dans `docs/2026-2027/<Niveau> - S<n> …/copies/<classe>/` comme l'attend la skill ;
  - **téléchargement incrémental** (ne retélécharge pas ce qui est déjà là) ;
  - `_manifest.json` enrichi : tous les élèves de la classe avec statut (scanné / absent / manquant), version du sujet, adapté, copie annotée. Les champs actuels restent → `push_grades.py` continue de marcher tel quel.
- Skill `/corriger` : section « Copies venant de l'app » → on saute l'identification des pages (le manifeste fait foi), les absents sont pris dans le manifeste, `bareme_<version>.json` choisi par élève selon sa version du sujet (petite évolution de `generer_correction.py`).

Tests : pytest sur la construction du manifeste et le choix du barème (Supabase simulé), vitest sur le calcul d'état.

### Lot 3 — Retour détaillé aux élèves
**Dépôts** : web/Supabase `feat/copies-retour` (migration 053) + Correcteur.

- Format `assessment_grades.details` (v1), produit par `generer_correction.py` dans `grades_<classe>.json` et envoyé par `push_grades.py` :
  ```json
  { "v": 1, "bareme_total": 28, "version": "v5",
    "questions": [{ "label": "Schéma branchie", "bareme": 5, "points": 2.5,
                    "commentaire": "…", "competences": ["Langages scientifiques"] }],
    "competences": [{ "nom": "Raisonner en sciences", "niveau": "Satisfaisante" }],
    "forces": "…", "faiblesses": "…", "commentaire": "…" }
  ```
- Prof (web) : fiche détaillée de chaque brouillon, retouche possible, **« Valider »** par élève ou **« Valider toute la classe »**, puis **« Publier »** distinct (refusé tant qu'il reste des brouillons, sauf confirmation explicite).
- Élève : sous la note, détail par question, forces / faiblesses / commentaire, **radar des compétences** (recharts, déjà dans le projet, 4 niveaux).
- Migration 053 :
  - `get_student_grades` renvoie `details` et **ne montre note/commentaire/détail que si `is_validated`** (lire `pg_get_functiondef` avant, cf. piège des signatures) ;
  - la saisie à la main dans le carnet compte comme validée (`saveGrade` met `is_validated = true`) ;
  - **rattrapage** : les 399 notes existantes passent à `is_validated = true` pour que les élèves continuent de voir exactement ce qu'ils voient aujourd'hui.

Tests : vitest (validation/publication, rendu détail + radar), pytest (`details` conforme), test SQL de la RPC (brouillon invisible, validé visible).

### Lot 4 — Suppression automatique des scans
**Dépôts** : web/Supabase `feat/copies-purge` (migration 054 + Edge Function).

- `written_assessments.published_at` (posé par trigger quand on publie), `copies_purge_at` (= publication + 30 jours, modifiable), `copies_purged_at`.
- Edge Function `purge-assessment-copies` (clé service) : supprime les fichiers du bucket puis les lignes `assessment_copy_pages`, et pose `copies_purged_at`. Appelée chaque nuit par `pg_cron` via `pg_net` (secret partagé). Supabase interdit d'effacer les fichiers directement en SQL, d'où l'Edge Function.
- Web : badge « copies supprimées dans 12 j », boutons **« Garder 30 j de plus »** (contestation) et **« Supprimer maintenant »**. Les notes et le détail restent : seuls les scans partent.
- Mobile : la file locale ignore et nettoie les pages d'une éval purgée.

Tests : test de la fonction sur une éval de test (fichiers et lignes supprimés, notes intactes), vitest du badge.

---

## 2. Ordre conseillé
1 → 2 → 3 → 4. Le lot 1 seul supprime déjà les problèmes de poids, de noms, de pages mélangées et de fichiers mal nommés ; le lot 2 peut démarrer en parallèle si Thomas le souhaite (fichiers distincts).

## 3. Décisions de Thomas (01/11/2026)
- Q1 → **barre de séance + raccourci radial** une fois l'éval choisie.
- Q2 → **30 jours après publication**, prolongeable de 30 j.
- Q3 → **l'élève ne voit que les notes validées** ; les notes existantes passent validées d'office.
- Q4 → **scripts du Correcteur modifiables**, avec sauvegarde des originaux avant.

### Questions posées
- **Q1. Menu radial.** Le menu radial s'ouvre sur *un* élève et a 4 directions. Proposition : bouton « Copies » dans la barre de séance (parcours complet ci-dessus) **et**, en raccourci, « Scanner sa copie » dans le sous-menu de l'élève quand une éval est déjà choisie. Ou tout dans la barre ?
- **Q2. Délai de suppression.** 30 jours après publication (défaut proposé), fin de trimestre, ou le plus tardif des deux ?
- **Q3. Notes visibles.** OK pour : l'élève ne voit que les notes validées, les notes déjà saisies passent « validées » d'office (rien ne change pour les élèves) ?
- **Q4. Correcteur.** OK pour modifier `sync_copies.py`, `push_grades.py`, `generer_correction.py` et la skill (sauvegarde avant, puisque ce dossier n'est pas versionné) ?

## 4. Hors périmètre
Pronote (saisie manuelle), iPhone/PWA (le scanner ML Kit est Android), correction dans l'app elle-même.
