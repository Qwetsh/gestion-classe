# Audit — Ce qui manque à l'éditeur de cours face à Word, Writer et Canva

> 12/11/2026 — audit sur lecture du code (`gestion-classe-web/src/components/course/`,
> `src/lib/course/`, `package.json`, `PLAN_cours_editeur.md`). Rien n'est codé, rien n'a été
> testé dans le navigateur : les comportements marqués « à vérifier » sont déduits du code.
> Existence, version et licence des paquets cités : vérifiées sur le registre npm le 12/11/2026.
> Les lots 3 à 6 de `PLAN_cours_editeur.md` (mode Tableau, mode En classe, animations,
> finitions) ne sont pas re-planifiés ici ; chaque point qui s'y raccroche le dit.

**Légende.** Colonnes Word / Writer / Canva : oui, part. (partiel), non. Intérêt pour un
enseignant de collège : Fort, Moyen, Faible, Hors sujet. Effort : S = quelques heures,
M = 1 à 2 jours, L = plusieurs jours, XL = chantier. La colonne « Piste technique » se termine
par le lot proposé (T0 à T17, § 5) ou par le lot déjà prévu (lot 3 à 6).

---

## 1. Résumé

L'éditeur a déjà le squelette d'un traitement de texte (feuilles A4, ruban, styles, images, tableaux, enregistrement automatique). Les cinq manques les plus gênants au quotidien :

1. **Les caractères de tous les jours** : ni exposant ni indice (m², CO₂), ni symboles (→, ≈, °), ni guillemets français automatiques ; la touche Tab fait sans doute sortir le curseur de la feuille.
2. **Le paragraphe** : pas d'interligne, d'espacement, de retrait hors des listes, de titres numérotés tout seuls, ni de cases à cocher.
3. **Les tableaux et les blocs longs** : tableau toujours 3 × 3, sans couleur de fond ni bordures réglables ; une liste, un tableau ou un encadré ne se coupe jamais entre deux pages.
4. **Reprendre l'existant** : collage depuis Word ou le web hasardeux (polices importées, images perdues), ni import ni export Word.
5. **Mise en page et filet de sécurité** : pas d'en-tête ni de pied de page, marges fixes, pas de rechercher-remplacer, pas d'historique des versions ni de modèles.

Ordre de grandeur : 18 lots, environ 40 à 45 jours de développement en tout. Le socle qui change vraiment le ressenti (T0 à T7) pèse une douzaine de jours et peut se faire avant le lot 3.

---

## 2. Ce que l'éditeur fait déjà (vérifié dans le code)

**Document et pages**
- Un seul flux de texte, réparti sur des feuilles A4 (210 × 297 mm, marges 2,5 cm, colonne de
  16 cm) par des « intercalaires » calculés (`coursePagination.ts`). Un titre n'est jamais
  laissé seul en bas de page. Saut de page manuel (Ctrl+Entrée).
- Numéro de page centré en bas de chaque feuille (`.ce-sheet__num`), imprimé, non réglable.
- Chaque bloc porte un identifiant stable `blockId` (`UniqueID`, licence MIT).

**Caractères** — gras, italique, souligné, barré ; 7 polices (Atkinson Hyperlegible par défaut,
Arial, Verdana, Georgia, Times New Roman, Comic Sans MS, Courier New) ; 15 tailles de 8 à 72 pt ;
6 couleurs de texte ; 4 surligneurs ; « Effacer la mise en forme » (marques et alignement).

**Paragraphe** — 4 alignements ; listes à puces et numérotées, imbriquées par Tab / Maj+Tab ;
les boutons de retrait ne fonctionnent que dans une liste.

**Styles** — Texte du cours, Titre 1 à 3, quatre encadrés (Définition, À retenir, Consigne,
Exemple). La citation existe dans le schéma (Ctrl+Maj+B) mais n'a pas de bouton.

**Insertion**
- Image : bouton, collage, glisser-déposer ; envoyée dans le stockage (JPEG, 1 800 px au plus,
  fond blanc) ; alignée à gauche, au centre ou à droite ; largeur par poignée ou 25 / 50 / 75 / 100 %.
- Tableau 3 × 3 avec ligne d'en-tête ; colonnes redimensionnables à la souris ; ajout et
  suppression de lignes et colonnes ; fusionner / scinder ; bascule de la ligne d'en-tête.
- Lien (adresse saisie dans une boîte du navigateur ; les adresses tapées deviennent des liens),
  trait de séparation, saut de page, encart tableau 16:9, zone d'écriture (Seyès, carreaux,
  lignes, blanc).

**Affichage** — zoom 50 à 200 %, « largeur de page », règle graduée (affichage seul),
« Page X sur Y », nombre de mots.

**Fichier** — enregistrement automatique 1 s après la frappe, Ctrl+S, copie de secours locale,
nouvel essai toutes les 15 s, renommer, imprimer ; « Exporter en PDF » ouvre la fenêtre
d'impression du navigateur.

**Confort** — annuler / rétablir (Ctrl+Z, Ctrl+Y, boutons) ; correcteur orthographique du
navigateur (`spellcheck`, `lang="fr"`) ; menu contextuel du navigateur ; clic dans une marge =
curseur au plus près ; repère de dépôt au glisser ; les boutons du ruban ne volent pas la sélection.

**Raccourcis réellement actifs** (fournis par les extensions installées) : Ctrl+B / I / U,
Ctrl+Maj+S (barré), Ctrl+Maj+H (surligner), Ctrl+Alt+0 / 1 / 2 / 3 (Normal, Titres),
Ctrl+Maj+L / E / R / J (alignements), Ctrl+Maj+7 / 8 (listes), Ctrl+Maj+B (citation),
Maj+Entrée (retour à la ligne), Ctrl+Entrée (saut de page), Tab / Maj+Tab (listes, cellules),
Ctrl+Z / Y, Ctrl+S, Ctrl+P. Saisie automatique façon Markdown : « - » ou « 1. » puis espace
(liste), « # » (titre), « > » (citation), « --- » (trait), `**gras**`, `*italique*`.

