"""
gc_semaine — préparer la semaine : poser les originaux de la bibliothèque sur les cours de
l'emploi du temps (une copie par cours, reliée au cours), sans requête écrite à la main.

En ligne de commande (python -I gc_semaine.py ...) :

    agenda [--jours 14] [--classes 4A,4B]
        les prochains cours de chaque classe, et le document déjà posé sur chacun
    bibliotheque [--niveau 4e] [--cherche wegener]
        les originaux de la bibliothèque (identifiant, niveau, séquence, nombre d'écrans)
    placer --activite <id> [--correction <id>] --classes 4A,4B|4e [--apres AAAA-MM-JJ]
           [--jours 21] [--groupes] [--envoyer]
        propose les cours : l'activité sur le prochain cours libre de chaque classe, la
        correction sur le cours suivant. SANS --envoyer, RIEN N'EST ÉCRIT. Avec --envoyer, les
        copies sont posées. Relancer la même demande ne crée pas de doublon.
    retirer <id de la copie> [--forcer]
        retire la copie posée sur un cours (jamais un original) ; sur demande de Thomas seulement

Le jeton d'import est celui de gc_envoi.py (~/.gestion-classe/jeton-import.txt).
"""
import argparse
import os
import re
import sys
import unicodedata
from datetime import datetime

# `python -I` n'ajoute pas le dossier du script au chemin d'import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gc_envoi  # noqa: E402

JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

# États d'une ligne du plan
A_PLACER = 'à placer'
DEJA = 'déjà placé'
PLACE = 'placé'
OCCUPE = 'occupé'
AUCUN = 'aucun cours'


def plier(texte):
    """Minuscules, sans accents ni ponctuation : « 3°EP1 » → « 3ep1 »."""
    t = unicodedata.normalize('NFD', texte or '')
    t = ''.join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r'[^a-z0-9]', '', t)


def date_de(iso):
    """Date ISO de la base → datetime avec fuseau."""
    return datetime.fromisoformat(iso.replace('Z', '+00:00'))


def jour_heure(iso):
    """« lun. 16 nov., 10 h 15 », à l'heure de l'ordinateur (Paris chez Thomas)."""
    d = date_de(iso).astimezone()
    return '%s %d %s, %d h %02d' % (JOURS[d.weekday()], d.day, MOIS[d.month - 1], d.hour, d.minute)


def nom_cours(lecon):
    """« 4C », « 3A · Groupe 1 »."""
    return lecon['class_name'] + (' · ' + lecon['group_name'] if lecon.get('group_name') else '')


def classes_visees(lecons, demande):
    """Noms des classes demandées : « 4A,4B », ou un niveau (« 4e ») pour toutes ses classes."""
    noms = sorted({l['class_name'] for l in lecons}, key=plier)
    voulues = []
    for morceau in [m.strip() for m in demande.split(',') if m.strip()]:
        niveau = re.match(r'^([3-6])\s*(e|ème|eme)$', morceau, re.I)
        if niveau:
            trouvees = [n for n in noms if plier(n).startswith(niveau.group(1))]
        else:
            trouvees = [n for n in noms if plier(n) == plier(morceau)]
        if not trouvees:
            voulues.append((morceau, None))
        voulues.extend((n, n) for n in trouvees if (n, n) not in voulues)
    return voulues


def pistes(lecons, classe, groupes=False):
    """
    Les suites de cours d'une classe, chacune recevant ses propres copies. Par défaut, les cours en
    classe entière ; s'il n'y en a pas (ou avec groupes=True), une suite par demi-groupe.
    Rend [(nom de la piste, [cours triés])] et une remarque éventuelle.
    """
    siens = sorted((l for l in lecons if l['class_name'] == classe), key=lambda l: l['starts_at'])
    entiere = [l for l in siens if not l.get('group_id')]
    par_groupe = {}
    for l in siens:
        if l.get('group_id'):
            par_groupe.setdefault(l['group_name'] or l['group_id'], []).append(l)
    if entiere and not groupes:
        remarque = 'cours en demi-groupes aussi : non comptés (--groupes pour les prendre)' if par_groupe else None
        return [(classe, entiere)], remarque
    if par_groupe:
        remarque = None if groupes else 'pas de cours en classe entière : un placement par demi-groupe'
        return [('%s · %s' % (classe, g), ls) for g, ls in sorted(par_groupe.items())], remarque
    return [(classe, entiere)], None


