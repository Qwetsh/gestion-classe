---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['brainstorming-session-2026-02-02.md']
date: 2026-02-02
author: Thomas
project_name: Gestion classe
workflow_complete: true
---

# Product Brief: Gestion Classe

## Executive Summary

**Gestion Classe** est une application mobile-first conçue pour les enseignants français qui veulent une vision claire de leur vie de classe sans sacrifier leur attention pendant le cours.

Face à des solutions existantes soit inadaptées au contexte éducatif français, soit trop lentes pour une utilisation en classe, Gestion Classe propose une approche radicalement différente : un système de menu radial permettant d'enregistrer n'importe quelle action (participation, bavardage, absence...) en **moins de 2 secondes**, d'un seul doigt, sans quitter les élèves des yeux.

L'application se décline en deux interfaces complémentaires : une app mobile ultra-épurée pour la saisie terrain, et un dashboard desktop pour l'analyse et la gestion administrative.

---

## Core Vision

### Problem Statement

Les enseignants qui souhaitent suivre finement leur gestion de classe (participations, comportements, incidents) sont confrontés à un dilemme : soit ils utilisent des outils génériques (notes, papier) qui rendent l'analyse impossible, soit ils utilisent des apps dédiées trop lentes et inadaptées qui les déconnectent de leur classe.

**Le résultat :** La plupart abandonnent ou font avec un suivi approximatif, perdant une vision précieuse de leur pédagogie.

### Problem Impact

- **Temps perdu** en copier-coller, recomptage manuel, préparation de séances
- **Données inexploitables** : pas de stats, pas de tendances, pas d'analyse de biais
- **Vision pédagogique dégradée** : difficile d'identifier les séances efficaces, l'équité d'interrogation, les élèves en difficulté

### Why Existing Solutions Fall Short

| Solution | Limitation |
|----------|------------|
| Apps existantes (Additio, TeacherKit...) | Pas adaptées au système français, trop lentes (10+ sec/action), UX desktop-first |
| Samsung Notes / Papier | Manuel, pas d'analyse, copier-coller fastidieux |
| Pronote / ENT | Public (parents/élèves), pas de notes privées enseignant |

**Le gap :** Aucune solution ne propose une saisie terrain en < 2 secondes adaptée à l'urgence du cours.

### Proposed Solution

Une application à deux faces :

**📱 Mobile (en classe) :**
- Plan de classe interactif avec élèves positionnés
- Menu radial au long-press : participation, bavardage, absence, remarque... en 1-2 secondes
- Feedback haptique, 0 lag, réactif au doigt
- Création automatique de séance via emploi du temps

**🖥️ Desktop (hors classe) :**
- Dashboard avec toutes les classes et alertes
- Stats automatiques : participations, genre, efficacité séances
- Rapports pré-remplis (exclusions, conseils de classe)
- Gestion des plans de salle et configuration

### Key Differentiators

1. **UX "2 secondes max"** - Menu radial au doigt, pensé pour l'urgence terrain
2. **Contexte français** - Adapté au système éducatif français (trimestres, conseils de classe, Pronote-compatible en workflow)
3. **Offline-first** - Fonctionne sans connexion, sync en fin de séance
4. **Vision pédagogique** - Transforme des données brutes en insights actionnables

---

## Target Users

### Primary Users

**Persona 1 : Thomas - L'enseignant tech-savvy**

| Attribut | Détail |
|----------|--------|
| **Profil** | Prof de SVT, collège, 10 ans d'expérience |
| **Équipement** | Samsung Z Fold 4 (grand écran pliable) |
| **Charge** | 13 classes, ~280 élèves |
| **Workflow actuel** | Samsung Notes + S Pen (manuel, fastidieux) |
| **Motivation** | Vision claire de sa pédagogie, gain de temps |
| **Frustration** | Copier-coller, comptage manuel, données inexploitables |
| **Moment wow** | Notif → plan de classe → menu radial smooth en 2 sec |

**Persona 2 : Sophie - L'enseignante pragmatique**

