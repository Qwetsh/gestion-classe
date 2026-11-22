"""Fiche protocole de l'antibiogramme (3e, séquence 2, activité 3), 22/11/2026.

Première fiche protocole à part (règle du 22/11/2026) : matériel et protocole quittent la fiche
d'activité pour une page en couleur, plastifiée, laissée sur la paillasse et relue dans le classeur.
Page dessinée par gc_protocole.py, dessins de antibiogramme_paillasse_dessins.py.

    python antibiogramme_protocole.py <dossier de travail> [<brouillon.json>]
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
sys.path.insert(0, ICI)
from gc_cours import Cours, Image  # noqa: E402
from gc_protocole import page_protocole  # noqa: E402
import antibiogramme_paillasse_dessins as d  # noqa: E402

TITRE = "Activité 3 — L'antibiogramme : choisir le bon antibiotique (protocole)"
CHAPITRE = 'Séquence 2 — Le système immunitaire'

MATERIEL = [
    (d.m_boites, '<b>2 boîtes</b> de Petri'),
    (d.m_placement, '<b>la fiche</b> de placement'),
    (d.m_flacons, '<b>6 flacons</b> en 2 lignes'),
    (d.m_pastilles, '<b>6 pastilles</b> vierges'),
    (d.m_pince, '<b>une pince</b> fine'),
    (d.m_gobelet, '<b>un gobelet</b> d’eau'),
    (d.m_feutre, '<b>un feutre</b>'),
    (d.m_regle, '<b>une règle</b> graduée'),
]

ETAPES = [
    (d.e1, '<b>Écris</b> A, B ou C sur 6 pastilles : 3 pour la boîte « plaie », 3 pour la boîte « microbiote ».'),
    (d.e2, 'Avec la pince, <b>trempe</b> la pastille A dans le flacon A de la <span class="bleu">ligne bleue</span>, '
           'puis <b>égoutte-la</b> sur le bord.'),
    (d.e3, '<b>Pose-la</b> sur la boîte « plaie », loin du bord, à sa place sur la fiche de placement.'),
    (d.e4, '<b>Rince</b> la pince dans l’eau. Fais de même avec B et C, bien espacées.'),
    (d.e5, '<b>Recommence</b> sur la boîte « microbiote », avec les flacons de la '
           '<span class="rouge">ligne rouge</span>.'),
    (d.e6, '<b>Attends 10 minutes</b> sans toucher : la couleur change autour des pastilles.'),
]

PENSER = ['la blouse ;',
          'rincer la pince entre deux pastilles ;',
          'ne jamais mélanger la <span class="bleu">ligne bleue</span> et la <span class="rouge">ligne rouge</span> ;',
          'à la fin : vider l’eau, nettoyer les boîtes, se laver les mains.']

ERREUR = ('<p>Tu peux redemander des pastilles ou une boîte, mais cela coûte des points :</p>'
          '<ul><li>1 pastille = 0,25 point ;</li><li>1 boîte = 2 points.</li></ul>')


def page(dossier):
    os.makedirs(dossier, exist_ok=True)
    return page_protocole('Réaliser un antibiogramme', '3e · Séquence 2 · Activité 3',
                          [(f(), t) for f, t in MATERIEL], [(f(), t) for f, t in ETAPES], PENSER, ERREUR,
                          os.path.join(dossier, 'antibiogramme-protocole.png'))


def fiche(dossier, sortie):
    png = page(dossier)
    c = Cours(TITRE, niveau='3e', chapitre=CHAPITRE, premiere_page_vide=False)
    c.ajouter(Image(png, largeur_cm=15.2))   # 15,2 cm : la page et la ligne vide finale tiennent sur une feuille
    c.ecrire(sortie)


if __name__ == '__main__':
    if len(sys.argv) == 2:
        print(page(sys.argv[1]))
    else:
        fiche(sys.argv[1], sys.argv[2])
