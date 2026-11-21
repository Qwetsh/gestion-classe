"""Les trois animations de la correction « Wegener et la dérive des continents » (4e, séquence 2,
activité 3), validées une par une par Thomas le 21/11/2026 :

  A. « Le puzzle se ferme »         (question 1)  wegener_puzzle_scene.js
  B. « Brise-glace ou plaque ? »    (question 4 b) wegener_coupe_scene.js
  C. « L'Atlantique s'ouvre »       (question 5)  wegener_ouverture_scene.js

Les textes (titre et légende des étapes) sont ici : ils se réécrivent sans toucher au dessin (ou
dans l'application, panneau « Étapes »). Dessins : animation/banque/tectonique.js et wegener_carte.js.
Scène 1600 x 570 : le cadre est posé en haut de l'écran (960 x 444), rien à lire sous y = 450.

    python wegener_animations.py <dossier> [a|b|c]   écrit les HTML et une image par étape
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


PUZZLE = [
    E('actuel', 'Le puzzle de Wegener',
      'Aujourd\'hui, l\'<b>océan Atlantique</b> sépare l\'Amérique du Sud et l\'Afrique.'),
    E('rapprochement', 'On rapproche les deux continents',
      'On fait tourner l\'Amérique du Sud vers l\'Afrique. La <b>pointe du Brésil</b> se loge dans le <b>golfe de Guinée</b>.'),
    E('emboitement', 'Les côtes s\'emboîtent',
      'Les côtes s\'emboîtent <b>presque parfaitement</b>, comme les pièces d\'un puzzle. Il reste de <b>petits vides</b>.'),
    E('fossiles', 'Les zones à Mesosaurus',
      'Les deux zones à fossiles de <b>Mesosaurus</b> se retrouvent <b>face à face</b>, l\'une dans le prolongement de l\'autre.'),
    E('talus', 'Et les petits vides ?',
      'Le <b>vrai bord</b> d\'un continent est <b>sous la mer</b> : les vides disparaissent. On ne recoupe pas les pièces.'),
]


def puzzle():
    return ga.assembler('Le puzzle se ferme', PUZZLE, _lire('wegener_carte.js', 'wegener_puzzle_scene.js'),
                        banques=['tectonique'], largeur=L, hauteur=H, proportion=PROPORTION)


OUVERTURE = [
    E('colles', "Il y a 130 millions d'années",
      "L'Amérique du Sud et l'Afrique sont <b>collées</b> : l'Atlantique sud n'existe pas encore."),
    E('ouverture', "L'Atlantique sud s'ouvre",
      "Les deux plaques s'écartent. À la <b>dorsale</b>, du <b>nouveau fond océanique</b> se forme, de chaque côté."),
    E('calcul', '3 cm par an',
      "À <b>3 cm par an</b>, un million d'années suffit pour s'écarter de <b>30 km</b>."),
    E('aujourdhui', "Aujourd'hui",
      "En 130 millions d'années : <b>3 900 km</b>. C'est le même <b>ordre de grandeur</b> que la largeur de l'Atlantique sud."),
    E('limite', 'Les limites du calcul',
      "Limite : la <b>vitesse a varié</b>, et l'ouverture a <b>commencé au sud</b>. L'océan y est plus large."),
]


def ouverture():
    return ga.assembler("L'Atlantique sud s'ouvre", OUVERTURE, _lire('wegener_carte.js', 'wegener_ouverture_scene.js'),
                        banques=['tectonique'], largeur=L, hauteur=H, proportion=PROPORTION)


COUPE = [
    E('idee', "L'idée de Wegener",
      "Wegener imaginait des continents de roches légères qui avancent <b>à travers</b> le fond de l'océan, comme un <b>brise-glace</b>."),
    E('bloque', 'Pourquoi on ne l’a pas cru',
      "Le fond de l'océan est <b>très rigide</b> : aucune force connue ne peut y pousser un continent. L'explication est <b>impossible</b>."),
    E('plaque', 'Ce que l’on sait aujourd’hui',
      "Le continent fait partie d'une <b>plaque</b> : la <b>lithosphère</b> (croûte + manteau rigide), épaisse d'environ 100 km."),
    E('glisse', 'Toute la plaque se déplace',
      "C'est <b>toute la plaque</b> qui glisse sur l'<b>asthénosphère</b>. Le continent est <b>transporté</b> avec elle."),
    E('dorsale', 'À la dorsale',
      "À la <b>dorsale</b>, de la nouvelle plaque se forme : l'Amérique du Sud et l'Afrique s'<b>écartent</b> (activité 1)."),
    E('lave', 'Bilan',
      "Le continent ne traverse pas le fond de l'océan : il est porté par sa <b>plaque</b>, qui glisse sur l'asthénosphère <b>solide</b>.",
      bilan=True),
]


def coupe():
    return ga.assembler('Brise-glace ou plaque ?', COUPE, _lire('wegener_coupe_scene.js'),
                        banques=['tectonique'], largeur=L, hauteur=H, proportion=PROPORTION)


ANIMATIONS = {
    'a': ('puzzle', puzzle, [5.5, 8.8, 6.5, 7.5, 7.5]),
    'b': ('coupe', coupe, [7.8, 6.8, 8.8, 8.8, 8.8, 7.8]),
    'c': ('ouverture', ouverture, [5.5, 9.5, 9.8, 9.5, 7.5]),
}


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
