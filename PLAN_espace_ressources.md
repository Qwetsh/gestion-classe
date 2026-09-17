# Épic 11 — Espace Ressources élève

> Plan de conception rédigé le 01/09/2026. Objectif : donner aux élèves l'accès à mes documents,
> corrections, cours en cours, vidéos et simulations/jeux, depuis l'espace `/eleve` existant.

## 1. Décisions de cadrage (arrêtées)

| Question | Décision |
|----------|----------|
| Emplacement | **Nouveaux onglets dans `/eleve`** — même code à 6 chiffres, même déploiement, visibilité pilotée par classe via `class_student_tabs` |
| Alimentation | **Hybride** — import initial scripté depuis `Ecole\2026-2027`, puis ajout à l'unité depuis l'app |
| Protection des fichiers | **Bucket privé + URL signées** générées par une RPC qui vérifie le code élève |
| Vidéos | **YouTube en non répertorié**, intégrées dans le lecteur de l'app |

### Ce qu'on réutilise tel quel

- `class_student_tabs` (migration 030) : il suffit d'ajouter deux colonnes `show_resources` / `show_games`.
- Le patron complet de `custom_annales` (migration 029) : table + bucket + upload prof + lecture élève.
- La visionneuse PDF de `StudentAnnales.tsx` (modale plein écran + iframe) — à extraire en composant partagé.
- Le thème élève `T` de `StudentDashboard.tsx` (palette chaude sombre) — à extraire aussi, il est déjà dupliqué.

## 2. Modèle de données

Trois tables préfixées `resource_`, pour isolation claire (convention `academy_`, `parc_`).

```
resource_folders            -- arborescence Niveau > Séquence > Activité
  id            uuid PK
  user_id       uuid FK auth.users
  parent_id     uuid FK resource_folders NULL     -- NULL = racine (un niveau)
  title         text                              -- "Séquence 2 - Le système immunitaire"
  level         text NULL                         -- '3e' | '4e' | '5e' (racines seulement)
  position      int                               -- ordre d'affichage
  is_published  boolean DEFAULT false             -- dossier masqué tant que non publié
  created_at    timestamptz

resource_folder_classes     -- quelles classes voient ce dossier
  folder_id     uuid FK resource_folders ON DELETE CASCADE
  class_id      uuid FK classes ON DELETE CASCADE
  PRIMARY KEY (folder_id, class_id)

resources
  id            uuid PK
  user_id       uuid FK auth.users
  folder_id     uuid FK resource_folders ON DELETE CASCADE
  kind          text      -- 'document' | 'video' | 'game' | 'link'
  category      text      -- 'cours' | 'activite' | 'correction' | 'entrainement' | 'autre'
  variant       text      -- 'standard' | 'adapte'   (version simplifiée/différenciée)
  title         text
  description   text NULL
  file_path     text NULL -- chemin dans le bucket privé `ressources`
  mime          text NULL
  size_bytes    bigint NULL
  external_url  text NULL -- YouTube non répertorié, jeu, lien Éduthèque…
  publish_at    timestamptz NULL  -- NULL = non publié ; date future = publication différée
  position      int
  created_at    timestamptz

resource_views              -- métriques d'usage (prolonge student_connections)
  id            uuid PK
  student_id    uuid FK students ON DELETE CASCADE
  resource_id   uuid FK resources ON DELETE CASCADE
  viewed_at     timestamptz DEFAULT now()
```

**Visibilité effective côté élève** = le dossier est publié **ET** rattaché à la classe de l'élève,
**ET** `resources.publish_at IS NOT NULL AND publish_at <= now()`.

Ce double niveau est volontaire : il permet de publier une activité le lundi et sa correction le jeudi,
sans toucher au dossier. C'est le cas d'usage central (« cours en cours »).

**RLS** : même pattern que `academy_config` — le prof gère ses propres lignes (`user_id = auth.uid()`),
l'élève n'a **aucune** policy `anon` et passe exclusivement par les RPC `SECURITY DEFINER`.

## 3. Storage

Nouveau bucket **privé** `ressources` (à créer ; ne pas réutiliser `brevets` qui est public).

```
ressources/<school_year>/<folder_id>/<resource_id>.<ext>
```

