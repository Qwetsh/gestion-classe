---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['prd.md', 'product-brief-gestion-classe-2026-02-02.md', 'brainstorming-session-2026-02-02.md']
workflowType: 'architecture'
project_name: 'Gestion Classe'
user_name: 'Thomas'
lastStep: 8
status: 'complete'
completedAt: '2026-02-02'
---

# Architecture Decision Document

_Ce document se construit de manière collaborative, étape par étape. Les sections sont ajoutées au fur et à mesure de nos décisions architecturales._

## Project Context Analysis

### Requirements Overview

**Exigences Fonctionnelles (42 FRs):**

| Catégorie | FRs | Description |
|-----------|-----|-------------|
| Gestion de Séance | FR1-FR6 | Sélection classe/salle, démarrage/fin séance |
| Menu Radial | FR7-FR17 | 5 actions + sous-menu Sortie + haptique |
| Consultation | FR18-FR21 | Historique élève/séance, compteurs |
| Configuration | FR22-FR28 | Import Excel, salles, plans, classes |
| Sync & Offline | FR29-FR33 | Mode offline, sync auto/manuelle |
| Utilisateurs | FR34-FR37 | Auth, multi-comptes isolés |
| RGPD | FR38-FR42 | Pseudonymisation, droit à l'oubli |

**Exigences Non-Fonctionnelles (18 NFRs):**

| Domaine | NFRs | Contraintes Clés |
|---------|------|------------------|
| Performance | NFR1-6 | Menu < 100ms, 60 FPS, saisie ≤ 2s |
| Sécurité/Privacy | NFR7-12 | Pseudonymisation, HTTPS, isolation données |
| Fiabilité | NFR13-16 | 0 perte données, offline complet |
| Accessibilité | NFR17-18 | Zones 44x44px, contraste WCAG AA |

**Scale & Complexity:**

- Primary domain: Mobile-first + Web SPA
- Complexity level: Moyenne
- Estimated architectural components: ~15-20 modules

### Technical Constraints & Dependencies

| Contrainte | Impact |
|------------|--------|
| Pas d'API Pronote | Système autonome, pas d'intégration |
| APK privé (pas de Store) | Expo build, distribution manuelle |
| 2 utilisateurs MVP | Multi-comptes dès V1 (Thomas + Aurélie) |
| Import Excel | Parser côté client (xlsx.js ou similar) |
| Appareils cibles | Samsung Z Fold 4, S25 (grands écrans) |

### Cross-Cutting Concerns Identified

1. **Gestion d'état** : Sync local ↔ cloud, résolution conflits
2. **Authentification** : Supabase Auth, tokens persistants offline
3. **Sécurité données** : Chiffrement transport, pseudonymisation stockage
4. **Performance UI** : Animations natives, éviter bridge React Native
5. **Testabilité** : Logique métier découplée pour tests unitaires

### Critical Technical Risk

Le **menu radial** est un pari "make or break" :
- Latence apparition < 100ms (seuil échec > 200ms)
- 60 FPS constant (drops = échec)
- Feedback haptique < 50ms
- **Prototype validé** : 250ms long-press, animations fluides ✅

## Starter Template Evaluation

### Primary Technology Domain

Multi-plateforme : Mobile-first (React Native/Expo) + Web SPA (React/Vite)

### Starter Options Evaluated

**Mobile :**
- create-expo-app (officiel) ✅ Sélectionné
- Obytes Starter (trop opinionné pour nos besoins)
- nkzw-tech template (bon mais prototype déjà existant)

**Web :**
- Vite react-ts (officiel) ✅ Sélectionné
- CodelyTV template (trop complexe pour MVP)

### Selected Starters

#### Mobile - Expo SDK 54

**Commande d'initialisation :**
```bash
npx create-expo-app@latest gestion-classe-mobile --template blank-typescript
```

**Décisions architecturales fournies :**
- TypeScript configuré
- Metro bundler
- Expo modules system
- Hot reloading

**Dépendances à ajouter :**
- `expo-haptics` (feedback tactile)
- `@react-native-async-storage/async-storage` (stockage offline)
- `@supabase/supabase-js` (backend)

#### Web - Vite + React

**Commande d'initialisation :**
```bash
npm create vite@latest gestion-classe-web -- --template react-ts
```

**Décisions architecturales fournies :**
- TypeScript strict
- ESLint configuré
- Vite HMR
- Build optimisé

**Dépendances à ajouter :**
- `@supabase/supabase-js` (backend)
- `xlsx` (import Excel)
- `react-router-dom` (navigation)

