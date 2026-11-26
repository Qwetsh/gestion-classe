"""Version mobile « sur mesure » d'un document (skill version-mobile, migration 093).

Une page HTML complète et autonome, pensée pour le téléphone, que le QR code « Version couleur »
des feuilles imprimées ouvre à la place de la version automatique. L'application l'affiche dans un
cadre isolé (`sandbox="allow-scripts"`, sans `allow-same-origin`) sous une CSP qui coupe le réseau.
Ce module aide à la fabriquer et à la contrôler ; le dépôt se fait par `gc_envoi.py mobile`.

    import gc_mobile
    src = gc_mobile.image_data_uri('C:/.../carte.jpg')                  # image intégrée à la page
    bloc = gc_mobile.animation(code, fichiers={'patient.glb': chemin})  # animation gc_animation
    gc_mobile.apercu('page.html', 'ecran.png')                          # 390 x 844, comme l'app
    gc_mobile.apercu('page.html', 'page.png', hauteur=3000)             # toute la page

Le contrôle (`apercu`) montre la page comme l'application : dans un cadre isolé de 390 px de large,
sous la même CSP. Une image ou un script qui viendrait du réseau y manque, comme chez l'élève.
"""
import base64
import html
import io
import json
import mimetypes
import os
import re
import subprocess
import tempfile

CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
LARGEUR = 390
HAUTEUR = 844
PAGE_MAX = 5 * 1024 * 1024

# Même règle que l'application (gestion-classe-web/src/lib/mobileVersion.ts, CUSTOM_CSP)
CSP = ("default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "
       "font-src data:; media-src data: blob:; connect-src data: blob:; base-uri 'none'; form-action 'none'")

# Le lecteur d'animation se croit « dans le tableau » : la page affiche elle-même titre et légende, en grand
_CACHE_LECTEUR = '<style>#gc-head,#gc-bar,#gc-caption,#gc-nav{display:none!important}</style>'


def image_data_uri(chemin, largeur_max=1200, qualite=82):
    """Une image en data URI, à mettre dans `src`. Réduite à `largeur_max` px et réenregistrée en JPEG
    (PNG gardé s'il a de la transparence) si Pillow est là ; sinon, telle quelle."""
    try:
        from PIL import Image
    except ImportError:
        with open(chemin, 'rb') as f:
            octets = f.read()
        type_ = mimetypes.guess_type(chemin)[0] or 'image/png'
        return 'data:%s;base64,%s' % (type_, base64.b64encode(octets).decode('ascii'))
    with Image.open(chemin) as im:
        if im.width > largeur_max:
            im = im.resize((largeur_max, round(im.height * largeur_max / im.width)), Image.LANCZOS)
        transparent = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
        sortie = io.BytesIO()
        if transparent:
            im.save(sortie, 'PNG', optimize=True)
            type_ = 'image/png'
        else:
            im.convert('RGB').save(sortie, 'JPEG', quality=qualite, optimize=True)
            type_ = 'image/jpeg'
    return 'data:%s;base64,%s' % (type_, base64.b64encode(sortie.getvalue()).decode('ascii'))


def animation(code, titre='Animation', fichiers=None, proportion=None):
    """Bloc HTML d'une animation `gc_animation` dans la page : un cadre `srcdoc` (bibliothèques et
    fichiers joints intégrés), le titre et la légende de l'étape écrits par la page, et ses boutons
    (◀, ↺ Rejouer, Suivant ▶). Le script de `gabarit.html` (skill version-mobile) le fait marcher.
    `proportion` : largeur / hauteur du cadre (celle de l'animation par défaut)."""
    import gc_animation
    page = gc_animation.document_local(code, fichiers)
    page = re.sub(r'</head>', _CACHE_LECTEUR + '</head>', page, count=1, flags=re.I)
    etapes = gc_animation.etapes_de(code) or []
    if proportion is None:
        m = re.search(r'"ratio"\s*:\s*([\d.]+)', code)
        proportion = float(m.group(1)) if m else 16 / 9
    donnees = html.escape(json.dumps(etapes, ensure_ascii=False), quote=True)
    return ('<section class="carte anim" data-etapes="%s">'
            '<iframe title="%s" style="aspect-ratio:%.3f" srcdoc="%s"></iframe>'
            '<p class="titre-etape"></p><p class="legende-etape"></p><div class="nav"></div></section>'
            % (donnees, html.escape(titre, quote=True), proportion, html.escape(page, quote=True)))


def cadre_isole(page):
    """La page telle que l'application la montre : CSP posée juste après le doctype (comme
    customSrcdoc), dans un cadre isolé de 390 px de large."""
    m = re.match(r'(\ufeff?(?:\s|<!--[\s\S]*?-->)*<!doctype[^>]*>)', page, re.I)
    garde = '<meta http-equiv="Content-Security-Policy" content="%s"><meta name="referrer" content="no-referrer">' % CSP
    isolee = (m.group(1) + garde + page[m.end():]) if m else garde + page
    return ('<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#9CA3AF}'
            'iframe{display:block;width:%dpx;height:100vh;border:0;background:#fff}</style></head><body>'
            '<iframe sandbox="allow-scripts" srcdoc="%s"></iframe></body></html>' % (LARGEUR, html.escape(isolee, quote=True)))


def apercu(chemin_page, sortie_png, hauteur=HAUTEUR, attente=2500):
    """Photographie la page à 390 px de large (Chrome sans fenêtre), dans le cadre isolé de
    l'application. `hauteur` : 844 pour le premier écran du téléphone, 3000 ou plus pour toute la
    page. La fenêtre de Chrome fait au moins 500 px : la bande grise à droite n'est pas la page."""
    with open(chemin_page, encoding='utf-8-sig') as f:
        page = f.read()
    taille = len(page.encode('utf-8'))
    if taille > PAGE_MAX:
        print('Attention : %.1f Mo, la page sera refusée (5 Mo au plus).' % (taille / 1024 / 1024))
    dossier = tempfile.mkdtemp(prefix='gc-mobile-')
    cadre = os.path.join(dossier, 'cadre.html')
    with open(cadre, 'w', encoding='utf-8') as f:
        f.write(cadre_isole(page))
    url = 'file:///' + cadre.replace('\\', '/')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--window-size=%d,%d' % (max(LARGEUR, 500), hauteur), '--virtual-time-budget=%d' % attente,
                    '--screenshot=' + os.path.abspath(sortie_png), url],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
    return sortie_png
