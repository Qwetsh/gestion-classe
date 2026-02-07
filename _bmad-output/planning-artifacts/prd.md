---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
workflowComplete: true
completedAt: '2026-02-02'
inputDocuments: ['product-brief-gestion-classe-2026-02-02.md', 'brainstorming-session-2026-02-02.md']
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: 'Mobile App + Web App'
  domain: 'EdTech'
  complexity: 'Medium'
  projectContext: 'Greenfield'
  keyConcerns: ['RGPD données élèves', 'UX performance critique', 'Offline-first']
---

# Product Requirements Document - Gestion Classe

**Author:** Thomas
**Date:** 2026-02-02

---

## Executive Summary

**Gestion Classe** - Application mobile-first pour enseignants français.

**Problème :** Les enseignants n'ont pas d'outil adapté pour suivre leur gestion de classe (participations, comportements) sans perdre l'attention de leurs élèves. Les solutions existantes sont trop lentes (10+ sec/action) ou inadaptées au contexte français.

**Solution :** Menu radial tactile permettant d'enregistrer n'importe quelle action en < 2 secondes, inspiré des jeux vidéo, avec sync offline et dashboard desktop pour configuration et visualisation.

**Différenciateur :** UX "2 secondes max" - aucune app éducative n'offre cette rapidité. Innovation de type "make or break" : si le menu radial échoue, le projet s'arrête.

**Utilisateurs MVP :** Thomas (créateur, prof SVT) + Aurélie (épouse, prof Français), enseignants collège.

**Stack technique :** React Native (mobile) + React SPA (desktop) + Supabase (backend)

**Conformité :** RGPD via pseudonymisation native - données serveur non-identifiantes.

---

## Success Criteria

### User Success

| Critère | Mesure | Cible | Méthode de validation |
|---------|--------|-------|----------------------|
| **Time to value** | Temps avant perception du bénéfice | ≤ 1 semaine | Feedback utilisateur |
| **Rapidité de saisie** | Temps pour noter une action | ≤ 2 secondes | Chronométrage terrain |
| **Efficacité globale** | Comparaison workflow actuel | = ou < Samsung Notes | Auto-évaluation |
| **Complétude** | Séances documentées | 100% sur 1 trimestre | Audit des données |
| **Satisfaction UX** | Ressenti menu radial | "Fluide et professionnel" | Feedback qualitatif |
| **Remplacement total** | Samsung Notes non utilisé | 1 mois consécutif | Observation usage |

### Business Success

| Critère | Cible | Horizon |
|---------|-------|---------|
| **Adoption initiale** | 2 utilisateurs actifs quotidiens | Mois 1 |
| **Rétention** | Usage continu sans abandon | Année scolaire complète |
| **Diffusion** | < 10 collègues volontaires | Année 1-2 |
| **Go/No-Go V2** | 5 critères MVP validés | Après 1 mois d'usage |

### Technical Success

| Critère | Cible | Seuil d'échec | Impact |
|---------|-------|---------------|--------|
| **Latence menu radial** | < 100ms | > 200ms | UX dégradée |
| **Frame rate** | 60 FPS constant | Drops visibles | Frustration utilisateur |
| **Sync offline** | Transparente | Perte de données | Échec critique |
| **Démarrage séance** | < 3 taps | > 5 taps | Friction excessive |
| **Fiabilité données** | 0 perte | Toute perte | Échec critique |

### Measurable Outcomes

**KPI #1 - Adoption**
> 2 utilisateurs actifs quotidiens après 1 mois

**KPI #2 - Rétention**
> 100% des séances documentées sur 1 trimestre

**KPI #3 - Performance UX**
> Saisie confirmée en ≤ 2 secondes en conditions réelles

**KPI #4 - Remplacement**
> "Je ne reviendrais pas à Samsung Notes" après 1 mois

---

## Product Scope

### MVP - Minimum Viable Product

**📱 Mobile**
- Plan de classe interactif avec élèves positionnés
- Menu radial (participation, bavardage, absence, remarque, sortie + sous-menu)
- Feedback haptique
- Consultation historique des séances
- Sync vers PC

**🖥️ Desktop**
- Import élèves (Excel)
- Gestion salles et plans de classe
- Visualisation des données saisies
- Configuration de base

**⚙️ Infrastructure**
- Base de données (élèves, séances, événements)
- Sync bidirectionnelle mobile ↔ PC
- Mode offline avec sync au retour
- Authentification multi-comptes (Thomas + Aurélie)

### Growth Features (Post-MVP - V2)

