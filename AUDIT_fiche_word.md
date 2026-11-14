# Audit — Atteindre la qualité des fiches Word dans l'éditeur de cours

*14/11/2026. Référence : `Fiche_eleve_S1A2_Microbiote.docx` (3e, séquence 1, activité 2), une page A4.*

But : que Thomas abandonne Word et que Claude rédige les cours directement dans Gestion Classe,
au niveau visuel des fiches actuelles.

## 1. Ce qui fait la qualité de la fiche

La fiche tient sur une page. Elle se lit de haut en bas en quatre temps : qui je suis (ligne
d'identité), de quoi il s'agit (cartouche), ce qu'il faut savoir (situation, rappel), ce qu'il faut
faire (questions, bonus, auto-évaluation). Les couleurs servent à repérer les zones, jamais à décorer.

Mesures relevées dans le XML :

- **Page** : A4, marges de 1,5 cm en haut et en bas, 2 cm à gauche et à droite ; le cartouche
  déborde un peu (17,7 cm de large).
- **Police** : Arial 11 pt pour le texte ; 8 à 10 pt dans le cartouche ; interligne 1,15 à 1,3.
- **Couleurs** :
  - bleu nuit `#1F4E79` (bandeau de séquence) ;
  - gris `#F2F2F2` (durée, modalité) ;
  - rose `#FBE5E5` (problématique) ;
  - bleu pâle `#EAF1F9` (objectifs) ;
  - jaune `#FFF8DC` bordé `#B8860B` (rappel) ;
  - violet `#F2EBF7` bordé `#7030A0` (bonus) ;
  - vert `#EAF3E0` bordé `#548235` (réussite) ;
  - titre « Questions » en bleu `#2E75B6`, 13 pt.

## 2. Élément par élément

Légende :

- ✅ **Faisable** : l'éditeur le fait déjà, tel quel.
- ⚙️ **Réglage** : faisable, mais à la main, élément par élément (ou seulement en JSON).
- ❌ **Absent** : l'éditeur ne sait pas le faire.

La colonne « Après » indique le lot de ce chantier qui comble l'écart.

| # | Élément de la fiche | Avant | Comment dans l'éditeur | Après |
|---|---|---|---|---|
| 1 | Ligne « Nom / Prénom / Classe / Date » en gris 10 pt, pointillés de longueur fixe | ✅ | Pointillés `dots` de longueur réglable (cm), couleur et taille du texte | Bloc « Cartouche d'activité » (Q2) |
| 2 | Cartouche en tableau à 5 colonnes, fusions verticales (bandeau sur 6 lignes) et horizontales | ⚙️ | Le tableau gère `rowspan` et `colspan` (bouton Fusionner), mais il faut tout construire à la main | Bloc « Cartouche d'activité » prêt à insérer (Q2) |
| 3 | Bandeau de séquence bleu nuit, texte blanc centré verticalement | ⚙️ | Fond de cellule par la roue de couleurs (la palette n'a que des teintes claires), texte blanc, alignement vertical | Q2 |
| 4 | Titre de l'activité en gras 12 pt centré, niveau « 3ᵉ » avec exposant | ✅ | Gras, taille, centrage, exposant (Ctrl+.) | — |
| 5 | Note « /20 » et « Commentaire » | ✅ | Cellules ordinaires ; le barème calculé (`pointsTotal`) existe aussi | — |
| 6 | Compétences en couleur (bleu, rouge) avec cercles ○ ○ ○ ○ | ✅ | Couleur du texte, symbole ○ (Insertion › Symbole) | Q2 |
| 7 | Ligne « Durée · Modalité · Matériel · Méthodes » avec émojis, fond gris | ✅ | Émojis tapés ou collés ; ou icônes Lucide (Insertion › Icône) | Q2 |
| 8 | Problématique sur fond rose, question en italique | ✅ | Fond de cellule, italique | Q2 |
| 9 | Objectifs « 🎯 À la fin de cette activité… » en liste à puces sur fond bleu pâle | ✅ | Liste à puces dans une cellule | Q2 |
| 10 | « Situation de départ : » en gras suivi du texte | ✅ | Paragraphe | — |
| 11 | Encadré « 💡 Rappel » : fond jaune, **cadre fin sur les quatre côtés**, texte brun | ❌ | L'encadré libre n'a qu'une **barre épaisse à gauche** et un titre en PETITES MAJUSCULES | Bordure « Cadre » et titre « Gras » (Q1) |
| 12 | Titre de partie « Questions » bleu 13 pt | ⚙️ | Titre 2 du thème (21 px, indigo) : couleur et taille à forcer sur le texte | Écart restant (voir § 4) |
| 13 | Questions « **1.** … » numérotées en gras, verbes de consigne en gras, interligne 1,3 | ✅ | Gras, interligne réglable, espace avant et après | — |
| 14 | Encadré « ★ Pour aller plus loin » violet, titre en gras de la taille du texte | ❌ | Même limite que le n° 11 | Q1 |
| 15 | Encadré « ✅ J'ai réussi l'activité si je peux » vert, **collé** au précédent | ❌ | Les encadrés sont toujours espacés de 12 px | Q1 (deux encadrés « Cadre » qui se suivent se collent) |
| 16 | Cases ☐ à cocher dans la liste de réussite | ✅ | Liste de cases à cocher (`taskList`), ou symbole ☐ | — |
| 17 | Texte en Arial 11 pt partout | ⚙️ | Il faut tout sélectionner et changer police et taille ; chaque nouveau paragraphe repart en Atkinson 12 pt | Police et taille **du cours** dans Mise en page (Q1) |
| 18 | Marges de 1,5 cm et 2 cm, la fiche tient sur une page | ❌ | Marges fixes de 2,5 cm (décision du 13/11/2026, T9b abandonné) | Écart restant (voir § 4) |
| 19 | Pas de numéro de page sur une fiche d'une page | ✅ | « Rien sur la première page » (En-tête et pied) | — |
| 20 | Fiche réutilisable d'une activité à l'autre | ⚙️ | Modèles personnels (T6), mais aucun modèle « fiche SVT » | Modèle « Fiche d'activité avec cartouche » (Q2) |

## 3. Les lots

- **Q1 — Encadrés et texte du cours façon fiche Word.**
  - Bordure d'encadré au choix (Barre, Cadre, Fond seul) et allure du titre (Étiquette ou Gras),
    dans l'onglet Encadré.
  - Deux encadrés « Cadre » qui se suivent se collent.
  - Police et taille du texte de tout le cours dans Mise en page › Texte du cours ; les menus
    Police et Taille de l'Accueil en tiennent compte.
- **Q2 — Cartouche d'activité et modèle de fiche.**
  - Bloc « Cartouche d'activité » (Insertion › Blocs) : le cartouche de Thomas, prêt à remplir.
  - Modèle « Fiche d'activité avec cartouche » : cartouche, situation de départ, rappel, questions,
    bonus, « J'ai réussi ».
- **Q3 — Claude écrit les cours dans l'app** : voir § 5.

## 4. Écarts restants

*Après les lots Q1 et Q2 ; mesurés sur la fiche Microbiote reconstruite (captures avant / après).*

| # | Écart | Effet visible | Piste |
|---|---|---|---|
| 1 | **Marges fixes de 2,5 cm**, contre 1,5 cm et 2 cm dans Word | La fiche Microbiote (370 mots) passe sur **deux pages** : l'encadré « J'ai réussi » (209 px) ne tient pas dans les 134 px restants. Il manque environ 2,4 cm | **Décision maintenue (Thomas, 14/11/2026)** : la projection en classe (bande de la largeur de colonne, PR #71) exige la colonne de 16 cm ; le lot Q4 « marges étroites » (PR #70) est fermé. Pour tenir sur une page : texte du cours en 10 ou 10,5 pt (Mise en page › Texte du cours), interligne 1,0 et espacements serrés, ou fiche de 300 mots environ au plus |
| 2 | Colonne de 16 cm au lieu de 17,7 cm | Le cartouche est plus serré, les cellules étroites passent à la ligne (« (questions 2 et 3) ») | Conséquence du n° 1, acceptée |
| 3 | Un encadré ou une ligne de tableau ne se coupe pas entre deux pages | Un grand blanc en bas de page quand un encadré passe à la page suivante | T15 (pagination fine), prévu après le lot 4 |
| 4 | Taille des titres fixe (Titre 2 : 21 px, Word : 13 pt) | « Questions » un peu plus grand que dans Word | Une taille de titres par thème, si Thomas le juge utile |
| 5 | Images : Claude ne peut pas envoyer de fichier dans le stockage | Les documents (photos, schémas) sont à insérer à la main avec le bouton Image | Hors de portée du connecteur ; un emplacement « [Image : …] » est laissé à la place |
| 6 | Le nombre de pages ne se calcule qu'à l'affichage | `course:check` ne peut pas dire si la fiche tient sur une page | Vérifier dans le navigateur, ou demander à Thomas |
| 7 | Émojis du cartouche (⏱ 👥 🔧 📖) | Leur dessin dépend du système (Windows, Android, imprimante) | Icônes Lucide (`Icone(...)`) si le rendu imprimé déçoit |
| 8 | Impression papier non vérifiée | Nouveaux encadrés, thème Fiche et fonds de cellules à contrôler sur papier | À faire par Thomas sur une vraie imprimante |

## 5. Faire écrire Claude directement dans l'app

**Voie retenue (Thomas, 14/11/2026) : insertion directe.** Claude crée le cours en base, sans
copier-coller.

| Pièce | Rôle |
|---|---|
| Skill `.claude/skills/cours-gestion-classe/` | Décrit la méthode, les blocs, les habitudes des fiches de Thomas et les règles de sûreté ; disponible dans toute session Claude Code ouverte sur le dépôt |
| `gc_cours.py` (dans la skill) | Bibliothèque Python : une fiche s'écrit en quelques lignes (`Cartouche(...)`, `Question(...)`, `JaiReussi(...)`), sans JSON TipTap à la main |
| `exemples/microbiote.py` | La fiche Microbiote complète : l'exemple de référence |
| `npm run course:check` | Vérifie chaque brouillon de `course-drafts/` contre le **schéma réel** de l'éditeur, plus les réglages, couleurs, icônes et fusions de tableaux ; écrit le rapport et la requête `INSERT` |
| Garde-fou dans l'éditeur | Un cours que l'éditeur ne sait pas lire s'ouvre en lecture seule, avec un message, et **n'est jamais enregistré** (TipTap l'aurait ouvert vide et l'enregistrement automatique l'aurait écrasé) |

Compromis acceptés :

- Il faut une session Claude qui a le dépôt (pour la vérification) et le connecteur Supabase.
- L'écriture se fait avec les droits d'administration : la skill limite Claude à **créer** des cours,
  et à n'en modifier un qu'à la demande, après en avoir gardé une version.

Pour plus tard, si Thomas veut rédiger depuis son téléphone, la voie B (bouton « Coller un cours
rédigé par Claude » dans l'éditeur) réutiliserait le même vérificateur.