| Attribut | Détail |
|----------|--------|
| **Profil** | Prof de Français, collège, 18 ans d'expérience |
| **Équipement** | Samsung S25 (écran standard) |
| **Workflow actuel** | Tableau Excel hebdomadaire (comptage manuel) |
| **Motivation** | Simplifier le suivi des participations |
| **Frustration** | Remplissage manuel du tableau chaque semaine |
| **Besoin spécifique** | Vue hebdomadaire en plus de la vue par séance |

**Points communs :**
- Enseignants collège en France
- Besoin de rapidité (pas de temps à perdre en classe)
- Veulent des stats automatiques sans effort
- Minimum de compréhension tech requis

### Secondary Users

Pour la V1, pas d'utilisateurs secondaires identifiés. L'app est **100% privée** pour l'enseignant.

*Évolution future possible :* partage de données avec CPE, direction, ou export pour conseils de classe.

### User Journey

**Phase 1 : Découverte**
- Bouche-à-oreille entre collègues proches
- "Regarde ce que j'utilise pour gérer ma classe"

**Phase 2 : Onboarding**
- Création de compte
- Import des élèves (Excel)
- Configuration des salles et plans de classe (sur PC)
- Connexion de l'emploi du temps

**Phase 3 : Premier cours (moment critique)**
- Notification "Vous avez cours avec les 3A"
- Tap → plan de classe prêt
- Premier long-press → menu radial → "Ça marche !"
- **Moment "aha!" :** la fluidité du menu radial

**Phase 4 : Usage quotidien**
- Routine : notif → saisie en cours → sync fin de séance
- Consultation des alertes (colles/remarques à faire)
- Analyse ponctuelle des stats sur desktop

**Phase 5 : Valeur long terme**
- Conseil de classe : "Mode conseil" avec données prêtes
- Fin de trimestre : notes de participation calculées automatiquement
- Fin d'année : vision complète de sa pédagogie

---

## Success Metrics

### User Success Metrics

| Métrique | Cible | Comment mesurer |
|----------|-------|-----------------|
| **Time to value** | ≤ 1 semaine | L'utilisateur ressent le bénéfice après 5 jours d'utilisation |
| **Temps par action** | ≤ 2 secondes | Chronométrage de la saisie participation/bavardage |
| **Efficacité globale** | = ou < workflow actuel | Pas de temps supplémentaire en classe vs Samsung Notes |
| **Complétude des données** | 100% des séances | Aucun trou dans l'historique après 1 trimestre |
| **Satisfaction menu radial** | "Professionnel et fluide" | Feedback subjectif : 0 frustration UX |

### Technical Success Metrics

| Métrique | Cible | Seuil d'échec |
|----------|-------|---------------|
| **Latence menu radial** | < 100ms | > 200ms = inacceptable |
| **Frame rate** | 60 FPS constant | Drops visibles = échec |
| **Sync offline** | Transparent | Perte de données = échec critique |
| **Temps de démarrage séance** | < 3 taps | > 5 taps = trop long |

### Adoption Metrics

| Métrique | Cible V1 | Horizon |
|----------|----------|---------|
| **Utilisateurs actifs** | 2 (Thomas + Aurélie) | Mois 1 |
| **Rétention Aurélie** | Utilisation toute l'année scolaire | Année 1 |
| **Diffusion collège** | < 10 collègues volontaires | Année 1-2 |

### Business Objectives

*Projet personnel - pas d'objectifs de revenus en V1*

| Objectif | Description |
|----------|-------------|
| **Validation du concept** | Prouver que le menu radial fonctionne en conditions réelles |
| **Usage durable** | L'app devient l'outil quotidien (remplace Samsung Notes définitivement) |
| **Scalabilité future** | Architecture permettant d'ajouter des utilisateurs facilement |

### Key Performance Indicators (KPIs)

**KPI #1 : Adoption**
> 2 utilisateurs actifs quotidiens en Mois 1

**KPI #2 : Rétention**
> 100% des séances documentées sur 1 trimestre

