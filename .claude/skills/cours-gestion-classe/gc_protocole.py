"""Fiche protocole d'une expérience : une page en couleur, à plastifier et à laisser sur la paillasse
(règle du 22/11/2026, voir SKILL.md § 3 « Fiche protocole »).

La page est dessinée en HTML (dessins SVG fournis par l'appelant), photographiée par Chrome, puis posée
en une seule image dans le cours « … (protocole) » de l'activité. Pour la retoucher : changer le script
qui l'a produite et la renvoyer (le texte n'est pas modifiable dans l'éditeur).

    from gc_protocole import page_protocole
    png = page_protocole('Réaliser un antibiogramme', '3e · Séquence 2 · Activité 3',
                         materiel=[(svg, 'un gobelet d’eau'), …],       # 4 à 8 éléments
                         etapes=[(svg, 'Avec la pince, <b>trempe</b>…'), …],   # 3 à 6 étapes
                         penser=['blouse et lunettes', …], erreur='…', sortie='protocole.png')

Les textes acceptent <b> et <span class="bleu|rouge|vert">. Police Arial, texte des étapes à 12 pt
(règle des fiches pour les élèves dys).
"""
import os
import subprocess
import tempfile

from gc_animation import CHROME

# Page dessinée pour l'ancienne zone de texte de l'éditeur (marges de 2,5 cm : 16 × 24,7 cm), un peu
# moins haute pour laisser la ligne vide que l'éditeur ajoute après l'image. Posée à 15,2 cm de large,
# elle tient aussi dans la zone actuelle (marges de 1,5 cm : 18 × 26,7 cm).
LARGEUR, HAUTEUR = 605, 900
ECHELLE = 3          # 1815 × 2700 px : net à l'impression

STYLE = '''
*{box-sizing:border-box}
html,body{margin:0;background:#fff}
body{width:%(l)dpx;height:%(h)dpx;font-family:Arial,Helvetica,sans-serif;color:#1d2433;display:flex;
  flex-direction:column;gap:9px;overflow:hidden;padding:2px}
.bandeau{background:#1F3A5F;color:#fff;border-radius:16px;padding:12px 18px;display:flex;align-items:center;gap:14px}
.bandeau .k{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;opacity:.75}
.bandeau .t{font-size:24px;font-weight:700;line-height:1.1;margin-top:2px}
.bandeau .d{margin-left:auto;text-align:right;font-size:12px;line-height:1.35;opacity:.9}
h2{margin:0 0 6px;font-size:15px;font-weight:700;color:#1F3A5F;display:flex;align-items:center;gap:8px}
h2::before{content:"";width:6px;height:16px;border-radius:3px;background:#2F6FD0}
.carte{border:2px solid #DCE3EC;border-radius:16px;padding:10px 12px}
.materiel{display:grid;gap:6px}
.m{text-align:center;font-size:12.5px;line-height:1.2}
.m svg{width:100%%;height:auto;max-width:72px;display:block;margin:0 auto 3px}
.etapes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.e{border:2px solid #DCE3EC;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;position:relative}
.e svg{width:100%%;height:auto;display:block;background:#F3F6FA}
.e .n{position:absolute;top:7px;left:7px;width:30px;height:30px;border-radius:50%%;background:#1F3A5F;color:#fff;
  font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px #fff}
.e p{margin:0;padding:7px 9px 9px;font-size:16px;line-height:1.25}
.bas{display:grid;grid-template-columns:1.25fr 1fr;gap:10px}
.penser{background:#FFF6D6;border:2px solid #E5C34A;border-radius:14px;padding:10px 14px}
.erreur{background:#FDEAEA;border:2px solid #E08A8A;border-radius:14px;padding:10px 14px}
.penser h3,.erreur h3{margin:0 0 4px;font-size:15px}
.penser h3{color:#7A5B00}.erreur h3{color:#A51F1F}
.penser ul,.erreur ul{margin:0;padding-left:18px;font-size:14px;line-height:1.35}
.erreur p{margin:0 0 3px;font-size:14px;line-height:1.35}
.bleu{color:#2F6FD0;font-weight:700}.rouge{color:#D64545;font-weight:700}.vert{color:#2E7D32;font-weight:700}
'''


def insecables(texte):
    """Espaces insécables du français : pas de « : » ni de guillemet seul en début de ligne."""
    for a, b in ((' :', '&nbsp;:'), (' ;', '&nbsp;;'), (' ?', '&nbsp;?'), (' !', '&nbsp;!'),
                 ('« ', '«&nbsp;'), (' »', '&nbsp;»')):
        texte = texte.replace(a, b)
    return texte


def html_protocole(titre, sous_titre, materiel, etapes, penser, erreur, consigne='Reste sur la paillasse'):
    materiel = [(svg, insecables(t)) for svg, t in materiel]
    etapes = [(svg, insecables(t)) for svg, t in etapes]
    penser = [insecables(t) for t in penser]
    erreur = insecables(erreur)
    colonnes = min(len(materiel), 8)
    mat = ''.join(f'<div class="m">{svg}<div>{label}</div></div>' for svg, label in materiel)
    eta = ''.join(f'<div class="e">{svg}<span class="n">{i}</span><p>{texte}</p></div>'
                  for i, (svg, texte) in enumerate(etapes, 1))
    pen = ''.join(f'<li>{p}</li>' for p in penser)
    err = erreur if erreur.lstrip().startswith('<') else f'<p>{erreur}</p>'
    return (f'<!doctype html><meta charset="utf-8"><style>{STYLE % {"l": LARGEUR, "h": HAUTEUR}}</style>'
            f'<div class="bandeau"><div><div class="k">Fiche protocole</div><div class="t">{titre}</div></div>'
            f'<div class="d">{sous_titre}<br>{consigne}</div></div>'
            f'<div><h2>Le matériel</h2><div class="carte materiel" '
            f'style="grid-template-columns:repeat({colonnes},1fr)">{mat}</div></div>'
            f'<div><h2>Le protocole</h2><div class="etapes">{eta}</div></div>'
            f'<div class="bas"><div class="penser"><h3>Bien penser à</h3><ul>{pen}</ul></div>'
            f'<div class="erreur"><h3>Une erreur ?</h3>{err}</div></div>')


def photographier(html, sortie, largeur=LARGEUR, hauteur=HAUTEUR, echelle=ECHELLE):
    d = tempfile.mkdtemp(prefix='gc-protocole-')
    p = os.path.join(d, 'page.html')
    with open(p, 'w', encoding='utf-8') as f:
        f.write(html)
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                    '--force-device-scale-factor=%d' % echelle, '--window-size=%d,%d' % (largeur, hauteur),
                    '--virtual-time-budget=1500', '--screenshot=' + os.path.abspath(sortie),
                    'file:///' + p.replace('\\', '/')],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    return sortie


def page_protocole(titre, sous_titre, materiel, etapes, penser, erreur, sortie, **k):
    """Écrit la page en PNG (et son HTML à côté, pour la relire) ; renvoie le chemin du PNG."""
    html = html_protocole(titre, sous_titre, materiel, etapes, penser, erreur, **k)
    with open(os.path.splitext(sortie)[0] + '.html', 'w', encoding='utf-8') as f:
        f.write(html)
    return photographier(html, sortie)
