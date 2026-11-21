# Banque : ce qui est déjà fait, à réutiliser

Avant de dessiner une animation ou d'écrire une scène, regarder ici : une scène qui a plu se
reprend (et se cite dans la proposition : « la 3D du patient, comme pour la 3e D »), un dessin de
banque fait gagner du temps et garde le même style d'une séance à l'autre. Chaque nouvelle scène
réussie et chaque nouveau thème de dessins s'ajoutent ici, avec la date et le retour de Thomas.

Fichiers : `.claude/skills/cours-gestion-classe/` (`animation/banque/`, `exemples/`).

## Banques de dessins et d'outils (`animation/banque/`)

| Banque | Ce qu'elle donne | Thème |
|---|---|---|
| `immunite.js` | virus (Epstein-Barr : antigènes triangulaires ; grippe : carrés), antigène, anticorps (creux complémentaires), lymphocyte B, phagocyte, cellule, fonds | 3e S2, système immunitaire |
| `scene3d.js` | la 3D sous les étiquettes SVG : `S3D.create`, `load` (GLB), `fit`, `box.at`, `view` (caméra en images-clés), `pose` (animation du modèle), `toStage` (étiquette qui suit le modèle), `glow`, `spot` | tout modèle 3D (bibliothèque `three`) |

`animation/outils.js` (toujours inclus) : `seg`, `lerp`, `keys` (images-clés), `rng`, `txt`,
`fleche`, `ok`, `ko`.

## Scènes faites

| Scène | Fichiers | Pour | Retour de Thomas |
|---|---|---|---|
| « Comment les anticorps nous défendent-ils ? » — 10 étapes, dessin vectoriel animé | `exemples/anticorps_animation.py` + `anticorps_scene.js` (référence de qualité : `_Claude/exemples/anticorps-animation-reference.html`) | 3e S2 A2, correction Eve Amalle | référence de qualité attendue (16/11/2026) ; posée en base sur l'original, retour de séance *à compléter* |
| « Une patiente fiévreuse » — 6 étapes : la patiente en 3D, gros plans fièvre et ganglions, frottis qui se rapproche, lymphocytes et phagocytes entourés, bilan | `exemples/patient3d_scene.py` (modèle `fille-fievreuse.glb` et photo `frottis-yve.jpg` de l'hôpital) | démonstration des scènes riches (21/11/2026), réutilisable en 3e S2 | montrée en planche le 21/11/2026, *non jouée en classe* |

## Pages de sites pilotables

| Page | Pour | Étapes |
|---|---|---|
| Hôpital `?presentation=eve-amalle` | 3e S2 A2 (activité, sans les réponses) | 12 |
| Hôpital `?correction=eve` | 3e S2 A2 (correction de Docteur Morel, voix) | 46 |
| Hôpital `?presentation=yve-apabien`, `?correction=yve` | 3e S2 A1 (première réaction immunitaire) | annoncées au chargement |
| Hôpital `?presentation=eva-quesine` | 3e S2 A4 (vaccination) | annoncées au chargement |
