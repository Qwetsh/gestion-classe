---
name: cours-gestion-classe
description: Rédige un cours, une fiche d'activité, une fiche méthode ou une évaluation directement dans l'éditeur de cours de Gestion Classe (l'app de Thomas, prof de SVT), au lieu de produire un .docx. À utiliser dès que Thomas demande d'« écrire / rédiger / faire / créer » un cours, une fiche élève, une activité, une trace écrite ou une évaluation « dans Gestion Classe », « dans l'app » ou « dans l'éditeur de cours », ou plus généralement une fiche alors qu'il a abandonné Word. Crée le cours en base Supabase (table boards, colonne doc) après vérification automatique.
---

# Écrire un cours dans Gestion Classe

Thomas n'utilise plus Word : ses fiches sont rédigées dans l'éditeur de cours de Gestion Classe
(feuilles A4, TipTap). Claude écrit le cours **directement dans l'app**. Il suit quatre étapes et
ne saute jamais la vérification.

1. **Rédiger** le contenu, en suivant les habitudes des fiches de Thomas (§ 3).
2. **Produire le brouillon** JSON avec la bibliothèque `gc_cours.py` de cette skill.
3. **Vérifier** avec `npm run course:check` (schéma réel de l'éditeur) et corriger jusqu'à zéro erreur.
4. **Créer le cours** en base avec la requête préparée, via le connecteur Supabase.

Chemins (dépôt `Gestion classe`, à adapter si la session est dans un worktree) :

- skill : `.claude/skills/cours-gestion-classe/` (`gc_cours.py`, `exemples/microbiote.py`, `icones.md`)
- brouillons : `gestion-classe-web/course-drafts/` (ignoré par git)
- projet Supabase de production : `djodkjysovalpufgevrr`

## 1. Rédiger

Avant d'écrire, lire `exemples/microbiote.py` : c'est une fiche réelle de Thomas, reproduite à
l'identique, et le modèle à suivre pour une fiche d'activité.

Le contenu scientifique est celui que Thomas demande, au niveau du collège. Il faut :

- des consignes courtes ;
- des verbes de consigne en gras (**explique**, **compare**, **justifie**) ;
- des phrases complètes et un vocabulaire du programme.

Si Thomas fournit des documents (PDF, images, fiche existante), en partir.

## 2. Produire le brouillon

Écrire un petit script Python (dans le dossier de travail de Claude, pas dans le dépôt). Il importe
la bibliothèque et décrit la fiche bloc par bloc :

```python
import sys; sys.path.insert(0, r'<dépôt>/.claude/skills/cours-gestion-classe')
from gc_cours import *

c = Cours('Activité 3 — Les antibiotiques', niveau='3e', chapitre='Séquence 1 — Micro-organismes')
c.identite()
c.ajouter(Cartouche('Séquence 1', ['La découverte des micro-organismes', 'Étude de documents'],
                    'Activité 3 : Les antibiotiques', classe='3', note='/20',
                    infos=[('⏱', 'Durée', '1 séance'), ('👥', 'Modalité', 'Binômes')],
                    problematique='Comment les antibiotiques agissent-ils ?',
                    objectifs=['…', '…']))
c.para(B('Situation de départ : '), '…')
c.titre2('Questions')
c.question(1, 'À partir du ', B('document 1'), ', ', B('explique'), ' …')
c.ajouter(JaiReussi('…', '…'))
c.ecrire(r'<dépôt>/gestion-classe-web/course-drafts/antibiotiques.json')
```

Lancer ce script avec `python -I script.py`. La bibliothèque produit un brouillon de la forme
`{ title, level, chapter, doc }`, où `doc` est le document de l'éditeur (`CourseDoc`).

### Les briques (toutes dans `gc_cours.py`, docstrings à lire)

**Texte en ligne** :

- `T(texte, gras, italique, souligne, couleur, taille, exposant, indice, surligne, police)` ;
- `B()` (gras), `I()` (italique), `C(texte, couleur)` ;
- `Pointilles(cm)` : pointillés de réponse ;
- `Bareme(n)`, `TotalBareme()` : barème « / n », calé à droite ;
- `Icone('Nom')` : voir `icones.md` ; les émojis sont aussi permis dans le texte ;
- `Saut()` : retour à la ligne dans le paragraphe.

**Blocs** :

- `P(...)` : paragraphe ; options `align`, `interligne`, `avant`, `apres`, `retrait` ;
- `Serre(...)` : paragraphe serré ;
- `Titre(1|2|3, ...)` ;
- listes : `Puces`, `Numeros`, `Cases` (cases à cocher) ;
- `Encadre(..., type_, titre, couleur, bordure, titre_gras)`, et `EncadreFiche(titre, couleur, ...)` pour le cadre fin des fiches Word ;
- `Zone(style, lignes)` : zone d'écriture Seyès, carreaux, lignes, pointillés ou blanc ;
- `Colonnes([...], [...])`, `SautDePage()`, `Trait()` ;
- `Image(fichier, largeur_cm, legende)` : envoie le fichier puis l'insère (demande le jeton d'import, § 5).

**Tableaux** :

- `Tableau(Ligne(Cellule(blocs, [largeurs px], lignes=rowspan, fond, milieu)), style)` ;
- `largeurs(*parts)` : des largeurs dont la somme fait la colonne (605 px) ;
- `TableauSimple(entetes, lignes)`.

**Blocs des fiches de Thomas** :

- `LigneIdentite()` ;
- `Cartouche(...)` ;
- `Question(n, ..., points)` ;
- `Rappel(...)` : encadré jaune 💡 ;
- `PourAllerPlusLoin(...)` : violet ★ ;
- `JaiReussi(...)` : vert ✅, avec des cases.

**Conventions** :

- **Chapitre** : celui des cours déjà rangés, mot pour mot, pour que la fiche rejoigne le même
  dossier. Lire `select distinct level, chapter from boards where chapter is not null order by 1, 2`.
  Sans chapitre existant, utiliser « Séquence n — thème court ».
- **Note** : dans une activité, `note_detail` dit quelles questions sont notées
  (« (questions 2 et 3) »). Le demander à Thomas s'il ne l'a pas dit. Pas de `Bareme` par question,
  sauf dans une évaluation.
- **Documents** : comme dans les fiches de Thomas, ils sont sur une **feuille de documents à part**,
  citée dans « Matériel ». La fiche n'en contient pas, sauf demande.
- **Icônes** : `Icone('Nom', couleur, taille)` dans un titre ou à la place d'un émoji, suivie d'une
  espace. Pas d'icône en tête d'un `Rappel` : le 💡 y est déjà.
- **Titres** : le titre du cours (`Cours(...)`, visible dans la liste des tableaux) peut différer
  du titre du cartouche (« Activité n : … »).

**Réglages du cours** : `Cours(titre, niveau, chapitre, police='Arial', taille=11, theme='fiche', numerotation, premiere_page_vide=True, en_tete, pied)`.

- Niveaux : `6e`, `5e`, `4e`, `3e`, `Autre` ou `None`.
- Thèmes : `classique`, `sobre`, `nature`, `chaleureux`, `ecolier`, `fiche` (couleurs des fiches Word).

## 3. Les habitudes des fiches de Thomas

Une fiche d'activité tient sur **une page A4**. Elle suit cet ordre, comme `exemples/microbiote.py` :

1. `LigneIdentite()`, puis `Cartouche(...)`. Le cartouche contient :
   - la séquence et sa thématique ;
   - le titre « Activité n : … » et la classe ;
   - la note sur 20, avec le détail des questions notées ;
   - deux compétences : « Pratiquer des démarches scientifiques » et « Pratiquer des langages scientifiques » ;
   - durée, modalité, matériel et méthodes, avec émojis ;
   - la problématique, sous forme de question ;
   - 2 à 4 objectifs commençant par un verbe à l'infinitif.
2. `Situation de départ :` en gras, puis deux phrases au plus.
3. Un `Rappel(...)` de méthode ou de vocabulaire, s'il est utile.
4. `titre2('Questions')`, puis des `question(n, ...)` : « n. » en gras, verbes de consigne en gras,
   documents cités en gras (« **document 1** »).
5. `PourAllerPlusLoin(...)` : une question bonus.
6. `JaiReussi(...)` : les objectifs, plus « rédiger des phrases complètes… », sous forme de cases.

Texte en Arial 11 pt, thème `fiche`, première page sans en-tête ni pied. Les marges sont fixes
(2,5 cm), donc la colonne fait 16 cm : il faut rester concis. Avec le cartouche, une fiche de plus de
300 mots environ passe sur deux pages (la fiche Microbiote, 370 mots, en fait deux) : raccourcir
ou prévenir Thomas.

Pour un **cours** (trace écrite) :

- `Cours(..., numerotation='roman')` ;
- `titre1` pour le chapitre, `titre2` et `titre3` pour les parties ;
- encadrés `Encadre(type_='definition')` et `Encadre(type_='retenir')` pour le bilan.

**Le bilan s'écrit toujours en rouge** (règle de Thomas, 14/11/2026 : c'est la trace que les élèves
recopient en rouge). Partout où Claude écrit un bilan — cours, fiche, correction, écran — son titre
et son texte sont en `ROUGE` (`#C00000`) : `C('…', ROUGE)` dans un document, `color` de l'objet
texte sur un écran. Les mots d'un texte à trous suivent la couleur du texte.

