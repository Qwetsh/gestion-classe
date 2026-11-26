"""Met à jour les outils de Claude pour le travail de contenu (cours, fiches, tableaux, semaine).

Un seul endroit fait foi, quel que soit le dossier d'où la session est lancée :

  - le « checkout des outils » : ~/gc-worktrees/outils-master, copie de `master` hors OneDrive.
    Les scripts des skills, la vérification des cours (`npm run course:check`) et les brouillons
    (`gestion-classe-web/course-drafts/`) y vivent ;
  - les skills de contenu, copiées de ce checkout dans ~/.claude/skills : elles se chargent alors
    partout (dossier École compris), toujours dans la version de `master`.

Ce script remet le checkout sur `master`, réinstalle les dépendances si elles ont changé, puis
recopie les skills. Une skill ne se modifie jamais dans ~/.claude/skills ni dans le checkout des
outils : elle se modifie dans le dépôt, par une PR. Si une copie installée a été retouchée à la
main, elle est mise de côté avant d'être remplacée, et le script le dit.

    python -I <outils>/scripts/maj_outils_claude.py            # mise à jour complète
    python -I <outils>/scripts/maj_outils_claude.py --etat     # ne change rien, dit où on en est
"""

from __future__ import annotations

import argparse
import datetime
import filecmp
import os
import shutil
import subprocess
import sys

SKILLS = ('cours-gestion-classe', 'prepare-semaine', 'tableau-seance', 'version-mobile')
IGNORES = ('__pycache__', '.installe-depuis')

HOME = os.path.expanduser('~')
DEPOT = os.path.join(HOME, 'OneDrive', 'Code', 'Gestion classe')
OUTILS = os.path.join(HOME, 'gc-worktrees', 'outils-master')
SKILLS_COMPTE = os.path.join(HOME, '.claude', 'skills')
SAUVEGARDES = os.path.join(HOME, '.claude', 'skills-mises-de-cote')
WEB = os.path.join(OUTILS, 'gestion-classe-web')


def git(*args: str, cwd: str = OUTILS, check: bool = True) -> str:
    done = subprocess.run(['git', '-C', cwd, *args], capture_output=True, text=True, encoding='utf-8')
    if check and done.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} a échoué :\n{done.stderr.strip()}")
    return done.stdout.strip()


def differences(a: str, b: str) -> list[str]:
    """Chemins qui diffèrent entre deux dossiers (contenu comparé, pas seulement les dates)."""
    if not os.path.isdir(a) or not os.path.isdir(b):
        return ['(dossier absent)']
    found: list[str] = []

    def walk(cmp: filecmp.dircmp, prefix: str) -> None:
        for name in cmp.left_only + cmp.right_only:
            found.append(os.path.join(prefix, name))
        _, mismatch, errors = filecmp.cmpfiles(cmp.left, cmp.right, cmp.common_files, shallow=False)
        found.extend(os.path.join(prefix, n) for n in mismatch + errors)
        for name, sub in cmp.subdirs.items():
            walk(sub, os.path.join(prefix, name))

    walk(filecmp.dircmp(a, b, ignore=list(IGNORES)), '')
    return sorted(found)


def installed_commit(skill: str) -> str | None:
    marker = os.path.join(SKILLS_COMPTE, skill, '.installe-depuis')
    try:
        with open(marker, encoding='utf-8') as fh:
            return fh.read().strip() or None
    except OSError:
        return None


def report() -> None:
    head = git('rev-parse', '--short', 'HEAD')
    behind = git('rev-list', '--count', 'HEAD..origin/master')
    print(f"Checkout des outils : {OUTILS}")
    print(f"  commit {head} ({git('log', '-1', '--format=%cd', '--date=format:%d/%m/%Y')}), "
          f"{behind} commit(s) de retard sur master")
    for skill in SKILLS:
        source = os.path.join(OUTILS, '.claude', 'skills', skill)
        target = os.path.join(SKILLS_COMPTE, skill)
        if not os.path.isdir(target):
            print(f"  {skill} : pas installée")
            continue
        diff = differences(source, target)
        origin = installed_commit(skill) or 'origine inconnue'
        state = 'identique au checkout' if not diff else f"{len(diff)} fichier(s) différent(s) du checkout"
        print(f"  {skill} : installée ({origin}), {state}")


