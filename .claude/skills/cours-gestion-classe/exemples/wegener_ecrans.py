"""
Exemple : les écrans de l'activité « Wegener et la dérive des continents » (4e, séquence 2,
activité 3), tels qu'ils ont été joués en classe en novembre 2026.

Il montre les deux niveaux de gc_ecrans : les gabarits quand la page est d'un modèle courant
(titre, tableau, calcul, bilan), les primitives quand elle a été réglée à la main.
Il reproduit à l'identique le fichier envoyé le 14/11/2026 : c'est le contrôle de non-régression
du générateur.

Lancer : python -I wegener_ecrans.py <fichier de sortie .json>
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gc_ecrans import *  # noqa: E402,F401,F403

e = Ecrans('weg', 'Activité 3 · Wegener et la dérive des continents')

# 1 — Titre (gabarit)
e.titre('Séquence 2 — Sous nos pieds, une Terre en mouvement', 'Activité 3', 'Wegener et la dérive des continents',
        problematique="Quels indices Wegener avait-il pour affirmer que les continents se déplacent, et pourquoi ne l'a-t-on pas cru ?")

# 2 — Situation de départ (primitives : espacement réglé à la main)
p = e.ecran('Situation de départ')
p.texte(60, 130, 880, 32, '<b>1912</b> — Alfred Wegener, un météorologue allemand, affirme que <b>les continents se déplacent</b>.')
p.texte(60, 245, 880, 32, 'La plupart des géologues refusent son idée. Il meurt en 1930 sans les avoir convaincus.')
p.texte(60, 360, 880, 32, "Aujourd'hui, les mesures GPS de l'activité 1 lui donnent raison.", BLEU2)
p.texte(60, 475, 880, 30, "<b>Quels étaient ses indices ? Pourquoi ne l'a-t-on pas cru ?</b>", ROUGE)

# 3 — Matériel
p = e.ecran("Ce qu'il te faut")
p.texte(60, 125, 880, 30, '<div>• le <b>Journal du collège « Spécial Wegener »</b> : articles 1 à 4</div>'
        '<div>• le <b>gabarit du puzzle</b>, des ciseaux, de la colle</div><div>• une calculatrice</div>'
        '<div>• ta fiche : le <b>document 5</b> est dessus</div>')
p.texte(60, 385, 880, 24, 'Fiche ramassée, notée sur 10.', GRIS)
p.texte(60, 440, 880, 22, '<b>Rappel de l’activité 2 :</b> une plaque, c’est la lithosphère. Elle glisse sur '
        'l’asthénosphère, qui est solide.', JAUNE_TEXTE, fond=FOND_JAUNE)

# 4 — Question 1 : le puzzle (consigne avec minuteur, posée à la main)
p = e.ecran('Question 1 — Le puzzle', '1,5 pt')
p.texte(60, 125, 560, 30, '<div><b>1. Découpe</b> les deux continents.</div><div><b>2. Assemble</b>-les comme un puzzle.</div>'
        '<div><b>3. Colle</b>-les dans le cadre.</div><div><b>4. Décris</b> ce que tu remarques : les côtes, puis les zones à '
        'fossiles de Mesosaurus.</div>')
p.minuteur(640, 130, 600)
p.texte(60, 470, 880, 22, 'Les petits vides sont normaux : on ne recoupe pas les pièces.', GRIS)

# 5 — Question 1 : ce que l'on remarque (image sous rideau, envoyée par gc_envoi.py image)
p = e.ecran('Question 1 — Ce que l’on remarque')
p.image(77, 125, 367, 390, '73f03330-7b03-42f1-b355-3378c4f94710/import/bbcd7014-759a-4da4-9a8c-33289dffdd47.png',
        1064, 1132, cache='Le puzzle assemblé')
p.texte(490, 125, 450, 26, '<b>Les côtes</b>', BLEU)
p.reponse(490, 165, 450, 26, 'Elles s’emboîtent presque parfaitement, comme les pièces d’un puzzle.')
p.texte(490, 310, 450, 26, '<b>Les zones à Mesosaurus</b>', BLEU)
p.reponse(490, 350, 450, 26, 'Une fois les pièces assemblées, les deux zones se retrouvent face à face.')

# 6 — Question 2
p = e.ecran('Question 2 — « À la nage » ?', '1 pt')
p.texte(60, 120, 880, 28, 'Un camarade propose : « Les Mesosaurus ont traversé l’océan à la nage. » <b>Montre</b>-lui que cette '
        'explication ne tient pas.')
p.texte(60, 245, 880, 24, '<b>Le Mesosaurus</b>', BLEU)
p.reponse(60, 280, 880, 26, 'C’est un reptile d’eau douce : il ne pouvait pas traverser un océan d’eau salée.')
p.texte(60, 365, 880, 24, '<b>Le Glossopteris</b>', BLEU)
p.reponse(60, 400, 880, 26, 'C’est une plante : elle ne se déplace pas, et ses graines, lourdes, ne traversent pas un océan.')
p.reponse(60, 495, 880, 26, '<b>L’océan n’existait pas encore.</b>')

# 7 et 8 — Question 3 : le tableau des arguments (gabarit, deux lignes par écran)
e.tableau('Question 3 — Les arguments de Wegener', ['Argument', 'Ce que Wegener observe', 'Ce qu’il en déduit'], [
    ['Formes des côtes<br>(article 1 et puzzle)',
     'Les côtes de l’Amérique du Sud et de l’Afrique s’emboîtent comme des pièces de puzzle.',
     'Ces deux continents formaient un seul bloc, puis se sont séparés.'],
    ['Chaînes de montagnes<br>(article 2)',
     'Des chaînes de même âge et de mêmes roches, de part et d’autre de l’Atlantique.',
     'Elles se sont formées d’un seul tenant, quand les continents étaient collés.'],
    ['Fossiles<br>(article 3)',
     'Les mêmes fossiles (Mesosaurus, Glossopteris…) sur des continents séparés par un océan.',
     'Ces continents étaient reliés quand ces espèces vivaient.'],
    ['Climats anciens<br>(article 4)',
     'Des traces de glaciers dans des régions aujourd’hui chaudes.',
     'Ces régions étaient réunies près du pôle Sud ; elles se sont déplacées depuis.'],
], bareme='4 pts', taille=20)  # taille telle qu'elle a été envoyée ; sans elle, le gabarit prend 22

# 9 — Document 5
p = e.ecran('Document 5 — On n’a pas cru Wegener')
p.texte(60, 120, 880, 24, 'Wegener imaginait que les continents avançaient <b>à travers</b> le fond des océans, comme un '
        'brise-glace dans la banquise.')
p.texte(60, 200, 880, 24, 'Les physiciens ont montré que c’était <b>impossible</b> : le fond des océans est très rigide, et '
        'aucune force connue ne pouvait y pousser un continent.')
p.texte(60, 312, 880, 24, 'Wegener avait des <b>indices solides</b>, mais une <b>explication fausse</b>. Il a fallu attendre '
        'les années 1960 pour comprendre.')
p.texte(60, 400, 880, 24, 'Aujourd’hui, le <b>GPS</b> mesure que l’Amérique du Sud et l’Afrique s’écartent de <b>3 cm par an</b>. '
        'L’Atlantique sud s’ouvre depuis <b>130 millions d’années</b>.', NOIR, fond='#EEF3F9')

# 10 — Question 4
p = e.ecran('Question 4 — Pourquoi ce refus ?', '2 pts')
p.texte(60, 118, 880, 26, '<b>a. Explique</b> pourquoi la plupart des géologues ont refusé la théorie de Wegener.')
p.reponse(60, 195, 880, 24, 'Il ne savait pas expliquer comment les continents bougent : avancer à travers le fond de l’océan, '
          'très rigide, c’était impossible.')
p.texte(60, 295, 880, 26, '<b>b.</b> Avec l’activité 2, <b>explique</b> comment un continent se déplace vraiment.')
p.reponse(60, 372, 880, 24, 'Le continent fait partie d’une plaque, la lithosphère. C’est toute la plaque qui glisse sur '
          'l’asthénosphère : le continent est transporté avec elle.')

# 11 — Question 5 (gabarit calcul)
e.calcul('Question 5 — Quel écart ?',
         '<b>3 cm par an</b>, pendant <b>130 millions d’années</b>. On admet que la vitesse n’a pas changé.',
         ['3 × 130 000 000 = 390 000 000 cm', '390 000 000 cm = 3 900 km',
          'Même ordre de grandeur que la largeur de l’Atlantique sud : 3 000 à 6 000 km.'], bareme='1,5 pt')

# 12 — Pour aller plus loin
p = e.ecran('★ Pour aller plus loin — Le charbon de Lorraine')
p.texte(60, 118, 880, 26, 'Près de Forbach, le charbon s’est formé il y a 300 millions d’années, dans des forêts de marécages '
        'chauds et humides, comme près de l’équateur aujourd’hui. La Lorraine a pourtant un climat tempéré.')
p.texte(60, 268, 880, 26, '<b>Propose</b> deux explications. Laquelle est celle de Wegener ?')
p.reponse(60, 345, 880, 24, '1. Le climat de toute la Terre était différent. 2. La Lorraine était ailleurs : près de '
          'l’équateur, puis sa plaque l’a portée vers le nord. C’est l’explication de Wegener.')

# 13 — Bilan (gabarit, texte à trous)
T = e.trou
e.bilan('<div>En 1912, Alfred Wegener propose la ' + T('dérive des continents') + ' : les continents étaient autrefois '
        'réunis en un seul bloc, la ' + T('Pangée') + ', puis se sont séparés.</div>'
        '<div><br></div>'
        '<div>Ses indices : la complémentarité des ' + T('côtes') + ', des ' + T('chaînes de montagnes') + ' de même âge de '
        'part et d’autre de l’Atlantique, les mêmes ' + T('fossiles') + ' sur des continents séparés, et des traces de '
        + T('climats anciens') + '.</div>'
        '<div><br></div>'
        '<div>Sa théorie est d’abord rejetée : il n’explique pas ' + T('comment') + ' les continents se déplacent. On sait '
        'aujourd’hui que ce sont les ' + T('plaques') + ' qui bougent, en portant les continents ; les mesures '
        + T('GPS') + ' le confirment.</div>',
        taille=26)  # mesuré dans l'application : 11 lignes, le texte s'arrête à 495 ; l'estimation en compte 13

if __name__ == '__main__':
    e.ecrire(sys.argv[1])