- Comptes multi-utilisateurs (Aurélie, puis collègues)
- Intégration emploi du temps → notifications automatiques
- Création automatique de séance
- Stats avancées avec graphiques
- Mode conseil de classe
- Alertes todo (colles/remarques à traiter)

### Vision (Future - V3+)

- Rapports auto-générés (exclusion, conseil de classe)
- Analyse de biais (équité interrogation genre)
- Suggestions pédagogiques basées sur les données
- Export pour administration
- Potentiel de monétisation si succès validé

---

## User Journeys

### Journey 1 : Thomas - Premier cours avec l'app

**Contexte :** Lundi matin, Thomas entre en classe avec les 3èA.

**Avant (Samsung Notes) :**
1. Thomas entre en classe, sort son téléphone
2. Ouvre Samsung Notes, cherche la bonne note
3. Copie-colle le plan de la séance précédente
4. Efface les annotations (participations, bavardages)
5. Note le sujet de la séance
6. Pendant le cours : écrit à la main sur le plan, parfois oublie
7. Après le cours : doit tout recompter manuellement pour les stats

**Après (Gestion Classe) :**
1. Thomas entre en classe, sort son téléphone
2. Ouvre l'app → Sélectionne 3èA → Sélectionne salle 310
3. Plan de classe prêt avec tous les élèves positionnés
4. Pendant le cours : long-press sur élève → menu radial → action en 1-2 sec
5. Feedback haptique confirme l'action sans regarder l'écran
6. Fin de cours : ferme l'app, sync automatique
7. Stats calculées automatiquement

**Moment "Aha!" :** La fluidité du menu radial - "Ça marche vraiment en 2 secondes !"

---

### Journey 2 : Thomas - Incident et contestation

**Contexte :** Un élève conteste une remarque mise la semaine dernière.

**Situation :** L'élève dit "Mais monsieur, j'ai pas bavardé la semaine dernière !"

**Workflow :**
1. Thomas ouvre l'app sur son téléphone
2. Navigue vers l'historique de l'élève
3. Retrouve la séance concernée avec horodatage exact
4. Montre à l'élève : "Regarde, c'était le mardi à 10h34"
5. L'élève ne peut pas contester, les données sont là

**Valeur :** Les données sont accessibles mais discrètes - pas affichées en permanence, mais disponibles quand nécessaire.

---

### Journey 3 : Thomas - Configuration initiale

**Contexte :** Dimanche soir, avant la rentrée. Thomas configure l'app sur son PC.

**Workflow :**
1. Connexion au dashboard PC
2. Import des élèves via fichier Excel (nom, prénom, genre, classe)
3. Création des salles (310, 210, etc.)
4. Positionnement des élèves sur les plans de classe
5. Configuration des classes et associations salle/classe
6. Sync vers mobile
7. Prêt pour le premier cours

**Durée acceptable :** Un setup annuel + gestion des ajouts/suppressions d'élèves en cours d'année.

---

### Journey 4 : Aurélie - Adoption via bouche-à-oreille

**Contexte :** Aurélie (prof de Français, Samsung S25) voit Thomas utiliser l'app.

**Workflow :**
1. Aurélie observe Thomas noter une participation en 1 seconde
2. "C'est quoi cette app ?"
3. Thomas lui montre le menu radial et les stats
4. Aurélie : "Je veux la même chose !"
5. Création de son compte (V1 multi-utilisateurs)
6. Import de ses classes
7. Première utilisation - même moment "Aha!"

**Besoin spécifique :** Vue hebdomadaire en plus de la vue par séance (son workflow actuel avec Excel).

---

### Récapitulatif des Besoins par Journey

| Journey | Besoin Principal | Fonctionnalité Clé |
|---------|-----------------|-------------------|
| Premier cours | Rapidité d'accès | Sélection classe → salle → plan prêt |
| Incident | Preuve horodatée | Historique avec timestamp accessible |
| Configuration | Setup efficace | Import Excel + éditeur de plans |
| Adoption | Multi-utilisateurs | Comptes séparés, données indépendantes |

---

## Domain-Specific Requirements

### Conformité & Réglementation

| Exigence | Approche |
|----------|----------|
| **RGPD** | Privacy by Design - conformité dès la conception |
| **Données mineurs** | Pseudonymisation systématique côté serveur |
| **Droit à l'effacement** | Suppression ciblée possible à tout moment |
| **Hébergement** | Supabase (options EU disponibles) |

### Architecture de Protection des Données

**Principe : Pseudonymisation avec réconciliation locale**

