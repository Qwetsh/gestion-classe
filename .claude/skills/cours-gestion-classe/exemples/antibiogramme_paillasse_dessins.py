"""Dessins de la fiche paillasse de l'antibiogramme (3e, séquence 2, activité 3), 22/11/2026.

Pictogrammes du matériel (carrés) et vignettes des six étapes du protocole (paysage), dans un même
style : traits sombres arrondis, aplats, gel violet du chou rouge, ligne bleue / ligne rouge.

    python -I antibiogramme_paillasse_dessins.py <dossier de sortie>
"""
import math
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
from antibiogramme_documents import photo  # noqa: E402

TRAIT = '#2B3445'
GEL, GEL_CLAIR = '#8E5BB5', '#B48AD6'
HALO = '#EE86B6'
BLEU, ROUGE = '#2F6FD0', '#D64545'
ACIER = '#A9B4C2'
EAU = '#CFE8F7'
FOND = '#F3F6FA'

PAGE = ('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff;'
        'font-family:Arial,Helvetica,sans-serif}svg{display:block}</style>')


def svg(l, h, corps, fond=True):
    bg = f'<rect x="4" y="4" width="{l-8}" height="{h-8}" rx="28" fill="{FOND}"/>' if fond else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{l}" height="{h}" viewBox="0 0 {l} {h}" '
            f'font-family="Arial" stroke-linejoin="round" stroke-linecap="round">{bg}{corps}</svg>')


# ------------------------------------------------------------------ éléments

def boite(cx, cy, r, etiquette=None, couleur_etiquette=TRAIT, pastilles=(), halos=()):
    """Boîte de Petri vue de dessus. pastilles / halos : listes de (dx, dy, lettre ou rayon)."""
    s = (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#FFFFFF" stroke="{TRAIT}" stroke-width="5"/>'
         f'<circle cx="{cx}" cy="{cy}" r="{r-9}" fill="{GEL}"/>'
         f'<path d="M{cx-r*0.62},{cy-r*0.42} A{r*0.78},{r*0.78} 0 0 1 {cx-r*0.05},{cy-r*0.78}" fill="none" '
         f'stroke="{GEL_CLAIR}" stroke-width="7"/>')
    for dx, dy, rr in halos:
        s += f'<circle cx="{cx+dx}" cy="{cy+dy}" r="{rr}" fill="{HALO}" opacity="0.92"/>'
    for dx, dy, lettre in pastilles:
        s += pastille(cx + dx, cy + dy, 13, lettre)
    if etiquette:
        lw = 15 * len(etiquette) + 26
        s += (f'<rect x="{cx-lw/2}" y="{cy+r+10}" width="{lw}" height="34" rx="9" fill="#fff" '
              f'stroke="{couleur_etiquette}" stroke-width="3"/>'
              f'<text x="{cx}" y="{cy+r+34}" font-size="21" font-weight="700" text-anchor="middle" '
              f'fill="{couleur_etiquette}">{etiquette}</text>')
    return s


def pastille(x, y, r, lettre=''):
    t = (f'<text x="{x}" y="{y+r*0.42}" font-size="{r*1.15:.0f}" font-weight="700" text-anchor="middle" '
         f'fill="{TRAIT}">{lettre}</text>') if lettre else ''
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" stroke="{TRAIT}" stroke-width="3"/>{t}'


def flacon(x, y, couleur, lettre, l=46, h=78):
    """Petit flacon : (x, y) = coin haut gauche du corps."""
    return (f'<rect x="{x+l*0.22}" y="{y-20}" width="{l*0.56}" height="22" rx="5" fill="{couleur}" '
            f'stroke="{TRAIT}" stroke-width="3"/>'
            f'<rect x="{x}" y="{y}" width="{l}" height="{h}" rx="12" fill="#FFFFFF" stroke="{TRAIT}" stroke-width="4"/>'
            f'<rect x="{x+5}" y="{y+h*0.35}" width="{l-10}" height="{h*0.65-5}" rx="8" fill="#E9F1FB"/>'
            f'<text x="{x+l/2}" y="{y+h*0.72}" font-size="26" font-weight="700" text-anchor="middle" '
            f'fill="{couleur}">{lettre}</text>')


def pince(x, y, angle=0, long=210):
    """Pince fine, pointes en (x, y), orientée de `angle` degrés (0 = manche vers la droite)."""
    return (f'<g transform="translate({x},{y}) rotate({angle})">'
            f'<path d="M0,0 L{long},-14 L{long},-4 Z" fill="{ACIER}" stroke="{TRAIT}" stroke-width="4"/>'
            f'<path d="M0,0 L{long},14 L{long},4 Z" fill="{ACIER}" stroke="{TRAIT}" stroke-width="4"/>'
            f'<rect x="{long*0.55}" y="-12" width="{long*0.22}" height="24" rx="6" fill="#7E8A99" opacity="0.5"/></g>')


