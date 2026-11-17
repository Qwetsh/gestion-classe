# -*- coding: utf-8 -*-
"""Fiches méthode FM1 à FM9 de Thomas → cours de l'éditeur Gestion Classe.

La source est son script `generate_fiches_methodes.py` (OneDrive, 2026-2027/Fiches methodes),
qui a produit les .docx : on le rejoue avec une fausse « charte » qui, au lieu d'écrire du Word,
note chaque bloc et le traduit en briques gc_cours. Le texte est donc repris mot pour mot.

Usage : python -I fiches_methode.py <dossier du script source> <dépôt> <dossier des brouillons>
"""
import importlib.util
import re
import sys
import types

SRC, REPO, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, REPO + '/.claude/skills/cours-gestion-classe')
from gc_cours import *  # noqa: E402,F403

VERT = '#1E5945'
VERT_CLAIR = '#D9E5DF'
SURTITRE = '#B9D0C6'
GRIS_TXT = '#2E2E2E'
GRIS_MOYEN = '#6E6E6E'
BLANC = '#FFFFFF'


def riche(texte, **k):
    """« *Lis* la consigne » : les mots entre astérisques en gras, comme dans la charte."""
    out = []
    for i, part in enumerate(re.split(r'\*([^*]+)\*', texte)):
        if part:
            out.append(T(part, gras=bool(i % 2), **k))
    return out


# Interlignes de la charte (1,35 dans les listes, 1,25 dans les tableaux, 1,4 pour le chapô) :
# ceux de l'éditeur les plus proches. L'interligne par défaut de l'éditeur (1,45) fait déborder
# les fiches longues sur une deuxième page.
LISTE, TABLEAU = '1.38', '1.2'


def liste(type_, lignes):
    item = 'taskItem' if type_ == 'taskList' else 'listItem'
    def li(l):
        n = {'type': item, 'content': [P(*riche(l), interligne=TABLEAU, apres=0)]}
        if item == 'taskItem':
            n['attrs'] = {'checked': False}
        return n
    return {'type': type_, 'content': [li(l) for l in lignes]}


class Fiche:
    def __init__(self):
        self.blocs = []
        self.numero = self.titre = self.pied = None


# ---- fausse charte : mêmes noms que _outils/charte.py ----
ch = types.ModuleType('charte')
ch.SZ_PETIT, ch.GRIS_MOYEN, ch.VERT_PALE = 9.5, 'GRIS_MOYEN', 'VERT_PALE'


def nouveau_document():
    return Fiche()


def titre_document(d, surtitre, titre, numero=None):
    d.numero, d.titre = numero, titre
    larg = largeurs(2.2, 15.2)
    d.blocs.append(Tableau(Ligne(
        Cellule([P(T(numero, gras=True, couleur=BLANC, taille=22), align='center', interligne=TABLEAU, apres=0)], [larg[0]], fond=VERT, milieu=True),
        Cellule([P(T(surtitre.upper(), gras=True, couleur=SURTITRE, taille=8), interligne=TABLEAU, apres=2),
                 P(T(titre, gras=True, couleur=BLANC, taille=17), interligne=TABLEAU, apres=0)], [larg[1]], fond=VERT, milieu=True),
    ), style='none'))


def chapo(d, texte):
    d.blocs.append(P(*riche(texte, couleur=GRIS_TXT), interligne=TABLEAU, avant=0, apres=2))


def rubrique(d, texte):
    d.blocs.append(Encadre(P(T(texte.upper(), gras=True, couleur=VERT, taille=9), interligne=TABLEAU, apres=0),
                           type_='libre', titre='', couleur=VERT, bordure='bar'))


def etapes(d, liste):
    larg = largeurs(1.0, 16.4)
    lignes = [Ligne(Cellule([P(T(str(i), gras=True, couleur=VERT), align='center', interligne=TABLEAU, apres=0)], [larg[0]], fond=VERT_CLAIR, milieu=True),
                    Cellule([P(*riche(e), interligne=TABLEAU, apres=0)], [larg[1]], milieu=True))
              for i, e in enumerate(liste, start=1)]
    d.blocs.append(Tableau(*lignes, style='none'))


def tableau(d, entetes, lignes, cm):
    larg = largeurs(*cm)
    rows = [Ligne(*[Cellule([P(T(h, gras=True, couleur=VERT, taille=9.5), apres=0)], [larg[j]], fond=VERT_CLAIR, entete=True)
                    for j, h in enumerate(entetes)])]
    for l in lignes:
        rows.append(Ligne(*[Cellule([P(*riche(v, taille=9.5), interligne=TABLEAU, apres=0)], [larg[j]]) for j, v in enumerate(l)]))
    d.blocs.append(Tableau(*rows, style='grid'))


def liste_puces(d, lignes, puce='—', fond=None):
    if puce is None:
        contenu = [P(*riche(l), interligne=LISTE, apres=4) for l in lignes]
    else:
        contenu = [liste('bulletList', lignes)]
    if fond:
        d.blocs.append(Encadre(*contenu, type_='libre', titre='', couleur=VERT, bordure='plain'))
    else:
        d.blocs.extend(contenu)


def cases(d, lignes):
    d.blocs.append(liste('taskList', lignes))


def para(d, texte, size=None, color=None, after=None):
    couleur = GRIS_MOYEN if color == 'GRIS_MOYEN' else None
    d.blocs.append(P(*riche(texte, couleur=couleur, taille=size), apres=4))


def pied(d, texte):
    # Pied de page de l'éditeur, pas un paragraphe : il ne prend pas de place dans la fiche
    d.pied = texte


def espace(d, pt=6):
    pass


def sauver(doc, nom):
    pass


for nom, f in list(globals().items()):
    if nom in ('nouveau_document', 'titre_document', 'chapo', 'rubrique', 'etapes', 'tableau',
               'liste_puces', 'cases', 'para', 'pied', 'espace', 'sauver'):
        setattr(ch, nom, f)
sys.modules['charte'] = ch

spec = importlib.util.spec_from_file_location('fiches_src', SRC + '/generate_fiches_methodes.py')
src = importlib.util.module_from_spec(spec)
spec.loader.exec_module(src)

for i, fm in enumerate((src.fm1, src.fm2, src.fm3, src.fm4, src.fm5, src.fm6, src.fm7, src.fm8, src.fm9), start=1):
    d, fichier = fm()
    c = Cours(f'FM{i} — {d.titre}', niveau=None, chapitre=None, police='Verdana', taille=10,
              theme='sobre', premiere_page_vide=False, pied={'left': d.pied})
    c.ajouter(*d.blocs)
    # Dernier paragraphe, vide et bas : sans lui, l'éditeur en ajoute un à l'interligne normal après
    # la liste finale, qui passerait seul sur une deuxième page
    c.ajouter(P(interligne='1.2', apres=0))
    c.ecrire(f'{OUT}/fm{i}.json')
