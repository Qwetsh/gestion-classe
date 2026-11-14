"""
gc_cours — écrire un cours de Gestion Classe (éditeur de cours, format CourseDoc / TipTap) en Python.

Usage (depuis un script placé hors du dépôt, ou dans course-drafts/) :

    import sys; sys.path.insert(0, r'<dépôt>/.claude/skills/cours-gestion-classe')
    from gc_cours import *

    c = Cours('Activité 2 — Le microbiote', niveau='3e', chapitre='Micro-organismes')
    c.identite()
    c.para(B('Situation de départ : '), 'les micro-organismes…')
    c.titre2('Questions')
    c.question(1, 'À partir du ', B('document 1'), ', ', B('explique'), '…')
    c.ecrire(r'<dépôt>/gestion-classe-web/course-drafts/microbiote.json')

Puis, dans gestion-classe-web : npm run course:check (voir SKILL.md).

Toutes les fonctions produisent du JSON TipTap valide pour le schéma de l'éditeur ; le contrôle
final reste `npm run course:check`.
"""
import json
import sys

# Géométrie de la feuille (lib/course/coursePage.ts) : colonne de texte en px CSS
COL_W = 793.7 - 2 * 94.49

ARIAL = 'Arial, Helvetica, sans-serif'
POLICES = {
    'Atkinson': None,
    'Arial': ARIAL,
    'Verdana': 'Verdana, Geneva, sans-serif',
    'Georgia': 'Georgia, serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    'Comic Sans MS': '"Comic Sans MS", "Comic Sans", cursive',
    'OpenDyslexic': '"OpenDyslexic", sans-serif',
    'Écriture attachée': '"Playwrite FR Moderne", cursive',
    'Courier New': '"Courier New", monospace',
}

# Couleurs des fiches Word de Thomas (thème « fiche »)
BLEU_NUIT = '#1F4E79'
BLEU = '#2E75B6'
BLEU_FONCE = '#1F3864'
ROUGE = '#C00000'
GRIS_TEXTE = '#595959'
GRIS_CERCLES = '#808080'
FOND_GRIS = '#F2F2F2'
FOND_ROSE = '#FBE5E5'
FOND_BLEU = '#EAF1F9'
JAUNE = '#B8860B'        # rappel : cadre
JAUNE_TITRE = '#8B6F00'
JAUNE_TEXTE = '#5C4A00'
VIOLET = '#7030A0'       # pour aller plus loin
VERT = '#548235'         # j'ai réussi
VERT_TITRE = '#385723'


# ---------------------------------------------------------------- texte en ligne

def T(texte, gras=False, italique=False, souligne=False, couleur=None, taille=None, exposant=False, indice=False, surligne=None, police=None):
    """Un morceau de texte mis en forme. taille en points (ex. 10) ; couleur '#rrggbb'."""
    if not texte:
        raise ValueError('texte vide : interdit dans un cours (supprimer le morceau)')
    marks = []
    if gras: marks.append({'type': 'bold'})
    if italique: marks.append({'type': 'italic'})
    if souligne: marks.append({'type': 'underline'})
    if exposant: marks.append({'type': 'superscript'})
    if indice: marks.append({'type': 'subscript'})
    if surligne: marks.append({'type': 'highlight', 'attrs': {'color': surligne}})
    style = {}
    if couleur: style['color'] = couleur
    if taille: style['fontSize'] = f'{taille}pt'
    if police: style['fontFamily'] = POLICES.get(police, police)
    if style: marks.append({'type': 'textStyle', 'attrs': style})
    n = {'type': 'text', 'text': texte}
    if marks: n['marks'] = marks
    return n


def B(texte, **k): return T(texte, gras=True, **k)
def I(texte, **k): return T(texte, italique=True, **k)
def C(texte, couleur, **k): return T(texte, couleur=couleur, **k)

def Pointilles(cm=None):
    """Pointillés de réponse dans la ligne : cm=None jusqu'au bord, sinon longueur en cm."""
    return {'type': 'dots', 'attrs': {'cm': cm}}

def Bareme(points):
    """Barème d'une question (« / 2 »), calé à droite de la ligne."""
    return {'type': 'points', 'attrs': {'value': points}}