**Installé mais pas branché** (aucune dépendance à ajouter pour s'en servir)
- `@tiptap/extension-list` : `TaskList` et `TaskItem` (cases à cocher), attributs `start` et
  `type` des listes numérotées.
- `@tiptap/react/menus` : `BubbleMenu` et `FloatingMenu` (`@floating-ui/dom` présent).
- `@tiptap/extensions` : `CharacterCount`, `Focus`, `Selection`.
- `TextStyleKit` : `BackgroundColor` (actif, sans bouton) et `LineHeight` (désactivé exprès).
- `@tiptap/extension-table` : attribut `align` des cellules, `toggleHeaderColumn`,
  `setCellAttribute`.
- Ailleurs dans l'application : `katex` (équations du tableau blanc, `EquationView.tsx`),
  `lib/boardSpell.ts` (LanguageTool), `mammoth` et `lib/docConvert.ts` (Word → HTML),
  `docx` (`lib/correctionsDocx.ts`), `qrcode`, `lucide-react`, `recharts`, `pdfjs-dist`.

**Fragilités repérées en lisant le code** (à confirmer dans le navigateur, traitées aux lots T0, T5, T6 ou T15)

| # | Constat | Où |
|---|---|---|
| F1 | La touche Tab n'est gérée que dans les listes et les tableaux : dans un paragraphe ordinaire, le navigateur déplace le focus hors de la feuille | aucun raccourci `Tab` dans `courseExtensions.ts` |
| F2 | Le bouton « Coller » ne colle que du texte brut (`clipboard.readText`) et passe ce texte à `insertContent`, qui l'interprète comme du HTML | `CourseEditor.tsx`, `paste()` |
| F3 | Une image collée avec du texte (page web, Word) n'est pas envoyée au stockage : elle reste un lien externe, ou un lien `file:///` cassé ; `allowBase64: true` laisse entrer des images en base64 dans le JSON du cours | `CourseImage`, `handlePaste` |
| F4 | Une liste, un tableau ou un encadré est UN bloc de premier niveau : il part entier à la page suivante et déborde s'il dépasse une page | `computeLayout` |
| F5 | L'impression réelle n'a jamais été testée (§ 8 du plan) | — |
| F6 | `Mod-Enter` est déclaré par `HardBreak` et par `PageBreak` : le saut de page gagne aujourd'hui, mais cela tient à l'ordre des extensions | `courseExtensions.ts` |
| F7 | `.ce-doc ol { list-style: decimal }` écrase le type (a, i…) des listes collées | `course.css` |
| F8 | Un lien ne peut pas être ouvert depuis l'éditeur (`openOnClick: false`, pas de Ctrl+clic) | `courseExtensions.ts` |
| F9 | Une image à fond transparent est aplatie sur blanc : rectangle blanc visible dans un encadré coloré | `lib/boardImport.ts`, `renderImage` |
| F10 | Un collage depuis Word importe probablement la police, la taille et la couleur d'origine (TextStyle lit les styles en ligne) | à vérifier |
| F11 | Deux onglets ou deux ordinateurs ouverts sur le même cours : le dernier enregistrement écrase l'autre sans prévenir | `saveCourseDoc` |

---

## 3. L'audit par famille

### 3.1 Saisie et sélection

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Sélection souris et clavier, double et triple clic, à travers les pages | oui | oui | oui | Fait (natif, flux unique) | Fort | — | — |
| Touche Tab dans un paragraphe | oui | oui | non | Absent : le focus sort de la feuille (F1, à vérifier) | Fort | S | Raccourci `Tab` maison : insère `\t` (la feuille est en `white-space: pre-wrap`, ajouter `tab-size`) ou applique un retrait de première ligne. T0 |
| Typographie française automatique (guillemets « », espace insécable avant : ; ? !, apostrophe courbe, points de suspension, tiret long) | oui | oui | part. | Absent | Fort : c'est le premier écart ressenti en tapant du français | S | `@tiptap/extension-typography` (MIT, 3.33.1) avec `openDoubleQuote` / `closeDoubleQuote` réglés sur « » ; `InputRule` maison pour les insécables. T1 |
| Correction automatique à la frappe (-> en flèche, 1/2, majuscule en début de phrase) | oui | oui | non | Absent | Moyen | S | Typography couvre flèches et fractions ; majuscule : `InputRule` maison. T1 |
| Espace et tiret insécables au clavier (Ctrl+Maj+Espace) | oui | oui | non | Absent | Moyen | S | Raccourci maison. T1 |
| Listes automatiques (« 1. », « - ») | oui | oui | oui | Fait | Moyen | — | — |
| Raccourcis Markdown (#, >, **) | non | non | part. | Fait d'office ; peut surprendre (« # » + espace devient un titre) | Faible | S | Désactivable extension par extension. Question à Thomas (§ 7) |
| Déplacer un paragraphe au clavier (Alt+Maj+flèches) | oui | oui | non | Absent | Moyen | S | Commande maison (échange de deux blocs voisins). Lot 6 (raccourcis) |
| Cliquer-taper dans le blanc de la page | oui | oui | non | Absent | Faible | — | Ne pas faire |
| Mode refrappe, sélection multiple (Ctrl), sélection en colonne (Alt) | oui | oui | non | Absent | Hors sujet | — | — |
| Dictée vocale | oui | non | non | Celle de Windows (Win+H) fonctionne | Faible | — | Rien à faire |

### 3.2 Presse-papiers

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Couper, copier, coller au clavier | oui | oui | oui | Fait (natif) | Fort | — | — |
| Bouton « Coller » | oui | oui | oui | Partiel : texte brut seulement (F2) | Moyen | S | `navigator.clipboard.read()` → `text/html` → `insertContent` ; repli sur le message « utilisez Ctrl+V ». T5 |
| Collage depuis Word / Writer | oui | oui | part. | Partiel : titres, listes, tableaux, gras passent ; police, taille, couleurs d'origine importées (F10) ; images perdues | Fort : c'est ainsi que les anciens cours arriveront | M | `transformPastedHTML` : retirer `font-family`, `font-size`, styles `mso-*`, couleurs de texte noires ; garder gras, italique, couleurs vives ; signaler les images `file:///`. T5 |
| Collage depuis une page web | oui | oui | part. | Partiel : les images restent des liens externes (F3) | Fort | M | Après collage, pour chaque `image` sans `path` : télécharger puis `uploadBoardImage` ; si le site refuse (CORS), message clair. `allowBase64: false`. T5 |
| Collage « texte seul » (Ctrl+Maj+V) | oui | oui | oui | Natif ProseMirror (à vérifier), sans bouton | Moyen | S | Menu sous « Coller » : Adapter au cours (défaut) / Garder la mise en forme / Texte seul. T5 |
| Pastille « options de collage » après coup | oui | non | non | Absent | Faible | M | Ne pas faire : le menu ci-dessus suffit |
| Reproduire la mise en forme (pinceau) | oui | oui | oui | Absent | Moyen | S à M | Extension maison : mémorise les marques et les attributs du bloc, les applique à la sélection suivante. T5 |
| Copier-coller d'un tableau Excel / Calc | oui | oui | part. | Probablement correct (tableau HTML), à vérifier | Moyen | S | À tester ; nettoyer les largeurs. T5 |
| Copier-coller d'un encart | — | — | — | Partiel : la copie partage sa page avec l'original (limite connue, § 8 du plan) | Moyen | S | À la détection d'un `pageId` en double, dupliquer la page (`clonePages`). T5 |
| Copier vers Word (sortie) | — | — | — | Partiel : texte et structure oui, images non (`path` sans `src`) | Faible | S | Ne pas faire tant que l'export Word (T10) n'existe pas |
| Presse-papiers multiple | oui | non | non | Absent (Win+V le fait) | Hors sujet | — | — |

### 3.3 Police et caractères

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Gras, italique, souligné, barré | oui | oui | oui | Fait | Fort | — | — |
| Exposant et indice | oui | oui | oui | Absent | Fort (m², 10³, CO₂, H₂O, 1er, XIXe) | S | `@tiptap/extension-superscript` et `@tiptap/extension-subscript` (MIT, 3.33.1) ; raccourcis Ctrl+Maj+= et Ctrl+=. T1 |
| Famille de police | oui | oui | oui | Partiel : 7 polices | Moyen | S | Ajouter des polices embarquées en woff2 (une police « dys », une cursive scolaire ; licences à vérifier, voir § 7). T1 |
| Taille | oui | oui | oui | Partiel : liste fixe, pas de saisie libre ni de boutons agrandir / réduire | Moyen | S | Champ éditable + boutons A+ / A−. T1 |
| Couleur du texte | oui | oui | oui | Partiel : 6 couleurs fixes | Moyen | S | Palette élargie, `<input type="color">`, couleurs récentes. T1 |
| Surlignage | oui | oui | oui | Partiel : 4 couleurs | Faible | S | Même palette. T1 |
| Changer la casse (Maj+F3) | oui | oui | part. | Absent | Moyen | S | Commande maison sur la sélection. T1 |
| Petites majuscules | oui | oui | non | Absent | Faible | S | Attribut `fontVariant` ajouté à `textStyle`. Pas prioritaire |
| Espacement des caractères | oui | oui | oui | Absent | Faible seul, utile pour l'impression adaptée | S | Réglage global de l'impression adaptée. T13 |
| Soulignements variés (double, pointillé, ondulé, couleur) | oui | oui | non | Absent | Faible | S | Ne pas faire |
| Effets (ombre, contour, dégradé, WordArt, texte courbé) | oui | part. | oui | Absent | Faible | L | Ne pas faire : un titre décoré se fait dans un encart |
| Mot important (style de caractère) | oui | oui | non | Absent | Moyen | S | Marque maison `keyword` (gras + couleur du thème) ; servira aussi au « mot caché ». Lot 5 |
| Police et taille par défaut du document | oui | oui | oui | Absent : Atkinson 12 pt figé | Moyen | M | Réglages du document (thème). T16 |
| Effacer la mise en forme | oui | oui | part. | Fait (marques + alignement) | Moyen | — | Ajouter Ctrl+Espace. Lot 6 |
| Texte masqué, ligatures, OpenType | oui | oui | non | Absent | Hors sujet | — | Le « mot caché » du lot 5 joue ce rôle |

### 3.4 Paragraphe

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Alignement | oui | oui | oui | Fait | Fort | — | — |
| Interligne (1 ; 1,15 ; 1,5 ; 2) | oui | oui | oui | Absent (`LineHeight` désactivé) | Fort (1,5 pour les élèves dys, textes à annoter) | S à M | Attribut de bloc maison `lineHeight` sur `paragraph`, `heading`, `listItem` ; le `LineHeight` de TextStyleKit agit sur des `<span>`, il ne convient pas. T2 |
| Espacement avant / après | oui | oui | part. | Absent (8 px figés dans `course.css`) | Moyen | S | Attributs `spaceBefore` / `spaceAfter`. T2 |
| Retrait gauche / droite | oui | oui | part. | Absent hors listes (boutons grisés) | Moyen | S | Attribut `indent` par crans de 0,63 cm ; mêmes boutons ; Ctrl+M. T2 |
| Retrait de première ligne (alinéa) | oui | oui | non | Absent | Moyen en français, faible ailleurs | S | Attribut `firstLine`. T2 |
| Tabulations à taquets (gauche, centre, droite, décimal) | oui | oui | non | Absent | Faible | L | Ne pas faire : un tableau sans bordures (T4) rend le même service |
| Points de suite, lignes pointillées de réponse | oui | oui | non | Absent | Fort (« Nom : ………… », lignes de réponse) | M | Nœud maison `dots` qui remplit la fin de la ligne, et variante « n lignes pointillées » de la zone d'écriture. T3 |
| Règle interactive (marges, retraits) | oui | oui | non | Partiel : affichage seul | Faible à moyen | L | Poignées liées aux attributs du lot T2 ; pas prioritaire, après T2 et T9 |
| Bordure et trame de paragraphe | oui | oui | non | Partiel : 4 encadrés fixes | Moyen | M | Encadré « libre » : attributs couleur de fond, bordure, titre modifiable sur le nœud `callout`. T3 |
| Césure automatique | oui | oui | non | Absent | Moyen (texte justifié) | S | CSS `hyphens: auto` (la langue `fr` est déjà posée), en réglage du document ; rendu à l'impression à vérifier. T2 |
| Numérotation des lignes | oui | oui | non | Absent | Fort en français (étude de texte), faible ailleurs | M | Décoration maison : compter les lignes rendues (`Range.getClientRects`) et écrire les numéros dans la marge. T14 |
| Veuves et orphelines | oui | oui | non | Sans objet : un paragraphe ne se coupe jamais | — | — | Voir § 4.1 et T15 |
| Paragraphes solidaires | oui | oui | non | Partiel : automatique pour les titres | Moyen | S | Attribut `keepWithNext` lu par `computeLayout`. T15 |
| Saut de page avant un style | oui | oui | non | Absent | Faible | S | Pas prioritaire |
| Lettrine | oui | oui | non | Absent | Faible | S | Ne pas faire |
| Tri de paragraphes, sens du texte | oui | oui | non | Absent | Hors sujet | — | — |

### 3.5 Styles

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Galerie de styles | oui | oui | part. | Partiel : 8 styles (Normal, 3 titres, 4 encadrés) | Fort | S | Ajouter Citation, encadré libre, mot important. Lot 6 (« galerie de styles complète ») |
| Numérotation automatique des titres (I. / 1. / a.) | oui | oui | non | Absent (la galerie montre « 1. Partie » mais rien n'est numéroté) | Fort : tous les cours sont structurés ainsi | S à M | Compteurs CSS (`counter-reset`, `counter-increment`) activés par un réglage du document, 2 ou 3 schémas au choix. T2 |
| Modifier un style (toutes les occurrences d'un coup) | oui | oui | part. | Absent | Moyen | M | Variables CSS par style, rangées dans les réglages du document (`doc.settings.theme`). T16 |
| Thèmes et jeux de styles (couleurs + polices) | oui | part. | oui | Absent | Moyen | M | 4 ou 5 thèmes prêts (Classique bleu, Sobre, Coloré, Noir et blanc photocopie). T16 |
| Créer un style personnel | oui | oui | non | Absent | Faible | L | Ne pas faire : les thèmes suffisent |
| Volet et inspecteur de styles | oui | oui | non | Absent | Hors sujet | — | — |

### 3.6 Listes

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Puces, numéros, imbrication | oui | oui | oui | Fait | Fort | — | — |
| Cases à cocher (liste de tâches) | part. | non | oui | Absent (`TaskList` installé, pas branché) | Fort (QCM, critères de réussite, auto-évaluation) | S | `TaskList` + `TaskItem` de `@tiptap/extension-list` (déjà installé) ; case imprimée vide. T2 |
| Type de numérotation (1, a, A, I, i) | oui | oui | part. | Partiel : attribut `type` lu au collage, écrasé par le CSS (F7) | Moyen (questions 1) a) b)) | S | Bouton de choix + CSS `ol[type]`. T2 |
| Commencer à… / continuer la numérotation | oui | oui | non | Partiel : attribut `start` sans interface | Moyen (exercice interrompu par un document) | S | Deux entrées de menu. T2 |
| Liste à plusieurs niveaux (1. a. i.) | oui | oui | part. | Partiel : 2 niveaux stylés | Moyen | S | CSS du 3e niveau. T2 |
| Puces personnalisées (flèche, tiret, coche) | oui | oui | part. | Absent | Faible à moyen | S | Attribut `bullet` sur `bulletList`. T2 |
| Tri d'une liste | oui | oui | non | Absent | Faible | S | Ne pas faire |

### 3.7 Mise en page

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| En-têtes et pieds de page | oui | oui | part. | Absent | Fort (titre du chapitre, classe, « Nom : … ») | M à L | Zones hors du flux, dessinées dans chaque `.ce-sheet` comme l'est déjà `.ce-sheet__num` ; texte simple + champs ; option « première page différente ». T9 |
| Numérotation des pages | oui | oui | oui | Partiel : numéro centré en bas, toujours imprimé, pas de « 1 / 4 » | Moyen | S | Réglage : masquer, format, position, pas sur la première page. T9 |
| Marges | oui | oui | oui | Absent : 2,5 cm figés dans `coursePage.ts` | Moyen à fort (gagner de la place) | L | Géométrie par document (`doc.settings.page`) au lieu de constantes ; préréglages Normales / Étroites ; voir § 4.3 pour l'effet en classe. T9 |
| Orientation paysage | oui | oui | oui | Absent | Moyen (tableaux larges, frises) | L (avec les marges) | Document entier seulement. T9 |
| Format du papier (A5, A3) | oui | oui | oui | Absent : A4 figé | Moyen (A5 à coller dans le cahier) | M | Préférer « 2 exemplaires par feuille » à l'impression. T13 |
| Colonnes | oui | oui | oui | Absent | Moyen | M | Bloc maison `columns` (2 ou 3 colonnes côte à côte, insécable). Pas de colonnes « journal » qui coulent d'une page à l'autre (§ 4.1). T8 |
| Saut de page | oui | oui | oui | Fait | Fort | — | — |
| Sections (mises en page différentes dans un même document), sauts de section et de colonne | oui | oui | non | Absent | Hors sujet | — | — |
| Filigrane | oui | oui | non | Absent | Faible (« CORRIGÉ ») | S | Texte en fond de `.ce-sheet`, avec la version corrigé. Lot 6 / T13 |
| Couleur, bordure, arrière-plan de page | oui | oui | oui | Absent | Faible (encre) | S | Ne pas faire |
| Page de garde | oui | oui | oui | Absent | Faible | — | Par un modèle. T6 |

### 3.8 Tableaux

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Insérer en choisissant la taille | oui | oui | oui | Partiel : 3 × 3 fixe | Fort | S | Grille de sélection à la souris (8 × 8). T4 |
| Ajouter / supprimer lignes et colonnes, fusionner, scinder | oui | oui | oui | Fait | Fort | — | — |
| Largeur des colonnes | oui | oui | oui | Fait (à la souris) | Fort | — | — |
| Trame de fond des cellules | oui | oui | oui | Absent | Fort | S | Étendre `TableCell` et `TableHeader` avec un attribut `backgroundColor` (procédé documenté par TipTap). T4 |
| Bordures (aucune, toutes, extérieures, épaisseur, couleur) | oui | oui | part. | Absent : gris fixe | Fort (tableau invisible pour aligner, cadre de réponse) | M | Attributs de cellule + préréglages. T4 |
| Styles de tableau (galerie) | oui | oui | oui | Absent | Moyen | S à M | Attribut `tableStyle` → classes CSS (grille, lignes alternées, sans bordures, en-tête coloré). T4 |
| Alignement horizontal dans la cellule | oui | oui | oui | Fait (alignement du paragraphe) | Moyen | — | — |
| Alignement vertical dans la cellule | oui | oui | oui | Absent | Moyen | S | Attribut `verticalAlign`. T4 |
| Hauteur de ligne | oui | oui | oui | Absent | Moyen (cases de réponse hautes) | S à M | Attribut `minHeight` sur `tableRow`. T4 |
| Répartir les colonnes uniformément | oui | oui | non | Absent | Moyen | S | `setCellAttribute('colwidth', …)` sur toutes les cellules. T4 |
| Largeur et position du tableau (étroit, centré) | oui | oui | oui | Absent : toujours 100 % | Moyen | S | Attribut sur `table`. T4 |
| Ligne d'en-tête | oui | oui | part. | Fait | Moyen | — | — |
| Colonne d'en-tête | oui | oui | non | Commande `toggleHeaderColumn` présente, pas de bouton | Moyen | S | Un bouton. T4 |
| Tableau qui se coupe entre deux pages | oui | oui | non | Absent : part entier à la page suivante, déborde au-delà d'une page (F4) | Fort dès qu'un tableau est long | L | Intercalaires entre les lignes du tableau (§ 4.1). T15 |
| Répétition de la ligne d'en-tête sur chaque page | oui | oui | non | Sans objet tant que le tableau ne se coupe pas | Moyen | M | Avec T15 |
| Tab = cellule suivante, nouvelle ligne au bout | oui | oui | oui | Fait | Moyen | — | — |
| Tri, formules, conversion texte ↔ tableau, texte vertical | oui | oui | non | Absent | Faible à hors sujet | — | Ne pas faire |

### 3.9 Images

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Insérer (fichier, collage, glisser-déposer), capture d'écran collée | oui | oui | oui | Fait | Fort | — | — |
| Redimensionner | oui | oui | oui | Fait (une poignée, proportions gardées, 4 tailles rapides) | Fort | — | — |
| Aligner à gauche, au centre, à droite | oui | oui | oui | Fait | Fort | — | — |
| Légende (« Document 1 : … ») | oui | oui | non | Absent | Fort (SVT, histoire-géo, français) | M | Nœud maison `figure` (image + légende éditable), numérotation par compteur CSS. T8 |
| Habillage : texte à côté de l'image | oui | oui | part. | Absent | Fort | M | Bloc « image + texte côte à côte » fondé sur les colonnes (T8). Éviter `float` : il fausse la mesure des pages (§ 4.1) |
| Rognage | oui | oui | oui | Absent | Moyen à fort (captures de manuel) | M | Attribut `crop` non destructif (cadre `overflow: hidden`) + poignées. T8 |
| Rotation, retournement | oui | oui | oui | Absent | Moyen (photos du téléphone) | S | Attribut `rotate` par quarts de tour. T8 |
| Remplacer l'image | oui | oui | oui | Absent | Moyen | S | Bouton de l'onglet Image. T8 |
| Texte alternatif | oui | oui | oui | Attribut `alt` présent, pas d'interface | Faible à moyen | S | Champ dans l'onglet Image. T8 |
| Bordure, coins arrondis, ombre, cadre rond | oui | oui | oui | Absent | Faible à moyen | S | Attribut `frame` → classes CSS. T8 |
| Luminosité, contraste, noir et blanc | oui | oui | oui | Absent | Moyen (rendu à la photocopieuse) | S | Filtres CSS par image ; aperçu noir et blanc global. T13 |
| Compression | oui | oui | oui | Fait à l'envoi (JPEG, 1 800 px) ; la transparence est perdue (F9) | Faible | S | Garder le PNG quand l'image a de la transparence. T8 |
| Petite image dans la ligne de texte | oui | oui | non | Absent (image = bloc) | Moyen | M | Icônes en ligne. T16 |
| Position libre, devant / derrière le texte | oui | oui | oui | Absent | Moyen | — | Calque du mode Tableau. Lot 3 |
| Suppression de l'arrière-plan | oui | non | oui | Absent | Faible | L | `@imgly/background-removal` (licence à vérifier, AGPL de mémoire, modèle lourd à télécharger). Ne pas faire |
| Banque d'images en ligne | oui | non | oui | Absent | Moyen | M à L | Voir 3.29. T16 |

### 3.10 Formes, zones de texte, SmartArt, graphiques, icônes

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Formes, flèches, connecteurs, dessin à main levée | oui | oui | oui | Dans un encart : fait. Par-dessus le texte : absent | Fort | — | Lot 3 (calque ancré) |
| Zone de texte flottante, post-it | oui | oui | oui | Absent sur la feuille | Moyen | — | Lot 3 |
| SmartArt (organigramme, cycle) | oui | non | part. | Absent en propre ; se dessine dans un encart avec les connecteurs | Faible | — | Ne pas faire |
| QR code | non | part. | oui | Absent | Fort (lien vers une vidéo ou un exercice sur une feuille papier) | S à M | `qrcode` (déjà installé) → image générée à partir d'une adresse. T3 |
| Graphique (courbe, histogramme) | oui | oui | oui | Absent | Moyen (SVT, maths) | M à L | Bloc maison : petit tableau de données + `recharts` (déjà installé), rendu SVG imprimable. Pas prioritaire ; d'ici là, coller l'image du tableur |
| Icônes | oui | non | oui | Absent | Moyen | M | `lucide-react` (déjà installé, licence ISC) : nœud en ligne `icon`. T16 |
| Vidéo en ligne | oui | non | oui | Absent | Moyen en classe, nul sur papier | S | `@tiptap/extension-youtube` (MIT) ; à l'impression, la remplacer par son QR code. À rattacher au lot 4 |
| Son | non | non | oui | Absent | Faible à moyen (langues) | S | `@tiptap/extension-audio` (MIT, existence vérifiée, interface non examinée). Lot 4 |
| Modèles 3D, objets incorporés (OLE) | oui | oui | non | Absent | Hors sujet | — | — |

### 3.11 Équations

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Équation dans la ligne ou en bloc | oui | oui | part. | Absent dans le texte (existe dans le tableau blanc : `EquationView.tsx`) | Fort en maths et physique-chimie, moyen en SVT, nul en français | M | `@tiptap/extension-mathematics` (MIT, 3.33.1) : nœuds en ligne et en bloc rendus par `katex` (déjà installé) ; panneau de saisie repris d'`EquationView` (modèles cliquables). T12 |
| Saisie visuelle (sans LaTeX) | oui | part. | non | Absent | Moyen | M | `mathlive` (MIT) en option, à évaluer (poids). T12 |
| Formules chimiques | part. | part. | non | Absent | Moyen | S | `\ce{…}` de KaTeX (déjà utilisé au tableau) ; les indices simples relèvent de T1. T12 |

### 3.12 Symboles et caractères spéciaux

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Insérer un symbole | oui | oui | part. | Absent | Fort (→ ⇒ ≈ ≠ ≤ ≥ × ÷ ± ° µ π α β Δ ♀ ♂ ✓ ✗ ☐, majuscules accentuées É À Ç) | S | Palette maison par familles, derniers utilisés. T1 |
| Émojis | oui | oui | oui | Ceux de Windows (Win+;) fonctionnent | Faible | — | Rien à faire (`@tiptap/extension-emoji`, MIT, existe) |

### 3.13 Liens, signets, renvois

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Lien hypertexte | oui | oui | oui | Partiel : boîte du navigateur (`window.prompt`), impossible à ouvrir (F8) | Moyen | S | Petite fenêtre maison, Ctrl+K, Ctrl+clic pour ouvrir, bulle « ouvrir / modifier / retirer ». T1 |
| Lien automatique à la frappe | oui | oui | oui | Fait | Faible | — | — |
| Signets, liens internes | oui | oui | non | Absent | Faible | M | Le `blockId` servirait d'ancre. Ne pas faire maintenant |
| Renvois (« voir page 3 ») | oui | oui | non | Absent | Hors sujet | — | — |

### 3.14 Table des matières, notes, légendes, index, bibliographie

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Table des matières | oui | oui | part. | Absent | Faible à moyen (cours de 2 à 4 pages) | M | `@tiptap/extension-table-of-contents` (MIT) pour la liste des titres ; numéros de page déduits de `PageLayout.spacers`. Pas prioritaire |
| Notes de bas de page | oui | oui | non | Absent | Moyen (vocabulaire d'un texte en français) | L en bas de page, M sous le texte | En bas de page : il faut réserver la place dans `computeLayout` (§ 4.1). Proposé : notes « sous le texte étudié ». `tiptap-footnotes` (MIT, v4, compatibilité TipTap 3 à vérifier) ou nœud maison. T14 |
| Notes de fin | oui | oui | non | Absent | Faible | M | Avec T14 |
| Légendes numérotées | oui | oui | non | Absent | Fort | M | Voir 3.9. T8 |
| Table des illustrations, index, bibliographie, citations | oui | oui | non | Absent | Hors sujet | — | La source d'un document s'écrit dans sa légende |

### 3.15 Champs

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Numéro de page, nombre de pages | oui | oui | oui | Partiel : numéro seul, figé | Moyen | S | Champs de l'en-tête / pied. T9 |
| Date, titre du cours, classe | oui | oui | non | Absent (la barre de titre connaît déjà la classe et la date du cours) | Moyen | S | Champs de l'en-tête / pied, alimentés par `fetchLessonBoardByBoardId`. T9 |
| Champs dans le corps du texte, champs calculés | oui | oui | non | Absent | Faible | M | Ne pas faire |

### 3.16 Révision

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Orthographe | oui | oui | oui | Fait par le navigateur (soulignement, suggestions au clic droit) | Fort | — | — |
| Grammaire et typographie | oui | oui | part. | Absent | Fort : le document part aux élèves et aux familles | M | Réemployer `lib/boardSpell.ts` (API publique LanguageTool : 20 requêtes par minute, 20 Ko par requête) dans un plugin ProseMirror à décorations, vérification bloc par bloc. T11 |
| Synonymes | oui | oui | non | Absent | Faible | — | Ne pas faire |
| Suivi des modifications | oui | oui | non | Absent | Hors sujet (un seul auteur) | — | Extension TipTap payante ; ne pas faire |
| Commentaires | oui | oui | oui | Absent | Faible à moyen | M | L'extension Comments de TipTap est payante. Alternative utile : un encadré « Note du professeur », jamais imprimé ni projeté. Lot 6 (version élève) |
| Comparaison de documents | oui | oui | non | Absent | Hors sujet | — | Payant chez TipTap ; l'historique (T6) suffit |
| Statistiques (mots) | oui | oui | oui | Fait (mots) ; caractères et sélection absents | Faible | S | `CharacterCount` (déjà installé). Pas prioritaire |
| Langue du texte | oui | oui | part. | `fr` figé | Faible (langues vivantes) | S | Réglage du document. Pas prioritaire |
| Traduction, lecture à voix haute, protection du document | oui | part. | part. | Absent | Hors sujet | — | — |

### 3.17 Recherche et remplacement

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Rechercher (Ctrl+F) | oui | oui | oui | Partiel : la recherche du navigateur trouve le texte, sans plus | Fort | M | `prosemirror-search` (MIT, 1.1.1, module officiel de ProseMirror) + barre maison ; Ctrl+F intercepté. T7 |
| Remplacer, tout remplacer (Ctrl+H) | oui | oui | oui | Absent | Moyen à fort (adapter un cours de 5e pour la 4e, corriger un terme partout) | inclus | Même module. T7 |
| Recherche par mise en forme, caractères génériques | oui | oui | non | Absent | Hors sujet | — | — |

### 3.18 Navigation

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Volet de navigation (liste des titres) | oui | oui | oui | Absent | Moyen à fort dès 4 pages | S à M | Liste des titres lue dans le document, clic = défilement jusqu'au bloc (`blockId`). T7 |
| Réordonner les parties en glissant les titres | oui | oui | non | Absent | Moyen | M | Plus tard, après le volet |
| Page X sur Y | oui | oui | oui | Fait | Moyen | — | — |
| Miniatures des pages | oui | non | oui | Absent | Faible | L | Ne pas faire |
| Mode plan | oui | oui | non | Absent | Hors sujet | — | — |
| Atteindre une page, reprendre où l'on s'était arrêté | oui | oui | non | Absent | Faible | S | Pas prioritaire |

### 3.19 Affichages

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Zoom, largeur de page | oui | oui | oui | Fait (50 à 200 %) | Fort | — | — |
| Zoom à la molette (Ctrl+molette) | oui | oui | oui | Absent : c'est toute l'interface que le navigateur zoome | Moyen | S | Écouter `wheel` avec `ctrlKey` sur le bureau. T7 |
| Page entière | oui | oui | oui | Absent | Moyen | S | Bouton à côté de « Largeur de page ». T7 |
| Plusieurs pages côte à côte | oui | oui | part. | Absent | Moyen (écran 32 pouces) | XL | Incompatible avec le flux unique en une colonne (§ 4.1). Ne pas faire |
| Caractères non imprimables (¶, espaces, tabulations) | oui | oui | non | Absent | Moyen (traquer les lignes vides et doubles espaces) | S | `@tiptap/extension-invisible-characters` (MIT, 3.33.1). T7 |
| Règle | oui | oui | part. | Partiel : horizontale, affichage seul | Faible | — | Voir 3.4 |
| Quadrillage, repères d'alignement | oui | oui | oui | Absent | Moyen | — | Lot 3 |
| Repère « écran de classe » | — | — | — | Absent (prévu au § 3 du plan) | Fort | — | Lot 4 |
| Mode lecture, plein écran, présentation | oui | oui | oui | Absent | Fort | — | Lot 4 (mode En classe) |
| Mode sombre | oui | oui | oui | Absent ; la feuille doit rester blanche | Faible | — | Ne pas faire |
| Deux documents côte à côte, fenêtre fractionnée | oui | oui | non | Absent | Moyen (recopier un ancien cours) | — | Deux onglets du navigateur ; attention à F11 |

### 3.20 Fichiers

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Enregistrement automatique, récupération après coupure | oui | oui | oui | Fait | Fort | — | — |
| Historique des versions | oui | part. | oui | Absent : un mauvais collage enregistré est définitif une fois l'onglet fermé | Fort (filet de sécurité) | M | Table `board_doc_versions` (migration 072) : instantané à l'ouverture, toutes les 10 minutes de travail, avant un import ; volet « Versions » avec restauration. L'extension d'historique de TipTap est payante. T6 |
| Enregistrer sous, dupliquer | oui | oui | oui | Partiel : copie vers une autre classe depuis « Mes tableaux » | Fort | S | « Dupliquer ce cours » dans l'onglet Fichier (duplique aussi les pages d'encarts). T6 |
| Modèles | oui | oui | oui | Absent (question 2 du plan) | Fort | M | Marque « modèle » sur un cours + « Nouveau à partir d'un modèle » ; 5 ou 6 modèles fournis. T6 |
| Garde-fou contre deux ouvertures simultanées | oui | oui | oui | Absent (F11) | Moyen (ordinateur de la maison et du collège) | S à M | Comparer `updated_at` avant d'écrire, avertir en cas d'écart. T6 |
| Importer un .docx | oui | oui | oui | Absent | Fort : reprendre des années de cours | L | `mammoth` (BSD-2, déjà installé ; `docxToHtml` existe dans `lib/docConvert.ts`) → HTML → nettoyage du lot T5 → document ; images envoyées au stockage. Fidélité moyenne : pas de colonnes, de zones de texte, d'en-têtes. L'import de TipTap est payant. T10 |
| Exporter en .docx | oui | oui | oui | Absent | Moyen à fort (collègues, ENT) | L | `docx` (MIT, déjà installé et utilisé par `lib/correctionsDocx.ts`) : convertisseur maison du JSON ; ou `prosemirror-docx` (MIT, 0.6.1, compatibilité à vérifier). L'export de TipTap est payant. T10 |
| .odt | oui | oui | non | Absent | Faible | — | Ne pas faire : Writer ouvre le .docx |
| Exporter en PDF | oui | oui | oui | Partiel : par la fenêtre d'impression | Fort | — | Garder ce chemin : le texte reste net et sélectionnable. Un fichier PDF fabriqué sans la fenêtre (`html2canvas` + `jspdf`) serait une image floue. Ne pas faire |
| Importer un PDF (pages en images) | part. | part. | oui | Absent dans un cours (existe pour le tableau blanc) | Moyen | M | `pdfjs-dist` (déjà installé) : chaque page devient une image du cours. T10 |
| Déposer dans OneDrive / Google Drive | oui | part. | oui | Absent ici (l'onglet « Mes clouds » existe) | Moyen | M | Plus tard, après T10 |
| Export HTML, Markdown, EPUB ; propriétés du document | oui | oui | part. | Absent | Hors sujet | — | — |

### 3.21 Impression

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Imprimer en A4 fidèle | oui | oui | oui | Fait sur le papier… jamais testé avec une vraie imprimante (F5) | Fort | S | Essai réel Chrome, Edge, Firefox. T0 |
| Aperçu, plage de pages, copies, recto verso, plusieurs pages par feuille, livret | oui | oui | part. | Fournis par la fenêtre d'impression du navigateur et le pilote | Fort | — | Rien à coder |
| Deux exemplaires de la même page sur une feuille (A5 à découper) | non | non | non | Absent | Fort : usage quotidien des enseignants | M | Impression par copie figée des feuilles (`cloneNode`) placée deux fois, à l'échelle 0,707, sur une page paysage. T13 |
| Version adaptée (police, taille, interligne) | non | non | non | Absent | Fort (élèves avec PAP) | M | Classe CSS posée avant `relayoutNow` : la pagination se recalcule seule. T13 |
| Noir et blanc, économie d'encre (fonds retirés) | part. | part. | non | Absent | Fort (photocopieuse) | S | Feuille de style d'impression alternative. T13 |
| Version élève / corrigé | non | non | non | Absent | Fort | — | Lot 6 (déjà prévu) |
| Imprimer la sélection ou la page courante | oui | oui | non | Absent (plage de pages du navigateur) | Faible | S | Ne pas faire |

### 3.22 Accessibilité

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Police lisible par défaut, structure en titres | oui | oui | part. | Fait (Atkinson Hyperlegible, vrais titres) | Fort | — | — |
| Texte alternatif des images | oui | oui | oui | Pas d'interface | Faible à moyen | S | T8 |
| Ruban utilisable au clavier (flèches, Alt) | oui | oui | part. | Partiel : touche Tab seulement (à vérifier) ; les boutons ont un libellé | Faible | M | Lot 6 |
| Vérificateur d'accessibilité | oui | oui | part. | Absent | Hors sujet | — | — |
| Documents adaptés aux élèves à besoins particuliers | part. | part. | non | Absent | Fort | M | Impression adaptée. T13 |

### 3.23 Raccourcis clavier

Les raccourcis existants sont listés au § 2. Le lot 6 prévoit déjà « raccourcis » : voici la
liste précise de ce qui manque, à lui confier (sauf mention d'un lot T).

| Raccourci attendu (Word) | Chez nous | Remarque |
|---|---|---|
| Ctrl+K (lien) | Absent | T1 |
| Ctrl+F, Ctrl+H (rechercher, remplacer) | Navigateur (Ctrl+H ouvre l'historique) | T7 |
| Ctrl+= et Ctrl+Maj+= (indice, exposant) | Absent | T1 |
| Ctrl+Maj+> et < (taille), Maj+F3 (casse) | Absent | T1 |
| Ctrl+Espace (effacer la mise en forme) | Absent | Lot 6 |
| Ctrl+1 / 2 / 5 (interligne), Ctrl+M (retrait) | Absent | T2 |
| Ctrl+E / L / R / J (alignements, sans Maj) | Seulement avec Maj | Le navigateur s'en sert (barre d'adresse, recharger, téléchargements) : interception à vérifier, sinon garder Maj |
| Alt+Maj+flèches (déplacer un paragraphe) | Absent | Lot 6 |
| Ctrl+Maj+C / V (pinceau) | Ctrl+Maj+V = coller en texte seul | Conflit : garder le sens « texte seul » |
| Ctrl+molette (zoom) | Zoom du navigateur | T7 |
| F7 (orthographe) | Absent | T11 |
| Ctrl+Maj+8 (afficher ¶ dans Word) | Liste à puces chez nous | Garder notre sens |

### 3.24 Menu contextuel et mini-barre d'outils

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Menu contextuel (clic droit) | oui | oui | oui | Celui du navigateur (il porte les suggestions d'orthographe) | Fort | M | Lot 6 (déjà prévu). Attention : un menu maison fait perdre les suggestions du navigateur ; il faudra y afficher celles de T11, ou laisser Maj+clic droit ouvrir le menu d'origine |
| Mini-barre flottante sur la sélection | oui | non | oui | Absent | Moyen à fort | S à M | `BubbleMenu` de `@tiptap/react/menus` (déjà installé). Placement sous `transform: scale` (zoom) à vérifier. Lot 6 |
| Menu d'insertion en début de ligne (« + » ou « / ») | non | non | oui | Absent | Faible à moyen | M | `FloatingMenu` (déjà installé). Pas prioritaire |

### 3.25 Glisser-déposer

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Déposer une image depuis l'ordinateur ; déplacer du texte sélectionné | oui | oui | oui | Fait | Fort | — | — |
| Déplacer une image, un encart, une zone d'écriture | oui | oui | oui | Fait (blocs `draggable`) | Fort | — | — |
| Poignée de déplacement sur chaque bloc | non | non | oui | Absent | Moyen | S à M | `@tiptap/extension-drag-handle-react` (MIT, 3.33.1). Placement sous zoom à vérifier. Lot 6 |
| Déposer un .docx ou un PDF sur la feuille | oui | oui | oui | Absent | Moyen | S | Avec T10 |

### 3.26 Annuler et rétablir

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Annuler / rétablir | oui | oui | oui | Fait (texte, images, réglages de blocs ; la pagination n'entre pas dans l'historique) | Fort | — | — |
| Liste des actions annulables | oui | oui | non | Absent | Faible | — | Ne pas faire |
| Annuler après fermeture | part. | non | oui | Absent | Fort | M | C'est l'historique des versions. T6 |
| Annuler un dessin fait dans un encart depuis le cours | — | — | — | Absent (l'encart a son propre historique) | Faible | — | Ne pas faire |

### 3.27 Collaboration et partage

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Écriture à plusieurs en même temps | oui | part. | oui | Absent | Hors sujet (un auteur par cours) | XL | `@tiptap/extension-collaboration` (MIT) existe mais demande un serveur de synchronisation. Ne pas faire |
| Donner une copie à un collègue | oui | oui | oui | Absent | Moyen | M | Par l'export Word (T10), ou une copie de compte à compte (fonction SQL). Question § 7 |
| Lien de lecture, mise à disposition des élèves | oui | non | oui | Absent | Fort en puissance (élèves absents) | L | Hors de cet audit : relève de l'espace élève. Question § 7 |
| Commentaires à plusieurs, mentions | oui | oui | oui | Absent | Hors sujet | — | — |

### 3.28 Publipostage

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Fusion avec une liste (une feuille par élève) | oui | oui | part. | Absent | Moyen : nom ou QR de l'élève pré-imprimé sur une évaluation, en lien avec les copies scannées | L | Impression en boucle sur la copie figée de T13 + champs « prénom », « classe ». À étudier après T13 ; pas dans ce plan |

### 3.29 Côté Canva

| Fonction | Word | Writer | Canva | Chez nous | Intérêt enseignant | Effort | Piste technique |
|---|---|---|---|---|---|---|---|
| Modèles prêts à l'emploi | oui | part. | oui | Absent | Fort | M | Modèles personnels + quelques modèles fournis (cours, fiche d'activité, évaluation, fiche méthode, TP). T6 |
| Bibliothèque d'éléments (photos, illustrations) | part. | part. | oui | Absent | Moyen | M à L | Recherche dans Wikimedia Commons ou Openverse (interfaces publiques, conditions d'usage à vérifier), source écrite d'office en légende. T16 |
| Icônes | oui | non | oui | Absent | Moyen | M | `lucide-react`. T16 |
| Kit de marque (couleurs, polices) | part. | non | oui | Absent | Moyen | M | Thème par défaut du professeur, appliqué aux nouveaux cours. T16 |
| Blocs déplaçables, repères d'alignement | part. | part. | oui | Absent | Moyen | — | Lot 3 (calque) et poignée de bloc (lot 6) |
| Grilles et cadres | non | non | oui | Absent | Moyen | M | Bloc colonnes et cadres d'image. T8 |
| Arrière-plans | oui | oui | oui | Absent | Faible | — | Ne pas faire |
| Effets de texte (ombre, néon, courbe) | oui | part. | oui | Absent | Faible | — | Ne pas faire |
| Suppression de l'arrière-plan d'une image | oui | non | oui | Absent | Faible | L | Ne pas faire (3.9) |
| Assistance à la rédaction (Magic Write, Copilot) | oui | non | oui | Absent | Moyen à fort, avec un coût à l'usage | L | Les extensions IA de TipTap sont payantes. Alternative : fonction Edge sur le modèle de `corriger-copie` (clé du professeur déjà gérée) : reformuler, simplifier, proposer des questions, fabriquer un texte à trous. T17 |
| Redimensionnement (changer de format) | part. | part. | oui | Absent | Moyen | M | A4 vers demi-feuille à l'impression. T13 |
| Présentation, « document vers diaporama » | part. | non | oui | Absent | Fort | — | C'est le principe même du mode En classe. Lot 4 |
| Éléments animés, minuteur, sondage | non | non | oui | Absent sur la feuille | Moyen | — | Lots 4 et 5 |

### 3.30 Ce que ni Word ni Canva ne font bien, et qu'un enseignant attend

Hors du périmètre strict de la comparaison, mais c'est là que l'éditeur peut dépasser Word.

| Fonction | Chez nous | Intérêt | Effort | Piste technique |
|---|---|---|---|---|
| Cartouche d'évaluation (Nom, Prénom, Classe, Date, Note, Appréciation, signature) | Absent | Fort | S à M | Bloc prêt à insérer (tableau pré-rempli + pointillés). T3 |
| Barème en marge (« / 2 ») et total calculé | Absent | Fort | M | Nœud en ligne `points`, total affiché dans le cartouche. T3 |
| Tableau de compétences (compétence, niveaux de maîtrise à cocher) | Absent | Fort | S | Bloc prêt à insérer. T3 |
| QCM, vrai / faux | Absent | Fort | S | Cases à cocher (T2) + blocs prêts. T3 |
| Texte à trous | Absent | Fort | — | Lot 5 (mot caché) et lot 6 (impression en pointillés) |
| Zone de réponse, lignes Seyès | Fait (zone d'écriture) | Fort | — | — |
| Note du professeur (visible à la rédaction seulement) | Absent | Moyen | S | Encadré non imprimé. Lot 6 |

---

## 4. Les obstacles techniques transversaux

### 4.1 La pagination par intercalaires

**Comment ça marche.** Le cours est un seul bloc de texte éditable. `computeLayout` mesure
chaque bloc de premier niveau et glisse, devant le premier qui déborde, un espace vide
(« intercalaire ») assez haut pour le renvoyer en haut de la feuille suivante. Les feuilles
blanches sont dessinées derrière.

**Ce que cela impose.**

| Sujet | Conséquence | Ce qu'on en fait |
|---|---|---|
| Un bloc ne se coupe pas | Une liste, un tableau, un encadré ou un long paragraphe part entier à la page suivante (grand blanc en bas de page) et déborde s'il dépasse une page | T15 : poser des intercalaires au second niveau (entre deux éléments de liste, entre deux lignes de tableau, entre deux blocs d'un encadré). Dans un tableau, l'intercalaire doit être une ligne `<tr>` fantôme sans bordure. Couper un paragraphe au milieu demande un intercalaire en ligne (`display: block`) à la position mesurée par `Range.getClientRects` : faisable, délicat |
| Veuves et orphelines | Sans objet aujourd'hui ; à régler le jour où un paragraphe se coupe (jamais moins de 2 lignes de part et d'autre) | T15 |
| En-têtes et pieds de page | Impossible dans le flux ; possible dans les feuilles, tant qu'ils tiennent dans la marge (2,5 cm) | T9 : contenu simple, hauteur fixe |
| Notes de bas de page | Il faudrait réserver, page par page, la place des notes : la hauteur utile dépend alors du contenu de la page, le calcul devient itératif | Notes « sous le texte étudié » (T14), pas de vraies notes de bas de page |
| Colonnes | Un bloc à colonnes est insécable ; des colonnes qui coulent de page en page sont hors de portée | T8 : colonnes côte à côte dans un bloc |
| Image habillée par le texte (`float`) | Le bloc flottant ne pousse plus le suivant : la mesure bloc par bloc devient fausse | T8 : bloc « image + texte » |
| Plusieurs pages côte à côte | Le flux est une seule colonne verticale | Ne pas faire |
| Marges, orientation, format | `PAGE_W`, `PAGE_H`, `MARGIN`, `COL_W`, `CONTENT_H` sont des constantes importées par 6 fichiers ; `@page { size: A4 }` est écrit en dur dans `course.css` | T9 : un objet « géométrie » par document, une règle `@page` injectée |
| Numéros de page dans une table des matières | Déductibles : la page d'un bloc = nombre d'intercalaires placés avant lui + 1 | Sans difficulté |
| Coût du calcul | Chaque frappe relance, 60 ms plus tard, une mesure de tous les blocs ; descendre au second niveau multiplie les mesures | T15 : ne re-mesurer que depuis le bloc modifié |

Deux extensions libres font de la pagination par décorations, comme nous : `tiptap-pagination-plus`
(MIT, 3.1.0) et `tiptap-extension-pagination` (ISC, 2.1.4). Elles ne remplacent pas notre
module (encarts, zoom, impression y sont réglés), mais leur façon de couper les tableaux mérite
d'être lue avant T15 (compatibilité et qualité à vérifier). L'extension officielle de TipTap
pour les pages est payante.

### 4.2 L'impression par le navigateur

- On ne commande pas la fenêtre d'impression : recto verso, plage de pages, pages par feuille
  restent des choix de l'utilisateur. Inutile de les recoder.
- Tout ce qui change l'aspect à l'impression (version élève, version adaptée, noir et blanc)
  doit passer par une classe CSS posée dans `beforeprint`, suivie de `relayoutNow` : le mécanisme
  existe déjà pour retirer l'espace entre les feuilles.
- Les polices doivent être embarquées (woff2) : une police absente de l'ordinateur du collège
  changerait la pagination.
- Une mise en page « deux exemplaires par feuille » ne peut pas s'appuyer sur l'éditeur vivant :
  il faut imprimer une copie figée des feuilles (T13). Cette copie servira aussi à un éventuel
  publipostage.
- L'impression réelle (marges de l'imprimante, en-têtes ajoutés par le navigateur, différences
  entre Chrome et Firefox) n'a jamais été vérifiée : c'est le premier point de T0.

### 4.3 La projection en classe (bande de la largeur de la colonne)

- Tout ce qui vit hors de la colonne n'existe pas en classe : en-têtes, pieds, numéros de page,
  numéros de lignes en marge. Rien d'important ne doit y loger.
- La taille projetée dépend de la largeur de la colonne : 16 cm donnent 8 px par mm, donc un
  texte de 12 pt à 34 px. Avec des marges étroites (colonne de 18 cm), le même texte tombe à
  30 px, sous le minimum du TBI. Changer les marges (T9) a donc un prix en classe ; les
  encarts, eux, restent toujours un écran pile.
- Un texte plus petit que 12 pt, un tableau dense, un bloc à 3 colonnes seront peu lisibles :
  le repère « écran de classe » du lot 4 doit le montrer dès la rédaction.
- Vidéo, son, liens : vivants en classe, morts sur papier. Prévoir leur double (QR code).

### 4.4 Les identifiants de bloc (`blockId`) et le calque du lot 3

- Tout nouveau type de bloc (cases à cocher, colonnes, figure, équation en bloc, pointillés)
  doit être ajouté à `BLOCK_TYPES` dans `courseExtensions.ts`, sinon le calque et les animations
  ne pourront pas s'y accrocher.
- Les éléments de liste et les lignes de tableau n'ont pas d'identifiant aujourd'hui. Le lot 5
  en aura besoin pour faire apparaître les puces une à une : à prévoir avec lui.
- Le calque ancre chaque dessin à `{ blockId, dx, dy }`. Tout ce qui change la forme d'un bloc
  après coup (interligne, marges, thème, version adaptée) déplace le texte sous le dessin. D'où
  l'ordre proposé : les lots qui touchent à la géométrie (T1, T2, T9) avant le lot 3 ; et
  l'impression adaptée (T13) imprimera sans le calque, ou avec un avertissement.
- Un bloc copié-collé garde-t-il son identifiant ? `UniqueID` est censé régénérer les doublons :
  à vérifier avant le lot 3.

### 4.5 Le stockage

- Le cours entier est réécrit dans `boards.doc` une seconde après chaque frappe. Aucune image
  ne doit y entrer en base64 (F3).
- Les réglages du document (page, thème, en-tête, numérotation des titres) peuvent loger dans
  le même JSON (`doc.settings`), sans migration SQL ; `COURSE_DOC_VERSION` passe à 2.
- Seul l'historique des versions (T6) demande une nouvelle table.

---

## 5. Le plan de mise en place

Dix-huit lots, classés par ce qu'ils apportent à l'enseignant rapporté au travail demandé.
Chacun se livre seul, en une PR, testée dans le navigateur. Vérification de build habituelle :
`npx tsc -b` puis `vite build`.

### Vue d'ensemble

| Lot | En une phrase | Effort | Quand, par rapport aux lots 3 à 6 |
|---|---|---|---|
| T0 | Vérifier l'impression sur papier et réparer la touche Tab | S | Tout de suite |
| T1 | Les caractères qui manquent : exposant, indice, symboles, guillemets français, couleurs, lien | M | Avant le lot 3 |
| T2 | Le paragraphe : interligne, espacements, retraits, titres numérotés, cases à cocher | M | Avant le lot 3 |
| T3 | Les blocs de fiche et d'évaluation : cartouche, pointillés, barème, QCM, QR code | M | Indifférent |
| T4 | Des tableaux complets : taille, couleurs, bordures, styles | M | Indifférent |
| T5 | Un collage propre depuis Word et le web, et le pinceau | M | Indifférent, avant T10 |
| T6 | Le filet de sécurité : historique des versions, dupliquer, modèles | M | Indifférent ; le plus tôt est le mieux |
| T7 | Rechercher, remplacer, se repérer dans un long cours | M | Indifférent |
| T8 | Images (légende, rognage, rotation) et blocs en colonnes | L | Indifférent |
| T9 | Mise en page : en-têtes, pieds de page, numéros, marges | L | En-têtes : indifférent. Marges : avant le lot 3, ou jamais |
| T10 | Ouvrir et produire des fichiers Word, insérer un PDF | L | Après T5 |
| T11 | Orthographe et grammaire | M | Avec le lot 6 (menu contextuel) |
| T12 | Équations | M | Indifférent |
| T13 | Impressions adaptées : dys, deux par feuille, noir et blanc | M | Avec ou juste après le lot 6 (version élève) |
| T14 | Étude de texte : numéros de lignes, notes de vocabulaire | M | Indifférent |
| T15 | Pagination fine : listes et tableaux qui se coupent entre deux pages | XL | Après le lot 4 |
| T16 | Thèmes, icônes, banque d'images | L | Thèmes : de préférence avant le lot 3 ; le reste après |
| T17 | Aide à la rédaction par IA | L | Optionnel, en dernier |

Ce qui est déjà dans les lots 3 à 6 et que ce plan ne refait pas : formes et zones de texte
flottantes (lot 3) ; présentation, vidéo et son, repère « écran de classe » (lot 4) ; mot caché
et texte à trous (lot 5) ; menu contextuel, raccourcis, galerie de styles complète, version
élève (lot 6). Le § 3.23 donne au lot 6 la liste exacte des raccourcis manquants ; la mini-barre
flottante, la poignée de bloc et la « note du professeur » sont à lui ajouter.

### T0 — Vérifications préalables (S)

**Contenu.** Imprimer pour de vrai un cours de trois pages et corriger ce qui cloche. Faire que
la touche Tab reste dans le texte. Empêcher les images « incrustées » d'alourdir le cours.

- Fichiers : `courseExtensions.ts` (raccourci `Tab` hors liste et hors tableau ; `allowBase64: false` ;
  priorité explicite du saut de page sur `Mod-Enter`), `course.css` (`tab-size`, retouches
  `@media print`), `PLAN_cours_editeur.md` § 8 (constats).
- Dépendances npm : aucune. Migration SQL : aucune.
- Risques : l'essai papier peut révéler un écart Chrome / Firefox plus profond (hauteur de page
  au demi-pixel) ; le noter plutôt que tout corriger dans ce lot.
