"""
Exemple des écrans interactifs (lot A) : 4e, séquence 2, sans image à envoyer.

Montre chaque nouveauté de gc_ecrans : déplacement animé pas à pas (`suivant` + `DeplacerVers`),
processus en étapes (`etapes`), schéma à légender (`schema`, avec un dessin de la bibliothèque),
vrai / faux contre les idées fausses (`vrai_faux`), QCM (`qcm`), coup de pouce (`coup_de_pouce`),
sommaire de correction (`sommaire`).

    python -I interactifs_4e.py <sortie.json>

Ce n'est pas une activité de Thomas : c'est le banc d'essai du générateur. Le contenu reste juste.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gc_ecrans import *  # noqa: E402,F403

e = Ecrans('dem', 'Exemple · écrans interactifs (4e, séquence 2)')

e.titre('Séquence 2 — Sous nos pieds, une Terre en mouvement', 'Exemple', 'Les continents se déplacent',
        problematique='Comment l’Atlantique sud s’est-il ouvert ?')

# 2 — Déplacement animé : l'Afrique et l'Amérique du Sud s'écartent, étape par étape
p = e.ecran('L’ouverture de l’Atlantique sud')
p.fond('grid')
amerique = p.forme('pentagon', 330, 190, 170, 230, trait='#7C5A2E', fond='#E9D8B4', texte=B('Amérique<br>du Sud'), taille=20)
afrique = p.forme('hexagon', 500, 170, 200, 250, trait='#7C5A2E', fond='#E9D8B4', texte=B('Afrique'), taille=20)
ocean = p.texte(430, 290, 140, 20, B('Atlantique<br>sud'), BLEU2)
p.cacher(ocean)
date = p.texte(MARGE, 110, 400, 26, B('Il y a 130 millions d’années'), BLEU_FONCE)
date2 = p.texte(MARGE, 110, 400, 26, B('Il y a 65 millions d’années'), BLEU_FONCE)
date3 = p.texte(MARGE, 110, 400, 26, B('Aujourd’hui : ≈ 3 900 km'), ROUGE)
p.cacher(date2, date3)
p.suivant(740, 478, [
    [DeplacerVers(amerique, 230, 200), DeplacerVers(afrique, 600, 175), Masquer(date), Afficher(date2), Afficher(ocean)],
    [DeplacerVers(amerique, 90, 215), DeplacerVers(afrique, 720, 180), Masquer(date2), Afficher(date3)],
])
p.coup_de_pouce('<div>Les plaques s’écartent d’environ <b>3 cm par an</b>.</div>'
                '<div>3 cm × 130 000 000 ans = 390 000 000 cm = 3 900 km.</div>', x=60, y=478)

# 3 — Un processus en étapes, illustré par un dessin de la bibliothèque
e.etapes('Une éruption, étape par étape', [
    ('Le magma se forme', 'en profondeur, des roches fondent.'),
    ('Il remonte', 'moins dense, il monte et s’accumule dans un réservoir.'),
    ('La pression augmente', 'les gaz poussent le magma vers la surface.'),
    ('L’éruption', 'lave, gaz et cendres sortent par le cratère.'),
], dessin='volcano')

# 4 — Schéma à légender, une étiquette par toucher
e.schema('Légender le volcan', [
    ('Cratère', (0.5, 0.08)),
    ('Cheminée', (0.5, 0.45)),
    ('Coulée de lave', (0.78, 0.62)),
    ('Réservoir magmatique', (0.5, 0.92)),
], dessin='volcano')

# 5 — Le même schéma en mode « toucher » : la classe désigne, le professeur touche
e.schema('Où est la cheminée ?', [('Cheminée', (0.5, 0.45)), ('Cratère', (0.5, 0.08))], dessin='volcano', mode='toucher')

# 6 — Vrai / faux contre les idées fausses
vf = e.vrai_faux('Vrai ou faux ?', [
    ('Les continents flottent sur un océan de magma.', False,
     'Sous la lithosphère, l’asthénosphère est solide : elle se déforme très lentement.'),
    ('Les plaques se déplacent de quelques centimètres par an.', True,
     'Les mesures GPS donnent de 1 à 10 cm par an selon les plaques.'),
    ('Une plaque, c’est un continent.', False,
     'Une plaque porte souvent un continent ET une partie d’océan.'),
])

# 7 — QCM, vote à main levée puis réponse
q = e.qcm('Question flash', 'Pourquoi la théorie de Wegener a-t-elle d’abord été <b>rejetée</b> ?', [
    'Ses indices étaient faux.',
    'Il n’expliquait pas comment les continents bougent.',
    'Personne ne connaissait le Mesosaurus.',
], bonne=1, explication='Ses indices étaient solides ; c’est le mécanisme proposé qui était impossible.')

# 8 — Bilan
e.bilan('<div>Les continents sont portés par des ' + e.trou('plaques') + ' qui se déplacent de quelques '
        + e.trou('centimètres') + ' par an.</div>')

# Sommaire de correction, rangé en deuxième position
e.sommaire('Correction — aller à…', [('Le déplacement', p), ('Vrai ou faux', vf), ('Question flash', q)], position=1)

if __name__ == '__main__':
    e.ecrire(sys.argv[1])
