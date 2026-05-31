#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_brevets_data.py — Chaîne de données des annales du Brevet.

Lit un manifeste CSV (la SEULE chose à remplir/corriger à la main), puis pour
chaque ligne :
  1. télécharge le PDF depuis source_url (avec User-Agent navigateur + retries) ;
  2. l'uploade dans le bucket Supabase Storage `brevets` (idempotent) ;
  3. régénère src/lib/brevets.ts avec l'URL publique et la taille réelle.

Philosophie : l'étape FRAGILE (trouver les bons liens) vit dans le CSV, pas
dans le code. Si un lien casse, on corrige UNE ligne et on relance — le script
saute tout ce qui est déjà en place (téléchargé + uploadé).

────────────────────────────────────────────────────────────────────────────
PRÉREQUIS
  pip install requests
  Variables d'environnement (ne JAMAIS committer la service_role) :
    SUPABASE_URL=https://djodkjysovalpufgevrr.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Dashboard → Settings → API → service_role)

USAGE
  python make_brevets_data.py --dry-run        # n'écrit rien, montre le plan
  python make_brevets_data.py                  # télécharge + upload + génère
  python make_brevets_data.py --only Maths     # ne traite qu'une matière
  python make_brevets_data.py --skip-upload    # télécharge + génère, sans Supabase
                                               # (utile pour tester le sourcing)
  python make_brevets_data.py --force          # ré-upload même si déjà présent

Le CSV (brevets_manifest.csv) a ces colonnes :
    matiere,annee,centre,theme,points,code,source_url
  - matiere : SVT | Maths | Français | Histoire-Géo-EMC | Physique-Chimie
  - points  : entier ou vide (0 si inconnu)
  - code    : identifiant officiel (ex 24GENMATMEAG1) ou vide -> auto-généré
  - source_url : lien DIRECT vers le PDF du sujet
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests manquant -> pip install requests")

# Console Windows : éviter UnicodeEncodeError sur les symboles (→ ✓ ⬆ …)
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001
        pass

# ── Chemins (le script vit dans gestion-classe-web/scripts/) ────────────────
HERE = Path(__file__).resolve().parent
WEB_ROOT = HERE.parent                       # gestion-classe-web/
MANIFEST = HERE / "brevets_manifest.csv"
CACHE_DIR = HERE / ".pdf_cache"              # PDFs téléchargés (gitignored)
OUT_TS = WEB_ROOT / "src" / "lib" / "brevets.ts"
BUCKET = "brevets"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

VALID_MATIERES = {"SVT", "Maths", "Français", "Histoire-Géo-EMC", "Physique-Chimie"}


