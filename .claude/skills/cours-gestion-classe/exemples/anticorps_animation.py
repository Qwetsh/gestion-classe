"""Animation « Comment les anticorps nous défendent-ils ? » (3e, séquence 2, activité 2).

Exemple complet d'une animation de tableau : les textes des étapes ici, le dessin dans
`anticorps_scene.js`, les dessins réutilisables dans `animation/banque/immunite.js`.

    python anticorps_animation.py <sortie.html> [dossier des images de contrôle]
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))
import gc_animation as ga  # noqa: E402

TITRE = 'Comment les anticorps nous défendent-ils ?'

ETAPES = [
    ga.etape('intro', 'Comment les anticorps nous défendent-ils ?',
             'Le sang de Mme Amalle contient des <b>anticorps</b> contre le virus d\'Epstein-Barr. '
             'D\'où viennent-ils, et à quoi servent-ils ?'),
    ga.etape('entree', 'Un virus entre dans l\'organisme',
             'Le virus d\'Epstein-Barr entre par la bouche. À sa surface, il porte des molécules de forme '
             'particulière : les <b>antigènes</b>.'),
    ga.etape('multiplication', 'Le virus se multiplie dans les cellules',
             'Le virus entre dans des cellules et s\'y <b>multiplie</b>. Les nouveaux virus sortent et infectent '
             'd\'autres cellules : l\'infection s\'étend.'),
    ga.etape('reconnaissance', 'Un lymphocyte B reconnaît l\'antigène',
             'Chaque <b>lymphocyte B</b> reconnaît <b>une seule forme</b> d\'antigène. Seul celui dont la forme '
             'correspond à l\'antigène du virus est activé.'),
    ga.etape('clones', 'Le lymphocyte B activé se multiplie',
             'Le lymphocyte B activé se <b>multiplie</b> dans les ganglions, qui <b>gonflent</b>. '
             'Cela prend <b>plusieurs jours</b> : c\'est une réaction lente.'),
    ga.etape('production', 'Les lymphocytes B produisent des anticorps',
             'Les lymphocytes B libèrent des <b>anticorps</b> dans le sang. Tous ont la même forme : '
             'celle qui est <b>complémentaire</b> de l\'antigène du virus.'),
    ga.etape('fixation', 'Les anticorps se fixent sur les antigènes',
             'Chaque anticorps se fixe sur l\'antigène de forme complémentaire : c\'est le <b>complexe '
             'antigène-anticorps</b>. L\'anticorps est <b>spécifique</b> : il ignore les autres virus.'),
    ga.etape('neutralisation', 'Le virus est neutralisé',
             'Couvert d\'anticorps, le virus ne peut plus entrer dans les cellules : il est <b>neutralisé</b>.'),
    ga.etape('phagocytose', 'Le complexe est éliminé par phagocytose',
             'Un phagocyte élimine le complexe antigène-anticorps par <b>phagocytose</b> : adhésion, ingestion, '
             'digestion, rejet des déchets.'),
    ga.etape('bilan', 'Bilan',
             'Un anticorps est spécifique. Les rechercher dans le sang montre quel micro-organisme on a '
             'rencontré : chez Mme Amalle, le virus d\'Epstein-Barr (mononucléose).', bilan=True),
]


def code():
    with open(os.path.join(ICI, 'anticorps_scene.js'), encoding='utf-8') as f:
        scene = f.read()
    return ga.assembler(TITRE, ETAPES, scene, banques=['immunite'])


if __name__ == '__main__':
    sortie = sys.argv[1]
    ga.ecrire(code(), sortie)
    print('écrit', sortie, len(code()), 'caractères')
    if len(sys.argv) > 2:
        # Une image par étape, figée vers la fin : c'est là que les étiquettes sont toutes visibles
        instants = [3.5, 6.5, 7.5, 9.5, 7.5, 8.5, 9.5, 6.5, 4.5, 6.5]
        for i, t in enumerate(instants, 1):
            ga.apercu(sortie, os.path.join(sys.argv[2], 'etape-%02d.png' % i), etape=i, instant=t)
        print('images dans', sys.argv[2])
