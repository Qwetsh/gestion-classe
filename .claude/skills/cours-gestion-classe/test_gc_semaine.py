"""Tests du plan de gc_semaine (sans réseau). Lancer : python -I test_gc_semaine.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gc_semaine as s  # noqa: E402

ACT, COR, AUTRE = 'act-original', 'cor-original', 'autre-original'


def cours(jour, classe, groupe=None, place=None, titre='Autre document', heure=8):
    return {'starts_at': '2026-11-%02dT%02d:15:00+00:00' % (jour, heure), 'ends_at': '2026-11-%02dT%02d:10:00+00:00' % (jour, heure + 1),
            'label': classe + (('P' + groupe[-1]) if groupe else ''), 'class_id': 'id-' + classe, 'class_name': classe,
            'group_id': ('g-' + classe + groupe) if groupe else None, 'group_name': groupe,
            'placed': {'board_id': 'copie', 'title': titre, 'source_board_id': place} if place else None}


class Plan(unittest.TestCase):
    def test_activite_puis_correction_sur_les_deux_prochains_cours(self):
        lignes = s.proposer([cours(16, '4C'), cours(17, '4C'), cours(23, '4C')], '4C', ACT, COR)
        self.assertEqual([(l['role'], l['etat'], l['lecon']['starts_at'][:10]) for l in lignes],
                         [('activité', s.A_PLACER, '2026-11-16'), ('correction', s.A_PLACER, '2026-11-17')])

    def test_relancer_ne_cree_pas_de_doublon(self):
        lignes = s.proposer([cours(16, '4C', place=ACT), cours(17, '4C', place=COR)], '4C', ACT, COR)
        self.assertEqual([l['etat'] for l in lignes], [s.DEJA, s.DEJA])

    def test_un_cours_deja_pris_est_saute_pour_l_activite(self):
        lignes = s.proposer([cours(16, '4C', place=AUTRE), cours(17, '4C'), cours(18, '4C')], '4C', ACT, COR)
        self.assertEqual(lignes[0]['lecon']['starts_at'][:10], '2026-11-17')
        self.assertIn('1 cours déjà pris avant', lignes[0]['remarque'])
        self.assertEqual(lignes[1]['lecon']['starts_at'][:10], '2026-11-18')

    def test_la_correction_n_ecrase_jamais_un_cours_pris(self):
        lignes = s.proposer([cours(16, '4C'), cours(17, '4C', place=AUTRE, titre='Évaluation')], '4C', ACT, COR)
        self.assertEqual(lignes[1]['etat'], s.OCCUPE)
        self.assertEqual(lignes[1]['occupant'], 'Évaluation')

    def test_un_niveau_designe_toutes_ses_classes(self):
        lecons = [cours(16, '4A'), cours(16, '4B', heure=10), cours(16, '3A', heure=13)]
        self.assertEqual(sorted(l['piste'] for l in s.proposer(lecons, '4e', ACT)), ['4A', '4B'])

    def test_classe_inconnue(self):
        lignes = s.proposer([cours(16, '4A')], '4Z', ACT)
        self.assertEqual((lignes[0]['piste'], lignes[0]['etat']), ('4Z', s.AUCUN))

    def test_demi_groupes(self):
        lecons = [cours(16, '3A'), cours(17, '3A', 'Groupe 1'), cours(18, '3A', 'Groupe 2')]
        # Par défaut : la classe entière, les demi-groupes sont signalés
        lignes = s.proposer(lecons, '3A', ACT)
        self.assertEqual([l['piste'] for l in lignes], ['3A'])
        self.assertIn('demi-groupes', lignes[0]['remarque'])
        # --groupes : une copie par demi-groupe
        lignes = s.proposer(lecons, '3A', ACT, groupes=True)
        self.assertEqual([l['piste'] for l in lignes], ['3A · Groupe 1', '3A · Groupe 2'])

    def test_apres_une_date(self):
        lignes = s.proposer([cours(16, '4C'), cours(23, '4C')], '4C', ACT, apres=s.date_de('2026-11-20T00:00:00+00:00'))
        self.assertEqual(lignes[0]['lecon']['starts_at'][:10], '2026-11-23')

    def test_envoyer_met_a_jour_les_etats(self):
        lignes = s.proposer([cours(16, '4C'), cours(17, '4C')], '4C', ACT, COR)
        appels = []

        def poser(original, liste):
            appels.append((original, len(liste)))
            statut = 'placed' if original == ACT else 'occupied'
            return [{'starts_at': c['starts_at'].replace('+00:00', '.000Z'), 'label': c['label'], 'status': statut,
                     'board_id': 'nouvelle', 'title': 'Pris entre-temps'} for c in liste]

        s.envoyer(lignes, poser)
        self.assertEqual(appels, [(ACT, 1), (COR, 1)])
        self.assertEqual([l['etat'] for l in lignes], [s.PLACE, s.OCCUPE])
        self.assertEqual(lignes[1]['occupant'], 'Pris entre-temps')

    def test_tableau(self):
        lignes = s.proposer([cours(16, '4C')], '4C', ACT)
        texte = s.tableau(lignes, {ACT: 'Activité 3 — Wegener'})
        self.assertIn('| 4C |', texte)
        self.assertIn('Activité 3 — Wegener (activité)', texte)

    def test_tableau_sans_role_en_double(self):
        lignes = s.proposer([cours(16, '4C'), cours(17, '4C')], '4C', ACT, COR)
        texte = s.tableau(lignes, {ACT: 'Wegener', COR: 'Wegener (correction)'})
        self.assertIn('| Wegener (correction) |', texte)
        self.assertNotIn('(correction) (correction)', texte)


if __name__ == '__main__':
    unittest.main()
