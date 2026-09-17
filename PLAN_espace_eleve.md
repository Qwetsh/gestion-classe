# Espace élève — personnalisation fine de ce que voit chaque élève

> Rédigé le 14/09/2026 avec Thomas. Remplace le panneau « Ce que voient les élèves » de la barre
> latérale de Classes (3 interrupteurs par classe) par une cascade à quatre portées et un écran dédié.
> Rien n'est codé ici.

---

## 1. Décisions prises (14/09/2026)

| Sujet | Décision |
|-------|----------|
| La note d'implication | **Toujours visible**, jamais dans la matrice. L'espace élève garde un sens. |
| Le niveau d'une classe | **Champ explicite** `classes.level` (6e / 5e / 4e / 3e / Autre, nullable). Pas de déduction depuis le nom. |
| L'aperçu | **« Voir comme Amina »** : l'enseignant ouvre l'espace élève de n'importe quel élève, réglages résolus. |
| Périmètre V1 | **Tout d'un coup** : cascade 4 portées, classement en 3 modes, profils prêts, aperçu. |

---

## 2. Existant (à migrer, pas à casser)

- `class_student_tabs(class_id, user_id, show_stamps, show_annales)` : visibilité par classe, source de
  vérité côté élève via `get_student_dashboard(p_code)` (SECURITY DEFINER, l'élève arrive par code).
- `academy_config.enabled` par classe : la Maison est une **fonctionnalité** (répartition, points), pas
  qu'un affichage. Reste tel quel ; la matrice ajoute seulement une visibilité par-dessus.
- `students.is_witness` : l'élève témoin voit tout. Conservé, mais l'aperçu « voir comme » le rend moins
  central.
- `hiddenTabs` (SettingsContext, localStorage) : navigation **du prof**. Aucun rapport, ne pas mélanger.
- Sur le mobile, `classes` est écrit avec des colonnes explicites (`syncService.ts`, upsert id/user_id/name…)
  et lu avec `select('id, name, created_at, updated_at')` : une colonne `level` nullable est sans effet.

---

## 3. Inventaire des éléments pilotables

Clés stables (chaîne), groupées comme les onglets de `/eleve`. Tout est booléen sauf le classement.

| Groupe | Clé | Type | Défaut | Note |
|--------|-----|------|--------|------|
| Notes | `notes.objectif` | on/off | on | « Objectif : 15 implications » |
| Notes | `notes.compteurs` | on/off | on | participations, malus, absences |
| Notes | `notes.classement_classe` | `exact` / `top10` / `off` | exact | rang + top 10 de la classe |
| Notes | `notes.classement_general` | `exact` / `top10` / `off` | exact | toutes les classes du prof |
| Notes | `notes.classement_classes` | on/off | on | palmarès des classes entre elles |
| Tampons | `tampons` | on/off | **off** | l'onglet entier (comme aujourd'hui) |
| Tampons | `tampons.historique` | on/off | on | cartes passées |
| Maison | `maison` | on/off | on | visible seulement si `academy_config.enabled` |
| Annales | `annales` | on/off | **off** | l'onglet entier (comme aujourd'hui) |
| RA | `ra` | on/off | on | onglet réalité augmentée |
| À venir | `tableau.pages` | on/off | off | pages du tableau de séance (absents) |
| À venir | `ressources` | on/off | off | espace ressources (Epic 11) |

Le mode `top10` du classement : l'élève voit le top 10 et sa note, pas son rang ni le total.

---

## 4. Modèle de données

### 4.1 Table `student_visibility_rules`

```sql
CREATE TABLE student_visibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('all', 'level', 'class', 'student')),
  -- 'all' : NULL ; 'level' : '6e'… ; 'class' : classes.id ; 'student' : students.id
  scope_id TEXT,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "notes.classement_classe": "off", "annales": true }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, scope_id)
);
```

Une ligne par portée, un JSON de clés. Une clé absente = **Hérité**. RLS par `user_id`.
`ALTER TABLE classes ADD COLUMN level TEXT` (nullable). Migration de `class_student_tabs` : chaque ligne
devient `scope='class'` avec `{"tampons": show_stamps, "annales": show_annales}` ; l'ancienne table reste
lue en repli tant que la nouvelle est vide, puis supprimée dans une migration suivante.

### 4.2 Résolution (SQL, réutilisée par la RPC élève et par l'aperçu)

```sql
CREATE FUNCTION resolve_student_visibility(p_student_id UUID) RETURNS JSONB
-- défauts || règles(all) || règles(level de la classe) || règles(class) || règles(student)
-- (|| de JSONB = la droite écrase la gauche, clé par clé)
-- puis : si academy_config.enabled est faux → "maison": false ;
--        si l'élève est témoin → tout à on / exact.
```

`get_student_dashboard` renvoie `visibility` (le JSON résolu) à la place de `tabs`, et **omet les données
masquées** (pas de `class_rank` si `notes.classement_classe = off`, top 10 seul si `top10`). Le masquage
est côté serveur : un élève curieux n'a rien dans la réponse. `get_student_academy` lit `maison`.

### 4.3 Aperçu « voir comme »

```sql
CREATE FUNCTION get_student_dashboard_preview(p_student_id UUID) RETURNS JSON
-- SECURITY DEFINER ; vérifie auth.uid() = students.user_id ; appelle le même corps que
-- get_student_dashboard, sans journaliser de connexion ; renvoie en plus "preview": true.
```

