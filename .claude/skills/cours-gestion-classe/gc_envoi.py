"""
Envoi vers Gestion Classe par jeton d'import (Edge Function `depot-cours`, migration 075).

Le jeton est créé par Thomas dans Réglages > Jeton d'import, puis collé, seul, dans le fichier
    <dossier personnel>/.gestion-classe/jeton-import.txt
Il n'apparaît jamais dans une conversation, un script ou un commit.

En ligne de commande (python -I gc_envoi.py ...) :
    verifier                               le jeton est-il valable ?
    image <fichier>                        envoie une image, affiche son chemin
    fichier <fichier>                      envoie un fichier joint de scène (image, modèle 3D GLB,
                                           son MP3/OGG/WAV, vidéo MP4/WebM), affiche son chemin
    cours <brouillon.json>                 crée un cours (brouillon vérifié par course:check)
    cours <brouillon.json> --remplacer <id>   remplace le document d'un cours, après version
    ecrans <id du cours> <pages.json>      pose les écrans d'un cours
    ecrans <id du cours> <pages.json> --remplacer   remplace les écrans existants
    cahier <fichier.txt | dossier>         entrées de cahier de texte (une par fichier, voir
                                           lire_entree_cahier) ; --remplacer pour écraser une
                                           entrée différente (sur demande de Thomas),
                                           --reprise pour des fichiers anciens (source « import »)

Placer sur l'emploi du temps : voir gc_semaine.py (agenda, bibliothèque, placer, retirer).

Depuis un script : envoyer_image(chemin), envoyer_fichier(chemin), envoyer_cours(brouillon), envoyer_ecrans(id, pages),
lire_agenda(depuis, jours), placer(id original, cours), retirer(id copie),
lire_entree_cahier(chemin), envoyer_cahier(entrees, remplacer, source).
"""
import base64
import hashlib
import json
import os
import re
import struct
import sys
import urllib.error
import urllib.request

URL = 'https://djodkjysovalpufgevrr.supabase.co/functions/v1/depot-cours'
DOSSIER = os.path.join(os.path.expanduser('~'), '.gestion-classe')
FICHIER_JETON = os.path.join(DOSSIER, 'jeton-import.txt')
# Images déjà envoyées (empreinte du fichier -> chemin) : une image n'est jamais envoyée deux fois
FICHIER_IMAGES = os.path.join(DOSSIER, 'images-envoyees.json')
IMAGE_MAX = 8 * 1024 * 1024

MESSAGES = {
    'invalid_token': "Jeton refusé : il est révoqué, expiré ou mal copié. En créer un dans Réglages > Jeton d'import.",
    'too_large': 'Envoi trop lourd (image : 8 Mo au plus).',
    'bad_image': "Ce fichier n'est pas une image PNG, JPEG, WebP ou GIF.",
    'bad_file': "Fichier joint refusé : seulement image, modèle 3D GLB, son (MP3, OGG, WAV) ou vidéo (MP4, WebM).",
    'bad_doc': "Ce n'est pas un document de cours (version 1, contenu de type doc).",
    'missing_image': "Le document cite une image qui n'a pas été envoyée avec ce jeton.",
    'replace_required': 'Ce cours existe : ajouter --remplacer pour le remplacer (une version est gardée).',
    'screens_exist': 'Ce cours a déjà des écrans : ajouter --remplacer pour les remplacer.',
    'page_id_taken': "Un identifiant de page est déjà pris par une page d'encart de ce cours.",
    'not_found': "Cours introuvable, ou il n'est pas à vous.",
    'bad_html': "Un texte d'écran contient une balise interdite (écrire &lt; pour le signe <).",
    'bad_pages': "La suite d'écrans est vide ou trop longue (60 au plus).",
    'read_failed': "Lecture de l'emploi du temps impossible.",
    'not_placed': "Ce document n'est placé sur aucun cours.",
    'used_in_session': 'Une séance a déjà utilisé cette copie : elle reste (son encre en dépend).',
    'edited': 'Cette copie a été ouverte ou retouchée depuis sa pose : la retirer seulement si Thomas le demande (--forcer).',
    'bad_request': 'Demande mal formée.',
}

