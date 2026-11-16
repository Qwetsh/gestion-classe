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


class Typographie(unittest.TestCase):
    N = g.INSECABLE

    def test_nombres_et_unites(self):
        self.assertEqual(g.typo('3 × 130 000 000 = 390 000 000 cm'),
                         '3 × 130' + self.N + '000' + self.N + '000 = 390' + self.N + '000' + self.N + '000' + self.N + 'cm')
        self.assertEqual(g.typo('1,5 pt'), '1,5' + self.N + 'pt')
        self.assertEqual(g.typo('il y a 2 mois'), 'il y a 2 mois')        # « m » seul, pas « mois »
        self.assertEqual(g.typo('en 1912 les'), 'en 1912 les')
        self.assertEqual(g.typo('(− 400 à − 350 Ma)'), '(−' + self.N + '400 à −' + self.N + '350' + self.N + 'Ma)')

    def test_ponctuation_et_guillemets(self):
        self.assertEqual(g.typo('<b>Problématique</b> : pourquoi ?'),
                         '<b>Problématique</b>' + self.N + ':' + ' pourquoi' + self.N + '?')
        self.assertEqual(g.typo('« Ça »'), '«' + self.N + 'Ça' + self.N + '»')

    def test_les_balises_ne_sont_pas_touchees(self):
        html = '<span style="color: #C00000; font-size: 0.6em">1 pt</span>'
        self.assertEqual(g.typo(html), '<span style="color: #C00000; font-size: 0.6em">1' + self.N + 'pt</span>')

    def test_ecrire_pose_les_insecables_partout(self):
        import json
        import tempfile
        e = g.Ecrans('t')
        x = e.ecran('Pourquoi ?')
        x.reponse(60, 120, 400, 24, '130 000 km')
        chemin = os.path.join(tempfile.mkdtemp(), 'e.json')
        e.ecrire(chemin)
        with open(chemin, encoding='utf8') as f:
            texte = json.load(f)[0]
        htmls = [o['html'] for o in texte['objects'] if o['type'] == 'text']
        self.assertIn('Pourquoi' + self.N + '?', htmls[0])
        self.assertIn('130' + self.N + '000' + self.N + 'km', htmls[1])
        self.assertNotIn(self.N, x.objets[1]['html'])                     # les objets en mémoire restent tels quels


class Animation(unittest.TestCase):
    """Objet « animation » du tableau : code assemblé par gc_animation, piloté par trois boutons."""

    @classmethod
    def setUpClass(cls):
        sys.path.insert(0, os.path.join(ICI, 'exemples'))
        import anticorps_animation
        import gc_animation
        cls.ga = gc_animation
        cls.exemple = anticorps_animation
        cls.code = anticorps_animation.code()

    def test_le_code_est_autonome_et_annonce_ses_etapes(self):
        etapes = self.ga.etapes_de(self.code)
        self.assertEqual([e['id'] for e in etapes], [e['id'] for e in self.exemple.ETAPES])
        self.assertEqual(len(etapes), 10)
        self.assertLess(len(self.code), self.ga.CODE_MAX)
        self.assertNotRegex(self.code, r'__[A-Z]+__')                      # plus aucun repère du gabarit
        self.assertNotRegex(self.code, r'(?:src|href)\s*=\s*["\']?\s*(?:https?:)?//')
        self.assertEqual(etapes[-1]['color'], '#C00000')                   # un bilan s'écrit en rouge

    def test_refuse_une_etape_que_la_scene_ne_dessine_pas(self):
        with self.assertRaises(self.ga.AnimationRefusee):
            self.ga.assembler('T', [self.ga.etape('absente', 'Titre', 'Légende')], 'GC.play({ autre: { dur: 3, draw(t) { return ""; } } });')
        with self.assertRaises(self.ga.AnimationRefusee):
            self.ga.assembler('T', [], 'GC.play({});')
        with self.assertRaises(self.ga.AnimationRefusee):
            self.ga.assembler('T', [self.ga.etape('a', 'T', 'L'), self.ga.etape('a', 'T', 'L')], 'GC.play({ a: { dur: 1, draw() { return ""; } } });')

    def test_un_ecran_entier_avec_ses_trois_boutons(self):
        e = g.Ecrans('ani', 'Activité 2 · Mme Eve Amalle')
        x = e.animation(self.code, titre='Les anticorps')
        anim = x.objets[0]
        self.assertEqual((anim['type'], anim['x'], anim['y'], anim['w'], anim['h']), ('animation', 20, 8, 960, 506))
        self.assertEqual([o['type'] for o in x.objets], ['animation', 'shape', 'shape', 'shape'])   # ni en-tête ni titre
        actions = [o['interactions'][0] for o in x.objets[1:]]
        self.assertEqual([a['action'] for a in actions], ['stepPrev', 'replay', 'stepNext'])
        self.assertTrue(all(a['targetId'] == anim['id'] for a in actions))
        self.assertLessEqual(max(o['y'] + o['h'] for o in x.objets), g.PAGE_H)
        self.assertEqual(e.alertes, [])
        self.assertNotIn('imagePath', anim)
        y = e.animation(self.code, affiche='u/import/affiche.png')
        self.assertEqual(y.objets[0]['imagePath'], 'u/import/affiche.png')

    def test_ecrire_ne_touche_pas_au_code(self):
        import json
        import tempfile
        e = g.Ecrans('ani')
        e.animation(self.code)
        chemin = os.path.join(tempfile.mkdtemp(), 'e.json')
        e.ecrire(chemin)
        with open(chemin, encoding='utf8') as f:
            self.assertEqual(json.load(f)[0]['objects'][0]['code'], self.code)


if __name__ == '__main__':
    unittest.main()