def TotalBareme():
    return {'type': 'pointsTotal'}

def Icone(nom, couleur=None, taille=None):
    """Icône Lucide (noms dans icones.md, ex. 'Microscope', 'Lightbulb', 'Target'), de la taille et
    de la couleur du texte qui l'entoure, sauf couleur/taille données. Suivre d'une espace : ' '."""
    n = {'type': 'courseIcon', 'attrs': {'name': nom}}
    style = {}
    if couleur: style['color'] = couleur
    if taille: style['fontSize'] = f'{taille}pt'
    if style: n['marks'] = [{'type': 'textStyle', 'attrs': style}]
    return n

def Saut():
    """Retour à la ligne dans le même paragraphe (Maj+Entrée)."""
    return {'type': 'hardBreak'}


def _runs(items):
    out = []
    for x in items:
        if x is None or x == '':
            continue
        out.append(T(x) if isinstance(x, str) else x)
    return out


# ---------------------------------------------------------------- blocs

def P(*contenu, align=None, interligne=None, avant=None, apres=None, retrait=0):
    """Paragraphe. align: 'center' | 'right' | 'justify' ; interligne: '1.2' (1,0), '1.38' (1,15),
    '1.8' (1,5) ; avant/apres : espace en px (0, 4, 8, 16…)."""
    attrs = {}
    if align: attrs['textAlign'] = align
    if interligne: attrs['lineHeight'] = interligne
    if avant is not None: attrs['spaceBefore'] = avant
    if apres is not None: attrs['spaceAfter'] = apres
    if retrait: attrs['indent'] = retrait
    n = {'type': 'paragraph'}
    if attrs: n['attrs'] = attrs
    runs = _runs(contenu)
    if runs: n['content'] = runs
    return n


def Serre(*contenu, align=None):
    """Paragraphe serré (cellules de tableau, cartouche) : interligne 1,0, pas d'espace après."""
    return P(*contenu, align=align, interligne='1.2', apres=0)


def Titre(niveau, *contenu):
    """Titre 1 (titre du cours), 2 (partie) ou 3 (sous-partie). Couleur donnée par le thème."""
    n = {'type': 'heading', 'attrs': {'level': niveau}}
    runs = _runs(contenu)
    if runs: n['content'] = runs
    return n


def Puces(*items, serre=False):
    """Liste à puces : chaque item est une chaîne, un morceau T(...), ou une liste de morceaux."""
    return {'type': 'bulletList', 'content': [{'type': 'listItem', 'content': [_item_par(i, serre)]} for i in items]}


def Numeros(*items, serre=False, type_=None, debut=1):
    """Liste numérotée (type_ : None = 1. 2. 3. ; 'a', 'A', 'i', 'I')."""
    attrs = {'start': debut}
    if type_: attrs['type'] = type_
    return {'type': 'orderedList', 'attrs': attrs, 'content': [{'type': 'listItem', 'content': [_item_par(i, serre)]} for i in items]}


def Cases(*items, serre=True):
    """Liste de cases à cocher (☐), pour « J'ai réussi si je peux… », un QCM…"""
    return {'type': 'taskList', 'content': [{'type': 'taskItem', 'attrs': {'checked': False}, 'content': [_item_par(i, serre)]} for i in items]}


def _item_par(item, serre):
    runs = item if isinstance(item, list) else [item]
    return P(*runs, apres=0) if serre else P(*runs)


def Encadre(*blocs, type_='libre', titre=None, couleur=None, bordure=None, titre_gras=False):
    """Encadré. type_ : 'definition' | 'retenir' | 'consigne' | 'exemple' | 'libre'.
    titre : None = titre du type (« Définition »…) ; '' = sans titre ; sinon le texte (émoji permis).
    couleur : '#rrggbb' (encadré libre). bordure : 'bar' (barre à gauche), 'box' (cadre fin, façon
    fiche Word), 'plain' (fond seul) ; None = celle du type. titre_gras : titre en gras à la taille du
    texte (sinon petites majuscules). Les blocs sont des paragraphes, listes, tableaux…"""
    attrs = {'kind': type_}
    if titre is not None: attrs['title'] = titre
    if couleur: attrs['color'] = couleur
    if bordure: attrs['frame'] = bordure
    if titre_gras: attrs['titleStyle'] = 'bold'
    contenu = [b if isinstance(b, dict) and b.get('type') != 'text' else P(b) for b in blocs] or [P()]
    return {'type': 'callout', 'attrs': attrs, 'content': contenu}