# Résultat d'une entrée de cahier de texte (action "journal")
ETATS_CAHIER = {
    'saved': 'enregistrée',
    'same': 'déjà là, identique',
    'exists': "une autre entrée existe pour ce cours : pas écrasée (--remplacer, sur demande de Thomas)",
    'replaced': 'remplacée',
    'not_found': "aucun cours de cette classe à cette heure dans l'emploi du temps",
    'ambiguous': 'plusieurs cours de cette classe à cette heure : préciser starts_at + label',
    'bad_lesson': 'cours mal désigné (date, heure ou classe manquante)',
    'bad_content': 'texte vide ou trop long (20 000 caractères au plus)',
    'read_failed': "lecture de l'emploi du temps impossible",
    'write_failed': 'écriture impossible',
}
LOT_CAHIER = 60


class EnvoiRefuse(Exception):
    """La fonction de dépôt a refusé l'envoi (le message dit pourquoi)."""


def jeton():
    """Lit le jeton dans son fichier ; ne l'affiche jamais."""
    try:
        with open(FICHIER_JETON, encoding='utf-8') as f:
            valeur = f.read().strip()
    except FileNotFoundError:
        raise EnvoiRefuse('Pas de jeton : le créer dans Réglages > Jeton d\'import, puis le coller dans ' + FICHIER_JETON)
    if not valeur:
        raise EnvoiRefuse('Le fichier du jeton est vide : ' + FICHIER_JETON)
    return valeur


def _appel(corps):
    corps = dict(corps, token=jeton())
    requete = urllib.request.Request(URL, data=json.dumps(corps).encode('utf-8'),
                                     headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            return json.loads(reponse.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode('utf-8'))
        except ValueError:
            detail = {}
        code = detail.get('error', 'http_%d' % e.code)
        message = MESSAGES.get(code, 'Envoi refusé (%s).' % code)
        if detail.get('path'):
            message += ' Image : ' + str(detail['path'])
        if detail.get('page_id'):
            message += ' Page : ' + str(detail['page_id'])
        raise EnvoiRefuse(message)
    except urllib.error.URLError as e:
        raise EnvoiRefuse('La fonction de dépôt ne répond pas : %s' % e.reason)


def verifier():
    """Rend { user_id, label, expires_at } si le jeton est valable."""
    return _appel({'action': 'whoami'})


def taille_image(chemin):
    """(largeur, hauteur) d'un PNG, d'un GIF ou d'un JPEG, lues dans l'en-tête ; None si inconnue."""
    with open(chemin, 'rb') as f:
        tete = f.read(32)
        if tete[:8] == bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]):
            return struct.unpack('>II', tete[16:24])
        if tete[:4] == b'GIF8':
            return struct.unpack('<HH', tete[6:10])
        if tete[:2] == bytes([0xFF, 0xD8]):
            f.seek(2)
            while True:
                marque = f.read(4)
                if len(marque) < 4 or marque[0] != 0xFF:
                    return None
                code, longueur = marque[1], struct.unpack('>H', marque[2:4])[0]
                if 0xC0 <= code <= 0xCF and code not in (0xC4, 0xC8, 0xCC):
                    bloc = f.read(5)
                    hauteur, largeur = struct.unpack('>HH', bloc[1:5])
                    return largeur, hauteur
                f.seek(longueur - 2, 1)
    return None


def _images_envoyees():
    try:
        with open(FICHIER_IMAGES, encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}


def envoyer_image(chemin):
    """Envoie une image et rend son chemin dans le stockage. Une image déjà envoyée n'est pas renvoyée."""
    with open(chemin, 'rb') as f:
        octets = f.read()
    if len(octets) > IMAGE_MAX:
        raise EnvoiRefuse('Image trop lourde (8 Mo au plus) : ' + chemin)
    empreinte = hashlib.sha256(octets).hexdigest()
    deja = _images_envoyees()
    if empreinte in deja:
        return deja[empreinte]
    reponse = _appel({'action': 'image', 'image': base64.b64encode(octets).decode('ascii')})
    deja[empreinte] = reponse['path']
    os.makedirs(DOSSIER, exist_ok=True)
    with open(FICHIER_IMAGES, 'w', encoding='utf-8') as f:
        json.dump(deja, f, indent=1)
    return reponse['path']


def envoyer_fichier(chemin):
    """Envoie un fichier joint de scène (image, GLB, son, vidéo ; type lu dans les octets par la
    fonction) et rend son chemin dans le stockage. Un fichier déjà envoyé n'est pas renvoyé."""
    with open(chemin, 'rb') as f:
        octets = f.read()
    if len(octets) > IMAGE_MAX:
        raise EnvoiRefuse('Fichier trop lourd (8 Mo au plus) : ' + chemin)
    empreinte = 'fichier:' + hashlib.sha256(octets).hexdigest()
    deja = _images_envoyees()
    if empreinte in deja:
        return deja[empreinte]
    reponse = _appel({'action': 'file', 'file': base64.b64encode(octets).decode('ascii')})
    deja[empreinte] = reponse['path']
    os.makedirs(DOSSIER, exist_ok=True)
    with open(FICHIER_IMAGES, 'w', encoding='utf-8') as f:
        json.dump(deja, f, indent=1)
    return reponse['path']


