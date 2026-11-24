---
name: cours-gestion-classe
description: Rédige un cours, une fiche d'activité, une fiche méthode ou une évaluation directement dans l'éditeur de cours de Gestion Classe (l'app de Thomas, prof de SVT), au lieu de produire un .docx. À utiliser dès que Thomas demande d'« écrire / rédiger / faire / créer » un cours, une fiche élève, une activité, une trace écrite ou une évaluation « dans Gestion Classe », « dans l'app » ou « dans l'éditeur de cours », ou plus généralement une fiche alors qu'il a abandonné Word. Crée le cours en base Supabase (table boards, colonne doc) après vérification automatique.
---

# Écrire un cours dans Gestion Classe

Thomas n'utilise plus Word : ses fiches sont rédigées dans l'éditeur de cours de Gestion Classe
(feuilles A4, TipTap). Claude écrit le cours **directement dans l'app**. Il suit quatre étapes et
ne saute jamais la vérification.

0. Pour un **contenu nouveau**, soumettre d'abord un plan court et attendre son « ok » (§ 0,
   « Faire tout de suite, ou proposer d'abord »).
1. **Rédiger** le contenu, en suivant les habitudes des fiches de Thomas (§ 3).
2. **Produire le brouillon** JSON avec la bibliothèque `gc_cours.py` de cette skill.
3. **Vérifier** avec `npm run course:check` (schéma réel de l'éditeur) et corriger jusqu'à zéro erreur.
4. **Créer le cours** en base avec la requête préparée, via le connecteur Supabase.

Chemins (dépôt `Gestion classe`, à adapter si la session est dans un worktree) :

- skill : `.claude/skills/cours-gestion-classe/` (`gc_cours.py`, `gc_ecrans.py`, `gc_envoi.py`, `gc_semaine.py`, `exemples/`, `icones.md`)
- poser un cours sur l'emploi du temps : skill `prepare-semaine` (`gc_semaine.py placer`), jamais par une requête écrite à la main
- brouillons : `gestion-classe-web/course-drafts/` (ignoré par git)
- projet Supabase de production : `djodkjysovalpufgevrr`

## 0. Relire les consignes pédagogiques (toujours, avant tout travail sur un cours)

Avant d'écrire, de convertir, de corriger ou de retoucher un cours, une fiche, une évaluation ou
des écrans, relire dans le dossier privé de Thomas, **hors du dépôt** :
`C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\projet-assistant\`

1. `LISEZMOI.md` : l'index du dossier et l'**ordre de priorité** en cas de contradiction.
2. `consignes-pedagogiques.md` : posture, fiabilité scientifique, création et correction,
   adaptation, interdits.
3. `regles-permanentes.md` : les règles et décisions de Thomas (supports, questions, rigueur,
   progression, matériel).

Puis, selon le cours visé, la note de `documents/claude/` qui le concerne (l'index du
`LISEZMOI.md` dit laquelle fait foi), et `references/BOcycle4Version2020.pdf` avant de citer le
programme.

- Une contradiction entre ces fichiers et cette skill, `profil.md` ou `gouts-tableaux.md` **se
  signale à Thomas** ; elle ne se tranche pas en silence.
- Le dépôt est **public** : rien de ce dossier n'y est copié (ni extrait, ni résumé, ni nom
  d'élève). On le cite par son chemin, on ne le recopie pas.
- Les mises à jour de ces consignes se font dans ce dossier, pas ici.

### Faire tout de suite, ou proposer d'abord (décision de Thomas, 22/11/2026)

| Travail | Ce que fait Claude |
|---|---|
| Mécanique : poser, déplacer ou retirer un document, convertir une fiche OneDrive à l'identique, cahier de texte | Il fait directement, puis rend compte |
| Contenu nouveau : nouvelle activité, évaluation, refonte, séquence | Un plan court d'abord (structure, questions, documents, barème) ; il fabrique après le « ok » de Thomas |
| Tableau d'une séance | Il propose, puis attend (skill `tableau-seance`) ; animations validées une par une |
| Demande floue sur un petit travail | Version par défaut, en nommant les autres possibilités |
| Code de l'app, commit, PR, fusion | Seulement quand Thomas le demande |

Le plan est une proposition qu'il peut refuser, pas une série de questions ; « ok » veut dire
valider et continuer. Une seule question à la fois, si elle bloque vraiment.

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
                    infos=[('Durée', '1 séance'), ('Modalité', 'Binômes')],
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
- `Icone('Nom')` : voir `icones.md` (icônes Lucide, dessinées) ; **jamais d'émoji** (§ 3) ;
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
- `Image(fichier, page_entiere=True)` : une **page A4 déjà mise en page** (feuille de documents
  convertie depuis Word, page d'un PDF) occupe toute la feuille, marges comprises, seule sur sa
  page : elle s'imprime à sa taille réelle. Sans ce réglage, la page est réduite dans la colonne de
  16 cm et ses propres marges s'ajoutent aux 2,5 cm du cours (retour de Thomas, 24/11/2026).
  Une image par page, sans `SautDePage()` entre elles (la pagination s'en charge).

**Tableaux** :

- `Tableau(Ligne(Cellule(blocs, [largeurs px], lignes=rowspan, fond, milieu)), style)` ;
- `largeurs(*parts)` : des largeurs dont la somme fait la colonne (605 px) ;
- `TableauSimple(entetes, lignes)` ;
- `TableauCompetences([(question, points, compétence), …])` : le tableau questions → compétences
  d'une évaluation (§ 3), domaines du socle et total compris.

**Blocs des fiches de Thomas** :

- `LigneIdentite()` ;
- `Cartouche(...)` ;
- `Question(n, ..., points)` ;
- `Rappel(...)` : encadré jaune « Rappel : » ;
- `PourAllerPlusLoin(...)` : violet ;
- `JaiReussi(...)` : vert, avec des cases.

**Conventions** :

- **Chapitre** : celui des cours déjà rangés, mot pour mot, pour que la fiche rejoigne le même
  dossier. Lire `select distinct level, chapter from boards where chapter is not null order by 1, 2`.
  Sans chapitre existant, utiliser « Séquence n — thème court ».
- **Note** : dans une activité, `note_detail` dit quelles questions sont notées
  (« (questions 2 et 3) »). Le demander à Thomas s'il ne l'a pas dit. Pas de `Bareme` par question,
  sauf dans une évaluation.
- **Documents** : comme dans les fiches de Thomas, ils sont sur une **feuille de documents à part**,
  citée dans « Matériel ». La fiche n'en contient pas, sauf demande.
- **Zéro émoji** (règle de Thomas, 22/11/2026 : « ça fait trop IA ») : aucun émoji dans une fiche,
  une correction, un écran, une animation, un cahier de texte, ni dans ce qu'on écrit à Thomas
  (propositions, comptes rendus). Restent permis : les flèches de navigation des boutons (◀ ▶ ↺) et
  les cases ☐. Les exemples Wegener (`wegener_*.py`) datent d'avant la règle et reproduisent ce qui
  est en base : ne pas imiter leurs ★ et ⚠.
- **Icônes** : `Icone('Nom', couleur, taille)` (un dessin Lucide, pas un émoji) dans un titre, suivie
  d'une espace, avec parcimonie. Pas d'icône en tête d'un `Rappel`.
- **Titres** : le titre du cours (`Cours(...)`, visible dans la liste des tableaux) peut différer
  du titre du cartouche (« Activité n : … »).

**Réglages du cours** : `Cours(titre, niveau, chapitre, police='Arial', taille=12, theme='fiche', numerotation, premiere_page_vide=True, en_tete, pied)`.

- Niveaux : `6e`, `5e`, `4e`, `3e`, `Autre` ou `None`.
- Thèmes : `classique`, `sobre`, `nature`, `chaleureux`, `ecolier`, `fiche` (couleurs des fiches Word).

## 3. Les habitudes des fiches de Thomas

Une fiche d'activité tient sur **une page A4**. Elle suit cet ordre, comme `exemples/microbiote.py` :

1. `LigneIdentite()`, puis `Cartouche(...)`. Le cartouche contient :
   - la séquence et sa thématique ;
   - le titre « Activité n : … » et la classe ;
   - la note sur 20, avec le détail des questions notées ;
   - deux compétences : « Pratiquer des démarches scientifiques » et « Pratiquer des langages scientifiques » ;
     le cartouche ajoute seul leurs domaines du socle (`avec_domaines`) ;
   - durée, modalité, matériel et méthodes (sans émoji) ;
   - la problématique, sous forme de question ;
   - 2 à 4 objectifs commençant par un verbe à l'infinitif.
2. `Situation de départ :` en gras, puis deux phrases au plus.
3. Un `Rappel(...)` de méthode ou de vocabulaire, s'il est utile.
4. `titre2('Questions')`, puis des `question(n, ...)` : « n. » en gras, verbes de consigne en gras,
   documents cités en gras (« **document 1** »).
5. `PourAllerPlusLoin(...)` : une question bonus.

   **Pas de tableau de coups de pouce** (encadré gris 🆘, indices en écriture miroir ou au
   décodeur) : les élèves ne s'en servent pas (Thomas, 22/11/2026). Une aide passe, si besoin,
   par un coup de pouce à l'écran (`p.coup_de_pouce`) ou par la version adaptée. En convertissant
   une fiche de OneDrive, ne pas reprendre ce tableau ; ne pas toucher sans demande aux fiches
   déjà en base qui en ont un.
6. `JaiReussi(...)` : les objectifs, plus « rédiger des phrases complètes… », sous forme de cases.

**Police : la règle d'accessibilité (« dys ») vaut pour toutes les fiches** (décision de Thomas,
22/11/2026 ; template v3.3) :

- corps de l'élève (consignes, situation, questions, réponses) en **Arial 12, interligne 1,5** :
  c'est le défaut de `Cours`, `c.para()` et `Question` (`INTERLIGNE_ELEVE`) ; les zones d'écriture
  (lignes de 8 mm) le respectent déjà ;
- encadrés (`Rappel`, `PourAllerPlusLoin`, `JaiReussi`) en **11 pt** (`TAILLE_ENCADRE`) ;
- cartouche et ligne d'identité en 8-10 pt (lus une fois) ;
- alignement à gauche, consignes décomposées, verbes d'action en gras ;
- ne pas réduire la taille ou l'interligne pour faire tenir une fiche : raccourcir le texte.

Thème `fiche`, première page sans en-tête ni pied. Les marges sont fixes (2,5 cm), donc la colonne
fait 16 cm : il faut rester concis. Avec le cartouche, une fiche de plus de **200 mots environ**
passe sur deux pages (estimation du 22/11/2026, à recaler sur la première fiche affichée ; en
Arial 11, la limite était de 300 mots) : raccourcir ou prévenir Thomas.

Pour un **cours** (trace écrite) :

- `Cours(..., numerotation='roman')` ;
- `titre1` pour le chapitre, `titre2` et `titre3` pour les parties ;
- encadrés `Encadre(type_='definition')` et `Encadre(type_='retenir')` pour le bilan.

**Le bilan s'écrit toujours en rouge** (règle de Thomas, 14/11/2026 : c'est la trace que les élèves
recopient en rouge). Partout où Claude écrit un bilan — cours, fiche, correction, écran — son titre
et son texte sont en `ROUGE` (`#C00000`) : `C('…', ROUGE)` dans un document, `color` de l'objet
texte sur un écran. Les mots d'un texte à trous suivent la couleur du texte.

Pour une **évaluation** (règle de Thomas, 22/11/2026) :

- **Les compétences** se nomment comme partout : intitulé du programme suivi de ses domaines du
  socle, « Pratiquer des langages (D1, D4) » (`avec_domaines`, table `DOMAINES_SOCLE`).
- **Le tableau questions → compétences** (règle de Thomas, 22/11/2026) : chaque évaluation a, dans
  son cours « (correction) », un tableau Question | Points | Compétence travaillée (domaines),
  avec le total : `c.ajouter(TableauCompetences([('1', 2, 'Pratiquer des langages'), …]))`.
  - Il figure dans le **plan** de l'évaluation soumis à Thomas : il le valide avant la
    correction. Une évaluation déjà en base sans tableau : le proposer, ne pas l'ajouter seul.
  - Jamais sur le sujet distribué aux élèves.
  - Les points du tableau sont ceux du barème du sujet, question par question : le total doit
    tomber juste.
  - Le Correcteur ne le lit pas encore (chantier à part) : les compétences par question restent
    à reporter dans la correction des copies.
- **Les élèves répondent sur une copie séparée** : le sujet ne contient ni `Zone` ni `Pointilles`
  sous les questions. `Question(..., points=2)`, et `TotalBareme()` dans le cartouche.
- **Les documents** de la partie « exploitation de documents » sont sur une **feuille à part**,
  un cours « Évaluation — thème (documents) », comme pour les activités. Thomas la ramasse
  parfois, parfois non : elle ne demande jamais d'écrire dessus et se lit seule (documents
  titrés et numérotés, cités par leur numéro dans le sujet).
- Le sujet est photocopié en **noir et blanc** : aucune question ne repose sur une couleur. La
  feuille de documents peut être en couleur (`regles-permanentes.md`).

### Ce que comporte une séquence (décision de Thomas, 22/11/2026)

Tout s'assemble dans le **classeur virtuel**. Une séquence comporte :

1. une **feuille de séquence**, comme celles qui existent (« Page de garde — Séquence n ») ;
2. les **fiches d'activités**, avec ce qui les accompagne : fiche protocole d'une manipulation
   (« … (protocole) », voir ci-dessous), documents (« … (documents) »), applications et sites,
   corrections ;
3. des **écrans pour chaque activité, terminés par un écran Bilan** (en rouge) : c'est là, et
   seulement là, que vit le bilan de l'activité ;
4. une **évaluation de séquence** (sujet et feuille de documents, voir ci-dessus) ;
5. une **fiche de mémorisation** de la séquence ;
6. parfois des **exercices d'entraînement** (surtout en 3e).

**Plus de feuille de bilans** : ni `.docx`, ni cours « Feuille de bilans — … », ni générateur
`feuille_bilans.py`. Une ancienne feuille de bilans de OneDrive ne sert plus que de source pour
le texte d'un bilan.

### La fiche protocole (manipulations, décision de Thomas, 22/11/2026)

Le **matériel et le protocole** d'une manipulation ne sont plus sur la fiche d'activité : ils vont
sur une **fiche protocole** à part, imprimée en couleur, plastifiée, laissée sur la paillasse et
réutilisée par tous les groupes et toutes les classes. L'élève la relit chez lui dans le classeur
virtuel.

- Un cours à part, même titre suivi de « (protocole) », même niveau et même séquence. L'app le range
  avec la fiche (bouton « Protocole » de la bibliothèque) et le met dans le classeur après la fiche,
  comme une feuille de documents.
- La page se dessine avec `gc_protocole.page_protocole(...)` : bandeau, matériel en pictogrammes
  (4 à 8), étapes numérotées illustrées (3 à 6), « Bien penser à » (sécurité, rangement) et, s'il y en
  a, la règle « Une erreur ? ». Les dessins sont des SVG faits pour l'expérience, dans un même style
  (exemple complet : `exemples/antibiogramme_paillasse_dessins.py` et `antibiogramme_protocole.py`).
  La page est posée en **une image** dans le cours (15,2 cm de large, pour tenir sur une feuille) :
  pour la changer, on change le script et on la renvoie.
- Étapes : un verbe à l'impératif en gras en tête, une action par étape, texte des étapes à 12 pt.
  Aucune conclusion de l'activité sur la fiche protocole (« plus la zone est grande… ») : c'est aux
  élèves de la trouver.
- Sur la **fiche d'activité**, la partie de manipulation se réduit à : « Suis la fiche protocole
  posée sur ta paillasse », ce qu'on fait pendant l'attente, et une phrase à écrire par l'élève
  sur ce qu'il teste (zone de 2 lignes). « Fiche protocole » s'ajoute au matériel du cartouche.
- **Deux exceptions** : quand l'élève doit **concevoir** le protocole (il l'écrit sur sa fiche), et
  quand le protocole tient en deux ou trois lignes (il reste sur la fiche).
