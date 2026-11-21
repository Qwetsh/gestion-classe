"""Animations du tableau de Gestion Classe : assemble une scène en un fichier HTML autonome.

Une animation est un objet du tableau (`type: 'animation'`, voir `lib/boardAnimation.ts`) : une
scène dessinée en SVG, redessinée à chaque image, découpée en étapes que les boutons du tableau
font avancer. Ce module colle ensemble :

  - `animation/gabarit.html` : la page (titre de l'étape, scène, légende) ;
  - `animation/lecteur.js`   : le lecteur (étapes, pilotage par le tableau, lecture seule au clavier) ;
  - `animation/outils.js`    : temps, interpolation, texte, flèches ;
  - `animation/banque/*.js`  : les dessins réutilisables d'un thème (immunité…), et `scene3d`, la
                                3D (three.js) sous les étiquettes SVG ;
  - les bibliothèques (`bibliotheques=['three']`, `['chart']`) : servies par l'application, injectées
    dans le cadre à l'ouverture (le code reste petit, rien ne vient du réseau) ;
  - la scène : `GC.play({ identifiant: { dur, draw(t) { … } }, … })`.

Les fichiers lourds (modèle 3D GLB, photo, son) ne vont pas dans le code : ils sont envoyés par
`gc_envoi.envoyer_fichier`, joints à l'objet (`animation(..., fichiers={'patient.glb': chemin})`) et lus
par la scène avec `await gcAsset('patient.glb')`. Pour l'aperçu local, `fichiers` donne les fichiers
de l'ordinateur : `apercu(html, png, fichiers={'patient.glb': 'C:/.../nora.glb'})`.

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
# Bibliothèques que le tableau sait injecter (SCENE_LIBS de lib/boardAnimation.ts)
BIBLIOTHEQUES = ('three', 'chart')
DEPOT = os.path.abspath(os.path.join(ICI, '..', '..', '..'))
DOSSIER_BIBLIOTHEQUES = os.path.join(DEPOT, 'gestion-classe-web', 'public', 'scene-libs')


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


def assembler(titre, etapes, scene, banques=(), largeur=1600, hauteur=760, proportion=1.9, bibliotheques=()):
    """Rend le code HTML de l'animation.
    `etapes` : liste d'`etape(...)`, dans l'ordre de lecture ; `scene` : le JavaScript de la scène ;
    `proportion` : largeur / hauteur conseillée du cadre posé sur l'écran ;
    `bibliotheques` : 'three' (avec la banque 'scene3d'), 'chart' — injectées par le tableau."""
    for b in bibliotheques:
        if b not in BIBLIOTHEQUES:
            raise AnimationRefusee('Bibliothèque « %s » inconnue (%s).' % (b, ', '.join(BIBLIOTHEQUES)))
    if 'scene3d' in banques and 'three' not in bibliotheques:
        raise AnimationRefusee("La banque scene3d demande bibliotheques=['three'].")
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
                        ('__BIBLIOTHEQUES__', ''.join('<script data-gc-lib="%s"></script>' % b for b in bibliotheques)),
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


def _bibliotheque(nom):
    chemin = os.path.join(DOSSIER_BIBLIOTHEQUES, nom + '.js')
    if not os.path.exists(chemin):
        raise AnimationRefusee('Bibliothèque « %s » absente : lancer « npm run scene-libs » dans gestion-classe-web.' % nom)
    with open(chemin, encoding='utf-8') as f:
        return f.read().replace('</script', '<\\/script')


LIB_RE = re.compile(r'<script\b[^>]*\bdata-gc-lib\s*=\s*["\']([\w-]+)["\'][^>]*>\s*</script\s*>', re.I)


def document_local(code, fichiers=None):
    """Le code tel que le tableau le joue, pour l'ouvrir seul dans Chrome : bibliothèques en place, et
    `gcAsset` qui lit les fichiers de l'ordinateur donnés par `fichiers` ({ nom: chemin local })."""
    import base64
    import mimetypes
    code = LIB_RE.sub(lambda m: '<script>' + _bibliotheque(m.group(1)) + '</script>', code)
    donnees = {}
    for nom, chemin in (fichiers or {}).items():
        with open(chemin, 'rb') as f:
            type_ = 'model/gltf-binary' if chemin.lower().endswith('.glb') else (mimetypes.guess_type(chemin)[0] or '')
            donnees[nom] = {'type': type_, 'data': base64.b64encode(f.read()).decode('ascii')}
    reception = ('<script>(function(){var F=%s;window.gcAsset=function(n){var f=F[n];'
                 'if(!f)return Promise.reject(new Error("Fichier joint absent : "+n));'
                 'var s=atob(f.data),b=new Uint8Array(s.length);for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i);'
                 'var blob=new Blob([b],{type:f.type});'
                 'return Promise.resolve({name:n,type:f.type,buffer:b.buffer,blob:blob,url:URL.createObjectURL(blob)});};})();</script>'
                 % json.dumps(donnees))
    tete = re.search(r'<head\b[^>]*>', code, re.I)
    at = tete.end() if tete else 0
    return code[:at] + reception + code[at:]


def apercu(chemin_html, sortie_png, etape=1, instant=0.0, largeur=960, hauteur=506, fichiers=None, attente=None):
    """Image de contrôle d'une étape figée à `instant` secondes (Chrome sans fenêtre).
    La taille par défaut est celle du cadre posé par `gc_ecrans` sur un écran de 1000 x 562,5.
    Scène riche : `fichiers` ({ nom: chemin local }) remplace les fichiers joints ; la 3D est rendue
    sans carte graphique (SwiftShader) et on lui laisse plus de temps (`attente`, en millisecondes)."""
    with open(chemin_html, encoding='utf-8') as f:
        code = f.read()
    riche = bool(fichiers) or 'data-gc-lib' in code
    if riche:
        dossier = tempfile.mkdtemp(prefix='gc-anim-')
        chemin_html = ecrire(document_local(code, fichiers), os.path.join(dossier, 'animation.html'))
    url = 'file:///' + os.path.abspath(chemin_html).replace('\\', '/') + '#%d,%s' % (etape, instant)
    gpu = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] if riche else ['--disable-gpu']
    budget = attente or (8000 if riche else 1500)
    subprocess.run([CHROME, '--headless=new', *gpu, '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--window-size=%d,%d' % (largeur, hauteur), '--virtual-time-budget=%d' % budget,
                    '--screenshot=' + os.path.abspath(sortie_png), url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    return sortie_png


def affiche(code, sortie_png, etape=1, instant=3.5, largeur=960, hauteur=506, fichiers=None):
    """L'image de l'animation : une étape figée, pour les vignettes et l'export PDF du tableau (où
    l'animation ne peut pas être jouée). À envoyer avec `gc_envoi.envoyer_image`, puis à passer à
    `animation(..., affiche=<chemin de stockage>)`. Choisir un instant où l'étape est lisible."""
    dossier = tempfile.mkdtemp(prefix='gc-anim-')
    html = ecrire(code, os.path.join(dossier, 'animation.html'))
    return apercu(html, sortie_png, etape=etape, instant=instant, largeur=largeur, hauteur=hauteur, fichiers=fichiers)