- À tester : impression Chrome, Edge, Firefox ; marges mesurées à la règle (2,5 cm) ; pas
  d'adresse ni de date ajoutées par le navigateur ; carreaux Seyès à 8 mm ; encart net ; Tab dans
  un paragraphe, une liste, un tableau ; Ctrl+Entrée ; au passage, coller un vrai cours Word et
  noter ce qui arrive (matière première de T5).

### T1 — Caractères et frappe (M)

**Contenu.** Boutons exposant et indice. Une palette de symboles (flèches, signes mathématiques,
lettres grecques, majuscules accentuées). Les guillemets « » et les espaces avant : ; ? ! se
posent tout seuls. Changer la casse. Taille au choix et boutons agrandir / réduire. Plus de
couleurs, dont une couleur libre. Une vraie petite fenêtre pour les liens (Ctrl+K), et Ctrl+clic
pour les ouvrir. Deux ou trois polices de plus.

- Fichiers : `courseExtensions.ts` ; nouveau `courseTypography.ts` (règles françaises, casse,
  insécables) ; `CourseRibbon.tsx` (groupe Police, Insertion › Symbole, Lien) ; nouveaux
  `CourseSymbolPicker.tsx` et `CourseLinkDialog.tsx` ; `CourseEditor.tsx` (retirer `window.prompt`) ;
  `coursePage.ts` (`FONT_FAMILIES`) ; `course.css` ; `courseIcons.tsx` ; `public/fonts/`.
