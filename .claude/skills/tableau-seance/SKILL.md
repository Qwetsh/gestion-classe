---
name: tableau-seance
description: Fabrique le tableau d'une heure de cours pour Thomas (prof de SVT au collège) dans Gestion Classe, pensé comme un petit site propre à la séance — sommaire, écrans interactifs, animations de qualité (niveau « anticorps »), scènes 3D, photos animées, graphiques, intégration de ses sites (hôpital virtuel : présentation du patient, correction de Docteur Morel). Claude PROPOSE tout cela, puis ne fabrique qu'après validation, et ne code jamais une animation ou une scène 3D sans l'accord explicite de Thomas. À utiliser dès que Thomas dit « crée-moi le tableau de l'heure de jeudi 10 h avec la 4C », « le tableau pour mes 3e lundi », « durant la séance prochaine avec la 4C je fais l'activité 3 de la séquence 2, crée le tableau », « fais-moi le tableau de la correction de… », « prépare les écrans de l'activité… », ou demande un tableau, des écrans, un support TBI, une correction animée. Aussi pour noter son retour après une séance jouée avec un tableau (« la séance s'est bien passée, mais… »).
---

# Le tableau d'une séance : un petit site par heure de cours

Thomas dit une phrase : « le tableau de l'heure x avec la classe y ». Claude retrouve le cours et
l'activité, puis **propose** un tableau qui exploite tout ce que l'app sait faire : un mini-site
adapté à cette séance, avec ce que Thomas n'aurait pas fait seul en dix minutes. Il **attend sa
validation** avant de fabriquer, et **ne code aucune animation ni scène riche sans un accord
explicite, numéro par numéro** (règle de Thomas, 21/11/2026).

Outils (les lire avant la première utilisation) :

- skill `cours-gestion-classe` : `gc_ecrans.py` (écrans, sites pilotables), `gc_animation.py`
  (animations et scènes riches : 3D, photos, graphiques), `gc_envoi.py` (envoi), `gc_cours.py` (fiche) ;
- skill `prepare-semaine` : `gc_semaine.py` (trouver le cours, y poser le document) ;
- ce dossier : `plus-value.md` (quel enrichissement pour quel moment, ressources disponibles) et
  `banque.md` (scènes et dessins déjà faits, à réutiliser).

## 0. Relire ce que l'on sait (toujours, avant tout)

La connaissance de Thomas est **hors du dépôt** (le dépôt est public) :
`C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\`

1. `profil.md` : sa façon d'enseigner, ses rituels, ce qu'il attend d'un tableau.
2. `gouts-tableaux.md` : ce qui lui a plu ou déplu. **Toute règle confirmée s'applique.**
3. `progression/<année>-<niveau>.md`, à l'activité visée : problématique, prérequis, notions,
   déroulé, bilan, vigilances, pistes pour le tableau.
4. `journal-seances.md` : les retours récents, surtout pour la même classe ou la même séquence.
5. `svt-cycle4.md` : le programme et les idées fausses des élèves sur la notion.
6. `projet-assistant/` : `LISEZMOI.md`, `consignes-pedagogiques.md`, `regles-permanentes.md`,
   comme le dit la skill `cours-gestion-classe` § 0 (exigences pédagogiques et scientifiques,
   ordre de priorité ; une contradiction se signale à Thomas).

Puis `plus-value.md` et `banque.md` (ce dossier-ci).

## 1. Comprendre la demande

- **Le cours** : `gc_semaine.py agenda --classes <classe>` → le cours de l'heure nommée (« jeudi
  10 h »), sinon le prochain cours de la classe. Le dire dans la proposition (classe, jour, heure).
- **L'activité** : celle déjà posée sur ce cours (`agenda` l'affiche), sinon la suivante dans la
  progression de la classe (`progression/…` et `journal-seances.md` : où en est-elle ?). Si deux
  activités sont possibles, ou si on ne sait pas s'il veut l'**activité** ou sa **correction**,
  poser la question en une ligne, avec la proposition la plus probable en premier.
- **Les sources, dans OneDrive** : `C:\Users\Utilisateur\OneDrive\Documents\Ecole\<année>\<n>ème\Séquence …\Activité …`.
  Lire, dans cet ordre :
  1. la **fiche de préparation** (déroulé minuté, prérequis, vigilances, bilan dicté) : c'est le
     scénario du tableau ;
  2. la fiche élève et le corrigé (`_CORRIGE`) : les questions et les réponses ;
  3. les documents, les images de `_ressources/`, le cahier de texte, la feuille de bilans corrigée.
  Ignorer `_ADAPTE`, `_archive*`, `_backup`.
- **Dans l'app** : `gc_semaine.py bibliotheque --niveau <n> --cherche <mot>`. Si l'activité a déjà
  un original (avec ou sans écrans), partir de lui ; ne jamais le modifier sans demande.
- **Ses sites** : l'activité a-t-elle un pendant dans l'hôpital virtuel (patient de la séquence 2
  de 3e), dans « Terre en mouvement », ou une page existante ? (`plus-value.md`, « Ressources ».)

## 2. Proposer le mini-site (et s'arrêter là)

Une proposition courte, lisible en deux minutes, **avant toute fabrication**. Elle contient :

1. **En tête** : le cours visé (classe, jour, heure), l'activité ou la correction, la durée, le
   nombre d'écrans, et s'il y a un **sommaire** (utile dès 6 écrans ou pour une correction : aller
   directement à la question 3).
2. **Le déroulé, un écran par ligne**, dans l'ordre de la préparation (environ un écran par 4 à 6
   minutes, davantage pour une correction). Pour chaque écran : le moment (minutage), ce que la
   classe voit, **la plus-value** (ce que l'écran fait que le papier ne fait pas), et son **type** :

   | Type | Ce que c'est | Fabriqué quand |
   |---|---|---|
   | 🟢 **Écran** | gabarits et interactions de `gc_ecrans` : titre sous rideau, consigne et minuteur, document en grand, réponse sous cache, vrai / faux, QCM, schéma qu'on légende, loupe, tableau à compléter, bilan à trous en rouge | dès que le déroulé est accepté |
   | 🟠 **Animation** | une scène dessinée et animée sur mesure (`gc_animation`, niveau `exemples/anticorps-animation-reference.html`) | **seulement sur accord explicite à son numéro** |
   | 🟠 **Scène riche** | 3D qu'on fait tourner (modèle GLB : patients et animaux de l'hôpital…), photo animée (lame qui se rapproche, cellules entourées une à une), graphique qui se trace, simulation à curseur | **seulement sur accord explicite à son numéro** |
   | 🔵 **Site intégré** | une page qui existe déjà, posée sur l'écran et pilotée par le tableau : hôpital (`?presentation=`, `?correction=`), autre site de Thomas, page web | dès que le déroulé est accepté (aucun code) |
   | 🟣 **À construire** | ce qui manque à un de ses sites ou à l'app (une page de l'hôpital, une fonction du tableau) | jamais dans la foulée : chantier à part, proposé à Thomas |

3. **Pour chaque 🟠, un storyboard** de 3 à 8 lignes : les étapes (titre, ce qu'on voit bouger,
   légende de deux lignes au plus), la durée, les fichiers nécessaires (quel modèle 3D, quelle
   photo) et ce qui pourrait décevoir (ex. « le modèle n'a pas d'organes visibles : on montre
   l'extérieur et on zoome »). Si plusieurs idées se valent pour le moment clé, proposer **deux
   variantes** (A / B) et dire laquelle Claude choisirait.
4. **Ce que Claude ne propose pas, et pourquoi**, en une ligne si c'est utile (« pas d'animation
   pour la consigne : un écran suffit »). Viser le spectacle aux **moments qui font comprendre**
   (situation, mécanisme, correction), pas partout.
5. **La question** : « Je fabrique les 🟢 et 🔵 ; quelles animations (🟠) veux-tu ? » — en
   rappelant leurs numéros.

Puis **s'arrêter et attendre la réponse**.

## 3. La validation : ce qui peut être fabriqué

- **Rien n'est fabriqué avant la réponse de Thomas** à la proposition.
- Un accord sur le déroulé (« ok », « vas-y », « go ») vaut pour les 🟢 et les 🔵, **pas pour les
  🟠** : une animation ou une scène riche ne se code que si Thomas l'accepte **nommément** (« ok
  pour la 5 », « les deux animations », « fais la 3D du patient »). Dans le doute, demander.
- Une 🟠 refusée ou sans réponse : l'écran devient un 🟢 équivalent (ou disparaît, s'il ne sert
  plus), et l'idée est rappelée dans le compte rendu (« proposée, non faite »).
- Une 🟠 acceptée **avec des corrections** (« oui mais sans les virus ») : appliquer les
  corrections au storyboard ; s'il change beaucoup, le remontrer avant de coder.
- Les corrections de Thomas qui valent pour la suite vont dans `gouts-tableaux.md`, avec la date.
- La validation par lot du 15/11/2026 (« enchaîne » pour la mise en bibliothèque) ne couvre pas les
  🟠 : même dans un lot, une animation se valide une par une.
- Un modèle 3D à **générer** (Meshy) coûte des crédits : jamais sans accord sur le coût. Un
  🟣 n'est jamais commencé dans la foulée.

## 4. Fabriquer ce qui est validé

- **🟢 Écrans** : `gc_ecrans.py` (skill `cours-gestion-classe`, § 7) — gabarits de base, gabarits
  interactifs (`etapes`, `schema`, `vrai_faux`, `qcm`, `loupe`, `sommaire`), primitives et actions.
  Exemple complet : `cours-gestion-classe/exemples/interactifs_4e.py`.
- **🟠 Animation** : `gc_animation` (« Les animations ») au niveau de
  `_Claude/exemples/anticorps-animation-reference.html` ; réutiliser `banque.md` avant de dessiner.
  Un nouveau thème de dessins = une nouvelle banque (`animation/banque/<thème>.js`), notée dans
  `banque.md`.
- **🟠 Scène riche** : `gc_animation` (« Les scènes riches ») — `bibliotheques=['three']` et la banque
  `scene3d` pour la 3D, `['chart']` pour un graphique, fichiers joints envoyés par
  `gc_envoi.py fichier`. Exemple complet : `cours-gestion-classe/exemples/patient3d_scene.py`
  (patiente de l'hôpital en 3D, symptômes zoomés, frottis animé).
- **Contrôle de chaque 🟠, étape par étape** : `gc_animation.apercu` (3D : `fichiers=…, attente=25000`),
  regarder chaque étape vers sa fin, assembler une planche et l'envoyer à Thomas avec le compte
  rendu (`SendUserFile`).
- **🔵 Site intégré** : `p.site(x, y, w, h, url, etapes=n, boutons=True)` ; pour l'hôpital,
  `gc_ecrans.HOPITAL + '?presentation=<fiche>'` (activité, sans réponses) ou `'?correction=<id>'`.
- Images : celles de `_ressources/` d'abord (`gc_envoi.py image`), sinon une image libre
  (Wikimedia Commons, NASA ; voir `svt-cycle4.md` § 4) avec son crédit en légende.
- **Tout reste retouchable** par Thomas : textes et étapes dans le tableau, légendes des animations
  dans le panneau « Étapes ».

## 5. Vérifier, poser, contrôler

1. `ecrire()` puis `npm run screens:check` : zéro erreur ; corriger les alertes simples.
2. Où poser :
   - l'activité a un cours dans l'app → `gc_envoi.py ecrans <id> <fichier>` sur **l'original** de
     la bibliothèque (`--remplacer` seulement sur demande), puis `gc_semaine.py placer` pour la
     classe ;
   - sinon, créer l'original (fiche via `gc_cours.py` si Thomas la veut, sinon cours minimal),
     y poser les écrans, puis placer.
3. Contrôle au navigateur intégré (serveur de dev ou site déployé, compte de Thomas) : ouvrir le
   cours **original** › Écrans › Essayer, toucher chaque bouton, faire avancer chaque animation et
   chaque site pilotable. Jamais sur une copie placée pour une classe (l'état y est gardé en base).
   Regarder : libellés de boutons sur une ligne, étiquettes qui ne chevauchent rien, texte de
   fenêtre lisible, rien sous le bouton « Suivant », rien à lire sous y = 450.

## 6. Rendre compte

- Le cours visé (classe, date, heure) et le titre du tableau dans l'app.
- Le déroulé final, écran par écran, en une ligne chacun, avec son type.
- La planche des animations et scènes riches.
- Les 🟠 proposées mais non faites, et les 🟣 suggérés (chantiers possibles).
- Ce qui reste à faire à la main, ce qui n'a pas pu être vérifié, les manques de l'app rencontrés.

## 7. Après la séance

Quand Thomas revient (ou à la séance suivante) : poser les trois questions de
`journal-seances.md` s'il n'en dit rien, écrire l'entrée, et remonter dans `gouts-tableaux.md` ce
qui vaut pour la suite. Une remarque qui revient deux fois devient une règle (ici, § 2-3, ou dans
`cours-gestion-classe`), **avec son accord**. Une animation qui a plu entre dans `banque.md`.

## Règles qui ne bougent pas

- **Proposer d'abord, fabriquer ensuite ; aucune animation ni scène riche sans accord explicite à
  son numéro** (Thomas, 21/11/2026).
- Les bilans en rouge (#C00000), titre compris.
- Une idée par écran ; texte courant en taille 22 au moins. Pas la fiche zoomée.
- **Rien à lire en bas de l'écran** (au-delà de y = 450 sur 562,5) : le bureau du prof le cache et
  le fond de la classe le lit mal. Seuls des boutons pour le prof peuvent y aller (19/11/2026).
- Une animation est une vraie scène animée (jamais des images qui glissent au toucher), intégrée au
  tableau.
- Jamais de nom d'élève sur un écran ; jamais d'information PAP/PPRE/PAI à l'écran.
- Ne jamais modifier ni supprimer un original ou une copie placée sans demande explicite.
- Ne jamais écrire dans `profil.md` ou `gouts-tableaux.md` une préférence que Thomas n'a pas
  exprimée : une hypothèse va dans la section « À vérifier avec toi ».
