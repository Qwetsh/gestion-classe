"""Tests de la lecture des fichiers de cahier de texte (sans réseau). Lancer : python -I test_gc_cahier.py"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gc_envoi as e  # noqa: E402

TEXTE = 'Thème — Séquence 1, séance 2 : titre\n\nTRAVAIL EFFECTUÉ EN CLASSE\nLes élèves ont travaillé.\n\nCOMPÉTENCES TRAVAILLÉES\n- Une compétence (domaine D4)'


class LectureFichier(unittest.TestCase):
    def setUp(self):
        self.dossier = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.dossier)

    def ecrire(self, nom, contenu, encodage='utf-8'):
        chemin = os.path.join(self.dossier, nom)
        with open(chemin, 'w', encoding=encodage, newline='') as f:
            f.write(contenu)
        return chemin

    def test_date_heure_classe_lues_dans_le_nom(self):
        chemin = self.ecrire('2026-11-23 11h15 4B — Activité 2.txt',
                             'Date : lundi 23/11/2026 11h15\nClasse : 4B\nCours : Activité 2\n\n' + TEXTE + '\n')
        self.assertEqual(e.lire_entree_cahier(chemin),
                         {'date': '2026-11-23', 'time': '11:15', 'class_name': '4B', 'content': TEXTE})

    def test_heure_sur_un_chiffre_et_classe_avec_symbole(self):
        chemin = self.ecrire('2026-11-24 8h15 3°EP1 — Correction.txt', 'Date : x\nClasse : y\nCours : z\n' + TEXTE)
        r = e.lire_entree_cahier(chemin)
        self.assertEqual((r['time'], r['class_name']), ('08:15', '3°EP1'))

    def test_fins_de_ligne_windows_et_bom(self):
        chemin = self.ecrire('2026-11-23 11h15 4B — A.txt',
                             ('Date : a\nClasse : b\nCours : c\n' + TEXTE + '\n\n').replace('\n', '\r\n'), 'utf-8-sig')
        self.assertEqual(e.lire_entree_cahier(chemin)['content'], TEXTE)

    def test_sans_nom_normalise_les_lignes_d_entete_servent(self):
        chemin = self.ecrire('entree.txt', 'Date : lundi 23/11/2026, 9h05\nClasse : 5D\nCours : Météo\n\n' + TEXTE)
        r = e.lire_entree_cahier(chemin)
        self.assertEqual((r['date'], r['time'], r['class_name']), ('2026-11-23', '09:05', '5D'))

    def test_classe_introuvable_refusee(self):
        chemin = self.ecrire('entree.txt', 'Date : 2026-11-23 9h05\n\n' + TEXTE)
        with self.assertRaises(e.EnvoiRefuse):
            e.lire_entree_cahier(chemin)

    def test_entree_vide_refusee(self):
        chemin = self.ecrire('2026-11-23 11h15 4B — A.txt', 'Date : a\nClasse : b\nCours : c\n\n')
        with self.assertRaises(e.EnvoiRefuse):
            e.lire_entree_cahier(chemin)

    def test_dossier_seulement_les_txt_dans_l_ordre(self):
        self.ecrire('2026-11-24 8h15 4B — B.txt', TEXTE)
        self.ecrire('2026-11-23 11h15 4B — A.txt', TEXTE)
        self.ecrire('notes.docx', 'x')
        self.assertEqual([os.path.basename(c) for c in e._fichiers_cahier(self.dossier)],
                         ['2026-11-23 11h15 4B — A.txt', '2026-11-24 8h15 4B — B.txt'])


if __name__ == '__main__':
    unittest.main()
