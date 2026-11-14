"""
Exemple de référence : la fiche élève « S1A2 — L'activité du microbiote » (3e), reproduite depuis la
fiche Word de Thomas. Lancer :  python exemples/microbiote.py <chemin du brouillon .json>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from gc_cours import *  # noqa: E402,F403

c = Cours("Activité 2 — L'activité du microbiote", niveau='3e', chapitre='Séquence 1 — Micro-organismes')

c.identite()
c.ajouter(Cartouche(
    'Séquence 1', ['La découverte des micro-organismes', 'Étude de documents'],
    "Activité 2 : L'activité du microbiote", classe='3',
    note='/20', note_detail='(questions 2 et 3)',
    infos=[('⏱', 'Durée', '1 à 2 séances'), ('👥', 'Modalité', 'Individuel'),
           ('🔧', 'Matériel', 'feuille de documents 1 à 5'), ('📖', 'Méthodes', 'FM1 (lire une consigne)')],
    problematique='Quelles aides les microbiotes nous apportent-ils ?',
    objectifs=["expliquer comment le microbiote empêche les micro-organismes pathogènes de s'installer (effet barrière) ;",
               'expliquer comment le microbiote participe à la mise en place du système immunitaire ;',
               'expliquer comment le microbiote participe à la digestion ;'],
))

c.para(B('Situation de départ : '), 'les micro-organismes du microbiote vivent en permanence dans notre corps '
       'sans nous rendre malades. On peut donc se demander à quoi ils nous servent.')

c.ajouter(Rappel(
    'la ', B('démarche déductive'), ' se fait en trois temps : ',
    B("j'observe"), ' ce que montre le document, ', B('je sais'),
    ' (une connaissance du cours), ', B("j'en déduis"), ' ma conclusion. — Une ',
    B('souche'), " est une variété particulière à l'intérieur d'une même espèce de "
    "micro-organisme : deux souches d'une même espèce peuvent avoir des effets très différents sur notre santé.",
))

c.titre2('Questions')
c.question(1, 'À partir du ', B('document 1'), " (expérience d'Alfred Nissle), ", B('explique'),
           " quel intérêt la souche A d'E. coli présente pour les êtres humains.")
c.question(2, 'À partir des documents 2 et 3, ', B('explique'), " l'importance et le fonctionnement du microbiote "
           'intestinal. ', B('Traite'), ' le document 2, puis le document 3, et ', B('termine'), ' par une conclusion.')
c.question(3, 'À partir des documents 4 et 5, ', B('explique'), ' en quoi le microbiote intestinal aide notre organisme à se nourrir.')

c.ajouter(PourAllerPlusLoin(P('Un traitement antibiotique détruit des bactéries. ', B('Explique'),
                              " pourquoi une diarrhée peut apparaître après une prise d'antibiotiques.", interligne='1.38')))
c.ajouter(JaiReussi(
    "expliquer comment le microbiote empêche les micro-organismes pathogènes de s'installer (effet barrière) ;",
    'expliquer comment le microbiote participe à la mise en place du système immunitaire ;',
    'expliquer comment le microbiote participe à la digestion ;',
    "écrire, pour chaque document, ce que j'observe, ce que je sais et ce que j'en déduis ;",
    'rédiger des phrases complètes, sans recopier les documents mot à mot.',
))

c.ecrire(sys.argv[1] if len(sys.argv) > 1 else 'microbiote.json')