```
Serveur (Supabase)              Local (PC/Mobile)
─────────────────────           ─────────────────────
Données pseudonymisées          Table de correspondance
"Aurélien Da"            ←→     "Aurélien Da" = Aurélien Dabot
+ événements/remarques          Générée depuis import Excel
```

**Avantages :**
- Données serveur non-identifiantes seules
- Même si base compromise → données inexploitables
- Conformité RGPD native

### Contraintes Techniques

| Contrainte | Implémentation |
|------------|----------------|
| **Pseudonymisation** | Prénom + 2 premières lettres du nom côté serveur |
| **Table de correspondance** | Générée depuis import Excel, stockée localement uniquement |
| **Conservation** | Illimitée avec suppression ciblée |
| **Multi-utilisateurs** | Chaque utilisateur = sa propre table de correspondance |

### Gestion des Risques

| Risque | Mitigation |
|--------|------------|
| Compromission serveur | Données pseudonymisées = inexploitables |
| Perte table locale | Régénérable depuis Excel source |
| Changement d'appareil | Export/import de la table ou régénération |
| Données sensibles (remarques) | Liées à pseudonymes, pas aux identités réelles |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

| Innovation | Type | Niveau de Risque |
|------------|------|------------------|
| **Menu radial tactile** | Adaptation jeux vidéo → mobile éducatif | Critique (core feature) |
| **Saisie < 2 secondes** | Performance UX inégalée dans le domaine | Élevé |
| **Pseudonymisation native** | Privacy by Design dès la conception | Faible |
| **Contexte français** | Première app adaptée (trimestres, conseils) | Faible |

### Origine de l'Innovation

**Inspiration :** Menus radiaux des jeux vidéo (sélection via pad manette)
**Adaptation :** Transposition au tactile mobile - long-press + glissement du doigt
**Originalité :** Aucune app éducative n'utilise ce pattern (recherche utilisateur)

### Validation Approach

| Phase | Méthode | Critère de Succès |
|-------|---------|-------------------|
| MVP | Test sur 1 classe réelle | Saisie confirmée ≤ 2 sec |
| Itération | Feedback terrain quotidien | "Fluide et professionnel" |
| Go/No-Go | 1 mois d'usage | Remplacement total Samsung Notes |

### Risk Mitigation

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Menu radial trop lent | **Critique** - Arrêt projet | Prototypage intensif, calibrage timing |
| Menu radial pas intuitif | **Critique** | Tests utilisateur précoces |
| Performance insuffisante | **Élevé** | Cible 60 FPS, latence < 100ms |

**Décision stratégique :** Le menu radial est un pari "tout ou rien". Si l'UX n'atteint pas la cible des 2 secondes, le projet perd sa raison d'être face aux solutions existantes.

---

## Mobile App + Web App Specific Requirements

### Project-Type Overview

| Plateforme | Technologie | Justification |
|------------|-------------|---------------|
| **Mobile** | React Native | Lisibilité code, compétences existantes |
| **Desktop/Web** | SPA (React) | Cohérence stack, réutilisation composants |
| **Backend** | Supabase | BaaS simplifié, options EU, auth intégrée |

### Platform Requirements

| Requirement | Mobile | Web |
|-------------|--------|-----|
| **Framework** | React Native | React (SPA) |
| **OS cible** | Android (prioritaire) | Navigateurs modernes |
| **Appareils cibles** | Samsung Z Fold 4, S25 | Desktop (Chrome, Firefox, Edge) |
| **Distribution** | APK privé (pas de Store) | Hébergement web standard |

### Device Permissions (Mobile)

| Permission | Usage | Criticité |
|------------|-------|-----------|
| **Vibration** | Feedback haptique menu radial | Critique |
| **Storage** | Table de correspondance locale | Critique |
| **Network** | Sync avec Supabase | Important |

### Offline Mode Strategy

| Aspect | Implémentation |
|--------|----------------|
| **Principe** | Offline-first - fonctionne sans connexion |
| **Stockage local** | AsyncStorage ou SQLite (React Native) |
| **Sync** | Fin de séance ou manuel |
| **Conflits** | Dernière écriture gagne (usage mono-utilisateur par compte) |

### Push Strategy

| Version | Stratégie |
|---------|-----------|
| **MVP** | Aucune notification push |
| **V2** | Notifications emploi du temps (optionnel) |

### Store Compliance

| Aspect | Décision |
|--------|----------|
| **Play Store** | Non pour MVP (APK privé) |
| **App Store** | Non prévu |
| **Évolution** | Possible en V2/V3 si diffusion collègues |

### Implementation Considerations

