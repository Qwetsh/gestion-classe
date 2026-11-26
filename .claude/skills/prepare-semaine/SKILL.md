---
name: prepare-semaine
description: Prépare la semaine de cours de Thomas (prof de SVT) dans Gestion Classe. Pose une activité de la bibliothèque, avec sa correction, sur les prochains cours de ses classes dans l'emploi du temps ; s'il le faut, convertit d'abord l'activité depuis OneDrive et écrit ses écrans. À utiliser dès que Thomas dit « prépare ma semaine », « prends l'activité X pour la classe Y », « mets l'activité 2 de la séquence 1 à mes 3e », « même chose pour toutes mes 4e », « la correction jeudi plutôt que mardi », ou demande de placer, déplacer ou retirer un document sur un cours du calendrier.
---

# Préparer la semaine

Thomas demande en une phrase ; Claude trouve l'activité, choisit les cours, vérifie, pose les
copies et rend compte. Thomas reprend ensuite ce qu'il veut dans l'app. Le plan complet est dans
`PLAN_preparation_semaine.md` (§ 4 : le dialogue).

Outils : la skill `cours-gestion-classe`, dans le checkout des outils
(`<skill>` = `C:\Users\Utilisateur\gc-worktrees\outils-master\.claude\skills\cours-gestion-classe`,
à remettre à jour en début de session : voir sa rubrique « Où sont les outils »). La lire
d'abord pour tout ce qui est écrit : fiche (`gc_cours.py`), écrans (`gc_ecrans.py`), envoi
(`gc_envoi.py`). Avant de convertir ou d'écrire une activité, relire les consignes pédagogiques
de son § 0 (dossier `_Claude\projet-assistant\`, hors du dépôt). Le placement passe par `gc_semaine.py`, avec le même jeton d'import.

```bash
python -I <skill>/gc_semaine.py bibliotheque --niveau 4e            # les originaux
python -I <skill>/gc_semaine.py agenda --classes 4e                 # les prochains cours
python -I <skill>/gc_semaine.py placer --activite <id> --correction <id> --classes 4e   # propose
python -I <skill>/gc_semaine.py placer ... --envoyer                # pose les copies
python -I <skill>/gc_semaine.py retirer <id de la copie>            # sur demande seulement
```

## Ce que Thomas dit, ce que Claude fait

| Thomas | Claude |
|---|---|
| « Prends l'activité 2 de la séquence 1 pour la 3B » | `placer --activite <id> --classes 3B` |
| « Même chose pour toutes mes 3e » | `placer ... --classes 3e` |
| « Prépare ma semaine : 3e → S1 A3, 4e → S2 A1 » | un `placer` par niveau |
| « La correction jeudi plutôt que mardi pour la 3A » | poser sur jeudi, puis retirer la copie de mardi (§ 4) |

## 1. Trouver l'activité

1. **Dans la bibliothèque** : `gc_semaine.py bibliotheque --niveau <n> --cherche <mot>`.
   - L'activité et sa correction sont deux originaux distincts (« Activité 3 — Wegener… » et
     « … (correction) »). Depuis le 15/11/2026, la feuille de documents élève est un troisième
     original, « … (documents) » ; la bibliothèque de « Mes cours » les montre sur une seule
     ligne (boutons Fiche, Correction, Documents). `placer` pose la fiche et la correction ; poser
     aussi les documents n'est pas encore prévu (un cours de l'emploi du temps ne porte qu'un
     document) : si Thomas le demande, lui poser la question.
   - Deux originaux qui se ressemblent : poser la question.
2. **Pas dans la bibliothèque** : la convertir depuis OneDrive, puis la créer comme original.
   - Les dossiers sont dans `C:\Users\Utilisateur\OneDrive\Documents\Ecole\2026-2027\<niveau>ème\Séquence …\Activité …`.
   - Source : `Fiche_eleve_….docx`, sinon le `.docx` élève le plus récent.
   - Les documents élève (feuille « Documents » à part, pages PDF jointes) vont dans un **cours
     à part**, même titre suivi de « (documents) », même niveau et même séquence, sans écrans.
     Une page déjà mise en page (rendu de la feuille Word, page PDF) s'y pose avec
     `Image(fichier, page_entiere=True)` : toute la feuille A4, à sa taille réelle à l'impression.
     Des documents mêlés aux questions sur la même feuille restent dans la fiche.
   - Les réponses viennent du `_CORRIGE.docx` ou du `corrigé`.
   - Une manipulation (matériel et protocole sur la fiche, ou fiche protocole sur Canva) donne une
     **fiche protocole** à part, « … (protocole) », comme le dit `cours-gestion-classe` § 3
     (« La fiche protocole ») ; la fiche d'activité n'en garde qu'un renvoi.
   - Un `_ADAPTEE` (et son `DOCUMENTS ADAPTEE`) se convertit en **cours à part**, « … (adaptée) »,
     comme le dit `cours-gestion-classe` § 3 (« La version adaptée ») : il porte de vraies aides
     (étapes, amorces) que l'impression « dys » de l'app ne recrée pas.
   - Ne pas reprendre le tableau de coups de pouce 🆘 (écriture miroir) d'une fiche : on n'en fait
     plus (`cours-gestion-classe` § 3).
   - Ignorer la fiche de préparation, le cahier de texte, la feuille de bilans (on n'en fait plus : le bilan est l'écran Bilan de
     l'activité, voir `cours-gestion-classe` § 3), et les dossiers `_Archive`, `_backup`,
     `_anciennes_versions`.
   - Fiche : `gc_cours.py`, puis `npm run course:check`, puis `gc_envoi.py cours`.
   - Écrans : `gc_ecrans.py`, puis `npm run screens:check`, puis `gc_envoi.py ecrans <id>`. Les
     réponses du corrigé vont sous cache.
   - Une activité est **un cours à deux faces** : la fiche à imprimer, et les écrans projetés
     pendant l'activité puis la correction.

## 2. Proposer les cours, sans rien écrire

`placer` sans `--envoyer` ne fait que proposer :

- **L'activité** va sur le **premier cours libre** de chaque classe à partir d'aujourd'hui (ou de
  `--apres AAAA-MM-JJ`). Un cours qui porte déjà un autre document est sauté, et la remarque le
  dit.
- **La correction** (`--correction <id>`) va sur le **cours suivant**. S'il porte un autre
  document, il est marqué « occupé » et rien n'y est posé.
- **Une classe en demi-groupes** : par défaut, seuls ses cours en classe entière comptent.
  `--groupes` pose une copie par demi-groupe (chacun la sienne).
- **Relancer la même demande ne crée rien de plus** : un cours qui porte déjà cet original est
  « déjà placé ».
- La période lue est de 21 jours (`--jours`, 60 au plus). Les cours annulés sont écartés.

## 3. Poser une seule question, si besoin, puis s'arrêter

Poser des copies est un travail mécanique : Claude le fait directement (`cours-gestion-classe`
§ 0, « Faire tout de suite, ou proposer d'abord »). Une activité **à écrire** (absente de OneDrive
comme de la bibliothèque) est un contenu nouveau : plan court d'abord.

Poser la question dans ces cas seulement :

- un cours visé porte déjà un document (état « occupé ») ;
- l'activité est introuvable, ou deux originaux lui ressemblent ;
- une classe n'a pas de cours dans la période (« aucun cours ») ;
- l'activité dure deux séances, ou les demi-groupes rendent l'ordre peu clair.

Sinon, poser directement avec `--envoyer` : la demande de Thomas vaut accord pour ce qu'elle
nomme (cette activité, ces classes, les prochains cours). Un cours occupé n'est jamais écrasé : la
fonction le refuse même si on le lui demande.

## 4. Corriger après coup, toujours sur demande

- **Retirer** : `gc_semaine.py retirer <id de la copie>`. La fonction refuse une copie qu'une
  séance a déjà utilisée (son encre en dépend). Elle refuse aussi une copie ouverte ou retouchée
  depuis sa pose ; dans ce cas, `--forcer` seulement si Thomas confirme qu'il accepte de perdre
  ses retouches.
- **Déplacer** (« la correction jeudi plutôt que mardi ») : poser l'original sur le nouveau cours
  (`placer --activite <id original> --classes 3A --apres <jour>`), puis retirer l'ancienne copie.
  Pour garder les retouches de Thomas, poser sa copie à la place de l'original : la provenance
  reste celle de l'original.
- Ne jamais modifier ni supprimer un **original** de la bibliothèque sans demande explicite.

## 5. Rendre compte

Le tableau que `placer` affiche, tel quel : Classe | Cours | Document | État. Ajouter dessous :

- ce qui reste à faire à la main (une image à insérer, un écran à retoucher) ;
- ce qui n'a pas pu être vérifié : le nombre de pages réel de la fiche, qui ne se voit qu'à
  l'affichage ; les avertissements de `screens:check` ;
- où le retrouver : le calendrier de l'accueil, et Mes cours › Par classe ;
- **les entrées de cahier de texte** des séances posées (une par cours et par classe), écrites
  comme le dit `cours-gestion-classe` § 3 (« Le cahier de texte ») et envoyées dans l'app, avec le
  compte rendu de l'envoi (enregistrées, déjà là, refusées).

## Habitudes apprises

Quand Thomas corrige un écran ou une fiche de la même façon deux fois, proposer d'en faire une
règle de `cours-gestion-classe` (SKILL.md, § 3 ou § 7) ; ne l'écrire qu'avec son accord.

- Les bilans s'écrivent toujours en rouge, titre compris (14/11/2026).
- La fiche zoomée n'est pas un tableau d'activité : les écrans sont faits pour l'écran (14/11/2026).