def gobelet(x, y, l=110, h=130):
    return (f'<path d="M{x},{y} L{x+l},{y} L{x+l*0.86},{y+h} L{x+l*0.14},{y+h} Z" fill="#FFFFFF" '
            f'stroke="{TRAIT}" stroke-width="5"/>'
            f'<path d="M{x+l*0.05},{y+h*0.3} L{x+l*0.95},{y+h*0.3} L{x+l*0.86},{y+h-4} L{x+l*0.14},{y+h-4} Z" '
            f'fill="{EAU}"/>'
            f'<path d="M{x+l*0.18},{y+h*0.42} q{l*0.15},-8 {l*0.3},0 t{l*0.3},0" fill="none" stroke="#9CCBEA" stroke-width="4"/>')


def feutre(x, y, angle=-35, long=190):
    return (f'<g transform="translate({x},{y}) rotate({angle})">'
            f'<path d="M0,0 L18,-11 L18,11 Z" fill="{TRAIT}"/>'
            f'<rect x="18" y="-15" width="{long*0.68}" height="30" rx="8" fill="#3F4B5E" stroke="{TRAIT}" stroke-width="4"/>'
            f'<rect x="{18+long*0.68}" y="-17" width="{long*0.3}" height="34" rx="9" fill="#5B6B82" stroke="{TRAIT}" stroke-width="4"/></g>')


def regle(x, y, l=240, h=46):
    graduations = ''.join(
        f'<line x1="{x+12+i*((l-24)/20):.1f}" y1="{y}" x2="{x+12+i*((l-24)/20):.1f}" y2="{y+(16 if i % 5 == 0 else 9)}" '
        f'stroke="{TRAIT}" stroke-width="2.5"/>' for i in range(21))
    return (f'<rect x="{x}" y="{y}" width="{l}" height="{h}" rx="6" fill="#F6D86B" stroke="{TRAIT}" stroke-width="4"/>'
            + graduations)


def fleche(x1, y1, x2, y2, couleur=TRAIT, courbe=0):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2 - courbe
    a = math.atan2(y2 - my, x2 - mx)
    p1 = (x2 - 18 * math.cos(a - 0.45), y2 - 18 * math.sin(a - 0.45))
    p2 = (x2 - 18 * math.cos(a + 0.45), y2 - 18 * math.sin(a + 0.45))
    return (f'<path d="M{x1},{y1} Q{mx},{my} {x2},{y2}" fill="none" stroke="{couleur}" stroke-width="5"/>'
            f'<path d="M{x2},{y2} L{p1[0]:.1f},{p1[1]:.1f} L{p2[0]:.1f},{p2[1]:.1f} Z" fill="{couleur}"/>')


def goutte(x, y, r=9, couleur='#9CCBEA'):
    return f'<path d="M{x},{y-r*1.8} C{x+r},{y-r*0.4} {x+r},{y+r} {x},{y+r} C{x-r},{y+r} {x-r},{y-r*0.4} {x},{y-r*1.8} Z" fill="{couleur}" stroke="{TRAIT}" stroke-width="2.5"/>'


def badge(x, y, texte, couleur):
    lw = 15 * len(texte) + 26
    return (f'<rect x="{x}" y="{y}" width="{lw}" height="36" rx="18" fill="{couleur}"/>'
            f'<text x="{x+lw/2}" y="{y+25}" font-size="21" font-weight="700" text-anchor="middle" fill="#fff">{texte}</text>')


# ------------------------------------------------------------------ matériel (300 × 300)

M = 300


def m_boites():
    return svg(M, M, boite(88, 104, 62, 'plaie', BLEU) + boite(205, 150, 62, 'microbiote', ROUGE))


def m_placement():
    s = (f'<rect x="58" y="34" width="184" height="236" rx="10" fill="#fff" stroke="{TRAIT}" stroke-width="5"/>'
         f'<rect x="58" y="34" width="184" height="30" rx="10" fill="#E3E9F1"/>')
    for cy, c in ((118, BLEU), (210, ROUGE)):
        s += f'<circle cx="150" cy="{cy}" r="40" fill="none" stroke="{c}" stroke-width="4" stroke-dasharray="9 7"/>'
        for dx, dy, l in ((-17, -12, 'A'), (17, -12, 'B'), (0, 18, 'C')):
            s += f'<text x="{150+dx}" y="{cy+dy+7}" font-size="17" font-weight="700" text-anchor="middle" fill="{c}">{l}</text>'
    return svg(M, M, s)


def m_flacons():
    s = ''
    for i, l in enumerate('ABC'):
        s += flacon(42 + i * 76, 64, BLEU, l)
        s += flacon(42 + i * 76, 186, ROUGE, l)
    s += f'<line x1="30" y1="150" x2="270" y2="150" stroke="{BLEU}" stroke-width="5"/>'
    s += f'<line x1="30" y1="272" x2="270" y2="272" stroke="{ROUGE}" stroke-width="5"/>'
    return svg(M, M, s)