def main() -> int:
    # La console Windows n'affiche pas tous les caractères : ne jamais planter pour un accent.
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(errors='replace')
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--etat', action='store_true', help="ne rien changer, dire où on en est")
    args = parser.parse_args()

    if not os.path.isdir(OUTILS):
        if args.etat:
            print(f"Le checkout des outils n'existe pas encore : {OUTILS}")
            return 1
        git('fetch', 'origin', '--quiet', cwd=DEPOT)
        git('worktree', 'add', '--detach', OUTILS, 'origin/master', cwd=DEPOT)
        print(f"Checkout des outils créé : {OUTILS}")

    git('fetch', 'origin', '--quiet')
    if args.etat:
        report()
        return 0

    dirty = git('status', '--porcelain', '--untracked-files=no')
    if dirty:
        print("Le checkout des outils contient des modifications non commitées :")
        print(dirty)
        print("Rien n'a été changé. Une skill se modifie dans le dépôt, par une PR : reporter ces "
              "modifications sur une branche, puis les annuler ici (git restore).")
        return 1

    # 1. Les copies installées ont-elles été retouchées à la main depuis leur installation ?
    stamp = datetime.datetime.now().strftime('%Y-%m-%d-%Hh%M')
    for skill in SKILLS:
        source = os.path.join(OUTILS, '.claude', 'skills', skill)
        target = os.path.join(SKILLS_COMPTE, skill)
        if not os.path.isdir(target):
            continue
        diff = differences(source, target)
        if diff:
            aside = os.path.join(SAUVEGARDES, f"{skill}-{stamp}")
            shutil.copytree(target, aside, ignore=shutil.ignore_patterns('__pycache__'))
            print(f"ATTENTION : la skill installée « {skill} » différait du checkout "
                  f"({len(diff)} fichier(s) : {', '.join(diff[:5])}{'…' if len(diff) > 5 else ''}).")
            print(f"  Copie mise de côté dans {aside}")

    # 2. Le checkout suit master.
    before = git('rev-parse', 'HEAD')
    git('checkout', '--detach', 'origin/master', '--quiet')
    after = git('rev-parse', 'HEAD')
    short = git('rev-parse', '--short', 'HEAD')
    if before == after:
        print(f"Checkout des outils déjà à jour ({short}).")
    else:
        print(f"Checkout des outils : {before[:7]} -> {short} "
              f"({git('rev-list', '--count', f'{before}..{after}')} commit(s)).")

    # 3. Dépendances de la vérification des cours, si elles ont changé.
    lock_changed = before != after and bool(
        git('diff', '--name-only', before, after, '--', 'gestion-classe-web/package-lock.json'))
    if lock_changed or not os.path.isdir(os.path.join(WEB, 'node_modules')):
        print("Installation des dépendances (une à deux minutes)…")
        done = subprocess.run('npm ci --no-audit --no-fund', cwd=WEB, shell=True)
        if done.returncode != 0:
            print("ATTENTION : `npm ci` a échoué ; `npm run course:check` peut ne pas marcher.")
    if not os.path.isfile(os.path.join(WEB, '.env')):
        print("ATTENTION : gestion-classe-web/.env manque dans le checkout des outils ; "
              "`npm run course:check` en a besoin.")

    # 4. Les skills du compte sont recopiées du checkout.
    os.makedirs(SKILLS_COMPTE, exist_ok=True)
    for skill in SKILLS:
        source = os.path.join(OUTILS, '.claude', 'skills', skill)
        target = os.path.join(SKILLS_COMPTE, skill)
        if not os.path.isdir(source):
            print(f"ATTENTION : la skill « {skill} » n'est pas dans le checkout.")
            continue
        if os.path.isdir(target):
            shutil.rmtree(target)
        shutil.copytree(source, target, ignore=shutil.ignore_patterns('__pycache__'))
        with open(os.path.join(target, '.installe-depuis'), 'w', encoding='utf-8') as fh:
            fh.write(f"master {short}, le {datetime.date.today().strftime('%d/%m/%Y')}\n")
    print(f"Skills installées dans {SKILLS_COMPTE} : {', '.join(SKILLS)} (master {short}).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