**KPI #3 : Efficacité UX**
> Action de saisie ≤ 2 secondes (mesure réelle)

**KPI #4 : Valeur perçue (1 an)**
> "Je ne reviendrais pas à Samsung Notes" - déclaration spontanée

---

## MVP Scope

### Core Features

**📱 Application Mobile**

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Plan de classe interactif** | Affichage des élèves positionnés selon la salle | Critique |
| **Menu radial** | Long-press → actions (participation, bavardage, absence, remarque, sortie + sous-menu) | Critique |
| **Sous-menu Sortie** | Infirmerie, toilettes, convocation, exclusion | Critique |
| **Feedback haptique** | Confirmation tactile des actions | Critique |
| **Sélection classe/salle** | Choix manuel de la classe puis de la salle | Critique |
| **Consultation historique** | Voir les séances passées et données enregistrées | Important |
| **Sync vers PC** | Données saisies visibles sur proto-dashboard | Critique |

**🖥️ Proto-Dashboard PC**

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Import élèves** | Import Excel (nom, prénom, genre, classe) | Critique |
| **Gestion des salles** | Créer/éditer les plans de salle | Critique |
| **Gestion des plans de classe** | Positionner les élèves par salle | Critique |
| **Visualisation données** | Voir les données saisies depuis le mobile | Important |
| **Configuration de base** | Paramètres utilisateur, classes, salles | Important |

**⚙️ Infrastructure**

| Feature | Description | Priorité |
|---------|-------------|----------|
| **Base de données** | Stockage élèves, séances, événements | Critique |
| **Sync bidirectionnelle** | Mobile ↔ PC (fin de séance ou manuel) | Critique |
| **Mode offline** | Saisie sans connexion, sync au retour | Critique |
| **Authentification simple** | Login unique (pas multi-comptes) | Critique |

### Out of Scope for MVP

| Feature | Raison du report | Version cible |
|---------|------------------|---------------|
| **Comptes multi-utilisateurs** | Thomas teste seul d'abord | V2 |
| **Notification emploi du temps** | Nécessite intégration EDT | V2 |
| **Création auto de séance** | Dépend de l'intégration EDT | V2 |
| **Stats avancées & graphiques** | Valeur ajoutée, pas critique | V2 |
| **Mode conseil de classe** | Valeur ajoutée, pas critique | V2 |
| **Rapports auto-générés** | Valeur ajoutée, pas critique | V2 |
| **Alertes sophistiquées** | Todo colles/remarques | V2 |
| **Comparaisons T1/T2** | Nécessite historique long | V2 |

### MVP Success Criteria

| Critère | Seuil de validation |
|---------|---------------------|
| **Adoption** | Thomas utilise l'app quotidiennement pendant 2 semaines |
| **Efficacité** | Saisie ≤ 2 secondes confirmée en conditions réelles |
| **Fiabilité** | 0 perte de données sur 1 mois |
| **UX Menu radial** | Ressenti "fluide et professionnel" |
| **Remplacement Samsung Notes** | Thomas n'ouvre plus Samsung Notes pour gérer sa classe |

**Go/No-Go V2 :**
> Si les 5 critères sont validés après 1 mois d'usage → Go pour V2 (multi-comptes, Aurélie)

### Future Vision

**V2 - Multi-utilisateurs & Automatisation**
- Comptes multi-utilisateurs (Aurélie, puis collègues)
- Intégration emploi du temps → notifications
- Création automatique de séance
- Stats avancées avec graphiques
- Mode conseil de classe
- Alertes todo (colles/remarques à traiter)

**V3 - Intelligence & Rapports**
- Rapports auto-générés (exclusion, conseil de classe)
- Analyse de biais (équité interrogation genre)
- Suggestions pédagogiques basées sur les données
- Export pour Pronote/administration

**Vision long terme**
- App de référence pour les enseignants français
- Communauté d'utilisateurs (< 10 au collège → expansion)
- Potentiel de monétisation si succès validé
