"""Les trois animations de la correction « Des chenilles en Lorraine : climat et répartition des
espèces » (5e, séquence 2, activité 1), validées sur storyboard par Thomas le 25/11/2026 :

  A. « Le front qui remonte »                               (question 4 et bilan)  chenilles_front_scene.js
  B. « Une nuit d'hiver dans le nid »                       (question 2)           chenilles_nid_scene.js
  C. « Pin ou chêne ? Le calendrier des poils urticants »   (question 1)           chenilles_calendrier_scene.js

Les textes (titre et légende des étapes) sont ici : ils se réécrivent sans toucher au dessin (ou
dans l'application, panneau « Étapes »). Dessins : animation/banque/chenilles.js.
Scène 1600 x 570 : le cadre est posé en haut de l'écran (960 x 444), rien à lire sous y = 450.

Données (vérifiées pour l'activité) : front de 87 km vers le nord entre 1972 et 2004 dans le Bassin
parisien, environ 5,5 km par an depuis 2000, hivers réchauffés d'environ 1,1 °C (Battisti et al.,
2005 ; INRAE) ; seuils 9 °C (nid, le jour), 0 °C (air, la nuit), −16 °C (mort) ; front dans l'Aube et
le sud de la Marne, à environ 125 km de Metz, foyer isolé à Obernai par introduction accidentelle
(FREDON Grand Est, 2021) ; pin urticant de novembre à avril, chêne de mai à juillet. Les tracés du
front en 1972 et en 2004 sont schématiques (seuls les 87 km sont des données).

    python chenilles_animations.py <dossier> [a|b|c]   écrit les HTML et une image par étape
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
import gc_animation as ga  # noqa: E402

E = ga.etape
L, H = 1600, 570
CADRE = (960, 444)   # largeur, hauteur du cadre sur l'écran
PROPORTION = round(CADRE[0] / CADRE[1], 3)


def _lire(*noms):
    return '\n'.join(open(os.path.join(ICI, n), encoding='utf-8').read() for n in noms)


FRONT = [
    E('debut', 'En 1972',
      'En 1972, le <b>front d’expansion</b> de la processionnaire du pin passe <b>au sud de Paris</b>.'),
    E('remonte', 'De 1972 à 2004',
      'En 32 ans, le front remonte de <b>87 km</b> vers le nord : environ <b>2,7 km par an</b>. '
      'Les hivers se réchauffent de <b>1,1 °C</b>.'),
    E('accelere', 'Depuis 2000, le front accélère',
      'Depuis 2000, il avance de <b>5,5 km par an</b> : deux fois plus vite. '
      'Il atteint l’<b>Aube</b> et le <b>sud de la Marne</b>.'),
    E('saut', 'Un saut : le transport par l’humain',
      'À <b>Obernai</b>, loin du front : des chenilles <b>transportées par accident</b> par l’humain. '
      'Ce saut ne vient pas du climat.'),
    E('lorraine', 'Et la Lorraine ?',
      'Avec des <b>hivers plus doux</b>, le front remonte vers le nord. Il est à <b>125 km de Metz</b>, '
      'aux portes de la Lorraine.', bilan=True),
]


def front():
    return ga.assembler('Le front qui remonte', FRONT, _lire('chenilles_front_scene.js'),
                        banques=['chenilles'], largeur=L, hauteur=H, proportion=PROPORTION)


NID = [
    E('nid', 'Un nid dans un pin, en hiver',
      'En hiver, les chenilles vivent en colonie dans un <b>nid de soie</b>, au bout d’une branche de pin.'),
    E('sortie', 'Air à 3 °C : elles sortent manger',
      'L’air reste <b>au-dessus de 0 °C</b> : la nuit, les chenilles sortent en procession et '
      '<b>mangent les aiguilles</b>.'),
    E('reste', 'Air à −4 °C : elles restent au nid',
      'Sous <b>0 °C</b>, elles restent au nid <b>sans manger</b>. Nuit froide après nuit froide, '
      'leurs <b>réserves</b> s’épuisent.'),
    E('mort', 'Air à −17 °C : la colonie meurt',
      'Sous <b>−16 °C</b>, les chenilles meurent. Le <b>froid de l’hiver</b> est le '
      '<b>facteur limitant</b> de la chenille du pin.', bilan=True),
]


def nid():
    return ga.assembler('Une nuit d’hiver dans le nid', NID, _lire('chenilles_nid_scene.js'),
                        banques=['chenilles'], largeur=L, hauteur=H, proportion=PROPORTION)


CALENDRIER = [
    E('calendrier', 'Deux calendriers',
      'La processionnaire <b>du pin</b> est urticante de <b>novembre à avril</b>, '
      'celle <b>du chêne</b> de <b>mai à juillet</b>.'),
    E('mairie', 'Fin juin : le message de la mairie',
      'Fin juin, seule la chenille <b>du chêne</b> est urticante. '
      'Celle du pin ne l’est plus depuis <b>avril</b>.'),
    E('patis', 'Au Pâtis, en juin',
      'Au parc du Pâtis, ce sont des processionnaires <b>du chêne</b> : bonne saison, '
      'et seule espèce installée en Lorraine.', bilan=True),
]


def calendrier():
    return ga.assembler('Pin ou chêne ? Le calendrier des poils urticants', CALENDRIER,
                        _lire('chenilles_calendrier_scene.js'),
                        banques=['chenilles'], largeur=L, hauteur=H, proportion=PROPORTION)


# clé : (nom, fabrique, instant photographié de chaque étape, vers sa fin)
ANIMATIONS = {
    'a': ('front', front, [6.8, 9.8, 9.8, 8.8, 8.8]),
    'b': ('nid', nid, [6.8, 9.5, 9.8, 8.8]),
    'c': ('calendrier', calendrier, [8.8, 8.8, 8.8]),
}
# étape et instant de l'image d'affiche (vignettes, export PDF)
AFFICHES = {'a': (3, 9.8), 'b': (2, 8), 'c': (2, 8.8)}


def generer(dossier, quoi='abc'):
    os.makedirs(dossier, exist_ok=True)
    for cle in quoi:
        if cle not in ANIMATIONS:
            continue
        nom, fabrique, instants = ANIMATIONS[cle]
        code = fabrique()
        html = ga.ecrire(code, os.path.join(dossier, nom + '.html'))
        print(nom, len(code), 'caractères')
        for i, t in enumerate(instants, 1):
            ga.apercu(html, os.path.join(dossier, '%s-%02d.png' % (nom, i)), etape=i, instant=t,
                      largeur=CADRE[0], hauteur=CADRE[1])


if __name__ == '__main__':
    generer(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'abc')
