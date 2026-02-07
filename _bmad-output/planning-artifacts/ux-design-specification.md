---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments: ['prd.md', 'architecture.md', 'epics.md']
project_name: 'Gestion Classe'
user_name: 'Thomas'
date: '2026-02-02'
---

# UX Design Specification - Gestion Classe

**Author:** Thomas
**Date:** 2026-02-02

---

## Executive Summary

### Project Vision

**Gestion Classe** révolutionne le suivi de classe pour les enseignants français avec une promesse simple : **enregistrer n'importe quelle action élève en moins de 2 secondes**.

L'innovation core est un **menu radial tactile** inspiré des jeux vidéo, déclenché par long-press sur un élève. Cette approche permet à l'enseignant de garder les yeux sur sa classe tout en documentant participations, bavardages, absences et sorties.

**Différenciateur clé :** Aucune application éducative n'offre cette rapidité. C'est un pari "make or break" - si le menu radial échoue, le projet s'arrête.

### Target Users

**Utilisateurs MVP :**

| Utilisateur | Profil | Appareil | Besoins spécifiques |
|-------------|--------|----------|---------------------|
| Thomas | Prof SVT, collège, créateur de l'app | Samsung Z Fold 4 | Rapidité absolue, stats automatiques |
| Aurélie | Prof Français, collège | Samsung S25 | Vue hebdomadaire (post-MVP) |

**Caractéristiques communes :**
- Tech-savvy, à l'aise avec smartphones
- Besoin d'efficacité pendant le cours
- Frustration avec solutions actuelles (Samsung Notes = 10+ sec/action)
- Grands écrans disponibles

### Key Design Challenges

| Défi | Contrainte | Approche |
|------|------------|----------|
| **Menu radial performant** | < 100ms apparition, 60 FPS | Prototype validé, intégration soignée |
| **Plan de classe lisible** | 30+ élèves, zones 44px min | Grille optimisée, pseudonymes courts |
| **Compteurs discrets** | Visibles mais non intrusifs | Typographie légère, positionnement subtil |
| **Feedback sans regard** | Confirmation par le toucher | 3 niveaux haptiques (light/medium/success) |
| **Configuration desktop** | Setup annuel efficace | Import Excel fluide, éditeur plan intuitif |

### Design Opportunities

| Opportunité | Impact UX |
|-------------|-----------|
| **Sensation satisfaisante** | Menu radial fluide = plaisir d'utilisation, presque addictif |
| **Preuves horodatées** | Argument imparable face aux contestations élèves |
| **Zéro friction offline** | L'utilisateur ne perçoit jamais la déconnexion |
| **Stats automatiques** | Fin du recomptage manuel, valeur immédiate |

### Design Direction

**Style visuel :**
- **Sobre et moderne** - Pas de look "vieux" ou daté
- **Palette de couleurs contemporaine** - À définir (probablement neutres + accents vifs pour les actions)
- **Attention particulière au menu radial** - Élément signature de l'app

**Principes d'affichage :**
- Compteurs participations/bavardages **visibles en permanence mais discrets**
- Densité d'information maîtrisée
- Hiérarchie visuelle claire

---

## Core User Experience

### Defining Experience

**Action Core :** Long-press sur un élève (250ms) → Menu radial apparaît → Glisser vers l'action → Relâcher → Feedback haptique confirme.

**Promesse UX :** Toute action enregistrée en ≤ 2 secondes, sans détourner le regard de la classe.

**Boucle primaire :**
1. Enseignant observe un comportement
2. Long-press sur l'élève concerné
3. Menu radial apparaît instantanément (< 100ms)
4. Glissement vers l'action souhaitée
5. Vibration confirme l'enregistrement
6. Retour immédiat à l'observation de la classe

### Platform Strategy

| Plateforme | Usage | Interaction | Priorité |
|------------|-------|-------------|----------|
| **Mobile (Expo)** | Quotidien en classe | 100% tactile | Primaire |
| **Web (React)** | Configuration, consultation | Souris/clavier | Secondaire |

**Contraintes clés :**
- **Offline-first** sur mobile - sync transparente en fin de séance
- **Grands écrans** (Z Fold 4, S25) - exploiter l'espace pour le plan de classe
- **Pas de store** - APK distribué manuellement (2 utilisateurs MVP)

### Effortless Interactions