def _ligne(piste, role, original, lecon, etat, occupant=None, remarque=None):
    return {'piste': piste, 'role': role, 'original': original, 'lecon': lecon, 'etat': etat,
            'occupant': occupant, 'remarque': remarque}


def proposer(lecons, demande, activite, correction=None, apres=None, groupes=False):
    """
    Le plan, sans rien écrire. Pour chaque piste (classe, ou demi-groupe) :
      - l'activité va sur le premier cours libre à partir de `apres` ; si un cours porte déjà cet
        original, c'est lui (« déjà placé ») : relancer ne crée pas de doublon ;
      - la correction va sur le cours qui suit celui de l'activité ; s'il porte un autre document,
        il est signalé « occupé » et rien n'est posé (question à poser à Thomas).
    """
    if apres:
        lecons = [l for l in lecons if date_de(l['starts_at']) >= apres]
    lignes = []
    for demande_nom, classe in classes_visees(lecons, demande):
        if classe is None:
            lignes.append(_ligne(demande_nom, 'activité', activite, None, AUCUN, remarque='classe inconnue ou sans cours dans la période'))
            continue
        suites, remarque = pistes(lecons, classe, groupes)
        for nom, suite in suites:
            source = lambda l: (l.get('placed') or {}).get('source_board_id')
            i = next((k for k, l in enumerate(suite) if source(l) == activite), None)
            if i is not None:
                lignes.append(_ligne(nom, 'activité', activite, suite[i], DEJA, remarque=remarque))
            else:
                i = next((k for k, l in enumerate(suite) if not l.get('placed')), None)
                if i is None:
                    lignes.append(_ligne(nom, 'activité', activite, None, AUCUN, remarque='aucun cours libre dans la période'))
                    continue
                pris = sum(1 for l in suite[:i] if l.get('placed'))
                note = '; '.join(x for x in [remarque, ('%d cours déjà pris avant' % pris) if pris else None] if x) or None
                lignes.append(_ligne(nom, 'activité', activite, suite[i], A_PLACER, remarque=note))
            if not correction:
                continue
            if i + 1 >= len(suite):
                lignes.append(_ligne(nom, 'correction', correction, None, AUCUN, remarque='pas de cours suivant dans la période'))
                continue
            suivant = suite[i + 1]
            if source(suivant) == correction:
                lignes.append(_ligne(nom, 'correction', correction, suivant, DEJA))
            elif not suivant.get('placed'):
                lignes.append(_ligne(nom, 'correction', correction, suivant, A_PLACER))
            else:
                lignes.append(_ligne(nom, 'correction', correction, suivant, OCCUPE, occupant=suivant['placed'].get('title')))
    return lignes


def envoyer(lignes, poser=gc_envoi.placer):
    """Pose les lignes « à placer » (un appel par original) et met à jour leur état."""
    par_original = {}
    for l in lignes:
        if l['etat'] == A_PLACER:
            par_original.setdefault(l['original'], []).append(l)
    for original, groupe in par_original.items():
        resultats = poser(original, [{'starts_at': l['lecon']['starts_at'], 'label': l['lecon']['label']} for l in groupe])
        par_cle = {(date_de(r['starts_at']).replace(second=0, microsecond=0), r['label']): r for r in resultats}
        for l in groupe:
            r = par_cle.get((date_de(l['lecon']['starts_at']).replace(second=0, microsecond=0), l['lecon']['label']))
            statut = r and r.get('status')
            if statut == 'placed':
                l['etat'], l['copie'] = PLACE, r.get('board_id')
            elif statut == 'already':
                l['etat'] = DEJA
            elif statut == 'occupied':
                l['etat'], l['occupant'] = OCCUPE, r.get('title')
            else:
                l['etat'] = 'refusé (%s)' % (statut or 'sans réponse')
    return lignes


def tableau(lignes, titres):
    """Le compte rendu du plan : Classe | Cours | Document | État."""
    sortie = ['| Classe | Cours | Document | État |', '|---|---|---|---|']
    for l in lignes:
        cours = jour_heure(l['lecon']['starts_at']) if l['lecon'] else '—'
        doc = titres.get(l['original'], l['original'])
        if not doc.rstrip().endswith('(%s)' % l['role']):  # pas de « (correction) (correction) »
            doc += ' (%s)' % l['role']
        etat = l['etat'] + (' par « %s »' % l['occupant'] if l['etat'] == OCCUPE and l.get('occupant') else '')
        if l.get('remarque'):
            etat += ' — ' + l['remarque']
        sortie.append('| %s | %s | %s | %s |' % (l['piste'], cours, doc, etat))
    return '\n'.join(sortie)