**Stack technique recommandé :**
```
Mobile: React Native + Expo (simplification build APK)
Web: React + Vite (SPA légère)
Backend: Supabase (Auth + DB + Realtime)
Sync: Supabase Realtime ou polling manuel
```

**Avantages de cette stack :**
- Code partageable entre mobile et web (logique métier, types)
- Supabase gère auth, DB, et sync
- Expo simplifie la génération d'APK sans Play Store
- Compétences React transférables

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Approche MVP :** Problem-Solving MVP - résoudre le problème de rapidité de saisie avant tout

**Philosophie :** Valider le risque technique principal (menu radial) en priorité. Si ça marche → construire le reste. Si ça échoue → arrêt projet.

**Ressources MVP :** 1 développeur (Thomas), usage personnel + Aurélie

### MVP Feature Set (Phase 1)

**Core User Journeys Supportés :**

| Journey | Supporté MVP | Commentaire |
|---------|--------------|-------------|
| Premier cours | ✅ Complet | Sélection classe → salle → menu radial |
| Incident/contestation | ✅ Complet | Historique avec horodatage |
| Configuration initiale | ✅ Complet | Import Excel + éditeur plans |
| Adoption Aurélie | ✅ Complet | Multi-comptes dès MVP |

**Must-Have Capabilities :**

| Fonctionnalité | Criticité | Raison |
|----------------|-----------|--------|
| Menu radial 5 actions | **Critique** | Différenciateur, make or break |
| Sous-menu Sortie | **Critique** | Complète les cas d'usage terrain |
| Feedback haptique | **Critique** | UX sans regarder l'écran |
| Plan de classe interactif | **Critique** | Support visuel pour menu radial |
| Import Excel élèves | **Critique** | Onboarding initial |
| Éditeur plans de salle | **Critique** | Configuration classes |
| Sync offline | **Critique** | Fiabilité données |
| Multi-comptes | **Important** | Thomas + Aurélie dès MVP |
| Consultation historique | **Important** | Valeur long terme |
| Pseudonymisation | **Important** | RGPD compliance |

### Ordre de Développement MVP

```
Phase 1.1 : Menu Radial (validation risque)
├── Prototype menu radial isolé
├── Test performance (< 100ms, 60 FPS)
├── Calibrage timing long-press
└── GO/NO-GO : ça marche en < 2 sec ?

Phase 1.2 : Core Mobile (si GO)
├── Plan de classe interactif
├── Intégration menu radial
├── Feedback haptique
└── Stockage local événements

Phase 1.3 : Infrastructure
├── Supabase setup (auth, DB)
├── Sync offline → cloud
├── Pseudonymisation

Phase 1.4 : Desktop
├── Import Excel
├── Éditeur plans de salle
├── Visualisation données
└── Multi-comptes
```

### Post-MVP Features

**Phase 2 (Growth) :**
- Notifications emploi du temps
- Création automatique de séance
- Stats avancées avec graphiques
- Mode conseil de classe
- Alertes todo (colles/remarques)
- Vue hebdomadaire (besoin Aurélie)

**Phase 3 (Expansion) :**
- Rapports auto-générés
- Analyse de biais (équité genre)
- Suggestions pédagogiques
- Export administration
- Diffusion collègues (< 10)

### Risk Mitigation Strategy

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **Menu radial trop lent** | Arrêt projet | Prototype isolé d'abord, GO/NO-GO avant infra |
| **Menu radial pas intuitif** | Critique | Tests terrain précoces avec vraie classe |
| **Sync offline défaillante** | Perte données | SQLite local robuste, sync manuelle fallback |
| **Supabase indisponible** | Bloquant | Mode offline-first, données locales prioritaires |

---

## Functional Requirements

### Gestion de Séance

- **FR1:** L'enseignant peut sélectionner une classe parmi sa liste de classes
- **FR2:** L'enseignant peut sélectionner une salle pour la séance en cours
- **FR3:** L'enseignant peut voir le plan de classe avec les élèves positionnés
- **FR4:** L'enseignant peut démarrer une nouvelle séance pour une classe/salle
- **FR5:** L'enseignant peut terminer une séance en cours
- **FR6:** L'enseignant peut consulter la liste des séances passées

### Saisie d'Actions (Menu Radial)

