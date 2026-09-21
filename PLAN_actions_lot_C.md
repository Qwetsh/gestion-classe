# Plan — Actions des boutons, lot C : banque d'événements

Rédigé le 21/09/2026 à la livraison, après `IDEES_actions_tableau.md` (§ 5 bis, idée de Thomas) et
les lots A et B. Le lot a été codé directement, les choix restants étant de routine ; ce document
tient lieu de plan et de bilan.

## 1. Ce qui est livré

- **Onglet « ⚡ Événements »** dans le panneau Ressources, entre Bibliothèque et Annales, avec la
  recherche commune. Deux sections : **Fournis** (14 préréglages) et **Les miens** (événements
  enregistrés, ✕ discret au survol pour retirer).
- **Accès** : menu Plus › Séance › « Événements (boutons prêts à poser) », et pastille radiale
  « Événements » à ajouter à la palette dans « Personnaliser la palette ».
- **Insertion** : un tap pose les objets au centre de la page, sélectionne le bouton porteur et
  passe en outil Sélection. Si le préréglage attend une cible, le bandeau « Touchez l'objet… »
  s'ouvre aussitôt, l'action déjà choisie dans la bulle (`pendingActionRef` → `openBubble(…,
  preset)`) ; sans cible (aller à une page), la bulle s'ouvre directement ; une fenêtre posée
  s'ouvre en édition.
- **Préréglages fournis** (`lib/boardEvents.ts`) : Afficher / masquer, Bouton Réponse (bouton +
  réponse cachée), Découvrir un cache, Suite →, ← Retour, Aller à une page, Tout remettre, Zone
  cliquable, Point chaud + fenêtre, Zoom sur…, Avancer d'un cran, Top chrono (bouton + minuteur),
  Tirage (bouton + dé), Jouer un son. Les boutons sont des rectangles arrondis indigo avec texte.
- **Mes événements** : « Enregistrer dans mes événements… » dans le menu contextuel d'une
  sélection ; le fragment est normalisé (identifiants frais, positions relatives, cibles internes
  remappées par `cloneObjects`). À la réinsertion, la première action vers un objet resté hors du
  fragment redevient « à relier ». Stockage : navigateur (`classroom-board-events`) + compte
  (table `user_board_events`, RLS par utilisateur, migration `add_board_events.sql` **appliquée en
  prod le 20/09/2026**) ; le compte alimente le navigateur à l'ouverture du tableau, le navigateur
  renvoie ce qu'il a en plus.

## 2. Écarts par rapport à l'idée de départ

- Pas de glisser-déposer depuis le panneau : un tap pose au centre, comme la bibliothèque.
- Les préréglages autonomes (Réponse, Top chrono, Tirage, Point chaud + fenêtre) n'enchaînent pas
  sur le choix de cible : ils sont déjà reliés.
- L'onglet reste dans le panneau Ressources (décision : UI provisoire, à retravailler).

## 3. Vérifié dans le navigateur (brouillon, 21/09/2026)

Menu Plus › Événements ouvre le panneau sur l'onglet ; « Suite → » posé au centre, sélectionné,
badge ⚡ ; « Afficher / masquer » enchaîne sur le bandeau, tap sur une cible, bulle avec
Basculer pré-choisi, validation → bouton « Voir ⚡ » ; « Bouton Réponse » pose deux objets dont
la réponse cachée (fantôme) ; « Point chaud + fenêtre » pose la zone reliée et ouvre l'éditeur de
fenêtre ; « Enregistrer dans mes événements… » sur le bouton Réponse → apparaît dans « Les
miens », suppression au ✕. Brouillon remis en état. Tests vitest : 51 ; tsc et eslint propres.

Non testé en direct : synchronisation avec le compte (table en prod, requêtes non exercées ici),
réinsertion d'un événement enregistré avec cible extérieure, préréglages Zoom / Avancer / Son /
Aller à une page dans leur enchaînement complet, pastille radiale.

## 4. Fichiers

`lib/boardEvents.ts` (nouveau), `lib/boardRadialPalette.ts`, `components/classroom/BoardLibraryPanel.tsx`
(prop `initialTab`, type `LibraryTab` exporté), `components/classroom/Whiteboard.tsx` (`insertEvent`,
`saveSelectionAsEvent`, `pendingActionRef`, `openBubble(…, preset)`, `libraryOpen: false | LibraryTab`),
`supabase/migrations/add_board_events.sql`, tests dans `lib/__tests__/boardReveal.test.ts`.

## 5. Reste après le lot C

Chantier UX « édition / en classe » (mode aperçu, gestes, outils), lot D (cloneur, conteneurs
auto-correcteurs, bonne / mauvaise réponse, actions à l'ouverture, encre magique, déclencheurs,
banque de sons, commandes depuis le téléphone), performance du zoom à vérifier sur le TBI, et
master qui n'a toujours pas cette branche.
