# AR Lab — banc d'essai réalité augmentée

Prototype isolé (hors app React) pour valider la RA par reconnaissance d'image avant
intégration dans l'espace élève. Deux pages statiques, aucune dépendance npm :
MindAR + A-Frame sont chargés depuis un CDN.

| Page | Rôle |
|------|------|
| `compile.html` | Transforme une photo en cible `.mind` (compilation dans le navigateur) |
| `index.html` | Scanner : ouvre la caméra, reconnaît la cible, affiche le contenu |

## Workflow de test

1. Ouvrir `compile.html` **sur le téléphone**, choisir/photographier l'image cible, compiler.
2. « Tester dans le scanner » (la cible est mémorisée dans le `localStorage` de l'appareil).
3. Choisir le contenu : objet 3D démo, modèle `.glb`, vidéo ou image.
4. Lancer la RA et viser l'image.

Le cadre vert semi-transparent matérialise la position calculée de la cible : s'il colle
à l'image réelle, le suivi est bon.

## Contraintes

- **HTTPS obligatoire** (`getUserMedia`). Trois options :
  - déployer sur GitHub Pages → `https://qwetsh.github.io/gestion-classe/ar-lab/`
  - `chrome://inspect` → Port forwarding `5173` → le téléphone ouvre `http://localhost:5173` (contexte sécurisé)
  - un tunnel HTTPS (`cloudflared`, `ngrok`)
- La compilation d'une cible prend 30 s à 2 min sur téléphone. Elle se fait **une fois**,
  hors ligne ; en production les `.mind` seront pré-compilés et servis comme assets.
- Une bonne cible = beaucoup de détails contrastés, pas de surface unie ni de motif répété.

## Pour l'intégration dans l'espace élève

Le passage en onglet React implique : `npm i mind-ar three` (ou `aframe`), chargement
paresseux du bundle (~2 Mo) au clic sur l'onglet, et des cibles stockées côté Supabase
(table `ar_targets` : image, `.mind`, contenu associé, classe/séance).