- Une fiche protocole existe déjà sur Canva pour certaines manipulations (Thomas, « Fiche
  protocole — … ») : en partir pour le contenu, pas pour la mise en page.

### Le TP de « Mes TP » : il note la manipulation (décision de Thomas, 22/11/2026)

Une manipulation a aussi son TP dans « Mes TP » (tables `tp_templates`, `tp_template_criteria`),
dont le barème sert à noter les groupes **pendant** la manipulation, sur le téléphone.

- Le barème note **la manipulation elle-même, jamais les résultats** : les résultats (tableau,
  schéma, raisonnement J'observe / Je sais / J'en déduis) sont notés à part, sur la fiche.
- Cinq critères sur 10 : respect du protocole (3), soin des gestes (2), respect des consignes (2),
  rangement et nettoyage (2), calme et travail du groupe (1). Chaque critère a une consigne
  (`hint`) propre au TP : ce qu'on regarde concrètement (étapes clés, gestes, sécurité, rangement).
  Un TP fait seul ou présenté à la classe peut adapter le dernier critère (« Calme et autonomie »,
  « Présentation et écoute »).
- Une règle de recharges (« Une erreur ? ») se retire de la note de manipulation : l'écrire dans la
  consigne de « Respect du protocole ».
- Le matériel, le protocole et la sécurité du TP reprennent ceux de la fiche protocole.
- Changer un barème : mettre à jour les critères existants (mêmes `id`), en retirer ou en ajouter
  seulement ce qu'il faut, et toucher `synced_at` pour que le téléphone les reprenne ; vérifier
  d'abord qu'aucune note (`group_grades`) n'y renvoie. Les 45 TP ont été remis à ce modèle le
  22/11/2026.