- Dépendances npm : `@tiptap/extension-superscript`, `@tiptap/extension-subscript`,
  `@tiptap/extension-typography` (MIT, alignées sur 3.33.x).
- Migration SQL : aucune.
- Risques : Typography transforme aussi ce qu'on ne veut pas forcément (1/2 en ½, (c) en ©, « x »
  entre deux nombres en ×) : activer règle par règle. Une correction automatique doit se défaire
  d'un Retour arrière. Poids des polices ajoutées.
- À tester : taper « Bonjour ! » et « Pourquoi ? » ; H2O et m2 ; guillemets dans un titre et dans
  un tableau ; Retour arrière juste après une correction ; Ctrl+K sur une sélection ; impression
  des nouvelles polices.

### T2 — Paragraphes, titres numérotés et listes (M)

**Contenu.** Interligne (simple, 1,15, 1,5, double). Espace avant et après un paragraphe.
Retraits qui marchent partout, pas seulement dans les listes ; alinéa de première ligne. Titres
numérotés tout seuls (I., 1., a.) si on le demande. Listes à cases à cocher. Choix du type de
numéros (1, a, A, I) et « recommencer à ». Coupure des mots en fin de ligne, en option.

- Fichiers : nouveau `courseParagraph.ts` (attributs globaux `lineHeight`, `spaceBefore`,
  `spaceAfter`, `indent`, `firstLine` par `addGlobalAttributes`) ; `courseExtensions.ts`
  (`TaskList`, `TaskItem`, `BLOCK_TYPES`) ; `CourseRibbon.tsx` (groupe Paragraphe) ; `course.css`
  (compteurs de titres, `ol[type]`, cases, `hyphens`) ; `lib/course/courseDoc.ts` (`settings` :
  numérotation des titres, césure ; version 2) ; `CourseEditor.tsx` (pose les réglages en classes
  sur `.ce-doc`).
