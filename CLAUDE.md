# Gestion Classe

Application de gestion de classe pour enseignants de collège, écrite pour Thomas (professeur de SVT) et utilisée par plusieurs collègues. Deux logiciels sur une même base :

- **Web** (`gestion-classe-web/`) : préparation et suivi. Classes, élèves, plans de classe, carnet de notes, éditeur de cours, tableau blanc projeté en classe, espace élève par code.
- **Mobile** (`gestion-classe-mobile/`, dépôt à part) : la séance en classe. Le menu radial enregistre une action élève en moins de 2 secondes ; l'app fonctionne sans réseau et se synchronise ensuite.

Thomas n'est pas développeur : c'est Claude qui écrit le code. Lui répondre en français, sans jargon, sans émoji, en disant ce qui a été vérifié et ce qui ne l'a pas été.

## Deux ateliers : ne pas les mélanger

| Atelier | Où lancer la session | Pour quoi |
|---|---|---|
| **Code** | ce dépôt | Changer le logiciel : fonction, correctif, migration. Branche, PR, tests. |
| **Contenu** | le dossier École de Thomas (`OneDrive\Documents\Ecole`) | Produire avec l'app : cours, fiches, corrections, tableaux, semaine, cahier de texte. |

Les skills de contenu (`cours-gestion-classe`, `prepare-semaine`, `tableau-seance`, `version-mobile`) sont écrites dans ce dépôt (`.claude/skills/`) mais **s'utilisent depuis leur copie installée au niveau du compte** (`~\.claude\skills`), avec les outils du checkout `C:\Users\Utilisateur\gc-worktrees\outils-master` (toujours sur `master`, hors OneDrive). Les deux se remettent à jour par :

```
python -I C:\Users\Utilisateur\gc-worktrees\outils-master\scripts\maj_outils_claude.py
```

Une skill ne se modifie donc qu'ici, sur une branche, par une PR ; jamais dans `~\.claude\skills` ni dans le checkout des outils. Une demande de contenu ne crée ni branche ni PR dans ce dépôt.

## Règles de travail sur le code

