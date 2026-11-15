"""Tests du générateur d'écrans (sans réseau). Lancer : python -I test_gc_ecrans.py"""
import os
import re
import sys
import unittest

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ICI)
import gc_ecrans as g  # noqa: E402

LIBRARY_TS = os.path.join(ICI, '..', '..', '..', 'gestion-classe-web', 'src', 'lib', 'boardLibrary.ts')


def objets(page):
    return {o['id']: o for o in page['objects']}


class Dessins(unittest.TestCase):
    @unittest.skipUnless(os.path.exists(LIBRARY_TS), 'boardLibrary.ts absent')
    def test_la_liste_suit_celle_de_l_application(self):
        with open(LIBRARY_TS, encoding='utf8') as f:
            ts = f.read()
        app = {m.group(1): float(m.group(2)) for m in
               re.finditer(r"\{ id: '([a-z0-9-]+)', label: '(?:[^'\\]|\\.)*', category: '[a-z]+', ratio: ([0-9.]+)", ts)}
        self.assertTrue(app, 'aucun dessin lu dans boardLibrary.ts')
        self.assertEqual(set(app), set(g.DESSINS))
        for k, ratio in app.items():
            self.assertAlmostEqual(ratio, g.DESSINS[k][0], msg=k)

    def test_hauteur_tiree_du_ratio(self):
        e = g.Ecrans('t')
        o = e.ecran().dessin('neuron', 0, 0, 300)
        self.assertEqual(o['h'], 150)


class Suivant(unittest.TestCase):
    def test_chaine_de_boutons(self):
        e = g.Ecrans('t')
        p = e.ecran('Essai')
        a, b = p.texte(60, 120, 300, 24, 'A'), p.texte(60, 200, 300, 24, 'B')
        p.cacher(a, b)
        boutons = p.suivant(700, 480, [[g.Afficher(a)], [g.Afficher(b)]])
        rejouer = p.objets[-1]
        self.assertEqual(len(boutons), 2)
        self.assertNotIn('hidden', boutons[0])
        self.assertTrue(boutons[1]['hidden'] and rejouer['hidden'])
        self.assertEqual(boutons[0]['interactions'],
                         [g.Afficher(a), g.Masquer(boutons[0]), g.Afficher(boutons[1])])
        self.assertEqual(boutons[1]['interactions'],
                         [g.Afficher(b), g.Masquer(boutons[1]), g.Afficher(rejouer)])
        self.assertEqual(rejouer['interactions'], [g.Reinitialiser()])

    def test_sans_rejouer_le_dernier_se_cache_seulement(self):
        e = g.Ecrans('t')
        p = e.ecran()
        x = p.texte(60, 120, 300, 24, 'X')
        (seul,) = p.suivant(700, 480, [[g.Afficher(x)]], rejouer=False)
        self.assertEqual(seul['interactions'], [g.Afficher(x), g.Masquer(seul)])


class Gabarits(unittest.TestCase):
    def test_schema_cache_etiquettes_et_fleches(self):
        e = g.Ecrans('t')
        p = e.schema('Volcan', [('Cratère', (0.5, 0.1)), ('Cheminée', (0.5, 0.5)), ('Réservoir', (0.5, 0.95))], dessin='volcano')
        caches = [o for o in p.objets if o.get('hidden') and o['type'] in ('text', 'connector')]
        self.assertEqual(len(caches), 6)
        labels = sorted(o['y'] for o in p.objets if o['type'] == 'text' and o.get('hidden'))
        self.assertTrue(all(b - a >= 62 for a, b in zip(labels, labels[1:])), labels)
        self.assertLessEqual(labels[-1], 425)
        self.assertEqual(e.alertes, [])

    def test_sommaire_range_et_vise_les_ecrans(self):
        e = g.Ecrans('t')
        e.titre('S', 'A', 'Titre')
        q = e.question('Q1', 'Énoncé', [(None, 'Réponse')])
        e.sommaire('Aller à', [('Q1', q)], position=1)
        self.assertEqual([p['id'] for p in e.pages], ['t-01', 't-03', 't-02'])
        boutons = [o for o in e.pages[1]['objects'] if o.get('interactions')]
        self.assertEqual(boutons[0]['interactions'], [g.AllerA('t-02')])

    def test_vrai_faux_et_qcm(self):
        e = g.Ecrans('t')
        vf = e.vrai_faux('VF', [('Les plaques flottent sur du magma.', False, 'L’asthénosphère est solide.')])
        self.assertEqual(sum(1 for o in vf.objets if o.get('hidden')), 2)
        q = e.qcm('Q', 'Pourquoi ?', ['a', 'b', 'c'], bonne=2)
        marques = [o for o in q.objets if o['type'] == 'library']
        self.assertEqual([m['item'] for m in marques], ['cross', 'cross', 'check'])
        self.assertTrue(all(m.get('hidden') for m in marques))

    def test_identifiants_uniques(self):
        sys.path.insert(0, os.path.join(ICI, 'exemples'))
        import interactifs_4e as ex  # noqa: E402
        ids = [o['id'] for p in ex.e.pages for o in p['objects']]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(ex.e.alertes, [])


if __name__ == '__main__':
    unittest.main()
