repo: Qwetsh/gestion-classe-mobile
branch: master

## Last sync
date: 2026-08-30T12:53:09Z

### Updated in this project
- Turn 6-8 : écran de séance, menu 4 directions + flick en option, grille compacte
- Turn 10 : refonte vue Groupes (liste avec états, notation stepper, config guidée)
- Turn 11 : composition manuelle rapide (tap-remplissage / depuis le plan — 11b retenu)
- Turn 12 : étape 2 Critères (steppers de barème, modèles, total en direct)

## Screen map
| Écran projet | Fichiers repo |
|---|---|
| Accueil (actuel + refontes) | app/(main)/index.tsx, components/FeedbackButton.tsx, components/AnnouncementBanner.tsx, constants/theme.ts |
| Mes classes (actuel + refontes) | app/(main)/classes/index.tsx, constants/theme.ts |
| Login (refonte B) | app/(auth)/login.tsx |
| Nouvelle séance (refonte B) | app/(main)/session/start.tsx |
| Historique (refonte B) | app/(main)/history/index.tsx |
| Réunions parents (refonte B) | app/(main)/parent-meeting/index.tsx |
| Séance (refonte B) | app/(main)/session/[id].tsx, components/radial/*, constants/menuItems.ts, hooks/useRadialMenu.ts, utils/menuPositioning.ts |
| Groupes (refonte B) | components/groups/SessionGroupView.tsx, components/groups/GroupGradingOverlay.tsx, components/groups/GroupConfigSheet.tsx |
