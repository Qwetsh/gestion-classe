export interface TimelineTemplate {
  id: string;
  name: string;
  category: string;
  icon: string;
  config: {
    title: string;
    subtitle: string;
    startYear: string;
    endYear: string;
    style: 'classique' | 'moderne' | 'parchemin';
    orientation: 'horizontal' | 'vertical';
    events: Array<{
      id: string;
      date: string;
      label: string;
      description: string;
      color: string;
    }>;
    periods: Array<{
      id: string;
      startDate: string;
      endDate: string;
      label: string;
      color: string;
      description: string;
      opacity: number;
    }>;
  };
}

// --- Couleurs pour événements ---
const EVENT_COLORS = {
  red: '#EF4444',
  orange: '#F97316',
  amber: '#F59E0B',
  yellow: '#EAB308',
  lime: '#84CC16',
  green: '#22C55E',
  emerald: '#10B981',
  teal: '#14B8A6',
  cyan: '#06B6D4',
  sky: '#0EA5E9',
  blue: '#3B82F6',
  indigo: '#6366F1',
  violet: '#8B5CF6',
  purple: '#A855F7',
  fuchsia: '#D946EF',
  pink: '#EC4899',
  rose: '#F43F5E',
};

// --- Couleurs pour périodes ---
const PERIOD_COLORS = {
  red: '#FCA5A5',
  orange: '#FDBA74',
  amber: '#FCD34D',
  yellow: '#FDE047',
  lime: '#BEF264',
  green: '#86EFAC',
  emerald: '#6EE7B7',
  teal: '#5EEAD4',
  cyan: '#67E8F9',
  sky: '#7DD3FC',
  blue: '#93C5FD',
  indigo: '#A5B4FC',
  violet: '#C4B5FD',
  purple: '#D8B4FE',
  fuchsia: '#F0ABFC',
  pink: '#F9A8D4',
  rose: '#FDA4AF',
};