def m_pastilles():
    s = ''.join(pastille(70 + (i % 3) * 80, 115 + (i // 3) * 82, 28) for i in range(6))
    return svg(M, M, s)


def m_pince():
    return svg(M, M, pince(48, 205, -32, 240))


def m_gobelet():
    return svg(M, M, gobelet(95, 80, 110, 150))


def m_feutre():
    return svg(M, M, feutre(70, 225, -40, 220))


def m_regle():
    return svg(M, M, f'<g transform="rotate(-20 150 150)">{regle(30, 125, 240, 50)}</g>')


MATERIEL = [('m-boites', m_boites), ('m-placement', m_placement), ('m-flacons', m_flacons),
            ('m-pastilles', m_pastilles), ('m-pince', m_pince), ('m-gobelet', m_gobelet),
            ('m-feutre', m_feutre), ('m-regle', m_regle)]


# ------------------------------------------------------------------ étapes (420 × 270)

EL, EH = 420, 270


def e1():
    """Le coin haut gauche reste libre : le numéro de l'étape s'y pose."""
    s = ''
    for i, l in enumerate('ABC'):
        s += pastille(70 + i * 62, 118, 24, l)
        s += pastille(70 + i * 62, 206, 24, l)
    s += f'<line x1="36" y1="162" x2="210" y2="162" stroke="#C9D2DE" stroke-width="3" stroke-dasharray="6 6"/>'
    s += badge(226, 100, 'plaie', BLEU) + badge(226, 188, 'microbiote', ROUGE)
    s += feutre(150, 96, -38, 112)
    return svg(EL, EH, s, fond=False)


def e2():
    s = flacon(70, 120, BLEU, 'A', 92, 120)
    s += f'<rect x="64" y="230" width="104" height="10" rx="5" fill="{BLEU}"/>'
    s += pince(116, 132, -52, 130)
    s += pastille(116, 138, 14)
    s += goutte(150, 108, 8)
    s += (f'<text x="250" y="150" font-size="22" font-weight="700" fill="{TRAIT}">tremper</text>'
          f'<text x="250" y="180" font-size="22" font-weight="700" fill="{TRAIT}">égoutter</text>')
    s += fleche(240, 158, 172, 132, TRAIT, 10)
    return svg(EL, EH, s, fond=False)


def e3():
    s = boite(250, 128, 92, 'plaie', BLEU, pastilles=[(-38, -30, 'A')])
    s += pince(212, 98, -140, 110)
    s += (f'<text x="22" y="200" font-size="22" font-weight="700" fill="{TRAIT}">loin</text>'
          f'<text x="22" y="228" font-size="22" font-weight="700" fill="{TRAIT}">du bord</text>')
    s += fleche(80, 186, 196, 110, TRAIT, 30)
    return svg(EL, EH, s, fond=False)


def e4():
    s = gobelet(40, 92, 120, 130)
    s += pince(100, 150, -70, 140)
    s += fleche(180, 140, 230, 140, TRAIT)
    s += boite(318, 122, 82, 'plaie', BLEU, pastilles=[(-32, -26, 'A'), (32, -26, 'B'), (0, 34, 'C')])
    return svg(EL, EH, s, fond=False)


def e5():
    s = ''.join(flacon(28 + i * 52, 104, ROUGE, l, 40, 66) for i, l in enumerate('ABC'))
    s += f'<rect x="22" y="184" width="152" height="9" rx="4" fill="{ROUGE}"/>'
    s += fleche(184, 140, 226, 140, TRAIT)
    s += boite(318, 122, 82, 'microbiote', ROUGE, pastilles=[(-32, -26, 'A'), (32, -26, 'B'), (0, 34, 'C')])
    return svg(EL, EH, s, fond=False)


def e6():
    s = boite(150, 128, 86, None, pastilles=[(-32, -26, 'A'), (32, -26, 'B'), (0, 34, 'C')],
              halos=[(-32, -26, 30), (32, -26, 18), (0, 34, 24)])
    cx, cy, r = 320, 120, 62
    s += (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#fff" stroke="{TRAIT}" stroke-width="5"/>'
          f'<path d="M{cx},{cy} L{cx},{cy-r+6} A{r-6},{r-6} 0 0 1 {cx+(r-6)*math.sin(math.radians(60)):.1f},'
          f'{cy-(r-6)*math.cos(math.radians(60)):.1f} Z" fill="#FFE08A"/>'
          f'<rect x="{cx-10}" y="{cy-r-20}" width="20" height="14" rx="4" fill="{TRAIT}"/>'
          f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy-r+14}" stroke="{TRAIT}" stroke-width="5"/>'
          f'<text x="{cx}" y="{cy+r+40}" font-size="26" font-weight="700" text-anchor="middle" fill="{TRAIT}">10 min</text>')
    return svg(EL, EH, s, fond=False)


ETAPES = [('e1-ecrire', e1), ('e2-tremper', e2), ('e3-poser', e3), ('e4-rincer', e4), ('e5-microbiote', e5),
          ('e6-attendre', e6)]


if __name__ == '__main__':
    sortie = sys.argv[1]
    os.makedirs(sortie, exist_ok=True)
    for nom, f in MATERIEL:
        print(photo(PAGE + f(), os.path.join(sortie, 'paillasse-%s.png' % nom), M, M))
    for nom, f in ETAPES:
        print(photo(PAGE + f(), os.path.join(sortie, 'paillasse-%s.png' % nom), EL, EH))
