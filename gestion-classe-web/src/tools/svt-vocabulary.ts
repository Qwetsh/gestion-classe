export interface SvtTerm {
  word: string;
  definition: string;
  theme: string;
}

export const SVT_THEMES = [
  'La cellule et le vivant',
  'Nutrition et digestion',
  'Respiration et circulation',
  'Reproduction et sexualité',
  'Génétique et hérédité',
  'Évolution et classification',
  'Écosystèmes et biodiversité',
  'Géologie et dynamique terrestre',
  'Système immunitaire et santé',
  'Environnement et développement durable',
] as const;

export type SvtTheme = (typeof SVT_THEMES)[number];

export const SVT_VOCABULARY: SvtTerm[] = [
  // ========================================
  // La cellule et le vivant
  // ========================================
  { word: 'CELLULE', definition: 'Unité de base du vivant', theme: 'La cellule et le vivant' },
  { word: 'NOYAU', definition: 'Organite contenant le matériel génétique', theme: 'La cellule et le vivant' },
  { word: 'MEMBRANE', definition: 'Enveloppe qui délimite la cellule', theme: 'La cellule et le vivant' },
  { word: 'CYTOPLASME', definition: 'Milieu liquide à l\'intérieur de la cellule', theme: 'La cellule et le vivant' },
  { word: 'ORGANITE', definition: 'Structure spécialisée à l\'intérieur d\'une cellule', theme: 'La cellule et le vivant' },
  { word: 'MITOSE', definition: 'Division cellulaire produisant deux cellules identiques', theme: 'La cellule et le vivant' },
  { word: 'CHLOROPLASTE', definition: 'Organite végétal responsable de la photosynthèse', theme: 'La cellule et le vivant' },
  { word: 'VACUOLE', definition: 'Poche remplie de liquide dans la cellule végétale', theme: 'La cellule et le vivant' },
  { word: 'PAROI', definition: 'Enveloppe rigide entourant la cellule végétale', theme: 'La cellule et le vivant' },
  { word: 'MICROSCOPE', definition: 'Instrument qui permet d\'observer ce qui est invisible à l\'œil nu', theme: 'La cellule et le vivant' },
  { word: 'UNICELLULAIRE', definition: 'Être vivant composé d\'une seule cellule', theme: 'La cellule et le vivant' },
  { word: 'PLURICELLULAIRE', definition: 'Être vivant composé de plusieurs cellules', theme: 'La cellule et le vivant' },
  { word: 'TISSU', definition: 'Ensemble de cellules ayant la même fonction', theme: 'La cellule et le vivant' },
  { word: 'ORGANE', definition: 'Partie du corps remplissant une fonction précise', theme: 'La cellule et le vivant' },
  { word: 'METABOLISME', definition: 'Ensemble des réactions chimiques dans un organisme', theme: 'La cellule et le vivant' },
  { word: 'PHOTOSYNTHESE', definition: 'Fabrication de matière organique par les végétaux grâce à la lumière', theme: 'La cellule et le vivant' },
  { word: 'CHLOROPHYLLE', definition: 'Pigment vert des végétaux captant la lumière', theme: 'La cellule et le vivant' },
  { word: 'AUTOTROPHE', definition: 'Organisme produisant sa propre matière organique', theme: 'La cellule et le vivant' },
  { word: 'HETEROTROPHE', definition: 'Organisme ayant besoin de matière organique pour se nourrir', theme: 'La cellule et le vivant' },

  // ========================================
  // Nutrition et digestion
  // ========================================
  { word: 'NUTRIMENT', definition: 'Molécule utilisable directement par les cellules', theme: 'Nutrition et digestion' },
  { word: 'ALIMENT', definition: 'Substance consommée qui apporte des nutriments', theme: 'Nutrition et digestion' },
  { word: 'ENZYME', definition: 'Molécule qui accélère une réaction chimique dans l\'organisme', theme: 'Nutrition et digestion' },
  { word: 'DIGESTION', definition: 'Transformation des aliments en nutriments', theme: 'Nutrition et digestion' },
  { word: 'ABSORPTION', definition: 'Passage des nutriments dans le sang au niveau de l\'intestin', theme: 'Nutrition et digestion' },
  { word: 'INTESTIN', definition: 'Organe du tube digestif où se fait l\'absorption', theme: 'Nutrition et digestion' },
  { word: 'ESTOMAC', definition: 'Organe du tube digestif où les aliments sont brassés et digérés', theme: 'Nutrition et digestion' },
  { word: 'GLUCIDE', definition: 'Famille de nutriments fournissant de l\'énergie, dont les sucres', theme: 'Nutrition et digestion' },
  { word: 'LIPIDE', definition: 'Famille de nutriments constituant les graisses', theme: 'Nutrition et digestion' },
  { word: 'PROTEINE', definition: 'Famille de nutriments essentiels à la construction des cellules', theme: 'Nutrition et digestion' },
  { word: 'VITAMINE', definition: 'Substance indispensable en petite quantité au fonctionnement de l\'organisme', theme: 'Nutrition et digestion' },
  { word: 'FIBRE', definition: 'Substance végétale non digérée favorisant le transit intestinal', theme: 'Nutrition et digestion' },
  { word: 'SALIVE', definition: 'Liquide produit dans la bouche contenant des enzymes digestives', theme: 'Nutrition et digestion' },
  { word: 'VILLOSITE', definition: 'Repli de la paroi intestinale augmentant la surface d\'absorption', theme: 'Nutrition et digestion' },
  { word: 'FOIE', definition: 'Organe produisant la bile et transformant les nutriments', theme: 'Nutrition et digestion' },
  { word: 'PANCREAS', definition: 'Organe produisant des enzymes digestives et de l\'insuline', theme: 'Nutrition et digestion' },
  { word: 'BILE', definition: 'Liquide produit par le foie aidant à digérer les graisses', theme: 'Nutrition et digestion' },
  { word: 'GLUCOSE', definition: 'Sucre simple, principale source d\'énergie des cellules', theme: 'Nutrition et digestion' },
  { word: 'CALORIE', definition: 'Unité de mesure de l\'énergie fournie par les aliments', theme: 'Nutrition et digestion' },

  // ========================================
  // Respiration et circulation
  // ========================================
  { word: 'RESPIRATION', definition: 'Échange gazeux permettant de produire de l\'énergie dans les cellules', theme: 'Respiration et circulation' },
  { word: 'POUMON', definition: 'Organe dans lequel se font les échanges gazeux respiratoires', theme: 'Respiration et circulation' },
  { word: 'ALVEOLE', definition: 'Petite poche pulmonaire où le sang s\'enrichit en dioxygène', theme: 'Respiration et circulation' },
  { word: 'BRONCHE', definition: 'Conduit amenant l\'air dans les poumons', theme: 'Respiration et circulation' },
  { word: 'TRACHEE', definition: 'Tube reliant le larynx aux bronches', theme: 'Respiration et circulation' },
  { word: 'DIAPHRAGME', definition: 'Muscle séparant le thorax de l\'abdomen, essentiel à la ventilation', theme: 'Respiration et circulation' },
  { word: 'DIOXYGENE', definition: 'Gaz prélevé dans l\'air et utilisé par les cellules', theme: 'Respiration et circulation' },
  { word: 'DIOXYDE', definition: 'Gaz de carbone rejeté par les cellules lors de la respiration', theme: 'Respiration et circulation' },
  { word: 'HEMOGLOBINE', definition: 'Molécule des globules rouges transportant le dioxygène', theme: 'Respiration et circulation' },
  { word: 'COEUR', definition: 'Organe musculaire qui propulse le sang dans les vaisseaux', theme: 'Respiration et circulation' },
  { word: 'ARTERE', definition: 'Vaisseau transportant le sang du cœur vers les organes', theme: 'Respiration et circulation' },
  { word: 'VEINE', definition: 'Vaisseau ramenant le sang des organes vers le cœur', theme: 'Respiration et circulation' },
  { word: 'CAPILLAIRE', definition: 'Vaisseau très fin où se font les échanges entre sang et organes', theme: 'Respiration et circulation' },
  { word: 'PLASMA', definition: 'Partie liquide du sang transportant les nutriments', theme: 'Respiration et circulation' },
  { word: 'VENTRICULE', definition: 'Cavité inférieure du cœur qui éjecte le sang', theme: 'Respiration et circulation' },
  { word: 'OREILLETTE', definition: 'Cavité supérieure du cœur qui reçoit le sang', theme: 'Respiration et circulation' },
  { word: 'POULS', definition: 'Battement ressenti dans une artère à chaque contraction du cœur', theme: 'Respiration et circulation' },
  { word: 'BRANCHIE', definition: 'Organe respiratoire des animaux aquatiques', theme: 'Respiration et circulation' },
  { word: 'PLAQUETTE', definition: 'Élément du sang intervenant dans la coagulation', theme: 'Respiration et circulation' },

  // ========================================
  // Reproduction et sexualité
  // ========================================
  { word: 'GAMETE', definition: 'Cellule reproductrice mâle ou femelle', theme: 'Reproduction et sexualité' },
  { word: 'OVULE', definition: 'Gamète femelle produit par les ovaires', theme: 'Reproduction et sexualité' },
  { word: 'SPERMATOZOIDE', definition: 'Gamète mâle produit par les testicules', theme: 'Reproduction et sexualité' },
  { word: 'FECONDATION', definition: 'Fusion d\'un ovule et d\'un spermatozoïde', theme: 'Reproduction et sexualité' },
  { word: 'EMBRYON', definition: 'Organisme en développement après la fécondation', theme: 'Reproduction et sexualité' },
  { word: 'FOETUS', definition: 'Stade de développement après l\'embryon, à partir du 3e mois', theme: 'Reproduction et sexualité' },
  { word: 'PLACENTA', definition: 'Organe assurant les échanges entre la mère et le fœtus', theme: 'Reproduction et sexualité' },
  { word: 'UTERUS', definition: 'Organe dans lequel se développe l\'embryon', theme: 'Reproduction et sexualité' },
  { word: 'OVAIRE', definition: 'Glande produisant les ovules et des hormones féminines', theme: 'Reproduction et sexualité' },
  { word: 'TESTICULE', definition: 'Glande produisant les spermatozoïdes et la testostérone', theme: 'Reproduction et sexualité' },
  { word: 'PUBERTE', definition: 'Période de transformation du corps permettant la reproduction', theme: 'Reproduction et sexualité' },
  { word: 'HORMONE', definition: 'Substance chimique transportée par le sang régulant le corps', theme: 'Reproduction et sexualité' },
  { word: 'OVULATION', definition: 'Libération d\'un ovule par l\'ovaire', theme: 'Reproduction et sexualité' },
  { word: 'MENSTRUATION', definition: 'Écoulement sanguin cyclique lié au renouvellement de l\'utérus', theme: 'Reproduction et sexualité' },
  { word: 'CONTRACEPTION', definition: 'Ensemble des méthodes pour éviter une grossesse', theme: 'Reproduction et sexualité' },
  { word: 'NIDATION', definition: 'Implantation de l\'embryon dans la paroi de l\'utérus', theme: 'Reproduction et sexualité' },
  { word: 'CORDON', definition: 'Lien ombilical reliant le fœtus au placenta', theme: 'Reproduction et sexualité' },
  { word: 'ACCOUCHEMENT', definition: 'Expulsion du fœtus hors de l\'utérus à la fin de la grossesse', theme: 'Reproduction et sexualité' },
  { word: 'GERMINATION', definition: 'Développement d\'une plantule à partir d\'une graine', theme: 'Reproduction et sexualité' },
  { word: 'POLLINISATION', definition: 'Transport du pollen vers le pistil d\'une fleur', theme: 'Reproduction et sexualité' },
  { word: 'GRAINE', definition: 'Structure contenant l\'embryon végétal et des réserves', theme: 'Reproduction et sexualité' },

  // ========================================
  // Génétique et hérédité
  // ========================================
  { word: 'ADN', definition: 'Molécule support de l\'information génétique', theme: 'Génétique et hérédité' },
  { word: 'GENE', definition: 'Portion d\'ADN déterminant un caractère héréditaire', theme: 'Génétique et hérédité' },
  { word: 'CHROMOSOME', definition: 'Structure contenant l\'ADN, visible lors de la division cellulaire', theme: 'Génétique et hérédité' },
  { word: 'ALLELE', definition: 'Version d\'un gène pouvant varier d\'un individu à l\'autre', theme: 'Génétique et hérédité' },
  { word: 'CARYOTYPE', definition: 'Représentation ordonnée de l\'ensemble des chromosomes d\'une cellule', theme: 'Génétique et hérédité' },
  { word: 'DOMINANT', definition: 'Allèle qui s\'exprime même en une seule copie', theme: 'Génétique et hérédité' },
  { word: 'RECESSIF', definition: 'Allèle qui ne s\'exprime qu\'en deux copies identiques', theme: 'Génétique et hérédité' },
  { word: 'MUTATION', definition: 'Modification accidentelle de la séquence d\'ADN', theme: 'Génétique et hérédité' },
  { word: 'HEREDITE', definition: 'Transmission des caractères des parents aux descendants', theme: 'Génétique et hérédité' },
  { word: 'GENOTYPE', definition: 'Ensemble des allèles portés par un individu', theme: 'Génétique et hérédité' },
  { word: 'PHENOTYPE', definition: 'Ensemble des caractères observables d\'un individu', theme: 'Génétique et hérédité' },
  { word: 'MEIOSE', definition: 'Division cellulaire produisant des gamètes avec la moitié des chromosomes', theme: 'Génétique et hérédité' },
  { word: 'GENOME', definition: 'Ensemble de l\'information génétique d\'un organisme', theme: 'Génétique et hérédité' },
  { word: 'TRANSGENESE', definition: 'Technique d\'introduction d\'un gène étranger dans un organisme', theme: 'Génétique et hérédité' },
  { word: 'CLONAGE', definition: 'Production d\'individus génétiquement identiques', theme: 'Génétique et hérédité' },

  // ========================================
  // Évolution et classification
  // ========================================
  { word: 'EVOLUTION', definition: 'Transformation des espèces au cours du temps', theme: 'Évolution et classification' },
  { word: 'FOSSILE', definition: 'Reste ou trace d\'un être vivant conservé dans la roche', theme: 'Évolution et classification' },
  { word: 'ESPECE', definition: 'Ensemble d\'individus pouvant se reproduire entre eux', theme: 'Évolution et classification' },
  { word: 'SELECTION', definition: 'Processus naturel favorisant les individus les mieux adaptés', theme: 'Évolution et classification' },
  { word: 'ADAPTATION', definition: 'Caractère favorisant la survie dans un milieu donné', theme: 'Évolution et classification' },
  { word: 'BIODIVERSITE', definition: 'Diversité des espèces vivantes dans un milieu', theme: 'Évolution et classification' },
  { word: 'VERTEBRE', definition: 'Animal possédant une colonne vertébrale', theme: 'Évolution et classification' },
  { word: 'INVERTEBRE', definition: 'Animal dépourvu de colonne vertébrale', theme: 'Évolution et classification' },
  { word: 'MAMMIFERE', definition: 'Vertébré à sang chaud allaitant ses petits', theme: 'Évolution et classification' },
  { word: 'REPTILE', definition: 'Vertébré à sang froid à peau couverte d\'écailles', theme: 'Évolution et classification' },
  { word: 'AMPHIBIEN', definition: 'Vertébré dont le développement passe par une phase aquatique', theme: 'Évolution et classification' },
  { word: 'ARTHROPODE', definition: 'Invertébré à pattes articulées et exosquelette', theme: 'Évolution et classification' },
  { word: 'INSECTE', definition: 'Arthropode à six pattes et trois parties du corps', theme: 'Évolution et classification' },
  { word: 'PHYLOGENESE', definition: 'Histoire évolutive d\'un groupe d\'êtres vivants', theme: 'Évolution et classification' },
  { word: 'ANCETRE', definition: 'Organisme dont descendent d\'autres espèces', theme: 'Évolution et classification' },
  { word: 'HOMOLOGIE', definition: 'Ressemblance entre organes héritée d\'un ancêtre commun', theme: 'Évolution et classification' },
  { word: 'EXTINCTION', definition: 'Disparition définitive d\'une espèce', theme: 'Évolution et classification' },
  { word: 'DARWIN', definition: 'Naturaliste ayant proposé la théorie de la sélection naturelle', theme: 'Évolution et classification' },

  // ========================================
  // Écosystèmes et biodiversité
  // ========================================
  { word: 'ECOSYSTEME', definition: 'Ensemble formé par un milieu et les êtres vivants qui l\'occupent', theme: 'Écosystèmes et biodiversité' },
  { word: 'BIOTOPE', definition: 'Milieu physique dans lequel vivent les êtres vivants', theme: 'Écosystèmes et biodiversité' },
  { word: 'BIOCENOSE', definition: 'Ensemble des êtres vivants d\'un écosystème', theme: 'Écosystèmes et biodiversité' },
  { word: 'PRODUCTEUR', definition: 'Être vivant fabriquant sa propre matière organique', theme: 'Écosystèmes et biodiversité' },
  { word: 'CONSOMMATEUR', definition: 'Être vivant se nourrissant d\'autres êtres vivants', theme: 'Écosystèmes et biodiversité' },
  { word: 'DECOMPOSEUR', definition: 'Être vivant transformant la matière organique morte en matière minérale', theme: 'Écosystèmes et biodiversité' },
  { word: 'PREDATEUR', definition: 'Animal qui chasse d\'autres animaux pour se nourrir', theme: 'Écosystèmes et biodiversité' },
  { word: 'PROIE', definition: 'Animal capturé et consommé par un prédateur', theme: 'Écosystèmes et biodiversité' },
  { word: 'SYMBIOSE', definition: 'Association durable et bénéfique entre deux espèces', theme: 'Écosystèmes et biodiversité' },
  { word: 'PARASITISME', definition: 'Relation où un organisme vit aux dépens d\'un autre', theme: 'Écosystèmes et biodiversité' },
  { word: 'PHOTOSYNTHESE', definition: 'Production de matière organique par les végétaux grâce à la lumière', theme: 'Écosystèmes et biodiversité' },
  { word: 'RESEAU', definition: 'Ensemble des chaînes alimentaires interconnectées', theme: 'Écosystèmes et biodiversité' },
  { word: 'HERBIVORE', definition: 'Animal se nourrissant exclusivement de végétaux', theme: 'Écosystèmes et biodiversité' },
  { word: 'CARNIVORE', definition: 'Animal se nourrissant d\'autres animaux', theme: 'Écosystèmes et biodiversité' },
  { word: 'OMNIVORE', definition: 'Animal se nourrissant à la fois de végétaux et d\'animaux', theme: 'Écosystèmes et biodiversité' },
  { word: 'HUMUS', definition: 'Couche du sol riche en matière organique décomposée', theme: 'Écosystèmes et biodiversité' },
  { word: 'LITIERE', definition: 'Couche de feuilles mortes et débris au sol d\'une forêt', theme: 'Écosystèmes et biodiversité' },
  { word: 'MIGRATION', definition: 'Déplacement saisonnier d\'animaux vers un autre milieu', theme: 'Écosystèmes et biodiversité' },
  { word: 'HIBERNATION', definition: 'État de vie ralentie de certains animaux pendant l\'hiver', theme: 'Écosystèmes et biodiversité' },

  // ========================================
  // Géologie et dynamique terrestre
  // ========================================
  { word: 'ROCHE', definition: 'Matériau solide constituant l\'écorce terrestre', theme: 'Géologie et dynamique terrestre' },
  { word: 'MINERAL', definition: 'Substance naturelle solide de composition chimique définie', theme: 'Géologie et dynamique terrestre' },
  { word: 'SEISME', definition: 'Tremblement de terre dû à une rupture de roches en profondeur', theme: 'Géologie et dynamique terrestre' },
  { word: 'VOLCAN', definition: 'Relief formé par l\'accumulation de matériaux issus du magma', theme: 'Géologie et dynamique terrestre' },
  { word: 'MAGMA', definition: 'Roche en fusion située en profondeur sous la croûte', theme: 'Géologie et dynamique terrestre' },
  { word: 'LAVE', definition: 'Magma arrivé en surface lors d\'une éruption volcanique', theme: 'Géologie et dynamique terrestre' },
  { word: 'PLAQUE', definition: 'Fragment rigide de la lithosphère en mouvement', theme: 'Géologie et dynamique terrestre' },
  { word: 'LITHOSPHERE', definition: 'Enveloppe rigide de la Terre comprenant croûte et manteau supérieur', theme: 'Géologie et dynamique terrestre' },
  { word: 'CROUTE', definition: 'Couche superficielle solide de la Terre', theme: 'Géologie et dynamique terrestre' },
  { word: 'MANTEAU', definition: 'Couche terrestre située entre la croûte et le noyau', theme: 'Géologie et dynamique terrestre' },
  { word: 'EROSION', definition: 'Usure du relief par l\'eau, le vent ou la glace', theme: 'Géologie et dynamique terrestre' },
  { word: 'SEDIMENTATION', definition: 'Dépôt de particules transportées formant des couches', theme: 'Géologie et dynamique terrestre' },
  { word: 'SEDIMENT', definition: 'Dépôt de particules issues de l\'érosion', theme: 'Géologie et dynamique terrestre' },
  { word: 'GRANITE', definition: 'Roche magmatique formée en profondeur, constituant la croûte continentale', theme: 'Géologie et dynamique terrestre' },
  { word: 'BASALTE', definition: 'Roche volcanique sombre constituant le plancher océanique', theme: 'Géologie et dynamique terrestre' },
  { word: 'CALCAIRE', definition: 'Roche sédimentaire formée de restes d\'organismes marins', theme: 'Géologie et dynamique terrestre' },
  { word: 'FAILLE', definition: 'Cassure de roches avec déplacement de blocs', theme: 'Géologie et dynamique terrestre' },
  { word: 'EPICENTRE', definition: 'Point en surface situé à la verticale du foyer d\'un séisme', theme: 'Géologie et dynamique terrestre' },
  { word: 'FOYER', definition: 'Point en profondeur où se produit la rupture lors d\'un séisme', theme: 'Géologie et dynamique terrestre' },
  { word: 'SUBDUCTION', definition: 'Plongement d\'une plaque tectonique sous une autre', theme: 'Géologie et dynamique terrestre' },
  { word: 'DORSALE', definition: 'Chaîne de montagnes sous-marines où se forme la nouvelle croûte', theme: 'Géologie et dynamique terrestre' },
  { word: 'PANGEE', definition: 'Supercontinent unique ayant existé il y a 250 millions d\'années', theme: 'Géologie et dynamique terrestre' },
  { word: 'STRATE', definition: 'Couche de roche sédimentaire horizontale', theme: 'Géologie et dynamique terrestre' },

  // ========================================
  // Système immunitaire et santé
  // ========================================
  { word: 'ANTIGENE', definition: 'Molécule étrangère déclenchant une réaction immunitaire', theme: 'Système immunitaire et santé' },
  { word: 'ANTICORPS', definition: 'Molécule produite par les lymphocytes neutralisant un antigène', theme: 'Système immunitaire et santé' },
  { word: 'LEUCOCYTE', definition: 'Globule blanc assurant la défense de l\'organisme', theme: 'Système immunitaire et santé' },
  { word: 'LYMPHOCYTE', definition: 'Globule blanc spécialisé dans la réponse immunitaire spécifique', theme: 'Système immunitaire et santé' },
  { word: 'PHAGOCYTOSE', definition: 'Ingestion et destruction d\'un élément étranger par une cellule', theme: 'Système immunitaire et santé' },
  { word: 'VACCINATION', definition: 'Introduction d\'un agent inoffensif pour préparer le système immunitaire', theme: 'Système immunitaire et santé' },
  { word: 'VACCIN', definition: 'Préparation stimulant l\'immunité contre une maladie', theme: 'Système immunitaire et santé' },
  { word: 'IMMUNITE', definition: 'Capacité de l\'organisme à se défendre contre un agent pathogène', theme: 'Système immunitaire et santé' },
  { word: 'BACTERIE', definition: 'Micro-organisme unicellulaire sans noyau', theme: 'Système immunitaire et santé' },
  { word: 'VIRUS', definition: 'Agent infectieux ne pouvant se reproduire qu\'à l\'intérieur d\'une cellule', theme: 'Système immunitaire et santé' },
  { word: 'ANTIBIOTIQUE', definition: 'Médicament détruisant ou bloquant la croissance des bactéries', theme: 'Système immunitaire et santé' },
  { word: 'INFECTION', definition: 'Pénétration et multiplication d\'un micro-organisme dans le corps', theme: 'Système immunitaire et santé' },
  { word: 'INFLAMMATION', definition: 'Réaction locale de défense avec rougeur, chaleur et gonflement', theme: 'Système immunitaire et santé' },
  { word: 'ASEPSIE', definition: 'Ensemble des mesures empêchant la contamination par des microbes', theme: 'Système immunitaire et santé' },
  { word: 'ANTISEPTIQUE', definition: 'Produit détruisant les micro-organismes sur une surface vivante', theme: 'Système immunitaire et santé' },
  { word: 'EPIDEMIE', definition: 'Propagation rapide d\'une maladie dans une population', theme: 'Système immunitaire et santé' },
  { word: 'PANDEMIE', definition: 'Épidémie touchant une très large zone géographique', theme: 'Système immunitaire et santé' },
  { word: 'ALLERGIE', definition: 'Réaction immunitaire excessive contre une substance normalement inoffensive', theme: 'Système immunitaire et santé' },
  { word: 'SEROPOSITIF', definition: 'Individu dont le sang contient des anticorps contre un agent donné', theme: 'Système immunitaire et santé' },
  { word: 'MICROBE', definition: 'Être vivant microscopique pouvant être pathogène', theme: 'Système immunitaire et santé' },

  // ========================================
  // Environnement et développement durable
  // ========================================
  { word: 'POLLUTION', definition: 'Dégradation d\'un milieu par des substances nocives', theme: 'Environnement et développement durable' },
  { word: 'RECHAUFFEMENT', definition: 'Augmentation de la température moyenne de la planète', theme: 'Environnement et développement durable' },
  { word: 'DEFORESTATION', definition: 'Destruction massive des forêts', theme: 'Environnement et développement durable' },
  { word: 'RENOUVELABLE', definition: 'Source d\'énergie qui se reconstitue naturellement', theme: 'Environnement et développement durable' },
  { word: 'FOSSILE', definition: 'Énergie provenant de matière organique ancienne enfouie', theme: 'Environnement et développement durable' },
  { word: 'RECYCLAGE', definition: 'Transformation de déchets en nouvelles matières premières', theme: 'Environnement et développement durable' },
  { word: 'EMPREINTE', definition: 'Mesure de l\'impact des activités humaines sur l\'environnement', theme: 'Environnement et développement durable' },
  { word: 'ATMOSPHERE', definition: 'Couche de gaz entourant la Terre', theme: 'Environnement et développement durable' },
  { word: 'OZONE', definition: 'Gaz protégeant la Terre des rayons ultraviolets', theme: 'Environnement et développement durable' },
  { word: 'NAPPE', definition: 'Réserve d\'eau souterraine contenue dans les roches', theme: 'Environnement et développement durable' },
  { word: 'AQUIFERE', definition: 'Formation géologique contenant de l\'eau exploitable', theme: 'Environnement et développement durable' },
  { word: 'COMPOST', definition: 'Matière obtenue par décomposition de déchets organiques', theme: 'Environnement et développement durable' },
  { word: 'PESTICIDE', definition: 'Produit chimique utilisé pour éliminer les organismes nuisibles', theme: 'Environnement et développement durable' },
  { word: 'SURPECHE', definition: 'Pêche excessive menaçant la survie des espèces marines', theme: 'Environnement et développement durable' },
  { word: 'DURABLE', definition: 'Développement répondant aux besoins actuels sans compromettre l\'avenir', theme: 'Environnement et développement durable' },
  { word: 'BIOMASSE', definition: 'Matière organique utilisable comme source d\'énergie', theme: 'Environnement et développement durable' },
  { word: 'DESERTIFICATION', definition: 'Transformation progressive d\'une zone en désert', theme: 'Environnement et développement durable' },
  { word: 'EUTROPHISATION', definition: 'Enrichissement excessif d\'un milieu aquatique en nutriments', theme: 'Environnement et développement durable' },
];
