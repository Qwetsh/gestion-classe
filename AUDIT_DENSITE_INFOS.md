# Densité d'information — ce qui est affiché par défaut, et ce qui devrait l'être

Date : 7 novembre 2026. Complète `AUDIT_DESIGN_UI.md` (qui traitait la forme) : ici on traite **la quantité de données visibles sans action**.

## Principe proposé

Une donnée est visible par défaut **seulement si elle sert à décider maintenant** (ouvrir, trier, repérer un problème). Tout le reste a trois destinations :

| Destination | Quand | Comment |
|---|---|---|
| **Au tap / survol** | utile une fois de temps en temps, lié à une ligne | infobulle, ou ligne qui s'étend au tap |
| **Dans le détail** | utile seulement une fois la ligne ouverte | page ou panneau de détail |
| **Retirer** | décoratif, redondant, ou que personne ne lit | supprimer |

Convention de lecture des tableaux : **G** garder · **T** au tap · **D** dans le détail · **R** retirer · **?** à trancher par Thomas. Coche ou corrige la colonne « Toi », je code ce qui est validé.

---

## Coquille (toutes les pages)

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| « T1 · 2026-2027 » sous le logo (barre latérale et barre du haut) | **R** | on ne change pas d'année en cours de route ; le trimestre est déjà dans Réglages et sur Suivi élèves | |
| Fil d'Ariane « Accueil › Séances » | **R** sur mobile, **G** bureau | sur téléphone la tab bar dit déjà où on est ; 1 ligne gagnée | |
| Sous-titre de page (« 127 séances cette année · 127 visibles », « Statistiques détaillées de vos classes », « Glissez-déposez les élèves… ») | **R** | explique ce que la page fait, lu une fois puis jamais ; les compteurs sont déjà dans les chips | |
| Pastille rouge « 2 » sur la cloche | **G** | c'est le seul signal de nouveauté | |
| Rappel « Pronote non connecté » | déjà fermable (palier 3) | | |

## Accueil

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| « samedi 7 novembre · fin de journée » | **G** | une ligne, donne le contexte du jour ; « fin de journée » est inutile → garder la date seule | |
| Carte « Démarrer une séance » + sous-titre « Suivre la participation en classe » | **G** / sous-titre **R** | le titre suffit | |
| Raccourcis « Travail de groupe · Noter un TP », « Épreuve · Points de maison » | sous-titres **R** | deux mots d'explication que tu connais | |
| EDT : « Importé le 24 sept. · Gérer » | **T** (dans le menu ‹ › ou Réglages › Emploi du temps) | n'intéresse qu'au moment d'importer | |
| EDT, cellule de cours : classe + **+3 −2 10 abs** + titre de séance | compteurs **T** | sur un cours **passé** les compteurs sont une info de bilan, pas de décision ; garder la classe, l'heure et le titre ; les compteurs au tap (le popover existe déjà) | |
| EDT, cellule : « 08:15 · 310 Sciences » (heure + salle) | salle **R** | tu connais ta salle ; l'heure est déjà sur l'axe | |
| Moyenne par classe : 11 barres + valeur | **G** mais ? | utile ? ou seulement à la fin du trimestre → peut-être **D** (page Analyses) | ? |
| Séances récentes : « 10 derniers jours · 5 séances » | **R** | | |
| Séances récentes, colonnes « Bonus · malus · absences » + « Événements » | événements **R**, badges **G** | le nombre d'événements n'aide pas à choisir une séance ; les badges oui | |
| Séances récentes : heure « 6 nov. 2026, 15:28 » | année **R** | « 6 nov. 15:28 » | |
| Moyenne d'implication « 11,7 /20 · T1 en cours » | **?** | KPI isolé ; utile tous les jours ? | ? |
| Mes tableaux : sous-titre « Cours préparés à l'avance, rangés par niveau et chapitre ; à ouvrir en classe depuis Plus ⋯ › Fichier. » | **R** | 2 lignes de mode d'emploi | |
| Mes tableaux : « modifié le 14 oct. » sur chaque ligne | **T** | | |
| Mes tableaux : « utilisé dans 2 séances » | **D** | | |

