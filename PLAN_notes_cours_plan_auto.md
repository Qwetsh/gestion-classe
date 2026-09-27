# Notes sur un cours à venir + génération automatique du plan de classe

*Rédigé et livré le 27/09/2026, sur la branche `feat/responsive`. Deux features distinctes, deux migrations (044, 045).*

## 1. Note sur un cours à venir (accueil)

### Le problème
Un cours de l'emploi du temps n'« existe » pas dans l'application tant qu'une séance n'est pas démarrée (téléphone ou mode classe). Écrire une note « pour cette heure » supposait donc de créer quelque chose, sans casser le fonctionnement de ceux qui n'utiliseront jamais la feature.

### Décisions
- **Une note n'est pas une séance.** Nouvelle table `lesson_notes` (migration 044), la table `sessions` n'est pas touchée. Rien n'est créé tant que la séance n'est pas démarrée. Un compte sans note ne voit aucune différence (lecture tolérante : table absente = aucune note).
- **Clé métier = (user_id, starts_at, label).** Un cours n'a pas d'identifiant stable commun aux sources (id pawnote en direct, UUID `timetable_entries` pour un `.ics`). L'heure de début exacte + le libellé Pronote (« 4D », « 3°EP1 ») sont identiques quelle que soit la source. Une note par cours (upsert).
- **class_id / group_id recopiés à l'écriture** (résolus par `timetable_label_links`) pour que le téléphone retrouve la note par classe + proximité horaire, sans connaître l'emploi du temps.
- **Le téléphone lit Supabase en direct**, pas de copie SQLite ni de sync : la note est écrite depuis le PC juste avant, le téléphone est en ligne pour synchroniser de toute façon. Hors ligne : rien ne s'affiche, rien ne casse. Le téléphone ne crée jamais de note, il la marque « vue ».
- **Jamais sur l'écran projeté `/classe`** : la note est pour l'enseignant.

### Livré
| Où | Quoi |
|---|---|
| Accueil › clic sur un cours (`LessonPopover`) | Section « Note pour ce cours » : zone de saisie sur un cours à venir, Ctrl+Entrée pour enregistrer, Modifier / Supprimer / « ✓ Vu ». Un cours passé montre sa note en lecture seule. Le popover ne se ferme plus sur un clic pendant la frappe. |
| Accueil › grille de la semaine (`LessonBlock`) | Marqueur 📝 + première ligne de la note ; bordure double ; mise en avant (fond ambre) sur le cours **en cours** ; barrée si « vue » ou passée. |
| Téléphone › Nouvelle séance (`session/start.tsx`) | Bandeau compact sous les tuiles de classe dès qu'une classe est choisie, si une note existe pour le cours qui commence. |
| Téléphone › Séance en cours (`session/[id].tsx`) | Bandeau « Note pour ce cours » sous l'en-tête, bouton « Vu ». |

Fenêtre de rapprochement mobile (`utils/lessonNotes.ts`, testé) : cours commencé il y a moins de 50 min ou commençant dans moins de 30 min, le plus proche l'emporte ; un demi-groupe ne voit que les notes de son groupe ou de la classe entière.

Fichiers : `supabase-migrations/044_lesson_notes.sql`, `gestion-classe-web/src/lib/timetable/lessonNotesQueries.ts`, `HomeDataContext.tsx` (`lessonNotes`, `saveNote`, `setNoteDone`), `LessonPopover.tsx`, `WeekTimetableModule.tsx`, `index.css` ; `gestion-classe-mobile/utils/lessonNotes.ts`, `services/lessonNotes.ts`, `components/LessonNoteBanner.tsx`, `__tests__/utils/lessonNotes.test.ts`.

### Reste / idées
- Notes visibles sur l'accueil du téléphone (« aujourd'hui : 3 notes »).
- Note sur un cours **sans** classe reliée : possible sur l'accueil (clé par libellé), mais le téléphone ne la retrouvera pas (pas de class_id).
- Rappel des notes non vues d'un cours passé (« tu avais noté… »).

## 2. Génération automatique du plan de classe sous contraintes

### Décisions
- **Orientation : le tableau est en bas de la grille** (éditeur web, écran projeté, séance mobile). « Devant » = les rangées d'indice élevé. L'éditeur de plan **mobile** affichait le tableau en haut : corrigé (tableau en bas) pour que « devant » veuille dire la même chose partout.
- **Les contraintes sont durables et attachées à la classe**, pas à un plan : « Léa devant » vaut pour toutes les salles. Table `seating_constraints` (migration 045). Les **règles** (PAP devant, bavards…) sont des cases à cocher mémorisées par navigateur.
- **Le générateur ne sauvegarde pas** : il remplace les positions dans l'éditeur (bouton Sauvegarder actif), l'enseignant retouche à la main. Aucune modification de `class_room_plans` / `class_group_plans` / mobile.
- **Méthode** (`lib/seatingAuto.ts`, pur, 13 tests) : placement glouton puis recuit simulé sur des échanges, chaque contrainte est une pénalité. Quand tout n'est pas satisfaisable, on renvoie le meilleur plan **et la liste de ce qui n'est pas respecté** (pastilles rouges sur les contraintes concernées) plutôt qu'un échec. « Autre proposition » relance avec une autre graine.

### Contraintes par élève (celles demandées + ajouts)
| Contrainte | Sens |
|---|---|
| devant | rangées proches du tableau (un tiers des rangées, au moins 1) |
| au fond | rangées du fond |
| **pas au fond** | ajout : n'importe où sauf le fond (moins fort que « devant ») |
| **au bord** | ajout : colonne extrême (mur, fenêtre, sortie discrète) |
| **au centre** | ajout : colonne centrale, face au tableau |
| **seul à sa table** | ajout : aucun voisin latéral |
| **place fixe** | ajout : garde sa place du plan actuel |
| à côté de B | voisins latéraux (binôme, tutorat) ; une allée coupe le voisinage |
| pas à côté de B | ni latéral, ni devant/derrière, ni diagonale |
| éloigné de B | distance de Tchebychev ≥ 3 (paramétrable dans `params.minDistance`) |

### Règles de la classe (ajouts, cochables)
- Élèves PAP / PPRE / PAI devant (fiche élève, migration 038) — coché par défaut.
- Éloigner les bavards les uns des autres (malus du trimestre, au-dessus de la médiane) — coché par défaut.
- Mélanger les niveaux : pas deux élèves fragiles (note de comportement < 10) côte à côte.
- Alterner filles / garçons.
- Nouveaux voisins : éviter de reformer les binômes du plan actuel.
- Remplir depuis l'avant (coché) / répartir dans toute la salle.
- Garder les élèves déjà placés (ne place que les non placés).

### Reste / idées
- Contraintes sur mobile (lecture des `seating_constraints` + bouton Générer dans l'éditeur mobile).
- Générer pour un **groupe** (plans `class_group_plans`, aucune UI web n'édite encore un plan par groupe).
- Contrainte « près de la porte » / « loin de la fenêtre » : la salle ne sait pas où sont la porte et les fenêtres (l'icône « Porte » de l'éditeur est décorative). À ajouter sur `rooms` si besoin.
- Prendre en compte `table_groups` (tables liées) pour « à côté de » : aujourd'hui, voisinage = colonne adjacente sur la même rangée sans allée entre les deux.
- Historique des plans pour « nouveaux voisins » sur plusieurs plans (aujourd'hui : seulement le plan actuel).
