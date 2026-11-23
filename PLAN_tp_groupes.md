# TP en groupes de bout en bout — plan

Validé par Thomas le 23/11/2026 (maquettes mobiles : canevas « TP en groupes — mobile »).
Maquettes élève et bureau : canevas « TP en groupes — élève et bureau »
(https://claude.ai/artifact/4eX7jtfczQPCJHpwHps7fR).

## Décisions de Thomas

- Le mode groupe remplace le plan de classe sans changer d'écran et garde ses fonctions
  (menu radial par élève). Les élèves changent de place en TP : îlots de groupes sur un fond
  libre, sans les tables du plan, déplaçables à tout moment.
- Implication / malus de groupe = un événement par membre présent (absents et sortis exclus),
  marqué du groupe. Le malus conduite (qui baisse la note du TP) reste, à côté.
- Un élève peut changer de groupe : il prend alors les notes de son nouveau groupe.
- Un absent peut être mis dans un groupe : il GARDE la note de son groupe (partie TP et copie
  de groupe de la partie activité) et voit documents et photos ; il ne reçoit pas les points
  d'implication de groupe (décidé par Thomas le 23/11/2026).
- Partie activité de la note : copie par élève ET copie par groupe. Note TP + note activité
  (ex. 10 + 20 = 30) sans mélanger les deux.
- Élèves : onglet TP (fiche, protocole, documents, Perso) ; photos déposées en classe depuis
  leur téléphone, 5 Mo max, compression auto ; photos partagées par le groupe ; dépôt
  ouvert / fermé par le prof quand il veut. TP corrigé : reste dans TP et apparaît dans Évals.
- Aurélie n'utilise pas le mode groupe.

Choix provisoires de Claude (à confirmer) : photos d'élèves visibles tout de suite par le
groupe, le prof peut les supprimer ; lancer le TP ouvre l'onglet TP aux membres (jamais la
correction) ; une colonne /30 au carnet ; photos d'élèves effacées en fin d'année.

## Lots

1. **Mobile** (ce lot) : lancement du TP (TP, barème), former puis placer les groupes, îlots
   en séance, radial élève et groupe, fiche du groupe (points de groupe, barème, malus,
   commentaire, photos, membres), photo rapide avec file d'envoi hors ligne, fin du TP.
   Nouvel APK de dev nécessaire seulement si une dépendance native change (aucune prévue).
2. **Bureau** : fiche du TP au visuel des évaluations (groupes, photos, barème, commentaire).
3. **Élève, lecture** : onglet TP (fiche, protocole, documents, photos du groupe).
4. **Élève, dépôt** : envoi de photos, ouverture / fermeture du dépôt.
5. **Note composée** : partie activité (copies par élève ou par groupe, correction Claude),
   total au carnet.

## Lot 1 — données

Migration Supabase `087_tp_groups_live.sql` (+ SQLite v19, miroir) :

- `session_groups` : `position_x`, `position_y` (0..1, NULL = rangement auto), `comment`,
  `display_order` (couleur et ordre des îlots).
- `events.tp_group_id` (uuid, sans clé étrangère : l'événement part en direct avant le groupe)
  = point donné au groupe entier.
- `group_session_photos` : `group_id` (NULL = toute la classe), `author` ('teacher' |
  'student'), `student_id`.
- `sync_group_session_assessment` : inchangée (063), plus le commentaire au groupe dans
  `details.groupe.commentaire`. L'absent garde la note de son groupe.
- Appliquée en production le 23/11/2026.

Synchro mobile :

- `group_sessions` part dès qu'il est actif (plus seulement terminé) ; le carnet ne bouge
  toujours qu'à la fin (le déclencheur ne regarde que `completed`).
- Changer un élève de groupe = UPDATE de sa ligne de membre (même id) : l'upsert la déplace
  côté serveur, le déclencheur recalcule sa note.
- Toute suppression locale (membre, groupe, critère, photo) passe par `pending_deletions`,
  et le pull ne ressuscite pas une ligne en attente de suppression.
- Envoi « en direct » des tables de groupe (anti-rebond) pendant le TP.
- Photos : copie locale + file d'envoi (Storage `student-photos`,
  `{user}/tp/{séance}/{id}.jpg`, 1600 px JPEG 0,8) puis ligne `group_session_photos`.
- Modèles de TP : le pull met à jour les modèles déjà synchronisés (barèmes revus sur le web).

## Lot 2 — fiche du TP au bureau (codé le 23/11/2026)