// =============================================================================
// 1. Révolution française (1789-1799)
// =============================================================================
const revolutionFrancaise: TimelineTemplate = {
  id: 'tpl_revolution',
  name: 'La Révolution française',
  category: 'Histoire',
  icon: '🇫🇷',
  config: {
    title: 'La Révolution française',
    subtitle: 'De la prise de la Bastille au coup d\'État du 18 Brumaire',
    startYear: '1789',
    endYear: '1799',
    style: 'parchemin',
    orientation: 'horizontal',
    events: [
      {
        id: 'tpl_revolution_1',
        date: '1789-05-05',
        label: 'Ouverture des États généraux',
        description: 'Réunion des trois ordres à Versailles, convoquée par Louis XVI pour résoudre la crise financière.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_revolution_2',
        date: '1789-06-20',
        label: 'Serment du Jeu de Paume',
        description: 'Les députés du tiers état jurent de ne pas se séparer avant d\'avoir donné une Constitution à la France.',
        color: EVENT_COLORS.indigo,
      },
      {
        id: 'tpl_revolution_3',
        date: '1789-07-14',
        label: 'Prise de la Bastille',
        description: 'Le peuple de Paris s\'empare de la forteresse royale, symbole de l\'absolutisme.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_revolution_4',
        date: '1789-08-04',
        label: 'Abolition des privilèges',
        description: 'Nuit du 4 août : l\'Assemblée nationale vote l\'abolition des droits féodaux et des privilèges.',
        color: EVENT_COLORS.amber,
      },
      {
        id: 'tpl_revolution_5',
        date: '1789-08-26',
        label: 'Déclaration des droits de l\'homme',
        description: 'Adoption de la DDHC, texte fondateur affirmant les droits naturels et imprescriptibles.',
        color: EVENT_COLORS.emerald,
      },
      {
        id: 'tpl_revolution_6',
        date: '1791-06-21',
        label: 'Fuite à Varennes',
        description: 'Louis XVI et sa famille tentent de fuir mais sont arrêtés à Varennes-en-Argonne.',
        color: EVENT_COLORS.orange,
      },
      {
        id: 'tpl_revolution_7',
        date: '1792-08-10',
        label: 'Chute de la monarchie',
        description: 'Prise du palais des Tuileries par les sans-culottes. Le roi est suspendu de ses fonctions.',
        color: EVENT_COLORS.rose,
      },
      {
        id: 'tpl_revolution_8',
        date: '1793-01-21',
        label: 'Exécution de Louis XVI',
        description: 'Le roi est guillotiné place de la Révolution (actuelle place de la Concorde).',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_revolution_9',
        date: '1794-07-27',
        label: 'Chute de Robespierre (9 Thermidor)',
        description: 'Robespierre est arrêté par la Convention. Fin de la Terreur.',
        color: EVENT_COLORS.purple,
      },
      {
        id: 'tpl_revolution_10',
        date: '1799-11-09',
        label: 'Coup d\'État du 18 Brumaire',
        description: 'Bonaparte renverse le Directoire et instaure le Consulat. Fin de la Révolution.',
        color: EVENT_COLORS.fuchsia,
      },
    ],
    periods: [
      {
        id: 'tpl_revolution_p1',
        startDate: '1789-07-14',
        endDate: '1792-08-10',
        label: 'Monarchie constitutionnelle',
        color: PERIOD_COLORS.blue,
        description: 'Tentative de concilier monarchie et principes révolutionnaires. Constitution de 1791.',
        opacity: 0.3,
      },
      {
        id: 'tpl_revolution_p2',
        startDate: '1792-09-21',
        endDate: '1795-10-26',
        label: 'Première République (Convention)',
        color: PERIOD_COLORS.red,
        description: 'Proclamation de la République, Terreur (1793-1794), guerres révolutionnaires.',
        opacity: 0.3,
      },
      {
        id: 'tpl_revolution_p3',
        startDate: '1795-10-26',
        endDate: '1799-11-09',
        label: 'Le Directoire',
        color: PERIOD_COLORS.purple,
        description: 'Régime républicain modéré, instabilité politique, montée en puissance de Bonaparte.',
        opacity: 0.3,
      },
    ],
  },
};

