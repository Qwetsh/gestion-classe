# Story 10.3 : Algorithme de Répartition — Le Diadème

## Metadata
- **Epic**: 10 - Module "L'Académie des Quatre Lumières"
- **Priority**: HIGH
- **Estimated Effort**: M
- **Status**: Draft
- **Depends on**: 10-1

## User Story
**En tant qu'** enseignante
**Je veux** que les élèves soient répartis automatiquement dans les 4 Maisons selon leur test et préférences
**Afin de** garantir un équilibre d'effectifs tout en respectant au mieux les résultats du Diadème

## Contexte
L'algorithme tourne côté client (navigateur de l'enseignante). Elle le déclenche manuellement depuis son dashboard quand suffisamment d'élèves ont passé le test. Les 4 maisons : Salamandre, Vouivre, Zéphyr, Taisson.

## Critères d'acceptation

### AC-1: Calcul des scores bruts (Étape A)
- [ ] Pour chaque élève ayant complété le test, calcul du score par maison
- [ ] Score = somme des pondérations (salamandre_weight, vouivre_weight, zephyr_weight, taisson_weight) des réponses choisies
- [ ] Résultat : 4 scores par élève

### AC-2: Affectation prioritaire score + préférence (Étape B)
- [ ] Si maison score dominant = préférence n°1 de l'élève → affectation prioritaire
- [ ] Respect du quota : effectif cible = nb_élèves / 4, tolérance ±15% de l'effectif max
- [ ] Les affectations B sont traitées en premier

### AC-3: Affectation par compromis (Étape C)
- [ ] Élèves restants : meilleur compromis score × rang de préférence
- [ ] Formule : score_maison × (5 - rang_preference) → maximiser ce produit
- [ ] Respect des quotas
- [ ] Éviter au maximum de placer un élève dans sa préférence n°4

### AC-4: Départage (Étape D)
- [ ] En cas de conflit (plusieurs élèves pour la dernière place d'une maison) → score brut le plus élevé gagne
- [ ] Les perdants sont reassignés via étape C sur les maisons restantes

### AC-5: Contraintes d'effectif
- [ ] Effectif cible = ceil(nb_élèves / 4)
- [ ] Effectif max = floor(effectif_cible × 1.15)
- [ ] Aucune maison ne dépasse l'effectif max (sauf override manuel)

### AC-6: Déclenchement et résultat
- [ ] Bouton "Lancer la répartition" dans le dashboard enseignante (story 10-4)
- [ ] Affichage du résultat avant validation : liste par maison avec scores
- [ ] Confirmation requise avant écriture en BDD
- [ ] Possibilité de relancer (écrase les affectations non-override)

### AC-7: Override manuel
- [ ] L'enseignante peut réaffecter manuellement n'importe quel élève
- [ ] Override = true, bypass du quota
- [ ] Les overrides ne sont pas écrasés par une relance de l'algorithme

## Tâches d'implémentation

### Task 1: Fonction de calcul des scores
- [ ] 1.1 RPC `calculate_academy_scores(p_class_id UUID)` ou query côté client
- [ ] 1.2 Jointure academy_responses × academy_answers pour scores
- [ ] 1.3 Jointure academy_preferences pour préférences
- [ ] 1.4 Retourne [{student_id, scores: {salamandre, vouivre, zephyr, taisson}, preferences: [1,2,3,4]}]

### Task 2: Algorithme de répartition
- [ ] 2.1 Module `gestion-classe-web/src/lib/sortingAlgorithm.ts`
- [ ] 2.2 Étape A : calcul scores bruts
- [ ] 2.3 Étape B : affectation prioritaire
- [ ] 2.4 Étape C : compromis score × préférence
- [ ] 2.5 Étape D : départage par score brut
- [ ] 2.6 Validation des quotas à chaque étape
- [ ] 2.7 Gestion des élèves avec override (exclus de l'algo)

### Task 3: Écriture des résultats
- [ ] 3.1 Upsert dans academy_assignments (student_id, class_id, house, assigned_by='algorithm')
- [ ] 3.2 Ne pas écraser les override=true
- [ ] 3.3 Transaction atomique

## Notes techniques
- Algo exécuté côté client (navigateur) pour preview avant validation
- Les scores bruts sont recalculés à chaque lancement (pas de cache)
- Max ~35 élèves par classe → performance non critique