### La version adaptée (élèves à PAP, décision de Thomas, 22/11/2026)

- Une activité ou une évaluation peut avoir une **version adaptée** : un cours à part, même titre
  suivi de « (adaptée) », même niveau et même séquence. L'app la range avec la fiche (bouton
  « Adaptée » de la bibliothèque) et ne la met **jamais** dans le classeur virtuel de la classe.
- Elle change la **forme**, pas le fond : consigne découpée en étapes numérotées avec pictogrammes
  (icônes Lucide, jamais d'émoji), amorces de phrases (« Je vois que… », « J'en déduis que… »), ce qu'il faut produire
  (« un texte de 3 à 4 lignes »). Le contenu évalué reste celui de la fiche ;
  **ne jamais réduire les exigences sans que Thomas le demande**, et signaler tout écart (une note
  qui porte sur moins de questions, par exemple).
- Elle n'est pas l'impression « dys » de l'app (Imprimer › Adaptée), qui ne change que la mise en
  page ; les deux se cumulent.
- Les documents adaptés, s'il y en a, vont dans le même cours « (adaptée) », après un saut de page.
- Quand : en convertissant un `_ADAPTEE` de OneDrive (`prepare-semaine` § 1), ou sur demande de
  Thomas. Pas de version adaptée d'office pour une nouvelle activité.
