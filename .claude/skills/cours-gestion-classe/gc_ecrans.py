"""
gc_ecrans — écrire les écrans d'un cours de Gestion Classe (pages de tableau blanc) en Python.

Les écrans sont la « face écran » d'une activité : ce que la classe voit au TBI, pas la fiche
zoomée. Une page fait 1000 x 562,5 unités (16:9) ; sur un TBI de 1 280 px, une unité vaut 1,28 px.

Usage (depuis un script placé dans course-drafts/_outils/, ou hors du dépôt) :

    import sys; sys.path.insert(0, r'<dépôt>/.claude/skills/cours-gestion-classe')
    from gc_ecrans import *

    e = Ecrans('weg', 'Activité 3 · Wegener et la dérive des continents')
    e.titre('Séquence 2 — Sous nos pieds, une Terre en mouvement', 'Activité 3',
            'Wegener et la dérive des continents', problematique='Quels indices… ?')
    e.question('Question 2 — « À la nage » ?', 'Un camarade propose… <b>Montre</b>-lui que…',
               [('Le Mesosaurus', 'C’est un reptile d’eau douce…')], bareme='1 pt')
    e.bilan('En 1912, Wegener propose la ' + e.trou('dérive des continents') + '…')
    e.ecrire(r'<dépôt>/gestion-classe-web/course-drafts/ecrans/wegener-ecrans.json')

Puis, dans gestion-classe-web : npm run screens:check (voir SKILL.md), et seulement ensuite
gc_envoi.py ecrans.

Deux niveaux :
  - les **gabarits** (titre, situation, consigne, document, question, tableau, calcul, bilan)
    placent tout seuls leurs blocs : la hauteur de chaque texte est estimée, les blocs sont
    répartis dans la page, et la taille descend d'un cran si le contenu ne tient pas ;
  - les **primitives** (ecran(), puis texte, reponse, cadre, minuteur, image) posent un objet à
    des coordonnées données, pour ce qu'aucun gabarit ne sait faire.

Ce que les écrans montrent, et pas la fiche : la problématique, les consignes raccourcies, les
documents en grand, une question par écran, la place pour écrire, les réponses sous cache, le
bilan. Le cartouche, la ligne d'identité, le barème détaillé et « J'ai réussi » restent sur papier.
"""
import json
import re
import sys

# ---------------------------------------------------------------- géométrie et lisibilité

PAGE_L = 1000
PAGE_H = 562.5
MARGE = 60                 # bord gauche du contenu
LARGEUR = PAGE_L - 2 * MARGE
HAUT = 120                 # première ligne sous le titre
BAS = 540                  # dernière ligne utile
INTERLIGNE = 1.34          # interligne du tableau blanc (lib/boardText.ts)
LARGEUR_CAR = 0.52         # largeur moyenne d'un caractère, en tailles de police (mesurée le
                           # 15/11/2026 sur 114 textes : 102 justes, 11 comptés trop hauts, 1 trop bas)
TAILLE_MIN = 22            # un texte courant se lit du fond de la classe à partir de là (28 px)

# Couleurs des fiches de Thomas
BLEU = '#1F4E79'
BLEU2 = '#2E75B6'
BLEU_FONCE = '#1F3864'
GRIS = '#64748B'
NOIR = '#111827'
ROUGE = '#C00000'          # réponses et bilans : toujours en rouge
FOND_BLEU = '#EAF1F9'
FOND_ROSE = '#FBE5E5'
FOND_JAUNE = '#FFF8DC'
JAUNE_TEXTE = '#5C4A00'
TRAIT = '#475569'
TRAIT_CLAIR = '#94A3B8'

_BLOC = re.compile(r'^<(div|p|ul|ol|h[1-3]|blockquote)\b', re.I)
_BLOC_VIDE = re.compile(r'<(div|p)\b[^>]*>(?:\s*(?:<br\s*/?>|&nbsp;))+\s*</\1>', re.I)


def _en_bloc(html):
    """Un texte du tableau est fait de blocs : une phrase nue est mise dans un <div>."""
    return html if _BLOC.match(html) else '<div>' + html + '</div>'


def lignes_de(html):
    """Texte nu d'un HTML, un bloc par ligne (même découpage que le vérificateur)."""
    t = re.sub(r'<br\s*/?>', '\n', html, flags=re.I)
    t = re.sub(r'</(div|p|li|h1|h2|h3|blockquote)>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]*>', '', t)
    for a, b in (('&nbsp;', ' '), ('&lt;', '<'), ('&gt;', '>'), ('&amp;', '&')):
        t = t.replace(a, b)
    return [l.strip() for l in t.split('\n') if l.strip()]