Policies : écriture/lecture réservées à `authenticated`. L'élève anonyme n'a jamais d'accès direct —
il obtient une URL signée à durée courte par RPC.

> ⚠️ **Contrainte de volume à surveiller.** L'offre gratuite Supabase plafonne à 1 Go de Storage.
> `Ecole\2026-2027` pèse ~490 Mo (309 .docx). Après exclusion des fiches de préparation et des
> évaluations, et conversion en PDF, j'estime la charge publiable entre 250 et 350 Mo — ça passe,
> mais sans marge pour deux années scolaires. Prévoir soit une compression des PDF à l'import,
> soit le passage en offre payante, soit une purge annuelle. À trancher avant le Lot 4.

## 4. RPC élève (SECURITY DEFINER, `SET search_path = ''`)

L'audit du 29/08 signale 12 fonctions `SECURITY DEFINER` avec `search_path` mutable — les nouvelles
doivent être propres dès le départ.

- **`get_student_resources(p_code text)`** → JSON : l'arbre des dossiers visibles pour la classe de
  l'élève, avec leurs ressources publiées. Ne renvoie **jamais** `file_path`, seulement des `id`.
  Le témoin (`is_witness`) voit tout, y compris le non publié, signalé comme tel.
- **`get_resource_url(p_code text, p_resource_id uuid)`** → URL signée valable 15 min, après
  vérification que la ressource est bien visible pour cet élève. Journalise dans `resource_views`
  (dédup 30 min, jamais pour un témoin — même règle que `student_connections`).
- **`get_resource_stats(p_class_id uuid)`** → côté prof : qui a ouvert quoi, quand. Mêmes policies
  que `get_connection_stats`.

**Limite assumée** : l'URL signée empêche le partage durable d'un lien, pas le téléchargement puis la
rediffusion du fichier. C'est le bon niveau pour un usage scolaire — à ne pas confondre avec du DRM.

## 5. Interface élève (`/eleve`)

Deux nouveaux onglets, conditionnés par `class_student_tabs` :

- **📖 Cours** — accordéon par séquence, puis par activité. Chaque ressource est une carte avec un
  badge de catégorie (Cours / Activité / Correction / Entraînement) et, le cas échéant, un badge
  « Version adaptée ». Documents, vidéos et liens cohabitent **dans leur contexte pédagogique**
  plutôt que dans des onglets séparés — c'est ce qui fait sens pour l'élève qui révise une séquence.
- **🎮 Jeux** — catalogue à plat des jeux et simulations, hors séquence, avec vignette et lancement
  en plein écran.

Visionneuse : la modale PDF de `StudentAnnales.tsx` extraite en `components/student/FileViewer.tsx`,
étendue au lecteur YouTube (`youtube-nocookie.com`) et à l'iframe de jeu.

## 6. Interface prof (`/ressources`)

Nouvelle page, dans le menu « Plus ».

- Arbre de dossiers avec réorganisation, création, renommage.
- Upload multi-fichiers par glisser-déposer dans un dossier.
- Rattachement d'un dossier à une ou plusieurs classes (multi-sélection).
- Bascule de publication par ressource, avec **date de publication différée** (le cas « je publie la
  correction jeudi »).
- Onglet Statistiques : consultations par ressource et par élève.
- Toggle `show_resources` / `show_games` dans la page Classes, à côté des toggles Tampons / Annales
  existants.

## 7. Import initial depuis OneDrive (Lot 4)

L'arborescence `Ecole\2026-2027` est assez régulière pour être classée automatiquement :

```
3ème / Séquence 2 le système immunitaire /
   Cours séquence 2.docx                                → cours, standard
   Activité 1 - La 1ere reaction /
       Activité 1 - 1ere react.docx                     → activité, standard
       Activité 1 - 1ere react - simplifie.docx         → activité, adapté
       Activité 1 - Correction ... simplifié.docx       → correction, adapté
       Fiche préparation - Activité 1.docx              → EXCLU
   Évaluation / …                                       → EXCLU (dossier entier)
```

**Règles de classement** (sur nom de fichier normalisé, sans accents, en minuscules) :