# ── Utilitaires ─────────────────────────────────────────────────────────────
def slugify(text: str, maxlen: int = 60) -> str:
    """ASCII, underscores, tronqué — pour des noms de fichiers Storage sûrs."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_")
    return text[:maxlen].strip("_") or "sujet"


def auto_code(row: dict) -> str:
    """Code de repli si la colonne 'code' est vide."""
    abbr = {"SVT": "SVT", "Maths": "MAT", "Français": "FRA",
            "Histoire-Géo-EMC": "HGE", "Physique-Chimie": "PHC"}.get(row["matiere"], "DNB")
    centre = slugify(row["centre"], 8).upper()
    return f"{str(row['annee'])[-2:]}{abbr}{centre}"


def storage_name(row: dict) -> str:
    """Nom de l'objet dans le bucket.

    Si la source pointe DÉJÀ vers notre bucket (cas des SVT historiques), on
    réutilise tel quel le nom de fichier existant — sinon on créerait des
    doublons et on changerait les URLs à chaque run. Pour un sujet externe
    (nouveau), on fabrique un nom : <code>_<matiere>_<theme>.pdf
    """
    url = row.get("source_url", "")
    marker = f"/storage/v1/object/public/{BUCKET}/"
    if marker in url:
        return url.split(marker, 1)[1].split("?", 1)[0]
    code = row["code"] or auto_code(row)
    return f"{code}_{slugify(row['matiere'],4)}_{slugify(row['theme'])}.pdf"


def public_url(supabase_url: str, name: str) -> str:
    return f"{supabase_url}/storage/v1/object/public/{BUCKET}/{name}"


# ── Étape 1 : téléchargement (avec cache + retries) ─────────────────────────
def download(url: str, dest: Path, retries: int = 3) -> bytes:
    if dest.exists() and dest.stat().st_size > 1024:
        return dest.read_bytes()
    last = None
    for attempt in range(1, retries + 1):
        try:
            r = requests.get(url, headers={"User-Agent": UA, "Accept": "application/pdf,*/*"},
                             timeout=40, allow_redirects=True)
            r.raise_for_status()
            data = r.content
            ct = r.headers.get("Content-Type", "")
            if not (data[:5] == b"%PDF-" or "pdf" in ct.lower()):
                raise ValueError(f"réponse non-PDF (Content-Type={ct!r}, {len(data)} octets)")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            return data
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt < retries:
                time.sleep(1.5 * attempt)
    raise RuntimeError(f"échec téléchargement après {retries} essais : {last}")


# ── Étape 2 : upload Supabase Storage (idempotent) ──────────────────────────
def storage_exists(sb_url: str, key: str, name: str) -> bool:
    r = requests.get(public_url(sb_url, name), headers={"User-Agent": UA},
                     timeout=20, stream=True)
    return r.status_code == 200


def storage_upload(sb_url: str, key: str, name: str, data: bytes, force: bool) -> None:
    endpoint = f"{sb_url}/storage/v1/object/{BUCKET}/{name}"
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": "application/pdf",
        "x-upsert": "true" if force else "false",
        "cache-control": "max-age=31536000",
    }
    r = requests.post(endpoint, headers=headers, data=data, timeout=120)
    if r.status_code in (200, 201):
        return
    if r.status_code == 409 and not force:  # existe déjà
        return
    raise RuntimeError(f"upload {name} → HTTP {r.status_code} : {r.text[:200]}")


# ── Étape 3 : génération du brevets.ts ──────────────────────────────────────
TS_HEADER = """// Généré automatiquement — annales DNB hébergées sur Supabase Storage (bucket 'brevets').
// Régénérer via scripts/make_brevets_data.py (lit scripts/brevets_manifest.csv).
export type Matiere = 'SVT' | 'Maths' | 'Français' | 'Histoire-Géo-EMC' | 'Physique-Chimie';

export interface Brevet {
  code: string;
  annee: number;
  centre: string;
  theme: string;
  points: number;
  url: string;
  tailleKo: number;
  /** Matière de l'épreuve. Absent = 'SVT' (entrées historiques). */
  matiere?: Matiere;
}

