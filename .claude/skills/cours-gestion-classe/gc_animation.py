"""Animations du tableau de Gestion Classe : assemble une scène en un fichier HTML autonome.

Une animation est un objet du tableau (`type: 'animation'`, voir `lib/boardAnimation.ts`) : une
scène dessinée en SVG, redessinée à chaque image, découpée en étapes que les boutons du tableau
font avancer. Ce module colle ensemble :

  - `animation/gabarit.html` : la page (titre de l'étape, scène, légende) ;
  - `animation/lecteur.js`   : le lecteur (étapes, pilotage par le tableau, lecture seule au clavier) ;
  - `animation/outils.js`    : temps, interpolation, texte, flèches ;
  - `animation/banque/*.js`  : les dessins réutilisables d'un thème (immunité…) ;
  - la scène : `GC.play({ identifiant: { dur, draw(t) { … } }, … })`.

Les textes (titre et légende de chaque étape) sont à part, dans `etapes` : ils se réécrivent sans
toucher au dessin, par Claude ou par Thomas dans l'application.

    code = assembler('Comment les anticorps nous défendent-ils ?', ETAPES, scene_js, banques=['immunite'])
    apercu('anticorps.html', 'e4.png', etape=4, instant=5)   # image de contrôle, Chrome sans fenêtre
    image = gc_envoi.envoyer_image(affiche(code, 'affiche.png'))  # ce que montrent vignettes et PDF
    e.animation(code, affiche=image)                    # gc_ecrans : pose l'objet et ses boutons
"""
import json
import os
import re
import subprocess
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.join(ICI, 'animation')
CODE_MAX = 300_000  # même plafond que l'application (ANIMATION_MAX_CHARS)
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

ROUGE_BILAN = '#C00000'


class AnimationRefusee(Exception):
    pass


def _lire(*chemin):
    with open(os.path.join(DOSSIER, *chemin), encoding='utf-8') as f:
        return f.read()


def etape(identifiant, titre, legende, duree=None, bilan=False):
    """Une étape : son identifiant (celui de la scène), son titre, sa légende (<b> pour les mots clés).
    `bilan=True` : titre et légende en rouge (règle de Thomas : un bilan s'écrit en rouge)."""
    e = {'id': identifiant, 'title': titre, 'caption': legende}
    if duree:
        e['dur'] = duree
    if bilan:
        e['color'] = ROUGE_BILAN
        e['captionColor'] = ROUGE_BILAN
    return e


def assembler(titre, etapes, scene, banques=(), largeur=1600, hauteur=760, proportion=1.9):
    """Rend le code HTML de l'animation.
    `etapes` : liste d'`etape(...)`, dans l'ordre de lecture ; `scene` : le JavaScript de la scène ;
    `proportion` : largeur / hauteur conseillée du cadre posé sur l'écran."""
    if not etapes:
        raise AnimationRefusee('Une animation a au moins une étape.')
    ids = [e.get('id') for e in etapes]
    if len(set(ids)) != len(ids) or not all(isinstance(i, str) and re.fullmatch(r'[a-z][a-z0-9_]*', i) for i in ids):
        raise AnimationRefusee('Chaque étape a un identifiant distinct (minuscules, chiffres, _).')
    for i in ids:
        if not re.search(r'\b' + re.escape(i) + r'\s*:', scene):
            raise AnimationRefusee('La scène ne dessine pas l\'étape « %s ».' % i)
    donnees = {'version': 1, 'title': titre, 'ratio': proportion, 'steps': etapes}
    # « </ » ne doit pas fermer le bloc <script> qui porte les données
    bloc = json.dumps(donnees, ensure_ascii=False, indent=1).replace('</', '<\\/')
    code = _lire('gabarit.html')
    for cle, valeur in (('__TITRE__', titre.replace('&', '&amp;').replace('<', '&lt;')), ('__DONNEES__', bloc),
                        ('__LARGEUR__', str(largeur)), ('__HAUTEUR__', str(hauteur)),
                        ('__LECTEUR__', _lire('lecteur.js')), ('__OUTILS__', _lire('outils.js')),
                        ('__BANQUES__', '\n'.join(_lire('banque', b + '.js') for b in banques)),
                        ('__SCENE__', scene)):
        code = code.replace(cle, valeur)
    if len(code) > CODE_MAX:
        raise AnimationRefusee('Animation trop lourde : %d caractères (%d au plus).' % (len(code), CODE_MAX))
    if re.search(r'(src|href)\s*=\s*["\']?\s*(https?:)?//', code, re.I):
        raise AnimationRefusee('Une animation ne charge rien du réseau : tout doit être dans le fichier.')
    return code


def etapes_de(code):
    """Les étapes annoncées par un code d'animation (bloc JSON « gc-anim »), ou None hors contrat."""
    m = re.search(r'<script\b[^>]*\bid\s*=\s*["\']gc-anim["\'][^>]*>([\s\S]*?)</script>', code, re.I)
    if not m:
        return None
    try:
        return json.loads(m.group(1)).get('steps')
    except ValueError:
        return None


def ecrire(code, chemin):
    os.makedirs(os.path.dirname(os.path.abspath(chemin)), exist_ok=True)
    with open(chemin, 'w', encoding='utf-8', newline='\n') as f:
        f.write(code)
    return chemin


def apercu(chemin_html, sortie_png, etape=1, instant=0.0, largeur=960, hauteur=506):
    """Image de contrôle d'une étape figée à `instant` secondes (Chrome sans fenêtre).
    La taille par défaut est celle du cadre posé par `gc_ecrans` sur un écran de 1000 x 562,5."""
    url = 'file:///' + os.path.abspath(chemin_html).replace('\\', '/') + '#%d,%s' % (etape, instant)
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--window-size=%d,%d' % (largeur, hauteur), '--virtual-time-budget=1500',
                    '--screenshot=' + os.path.abspath(sortie_png), url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    return sortie_png


def affiche(code, sortie_png, etape=1, instant=3.5, largeur=960, hauteur=506):
    """L'image de l'animation : une étape figée, pour les vignettes et l'export PDF du tableau (où
    l'animation ne peut pas être jouée). À envoyer avec `gc_envoi.envoyer_image`, puis à passer à
    `animation(..., affiche=<chemin de stockage>)`. Choisir un instant où l'étape est lisible."""
    dossier = tempfile.mkdtemp(prefix='gc-anim-')
    html = ecrire(code, os.path.join(dossier, 'animation.html'))
    return apercu(html, sortie_png, etape=etape, instant=instant, largeur=largeur, hauteur=hauteur)
