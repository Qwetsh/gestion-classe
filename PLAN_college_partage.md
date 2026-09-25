# Plan — Collèges partagés : récupérer les élèves d'un collègue

## Objectif

Une collègue qui arrive sur l'app (aucun élève) choisit son collège parmi ceux déjà inscrits, voit
les classes déjà saisies par les autres profs de ce collège, et **récupère les élèves** au lieu de
les ressaisir. L'élève garde **un seul code de connexion** pour tous ses profs. Une classe que
personne n'a encore saisie, elle la crée elle-même (comme aujourd'hui).

---

## 1. État actuel (vérifié sur la base `Class'it` + le code web)

| Point | Constat | Conséquence |
|---|---|---|
| Notion de collège | **N'existe pas en base.** `settings.establishment` (nom, tél, adresse) est un réglage local du prof, texte libre. | Il faut créer l'entité. |
| `students` | Une ligne = un élève **d'un prof** (`user_id`), dans **une** classe (`class_id`). | Un élève ne peut pas appartenir à 2 profs. |
| `students.student_code` | `UNIQUE` global, généré par le trigger `trg_generate_student_code`. | Deux lignes ne peuvent pas partager le code. |
| RLS | `students`, `classes`, `sessions`, `stamps`, `stamp_cards`, `trimester_grades`, `assessment_grades`… : tout est `auth.uid() = user_id`. `events` passe par `sessions.user_id`. | Toutes les données de suivi sont **par prof**. C'est sain, on n'y touche pas. |
| Espace élève | `get_student_dashboard`, `get_student_stamps`, `get_student_academy`, `select_student_bonus`, `submit_academy_test`, `get_student_grades` (SECURITY DEFINER) retrouvent l'élève par `WHERE student_code = p_code` puis prennent **son** `user_id`. | Si 2 lignes ont le même code : `SELECT … INTO` prend **une ligne au hasard, sans erreur** → l'élève voit les données d'un prof aléatoire, et `select_student_bonus` peut écrire dans la mauvaise carte. **Bug critique si on partage le code sans refaire ces RPC.** |
| Requêtes front | 36 `from('students')` côté web, toutes filtrées par `user_id`/`class_id`. | Rester sur « une ligne par prof » évite de toutes les réécrire. |
| Mobile | `gestion-classe-mobile/` est vide dans ce dépôt (projet à part). Il synchronise les élèves du prof connecté (SQLite). | À vérifier : qu'il n'envoie pas de `student_code` à l'insertion et qu'il n'a pas d'hypothèse « code unique ». |
| Données | 5 profs ont des classes (22 classes, 511 élèves). Un compte a déjà 2 classes **vides** (`6B`, `6e3 Paul Verlaine`) ; un autre travaille en **demi-groupes** (`6éme groupe 1/2`). | Le parcours doit gérer : classe cible déjà existante (vide), et classes qui ne correspondent pas 1:1 à une classe du collège. |

---

## 2. Principe retenu : identité partagée, ligne par prof

**On ne fusionne pas les élèves entre profs.** On ajoute une table `student_identities` (le « vrai »
élève du collège, porteur du code), et chaque prof garde **sa propre ligne** `students` qui pointe
vers cette identité.

```
schools ──< school_members (prof)
   │
   ├──< school_classes (5e1 2026-2027)  >── classes.school_class_id (classe du prof)
   │
   └──< student_identities (code 6 chiffres)  >── students.identity_id (ligne du prof)
```

Pourquoi ce choix plutôt qu'un élève partagé en many-to-many :

- **Zéro changement** sur les RLS existantes, les 36 requêtes front, le mobile, les tampons, notes,
  événements, plans de classe : chaque prof continue à travailler sur ses lignes.