def envoyer_cours(brouillon, remplacer=None):
    """Crée un cours à partir d'un brouillon { title, level, chapter, doc } ; rend son identifiant.
    remplacer=<id> : remplace le document de ce cours (une version est gardée, les écrans restent)."""
    if isinstance(brouillon, str):
        with open(brouillon, encoding='utf-8') as f:
            brouillon = json.load(f)
    corps = {'action': 'course', 'title': brouillon.get('title'), 'level': brouillon.get('level'),
             'chapter': brouillon.get('chapter'), 'doc': brouillon['doc']}
    if remplacer:
        corps.update(board_id=remplacer, replace=True)
    return _appel(corps)['id']


def envoyer_ecrans(cours_id, pages, remplacer=False):
    """Pose les écrans d'un cours (liste de pages de tableau blanc) ; rend leur nombre."""
    if isinstance(pages, str):
        with open(pages, encoding='utf-8') as f:
            pages = json.load(f)
    corps = {'action': 'screens', 'board_id': cours_id, 'pages': pages}
    if remplacer:
        corps['replace'] = True
    return _appel(corps)['pages']


def lire_agenda(depuis=None, jours=14):
    """Cours à venir (avec leur classe et le document déjà placé) et originaux de la bibliothèque.
    `depuis` : date ISO (maintenant par défaut) ; `jours` : 60 au plus."""
    corps = {'action': 'agenda', 'days': jours}
    if depuis:
        corps['from'] = depuis
    return _appel(corps)


def placer(original, cours):
    """Une copie de `original` sur chacun des `cours` ([{starts_at, label}]) ; rend les résultats
    (status : placed, already, occupied, not_found…). Un cours occupé n'est jamais écrasé."""
    return _appel({'action': 'place', 'source_board_id': original, 'lessons': cours})['results']


def retirer(copie, forcer=False):
    """Retire la copie placée sur un cours (jamais un original). Sur demande de Thomas seulement."""
    corps = {'action': 'unplace', 'board_id': copie}
    if forcer:
        corps['force'] = True
    return _appel(corps)


# ---- Cahier de texte (action "journal", migration 084) ----

# « 2026-11-23 11h15 4B — Activité 2 Wegener.txt »
NOM_CAHIER = re.compile(r'^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})h(\d{2})\s+(.+?)(?:\s+[—–-]\s+.*)?$')
ENTETE_CAHIER = re.compile(r'^\s*(date|classe|cours)\s*:\s*(.*)$', re.IGNORECASE)
DATE_FR = re.compile(r'(\d{1,2})/(\d{1,2})/(\d{4})')
DATE_ISO = re.compile(r'(\d{4})-(\d{2})-(\d{2})')
HEURE = re.compile(r'(\d{1,2})\s*[h:]\s*(\d{2})')


def lire_entree_cahier(chemin):
    """Lit un fichier d'entrée : nommé « AAAA-MM-JJ HHhMM <classe> — <titre>.txt », il commence
    par les lignes « Date : », « Classe : », « Cours : », puis le texte brut de l'entrée.
    Date, heure et classe sont lues dans le nom du fichier, sinon dans ces lignes.
    Rend { date, time, class_name, content } (le texte sans les lignes d'en-tête)."""
    with open(chemin, encoding='utf-8-sig') as f:
        lignes = f.read().replace('\r\n', '\n').replace('\r', '\n').split('\n')
    entete = {}
    while lignes and (not lignes[0].strip() or ENTETE_CAHIER.match(lignes[0])):
        m = ENTETE_CAHIER.match(lignes.pop(0))
        if m:
            entete[m.group(1).lower()] = m.group(2).strip()
    texte = '\n'.join(l.rstrip() for l in lignes).strip('\n')
    date = heure = classe = None
    m = NOM_CAHIER.match(os.path.splitext(os.path.basename(chemin))[0])
    if m:
        date, heure, classe = m.group(1), '%02d:%s' % (int(m.group(2)), m.group(3)), m.group(4).strip()
    else:
        valeur = entete.get('date', '')
        d, h = DATE_ISO.search(valeur), HEURE.search(valeur)
        if d:
            date = d.group(0)
        elif DATE_FR.search(valeur):
            j, mo, a = DATE_FR.search(valeur).groups()
            date = '%s-%02d-%02d' % (a, int(mo), int(j))
        if h:
            heure = '%02d:%s' % (int(h.group(1)), h.group(2))
        classe = entete.get('classe') or None
    if not (date and heure and classe):
        raise EnvoiRefuse('Date, heure ou classe introuvable : ' + os.path.basename(chemin))
    if not texte:
        raise EnvoiRefuse('Entrée vide : ' + os.path.basename(chemin))
    return {'date': date, 'time': heure, 'class_name': classe, 'content': texte}