`GroupSessionDetail` réécrit en trois colonnes (maquette B1) ; `lib/tpGroupSheet.ts`. Tout
s'enregistre au fil des gestes (pas de brouillon en base) ; « Valider » compte 0 aux critères
vides. Note d'un membre : « Ajuster » (ne suit plus le groupe), « Suivre le groupe » (la remet).
Pas encore : bandeau du dépôt (lot 4), onglet Partie Activité et /30 (lot 5).

## Lot 3 — onglet TP élève, en lecture (codé le 23/11/2026)

Mis en service le 23/11/2026 sur « Oui, mets-les » de Thomas : migration 088 appliquée, fonction
`tp-eleve` déployée (version 1, verify_jwt ; déployée avec une copie réduite de
`classeur-eleve/release.ts` : closedByTitle, publicDoc, imagePaths, ownedPaths, isUuid). Reste le
site (push sur master, avec les lots 2 et 3).


- Migration `088_student_tp_tab.sql` (pas appliquée) : `tp_templates.student_boards`,
  `get_student_tps`, `get_student_tp`, `student_tp_photo_paths` (service_role seulement),
  `tp_group_order`. Essayée à blanc (transaction annulée) le 23/11/2026.
- Fonction Edge `tp-eleve` (pas déployée) : photos signées (student-photos) et cours ouverts
  (board-assets), après vérification du code. Importe `../classeur-eleve/release.ts`.
- Comme le classeur : le serveur n'ouvre aucun cours d'après son titre. Fiche, protocole et
  documents de chaque TP sont écrits dans `student_boards` par le navigateur du prof
  (`syncTpStudentBoards`, à l'ouverture de Mes TP et de Mes cours).
- Espace élève : bouton « Mes TP » (orange) sous la barre d'onglets, visible dès que l'élève a
  fait partie d'un groupe, sans réglage de classe ; plein écran au style « Vivante » (A1, A2,
  A3b) : liste (en cours, déjà faits), fiche, protocole (cours, à défaut celui de Mes TP),
  documents, photos du groupe et de toute la classe, bandeau de l'absent, mot du prof une fois
  l'éval publiée. Jamais la correction ni la note.
- Ordre de mise en service : migration 088, puis déployer `tp-eleve`, puis le site.

## Lot 4 — dépôt des élèves (codé le 24/11/2026)

Mis en service le 24/11/2026 sur « Oui, mets-les » de Thomas : migration 089 appliquée, `tp-eleve`
version 2 déployée (envoi et retrait). Reste le site (push sur master, avec les lots 2 à 4).


- Migration `089_tp_student_deposit.sql` (essayée à blanc) : `group_sessions.deposit_closed`,
  `deposit_until` ; `tp_deposit_state` (droits de l'appelant) ; `student_tp_deposit_target`
  (service_role) ; `get_student_tps` (+ deposit_open) et `get_student_tp` (+ deposit, photos.mine).
- Règle : ouvert au lancement, fermé quand la séance est terminée au téléphone, au plus tard 2 h
  après son début ; « Fermer plus tôt » ; « Rouvrir 30 min » (se referme seul).
  Fin de l'heure tirée de la séance, pas de l'emploi du temps.
- Fonction `tp-eleve` : actions `upload` (JPEG base64 ≤ 1 Mo, vrai JPEG, 30 photos max par élève)
  et `delete` (ses propres photos, dépôt ouvert). À redéployer après la 089.
- Élève : partie « Perso » (Prendre une photo, Galerie), réduction dans le navigateur sous 1 Mo
  (1600 px puis plus petit), file d'envoi qui attend le réseau tant que la page est ouverte,
  retrait de ses photos. Bouton « Déposer » sur la carte du TP en cours.
- Bureau : bandeau du dépôt dans la fiche TP (état, photos d'élèves, Fermer plus tôt / Rouvrir
  30 min) ; nouvelles photos relues toutes les 20 s quand il est ouvert.
- Pas fait : bouton Fermer au téléphone (nouvel APK), page « Dépôt des élèves » complète (B3 :
  tableau par groupe), photos d'élèves vues au téléphone (le téléphone ne relit pas les photos).

## Lot 1 — pas couvert

- Proposition du TP d'après l'emploi du temps : liste filtrée par niveau, le dernier TP
  utilisé en tête (l'EDT viendra ensuite).
- Dépôt des élèves (lot 4) : pas de bandeau ni d'interrupteur tant que l'élève ne peut pas
  déposer.
