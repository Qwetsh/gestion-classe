---
name: tableau-seance
description: Fabrique le tableau d'une séance pour Thomas (prof de SVT au collège) dans Gestion Classe — les écrans projetés au TBI pendant une activité ou sa correction, avec une vraie plus-value (animations pas à pas, schémas cliquables, révélations, vrai/faux, QCM, objets qui se déplacent, et plus tard 3D et graphiques animés). À utiliser dès que Thomas dit « durant la séance prochaine avec la 4C je fais l'activité 3 de la séquence 2, crée le tableau », « fais-moi le tableau de la correction de… », « prépare les écrans de l'activité… », « le tableau pour mes 3e jeudi », ou demande un tableau, des écrans, un support TBI, une correction animée pour une activité de ses séquences. Aussi pour noter son retour après une séance jouée avec un tableau (« la séance s'est bien passée, mais… »).
---

# Le tableau d'une séance

Thomas dit en une phrase : la classe, l'activité, la séquence, et s'il veut le tableau de
**l'activité** ou de la **correction**. Claude livre des écrans prêts à projeter, posés sur le bon
cours, qui apportent ce qu'il n'aurait pas fait seul en 10 minutes. Il retouche ensuite dans l'app.

Outils : la skill `cours-gestion-classe` (`gc_ecrans.py` écrit les écrans, `gc_envoi.py` les
envoie, `gc_cours.py` la fiche) et la skill `prepare-semaine` (`gc_semaine.py` trouve le cours et
y pose le document). Les lire avant la première utilisation.

## 0. Relire ce que l'on sait (toujours, avant tout)