Côté web : `/eleve?preview=<student_id>` ouvre `StudentDashboard` avec un bandeau « Aperçu : Amina DU.
(6e A) — ce que voit l'élève » et un bouton Fermer. Le bandeau est le seul écart avec l'écran réel.

---

## 5. Placement

**Un écran central + deux portes d'entrée contextuelles.**

- **Écran « Espace élève »** : nouvelle entrée de navigation (route `/espace-eleve`), à côté de Suivi
  élèves. C'est là que vit la matrice complète.
- **Classes**, barre latérale : le bloc « Ce que voient les élèves » devient un résumé en lecture (« Tampons
  ✓ · Maison ✓ · Annales ✗ · classement : top 10 ») + lien « Régler… » qui ouvre l'écran pré-filtré sur la
  classe. Les trois interrupteurs disparaissent (ils vivaient au mauvais niveau).
- **Suivi élèves**, fiche détail : ligne « Affichage particulier : aucun / 2 réglages » + lien « Régler… »
  pré-filtré sur l'élève, et bouton « Voir comme cet élève ».
- **Classes**, formulaire de classe : champ Niveau (select) à côté du nom.

---

## 6. Visuel de l'écran

Deux colonnes, densité bureau (c'est un écran de préparation, pas de TBI).

```
┌─ Espace élève ─────────────────────────────────────────────────────────────────┐
│ Portée                     │ 6e A   hérite de : 6e › Tous mes élèves             │
│ ▸ Tous mes élèves          │ [Profils ▾]  [Tout remettre en héritage]  [Voir comme…] │
│ ▾ 6e            2 propres  │                                                     │
│   ▸ 6e A        1 propre   │ NOTES                                               │
│   ▸ 6e B                   │  Note d'implication        toujours affichée        │
│ ▸ 5e                       │  Objectif                  (Hérité ● Affiché ○ Masqué ○)  Affiché, hérité de Tous │
│ ▸ 4e                       │  Compteurs                 (● ○ ○)                  │
│ ▸ 3e            1 propre   │  Classement classe         Hérité ● | Exact | Top 10 | Masqué   → Top 10, hérité de 6e │
│ ▸ Sans niveau              │  Classement général        (…)                      │
│                            │  Palmarès des classes      (…)                      │
│ Élèves avec un affichage   │ TAMPONS                                             │
│ particulier (6e A) :       │  Onglet Tampons            (…)                      │
│  • Amina DU.   1 réglage   │  Historique des cartes     (…)   grisé si onglet masqué │
│  + Ajouter un élève        │ MAISON  — désactivée pour cette classe (Académie)    │
│                            │ ANNALES / RA / À VENIR …                            │
└────────────────────────────┴─────────────────────────────────────────────────────┘
```

Règles :
- Le sélecteur de chaque ligne a toujours **Hérité** en première position ; en position Hérité, la valeur
  effective et sa provenance s'affichent en gris (« Masqué, hérité de 6e »).
- Un badge « N propres » sur chaque nœud de l'arbre : on voit d'un coup d'œil où sont les exceptions.
- Sous une classe, on ne liste **que** les élèves qui ont des réglages propres ; « Ajouter un élève » ouvre
  une recherche dans la classe.
- Les lignes dépendantes d'une autre (historique sans onglet, maison sans académie) sont grisées avec la
  raison en infobulle, jamais cachées.
- Enregistrement immédiat à chaque changement (comme les interrupteurs actuels), avec « Annuler » 8 s.

### Profils prêts (menu « Profils »)

Appliqués à la portée courante, en écrasant ses règles propres :

| Profil | Contenu |
|--------|---------|
| Tout | tout affiché, classements exacts |
| Sobre | note, objectif, compteurs ; classements masqués ; tampons/annales hérités |
| Brevet (3e) | Sobre + annales affichées |
| Réinitialiser | supprime les règles propres de la portée (= tout Hérité) |

---

## 7. Phases

1. **Données** : migration `add_student_visibility.sql` (table, `classes.level`, migration des lignes
   `class_student_tabs`, `resolve_student_visibility`, `get_student_dashboard` étendu, aperçu). Lib
   `studentVisibility.ts` (clés, défauts, types, résolution côté client pour l'affichage « hérité de »).
2. **Écran** `/espace-eleve` : arbre des portées, matrice, profils, badges. Champ Niveau dans Classes.
3. **Côté élève** : `StudentDashboard` lit `visibility` (objectif, compteurs, classements en 3 modes,
   onglets). Mode aperçu avec bandeau.
4. **Portes d'entrée** : résumé + « Régler… » dans Classes ; fiche élève dans Suivi élèves (« Affichage
   particulier », « Voir comme cet élève »). Retrait des anciens interrupteurs et de `applyStudentTabsToAll`.
5. **Nettoyage** : suppression de `class_student_tabs` une fois la migration confirmée en classe.

Chaque phase compile seule ; la 1 ne change rien pour l'élève tant que la 3 n'est pas livrée (la RPC garde
`tabs` en plus de `visibility` pendant la transition).

---

## 8. Points d'attention

- **RGPD / sécurité** : l'aperçu est réservé à `auth.uid() = students.user_id`. Jamais d'aperçu par code.
- **Élève témoin** : voit tout, comme avant ; l'aperçu le rend surtout utile pour tester sur téléphone.
- **Passage d'année** : les règles `student` suivent l'élève (FK sur `students.id`, `ON DELETE CASCADE`) ;
  les règles `class` meurent avec la classe ; `level` et `all` survivent.
- **Aurélie** : tout est par `user_id`, ses élèves ne voient que ses règles.
