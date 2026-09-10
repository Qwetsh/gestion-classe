# Gestion Classe - MVP

## Contexte

Application mobile-first pour enseignants français (collège). Innovation principale : **menu radial tactile permettant d'enregistrer n'importe quelle action élève en < 2 secondes**.

**Utilisateurs MVP :** Thomas (créateur, Samsung Z Fold 4) + Aurélie (prof Français, Samsung S25)

## Documents de référence

| Document | Chemin | Contenu |
|----------|--------|---------|
| PRD | `_bmad-output/planning-artifacts/prd.md` | 42 FRs, 18 NFRs, personas |
| Architecture | `_bmad-output/planning-artifacts/architecture.md` | Stack, structure projet, décisions |
| Epics | `_bmad-output/planning-artifacts/epics.md` | 8 epics, 45 stories |
| UX Design | `_bmad-output/planning-artifacts/ux-design-specification.md` | Design system, écrans, interactions |

## Prototype validé

Le dossier `gestion-classe-proto/` contient un prototype Expo fonctionnel qui valide :
- Menu radial avec 5 actions + sous-menu Sortie
- Feedback haptique 3 niveaux
- Temps de saisie < 2 secondes (testé sur Z Fold 4)
- Animation 60 FPS

**Code réutilisable :** `components/RadialMenu.tsx`, `hooks/useRadialMenu.ts`

## Stack technique MVP

```
Mobile (prioritaire):
- Expo SDK 52 + React Native
- react-native-gesture-handler + react-native-reanimated
- expo-haptics, expo-sqlite
- Distribution: APK manuel (pas de store)

Web (configuration):
- React 18 + Vite + TypeScript
- TailwindCSS
- React Query

Backend:
- Supabase (Auth, PostgreSQL, Realtime)
- Row Level Security pour multi-tenant
```

## Epics MVP

1. **Setup & Auth** - Projet Expo, Supabase, auth email
2. **Gestion Classes** - CRUD classes, import Excel élèves
3. **Plan de Classe** - Éditeur drag & drop, grille responsive
4. **Séances** - Démarrer/terminer, timer, état local
5. **Menu Radial** - Intégration du prototype validé
6. **Événements** - Enregistrement, compteurs, historique
7. **Sync Offline** - SQLite local, réconciliation
8. **Consultation** - Stats, filtres, export

## Critères de succès

| Métrique | Cible |
|----------|-------|
| Temps action complète | ≤ 2 secondes |
| Latence menu radial | < 100ms |
| Frame rate | 60 FPS constant |
| Setup initial | < 30 minutes |

## Build Mobile (APK)

**IMPORTANT : Le build EAS doit se faire HORS OneDrive !**

OneDrive verrouille les fichiers et cause des erreurs "Permission denied" avec les dossiers `(auth)` et `(main)`.

```bash
# Dossier de build (hors OneDrive)
C:\Users\Utilisateur\gestion-classe-build

# Workflow de build :
# 1. Copier les modifications vers le dossier de build
cp -r gestion-classe-mobile/* /c/Users/Utilisateur/gestion-classe-build/

# 2. IMPORTANT : réinitialiser les attributs/ACL hérités de OneDrive,
#    sinon le tar envoyé à EAS contient des fichiers illisibles
#    ("tar: Cannot open: Permission denied" en phase Prepare project)
#    Depuis PowerShell dans le dossier de build :
#    attrib -r -s -h -o -i /s /d *.* ; icacls . /reset /t /c /q

# 3. Lancer le build depuis ce dossier
cd /c/Users/Utilisateur/gestion-classe-build && npx eas build --platform android --profile preview
```

## Développement rapide sur téléphone (dev client)

Un APK de dev « Gestion Classe (Dev) » (package `com.gestionclasse.app.dev`, keystore dédiée)
coexiste avec l'app de prod sur le téléphone. Config via `app.config.js` (variable `APP_VARIANT`,
positionnée par le profil `development` de eas.json). Rebuild nécessaire uniquement si les
dépendances natives ou la config native changent.

```bash
# Boucle quotidienne (Fast Refresh sur le téléphone, même Wi-Fi) :
cd gestion-classe-mobile && npx expo start
# Réseau verrouillé (collège) : ajouter --tunnel, ou câble USB + adb reverse tcp:8081 tcp:8081
# IMPORTANT : Watchman (installé via winget) est requis — sans lui, le watcher Metro
# ne voit pas les modifications de fichiers dans OneDrive (Fast Refresh muet).
# adb/scrcpy : %LOCALAPPDATA%\Microsoft\WinGet\Packages\Genymobile.scrcpy_*\scrcpy-win64-*\
# Débogage Wi-Fi : adb tcpip 5555 puis adb connect <ip-du-tel>:5555
```

## Commandes utiles

```bash
# Prototype existant
cd gestion-classe-proto && npx expo start

# Lancer les tests (quand implémentés)
npm test
```

## Notes importantes

- **RGPD** : Pseudonymisation obligatoire (prénom + 2 lettres nom)
- **Offline-first** : L'app doit fonctionner sans connexion
- **Pas d'écriture** : Minimiser la saisie texte (sauf Remarque libre)
- **Haptique** : Feedback tactile = confirmation principale
