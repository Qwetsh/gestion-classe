"""
Les écrans de la correction « Wegener et la dérive des continents » (4e, séquence 2, activité 3),
faits avec le procédé « tableau de séance » le 21/11/2026 pour la 4B (lundi 23/11, 8 h 15).

17 écrans, avec sommaire. Trois animations, acceptées une par une par Thomas (wegener_animations.py) :
A. le puzzle se ferme (Q1), B. brise-glace ou plaque ? (Q4 b), C. l'Atlantique sud s'ouvre (Q5).
Règle du 19/11/2026 : rien à lire sous y = 450 ; seuls les boutons du professeur y descendent.

    python -I wegener_correction.py <sortie.json> [--affiches]
        --affiches : photographie une étape de chaque animation et l'envoie (gc_envoi), pour les
                     vignettes et l'export PDF
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
sys.path.insert(0, ICI)
import gc_ecrans  # noqa: E402
from gc_ecrans import *  # noqa: E402,F401,F403
import gc_animation as ga  # noqa: E402
import wegener_animations as wa  # noqa: E402

LISIBLE = 450   # dernière ligne lisible du fond de la classe

e = Ecrans('wgk', 'Correction · Activité 3 · Wegener')
T = e.trou


def avec_bas(bas, fabrique, *args, **kw):
    """Appelle un gabarit en abaissant la limite basse du contenu (gabarits qui lisent gc_ecrans.BAS)."""
    ancien = gc_ecrans.BAS
    gc_ecrans.BAS = bas
    try:
        return fabrique(*args, **kw)
    finally:
        gc_ecrans.BAS = ancien


def question(titre, enonce, reponses, bareme=None, note=None):
    """Comme e.question, mais tout tient au-dessus de y = 450. `reponses` : (intitulé, réponse, rideau)."""
    p = e.ecran(titre, bareme)
    blocs = [{'html': enonce, 'taille': 26}]
    for intitule, reponse, *rideau in reponses:
        if intitule:
            blocs.append({'html': B(intitule), 'taille': 24, 'couleur': BLEU, 'fixe': True})
        blocs.append({'html': reponse, 'taille': 26, 'couleur': ROUGE, 'cache': rideau[0] if rideau else 'Réponse',
                      'colle': bool(intitule)})
    if note:
        blocs.append({'html': note, 'taille': 22, 'couleur': GRIS})
    e._empiler(p, blocs, bas=LISIBLE)
    return p


def animation(code, affiche=None):
    """Un écran d'animation : le cadre (960 x 444) en haut, ses trois boutons sous y = 450."""
    p = Ecran(e, len(e.pages) + 1)
    del p.objets[:]
    p.n = 0
    e.pages.append(p.page)
    p.animation(20, 4, wa.CADRE[0], wa.CADRE[1], code, affiche=affiche)
    return p


