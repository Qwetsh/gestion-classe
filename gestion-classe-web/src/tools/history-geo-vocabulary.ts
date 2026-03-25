export interface HistoryGeoTerm {
  word: string;
  definition: string;
  theme: string;
}

export const HISTORY_GEO_THEMES = [
  'Antiquité',
  'Moyen Âge',
  'Renaissance et Temps modernes',
  'Révolution et Empire',
  'XIXe siècle',
  'Guerres mondiales',
  'Monde contemporain',
  'Habiter le monde',
  'France et Europe',
  'Mondialisation et développement',
] as const;

export type HistoryGeoTheme = (typeof HISTORY_GEO_THEMES)[number];

export const HISTORY_GEO_VOCABULARY: HistoryGeoTerm[] = [
  // ========================================
  // Antiquité
  // ========================================
  { word: 'DEMOCRATIE', definition: 'Régime politique où le pouvoir appartient au peuple', theme: 'Antiquité' },
  { word: 'CITE', definition: 'Ville indépendante avec son propre gouvernement dans la Grèce antique', theme: 'Antiquité' },
  { word: 'POLYTHEISME', definition: 'Croyance en plusieurs dieux', theme: 'Antiquité' },
  { word: 'MONOTHEISME', definition: 'Croyance en un seul dieu', theme: 'Antiquité' },
  { word: 'REPUBLIQUE', definition: 'Régime politique où les dirigeants sont élus par les citoyens', theme: 'Antiquité' },
  { word: 'SENAT', definition: 'Assemblée de notables qui conseille et gouverne dans la Rome antique', theme: 'Antiquité' },
  { word: 'PATRICIEN', definition: 'Membre des familles nobles et privilégiées de Rome', theme: 'Antiquité' },
  { word: 'PLEBIEN', definition: 'Citoyen romain ordinaire, non noble', theme: 'Antiquité' },
  { word: 'AGORA', definition: 'Place publique servant de lieu de réunion dans les cités grecques', theme: 'Antiquité' },
  { word: 'FORUM', definition: 'Place publique au centre de la vie politique et religieuse romaine', theme: 'Antiquité' },
  { word: 'PHARAON', definition: 'Roi d\'Égypte ancienne considéré comme un dieu vivant', theme: 'Antiquité' },
  { word: 'HIEROGLYPHE', definition: 'Écriture sacrée de l\'Égypte ancienne utilisant des dessins', theme: 'Antiquité' },
  { word: 'MYTHOLOGIE', definition: 'Ensemble des récits légendaires sur les dieux et héros d\'une civilisation', theme: 'Antiquité' },
  { word: 'LEGION', definition: 'Unité principale de l\'armée romaine comptant environ 5000 soldats', theme: 'Antiquité' },
  { word: 'EMPIRE', definition: 'Vaste territoire gouverné par un empereur', theme: 'Antiquité' },
  { word: 'AMPHITHEATRE', definition: 'Édifice romain ovale où se déroulaient les combats de gladiateurs', theme: 'Antiquité' },
  { word: 'AQUEDUC', definition: 'Construction romaine servant à transporter l\'eau vers les villes', theme: 'Antiquité' },
  { word: 'NECROPOLE', definition: 'Grand cimetière de l\'Antiquité, littéralement cité des morts', theme: 'Antiquité' },

  // ========================================
  // Moyen Âge
  // ========================================
  { word: 'FEODALITE', definition: 'Système politique fondé sur les liens entre seigneurs et vassaux', theme: 'Moyen Âge' },
  { word: 'VASSAL', definition: 'Homme lié à un seigneur par un serment de fidélité', theme: 'Moyen Âge' },
  { word: 'SUZERAIN', definition: 'Seigneur qui accorde une terre à un vassal en échange de sa fidélité', theme: 'Moyen Âge' },
  { word: 'FIEF', definition: 'Terre accordée par un seigneur à son vassal', theme: 'Moyen Âge' },
  { word: 'SEIGNEURIE', definition: 'Territoire sur lequel un seigneur exerce son autorité', theme: 'Moyen Âge' },
  { word: 'SERF', definition: 'Paysan attaché à la terre de son seigneur sans pouvoir la quitter', theme: 'Moyen Âge' },
  { word: 'CROISADE', definition: 'Expédition militaire chrétienne pour reprendre Jérusalem aux musulmans', theme: 'Moyen Âge' },
  { word: 'CHEVALIER', definition: 'Guerrier noble combattant à cheval au service d\'un seigneur', theme: 'Moyen Âge' },
  { word: 'ADOUBEMENT', definition: 'Cérémonie par laquelle un jeune noble devient chevalier', theme: 'Moyen Âge' },
  { word: 'DONJON', definition: 'Tour principale et fortifiée d\'un château fort', theme: 'Moyen Âge' },
  { word: 'EGLISE', definition: 'Institution religieuse chrétienne dirigée par le pape au Moyen Âge', theme: 'Moyen Âge' },
  { word: 'MONASTERE', definition: 'Lieu de vie d\'une communauté de moines ou de moniales', theme: 'Moyen Âge' },
  { word: 'CLERGE', definition: 'Ensemble des religieux (prêtres, moines, évêques)', theme: 'Moyen Âge' },
  { word: 'CORPORATION', definition: 'Association de métier regroupant artisans et marchands d\'une même profession', theme: 'Moyen Âge' },
  { word: 'CHARTE', definition: 'Document officiel accordant des droits et libertés à une ville', theme: 'Moyen Âge' },
  { word: 'PESTE', definition: 'Épidémie mortelle qui décima un tiers de la population européenne au XIVe siècle', theme: 'Moyen Âge' },
  { word: 'HOMMAGE', definition: 'Cérémonie par laquelle un vassal jure fidélité à son seigneur', theme: 'Moyen Âge' },

  // ========================================
  // Renaissance et Temps modernes
  // ========================================
  { word: 'RENAISSANCE', definition: 'Mouvement culturel et artistique né en Italie aux XVe-XVIe siècles', theme: 'Renaissance et Temps modernes' },
  { word: 'HUMANISME', definition: 'Mouvement intellectuel plaçant l\'homme et la raison au centre de la réflexion', theme: 'Renaissance et Temps modernes' },
  { word: 'REFORME', definition: 'Mouvement religieux du XVIe siècle qui donna naissance au protestantisme', theme: 'Renaissance et Temps modernes' },
  { word: 'PROTESTANTISME', definition: 'Religion chrétienne issue de la Réforme initiée par Luther', theme: 'Renaissance et Temps modernes' },
  { word: 'MONARCHIE', definition: 'Régime politique dirigé par un roi ou une reine', theme: 'Renaissance et Temps modernes' },
  { word: 'ABSOLUTISME', definition: 'Régime où le roi concentre tous les pouvoirs sans contrôle', theme: 'Renaissance et Temps modernes' },
  { word: 'COLONISATION', definition: 'Occupation et exploitation d\'un territoire par une puissance étrangère', theme: 'Renaissance et Temps modernes' },
  { word: 'IMPRIMERIE', definition: 'Invention de Gutenberg permettant la reproduction rapide des textes', theme: 'Renaissance et Temps modernes' },
  { word: 'MECENE', definition: 'Personne fortunée qui finance et protège les artistes', theme: 'Renaissance et Temps modernes' },
  { word: 'PERSPECTIVE', definition: 'Technique artistique permettant de représenter la profondeur sur une surface plane', theme: 'Renaissance et Temps modernes' },
  { word: 'CARAVELLE', definition: 'Navire léger et rapide utilisé pour les grandes explorations maritimes', theme: 'Renaissance et Temps modernes' },
  { word: 'TRAITE', definition: 'Commerce d\'êtres humains réduits en esclavage', theme: 'Renaissance et Temps modernes' },
  { word: 'MERCANTILISME', definition: 'Doctrine économique visant à enrichir l\'État par le commerce et l\'accumulation d\'or', theme: 'Renaissance et Temps modernes' },
  { word: 'PHILOSOPHE', definition: 'Penseur des Lumières prônant la raison et la liberté', theme: 'Renaissance et Temps modernes' },
  { word: 'ENCYCLOPEDIE', definition: 'Ouvrage des Lumières dirigé par Diderot et d\'Alembert rassemblant tout le savoir', theme: 'Renaissance et Temps modernes' },

  // ========================================
  // Révolution et Empire
  // ========================================
  { word: 'REVOLUTION', definition: 'Changement brutal de régime politique et de société', theme: 'Révolution et Empire' },
  { word: 'BASTILLE', definition: 'Prison royale prise d\'assaut le 14 juillet 1789, symbole de la Révolution', theme: 'Révolution et Empire' },
  { word: 'CONSTITUTION', definition: 'Texte fondamental qui organise les pouvoirs d\'un État', theme: 'Révolution et Empire' },
  { word: 'SUFFRAGE', definition: 'Droit de vote des citoyens', theme: 'Révolution et Empire' },
  { word: 'TERREUR', definition: 'Période révolutionnaire de répression violente menée par Robespierre', theme: 'Révolution et Empire' },
  { word: 'GUILLOTINE', definition: 'Instrument d\'exécution utilisé pendant la Révolution française', theme: 'Révolution et Empire' },
  { word: 'SOUVERAINETE', definition: 'Pouvoir suprême exercé par le peuple ou la nation', theme: 'Révolution et Empire' },
  { word: 'CITOYEN', definition: 'Membre d\'un État disposant de droits civiques et politiques', theme: 'Révolution et Empire' },
  { word: 'ABOLITION', definition: 'Suppression officielle d\'une loi ou d\'une pratique comme l\'esclavage', theme: 'Révolution et Empire' },
  { word: 'NAPOLEON', definition: 'Général devenu empereur des Français en 1804', theme: 'Révolution et Empire' },
  { word: 'CONCORDAT', definition: 'Accord entre Napoléon et le pape organisant les rapports Église-État', theme: 'Révolution et Empire' },
  { word: 'PREFET', definition: 'Représentant de l\'État dans un département créé par Napoléon', theme: 'Révolution et Empire' },
  { word: 'ASSIGNAT', definition: 'Papier-monnaie émis pendant la Révolution garanti sur les biens du clergé', theme: 'Révolution et Empire' },
  { word: 'JACOBIN', definition: 'Membre du club politique radical favorable à la République pendant la Révolution', theme: 'Révolution et Empire' },

  // ========================================
  // XIXe siècle
  // ========================================
  { word: 'INDUSTRIALISATION', definition: 'Transformation économique et sociale liée au développement des usines et machines', theme: 'XIXe siècle' },
  { word: 'PROLETARIAT', definition: 'Classe sociale des ouvriers ne possédant que leur force de travail', theme: 'XIXe siècle' },
  { word: 'BOURGEOISIE', definition: 'Classe sociale possédant les moyens de production et le capital', theme: 'XIXe siècle' },
  { word: 'SOCIALISME', definition: 'Doctrine politique visant l\'égalité sociale et la propriété collective', theme: 'XIXe siècle' },
  { word: 'SYNDICALISME', definition: 'Mouvement de défense des droits et intérêts des travailleurs', theme: 'XIXe siècle' },
  { word: 'NATIONALISME', definition: 'Idéologie affirmant la supériorité et les droits d\'une nation', theme: 'XIXe siècle' },
  { word: 'IMPERIALISME', definition: 'Politique de domination d\'un État sur d\'autres territoires', theme: 'XIXe siècle' },
  { word: 'URBANISATION', definition: 'Croissance des villes et concentration de la population en milieu urbain', theme: 'XIXe siècle' },
  { word: 'EXODE', definition: 'Départ massif de populations rurales vers les villes', theme: 'XIXe siècle' },
  { word: 'CAPITALISME', definition: 'Système économique fondé sur la propriété privée et le libre marché', theme: 'XIXe siècle' },
  { word: 'LAICITE', definition: 'Principe de séparation des institutions religieuses et de l\'État', theme: 'XIXe siècle' },
  { word: 'COLONIALISME', definition: 'Politique d\'expansion et d\'exploitation des territoires colonisés', theme: 'XIXe siècle' },
  { word: 'EMIGRATION', definition: 'Départ de personnes quittant leur pays pour s\'installer ailleurs', theme: 'XIXe siècle' },

  // ========================================
  // Guerres mondiales
  // ========================================
  { word: 'TRANCHEE', definition: 'Fossé creusé pour protéger les soldats pendant la Première Guerre mondiale', theme: 'Guerres mondiales' },
  { word: 'ARMISTICE', definition: 'Accord mettant fin aux combats entre belligérants', theme: 'Guerres mondiales' },
  { word: 'GENOCIDE', definition: 'Extermination systématique et organisée d\'un peuple entier', theme: 'Guerres mondiales' },
  { word: 'TOTALITARISME', definition: 'Régime politique où l\'État contrôle tous les aspects de la vie des citoyens', theme: 'Guerres mondiales' },
  { word: 'FASCISME', definition: 'Idéologie autoritaire et nationaliste née en Italie avec Mussolini', theme: 'Guerres mondiales' },
  { word: 'NAZISME', definition: 'Idéologie raciste et totalitaire du parti d\'Hitler en Allemagne', theme: 'Guerres mondiales' },
  { word: 'RESISTANCE', definition: 'Action clandestine menée contre l\'occupation allemande pendant la Seconde Guerre', theme: 'Guerres mondiales' },
  { word: 'COLLABORATION', definition: 'Coopération volontaire avec l\'occupant ennemi', theme: 'Guerres mondiales' },
  { word: 'DEPORTATION', definition: 'Transfert forcé de personnes vers des camps de concentration ou d\'extermination', theme: 'Guerres mondiales' },
  { word: 'PROPAGANDE', definition: 'Diffusion massive d\'idées pour influencer l\'opinion publique', theme: 'Guerres mondiales' },
  { word: 'BLITZKRIEG', definition: 'Guerre éclair menée par l\'Allemagne nazie avec des attaques rapides et massives', theme: 'Guerres mondiales' },
  { word: 'SHOAH', definition: 'Extermination de six millions de Juifs par les nazis', theme: 'Guerres mondiales' },
  { word: 'POILU', definition: 'Surnom donné aux soldats français de la Première Guerre mondiale', theme: 'Guerres mondiales' },
  { word: 'RATIONNEMENT', definition: 'Limitation de la distribution de nourriture et de biens en temps de guerre', theme: 'Guerres mondiales' },
  { word: 'DEBARQUEMENT', definition: 'Opération militaire amphibie, notamment celle du 6 juin 1944 en Normandie', theme: 'Guerres mondiales' },

  // ========================================
  // Monde contemporain
  // ========================================
  { word: 'DECOLONISATION', definition: 'Processus par lequel les colonies accèdent à l\'indépendance', theme: 'Monde contemporain' },
  { word: 'BIPOLARISATION', definition: 'Division du monde en deux blocs opposés pendant la Guerre froide', theme: 'Monde contemporain' },
  { word: 'RIDEAU', definition: 'Frontière symbolique séparant l\'Europe de l\'Ouest et de l\'Est pendant la Guerre froide', theme: 'Monde contemporain' },
  { word: 'DISSUASION', definition: 'Stratégie visant à empêcher l\'ennemi d\'attaquer grâce à la menace nucléaire', theme: 'Monde contemporain' },
  { word: 'CONSTRUCTION', definition: 'Processus d\'unification politique et économique de l\'Europe', theme: 'Monde contemporain' },
  { word: 'TERRORISME', definition: 'Usage de la violence contre des civils pour des motivations politiques ou idéologiques', theme: 'Monde contemporain' },
  { word: 'MONDIALISATION', definition: 'Mise en relation des différentes parties du monde par les échanges économiques et culturels', theme: 'Monde contemporain' },
  { word: 'MULTILATERALISME', definition: 'Coopération entre plusieurs États pour résoudre les problèmes internationaux', theme: 'Monde contemporain' },
  { word: 'REFERENDUM', definition: 'Vote par lequel les citoyens se prononcent directement sur une question', theme: 'Monde contemporain' },
  { word: 'SUPERPUISSANCE', definition: 'État dominant sur le plan militaire, économique et diplomatique à l\'échelle mondiale', theme: 'Monde contemporain' },
  { word: 'APARTHEID', definition: 'Politique de ségrégation raciale appliquée en Afrique du Sud', theme: 'Monde contemporain' },

  // ========================================
  // Habiter le monde
  // ========================================
  { word: 'METROPOLE', definition: 'Grande ville qui concentre population, activités et pouvoirs de décision', theme: 'Habiter le monde' },
  { word: 'BIDONVILLE', definition: 'Quartier d\'habitat précaire construit avec des matériaux de récupération', theme: 'Habiter le monde' },
  { word: 'PERIURBAIN', definition: 'Espace situé en périphérie d\'une ville combinant caractères ruraux et urbains', theme: 'Habiter le monde' },
  { word: 'LITTORAL', definition: 'Zone de contact entre la terre et la mer', theme: 'Habiter le monde' },
  { word: 'AGRICULTURE', definition: 'Activité de culture des terres et d\'élevage des animaux', theme: 'Habiter le monde' },
  { word: 'TOURISME', definition: 'Activité de déplacement et de séjour dans un lieu pour le loisir', theme: 'Habiter le monde' },
  { word: 'MIGRATION', definition: 'Déplacement de populations d\'un lieu à un autre pour s\'y installer', theme: 'Habiter le monde' },
  { word: 'DENSITE', definition: 'Nombre d\'habitants par unité de surface', theme: 'Habiter le monde' },
  { word: 'ETALEMENT', definition: 'Extension spatiale des villes sur les espaces environnants', theme: 'Habiter le monde' },
  { word: 'GENTRIFICATION', definition: 'Transformation d\'un quartier populaire par l\'arrivée de populations plus aisées', theme: 'Habiter le monde' },
  { word: 'DESERTIFICATION', definition: 'Dégradation des terres en zones arides les rendant improductives', theme: 'Habiter le monde' },
  { word: 'MEGAPOLE', definition: 'Agglomération urbaine de plus de dix millions d\'habitants', theme: 'Habiter le monde' },

  // ========================================
  // France et Europe
  // ========================================
  { word: 'AMENAGEMENT', definition: 'Action de transformer et d\'organiser un territoire pour le rendre plus fonctionnel', theme: 'France et Europe' },
  { word: 'DECENTRALISATION', definition: 'Transfert de compétences de l\'État central vers les collectivités territoriales', theme: 'France et Europe' },
  { word: 'REGION', definition: 'Collectivité territoriale française aux compétences économiques et éducatives', theme: 'France et Europe' },
  { word: 'DEPARTEMENT', definition: 'Division administrative française dirigée par un conseil départemental', theme: 'France et Europe' },
  { word: 'COMMUNE', definition: 'Plus petite division administrative française dirigée par un maire', theme: 'France et Europe' },
  { word: 'INTERCOMMUNALITE', definition: 'Regroupement de communes pour gérer ensemble certains services', theme: 'France et Europe' },
  { word: 'TERRITOIRE', definition: 'Espace délimité approprié et aménagé par une société', theme: 'France et Europe' },
  { word: 'FRONTIERE', definition: 'Limite séparant deux États ou deux territoires', theme: 'France et Europe' },
  { word: 'SCHENGEN', definition: 'Espace européen de libre circulation des personnes sans contrôle aux frontières', theme: 'France et Europe' },
  { word: 'OUTREMER', definition: 'Ensemble des territoires français situés hors de la métropole', theme: 'France et Europe' },
  { word: 'EUROZONE', definition: 'Ensemble des pays de l\'Union européenne ayant adopté l\'euro', theme: 'France et Europe' },

  // ========================================
  // Mondialisation et développement
  // ========================================
  { word: 'DEVELOPPEMENT', definition: 'Amélioration des conditions de vie d\'une population', theme: 'Mondialisation et développement' },
  { word: 'INEGALITE', definition: 'Différence de richesse et de conditions de vie entre populations ou territoires', theme: 'Mondialisation et développement' },
  { word: 'RESSOURCE', definition: 'Élément naturel ou humain utilisé pour satisfaire les besoins d\'une société', theme: 'Mondialisation et développement' },
  { word: 'DURABLE', definition: 'Qui répond aux besoins du présent sans compromettre ceux des générations futures', theme: 'Mondialisation et développement' },
  { word: 'CONTENEUR', definition: 'Grande boîte métallique standardisée pour le transport international de marchandises', theme: 'Mondialisation et développement' },
  { word: 'MULTINATIONALE', definition: 'Entreprise implantée dans plusieurs pays à travers le monde', theme: 'Mondialisation et développement' },
  { word: 'DELOCALISATION', definition: 'Transfert d\'activités de production vers un pays où les coûts sont plus faibles', theme: 'Mondialisation et développement' },
  { word: 'FACADE', definition: 'Littoral concentrant ports et activités économiques tournés vers le commerce mondial', theme: 'Mondialisation et développement' },
  { word: 'HUMANITAIRE', definition: 'Aide apportée aux populations victimes de catastrophes ou de conflits', theme: 'Mondialisation et développement' },
  { word: 'RECHAUFFEMENT', definition: 'Augmentation de la température moyenne de la Terre due aux activités humaines', theme: 'Mondialisation et développement' },
  { word: 'BIODIVERSITE', definition: 'Diversité des espèces vivantes dans un milieu donné', theme: 'Mondialisation et développement' },
  { word: 'TRANSITION', definition: 'Passage progressif d\'un modèle énergétique fossile vers les énergies renouvelables', theme: 'Mondialisation et développement' },
];
