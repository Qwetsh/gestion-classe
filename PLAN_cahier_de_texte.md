# Plan « Cahier de texte » (22/11/2026)

## Besoin

Chaque séance préparée par Claude a son entrée de cahier de texte (format de la skill
`cahier-de-texte` : texte brut, thème et séance en tête, « TRAVAIL EFFECTUÉ EN CLASSE »,
« COMPÉTENCES TRAVAILLÉES »). Une entrée par séance et par classe. Thomas la recopie lui-même
dans Pronote : l'app garde la copie, rattachée au cours de l'emploi du temps, et la rend facile
à copier. **Pas d'export vers Pronote.**

## 1. Base : table `lesson_journal` (migration 084)

Même clé que `lesson_notes` (044) et `lesson_boards` (065) : un cours n'a pas d'identifiant
stable commun aux sources (Pronote en direct, .ics, manuel), donc **(user_id, starts_at, label)**,
début à la minute + libellé Pronote du cours. Une entrée par cours. `lesson_notes` n'est pas
touchée (une note est un rappel *avant* le cours, l'entrée est un compte rendu).

| colonne | rôle |
|---|---|
| `id`, `user_id` (→ auth.users, CASCADE) | |
| `starts_at`, `ends_at`, `label` | le cours ; UNIQUE (user_id, starts_at, label) |
| `class_id` (→ classes, SET NULL), `group_id` (→ class_groups, SET NULL) | recopiés à l'écriture, pour la liste par classe |
| `content` TEXT NOT NULL | le texte brut, tel que collé dans Pronote |
| `copied_at` TIMESTAMPTZ NULL | « recopiée dans Pronote » (posé par le bouton Copier, annulable) |
| `source` TEXT : `claude` / `manual` / `import` | qui l'a écrite |
| `created_at`, `updated_at` | |

RLS : propriétaire seulement (`auth.uid() = user_id`), comme 044. Rien côté élève, rien sur
l'écran projeté. Index (user_id, starts_at) et (class_id, starts_at). Aucune 2e clé étrangère
vers une table déjà lue par embed (piège PGRST201).

## 2. Où on la voit et la retouche (web)

- **Popover du cours sur l'accueil** (`LessonPopover.tsx`) : une section « Cahier de texte » sous
  la note. Entrée présente : sa 1re ligne (thème, séance), pastille « copiée » ou non, boutons
  **Copier** et **Ouvrir**. Pas d'entrée : « Écrire l'entrée » (cours passé ou du jour). Le
  popover fait 300 px : le texte complet s'ouvre dans une fenêtre (Modal partagée) avec une
  zone de texte retouchable, Enregistrer, Supprimer, Copier.
- **Page « Cahier de texte »** (`/cahier-de-texte`, barre latérale, section du suivi) : toutes
  les entrées, les plus récentes en haut, filtre par classe, filtre « pas encore copiées ».
  Chaque ligne : date, heure, classe, 1re ligne ; clic = la même fenêtre. Sert à rattraper le
  recopiage dans Pronote en fin de semaine.
- **Copier** : met le texte brut dans le presse-papiers (`navigator.clipboard.writeText`) et
  pose `copied_at` (« Copiée le 23/11 », clic pour annuler). Rien d'autre.
- Mobile : rien dans ce lot (lecture seule possible plus tard).

## 3. Comment Claude y écrit (jeton d'import)

- Fonction `depot-cours`, nouvelle action **`journal`** (jeton) :
  `{ token, entries: [{ starts_at, label, content }], replace? }` →
  `{ results: [{ starts_at, label, status }] }`, statut `saved` / `same` (texte identique) /
  `exists` (une autre entrée existe : jamais écrasée sans `replace: true`, sur demande de
  Thomas) / `not_found` (pas de cours de ses classes à cette minute). Le cours est cherché
  comme pour `place` (`lessonsBetween`), la classe recopiée. 60 entrées au plus par appel.
- On peut aussi désigner le cours par **date + heure locale + nom de classe**
  (`{ date: "2026-11-23", time: "11:15", class_name: "4B" }`) : la fonction cherche le cours de
  cette classe qui commence à cette heure (heure de Paris), ce qui évite à Python les fuseaux.
- `gc_envoi.py cahier <fichier.txt | dossier>` : lit le format des fichiers actuels (voir § 4)
  et envoie. La skill `cours-gestion-classe` § 3 dira : écrire l'entrée dans un .txt de
  `course-drafts/cahier/` au même format, puis `gc_envoi.py cahier` ; plus de fichier OneDrive.
- Le jeton n'écrit que dans l'espace de son propriétaire et ne relit pas les entrées (il
  répond seulement `same` / `exists`).

## 4. Reprise des fichiers déjà écrits

`2026-2027/_Cahier de texte/AAAA-MM-JJ HHhMM <classe> — <titre court>.txt` : date, heure et
classe lues dans le **nom du fichier** (sûr), les trois lignes `Date :`, `Classe :`, `Cours :`
retirées, le reste = `content`. Envoi : `gc_envoi.py cahier "<dossier>"`, avec `source: import`.
Compte rendu fichier par fichier ; un fichier sans cours trouvé est signalé, pas deviné. Les
fichiers restent dans OneDrive (sauvegarde).

## 5. Étapes

1. Migration 084 (fichier dans `supabase-migrations/`), appliquée en prod **avec ton accord**.
2. `lib/timetable/lessonJournalQueries.ts` + section du popover + fenêtre + page + lien.
3. Action `journal` dans `depot-cours` (redéployée) + `gc_envoi.py cahier` + tests.
4. Reprise du dossier OneDrive.
5. Vérification dans le navigateur, skill § 3 mise à jour, PR.

Dépôt public : aucun texte d'entrée ni nom d'élève dans le code, les tests ou les commits.