- Le pseudo, la photo, le témoin, le plan de classe, les groupes, la maison restent propres à chaque
  prof (normal : deux profs n'ont pas le même plan de classe).
- Seul l'**espace élève** doit savoir qu'un code peut mener à plusieurs profs.

Alternative écartée : dupliquer les élèves → deux codes par élève, exactement ce qu'on veut éviter.

---

## 3. Modèle de données (migration `043_shared_schools.sql`)

```sql
-- Collège
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  uai varchar(8) UNIQUE,              -- n° RNE/UAI, optionnel mais anti-doublon
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Code d'adhésion séparé : NE DOIT PAS être lisible par les non-membres
CREATE TABLE school_join_codes (
  school_id uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  code varchar(8) NOT NULL UNIQUE,
  rotated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE school_members (
  school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,          -- affiché à l'élève : « M. Charles »
  subject text,                        -- « SVT »
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (school_id, user_id)
);
-- MVP : un prof = un collège
CREATE UNIQUE INDEX school_members_one_school ON school_members(user_id);

-- Classe « officielle » du collège, par année
CREATE TABLE school_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  school_year varchar(9) NOT NULL,
  name text NOT NULL,
  name_key text GENERATED ALWAYS AS (lower(regexp_replace(unaccent_immutable(name), '[^a-z0-9]', '', 'gi'))) STORED,
  UNIQUE (school_id, school_year, name_key)   -- « 5e1 », « 5E1 », « 5e 1 » = même classe
);
ALTER TABLE classes ADD COLUMN school_class_id uuid REFERENCES school_classes(id) ON DELETE SET NULL;

-- Identité élève = porteuse du code
CREATE TABLE student_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  student_code varchar(6) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE students ADD COLUMN identity_id uuid REFERENCES student_identities(id);

-- Un prof ne peut pas avoir 2 fois le même élève
CREATE UNIQUE INDEX students_one_per_teacher ON students(user_id, identity_id);
```

Notes :
- `unaccent_immutable` : wrapper IMMUTABLE autour de `unaccent` (l'extension n'est pas IMMUTABLE,
  une colonne générée l'exige). Sinon faire la normalisation en trigger.
- `school_classes` n'a **pas** de liste d'élèves stockée : les élèves d'une classe du collège sont
  **déduits** = union des `students` (tous profs) dont la classe est rattachée à cette
  `school_class`. Pas de liste à tenir à jour, pas de désynchronisation.

### Backfill (même migration)

1. Une `student_identity` par ligne `students` existante, avec **son code actuel** (déjà unique → pas
   de conflit), `students.identity_id` renseigné.
2. `ALTER TABLE students ALTER COLUMN identity_id SET NOT NULL`.
3. `DROP` de la contrainte `UNIQUE` sur `students.student_code` (la colonne reste, comme copie
   dénormalisée, pour ne pas casser l'affichage/impression des codes côté prof).

### Triggers

- **BEFORE INSERT `students`** (remplace `generate_student_code`) :
  - `identity_id` NULL → crée une identité avec un code neuf (unicité vérifiée sur
    `student_identities`, boucle comme aujourd'hui) ;
  - `identity_id` fourni → `NEW.student_code := identité.student_code` (on **ignore** tout code
    envoyé par le client, y compris le mobile).
- **BEFORE UPDATE `students`** : interdire la modification directe de `student_code` / `identity_id`
  (`NEW := OLD` sur ces colonnes). Seules des RPC dédiées les changent.
- **AFTER DELETE `students`** : supprimer l'identité si plus aucune ligne ne la référence (sinon
  identités orphelines qui bloquent des codes pour rien).

---

## 4. RPC (toutes SECURITY DEFINER, `search_path = public`)

| RPC | Rôle | Contrôles |
|---|---|---|
| `search_schools(q)` | Liste des collèges : `id, name, city, uai, nb_profs`. | Aucune donnée élève, aucun email de prof. Min. 2 caractères. |
| `create_school(name, city, uai)` | Crée collège + code d'adhésion, le créateur devient `admin`. | Refus si UAI déjà pris (→ proposer de rejoindre). |
| `join_school(school_id, code, display_name, subject)` | Adhésion. | Code correct ; compteur d'échecs (anti force brute). |
| `get_school_join_code()` / `rotate_school_join_code()` | Afficher / changer le code (membres). | Membre actif. |
| `list_school_classes(school_year)` | Classes du collège + nb d'élèves + profs qui l'ont. | Membre. |
| `list_school_class_students(school_class_id)` | `identity_id, pseudo, gender, already_mine`. | Membre du collège de la classe. Pas de code élève, pas de PAP/PAI ici. |
| `import_school_students(target_class_id, identity_ids[], copy_flags bool)` | Crée les lignes `students` du prof appelant (`user_id = auth.uid()`, même `identity_id`, pseudo + genre copiés). | Classe cible = au prof ; identités = du collège ; `ON CONFLICT (user_id, identity_id) DO NOTHING` + retour du nb importés / déjà présents. Transaction unique. |
| `link_class_to_school_class(class_id, school_class_id \| new_name)` | Rattacher une classe du prof à une classe du collège (créée si absente). | Classe au prof ; `ON CONFLICT` sur `name_key` → renvoie l'existante (2 profs qui créent « 5e1 » en même temps). |
| `regenerate_student_code(student_id)` | Nouveau code sur l'**identité**, propagé à toutes les lignes. | Ligne au prof. Message front : « le code change aussi chez vos collègues ». |

Les RLS des nouvelles tables : lecture réservée aux membres ; **aucune écriture directe** (tout passe
par les RPC). `school_join_codes` : aucune policy (accès RPC uniquement).

---

## 5. Parcours prof (web)

### A. Rattacher son collège (Réglages → Établissement)
- Champ de recherche → `search_schools` (préremplie avec `settings.establishment.name`).
- Trouvé → « Rejoindre » → saisie du **code d'adhésion** (donné par un collègue déjà inscrit) +
  nom affiché + matière (préremplis depuis `settings.teacher`).
- Pas trouvé → « Créer mon collège » (nom, ville, UAI facultatif).
- Membre : affichage du code d'adhésion à transmettre, bouton « Changer le code ».
- **Bonus** : si l'URL Pronote est configurée, l'UAI est souvent le sous-domaine
  (`0541234x.index-education.net`) → préremplir et proposer le bon collège automatiquement.

### B. Premier prof (Thomas) : rattacher ses classes existantes
- Dans Classes, pour chaque classe : sélecteur « Classe du collège » (suggestion par nom normalisé).
- Les demi-groupes (`6ème groupe 1`) : rattacher à la classe mère (`6e3`) ; l'union des groupes
  reconstitue la classe côté collègue.
- Classes mixtes (LV2, options, AP) : ne pas rattacher.

### C. Nouvelle collègue : « Récupérer mes élèves » (écran d'accueil si 0 élève + collège rattaché)
1. Liste des classes du collège (année en cours), avec nb d'élèves et profs qui l'ont déjà.
2. Clic sur une classe → liste des élèves, **tous cochés**, décochables (demi-groupe, option).
3. Classe cible : **créer** une classe du même nom (défaut) **ou** choisir une de ses classes
   existantes (cas des classes déjà créées vides).
4. Import → toast « 27 élèves récupérés, 0 déjà présents ». La classe cible est rattachée à la
   `school_class`.
5. Classe absente de la liste → bouton « Ma classe n'y est pas » → flux actuel (création + import
   Excel/Pronote), avec rattachement proposé pour que les suivants en profitent.

### D. Après coup : « Mettre à jour depuis le collège »
Bouton sur une classe rattachée : liste les élèves présents dans la `school_class` mais pas chez
moi (arrivée en cours d'année saisie par un collègue) → import en un clic. Pas de synchro auto.

---

## 6. Espace élève

- `get_student_dashboard(p_code, p_student_id DEFAULT NULL)` :
  - lignes trouvées = `students` avec ce code, `is_deleted = false`, `class_id` non NULL ;
  - **1 ligne** → comportement actuel (rétrocompatible) ;
  - **plusieurs** et `p_student_id` NULL → renvoie `{ choices: [{ student_id, teacher, subject, class_name }] }` ;
  - `p_student_id` fourni → vérifier `id = p_student_id AND student_code = p_code` (ne **jamais**
    faire confiance à l'`id` seul), puis dashboard du prof de cette ligne.
- Même signature et même contrôle pour `get_student_stamps`, `get_student_academy`,
  `select_student_bonus`, `submit_academy_test`, `get_student_grades`.
- Front `StudentDashboard.tsx` : sélecteur de matière (onglets « SVT · Français ») si plusieurs
  choix, dernier choix mémorisé en localStorage.
- `student_connections` : log sur la ligne consultée (les stats de connexion de chaque prof restent
  justes).

**Ce lot doit être en prod avant le premier import partagé** (cf. bug `SELECT … INTO` au §1).

---

## 7. Bugs et cas limites — liste exhaustive

### Identité / codes
| # | Risque | Parade |
|---|---|---|
| 1 | Code partagé + RPC élève inchangées → données d'un prof au hasard, bonus écrit chez le mauvais prof. | Lot espace élève **avant** tout import. Test SQL avec 2 lignes même code. |
| 2 | La collègue importe deux fois la même classe → doublons. | Index unique `(user_id, identity_id)` + `ON CONFLICT DO NOTHING`. |
| 3 | La collègue crée un élève à la main / par Excel alors qu'il existe dans le collège → 2e code. | Import Excel/Pronote dans une classe rattachée : rapprochement par pseudo avec les identités de la `school_class` → aperçu « 25 reconnus, 2 nouveaux » (même logique que l'aperçu de rentrée existant, `Classes.tsx:882`). |
| 4 | Homonymes de pseudo (2 « Lucas MA ») → mauvais rapprochement. | Rapprochement uniquement dans la même `school_class` ; si ambiguïté, pas d'auto-match, choix manuel. |
| 5 | Un prof régénère le code → l'autre affiche l'ancien. | Code sur l'identité, propagé par la RPC ; trigger bloque l'édition directe. |
| 6 | Mobile/client envoie un `student_code` à l'insertion → collision ou code divergent. | Trigger BEFORE INSERT écrase le code. Vérifier le code mobile. |
| 7 | Suppression de l'élève par un prof → code perdu pour l'autre. | L'identité reste tant qu'une ligne existe ; purge seulement quand la dernière disparaît. |
| 8 | Soft delete (`is_deleted`) → l'élève voit encore le prof qui l'a retiré. | Les RPC élève filtrent `is_deleted = false` et `class_id IS NOT NULL`. |
| 9 | Collision de code entre `students` et `student_identities` pendant la migration. | Backfill depuis les codes existants (déjà uniques) ; génération ne regarde plus que `student_identities`. |

### Collèges / classes
| # | Risque | Parade |
|---|---|---|
| 10 | Doublons de collège (« Clg P. Verlaine » / « Collège Paul-Verlaine »). | Recherche insensible accents/casse + ville ; UAI unique ; un seul collège par prof. |
| 11 | N'importe quel inscrit rejoint un collège et voit les élèves. | Code d'adhésion obligatoire, table séparée non lisible, rotation possible. |
| 12 | Force brute du code d'adhésion. | 8 caractères alphanumériques + compteur d'échecs par utilisateur (ex. 5/heure). |
| 13 | « 5e1 » / « 5E1 » / « 5ème 1 » → 3 classes du collège. | `name_key` normalisé + contrainte unique ; suggestion à la saisie. |
| 14 | Deux profs créent la même classe du collège en même temps. | `ON CONFLICT` sur `name_key` → renvoie l'existante. |
| 15 | Demi-groupes / options : classe du prof ≠ classe du collège. | Cases à cocher à l'import ; rattachement à la classe mère ; classes mixtes non rattachées. |
| 16 | Changement de classe en cours d'année par un prof (`transferStudent`) → pas répercuté chez l'autre. | Assumé (lignes indépendantes). La liste du collège étant déduite, l'élève apparaît dans sa nouvelle classe pour les imports suivants. Évolution possible : badge « divergence ». |
| 17 | Passage d'année : classes du collège 2026-2027 ≠ 2027-2028. | `school_classes` par `school_year` ; l'identité (donc le code) persiste d'une année sur l'autre ; la logique de rentrée par pseudo (migration 033) agit sur les lignes du prof, inchangée. |
| 18 | Un prof quitte le collège / supprime son compte. | Ses lignes disparaissent (cascade existante) ; identités conservées si d'autres profs les ont. |
| 19 | Le créateur (admin) part → collège sans admin. | Transférer `admin` au plus ancien membre (trigger ou RPC `leave_school`). |

### Données partagées / RGPD
| # | Risque | Parade |
|---|---|---|
| 20 | Fuite de données d'un prof à l'autre (notes, remarques, événements). | Rien n'est partagé hormis pseudo + genre (+ drapeaux si choisi). RLS existantes inchangées. |
| 21 | PAP / PPRE / PAI : info sensible (PAI = santé). | Copie **optionnelle** (case cochée par défaut), booléens seuls, jamais de détail. |
| 22 | Photo : chemin de stockage propre à chaque prof → lien cassé si copié. | Photo non copiée. |
| 23 | `search_schools` expose les emails des profs. | Renvoie seulement nom/ville/UAI/nb de profs ; `display_name` visible seulement par les membres. |
| 24 | L'élève voit le nom réel du prof. | `display_name` choisi par le prof (« M. Charles »). |

### Espace élève
| # | Risque | Parade |
|---|---|---|
| 25 | Académie (maisons) : l'élève refait le test chez chaque prof. | Assumé MVP (maisons par classe/prof). Évolution : réutiliser les réponses de l'identité. |
| 26 | Dashboard basé sur `trimester_settings` du prof → trimestres différents selon les profs. | Normal : chaque vue est celle d'un prof. |
| 27 | Stats de connexion faussées. | Log sur la ligne consultée. |

---

## 8. Découpage et ordre de mise en œuvre

| Lot | Contenu | Pré-requis | Effort |
|---|---|---|---|
| **1. Base** | Tables, backfill identités, triggers, drop unique, RPC collège/import. Invisible pour les utilisateurs. | — | ~½ j |
| **2. Espace élève multi-profs** | RPC élève avec `p_student_id` + sélecteur de matière. | Lot 1 | ~½ j |
| **3. Collège (réglages)** | Rechercher / créer / rejoindre, code d'adhésion, rattachement des classes. | Lot 1 | ~½ j |
| **4. Récupérer mes élèves** | Écran d'import collègue + « Mettre à jour depuis le collège ». | Lots 1-3 | ~½ j |
| **5. Garde-fous import** | Rapprochement pseudo ↔ identités dans l'import Excel/Pronote d'une classe rattachée. | Lot 1 | ~¼ j |
| **6. Mobile** | Vérifier insertion sans `student_code` ; afficher le code depuis la ligne (inchangé). | Lot 1 | contrôle |

Ordre : **1 → 2 → 3 → 4 → 5**. Rien n'est ouvert aux collègues avant la fin du lot 2.

### Tests à faire avant d'ouvrir à la collègue
- SQL : insertion élève sans identité → code généré unique ; avec identité → code copié ; update
  direct du code → ignoré ; suppression de la dernière ligne → identité purgée.
- SQL : RPC élève avec 1 ligne (identique à aujourd'hui), 2 lignes sans `p_student_id` (choix),
  2 lignes avec `p_student_id` d'un autre élève (refus).
- RLS : compte B membre du collège ne lit **aucune** ligne `students`/`events`/`stamps` de A via
  l'API (seulement via les RPC listées).
- Compte non membre : `list_school_class_students` refusé ; `school_join_codes` illisible.
- Parcours complet avec 2 comptes de test : Thomas rattache 5e1 → collègue rejoint → importe 5e1
  → un élève se connecte avec son code → voit « SVT · Français ».
- Réimport de la même classe → 0 doublon. Import Excel d'une classe rattachée → élèves reconnus.
- Régénération de code par A → B voit le nouveau code.

---

## 9. Points à trancher

1. **Adhésion** : code d'adhésion transmis par un collègue (recommandé, simple et sûr) ou demande
   validée par un membre (plus de code, mais attente).
2. **PAP/PPRE/PAI** : copiés par défaut à l'import (recommandé) ou jamais.
3. **Un seul collège par prof** pour le MVP (recommandé) ; multi-collèges plus tard (profs
   partagés sur 2 établissements).
4. **Pseudo** : copie indépendante par prof (recommandé) ou pseudo commun synchronisé.