## Séances (liste)

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| Heure « 15:28 » | **G** | | |
| **Durée « 5' », « 196' »** sous l'heure | **R** (ton exemple) | ne sert à rien pour retrouver une séance ; 196' trahit juste une séance oubliée ouverte | |
| Pastille colorée de classe « 3B » **et** le nom « 3B » juste à côté | pastille **G**, texte **R** (ou l'inverse) | la même info deux fois | |
| Titre de séance « Évaluation », « Sequence 2 patent 1 » | **G** | c'est ce qui identifie la séance | |
| « 4 évts » + barre de progression verte/rouge/grise | **R** les deux | le total d'événements ne dit rien ; la barre répète les badges | |
| Badges « +1 · −0 · 3 abs » | **G** mais **masquer les zéros** : « −0 » n'apporte rien | | |
| Chevron › | **R** | toute la ligne est cliquable | |
| En-tête de jour « Vendredi 6 Novembre » | **G** | | |
| Chips de classes avec compteur « 3A 12 » | compteur **T** ou **R** | | |
| Vue « Semaine » / « Mois » : « +4 7 abs Activité 2 sequence 2 » dans chaque case | **T** | même logique que l'EDT | |

## Suivi élèves

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| « T1 · 2026-2027 · Note de base 10/20 » sous le titre | **R** (note de base → Réglages) | | |
| Bandeau « 2 ancien(s) élève(s) non réaffecté(s)… » avec bouton « Supprimer définitivement » | **D** (dans la fiche de classe ou Réglages › Données), fermable | il revient à chaque visite et prend 90 px | |
| Liste des classes : « 30 élèves · Moy. 11.0 » + pastille de moyenne | moyenne **G** (une seule fois), effectif **R** | | |
| En-tête de classe : « 30 élèves · 30 affichés » | **R** | « 30 affichés » n'a de sens que si un filtre est actif → l'afficher seulement dans ce cas | |
| « MOYENNE DE CLASSE 11.0/20 » | **G** | | |
| Distribution des notes (histogramme) | **?** | joli, mais décide-t-on quelque chose avec ? Sinon **D** (Analyses) | ? |
| 4 indicateurs « Oral fait 12/30 · Participation 31 · Absences 7 · Bonus 0 » | « Oral fait » **G** (il reste des oraux à faire = décision), les 3 autres **T** ou **D** | | |
| Carte élève : « 1/25 sessions » | **R** | | |
| Carte élève : « −1 malus » | **G** seulement si ≠ 0 | | |
| Carte élève : sparkline + « 10 dernières séances » + « → 0.0 » | sparkline **G**, libellé **R**, delta **G** seulement si ≠ 0 | la légende « 10 dernières séances » est répétée 30 fois | |
| Chips « Tous 30 · À suivre 3 · En tête 7 » | **G** | c'est un vrai filtre | |
| Barre « A-Z · Note · Tendance · Absences » + 2 boutons de vue | **G** | | |

## Plan de salle

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| Sous-titre « Glissez-déposez… Survolez un bureau pour voir la fiche. » | **R** | | |
| Barre d'outils : 6 à 8 boutons visibles | **G** : Vue tableau, Générer, Sauvegarder ; **T** (menu ⋯) : Lier les tables, Couleur de table, Malus, Imprimer | 3 actions courantes, 4 occasionnelles | |
| Légende « 16-20 · 12-16 · 8-12 · < 8 · TENDANCE en hausse / en baisse » | **T** (icône « i ») | ne sert qu'avec Couleur de table activée → ne l'afficher que dans ce cas | |
| Onglets de salle « Salle 210 (info) · Salle 310 · + Salle » | **G** | | |
| « 3A · 0/30 placés · Salle 210 (info) » | **G** (c'est l'état du plan) | | |
| Panneau Non placés : note « 10/20 » à côté de chaque nom | **T** | la note n'aide à placer que si Couleur de table est active | |
| « Ce que voient les élèves : Tampons · Malus · Annales · Notes » (interrupteurs) | **D** (Réglages de la classe) | rien à voir avec le plan de salle | |

## Évaluations

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| Sous-titre « Toutes les notes d'une classe sur un trimestre, saisie au clavier. Le nom d'une colonne ouvre la fiche de l'éval. » | **R** | | |
| En-tête de colonne : « Évaluation du 11/09 · Écrit · 11/09 · /8 » | date **R** (déjà dans le nom), « Écrit » **T**, barème **G** | déjà allégé par PR #29 ; reste la date doublée | |
| « 2026-2027 » à côté de T1 T2 T3 | **R** | | |
| Filtres « Type · Séquence · Publication » + « Colonne moyenne » + « Détails des colonnes » | **T** (bouton Filtres) | déjà prévu dans l'audit V3 | |
| « i » dans chaque cellule | **T** (au survol seulement, déjà le cas en bureau) | | |

## Analyses

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| Sous-titre « Statistiques détaillées de vos classes » | **R** | | |
| 5 KPI « Participations · Malus · Absences · Sorties · Ratio +/− » | « Sorties » **?** ; « Ratio 66 % » **?** | lis-tu le ratio ? | ? |
| Notes d'oral : « Moyenne /5 · 107 élèves » | **G** | | |
| Comparaison Filles / Garçons | **?** | vraie question pédagogique ou curiosité ? | ? |

## Récompenses

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| Colonne « Classe » quand une classe est sélectionnée | **R** dans ce cas | 30 fois « 3D » | |
| Colonne « Carte · n°1 » | **T** | presque toujours n°1 | |
| « 0/10 » texte à côté de la barre | **R** quand 0 | | |
| Colonne « Bonus » vide pour 95 % des élèves | **G** mais n'afficher la colonne que si au moins un élève a 10 tampons | | |
| Bouton ↺ (réinitialiser) sur chaque ligne | **T** (menu ⋯ de la ligne) | action rare et destructive, 300 fois | |
| « Carte à tampons et bonus » sous le titre | **R** | | |

## Connexion / divers

| Info visible | Proposé | Pourquoi | Toi |
|---|---|---|---|
| « Gestion Classe v1.0 » sous la carte de connexion | **R** | | |
| « Connectez-vous à votre compte » | **R** | le formulaire le dit | |

---

## Ce que ça change, en chiffres (estimation)

- Séances, mobile : une ligne passe de 7 informations à 4 (heure, classe, titre, badges non nuls). Hauteur de ligne inchangée, lecture deux fois plus rapide.
- Suivi élèves, mobile : ≈ 180 px de moins avant le premier élève (sous-titre, bandeau, « 30 affichés », légendes).
- Accueil : 4 sous-titres et 2 lignes de métadonnées en moins ; les cellules de l'EDT ne portent plus que classe + titre.

## Méthode proposée pour coder

1. Tu valides ou corriges la colonne « Toi » (un mot suffit : G / T / D / R).
2. Je code par écran, dans cet ordre : Séances (ton exemple), Accueil, Suivi élèves, Plan de salle, le reste.
3. Règle générale que j'applique partout sans te demander : **jamais de « 0 » affiché** (−0, 0 abs, 0/10, 0 malus) et **jamais une info deux fois sur la même ligne**.

---

## Journal

**Appliqué le 7 novembre 2026** (branche `feat/densite-infos`, depuis `feat/design-suite`), liste validée telle quelle par Thomas ; les six points « ? » sont restés inchangés.
- Coquille : plus de « T1 · 2026-2027 » sous le logo (en infobulle) ; fil d'Ariane masqué sous 768 px ; `.page-subtitle` masqué et sous-titres inline retirés sur toutes les pages listées.
- Accueil : date seule ; lanceurs sans sous-titre ; EDT sans ligne source (engrenage dans la navigation), cellules réduites à classe + titre + point vert « séance enregistrée », compteurs et salle dans l'infobulle et le popover ; séances récentes sans sous-titre, sans colonne Événements, date sans année ; Mes tableaux sans mode d'emploi, « modifié le » et « utilisé dans » en infobulle.
- Séances : plus de durée, de nom de classe doublé, de « n évts », de barre, de chevron, de compteurs sur les chips ; badges seulement si ≠ 0 ; vues Semaine et Mois : compteurs en `title` ; légende obsolète supprimée.
- Suivi élèves : plus de ligne trimestre / note de base ; bandeau des anciens élèves remplacé par une ligne fermable en pied du panneau Classes ; panneau Classes sans effectif ni moyenne en texte ; « n affichés sur m » seulement si filtré ; seul l'indicateur « Oral fait » reste ; cartes sans « 1/25 sessions », malus et delta seulement si significatifs, légende de sparkline en infobulle ; vue liste alignée.
- Plan de salle : 3 boutons visibles + menu ⋯ (Lier, Couleur, Malus, Imprimer) ; légende seulement avec « Couleur de table » ; notes des non placés en infobulle sauf avec « Couleur de table » ; « Visibilité élèves » replié.
- Évaluations : en-têtes sans date doublée, type en infobulle ; plus de « 2026-2027 » ; filtres derrière un bouton « Filtres · n ».
- Analyses : sous-titre retiré. Récompenses : sous-titre retiré, colonne Classe masquée quand une classe est choisie, colonne Carte en infobulle, « 0/10 » masqué, colonne Bonus conditionnelle, ↺ dans un menu ⋯ par ligne.
- Connexion : plus de « v1.0 » ni de « Connectez-vous à votre compte ».
- Vérifié sur le serveur local connecté en 375 px (accueil, séances, suivi élèves, récompenses, évaluations : aucun « 0 » isolé, aucun débordement, aucune erreur console) ; `tsc -b` et `vite build` passent. Reste à ajuster : la cible du menu ⋯ des lignes de récompenses (mode compact ≈ 24 px) ; `wtt__lesson-meta`, `wtt__count*`, `dash__srow-count` sont désormais des règles CSS mortes.