Pour une **évaluation** :

- `Question(..., points=2)` et `Zone('lignes', 4)` pour répondre ;
- `TotalBareme()` dans le cartouche.

## 4. Vérifier

```bash
cd <dépôt>/gestion-classe-web && npm run course:check
```

- Lire `course-drafts/<nom>.report.txt`. Il donne aussi la **longueur en mots** : au-delà de
  300 mots environ, une fiche avec cartouche passe sur deux pages.
- La commande vérifie **tous** les brouillons du dossier et réécrit leurs rapports. Une ligne
  « 1 skipped » est normale : c'est le test « aucun brouillon », qui ne joue pas quand il y en a.
- Corriger **toutes** les erreurs (✗) dans le script, régénérer et revérifier.
- Relire les avertissements (!).
- Sans erreur, le script écrit `course-drafts/<nom>.sql`, la requête de création.

Le compte propriétaire est lu dans `course-drafts/owner.txt`. S'il manque, lancer
`select user_id, count(*) from boards group by user_id` :

- un seul compte : écrire son identifiant dans le fichier ;
- plusieurs comptes : demander à Thomas lequel est le sien.

## 5. Créer le cours

**Voie normale : le jeton d'import.** Thomas crée un jeton dans Réglages › Jeton d'import et le
colle dans `~/.gestion-classe/jeton-import.txt`. Ne jamais lui demander de le coller dans la
conversation, ne jamais l'afficher ni l'écrire ailleurs.