### Prototype Existant

Le prototype `gestion-classe-proto/` validé servira de base pour le mobile.

**Structure à migrer/réutiliser :**
- `hooks/useRadialMenu.ts` - Logique menu radial
- `components/RadialMenu.tsx` - Composant menu
- `components/RadialMenuItem.tsx` - Items du menu
- `constants/menuItems.ts` - Configuration actions
- `utils/haptics.ts` - Feedback haptique

**Note :** L'initialisation du projet est la première story d'implémentation

## Core Architectural Decisions

### Decision Priority Analysis

**Décisions Critiques (Bloquent l'implémentation) :**
- Stockage offline : Expo SQLite
- Sync strategy : Fin de séance + manuel
- Auth tokens : Expo SecureStore
- Isolation données : Supabase RLS

**Décisions Importantes (Façonnent l'architecture) :**
- State management : Zustand
- Navigation : Expo Router
- Communication : Supabase JS Client (sans Realtime)

**Décisions Différées (Post-MVP) :**
- Realtime sync entre appareils
- Push notifications

### Data Architecture

| Décision | Choix | Rationale |
|----------|-------|-----------|
| **Stockage offline** | Expo SQLite | Données structurées, requêtes complexes, volume important |
| **Sync strategy** | Fin de séance + manuel | Correspond au workflow naturel du cours |
| **Pseudonymisation** | SQLite local (table séparée) | Cohérent, données ne quittent jamais l'appareil |
| **Résolution conflits** | Dernière écriture gagne | Usage mono-utilisateur par compte |

### Authentication & Security

| Décision | Choix | Rationale |
|----------|-------|-----------|
| **Token persistence** | Expo SecureStore | Chiffré par l'OS, standard industrie |
| **Isolation multi-user** | Supabase RLS | Sécurité garantie niveau DB |
| **Transport** | HTTPS (Supabase default) | Chiffrement en transit |

### API & Communication Patterns

| Décision | Choix | Rationale |
|----------|-------|-----------|
| **Client Supabase** | supabase-js | Auto-généré, typé, simple |
| **Realtime** | Non (MVP) | Sync fin de séance suffisante |
| **Gestion erreurs** | Try/catch + fallback offline | Résilience réseau |

### Frontend Architecture

| Décision | Choix | Rationale |
|----------|-------|-----------|
| **State management** | Zustand | Léger, simple, adapté à la taille du projet |
| **Navigation mobile** | Expo Router | File-based, moderne, intégré Expo |
| **Navigation web** | React Router | Standard React SPA |

### Infrastructure & Deployment

| Décision | Choix | Rationale |
|----------|-------|-----------|
| **Build mobile** | EAS Build | Cloud, pas d'Android Studio requis |
| **Distribution APK** | Manuelle (lien direct) | Privé, 2 utilisateurs MVP |
| **Hébergement web** | Vercel | Gratuit, auto-deploy, excellent DX |
| **Backend** | Supabase (hosted) | BaaS complet, EU possible |

### Decision Impact Analysis

**Séquence d'implémentation :**
1. Setup Supabase (DB schema, RLS, Auth)
2. Setup projet Expo avec SQLite
3. Implémenter sync offline ↔ Supabase
4. Intégrer menu radial (depuis prototype)
5. Setup projet Web + déploiement Vercel

**Dépendances inter-composants :**
- SQLite local ↔ Supabase : même schéma de données
- Zustand ↔ SQLite : state hydraté depuis DB locale
- SecureStore ↔ Supabase Auth : tokens persistés

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Supabase PostgreSQL) :**

| Élément | Convention | Exemple |
|---------|------------|---------|
| Tables | snake_case, pluriel | `students`, `class_sessions` |
| Colonnes | snake_case | `first_name`, `created_at` |
| Clés étrangères | `{table}_id` | `student_id`, `class_id` |

**Code TypeScript :**

| Élément | Convention | Exemple |
|---------|------------|---------|
| Fichiers composants | PascalCase | `RadialMenu.tsx` |
| Fichiers utilitaires | camelCase | `haptics.ts` |
| Fonctions | camelCase | `getStudentById()` |
| Types/Interfaces | PascalCase | `Student`, `ClassSession` |
| Constantes | SCREAMING_SNAKE | `MENU_RADIUS` |

**JSON :**
- Supabase ↔ DB : snake_case
- Code JS/TS : camelCase
- Conversion automatique au fetch/save

### Structure Patterns

**Organisation Mobile (Expo) :**
```
app/                # Routes Expo Router
components/         # Composants réutilisables (par feature)
hooks/              # Hooks personnalisés
services/           # Logique métier & API
stores/             # Zustand stores
types/              # Types TypeScript partagés
utils/              # Utilitaires purs
```

**Tests :**
- Emplacement : co-localisés (`sync.ts` → `sync.test.ts`)
- Framework : Jest + React Native Testing Library

### Format Patterns

**Réponses Services :**
```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

**Erreurs UI :**
- Réseau : Toast discret
- Validation : Message inline
- Critique : Modal avec action

**Dates :**
- Stockage : ISO 8601 (`2026-02-02T14:30:00Z`)
- Affichage : Format FR (`02/02/2026 à 14h30`)

### Process Patterns

**États de chargement (Zustand) :**
- `isLoading` : chargement initial
- `isSyncing` : synchronisation
- `isSaving` : sauvegarde locale

**Gestion erreurs :**
- Services : try/catch → `Result<T>`
- Stores : stocke erreur dans state
- Composants : affiche selon type

**Logging :**
- Préfixe obligatoire : `[MODULE]`
- `console.log` : debug dev
- `console.warn` : inattendu
- `console.error` : erreur réelle

### Enforcement Guidelines

**Tous les agents IA DOIVENT :**
1. Suivre les conventions de nommage sans exception
2. Utiliser le type `Result<T>` pour les retours de services
3. Préfixer tous les logs avec `[MODULE]`
4. Co-localiser les tests avec les fichiers source
5. Convertir snake_case ↔ camelCase aux frontières DB/Code

## Project Structure & Boundaries

### Organisation Globale

Deux repos séparés (plus simple pour MVP) :
- `gestion-classe-mobile/` - App Expo (priorité)
- `gestion-classe-web/` - Dashboard React/Vite

### Structure Mobile (Expo)

```
gestion-classe-mobile/
├── app.json                    # Config Expo
├── package.json
├── tsconfig.json
├── babel.config.js
├── eas.json                    # Config EAS Build
├── .env.example
│
├── app/                        # Routes (Expo Router)
│   ├── _layout.tsx             # Layout racine + providers
│   ├── index.tsx               # Sélection classe
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── _layout.tsx
│   ├── session/
│   │   ├── [classId].tsx       # Plan de classe + menu radial
│   │   └── history/
│   │       └── [classId].tsx   # Historique séances
│   └── settings.tsx
│
├── components/
│   ├── RadialMenu/
│   │   ├── RadialMenu.tsx
│   │   ├── RadialMenuItem.tsx
│   │   ├── SubMenu.tsx
│   │   └── index.ts
│   ├── ClassPlan/
│   │   ├── ClassPlan.tsx
│   │   ├── StudentCard.tsx
│   │   └── index.ts
│   ├── Session/
│   │   ├── SessionHeader.tsx
│   │   └── EventCounter.tsx
│   └── ui/
│       ├── Toast.tsx
│       └── Loading.tsx
│
├── hooks/
│   ├── useRadialMenu.ts
│   ├── useSession.ts
│   └── useSync.ts
│
├── services/
│   ├── database/
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   ├── students.ts
│   │   ├── sessions.ts
│   │   ├── events.ts
│   │   └── index.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   └── sync.ts
│   └── pseudonymization.ts
│
├── stores/
│   ├── authStore.ts
│   ├── sessionStore.ts
│   └── syncStore.ts
│
├── types/
│   ├── student.ts
│   ├── session.ts
│   ├── event.ts
│   └── index.ts
│
├── utils/
│   ├── haptics.ts
│   ├── dates.ts
│   └── mapping.ts
│
└── constants/
    ├── menuItems.ts
    └── config.ts
```

### Structure Web (Vite/React)

```
gestion-classe-web/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   │
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Classes.tsx
│   │   ├── Rooms.tsx
│   │   ├── RoomEditor.tsx
│   │   ├── Import.tsx
│   │   └── History.tsx
│   │
│   ├── components/
│   │   ├── ClassPlanEditor/
│   │   ├── StudentTable/
│   │   ├── ExcelImport/
│   │   └── ui/
│   │
│   ├── services/
│   │   ├── supabase.ts
│   │   └── excel.ts
│   │
│   ├── stores/
│   │   └── authStore.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── utils/
│       └── dates.ts
│
├── public/
└── index.html
```

### Schéma Base de Données (Supabase)

```sql
students (id, user_id, pseudo, class_id, created_at)
classes (id, user_id, name, created_at)
rooms (id, user_id, name, layout, created_at)
class_room_plans (id, class_id, room_id, positions, created_at)
sessions (id, user_id, class_id, room_id, started_at, ended_at, synced_at)
events (id, session_id, student_id, type, subtype, note, timestamp, synced_at)
```

### Mapping FRs → Structure

| Catégorie | Mobile | Web |
|-----------|--------|-----|
| Gestion Séance (FR1-6) | `app/session/`, `stores/sessionStore.ts` | - |
| Menu Radial (FR7-17) | `components/RadialMenu/`, `hooks/useRadialMenu.ts` | - |
| Consultation (FR18-21) | `app/session/history/` | `pages/History.tsx` |
| Import/Config (FR22-28) | - | `pages/Import.tsx`, `pages/Rooms.tsx` |
| Sync Offline (FR29-33) | `services/supabase/sync.ts`, `hooks/useSync.ts` | - |
| Auth (FR34-37) | `app/(auth)/`, `services/supabase/auth.ts` | `pages/Login.tsx` |
| RGPD (FR38-42) | `services/pseudonymization.ts` | - |

### Frontières de Communication

```
Supabase (Cloud)
    ↑ HTTPS
    │
Mobile: services/supabase/ ↔ services/database/ (SQLite)
                    ↓
              stores/ (Zustand)
                    ↓
              components/ + app/

Web: services/supabase.ts (direct, pas d'offline)
              ↓
        stores/ (Zustand)
              ↓
        pages/ + components/
```

## Architecture Validation Results

### Coherence Validation ✅

**Compatibilité des Technologies :**
- Expo SDK 54 + React Native 0.81 : Compatible
- React 19 + Vite 6 : Compatible
- Supabase + Expo SQLite : Compatible
- TypeScript partout : Cohérent
- Zustand + React : Compatible

**Cohérence des Patterns :**
- Conventions de nommage alignées avec TypeScript/PostgreSQL
- Structure par feature adaptée à Expo Router
- Pattern Result<T> idiomatique TypeScript

**Alignement Structure :**
- Structure mobile suit les conventions Expo Router
- Frontières services/stores/components bien définies
- Aucune contradiction détectée

### Requirements Coverage Validation ✅

**Exigences Fonctionnelles (42 FRs) : 100% couvertes**

| Catégorie | FRs | Couverture |
|-----------|-----|------------|
| Gestion Séance | FR1-6 | ✅ |
| Menu Radial | FR7-17 | ✅ (prototype validé) |
| Consultation | FR18-21 | ✅ |
| Configuration | FR22-28 | ✅ |
| Sync Offline | FR29-33 | ✅ |
| Utilisateurs | FR34-37 | ✅ |
| RGPD | FR38-42 | ✅ |

**Exigences Non-Fonctionnelles (18 NFRs) : 100% couvertes**

| Catégorie | NFRs | Solution |
|-----------|------|----------|
| Performance | NFR1-6 | Menu radial validé par prototype |
| Sécurité | NFR7-12 | RLS, SecureStore, pseudonymisation |
| Fiabilité | NFR13-16 | SQLite offline-first |
| Accessibilité | NFR17-18 | Zones tactiles 70px |

### Implementation Readiness Validation ✅

**Complétude des Décisions :** Toutes documentées avec rationale
**Complétude de la Structure :** Arborescence complète mobile + web
**Complétude des Patterns :** Définis avec exemples

### Gap Analysis Results

**Lacunes Critiques :** Aucune
**Lacunes Mineures (non bloquantes) :**
- Tests E2E : À définir en V2
- CI/CD : GitHub Actions basique suffira
- Monitoring : Sentry en V2 si besoin

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** ÉLEVÉ (prototype validé, stack éprouvée)

**Key Strengths:**
- Menu radial (risque critique) validé par prototype fonctionnel
- Stack technologique éprouvée et bien documentée
- Architecture offline-first robuste
- Conformité RGPD intégrée dès la conception

**Areas for Future Enhancement:**
- Tests E2E et stratégie de test détaillée
- Pipeline CI/CD
- Monitoring et observabilité

### Implementation Handoff

**AI Agent Guidelines:**
1. Suivre toutes les décisions architecturales exactement comme documentées
2. Utiliser les patterns d'implémentation de manière cohérente
3. Respecter la structure du projet et les frontières
4. Référencer ce document pour toutes les questions architecturales

**First Implementation Priority:**
1. Setup Supabase (schema, RLS, Auth)
2. `npx create-expo-app@latest gestion-classe-mobile --template blank-typescript`
3. Migrer le code du prototype `gestion-classe-proto/`