| Interaction | Cible "sans effort" |
|-------------|---------------------|
| **Démarrer une séance** | 2-3 taps max (classe → salle → go) |
| **Enregistrer une action** | Long-press + glisser + relâcher |
| **Sync des données** | Automatique, invisible pour l'utilisateur |
| **Retrouver un historique** | Navigation intuitive par classe/élève/date |
| **Import élèves** | Glisser-déposer Excel, mapping automatique |

### Critical Success Moments

| Moment | Réaction souhaitée | Risque d'échec |
|--------|-------------------|----------------|
| **Premier long-press** | "Wow, c'est instantané !" | Latence > 200ms = frustration |
| **Première action complète** | "C'est vraiment 2 secondes !" | > 3 sec = pas mieux que Notes |
| **Fin première séance** | "J'ai tout noté sans stress" | Actions manquées = doute |
| **Consultation historique** | "La preuve est là avec l'heure" | Données incomplètes = inutile |
| **Setup initial** | "C'était rapide à configurer" | > 30 min = abandon |

### Experience Principles

1. **Rapidité avant tout** - Chaque milliseconde compte. Le menu radial doit apparaître instantanément.

2. **Yeux sur la classe** - L'enseignant ne doit jamais perdre le contact visuel avec ses élèves pour utiliser l'app.

3. **Confirmation tactile** - Le feedback haptique remplace le feedback visuel. L'utilisateur sait que l'action est enregistrée par la vibration.

4. **Zéro friction technique** - Offline, sync, auth... tout doit être invisible. L'utilisateur pense "gestion de classe", pas "technologie".

5. **Données toujours là** - Aucune perte de données acceptable. Les preuves horodatées sont la valeur long terme.

---

## Desired Emotional Response

### Primary Emotional Goals

**Émotion core : Efficacité satisfaisante**

L'utilisateur doit ressentir qu'il gère sa classe avec une fluidité nouvelle. Chaque action est capturée sans effort, sans friction, sans distraction. Le sentiment dominant : "Je suis efficace ET présent pour mes élèves."

**Émotions de support :**
- **Confiance** - Certitude que les données sont enregistrées et fiables
- **Contrôle** - Maîtrise totale de l'outil, jamais submergé
- **Légèreté** - L'app disparaît, seule reste la gestion de classe

### Emotional Journey Mapping

| Phase | Émotion cible | Comment l'atteindre |
|-------|---------------|---------------------|
| **Découverte** | Curiosité intriguée | Design moderne, promesse claire "2 secondes" |
| **Premier essai** | Surprise positive | Rapidité du menu radial, feedback immédiat |
| **Usage quotidien** | Sérénité productive | Fiabilité, pas de bugs, offline transparent |
| **Fin de séance** | Accomplissement | Récap visuel des actions, sync confirmée |
| **Consultation historique** | Confiance assurée | Données complètes, horodatées, indiscutables |
| **Contestation élève** | Assurance calme | Preuve immédiate accessible |

### Micro-Emotions

**À cultiver :**

| Micro-émotion | Moment | Design implication |
|---------------|--------|-------------------|
| **Satisfaction tactile** | Geste du menu radial | Animation fluide 60fps + haptique précis |
| **Réassurance discrète** | Après chaque action | Feedback subtil mais certain |
| **Fierté silencieuse** | Stats de fin de séance | Visualisation valorisante du travail |

**À éviter absolument :**

| Micro-émotion | Cause | Prévention |
|---------------|-------|------------|
| **Doute** | "C'est enregistré ?" | Feedback haptique immédiat + visuel discret |
| **Agacement** | Geste raté, menu lent | Zones tactiles généreuses, latence < 100ms |
| **Culpabilité** | Regarder l'écran trop longtemps | Interaction ultra-rapide, yeux sur la classe |
| **Surcharge cognitive** | Trop d'options, interface dense | Sobriété, hiérarchie claire |

### Design Implications

| Émotion visée | Implication UX |
|---------------|----------------|
| **Efficacité** | Actions en 1-2 gestes max, pas de modales |
| **Confiance** | Indicateurs de sync discrets mais présents |
| **Contrôle** | Navigation prévisible, pas de surprises |
| **Satisfaction** | Animations soignées, transitions fluides |
| **Sérénité** | Interface épurée, pas de notifications intrusives |

### Emotional Design Principles

1. **Le silence est d'or** - L'app ne demande jamais l'attention. Elle attend, répond, et s'efface.

2. **Feedback certain, jamais envahissant** - Une vibration suffit. Pas de popup, pas de son, pas de distraction.

