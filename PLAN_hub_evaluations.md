# Plan — Hub central « Évaluations » (étape 0 : audit)

> Rédigé le 02/11/2026 après lecture du code web, des tables Supabase en production (projet Class'it),
> des buckets, des Edge Functions, de l'app mobile et des scripts du Correcteur. Répond au brief
> « Refonte : hub central Évaluations » de Thomas. Fait suite à `PLAN_ergonomie_evaluations.md`.
> Statut : **plan validé par Thomas le 02/11/2026** (« Valide, lance la phase 1 » : recommandations du §6 retenues).
> - Phase 1 **codée le 02/11/2026** (branche `feat/hub-phase1`) : migration 060 réduite à ce que la phase lit
>   (`short_name`, `sequence` ; le reste du §3.2 vient avec les phases 2 à 4), **vérifiée en transaction annulée,
>   pas appliquée** ; en-têtes compacts (icône du type, titre court, date), filtres type / séquence / publication
>   (gardés dans le navigateur), colonne Moyenne facultative (calculée sur les colonnes affichées), indicateur de
>   cellule (brouillon *, copie à corriger ●, copie manquante ○), bouton « i » → visionneuse ouverte sur l'élève,
>   pied « Copies manquantes », rendu téléphone (classes en rangée, noms étroits). Titre court et séquence dans le
>   formulaire de l'éval. Vérifié dans Chrome sur la 4D, et à 390 px.
>   **En ligne le 02/11/2026** (« Oui, mets en ligne ») : migration 060 appliquée (2 colonnes vides, 27 évals
>   intactes), PR #22 fusionnée, déploiement Pages OK, vérifié sur le site publié (grille 4D, formulaire avec titre
>   court et séquence, « i » sur Ayaz). Prochaine étape : phase 2, modale élève × éval.
> - Phase 2 **codée le 02/11/2026** (branche `feat/hub-phase2`) : migration 061 (table
>   `assessment_grade_revisions` + trigger d'archivage, RLS lecture prof seule), **vérifiée en transaction
>   annulée, pas appliquée** ; modale élève × éval (`components/StudentGradeModal.tsx`) ouverte par le « i » de
>   chaque cellule, tous types : note modifiable (même saisie que le carnet), statut, brouillon / validée,
>   publiée ou non, copie (pages, zoom), transcription (seule ou en onglet), correction (détail, radar, à
>   arbitrer), historique des versions, actions (valider, corriger / recorriger avec Claude, ajouter ou
>   remplacer la copie, imprimer en PDF), ← → élèves, ↑ ↓ pages, Échap. Données et gestes extraits dans
>   `hooks/useAssessmentCopies.ts`, partagés avec la visionneuse de la fiche. Vérifié dans Chrome sur la 4D.
>   Reportés : critères (type groupe) à la phase 3, réponses (type production) à la phase 6.
>   **En ligne le 02/11/2026** (« Oui, mets en ligne ») : migration 061 appliquée (table vide, RLS, trigger,
>   424 notes intactes), PR #23 fusionnée, déploiement OK, vérifié sur le site publié (modale d'Ayaz, 4D :
>   copie, correction, radar, section Historique avec la version actuelle). Prochaine étape : phase 3,
>   séances de groupe dans le carnet.
> - Phase 3 **codée le 02/11/2026** (branche `feat/hub-phase3`) : migration 063 (kind `groupe`,
>   `written_assessments.group_session_id`, synchronisation par déclencheurs sur les tables de séance de groupe
>   — web et mobile —, note individuelle ajustable, éval à la corbeille si la séance est supprimée, auteur
>   'groupe' dans l'historique), **vérifiée en transaction annulée, pas appliquée** ; la bascule des séances
>   passées est une commande à part, limitée au compte de Thomas (13 séances ; un autre compte a 1 séance, qui
>   ne sera versée que si elle change). Web : type « TP de groupe » (icône, filtre, formulaire avec type et
>   barème verrouillés), détail de séance extrait dans `components/groups/GroupSessionDetail.tsx` et partagé
>   par la page Groupes et la fiche de l'éval, section Critères dans la modale (groupe, membres, points, malus,
>   note du groupe, note ajustée et « Remettre la note du groupe »).
>   **En ligne le 02/11/2026** (« Oui, mets en ligne ») : PR #24 fusionnée, déploiement OK, migration 063
>   appliquée (6 déclencheurs, fonction fermée aux clients), bascule du compte de Thomas : 13 évals « TP de
>   groupe » hors moyenne et non publiées, 252 notes, les 424 notes existantes intactes. Vérifié sur le site
>   publié (carnet 3A, modale avec critères et historique « Séance de groupe », fiche avec la section séance,
>   moyenne inchangée, console sans erreur). À reprendre : la fiche d'un TP de groupe affiche encore les blocs
>   de copies scannées, inutiles pour ce type (corrigé en phase 4). Prochaine étape : phase 4.
> - Phase 4 **codée le 02/11/2026** (branche `feat/hub-phase4`) : migration 064 (`corrections_withheld`,
>   fonctions élève `get_student_grades` et `get_student_work_correction` réécrites depuis leur version EN
>   LIGNE, qui vient de la PR #3 non fusionnée) et Edge Function `student-doc` (version 3 déployée + refus du
>   corrigé retenu), **vérifiées en transaction annulée, pas appliquées**. Web : « Publier… » ouvre un choix
>   « notes et corrections » ou « notes seulement », puis « Publier les corrections » sur la ligne ; « Retenir
>   les corrections » dans le menu ⋯ ; l'espace élève dit « La correction sera publiée plus tard ». « Copier
>   pour Pronote » (menu ⋯ de la ligne) : colonne des notes brutes, ordre des noms deviné sur les deux
>   lettres du pseudo, lignes douteuses surlignées. « Dupliquer » dans l'en-tête de la fiche (une ou plusieurs
>   classes, sujet et corrigé recopiés, trimestre en cours). Fiche d'un TP de groupe sans blocs de copies.
>   L'avancement en chiffres existait déjà sur la ligne de classe. Mise en ligne : migration 064, puis
>   redéploiement de `student-doc`, puis fusion.
>   **En ligne le 02/11/2026** (« Oui, mets en ligne ») : migration 064 appliquée (aucune éval retenue, les 7
>   évals publiées montrent tout comme avant, droits élève intacts), `student-doc` redéployée en version 4
>   (répond et lit la nouvelle colonne), PR #25 fusionnée, déploiement OK. Vérifié sur le site publié :
>   Dupliquer et Publier… sur la fiche, menu ⋯ d'une éval publiée avec Copier pour Pronote et Retenir les
>   corrections, console sans erreur ; aucune publication réelle modifiée. Prochaine étape : phase 5.
> - Phase 5 **codée le 02/11/2026** (branche `feat/hub-phase5`), **sans migration ni changement serveur** :
>   correction en lot tenue par le navigateur (`lib/aiBatch.ts`, `hooks/useAiBatch.ts`, `AiBatchPanel`) :
>   bouton « Corriger avec Claude (N copies) » dans la visionneuse quand un kit existe et qu'au moins deux
>   copies scannées n'ont pas de note ; même Edge Function `corriger-copie` qu'un élève seul, deux copies à la
>   fois, coût annoncé (≈ 0,30 $ la copie), avancement, erreurs, « Arrêter » ; arrêt automatique sur une erreur
>   de clé API ou de crédits ; reprise = relancer (les copies notées sont sautées). Exports dans « Exporter… »
>   (ex-« Exporter en PDF ») : PDF, Word (`lib/correctionsDocx.ts`, docx déjà en dépendance) et Markdown
>   pseudonymisé (`lib/copiesMarkdown.ts`) : « Élève 01… » dans l'ordre de la classe, correspondance affichée
>   dans la fenêtre, prénoms, pseudos et noms en capitales remplacés dans commentaires et transcriptions
>   (vérifié sur les 25 copies de 4D : 23 prénoms dans les données brutes, 0 dans l'export).
>   **En ligne le 02/11/2026** (« Oui, mets en ligne ») : PR #26 fusionnée, déploiement OK, vérifié sur le site
>   publié (« Exporter… » et ses trois formats sur la fiche de 4D, console sans erreur, rien téléchargé). Le lot
>   n'a pas encore tourné en vrai (aucune copie scannée sans note). Prochaine étape : phase 6.
> - Phase 6 **codée le 02/11/2026** (branche `feat/hub-phase6`), **sans migration ni changement serveur** :
>   « + Évaluation » demande d'abord le type (`NewAssessmentChooser`) : Évaluation (formulaire habituel),
>   Production numérique (choisir une activité existante : « Ouvrir sa fiche » si la classe en a déjà une,
>   sinon l'éval est créée et reçoit les notes déjà corrigées), TP de groupe (lance la séance au téléphone,
>   l'explique sur ordinateur, où la séance ne s'affiche pas). Panneau « activité × classe » extrait de la
>   page Productions (`components/productions/ActivityClassPanel.tsx`) et affiché dans la fiche de l'éval liée
>   (section Activité numérique : envois, corrigé attendu, correction, impression, Claude par fichier). Q5 :
>   dans la fiche, la note suit la correction (chaque correction enregistrée ou importée part au carnet ; à
>   l'ouverture, rattrapage des notes plus anciennes que la correction, `lib/productionSync.ts`, une retouche
>   faite à la main après la correction n'est pas écrasée). Modale du carnet : section Production (statut,
>   note, binôme, lien « Corriger / Revoir sa production » vers la fiche, qui l'ouvre). Menu : Groupes et
>   Productions retirés, pages conservées et joignables ; raccourci « Groupes » de l'Accueil remplacé par
>   Évaluations. La fiche n'ouvre plus d'office la visionneuse pour une éval sans copies.

---

## 1. Cartographie — ce qui existe (constaté, pas supposé)

### 1.1 Les quatre onglets et leurs briques

| Onglet | Écrans (web) | Tables | Stockage / fonctions | Qui écrit |
|---|---|---|---|---|
| **Évaluations** (= Carnet + fiche d'éval, en ligne depuis hier) | `pages/Evaluations.tsx` (grille), `CarnetTab.tsx`, `pages/AssessmentSheet.tsx` (fiche), `AssessmentDetail.tsx`, `CopyViewer.tsx`, `AddCopyDialog.tsx`, `ExportCorrectionsDialog.tsx`, `AssessmentModal.tsx`, `AssessmentStatsPanel.tsx`, `PronoteImportModal.tsx` | `written_assessments` (25 évals, dont 1 TP), `assessment_series`, `assessment_grades` (424), `assessment_copy_pages` (60), `assessment_copy_transcripts` (25), `assessment_correction_kits` (3, par version du sujet), `assessment_ai_corrections` (1), `assessment_upload_tokens`, `assessment_placements`, `class_groups` (demi-groupes, pour l'effectif attendu), `trimester_settings` | Buckets privés `assessment-copies`, `assessment-docs`. Edge Functions `corriger-copie` (API Claude, JWT prof), `depot-copie` (QR code, jeton), `purge-assessment-copies` (pg_cron, nuit). RPC élève `get_student_grades` | Web (saisie, validation, publication), **mobile** (scan en séance, création d'éval, placement), **Correcteur PC** (`push_grades.py` : notes brouillon, détail, transcriptions, kits ; `sync_copies.py` : lecture des pages) |
| **Productions** | `pages/Productions.tsx`, `productions/WorkCorrection.tsx`, `productions/HeldWorksAlert.tsx` (bandeau global) | `activities` (2), `student_works` (82), `student_work_versions`, `student_work_held`, `activity_assessments` (1 : lien activité × classe → éval du carnet) | Edge Function `student-doc` (réception des fiches depuis l'app élève, sans compte). RPC élève `get_student_work_correction` | **App élève** (hors de ce dépôt) crée l'activité et envoie les fiches ; web corrige (critères, auto pour les QCM), valide, imprime, envoie au carnet (crée une éval `kind = 'tp'`, coef 1, notes validées) |
| **Groupes** (historique des TP notés) | `pages/GroupSessions.tsx` ; **notation en direct** : `contexts/GroupSessionContext.tsx` + `live-session/Group{SessionLauncher,ClassSelector,Setup,Grading,Summary}.tsx` (lancé depuis l'Accueil), `GroupSplitter.tsx` (demi-groupes durables, autre chose) | `group_sessions` (14), `grading_criteria` (38), `session_groups` (80), `session_group_members`, `group_grades` (174), `tp_templates` (6, critères réutilisables), `group_session_photos` | Bucket photos de TP. Pas d'Edge Function, pas de RPC élève : **les notes de groupe n'atteignent ni le carnet, ni les moyennes, ni l'espace élève** | Web (overlay en séance) et **mobile** (même flux) créent et notent ; le web relit, corrige les notes, exporte un PDF « fiches à découper », gère matériel et photos |
| **« Carnet » au sens du brief** (détail d'une copie) | C'est la **visionneuse** dans la fiche d'éval : liste des élèves, pages, zoom, Correction (détail par question + radar), Transcription, Valider la note, PDF, Ajouter une copie, Corriger / Recorriger avec Claude, encadré « À arbitrer » | (celles d'Évaluations) | | |

Autres notes qui existent et ne sont dans aucun des trois types du brief : **participation** (`trimester_grades`, 323 lignes, note /20 par trimestre, onglet Suivi élèves / Analyses) et **oral** (`oral_evaluations`, 92 lignes, 1 à 5). Voir Q1.

### 1.2 Ce que l'élève voit aujourd'hui (PWA élève, RPC sans compte)
`get_student_grades` : note, commentaire, détail (si validée) des évals **publiées** (`published_to_students`), sujet et corrigé, et la correction d'une production via `get_student_work_correction`. Rien des séances de groupe. L'onglet « Notes » doit être activé par classe (`class_student_tabs.show_grades`).

### 1.3 Ce que le brief demande et qui **existe déjà** (à ne pas refaire)
| Demande du brief | Existe | Où |
|---|---|---|
| Grille élèves × évals, saisie clavier, Tab/Entrée, pied moyenne/médiane, colonne moyenne pondérée, colonne des noms figée | oui | Carnet (`CarnetTab.tsx`) — par classe × trimestre, tous types confondus (`kind`) |
| Indicateur d'état dans l'en-tête (à valider, publiée, scan, sans note) | oui (depuis hier) | pastille d'en-tête |
| Copie multi-pages, zoom ; transcription seule ou en onglet à côté de la copie | oui | `CopyViewer.tsx` |
| Détail par question, compétences (radar), forces / faiblesses, commentaire | oui | `GradeDetailsView.tsx` (prof et élève) |
| Valider la correction IA (par élève, par classe) ; brouillon invisible de l'élève tant que non validé | oui | fiche, ligne de classe + visionneuse |
| Recorriger avec Claude (un élève) ; confirmation si la note est validée ; kit par version du sujet ; alerte « autre version » | oui | `corriger-copie` + `CopyViewer` |
| Remplacer / ajouter la copie : fichiers (images, PDF page par page), webcam, **QR code → page téléphone** (jeton 15 min, 8 pages) | oui | `AddCopyDialog.tsx`, `/depot`, `depot-copie` |
| Imprimer la correction en PDF (un élève, ou la classe avec récapitulatif) | oui | `ExportCorrectionsDialog.tsx`, `correctionsPdf.ts` |
| Navigation élève précédent / suivant sans fermer | oui (↑ ↓) | visionneuse |
| Statistiques : moyenne, médiane, min/max, histogramme, comparaison des classes d'une série | oui | fiche › Statistiques |
| Sujet et corrigé (PDF/image, docx converti) | oui | fiche |
| Publier / dépublier (notes **et** corrections ensemble) | oui, un seul interrupteur | ligne de classe |
| Export des notes (Excel, PDF, toutes classes) ; import CSV Pronote | oui | menu ⋯ du Carnet |
| Export Markdown pour Claude + import JSON | oui **pour les productions seulement** | `productionsExport.ts` |
| Suppression auto des scans 30 j après publication, prolongation, suppression manuelle | oui | menu ⋯ de la ligne de classe |
| Séries (même éval sur plusieurs classes, sujet et corrigé communs) | oui | `assessment_series` |
| **Import du paquet de la classe** (PDF du photocopieur ou photos), découpage en copies de N pages, attribution dans l'ordre alphabétique, retouches (glisser, couper, fusionner, tourner), absents, webcam élève par élève | oui (PR #20, 02/11) | `ClassCopiesDialog`, `lib/classCopies.ts` |
| Bucket privé + URL signées, RLS partout, jeton QR haché à expiration courte, API Claude sans nom (pseudos) | oui | migrations 052 à 059 |

### 1.4 Ce qui **manque** par rapport au brief
1. **Type `groupe`** : aucun lien entre une séance de groupe et le carnet. Pas de note individuelle ajustable, pas de publication, pas de moyenne.
2. **Modale élève × éval** unique et adaptative (copie / transcription / critères / réponses / correction). Aujourd'hui : copie et correction dans la visionneuse ; réponses d'une production dans `WorkCorrection` (page Productions) ; critères de groupe dans la modale Groupes.
3. **Historique des corrections** (versions datées, IA ou prof) : `assessment_grades` ne garde que l'état courant ; `student_works` a un historique des *envois*, pas des corrections.
4. **Publication séparée** notes / corrections : un seul drapeau `published_to_students`.
5. **Titre court, séquence, icône de type** dans les en-têtes ; **filtres** type / période / séquence / publiée (le Carnet filtre par classe et trimestre seulement).
6. ~~Découpage d'un PDF de classe~~ : fait le 02/11 (PR #20). Reste éventuellement la lecture du nom en haut de page par l'API (1 à 2 centimes par classe), à décider.
7. **Correction IA en lot** (toutes les copies non corrigées, file d'attente, progression). Aujourd'hui : un élève à la fois, 1 à 2 min chacun, limite de durée de l'Edge Function.
8. **Exports** : colonne de notes « prête pour Pronote » (ordre alphabétique, Abs / NR) ; corrections en **Word** ; **Markdown pseudonymisé** pour l'assistant Claude côté copies.
9. **Création unifiée par type** ; composition des groupes depuis le hub ; choix de l'activité numérique.
10. **Dupliquer** une évaluation.
11. Grille **sur téléphone** : la colonne des noms est déjà figée, mais la page n'a pas été pensée pour 390 px.

---

## 2. Inventaire des fonctionnalités et leur destination

Légende : **Hub** = onglet Évaluations (grille), **Fiche** = fiche de l'éval (panneau de l'évaluation), **Modale** = modale élève × éval, **Création** = flux « + Évaluation ». Rien ne disparaît sans ta validation ; les lignes « à décider » sont en §6.

### Évaluations (copies)
| Fonction | Aujourd'hui | Destination |
|---|---|---|
| Grille, saisie clavier, raccourcis a/d/n/z/*, moyennes | Carnet | **Hub** (inchangé, + filtres, en-têtes compacts) |
| Créer une éval (+ série multi-classes) | « + Évaluation » | **Création**, type `copie` |
| Créer une éval en séance, scanner, placement | mobile | mobile (inchangé) |
| Modifier (nom, barème avec conversion, coef, type, date, aménagements, série), supprimer | Fiche › Modifier | **Fiche** (+ dupliquer) |
| Sujet / corrigé | Fiche | **Fiche** |
| État par classe, Voir les copies, Valider la classe, Publier, Exporter en PDF, scans (⋯) | Fiche, ligne de classe | **Fiche** |
| Visionneuse : pages, zoom, Correction, Transcription, Valider la note, PDF, Ajouter une copie, Corriger avec Claude, À arbitrer | Fiche | **Modale** (par élève) ; la Fiche garde la liste des élèves avec leur état comme entrée vers la modale et pour l'import |
| Statistiques et comparaison des classes | Fiche | **Fiche** |
| Sauvegarder (Excel, PDF), Importer Pronote | menu ⋯ du Hub | **Hub**, menu ⋯ (+ export « colonne Pronote » dans la Fiche) |
| Espace élève : note, détail, sujet, corrigé | RPC | inchangé, + publication séparée des corrections |

### Productions
| Fonction | Aujourd'hui | Destination |
|---|---|---|
| Liste des activités, fermer / rouvrir les envois, corrigé attendu | Productions | **Fiche** de l'éval de type `production` (section Activité) |
| Bandeau « envois fermés mais des élèves travaillent » + récupération | global | inchangé (global) |
| Tableau des élèves : statut, binôme, envois, note auto | Productions | **Fiche** (liste des élèves, comme pour les copies) |
| Corriger une fiche par critères, Auto, binôme, remarques, compétences, conseils, rouvrir, supprimer, historique des envois | `WorkCorrection` | **Modale**, section Réponses + Correction |
| Envoyer / mettre à jour les notes au carnet | bouton | disparaît comme geste : l'éval de type `production` **est** la colonne du carnet ; la note suit la correction (à décider : Q5) |
| Imprimer les corrigées | bouton | **Fiche** › Exports |
| Exporter pour Claude / importer la correction | menu ⋯ | **Fiche** › Exports (fusionné avec l'export Markdown des copies) |
| Création d'une activité | app élève (hors dépôt) | **Création** : type `production` = choisir une activité existante (Q6) |

### Groupes (TP notés)
| Fonction | Aujourd'hui | Destination |
|---|---|---|
| Lancer une séance de groupe, choisir la classe, critères (modèles `tp_templates`), composer les groupes, noter en direct, malus, résumé, mode Académie (épreuve) | overlay web (Accueil) et mobile | **inchangé** : c'est un outil de séance, pas un onglet. Ajout : à la fin, l'éval de type `groupe` apparaît dans le carnet |
| Historique des séances par classe, détail des groupes, modifier les notes par critère | onglet Groupes | **Fiche** de l'éval `groupe` (critères × groupes) ; **Modale** pour un élève (son groupe, ses critères, note de groupe et note individuelle) |
| Matériel nécessaire, photos de référence | onglet Groupes | **Fiche** › section TP (Q4) |
| Exporter PDF « fiches à découper » (3 par page) | onglet Groupes | **Fiche** › Exports (gardé tel quel) |
| Supprimer la séance (et la séance classique liée) | onglet Groupes | **Fiche** › Supprimer (avec le même avertissement) |
| Demi-groupes durables (Répartition, `class_groups`) | Classes / Séances | inchangé (ce n'est pas une note) |

---

## 3. Modèle de données unifié — proposition

### 3.1 Constat qui simplifie tout
Le modèle cible du brief existe **déjà aux deux tiers** : `written_assessments` est l'évaluation (avec `kind`, barème, coef, période, série, publication, sujet, corrigé) et `assessment_grades` est **la** cellule élève × éval (note, note brute, statut noté / absent / dispensé / non rendu, validée ou non, détail JSON, commentaire, adaptée). Les productions y entrent déjà (`activity_assessments` relie activité × classe → éval). Seules les séances de groupe sont à côté.

→ **Stratégie : pas de nouvelle table d'agrégation, pas de migration destructive.** On garde `written_assessments` + `assessment_grades` comme colonne vertébrale, on relie les groupes, on ajoute ce qui manque par colonnes et petites tables, et une **vue SQL** pour la lecture unifiée. Les tables `group_*` et `student_works` restent telles quelles (le mobile et l'app élève continuent d'y écrire).

### 3.2 Migration 060 (additive, réversible)
```sql
-- Évaluation
alter table written_assessments
  add column short_name text,                       -- titre court pour l'en-tête
  add column sequence text,                         -- « Séquence 1 »
  add column group_session_id uuid references group_sessions(id) on delete set null,
  add column details_published boolean not null default true;  -- corrections visibles ? (notes : published_to_students)
-- kind accepte une valeur de plus : 'groupe' (texte libre aujourd'hui ; contrainte à ajouter si tu veux)

-- Historique des corrections : une ligne par version, jamais modifiée
create table assessment_grade_revisions (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references assessment_grades(id) on delete cascade,
  user_id uuid not null,
  source text not null check (source in ('prof','ia','correcteur','production','groupe')),
  grade numeric, grade_raw numeric, comment text, details jsonb,
  created_at timestamptz not null default now()
);  -- + RLS propriétaire, + trigger : chaque UPDATE de assessment_grades qui change note/détail/commentaire archive l'ancienne valeur

-- Note de groupe par membre : `assessment_grades.details` porte { "v": 2, "groupe": { "nom", "membres", "criteres": [...], "malus", "total" } }
-- et grade_raw = total du groupe, ajustable par élève (la cellule reste individuelle).

-- Lecture unifiée (optionnelle, pour la grille et la modale)
create view assessment_cells as
  select g.*, a.kind, a.class_id, a.period, a.school_year, a.published_to_students, a.details_published,
         exists(select 1 from assessment_copy_pages p where p.assessment_id = g.assessment_id and p.student_id = g.student_id) as has_copy,
         exists(select 1 from assessment_copy_transcripts t where t.assessment_id = g.assessment_id and t.student_id = g.student_id) as has_transcript,
         (a.kind = 'groupe') as has_criteria,
         exists(select 1 from activity_assessments aa join student_works w on w.activity_id = aa.activity_id and w.class_id = aa.class_id and w.student_id = g.student_id where aa.assessment_id = g.assessment_id) as has_answers
  from assessment_grades g join written_assessments a on a.id = g.assessment_id;
```
Retour arrière : `drop view`, `drop table assessment_grade_revisions`, `alter table … drop column` × 4. Aucune donnée existante modifiée.

### 3.3 Correspondance type ↔ existant
| Type du brief | `kind` | Données de la cellule | Lien |
|---|---|---|---|
| `copie` | `ecrit`, `dm` | pages, transcription, détail v1 (questions, compétences) | — |
| `groupe` | **`groupe`** (nouveau) | détail v2 « groupe » (critères, membres, malus) | `group_session_id` |
| `production` | `tp` (existant) | réponses dans `student_works.content`, correction dans `student_works.correction` | `activity_assessments` |
| hors brief | `oral`, `projet` | note seule | — |

### 3.4 Bascule des séances de groupe existantes
Un script (ou une fonction SQL) crée, **pour chaque séance terminée**, une éval `kind = 'groupe'` (nom, classe, date de la séance, barème = somme des critères, période déduite de la date) et une ligne `assessment_grades` par membre (grade_raw = total du groupe, détail v2). Lancé seulement après ta validation, rejouable, et annulable (suppression des évals créées ; les tables `group_*` ne bougent pas). Les 14 séances existantes = 14 colonnes de plus dans les carnets concernés : à toi de dire si tu les veux toutes (Q3).

---

## 4. Écrans — ce qui change par rapport à aujourd'hui

- **Hub (grille)** : ce que tu as validé hier, plus : titre court + icône de type + date dans l'en-tête, filtres (type, période, séquence, publiée), bouton « i » dans la cellule → Modale, pied « copies manquantes », passage téléphone (390 px : colonne des noms étroite « Prénom N. », en-têtes sur deux lignes, scroll horizontal). La saisie clavier ne change pas.
- **Modale élève × éval** (nouvelle) : sections conditionnelles. Copie et Correction viennent de la visionneuse actuelle ; Réponses vient de `WorkCorrection` ; Critères vient de la modale Groupes ; Historique vient de la nouvelle table. ← → entre élèves. Actions : note, valider, recorriger avec Claude, remplacer / ajouter la copie, PDF.
- **Fiche de l'éval** = le « panneau de l'évaluation » du brief. Je propose de **garder la page** validée hier plutôt qu'un panneau latéral (Q2) : les sections qu'il demande y sont déjà (infos, stats, sujet, corrigé, publication, import, exports, modifier, supprimer) ; on ajoute l'avancement en chiffres, la publication séparée, l'import par PDF découpé, la correction en lot, les exports Pronote / Word / Markdown, dupliquer, et la section Activité (productions) ou TP (groupes). La liste des élèves y reste comme **tableau d'avancement** (scanné, corrigé, validé) et comme porte d'entrée de la modale.
- **Création** : « + Évaluation » → choix du type, puis le formulaire actuel (copie), ou activité à choisir (production), ou lancement de la séance de groupe (groupe : critères, composition — c'est l'overlay existant).
- **Productions et Groupes** : retirés de la navigation **à la fin** (phase 6), une fois que tout est accessible depuis le hub et que tu l'as constaté. Le code reste.

---

## 5. Phases (chacune testable seule, une PR, un récap)

| Phase | Contenu | Livrable testable | Migration |
|---|---|---|---|
| **1. Modèle + grille** | Migration 060 (titre court, séquence ; historique et vue reportés aux phases qui s'en servent). Grille : titre court, icône de type, date, filtres, bouton « i » (ouvre la visionneuse actuelle en attendant la modale), pied « manquantes », mobile | Grille filtrable sur téléphone et PC, données inchangées | 060 (additive) |
| **2. Modale élève × éval** | Sections copie / transcription / correction + historique ; ← → ; actions ; PDF individuel. La visionneuse de la fiche s'appuie dessus | Même chaîne copies qu'aujourd'hui, dans la modale | — |
| **3. Groupes → hub** | Fin de séance → éval `groupe` + cellules par membre ; note individuelle ajustable ; section Critères dans la modale ; Fiche : critères × groupes, matériel, photos, PDF fiches ; bascule des séances passées (après ton OK) ; espace élève : note publiable | Une séance de groupe notée apparaît dans le carnet et se publie | bascule (script, réversible) |
| **4. Fiche : publication, exports des notes** | Publication séparée notes / corrections (RPC élève à adapter) ; avancement en chiffres ; export « colonne Pronote » ; dupliquer ; (l'import du paquet de la classe existe depuis la PR #20) | Publier les notes sans les corrections ; copier la colonne dans Pronote | — (RPC modifiée, rétro-compatible) |
| **5. IA en lot + exports des corrections** | File de correction (table `assessment_ai_jobs` ou boucle côté client avec reprise), progression, erreurs ; exports Word (docx, déjà en dépendance) et Markdown pseudonymisé (Élève 01…, table de correspondance dans l'app) | Corriger 25 copies d'un clic, suivre, valider ; sortir le Word et le Markdown | petite table de file (additive) |
| **6. Création unifiée + retrait** | « + Évaluation » par type ; Réponses d'une production dans la modale ; Fiche › section Activité (envois, corrigé attendu) ; retrait de Productions et Groupes de la navigation (code conservé) | Tout se fait depuis Évaluations | — |

Ordre proposé : 1 → 2 → 3 → 4 → 5 → 6. Les phases 3, 4 et 5 sont indépendantes entre elles : on peut en remonter une si elle presse (ex. la correction en lot avant les groupes).

Dépendances techniques déjà présentes : `jspdf` + `jspdf-autotable` (PDF), `docx` 9 (Word), `pdf-lib` (découpage / lecture de PDF côté navigateur), `xlsx`, `recharts`, `qrcode`. **Aucune dépendance nouvelle** n'est nécessaire : pour le Word, `docx` est déjà là et produit un vrai .docx sans serveur ; pour le découpage PDF, `pdf-lib` extrait les pages et `AddCopyDialog` sait déjà rendre une page PDF en image.

---

## 6. Questions à trancher avant de coder

- **Q1. Participation et oral.** Les notes de participation (/20 par trimestre) et d'oral (1 à 5) ne sont dans aucun des trois types. Les laisser où elles sont (Suivi élèves, Analyses) ? Je le recommande pour ce chantier.
- **Q2. Panneau de l'évaluation : page ou panneau latéral ?** Je recommande de garder la fiche en page (validée hier) et de l'enrichir ; un panneau latéral n'aurait pas la place pour les copies et l'import.
- **Q3. Séances de groupe passées.** Faut-il verser les 14 séances existantes dans les carnets (une colonne chacune, trimestre déduit de la date), ou seulement celles à venir ? Et une note de groupe entre-t-elle dans la moyenne par défaut ?
- **Q4. Matériel et photos des TP** : dans la fiche de l'éval `groupe` (recommandé), ou dans « Mes TP » (modèles) ?
- **Q5. Productions : la note suit-elle la correction automatiquement** (dès qu'une fiche est corrigée, sa cellule du carnet se met à jour, brouillon tant que non validée), ou garde-t-on un geste « Envoyer au carnet » ? Je recommande l'automatique : c'est ce que « un hub unique » veut dire.
- **Q6. Création d'une activité numérique.** Les activités sont créées par l'app élève (hors de ce dépôt) ; depuis le hub, on ne pourra que **choisir** une activité existante. OK ?
- **Q7. Pseudonymisation de l'export Markdown** : « Élève 01, 02… » avec table de correspondance dans l'app (recommandé), alors que le Correcteur travaille aujourd'hui avec les pseudos « Prénom NO. ». Les deux peuvent coexister.
- **Q8. Historique des corrections** : conserver toutes les versions sans limite (recommandé, c'est petit), ou les N dernières ?
