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