3. **La vitesse génère la confiance** - Un menu instantané = "cette app est solide".

4. **L'accomplissement par l'accumulation** - Chaque petite action contribue à un historique valorisant.

5. **Zéro anxiété technique** - Offline, sync, sauvegarde... l'utilisateur n'y pense jamais.

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Busuu (Language Learning)**
- Progression claire et motivante
- Gamification subtile sans être infantilisante
- Sessions courtes et efficaces
- Feedback immédiat sur les actions

**PictureThis (Plant Identification)**
- Résultat instantané après une action simple
- Pas de configuration préalable nécessaire
- UX "point and shoot" - zéro friction
- Valeur immédiate visible

**Horizon Zero Dawn / Red Dead Redemption 2 (Radial Menus)**
- Menu radial fluide, intégré au gameplay
- Apparition/disparition sans rupture visuelle
- Sélection par direction, pas par précision
- Temps ralenti pendant la sélection (feedback de "pause")

### Transferable UX Patterns

**Du gaming vers Gestion Classe :**

| Pattern jeu vidéo | Application |
|-------------------|-------------|
| Menu radial unifié | Dégradé 100% → 50% opacité, pas de bordures dures |
| Sélection directionnelle | Glissement vers la direction, pas besoin de précision |
| Feedback immédiat | Vibration + highlight subtil |
| Retour instantané au jeu | Menu disparaît, retour au plan de classe |

**De Busuu/PictureThis :**

| Pattern | Application |
|---------|-------------|
| Action → Résultat immédiat | Long-press → Action enregistrée en < 2s |
| Zéro configuration pour agir | Plan de classe prêt dès sélection classe/salle |
| Sessions courtes | Une séance = une session, pas de workflow complexe |

### Anti-Patterns to Avoid

| Anti-pattern | Source | Pourquoi l'éviter |
|--------------|--------|-------------------|
| **Boutons multiples + écriture** | Apps éducatives existantes | Trop lent, distrait du cours |
| **Menus avec bordures dures** | UI classique | Casse l'effet "unifié" du radial |
| **Configuration obligatoire** | Apps pro complexes | Friction avant la valeur |
| **Niveaux scolaires US/UK** | Apps éducatives étrangères | Pas adapté au collège français |
| **Popups de confirmation** | UX défensive | Ralentit l'action, crée du doute |

### Design Inspiration Strategy

**Adopter directement :**
- Dégradé d'opacité centre → périphérie pour le menu radial
- Feedback haptique comme confirmation principale
- Actions sans écriture (sauf Remarque)

**Adapter :**
- Le "temps ralenti" des jeux → légère animation d'ouverture du menu
- La gamification Busuu → compteurs discrets, pas de badges

**Éviter absolument :**
- Boutons traditionnels pour les actions fréquentes
- Champs de texte obligatoires
- Confirmation modale avant action
- Toute référence au système scolaire non-français

---

## Design System Foundation

### Design System Choice

**Approche choisie : Composants Custom + Design Tokens**

Plutôt qu'un framework UI lourd, Gestion Classe utilisera une approche minimaliste avec :
- Un système de design tokens centralisé
- Des composants custom légers et focalisés
- Le menu radial comme composant signature

### Rationale for Selection

| Critère | Justification |
|---------|---------------|
| **Performance** | Pas de surcharge de librairie, 60 FPS garanti |
| **Unicité** | Look sobre et moderne, pas de "Material Design générique" |
| **Contrôle** | Liberté totale sur chaque détail visuel |
| **Simplicité** | Peu d'écrans = peu de composants nécessaires |
| **Cohérence** | Design tokens = source de vérité unique |

### Implementation Approach

**Fichier `theme.ts` - Design Tokens :**

```typescript
export const theme = {
  colors: {
    // Neutres
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#6B7280',

    // Actions (menu radial)
    participation: '#4CAF50',
    bavardage: '#FF9800',
    absence: '#F44336',
    remarque: '#2196F3',
    sortie: '#9C27B0',

    // États
    success: '#10B981',
    error: '#EF4444',
    offline: '#F59E0B',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  radius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },

  typography: {
    // À définir avec les fonts
  },
}
```

**Composants de base à créer :**

| Composant | Usage |
|-----------|-------|
| `Button` | Actions secondaires (démarrer séance, sync) |
| `Card` | Conteneurs (élève, séance, classe) |
| `Text` | Typographie cohérente |
| `Input` | Champ remarque, recherche |
| `Badge` | Compteurs (+3/-1) |
| `Toast` | Feedback discret (sync OK, erreur) |