La connaissance de Thomas est **hors du dépôt** (le dépôt est public) :
`C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\`

1. `profil.md` : sa façon d'enseigner, ses rituels, ce qu'il attend d'un tableau.
2. `gouts-tableaux.md` : ce qui lui a plu ou déplu. **Toute règle confirmée s'applique.**
3. `progression/<année>-<niveau>.md`, à l'activité visée : problématique, prérequis, notions,
   déroulé, bilan, vigilances, pistes pour le tableau.
4. `journal-seances.md` : les retours récents, surtout pour la même classe ou la même séquence.
5. `svt-cycle4.md` : le programme et les idées fausses des élèves sur la notion.

Puis `plus-value.md` (ce dossier-ci) : quel enrichissement pour quel contenu.

## 1. Trouver l'activité et le cours

- **Le cours** : `gc_semaine.py agenda --classes <classe>` → le prochain cours de la classe (ou
  celui qu'il nomme : « jeudi »). Dire lequel dans le compte rendu.
- **L'activité, dans OneDrive** : `C:\Users\Utilisateur\OneDrive\Documents\Ecole\<année>\<n>ème\Séquence …\Activité …`.
  Lire, dans cet ordre :
  1. la **fiche de préparation** (déroulé minuté, prérequis, vigilances, bilan dicté) : c'est le
     scénario du tableau ;
  2. la fiche élève et le corrigé (`_CORRIGE`) : les questions et les réponses ;
  3. les documents, les images de `_ressources/`, le cahier de texte, la feuille de bilans corrigée.
  Ignorer `_ADAPTE`, `_archive*`, `_backup`.
- **Dans l'app** : `gc_semaine.py bibliotheque --niveau <n> --cherche <mot>`. Si l'activité a
  déjà un original (avec ou sans écrans), partir de lui ; ne jamais le modifier sans demande.
- Ancienne préparation générique (sans minutage, avril 2026) : la fiche élève prime ; le dire.

## 2. Scénario d'abord (dix lignes, avant de fabriquer)

Un écran par moment du déroulé de la préparation. Pour chacun : ce que la classe voit, et **la
plus-value annoncée** (ce que l'écran fait que la fiche papier ne fait pas). Exemple :

```
1. Titre + problématique (rideau de page : on découvre la question ensemble)
2. Situation : Wegener 1912 — photo, citation, « pourquoi ne l'a-t-on pas cru ? » en rouge
3. Consigne du puzzle + minuteur 10 min
4. L'Atlantique s'ouvre : Afrique et Amérique du Sud glissent en 3 étapes (−130 Ma → auj.), bouton Suivant
5. Tableau observe / déduit, une ligne par toucher
…
9. Bilan à trous, en rouge
```

- **Tant que `gouts-tableaux.md` ne dit pas autre chose, soumettre le scénario à Thomas** et
  attendre son accord ou ses corrections avant de fabriquer. Ses corrections vont dans
  `gouts-tableaux.md` (avec la date) si elles valent pour la suite.
- Activité : on accompagne le travail. Consignes courtes, documents en grand, minuteur, coups de
  pouce, **aucune réponse visible**. Correction : réponses révélées une à une, erreurs fréquentes
  (vigilances de la préparation), vrai / faux sur les idées fausses, bilan en rouge.
- Respecter le minutage : environ un écran par 4 à 6 minutes de séance, plus pour une correction.

## 3. Fabriquer

`gc_ecrans.py` (skill `cours-gestion-classe`, § 7) : gabarits de base, gabarits interactifs
(`etapes`, `schema`, `vrai_faux`, `qcm`, `loupe`, `sommaire`), primitives (`bouton`, `suivant`,
`zone`, `cacher`, `fleche`, `dessin`, `forme`, `fenetre`, `coup_de_pouce`, `outil`, `video`,
`site`) et actions (`Afficher`, `DeplacerVers`, `Decouvrir`, `AllerA`, `Ouvrir`, `Zoomer`…).
L'exemple complet est `cours-gestion-classe/exemples/interactifs_4e.py`.

- **Un mécanisme se montre par une animation**, pas par des images que des boutons déplacent
  (refusé par Thomas le 16/11/2026) : scène dessinée et animée avec `gc_animation` (skill
  `cours-gestion-classe`, § 7 « Les animations »), au niveau de qualité de
  `_Claude/exemples/anticorps-animation-reference.html`, contrôlée étape par étape avec `apercu`.
  Une animation par tableau suffit souvent : la garder pour le moment où elle fait comprendre.
- Images : celles de `_ressources/` d'abord (`gc_envoi.py image`), sinon une image libre
  (Wikimedia Commons, NASA ; voir `svt-cycle4.md` § 4) avec son crédit en légende.
- Ce que l'app ne sait pas encore faire (3D manipulable, graphique qui se trace, simulation à
  curseur, glisser-déposer élève) : **le dire dans le scénario**, proposer l'équivalent faisable
  (étapes, déplacements, schéma cliquable), et noter le manque dans le compte rendu. Ces manques
  sont la liste des fonctions à ajouter (lots B à D de `plus-value.md`).

## 4. Vérifier, poser, contrôler

1. `ecrire()` puis `npm run screens:check` : zéro erreur ; corriger les alertes simples.
2. Où poser :
   - l'activité a un cours dans l'app → `gc_envoi.py ecrans <id> <fichier>` sur **l'original** de
     la bibliothèque (`--remplacer` seulement sur demande), puis `gc_semaine.py placer` pour la
     classe ;
   - sinon, créer l'original (fiche via `gc_cours.py` si Thomas la veut, sinon cours minimal),
     y poser les écrans, puis placer.
3. Contrôle au navigateur intégré (serveur de dev `web-tableau-seance` ou celui d'une autre copie,
   compte de Thomas) : ouvrir le cours **original** › Écrans › Essayer, toucher chaque bouton.
   Jamais sur une copie placée pour une classe (l'état y est gardé en base).
   Points à regarder : libellés de boutons sur une ligne, étiquettes qui ne chevauchent rien,
   texte de fenêtre lisible, rien sous le bouton « Suivant ».

## 5. Rendre compte

- Le cours visé (classe, date, heure) et le titre du tableau dans l'app.
- Le scénario final, écran par écran, en une ligne chacun.
- Ce qui reste à faire à la main (image à insérer, écran à retoucher), ce qui n'a pas pu être
  vérifié, et les manques de l'app rencontrés.

## 6. Après la séance

Quand Thomas revient (ou à la séance suivante) : poser les trois questions de
`journal-seances.md` s'il n'en dit rien, écrire l'entrée, et remonter dans `gouts-tableaux.md` ce
qui vaut pour la suite. Une remarque qui revient deux fois devient une règle (ici, § 2, ou dans
`cours-gestion-classe`), **avec son accord**.

## Règles qui ne bougent pas

- Les bilans en rouge (#C00000), titre compris.
- Une idée par écran ; texte courant en taille 22 au moins.
- Jamais de nom d'élève sur un écran ; jamais d'information PAP/PPRE/PAI à l'écran.
- Ne jamais modifier ni supprimer un original ou une copie placée sans demande explicite.
- Ne jamais écrire dans `profil.md` ou `gouts-tableaux.md` une préférence que Thomas n'a pas
  exprimée : une hypothèse va dans la section « À vérifier avec toi ».
