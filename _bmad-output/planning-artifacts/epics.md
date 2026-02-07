---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-02-02'
inputDocuments: ['prd.md', 'architecture.md']
project_name: 'Gestion Classe'
user_name: 'Thomas'
date: '2026-02-02'
---

# Gestion Classe - Epic Breakdown

## Overview

Ce document fournit le découpage complet en Epics et Stories pour Gestion Classe, décomposant les exigences du PRD et de l'Architecture en stories implémentables.

## Requirements Inventory

### Functional Requirements

**Gestion de Séance (FR1-FR6)**
- FR1: L'enseignant peut sélectionner une classe parmi sa liste de classes
- FR2: L'enseignant peut sélectionner une salle pour la séance en cours
- FR3: L'enseignant peut voir le plan de classe avec les élèves positionnés
- FR4: L'enseignant peut démarrer une nouvelle séance pour une classe/salle
- FR5: L'enseignant peut terminer une séance en cours
- FR6: L'enseignant peut consulter la liste des séances passées

**Saisie d'Actions - Menu Radial (FR7-FR17)**
- FR7: L'enseignant peut déclencher le menu radial via long-press sur un élève
- FR8: L'enseignant peut enregistrer une participation (+1) via le menu radial
- FR9: L'enseignant peut enregistrer un bavardage (-1) via le menu radial
- FR10: L'enseignant peut enregistrer une absence via le menu radial
- FR11: L'enseignant peut enregistrer une remarque libre via le menu radial
- FR12: L'enseignant peut accéder au sous-menu "Sortie" via le menu radial
- FR13: L'enseignant peut enregistrer une sortie infirmerie via le sous-menu
- FR14: L'enseignant peut enregistrer une sortie toilettes via le sous-menu
- FR15: L'enseignant peut enregistrer une convocation via le sous-menu
- FR16: L'enseignant peut enregistrer une exclusion via le sous-menu
- FR17: L'enseignant reçoit un feedback haptique à chaque action enregistrée

**Consultation des Données (FR18-FR21)**
- FR18: L'enseignant peut consulter l'historique d'un élève spécifique
- FR19: L'enseignant peut voir les événements d'une séance passée avec horodatage
- FR20: L'enseignant peut voir le compteur de participations/bavardages par élève dans la séance
- FR21: L'enseignant peut consulter l'historique des séances par classe

**Configuration & Import (FR22-FR28)**
- FR22: L'enseignant peut importer une liste d'élèves depuis un fichier Excel
- FR23: L'enseignant peut créer une nouvelle salle
- FR24: L'enseignant peut définir le plan d'une salle (disposition des places)
- FR25: L'enseignant peut positionner les élèves sur le plan d'une salle
- FR26: L'enseignant peut modifier le positionnement des élèves
- FR27: L'enseignant peut créer/modifier/supprimer des classes
- FR28: L'enseignant peut ajouter/retirer des élèves d'une classe en cours d'année

**Synchronisation & Offline (FR29-FR33)**
- FR29: L'application mobile fonctionne sans connexion internet
- FR30: Les données saisies hors ligne sont stockées localement
- FR31: Les données locales se synchronisent automatiquement au retour de la connexion
- FR32: L'enseignant peut déclencher une synchronisation manuelle
- FR33: Les données synchronisées sont visibles sur l'interface desktop

**Gestion des Utilisateurs (FR34-FR37)**
- FR34: Un utilisateur peut créer un compte
- FR35: Un utilisateur peut se connecter à son compte
- FR36: Un utilisateur peut se déconnecter
- FR37: Chaque utilisateur a ses propres données (classes, élèves, séances) isolées

**Protection des Données - RGPD (FR38-FR42)**
- FR38: Le système stocke les élèves sous forme pseudonymisée (prénom + 2 lettres nom)
- FR39: La table de correspondance complète est générée depuis l'import Excel
- FR40: La table de correspondance est stockée uniquement localement
- FR41: L'enseignant peut supprimer définitivement les données d'un élève
- FR42: L'enseignant peut supprimer définitivement les données d'une classe/année

### Non-Functional Requirements

**Performance (NFR1-NFR6)**
- NFR1: Latence apparition menu radial < 100ms (seuil échec > 200ms)
- NFR2: Frame rate animations menu 60 FPS constant
- NFR3: Temps de réponse feedback haptique < 50ms
- NFR4: Temps de démarrage app (cold start) < 3 secondes
- NFR5: Temps de chargement plan de classe < 500ms
- NFR6: Temps total saisie action ≤ 2 secondes