### Customization Strategy

**Menu Radial (composant signature) :**
- Design unique inspiré Horizon Zero Dawn / RDR2
- Dégradé d'opacité 100% → 50%
- Couleurs par action depuis design tokens
- Animations fluides 60 FPS

**Composants standards :**
- Style sobre, bordures subtiles
- Ombres légères (elevation moderne)
- Coins arrondis cohérents (radius.md par défaut)
- Transitions douces (200ms ease)

**Responsive :**
- Optimisé grands écrans (Z Fold 4, S25)
- Zones tactiles minimum 44×44px
- Espacement généreux pour éviter les erreurs de tap

---

## Defining Experience

### The Core Interaction

**L'expérience définissante de Gestion Classe :**

> **"Long-press pour noter"** - En une pression maintenue et un glissement, n'importe quelle action élève est enregistrée en moins de 2 secondes.

**Comment les utilisateurs le décriront :**
> "Tu appuies sur l'élève, tu glisses vers l'action, c'est noté."

### User Mental Model

**Transition du modèle mental :**

| Avant (Samsung Notes) | Après (Gestion Classe) |
|-----------------------|------------------------|
| Ouvrir l'app, chercher la note | Ouvrir l'app, 2 taps (classe/salle) |
| Écrire à la main sur le plan | Long-press + glisser |
| Espérer se souvenir de tout | Feedback haptique immédiat |
| Recompter manuellement | Stats automatiques |
| Données dispersées | Historique horodaté centralisé |

**Familiarité exploitée :**
- Geste de jeu vidéo (Horizon Zero Dawn, RDR2) transposé au mobile
- Métaphore de "roue de sélection rapide" connue des gamers
- Long-press = pattern mobile établi (menus contextuels)

### Success Criteria

| Critère | Cible | Seuil d'échec |
|---------|-------|---------------|
| **Temps total action** | ≤ 2 secondes | > 3 secondes |
| **Latence apparition** | < 100ms | > 200ms |
| **Frame rate** | 60 FPS constant | Drops visibles |
| **Taux succès geste** | > 95% | < 80% |
| **Sentiment utilisateur** | "Fluide et satisfaisant" | "Laborieux" |

### Novel UX Patterns

**Innovation :**
- Premier menu radial tactile en contexte éducatif
- Aucune app de gestion de classe n'utilise ce pattern

**Pattern hybride :**
- Novel dans le contexte (éducation)
- Familier dans la forme (jeux vidéo, menus contextuels)

**Éducation utilisateur :**
- Pas nécessaire pour les gamers (pattern connu)
- Onboarding minimal : une animation de démo au premier lancement suffit

### Experience Mechanics

**Phase 1 - Initiation :**
```
Trigger     : Long-press 250ms sur carte élève
Feedback    : Vibration medium
Visuel      : Menu radial apparaît (< 100ms)
              Dégradé opacité 100% centre → 50% périphérie
```

**Phase 2 - Interaction :**
```
Action      : Glisser le doigt vers l'option
Feedback    : Vibration light au survol de chaque option
Visuel      : Option survolée = highlight subtil (couleur + scale)
```

**Phase 3 - Sélection :**
```
Action      : Relâcher le doigt sur l'option
Feedback    : Vibration success
Visuel      : Menu disparaît, compteur élève mis à jour
Données     : Événement créé avec timestamp
```

**Phase 4 - Annulation :**
```
Action      : Relâcher hors du menu OU glisser vers le centre
Feedback    : Aucune vibration
Visuel      : Menu disparaît sans animation
Résultat    : Aucune action enregistrée
```

**Cas spécial - Sous-menu Sortie :**
```
Trigger     : Survol option "Sortie" pendant 300ms
Feedback    : Vibration light
Visuel      : Sous-menu apparaît (4 options)
Position    : Décalé depuis l'option Sortie parente
Sélection   : Même logique (glisser + relâcher)
```

**Cas spécial - Remarque libre :**
```
Sélection   : Option "Remarque" sélectionnée
Transition  : Clavier apparaît avec champ texte
Validation  : Bouton "OK" ou touche Entrée
Annulation  : Bouton "X" ou geste retour
```

---

## Visual Foundation

### Typography System

**Police choisie : Inter**

Rationale :
- Police moderne et sobre, alignée avec la direction artistique
- Excellente lisibilité sur écrans mobiles
- Poids multiples pour hiérarchie claire
- Disponible via Google Fonts / expo-google-fonts