def EncadreFiche(titre, couleur, *blocs):
    """Encadré des fiches Word : cadre fin, fond clair de la couleur, titre en gras."""
    return Encadre(*blocs, type_='libre', titre=titre, couleur=couleur, bordure='box', titre_gras=True)


def Zone(style='lignes', lignes=4):
    """Zone d'écriture : 'seyes' | 'carreaux' | 'lignes' | 'pointilles' | 'blanc' ; lignes de 8 mm."""
    return {'type': 'writingZone', 'attrs': {'style': style, 'lines': lignes}}


def Image(fichier, largeur_cm=None, legende=None, alignement='center'):
    """Image du cours. Le fichier est envoyé dans l'application (jeton d'import, voir gc_envoi.py),
    puis cité par son chemin : une image déjà envoyée n'est pas renvoyée.
    largeur_cm : largeur affichée (sinon la largeur naturelle, plafonnée à la colonne de 16 cm).
    legende : texte sous l'image. alignement : 'left', 'center' ou 'right'."""
    from gc_envoi import envoyer_image
    attrs = {'path': envoyer_image(fichier), 'align': alignement}
    if largeur_cm:
        attrs['width'] = int(round(min(largeur_cm, 16) * 96 / 2.54))
    if legende is not None:
        attrs['caption'] = legende
    return {'type': 'image', 'attrs': attrs}


def SautDePage():
    return {'type': 'pageBreak'}


def Trait():
    return {'type': 'horizontalRule'}


def Colonnes(*colonnes, disposition=None):
    """2 ou 3 colonnes ; chaque colonne est une liste de blocs.
    disposition : '1-1', '2-1', '1-2', '1-1-1' (None = parts égales)."""
    lay = disposition or '-'.join('1' for _ in colonnes)
    return {'type': 'columns', 'attrs': {'layout': lay}, 'content': [{'type': 'column', 'content': list(col) or [P()]} for col in colonnes]}


# ---------------------------------------------------------------- tableaux

def largeurs(*parts, total=None):
    """Largeurs de colonnes (px) proportionnelles à `parts`, dont la somme fait la colonne de texte."""
    total = total or COL_W
    s = sum(parts)
    w = [int(p / s * total) for p in parts]
    w[0] += int(total) - sum(w)
    return w


def Cellule(blocs, largeurs_px, lignes=1, fond=None, milieu=False, entete=False):
    """Cellule de tableau. largeurs_px : liste des largeurs des colonnes couvertes (colspan = len).
    lignes : rowspan. fond : '#rrggbb'. milieu : centrée verticalement."""
    attrs = {'colspan': len(largeurs_px), 'rowspan': lignes, 'colwidth': [int(x) for x in largeurs_px]}
    if fond: attrs['backgroundColor'] = fond
    if milieu: attrs['verticalAlign'] = 'middle'
    blocs = blocs if isinstance(blocs, list) else [blocs]
    contenu = [b if isinstance(b, dict) and b.get('type') != 'text' else Serre(b) for b in blocs] or [P()]
    return {'type': 'tableHeader' if entete else 'tableCell', 'attrs': attrs, 'content': contenu}


def Ligne(*cellules, hauteur=None):
    n = {'type': 'tableRow', 'content': list(cellules)}
    if hauteur: n['attrs'] = {'minHeight': hauteur}
    return n


def Tableau(*lignes, style='grid', position='left'):
    """style : 'grid' (toutes bordures), 'outer' (cadre), 'lines', 'zebra', 'header', 'none'.
    Attention aux fusions : une cellule avec lignes=3 occupe sa colonne dans les 2 lignes suivantes,
    qui ont donc une cellule de moins."""
    return {'type': 'table', 'attrs': {'tableStyle': style, 'tableAlign': position}, 'content': list(lignes)}