- Jamais de nom d'élève ni d'information PAP sur un écran projeté.

### Le cahier de texte (décision de Thomas, 22/11/2026)

**Chaque séance préparée a son entrée de cahier de texte**, que Thomas recopie lui-même dans
Pronote :

- **Quand** : dès qu'un document est posé sur un cours daté de l'emploi du temps
  (`prepare-semaine`, `tableau-seance`) : une entrée par séance et par classe, à la date et à
  l'heure du cours. Une activité sur deux séances = deux entrées.
- **Format** : celui de la skill `cahier-de-texte` (texte brut collable dans Pronote, thème et
  séance en tête, « TRAVAIL EFFECTUÉ EN CLASSE », « COMPÉTENCES TRAVAILLÉES » ; rien d'inventé :
  on part de la fiche, de la correction et des écrans).
- **Compétences travaillées** : l'intitulé du programme suivi de ses domaines, comme sur les
  fiches (« Pratiquer des démarches scientifiques (D1, D2, D4) »), et non une compétence
  reformulée.
- **Écrite avant la séance** : c'est un prévisionnel, rédigé au passé comme la skill le demande.
  Le dire à Thomas dans le compte rendu : il l'ajuste si la séance a dévié.
- **Où : dans Gestion Classe**, sur le cours de l'emploi du temps (table `lesson_journal`,
  migration 084, depuis le 22/11/2026). Plus de fichier dans OneDrive.
  1. Écrire l'entrée dans `gestion-classe-web/course-drafts/cahier/` (dossier ignoré par git : le
     dépôt est public), un fichier par séance nommé `AAAA-MM-JJ HHhMM <classe> — <titre court>.txt`
     (heure de début du cours, heure de Paris ; classe telle que l'agenda la donne, « 4B »). Il
     commence par trois lignes `Date :`, `Classe :`, `Cours :`, puis l'entrée.
  2. L'envoyer par le jeton d'import (§ 5) :
     `python -I <skill>/gc_envoi.py cahier "<dossier ou fichier>"`. Le compte rendu dit, fichier
     par fichier : « enregistrée », « déjà là, identique », ou un refus. Depuis un script :
     `envoyer_cahier([{ 'starts_at', 'label', 'content' }])` avec le cours tel que le rend
     `lire_agenda`.
  3. **Une entrée différente existe déjà** pour ce cours (« une autre entrée existe ») : Thomas a
     pu la retoucher. Ne pas l'écraser : le signaler, et n'ajouter `--remplacer` que s'il le
     demande. « Aucun cours » : le cours n'est pas dans l'emploi du temps à cette heure, ou pas
     relié à une de ses classes (le signaler, ne pas deviner).
- **Où Thomas la retrouve** : sur l'accueil, popover du cours › « Cahier de texte » (Copier pour
  Pronote, ouvrir, retoucher) ; page « Cahier de texte » (Classes › Cahier de texte), avec le
  filtre « À recopier ». « Copier pour Pronote » marque l'entrée recopiée.
