# Brief pour Claude Design — application complète (en attente)

> **Ce document n'est pas le chantier en cours.** Le chantier actif est
> [`BRIEF_claude_design.md`](BRIEF_claude_design.md), limité au **tableau blanc** (Épic 12).
> Celui-ci est le brief plus large, rédigé le 10/09/2026 puis mis de côté à la demande de Thomas :
> à ressortir le jour où le design des autres surfaces (web enseignant, mobile, espace élève) sera lancé.
> Il faudra alors le relire : l'état des lieux et les priorités auront vieilli, et le système de design issu
> du tableau blanc servira de point de départ au lieu d'être à inventer.

## 1. Le produit en une page

**Gestion Classe** est l'outil d'un enseignant de collège (SVT), fait par lui, utilisé par lui et une collègue
de Français. Il couvre la journée de classe de bout en bout :

| Surface | Appareil | Ce qu'on y fait |
|---|---|---|
| **App mobile** (Expo, `gestion-classe-mobile/`) | Samsung Z Fold 4, Samsung S25, une main, en marchant entre les tables | Enregistrer un événement élève en **moins de 2 secondes** (participation, bavardage, sortie, absence, remarque) via un **menu radial** sur le plan de classe ; démarrer/terminer une séance ; tirage au sort ; minuteur ; piloter l'écran projeté |
| **App web enseignant** (React + Vite, `gestion-classe-web/`) | PC, iPhone en PWA | Tout le reste : classes et import d'élèves, plans de classe, séances et relecture, suivi et notes d'implication, évaluations, récompenses (cartes à tampons), « Quatre Maisons » (univers de jeu original), statistiques, boîte à outils, Pronote, annales |
| **Écran projeté « en classe »** (`/classe`) | TBI / vidéoprojecteur, vu à 3–8 m | Plan de classe en direct piloté par le téléphone, rideau, minuteur, tirage ; et le **tableau blanc** |
| **Tableau blanc** (`components/classroom/`) | TBI au stylet et au doigt, PC | *Traité à part : voir `BRIEF_claude_design.md`* |
| **Espace élève** (`/eleve`) | Téléphone de l'élève, code à 6 chiffres | Ses notes d'implication, ses tampons, sa Maison, les annales, une expérience RA |

Deux personas : **Thomas** (créateur, SVT, TBI, adore les outils denses et rapides) et **Aurélie** (Français,
veut que ça marche sans lire de doc). Élèves de 11 à 15 ans pour l'espace élève : motivant, pas enfantin.

Contraintes non négociables qui touchent le design : **RGPD** (les élèves apparaissent en pseudonymes « Prénom
+ 2 lettres », jamais de nom complet ni de photo), **hors ligne** (le mobile marche sans réseau), **le moins
de saisie texte possible** (tout doit se faire au tap), **feedback haptique** comme confirmation principale
sur mobile.

## 2. Ce qu'on demanderait

1. Un **système de design** (tokens, typographie, composants, icônes, mouvement, son/haptique) qui tient sur
   trois contextes très différents : *téléphone à une main*, *écran vu à plusieurs mètres*, *PC de bureau*.
2. La **maquette de chaque surface**, écran par écran, avec ses états (vide, chargement, erreur, hors ligne),
   dans les canevas Claude Design (`.dc.html`).
3. Un **plan d'implémentation** par lots, chaque lot livrable seul.

Hors périmètre : les fonctionnalités et le modèle de données, la structure des composants React, la stack.

## 3. État des lieux (au 10/09/2026)

- **Web enseignant** : un thème « indigo + surfaces claires » cohérent mais générique (Tailwind, variables
  `--indigo`, `--surface`, `--text` dans `src/index.css`), des cartes partout, peu de hiérarchie, des écrans
  denses faits au fil de l'eau. Fonctionne, ne donne pas envie.
- **Mobile** : un reskin « Direction B » existe (tab bar, IBM Plex, menu radial à 4 directions + flick,
  bottom sheets) — voir `design_handoff_reskin_direction_b/`. C'est la surface la plus aboutie ; à
  **intégrer et prolonger**, pas à jeter.
- **Espace élève** : thème « chaud sombre » propre à l'élève (palette `T` dans `StudentDashboard.tsx`),
  avec l'univers *Quatre Maisons* (blasons dans `blason/`, direction artistique dans
  `_bmad-output/planning-artifacts/`). À garder comme base et à professionnaliser.
- **Tableau blanc** : traité séparément, en premier.

## 4. Les références — ce qu'il faut leur voler