**Security & Privacy (NFR7-NFR12)**
- NFR7: Données serveur pseudonymisées (prénom + 2 lettres)
- NFR8: Table de correspondance stockée uniquement localement
- NFR9: Communications chiffrées (HTTPS/TLS)
- NFR10: Authentification requise pour accès aux données
- NFR11: Isolation complète des données entre utilisateurs
- NFR12: Suppression définitive possible (droit à l'oubli RGPD)

**Reliability & Data Integrity (NFR13-NFR16)**
- NFR13: Perte de données saisies = 0
- NFR14: Données locales persistantes après crash app = 100%
- NFR15: Résolution conflits sync automatique
- NFR16: Fonctionnement mode offline complet

**Accessibility (NFR17-NFR18)**
- NFR17: Taille minimale zones tactiles 44x44 pixels
- NFR18: Contraste texte suffisant WCAG AA (4.5:1 minimum)

### Additional Requirements

**Infrastructure (depuis Architecture)**
- Starter Template: Expo SDK 54 (`npx create-expo-app@latest --template blank-typescript`)
- Stockage Offline: Expo SQLite
- State Management: Zustand
- Navigation: Expo Router
- Authentification: Supabase Auth + Expo SecureStore
- Synchronisation: Fin de séance + bouton manuel
- Schéma DB: 6 tables (students, classes, rooms, class_room_plans, sessions, events)
- Pseudonymisation: Table de correspondance en SQLite local
- Build Mobile: EAS Build pour APK
- Web Dashboard: Vite + React, hébergé sur Vercel
- Prototype existant: Menu radial validé dans `gestion-classe-proto/`

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 4 | Sélectionner une classe |
| FR2 | Epic 4 | Sélectionner une salle |
| FR3 | Epic 4 | Voir le plan de classe |
| FR4 | Epic 4 | Démarrer une séance |
| FR5 | Epic 4 | Terminer une séance |
| FR6 | Epic 5 | Consulter séances passées |
| FR7 | Epic 4 | Menu radial via long-press |
| FR8 | Epic 4 | Enregistrer participation (+1) |
| FR9 | Epic 4 | Enregistrer bavardage (-1) |
| FR10 | Epic 4 | Enregistrer absence |
| FR11 | Epic 4 | Enregistrer remarque libre |
| FR12 | Epic 4 | Accéder sous-menu Sortie |
| FR13 | Epic 4 | Sortie infirmerie |
| FR14 | Epic 4 | Sortie toilettes |
| FR15 | Epic 4 | Convocation |
| FR16 | Epic 4 | Exclusion |
| FR17 | Epic 4 | Feedback haptique |
| FR18 | Epic 5 | Historique élève |
| FR19 | Epic 5 | Événements séance avec horodatage |
| FR20 | Epic 4 | Compteur participations/bavardages |
| FR21 | Epic 5 | Historique séances par classe |
| FR22 | Epic 2 | Import Excel |
| FR23 | Epic 3 | Créer une salle |
| FR24 | Epic 3 | Définir plan de salle |
| FR25 | Epic 3 | Positionner élèves |
| FR26 | Epic 3 | Modifier positionnement |
| FR27 | Epic 2 | CRUD classes |
| FR28 | Epic 2 | Ajouter/retirer élèves |
| FR29 | Epic 6 | Fonctionnement offline |
| FR30 | Epic 6 | Stockage local |
| FR31 | Epic 6 | Sync automatique |
| FR32 | Epic 6 | Sync manuelle |
| FR33 | Epic 8 | Données visibles sur desktop |
| FR34 | Epic 1 | Créer un compte |
| FR35 | Epic 1 | Se connecter |
| FR36 | Epic 1 | Se déconnecter |
| FR37 | Epic 1 | Isolation données utilisateur |
| FR38 | Epic 1 | Stockage pseudonymisé |
| FR39 | Epic 1 | Table correspondance depuis import |
| FR40 | Epic 1 | Table correspondance locale |
| FR41 | Epic 7 | Suppression données élève |
| FR42 | Epic 7 | Suppression données classe |

## Epic List

### Epic 1: Authentification & Espace Personnel

**Objectif:** L'enseignant peut créer un compte sécurisé et ses données sont automatiquement pseudonymisées conformément au RGPD.

**FRs couverts:** FR34, FR35, FR36, FR37, FR38, FR39, FR40

**Fonctionnalités:**
- Création de compte (email/mot de passe)
- Connexion / Déconnexion
- Isolation des données par utilisateur (Supabase RLS)
- Pseudonymisation automatique des élèves (prénom + 2 lettres nom)
- Table de correspondance stockée uniquement en local (SQLite)

**NFRs adressés:** NFR7, NFR8, NFR9, NFR10, NFR11

---

### Epic 2: Configuration des Classes et Import

**Objectif:** L'enseignant peut importer ses listes d'élèves depuis Excel et gérer ses classes.

**FRs couverts:** FR22, FR27, FR28

**Fonctionnalités:**
- Import fichier Excel → parsing et création élèves pseudonymisés
- Génération table de correspondance locale
- Créer / modifier / supprimer des classes
- Ajouter / retirer des élèves d'une classe en cours d'année

**Dépendances:** Epic 1 (authentification requise)

---

### Epic 3: Configuration des Salles et Plans

**Objectif:** L'enseignant peut créer des salles avec leur disposition et positionner les élèves sur le plan de classe.

**FRs couverts:** FR23, FR24, FR25, FR26

**Fonctionnalités:**
- Création d'une nouvelle salle
- Définition du plan de salle (grille de places)
- Positionnement des élèves sur le plan
- Modification du positionnement existant

**NFRs adressés:** NFR5 (chargement plan < 500ms)

**Dépendances:** Epic 1, Epic 2 (classes et élèves requis)

---

### Epic 4: Conduite de Séance avec Menu Radial

**Objectif:** L'enseignant peut conduire une séance et enregistrer les actions élèves en moins de 2 secondes via le menu radial avec feedback haptique.

**FRs couverts:** FR1, FR2, FR3, FR4, FR5, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR20

**Fonctionnalités:**
- Sélection de la classe pour la séance
- Sélection de la salle
- Affichage du plan de classe avec élèves positionnés
- Démarrer / Terminer une séance
- Menu radial (long-press 250ms) avec 5 actions:
  - Participation (+1)
  - Bavardage (-1)
  - Absence
  - Remarque libre
  - Sortie (sous-menu: Infirmerie, Toilettes, Convocation, Exclusion)
- Feedback haptique à chaque action
- Compteur participations/bavardages visible par élève

**NFRs adressés:** NFR1 (< 100ms), NFR2 (60 FPS), NFR3 (< 50ms haptique), NFR6 (≤ 2s total), NFR17 (zones 44x44px)

**Note technique:** Intègre le code validé du prototype `gestion-classe-proto/`

**Dépendances:** Epic 1, Epic 2, Epic 3

---

### Epic 5: Consultation de l'Historique

**Objectif:** L'enseignant peut consulter l'historique complet des séances et des élèves.

**FRs couverts:** FR6, FR18, FR19, FR21

**Fonctionnalités:**
- Liste des séances passées
- Historique d'un élève spécifique (toutes ses actions)
- Détail d'une séance avec événements horodatés
- Historique des séances filtré par classe

**Dépendances:** Epic 4 (données de séances requises)

---

### Epic 6: Mode Hors-Ligne et Synchronisation

**Objectif:** L'application mobile fonctionne sans connexion et les données se synchronisent automatiquement.

**FRs couverts:** FR29, FR30, FR31, FR32

**Fonctionnalités:**
- Fonctionnement offline complet (toutes les features)
- Stockage local persistant (Expo SQLite)
- Synchronisation automatique en fin de séance
- Bouton de synchronisation manuelle
- Gestion des conflits (last-write-wins)

**NFRs adressés:** NFR13 (0 perte), NFR14 (persistance crash), NFR15 (résolution conflits), NFR16 (offline complet)

**Dépendances:** Epic 1 à 5 (fonctionnalités à rendre offline)

---

### Epic 7: Suppression des Données (RGPD)

**Objectif:** L'enseignant peut exercer le droit à l'oubli RGPD et supprimer définitivement les données.

**FRs couverts:** FR41, FR42

**Fonctionnalités:**
- Suppression définitive des données d'un élève (local + serveur)
- Suppression définitive des données d'une classe/année
- Confirmation avant suppression
- Cascade sur les événements liés

**NFRs adressés:** NFR12 (droit à l'oubli)

**Dépendances:** Epic 2, Epic 6 (sync pour suppression serveur)

---

### Epic 8: Dashboard Web

**Objectif:** L'enseignant peut consulter et gérer ses données depuis un navigateur web.

**FRs couverts:** FR33

**Fonctionnalités:**
- Interface web responsive (Vite + React)
- Authentification (même compte que mobile)
- Consultation des données synchronisées
- Vue des séances, historiques, statistiques
- Hébergement Vercel

**NFRs adressés:** NFR18 (contraste WCAG AA)

**Dépendances:** Epic 1, Epic 6 (données synchronisées disponibles)

---

## Résumé

| Epic | Titre | FRs | Statut |
|------|-------|-----|--------|
| 1 | Authentification & Espace Personnel | 7 | À faire |
| 2 | Configuration des Classes et Import | 3 | À faire |
| 3 | Configuration des Salles et Plans | 4 | À faire |
| 4 | Conduite de Séance avec Menu Radial | 17 | À faire |
| 5 | Consultation de l'Historique | 4 | À faire |
| 6 | Mode Hors-Ligne et Synchronisation | 4 | À faire |
| 7 | Suppression des Données (RGPD) | 2 | À faire |
| 8 | Dashboard Web | 1 | À faire |

**Total:** 8 Epics, 42 FRs couverts (100%)

---

## Epic 1: Authentification & Espace Personnel

**Objectif:** L'enseignant peut créer un compte sécurisé et ses données sont automatiquement pseudonymisées conformément au RGPD.

**FRs couverts:** FR34, FR35, FR36, FR37, FR38, FR39, FR40

**NFRs concernés:** NFR7, NFR8, NFR9, NFR10, NFR11

---

### Story 1.1: Initialisation du projet mobile

**As a** développeur,
**I want** un projet Expo configuré avec navigation et dépendances de base,
**So that** je peux commencer le développement des fonctionnalités.

**Acceptance Criteria:**

**Given** aucun projet n'existe
**When** j'exécute les commandes d'initialisation
**Then** un projet Expo SDK 54 est créé avec TypeScript
**And** Expo Router est configuré avec un layout de base
**And** Zustand est installé pour le state management
**And** le projet démarre sans erreur sur Android/iOS

---

### Story 1.2: Inscription enseignant

**As an** enseignant,
**I want** créer un compte avec mon email et un mot de passe,
**So that** je puisse accéder à mon espace personnel.

**Acceptance Criteria:**

**Given** je suis sur l'écran d'inscription
**When** je saisis un email valide et un mot de passe (min 8 caractères)
**Then** mon compte est créé dans Supabase
**And** je suis redirigé vers l'écran principal
**And** un message de confirmation s'affiche

**Given** je saisis un email déjà utilisé
**When** je soumets le formulaire
**Then** un message d'erreur m'informe que l'email existe déjà

**FR couvert:** FR34

---

### Story 1.3: Connexion enseignant

**As an** enseignant,
**I want** me connecter à mon compte existant,
**So that** je puisse accéder à mes données.

**Acceptance Criteria:**

**Given** je suis sur l'écran de connexion
**When** je saisis mes identifiants corrects
**Then** je suis authentifié et redirigé vers l'écran principal
**And** ma session est active

**Given** je saisis des identifiants incorrects
**When** je soumets le formulaire
**Then** un message d'erreur s'affiche
**And** je reste sur l'écran de connexion

**FR couvert:** FR35

---

### Story 1.4: Persistance de la session

**As an** enseignant,
**I want** rester connecté entre les sessions,
**So that** je n'aie pas à me reconnecter à chaque ouverture de l'app.

**Acceptance Criteria:**

**Given** je suis connecté et je ferme l'application
**When** je rouvre l'application
**Then** je suis automatiquement connecté
**And** je suis redirigé vers l'écran principal

**Given** mon token a expiré
**When** je rouvre l'application
**Then** je suis redirigé vers l'écran de connexion

**Note technique:** Utilise Expo SecureStore pour stocker les tokens.

---

### Story 1.5: Déconnexion enseignant

**As an** enseignant,
**I want** me déconnecter de mon compte,
**So that** je puisse sécuriser mes données si je partage mon appareil.

**Acceptance Criteria:**

**Given** je suis connecté
**When** j'appuie sur le bouton de déconnexion
**Then** ma session est terminée
**And** mes tokens sont supprimés du SecureStore
**And** je suis redirigé vers l'écran de connexion

**FR couvert:** FR36

---

### Story 1.6: Isolation des données utilisateur (RLS)

**As an** enseignant,
**I want** que mes données soient isolées des autres utilisateurs,
**So that** personne d'autre ne puisse voir mes classes et élèves.

**Acceptance Criteria:**

**Given** deux enseignants A et B avec leurs propres données
**When** l'enseignant A consulte ses données
**Then** il ne voit que ses propres classes, élèves et séances
**And** les données de l'enseignant B sont invisibles

**Note technique:** Configuration des Row Level Security (RLS) policies dans Supabase.

**FR couvert:** FR37, NFR11

---

### Story 1.7: Structure de base de données locale (SQLite)

**As an** enseignant,
**I want** que l'app puisse stocker des données localement,
**So that** je puisse utiliser l'app hors connexion et protéger les noms complets de mes élèves.

**Acceptance Criteria:**

**Given** l'application est installée
**When** je me connecte pour la première fois
**Then** une base SQLite locale est initialisée
**And** la structure inclut une table `local_student_mapping` pour la correspondance pseudonyme ↔ nom complet
**And** la table de correspondance n'est jamais synchronisée vers le serveur

**FR couverts:** FR38, FR40, NFR8

---

## Epic 2: Configuration des Classes et Import

**Objectif:** L'enseignant peut importer ses listes d'élèves depuis Excel et gérer ses classes.

**FRs couverts:** FR22, FR27, FR28, FR39

**Dépendances:** Epic 1 (authentification requise)

---

### Story 2.1: Création d'une classe

**As an** enseignant,
**I want** créer une nouvelle classe,
**So that** je puisse organiser mes élèves par groupe.

**Acceptance Criteria:**

**Given** je suis connecté
**When** je crée une nouvelle classe avec un nom (ex: "3ème B")
**Then** la classe est créée et apparaît dans ma liste
**And** la classe est associée à mon compte utilisateur

**Given** je crée une classe avec un nom vide
**When** je soumets le formulaire
**Then** un message d'erreur m'indique que le nom est requis

**FR couvert:** FR27 (partie création)

---

### Story 2.2: Modification et suppression d'une classe

**As an** enseignant,
**I want** modifier ou supprimer une classe existante,
**So that** je puisse corriger des erreurs ou retirer des classes obsolètes.

**Acceptance Criteria:**

**Given** j'ai une classe existante
**When** je modifie son nom
**Then** le nouveau nom est enregistré et affiché

**Given** j'ai une classe existante
**When** je la supprime
**Then** la classe est retirée de ma liste
**And** une confirmation est demandée avant suppression

**FR couvert:** FR27 (parties modification/suppression)

---

### Story 2.3: Import d'élèves depuis Excel

**As an** enseignant,
**I want** importer une liste d'élèves depuis un fichier Excel,
**So that** je puisse rapidement ajouter tous mes élèves sans saisie manuelle.

**Acceptance Criteria:**

**Given** j'ai un fichier Excel avec colonnes Nom et Prénom
**When** j'importe le fichier pour une classe
**Then** chaque élève est créé avec un pseudonyme (Prénom + 2 premières lettres du nom)
**And** la table de correspondance locale est mise à jour avec nom complet ↔ pseudonyme
**And** les élèves apparaissent dans la classe sélectionnée

**Given** le fichier Excel a un format invalide
**When** j'essaie de l'importer
**Then** un message d'erreur m'indique le problème de format

**FR couverts:** FR22, FR39

---

### Story 2.4: Ajout manuel d'un élève à une classe

**As an** enseignant,
**I want** ajouter manuellement un élève à une classe,
**So that** je puisse intégrer un nouvel élève en cours d'année.

**Acceptance Criteria:**

**Given** j'ai une classe existante
**When** j'ajoute un élève avec Nom et Prénom
**Then** l'élève est créé avec son pseudonyme
**And** la correspondance est stockée localement
**And** l'élève apparaît dans la liste de la classe

**FR couvert:** FR28 (partie ajout)

---

### Story 2.5: Retrait d'un élève d'une classe

**As an** enseignant,
**I want** retirer un élève d'une classe,
**So that** je puisse gérer les départs en cours d'année.

**Acceptance Criteria:**

**Given** un élève est dans une classe
**When** je le retire de la classe
**Then** l'élève n'apparaît plus dans cette classe
**And** ses données historiques sont conservées
**And** une confirmation est demandée avant retrait

**FR couvert:** FR28 (partie retrait)

---

## Epic 3: Configuration des Salles et Plans

**Objectif:** L'enseignant peut créer des salles avec leur disposition et positionner les élèves sur le plan de classe.

**FRs couverts:** FR23, FR24, FR25, FR26

**NFRs concernés:** NFR5 (chargement plan < 500ms)

**Dépendances:** Epic 1, Epic 2 (classes et élèves requis)

---

### Story 3.1: Création d'une salle

**As an** enseignant,
**I want** créer une nouvelle salle,
**So that** je puisse définir les lieux où j'enseigne.

**Acceptance Criteria:**

**Given** je suis connecté
**When** je crée une salle avec un nom (ex: "Salle 204")
**Then** la salle est créée et apparaît dans ma liste de salles
**And** la salle est associée à mon compte

**Given** je crée une salle sans nom
**When** je soumets
**Then** un message d'erreur m'indique que le nom est requis

**FR couvert:** FR23

---

### Story 3.2: Définition du plan de salle (grille)

**As an** enseignant,
**I want** définir la disposition des places dans une salle,
**So that** je puisse représenter l'agencement réel de ma classe.

**Acceptance Criteria:**

**Given** j'ai une salle existante
**When** je définis une grille (ex: 5 colonnes × 6 rangées)
**Then** le plan affiche les places disponibles
**And** je peux marquer certaines positions comme "pas de place" (allées, bureau prof)

**Given** je modifie la grille d'une salle existante
**When** je sauvegarde
**Then** les nouvelles dimensions sont enregistrées

**FR couvert:** FR24

---

### Story 3.3: Positionnement des élèves sur le plan

**As an** enseignant,
**I want** positionner mes élèves sur le plan d'une salle,
**So that** je puisse retrouver visuellement chaque élève pendant la séance.

**Acceptance Criteria:**

**Given** j'ai une classe avec des élèves et une salle avec un plan
**When** je glisse un élève vers une place libre
**Then** l'élève est assigné à cette position
**And** la place affiche le pseudonyme de l'élève

**Given** une place est déjà occupée
**When** je tente d'y placer un autre élève
**Then** un message m'indique que la place est prise
**Or** l'élève précédent est automatiquement désassigné (au choix UX)

**FR couvert:** FR25

---

### Story 3.4: Modification du positionnement

**As an** enseignant,
**I want** modifier le positionnement des élèves,
**So that** je puisse réorganiser ma classe en cours d'année.

**Acceptance Criteria:**

**Given** des élèves sont positionnés sur un plan
**When** je déplace un élève vers une autre place
**Then** sa nouvelle position est enregistrée
**And** l'ancienne place devient libre

**Given** des élèves sont positionnés
**When** je retire un élève du plan
**Then** la place devient libre
**And** l'élève apparaît dans la liste des "non placés"

**FR couvert:** FR26

---

## Epic 4: Conduite de Séance avec Menu Radial

**Objectif:** L'enseignant peut conduire une séance et enregistrer les actions élèves en moins de 2 secondes via le menu radial avec feedback haptique.

**FRs couverts:** FR1, FR2, FR3, FR4, FR5, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR20

**NFRs concernés:** NFR1 (<100ms), NFR2 (60 FPS), NFR3 (<50ms haptique), NFR6 (≤2s total), NFR17 (zones 44×44px)

**Dépendances:** Epic 1, Epic 2, Epic 3

**Note:** Intègre le code validé du prototype `gestion-classe-proto/`

---

### Story 4.1: Sélection de classe pour une séance

**As an** enseignant,
**I want** sélectionner une classe pour ma séance,
**So that** je puisse travailler avec le bon groupe d'élèves.

**Acceptance Criteria:**

**Given** je suis connecté et j'ai des classes
**When** je démarre une nouvelle séance
**Then** la liste de mes classes s'affiche
**And** je peux sélectionner une classe

**Given** je n'ai aucune classe
**When** je tente de démarrer une séance
**Then** un message m'invite à créer une classe d'abord

**FR couvert:** FR1

---

### Story 4.2: Sélection de salle pour une séance

**As an** enseignant,
**I want** sélectionner une salle pour ma séance,
**So that** je puisse voir le plan de classe correspondant.

**Acceptance Criteria:**

**Given** j'ai sélectionné une classe
**When** je choisis une salle
**Then** la salle est associée à la séance
**And** le plan de classe (classe + salle) est chargé

**Given** aucun plan n'existe pour cette combinaison classe/salle
**When** je sélectionne la salle
**Then** un message m'invite à positionner les élèves d'abord

**FR couvert:** FR2

---

### Story 4.3: Affichage du plan de classe en séance

**As an** enseignant,
**I want** voir le plan de classe avec mes élèves positionnés,
**So that** je puisse identifier rapidement chaque élève.

**Acceptance Criteria:**

**Given** j'ai sélectionné classe et salle avec un plan existant
**When** le plan s'affiche
**Then** chaque élève est visible à sa position avec son pseudonyme
**And** le chargement prend moins de 500ms (NFR5)
**And** les zones tactiles font minimum 44×44 pixels (NFR17)

**FR couvert:** FR3

---

### Story 4.4: Démarrage d'une séance

**As an** enseignant,
**I want** démarrer officiellement une séance,
**So that** les actions soient horodatées et enregistrées.

**Acceptance Criteria:**

**Given** j'ai sélectionné classe et salle
**When** j'appuie sur "Démarrer la séance"
**Then** une nouvelle séance est créée avec timestamp de début
**And** je suis sur l'écran de séance active
**And** je peux commencer à enregistrer des actions

**FR couvert:** FR4

---

### Story 4.5: Terminer une séance

**As an** enseignant,
**I want** terminer une séance en cours,
**So that** les données soient finalisées et prêtes pour consultation.

**Acceptance Criteria:**

**Given** une séance est en cours
**When** j'appuie sur "Terminer la séance"
**Then** le timestamp de fin est enregistré
**And** la séance passe en statut "terminée"
**And** je suis redirigé vers l'écran d'accueil ou récapitulatif

**FR couvert:** FR5

---

### Story 4.6: Menu radial - Déclenchement par long-press

**As an** enseignant,
**I want** déclencher le menu radial en maintenant appuyé sur un élève,
**So that** je puisse accéder rapidement aux actions.

**Acceptance Criteria:**

**Given** une séance est active et je vois le plan
**When** je maintiens appuyé sur un élève pendant 250ms
**Then** le menu radial apparaît centré sur l'élève
**And** l'apparition prend moins de 100ms (NFR1)
**And** un feedback haptique medium confirme l'ouverture

**Given** j'appuie brièvement (< 250ms)
**When** je relâche
**Then** le menu ne s'ouvre pas

**FR couvert:** FR7

---

### Story 4.7: Menu radial - Enregistrer une participation

**As an** enseignant,
**I want** enregistrer une participation via le menu radial,
**So that** je puisse noter qu'un élève a participé.

**Acceptance Criteria:**

**Given** le menu radial est ouvert
**When** je glisse vers l'option "Participation" (✋) et relâche
**Then** un événement participation (+1) est créé pour l'élève
**And** le compteur de participations de l'élève s'incrémente
**And** un feedback haptique success confirme l'action
**And** le temps total de saisie est ≤ 2 secondes (NFR6)

**FR couverts:** FR8, FR17, FR20

---

### Story 4.8: Menu radial - Enregistrer un bavardage

**As an** enseignant,
**I want** enregistrer un bavardage via le menu radial,
**So that** je puisse noter qu'un élève a bavardé.

**Acceptance Criteria:**

**Given** le menu radial est ouvert
**When** je glisse vers l'option "Bavardage" (💬) et relâche
**Then** un événement bavardage (-1) est créé pour l'élève
**And** le compteur de bavardages de l'élève s'incrémente
**And** un feedback haptique success confirme l'action

**FR couverts:** FR9, FR17, FR20

---

### Story 4.9: Menu radial - Enregistrer une absence

**As an** enseignant,
**I want** enregistrer une absence via le menu radial,
**So that** je puisse noter qu'un élève est absent.

**Acceptance Criteria:**

**Given** le menu radial est ouvert
**When** je glisse vers l'option "Absence" (❌) et relâche
**Then** un événement absence est créé pour l'élève
**And** l'élève est visuellement marqué comme absent sur le plan
**And** un feedback haptique success confirme l'action

**FR couverts:** FR10, FR17

---

### Story 4.10: Menu radial - Enregistrer une remarque

**As an** enseignant,
**I want** enregistrer une remarque libre via le menu radial,
**So that** je puisse noter une observation personnalisée.

**Acceptance Criteria:**

**Given** le menu radial est ouvert
**When** je glisse vers l'option "Remarque" (📝) et relâche
**Then** un champ de saisie texte apparaît
**And** je peux saisir ma remarque et valider
**And** un événement remarque avec le texte est créé
**And** un feedback haptique success confirme l'action

**FR couverts:** FR11, FR17

---

### Story 4.11: Menu radial - Sous-menu Sortie

**As an** enseignant,
**I want** accéder au sous-menu Sortie,
**So that** je puisse enregistrer différents types de sorties.

**Acceptance Criteria:**

**Given** le menu radial est ouvert
**When** je survole l'option "Sortie" (🚪) pendant 300ms
**Then** le sous-menu s'ouvre avec 4 options
**And** l'animation est fluide à 60 FPS (NFR2)
**And** un feedback haptique light confirme l'ouverture du sous-menu

**FR couvert:** FR12

---

### Story 4.12: Sous-menu Sortie - Infirmerie, Toilettes, Convocation, Exclusion

**As an** enseignant,
**I want** enregistrer les différents types de sortie,
**So that** je puisse tracer précisément les mouvements d'élèves.

**Acceptance Criteria:**

**Given** le sous-menu Sortie est ouvert
**When** je sélectionne "Infirmerie" (🏥)
**Then** un événement sortie_infirmerie est créé avec timestamp

**Given** le sous-menu Sortie est ouvert
**When** je sélectionne "Toilettes" (🚻)
**Then** un événement sortie_toilettes est créé avec timestamp

**Given** le sous-menu Sortie est ouvert
**When** je sélectionne "Convocation" (📋)
**Then** un événement convocation est créé avec timestamp

**Given** le sous-menu Sortie est ouvert
**When** je sélectionne "Exclusion" (⛔)
**Then** un événement exclusion est créé avec timestamp

**And** chaque sélection déclenche un feedback haptique success

**FR couverts:** FR13, FR14, FR15, FR16, FR17

---

### Story 4.13: Compteurs visibles par élève

**As an** enseignant,
**I want** voir les compteurs de participations et bavardages de chaque élève,
**So that** je puisse suivre leur comportement pendant la séance.

**Acceptance Criteria:**

**Given** une séance est active
**When** je regarde le plan de classe
**Then** chaque élève affiche ses compteurs (ex: "+3 / -1")
**And** les compteurs se mettent à jour instantanément après chaque action

**FR couvert:** FR20

---

## Epic 5: Consultation de l'Historique

**Objectif:** L'enseignant peut consulter l'historique complet des séances et des élèves.

**FRs couverts:** FR6, FR18, FR19, FR21

**Dépendances:** Epic 4 (données de séances requises)

---

### Story 5.1: Liste des séances passées

**As an** enseignant,
**I want** consulter la liste de mes séances passées,
**So that** je puisse retrouver une séance spécifique.

**Acceptance Criteria:**

**Given** j'ai effectué des séances
**When** j'accède à l'historique des séances
**Then** je vois la liste de toutes mes séances
**And** chaque séance affiche: date, classe, salle, durée
**And** les séances sont triées par date décroissante (plus récentes en haut)

**Given** je n'ai aucune séance
**When** j'accède à l'historique
**Then** un message m'indique qu'il n'y a pas encore de séances

**FR couvert:** FR6

---

### Story 5.2: Historique d'un élève spécifique

**As an** enseignant,
**I want** consulter l'historique complet d'un élève,
**So that** je puisse voir son comportement sur la durée.

**Acceptance Criteria:**

**Given** j'ai un élève avec des événements enregistrés
**When** je consulte son historique
**Then** je vois tous ses événements (participations, bavardages, absences, remarques, sorties)
**And** chaque événement affiche: type, date, séance associée
**And** je vois un résumé (total participations, total bavardages, etc.)

**FR couvert:** FR18

---

### Story 5.3: Détail d'une séance avec événements horodatés

**As an** enseignant,
**I want** voir le détail d'une séance passée avec tous les événements,
**So that** je puisse revoir ce qui s'est passé pendant le cours.

**Acceptance Criteria:**

**Given** j'ai une séance terminée
**When** je consulte son détail
**Then** je vois tous les événements de la séance
**And** chaque événement affiche: heure exacte, élève concerné, type d'action
**And** les événements sont triés chronologiquement

**FR couvert:** FR19

---

### Story 5.4: Historique des séances par classe

**As an** enseignant,
**I want** filtrer l'historique des séances par classe,
**So that** je puisse consulter les séances d'une classe spécifique.

**Acceptance Criteria:**

**Given** j'ai plusieurs classes avec des séances
**When** je filtre par une classe spécifique
**Then** seules les séances de cette classe s'affichent
**And** je peux facilement basculer entre les classes

**FR couvert:** FR21

---

## Epic 6: Mode Hors-Ligne et Synchronisation

**Objectif:** L'application mobile fonctionne sans connexion et les données se synchronisent automatiquement.

**FRs couverts:** FR29, FR30, FR31, FR32

**NFRs concernés:** NFR13 (0 perte), NFR14 (persistance crash), NFR15 (résolution conflits), NFR16 (offline complet)

**Dépendances:** Epics 1-5 (fonctionnalités à rendre offline)

---

### Story 6.1: Fonctionnement offline complet

**As an** enseignant,
**I want** utiliser toutes les fonctionnalités de l'app sans connexion internet,
**So that** je puisse travailler même dans des zones sans réseau.

**Acceptance Criteria:**

**Given** je suis connecté et je perds la connexion internet
**When** j'utilise l'application
**Then** toutes les fonctionnalités restent disponibles (séances, menu radial, consultation)
**And** aucune erreur réseau n'est affichée à l'utilisateur
**And** un indicateur discret montre le mode offline

**Given** je lance l'app sans connexion (après une première connexion)
**When** j'utilise l'application
**Then** je peux créer des séances et enregistrer des actions normalement

**FR couvert:** FR29, NFR16

---

### Story 6.2: Stockage local persistant

**As an** enseignant,
**I want** que mes données saisies hors ligne soient stockées de manière fiable,
**So that** je ne perde jamais de données.

**Acceptance Criteria:**

**Given** je suis en mode offline et j'enregistre des actions
**When** les données sont créées
**Then** elles sont immédiatement persistées dans SQLite local
**And** les données survivent à un crash ou redémarrage de l'app (NFR14)

**Given** je ferme l'app en mode offline
**When** je la rouvre
**Then** toutes mes données offline sont toujours présentes

**FR couvert:** FR30, NFR13, NFR14

---

### Story 6.3: Synchronisation automatique

**As an** enseignant,
**I want** que mes données se synchronisent automatiquement quand je retrouve la connexion,
**So that** je n'aie pas à y penser.

**Acceptance Criteria:**

**Given** j'ai des données non synchronisées et je retrouve la connexion
**When** je termine une séance
**Then** les données sont automatiquement envoyées vers Supabase
**And** un indicateur de sync s'affiche brièvement
**And** les données locales sont marquées comme synchronisées

**Given** deux appareils ont modifié la même donnée offline
**When** la synchronisation se produit
**Then** le conflit est résolu automatiquement (last-write-wins) (NFR15)

**FR couvert:** FR31, NFR15

---

### Story 6.4: Synchronisation manuelle

**As an** enseignant,
**I want** pouvoir déclencher manuellement une synchronisation,
**So that** je puisse forcer l'envoi de mes données quand je le souhaite.

**Acceptance Criteria:**

**Given** j'ai une connexion internet
**When** j'appuie sur le bouton "Synchroniser"
**Then** toutes les données non synchronisées sont envoyées
**And** un message confirme le succès ou indique les erreurs
**And** je vois le nombre d'éléments synchronisés

**Given** je n'ai pas de connexion
**When** j'appuie sur "Synchroniser"
**Then** un message m'indique que la connexion est indisponible

**FR couvert:** FR32

---

## Epic 7: Suppression des Données (RGPD)

**Objectif:** L'enseignant peut exercer le droit à l'oubli RGPD et supprimer définitivement les données.

**FRs couverts:** FR41, FR42

**NFRs concernés:** NFR12 (droit à l'oubli)

**Dépendances:** Epic 2, Epic 6 (sync pour suppression serveur)

---

### Story 7.1: Suppression définitive des données d'un élève

**As an** enseignant,
**I want** supprimer définitivement toutes les données d'un élève,
**So that** je puisse respecter le droit à l'oubli RGPD.

**Acceptance Criteria:**

**Given** j'ai un élève avec des données (événements, participations, etc.)
**When** je demande la suppression définitive de cet élève
**Then** une confirmation explicite est demandée ("Cette action est irréversible")
**And** après confirmation, toutes les données de l'élève sont supprimées:
  - Données locales (SQLite)
  - Données serveur (Supabase)
  - Table de correspondance locale
  - Événements associés (cascade)
**And** l'élève n'apparaît plus nulle part dans l'application

**Given** je suis offline
**When** je supprime un élève
**Then** la suppression locale est effectuée
**And** la suppression serveur est mise en file d'attente pour la prochaine sync

**FR couvert:** FR41, NFR12

---

### Story 7.2: Suppression définitive des données d'une classe/année

**As an** enseignant,
**I want** supprimer définitivement toutes les données d'une classe ou d'une année,
**So that** je puisse faire le ménage en fin d'année scolaire.

**Acceptance Criteria:**

**Given** j'ai une classe avec des élèves, séances et événements
**When** je demande la suppression définitive de la classe
**Then** une confirmation explicite est demandée avec récapitulatif:
  - Nombre d'élèves concernés
  - Nombre de séances concernées
  - "Cette action est irréversible"
**And** après confirmation, toutes les données sont supprimées:
  - La classe
  - Tous les élèves de la classe
  - Toutes les séances de la classe
  - Tous les événements associés
  - Les entrées de correspondance locale
**And** les données sont supprimées en local et sur le serveur

**Given** je veux supprimer les données d'une année entière
**When** je sélectionne "Supprimer toutes les données"
**Then** toutes mes classes et données associées sont supprimées
**And** mon compte reste actif mais vide

**FR couvert:** FR42, NFR12

---

## Epic 8: Dashboard Web

**Objectif:** L'enseignant peut consulter et gérer ses données depuis un navigateur web.

**FRs couverts:** FR33

**NFRs concernés:** NFR18 (contraste WCAG AA)

**Dépendances:** Epic 1, Epic 6 (données synchronisées disponibles)

**Stack:** Vite + React, hébergé sur Vercel

---

### Story 8.1: Initialisation du projet web

**As a** développeur,
**I want** un projet web configuré avec Vite et React,
**So that** je puisse développer le dashboard.

**Acceptance Criteria:**

**Given** aucun projet web n'existe
**When** j'initialise le projet
**Then** un projet Vite + React + TypeScript est créé
**And** React Router est configuré pour la navigation
**And** le client Supabase est configuré
**And** le projet démarre sans erreur

---

### Story 8.2: Authentification web

**As an** enseignant,
**I want** me connecter au dashboard avec mon compte existant,
**So that** je puisse accéder à mes données depuis un navigateur.

**Acceptance Criteria:**

**Given** j'ai un compte créé via l'app mobile
**When** je me connecte sur le dashboard web
**Then** j'accède à mon espace personnel
**And** je vois les mêmes données que sur mobile (synchronisées)

**Given** je ne suis pas connecté
**When** j'accède au dashboard
**Then** je suis redirigé vers la page de connexion

---

### Story 8.3: Consultation des classes et élèves

**As an** enseignant,
**I want** consulter mes classes et élèves sur le web,
**So that** je puisse voir mes données sur grand écran.

**Acceptance Criteria:**

**Given** je suis connecté au dashboard
**When** j'accède à la section "Classes"
**Then** je vois la liste de toutes mes classes
**And** je peux voir les élèves de chaque classe (pseudonymes)
**And** le contraste respecte WCAG AA (NFR18)

---

### Story 8.4: Consultation des séances et historiques

**As an** enseignant,
**I want** consulter l'historique des séances sur le web,
**So that** je puisse analyser les données sur un écran confortable.

**Acceptance Criteria:**

**Given** je suis connecté au dashboard
**When** j'accède à la section "Séances"
**Then** je vois la liste de toutes mes séances synchronisées
**And** je peux consulter le détail d'une séance (événements horodatés)
**And** je peux filtrer par classe

---

### Story 8.5: Statistiques et vue d'ensemble

**As an** enseignant,
**I want** voir des statistiques globales sur le dashboard,
**So that** je puisse avoir une vue d'ensemble de mes classes.

**Acceptance Criteria:**

**Given** je suis connecté avec des données synchronisées
**When** j'accède au tableau de bord
**Then** je vois des statistiques:
  - Nombre total de séances
  - Participations / Bavardages par classe
  - Élèves les plus actifs
**And** les données sont présentées de manière claire et lisible

---

### Story 8.6: Déploiement sur Vercel

**As a** développeur,
**I want** déployer le dashboard sur Vercel,
**So that** les enseignants puissent y accéder en ligne.

**Acceptance Criteria:**

**Given** le projet web est fonctionnel
**When** je configure le déploiement Vercel
**Then** le site est accessible via une URL publique
**And** les déploiements sont automatiques sur push vers main
**And** les variables d'environnement Supabase sont configurées

**FR couvert:** FR33

---

## Récapitulatif

| Epic | Titre | Stories | FRs |
|------|-------|---------|-----|
| 1 | Authentification & Espace Personnel | 7 | FR34-40 |
| 2 | Configuration des Classes et Import | 5 | FR22, 27, 28, 39 |
| 3 | Configuration des Salles et Plans | 4 | FR23-26 |
| 4 | Conduite de Séance avec Menu Radial | 13 | FR1-5, 7-17, 20 |
| 5 | Consultation de l'Historique | 4 | FR6, 18, 19, 21 |
| 6 | Mode Hors-Ligne et Synchronisation | 4 | FR29-32 |
| 7 | Suppression des Données (RGPD) | 2 | FR41-42 |
| 8 | Dashboard Web | 6 | FR33 |
| **TOTAL** | | **45 stories** | **42/42 FRs (100%)** |