def envoyer_cahier(entrees, remplacer=False, source='claude'):
    """Envoie des entrées de cahier de texte. Chaque entrée : { content } et le cours, désigné par
    { starts_at, label } (voir lire_agenda) ou { date: 'AAAA-MM-JJ', time: 'HH:MM', class_name }
    (heure de Paris). Rend la liste des résultats (status : saved, same, exists, not_found…).
    Une entrée différente déjà là n'est jamais écrasée sans remplacer=True."""
    resultats = []
    for i in range(0, len(entrees), LOT_CAHIER):
        corps = {'action': 'journal', 'entries': entrees[i:i + LOT_CAHIER], 'source': source}
        if remplacer:
            corps['replace'] = True
        resultats.extend(_appel(corps)['results'])
    return resultats


def _fichiers_cahier(cible):
    if os.path.isdir(cible):
        return sorted(os.path.join(cible, n) for n in os.listdir(cible) if n.lower().endswith('.txt'))
    return [cible]


def _principal(args):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except (AttributeError, ValueError):
        pass
    if not args:
        print(__doc__)
        return 2
    try:
        commande = args[0]
        if commande == 'verifier':
            r = verifier()
            print('Jeton valable (%s), jusqu\'au %s.' % (r.get('label') or 'sans nom', str(r.get('expires_at'))[:10]))
        elif commande == 'image' and len(args) == 2:
            print(envoyer_image(args[1]))
        elif commande == 'fichier' and len(args) == 2:
            print(envoyer_fichier(args[1]))
        elif commande == 'cours' and len(args) in (2, 4):
            remplacer = args[3] if len(args) == 4 and args[2] == '--remplacer' else None
            if len(args) == 4 and not remplacer:
                print(__doc__)
                return 2
            print('Cours %s : %s' % ('remplacé' if remplacer else 'créé', envoyer_cours(args[1], remplacer)))
        elif commande == 'ecrans' and len(args) in (3, 4):
            remplacer = len(args) == 4 and args[3] == '--remplacer'
            if len(args) == 4 and not remplacer:
                print(__doc__)
                return 2
            print('%d écrans posés.' % envoyer_ecrans(args[1], args[2], remplacer))
        elif commande == 'cahier' and len(args) >= 2 and set(args[2:]) <= {'--remplacer', '--reprise'}:
            fichiers, entrees, illisibles = _fichiers_cahier(args[1]), [], 0
            for chemin in fichiers:
                try:
                    entrees.append((os.path.basename(chemin), lire_entree_cahier(chemin)))
                except (EnvoiRefuse, OSError, UnicodeDecodeError) as e:
                    illisibles += 1
                    print('✗ %s : illisible (%s)' % (os.path.basename(chemin), e))
            if not entrees:
                print('Aucune entrée à envoyer.')
                return 1
            resultats = envoyer_cahier([e for _, e in entrees], '--remplacer' in args,
                                       'import' if '--reprise' in args else 'claude')
            bilan = {}
            for (nom, _), r in zip(entrees, resultats):
                etat = r.get('status')
                bilan[etat] = bilan.get(etat, 0) + 1
                ok = etat in ('saved', 'same', 'replaced')
                print('%s %s : %s' % ('✓' if ok else '✗', nom, ETATS_CAHIER.get(etat, etat)))
            print('Bilan : ' + ', '.join('%d %s' % (n, ETATS_CAHIER.get(e, e).split(' :')[0]) for e, n in bilan.items())
                  + (', %d illisibles' % illisibles if illisibles else '') + '.')
            if any(r.get('status') not in ('saved', 'same', 'replaced') for r in resultats) or illisibles:
                return 1
        else:
            print(__doc__)
            return 2
    except EnvoiRefuse as e:
        print('Refusé : %s' % e)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(_principal(sys.argv[1:]))