// =============================================================================
// 2. Ères géologiques (4,6 Ga à aujourd'hui)
// =============================================================================
const eresGeologiques: TimelineTemplate = {
  id: 'tpl_geologie',
  name: 'Les ères géologiques',
  category: 'Géologie',
  icon: '🌍',
  config: {
    title: 'Les ères géologiques',
    subtitle: 'De la formation de la Terre à nos jours (4,6 milliards d\'années)',
    startYear: '-4600000000',
    endYear: '2025',
    style: 'moderne',
    orientation: 'horizontal',
    events: [
      {
        id: 'tpl_geologie_1',
        date: '-4600 Ma',
        label: 'Formation de la Terre',
        description: 'Accrétion de la Terre à partir du disque protoplanétaire autour du jeune Soleil.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_geologie_2',
        date: '-4500 Ma',
        label: 'Impact de Théia et formation de la Lune',
        description: 'Collision entre la proto-Terre et un corps de la taille de Mars, formant la Lune.',
        color: EVENT_COLORS.orange,
      },
      {
        id: 'tpl_geologie_3',
        date: '-3800 Ma',
        label: 'Plus anciennes traces de vie',
        description: 'Stromatolithes et micro-organismes procaryotes dans les océans primitifs.',
        color: EVENT_COLORS.emerald,
      },
      {
        id: 'tpl_geologie_4',
        date: '-2400 Ma',
        label: 'Grande Oxydation',
        description: 'Les cyanobactéries produisent de l\'oxygène, transformant l\'atmosphère terrestre.',
        color: EVENT_COLORS.cyan,
      },
      {
        id: 'tpl_geologie_5',
        date: '-540 Ma',
        label: 'Explosion cambrienne',
        description: 'Apparition rapide de la plupart des grands groupes d\'animaux actuels.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_geologie_6',
        date: '-252 Ma',
        label: 'Extinction permienne',
        description: 'Plus grande extinction de masse : ~95% des espèces marines et ~70% des espèces terrestres disparaissent.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_geologie_7',
        date: '-230 Ma',
        label: 'Premiers dinosaures',
        description: 'Apparition des premiers dinosaures au Trias supérieur.',
        color: EVENT_COLORS.green,
      },
      {
        id: 'tpl_geologie_8',
        date: '-66 Ma',
        label: 'Extinction Crétacé-Tertiaire (K-T)',
        description: 'Impact d\'un astéroïde à Chicxulub (Mexique). Disparition des dinosaures non-aviens.',
        color: EVENT_COLORS.rose,
      },
      {
        id: 'tpl_geologie_9',
        date: '-7 Ma',
        label: 'Premiers hominidés',
        description: 'Séparation de la lignée humaine et des grands singes. Toumaï (~7 Ma), Orrorin (~6 Ma).',
        color: EVENT_COLORS.violet,
      },
      {
        id: 'tpl_geologie_10',
        date: '-0.3 Ma',
        label: 'Homo sapiens',
        description: 'Apparition d\'Homo sapiens en Afrique, il y a environ 300 000 ans.',
        color: EVENT_COLORS.fuchsia,
      },
    ],
    periods: [
      {
        id: 'tpl_geologie_p1',
        startDate: '-4600 Ma',
        endDate: '-4000 Ma',
        label: 'Hadéen',
        color: PERIOD_COLORS.red,
        description: 'Formation de la Terre, bombardement météoritique intense, pas de croûte stable.',
        opacity: 0.3,
      },
      {
        id: 'tpl_geologie_p2',
        startDate: '-4000 Ma',
        endDate: '-2500 Ma',
        label: 'Archéen',
        color: PERIOD_COLORS.orange,
        description: 'Premières formes de vie unicellulaires, atmosphère sans oxygène.',
        opacity: 0.3,
      },
      {
        id: 'tpl_geologie_p3',
        startDate: '-2500 Ma',
        endDate: '-540 Ma',
        label: 'Protérozoïque',
        color: PERIOD_COLORS.teal,
        description: 'Oxygénation de l\'atmosphère, premières cellules eucaryotes, glaciations globales.',
        opacity: 0.3,
      },
      {
        id: 'tpl_geologie_p4',
        startDate: '-540 Ma',
        endDate: '-252 Ma',
        label: 'Paléozoïque',
        color: PERIOD_COLORS.green,
        description: 'Explosion de la biodiversité, conquête des terres, forêts de fougères géantes.',
        opacity: 0.3,
      },
      {
        id: 'tpl_geologie_p5',
        startDate: '-252 Ma',
        endDate: '-66 Ma',
        label: 'Mésozoïque',
        color: PERIOD_COLORS.lime,
        description: 'Ère des dinosaures. Trias, Jurassique, Crétacé. Dislocation de la Pangée.',
        opacity: 0.3,
      },
      {
        id: 'tpl_geologie_p6',
        startDate: '-66 Ma',
        endDate: '2025',
        label: 'Cénozoïque',
        color: PERIOD_COLORS.amber,
        description: 'Ère des mammifères. Diversification, glaciations quaternaires, apparition de l\'Homme.',
        opacity: 0.3,
      },
    ],
  },
};