- **Fichiers écrits avant la fonction** (dossier
  `C:\Users\Utilisateur\OneDrive\Documents\Ecole\2026-2027\_Cahier de texte\`, même nommage) :
  les reverser avec `gc_envoi.py cahier "<ce dossier>" --reprise` (provenance « reprise ») ; les
  fichiers restent dans OneDrive. Absent le 22/11/2026 : rien n'était encore à reprendre.

## 4. Vérifier

```bash
cd <dépôt>/gestion-classe-web && npm run course:check
```

- Lire `course-drafts/<nom>.report.txt`. Il donne aussi la **longueur en mots** : au-delà de
  200 mots environ, une fiche avec cartouche passe sur deux pages (§ 3).
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
npm run screens:check                                       # contrôle course-drafts/ecrans/*.json
python -I <skill>/gc_envoi.py ecrans <id du cours> <pages.json> # pose les écrans d'un cours
python -I <skill>/gc_envoi.py cahier <dossier | fichier.txt>   # entrées de cahier de texte (§ 3)
```

- L'envoi **crée un nouveau cours** et affiche son `id`.
- Les images passent par le même jeton : `Image('schema.png', largeur_cm=8)` dans le script du
  brouillon envoie le fichier et l'insère. La fonction refuse un document qui cite une image
  qu'elle n'a pas reçue.
- Dire à Thomas où trouver le cours : Accueil › Mes tableaux, rangé sous son niveau.
- **Fiche méthode** (« FM10 — … », sans niveau ni chapitre) : elle va dans l'onglet « Fiches
  méthode » de « Mes cours », pas dans la bibliothèque des activités. Après l'envoi, la ranger avec
  le connecteur Supabase : `update boards set category = 'methode' where id = '<id du cours>'`
  (migration 082 ; seule cette requête, sur le cours qu'on vient de créer). Titre « FMn — Titre »,
  le numéro que les fiches d'activité citent dans leur ligne « Méthodes ». Les FM1 à FM9 (charte
  verte, Verdana) ont été reprises le 17/11/2026 de `2026-2027/Fiches methodes/generate_fiches_methodes.py`.

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
- **Ne jamais envoyer des écrans que `screens:check` n'a pas validés sans erreur.** Ranger le
  fichier dans `course-drafts/ecrans/`, lancer `npm run screens:check` (dans `gestion-classe-web`),
  lire `<nom>.report.txt`. Une erreur bloque l'envoi : type d'objet inconnu, balise refusée, bouton
  ou cache qui vise un objet absent, objet hors de l'écran (la page fait 1000 × 562,5).
- Les avertissements du rapport sont des **estimations** : texte courant sous la taille 22 (28 px
  sur le TBI), texte qui descendrait sur le suivant ou sous l'écran. Les corriger quand c'est
  simple, et les citer à Thomas dans le compte rendu : seul l'affichage dans l'application tranche.
- Ne pas écrire `rev` dans un nouveau cours. Ne pas mettre d'URL d'image.
- Dans un texte d'écran, écrire `&lt;` pour le signe « < » : la fonction refuse toute balise
  autre que la mise en forme.
- Un brouillon reste dans `course-drafts/` : il peut servir à recréer le cours.

## 6. Contrôler le rendu (si le navigateur intégré est disponible)

Ouvrir l'app (serveur de dev ou site déployé), puis le cours, et vérifier :

- le nombre de pages dans la barre d'état (« Page 1 sur 1 » pour une fiche) ;
- qu'aucun tableau ne déborde.

Sinon, demander à Thomas de l'ouvrir et de le dire.

## 7. Les écrans d'une activité (`gc_ecrans.py`)

Les écrans sont ce que la classe voit au TBI pendant l'activité : des pages de tableau blanc
(1000 × 562,5), portées par le cours. Ce n'est pas la fiche zoomée (Thomas l'a écartée).