- **FR7:** L'enseignant peut déclencher le menu radial via long-press sur un élève
- **FR8:** L'enseignant peut enregistrer une participation (+1) via le menu radial
- **FR9:** L'enseignant peut enregistrer un bavardage (-1) via le menu radial
- **FR10:** L'enseignant peut enregistrer une absence via le menu radial
- **FR11:** L'enseignant peut enregistrer une remarque libre via le menu radial
- **FR12:** L'enseignant peut accéder au sous-menu "Sortie" via le menu radial
- **FR13:** L'enseignant peut enregistrer une sortie infirmerie via le sous-menu
- **FR14:** L'enseignant peut enregistrer une sortie toilettes via le sous-menu
- **FR15:** L'enseignant peut enregistrer une convocation via le sous-menu
- **FR16:** L'enseignant peut enregistrer une exclusion via le sous-menu
- **FR17:** L'enseignant reçoit un feedback haptique à chaque action enregistrée

### Consultation des Données

- **FR18:** L'enseignant peut consulter l'historique d'un élève spécifique
- **FR19:** L'enseignant peut voir les événements d'une séance passée avec horodatage
- **FR20:** L'enseignant peut voir le compteur de participations/bavardages par élève dans la séance
- **FR21:** L'enseignant peut consulter l'historique des séances par classe

### Configuration & Import

- **FR22:** L'enseignant peut importer une liste d'élèves depuis un fichier Excel
- **FR23:** L'enseignant peut créer une nouvelle salle
- **FR24:** L'enseignant peut définir le plan d'une salle (disposition des places)
- **FR25:** L'enseignant peut positionner les élèves sur le plan d'une salle
- **FR26:** L'enseignant peut modifier le positionnement des élèves
- **FR27:** L'enseignant peut créer/modifier/supprimer des classes
- **FR28:** L'enseignant peut ajouter/retirer des élèves d'une classe en cours d'année

### Synchronisation & Offline

- **FR29:** L'application mobile fonctionne sans connexion internet
- **FR30:** Les données saisies hors ligne sont stockées localement
- **FR31:** Les données locales se synchronisent automatiquement au retour de la connexion
- **FR32:** L'enseignant peut déclencher une synchronisation manuelle
- **FR33:** Les données synchronisées sont visibles sur l'interface desktop

### Gestion des Utilisateurs

- **FR34:** Un utilisateur peut créer un compte
- **FR35:** Un utilisateur peut se connecter à son compte
- **FR36:** Un utilisateur peut se déconnecter
- **FR37:** Chaque utilisateur a ses propres données (classes, élèves, séances) isolées

### Protection des Données (RGPD)

- **FR38:** Le système stocke les élèves sous forme pseudonymisée (prénom + 2 lettres nom)
- **FR39:** La table de correspondance complète est générée depuis l'import Excel
- **FR40:** La table de correspondance est stockée uniquement localement
- **FR41:** L'enseignant peut supprimer définitivement les données d'un élève
- **FR42:** L'enseignant peut supprimer définitivement les données d'une classe/année

---

## Non-Functional Requirements

### Performance

| NFR | Critère | Seuil d'Échec |
|-----|---------|---------------|
| **NFR1** | Latence apparition menu radial | < 100ms | > 200ms |
| **NFR2** | Frame rate animations menu | 60 FPS constant | Drops visibles |
| **NFR3** | Temps de réponse feedback haptique | < 50ms | Perceptiblement décalé |
| **NFR4** | Temps de démarrage app (cold start) | < 3 secondes | > 5 secondes |
| **NFR5** | Temps de chargement plan de classe | < 500ms | > 1 seconde |
| **NFR6** | Temps total saisie action | ≤ 2 secondes | > 3 secondes |

### Security & Privacy

| NFR | Critère |
|-----|---------|
| **NFR7** | Données serveur pseudonymisées (prénom + 2 lettres) |
| **NFR8** | Table de correspondance stockée uniquement localement |
| **NFR9** | Communications chiffrées (HTTPS/TLS) |
| **NFR10** | Authentification requise pour accès aux données |
| **NFR11** | Isolation complète des données entre utilisateurs |
| **NFR12** | Suppression définitive possible (droit à l'oubli RGPD) |

### Reliability & Data Integrity

| NFR | Critère | Seuil d'Échec |
|-----|---------|---------------|
| **NFR13** | Perte de données saisies | 0 | Toute perte |
| **NFR14** | Données locales persistantes après crash app | 100% | Toute perte |
| **NFR15** | Résolution conflits sync | Automatique | Intervention manuelle requise |
| **NFR16** | Fonctionnement mode offline | Complet (toutes FRs saisie) | Fonctionnalités bloquées |

### Accessibility (Minimal)

| NFR | Critère |
|-----|---------|
| **NFR17** | Taille minimale zones tactiles | 44x44 pixels (standard iOS/Android) |
| **NFR18** | Contraste texte suffisant | WCAG AA (4.5:1 minimum) |
