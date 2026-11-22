"""
Les écrans de « Activité 3 — L'antibiogramme » (3e, séquence 2), refaits le 22/11/2026 avec le procédé
« tableau de séance » : l’activité (14 écrans, deux séances) et sa correction (12 écrans), chacune avec un
sommaire. Deux animations acceptées par Thomas (antibiogramme_animations.py) : A. lire un antibiogramme
(modèle chou rouge + vinaigre à côté d'un vrai), B. la sélection des bactéries résistantes.
Règle du 19/11/2026 : rien à lire sous y = 450 ; seuls les boutons du professeur y descendent.

    python -I antibiogramme_ecrans.py <dossier de sortie> [--affiches]
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
sys.path.insert(0, ICI)
import gc_ecrans  # noqa: E402
from gc_ecrans import *  # noqa: E402,F401,F403
import gc_animation as ga  # noqa: E402
import antibiogramme_animations as aa  # noqa: E402

LISIBLE = 450
SEQ = 'Séquence 2 — Le système immunitaire'
PROBLEME = 'Quel antibiotique faut-il prescrire à M. Apabien ?'


def avec_bas(bas, fabrique, *args, **kw):
    ancien = gc_ecrans.BAS
    gc_ecrans.BAS = bas
    try:
        return fabrique(*args, **kw)
    finally:
        gc_ecrans.BAS = ancien


def question(e, titre, enonce, reponses, bareme=None, note=None):
    """Comme e.question, mais tout tient au-dessus de y = 450. `reponses` : (intitulé, réponse)."""
    p = e.ecran(titre, bareme)
    blocs = [{'html': enonce, 'taille': 26}]
    for intitule, reponse in reponses:
        if intitule:
            blocs.append({'html': B(intitule), 'taille': 24, 'couleur': BLEU, 'fixe': True})
        blocs.append({'html': reponse, 'taille': 24, 'couleur': ROUGE, 'cache': 'Réponse', 'colle': bool(intitule)})
    if note:
        blocs.append({'html': note, 'taille': 22, 'couleur': GRIS})
    e._empiler(p, blocs, bas=LISIBLE)
    return p


def animation(e, code, affiche=None):
    p = Ecran(e, len(e.pages) + 1)
    del p.objets[:]
    p.n = 0
    e.pages.append(p.page)
    p.animation(20, 4, aa.CADRE[0], aa.CADRE[1], code, affiche=affiche)
    return p


def titre(e, sous_titre, cache=True):
    p = e.ecran()
    p.texte(MARGE, 70, LARGEUR, 22, SEQ, GRIS)
    p.texte(MARGE, 112, LARGEUR, 30, sous_titre, BLEU2)
    p.texte(MARGE, 160, LARGEUR, 50, B('L’antibiogramme : choisir le bon antibiotique'), BLEU)
    p.texte(MARGE, 318, LARGEUR, 28, B('Problématique :') + ' ' + I(PROBLEME), NOIR,
            cache='Problématique' if cache else None, fond=FOND_ROSE)
    return p


def tableau_mesures(e, titre_ecran, reponses, bareme=None, note=None):
    """Tableau 2 lignes (les deux boîtes) × A, B, C ; réponses sous rideau, place pour écrire les mesures."""
    p = e.ecran(titre_ecran, bareme)
    xs, ws = [50, 290, 510, 730], [240, 220, 220, 220]
    for x, w, nom in zip(xs, ws, ('Boîte', 'A', 'B', 'C')):
        p.cadre(x, 112, w, 40, B(nom), fond=FOND_BLEU, taille=20, couleur=BLEU_FONCE)
    h = 120
    for i, (boite, reps) in enumerate(reponses):
        y = 152 + i * h
        p.cadre(xs[0], y, ws[0], h, B(boite), taille=20)
        for x, w, rep in zip(xs[1:], ws[1:], reps):
            p.cadre(x, y, w, h)
            p.reponse(x + 10, y + h - 46, w - 20, 22, rep)
    if note:
        p.texte(MARGE, 400, LARGEUR, 22, note, GRIS)
    return p


PHOTO = os.path.join(ICI, '..', '..', '..', '..', 'gestion-classe-web', 'course-drafts', 'images',
                     'antibiogramme-wikimedia.jpg')
PHOTO_TAILLE = (614, 461)
PHOTO_CREDIT = 'Photo : Microrao, domaine public (Wikimedia Commons, « Antibiotic disk diffusion »).'
# Points visés, en fraction de la photo (repérés sur l'image)
PHOTO_LEGENDES = [
    ('gélose couverte de bactéries', (0.62, 0.15)),
    ('zone claire : pas de bactéries', (0.40, 0.18)),
    ('pastille d’antibiotique', (0.52, 0.49)),
    ('boîte de Petri', (0.855, 0.49)),
    ('pas de zone : bactérie résistante', (0.63, 0.69)),
]


def vrai_antibiogramme(e, chemin):
    """La photo d'un vrai antibiogramme, légendée une étiquette après l'autre, tout au-dessus de y = 450."""
    p = e.ecran('Un vrai antibiogramme')
    if not chemin:
        p.texte(MARGE, 120, LARGEUR, 24, I('(photo à envoyer : lancer le script avec --affiches)'), GRIS)
        return p
    lw, lh = PHOTO_TAILLE
    w, h = 400, round(400 * lh / lw)
    x0, y0 = 30, 102
    p.image(x0, y0, w, h, chemin, lw, lh)
    p.texte(x0, y0 + h + 6, w, 15, PHOTO_CREDIT, GRIS)
    etapes, ys = [], [102, 160, 218, 276, 334]
    for (texte, (fx, fy)), y in zip(PHOTO_LEGENDES, ys):
        lab = p.texte(470, y, 500, 22, B(texte), BLEU_FONCE, fond=FOND_BLEU)
        fl = p.fleche(lab, (round(x0 + fx * w), round(y0 + fy * h)), couleur=BLEU_FONCE, epaisseur=2.5)
        p.cacher(lab, fl)
        etapes.append([Afficher(lab), Afficher(fl)])
    p.texte(470, 392, 500, 20, I('Fond noir : les zones sans bactéries paraissent sombres.'), GRIS)
    p.suivant(400, 456, etapes)
    return p


BILAN = None   # rempli dans construire() (a besoin de e.trou)


def bilan(e):
    T = e.trou
    return avec_bas(LISIBLE, e.bilan,
                    '<div>Un antibiotique est une substance qui ' + T('détruit') + ' les bactéries ou bloque leur '
                    + T('multiplication') + '. Il n’a aucun effet sur les ' + T('virus') + '.</div><div><br></div>'
                    '<div>Pour limiter les bactéries ' + T('résistantes') + ' et préserver le ' + T('microbiote')
                    + ', on ne le prend que contre une infection ' + T('bactérienne') + ', sur ' + T('prescription')
                    + ' d’un médecin.</div>')


def activite(affiches):
    e = Ecrans('abg', 'Activité 3 · L’antibiogramme')

    # Séance 5
    titre(e, 'Activité 3 — Séance 5 : la manipulation')
    sit = e.ecran('M. Apabien revient')
    sit.site(20, 105, 600, 340, HOPITAL + '?presentation=yve-apabien', titre='Hôpital virtuel', boutons=True)
    sit.texte(645, 110, 330, 26, '<div><b>5 jours plus tard :</b></div><div>38,9 °C de fièvre</div>'
              '<div>rougeur jusqu’au poignet</div><div>ganglions gonflés sous le bras</div>', NOIR, fond=FOND_ROSE)
    sit.texte(645, 352, 330, 26, B('L’infection n’est plus contenue dans sa main.'), ROUGE)

    vrai = vrai_antibiogramme(e, affiches.get('photo'))

    proto = avec_bas(LISIBLE, e.consigne, 'Partie 1 — Je réalise un antibiogramme', [
        ('Note', 'sous chaque boîte la place de A, B, C, bien écartées.'),
        ('Trempe', 'une pastille dans le flacon A de la ligne bleue, pose-la sur la boîte « plaie ».'),
        ('Rince', 'la pince, puis fais de même avec B et C.'),
        ('Recommence', 'sur la boîte « microbiote », avec la ligne rouge.'),
        ('Attends', '15 minutes sans toucher.'),
    ], minuteur=900)

    anim_a = animation(e, aa.lecture(), affiches.get('a'))

    attente = avec_bas(LISIBLE, e.consigne, 'Pendant l’attente', [
        ('Lis', 'les documents 1 et 2 de la feuille de documents.'),
        ('Réponds', 'aux questions 4 et 5 sur ta copie.'),
    ])

    q12 = avec_bas(LISIBLE, e.consigne, 'Questions 1 et 2 — Mes résultats', [
        ('Mesure', 'le diamètre de chaque zone colorée, pastille comprise, en mm.'),
        ('Présente', 'tes six mesures dans un tableau à double entrée (FM2).'),
        ('Schématise', 'tes deux boîtes au compas, légendes et titre.'),
    ])
    q12.coup_de_pouce('<div>Un tableau à double entrée a :</div><div>• un <b>titre</b> ;</div>'
                      '<div>• des lignes et des colonnes <b>nommées</b> ;</div><div>• l’<b>unité</b> (mm).</div>')

    # Séance 6
    commun = tableau_mesures(e, 'Séance 6 — Nos mesures', [
        ('Bactérie de la plaie', ['grande zone', 'grande zone', 'petite zone']),
        ('Microbiote', ['grande zone', 'aucune zone', 'petite zone']),
    ], note='Écrire au stylet les mesures des binômes ; tirer les rideaux pour comparer.')

    q3 = e.ecran('Question 3 — Quel antibiotique ?', None)
    q3.texte(MARGE, 104, LARGEUR, 26, B('Indique') + ' l’antibiotique à prescrire et ' + B('justifie') +
             ', en parlant des deux boîtes.')
    for i, nom in enumerate(('J’observe', 'Je sais', 'J’en déduis')):
        x = 30 + i * 320
        q3.cadre(x, 180, 300, 42, B(nom), fond=FOND_BLEU, taille=22, couleur=BLEU_FONCE)
        q3.cadre(x, 222, 300, 224, pointille=True, trait=TRAIT_CLAIR)

    fleming = e.ecran('Document 1 — Fleming, 1928')
    fleming.texte(MARGE, 104, LARGEUR, 26, 'En 1928, Alexander Fleming voit qu’une moisissure, <i>Penicillium</i>, a '
                  'poussé dans une boîte de staphylocoques : <b>autour d’elle, les staphylocoques ne se développent '
                  'pas</b>. Elle fabrique une substance, la pénicilline.', NOIR, fond='#EEF3F9')
    fleming.texte(MARGE, 300, LARGEUR, 26, B('Question 4 — ') + B('Compare') + ' avec ton antibiogramme : à quoi '
                  'correspondent la moisissure et la zone sans staphylocoques ? ' + B('Déduis-en') + ' ce qu’est un '
                  'antibiotique.', BLEU_FONCE)

    vf = avec_bas(LISIBLE, e.vrai_faux, 'Vrai ou faux ?', [
        ('Un antibiotique soigne la grippe.', False, 'La grippe est due à un virus : aucun effet.'),
        ('Un antibiotique ne détruit que les « mauvaises » bactéries.', False, 'Il abîme aussi le microbiote.'),
        ('C’est la bactérie qui devient résistante, pas le malade.', True, 'Le malade, lui, n’est pas « résistant ».'),
    ])

    anim_b = animation(e, aa.resistance(), affiches.get('b'))
    bl = bilan(e)

    e.sommaire('Activité — aller à…', [
        ('Le retour de M. Apabien', sit), ('Un vrai antibiogramme', vrai), ('Le protocole', proto), ('Lire un antibiogramme', anim_a),
        ('Pendant l’attente', attente), ('Questions 1 et 2', q12), ('Nos mesures', commun),
        ('Question 3', q3), ('Fleming (question 4)', fleming), ('Vrai ou faux', vf),
        ('Les résistances', anim_b), ('Bilan', bl)], position=1)
    return e


def correction(affiches):
    e = Ecrans('abc', 'Correction · Activité 3 · L’antibiogramme')
    titre(e, 'Correction — Activité 3', cache=False)

    q1 = tableau_mesures(e, 'Question 1 — Le tableau', [
        ('Bactérie de la plaie', ['grande zone', 'grande zone', 'petite zone']),
        ('Microbiote', ['grande zone', 'aucune zone', 'petite zone']),
    ], '3 pts', note='Barème : six mesures avec l’unité · tableau bien construit · titre.')

    q2 = question(e, 'Question 2 — Le schéma', '<b>Schématise</b> tes deux boîtes au compas.', [
        ('Ce qu’on attend', 'Deux cercles, trois pastilles A, B, C dans chacun, des zones à la bonne taille.'),
        ('Légendes', 'boîte de Petri, bactéries, pastille d’antibiotique, zone où les bactéries sont détruites.'),
        ('Titre', '« Antibiogramme de la bactérie de M. Apabien et de son microbiote ».'),
    ], '3 pts')

    q3a = question(e, 'Question 3 — Quel antibiotique ? (1/2)', 'Justifie avec <b>les deux boîtes</b>.', [
        ('J’observe', 'Plaie : grandes zones autour de A et de B, petite autour de C. Microbiote : grande zone '
         'autour de A, aucune autour de B, petite autour de C.'),
        ('Je sais', 'Plus la zone est grande, plus l’antibiotique est efficace. Le microbiote nous est utile : '
         'il faut l’épargner.'),
    ], '6 pts')
    question(e, 'Question 3 — Quel antibiotique ? (2/2)', 'Et donc ?', [
        ('J’en déduis', 'C agit peu sur la bactérie de la plaie ; A la détruit, mais détruit aussi le microbiote ; '
         'B détruit la bactérie sans toucher au microbiote.'),
        ('Conclusion', 'Le médecin doit prescrire l’<b>antibiotique B</b>.'),
    ])

    q4 = question(e, 'Question 4 — Fleming', 'À quoi correspondent la moisissure et la zone sans staphylocoques ?', [
        ('La moisissure', 'Elle joue le rôle de la pastille : elle libère la pénicilline, qui se répand.'),
        ('La zone', 'C’est la zone autour de la pastille, où les bactéries sont détruites.'),
        ('Définition', 'Un antibiotique détruit les bactéries ou bloque leur multiplication.'),
    ], '2 pts')

    q5 = question(e, 'Question 5 — Mme Amalle', 'Pourquoi les antibiotiques ne l’auraient-ils pas guérie ?', [
        (None, 'Sa mononucléose est due à un <b>virus</b>.'),
        (None, 'Un antibiotique agit sur ce que seules les bactéries possèdent : <b>aucun effet sur un virus</b>.'),
    ], '2 pts')

    q6 = question(e, 'Question 6 — Le voisin enrhumé', 'Pourquoi c’est inutile, et ce qu’il risque.', [
        ('Inutile', 'Un rhume est dû à un virus : l’antibiotique ne le soigne pas.'),
        ('Les risques', 'Il abîme son microbiote et favorise les bactéries résistantes.'),
        ('Le slogan', 'Un antibiotique seulement contre une infection bactérienne, sur prescription.'),
    ], '4 pts')

    anim_b = animation(e, aa.resistance(), affiches.get('b'))

    bonus = question(e, 'Pour aller plus loin', 'A détruit presque toutes les bactéries. Pourquoi n’est-ce pas le '
                     'meilleur choix ?', [
                         (None, 'Il détruirait aussi le microbiote : sans lui, plus d’effet barrière.'),
                         (None, 'Une bactérie comme <i>Clostridioides difficile</i> peut alors s’installer (séquence 1). '
                          'On choisit l’antibiotique le plus <b>ciblé</b>.'),
                     ])
    bl = bilan(e)

    e.sommaire('Correction — aller à…', [
        ('Q1 — Le tableau', q1), ('Q2 — Le schéma', q2), ('Q3 — Quel antibiotique ?', q3a),
        ('Q4 — Fleming', q4), ('Q5 — Mme Amalle', q5), ('Q6 — Le voisin', q6),
        ('Les résistances', anim_b), ('Pour aller plus loin', bonus), ('Bilan', bl)], position=1)
    return e


def envoyer_affiches(dossier):
    import gc_envoi
    rendu = {}
    for cle, (fabrique, nom) in {'a': (aa.lecture, 'lecture'), 'b': (aa.resistance, 'resistance')}.items():
        etape, instant = aa.AFFICHE[nom]
        png = ga.affiche(fabrique(), os.path.join(dossier, 'affiche-%s.png' % nom), etape=etape, instant=instant,
                         largeur=aa.CADRE[0], hauteur=aa.CADRE[1])
        rendu[cle] = gc_envoi.envoyer_image(png)
        print('affiche', nom, rendu[cle])
    if os.path.exists(PHOTO):
        rendu['photo'] = gc_envoi.envoyer_image(PHOTO)
        print('photo', rendu['photo'])
    return rendu


if __name__ == '__main__':
    sortie = sys.argv[1]
    os.makedirs(sortie, exist_ok=True)
    affiches = envoyer_affiches(sortie) if '--affiches' in sys.argv else {}
    activite(affiches).ecrire(os.path.join(sortie, 'antibiogramme-ecrans.json'))
    correction(affiches).ecrire(os.path.join(sortie, 'antibiogramme-correction-ecrans.json'))