// =============================================================================
// 3. Seconde Guerre mondiale (1939-1945)
// =============================================================================
const secondeGuerreMondiale: TimelineTemplate = {
  id: 'tpl_ww2',
  name: 'La Seconde Guerre mondiale',
  category: 'Histoire',
  icon: '⚔️',
  config: {
    title: 'La Seconde Guerre mondiale',
    subtitle: 'Le conflit le plus meurtrier de l\'histoire (1939-1945)',
    startYear: '1939',
    endYear: '1945',
    style: 'classique',
    orientation: 'horizontal',
    events: [
      {
        id: 'tpl_ww2_1',
        date: '1939-09-01',
        label: 'Invasion de la Pologne',
        description: 'L\'Allemagne nazie envahit la Pologne. Début de la Seconde Guerre mondiale.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_ww2_2',
        date: '1939-09-03',
        label: 'Déclaration de guerre franco-britannique',
        description: 'La France et le Royaume-Uni déclarent la guerre à l\'Allemagne.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_ww2_3',
        date: '1940-05-10',
        label: 'Offensive allemande à l\'Ouest',
        description: 'Début de la Blitzkrieg : invasion des Pays-Bas, de la Belgique et de la France.',
        color: EVENT_COLORS.orange,
      },
      {
        id: 'tpl_ww2_4',
        date: '1940-06-18',
        label: 'Appel du 18 Juin',
        description: 'Le général de Gaulle appelle depuis Londres à poursuivre le combat.',
        color: EVENT_COLORS.indigo,
      },
      {
        id: 'tpl_ww2_5',
        date: '1940-06-22',
        label: 'Armistice franco-allemand',
        description: 'La France signe l\'armistice à Rethondes. Début du régime de Vichy.',
        color: EVENT_COLORS.amber,
      },
      {
        id: 'tpl_ww2_6',
        date: '1941-06-22',
        label: 'Opération Barbarossa',
        description: 'L\'Allemagne envahit l\'URSS, ouvrant le front de l\'Est.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_ww2_7',
        date: '1941-12-07',
        label: 'Attaque de Pearl Harbor',
        description: 'Le Japon attaque la base américaine. Les États-Unis entrent en guerre.',
        color: EVENT_COLORS.sky,
      },
      {
        id: 'tpl_ww2_8',
        date: '1942-11-11',
        label: 'Invasion de la zone libre',
        description: 'Les Allemands envahissent la zone libre en France (opération Anton).',
        color: EVENT_COLORS.purple,
      },
      {
        id: 'tpl_ww2_9',
        date: '1943-02-02',
        label: 'Capitulation à Stalingrad',
        description: 'La VIe armée allemande capitule. Tournant majeur de la guerre sur le front de l\'Est.',
        color: EVENT_COLORS.emerald,
      },
      {
        id: 'tpl_ww2_10',
        date: '1944-06-06',
        label: 'Débarquement en Normandie (Jour J)',
        description: 'Opération Overlord : les Alliés débarquent sur les plages normandes.',
        color: EVENT_COLORS.green,
      },
      {
        id: 'tpl_ww2_11',
        date: '1944-08-25',
        label: 'Libération de Paris',
        description: 'Paris est libéré par la 2e DB du général Leclerc et les FFI.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_ww2_12',
        date: '1945-05-08',
        label: 'Capitulation de l\'Allemagne',
        description: 'L\'Allemagne nazie capitule sans conditions. Fin de la guerre en Europe.',
        color: EVENT_COLORS.teal,
      },
      {
        id: 'tpl_ww2_13',
        date: '1945-08-06',
        label: 'Bombe atomique sur Hiroshima',
        description: 'Les États-Unis larguent la première bombe atomique sur Hiroshima.',
        color: EVENT_COLORS.rose,
      },
      {
        id: 'tpl_ww2_14',
        date: '1945-09-02',
        label: 'Capitulation du Japon',
        description: 'Le Japon signe la capitulation. Fin de la Seconde Guerre mondiale.',
        color: EVENT_COLORS.fuchsia,
      },
    ],
    periods: [
      {
        id: 'tpl_ww2_p1',
        startDate: '1939-09-03',
        endDate: '1940-05-10',
        label: 'Drôle de guerre',
        color: PERIOD_COLORS.sky,
        description: 'Période d\'inaction militaire sur le front occidental malgré la déclaration de guerre.',
        opacity: 0.3,
      },
      {
        id: 'tpl_ww2_p2',
        startDate: '1940-06-22',
        endDate: '1944-06-06',
        label: 'Occupation',
        color: PERIOD_COLORS.red,
        description: 'La France est occupée (zone nord) puis entièrement (nov. 1942). Régime de Vichy, Résistance.',
        opacity: 0.25,
      },
      {
        id: 'tpl_ww2_p3',
        startDate: '1944-06-06',
        endDate: '1945-05-08',
        label: 'Libération',
        color: PERIOD_COLORS.green,
        description: 'Débarquements en Normandie et Provence, libération progressive du territoire français.',
        opacity: 0.3,
      },
    ],
  },
};

