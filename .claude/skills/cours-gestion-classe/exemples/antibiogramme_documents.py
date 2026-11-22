"""Illustrations de la feuille de documents de l'antibiogramme (3e, séquence 2, activité 3), 22/11/2026.

- doc2-bacterie-virus.png : une bactérie et un virus à la même échelle, légendés en français ;
- doc3-resistances.png : trois images de l'animation « résistances » (avant, pendant, après le traitement),
  sans les textes de la scène, pour que le papier raconte la même histoire que l'écran.

    python -I antibiogramme_documents.py <dossier de sortie>
"""
import os
import subprocess
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(ICI)
sys.path.insert(0, SKILL)
from gc_animation import CHROME  # noqa: E402


def lire(*chemin):
    with open(os.path.join(SKILL, *chemin), encoding='utf-8') as f:
        return f.read()


def photo(html, sortie, largeur, hauteur):
    d = tempfile.mkdtemp(prefix='gc-doc-')
    p = os.path.join(d, 'page.html')
    with open(p, 'w', encoding='utf-8') as f:
        f.write(html)
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                    '--window-size=%d,%d' % (largeur, hauteur), '--virtual-time-budget=1500',
                    '--screenshot=' + os.path.abspath(sortie), 'file:///' + p.replace('\\', '/')],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    return sortie


PAGE = ('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;'
        'font-family:Arial,Helvetica,sans-serif}</style>')


def doc2(sortie):
    """Bactérie (2 µm) et virus (0,1 µm) à la même échelle : 1 µm = 230 px."""
    U = 230
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="560" viewBox="0 0 1200 560" font-family="Arial">
<defs><marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>
<text x="290" y="48" font-size="30" font-weight="700" text-anchor="middle" fill="#1F4E79">Une bactérie (environ 2 µm)</text>
<rect x="60" y="150" width="{2*U}" height="170" rx="85" fill="#F3E3B5" stroke="#8A6D1E" stroke-width="12"/>
<rect x="72" y="162" width="{2*U-24}" height="146" rx="73" fill="#F7EDCF" stroke="#C9A64A" stroke-width="3"/>
<path d="M150,235 C190,190 230,280 270,235 S350,190 390,235 S450,280 470,230" fill="none" stroke="#7A3E9D" stroke-width="5"/>
<g fill="#B08A2E">{''.join(f'<circle cx="{x}" cy="{y}" r="5"/>' for x, y in [(130,200),(180,280),(240,190),(320,285),(380,200),(430,275),(200,225),(350,250),(460,205)])}</g>
<line x1="150" y1="110" x2="120" y2="152" stroke="#333" stroke-width="2.5" marker-end="url(#fl)"/>
<text x="150" y="102" font-size="24" font-weight="700" fill="#5C4A00">paroi</text>
<line x1="330" y1="372" x2="330" y2="300" stroke="#333" stroke-width="2.5" marker-end="url(#fl)"/>
<text x="330" y="400" font-size="24" font-weight="700" text-anchor="middle" fill="#5C4A00">cytoplasme</text>
<line x1="470" y1="110" x2="430" y2="225" stroke="#333" stroke-width="2.5" marker-end="url(#fl)"/>
<text x="470" y="102" font-size="24" font-weight="700" fill="#7A3E9D">ADN</text>
<rect x="40" y="430" width="500" height="80" rx="12" fill="#EEF5EA" stroke="#2E7D32" stroke-width="2"/>
<text x="290" y="463" font-size="22" text-anchor="middle" fill="#1B5E20">L’antibiotique agit sur la paroi ou sur les</text>
<text x="290" y="492" font-size="22" text-anchor="middle" fill="#1B5E20">outils de la bactérie pour se multiplier.</text>
<text x="900" y="48" font-size="30" font-weight="700" text-anchor="middle" fill="#1F4E79">Un virus (environ 0,1 µm)</text>
<circle cx="650" cy="235" r="{0.05*U:.1f}" fill="#C9B6EC" stroke="#5E35B1" stroke-width="2"/>
<text x="650" y="290" font-size="20" text-anchor="middle" fill="#555">à la même échelle</text>
<line x1="666" y1="228" x2="770" y2="190" stroke="#888" stroke-width="2" stroke-dasharray="6 5"/>
<line x1="666" y1="242" x2="770" y2="310" stroke="#888" stroke-width="2" stroke-dasharray="6 5"/>
<g transform="translate(880,250)">
{''.join(f'<line x1="0" y1="0" x2="{110*__import__("math").cos(a*3.14159/180):.1f}" y2="{110*__import__("math").sin(a*3.14159/180):.1f}" stroke="#5E35B1" stroke-width="6"/><circle cx="{112*__import__("math").cos(a*3.14159/180):.1f}" cy="{112*__import__("math").sin(a*3.14159/180):.1f}" r="9" fill="#D63A3A"/>' for a in range(0, 360, 30))}
<circle r="92" fill="#C9B6EC" stroke="#5E35B1" stroke-width="6"/>
<path d="M-50,-10 C-25,-45 0,25 25,-10 S55,-30 55,10" fill="none" stroke="#7A3E9D" stroke-width="5"/>
</g>
<text x="850" y="410" font-size="20" text-anchor="middle" fill="#555">le même virus, grossi bien plus</text>
<line x1="1040" y1="160" x2="962" y2="200" stroke="#333" stroke-width="2.5" marker-end="url(#fl)"/>
<text x="1010" y="118" font-size="22" font-weight="700" fill="#5E35B1">enveloppe</text><text x="1010" y="144" font-size="22" font-weight="700" fill="#5E35B1">de protéines</text>
<line x1="1040" y1="335" x2="920" y2="262" stroke="#333" stroke-width="2.5" marker-end="url(#fl)"/>
<text x="1010" y="362" font-size="22" font-weight="700" fill="#7A3E9D">information</text><text x="1010" y="388" font-size="22" font-weight="700" fill="#7A3E9D">génétique</text>
<rect x="680" y="430" width="500" height="80" rx="12" fill="#FBE5E5" stroke="#C00000" stroke-width="2"/>
<text x="930" y="463" font-size="22" text-anchor="middle" fill="#8E1F1F">Ni paroi, ni cytoplasme : l’antibiotique</text>
<text x="930" y="492" font-size="22" text-anchor="middle" fill="#8E1F1F">n’a rien sur quoi agir.</text>
<line x1="60" y1="540" x2="{60+U}" y2="540" stroke="#1d2433" stroke-width="4"/>
<line x1="60" y1="532" x2="60" y2="548" stroke="#1d2433" stroke-width="3"/><line x1="{60+U}" y1="532" x2="{60+U}" y2="548" stroke="#1d2433" stroke-width="3"/>
<text x="{60+U+14}" y="548" font-size="20" fill="#1d2433">1 µm</text>
</svg>'''
    return photo(PAGE + svg, sortie, 1200, 560)


def doc3(sortie):
    """Trois instants de la scène des résistances, sans ses textes."""
    scene = lire('exemples', 'antibiogramme_resistance_scene.js')
    js = (lire('animation', 'outils.js') + '\n' + lire('animation', 'banque', 'bacteries.js') + '\n'
          + 'txt = () => "";\nconst GC = { play(s) { window.S = s; } };\n' + scene + '''