- Dépendances npm : aucune (tout est déjà installé). Migration SQL : aucune.
- Risques : les numéros de titres sont dessinés par le CSS, ils ne partent pas dans un
  copier-coller ni dans l'export Word (T10 devra les recalculer). Les anciens documents n'ont pas
  de `settings` : valeurs par défaut obligatoires.
- À tester : interligne 1,5 sur un cours de deux pages (la pagination suit) ; numérotation après
  suppression et déplacement d'un titre ; cases imprimées vides ; liste « a) b) c) » reprise après
  une image ; ouverture d'un cours enregistré avant ce lot.

### T3 — Blocs pour fiches et évaluations (M)

**Contenu.** Un menu « Blocs » dans Insertion : cartouche d'évaluation (Nom, Prénom, Classe, Date,
Note, Appréciation), tableau de compétences, QCM, vrai / faux. Des pointillés de réponse qui vont
jusqu'au bord, ou n lignes pointillées. Un barème en bout de question (« / 2 ») avec le total
calculé. Un encadré « libre » dont on choisit le titre et la couleur. Un QR code fabriqué à
partir d'une adresse.

- Fichiers : nouveau `courseBlocks.ts` (gabarits) ; nouveaux `courseDots.ts` et `coursePoints.ts`
  (nœuds en ligne) ; `courseExtensions.ts` (attributs `title` et `color` de `callout`,
  `BLOCK_TYPES`) ; `CourseRibbon.tsx` (Insertion › Blocs, onglet contextuel Encadré) ; nouveau
  `CourseQrDialog.tsx` ; `course.css`.