**Ce qui va à l'écran** : la problématique, les consignes raccourcies, un document en grand, une
question par écran, la place pour écrire, les réponses sous cache, le bilan.
**Ce qui reste sur le papier** : cartouche, ligne d'identité, barème détaillé, « J'ai réussi ».

Lire d'abord les deux exemples :

- `exemples/microbiote_ecrans.py` : huit écrans écrits avec les seuls gabarits (à lire à côté de
  `exemples/microbiote.py`, la fiche de la même activité) ;
- `exemples/wegener_ecrans.py` : les 13 écrans joués en classe, gabarits et primitives mêlés. Il
  reproduit à l'identique ce qui est en base : c'est le contrôle de non-régression du générateur.

```python
import sys; sys.path.insert(0, r'<dépôt>/.claude/skills/cours-gestion-classe')
from gc_ecrans import *

e = Ecrans('mic', "Activité 2 · L'activité du microbiote")   # préfixe court, propre à l'activité
e.titre('Séquence 1 — Micro-organismes', 'Activité 2', "L'activité du microbiote",
        problematique='Quelles aides les microbiotes nous apportent-ils ?')
e.question('Question 1 — La souche A', 'À partir du <b>document 1</b>, <b>explique</b> …',
           [('J’observe', '…'), ('J’en déduis', '…')])
e.bilan('<div>Le ' + e.trou('microbiote') + ' est …</div>')
e.ecrire(r'<dépôt>/gestion-classe-web/course-drafts/ecrans/microbiote-ecrans.json')
```

**Les gabarits** placent seuls leurs blocs (hauteur estimée, taille réduite jusqu'à 22 si le
contenu ne tient pas, alerte au-delà) :

| Gabarit | Ce qu'il pose |
|---|---|
| `titre(sequence, activite, titre, problematique)` | l'écran d'ouverture |
| `situation(paragraphes, question)` | deux ou trois phrases, la question en rouge |
| `consigne(titre, etapes, minuteur, note, bareme)` | étapes numérotées `(verbe, suite)`, minuteur à droite |
| `document(titre, paragraphes, encadre)` ou `document(titre, image=…, legende=…)` | un document en grand |
| `question(titre, enonce, reponses, bareme)` | l'énoncé, puis `(intitulé, réponse)` sous cache |
| `tableau(titre, entetes, lignes, bareme, par_ecran=2)` | tableau à compléter, deux lignes par écran, suite sur l'écran suivant |
| `calcul(titre, enonce, etapes, bareme)` | zone où poser le calcul, étapes sous cache à droite |
| `bilan(html)` | le bilan en rouge ; `e.trou('mot')` pour un texte à trous |

**Les primitives**, pour ce qu'aucun gabarit ne fait : `p = e.ecran(titre, bareme)`, puis
`p.texte(x, y, w, taille, html, couleur, cache, fond)`, `p.reponse(...)` (rouge, sous rideau),
`p.cadre(...)`, `p.minuteur(x, y, secondes)`, `p.image(x, y, w, h, chemin, largeur, hauteur, cache)`
(l'image est d'abord envoyée par `gc_envoi.py image`).

**L'interactivité** (lot A, 15/11/2026 ; exemple complet : `exemples/interactifs_4e.py`, contrôlé
dans l'application). Le procédé qui s'en sert est la skill `tableau-seance`.

| Gabarit interactif | Ce qu'il pose |
|---|---|
| `etapes(titre, etapes, image=…/dessin=…)` | un processus : chaque toucher sur « Suivant » montre l'étape suivante |
| `schema(titre, legendes, image=…/dessin=…, mode='suivant'\|'toucher')` | étiquettes reliées par une flèche à leur point, une à une, ou au toucher du point |
| `vrai_faux(titre, [(texte, vrai, explication)])` | 4 lignes au plus, bouton « Verdict » par ligne |
| `qcm(titre, question, choix, bonne, explication)` | toucher un choix montre une coche ou une croix |
| `loupe(titre, image, zones)` | toucher une zone de l'image cadre la vue dessus |
| `sommaire(titre, [(libellé, écran)], position)` | boutons qui mènent chacun à un écran |

