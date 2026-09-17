# Plan — Scan de copies depuis le mobile → correction par Claude

> Objectif : scanner les copies d'éval depuis l'app mobile au moment de la récupération,
> les stocker dans Supabase **déjà nominées** (liées à l'élève), les consulter sur le web,
> puis les récupérer depuis Claude terminal (PC) pour correction automatique.
>
> Statut : **plan validé, implémentation à venir** (rédigé après lecture du code existant).

---

## 0. Principe & gain

Aujourd'hui, le point pénible de la correction n'est PAS la correction elle-même mais le
**découpage d'un PDF fusionné** (retrouver qui est qui, en-têtes illisibles, pages orphelines,
homonymes). En capturant chaque copie **par élève** dès la récupération, ce problème disparaît :
les copies arrivent nominées et groupées, et le pipeline de correction existant tourne directement.

**Constat clé du code** : les élèves sont déjà **pseudonymisés** (`students.pseudo` = prénom + lettres
du nom, RGPD). C'est exactement le « prénom + 1ʳᵉ lettre » voulu. Une copie liée à `student_id` est
donc déjà nominée par son pseudo. Et le pattern d'upload d'images existe déjà
(`gestion-classe-mobile/services/photos/index.ts` → bucket privé + RLS par `user_id`). On calque dessus.

---

## 1. Décisions retenues (défauts recommandés — à confirmer le jour J)

| # | Décision | Choix recommandé |
|---|----------|------------------|
| 1 | Entité éval écrite | Créer une table dédiée `written_assessments` (ne pas surcharger `trimester_grades`). |
| 2 | Stockage fichiers | Nouveau bucket privé `assessment-copies` (séparé de `student-photos`). |
| 3 | Périmètre v1 | Mobile (scan + upload) + script PC de sync. Web (consultation) et write-back des notes = phase 2. |
| 4 | Projet Supabase | Celui déjà connecté (vérifier via les outils Supabase / MCP avant migration). |

---

## 2. Modèle de données — migration `supabase-migrations/018_assessment_copies.sql`

Conventions respectées : `uuid-ossp`, `user_id REFERENCES auth.users`, RLS `auth.uid() = user_id`, `is_deleted`.

```sql
-- Migration: Assessment copies (scans de copies d'evaluations ecrites)

-- 1. Evaluations ecrites (devoirs)
CREATE TABLE IF NOT EXISTS public.written_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- ex: "Eval Nutrition"
  subject TEXT,                       -- ex: "SVT"
  date DATE,
  bareme_total NUMERIC DEFAULT 20,    -- bareme brut (ex: 28), ramene /20 a la correction
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- 2. Pages de copies (1 ligne par page scannee)
CREATE TABLE IF NOT EXISTS public.assessment_copy_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.written_assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  page_order INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,         -- user_id/{assessmentId}/{studentId}/{page}.jpg
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, student_id, page_order)
);

CREATE INDEX IF NOT EXISTS idx_wa_user_id ON public.written_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_class_id ON public.written_assessments(class_id);
CREATE INDEX IF NOT EXISTS idx_acp_assessment ON public.assessment_copy_pages(assessment_id);
CREATE INDEX IF NOT EXISTS idx_acp_student ON public.assessment_copy_pages(student_id);

-- 3. RLS
ALTER TABLE public.written_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_copy_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own written_assessments" ON public.written_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own written_assessments" ON public.written_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own written_assessments" ON public.written_assessments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own written_assessments" ON public.written_assessments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own copy_pages" ON public.assessment_copy_pages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own copy_pages" ON public.assessment_copy_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own copy_pages" ON public.assessment_copy_pages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own copy_pages" ON public.assessment_copy_pages
  FOR DELETE USING (auth.uid() = user_id);
```

### Bucket Storage (Dashboard ou SQL)
- Nom : `assessment-copies` — **Public : false** — limite ~5 Mo/fichier — MIME `image/*`.
- Chemin fichier : `user_id/{assessmentId}/{studentId}/{page}.jpg`.
- 4 policies storage **identiques au pattern `student-photos`** (cf. `006_student_photos.sql`), en
  remplaçant `bucket_id = 'student-photos'` par `bucket_id = 'assessment-copies'` (filtre `(storage.foldername(name))[1] = auth.uid()`).

---

## 3. Mobile (Expo) — capture + upload

### 3.1 Service `services/copies/index.ts` (copie du pattern `services/photos`)
- ⚠️ **Nouveau profil de compression `assessment`** (le point le plus important) :
  les profils actuels (300/600 px) sont trop bas pour de l'écriture manuscrite.
  ```ts
  assessment: { maxWidth: 2000, maxHeight: 2000, jpegQuality: 0.8 }
  ```
  (resize en gardant le ratio : passer seulement `width`, pas `height`, dans `manipulateAsync`.)