- Dépendances npm : aucune (`qrcode` est déjà là). Migration SQL : aucune.
- Dépend de : T2 (cases à cocher).
- Risques : le total du barème doit rester calculé, jamais stocké. Les pointillés ne doivent pas
  être confondus avec le « mot caché » du lot 5. Le QR code passe par `uploadBoardImage` (JPEG) :
  vérifier qu'il reste lisible.
- À tester : cartouche imprimé ; pointillés dans un paragraphe, une liste, une cellule ; total
  après ajout et suppression de questions ; QR code scanné au téléphone sur la feuille imprimée.

### T4 — Tableaux (M)

**Contenu.** Choisir la taille du tableau à l'insertion. Couleur de fond des cellules. Bordures :
aucune, toutes, extérieures. Quelques styles tout faits (grille, lignes alternées, sans
bordures, en-tête coloré). Alignement vertical, hauteur de ligne, colonnes de même largeur,
tableau étroit et centré, colonne d'en-tête.

- Fichiers : nouveau `courseTable.ts` (extensions de `Table`, `TableRow`, `TableCell`,
  `TableHeader`) ; `courseExtensions.ts` ; `CourseRibbon.tsx` (onglet Tableau) ; nouveau
  `CourseTableGrid.tsx` ; `course.css`.
- Dépendances npm : aucune. Migration SQL : aucune.
- Risques : avec `resizable: true`, le tableau est dessiné par une vue (`TableView`) qui peut
  ignorer des attributs ajoutés à `table` : à vérifier, quitte à étendre la vue. Bordures en
  `border-collapse` : deux cellules voisines se disputent le même trait. Fonds à l'impression
  (`print-color-adjust`).
- À tester : tableau 2 × 6 ; fusion après coloration ; redimensionnement d'une colonne dans un
  tableau étroit ; tableau « sans bordures » utilisé pour aligner deux textes ; impression couleur
  et noir et blanc.

### T5 — Collage propre et pinceau (M)

**Contenu.** Coller depuis Word, Writer ou une page web donne un texte aux couleurs du cours, pas
un patchwork de polices. Les images collées avec le texte sont rapatriées dans le stockage, ou
signalées. Le bouton « Coller » propose : adapter au cours, garder la mise en forme, texte seul.
Un pinceau pour reproduire une mise en forme. Un encart copié devient une vraie copie.