Primitives : `p.bouton(x, y, w, h, texte, actions)`, `p.suivant(x, y, [[actions], [actions]…])`
(un bouton « Suivant 1/n » qui déroule des étapes, puis « ↺ Rejouer »), `p.zone(x, y, w, h,
actions)` (zone invisible), `p.cacher(objets…)` (cachés au départ), `p.fleche(de, vers)` (objet ou
point), `p.dessin(item, x, y, w)` (`DESSINS` : cell-animal, neuron, heart, volcano, check…),
`p.forme(kind, …)`, `p.tableau_fixe(x, y, w, lignes)`, `p.fenetre(titre, html)`,
`p.coup_de_pouce(html)`, `p.outil(kind, …)` (dé, roue, feu…), `p.video(x, y, w, url)`,
`p.site(x, y, w, h, url)`, `p.fond('grid')`, `p.rideau()`.
Actions : `Afficher`, `Masquer`, `Basculer`, `Decouvrir`, `Recouvrir`, `DeplacerVers(o, x, y)`,
`Decaler(o, dx, dy)`, `Replacer`, `Zoomer`, `Ouvrir(fenetre)`, `AllerA(écran)`, `PageSuivante`,
`Lancer`/`Arreter` (minuteur), `Tirer` (dé, roue), `Reinitialiser`, `UneFois(action)`.