**Échelle typographique :**

```typescript
typography: {
  // Titres
  h1: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '500', lineHeight: 24 },

  // Corps
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },

  // UI
  label: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },

  // Données
  counter: { fontSize: 12, fontWeight: '700', lineHeight: 16 },
  studentName: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
}
```

**Usage :**

| Contexte | Style | Exemple |
|----------|-------|---------|
| Titre écran | h1 | "Plan de classe" |
| Nom de classe | h2 | "6ème B" |
| Section | h3 | "Élèves présents" |
| Texte courant | body | Instructions, descriptions |
| Nom élève (carte) | studentName | "Thomas D." |
| Compteur | counter | "+3" / "-1" |
| Label menu | label | "Participation" |

### Color Application

**Palette étendue :**

```typescript
colors: {
  // Neutres
  background: '#FAFAFA',      // Fond app
  surface: '#FFFFFF',         // Cartes, modales
  surfaceHover: '#F5F5F5',    // État hover
  border: '#E5E7EB',          // Bordures subtiles

  // Texte
  text: '#1A1A1A',            // Texte principal
  textSecondary: '#6B7280',   // Texte secondaire
  textTertiary: '#9CA3AF',    // Placeholders, désactivé
  textInverse: '#FFFFFF',     // Sur fond coloré

  // Actions (menu radial)
  participation: '#4CAF50',
  bavardage: '#FF9800',
  absence: '#F44336',
  remarque: '#2196F3',
  sortie: '#9C27B0',

  // Sous-actions Sortie
  infirmerie: '#E91E63',
  toilettes: '#00BCD4',
  convocation: '#795548',
  exclusion: '#B71C1C',

  // États système
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  offline: '#F59E0B',

  // Menu radial
  menuCenter: 'rgba(255,255,255,1.0)',     // Centre opaque
  menuPeriphery: 'rgba(255,255,255,0.5)',  // Périphérie translucide
  menuOverlay: 'rgba(0,0,0,0.3)',          // Fond assombri
}
```

**Règles d'application :**

| Zone | Couleur | Notes |
|------|---------|-------|
| Fond app | background | Gris très léger, moderne |
| Cartes élèves | surface + border | Blanc avec bordure subtile |
| Compteur positif | participation | Vert Material |
| Compteur négatif | error | Rouge erreur |
| Menu radial fond | menuCenter → menuPeriphery | Dégradé radial |
| Texte sur action | textInverse | Blanc pour contraste |

### Icon System

**Approche : Emojis natifs**

Rationale :
- Universellement compris
- Pas de librairie à charger (performance)
- Cohérent sur Android/iOS
- Déjà validé dans le prototype

**Icônes du menu radial :**

| Action | Emoji | Fallback texte |
|--------|-------|----------------|
| Participation | ✋ | Part. |
| Bavardage | 💬 | Bav. |
| Absence | ❌ | Abs. |
| Remarque | 📝 | Rem. |
| Sortie | 🚪 | Sort. |
| Infirmerie | 🏥 | Inf. |
| Toilettes | 🚻 | WC |
| Convocation | 📋 | Conv. |
| Exclusion | ⛔ | Excl. |

**Taille emoji dans le menu :** 28px (lisible sans dominer)

### Shadow & Elevation

**Système minimaliste :**

```typescript
shadows: {
  none: 'none',
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
}
```

**Usage :**

| Élément | Niveau | Notes |
|---------|--------|-------|
| Carte élève (repos) | sm | Subtil, présent |
| Carte élève (hover) | md | Élévation légère |
| Menu radial | lg | Flottant, distinct |
| Toast notification | md | Visible mais discret |

### Accessibility Guidelines

**Contraste (WCAG AA) :**