const CHOIX = [['colonie', 6.5], ['dose', 7.8], ['multiplication', 8.8]];
document.querySelectorAll('svg.p').forEach((el, i) => { const [id, t] = CHOIX[i]; el.innerHTML = window.S[id].draw(t); });''')
    panneaux = ''.join(
        f'<div class="c"><svg class="p" viewBox="200 140 1200 600" xmlns="http://www.w3.org/2000/svg"></svg>'
        f'<div class="t"><b>{n}.</b> {t}</div></div>'
        for n, t in [(1, 'Avant le traitement : quelques bactéries résistantes, par hasard.'),
                     (2, 'Pendant : l’antibiotique détruit les bactéries sensibles.'),
                     (3, 'Après : les résistantes se sont multipliées.')])
    html = (PAGE + '<style>.r{display:flex;gap:14px;padding:10px}.c{flex:1;border:2px solid #9C2A2A;border-radius:12px;'
            'overflow:hidden;background:#FBEFEF}.p{display:block;width:100%;height:auto}.t{font-size:19px;padding:8px 10px;'
            'background:#fff;color:#1d2433;min-height:52px}.l{font-size:19px;padding:0 14px 10px;color:#1d2433}'
            '.b{display:inline-block;width:30px;height:13px;border-radius:7px;vertical-align:middle;margin:0 6px 0 16px}</style>'
            f'<div class="r">{panneaux}</div><div class="l"><span class="b" style="background:#3D7FD1"></span>bactérie '
            'sensible<span class="b" style="background:#D64545"></span>bactérie résistante</div><script>' + js + '</script>')
    return photo(html, sortie, 1200, 322)


if __name__ == '__main__':
    sortie = sys.argv[1]
    os.makedirs(sortie, exist_ok=True)
    print(doc2(os.path.join(sortie, 'doc2-bacterie-virus.png')))
    print(doc3(os.path.join(sortie, 'doc3-resistances.png')))