def TableauSimple(entetes, lignes, parts=None, style='header'):
    """Tableau ordinaire : une ligne d'en-tête (chaînes) puis des lignes (listes de chaînes ou de morceaux)."""
    n = len(entetes)
    w = largeurs(*(parts or [1] * n))
    rows = [Ligne(*[Cellule([Serre(B(h) if isinstance(h, str) else h)], [w[i]], entete=True) for i, h in enumerate(entetes)])]
    for l in lignes:
        rows.append(Ligne(*[Cellule([Serre(x)], [w[i]]) for i, x in enumerate(l)]))
    return Tableau(*rows, style=style)


# ---------------------------------------------------------------- blocs des fiches SVT de Thomas

def LigneIdentite():
    """Nom : …  Prénom : …  Classe : …  Date : …/…/… (gris 10 pt, tient sur une ligne)."""
    g = dict(couleur=GRIS_TEXTE, taille=10)
    return P(T('Nom : ', **g), Pointilles(2.6), T('   Prénom : ', **g), Pointilles(2.6),
             T('   Classe : ', **g), Pointilles(1.2), T('   Date : ', **g), T('……/……/………', **g), apres=4)


def Cartouche(sequence, sous_titres, titre, classe='3', note='/20', note_detail=None,
              competences=(('Pratiquer des démarches scientifiques', BLEU), ('Pratiquer des langages scientifiques', ROUGE)),
              infos=(), problematique='', objectifs=()):
    """Cartouche d'activité des fiches SVT (6 lignes, bandeau de séquence bleu nuit à gauche).
    sous_titres : lignes en italique sous « Séquence n » ; classe : '3' donne « 3ᵉ » ;
    infos : [('⏱', 'Durée', '1 séance'), ('👥', 'Modalité', 'Individuel'), …] ;
    objectifs : phrases de « À la fin de cette activité, tu seras capable de : »."""
    a, b, c, d, e = largeurs(17.6, 11, 23.7, 23.7, 24)
    nb = chr(0xA0)
    bandeau = [Serre(B(sequence, couleur='#FFFFFF', taille=10), align='center')]
    bandeau += [Serre(I(s, couleur='#FFFFFF', taille=9), align='center') for s in sous_titres]
    note_blocs = [Serre(B('Note :', taille=10)), Serre(B(note, taille=10))]
    if note_detail: note_blocs.append(Serre(T(note_detail, taille=8)))
    comp = []
    for i, (label, couleur) in enumerate(competences[:2]):
        ws = [c] if i == 0 else [d, e]
        comp.append(Cellule([Serre(I(label, couleur=couleur, taille=8), align='center'),
                             Serre(T('○  ○  ○  ○', couleur=GRIS_CERCLES, taille=9), align='center')], ws, milieu=True))
    runs = []
    for i, (icone, label, valeur) in enumerate(infos):
        last = i == len(infos) - 1
        runs += [T(icone + nb, taille=9), B(label + nb + ': ', taille=9), T(valeur + ('' if last else '   |   '), taille=9)]
    lignes = [
        Ligne(Cellule(bandeau, [a], lignes=6, fond=BLEU_NUIT, milieu=True),
              Cellule([Serre(B(titre, taille=12), align='center')], [b, c, d], milieu=True),
              Cellule([Serre(B(classe, taille=13), B('e', taille=13, exposant=True), align='center')], [e], milieu=True)),
        Ligne(Cellule(note_blocs, [b], lignes=2, milieu=True),
              Cellule([Serre(B('Commentaire :', taille=10))], [c, d, e])),
        Ligne(*comp),
        Ligne(Cellule([Serre(*runs)] if runs else [P()], [b, c, d, e], fond=FOND_GRIS)),
        Ligne(Cellule([Serre(B('Problématique : '), I(problematique))], [b, c, d, e], fond=FOND_ROSE)),
        Ligne(Cellule([Serre(B('🎯 À la fin de cette activité, tu seras capable de :', couleur=BLEU_FONCE, taille=10)),
                       Puces(*[T(o, taille=10) for o in objectifs], serre=True)], [b, c, d, e], fond=FOND_BLEU)),
    ]
    return Tableau(*lignes)


