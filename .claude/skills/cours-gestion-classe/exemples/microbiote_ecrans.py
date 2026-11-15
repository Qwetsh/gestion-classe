"""
Exemple : des écrans écrits **uniquement avec les gabarits** de gc_ecrans, pour l'activité
« L'activité du microbiote » (3e) dont la fiche est dans microbiote.py.

À lire à côté de la fiche : la fiche porte le cartouche, les objectifs, « J'ai réussi » ; les
écrans portent la problématique, la consigne, un document en grand, une question par écran, les
réponses sous cache et le bilan.

Attention : le texte des documents 2 et 3 est écrit pour l'exemple, ce ne sont pas les documents
de Thomas. Ne pas envoyer ces écrans tels quels.

Lancer : python -I microbiote_ecrans.py <fichier de sortie .json>
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from gc_ecrans import *  # noqa: E402,F401,F403

e = Ecrans('mic', "Activité 2 · L'activité du microbiote")

e.titre('Séquence 1 — Micro-organismes', 'Activité 2', "L'activité du microbiote",
        problematique='Quelles aides les microbiotes nous apportent-ils ?')

e.situation(['Des milliards de micro-organismes vivent en permanence dans notre corps : c’est le <b>microbiote</b>.',
             'Ils ne nous rendent pas malades.'],
            question='À quoi nous servent-ils ?')

e.consigne('Ce que tu fais', [('Lis', 'les documents 1 à 5.'),
                              ('Réponds', 'aux questions 1 à 3 sur ta fiche.'),
                              ('Rédige', 'des phrases complètes, sans recopier les documents.')],
           minuteur=900, note='Les questions 2 et 3 sont notées.')

e.document('Document 1 — L’expérience d’Alfred Nissle',
           ['1917 : une épidémie de dysenterie touche des soldats. L’un d’eux ne tombe pas malade.',
            'Alfred Nissle trouve dans son intestin une souche particulière de la bactérie <i>E. coli</i> : la souche A.',
            'Cultivée avec des bactéries pathogènes, la souche A les empêche de se multiplier.'],
           encadre='<b>Une souche</b> : une variété particulière à l’intérieur d’une même espèce.')

e.question('Question 1 — La souche A',
           'À partir du <b>document 1</b>, <b>explique</b> quel intérêt la souche A présente pour les êtres humains.',
           [('J’observe', 'Avec la souche A, les bactéries pathogènes ne se multiplient plus.'),
            ('J’en déduis', 'La souche A protège celui qui la porte contre certaines maladies.')])

e.tableau('Question 2 — Le microbiote intestinal', ['Document', 'Ce que j’observe', 'Ce que j’en déduis'], [
    ['Document 2',
     'Des souris sans microbiote sont infectées plus facilement par une bactérie pathogène.',
     'Le microbiote empêche les pathogènes de s’installer : c’est l’effet barrière.'],
    ['Document 3',
     'Des souris élevées sans microbiote ont un système immunitaire peu développé.',
     'Le microbiote participe à la mise en place du système immunitaire.'],
], bareme='4 pts')

e.calcul('Pour aller plus loin — Une multiplication rapide',
         'Une bactérie se divise en deux toutes les <b>20 minutes</b>. <b>Calcule</b> le nombre de bactéries obtenues '
         'en <b>2 heures</b>, à partir d’une seule.',
         ['2 h = 120 min, soit 6 divisions.', '1 → 2 → 4 → 8 → 16 → 32 → 64', '64 bactéries en 2 heures.'])

T = e.trou
e.bilan('<div>Le ' + T('microbiote') + ' est l’ensemble des micro-organismes qui vivent dans notre corps sans nous '
        'rendre malades.</div>'
        '<div><br></div>'
        '<div>Il nous protège : il empêche les micro-organismes ' + T('pathogènes') + ' de s’installer, c’est '
        'l’' + T('effet barrière') + '. Il participe aussi à la mise en place du ' + T('système immunitaire') + '.</div>'
        '<div><br></div>'
        '<div>Dans l’intestin, il nous aide à ' + T('digérer') + ' certains aliments.</div>')

if __name__ == '__main__':
    e.ecrire(sys.argv[1])
