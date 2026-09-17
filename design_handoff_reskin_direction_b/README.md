# Handoff : Reskin "Direction B" — Gestion Classe Mobile

## Overview
Refonte visuelle et UX de l'application Expo/React Native `Qwetsh/gestion-classe-mobile` (repo GitHub lié, branche `master`). Objectif : une interface sobre et professionnelle (fin des dégradés violets et des emojis-icônes), une navigation par tab bar, et un écran de séance utilisable quasi sans regarder (menu radial à 4 directions + mode expert "flick" optionnel). Toutes les décisions ont été validées écran par écran par Thomas (l'enseignant utilisateur).

## About the Design Files
`Refonte Gestion Classe.dc.html` (à la racine du projet de design) est une **référence de design en HTML** — un canvas de maquettes, pas du code de production. La tâche est de **recréer ces écrans dans le codebase Expo/React Native existant**, avec ses patterns en place : `constants/theme.ts` pour les tokens, Zustand pour l'état, Expo Router pour la navigation, `lucide-react-native` pour les icônes (déjà en dépendance — voir `session/start.tsx`).

Le canvas est organisé en "turns" numérotés (badge en haut de chaque carte). Les options **validées** sont : 1e/1f (direction générale B), 2a/2b/2c, 3b, **4b + 5a (accueil final)**, 6a/6b/6c, **7a/7b**, 8a/8b, 9a/9b/9c, 10a/10b/10c, **11b** (composition manuelle retenue), 12a (version finale avec sélecteur replié), 13b. Ignorer : 1a/1b (recréation de l'existant), 1c/1d (direction A abandonnée), 1e sans tab-cartes (remplacé par 4b), 3a (remplacé par 5a), 11a (non retenu), 13a.

## Fidelity
**High-fidelity.** Couleurs, typo, espacements et copies sont finaux. Recréer au pixel près avec les composants RN existants.

## Design Tokens (mise à jour de `constants/theme.ts`)
Le thème actuel est déjà proche ; changements :
- **Police : IBM Plex Sans partout** (400/500/600/700 via `@expo-google-fonts/ibm-plex-sans`). Supprimer Playfair Display et Inter. `fonts.display` → IBMPlexSans_700Bold, `body` → 400, `bodyMedium` → 500, `bodySemibold` → 600, `bodyBold` → 700.
- Background : `#F7F7F9` (remplace `#F4F5F8`). Surface `#FFFFFF`, border `#E5E7EB`, séparateur fin `#F1F5F9`, surface désactivée/allée `#F1F2F5`, segment track `#EDEEF2`.
- Texte : `#1F2433` / secondaire `#6B7280` / tertiaire `#9CA3AF`.
- Primaire (nav, sélection) : indigo `#4F46E5`, soft `#EEF0FF`.
- Action verte (démarrer/terminer/valider) : `#059669`, soft `#ECFDF5` (le vert clair `#34D399` reste la couleur du menu radial Implication).
- Sémantique menu radial (inchangé, cf. `menuItems.ts`) : Implication `#34D399`, Malus `#FBBF24`, Sortie `#A78BFA`, Remarque `#60A5FA` (déplacée en toolbar), Absence `#FB7185`. Sous-actions : Infirmerie `#F472B6`, Toilettes `#22D3EE`, Convocation `#A8A29E`, Exclusion `#F87171`.
- États cellules : absent bg `#FEF2F2` bord `#FECACA` texte `#B91C1C` badge `#EF4444` ; sortie bg `#F5F3FF` bord `#DDD6FE` texte `#6D28D9` ; malus/ambre `#B45309` sur `#FFFBEB`.
- **Aucun dégradé nulle part** (supprimer les usages de `theme.gradients` et LinearGradient). Une seule ombre douce ou bordure `1px #E5E7EB`.
- Radius : cartes 16, contrôles/boutons 12, cellules du plan 8–9, pills 999.
- **Icônes : lucide-react-native**, strokeWidth 1.7–2, jamais d'emoji. Correspondances utilisées : play, chevron-right/left/up-down, book-open, clock, users, message-circle, pencil, trash-2, shuffle, mic, log-out (Sortie), x-circle (Absence), hand (Implication), zap (flick), search, home, settings, file, plus, check, minus, grip-lines.

## Screens / Views (fichiers cibles dans le repo)

### 1. Tab bar (nouveau `(main)/_layout.tsx` → Tabs)
4 onglets : Accueil (home), Classes (book-open), Historique (clock), Réunions (users). Fond blanc, bord haut `#E5E7EB`, actif indigo `#4F46E5` (icône strokeWidth 2 + label 11px/600), inactif `#9CA3AF` (1.8 + 500). Labels toujours visibles.

### 2. Accueil — `app/(main)/index.tsx` (maquettes 4b + 5a)
- Supprimer : header dégradé, courbe SVG, AnnouncementBanner en l'état, cartes d'accès rapide (la tab bar les remplace), gros bouton feedback.
- Header : "Bonjour," 15px `#6B7280` / prénom 26px 700 `#1F2433` ; à droite une icône feedback (message-circle, cercle 40 blanc bordé) qui ouvre la modale feedback existante + avatar 40 rond fond `#1F2433` initiale blanche (déconnexion).
- Corps centré verticalement : **hero rond 150px** fond `#059669`, halo `0 0 0 14px #ECFDF5` + ombre `0 8px 30px rgba(5,150,105,.3)`, triangle play blanc 52px → `/(main)/session/start`. Dessous : "Démarrer une séance" 20px 600 + sous-titre 14px `#6B7280` "Suivre la participation en classe en moins de 2 secondes".
- Bas : ligne "Dernière séance : {classe} · {relatif}, {durée}" dans une carte blanche fine → historique.
- **État séance active (5a)** : badge "● EN COURS · {min} MIN" 12px 700 `#059669` au-dessus du hero ; le hero devient "Reprendre la séance" avec sous-titre "{classe} — {salle} · démarrée à {h} / {thème}" ; bouton "Annuler la séance" texte `#EF4444` sur `#FDE8E8` radius 10.

### 3. Mes classes — `app/(main)/classes/index.tsx` (1f)
Titre 26px 700 + sous-ligne "{n} classes · {n} élèves". Cartes blanches radius 16 bord `#E5E7EB` : tuile 46px radius 12 avec nom court (5e2) en couleur soft tournante (`#EEF0FF`/indigo, `#ECFDF5`/vert, `#FFFBEB`/ambre), nom 16px 600, "{n} élèves · {n} séances" 13px `#6B7280`, chevron.

### 4. Login — `app/(auth)/login.tsx` (2a)
Fond `#F7F7F9` plat. Logo : carré 60 radius 16 indigo avec icône book-open blanche. "Bienvenue" 26px 700, sous-titre 15px. Champs : label 14px 600 au-dessus, input blanc bord `#E5E7EB` radius 12 padding 15/18, œil (eye) sur le mot de passe. CTA plein indigo radius 12 16px 600. Lien "S'inscrire" indigo.

### 5. Nouvelle séance — `app/(main)/session/start.tsx` (2b)
Back chevron + titre 19px 600. Sections numérotées "1 · CHOISIR UNE CLASSE" (labels 13px 600 uppercase `#6B7280`). Classes en tuiles égales sur une rangée (sélection = fond indigo texte blanc, sinon blanc bordé). Salles en liste (ligne sélectionnée fond `#EEF0FF` + pastille check indigo 24px). Thème = input multiline (optionnel). Footer blanc bord haut : résumé "5e2 · Salle B12" centré 13px puis CTA vert "Démarrer la séance" avec play.

### 6. Historique — `app/(main)/history/index.tsx` (2c)
Titre 26px 700, barre de recherche (icône search, placeholder "Rechercher (classe, salle, thème)…"), filtres pills (actif fond `#1F2433` blanc, sinon blanc bordé). Groupes par jour ("Hier" 13px 600 `#6B7280`). Carte séance : classe 16px 600 + chevron, thème 13.5px `#6B7280`, rangée méta HEURE/SALLE/DURÉE (label 10.5px uppercase `#9CA3AF`, valeur 13px 600) séparée par un filet `#F1F5F9`. Suppression : garder l'accès mais via appui long ou swipe (plus de 🗑️ inline).

### 7. Réunions parents — `app/(main)/parent-meeting/index.tsx` (3b)
Même patron que l'historique. Filtres de période Année/T1/T2/T3. Élèves groupés par classe (en-tête : nom + pastille compteur `#F3F4F7`). Ligne élève : nom 15px 600, pseudo 12.5px `#9CA3AF`, badge score (+n vert `#ECFDF5`/`#059669`, −n ambre `#FFFBEB`/`#B45309`, 0 gris) et badge note d'oral (mic bleu `#EFF6FF`/`#3B82F6`), chevron.

### 8. Écran de séance — `app/(main)/session/[id].tsx` (6a, 8b)
- Header blanc plat : "Annuler" texte `#EF4444` à gauche ; centre titre "{classe} · {salle}" 16px 700 + chrono "● {n} min" 12px 600 `#059669` ; droite bouton plein vert "Terminer" (radius 9, 13px 600).
- Toggle segmenté Plan de classe / Groupes (track `#EDEEF2` radius 10, actif carte blanche).
- **Toolbar 5 boutons** égaux (cartes blanches bordées radius 10, icône 17 + label 10.5px 600) : Aléatoire (shuffle), Oral (mic + badge "n/n" indigo en coin), Note (pencil + point indigo si note), **Remarque (message-square — remplace l'entrée du menu radial ; ouvre le sélecteur d'élève puis la modale remarque existante texte+photo)**, Supprimer (trash-2).
- Hint : "Maintenir appuyé sur un élève" 12.5px `#9CA3AF` centré.
- **Grille compacte (8b, réglage "Grille compacte" ON par défaut)** : gap 3px (au lieu de `spacing.sm`), cellules `min((width-32-3*(cols-1))/cols, 60)`, radius 8, blanches bordées. Prénom 11px 600 ; badges compteurs pills (participation `+n` vert, bavardage `n` ambre) 9px 700 ; absent/sortie : voir tokens. Allées `#F1F2F5` sans bordure. Bandeau "TABLEAU" `#EDEEF2` 11px 600 uppercase. Les zones tactiles restent bord à bord (le gap est purement visuel).

### 9. Menu radial 4 directions — `components/radial/*`, `constants/menuItems.ts`, `hooks/useRadialMenu.ts` (7a)
- `MENU_ITEMS` passe à 4 : participation (haut), bavardage (droite), sortie (bas, subItems inchangés), absence (gauche). **Retirer `remarque`** (déplacée en toolbar). Quadrants à 90° tournés de 45° (haut = −135°→−45°).
- SegmentedRing : quadrants pleins inner 40 / outer `MENU_RADIUS + ITEM_SIZE/2 + 8`, fond `rgba(15,23,42,.78)`, survolé : rempli de la couleur de l'action (participation `rgba(52,211,153,.88)`) ; gap ~2°. La jauge bonus (remplissage progressif du quadrant haut, 1500 ms, `rgba(52,211,153,.5)`) est conservée.
- Icônes lucide blanches/couleur au lieu des emojis, label 10-11px sous l'icône, "maintenir = bonus" 9px sous Implication.
- **Centre = disque blanc 70px avec prénom/nom de l'élève** (remplace le selectedIndicator du bas). Relâcher au centre (distance < minRadius) = annulation silencieuse.
- Pill bas d'écran : "{élève} · relâcher au centre pour annuler" sur blanc `rgba(255,255,255,.95)`.
- Sous-menu Sortie : 4 sous-actions en cercles 58px pleins (couleurs sous-actions), fond disque `rgba(0,0,0,.18)`, logique de flip anti-bord conservée (`menuPositioning.ts`).
- La détection par angle de `getItemAtPosition` passe à 4 segments (anglePerItem = 90°) — le reste du hook est réutilisable tel quel.

### 10. Mode expert "flick" — nouveau réglage (7b, 8a) — **OFF par défaut**
- Sheet "Réglages de séance" (engrenage à droite du toggle Plan/Groupes) : 3 lignes icône+titre+description+switch — "Mode expert (flick)" (OFF), "Vibrations différenciées" (ON), "Grille compacte" (ON). Switch : track 46×28, ON indigo.
- Comportement flick (si ON) : appui + déplacement > seuil avant 250 ms de pause → l'action de la direction est validée sans afficher le menu ; une pause ≥ 250 ms affiche le menu normal (mêmes angles). Confirmation : bannière verte en haut "✓ {élève} · +1 Implication — Annuler" (auto-dismiss 4 s) + haptique.
- Signatures haptiques : Implication 1 impact, Malus 2 impacts, Sortie 1 long, Absence 2 longs.

### 11. Outils de séance en bottom sheets (9a/9b/9c) — remplacer les `Alert.alert`
Patron commun : sheet blanche radius 20 haut, poignée 38×4, padding 24, backdrop `rgba(15,23,42,.35)`.
- **Tirage au sort (9a)** : titre + "{n} présents" ; carte `#EEF0FF` radius 16 : "ÉLÈVE TIRÉ" 12px indigo uppercase, nom 28px 700, contexte 13.5px ; boutons "Relancer" (bordé, shuffle) / "C'est lui !" (plein indigo).
- **Éval orale (9b)** : titre + badge "n/n évalués" ; ligne "Trimestre {n} · {n} restants" ; carte élève tiré (avatar initiale fond `#1F2433`) avec lien "Choisir" ; notes 0–5 en 6 boutons égaux h52 radius 12 (sélection pleine indigo) ; CTA vert "Enregistrer {n}/5".
- **Note de séance (9c)** : textarea `#F7F7F9` bordé min-h 110, compteur "n/500" 11.5px aligné droite, Annuler bordé / Enregistrer indigo.

### 12. Vue Groupes — `components/groups/SessionGroupView.tsx` (10a)
Barre au-dessus de la liste : "{nom du TP} · /{max} pts" + badge "n/m notés" indigo. Cartes groupe : nom 15px 700 + badge d'état (NOTÉ vert / EN COURS indigo + carte bordée indigo / À NOTER gris) + badge "−n malus" rouge si présent + score 20px 700 aligné droite ; barre de progression 5px (vert si noté, indigo si en cours) ; membres en une ligne 12.5px `#6B7280` (plus de chips). Engrenage en haut à droite → config.

### 13. Notation d'un groupe — `GroupGradingOverlay.tsx` (10b)
- **Remplacer les sliders par des steppers − / +** au ½ point : boutons 38×38 radius 10 (− blanc bordé, + plein indigo), valeur 17px 700 "3,5/5" au centre, mini barre de progression 4px sous le label du critère. Haptique light à chaque pas.
- **Navigation inter-groupes dans la sheet** : flèches ‹ › de part et d'autre du titre + pastilles de progression (notés = vertes, courant = barre indigo) ; footer "Total {n}/{max}" à gauche + CTA indigo "Groupe suivant →" (dernier groupe : "Terminer la notation").
- Malus conduite : ligne rouge (`#FEF2F2`/`#FECACA`) avec steppers − / + explicites (plus d'appui long caché pour le reset).

### 14. Config des groupes — `GroupConfigSheet.tsx` (10c, 11b, 12a final)
- Étape 1 "Composer les groupes" : stepper d'étapes (1 plein indigo — 2 gris) ; raccourci **"Reprendre"** en haut à droite = recharge la dernière config connue de la classe (groupes + critères) ; segmenté **Aléatoire / Manuel**.
  - Aléatoire : stepper "Élèves par groupe", encart aperçu "24 présents → 6 groupes de 4 · les absents sont exclus" + groupes générés en pills indigo ; bouton "Mélanger" (shuffle).
  - **Manuel = sur le plan de classe (11b)** : rangée de pills de groupes en haut (faits = pleins colorés avec ✓, actif = bordé ambre "G3 · 2/4", "+ Nouveau" en pointillés, compteur "n restants" à droite). Le plan s'affiche ; tap sur un élève = l'ajoute au groupe actif (cellule prend fond/bord/couleur du groupe + tag "G3"), re-tap = retire ; absents grisés non tapables. Couleurs de groupes en rotation : indigo `#EEF0FF/#4F46E5`, vert `#ECFDF5/#059669`, ambre `#FEF3C7/#F59E0B`, puis violet/rose/cyan soft.
  - Footer : "Compléter au hasard" (bordé) + "Critères →" (plein indigo).
- Étape 2 "Critères" (12a) : stepper (1 ✓ vert — 2 indigo) ; **"Partir d'un modèle" = sélecteur replié une ligne** (icône fichier sur `#EEF0FF`, nom + "n critères · n pts · dernier utilisé pour {classe}", chevrons haut/bas ; s'ouvre en liste : options + "Partir de zéro") pré-rempli avec le dernier modèle de la classe ; liste des critères : poignée grip, nom 14.5px 600, stepper − / + du barème en points ; ligne "+ Ajouter un critère" indigo ; encart "Total du barème {n} pts" sur `#EEF0FF` ; toggle "Enregistrer comme modèle" ; footer "← Groupes" / CTA **vert** "Lancer la notation".

## Interactions & Behavior
- Transitions : sheets en slide 250 ms ; menu radial spring (damping 15, stiffness 300) inchangé ; press states = scale .98 + fond `#FAFBFC`.
- Toast/bannière d'annulation : toute action rapide (tap ou flick) affiche 4 s une bannière verte avec "Annuler" (undo du dernier événement).
- Tous les hit targets ≥ 44px (les steppers 38px ont un hitSlop de 6).
- `LONG_PRESS_DURATION` reste 400 ms ; pause flick→menu : 250 ms.

## State Management
Stores Zustand existants suffisants. Ajouts : `settingsStore` (flickMode: bool = false, distinctHaptics: bool = true, compactGrid: bool = true, persistés SecureStore/AsyncStorage) ; `groupSessionStore` : mémoriser la dernière config par classId (groupes + critères) pour "Reprendre" ; navigation inter-groupes dans l'overlay (index courant).

## Assets
Aucune image. Icônes : lucide-react-native (dépendance existante). Police : `@expo-google-fonts/ibm-plex-sans` (à ajouter).

## Files
- `Refonte Gestion Classe.dc.html` — canvas de toutes les maquettes (turns 1→13, options validées listées ci-dessus).
- Repo source : `github.md` à la racine (repo, branche, screen map).