- Fichiers : nouveau `coursePaste.ts` (`transformPastedHTML`, rapatriement des images, doublons
  de `pageId`) ; nouveau `courseFormatPainter.ts` ; `CourseEditor.tsx` (`handlePaste`, bouton
  Coller) ; `CourseRibbon.tsx` ; `encartStore.ts` (dupliquer une page d'encart).
- Dépendances npm : aucune. Migration SQL : aucune.
- Risques : le HTML produit par Word, Writer, Google Docs, Pronote et les sites est sans fin :
  travailler sur un jeu d'essai fixe et accepter « 80 % propre ». Beaucoup de sites interdisent
  le téléchargement de leurs images depuis une autre page. La lecture du presse-papiers par le
  bouton demande une autorisation du navigateur. Ne pas toucher au collage interne à l'éditeur
  (reconnaissable à `data-pm-slice`).
- À tester : trois vrais cours Word de Thomas, un document Writer, une page Wikipédia avec
  images, un tableau Excel, un Google Docs ; copier-coller à l'intérieur d'un cours inchangé ;
  encart copié puis modifié (l'original ne bouge pas).

### T6 — Sécurité et modèles (M, migration 072)

**Contenu.** Un historique : l'éditeur garde des versions du cours et permet d'en rouvrir une.
« Dupliquer ce cours ». « Enregistrer comme modèle » et « Nouveau à partir d'un modèle », avec
cinq ou six modèles fournis. Un avertissement si le même cours est ouvert ailleurs.

- Fichiers : `supabase-migrations/072_board_doc_versions.sql` ; nouveau
  `lib/course/courseVersions.ts` ; `lib/course/courseDoc.ts` (contrôle de `updated_at` avant
  écriture, `duplicateCourse`) ; nouveau `CourseVersionsPanel.tsx` ; nouveau `courseTemplates.ts` ;
  `CourseRibbon.tsx` (onglet Fichier) ; `CourseEditor.tsx` ; `components/classroom/BoardsPanel.tsx`
  (« + Nouveau » propose les modèles).
- Dépendances npm : aucune.
- Migration SQL 072 (numéro à confirmer au moment de l'écrire) : table `board_doc_versions`
  (`id`, `board_id` → `boards` ON DELETE CASCADE, `user_id`, `doc` JSONB, `kind` auto / manuel /
  avant import, `label`, `created_at`), index (`board_id`, `created_at` DESC), RLS « propriétaire
  seulement » calquée sur celle de `boards` (lire les politiques réelles avant d'écrire) ;
  colonne `boards.is_template` BOOLEAN DEFAULT false.
- Risques : volume (un cours × des dizaines de versions) : garder les 30 dernières et une par
  jour sur 30 jours. Les dessins des encarts ne sont pas versionnés : restaurer une version du
  texte ne restaure pas un encart modifié depuis ; le dire dans le volet.
- À tester : restauration après un « tout sélectionner, supprimer » enregistré ; duplication d'un
  cours avec encarts (les copies sont indépendantes) ; modèle → nouveau cours ; même cours ouvert
  dans deux onglets.

### T7 — Rechercher, remplacer, se repérer (M)

**Contenu.** Une barre Rechercher / Remplacer (Ctrl+F, Ctrl+H). Un volet des titres pour sauter
d'une partie à l'autre. Zoom à la molette, bouton « page entière ». Affichage des marques de
paragraphe (¶) et des espaces.

- Fichiers : nouveaux `CourseFindBar.tsx` et `CourseOutline.tsx` ; `courseExtensions.ts` ;
  `CourseEditor.tsx` (raccourcis, molette, volet) ; `CourseRibbon.tsx` (onglet Affichage) ;
  `course.css`.
- Dépendances npm : `prosemirror-search` (MIT), `@tiptap/extension-invisible-characters` (MIT).
- Migration SQL : aucune.
- Risques : `prosemirror-search` doit utiliser les mêmes exemplaires de `prosemirror-state` et
  `prosemirror-view` que `@tiptap/pm` (vérifier `npm ls prosemirror-state` après installation).
  Ses surlignages cohabitent avec les intercalaires de pagination. Faire défiler jusqu'au résultat
  dans un bureau zoomé.
- À tester : recherche d'un mot présent sur trois pages ; « tout remplacer » puis Ctrl+Z ;
  accents et majuscules ; clic sur un titre du volet ; Ctrl+molette ; ¶ non imprimés.

### T8 — Images et colonnes (L)

**Contenu.** Légende sous l'image, numérotée (« Document 1 »). Rogner, tourner, remplacer une
image ; cadre, coins arrondis ; texte de remplacement. Un bloc « colonnes » (deux ou trois), dont
le cas courant « image à gauche, texte à droite ». Les images transparentes restent transparentes.

- Fichiers : `CourseImageView.tsx` ; nouveau `CourseFigureView.tsx` ; nouveau `courseColumns.ts` ;
  `courseExtensions.ts` (attributs de `CourseImage`, nœuds `figure`, `columns`, `column`,
  `BLOCK_TYPES`) ; `CourseRibbon.tsx` (onglet Image, Insertion › Colonnes) ; `course.css` ;
  `lib/boardImport.ts` (option « garder le PNG », sans changer le comportement du tableau blanc).
- Dépendances npm : aucune. Migration SQL : aucune.
- Risques : un bloc à colonnes est insécable (une page au plus) ; sa lisibilité en classe est à
  regarder avec le lot 4. Rognage et redimensionnement doivent s'entendre. Ne pas convertir
  d'office les images existantes en figures.
- À tester : légende qui suit l'image au glisser ; numérotation après déplacement ; image rognée
  puis redimensionnée ; photo tournée ; bloc image + texte en bas de page (renvoi entier) ;
  impression.

### T9 — Mise en page (L)

**Contenu.** En-tête et pied de page simples : trois cases (gauche, centre, droite) où l'on met
du texte ou un champ (titre du cours, classe, date, page X sur Y), avec « différent sur la
première page ». Numéro de page réglable ou masqué. Marges normales ou étroites, orientation
paysage — si Thomas le veut (§ 7, question 1).

- Fichiers : `lib/course/coursePage.ts` (la géométrie devient une fonction des réglages) ;
  `coursePagination.ts` ; `CourseEditor.tsx` (feuilles, règle, en-tête et pied par feuille,
  règle `@page` injectée) ; nouveau `CoursePageSetup.tsx` ; `CourseRibbon.tsx` (nouvel onglet
  « Mise en page ») ; `CourseImageView.tsx`, `EncartView.tsx`, `courseExtensions.ts` (usage de
  `COL_W`) ; `lib/course/courseDoc.ts` (`settings.page`, `settings.header`, `settings.footer`) ;
  `course.css`.
- Dépendances npm : aucune. Migration SQL : aucune (réglages dans le JSON du cours).
- Découpage conseillé : T9a en-têtes, pieds, numéros (M, sans toucher à la géométrie, à tout
  moment) ; T9b marges et orientation (M à L, avant le lot 3 ou pas du tout).
- Risques : T9b touche les 6 fichiers qui lisent les constantes de page ; une colonne plus large
  rapetisse le texte projeté (§ 4.3) ; un calque déjà dessiné (lot 3) se décale si l'on change les
  marges après coup.
- À tester : en-tête sur 4 pages, première page différente ; « Page 2 sur 4 » juste après ajout
  d'une page ; impression ; passage en marges étroites d'un cours existant (images, encarts,
  zones d'écriture se recalent) ; paysage.

### T10 — Word et PDF (L)

**Contenu.** Ouvrir un fichier Word comme nouveau cours, ou l'insérer dans un cours. Enregistrer
un cours au format Word pour un collègue. Insérer les pages d'un PDF comme images.

- Fichiers : nouveaux `lib/course/courseImportDocx.ts`, `lib/course/courseExportDocx.ts`,
  `lib/course/courseImportPdf.ts` ; `CourseRibbon.tsx` (Fichier › Importer, Exporter) ;
  `CourseEditor.tsx` (dépôt d'un fichier sur la feuille) ; `components/classroom/BoardsPanel.tsx`
  (« Nouveau à partir d'un fichier Word »).
- Dépendances npm : aucune (`mammoth`, `docx`, `pdfjs-dist`, `file-saver` sont installés).
  En option `prosemirror-docx` (MIT), à évaluer avant d'écrire le convertisseur maison.
- Migration SQL : aucune.
- Dépend de : T5 (même nettoyage), T6 (un instantané est pris avant tout import).
- Risques : fidélité. À l'import, `mammoth` garde la structure (titres, listes, tableaux, images,
  gras) mais pas les couleurs, les alignements, les colonnes, les zones de texte, les en-têtes ni
  les équations de Word. À l'export, les encarts partent en images, les zones d'écriture en
  cadres, les encadrés en tableaux à une case ; la numérotation des titres doit être recalculée.
  Annoncer clairement « reprise à retoucher ».
- À tester : dix vrais documents de Thomas et d'Aurélie ; aller-retour cours → Word → cours ;
  ouverture du .docx produit dans Word et dans Writer ; PDF de 5 pages.

### T11 — Orthographe et grammaire (M)

**Contenu.** Les fautes d'accord, de conjugaison et de typographie sont soulignées, avec des
propositions au clic. Un bouton « Vérifier le cours » et un interrupteur.

- Fichiers : nouveau `courseSpell.ts` (plugin : file d'attente par bloc modifié, soulignements,
  mémoire par `blockId`) ; `lib/boardSpell.ts` (réemploi de l'appel au service, sans changer le
  tableau blanc) ; nouveau `CourseSpellPopover.tsx` ; `CourseRibbon.tsx` (onglet « Révision ») ;
  `course.css`.
- Dépendances npm : aucune. Migration SQL : aucune.
- Risques : quota du service public (20 requêtes par minute) : vérifier à la demande ou au
  repos, jamais à chaque frappe. Le texte du cours part chez un tiers (§ 7, question 6). Double
  soulignement avec le correcteur du navigateur. À coordonner avec le menu contextuel du lot 6.
- À tester : « les élève travaille », « il a manger » ; correction appliquée puis Ctrl+Z ; cours
  de 6 pages (pas de blocage) ; hors connexion (silence, pas d'erreur).

### T12 — Équations (M)

**Contenu.** Insertion › Équation : dans la ligne ou centrée, avec des modèles cliquables
(fraction, puissance, racine, formule chimique). Double-clic pour la modifier.

- Fichiers : `courseExtensions.ts` ; nouveau `CourseMathDialog.tsx` (repris de
  `classroom/objects/EquationView.tsx`) ; `CourseRibbon.tsx` ; `course.css` ; `BLOCK_TYPES`.
- Dépendances npm : `@tiptap/extension-mathematics` (MIT) ; `katex` est déjà là ; `mathlive`
  (MIT) seulement si la saisie visuelle est demandée.
- Migration SQL : aucune.
- Risques : noms exacts des nœuds et options de l'extension à confirmer à l'installation ;
  polices KaTeX à l'impression ; une fraction dans une ligne agrandit l'interligne ; à l'export
  Word (T10) l'équation deviendra une image.
- À tester : fraction dans une phrase, équation centrée, `\ce{CO2}` ; impression ; copier-coller
  d'une équation.

### T13 — Impressions adaptées (M)

**Contenu.** Une petite fenêtre avant l'impression : version normale ou adaptée (police, taille
et interligne agrandis pour les élèves dys) ; un ou deux exemplaires par feuille (demi-feuilles à
coller dans le cahier) ; couleur, noir et blanc, ou économie d'encre. La version élève / corrigé
du lot 6 y trouvera sa place.

- Fichiers : nouveau `CoursePrintDialog.tsx` ; nouveau `coursePrint.ts` (classes d'impression,
  recalcul, copie figée des feuilles) ; `CourseEditor.tsx` (`beforeprint` / `afterprint`) ;
  `course.css` (variantes `@media print`) ; `public/fonts/` (police dys).
- Dépendances npm : aucune. Migration SQL : aucune.
- Risques : la version adaptée change le nombre de pages (c'est normal) et décale un calque
  dessiné (lot 3) : l'imprimer sans calque ou prévenir. Ctrl+P contourne la fenêtre : il imprime
  la version normale. La copie figée duplique des identifiants HTML.
- À tester : version adaptée d'un cours de 2 pages ; deux exemplaires par feuille découpés (les
  deux moitiés sont identiques et lisibles) ; noir et blanc à la photocopieuse du collège.

### T14 — Étude de texte (M)

**Contenu.** Un bloc « texte étudié » : numéros de lignes de 5 en 5, notes de vocabulaire
numérotées sous le texte, auteur et source. Pensé pour le français, utile en histoire.

- Fichiers : nouveaux `courseStudyText.ts` et `courseFootnote.ts` ; `CourseRibbon.tsx` ;
  `course.css` ; `BLOCK_TYPES`.
- Dépendances npm : aucune (`tiptap-footnotes`, MIT, à évaluer comme source d'inspiration).
- Migration SQL : aucune.
- Risques : les numéros dépendent de la mise en page (police, version adaptée) : les recalculer
  après chaque recalcul des pages et avant l'impression. En classe la marge n'existe pas : les
  numéros doivent tenir dans la colonne. Un long texte est un bloc insécable tant que T15 n'est
  pas fait.
- À tester : texte de 40 lignes ; modification au milieu (les numéros suivent) ; impression ;
  note ajoutée puis supprimée (renumérotation).

### T15 — Pagination fine (XL)

**Contenu.** Une longue liste, un grand tableau, un encadré se coupent proprement entre deux
pages ; la ligne d'en-tête du tableau se répète ; un très long paragraphe aussi, sans laisser une
ligne seule.

- Fichiers : `coursePagination.ts` (réécriture de `computeLayout`, trois sortes d'intercalaires) ;
  `course.css` ; nouveau `__tests__/coursePagination.test.ts` (séparer le calcul de la mesure
  pour le tester avec vitest).
- Dépendances npm : aucune. Migration SQL : aucune.
- Découpage : T15a listes et encadrés (L) ; T15b tableaux et en-tête répété (L) ; T15c
  paragraphes (L, seulement si le besoin se confirme).
- Risques : le lot le plus risqué du plan. Oscillations de mise en page, lenteur sur un long
  cours, curseur autour d'une ligne fantôme dans un tableau, impression. Un dessin du calque
  ancré à un bloc coupé se décale de la hauteur de l'intercalaire : l'ancrage devra viser
  l'élément de liste ou la ligne (identifiants à leur donner avec le lot 5).
- À tester : liste de 60 éléments, tableau de 40 lignes, encadré de deux pages ; frappe continue
  dans un cours de 10 pages ; annuler / rétablir ; impression.

### T16 — Thèmes, icônes, banque d'images (L)

**Contenu.** Quatre ou cinq thèmes (couleurs et polices des titres et encadrés), dont un « sobre »
pour la photocopie, et un thème par défaut pour les nouveaux cours. Des icônes à glisser dans le
texte. Une recherche d'images libres de droits avec la source écrite sous l'image.

- Fichiers : nouveau `courseThemes.ts` ; `lib/course/courseDoc.ts` (`settings.theme`) ;
  `course.css` (les couleurs des titres et encadrés, aujourd'hui en dur, deviennent des
  variables) ; nouveaux `CourseIconPicker.tsx` et `CourseImageSearch.tsx` ; nœud `icon` dans
  `courseExtensions.ts` ; `CourseRibbon.tsx`.
- Dépendances npm : aucune (`lucide-react` est installé).
- Migration SQL : aucune si le thème par défaut reste sur l'ordinateur (`localStorage`) ; à
  prévoir s'il doit suivre le compte.
- Risques : charger toutes les icônes alourdit l'application (se limiter à 150, chargées à la
  demande). Services d'images externes : quotas, conditions d'usage et droits à vérifier un par un.
  Un changement de thème déplace le texte sous un calque déjà dessiné.
- À tester : changement de thème sur un cours de 4 pages ; impression du thème sobre ; icône dans
  un titre ; image trouvée, insérée, créditée.

### T17 — Aide à la rédaction (L, optionnel)

**Contenu.** Sur un texte sélectionné : reformuler, simplifier pour un élève en difficulté,
proposer des questions, fabriquer un texte à trous. Toujours en proposition, jamais à la place
du professeur.

- Fichiers : nouvelle fonction `supabase/functions/aide-redaction/` (sur le modèle de
  `corriger-copie`) ; nouveau `lib/course/courseAi.ts` ; nouveau `CourseAiMenu.tsx` ;
  `CourseRibbon.tsx`.
- Dépendances npm : aucune côté web. Migration SQL : aucune a priori (la clé du professeur est
  déjà gérée, `lib/userKeys.ts` ; à vérifier).
- Risques : coût à l'usage, qualité inégale, texte envoyé à un tiers. Les extensions IA de TipTap
  sont payantes : tout est maison.
- À tester : chaque action sur un paragraphe de cours réel ; refus propre sans clé ; annulation.

---

## 6. Ce qu'on choisit de ne pas faire, et pourquoi

| On ne fait pas | Pourquoi |
|---|---|
| Les extensions payantes de TipTap (pages, commentaires, suivi des modifications, historique, import et export Word, IA) | Abonnement ; chacune a ici une solution libre ou maison |
| Suivi des modifications, comparaison de documents, écriture à plusieurs | Un cours a un seul auteur ; l'historique des versions (T6) couvre le besoin réel |
| Sections, sauts de section, mises en page différentes dans un même cours | Complexité énorme pour un usage rare ; un second cours fait l'affaire |
| Tabulations à taquets et règle entièrement interactive | Un tableau sans bordures et les pointillés (T3, T4) rendent le service |
| Colonnes « journal » qui coulent d'une page à l'autre | Hors de portée de la pagination actuelle ; le bloc à colonnes suffit |
| Vraies notes de bas de page | Même raison ; remplacées par des notes sous le texte (T14) |
| Plusieurs pages côte à côte, miniatures de pages | Le cours est un seul ruban vertical ; « page entière » et le volet des titres suffisent |
| Texte qui épouse le contour d'une image | Fausse la mesure des pages ; remplacé par « image + texte côte à côte » |
| Un fichier PDF fabriqué sans passer par la fenêtre d'impression | Donnerait une image floue ; « Enregistrer au format PDF » du navigateur fait mieux |
| Le format .odt | Writer ouvre très bien le .docx |
| WordArt, ombres, texte courbé, arrière-plans et bordures de page | Décoratif, gourmand en encre ; un titre décoré se fait dans un encart |
| Suppression de l'arrière-plan d'une image | Licence douteuse, gros téléchargement, besoin faible |
| SmartArt, index, bibliographie, table des illustrations, renvois | Hors du métier ; les encarts et les légendes suffisent |
| Synonymes, traduction, lecture à voix haute, dictée | Le navigateur et Windows le font déjà |
| Styles personnels créés de toutes pièces | Les thèmes (T16) et l'encadré libre (T3) suffisent |
| Mode sombre de la feuille | La feuille est ce qui s'imprime : elle reste blanche |
| Publipostage | Intéressant (nom de l'élève sur l'évaluation) mais c'est un chantier à part, après T13 |

---

## 7. Questions à trancher par Thomas

1. **Marges** : les laisser fixes à 2,5 cm (le texte projeté reste à la bonne taille), ou les
   rendre réglables ? Si réglables, il faut le faire avant le mode Tableau (lot 3).
2. **Titres numérotés** : quel schéma par défaut — « I. / 1. / a. », « 1. / 1.1 / 1.1.1 », ou
   aucun ?
3. **Raccourcis à la Markdown** (taper « # » puis espace fait un titre, « - » fait une puce) :
   on garde, ou on coupe pour coller à Word ?
4. **Anciens cours Word** : combien veux-tu en reprendre, et une reprise « à 80 %, à retoucher »
   te convient-elle ? Peux-tu en fournir une dizaine, variés, comme jeu d'essai (T5, T10) ?
5. **Export Word** : en as-tu besoin (collègues, ENT), ou le PDF suffit-il ? Cela décide de la
   moitié du lot T10.
6. **Grammaire** : acceptes-tu que le texte du cours soit envoyé au service public LanguageTool
   (gratuit, limité, déjà utilisé par le tableau blanc) ? Il ne faudra pas y mettre de noms d'élèves.
7. **Équations** : besoin réel pour toi et Aurélie, ou les exposants, indices et symboles de T1
   suffisent-ils ?
8. **Version adaptée** : quels réglages veux-tu (police, taille, interligne) ? Une seule version
   « dys », ou plusieurs profils ?
9. **Cartouche d'évaluation** : que doit-il contenir exactement, et veux-tu le barème calculé ?
10. **Historique** : combien de temps garder les anciennes versions d'un cours (30 jours proposés) ?
11. **Polices** : lesquelles ajouter (une police dys, une cursive scolaire, autre) ?
12. **Aurélie** : les numéros de lignes et les notes de vocabulaire (T14) lui serviraient-ils
    vraiment ?
13. **Partage** : donner une copie d'un cours à un collègue, publier un cours dans l'espace
    élève — est-ce à ouvrir comme chantier séparé ?
14. **Aide par IA** (T17) : envie ou pas, sachant que chaque demande a un coût ?

---

## Annexe — Points non vérifiés

- Rien n'a été exécuté dans le navigateur : F1 (Tab), F6 (Ctrl+Entrée), F10 (collage Word),
  Ctrl+Maj+V en texte seul, collage d'un tableau Excel, navigation du ruban au clavier sont des
  déductions du code.
- Extensions payantes de TipTap : leurs paquets sont dans un registre privé ; leur liste
  (pages, commentaires, suivi des modifications, historique, conversion Word, IA) vient de ma
  connaissance du catalogue, pas d'une vérification ce jour.
- Compatibilité avec TipTap 3.33 non vérifiée pour : `tiptap-footnotes`, `prosemirror-docx`,
  `tiptap-pagination-plus`, `tiptap-extension-pagination`. Existence et licence, elles, le sont.
- `@tiptap/extension-mathematics`, `@tiptap/extension-audio`, `@tiptap/extension-drag-handle-react`,
  `@tiptap/extension-invisible-characters` : existence et licence MIT vérifiées ; noms des nœuds
  et options à lire à l'installation.
- `@imgly/background-removal` : le registre renvoie à un fichier de licence ; AGPL de mémoire.
- Licences des polices à ajouter (OpenDyslexic, Luciole, cursive scolaire) et conditions d'usage
  des services d'images (Wikimedia Commons, Openverse) : à vérifier au moment du lot.
- Limites de LanguageTool (20 requêtes par minute, 20 Ko) : reprises du commentaire de
  `lib/boardSpell.ts`.
- Interception de Ctrl+E / L / R / J et placement de `BubbleMenu` et de la poignée de bloc sous
  `transform: scale` : à essayer.
- `UniqueID` et les blocs copiés-collés (doublons d'identifiants) : à vérifier avant le lot 3.
- Les efforts sont des ordres de grandeur, estimés à la lecture du code.

---

## Suivi de la mise en place

### T0 et T1 — faits le 12/11/2026 (branche `feat/texte-t0-t1`)

- **Touche Tab** : dans un paragraphe, insère une tabulation (1,25 cm) au lieu de quitter la
  feuille ; listes et tableaux gardent leur comportement. Maj+Tab hors liste ne fait rien.
- **Ctrl+Entrée** : porté par une extension prioritaire (`CourseKeys`), plus par l'ordre des
  extensions (F6).
- **Images en base64** refusées dans le document (`allowBase64: false`, F3 en partie : le
  rapatriement des images collées avec du texte reste à faire en T5).
- **Bouton « Coller »** : colle comme Ctrl+V, mise en forme et images comprises (F2).
- **Exposant et indice** (boutons, Ctrl+. et Ctrl+,), **changer la casse** (bouton Aa, Maj+F3 :
  minuscules → MAJUSCULES → Première lettre), **agrandir / réduire** la police.
- **Typographie française** à la frappe : « guillemets » avec espaces insécables, espace fine
  insécable avant ; ? ! et insécable avant :, apostrophe typographique, … — → ← ≠ ± ² ³. Les
  adresses (« http: ») et les heures (« 10:30 ») ne sont pas touchées. Retour arrière juste après
  annule la correction.
- **Couleur libre** pour le texte et le surlignage (roue de couleurs).
- **Lien** : vraie fenêtre (Ctrl+K) — texte affiché, adresse, retirer, ouvrir ; « www… » et les
  adresses e-mail sont complétées ; **Ctrl + clic** ouvre un lien (F8).
- **Symboles** (Insertion › Symbole) : 135 caractères en 8 familles, derniers utilisés mémorisés.
- Vérifié dans le navigateur (frappe caractère par caractère, boutons, fenêtre de lien, palette).

**Non fait dans ces lots**
- L'**essai d'impression sur papier** (F5) : il ne peut pas se faire depuis l'outil de test ; à
  faire par Thomas (un cours de trois pages, marges à la règle, carreaux Seyès à 8 mm).
- Les **polices supplémentaires** (dys, cursive) : licences à vérifier, question 11 ouverte.
- La **taille de police libre** (hors liste) et les raccourcis clavier d'agrandissement.

### T2 — fait le 12/11/2026 (branche `feat/texte-t2`)

- **Interligne** (1,0 · 1,15 · Normal · 1,5 · 2,0), **espace avant / après** (du style, aucun,
  petit, moyen, grand), **retrait gauche** par crans de 1,25 cm (boutons, Ctrl+M / Ctrl+Maj+M ;
  dans une liste les mêmes boutons changent de niveau), **alinéa** de première ligne. Portés par
  les paragraphes et les titres (`courseParagraph.ts`) ; la pagination suit.
- **Titres numérotés** (onglet Mise en page) : sans numéros (défaut), « I. puis 1. », « 1. puis
  a. », « 1. puis 1.1 ». Compteurs CSS : rien n'est écrit dans le texte, la numérotation se
  recalcule quand on déplace ou supprime un titre. Le Titre 1 (titre du cours) n'est pas numéroté.
- **Cases à cocher** (liste de tâches, imbriquable).
- **Type de numéros** d'une liste numérotée : 1. · a. · A. · I. · i. (F7 corrigé : `data-kind`,
  l'attribut `type` ne distinguant pas a de A en CSS).
- **Coupure des mots** en fin de ligne (onglet Mise en page).
- Réglages du document dans `doc.settings` (`numbering`, `hyphens`) — absents des anciens cours,
  valeurs par défaut appliquées ; pas de changement de version.
- Nouvel onglet **Mise en page** (titres, coupure des mots, saut de page) : il accueillera les
  marges et les en-têtes du lot T9.
- Vérifié dans le navigateur : chaque réglage, numérotation dans les trois schémas (remise à
  zéro des sous-parties), cases à cocher, listes a. et A., enregistrement et relecture des
  réglages, aucun bloc hors page.

**Non fait dans ce lot** : « recommencer la numérotation à… » d'une liste ; les numéros de titres
ne partent pas dans un copier-coller (ils sont dessinés, à recalculer pour l'export Word du T10).

### T3 — fait le 12/11/2026 (branche `feat/texte-t3`)

- **Insertion › Blocs** (`courseBlocks.ts`, `CourseBlocksMenu`) : cartouche d'évaluation (Nom,
  Prénom, Classe, Date, Note sur le total, Appréciation), question avec barème et lignes
  pointillées, QCM (cases à cocher), vrai ou faux, tableau de compétences (I, F, S, TB), encadré
  libre. Ce sont des gabarits de contenu ordinaire : une fois posés, ils se modifient comme le reste.
- **Pointillés de réponse** (`dots`, nœud en ligne) : jusqu'au bord de la ligne (le paragraphe
  devient flexible, `:has()`), ou d'une longueur choisie (onglet contextuel, 0,5 à 16 cm).
  Zone d'écriture : nouveau type « Pointillés » (une ligne de points tous les 8 mm).
- **Barème** (`points`) calé à droite, réglable au demi-point ; **total** (`pointsTotal`)
  recalculé à chaque modification, jamais stocké.
- **Encadré libre** : titre et couleur au choix ; tout encadré peut recevoir un titre personnalisé
  (onglet contextuel « Encadré », disponible quand le curseur est dans un encadré).
- **QR code** (`CourseQrDialog`, bibliothèque `qrcode` déjà présente) : adresse, aperçu, taille
  de 2,5 à 5 cm ; inséré comme une image.
- Vérifié dans le navigateur : insertion des six blocs, total (2 + 1 = 3, puis 5,5 après réglage),
  pointillés à 4 cm exacts, encadré libre (titre, couleur), QR code à 3 cm, aucun bloc hors page.

**Non vérifié** : lecture du QR code au téléphone sur la feuille imprimée (il passe par la
conversion JPEG des images) ; rendu imprimé des pointillés. **Non fait** : le contenu exact du
cartouche attend la réponse à la question 9.
