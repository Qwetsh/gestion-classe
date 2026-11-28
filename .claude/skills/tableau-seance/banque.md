# Banque : ce qui est déjà fait, à réutiliser

Avant de dessiner une animation ou d'écrire une scène, regarder ici : une scène qui a plu se
reprend (et se cite dans la proposition : « la 3D du patient, comme pour la 3e D »), un dessin de
banque fait gagner du temps et garde le même style d'une séance à l'autre. Chaque nouvelle scène
réussie et chaque nouveau thème de dessins s'ajoutent ici, avec la date et le retour de Thomas.

Fichiers : `.claude/skills/cours-gestion-classe/` (`animation/banque/`, `exemples/`). Un chemin qui
commence par `_Claude/exemples/` désigne le dossier privé de Thomas
(`C:\Users\Utilisateur\OneDrive\Documents\Ecole\_Claude\exemples\`) : les corrections d'évaluation n'ont pas leur place dans un dépôt
public.

## Banques de dessins et d'outils (`animation/banque/`)

| Banque | Ce qu'elle donne | Thème |
|---|---|---|
| `immunite.js` | virus (Epstein-Barr : antigènes triangulaires ; grippe : carrés), antigène, anticorps (creux complémentaires), lymphocyte B, phagocyte, cellule, fonds ; depuis le 22/11/2026 : staphylocoque (`bacterie`, digéré avec `dig`), toxines tétanique (sites ronds) et diphtérique (sites carrés) (`toxine`, `bindTox`), souris et lapin de laboratoire | 3e S2, système immunitaire |
| `scene3d.js` | la 3D sous les étiquettes SVG : `S3D.create`, `load` (GLB), `fit`, `box.at`, `view` (caméra en images-clés), `pose` (animation du modèle), `toStage` (étiquette qui suit le modèle), `glow`, `spot` | tout modèle 3D (bibliothèque `three`) |
| `bacteries.js` | bactérie en bâtonnet (`bacterie` : bleue sensible, rouge résistante), boîte de Petri (`boite`), tapis de bactéries avec trous (`tapis`), pastille lettrée, halo de diffusion (`halo`), zone nette (`zone`), règle graduée (`regle`) ; couleurs `BA` (chou rouge, rose acide, microbiote) | 3e S2 A3 (antibiogramme, résistances) ; réutilisable pour la séquence 1 (développement bactérien) |
| `tectonique.js` | contours réels de l'Afrique et de l'Amérique du Sud (Natural Earth, domaine public) et zones à Mesosaurus ; rotation sur la sphère (`R`, `tourne`, `SA_A(w)` : l'Atlantique ouvert de w°, pôle de Bullard), projection de Lambert avec caméra (`camera`), `distance`, `centre` ; Mesosaurus qui nage (`mesosaurus`) ; couleurs de coupe (`COUPE` : croûtes, manteau rigide, asthénosphère, vert de la lithosphère) | 4e S2 (dérive, frontières, profondeur des plaques) |
| `chenilles.js` | chenille processionnaire qui rampe (`CHEN.chenille`, gelée avec `gel`), procession le long d'un chemin (`procession`, `surChemin`), nid de soie (givre, éteint), pin, chêne, branche, touffe d'aiguilles (mangée, givrée), thermomètre gradué à seuils, jauge, ciel jour → nuit étoilé, lune, camion chargé de pins, secteurs d'une roue des mois (`secteur`, `roueP`, `MOIS`), carte du nord-est de la France (`VILLES` aux vraies coordonnées, `projection`, `trace`, `entre`, `ville`), hachures de zone colonisée | 5e S2 (climat et répartition des espèces) ; réutilisable pour tout cycle de vie, calendrier ou carte régionale |

`animation/outils.js` (toujours inclus) : `seg`, `lerp`, `keys` (images-clés), `rng`, `txt`,
`fleche`, `ok`, `ko`.

## Scènes faites

| Scène | Fichiers | Pour | Retour de Thomas |
|---|---|---|---|
| « Comment les anticorps nous défendent-ils ? » — 10 étapes, dessin vectoriel animé | `exemples/anticorps_animation.py` + `anticorps_scene.js` (référence de qualité : `_Claude/exemples/anticorps-animation-reference.html`) | 3e S2 A2, correction Eve Amalle | référence de qualité attendue (16/11/2026) ; posée en base sur l'original, retour de séance *à compléter* |
| « Une patiente fiévreuse » — 6 étapes : la patiente en 3D, gros plans fièvre et ganglions, frottis qui se rapproche, lymphocytes et phagocytes entourés, bilan | `exemples/patient3d_scene.py` (modèle `fille-fievreuse.glb` et photo `frottis-yve.jpg` de l'hôpital) | démonstration des scènes riches (21/11/2026), réutilisable en 3e S2 | montrée en planche le 21/11/2026, *non jouée en classe* |
| « Le puzzle se ferme » — 5 étapes : l'Amérique du Sud tourne vers l'Afrique (vrais contours, rotation de Bullard), côtes qui s'emboîtent, petits vides, zones à Mesosaurus face à face, plateau continental qui comble les vides | `exemples/wegener_animations.py` + `wegener_carte.js` + `wegener_puzzle_scene.js` | 4e S2 A3, correction Q1 | acceptée sur storyboard le 21/11/2026 ; posée pour la 4B (23/11), *non jouée* |
| « Brise-glace ou plaque ? » — 6 étapes en coupe : l'idée de Wegener (brise-glace), le blocage, la plaque cerclée de vert, toute la plaque glisse (GPS), la dorsale, « pas de lave » | `exemples/wegener_coupe_scene.js` | 4e S2 A3, correction Q4 b ; la coupe se reprend pour l'A2 | idem |
| « L'Atlantique sud s'ouvre » — 5 étapes : de 130 Ma à aujourd'hui, dorsale et fond océanique coloré par âge, compteur à 3 cm/an, calcul, largeurs 3 000 / 6 000 km, limites du modèle | `exemples/wegener_ouverture_scene.js` (même carte que le puzzle) | 4e S2 A3, correction Q5 ; réutilisable en A1 (divergence) | idem |
| « Comment lire un antibiogramme ? » — 6 étapes : le modèle de la classe (gel au chou rouge, vinaigre dilué) à côté d'un vrai antibiogramme, pastilles, diffusion, zones (couleur / zone claire, 15 min contre 16-20 h), mesure du diamètre, bilan | `exemples/antibiogramme_animations.py` + `antibiogramme_lecture_scene.js` | 3e S2 A3, activité | acceptée sur storyboard le 22/11/2026 ; posée sur l'original, *non jouée* |
| « Quand les antibiotiques ne marchent plus » — 6 étapes : colonie avec résistantes présentes par hasard, une prise (les sensibles meurent), multiplication des résistantes, nouvelle prise sans effet, microbiote appauvri, bilan « sélection » | `exemples/antibiogramme_resistance_scene.js` | 3e S2 A3, activité et correction (document 3, Q6) | idem |
| « Le front qui remonte » — 5 étapes : carte du nord-est, front de 1972 au sud de Paris, compteur 1972 → 2004 (+ 87 km, hivers + 1,1 °C), accélération à 5,5 km par an jusqu'à l'Aube et la Marne, camion qui dépose des nids à Obernai, 125 km jusqu'à Metz | `exemples/chenilles_animations.py` + `chenilles_front_scene.js` | 5e S2 A1, correction Q4 et bilan | acceptée sur storyboard le 25/11/2026 ; posée sur l'original de la correction, *non jouée* |
| « Une nuit d'hiver dans le nid » — 4 étapes : pin la nuit et nid de soie, sortie en procession à 3 °C (aiguilles mangées, réserves qui montent), au nid à −4 °C (nuits froides, réserves qui baissent), colonie morte à −17 °C, bilan « facteur limitant » | `exemples/chenilles_nid_scene.js` | 5e S2 A1, correction Q2 | idem |
| « Pin ou chêne ? Le calendrier des poils urticants » — 3 étapes : roue des 12 mois à deux anneaux (pin novembre-avril, chêne mai-juillet), curseur jusqu'à « fin juin » (message de la mairie), réponse au Pâtis avec les deux indices | `exemples/chenilles_calendrier_scene.js` | 5e S2 A1, correction Q1 | idem |

| « Même lumière, plus grande surface » — 5 étapes : rayons parallèles sur la Terre, encarts « vu de près » (feuille quadrillée de l'A3 : 4 carreaux à l'équateur, 8 près du pôle), thermomètres, deux idées fausses barrées (distance, glace) | `_Claude/exemples/meteo_animations.py` + `meteo_poles_scene.js` | 5e S1, correction de l'évaluation 1, Q6 ; réutilisable pour la correction de l'A3 (séance 2) | acceptée sur storyboard le 21/11/2026 ; posée pour la 5D (23/11), *non jouée* |
| « La brise de mer se lève » — 6 étapes : le sable chauffe, particules d'air qui tournent (espacées = moins dense, serrées = plus dense), les 4 flèches du barème une à une, drapeau qui se lève, bonus la nuit (brise de terre) | `_Claude/exemples/meteo_brise_scene.js` | 5e S1, correction de l'évaluation 1, Q8-9 ; réutilisable pour l'A3 (séance 3, boîte à convection) | idem |
| « Englober n'est pas détruire » — 5 étapes : adhésion, ingestion, digestion chez l'enfant en bonne santé (compteur 100 → 3 %), puis l'enfant malade où la bactérie survit et se divise (44 %), bilan côte à côte | `_Claude/exemples/entrainement3e_animations.py` + `entrainement3e_phagocytose_scene.js` | 3e S2, correction de l'entraînement noté, Q4 ; réutilisable pour la phagocytose (A1, M. Apabien) | acceptée sur storyboard le 22/11/2026 ; posée sur l'original, *non jouée* |
| « Ce que contient le sérum A » — 6 étapes : le lapin fabrique des anticorps (LB), le sérum sans cellules, lots 2, 3 (témoin) et 4 (autre toxine), bilan spécificité | `_Claude/exemples/entrainement3e_serum_scene.js` (même fichier Python) | 3e S2, correction de l'entraînement noté, Q10-11 ; réutilisable pour la sérothérapie et la vaccination (A4) | idem |

## Pages de sites pilotables

| Page | Pour | Étapes |
|---|---|---|
| Hôpital `?presentation=eve-amalle` | 3e S2 A2 (activité, sans les réponses) | 12 |
| Hôpital `?correction=eve` | 3e S2 A2 (correction de Docteur Morel, voix) | 46 |
| Hôpital `?presentation=yve-apabien`, `?correction=yve` | 3e S2 A1 (première réaction immunitaire) | annoncées au chargement |
| Hôpital `?presentation=eva-quesine` | 3e S2 A4 (vaccination) | annoncées au chargement |