def Question(n, *contenu, points=None):
    """« n. » en gras puis l'énoncé (mettre les verbes de consigne en B(...)) ; barème optionnel."""
    runs = [B(f'{n}. ')] + list(contenu)
    if points is not None: runs.append(Bareme(points))
    return P(*runs, interligne='1.38', avant=8, apres=5)


def _teinte(run, couleur):
    """Donne `couleur` à un morceau qui n'en a pas (texte ou icône)."""
    if isinstance(run, str):
        return C(run, couleur)
    marks = run.setdefault('marks', [])
    for m in marks:
        if m.get('type') == 'textStyle':
            m.setdefault('attrs', {}).setdefault('color', couleur)
            return run
    marks.append({'type': 'textStyle', 'attrs': {'color': couleur}})
    return run


def Rappel(*contenu, titre='💡 Rappel : '):
    """Encadré jaune « 💡 Rappel : » des fiches : tout le texte en brun (gras compris, sauf couleur
    donnée). Ne pas y ajouter d'autre pictogramme en tête : le 💡 est déjà là."""
    runs = [B(titre, couleur=JAUNE_TITRE)] + [_teinte(x, JAUNE_TEXTE) for x in contenu]
    return EncadreFiche('', JAUNE, P(*runs, interligne='1.2'))


def PourAllerPlusLoin(*blocs):
    return EncadreFiche('★ Pour aller plus loin (question expert, bonus)', VIOLET, *blocs)


def JaiReussi(*criteres):
    return EncadreFiche('✅ J’ai réussi l’activité si je peux :', VERT, Cases(*criteres))


# ---------------------------------------------------------------- le cours

class Cours:
    """Un brouillon de cours. Réglages : police (nom du menu), taille du texte (10 à 14 pt),
    theme ('classique', 'sobre', 'nature', 'chaleureux', 'ecolier', 'fiche'), numerotation des titres
    ('none', 'roman', 'alpha', 'decimal'), premiere_page_vide (pas d'en-tête ni de pied en page 1)."""

    def __init__(self, titre, niveau=None, chapitre=None, police='Arial', taille=11, theme='fiche',
                 numerotation=None, premiere_page_vide=True, en_tete=None, pied=None):
        self.titre, self.niveau, self.chapitre = titre, niveau, chapitre
        self.blocs = []
        s = {}
        if police and POLICES.get(police, police): s['font'] = POLICES.get(police, police)
        if taille and taille != 12: s['fontSize'] = taille
        if theme and theme != 'classique': s['theme'] = theme
        if numerotation: s['numbering'] = numerotation
        if premiere_page_vide: s['firstPageBlank'] = True
        if en_tete: s['header'] = en_tete      # {'left': '{titre}', 'center': '', 'right': '{classe}'}
        if pied: s['footer'] = pied            # {'center': 'Page {page} sur {pages}'}
        self.settings = s

    def ajouter(self, *blocs):
        for b in blocs:
            if isinstance(b, (list, tuple)): self.ajouter(*b)
            else: self.blocs.append(b)
        return self

    # raccourcis
    def para(self, *contenu, **k): return self.ajouter(P(*contenu, **k))
    def titre1(self, *c): return self.ajouter(Titre(1, *c))
    def titre2(self, *c): return self.ajouter(Titre(2, *c))
    def titre3(self, *c): return self.ajouter(Titre(3, *c))
    def identite(self): return self.ajouter(LigneIdentite())
    def question(self, n, *c, points=None): return self.ajouter(Question(n, *c, points=points))

    def json(self):
        content = self.blocs or [P()]
        doc = {'version': 1, 'content': {'type': 'doc', 'content': content}}
        if self.settings: doc['settings'] = self.settings
        return {'title': self.titre, 'level': self.niveau, 'chapter': self.chapitre, 'doc': doc}

    def ecrire(self, chemin):
        with open(chemin, 'w', encoding='utf-8') as f:
            json.dump(self.json(), f, ensure_ascii=False, indent=1)
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except (AttributeError, ValueError):
            pass
        print('Brouillon écrit :', chemin)