**Les sites pilotables** (21/11/2026). Un site qui suit le contrat « gc-anim » avance comme une
animation, avec les boutons du tableau (`EtapeSuivante(site)`) et le « Suivant » du téléphone :
`p.site(x, y, w, h, url, etapes=n, boutons=True)`. L'hôpital virtuel de Thomas (`HOPITAL` dans
`gc_ecrans`) en offre deux :
- `HOPITAL + '?presentation=<fiche>'` : le patient en 3D, sa température, les photos du corps avec
  un gros plan, la lame, les analyses, **sans les réponses** (pour l'activité). Pour Mme Amalle
  (`eve-amalle`), 12 étapes ;
- `HOPITAL + '?correction=<id>'` : la correction animée de Docteur Morel, avec les voix
  (`content/corrections/<id>.json` de l'hôpital ; `eve` : 46 répliques). Hors du tableau, elle reste
  fermée tant que Thomas ne l'ouvre pas.
`etapes` est facultatif (le site l'annonce à son chargement), mais le donner permet aux boutons de
marcher avant le chargement. Fiches de l'hôpital : `C:/dev/hopital-virtuel/content/patients/`.

**Tout support interactif vit dans le tableau** (écrans, animations, scènes riches) : pas de
fichier HTML autonome ni de widget Genially (Thomas, 22/11/2026). Pour les élèves, l'export
« page web pour les élèves » du tableau en tient lieu.

**Une animation ou une scène riche ne se code qu'avec l'accord explicite de Thomas**, donnée à
cette animation-là, après un storyboard (règle du 21/11/2026, skill `tableau-seance` § 2-3).

**Les animations** (16/11/2026 ; exemple complet : `exemples/anticorps_animation.py` et
`anticorps_scene.js`). Pour montrer un **mécanisme** (une réaction, un cycle, un trajet, une
multiplication), on n'assemble pas des images que des boutons font glisser — Thomas l'a refusé le
16/11/2026 — : on écrit une **scène animée**, posée sur l'écran comme une image qui bouge.

- `gc_animation.assembler(titre, etapes, scene, banques=[…])` rend le code HTML de l'animation.
  `etapes` : liste d'`etape(identifiant, titre, légende, bilan=False)` — les **textes**, séparés du
  dessin, que Thomas pourra réécrire. `scene` : du JavaScript, `GC.play({ identifiant: { dur,
  draw(t) { … return svg; } } })` ; `draw` rend le SVG de l'instant `t` (secondes), la scène fait
  1600 × 760. `animation/outils.js` donne `seg`, `lerp`, `keys` (images-clés), `rng`, `txt`,
  `fleche`, `ok`, `ko` ; `animation/banque/<thème>.js` les dessins réutilisables (immunité : virus,
  antigène, anticorps, lymphocyte B, phagocyte, cellule, fonds). Un nouveau thème = un nouveau
  fichier de banque, dessiné avec le même soin.
- `e.animation(code)` : un écran entier (960 × 506) avec « ◀ Précédent », « ↺ Rejouer »,
  « Suivant ▶ ». L'animation affiche elle-même le titre et la légende de l'étape : pas de titre
  d'écran. `p.animation(x, y, w, h, code)` la pose où l'on veut ; actions `EtapeSuivante(o)`,
  `EtapePrecedente(o)`, `Rejouer(o)`.
- **L'image de l'animation** : `gc_animation.affiche(code, 'affiche.png')` photographie une étape,
  `gc_envoi.envoyer_image` l'envoie, et son chemin se passe à `e.animation(code, affiche=…)`. C'est
  elle que montrent les vignettes, l'aperçu de « Mes cours » et l'export PDF ; sans elle, une carte
  « ▶ Animation » (et `screens:check` le signale).
- En classe, le « Suivant » du téléphone fait avancer l'animation étape par étape, puis passe à
  l'écran suivant : inutile de prévoir autre chose.
- Contrôle avant l'envoi : `gc_animation.apercu(fichier.html, image.png, etape=n, instant=s)` fige
  une étape et la photographie (Chrome sans fenêtre) ; regarder **chaque étape, vers sa fin**
  (étiquettes qui se chevauchent, texte qui sort de la scène). Le fichier s'ouvre aussi seul dans
  un navigateur, avec ses boutons et les flèches du clavier.
- Règles : le code ne charge **rien du réseau** (le tableau le bloque) ; 300 000 caractères au
  plus ; légende de deux lignes au plus (environ 150 caractères), mots clés en `<b>` ; étiquettes
  de la scène en taille 24 au moins (hors vignettes d'un récapitulatif) ; une étape de bilan avec `bilan=True` (rouge) ; 5 à 11
  secondes par étape, la scène reste sur sa dernière image.

**Les scènes riches** (21/11/2026 : 3D, photos, graphiques ; exemple complet :
`exemples/patient3d_scene.py`, la patiente de l'hôpital virtuel en 3D, symptômes zoomés, frottis
animé). Une animation peut aussi :

- **demander une bibliothèque** : `assembler(..., bibliotheques=['three'])` (three.js : 3D, modèles
  GLB, rotation au doigt) ou `['chart']` (Chart.js). Le tableau l'injecte à l'ouverture : le code
  reste petit (la démonstration fait 24 000 caractères) et rien ne vient du réseau ;
- **recevoir des fichiers lourds** (modèle 3D GLB, photo de lame, son ; 8 Mo au plus chacun) :
  `gc_envoi.py fichier <chemin>` les envoie, `e.animation(code, fichiers={'patient.glb': chemin_stockage})`
  les joint, la scène les lit par `await gcAsset('patient.glb')` → `{ buffer, blob, url }` (l'`url`
  sert directement dans `<image href>` du SVG) ;
- **se manipuler en classe** : `interactif=True` (faire tourner le modèle au doigt ; on n'écrit plus
  par-dessus au stylet).

La banque `scene3d` (`banques=['scene3d']`, avec `bibliotheques=['three']`) pose la 3D sous les
étiquettes SVG : `S3D.create()`, `load(nom)` (GLB compressé meshopt, comme ceux de l'hôpital),
`fit(objet)` → boîte, `box.at(fx, fy, fz)` (un point du modèle en fractions : tête ≈ `.5, .93, .5`),
`view(t, [{t, pos, target}…])` (caméra en images-clés ; libre après la dernière), `pose(modèle, clip, t)`,
`toStage(point)` (point 3D → coordonnées SVG : une étiquette qui suit le modèle), `glow`, `spot`.
Une étape 3D a `update(t)` (caméra, pose), `draw(t)` (étiquettes) et `live: true` (redessinée à chaque
image). Tout dépend de `t` : l'étape se rejoue et se photographie à l'identique.
Aperçu : `apercu(html, png, etape=n, instant=s, fichiers={'patient.glb': chemin_local}, attente=25000)`
(3D rendue sans carte graphique, lente : laisser `attente`). Une image prise avant le démarrage
de la scène est refaite toute seule (trois essais) ; après trois échecs, `AnimationRefusee` : la scène
ne démarre pas (fichier joint absent de `fichiers`, erreur de script). Bibliothèques locales : `npm run scene-libs`.

Pièges vérifiés dans l'application :

- une flèche accrochée à un objet ne suit pas un objet **déplacé par un bouton** ;
- les boutons ne réagissent qu'avec l'outil de sélection (pas avec le stylo) ;
- un libellé de bouton est en gras : compter 15 % plus large que le texte courant (`ecrire()`
  alerte quand il passerait sur deux lignes) ;
- sans espaces insécables, le tableau coupe « 130 000 / 000 » et laisse un « ? » seul en début de
  ligne : `ecrire()` les pose tout seul (nombres, unités, « : ; ! ? », guillemets, « − 400 ») —
  écrire des espaces ordinaires, ne pas taper `&nbsp;` ;
- des cartes déplacées par un bouton dans un cadre : leur largeur + la position d'arrivée doit
  rester dans le cadre (marges intérieures du texte comprises, environ 11 de chaque côté).

Règles :

- **Une idée par écran**, des phrases courtes. Un texte courant ne descend pas sous la taille 22.
- **Le bilan en rouge**, titre compris (le gabarit le fait).
- Lire les **alertes** qu'affiche `ecrire()` : elles disent quel écran raccourcir ou couper.
- Puis `npm run screens:check`, et seulement ensuite `gc_envoi.py ecrans <id du cours> <fichier>`.
- Les hauteurs sont **estimées**, en comptant large (mesuré le 15/11/2026 sur 114 textes : 102
  justes, 11 comptés trop hauts, 1 trop bas, une ligne de chiffres). Si le navigateur intégré est
  disponible, ouvrir le cours en mode « En classe » et regarder chaque écran ; sinon le dire à
  Thomas. Ne jamais faire ce contrôle sur un cours placé pour une classe : la page affichée y est
  gardée en base.