### Mobile enseignant
- **Things 3** — la référence du geste juste : chaque action a exactement l'animation qu'il faut, rien de plus.
- **Apple Fitness / Santé** — les anneaux et compteurs : lisibilité immédiate d'un état (« 3 participations »).
- **Linear (mobile)** — densité maîtrisée, raccourcis, vitesse ; l'app d'un pro pressé.
- **Le prototype validé** (`gestion-classe-proto/`, `components/RadialMenu.tsx`) — le menu radial est
  l'innovation du produit, testé à moins de 2 s ; sa mécanique est intouchable, son habillage est libre.

### App web enseignant
- **Linear** — hiérarchie, densité, raccourcis clavier, palette de commandes (Ctrl+K), tableaux qui respirent.
- **Notion** — le calme d'un document, la typographie, les états vides qui expliquent.
- **Craft** — la chaleur ; **Vercel** — les dashboards et courbes sobres (statistiques, analytics).

### Espace élève (11–15 ans)
- **Duolingo** — motivation, séries, célébrations, sans infantiliser.
- **Classcraft / ClassDojo** — ce qu'ils font de bien (progression visible, récompenses tangibles) et ce qu'il
  faut éviter (kitsch, surcharge). L'univers *Quatre Maisons* est à nous : ni Poudlard, ni générique.
- **Apple Fitness** — les anneaux de progression, encore.

### Pour l'énergie de classe (quiz V2)
- **Kahoot** — le compte à rebours, le suspense, la couleur qui explose au bon moment, puis retour au calme.

## 5. Principes de design propres à ce produit

1. **Deux secondes.** Sur mobile, toute action élève tient en un geste ; l'interface ne doit jamais ajouter
   un tap, un délai d'animation ou une confirmation. L'animation confirme, elle ne bloque pas.
2. **Lisible à six mètres** pour tout ce qui est projeté.
3. **Calme par défaut, énergie sur commande.**
4. **Trois thèmes, pas deux.** Clair (PC), sombre (soir, mobile), et **projection** (contraste maximal).
5. **Pseudonymes et dignité.** Les élèves sont des pseudonymes : typographie qui les rend lisibles et
   agréables (initiales, avatars abstraits par Maison), jamais des lignes de tableur.
6. **Français d'abord.** Micro-typographie française, libellés courts, verbes d'action.
7. **Une seule famille.** Mobile, web, tableau et espace élève doivent se reconnaître (même logique de
   couleur pour participation / bavardage / sortie / absence, mêmes icônes, même voix), en laissant à l'espace
   élève son ton plus chaud.

## 6. Plan de travail proposé (à revoir le moment venu)

| Lot | Contenu |
|---|---|
| **A. Fondations** | Tokens (couleurs × 3 thèmes, échelle typographique, espacements, rayons, ombres, mouvement), polices, icônes, composants de base, sons et haptique — **en partant du système issu du tableau blanc** |
| **B. Espace élève** | Tableau de bord, notes, tampons, Maison (blason, classement, atmosphère), annales, RA ; onboarding par code |
| **C. Mobile enseignant** | Intégrer Direction B au système, puis plan de classe, menu radial, séance, historique, groupes, réunion parents, évaluations et scan |
| **D. Web enseignant** | Accueil, classes et import, plans, séances et relecture, suivi élèves, évaluations, récompenses, Maisons, statistiques, boîte à outils, Pronote, réglages, connexion |
| **E. Finitions** | États vides et erreurs, onboarding, mouvement d'ensemble, accessibilité, micro-copie |

## 7. Contraintes techniques

- **Web** : Tailwind + variables CSS dans `gestion-classe-web/src/index.css` (`--indigo`, `--surface`,
  `--text`, `--radius-*`, `--shadow-*`, couleurs d'événements `--color-participation` etc.). Un nouveau
  système remplace ces variables ; les composants les consomment déjà.
- **Mobile** : tokens Direction B, Reanimated pour le mouvement, haptique via `expo-haptics` à trois niveaux.
  Le menu radial vient de `gestion-classe-proto/components/RadialMenu.tsx`.
- **Espace élève** : palette `T` dans `src/pages/StudentDashboard.tsx` à externaliser en tokens.
- **Polices** : toute police doit être **embarquée** (le collège filtre les CDN).

## 8. Documents et dossiers de référence

| Quoi | Où |
|---|---|
| PRD, architecture, epics, spécification UX d'origine | `_bmad-output/planning-artifacts/` |
| Chantier design en cours (tableau blanc) | `BRIEF_claude_design.md`, `PLAN_tableau_blanc.md` |
| Handoff design précédent (mobile, Direction B) | `design_handoff_reskin_direction_b/README.md` + canevas `.dc.html` |
| Premier handoff (web) | `design_handoff_gestion_classe/` |
| Univers Quatre Maisons (blasons, DA) | `blason/`, `_bmad-output/implementation-artifacts/10-*.md` |
| Prototype validé du menu radial | `gestion-classe-proto/` |