# ---------------------------------------------------------------- ligne de commande

def _agenda(args):
    a = gc_envoi.lire_agenda(jours=args.jours)
    lecons = a['lessons']
    if args.classes:
        noms = {n for _, n in classes_visees(lecons, args.classes) if n}
        lecons = [l for l in lecons if l['class_name'] in noms]
    for l in lecons:
        p = l.get('placed')
        print('%-24s %-18s %s' % (jour_heure(l['starts_at']), nom_cours(l), ('« %s »' % p.get('title')) if p else '—'))
    print('%d cours.' % len(lecons))


def _bibliotheque(args):
    a = gc_envoi.lire_agenda(jours=1)
    for b in a['library']:
        if args.niveau and (b.get('level') or '') != args.niveau:
            continue
        if args.cherche and plier(args.cherche) not in plier(b['title'] + ' ' + (b.get('chapter') or '')):
            continue
        ecrans = ', %d écrans' % b['screens'] if b.get('screens') else ''
        print('%s  %-5s %s › %s%s' % (b['id'], b.get('level') or '—', b.get('chapter') or 'sans séquence', b['title'], ecrans))


def _placer(args):
    a = gc_envoi.lire_agenda(depuis=args.apres, jours=args.jours)
    titres = {b['id']: b['title'] for b in a['library']}
    for ident in [args.activite] + ([args.correction] if args.correction else []):
        if ident not in titres:
            print('Refusé : %s n’est pas un original de la bibliothèque (voir « bibliotheque »).' % ident)
            return 1
    apres = date_de(args.apres).astimezone() if args.apres and 'T' in args.apres else None
    lignes = proposer(a['lessons'], args.classes, args.activite, args.correction, apres, args.groupes)
    if args.envoyer:
        envoyer(lignes)
    print(tableau(lignes, titres))
    a_faire = sum(1 for l in lignes if l['etat'] == A_PLACER)
    if not args.envoyer and a_faire:
        print('\nProposition seulement : rien n’est écrit. Ajouter --envoyer pour poser %d copie(s).' % a_faire)
    return 0


def _retirer(args):
    r = gc_envoi.retirer(args.copie, args.forcer)
    print('Copie retirée du cours %s (%s).' % (r.get('label'), jour_heure(r['starts_at'])))
    return 0


def principal(argv):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, ValueError):
        pass
    p = argparse.ArgumentParser(prog='gc_semaine.py', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sous = p.add_subparsers(dest='commande', required=True)
    s = sous.add_parser('agenda')
    s.add_argument('--jours', type=int, default=14)
    s.add_argument('--classes')
    s = sous.add_parser('bibliotheque')
    s.add_argument('--niveau')
    s.add_argument('--cherche')
    s = sous.add_parser('placer')
    s.add_argument('--activite', required=True)
    s.add_argument('--correction')
    s.add_argument('--classes', required=True)
    s.add_argument('--apres', help='date de départ, AAAA-MM-JJ (aujourd’hui par défaut)')
    s.add_argument('--jours', type=int, default=21)
    s.add_argument('--groupes', action='store_true', help='placer par demi-groupe même si la classe a des cours entiers')
    s.add_argument('--envoyer', action='store_true', help='poser les copies (sans cette option, rien n’est écrit)')
    s = sous.add_parser('retirer')
    s.add_argument('copie')
    s.add_argument('--forcer', action='store_true')
    args = p.parse_args(argv)
    if getattr(args, 'apres', None) and re.match(r'^\d{4}-\d{2}-\d{2}$', args.apres):
        # minuit, heure de l'ordinateur
        args.apres = datetime.strptime(args.apres, '%Y-%m-%d').astimezone().isoformat()
    try:
        return {'agenda': _agenda, 'bibliotheque': _bibliotheque, 'placer': _placer, 'retirer': _retirer}[args.commande](args) or 0
    except gc_envoi.EnvoiRefuse as e:
        print('Refusé : %s' % e)
        return 1


if __name__ == '__main__':
    sys.exit(principal(sys.argv[1:]))