def hauteur_texte(html, largeur, taille, fond=False):
    """Hauteur estimée d'une zone de texte (même calcul que `npm run screens:check`)."""
    marge = taille * 0.5 if fond else 0
    par_ligne = max(1, int((largeur - marge * 2) / (taille * LARGEUR_CAR)))
    lignes = sum(max(1, -(-len(l) // par_ligne)) for l in lignes_de(html))
    lignes += len(_BLOC_VIDE.findall(html))      # « <div><br></div> » : une ligne vide à l'écran
    return max(1, lignes) * taille * INTERLIGNE + marge * 2


def B(texte):
    return '<b>' + texte + '</b>'


def I(texte):
    return '<i>' + texte + '</i>'


def C(texte, couleur):
    return '<span style="color: ' + couleur + '">' + texte + '</span>'


def liste(*lignes):
    """Plusieurs lignes dans une même zone : « • … » sur chacune."""
    return ''.join('<div>• ' + l + '</div>' for l in lignes)


# ---------------------------------------------------------------- actions des boutons
#
# Un bouton (ou une zone cliquable) porte une liste d'actions jouées dans l'ordre quand on le
# touche (lib/boardObjects.ts, `Interaction`). Chaque fonction ci-dessous rend une action ; la
# cible est un objet rendu par une primitive (ou son identifiant). Un bouton ne déclenche jamais
# un autre bouton. L'état (affiché, découvert, déplacé) appartient à la séance : « Réinitialiser »
# remet la page comme au départ.

def _cible(o):
    return o['id'] if isinstance(o, dict) else o


def _page_id(p):
    if isinstance(p, Ecran):
        return p.id
    return p['id'] if isinstance(p, dict) else p


def Afficher(o):
    """Fait apparaître un objet caché au départ (`cacher`)."""
    return {'action': 'show', 'targetId': _cible(o)}


def Masquer(o):
    return {'action': 'hide', 'targetId': _cible(o)}


def Basculer(o):
    """Affiche l'objet s'il est caché, le cache sinon."""
    return {'action': 'toggle', 'targetId': _cible(o)}


def Decouvrir(o):
    """Tire le rideau (ou gratte le ticket) posé sur l'objet."""
    return {'action': 'reveal', 'targetId': _cible(o)}


def Recouvrir(o):
    return {'action': 'cover', 'targetId': _cible(o)}


def AllerA(page):
    """Va à un écran (Ecran, page ou identifiant)."""
    return {'action': 'goto', 'params': {'pageId': _page_id(page)}}


def PageSuivante():
    return {'action': 'next'}


def PagePrecedente():
    return {'action': 'prev'}


def Reinitialiser():
    """Remet la page comme au départ : objets cachés, rideaux fermés, objets à leur place."""
    return {'action': 'reset'}


def Lancer(o):
    """Démarre un minuteur."""
    return {'action': 'start', 'targetId': _cible(o)}


def Arreter(o):
    return {'action': 'stop', 'targetId': _cible(o)}


def Tirer(o):
    """Lance le dé, fait tourner la roue, tire les groupes."""
    return {'action': 'roll', 'targetId': _cible(o)}


def Ouvrir(fenetre):
    """Ouvre une fenêtre (`fenetre()`) par-dessus l'écran."""
    return {'action': 'window', 'targetId': _cible(fenetre)}


def Zoomer(o):
    """La vue cadre l'objet (animé) ; toucher à côté revient à l'écran entier."""
    return {'action': 'zoomTo', 'targetId': _cible(o)}


def DeplacerVers(o, x, y):
    """L'objet glisse (0,4 s, en ligne droite) jusqu'à ce que son coin haut-gauche soit en (x, y)."""
    return {'action': 'moveTo', 'targetId': _cible(o), 'params': {'x': x, 'y': y}}


def Decaler(o, dx, dy):
    """L'objet glisse de (dx, dy) depuis sa place du moment."""
    return {'action': 'moveBy', 'targetId': _cible(o), 'params': {'dx': dx, 'dy': dy}}


def Replacer(o):
    """L'objet revient à sa place de départ."""
    return {'action': 'moveBack', 'targetId': _cible(o)}


def UneFois(action):
    """L'action ne se joue qu'une fois par séance."""
    return dict(action, once=True)


# Dessins de la bibliothèque du tableau (lib/boardLibrary.ts) : identifiant -> (largeur / hauteur,
# catégorie, nom). Le test test_gc_ecrans.py vérifie que la liste suit celle de l'application.
DESSINS = {
    'beaker': (0.85, 'lab', 'Bécher'), 'erlenmeyer': (0.8, 'lab', 'Erlenmeyer'),
    'testtube': (0.32, 'lab', 'Tube à essai'), 'cylinder': (0.35, 'lab', 'Éprouvette graduée'),
    'petri': (1.6, 'lab', 'Boîte de Petri'), 'microscope': (0.7, 'lab', 'Microscope'),
    'thermometer': (0.3, 'lab', 'Thermomètre'), 'funnel': (0.8, 'lab', 'Entonnoir'),
    'pipette': (0.25, 'lab', 'Pipette'), 'burner': (0.8, 'lab', 'Chauffe-ballon / bec'),
    'balance': (1.2, 'lab', 'Balance'), 'magnifier': (1, 'lab', 'Loupe'),
    'cell-animal': (1.15, 'cell', 'Cellule animale'), 'cell-plant': (1.3, 'cell', 'Cellule végétale'),
    'neuron': (2, 'cell', 'Neurone'), 'bacteria': (1.8, 'cell', 'Bactérie'), 'virus': (1, 'cell', 'Virus'),
    'dna': (0.5, 'cell', 'ADN'), 'chromosome': (0.6, 'cell', 'Chromosome'), 'flower': (0.7, 'cell', 'Fleur'),
    'seed': (0.8, 'cell', 'Graine en germination'),
    'foodchain': (3, 'earth', 'Chaîne alimentaire'), 'watercycle': (1.4, 'earth', "Cycle de l'eau"),
    'volcano': (1.3, 'earth', 'Volcan'), 'leaf': (0.7, 'earth', 'Feuille'),
    'heart': (0.9, 'body', 'Cœur'), 'lungs': (1, 'body', 'Poumons'), 'brain': (1.2, 'body', 'Cerveau'),
    'stomach': (0.6, 'body', 'Système digestif'), 'bone': (0.4, 'body', 'Os'), 'eye': (1.8, 'body', 'Œil'),
    'battery': (2, 'circuit', 'Pile'), 'lamp': (2, 'circuit', 'Lampe'), 'switch': (2, 'circuit', 'Interrupteur'),
    'resistor': (2, 'circuit', 'Résistance'), 'motor': (2, 'circuit', 'Moteur'), 'led': (2, 'circuit', 'DEL'),
    'ammeter': (2, 'circuit', 'Ampèremètre'), 'voltmeter': (2, 'circuit', 'Voltmètre'),
    'wire-node': (1, 'circuit', 'Nœud'),
    'lens': (0.5, 'optics', 'Lentille convergente'), 'lens-div': (0.5, 'optics', 'Lentille divergente'),
    'mirror': (0.4, 'optics', 'Miroir plan'), 'ray': (3, 'optics', 'Rayon lumineux'), 'prism': (1.2, 'optics', 'Prisme'),
    'axes': (1, 'geometry', 'Repère orthonormé'), 'number-line': (4, 'geometry', 'Droite graduée'),
    'trig-circle': (1, 'geometry', 'Cercle trigonométrique'), 'right-angle': (1, 'geometry', 'Angle droit'),
    'cube': (1, 'geometry', 'Cube (perspective)'), 'cylinder-3d': (0.7, 'geometry', 'Cylindre'),
    'label': (2.2, 'marks', 'Étiquette'), 'check': (1, 'marks', 'Coche'), 'cross': (1, 'marks', 'Croix'),
    'circle-1': (1, 'marks', 'Numéro ①'), 'circle-2': (1, 'marks', 'Numéro ②'), 'circle-3': (1, 'marks', 'Numéro ③'),
    'star-mark': (1, 'marks', 'Étoile'), 'question': (1, 'marks', "Point d'interrogation"),
    'warning': (1.1, 'marks', 'Attention'), 'curved-arrow': (1.2, 'marks', 'Flèche courbe'),
    'smiley': (1, 'marks', 'Smiley'),
}

FORMES = ('line', 'arrow', 'double-arrow', 'rect', 'rounded-rect', 'ellipse', 'triangle', 'right-triangle',
          'diamond', 'parallelogram', 'trapezoid', 'pentagon', 'hexagon', 'star', 'polygon')
OUTILS = ('timer', 'dice', 'wheel', 'noise', 'calc', 'meter', 'groups', 'clock', 'traffic', 'qr')
FONDS = ('blank', 'grid', 'lines', 'seyes', 'graph', 'axes', 'dots')
VERT = '#15803D'
FOND_VERT = '#E7F5EC'


# ---------------------------------------------------------------- un écran

class Ecran:
    """Une page. Créée par Ecrans.ecran() ou par un gabarit ; porte les primitives."""

    def __init__(self, jeu, numero, titre=None, bareme=None):
        self.jeu = jeu
        self.id = '%s-%02d' % (jeu.prefixe, numero)
        self.n = 0
        self.objets = []
        self.page = {'id': self.id, 'background': 'blank', 'strokes': [], 'objects': self.objets}
        if jeu.entete:
            self.texte(50, 20, 900, 15, jeu.entete, GRIS)
        if titre:
            html = B(titre)
            if bareme:
                html += ' <span style="color: ' + ROUGE + '; font-size: 0.6em">' + bareme + '</span>'
            if len(titre) + (0.6 * len(bareme) + 1 if bareme else 0) > int(900 / (36 * LARGEUR_CAR)):
                jeu.alertes.append('%s : le titre « %s… » risque de passer sur deux lignes et de descendre sur le '
                                   'contenu — le raccourcir.' % (self.id, titre[:30]))
            # Le bilan s'écrit toujours en rouge, titre compris (règle de Thomas)
            self.texte(50, 48, 900, 36, html, ROUGE if titre.startswith('Bilan') else BLEU)

    def _id(self):
        self.n += 1
        return self.id + '-' + str(self.n)

    def texte(self, x, y, w, taille, html, couleur=NOIR, cache=None, fond=None):
        """Zone de texte. `cache` : libellé du rideau qui la couvre (« Réponse »)."""
        o = {'id': self._id(), 'type': 'text', 'x': x, 'y': y, 'w': w, 'size': taille, 'font': 'sans',
             'color': couleur, 'html': _en_bloc(html)}
        if fond:
            o['background'] = fond
        if cache:
            o['cover'] = {'kind': 'curtain', 'color': BLEU, 'label': cache}
        self.objets.append(o)
        return o

    def reponse(self, x, y, w, taille, html, libelle='Réponse'):
        """Une réponse : en rouge, sous un rideau que l'on tire en classe."""
        return self.texte(x, y, w, taille, html, ROUGE, cache=libelle)

    def cadre(self, x, y, w, h, texte=None, fond=None, trait=TRAIT, pointille=False, taille=20, couleur=NOIR):
        """Rectangle : case d'un tableau, zone où écrire, encadré."""
        o = {'id': self._id(), 'type': 'shape', 'kind': 'rect', 'x': x, 'y': y, 'w': w, 'h': h,
             'stroke': trait, 'strokeWidth': 1.5, 'fill': fond}
        if pointille:
            o['dashed'] = True
        if texte:
            o['text'] = {'html': '<div>' + texte + '</div>', 'size': taille, 'font': 'sans', 'color': couleur}
        self.objets.append(o)
        return o

    def minuteur(self, x, y, secondes):
        o = {'id': self._id(), 'type': 'widget', 'widget': 'timer', 'x': x, 'y': y, 'w': 320, 'h': 186,
             'config': {'seconds': secondes}}
        self.objets.append(o)
        return o

    def image(self, x, y, w, h, chemin, largeur, hauteur, cache=None):
        """Image déjà envoyée (gc_envoi.py image) : `chemin` est celui que l'envoi a rendu."""
        o = {'id': self._id(), 'type': 'image', 'x': x, 'y': y, 'w': w, 'h': h, 'path': chemin,
             'naturalWidth': largeur, 'naturalHeight': hauteur}
        if cache:
            o['cover'] = {'kind': 'curtain', 'color': BLEU, 'label': cache}
        self.objets.append(o)
        return o

    # ---- réglages de la page

    def fond(self, fond='grid', couleur=None):
        """Fond de l'écran : grid, lines, seyes, graph, axes, dots ou blank ; `couleur` #rrggbb."""
        if fond not in FONDS:
            raise ValueError('fond inconnu : %s (%s)' % (fond, ', '.join(FONDS)))
        self.page['background'] = fond
        if couleur:
            self.page['color'] = couleur
        return self

    def rideau(self):
        """Un rideau couvre tout l'écran au départ : on le tire pour découvrir la page."""
        self.page['curtain'] = True
        return self

    # ---- objets supplémentaires

    def cacher(self, *objets):
        """Ces objets sont cachés au départ ; un bouton les fait apparaître (`Afficher`)."""
        for o in objets:
            o['hidden'] = True
        return objets[0] if len(objets) == 1 else objets

    def forme(self, kind, x, y, w, h, trait=TRAIT, fond=None, epaisseur=2, texte=None, taille=22,
              couleur=NOIR, pointille=False, rotation=None, de=None, vers=None):
        """
        Forme du tableau (`FORMES`). Pour line / arrow / double-arrow, `de` et `vers` donnent les
        extrémités en fraction de la boîte (par défaut du coin haut-gauche au coin bas-droit) :
        `forme('arrow', 100, 300, 200, 1, de=(0, 0.5), vers=(1, 0.5))` = flèche horizontale.
        """
        if kind not in FORMES:
            raise ValueError('forme inconnue : %s' % kind)
        o = {'id': self._id(), 'type': 'shape', 'kind': kind, 'x': x, 'y': y, 'w': w, 'h': h,
             'stroke': trait, 'strokeWidth': epaisseur, 'fill': fond}
        if pointille:
            o['dashed'] = True
        if rotation:
            o['rotation'] = rotation
        if de is not None:
            o['a'] = {'x': de[0], 'y': de[1]}
        if vers is not None:
            o['b'] = {'x': vers[0], 'y': vers[1]}
        if texte and kind not in ('line', 'arrow', 'double-arrow'):
            o['text'] = {'html': _en_bloc(texte), 'size': taille, 'font': 'sans', 'color': couleur}
        self.objets.append(o)
        return o

    def bouton(self, x, y, w, h, texte, actions, couleur=BLEU2, taille=22, texte_couleur='#FFFFFF', forme='rounded-rect'):
        """
        Un bouton : une forme pleine avec son libellé, qui joue `actions` quand on la touche
        (`Afficher`, `Decouvrir`, `DeplacerVers`, `AllerA`, `Ouvrir`, `Lancer`…).
        """
        o = self.forme(forme, x, y, w, h, trait=couleur, fond=couleur, epaisseur=1.5, texte=B(texte),
                       taille=taille, couleur=texte_couleur)
        o['interactions'] = list(actions)
        # Libellé en gras, émojis compris : environ 15 % plus large que le texte courant (mesuré le
        # 15/11/2026 : « 💡 Coup de pouce » en 18 passait sur deux lignes dans 180 de large)
        if hauteur_texte(_en_bloc(B(texte)), (w - 24) / 1.15, taille) > taille * INTERLIGNE * max(1, int(h // (taille * INTERLIGNE))):
            self.jeu.alertes.append('%s : le libellé du bouton « %s » ne tient pas — l’élargir ou le raccourcir.' % (self.id, texte[:30]))
        return o

    def zone(self, x, y, w, h, actions):
        """Zone cliquable invisible (en pointillé fin dans l'éditeur), posée sur une image ou un dessin."""
        o = {'id': self._id(), 'type': 'shape', 'kind': 'rect', 'x': x, 'y': y, 'w': w, 'h': h,
             'stroke': BLEU2, 'strokeWidth': 1.5, 'fill': None, 'hotspot': True, 'interactions': list(actions)}
        self.objets.append(o)
        return o

    def suivant(self, x, y, etapes, libelle='Suivant ▶', w=200, h=54, rejouer=True, couleur=BLEU2):
        """
        Un bouton « Suivant » qui déroule des étapes, une par toucher. `etapes` : liste de listes
        d'actions (étape 1 = ce que fait le premier toucher…). Fabriqué avec un bouton par étape,
        empilés au même endroit : chacun joue son étape, se cache et montre le suivant. Le dernier
        devient « ↺ Rejouer » (remise à zéro de la page) si `rejouer`.
        """
        boutons = []
        for i, actions in enumerate(etapes):
            texte = '%s %d/%d' % (libelle, i + 1, len(etapes)) if len(etapes) > 1 else libelle
            b = self.bouton(x, y, w, h, texte, list(actions), couleur=couleur)
            if i > 0:
                b['hidden'] = True
            boutons.append(b)
        fin = None
        if rejouer:
            fin = self.bouton(x, y, w, h, '↺ Rejouer', [Reinitialiser()], couleur=GRIS)
            fin['hidden'] = True
        suite = boutons[1:] + ([fin] if fin else [None])
        for b, nxt in zip(boutons, suite):
            b['interactions'].append(Masquer(b))
            if nxt:
                b['interactions'].append(Afficher(nxt))
        return boutons

    def fleche(self, de, vers, libelle=None, couleur=TRAIT, epaisseur=3, courbe=False, pointes=(False, True), pointille=False):
        """
        Flèche (connecteur). `de` / `vers` : un objet (la flèche s'y accroche et le suit) ou un
        point (x, y). Une flèche n'a pas de place à elle : elle est dessinée entre ses deux bouts.
        """
        def bout(v):
            if isinstance(v, dict):
                return {'objectId': v['id'], 'side': 'auto'}, (v['x'] + v['w'] / 2, v['y'] + v.get('h', 40) / 2)
            return {'x': v[0], 'y': v[1]}, (v[0], v[1])
        a, pa = bout(de)
        b, pb = bout(vers)
        o = {'id': self._id(), 'type': 'connector', 'x': min(pa[0], pb[0]), 'y': min(pa[1], pb[1]),
             'w': abs(pb[0] - pa[0]) or 1, 'h': abs(pb[1] - pa[1]) or 1, 'from': a, 'to': b,
             'route': 'curve' if courbe else 'straight', 'heads': {'start': pointes[0], 'end': pointes[1]},
             'stroke': couleur, 'strokeWidth': epaisseur}
        if pointille:
            o['dashed'] = True
        if libelle:
            o['label'] = libelle
        self.objets.append(o)
        return o

    def dessin(self, item, x, y, w, couleur=BLEU_FONCE, fond=None, epaisseur=3):
        """Dessin vectoriel de la bibliothèque du tableau (`DESSINS` : cellule, neurone, cœur, volcan…)."""
        if item not in DESSINS:
            raise ValueError('dessin inconnu : %s' % item)
        o = {'id': self._id(), 'type': 'library', 'item': item, 'x': x, 'y': y, 'w': w,
             'h': round(w / DESSINS[item][0], 1), 'stroke': couleur, 'fill': fond, 'strokeWidth': epaisseur}
        self.objets.append(o)
        return o

    def tableau_fixe(self, x, y, w, lignes, entete=True, taille=22, largeurs=None, couleur=NOIR):
        """
        Vrai tableau du tableau blanc (texte fixe, sans cache) : un document chiffré, des données.
        `lignes` : liste de listes de HTML ; `largeurs` : fractions qui somment à 1.
        Pour un tableau à compléter dont les réponses sont sous cache, utiliser le gabarit `tableau`.
        """
        cols = max(len(l) for l in lignes)
        cells = [[_en_bloc(c) for c in l] + ['<div><br></div>'] * (cols - len(l)) for l in lignes]
        fr = largeurs or [1 / cols] * cols
        pad = taille * 0.35
        h = sum(max(hauteur_texte(c, fr[i] * w - pad * 2, taille) for i, c in enumerate(r)) + pad * 2 for r in cells)
        o = {'id': self._id(), 'type': 'table', 'x': x, 'y': y, 'w': w, 'h': round(h), 'rows': len(cells), 'cols': cols,
             'cells': cells, 'header': entete, 'size': taille, 'font': 'sans', 'color': couleur}
        if largeurs:
            o['colWidths'] = list(largeurs)
        if y + h > BAS + 15:
            self.jeu.alertes.append('%s : le tableau descendrait jusqu’à %d environ — le raccourcir.' % (self.id, y + h))
        self.objets.append(o)
        return o

    def fenetre(self, titre, html, x=740, y=500, image=None):
        """
        Fenêtre ouverte par un bouton (`Ouvrir`) : coup de pouce, définition, document complet.
        Invisible sur l'écran en classe ; une petite carte la montre dans l'éditeur, en (x, y).
        `image` : dict(chemin, largeur, hauteur) d'une image déjà envoyée.
        """
        o = {'id': self._id(), 'type': 'window', 'x': x, 'y': y, 'w': 220, 'h': 56, 'title': titre, 'html': _en_bloc(html)}
        if image:
            o.update(imagePath=image['chemin'], imageW=image['largeur'], imageH=image['hauteur'])
        self.objets.append(o)
        return o

    def coup_de_pouce(self, html, titre='Coup de pouce', x=730, y=480, w=230, h=48):
        """Un bouton « 💡 Coup de pouce » qui ouvre une aide : pour les élèves qui bloquent."""
        f = self.fenetre(titre, html, x=max(0, x - 240), y=y - 4)
        return self.bouton(x, y, w, h, '💡 ' + titre, [Ouvrir(f)], couleur='#B45309', taille=18)

    def outil(self, kind, x, y, w=320, h=186, **config):
        """Outil de classe : timer (seconds), dice (faces), wheel (entries), groups (groupSize),
        traffic, clock, noise, meter, calc, qr (text)."""
        if kind not in OUTILS:
            raise ValueError('outil inconnu : %s' % kind)
        o = {'id': self._id(), 'type': 'widget', 'widget': kind, 'x': x, 'y': y, 'w': w, 'h': h, 'config': config}
        self.objets.append(o)
        return o

    def video(self, x, y, w, url, titre=None):
        """Vidéo YouTube (ou Vimeo, Dailymotion, PeerTube), en 16:9."""
        yt = re.search(r'(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([\w-]{11})', url)
        o = {'id': self._id(), 'type': 'video', 'x': x, 'y': y, 'w': w, 'h': round(w * 9 / 16, 1), 'url': url,
             'provider': 'youtube' if yt else 'embed'}
        if titre:
            o['title'] = titre
        self.objets.append(o)
        return o

    def site(self, x, y, w, h, url, titre=None, interactif=True):
        """Page web en direct dans l'écran (une animation hébergée, un simulateur). Elle doit accepter
        d'être affichée dans un cadre ; à vérifier dans l'application."""
        o = {'id': self._id(), 'type': 'web', 'x': x, 'y': y, 'w': w, 'h': h, 'url': url, 'interactive': interactif}
        if titre:
            o['title'] = titre
        self.objets.append(o)
        return o


# ---------------------------------------------------------------- un jeu d'écrans

class Ecrans:
    """
    Les écrans d'une activité. `prefixe` : court, sans accent, propre à l'activité (« weg ») — il
    commence l'identifiant de chaque page et de chaque objet. `entete` : la ligne discrète en haut
    de chaque écran (« Activité 3 · Wegener et la dérive des continents »).
    """

    def __init__(self, prefixe, entete=None):
        if not re.match(r'^[A-Za-z0-9]{1,12}$', prefixe):
            raise ValueError('prefixe : lettres et chiffres seulement, 12 au plus')
        self.prefixe = prefixe
        self.entete = entete
        self.pages = []
        self.alertes = []
        self._trous = 0

    # ---- primitives

    def ecran(self, titre=None, bareme=None):
        """Un écran vide (avec son en-tête et son titre), à remplir avec les primitives."""
        e = Ecran(self, len(self.pages) + 1, titre, bareme)
        self.pages.append(e.page)
        return e

    def trou(self, mot):
        """Un mot à trouver dans un texte à trous (révélé d'un toucher en classe)."""
        self._trous += 1
        return '<span data-gap="%s-g%d">%s</span>' % (self.prefixe, self._trous, mot)

    # ---- mise en page des gabarits

    def _empiler(self, e, blocs, haut=HAUT, bas=BAS, x=MARGE, largeur=LARGEUR, repartir=True):
        """
        Pose des blocs de texte l'un sous l'autre. Chaque bloc : dict(html, taille, couleur, fond,
        cache, fixe, colle). `colle` : le bloc reste sous le précédent (une réponse sous son intitulé). Si le tout ne tient pas, la taille des blocs non fixes descend de 2 en 2
        jusqu'à TAILLE_MIN ; au-delà, une alerte est notée et le contenu déborde. S'il reste de la
        place, elle est répartie entre les blocs (60 au plus par intervalle).
        """
        blocs = [dict(b) for b in blocs]
        libre = bas - haut

        def total():
            h = [hauteur_texte(_en_bloc(b['html']), largeur, b['taille'], bool(b.get('fond'))) for b in blocs]
            esp = [b['taille'] * (0.15 if blocs[i + 1].get('colle') else 0.55) for i, b in enumerate(blocs[:-1])]
            return h, esp, sum(h) + sum(esp)

        h, esp, somme = total()
        while somme > libre and any(not b.get('fixe') and b['taille'] > TAILLE_MIN for b in blocs):
            for b in blocs:
                if not b.get('fixe') and b['taille'] > TAILLE_MIN:
                    b['taille'] = max(TAILLE_MIN, b['taille'] - 2)
            h, esp, somme = total()
        if somme > libre:
            self.alertes.append('%s : le contenu demande environ %d de haut pour %d disponibles — raccourcir '
                                'ou couper en deux écrans.' % (e.id, round(somme), round(libre)))
        reste = max(0, libre - somme)
        souples = [i for i in range(len(esp)) if not blocs[i + 1].get('colle')]
        plus = min(60, reste / len(souples)) if (repartir and souples) else 0
        y = haut
        for i, b in enumerate(blocs):
            e.texte(x, round(y), largeur, b['taille'], b['html'], b.get('couleur', NOIR), cache=b.get('cache'), fond=b.get('fond'))
            if i < len(esp):
                y += h[i] + esp[i] + (plus if i in souples else 0)
        return y + (h[-1] if blocs else 0)

    # ---- gabarits

    def titre(self, sequence, activite, titre, problematique=None):
        """Écran d'ouverture : la séquence, l'activité, son titre, la problématique."""
        e = Ecran(self, len(self.pages) + 1)
        self.pages.append(e.page)
        e.texte(MARGE, 80, LARGEUR, 22, sequence, GRIS)
        e.texte(MARGE, 135, LARGEUR, 30, activite, BLEU2)
        taille = 58
        if hauteur_texte(_en_bloc(B(titre)), LARGEUR, taille) > 2 * taille * INTERLIGNE + 1:
            taille = 46
            if hauteur_texte(_en_bloc(B(titre)), LARGEUR, taille) > 3 * taille * INTERLIGNE + 1:
                self.alertes.append('%s : le titre est trop long pour l’écran d’ouverture — le raccourcir.' % e.id)
        e.texte(MARGE, 180, LARGEUR, taille, B(titre), BLEU)
        if problematique:
            html = B('Problématique :') + ' ' + I(problematique)
            taille = 28
            while taille > TAILLE_MIN and 385 + hauteur_texte(_en_bloc(html), LARGEUR, taille, True) > 545:
                taille -= 2
            if 385 + hauteur_texte(_en_bloc(html), LARGEUR, taille, True) > 545:
                self.alertes.append('%s : la problématique est trop longue — la raccourcir.' % e.id)
            e.texte(MARGE, 385, LARGEUR, taille, html, NOIR, fond=FOND_ROSE)
        return e

    def situation(self, paragraphes, question=None, titre='Situation de départ'):
        """Le point de départ, en deux ou trois phrases courtes ; la question que l'on se pose, en rouge."""
        e = self.ecran(titre)
        blocs = [{'html': p, 'taille': 32} for p in paragraphes]
        if question:
            blocs.append({'html': B(question), 'taille': 30, 'couleur': ROUGE})
        self._empiler(e, blocs, haut=130)
        return e

    def consigne(self, titre, etapes, minuteur=None, note=None, bareme=None):
        """
        Ce que les élèves font : `etapes` est une liste de (verbe, suite) — « Découpe », « les deux
        continents. ». `minuteur` en secondes, posé à droite. `note` : une précision, en gris, en bas.
        """
        e = self.ecran(titre, bareme)
        largeur = 560 if minuteur else LARGEUR
        html = ''.join('<div>' + B('%d. %s' % (i + 1, verbe)) + ' ' + suite + '</div>' for i, (verbe, suite) in enumerate(etapes))
        bas = 450 if note else BAS
        self._empiler(e, [{'html': html, 'taille': 30}], haut=125, bas=bas, largeur=largeur)
        if minuteur:
            e.minuteur(640, 130, minuteur)
        if note:
            e.texte(MARGE, 470, LARGEUR, 22, note, GRIS)
        return e

    def document(self, titre, paragraphes=(), encadre=None, image=None, legende=None):
        """
        Un document en grand. `paragraphes` : le texte, raccourci. `encadre` : la phrase à retenir,
        sur fond bleu. `image` : dict(chemin, largeur, hauteur) d'une image déjà envoyée ; elle prend
        la place, la `legende` dessous.
        """
        e = self.ecran(titre)
        if image:
            place_h = 360 if legende else 400
            echelle = min(LARGEUR / image['largeur'], place_h / image['hauteur'])
            w, h = round(image['largeur'] * echelle), round(image['hauteur'] * echelle)
            e.image(round((PAGE_L - w) / 2), HAUT, w, h, image['chemin'], image['largeur'], image['hauteur'])
            if legende:
                e.texte(MARGE, HAUT + h + 14, LARGEUR, 22, legende, GRIS)
            return e
        blocs = [{'html': p, 'taille': 26} for p in paragraphes]
        if encadre:
            blocs.append({'html': encadre, 'taille': 26, 'fond': '#EEF3F9'})
        self._empiler(e, blocs)
        return e

    def question(self, titre, enonce, reponses, bareme=None):
        """
        Une question par écran. `reponses` : liste de (intitulé ou None, réponse) ; chaque réponse est
        en rouge sous un rideau, à tirer pendant la correction.
        """
        e = self.ecran(titre, bareme)
        blocs = [{'html': enonce, 'taille': 28}]
        for intitule, reponse in reponses:
            if intitule:
                blocs.append({'html': B(intitule), 'taille': 24, 'couleur': BLEU, 'fixe': True})
            blocs.append({'html': reponse, 'taille': 26, 'couleur': ROUGE, 'cache': 'Réponse', 'colle': bool(intitule)})
        self._empiler(e, blocs)
        return e

    def tableau(self, titre, entetes, lignes, bareme=None, par_ecran=2, largeur_1=200, taille=None):
        """
        Tableau à compléter : la première colonne nomme la ligne, les autres portent une réponse sous
        cache. `lignes` : liste de listes (intitulé, réponse, réponse…). Deux lignes par écran par
        défaut ; au-delà, le tableau continue sur l'écran suivant (« 1/2 », « 2/2 »).
        `taille` des réponses : sans indication, 22 si toutes tiennent dans leur case, 20 sinon.
        """
        x0 = 50
        autres = (PAGE_L - 2 * x0 - largeur_1) / (len(entetes) - 1)
        xs = [x0] + [x0 + largeur_1 + autres * i for i in range(len(entetes) - 1)]
        ws = [largeur_1] + [autres] * (len(entetes) - 1)
        ecrans = [lignes[i:i + par_ecran] for i in range(0, len(lignes), par_ecran)]
        haut_ligne = (532 - 152) / par_ecran
        if taille is None:
            tient = all(hauteur_texte(_en_bloc(r), w - 20, TAILLE_MIN) <= haut_ligne - 20
                        for ligne in lignes for w, r in zip(ws[1:], ligne[1:]))
            taille = TAILLE_MIN if tient else 20
        crees = []
        for k, groupe in enumerate(ecrans):
            suffixe = ' (%d/%d)' % (k + 1, len(ecrans)) if len(ecrans) > 1 else ''
            e = self.ecran(titre + suffixe, bareme if k == 0 else None)
            for x, w, nom in zip(xs, ws, entetes):
                e.cadre(x, 112, w, 40, B(nom), fond=FOND_BLEU, taille=20, couleur=BLEU_FONCE)
            for i, ligne in enumerate(groupe):
                y = 152 + i * haut_ligne
                e.cadre(xs[0], y, ws[0], haut_ligne, B(ligne[0]), taille=19)
                for x, w in zip(xs[1:], ws[1:]):
                    e.cadre(x, y, w, haut_ligne)
                for x, w, reponse in zip(xs[1:], ws[1:], ligne[1:]):
                    if hauteur_texte(_en_bloc(reponse), w - 20, taille) > haut_ligne - 20:
                        self.alertes.append('%s : « %s… » ne tient pas dans sa case.' % (e.id, reponse[:30]))
                    e.reponse(x + 10, y + 10, w - 20, taille, reponse)
            crees.append(e)
        return crees

    def calcul(self, titre, enonce, etapes, bareme=None):
        """Un calcul : l'énoncé, une grande zone où le poser au stylet, et les étapes sous cache à droite."""
        e = self.ecran(titre, bareme)
        e.texte(MARGE, 118, LARGEUR, 28, enonce)
        # Le cadre commence sous l'énoncé : à 205 pour deux lignes, plus bas s'il en fait trois.
        haut = max(205, round(118 + hauteur_texte(_en_bloc(enonce), LARGEUR, 28) + 12))
        h = 515 - haut
        if h < 180:
            self.alertes.append('%s : l’énoncé ne laisse que %d de haut pour poser le calcul — le raccourcir.' % (e.id, h))
        e.cadre(MARGE, haut, 540, h, trait=TRAIT_CLAIR)
        pas = min(85, h / max(1, len(etapes)))
        for i, etape in enumerate(etapes):
            e.reponse(630, round(haut + i * pas), 320, 24, etape)
        return e

    def bilan(self, html, titre='Bilan', taille=None):
        """
        Le bilan, toujours en rouge. Écrire les mots à trouver avec trou() pour un texte à trous.
        `taille` : sans indication, 26, réduite jusqu'à 22 si l'estimation ne tient pas ; l'imposer
        quand le rendu a été contrôlé dans l'application (l'estimation compte large).
        """
        e = self.ecran(titre)
        impose = taille is not None
        taille = taille or 26
        while not impose and taille > TAILLE_MIN and hauteur_texte(_en_bloc(html), LARGEUR, taille) > BAS - 112:
            taille -= 2
        if not impose and hauteur_texte(_en_bloc(html), LARGEUR, taille) > BAS - 112:
            self.alertes.append('%s : le bilan ne tient pas sur un écran en taille %d — le raccourcir.' % (e.id, taille))
        e.texte(MARGE, 112, LARGEUR, taille, html, ROUGE)
        return e

    # ---- gabarits interactifs (boutons, objets cachés, déplacements)

    @staticmethod
    def _placer_image(e, image, x, y, wmax, hmax):
        """Pose une image déjà envoyée dans la boîte (x, y, wmax, hmax), centrée ; rend (objet, échelle)."""
        k = min(wmax / image['largeur'], hmax / image['hauteur'])
        w, h = round(image['largeur'] * k), round(image['hauteur'] * k)
        o = e.image(round(x + (wmax - w) / 2), round(y + (hmax - h) / 2), w, h, image['chemin'],
                    image['largeur'], image['hauteur'])
        return o

    def etapes(self, titre, etapes, image=None, dessin=None, libelle='Suivant ▶', bareme=None):
        """
        Un processus dévoilé étape par étape : chaque toucher sur « Suivant » fait apparaître
        l'étape suivante (texte numéroté). `etapes` : liste de (intitulé, explication) ou de textes.
        Avec `image` (dict chemin, largeur, hauteur) ou `dessin` (identifiant de DESSINS),
        l'illustration occupe la gauche et les étapes la droite.
        """
        e = self.ecran(titre, bareme)
        x, largeur = MARGE, LARGEUR
        if image or dessin:
            if image:
                self._placer_image(e, image, 40, 115, 430, 360)
            else:
                ratio = DESSINS[dessin][0]
                w = min(430, 360 * ratio)
                e.dessin(dessin, round(40 + (430 - w) / 2), round(115 + (360 - w / ratio) / 2), round(w))
            x, largeur = 500, 460
        blocs = []
        for i, et in enumerate(etapes):
            intitule, texte = et if isinstance(et, (tuple, list)) else (None, et)
            html = B('%s %s' % ('①②③④⑤⑥⑦⑧⑨'[i] if i < 9 else '%d.' % (i + 1), intitule or '')) + (' ' if intitule else '') + texte
            blocs.append({'html': html, 'taille': 26})
        debut = len(e.objets)
        self._empiler(e, blocs, haut=118, bas=455, x=x, largeur=largeur, repartir=False)
        caches = e.objets[debut:]
        for o in caches:
            o['hidden'] = True
        e.suivant(PAGE_L - 50 - 210, 478, [[Afficher(o)] for o in caches], libelle=libelle, w=210)
        return e

    def schema(self, titre, legendes, image=None, dessin=None, mode='suivant', bareme=None):
        """
        Un schéma à légender devant la classe. `legendes` : liste de (texte, (fx, fy)) où (fx, fy)
        est le point visé, en fraction de l'illustration (0,0 = coin haut-gauche, 1,1 = bas-droit).
        Les étiquettes se rangent dans la colonne de droite, reliées à leur point par une flèche.
        `mode='suivant'` : un bouton les fait apparaître une à une ; `mode='toucher'` : toucher le
        point sur le schéma montre ou cache son étiquette (schéma cliquable).
        """
        e = self.ecran(titre, bareme)
        bx, by, bw, bh = 40, 110, 560, 420
        if image:
            o = self._placer_image(e, image, bx, by, bw, bh)
        elif dessin:
            ratio = DESSINS[dessin][0]
            w = min(bw, bh * ratio)
            o = e.dessin(dessin, round(bx + (bw - w) / 2), round(by + (bh - w / ratio) / 2), round(w))
        else:
            raise ValueError('schema : donner image= ou dessin=')
        points = [(t, (o['x'] + fx * o['w'], o['y'] + fy * o['h'])) for t, (fx, fy) in legendes]
        # étiquettes dans l'ordre vertical des points, sans se chevaucher
        ordre = sorted(range(len(points)), key=lambda i: points[i][1][1])
        # Une étiquette (taille 24, sur fond) fait 24 × 1,34 + 24 ≈ 56 de haut : pas de 62. La
        # colonne s'arrête à 425 pour laisser le bouton « Suivant » (en 490) dégagé.
        pas, plus_bas = 62, 425
        ys, bas_prec = {}, 105
        for i in ordre:                       # de haut en bas : chaque étiquette face à son point
            ys[i] = max(points[i][1][1] - 28, bas_prec)
            bas_prec = ys[i] + pas
        plafond = plus_bas
        for i in reversed(ordre):             # de bas en haut : on ne remonte que ce qui dépasse
            ys[i] = min(ys[i], plafond)
            plafond = ys[i] - pas
        if min(ys.values()) < 100:
            self.alertes.append('%s : trop d’étiquettes pour la colonne (5 au plus) — en retirer ou couper le schéma.' % e.id)
        etiquettes = []
        for i, (texte, (px, py)) in enumerate(points):
            lab = e.texte(650, round(ys[i]), 300, 24, B(texte), BLEU_FONCE, fond=FOND_BLEU)
            fl = e.fleche(lab, (round(px), round(py)), couleur=BLEU_FONCE, epaisseur=2.5)
            e.cacher(lab, fl)
            etiquettes.append((lab, fl, (px, py)))
        if mode == 'toucher':
            for lab, fl, (px, py) in etiquettes:
                e.zone(round(px - 22), round(py - 22), 44, 44, [Basculer(lab), Basculer(fl)])
            e.texte(MARGE, 538, LARGEUR, 15, I('Toucher un point du schéma montre sa légende.'), GRIS)
        else:
            e.suivant(PAGE_L - 50 - 210, 490, [[Afficher(lab), Afficher(fl)] for lab, fl, _ in etiquettes], w=210)
        return e

    def vrai_faux(self, titre, affirmations, bareme=None):
        """
        Vrai ou faux, une ligne par affirmation (4 au plus par écran) : on vote, puis le bouton
        « Verdict » de la ligne montre VRAI / FAUX et l'explication. `affirmations` : liste de
        (texte, vrai, explication). Idéal pour déconstruire une idée fausse.
        """
        if len(affirmations) > 4:
            self.alertes.append('vrai_faux « %s » : %d affirmations, 4 au plus par écran.' % (titre, len(affirmations)))
        e = self.ecran(titre, bareme)
        haut = (BAS - 112) / max(1, len(affirmations))
        for i, (texte, vrai, explication) in enumerate(affirmations):
            y = round(112 + i * haut)
            e.texte(MARGE, y, 650, 24, texte)
            verdict = e.forme('rounded-rect', 740, y, 200, 46, trait=VERT if vrai else ROUGE, fond=FOND_VERT if vrai else FOND_ROSE,
                              texte=B('VRAI' if vrai else 'FAUX'), taille=24, couleur=VERT if vrai else ROUGE)
            ex = e.texte(MARGE + 20, round(y + hauteur_texte(_en_bloc(texte), 650, 24) + 4), 630, 22,
                         I(explication), VERT if vrai else ROUGE)
            e.cacher(verdict, ex)
            b = e.bouton(740, y, 200, 46, 'Verdict', [Afficher(verdict), Afficher(ex)], couleur=GRIS)
            b['interactions'].append(Masquer(b))
            if hauteur_texte(_en_bloc(texte), 650, 24) + hauteur_texte(_en_bloc(explication), 630, 22) + 8 > haut:
                self.alertes.append('%s : la ligne %d (« %s… ») et son explication ne tiennent pas — raccourcir.' % (e.id, i + 1, texte[:25]))
        return e

    def qcm(self, titre, question, choix, bonne, explication=None, bareme=None):
        """
        Question à choix (2 à 4) : on vote à main levée ou sur ardoise, puis on touche un choix —
        une coche verte ou une croix rouge apparaît à côté. `bonne` : indice (0 = A) de la bonne
        réponse. `explication` : sous rideau, en bas.
        """
        e = self.ecran(titre, bareme)
        bas_q = self._empiler(e, [{'html': question, 'taille': 28}], haut=112, bas=230, repartir=False)
        lettres = 'ABCD'
        y0 = max(round(bas_q) + 18, 200)
        dispo = (440 if explication else BAS) - y0
        h = min(64, (dispo - 12 * (len(choix) - 1)) / len(choix))
        for i, c in enumerate(choix):
            y = round(y0 + i * (h + 12))
            marque = e.dessin('check' if i == bonne else 'cross', 830, y + 2, round(h - 4),
                              couleur=VERT if i == bonne else ROUGE, epaisseur=5)
            e.cacher(marque)
            e.bouton(MARGE, y, 740, round(h), lettres[i] + '.  ' + c, [Afficher(marque)], couleur='#E2E8F0',
                     texte_couleur=BLEU_FONCE, taille=22)
        if explication:
            e.reponse(MARGE, 455, LARGEUR, 22, explication, 'Explication')
        return e

    def loupe(self, titre, image, zones, legende=None):
        """
        Un document en grand avec des zones à agrandir : toucher une zone cadre la vue dessus
        (toucher à côté revient). `zones` : liste de (fx, fy, fw, fh) en fraction de l'image, ou de
        (fx, fy, fw, fh, libellé) — le libellé s'écrit en petit au-dessus de la zone.
        """
        e = self.ecran(titre)
        o = self._placer_image(e, image, MARGE, 105, LARGEUR, 400 if legende else 430)
        for z in zones:
            fx, fy, fw, fh = z[:4]
            x, y, w, h = round(o['x'] + fx * o['w']), round(o['y'] + fy * o['h']), round(fw * o['w']), round(fh * o['h'])
            zz = e.zone(x, y, w, h, [])
            zz['interactions'] = [Zoomer(zz)]
            if len(z) > 4:
                e.texte(x, max(95, y - 26), max(w, 160), 18, B('🔍 ' + z[4]), BLEU2)
        if legende:
            e.texte(MARGE, 515, LARGEUR, 20, legende, GRIS)
        return e

    def sommaire(self, titre, entrees, position=None):
        """
        Un écran de boutons qui mènent chacun à un écran (correction par question, parcours au
        choix). `entrees` : liste de (libellé, écran). `position` : rang où ranger ce sommaire
        (0 = en premier) ; sans indication, à la suite.
        """
        e = self.ecran(titre)
        if position is not None:
            self.pages.insert(position, self.pages.pop())
        n = len(entrees)
        cols = 1 if n <= 4 else 2
        par_col = -(-n // cols)
        w = (LARGEUR - 30 * (cols - 1)) / cols
        h = min(70, (BAS - 120 - 14 * (par_col - 1)) / par_col)
        for i, (libelle, cible) in enumerate(entrees):
            c, r = divmod(i, par_col)
            e.bouton(round(MARGE + c * (w + 30)), round(120 + r * (h + 14)), round(w), round(h), libelle,
                     [AllerA(cible)], couleur=BLEU2, taille=24)
        return e

    # ---- sortie

    def ecrire(self, chemin):
        """Écrit le fichier des écrans. À ranger dans course-drafts/ecrans/, puis `npm run screens:check`."""
        with open(chemin, 'w', encoding='utf8') as f:
            json.dump(self.pages, f, ensure_ascii=False)
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
        print('%d écrans, %d objets -> %s' % (len(self.pages), sum(len(p['objects']) for p in self.pages), chemin))
        for a in self.alertes:
            print('  ! ' + a)
        print('À faire maintenant : npm run screens:check (dans gestion-classe-web).')
        return chemin