// =============================================================================
// 4. L'Antiquité (3500 av. J.-C. à 476)
// =============================================================================
const antiquite: TimelineTemplate = {
  id: 'tpl_antiquite',
  name: 'L\'Antiquité',
  category: 'Histoire',
  icon: '🏛️',
  config: {
    title: 'L\'Antiquité',
    subtitle: 'Des premières civilisations à la chute de Rome (3500 av. J.-C. - 476)',
    startYear: '-3500',
    endYear: '476',
    style: 'parchemin',
    orientation: 'horizontal',
    events: [
      {
        id: 'tpl_antiquite_1',
        date: '-3300',
        label: 'Invention de l\'écriture (Sumer)',
        description: 'Apparition de l\'écriture cunéiforme en Mésopotamie. Début de l\'Histoire.',
        color: EVENT_COLORS.amber,
      },
      {
        id: 'tpl_antiquite_2',
        date: '-2600',
        label: 'Construction des pyramides de Gizeh',
        description: 'Édification de la Grande Pyramide de Khéops sous l\'Ancien Empire égyptien.',
        color: EVENT_COLORS.yellow,
      },
      {
        id: 'tpl_antiquite_3',
        date: '-1750',
        label: 'Code de Hammurabi',
        description: 'Premier grand code de lois écrit, gravé sur une stèle en Babylonie.',
        color: EVENT_COLORS.orange,
      },
      {
        id: 'tpl_antiquite_4',
        date: '-776',
        label: 'Premiers Jeux olympiques',
        description: 'Premiers Jeux olympiques à Olympie, en l\'honneur de Zeus.',
        color: EVENT_COLORS.green,
      },
      {
        id: 'tpl_antiquite_5',
        date: '-509',
        label: 'Fondation de la République romaine',
        description: 'Renversement du dernier roi étrusque. Rome devient une république.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_antiquite_6',
        date: '-490',
        label: 'Bataille de Marathon',
        description: 'Victoire des Athéniens contre les Perses lors de la première guerre médique.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_antiquite_7',
        date: '-447',
        label: 'Construction du Parthénon',
        description: 'Début de la construction du Parthénon sur l\'Acropole d\'Athènes, sous Périclès.',
        color: EVENT_COLORS.indigo,
      },
      {
        id: 'tpl_antiquite_8',
        date: '-336',
        label: 'Alexandre le Grand',
        description: 'Alexandre devient roi de Macédoine et lance la conquête de l\'Empire perse.',
        color: EVENT_COLORS.violet,
      },
      {
        id: 'tpl_antiquite_9',
        date: '-52',
        label: 'Bataille d\'Alésia',
        description: 'Défaite de Vercingétorix face à Jules César. La Gaule passe sous domination romaine.',
        color: EVENT_COLORS.emerald,
      },
      {
        id: 'tpl_antiquite_10',
        date: '-27',
        label: 'Début de l\'Empire romain',
        description: 'Octave reçoit le titre d\'Auguste. Début du Principat et de la Pax Romana.',
        color: EVENT_COLORS.rose,
      },
      {
        id: 'tpl_antiquite_11',
        date: '79',
        label: 'Éruption du Vésuve',
        description: 'Destruction de Pompéi et Herculanum par l\'éruption du Vésuve.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_antiquite_12',
        date: '476',
        label: 'Chute de l\'Empire romain d\'Occident',
        description: 'Romulus Augustule, dernier empereur, est déposé par Odoacre. Fin de l\'Antiquité.',
        color: EVENT_COLORS.fuchsia,
      },
    ],
    periods: [
      {
        id: 'tpl_antiquite_p1',
        startDate: '-3300',
        endDate: '-1000',
        label: 'Civilisations du Proche-Orient',
        color: PERIOD_COLORS.amber,
        description: 'Sumer, Babylone, Égypte ancienne. Invention de l\'écriture, premières cités-États.',
        opacity: 0.25,
      },
      {
        id: 'tpl_antiquite_p2',
        startDate: '-800',
        endDate: '-146',
        label: 'Grèce antique',
        color: PERIOD_COLORS.blue,
        description: 'Cités grecques, démocratie athénienne, philosophie, art et sciences.',
        opacity: 0.25,
      },
      {
        id: 'tpl_antiquite_p3',
        startDate: '-753',
        endDate: '476',
        label: 'Rome',
        color: PERIOD_COLORS.red,
        description: 'De la fondation légendaire de Rome à la chute de l\'Empire d\'Occident.',
        opacity: 0.2,
      },
    ],
  },
};