export const brevets: Brevet[] = [
"""


def ts_str(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_ts(entries: list[dict]) -> None:
    # tri : matière, puis année décroissante, puis centre
    entries.sort(key=lambda e: (e["matiere"], -e["annee"], e["centre"]))
    lines = [TS_HEADER]
    for e in entries:
        lines.append(
            "  { "
            f"code: {ts_str(e['code'])}, "
            f"annee: {e['annee']}, "
            f"centre: {ts_str(e['centre'])}, "
            f"theme: {ts_str(e['theme'])}, "
            f"points: {e['points']}, "
            f"matiere: {ts_str(e['matiere'])}, "
            f"tailleKo: {e['tailleKo']}, "
            f"url: {ts_str(e['url'])} "
            "},"
        )
    lines.append("];\n")
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")


# ── Pilote ──────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description="Génère brevets.ts depuis le manifeste CSV.")
    ap.add_argument("--dry-run", action="store_true", help="n'écrit/n'uploade rien")
    ap.add_argument("--only", help="ne traiter qu'une matière (ex: Maths)")
    ap.add_argument("--skip-upload", action="store_true", help="pas d'upload Supabase")
    ap.add_argument("--force", action="store_true", help="ré-upload même si présent")
    args = ap.parse_args()

    if not MANIFEST.exists():
        sys.exit(f"manifeste introuvable : {MANIFEST}")

    sb_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    need_supabase = not (args.dry_run or args.skip_upload)
    if need_supabase and not (sb_url and sb_key):
        sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants "
                 "(ou utilise --skip-upload / --dry-run)")
    if not sb_url:
        sb_url = "https://djodkjysovalpufgevrr.supabase.co"  # défaut Class'it

    # Lecture manifeste
    rows: list[dict] = []
    with MANIFEST.open(encoding="utf-8-sig", newline="") as f:
        for i, raw in enumerate(csv.DictReader(f), start=2):
            row = {k: (v or "").strip() for k, v in raw.items()}
            if not row.get("source_url"):
                continue  # ligne vide / à compléter
            if row["matiere"] not in VALID_MATIERES:
                print(f"  ! ligne {i}: matière invalide {row['matiere']!r}, ignorée")
                continue
            if args.only and row["matiere"].lower() != args.only.lower():
                continue
            try:
                row["annee"] = int(row["annee"])
            except ValueError:
                print(f"  ! ligne {i}: année invalide {row.get('annee')!r}, ignorée")
                continue
            row["points"] = int(row["points"]) if row.get("points", "").isdigit() else 0
            row["code"] = row.get("code") or auto_code(row)
            rows.append(row)

    print(f"→ {len(rows)} sujet(s) à traiter"
          + (f" (filtre matière: {args.only})" if args.only else ""))

    entries: list[dict] = []
    ok = skip = fail = 0
    for row in rows:
        name = storage_name(row)
        tag = f"[{row['matiere']:>16}] {row['code']} — {row['theme'][:50]}"
        if args.dry_run:
            print(f"  · {tag}\n        ↳ {name}")
            continue
        try:
            cache_path = CACHE_DIR / name
            data = download(row["source_url"], cache_path)
            taille_ko = max(1, round(len(data) / 1024))

            if not args.skip_upload:
                if args.force or not storage_exists(sb_url, sb_key, name):
                    storage_upload(sb_url, sb_key, name, data, args.force)
                    print(f"  ⬆ {tag}")
                    ok += 1
                else:
                    print(f"  ✓ {tag}  (déjà en ligne)")
                    skip += 1
            else:
                print(f"  ⬇ {tag}  ({taille_ko} Ko, upload sauté)")
                ok += 1

            entries.append({
                "code": row["code"], "annee": row["annee"], "centre": row["centre"],
                "theme": row["theme"], "points": row["points"], "matiere": row["matiere"],
                "tailleKo": taille_ko, "url": public_url(sb_url, name),
            })
        except Exception as e:  # noqa: BLE001
            print(f"  ✗ {tag}\n        ERREUR: {e}")
            fail += 1

    if args.dry_run:
        print("\n(dry-run — rien écrit)")
        return 0

    # Garde-fou : --only ne réécrit PAS brevets.ts (sinon il effacerait les
    # autres matières, car la génération est globale). On l'utilise seulement
    # pour tester le sourcing/upload d'une matière.
    if args.only:
        print(f"\n(--only {args.only} : brevets.ts NON réécrit. "
              "Relance SANS --only pour régénérer le fichier complet.)")
        print(f"  upload: {ok}  déjà-présents: {skip}  échecs: {fail}")
        return 0

    if entries:
        write_ts(entries)
        print(f"\n✔ {OUT_TS.relative_to(WEB_ROOT)} régénéré ({len(entries)} entrées)")
    print(f"  upload: {ok}  déjà-présents: {skip}  échecs: {fail}")
    if fail:
        print("  → corrige les source_url en échec dans le CSV puis relance "
              "(le reste sera sauté).")
    return 1 if fail and not entries else 0


if __name__ == "__main__":
    raise SystemExit(main())
