# Annales du Brevet — chaîne de données

Ajouter / mettre à jour les sujets de DNB affichés dans l'onglet **Annales**.

## Vue d'ensemble

```
brevets_manifest.csv  →  make_brevets_data.py  →  ../src/lib/brevets.ts
   (à remplir)              (download + upload)        (généré, ne pas éditer)
                                   │
                                   └─►  Supabase Storage (bucket public 'brevets')
```

Le **manifeste CSV est la seule chose à éditer à la main**. Le code ne devine
rien : il télécharge l'`source_url` de chaque ligne, l'envoie sur Supabase, et
régénère `brevets.ts`. Si un lien casse, on corrige **une ligne** et on relance —
tout ce qui est déjà en ligne est sauté (idempotent).

## Procédure pour ajouter une matière (ex : Maths)

1. **Remplir le manifeste.** Ajouter une ligne par sujet dans
   `brevets_manifest.csv` :

   ```csv
   matiere,annee,centre,theme,points,code,source_url
   Maths,2024,Métropole,Sujet complet,100,24GENMATMEAG1,https://www.apmep.fr/IMG/pdf/....pdf
   ```

   - `matiere` : `SVT` | `Maths` | `Français` | `Histoire-Géo-EMC` | `Physique-Chimie`
   - `points` : entier, ou `0` si inconnu (la carte masque alors le badge points)
   - `code` : identifiant officiel si connu, sinon laisser **vide** (auto-généré)
   - `source_url` : lien **direct** vers le PDF
   - Mettre les champs contenant une virgule entre guillemets `"..."`.

2. **Tester le sourcing sans rien publier** (vérifie que les liens répondent
   bien en PDF, télécharge dans `.pdf_cache/`, n'uploade pas) :

   ```bash
   python make_brevets_data.py --only Maths --skip-upload
   ```

   Corriger dans le CSV les lignes en `✗` puis relancer (le reste est sauté).

3. **Publier** (nécessite les variables d'env, voir plus bas) :

   ```bash
   python make_brevets_data.py        # télécharge, uploade, régénère brevets.ts
   ```

4. **Vérifier le build puis committer** :

   ```bash
   cd .. && npx tsc -b
   git add src/lib/brevets.ts scripts/brevets_manifest.csv
   git commit -m "feat(annales): ajout sujets DNB Maths"
   ```

## Variables d'environnement (publication)

La clé `service_role` permet d'écrire dans le Storage. **Ne jamais la committer.**
Dashboard Supabase → *Settings → API → service_role*.

```powershell
# PowerShell
$env:SUPABASE_URL = "https://djodkjysovalpufgevrr.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJ..."
```

```bash
# bash
export SUPABASE_URL="https://djodkjysovalpufgevrr.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

Prérequis : `pip install requests` (Python 3.9+).

## Options du script

| Option | Effet |
|---|---|
| `--dry-run` | Affiche le plan, n'écrit/n'uploade rien |
| `--only <Matière>` | Ne traite qu'une matière. **Ne réécrit PAS** `brevets.ts` (sécurité : la génération est globale) |
| `--skip-upload` | Télécharge + régénère, sans toucher à Supabase (idéal pour tester le sourcing) |
| `--force` | Ré-uploade même si le fichier existe déjà (upsert) |

## ⚠️ Pièges à connaître

- **`brevets.ts` est régénéré INTÉGRALEMENT** depuis le manifeste lors d'un run
  sans `--only`. Le manifeste doit donc **contenir TOUTES les matières**, SVT
  inclus (les 30 lignes SVT y sont déjà, pointant vers leurs PDF déjà en ligne :
  elles seront re-téléchargées depuis Supabase puis conservées).
- Un `--only Maths` complet télécharge/uploade les Maths mais **laisse
  `brevets.ts` intact**. Pour intégrer les Maths au site, relancer **sans**
  `--only` une fois le manifeste à jour.
- `sujetdebrevet.fr` et certains sites bloquent les requêtes sans navigateur :
  le script envoie déjà un User-Agent Chrome. Si un lien renvoie du HTML au lieu
  d'un PDF, c'est souvent une page intermédiaire — trouver le lien `.pdf` final.