- Fonctions : `pickFromCamera()` (réutilisable, mais **`allowsEditing` sans `aspect: [1,1]`** — une copie n'est pas carrée),
  `uploadCopyPage(userId, assessmentId, studentId, pageOrder, uri)`,
  `listCopyPages(assessmentId, studentId)`, `getCopyPageUrl(path)`, `deleteCopyPage(path)`.
- Insère une ligne `assessment_copy_pages` après chaque upload réussi.

### 3.2 Store `stores/assessmentStore.ts` (Zustand, comme les autres stores)
- CRUD `written_assessments`, liste des élèves d'une classe avec compteur de pages scannées.

### 3.3 Écran de scan `app/(main)/assessments/scan.tsx`
Flux :
1. Choisir / créer l'évaluation (nom, classe, barème).
2. Liste des élèves de la classe (pseudos) avec une pastille « X pages » + état (✓ scannée / vide).
3. Tap élève → caméra → photo → (option « + page » pour enchaîner) → upload en tâche de fond.
4. Indicateur de progression d'upload ; possibilité de re-scanner/supprimer une page.

### 3.4 Offline-first
- Réutiliser `syncStore` + `networkStore` + `expo-file-system` : si hors-ligne, **garder l'URI locale en file d'attente**
  et uploader à la reconnexion. Ne jamais perdre une copie scannée (NFR offline du projet).

---

## 4. Web (React/Vite) — consultation (phase 2)
- Page `src/pages/Evaluations.tsx` : liste des `written_assessments` par classe.
- Détail d'une éval : grille des élèves → vignettes des pages (signed URLs via supabase-js), zoom, ordre des pages.
- Permet de vérifier la complétude des scans avant de lancer la correction.

---

## 5. PC ↔ Claude terminal — sync + correction

### 5.1 Script `scripts/sync_copies.py` (côté Correcteur, ou dans le repo app)
- Entrées : `--assessment <id>` (ou `--class 5A --eval "Nutrition"`).
- Auth : **clé service-role** Supabase (dans `.env` local PC, jamais commitée) — lecture seule logique.
- Pour chaque ligne `assessment_copy_pages` de l'éval :
  - récupère `pseudo` de l'élève (jointure `students`),
  - télécharge le fichier Storage,
  - écrit `docs/[Eval]/[Classe]/{pseudo}_p{page}.jpg` (ou un sous-dossier par élève).
- Résultat : arborescence **déjà nominée et groupée** → le pipeline de correction actuel tourne tel quel
  (PNG → correction multi-agent → Word avec accents + absents → Excel), **sans étape de découpage**.

### 5.2 Intégration correcteur
- Le mapping page→élève est fourni par la DB → on supprime toute la phase d'identification/segmentation.
- On garde la **vérification systématique des sommes** (les agents font des erreurs d'addition) et le calibrage.

### 5.3 Phase 2 — write-back des notes
- En fin de correction, un script `push_grades.py` écrit les notes /20 dans `trimester_grades`
  (ou une table `assessment_grades` liée à `written_assessments`) via Supabase → plus d'Excel manuel,
  notes visibles côté web. Boucle fermée.

---

## 6. Étapes de réalisation (ordonnées, jalons testables)

1. **DB** : écrire + appliquer `018_assessment_copies.sql` ; créer le bucket `assessment-copies` + policies.
   *Test* : insert manuel d'une ligne, upload manuel d'un fichier, signed URL OK.
2. **Mobile service** : `services/copies/` + profil HD. *Test* : upload d'une photo, fichier lisible dans Storage.
3. **Mobile store + écran scan** : créer une éval, scanner 2-3 élèves multi-pages. *Test* : pages bien rangées par `page_order`.
4. **Offline** : couper le réseau, scanner, rallumer → upload auto. *Test* : aucune perte.
5. **Script PC sync** : `sync_copies.py` → arborescence nominée locale. *Test* : noms = pseudos, ordre des pages correct.
6. **Correction** : lancer le pipeline sur l'arbo récupérée. *Test* : Word + Excel générés sans découpage.
7. **(Phase 2)** Web consultation, puis write-back notes.

---

## 7. Points de vigilance

- **Qualité image** = facteur n°1 de réussite de la correction. Profil HD (~2000 px) + recadrage à la prise.
  Tester la lisibilité d'une vraie copie manuscrite avant d'industrialiser.
- **RGPD** : bucket privé + RLS par `user_id` ; ne jamais rendre public ; clé service-role uniquement sur le PC.
  Les copies portent le nom manuscrit de l'élève (inhérent) — d'où l'importance du stockage privé.
- **Collisions de pseudo** : deux élèves même pseudo dans une classe → le lien se fait sur `student_id`
  (sélection dans la liste), pas sur le texte ; le pseudo n'est qu'un libellé. Pour le script PC, si deux
  pseudos identiques, suffixer par les 4 premiers caractères de l'`student_id`.
- **Build EAS hors OneDrive** (cf. CLAUDE.md du projet) : copier vers `C:\Users\Utilisateur\gestion-classe-build` avant `eas build`.
- **`allowsEditing`/aspect** : ne pas imposer `[1,1]` (carré) comme pour les photos d'élèves — une copie est rectangulaire.

---

## 8. Checklist fichiers à créer / modifier

**Supabase**
- [ ] `supabase-migrations/018_assessment_copies.sql` (nouveau)
- [ ] Bucket `assessment-copies` + 4 storage policies (Dashboard/SQL)

**Mobile** (`gestion-classe-mobile/`)
- [ ] `services/copies/index.ts` (nouveau, calqué sur `services/photos/index.ts`)
- [ ] `stores/assessmentStore.ts` (nouveau)
- [ ] `app/(main)/assessments/scan.tsx` (+ écran liste évals) (nouveau)
- [ ] `types/` : types `WrittenAssessment`, `AssessmentCopyPage`
- [ ] Brancher la file offline dans `services/sync` / `syncStore`

**Web** (`gestion-classe-web/`, phase 2)
- [ ] `src/pages/Evaluations.tsx` + route
- [ ] Hook de fetch des copies (signed URLs)

**PC / Correcteur**
- [ ] `scripts/sync_copies.py` (download depuis Supabase → arbo nominée)
- [ ] `.env` PC avec `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (gitignore)
- [ ] (Phase 2) `scripts/push_grades.py` (write-back notes)

---

## 9. À confirmer avant de coder
- Projet Supabase = bien celui connecté ici (inspecter le schéma live).
- Garde-t-on `trimester_grades` pour les notes, ou table `assessment_grades` dédiée ?
- v1 = mobile + sync PC ; web + write-back en phase 2 (validé par défaut).