def construire(affiches=None):
    affiches = affiches or {}

    # 1 — Titre, problématique sous rideau
    p = e.ecran()
    p.texte(MARGE, 70, LARGEUR, 22, 'Séquence 2 — Sous nos pieds, une Terre en mouvement', GRIS)
    p.texte(MARGE, 112, LARGEUR, 30, 'Correction — Activité 3', BLEU2)
    p.texte(MARGE, 160, LARGEUR, 50, B('Wegener et la dérive des continents'), BLEU)
    p.texte(MARGE, 318, LARGEUR, 26, B('Problématique :') + ' ' + I("Quels indices Wegener avait-il pour affirmer que les "
            "continents se déplacent, et pourquoi ne l'a-t-on pas cru ?"), NOIR, cache='Problématique', fond=FOND_ROSE)

    # 3 — Vrai ou faux d'entrée : les idées fausses avant la correction
    vf = avec_bas(LISIBLE, e.vrai_faux, 'Vrai ou faux ?', [
        ("Les Mesosaurus ont traversé l'océan à la nage.", False, "L'océan n'existait pas encore."),
        ("Les continents avancent dans le fond de l'océan.", False, "C'était l'idée de Wegener : impossible."),
        ("C'est toute la plaque qui bouge, continent compris.", True, "La lithosphère glisse sur l'asthénosphère."),
        ("L'Afrique et l'Amérique du Sud s'éloignent encore.", True, 'Environ 3 cm par an, mesurés par GPS.'),
    ])

    # 4 — Animation A : le puzzle se ferme
    anim_a = animation(wa.puzzle(), affiches.get('a'))

    # 5 — Question 1
    q1 = question('Question 1 — Le puzzle', '<b>Décris</b> ce que tu remarques : les côtes, puis les zones à Mesosaurus.', [
        ('Le collage', 'La pointe est du Brésil se loge dans le golfe de Guinée.'),
        ('Les côtes', 'Elles s’emboîtent presque parfaitement, avec de petits vides.'),
        ('Les zones à Mesosaurus', 'Face à face, l’une dans le prolongement de l’autre.'),
    ], '1,5 pt', note='Les petits vides sont normaux : le vrai bord du continent est sous la mer.')

    # 6 — Question 2
    q2 = question('Question 2 — « À la nage » ?', 'Un camarade : « Les Mesosaurus ont traversé l’océan à la nage. » '
                  '<b>Montre</b>-lui que c’est impossible.', [
                      ('Le Mesosaurus', 'Un reptile d’eau douce : il ne traverse pas des milliers de km d’eau de mer.'),
                      ('Le Glossopteris', 'Une plante : elle ne se déplace pas, et ses graines, lourdes, ne traversent pas un océan.'),
                      ('Conclusion', 'Ils n’ont pas traversé l’océan : <b>l’océan n’existait pas encore</b>.'),
                  ], '1 pt')

    # 7 — Observer ou déduire : chaque « Suivant » range une carte dans sa colonne
    od = e.ecran('Observer ou déduire ?')
    od.texte(MARGE, 104, LARGEUR, 22, I('« Ça, tu le <b>vois</b> sur le document, ou tu le <b>conclus</b> ? »'), GRIS)
    for x, nom in ((30, 'Wegener observe'), (670, 'Il en déduit')):
        od.cadre(x, 150, 300, 42, B(nom), fond=FOND_BLEU, taille=22, couleur=BLEU_FONCE)
        od.cadre(x, 192, 300, 254, pointille=True, trait=TRAIT_CLAIR)
    # textes courts : une ligne par carte (contrôlé dans l'application le 21/11/2026)
    cartes = [('Un seul bloc jadis', 675), ('Côtes emboîtées', 35), ('Jadis au pôle Sud', 675), ('Mêmes fossiles', 35)]
    etapes = []
    for i, (texte, x_fin) in enumerate(cartes):
        y = 200 + i * 62
        c = od.forme('rounded-rect', 355, y, 290, 54, trait=BLEU2, fond='#FFFFFF', texte=B(texte), taille=22, couleur=BLEU_FONCE)
        etapes.append([DeplacerVers(c, x_fin, y)])
    # en bas au centre : le navigateur de pages de la classe couvre le coin bas droit
    od.suivant(400, 456, etapes)

    # 8-9 — Question 3 : le tableau, deux arguments par écran, cases sous rideau
    def tableau(titre, lignes, bareme=None):
        p = e.ecran(titre, bareme)
        xs, ws = [50, 240, 595], [190, 355, 355]
        for x, w, nom in zip(xs, ws, ('Argument', 'Ce que Wegener observe', 'Ce qu’il en déduit')):
            p.cadre(x, 112, w, 40, B(nom), fond=FOND_BLEU, taille=20, couleur=BLEU_FONCE)
        h = (446 - 152) / 2
        for i, ligne in enumerate(lignes):
            y = round(152 + i * h)
            p.cadre(xs[0], y, ws[0], round(h), B(ligne[0]), taille=20)
            for x, w, rep in zip(xs[1:], ws[1:], ligne[1:]):
                p.cadre(x, y, w, round(h))
                p.reponse(x + 10, y + 10, w - 20, 22, rep)
        return p
    t1 = tableau('Question 3 — Les arguments (1/2)', [
        ['Formes des côtes<br>(article 1, puzzle)', 'Les côtes de l’Amérique du Sud et de l’Afrique s’emboîtent.',
         'Les deux continents formaient un seul bloc, puis se sont séparés.'],
        ['Montagnes<br>(article 2)', 'Des chaînes de même âge (− 400 à − 350 Ma) et de mêmes roches, des deux côtés de l’Atlantique.',
         'Elles se sont formées d’un seul tenant, puis l’océan les a séparées.'],
    ], '4 pts')
    tableau('Question 3 — Les arguments (2/2)', [
        ['Fossiles<br>(article 3)', 'Mesosaurus, Cynognathus, Lystrosaurus, Glossopteris sur des continents séparés.',
         'Ces continents étaient reliés quand ces espèces vivaient.'],
        ['Climats anciens<br>(article 4)', 'Des traces de glaciers dans des régions aujourd’hui chaudes.',
         'Ces régions étaient réunies près du pôle Sud ; elles ont bougé.'],
    ])

    # 10 — Question 4 a : vote, puis réponse
    q4a = avec_bas(360, e.qcm, 'Question 4 a — Pourquoi ce refus ?',
                   'La plupart des géologues ont refusé la théorie de Wegener parce que…',
                   ['ses indices étaient faux.', 'il n’expliquait pas comment ils bougent.',
                    'personne ne connaissait les fossiles.'], bonne=1, bareme='1 pt')
    q4a.reponse(MARGE, 372, LARGEUR, 22, 'Ses indices étaient solides ; c’est son explication du mouvement qui était '
                'impossible.', 'Explication')

    # 11 — Animation B : brise-glace ou plaque ?
    anim_b = animation(wa.coupe(), affiches.get('b'))

    # 12 — Question 4 b
    question('Question 4 b — Le vrai mécanisme', 'Avec l’activité 2 : <b>explique</b> comment un continent se déplace vraiment.', [
        (None, 'Le continent fait partie d’une <b>plaque</b>, la lithosphère.'),
        (None, 'C’est <b>toute la plaque</b> qui glisse sur l’<b>asthénosphère</b>, solide : le continent est transporté.'),
        ('Piège', 'Pas « sur la lave » : il n’y a pas de lave sous la plaque.', 'Piège'),
        ('Bonus', 'À la dorsale, de la nouvelle plaque se forme (activité 1).', 'Bonus'),
    ], '1 pt')

    # 13 — Animation C : l'Atlantique sud s'ouvre
    anim_c = animation(wa.ouverture(), affiches.get('c'))

    # 14 — Question 5 : le calcul pas à pas, et le piège des millions
    q5 = e.ecran('Question 5 — Quel écart ?', '1,5 pt')
    q5.texte(MARGE, 108, LARGEUR, 26, '<b>3 cm par an</b> pendant <b>130 millions d’années</b>. De combien l’Amérique du '
             'Sud et l’Afrique se sont-elles écartées ?')
    for i, (libelle, html) in enumerate([
            ('Étape 1', '130 millions = <b>130 000 000</b>'),
            ('Étape 2', '3 × 130 000 000 = 390 000 000 <b>cm</b>'),
            ('Étape 3', '= 3 900 000 m = <b>3 900 km</b>'),
            ('Comparaison', 'Même ordre de grandeur que l’Atlantique sud (3 000 à 6 000 km).')]):
        q5.reponse(MARGE, 205 + i * 60, 560, 24, html, libelle)
    q5.texte(650, 205, 300, 22, '<div><b>⚠ Piège fréquent</b></div><div>3 × 130 = 390 km ✗</div>'
             '<div>130 millions, ce n’est pas 130 !</div>', ROUGE, cache='Piège', fond=FOND_ROSE)

    # 15 — Pour aller plus loin
    ch = question('★ Pour aller plus loin — Le charbon lorrain', 'Près de Forbach, du charbon s’est formé il y a 300 millions '
                  'd’années, dans des forêts de marécages chauds, comme à l’équateur. <b>Propose</b> deux explications.', [
                      ('Explication 1', 'Le climat de toute la Terre était différent.'),
                      ('Explication 2', 'La Lorraine était près de l’équateur ; sa plaque l’a portée vers le nord. '
                       'C’est l’explication de Wegener.'),
                  ])

    # 16 — Esprit critique : le journal
    jr = question('Esprit critique — Le journal s’est trompé', 'Trois erreurs dans le Journal du collège « Spécial Wegener ».', [
        ('Article 4', 'Pas « il y a 200 millions d’années » : ces glaciers datent d’environ <b>300 millions d’années</b>.'),
        ('Article 2', '« qu’il a nommé ls. » : il fallait lire « la <b>Pangée</b> ».'),
        ('Encadré', '« Wegenera » : il s’agit de <b>Wegener</b>.'),
    ])

    # 17 — Bilan, texte à trous en rouge
    bl = avec_bas(LISIBLE, e.bilan,
                  '<div>En 1912, Alfred Wegener propose la ' + T('dérive des continents') + ' : les continents étaient '
                  'autrefois réunis en un seul bloc, la ' + T('Pangée') + ', puis se sont séparés.</div><div><br></div>'
                  '<div>Ses indices : la complémentarité des ' + T('côtes') + ', des ' + T('chaînes de montagnes') + ' de même '
                  'âge de part et d’autre de l’Atlantique, les mêmes ' + T('fossiles') + ' sur des continents séparés, et des '
                  'traces de ' + T('climats anciens') + '.</div><div><br></div>'
                  '<div>Sa théorie est d’abord rejetée : il n’explique pas ' + T('comment') + ' les continents se déplacent. '
                  'On sait aujourd’hui que ce sont les ' + T('plaques') + ' qui bougent, en portant les continents ; les '
                  'mesures ' + T('GPS') + ' le confirment.</div>',
                  taille=24)  # mesuré dans l'application : en 22, le texte s'arrêtait vers y = 340

    # 2 — Sommaire (boutons du professeur), rangé en deuxième position
    e.sommaire('Correction — aller à…', [
        ('Vrai ou faux', vf), ('Q1 — Le puzzle', anim_a), ('Q2 — À la nage ?', q2), ('Observer ou déduire', od),
        ('Q3 — Les arguments', t1), ('Q4 a — Le refus', q4a), ('Q4 b — Le mécanisme', anim_b),
        ('Q5 — L’Atlantique s’ouvre', anim_c), ('Q5 — Le calcul', q5), ('★ Le charbon', ch), ('Le journal', jr),
        ('Bilan', bl)], position=1)
    return e


def envoyer_affiches(dossier):
    """Une image par animation (étape lisible), envoyée : rend {clé : chemin de stockage}."""
    import gc_envoi
    choix = {'a': (wa.puzzle, 4, 7.5), 'b': (wa.coupe, 4, 8.8), 'c': (wa.ouverture, 4, 9.5)}
    rendu = {}
    for cle, (fabrique, etape, instant) in choix.items():
        png = ga.affiche(fabrique(), os.path.join(dossier, 'affiche-%s.png' % cle), etape=etape, instant=instant,
                         largeur=wa.CADRE[0], hauteur=wa.CADRE[1])
        rendu[cle] = gc_envoi.envoyer_image(png)
        print('affiche', cle, rendu[cle])
    return rendu


if __name__ == '__main__':
    sortie = sys.argv[1]
    affiches = envoyer_affiches(os.path.dirname(os.path.abspath(sortie))) if '--affiches' in sys.argv else None
    construire(affiches).ecrire(sortie)
