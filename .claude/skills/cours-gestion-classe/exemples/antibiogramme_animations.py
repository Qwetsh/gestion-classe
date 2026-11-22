"""Les deux animations de l'antibiogramme (3e, séquence 2, activité 3), acceptées par Thomas le 22/11/2026.

A. « Comment lire un antibiogramme ? » : le modèle de la classe (chou rouge + vinaigre) à côté d'un vrai
   antibiogramme ; même principe, la diffusion ; la mesure du diamètre.
B. « Quand les antibiotiques ne marchent plus » : sélection des bactéries résistantes (document 3).

    python antibiogramme_animations.py <dossier de sortie> [aperçus]
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
import gc_animation as ga  # noqa: E402

LECTURE = [
    ga.etape('boites', 'Deux boîtes', 'À gauche, <b>notre modèle</b> : un gel au jus de chou rouge. À droite, '
             '<b>un vrai antibiogramme</b> : une gélose où l’on a semé des bactéries.'),
    ga.etape('pastilles', 'Les pastilles', 'On pose trois <b>pastilles</b> imbibées de produits différents : '
             'A, B et C.'),
    ga.etape('diffusion', 'Le produit se répand', 'Le produit <b>se répand</b> dans le gel autour de la pastille : '
             'il est de moins en moins concentré en s’éloignant.'),
    ga.etape('zones', 'La zone apparaît', 'Là où il y en a assez, le chou rouge <b>change de couleur</b> ; sur la '
             'vraie boîte, les bactéries <b>ne poussent pas</b> : la zone claire.'),
    ga.etape('mesure', 'On mesure', 'On mesure le <b>diamètre</b> de la zone avec une règle, pastille comprise.'),
    ga.etape('bilan', 'Bilan', 'Plus la zone est grande, plus la bactérie est <b>sensible</b> à l’antibiotique.',
             bilan=True),
]

RESISTANCE = [
    ga.etape('colonie', 'Dans la plaie', 'Parmi les bactéries de la plaie, quelques-unes sont <b>résistantes</b> '
             'à l’antibiotique, par hasard, avant tout traitement.'),
    ga.etape('dose', 'Une prise d’antibiotique', 'L’antibiotique détruit les bactéries <b>sensibles</b>. Les '
             'résistantes survivent.'),
    ga.etape('multiplication', 'Les résistantes se multiplient', 'Sans les autres, les bactéries résistantes '
             '<b>se multiplient</b> : elles deviennent nombreuses.'),
    ga.etape('echec', 'L’antibiotique ne marche plus', 'Une nouvelle prise du même antibiotique ne fait plus '
             'rien : l’infection <b>résiste</b> au traitement.'),
    ga.etape('microbiote', 'Et le microbiote ?', 'L’antibiotique détruit aussi une partie du <b>microbiote</b> '
             'intestinal ; des bactéries résistantes peuvent s’y installer.'),
    ga.etape('bilan', 'Bilan', 'Les bactéries résistantes existaient déjà : l’antibiotique les <b>sélectionne</b>. '
             'Plus on en prend, plus elles deviennent nombreuses.', bilan=True),
]


CADRE = (960, 444)   # cadre sur l'écran : ses boutons restent sous y = 450 (règle du 19/11/2026)
PROPORTION = round(CADRE[0] / CADRE[1], 3)


def _scene(nom):
    with open(os.path.join(ICI, nom), encoding='utf-8') as f:
        return f.read()


def lecture():
    return ga.assembler('Comment lire un antibiogramme ?', LECTURE, _scene('antibiogramme_lecture_scene.js'),
                        banques=['bacteries'], proportion=PROPORTION)


def resistance():
    return ga.assembler('Quand les antibiotiques ne marchent plus', RESISTANCE,
                        _scene('antibiogramme_resistance_scene.js'), banques=['bacteries'], proportion=PROPORTION)


# Instants de contrôle (vers la fin de chaque étape) et instant de l'affiche
INSTANTS = {'lecture': [5.5, 5.5, 8.5, 8.5, 7.5, 6.5], 'resistance': [6.5, 7.5, 8.5, 6.5, 8.5, 6.5]}
AFFICHE = {'lecture': (4, 8.5), 'resistance': (3, 8.5)}

if __name__ == '__main__':
    sortie = sys.argv[1]
    os.makedirs(sortie, exist_ok=True)
    for nom, fabrique in (('lecture', lecture), ('resistance', resistance)):
        html = ga.ecrire(fabrique(), os.path.join(sortie, 'antibiogramme-%s.html' % nom))
        print('écrit', html, len(fabrique()), 'caractères')
        if len(sys.argv) > 2:
            for i, t in enumerate(INSTANTS[nom], 1):
                ga.apercu(html, os.path.join(sys.argv[2], '%s-%02d.png' % (nom, i)), etape=i, instant=t,
                          largeur=CADRE[0], hauteur=CADRE[1])
    if len(sys.argv) > 2:
        print('aperçus dans', sys.argv[2])
