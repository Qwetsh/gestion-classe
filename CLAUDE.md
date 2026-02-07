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
