# Story 1.1: Initialisation du projet mobile

Status: complete

## Story

As a **developpeur**,
I want **un projet Expo configure avec navigation et dependances de base**,
So that **je peux commencer le developpement des fonctionnalites**.

## Acceptance Criteria

1. **AC1:** Un projet Expo SDK 54 est cree avec TypeScript ✅
2. **AC2:** Expo Router est configure avec un layout de base (auth + main) ✅
3. **AC3:** Zustand est installe et un store de test fonctionne ✅
4. **AC4:** Le projet demarre sans erreur sur Android (Expo Go ou build) ✅
5. **AC5:** La structure de dossiers suit l'architecture definie ✅

## Tasks / Subtasks

- [x] Task 1: Creer le projet Expo (AC: 1)
  - [x] 1.1 Executer `npx create-expo-app@latest gestion-classe-mobile --template blank-typescript`
  - [x] 1.2 Verifier que le projet demarre avec `npx expo start`
  - [x] 1.3 Configurer `app.json` (nom, slug, version, scheme)

- [x] Task 2: Installer et configurer Expo Router (AC: 2)
  - [x] 2.1 Installer expo-router et dependances
  - [x] 2.2 Configurer `app.json` pour expo-router (scheme, output, plugins)
  - [x] 2.3 Creer la structure `app/` avec `_layout.tsx` racine
  - [x] 2.4 Creer `app/(auth)/_layout.tsx` et `app/(auth)/login.tsx`
  - [x] 2.5 Creer `app/(main)/_layout.tsx` et `app/(main)/index.tsx`
  - [x] 2.6 Verifier la navigation entre les routes

- [x] Task 3: Installer et configurer Zustand (AC: 3)
  - [x] 3.1 Installer zustand
  - [x] 3.2 Creer le dossier `stores/` et `stores/authStore.ts`
  - [x] 3.3 Integrer le store dans les ecrans pour verifier le fonctionnement

- [x] Task 4: Creer la structure de dossiers complete (AC: 5)
  - [x] 4.1 Creer `components/` avec sous-dossier `ui/`
  - [x] 4.2 Creer `hooks/`
  - [x] 4.3 Creer `services/` avec sous-dossiers `database/` et `supabase/`
  - [x] 4.4 Creer `stores/`
  - [x] 4.5 Creer `types/`
  - [x] 4.6 Creer `utils/`
  - [x] 4.7 Creer `constants/`
  - [x] 4.8 Ajouter un fichier `index.ts` dans chaque dossier pour les exports

- [x] Task 5: Installer les dependances core du projet (AC: 4)
  - [x] 5.1 Installer expo-haptics
  - [x] 5.2 Installer expo-sqlite
  - [x] 5.3 Installer expo-secure-store
  - [x] 5.4 Creer le fichier `.env.example` pour les variables d'environnement
  - [x] 5.5 Verifier que le projet demarre toujours sans erreur

- [x] Task 6: Configurer TypeScript strict et paths aliases (AC: 1)
  - [x] 6.1 Configurer `tsconfig.json` avec mode strict et paths aliases
  - [x] 6.2 Verifier que le build TypeScript passe sans erreur

- [x] Task 7: Validation finale (AC: 4)
  - [x] 7.1 Executer `npx expo start` et tester
  - [x] 7.2 Verifier la navigation auth → main
  - [x] 7.3 Documenter les commandes dans README.md du projet

## Dev Notes

### Architecture Requirements

**Source:** [architecture.md#Starter-Template-Evaluation]

- **Commande d'initialisation:** `npx create-expo-app@latest gestion-classe-mobile --template blank-typescript`
- **SDK cible:** Expo SDK 54
- **Navigation:** Expo Router (file-based routing)
- **State Management:** Zustand (leger, simple, adapte a la taille du projet)

### Project Structure Notes

Structure conforme a l'architecture definie avec:
- Path aliases configures (`@/components`, `@/stores`, etc.)
- Design tokens pre-configures dans `constants/theme.ts`
- Types de base definis dans `types/index.ts`
- Configuration des constantes dans `constants/config.ts`

### References

- [Source: architecture.md#Starter-Template-Evaluation]
- [Source: architecture.md#Project-Structure-Boundaries]
- [Source: architecture.md#Implementation-Patterns]
- [Source: ux-design-specification.md#Design-System-Foundation]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASS (0 errors)
- Metro Bundler: Started successfully on http://localhost:8081

### Completion Notes List

1. Projet cree avec Expo SDK 54.0.33 + React 19.1.0
2. Expo Router 6.0.23 configure avec groupes (auth) et (main)
3. Zustand 5.0.11 installe avec authStore fonctionnel
4. Dependances core installees: expo-haptics, expo-sqlite, expo-secure-store
5. Structure complete avec 8 dossiers et fichiers index.ts
6. Design tokens et config pre-definis depuis UX spec
7. TypeScript strict mode avec path aliases
8. README.md avec documentation complete

### File List

**Routes (app/):**
- `app/_layout.tsx` - Root layout avec SafeAreaProvider
- `app/index.tsx` - Redirect vers login
- `app/(auth)/_layout.tsx` - Layout groupe auth
- `app/(auth)/login.tsx` - Ecran de connexion demo
- `app/(main)/_layout.tsx` - Layout groupe main
- `app/(main)/index.tsx` - Ecran d'accueil

**Stores:**
- `stores/authStore.ts` - Store d'authentification Zustand
- `stores/index.ts` - Exports

**Constants:**
- `constants/theme.ts` - Design tokens complets
- `constants/config.ts` - Configuration app
- `constants/index.ts` - Exports

**Types:**
- `types/index.ts` - Types de base (Student, Class, Session, Event)

**Configuration:**
- `app.json` - Config Expo avec plugins
- `tsconfig.json` - TypeScript strict + paths
- `package.json` - Dependances
- `.env.example` - Variables d'environnement
- `README.md` - Documentation

**Index files:**
- `components/index.ts`
- `components/ui/index.ts`
- `hooks/index.ts`
- `services/index.ts`
- `services/database/index.ts`
- `services/supabase/index.ts`
- `utils/index.ts`

---

## Change Log

| Date | Changement |
|------|------------|
| 2026-02-03 | Story creee par create-story workflow |
| 2026-02-03 | Story implementee et completee par dev-story workflow |