```bash
python -I <skill>/gc_envoi.py verifier                      # le jeton est-il valable ?
python -I <skill>/gc_envoi.py cours course-drafts/<nom>.json    # crée le cours, affiche son id
python -I <skill>/gc_envoi.py ecrans <id du cours> <pages.json> # pose les écrans d'un cours
```

- L'envoi **crée un nouveau cours** et affiche son `id`.
- Les images passent par le même jeton : `Image('schema.png', largeur_cm=8)` dans le script du
  brouillon envoie le fichier et l'insère. La fonction refuse un document qui cite une image
  qu'elle n'a pas reçue.
- Dire à Thomas où trouver le cours : Accueil › Mes tableaux, rangé sous son niveau.

**Sans jeton** (pas encore créé, fonction indisponible) : lire `course-drafts/<nom>.sql` et
l'exécuter tel quel avec l'outil `execute_sql` du connecteur Supabase, projet
`djodkjysovalpufgevrr`. Pas d'image dans ce cas : mettre un paragraphe `[Image : …]` et le
signaler à Thomas.

Règles de sûreté :

- Ne jamais envoyer un brouillon que `course:check` n'a pas validé sans erreur.
- **Ne jamais modifier ni supprimer un cours existant** sans demande explicite de Thomas.
- Pour une correction demandée sur un cours existant :
  `python -I <skill>/gc_envoi.py cours <brouillon.json> --remplacer <id>`. La fonction garde
  d'abord une version (« Avant la modification par Claude »), conserve les écrans du cours et
  pose un nouveau `rev` : si Thomas a le cours ouvert, l'éditeur signale le conflit et le laisse
  choisir entre les deux versions.
- Remplacer les écrans d'un cours : `ecrans <id> <pages.json> --remplacer`, seulement sur
  demande ; les anciens écrans sont supprimés, sans version.
- Ne pas écrire `rev` dans un nouveau cours. Ne pas mettre d'URL d'image.
- Dans un texte d'écran, écrire `&lt;` pour le signe « < » : la fonction refuse toute balise
  autre que la mise en forme.
- Un brouillon reste dans `course-drafts/` : il peut servir à recréer le cours.

## 6. Contrôler le rendu (si le navigateur intégré est disponible)

Ouvrir l'app (serveur de dev ou site déployé), puis le cours, et vérifier :

- le nombre de pages dans la barre d'état (« Page 1 sur 1 » pour une fiche) ;
- qu'aucun tableau ne déborde.

Sinon, demander à Thomas de l'ouvrir et de le dire.