| Motif | Résultat |
|-------|----------|
| `fiche preparation`, `fiche de prep`, `bareme` | exclu |
| dossier `evaluation`, `eval` | exclu (récursif) |
| `correction`, `corrige`, `corrig` | catégorie `correction` |
| `cours` | catégorie `cours` |
| `activite N`, `activite` | catégorie `activite` |
| `entrainement` | catégorie `entrainement` |
| `simplifi`, `adapt` | variante `adapte` |
| `.drawio`, `.flipchart`, `.pptx` | exclu par défaut (formats non lisibles par l'élève) |

**Conversion .docx → PDF** : LibreOffice en mode headless (`soffice --headless --convert-to pdf`),
gratuit et scriptable en lot. Repli si LibreOffice n'est pas installé : automation Word via COM
PowerShell, plus fidèle à la mise en page mais séquentielle et plus lente.

**Le script ne publie rien directement.** Il produit un manifeste JSON (chemin source, classement
proposé, exclusion et sa raison) que la page `/ressources` affiche dans un écran de validation :
tu coches, tu corriges les mauvais classements, tu lances. C'est le garde-fou contre la publication
accidentelle d'une correction ou d'un sujet d'évaluation — le risque n°1 de tout ce module.

## 8. Jeux et simulations (Lot 6)

Inventaire des candidats dans `OneDrive\Code` : `jeu-ressources` (Vite), `phylae`, `Animations`,
`bio-classification-app`, `Dice`, `SpaceGame`, `Plan3D`, `QuizzEleves`, `Jeu dé révision`.

Question ouverte à trancher : **où les héberger**. Trois options, par ordre de préférence :

1. **Sous-dossier du même GitHub Pages** (`/gestion-classe/jeux/<slug>/`) alimenté par un script de
   build qui copie le `dist` de chaque jeu. Gratuit, pas de CORS, une seule URL à gérer. Contrainte :
   le dépôt grossit, et chaque jeu doit accepter une `base` Vite paramétrable.
2. **Un GitHub Pages par jeu**, référencé par simple `external_url`. Découplé et propre, mais autant
   de déploiements à maintenir.
3. **Intégration de l'existant hors app** (Genially, etc.) par `external_url` — zéro travail, à faire
   dès le Lot 3 pour les jeux déjà en ligne.

> ⚠️ **Point de sécurité préalable.** L'audit du 29/08 (point 7) relève que la base Class'it héberge
> déjà les tables d'un projet de jeu (`games`, `map_hexes`, `monsters`, `players`…) avec des policies
> `anon` en CRUD **sans aucune condition** : quiconque extrait la clé publique du bundle peut tout
> lire et écrire. Ces tables cohabitent avec les 536 élèves. Il faut verrouiller ou déplacer ces
> tables **avant** d'ouvrir un onglet Jeux, faute de quoi on rend le problème plus visible et plus
> exploitable.

## 9. Découpage en lots

| Lot | Contenu | Effort | Dépend de |
|-----|---------|--------|-----------|
| **1** | Migration socle : 4 tables + RLS + bucket privé + 3 RPC | M | — |
| **2** | Page prof `/ressources` : arbre, upload, publication, ciblage classe | L | 1 |
| **3** | Onglet élève 📖 Cours : arbre, cartes, visionneuse partagée | M | 1, 2 |
| **4** | Import massif : script de scan + conversion PDF + écran de validation | L | 2 |
| **5** | Vidéos YouTube non répertoriées : champ URL + lecteur intégré | S | 3 |
| **6** | Onglet 🎮 Jeux + hébergement des simulations (après verrouillage BDD) | L | 3 |
| **7** | Statistiques de consultation côté prof | S | 3 |

Chemin le plus court vers quelque chose d'utilisable en classe : **1 → 2 → 3**, puis import massif.
Les lots 5 à 7 sont des ajouts indépendants.

## 10. Points à trancher avant le Lot 4

- [ ] Volume Storage : compression des PDF, offre payante, ou purge annuelle ?
- [ ] Droits d'auteur : les documents contenant des ressources tierces sont-ils tous diffusables,
      même en accès restreint par code ?
- [ ] Que faire des `.drawio` / `.flipchart` / `.pptx` — export image, ou hors périmètre ?
- [ ] Les élèves d'une même classe voient-ils tous les mêmes versions, ou la version « adaptée »
      doit-elle être réservée à certains élèves ? (impacte le modèle : ciblage par élève, pas par classe)
