export interface MathTerm {
  word: string;
  definition: string;
  theme: string;
}

export const MATH_THEMES = [
  'Nombres et calculs',
  'Algèbre et équations',
  'Géométrie plane',
  'Géométrie dans l\'espace',
  'Grandeurs et mesures',
  'Fonctions',
  'Statistiques et probabilités',
  'Transformations',
  'Trigonométrie',
  'Arithmétique',
] as const;

export type MathTheme = (typeof MATH_THEMES)[number];

export const MATH_VOCABULARY: MathTerm[] = [
  // ========================================
  // Nombres et calculs
  // ========================================
  { word: 'ENTIER', definition: 'Nombre sans virgule, positif, négatif ou nul', theme: 'Nombres et calculs' },
  { word: 'DECIMAL', definition: 'Nombre pouvant s\'écrire avec une partie entière et une partie décimale finie', theme: 'Nombres et calculs' },
  { word: 'FRACTION', definition: 'Écriture d\'un nombre sous forme de numérateur sur dénominateur', theme: 'Nombres et calculs' },
  { word: 'NUMERATEUR', definition: 'Nombre situé au-dessus de la barre de fraction', theme: 'Nombres et calculs' },
  { word: 'DENOMINATEUR', definition: 'Nombre situé au-dessous de la barre de fraction', theme: 'Nombres et calculs' },
  { word: 'INVERSE', definition: 'Nombre qui multiplié par un autre donne un comme résultat', theme: 'Nombres et calculs' },
  { word: 'OPPOSE', definition: 'Nombre de signe contraire tel que leur somme vaut zéro', theme: 'Nombres et calculs' },
  { word: 'RATIONNEL', definition: 'Nombre pouvant s\'écrire sous forme de fraction de deux entiers', theme: 'Nombres et calculs' },
  { word: 'IRRATIONNEL', definition: 'Nombre qui ne peut pas s\'écrire sous forme de fraction', theme: 'Nombres et calculs' },
  { word: 'PUISSANCE', definition: 'Produit d\'un nombre multiplié par lui-même un certain nombre de fois', theme: 'Nombres et calculs' },
  { word: 'RACINE', definition: 'Nombre qui élevé au carré donne le nombre sous le radical', theme: 'Nombres et calculs' },
  { word: 'PRIORITE', definition: 'Règle déterminant l\'ordre dans lequel effectuer les opérations d\'un calcul', theme: 'Nombres et calculs' },
  { word: 'QUOTIENT', definition: 'Résultat d\'une division', theme: 'Nombres et calculs' },
  { word: 'PRODUIT', definition: 'Résultat d\'une multiplication', theme: 'Nombres et calculs' },
  { word: 'SOMME', definition: 'Résultat d\'une addition', theme: 'Nombres et calculs' },
  { word: 'DIFFERENCE', definition: 'Résultat d\'une soustraction', theme: 'Nombres et calculs' },
  { word: 'FACTEUR', definition: 'Chacun des nombres intervenant dans une multiplication', theme: 'Nombres et calculs' },

  // ========================================
  // Algèbre et équations
  // ========================================
  { word: 'EQUATION', definition: 'Égalité contenant une ou plusieurs inconnues à déterminer', theme: 'Algèbre et équations' },
  { word: 'INCONNUE', definition: 'Valeur cherchée dans une équation, souvent notée x', theme: 'Algèbre et équations' },
  { word: 'VARIABLE', definition: 'Lettre représentant un nombre pouvant prendre différentes valeurs', theme: 'Algèbre et équations' },
  { word: 'EXPRESSION', definition: 'Suite d\'opérations portant sur des nombres et des lettres', theme: 'Algèbre et équations' },
  { word: 'DEVELOPPER', definition: 'Transformer un produit en somme en appliquant la distributivité', theme: 'Algèbre et équations' },
  { word: 'FACTORISER', definition: 'Transformer une somme en produit en trouvant un facteur commun', theme: 'Algèbre et équations' },
  { word: 'DISTRIBUTIVITE', definition: 'Propriété permettant de distribuer la multiplication sur l\'addition', theme: 'Algèbre et équations' },
  { word: 'IDENTITE', definition: 'Égalité remarquable vraie pour toutes les valeurs des variables', theme: 'Algèbre et équations' },
  { word: 'INEQUATION', definition: 'Inégalité contenant une inconnue dont on cherche les valeurs solutions', theme: 'Algèbre et équations' },
  { word: 'SYSTEME', definition: 'Ensemble de plusieurs équations à résoudre simultanément', theme: 'Algèbre et équations' },
  { word: 'SOLUTION', definition: 'Valeur de l\'inconnue qui vérifie une équation', theme: 'Algèbre et équations' },
  { word: 'COEFFICIENT', definition: 'Nombre par lequel est multipliée une variable dans une expression', theme: 'Algèbre et équations' },
  { word: 'POLYNOME', definition: 'Expression algébrique composée de sommes de termes avec des puissances entières', theme: 'Algèbre et équations' },
  { word: 'SUBSTITUTION', definition: 'Remplacement d\'une variable par une valeur numérique dans une expression', theme: 'Algèbre et équations' },

  // ========================================
  // Géométrie plane
  // ========================================
  { word: 'DROITE', definition: 'Ligne illimitée formée de points alignés', theme: 'Géométrie plane' },
  { word: 'SEGMENT', definition: 'Portion de droite limitée par deux points', theme: 'Géométrie plane' },
  { word: 'PERPENDICULAIRE', definition: 'Se dit de deux droites qui se coupent en formant un angle droit', theme: 'Géométrie plane' },
  { word: 'PARALLELE', definition: 'Se dit de deux droites qui ne se coupent jamais', theme: 'Géométrie plane' },
  { word: 'MEDIATRICE', definition: 'Droite perpendiculaire à un segment en son milieu', theme: 'Géométrie plane' },
  { word: 'BISSECTRICE', definition: 'Demi-droite qui partage un angle en deux angles égaux', theme: 'Géométrie plane' },
  { word: 'TRIANGLE', definition: 'Polygone à trois côtés et trois sommets', theme: 'Géométrie plane' },
  { word: 'RECTANGLE', definition: 'Quadrilatère ayant quatre angles droits', theme: 'Géométrie plane' },
  { word: 'LOSANGE', definition: 'Quadrilatère ayant quatre côtés de même longueur', theme: 'Géométrie plane' },
  { word: 'PARALLELOGRAMME', definition: 'Quadrilatère dont les côtés opposés sont parallèles et de même longueur', theme: 'Géométrie plane' },
  { word: 'CERCLE', definition: 'Ensemble des points situés à égale distance d\'un point appelé centre', theme: 'Géométrie plane' },
  { word: 'RAYON', definition: 'Distance du centre d\'un cercle à n\'importe quel point du cercle', theme: 'Géométrie plane' },
  { word: 'DIAMETRE', definition: 'Segment passant par le centre d\'un cercle et reliant deux points du cercle', theme: 'Géométrie plane' },
  { word: 'HYPOTENUSE', definition: 'Côté le plus long d\'un triangle rectangle, opposé à l\'angle droit', theme: 'Géométrie plane' },
  { word: 'DIAGONALE', definition: 'Segment reliant deux sommets non consécutifs d\'un polygone', theme: 'Géométrie plane' },
  { word: 'POLYGONE', definition: 'Figure plane fermée formée de segments de droites', theme: 'Géométrie plane' },
  { word: 'PERIMETRE', definition: 'Longueur totale du contour d\'une figure', theme: 'Géométrie plane' },
  { word: 'AIRE', definition: 'Mesure de la surface intérieure d\'une figure plane', theme: 'Géométrie plane' },

  // ========================================
  // Géométrie dans l'espace
  // ========================================
  { word: 'PAVE', definition: 'Solide à six faces rectangulaires, aussi appelé parallélépipède rectangle', theme: 'Géométrie dans l\'espace' },
  { word: 'CUBE', definition: 'Solide à six faces carrées identiques', theme: 'Géométrie dans l\'espace' },
  { word: 'PYRAMIDE', definition: 'Solide dont la base est un polygone et les faces latérales des triangles', theme: 'Géométrie dans l\'espace' },
  { word: 'CONE', definition: 'Solide dont la base est un disque et qui se termine en pointe', theme: 'Géométrie dans l\'espace' },
  { word: 'CYLINDRE', definition: 'Solide avec deux bases circulaires parallèles reliées par une surface courbe', theme: 'Géométrie dans l\'espace' },
  { word: 'SPHERE', definition: 'Ensemble des points de l\'espace situés à égale distance d\'un centre', theme: 'Géométrie dans l\'espace' },
  { word: 'PRISME', definition: 'Solide avec deux bases polygonales identiques et parallèles reliées par des rectangles', theme: 'Géométrie dans l\'espace' },
  { word: 'VOLUME', definition: 'Mesure de l\'espace occupé par un solide', theme: 'Géométrie dans l\'espace' },
  { word: 'ARETE', definition: 'Segment formé par l\'intersection de deux faces d\'un solide', theme: 'Géométrie dans l\'espace' },
  { word: 'SOMMET', definition: 'Point de rencontre de deux ou plusieurs arêtes d\'un solide', theme: 'Géométrie dans l\'espace' },
  { word: 'FACE', definition: 'Surface plane délimitant un solide', theme: 'Géométrie dans l\'espace' },
  { word: 'PATRON', definition: 'Figure plane que l\'on peut plier pour construire un solide', theme: 'Géométrie dans l\'espace' },
  { word: 'SECTION', definition: 'Figure obtenue en coupant un solide par un plan', theme: 'Géométrie dans l\'espace' },

  // ========================================
  // Grandeurs et mesures
  // ========================================
  { word: 'LONGUEUR', definition: 'Mesure de la distance entre deux points', theme: 'Grandeurs et mesures' },
  { word: 'MASSE', definition: 'Grandeur mesurant la quantité de matière d\'un objet', theme: 'Grandeurs et mesures' },
  { word: 'DUREE', definition: 'Mesure du temps écoulé entre deux instants', theme: 'Grandeurs et mesures' },
  { word: 'VITESSE', definition: 'Rapport entre une distance parcourue et le temps mis pour la parcourir', theme: 'Grandeurs et mesures' },
  { word: 'PROPORTIONNALITE', definition: 'Relation entre deux grandeurs dont le rapport est constant', theme: 'Grandeurs et mesures' },
  { word: 'ECHELLE', definition: 'Rapport entre une distance sur un plan et la distance réelle correspondante', theme: 'Grandeurs et mesures' },
  { word: 'POURCENTAGE', definition: 'Proportion exprimée sur cent', theme: 'Grandeurs et mesures' },
  { word: 'CONVERSION', definition: 'Passage d\'une unité de mesure à une autre', theme: 'Grandeurs et mesures' },
  { word: 'CAPACITE', definition: 'Volume maximal de liquide qu\'un récipient peut contenir', theme: 'Grandeurs et mesures' },
  { word: 'ANGLE', definition: 'Figure formée par deux demi-droites de même origine', theme: 'Grandeurs et mesures' },

  // ========================================
  // Fonctions
  // ========================================
  { word: 'FONCTION', definition: 'Relation qui associe à chaque valeur d\'entrée une unique valeur de sortie', theme: 'Fonctions' },
  { word: 'IMAGE', definition: 'Valeur de sortie obtenue par une fonction pour une valeur d\'entrée donnée', theme: 'Fonctions' },
  { word: 'ANTECEDENT', definition: 'Valeur d\'entrée dont l\'image par une fonction est connue', theme: 'Fonctions' },
  { word: 'AFFINE', definition: 'Fonction de la forme f(x) = ax + b représentée par une droite', theme: 'Fonctions' },
  { word: 'LINEAIRE', definition: 'Fonction de la forme f(x) = ax passant par l\'origine', theme: 'Fonctions' },
  { word: 'ORDONNEE', definition: 'Coordonnée verticale d\'un point dans un repère', theme: 'Fonctions' },
  { word: 'ABSCISSE', definition: 'Coordonnée horizontale d\'un point dans un repère', theme: 'Fonctions' },
  { word: 'ORIGINE', definition: 'Point d\'intersection des deux axes dans un repère', theme: 'Fonctions' },
  { word: 'REPERE', definition: 'Système de deux axes gradués permettant de placer des points', theme: 'Fonctions' },
  { word: 'COURBE', definition: 'Représentation graphique d\'une fonction dans un repère', theme: 'Fonctions' },
  { word: 'CROISSANTE', definition: 'Fonction dont les valeurs augmentent quand la variable augmente', theme: 'Fonctions' },
  { word: 'DECROISSANTE', definition: 'Fonction dont les valeurs diminuent quand la variable augmente', theme: 'Fonctions' },
  { word: 'PENTE', definition: 'Coefficient directeur indiquant l\'inclinaison d\'une droite', theme: 'Fonctions' },

  // ========================================
  // Statistiques et probabilités
  // ========================================
  { word: 'MOYENNE', definition: 'Somme des valeurs divisée par le nombre de valeurs', theme: 'Statistiques et probabilités' },
  { word: 'MEDIANE', definition: 'Valeur qui partage une série ordonnée en deux groupes de même effectif', theme: 'Statistiques et probabilités' },
  { word: 'ETENDUE', definition: 'Différence entre la plus grande et la plus petite valeur d\'une série', theme: 'Statistiques et probabilités' },
  { word: 'EFFECTIF', definition: 'Nombre d\'individus ou de valeurs dans une catégorie', theme: 'Statistiques et probabilités' },
  { word: 'FREQUENCE', definition: 'Rapport entre l\'effectif d\'une valeur et l\'effectif total', theme: 'Statistiques et probabilités' },
  { word: 'PROBABILITE', definition: 'Nombre entre zéro et un mesurant la chance qu\'un événement se réalise', theme: 'Statistiques et probabilités' },
  { word: 'EXPERIENCE', definition: 'Action dont le résultat dépend du hasard', theme: 'Statistiques et probabilités' },
  { word: 'EVENEMENT', definition: 'Résultat ou ensemble de résultats possibles d\'une expérience aléatoire', theme: 'Statistiques et probabilités' },
  { word: 'EQUIPROBABLE', definition: 'Se dit d\'événements ayant tous la même probabilité de se produire', theme: 'Statistiques et probabilités' },
  { word: 'DIAGRAMME', definition: 'Représentation graphique de données statistiques', theme: 'Statistiques et probabilités' },
  { word: 'HISTOGRAMME', definition: 'Diagramme en barres représentant la distribution d\'une série de données', theme: 'Statistiques et probabilités' },
  { word: 'QUARTILE', definition: 'Valeur qui sépare une série ordonnée en quatre groupes de même effectif', theme: 'Statistiques et probabilités' },

  // ========================================
  // Transformations
  // ========================================
  { word: 'SYMETRIE', definition: 'Transformation qui associe à chaque point son image par rapport à un axe ou un centre', theme: 'Transformations' },
  { word: 'TRANSLATION', definition: 'Transformation qui déplace chaque point dans la même direction et la même distance', theme: 'Transformations' },
  { word: 'ROTATION', definition: 'Transformation qui tourne chaque point autour d\'un centre selon un angle donné', theme: 'Transformations' },
  { word: 'HOMOTHETIE', definition: 'Transformation qui agrandit ou réduit une figure à partir d\'un centre', theme: 'Transformations' },
  { word: 'THALES', definition: 'Théorème reliant les longueurs de segments coupés par des droites parallèles', theme: 'Transformations' },
  { word: 'AGRANDISSEMENT', definition: 'Transformation qui multiplie toutes les dimensions d\'une figure par un facteur supérieur à un', theme: 'Transformations' },
  { word: 'REDUCTION', definition: 'Transformation qui multiplie toutes les dimensions d\'une figure par un facteur inférieur à un', theme: 'Transformations' },
  { word: 'ISOMETRIE', definition: 'Transformation qui conserve les distances et les angles', theme: 'Transformations' },
  { word: 'SIMILITUDE', definition: 'Transformation qui conserve les angles mais peut modifier les distances', theme: 'Transformations' },

  // ========================================
  // Trigonométrie
  // ========================================
  { word: 'COSINUS', definition: 'Rapport du côté adjacent sur l\'hypoténuse dans un triangle rectangle', theme: 'Trigonométrie' },
  { word: 'SINUS', definition: 'Rapport du côté opposé sur l\'hypoténuse dans un triangle rectangle', theme: 'Trigonométrie' },
  { word: 'TANGENTE', definition: 'Rapport du côté opposé sur le côté adjacent dans un triangle rectangle', theme: 'Trigonométrie' },
  { word: 'ADJACENT', definition: 'Côté du triangle rectangle situé à côté de l\'angle considéré', theme: 'Trigonométrie' },
  { word: 'PYTHAGORE', definition: 'Théorème reliant les carrés des longueurs des côtés d\'un triangle rectangle', theme: 'Trigonométrie' },
  { word: 'RECIPROQUE', definition: 'Théorème inversé qui permet de démontrer qu\'un triangle est rectangle', theme: 'Trigonométrie' },
  { word: 'RADIAN', definition: 'Unité de mesure d\'angle correspondant à un arc égal au rayon', theme: 'Trigonométrie' },

  // ========================================
  // Arithmétique
  // ========================================
  { word: 'DIVISEUR', definition: 'Nombre qui divise un autre nombre sans reste', theme: 'Arithmétique' },
  { word: 'MULTIPLE', definition: 'Nombre obtenu en multipliant un entier par un autre', theme: 'Arithmétique' },
  { word: 'PREMIER', definition: 'Nombre entier supérieur à un divisible uniquement par un et par lui-même', theme: 'Arithmétique' },
  { word: 'PGCD', definition: 'Plus grand nombre qui divise à la fois deux nombres entiers', theme: 'Arithmétique' },
  { word: 'PPCM', definition: 'Plus petit nombre qui est multiple de deux nombres entiers à la fois', theme: 'Arithmétique' },
  { word: 'DECOMPOSITION', definition: 'Écriture d\'un nombre sous forme de produit de facteurs premiers', theme: 'Arithmétique' },
  { word: 'DIVISIBILITE', definition: 'Propriété d\'un nombre d\'être divisé exactement par un autre', theme: 'Arithmétique' },
  { word: 'PARITE', definition: 'Caractère pair ou impair d\'un nombre entier', theme: 'Arithmétique' },
  { word: 'EUCLIDIEN', definition: 'Qualifie la division qui donne un quotient entier et un reste', theme: 'Arithmétique' },
  { word: 'CRITERE', definition: 'Règle permettant de savoir si un nombre est divisible par un autre sans calculer', theme: 'Arithmétique' },
];