// =============================================================================
// 5. Histoire de l'informatique (1940-2025)
// =============================================================================
const histoireInformatique: TimelineTemplate = {
  id: 'tpl_informatique',
  name: 'Histoire de l\'informatique',
  category: 'Sciences',
  icon: '💻',
  config: {
    title: 'Histoire de l\'informatique',
    subtitle: 'Des premiers ordinateurs à l\'intelligence artificielle (1940-2025)',
    startYear: '1940',
    endYear: '2025',
    style: 'moderne',
    orientation: 'horizontal',
    events: [
      {
        id: 'tpl_informatique_1',
        date: '1943',
        label: 'Colossus',
        description: 'Premier calculateur électronique programmable, utilisé pour décrypter les codes allemands à Bletchley Park.',
        color: EVENT_COLORS.amber,
      },
      {
        id: 'tpl_informatique_2',
        date: '1946',
        label: 'ENIAC',
        description: 'Premier ordinateur entièrement électronique à usage général, pesant 30 tonnes.',
        color: EVENT_COLORS.orange,
      },
      {
        id: 'tpl_informatique_3',
        date: '1958',
        label: 'Circuit intégré',
        description: 'Jack Kilby (Texas Instruments) invente le circuit intégré, révolutionnant la miniaturisation.',
        color: EVENT_COLORS.teal,
      },
      {
        id: 'tpl_informatique_4',
        date: '1969',
        label: 'ARPANET',
        description: 'Premier réseau de communication entre ordinateurs, ancêtre d\'Internet.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_informatique_5',
        date: '1971',
        label: 'Premier microprocesseur (Intel 4004)',
        description: 'Intel crée le premier microprocesseur commercial, intégrant un CPU sur une seule puce.',
        color: EVENT_COLORS.indigo,
      },
      {
        id: 'tpl_informatique_6',
        date: '1977',
        label: 'Apple II',
        description: 'L\'Apple II de Steve Wozniak et Steve Jobs popularise l\'ordinateur personnel.',
        color: EVENT_COLORS.green,
      },
      {
        id: 'tpl_informatique_7',
        date: '1981',
        label: 'IBM PC',
        description: 'Lancement du PC d\'IBM avec MS-DOS. Début de la standardisation du PC.',
        color: EVENT_COLORS.sky,
      },
      {
        id: 'tpl_informatique_8',
        date: '1989',
        label: 'Invention du World Wide Web',
        description: 'Tim Berners-Lee invente le Web au CERN (Genève) : HTML, HTTP, URL.',
        color: EVENT_COLORS.violet,
      },
      {
        id: 'tpl_informatique_9',
        date: '1991',
        label: 'Linux',
        description: 'Linus Torvalds publie le noyau Linux, fondation du mouvement open source.',
        color: EVENT_COLORS.emerald,
      },
      {
        id: 'tpl_informatique_10',
        date: '1998',
        label: 'Fondation de Google',
        description: 'Larry Page et Sergey Brin fondent Google, révolutionnant la recherche sur Internet.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_informatique_11',
        date: '2007',
        label: 'iPhone',
        description: 'Apple lance l\'iPhone, inaugurant l\'ère des smartphones modernes à écran tactile.',
        color: EVENT_COLORS.pink,
      },
      {
        id: 'tpl_informatique_12',
        date: '2022',
        label: 'ChatGPT',
        description: 'OpenAI lance ChatGPT, rendant l\'intelligence artificielle générative accessible au grand public.',
        color: EVENT_COLORS.fuchsia,
      },
    ],
    periods: [
      {
        id: 'tpl_informatique_p1',
        startDate: '1940',
        endDate: '1960',
        label: 'Ère des mainframes',
        color: PERIOD_COLORS.amber,
        description: 'Gros ordinateurs à tubes, réservés aux militaires et aux universités.',
        opacity: 0.25,
      },
      {
        id: 'tpl_informatique_p2',
        startDate: '1960',
        endDate: '1980',
        label: 'Mini-ordinateurs et circuits intégrés',
        color: PERIOD_COLORS.teal,
        description: 'Miniaturisation, premiers langages de programmation modernes, ARPANET.',
        opacity: 0.25,
      },
      {
        id: 'tpl_informatique_p3',
        startDate: '1980',
        endDate: '2000',
        label: 'Révolution du PC et d\'Internet',
        color: PERIOD_COLORS.blue,
        description: 'Démocratisation de l\'ordinateur personnel, naissance du Web.',
        opacity: 0.25,
      },
      {
        id: 'tpl_informatique_p4',
        startDate: '2000',
        endDate: '2025',
        label: 'Ère du mobile et de l\'IA',
        color: PERIOD_COLORS.purple,
        description: 'Smartphones, cloud computing, réseaux sociaux, intelligence artificielle.',
        opacity: 0.25,
      },
    ],
  },
};

