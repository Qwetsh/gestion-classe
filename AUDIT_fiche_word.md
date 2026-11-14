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

*(complété après la démonstration)*

## 5. Faire écrire Claude directement dans l'app

*(complété après le choix de Thomas)*