- **Une branche et une PR par changement**, depuis une copie de travail à part : `git worktree add C:\Users\Utilisateur\gc-worktrees\<nom> -b <branche> origin/master`. Le dossier du dépôt est dans OneDrive, qui verrouille des fichiers : on n'y change pas de branche en cours de travail, et on retire la copie de travail une fois la PR fusionnée.
- **Avant de pousser** : `npx tsc -b` (pas `tsc --noEmit` : c'est `tsc -b && vite build` que lance la mise en ligne) et `npm test`, dans `gestion-classe-web/`. Chaque PR repasse ces contrôles (`.github/workflows/ci.yml`) ; ne pas fusionner une PR dont la vérification est rouge.
- **Mise en ligne** : un push sur `master` publie le site (GitHub Pages, `qwetsh.github.io/gestion-classe/`). Fusionner, c'est mettre en ligne.
- **Le dépôt est public.** Rien de personnel n'y entre : ni nom d'élève réel, ni document de classe, ni correction d'évaluation, ni secret. Les fichiers de travail posés à la racine sont ignorés par git ; ne pas forcer leur ajout.
- **Dire ce qui n'a pas été vérifié.** Un écran non ouvert, une fonction non essayée avec un vrai compte, un APK non essayé sur téléphone : l'écrire dans la PR et le dire à Thomas.

### Deux règles de structure (web), contrôlées par `npm test`

- **La base se lit et s'écrit depuis `src/lib/`.** Une page ou un composant n'appelle pas `supabase.from`, `.rpc`, `.storage` ni `.functions` : il appelle une fonction de `src/lib/`, qui se teste sans écran.
- **Un fichier de plus de 1 500 lignes ne grossit pas**, et aucun nouveau fichier ne dépasse ce seuil. Pour y ajouter du code, en sortir d'abord (logique dans `src/lib/`, sous-composants à part).

L'existant est toléré et consigné dans `gestion-classe-web/garde-fous.json` ; `scripts/garde-fous.mjs` fait échouer `npm test` dès qu'une de ces deux mesures s'aggrave. Quand un fichier maigrit, `npm run garde-fous:maj` enregistre le progrès. La même commande enregistre aussi une hausse : la réserver à un cas justifié, écrit dans la PR.

## Base de données et fonctions serveur

Projet Supabase « Class'it » (`djodkjysovalpufgevrr`), partagé avec d'autres applications de Thomas.

- **Plusieurs enseignants ont des élèves dans cette base.** Toute écriture directe filtre sur le compte concerné ; avant une écriture en masse, copier les lignes visées.
- **Migrations** : `supabase-migrations/`, appliquées à la main, fichier commité dans la même PR. Lire `supabase-migrations/README.md` avant d'en écrire une (numérotation, sécurité par ligne, comptes anonymes, fonctions ouvertes aux élèves).
- **Fonctions serveur** : `supabase/functions/`, réglages dans `supabase/config.toml` (il fait foi au déploiement).
- **Sauvegarde** : chaque nuit, chiffrée, dans le dépôt privé `gestion-classe-sauvegardes`. Regarder la date de la dernière avant de s'y fier.

## Stack

- Web : React 19, Vite 7, TypeScript 5.9 strict, Tailwind 4, Vitest. Accès à la base par `@supabase/supabase-js`, de préférence depuis `src/lib/`.
- Mobile : Expo 54, React Native, `react-native-gesture-handler`, `react-native-reanimated`, `expo-sqlite`, `expo-haptics`, Jest.
- Serveur : Supabase (authentification, PostgreSQL avec sécurité par ligne, temps réel, stockage, fonctions Deno).

## Mobile

Le code est dans le dépôt `Qwetsh/gestion-classe-mobile` ; le dossier `gestion-classe-mobile/` d'ici en est une copie de travail.

- **Boucle quotidienne** (APK de développement « Gestion Classe (Dev) », même Wi-Fi) : `cd gestion-classe-mobile && npx expo start`. Réseau verrouillé (collège) : ajouter `--tunnel`, ou câble USB et `adb reverse tcp:8081 tcp:8081`. Watchman (installé par winget) est requis : sans lui Metro ne voit pas les modifications dans OneDrive.
- **Tests** : `npx tsc --noEmit` et `npx jest --watchman=false`.
- **Construire un APK** : depuis une copie de travail propre **hors OneDrive**, sur `master` (`npx eas build --platform android --profile preview` ou `production`). Jamais depuis une branche de travail ni depuis la copie OneDrive. `master` suit le dernier APK construit, et chaque APK est étiqueté dans git : `apk/AAAA-MM-JJ-profil`.
- Un changement mobile n'est vérifié que s'il a été essayé sur téléphone ; sinon le dire.

## Ce qui ne se négocie pas dans le produit

- **Pseudonymisation** : un élève est un prénom et deux lettres. Les vrais noms ne quittent pas le téléphone de l'enseignant.
- **Aménagements (PAP, PPRE, PAI)** : jamais affichés sur un écran projeté en classe.
- **Hors ligne d'abord** sur mobile : la séance doit marcher sans réseau.
- **Vitesse en séance** : une action élève en 2 secondes au plus, confirmée par le retour haptique. Pas de saisie de texte, sauf la remarque libre.
- **Densité** : n'afficher une information que si elle sert à décider ; pas d'écran surchargé.

## Documents

Les plans par chantier sont à la racine (`PLAN_*.md`, `AUDIT_*.md`). Les documents d'origine du projet (cahier des charges, architecture, maquettes de février 2026) sont dans `_bmad-output/planning-artifacts/` : utiles pour l'histoire, plus à jour pour la stack ni pour le périmètre.
