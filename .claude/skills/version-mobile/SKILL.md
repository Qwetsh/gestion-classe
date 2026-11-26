---
name: version-mobile
description: Fabrique la version mobile « sur mesure » d'un document de Gestion Classe (fiche d'activité, documents, protocole, fiche méthode, cours) — une page HTML autonome pensée pour le téléphone (mise en page soignée, schémas interactifs, révélations, animations validées) que le QR code « Version couleur » des feuilles imprimées ouvre à la place de la version automatique, sans réimpression. À utiliser quand Thomas demande « fais la version mobile de… », « une version téléphone soignée / animée de la fiche… », « améliore ce que voient les élèves quand ils scannent le QR code », ou veut retirer une version sur mesure.
---

# Version mobile sur mesure

Chaque document imprimé depuis l'éditeur de cours porte un QR code « Version couleur » vers
`/d/<jeton>`. Par défaut, cette page est faite **automatiquement** par l'application (le document
en une colonne). Une **version sur mesure**, facultative, la remplace pour un document : une page
HTML complète, écrite par Claude, déposée dans l'application. Le **même QR code** y mène : les
feuilles déjà imprimées en profitent sans réimpression.

Ce qu'il faut savoir avant de commencer :

- **Un document original par version.** Une copie posée sur l'emploi du temps est ramenée à son
  original au dépôt (le QR code imprimé est celui de l'original).
- **Jamais pour une correction, une copie modèle ni une évaluation** : le serveur refuse (pas de
  QR code pour elles). **Jamais de réponses** dans la version mobile d'une fiche d'activité.
- **Le lien de partage** (cahier de texte) n'est pas concerné : il garde ses vues automatiques
  Téléphone / Pages A4.
- **Elle ne suit pas les retouches du document.** L'éditeur de cours l'indique (barre de titre :
  « Version mobile : sur mesure » ou « plus ancienne que le document »), avec **Garder**,
  **Revenir à l'automatique** et **Voir**.
- **La page est isolée** : cadre `sandbox="allow-scripts"` (origine opaque) et CSP qui coupe le
  réseau. Donc rien du réseau (pas de police Google, pas de CDN, pas d'image en ligne), pas de
  `localStorage`, pas d'`alert()` ni de `confirm()`, pas de `window.open()`, pas de formulaire.
- **Un petit bouton « Version simple »** se pose en bas à droite, par-dessus la page : laisser
  **56 px libres en bas** (le gabarit le fait).
- C'est l'exception, validée par Thomas le 26/11/2026, à la règle « tout support interactif vit
  dans le tableau » (skill `cours-gestion-classe`, § 7).

## 0. Les outils : un checkout à jour de master

Les outils Python sont dans le checkout des outils, `C:\Users\Utilisateur\gc-worktrees\outils-master`
(noté `<checkout>` plus bas), copie de `master` hors OneDrive : `gc_envoi.py` pour le dépôt,
`gc_mobile.py` pour fabriquer et contrôler, `gc_animation.py` pour les animations, tous dans
`<checkout>\.claude\skills\cours-gestion-classe\`, et le gabarit de page dans
`<checkout>\.claude\skills\version-mobile\`.

En début de session, le remettre à jour (cela crée le checkout s'il manque, et réinstalle les
skills du compte) :

```
python -I C:\Users\Utilisateur\gc-worktrees\outils-master\scripts\maj_outils_claude.py
```

Ne jamais changer de branche dans le dépôt principal (`OneDrive\Code\Gestion classe`) pour
produire du contenu, et ne jamais modifier une skill dans `~\.claude\skills` ni dans le checkout :
une skill se modifie dans le dépôt, par une PR.

Le jeton d'import est lu par `gc_envoi.py` dans `~/.gestion-classe/jeton-import.txt` : **ne jamais
lire, afficher ni copier ce fichier**. Lancer Python avec `-I`.

Fichiers de travail (page, images, aperçus) : `gestion-classe-web/course-drafts/mobile/` du
checkout (ignoré par git). Le dépôt est **public** : aucune page, aucune image, aucun nom d'élève
n'y est commité.

## 1. Relire les consignes de Thomas (toujours)

Dans le dossier privé de Thomas, **hors du dépôt** (on les cite par leur chemin, on ne les
recopie jamais) :

- `C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\projet-assistant\LISEZMOI.md` (index et ordre de priorité)
- `C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\projet-assistant\consignes-pedagogiques.md`
- `C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\projet-assistant\regles-permanentes.md`
- `C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\gouts-tableaux.md` (ses goûts pour ce qui s'anime à l'écran)

Une contradiction entre ces fichiers et cette skill se signale à Thomas ; elle ne se tranche pas
en silence.

## 2. Un plan court d'abord (« faire ou proposer »)

Une nouvelle version sur mesure est un **contenu nouveau** : Claude propose d'abord un plan court
et attend le « ok » de Thomas (règle du 22/11/2026, skill `cours-gestion-classe` § 0) :

- les sections, dans l'ordre de la feuille (une idée par section) ;
- ce qui devient interactif (schéma qu'on touche, étapes, vocabulaire à révéler, image à agrandir) ;
- les **animations proposées, numérotées**, chacune avec son **storyboard** de 3 à 8 lignes
  (étapes, ce qui bouge, légende, durée, fichiers nécessaires), comme dans la skill
  `tableau-seance` § 2-3 ;
- ce qui n'est pas proposé, et pourquoi, en une ligne si utile.

Un « ok » vaut pour la page, **pas pour les animations** : une animation ne se code qu'après
l'accord explicite de Thomas **à son numéro** (« storyboard d'abord, une par une »). Sans accord,
la page se fait sans elle (un schéma fixe ou des étapes à la place).

Pour **retirer** une version sur mesure ou la **redéposer** telle quelle, pas de plan : faire,
puis rendre compte.

## 3. Lire le document

Avec le connecteur Supabase, **en lecture seule**, projet `djodkjysovalpufgevrr` :

```sql
select id, title, doc from boards where id = '<id du cours>';
-- une copie posée sur l'emploi du temps : son original
select source_board_id from lesson_boards where board_id = '<id du cours>';
-- le jeton du QR code de l'original (s'il a déjà été imprimé)
select token from board_mobile_links where board_id = '<id de l''original>';
```

Lire le document de l'**original** : c'est lui que le QR code montre. Le texte est dans
`doc.content` (TipTap) ; les images sont des nœuds `image` dont `attrs.path` est un chemin du
bucket privé `board-assets`.

**Les images**, à intégrer en data URI : d'abord les fichiers d'origine s'ils sont sur
l'ordinateur (dossiers de cours de Thomas, `course-drafts/`) ; sinon, par le jeton du QR code :
`gc_envoi.images_du_document(jeton, dossier)` les télécharge (ce que voit qui scanne le QR code).
Pas encore de jeton (document jamais imprimé) : le dépôt en créera un ; demander à Thomas les
fichiers, ou déposer d'abord une page sans image, puis la compléter.

## 4. Concevoir la page en partant du téléphone

Partir de `gabarit.html` (même dossier que cette skill) ; `exemple.html` montre une fiche
d'activité minimale.

- Largeur de référence **390 px** ; rien ne déborde ; images et schémas à `max-width: 100%`.
- Texte **16 px au moins** (17 px dans le gabarit), interligne 1,5, aligné à gauche.
- **Une idée par section** (ou par écran d'étapes) : la situation, un document, une méthode, les
  questions.
- **Couleurs de la charte des fiches** (`gc_cours.py`, reprises dans le gabarit) : bleu nuit
  `#1F4E79`, bleu `#2E75B6`, fond bleu `#EAF1F9`, rappel jaune (`#B8860B`, `#FFF8DC`), violet
  `#7030A0` (pour aller plus loin), vert `#548235` (j'ai réussi).
- **Bilan en rouge `#C00000`, titre compris** (cours, fiche méthode) ; jamais de bilan ni de
  réponse sur une fiche d'activité.
- **Zéro émoji.** Les flèches ◀ ▶ et ↺ sont permises.
- **Fidèle à la feuille** : mêmes numéros de questions et de documents, mêmes verbes de consigne en
  gras ; l'élève passe de l'une à l'autre. Les réponses s'écrivent sur la feuille.
- Boutons de **44 px** de haut au moins ; rien qui ne marche qu'au survol.
- Images en **data URI** (`gc_mobile.image_data_uri(chemin)` : JPEG, 1200 px de large au plus) ;
  schémas de préférence en SVG écrit dans la page ; polices du système (ou une police en data URI,
  si elle vaut son poids). **5 Mo au plus** pour toute la page.
- Pas de lien vers un site, sauf demande : il s'ouvrirait dans le cadre, à la place de la page.

## 5. Les animations (seulement celles que Thomas a validées)

Elles se font comme celles du tableau (skill `cours-gestion-classe` § 7, `gc_animation.py`), puis
s'intègrent à la page :

```python
import sys; sys.path.insert(0, r'<checkout>/.claude/skills/cours-gestion-classe')
import gc_animation, gc_mobile
code = gc_animation.assembler(titre, ETAPES, scene_js, banques=['immunite'])
gc_animation.apercu(...)                     # contrôle de l'animation seule, étape par étape
bloc = gc_mobile.animation(code, titre)      # cadre srcdoc + titre, légende et boutons de la page
```

`gc_mobile.animation` intègre les bibliothèques (three, chart) et les fichiers joints
(`fichiers={'patient.glb': chemin}`) dans le cadre, cache le titre et la légende du lecteur (trop
petits sur un téléphone) et les fait écrire en grand par la page, avec ◀, ↺ Rejouer, Suivant ▶ ;
le script de `gabarit.html` pilote le cadre. Sur un téléphone tenu droit, une scène pensée pour le
tableau (1600 × 760) est petite : préférer, pour une animation faite pour la page, une scène plus
haute (`assembler(..., largeur=900, hauteur=1000, proportion=0.9)`).

## 6. Contrôler avant de déposer

Photographier la page **comme l'application la montre** (cadre isolé, même CSP, 390 px de large),
avec Chrome sans fenêtre, et **regarder les images** :

```python
gc_mobile.apercu('page.html', 'ecran.png')                 # premier écran, 390 x 844
gc_mobile.apercu('page.html', 'page.png', hauteur=3200)    # toute la page
```

(Commande sous-jacente : `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new
--screenshot=… --window-size=…` ; la fenêtre fait au moins 500 px, la bande grise à droite n'est
pas la page.) Vérifier : rien ne déborde, le texte est lisible, les boutons tiennent, une image ou
un script manquant (venu du réseau) se voit. Pour une révélation ou des étapes, ouvrir aussi la
page dans le navigateur intégré, à 390 px, et toucher les boutons.

## 7. Déposer

```
python -I gc_envoi.py mobile <id du cours> <page.html>
```

ou `gc_envoi.envoyer_mobile(id, 'page.html')`. Le serveur vérifie : cours de Thomas, copie
ramenée à l'original, document qui a un QR code (jamais une correction ni une évaluation), 5 Mo au
plus, page autonome. Un refus « La page charge quelque chose hors d'elle-même » cite l'endroit
repéré : `src`/`href` en http(s) ou relatif (hors liens `<a>`), `url(http…)`, `@import`,
`fetch("https://…")`, `<iframe src>`, `<object>`, `<base>`… Un nouveau dépôt **remplace** le
précédent.

## 8. Rendre compte à Thomas

- L'adresse, affichée par `gc_envoi.py` : `https://qwetsh.github.io/gestion-classe/d/<jeton>`
  (ou lue avec le connecteur : `select token from board_mobile_links where board_id = '<original>'`).
  Le dépôt crée le lien du QR code s'il n'existait pas encore.
- Ce qui est interactif, les animations faites et celles proposées mais non faites.
- **Prévenir** : la version sur mesure ne suit pas les retouches du document ; après une
  modification, l'éditeur affiche « plus ancienne que le document » (Garder, Revenir à
  l'automatique, Voir). Pour la mettre à jour : redemander une version, qui remplacera l'ancienne.

## 9. Retirer

Sur demande de Thomas seulement : `python -I gc_envoi.py mobile <id du cours> --retirer` (ou le
bouton « Revenir à l'automatique » de l'éditeur). Le QR code sert de nouveau la version automatique.