| Combinaison | Ratio | Statut |
|-------------|-------|--------|
| text (#1A1A1A) sur background (#FAFAFA) | 15.8:1 | ✅ AAA |
| textSecondary (#6B7280) sur background | 5.6:1 | ✅ AA |
| textInverse (#FFF) sur participation (#4CAF50) | 3.0:1 | ⚠️ Large text only |
| textInverse (#FFF) sur absence (#F44336) | 4.0:1 | ⚠️ Large text only |

**Recommandation :** Sur les couleurs d'action, utiliser :
- Icône (emoji) pour l'identification visuelle principale
- Texte en gras 14px+ pour la lisibilité
- Ne jamais dépendre de la couleur seule

**Zones tactiles :**
- Minimum : 44 × 44 px (guideline Apple/Google)
- Recommandé pour menu radial : 60 × 60 px (marge d'erreur)
- Espacement entre zones : minimum 8px

**Feedback non-visuel :**
- Haptic obligatoire pour chaque action
- Aucune action silencieuse
- Animation ≠ seul indicateur de succès

### Animation Principles

**Durées standard :**

```typescript
animation: {
  instant: 100,      // Feedback immédiat
  fast: 200,         // Transitions UI
  normal: 300,       // Apparition menu
  slow: 400,         // Animations complexes
}
```

**Courbes d'accélération :**
- Menu radial ouverture : `spring({ damping: 15, stiffness: 150 })`
- Transitions UI : `ease-out`
- Disparition : `ease-in` (plus rapide)

**Règles :**
1. Jamais d'animation > 400ms (perte de fluidité perçue)
2. Menu radial : apparition < 100ms (critique)
3. Animation = guide visuel, pas décoration

---

## Component Inventory

### Core Components (Mobile)

| Composant | Usage | Priorité |
|-----------|-------|----------|
| **RadialMenu** | Menu d'actions principal | Critique |
| **RadialMenuItem** | Item individuel du menu | Critique |
| **SubMenu** | Sous-menu Sortie | Critique |
| **StudentCard** | Carte élève sur le plan | Critique |
| **StudentBadge** | Compteurs (+/-) sur la carte | Haute |
| **ClassroomGrid** | Grille du plan de classe | Haute |
| **SessionHeader** | Header avec classe/salle/date | Haute |
| **HapticFeedback** | Wrapper pour vibrations | Critique |

### UI Components (Shared)

| Composant | Usage | Variantes |
|-----------|-------|-----------|
| **Button** | Actions secondaires | primary, secondary, ghost |
| **Card** | Conteneurs génériques | elevated, outlined, flat |
| **Text** | Typographie cohérente | h1, h2, h3, body, label, caption |
| **Input** | Saisie texte | text, search |
| **Badge** | Indicateurs numériques | positive, negative, neutral |
| **Toast** | Notifications éphémères | success, error, info |
| **Modal** | Dialogues | confirm, input |
| **List** | Listes sélectionnables | single, multi |
| **Dropdown** | Sélecteurs | simple |

### Web-Specific Components

| Composant | Usage |
|-----------|-------|
| **ClassroomEditor** | Éditeur drag & drop du plan |
| **StudentImport** | Import Excel avec preview |
| **StatsChart** | Graphiques historique |
| **DataTable** | Tableaux élèves/événements |

### Component Specifications

#### RadialMenu

```
Dimensions:
- Rayon total: 120px
- Zone centrale (annulation): 40px
- Zone action: 40px-120px

États:
- hidden: Invisible, aucune interaction
- opening: Animation spring 100ms
- visible: 5 items affichés en cercle
- submenu: Sous-menu affiché (Sortie)
- closing: Fade out 50ms

Props:
- position: { x: number, y: number }
- items: MenuItem[]
- onSelect: (item: MenuItem) => void
- onCancel: () => void
```

#### StudentCard

```
Dimensions:
- Minimum: 60 × 50 px
- Recommandé: 70 × 60 px
- Zone tactile: 70 × 60 px (inclut padding)

Contenu:
- Prénom + initiale nom (RGPD)
- Compteur participation (top-right, vert)
- Compteur bavardage (top-right, orange)

États:
- normal: Fond blanc, ombre sm
- pressed: Fond surfaceHover, ombre md
- menuOpen: Fond surfaceHover, menu visible
- highlighted: Bordure couleur action
```

---

## Screen Specifications

### Mobile Screens

#### M1 - Sélection Classe

**Objectif :** Choisir la classe pour la séance

**Layout :**
```
┌─────────────────────────────┐
│  [H1] Mes classes           │
├─────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    │
│  │ 6ème A  │ │ 6ème B  │    │
│  │ 28 él.  │ │ 30 él.  │    │
│  └─────────┘ └─────────┘    │
│  ┌─────────┐ ┌─────────┐    │
│  │ 5ème C  │ │ 4ème A  │    │
│  │ 25 él.  │ │ 27 él.  │    │
│  └─────────┘ └─────────┘    │
│             ...             │
└─────────────────────────────┘
```

**Interactions :**
- Tap sur classe → écran M2

---

#### M2 - Sélection Salle

**Objectif :** Choisir la salle (plan de classe)

**Layout :**
```
┌─────────────────────────────┐
│ [←] [H1] 6ème B - Salle     │
├─────────────────────────────┤
│  ┌─────────┐ ┌─────────┐    │
│  │ Salle   │ │ Salle   │    │
│  │  101    │ │  203    │    │
│  └─────────┘ └─────────┘    │
│  ┌─────────┐                │
│  │ Salle   │                │
│  │  Lab    │                │
│  └─────────┘                │
└─────────────────────────────┘
```

**Interactions :**
- Tap sur salle → écran M3
- Retour → écran M1

---

#### M3 - Plan de Classe (Core)

**Objectif :** Interface principale de suivi

**Layout :**
```
┌─────────────────────────────┐
│ 6ème B | S101 | 14:30  [⋮]  │
├─────────────────────────────┤
│                             │
│  [El1] [El2] [El3] [El4]    │
│  [El5] [El6] [El7] [El8]    │
│  [El9] [El10][El11][El12]   │
│  [El13][El14][El15][El16]   │
│  [El17][El18][El19][El20]   │
│  [El21][El22][El23][El24]   │
│                             │
│  ┌────────────────────────┐ │
│  │ [TABLEAU / BUREAU]     │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Interactions :**
- Long-press sur élève → Menu radial
- Tap menu [⋮] → Options (terminer, historique)
- Scroll si nécessaire

---

#### M4 - Menu Radial (Overlay)

**Objectif :** Sélection rapide d'action

**Layout :**
```
        ┌─────┐
        │ ✋  │  ← Participation
┌─────┐ │     │ ┌─────┐
│ 🚪  │←──[C]──→│ 💬  │  ← Bavardage
└─────┘ │     │ └─────┘
  ↓     │     │   ↑
Sortie  └─────┘  Absence
        ┌─────┐
        │ 📝  │  ← Remarque
        └─────┘

[C] = Centre (annulation)
Dégradé opacité: centre 100% → bord 50%
```

**Interactions :**
- Glisser vers action → highlight + vibration light
- Relâcher sur action → vibration success + fermer
- Relâcher au centre → fermer sans action
- Rester sur Sortie 300ms → sous-menu

---

#### M5 - Sous-menu Sortie

**Layout :**
```
        ┌─────┐
        │ 🏥  │  ← Infirmerie
┌─────┐ │     │ ┌─────┐
│ ⛔  │←──[C]──→│ 🚻  │  ← Toilettes
└─────┘ │     │ └─────┘
  ↓     └─────┘
Exclusion   ↑
        ┌─────┐
        │ 📋  │  ← Convocation
        └─────┘
```

**Position :** Centré sur l'ancien emplacement de "Sortie"

---

### Web Screens

#### W1 - Dashboard

**Objectif :** Vue d'ensemble et navigation

**Layout :**
```
┌─────────────────────────────────────────┐
│ [Logo] Gestion Classe    [Thomas] [⚙️]  │
├─────────────────────────────────────────┤
│                                         │
│  Mes classes                            │
│  ┌─────────┬─────────┬─────────┐        │
│  │ 6ème A  │ 6ème B  │ 5ème C  │        │
│  │ 28 él.  │ 30 él.  │ 25 él.  │        │
│  └─────────┴─────────┴─────────┘        │
│                                         │
│  Dernières séances                      │
│  ┌─────────────────────────────┐        │
│  │ 6ème B - 14:30 - 12 actions │        │
│  │ 5ème C - 10:00 - 8 actions  │        │
│  └─────────────────────────────┘        │
│                                         │
└─────────────────────────────────────────┘
```

---

#### W2 - Configuration Classe

**Objectif :** Gérer les élèves et le plan

**Sections :**
1. Liste des élèves (import Excel)
2. Éditeur de plan (drag & drop)
3. Paramètres classe

---

## Interaction Patterns

### Pattern 1 : Long-Press Menu

**Déclencheur :** Pression maintenue 250ms

**Séquence :**
```
t=0ms      : Doigt touche la carte élève
t=100ms    : Aucun feedback (éviter faux positifs)
t=250ms    : Vibration medium + menu apparaît
t=250-500ms: Doigt glisse vers option
t=Xms      : Option survolée → vibration light
t=release  : Si sur option → vibration success + action
            Si au centre → fermer sans action
```

**Annulation :**
- Glisser vers le centre du menu
- Relâcher en dehors de toute option
- Geste "retour" système

### Pattern 2 : Quick Tap

**Usage :** Actions simples (navigation, boutons)

**Feedback :**
- Visuel : État pressed immédiat
- Haptique : Aucun (réservé au menu)

### Pattern 3 : Sous-menu Delayed

**Déclencheur :** Survol "Sortie" pendant 300ms

**Séquence :**
```
t=0ms      : Doigt arrive sur "Sortie"
t=300ms    : Vibration light + sous-menu apparaît
            Menu principal reste visible (opacité réduite)
t=release  : Sélection dans sous-menu ou annulation
```

### Pattern 4 : Offline Indicator

**États :**
```
Online    : Aucun indicateur visible
Syncing   : Toast discret "Synchronisation..."
Offline   : Badge orange dans header "Hors ligne"
Error     : Toast rouge "Erreur de sync"
```

**Règle :** L'utilisateur n'est jamais bloqué par l'état réseau.

### Pattern 5 : Confirmation Feedback

**Actions irréversibles (exclusion, remarque négative) :**
```
Option 1 : Vibration prolongée (300ms) → confirmation implicite
Option 2 : Toast avec "Annuler" (5 secondes)
```

**Recommandation :** Option 2 pour MVP (moins risqué)

---

## Implementation Checklist

### Phase 1 : Prototype (Fait)

- [x] Menu radial fonctionnel
- [x] 5 actions principales
- [x] Sous-menu Sortie
- [x] Feedback haptique 3 niveaux
- [x] Mesure temps < 2 secondes

### Phase 2 : MVP Mobile

- [ ] Plan de classe avec vraies données
- [ ] Cartes élèves avec compteurs
- [ ] Persistance locale (SQLite)
- [ ] Navigation classe → salle → plan
- [ ] Toast de confirmation
- [ ] État offline visible

### Phase 3 : Web Config

- [ ] Dashboard classes
- [ ] Import Excel élèves
- [ ] Éditeur plan drag & drop
- [ ] Consultation historique

### Phase 4 : Polish

- [ ] Animations peaufinées
- [ ] Onboarding premier lancement
- [ ] Stats et graphiques
- [ ] Sync cloud

---

## Design Validation Criteria

### Performance (Critique)

| Métrique | Cible | Méthode de test |
|----------|-------|-----------------|
| Temps action | ≤ 2s | Chrono dans app |
| Latence menu | < 100ms | Performance monitor |
| Frame rate | 60 FPS | React Native perf |
| Haptique | < 50ms | Perception utilisateur |

### Usability

| Critère | Validation |
|---------|------------|
| Geste intuitif | Test avec 2 utilisateurs |
| Pas d'erreur de sélection | Taux > 95% sur 50 essais |
| Yeux sur la classe | Utilisateur peut décrire l'écran |
| Configuration < 30min | Timer setup complet |

### Accessibility

| Critère | Test |
|---------|------|
| Contraste texte | Outil vérification WCAG |
| Zones tactiles | Mesure ≥ 44px |
| Feedback haptique | Fonctionne sur device test |
| Pas de dépendance couleur | Test en N&B |

---

## Appendix

### A. Device Specifications

**Samsung Z Fold 4 (Primary test device)**
- Écran principal : 7.6" (2176 × 1812 px)
- Densité : 374 ppi
- Zone sûre : respecter encoche
- Haptic : moteur linéaire, 3+ niveaux

**Samsung S25 (Secondary)**
- Écran : 6.2" (2340 × 1080 px)
- Densité : 416 ppi
- Haptic : comparable Z Fold

### B. Couleurs HEX Reference

```
// Neutres
background:     #FAFAFA
surface:        #FFFFFF
text:           #1A1A1A
textSecondary:  #6B7280

// Actions
participation:  #4CAF50
bavardage:      #FF9800
absence:        #F44336
remarque:       #2196F3
sortie:         #9C27B0

// Sous-menu
infirmerie:     #E91E63
toilettes:      #00BCD4
convocation:    #795548
exclusion:      #B71C1C

// États
success:        #10B981
error:          #EF4444
warning:        #F59E0B
```

### C. Gesture Timings

```
LONG_PRESS_DURATION:  250ms
SUBMENU_DELAY:        300ms
ANIMATION_OPEN:       100ms
ANIMATION_CLOSE:      50ms
HAPTIC_LIGHT:         10ms
HAPTIC_MEDIUM:        20ms
HAPTIC_SUCCESS:       30ms
```
