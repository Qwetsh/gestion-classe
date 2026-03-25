export interface FrenchTerm {
  word: string;
  definition: string;
  theme: string;
}

export const FRENCH_THEMES = [
  'Figures de style',
  'Classes grammaticales',
  'Analyse littéraire',
  'Vocabulaire du récit',
  'Vocabulaire du théâtre',
  'Vocabulaire de la poésie',
  'Vocabulaire de l\'argumentation',
  'Types et genres littéraires',
  'Conjugaison et temps',
  'Vocabulaire des émotions',
] as const;

export type FrenchTheme = (typeof FRENCH_THEMES)[number];

export const FRENCH_VOCABULARY: FrenchTerm[] = [
  // ========================================
  // Figures de style
  // ========================================
  { word: 'METAPHORE', definition: 'Comparaison sans mot outil entre deux éléments', theme: 'Figures de style' },
  { word: 'COMPARAISON', definition: 'Rapprochement de deux éléments avec un mot outil (comme, tel)', theme: 'Figures de style' },
  { word: 'PERSONNIFICATION', definition: 'Attribuer des caractéristiques humaines à un objet ou un animal', theme: 'Figures de style' },
  { word: 'HYPERBOLE', definition: 'Exagération dans l\'expression d\'une idée', theme: 'Figures de style' },
  { word: 'LITOTE', definition: 'Dire moins pour suggérer plus', theme: 'Figures de style' },
  { word: 'EUPHEMISME', definition: 'Atténuer une réalité jugée brutale ou déplaisante', theme: 'Figures de style' },
  { word: 'ANTITHESE', definition: 'Opposition de deux termes ou idées contraires', theme: 'Figures de style' },
  { word: 'OXYMORE', definition: 'Alliance de deux mots de sens contraires', theme: 'Figures de style' },
  { word: 'ANAPHORE', definition: 'Répétition d\'un mot ou groupe de mots en début de phrase', theme: 'Figures de style' },
  { word: 'ENUMERATION', definition: 'Suite de termes appartenant à une même catégorie', theme: 'Figures de style' },
  { word: 'GRADATION', definition: 'Énumération de termes d\'intensité croissante ou décroissante', theme: 'Figures de style' },
  { word: 'ALLEGORIE', definition: 'Représentation concrète d\'une idée abstraite', theme: 'Figures de style' },
  { word: 'METONYMIE', definition: 'Remplacement d\'un mot par un autre ayant un lien logique', theme: 'Figures de style' },
  { word: 'PERIPHRASE', definition: 'Remplacer un mot par une expression plus longue', theme: 'Figures de style' },
  { word: 'IRONIE', definition: 'Dire le contraire de ce que l\'on pense', theme: 'Figures de style' },
  { word: 'CHIASME', definition: 'Croisement de deux expressions en miroir (AB/BA)', theme: 'Figures de style' },
  { word: 'PARALLELISME', definition: 'Répétition d\'une même construction syntaxique', theme: 'Figures de style' },
  { word: 'PLEONASME', definition: 'Emploi de termes superflus exprimant la même idée', theme: 'Figures de style' },
  { word: 'ANTONOMASE', definition: 'Remplacement d\'un nom propre par un nom commun ou inversement', theme: 'Figures de style' },
  { word: 'SYNECDOQUE', definition: 'Désigner le tout par la partie ou inversement', theme: 'Figures de style' },

  // ========================================
  // Classes grammaticales
  // ========================================
  { word: 'NOM', definition: 'Mot désignant un être, une chose ou une idée', theme: 'Classes grammaticales' },
  { word: 'VERBE', definition: 'Mot exprimant une action ou un état', theme: 'Classes grammaticales' },
  { word: 'ADJECTIF', definition: 'Mot qui qualifie ou détermine un nom', theme: 'Classes grammaticales' },
  { word: 'ADVERBE', definition: 'Mot invariable modifiant un verbe, un adjectif ou un autre adverbe', theme: 'Classes grammaticales' },
  { word: 'PRONOM', definition: 'Mot qui remplace un nom ou un groupe nominal', theme: 'Classes grammaticales' },
  { word: 'DETERMINANT', definition: 'Mot placé devant le nom qui le détermine', theme: 'Classes grammaticales' },
  { word: 'PREPOSITION', definition: 'Mot invariable introduisant un complément', theme: 'Classes grammaticales' },
  { word: 'CONJONCTION', definition: 'Mot invariable reliant deux mots ou propositions', theme: 'Classes grammaticales' },
  { word: 'INTERJECTION', definition: 'Mot invariable exprimant une émotion ou un ordre', theme: 'Classes grammaticales' },
  { word: 'SUJET', definition: 'Élément de la phrase qui fait ou subit l\'action du verbe', theme: 'Classes grammaticales' },
  { word: 'ATTRIBUT', definition: 'Mot relié au sujet par un verbe d\'état', theme: 'Classes grammaticales' },
  { word: 'EPITHETE', definition: 'Adjectif directement rattaché au nom qu\'il qualifie', theme: 'Classes grammaticales' },
  { word: 'APPOSITION', definition: 'Mot ou groupe de mots placé à côté du nom pour le caractériser', theme: 'Classes grammaticales' },
  { word: 'COMPLEMENT', definition: 'Mot ou groupe de mots qui complète le sens d\'un autre mot', theme: 'Classes grammaticales' },
  { word: 'PROPOSITION', definition: 'Groupe de mots organisé autour d\'un verbe conjugué', theme: 'Classes grammaticales' },
  { word: 'SUBORDONNEE', definition: 'Proposition qui dépend d\'une autre proposition', theme: 'Classes grammaticales' },
  { word: 'PRINCIPALE', definition: 'Proposition dont dépend une subordonnée', theme: 'Classes grammaticales' },
  { word: 'RELATIVE', definition: 'Subordonnée introduite par un pronom relatif', theme: 'Classes grammaticales' },
  { word: 'ARTICLE', definition: 'Déterminant placé devant un nom (le, un, du)', theme: 'Classes grammaticales' },

  // ========================================
  // Analyse littéraire
  // ========================================
  { word: 'NARRATEUR', definition: 'Celui qui raconte l\'histoire dans un récit', theme: 'Analyse littéraire' },
  { word: 'FOCALISATION', definition: 'Point de vue adopté par le narrateur', theme: 'Analyse littéraire' },
  { word: 'OMNISCIENT', definition: 'Narrateur qui sait tout des personnages et de l\'histoire', theme: 'Analyse littéraire' },
  { word: 'INTERNE', definition: 'Focalisation où l\'on voit à travers les yeux d\'un personnage', theme: 'Analyse littéraire' },
  { word: 'EXTERNE', definition: 'Focalisation où le narrateur se limite à ce qu\'il observe', theme: 'Analyse littéraire' },
  { word: 'PROTAGONISTE', definition: 'Personnage principal d\'un récit', theme: 'Analyse littéraire' },
  { word: 'ANTAGONISTE', definition: 'Personnage qui s\'oppose au héros', theme: 'Analyse littéraire' },
  { word: 'INTRIGUE', definition: 'Enchaînement des événements dans un récit', theme: 'Analyse littéraire' },
  { word: 'DENOUEMENT', definition: 'Résolution finale de l\'intrigue', theme: 'Analyse littéraire' },
  { word: 'QUIPROQUO', definition: 'Malentendu entre des personnages', theme: 'Analyse littéraire' },
  { word: 'SUSPENSE', definition: 'Tension narrative maintenant le lecteur dans l\'attente', theme: 'Analyse littéraire' },
  { word: 'REGISTRE', definition: 'Tonalité dominante d\'un texte (comique, tragique, lyrique)', theme: 'Analyse littéraire' },
  { word: 'CHAMP', definition: 'Ensemble de mots se rapportant à un même thème', theme: 'Analyse littéraire' },
  { word: 'CONNOTATION', definition: 'Sens implicite ou suggéré d\'un mot au-delà de sa définition', theme: 'Analyse littéraire' },
  { word: 'DENOTATION', definition: 'Sens premier et objectif d\'un mot', theme: 'Analyse littéraire' },
  { word: 'IMPLICITE', definition: 'Ce qui est suggéré sans être dit clairement', theme: 'Analyse littéraire' },
  { word: 'EXPLICITE', definition: 'Ce qui est dit clairement et directement', theme: 'Analyse littéraire' },
  { word: 'MORALE', definition: 'Leçon de vie exprimée à la fin d\'une fable ou d\'un conte', theme: 'Analyse littéraire' },

  // ========================================
  // Vocabulaire du récit
  // ========================================
  { word: 'INCIPIT', definition: 'Premières lignes ou premiers mots d\'un récit', theme: 'Vocabulaire du récit' },
  { word: 'EXCIPIT', definition: 'Dernières lignes d\'un récit', theme: 'Vocabulaire du récit' },
  { word: 'EXPOSITION', definition: 'Présentation des personnages et du cadre au début', theme: 'Vocabulaire du récit' },
  { word: 'PERIPETIE', definition: 'Événement inattendu qui modifie le cours de l\'action', theme: 'Vocabulaire du récit' },
  { word: 'CLIMAX', definition: 'Moment de plus forte tension dans le récit', theme: 'Vocabulaire du récit' },
  { word: 'ANALEPSE', definition: 'Retour en arrière dans le récit (flashback)', theme: 'Vocabulaire du récit' },
  { word: 'PROLEPSE', definition: 'Anticipation d\'un événement futur dans le récit', theme: 'Vocabulaire du récit' },
  { word: 'ELLIPSE', definition: 'Passage sous silence d\'une période dans le récit', theme: 'Vocabulaire du récit' },
  { word: 'DIALOGUE', definition: 'Échange de paroles entre des personnages', theme: 'Vocabulaire du récit' },
  { word: 'MONOLOGUE', definition: 'Discours d\'un personnage qui se parle à lui-même', theme: 'Vocabulaire du récit' },
  { word: 'DESCRIPTION', definition: 'Passage détaillant un lieu, un objet ou un personnage', theme: 'Vocabulaire du récit' },
  { word: 'PORTRAIT', definition: 'Description physique et morale d\'un personnage', theme: 'Vocabulaire du récit' },
  { word: 'CADRE', definition: 'Lieu et époque dans lesquels se déroule l\'histoire', theme: 'Vocabulaire du récit' },
  { word: 'CHRONOLOGIE', definition: 'Ordre dans lequel les événements se succèdent', theme: 'Vocabulaire du récit' },
  { word: 'NARRATIF', definition: 'Qui relève de la narration, du récit d\'événements', theme: 'Vocabulaire du récit' },
  { word: 'EPIQUE', definition: 'Qui met en valeur des exploits héroïques et grandioses', theme: 'Vocabulaire du récit' },

  // ========================================
  // Vocabulaire du théâtre
  // ========================================
  { word: 'ACTE', definition: 'Grande division d\'une pièce de théâtre', theme: 'Vocabulaire du théâtre' },
  { word: 'SCENE', definition: 'Subdivision d\'un acte marquée par l\'entrée ou la sortie d\'un personnage', theme: 'Vocabulaire du théâtre' },
  { word: 'REPLIQUE', definition: 'Parole prononcée par un personnage en réponse à un autre', theme: 'Vocabulaire du théâtre' },
  { word: 'TIRADE', definition: 'Longue réplique sans interruption d\'un personnage', theme: 'Vocabulaire du théâtre' },
  { word: 'DIDASCALIE', definition: 'Indication scénique de l\'auteur (gestes, ton, décor)', theme: 'Vocabulaire du théâtre' },
  { word: 'APARTE', definition: 'Parole d\'un personnage que les autres ne sont pas censés entendre', theme: 'Vocabulaire du théâtre' },
  { word: 'SOLILOQUE', definition: 'Discours d\'un personnage seul sur scène', theme: 'Vocabulaire du théâtre' },
  { word: 'TRAGEDIE', definition: 'Pièce mettant en scène des héros confrontés à un destin fatal', theme: 'Vocabulaire du théâtre' },
  { word: 'COMEDIE', definition: 'Pièce visant à faire rire en représentant les défauts humains', theme: 'Vocabulaire du théâtre' },
  { word: 'FARCE', definition: 'Courte pièce comique à gros effets et situations burlesques', theme: 'Vocabulaire du théâtre' },
  { word: 'DRAMATURGE', definition: 'Auteur de pièces de théâtre', theme: 'Vocabulaire du théâtre' },
  { word: 'MISE', definition: 'Ensemble des choix artistiques pour le spectacle sur scène', theme: 'Vocabulaire du théâtre' },
  { word: 'CATHARSIS', definition: 'Purification des passions du spectateur par le spectacle', theme: 'Vocabulaire du théâtre' },
  { word: 'PATHETIQUE', definition: 'Registre visant à émouvoir et à susciter la pitié', theme: 'Vocabulaire du théâtre' },
  { word: 'COMIQUE', definition: 'Registre provoquant le rire par des situations ou des mots', theme: 'Vocabulaire du théâtre' },
  { word: 'TRAGIQUE', definition: 'Registre lié à la fatalité et à l\'impossibilité d\'échapper au destin', theme: 'Vocabulaire du théâtre' },

  // ========================================
  // Vocabulaire de la poésie
  // ========================================
  { word: 'VERS', definition: 'Ligne d\'un poème mesurée par le nombre de syllabes', theme: 'Vocabulaire de la poésie' },
  { word: 'STROPHE', definition: 'Groupe de vers formant une unité dans un poème', theme: 'Vocabulaire de la poésie' },
  { word: 'RIME', definition: 'Répétition d\'un même son à la fin de deux vers', theme: 'Vocabulaire de la poésie' },
  { word: 'ALEXANDRIN', definition: 'Vers de douze syllabes', theme: 'Vocabulaire de la poésie' },
  { word: 'OCTOSYLLABE', definition: 'Vers de huit syllabes', theme: 'Vocabulaire de la poésie' },
  { word: 'DECASYLLABE', definition: 'Vers de dix syllabes', theme: 'Vocabulaire de la poésie' },
  { word: 'SONNET', definition: 'Poème de quatorze vers répartis en deux quatrains et deux tercets', theme: 'Vocabulaire de la poésie' },
  { word: 'QUATRAIN', definition: 'Strophe de quatre vers', theme: 'Vocabulaire de la poésie' },
  { word: 'TERCET', definition: 'Strophe de trois vers', theme: 'Vocabulaire de la poésie' },
  { word: 'DISTIQUE', definition: 'Strophe de deux vers', theme: 'Vocabulaire de la poésie' },
  { word: 'CESURE', definition: 'Pause rythmique à l\'intérieur d\'un vers', theme: 'Vocabulaire de la poésie' },
  { word: 'ENJAMBEMENT', definition: 'Suite d\'une phrase au vers suivant sans pause', theme: 'Vocabulaire de la poésie' },
  { word: 'REJET', definition: 'Mot bref rejeté au début du vers suivant', theme: 'Vocabulaire de la poésie' },
  { word: 'ALLITERATION', definition: 'Répétition d\'un même son consonne dans un vers', theme: 'Vocabulaire de la poésie' },
  { word: 'ASSONANCE', definition: 'Répétition d\'un même son voyelle dans un vers', theme: 'Vocabulaire de la poésie' },
  { word: 'LYRIQUE', definition: 'Registre exprimant des sentiments personnels avec musicalité', theme: 'Vocabulaire de la poésie' },
  { word: 'ELEGIE', definition: 'Poème exprimant la mélancolie ou le deuil', theme: 'Vocabulaire de la poésie' },
  { word: 'ODE', definition: 'Poème lyrique célébrant un sujet élevé', theme: 'Vocabulaire de la poésie' },

  // ========================================
  // Vocabulaire de l'argumentation
  // ========================================
  { word: 'THESE', definition: 'Idée principale défendue par un auteur', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'ARGUMENT', definition: 'Raison avancée pour défendre une thèse', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'EXEMPLE', definition: 'Fait concret illustrant un argument', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'REFUTATION', definition: 'Rejet d\'un argument adverse par la démonstration', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'CONCESSION', definition: 'Accepter partiellement un argument adverse avant de le nuancer', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'CONNECTEUR', definition: 'Mot de liaison organisant le raisonnement', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'DEDUCTIF', definition: 'Raisonnement allant du général au particulier', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'INDUCTIF', definition: 'Raisonnement allant du particulier au général', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'PERSUADER', definition: 'Convaincre en faisant appel aux émotions', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'CONVAINCRE', definition: 'Amener quelqu\'un à adhérer par la raison', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'DELIBERER', definition: 'Peser le pour et le contre avant de décider', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'RHETORIQUE', definition: 'Art de bien parler et de persuader', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'SYLLOGISME', definition: 'Raisonnement logique en trois propositions', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'PARADOXE', definition: 'Idée contraire à l\'opinion commune', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'POLEMIQUE', definition: 'Débat vif et agressif autour d\'une question', theme: 'Vocabulaire de l\'argumentation' },
  { word: 'SATIRIQUE', definition: 'Qui critique en se moquant des défauts de la société', theme: 'Vocabulaire de l\'argumentation' },

  // ========================================
  // Types et genres littéraires
  // ========================================
  { word: 'ROMAN', definition: 'Long récit en prose racontant une histoire fictive', theme: 'Types et genres littéraires' },
  { word: 'NOUVELLE', definition: 'Récit court en prose avec un dénouement rapide', theme: 'Types et genres littéraires' },
  { word: 'CONTE', definition: 'Récit imaginaire comportant souvent une morale', theme: 'Types et genres littéraires' },
  { word: 'FABLE', definition: 'Court récit en vers dont les personnages illustrent une morale', theme: 'Types et genres littéraires' },
  { word: 'AUTOBIOGRAPHIE', definition: 'Récit où l\'auteur raconte sa propre vie', theme: 'Types et genres littéraires' },
  { word: 'BIOGRAPHIE', definition: 'Récit de la vie d\'une personne écrit par un autre', theme: 'Types et genres littéraires' },
  { word: 'EPOPEE', definition: 'Long poème racontant les exploits d\'un héros', theme: 'Types et genres littéraires' },
  { word: 'UTOPIE', definition: 'Récit décrivant une société idéale imaginaire', theme: 'Types et genres littéraires' },
  { word: 'DYSTOPIE', definition: 'Récit décrivant une société imaginaire oppressive', theme: 'Types et genres littéraires' },
  { word: 'FANTASTIQUE', definition: 'Genre où le surnaturel fait irruption dans le réel', theme: 'Types et genres littéraires' },
  { word: 'MERVEILLEUX', definition: 'Genre où le surnaturel est accepté sans question', theme: 'Types et genres littéraires' },
  { word: 'REALISME', definition: 'Courant cherchant à représenter la réalité telle qu\'elle est', theme: 'Types et genres littéraires' },
  { word: 'NATURALISME', definition: 'Courant poussant le réalisme par une approche scientifique', theme: 'Types et genres littéraires' },
  { word: 'ROMANTISME', definition: 'Courant valorisant les sentiments et la nature', theme: 'Types et genres littéraires' },
  { word: 'CLASSICISME', definition: 'Courant prônant l\'ordre, la mesure et l\'imitation des Anciens', theme: 'Types et genres littéraires' },
  { word: 'PAMPHLET', definition: 'Texte court et violent critiquant une personne ou une institution', theme: 'Types et genres littéraires' },
  { word: 'EPISTOLAIRE', definition: 'Genre littéraire composé de lettres', theme: 'Types et genres littéraires' },

  // ========================================
  // Conjugaison et temps
  // ========================================
  { word: 'INFINITIF', definition: 'Forme non conjuguée du verbe', theme: 'Conjugaison et temps' },
  { word: 'PARTICIPE', definition: 'Forme du verbe pouvant servir d\'adjectif', theme: 'Conjugaison et temps' },
  { word: 'GERONDIF', definition: 'Forme en -ant précédée de "en" exprimant la simultanéité', theme: 'Conjugaison et temps' },
  { word: 'INDICATIF', definition: 'Mode exprimant des faits réels et certains', theme: 'Conjugaison et temps' },
  { word: 'SUBJONCTIF', definition: 'Mode exprimant le souhait, le doute ou la possibilité', theme: 'Conjugaison et temps' },
  { word: 'CONDITIONNEL', definition: 'Mode exprimant une action soumise à une condition', theme: 'Conjugaison et temps' },
  { word: 'IMPERATIF', definition: 'Mode exprimant un ordre ou un conseil', theme: 'Conjugaison et temps' },
  { word: 'IMPARFAIT', definition: 'Temps du passé exprimant une action en cours ou habituelle', theme: 'Conjugaison et temps' },
  { word: 'PASSE', definition: 'Temps du passé exprimant une action achevée et limitée', theme: 'Conjugaison et temps' },
  { word: 'FUTUR', definition: 'Temps exprimant une action à venir', theme: 'Conjugaison et temps' },
  { word: 'PRESENT', definition: 'Temps exprimant une action en cours au moment où l\'on parle', theme: 'Conjugaison et temps' },
  { word: 'AUXILIAIRE', definition: 'Verbe (être ou avoir) servant à former les temps composés', theme: 'Conjugaison et temps' },
  { word: 'TRANSITIF', definition: 'Verbe qui admet un complément d\'objet', theme: 'Conjugaison et temps' },
  { word: 'INTRANSITIF', definition: 'Verbe qui n\'admet pas de complément d\'objet', theme: 'Conjugaison et temps' },
  { word: 'PRONOMINAL', definition: 'Verbe accompagné d\'un pronom réfléchi (se laver)', theme: 'Conjugaison et temps' },
  { word: 'VOIX', definition: 'Forme du verbe indiquant si le sujet fait ou subit l\'action', theme: 'Conjugaison et temps' },

  // ========================================
  // Vocabulaire des émotions
  // ========================================
  { word: 'PATHOS', definition: 'Appel aux émotions du lecteur ou du spectateur', theme: 'Vocabulaire des émotions' },
  { word: 'MELANCOLIE', definition: 'Tristesse vague et profonde sans cause précise', theme: 'Vocabulaire des émotions' },
  { word: 'NOSTALGIE', definition: 'Regret attendri d\'un passé révolu', theme: 'Vocabulaire des émotions' },
  { word: 'EMPATHIE', definition: 'Capacité à ressentir les émotions d\'autrui', theme: 'Vocabulaire des émotions' },
  { word: 'COMPASSION', definition: 'Sentiment de pitié poussant à aider autrui', theme: 'Vocabulaire des émotions' },
  { word: 'INDIGNATION', definition: 'Colère provoquée par une injustice', theme: 'Vocabulaire des émotions' },
  { word: 'STUPEUR', definition: 'Étonnement si fort qu\'il paralyse', theme: 'Vocabulaire des émotions' },
  { word: 'EFFROI', definition: 'Peur très vive et soudaine', theme: 'Vocabulaire des émotions' },
  { word: 'ANGOISSE', definition: 'Inquiétude profonde liée à un danger imprécis', theme: 'Vocabulaire des émotions' },
  { word: 'EUPHORIE', definition: 'Sentiment intense de bonheur et d\'excitation', theme: 'Vocabulaire des émotions' },
  { word: 'RESSENTIMENT', definition: 'Amertume durable causée par une offense', theme: 'Vocabulaire des émotions' },
  { word: 'DEDAIN', definition: 'Mépris affiché envers quelqu\'un ou quelque chose', theme: 'Vocabulaire des émotions' },
  { word: 'AFFLICTION', definition: 'Douleur morale profonde', theme: 'Vocabulaire des émotions' },
  { word: 'ALLÉGRESSE', definition: 'Joie très vive et communicative', theme: 'Vocabulaire des émotions' },
  { word: 'AMERTUME', definition: 'Sentiment mêlé de déception et de tristesse', theme: 'Vocabulaire des émotions' },
  { word: 'ÉMOI', definition: 'Trouble affectif intense', theme: 'Vocabulaire des émotions' },
];