// =============================================================================
// 6. Le système solaire (formation)
// =============================================================================
const systemeSolaire: TimelineTemplate = {
  id: 'tpl_systeme_solaire',
  name: 'Formation du système solaire',
  category: 'Sciences',
  icon: '☀️',
  config: {
    title: 'Formation du système solaire',
    subtitle: 'De la nébuleuse solaire à aujourd\'hui (4,6 Ga)',
    startYear: '-4600000000',
    endYear: '2025',
    style: 'moderne',
    orientation: 'horizontal',
    events: [
      {
        id: 'tpl_systeme_solaire_1',
        date: '-4600 Ma',
        label: 'Effondrement de la nébuleuse solaire',
        description: 'Un nuage de gaz et de poussière s\'effondre sous sa propre gravité, formant le disque protoplanétaire.',
        color: EVENT_COLORS.amber,
      },
      {
        id: 'tpl_systeme_solaire_2',
        date: '-4567 Ma',
        label: 'Formation du Soleil',
        description: 'Le proto-Soleil s\'allume : les réactions de fusion nucléaire débutent en son cœur.',
        color: EVENT_COLORS.yellow,
      },
      {
        id: 'tpl_systeme_solaire_3',
        date: '-4560 Ma',
        label: 'Accrétion des planétésimaux',
        description: 'Les grains de poussière s\'agrègent en planétésimaux puis en protoplanètes.',
        color: EVENT_COLORS.orange,
      },
      {
        id: 'tpl_systeme_solaire_4',
        date: '-4530 Ma',
        label: 'Formation de la Terre',
        description: 'La proto-Terre atteint sa taille actuelle par accrétion de planétésimaux rocheux.',
        color: EVENT_COLORS.blue,
      },
      {
        id: 'tpl_systeme_solaire_5',
        date: '-4500 Ma',
        label: 'Impact géant et formation de la Lune',
        description: 'Collision avec Théia. Les débris en orbite s\'agrègent pour former la Lune.',
        color: EVENT_COLORS.indigo,
      },
      {
        id: 'tpl_systeme_solaire_6',
        date: '-4400 Ma',
        label: 'Formation des premiers océans',
        description: 'La Terre refroidit suffisamment pour que l\'eau liquide s\'accumule en surface.',
        color: EVENT_COLORS.cyan,
      },
      {
        id: 'tpl_systeme_solaire_7',
        date: '-4100 Ma',
        label: 'Grand bombardement tardif',
        description: 'Intense bombardement d\'astéroïdes sur les planètes internes, dû à la migration des géantes gazeuses.',
        color: EVENT_COLORS.red,
      },
      {
        id: 'tpl_systeme_solaire_8',
        date: '-3800 Ma',
        label: 'Premières traces de vie sur Terre',
        description: 'Micro-organismes dans les océans terrestres, attestés par les plus anciens stromatolithes.',
        color: EVENT_COLORS.emerald,
      },
      {
        id: 'tpl_systeme_solaire_9',
        date: '-700 Ma',
        label: 'Terre « boule de neige »',
        description: 'Glaciations globales recouvrant la quasi-totalité de la surface terrestre.',
        color: EVENT_COLORS.sky,
      },
      {
        id: 'tpl_systeme_solaire_10',
        date: '-66 Ma',
        label: 'Impact de Chicxulub',
        description: 'Un astéroïde de ~10 km frappe le Yucatán, provoquant l\'extinction des dinosaures.',
        color: EVENT_COLORS.rose,
      },
    ],
    periods: [
      {
        id: 'tpl_systeme_solaire_p1',
        startDate: '-4600 Ma',
        endDate: '-4560 Ma',
        label: 'Nébuleuse et disque protoplanétaire',
        color: PERIOD_COLORS.amber,
        description: 'Effondrement gravitationnel, formation du Soleil et du disque de gaz et poussière.',
        opacity: 0.3,
      },
      {
        id: 'tpl_systeme_solaire_p2',
        startDate: '-4560 Ma',
        endDate: '-4500 Ma',
        label: 'Accrétion planétaire',
        color: PERIOD_COLORS.orange,
        description: 'Formation des planètes telluriques et des noyaux des géantes gazeuses.',
        opacity: 0.3,
      },
      {
        id: 'tpl_systeme_solaire_p3',
        startDate: '-4500 Ma',
        endDate: '-4100 Ma',
        label: 'Différenciation et refroidissement',
        color: PERIOD_COLORS.blue,
        description: 'Séparation noyau/manteau, formation de la Lune, apparition des premiers océans.',
        opacity: 0.3,
      },
      {
        id: 'tpl_systeme_solaire_p4',
        startDate: '-4100 Ma',
        endDate: '-3800 Ma',
        label: 'Grand bombardement tardif',
        color: PERIOD_COLORS.red,
        description: 'Migration des planètes géantes perturbant la ceinture d\'astéroïdes.',
        opacity: 0.3,
      },
      {
        id: 'tpl_systeme_solaire_p5',
        startDate: '-3800 Ma',
        endDate: '2025',
        label: 'Évolution du système solaire',
        color: PERIOD_COLORS.green,
        description: 'Stabilisation des orbites, évolution géologique et biologique sur Terre.',
        opacity: 0.2,
      },
    ],
  },
};

// =============================================================================
// Export
// =============================================================================
export const TIMELINE_TEMPLATES: TimelineTemplate[] = [
  revolutionFrancaise,
  eresGeologiques,
  secondeGuerreMondiale,
  antiquite,
  histoireInformatique,
  systemeSolaire,
];
