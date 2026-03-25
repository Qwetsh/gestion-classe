export interface GermanTerm {
  word: string;
  definition: string;
  theme: string;
}

export const GERMAN_THEMES = [
  'Verbes forts 6ème',
  'Verbes forts 5ème',
  'Verbes forts 4ème',
  'Verbes forts 3ème',
  'Vocabulary: Alltag',
  'Vocabulary: Schule',
  'Vocabulary: Essen und Trinken',
  'Vocabulary: Reisen und Orte',
  'Vocabulary: Körper und Gesundheit',
  'Vocabulary: Gefühle und Persönlichkeit',
] as const;

export type GermanTheme = (typeof GERMAN_THEMES)[number];

export const GERMAN_VOCABULARY: GermanTerm[] = [
  // ========================================
  // Verbes forts 6ème (A1)
  // ========================================
  { word: 'SEIN', definition: 'Être (war — gewesen)', theme: 'Verbes forts 6ème' },
  { word: 'HABEN', definition: 'Avoir (hatte — gehabt)', theme: 'Verbes forts 6ème' },
  { word: 'GEHEN', definition: 'Aller (ging — gegangen)', theme: 'Verbes forts 6ème' },
  { word: 'KOMMEN', definition: 'Venir (kam — gekommen)', theme: 'Verbes forts 6ème' },
  { word: 'SEHEN', definition: 'Voir (sah — gesehen)', theme: 'Verbes forts 6ème' },
  { word: 'ESSEN', definition: 'Manger (aß — gegessen)', theme: 'Verbes forts 6ème' },
  { word: 'TRINKEN', definition: 'Boire (trank — getrunken)', theme: 'Verbes forts 6ème' },
  { word: 'GEBEN', definition: 'Donner (gab — gegeben)', theme: 'Verbes forts 6ème' },
  { word: 'NEHMEN', definition: 'Prendre (nahm — genommen)', theme: 'Verbes forts 6ème' },
  { word: 'SPRECHEN', definition: 'Parler (sprach — gesprochen)', theme: 'Verbes forts 6ème' },
  { word: 'FAHREN', definition: 'Conduire, aller en véhicule (fuhr — gefahren)', theme: 'Verbes forts 6ème' },
  { word: 'LESEN', definition: 'Lire (las — gelesen)', theme: 'Verbes forts 6ème' },
  { word: 'SCHREIBEN', definition: 'Écrire (schrieb — geschrieben)', theme: 'Verbes forts 6ème' },
  { word: 'SCHLAFEN', definition: 'Dormir (schlief — geschlafen)', theme: 'Verbes forts 6ème' },
  { word: 'FINDEN', definition: 'Trouver (fand — gefunden)', theme: 'Verbes forts 6ème' },
  { word: 'STEHEN', definition: 'Être debout (stand — gestanden)', theme: 'Verbes forts 6ème' },
  { word: 'SITZEN', definition: 'Être assis (saß — gesessen)', theme: 'Verbes forts 6ème' },
  { word: 'LIEGEN', definition: 'Être couché (lag — gelegen)', theme: 'Verbes forts 6ème' },

  // ========================================
  // Verbes forts 5ème (A1-A2)
  // ========================================
  { word: 'TRAGEN', definition: 'Porter (trug — getragen)', theme: 'Verbes forts 5ème' },
  { word: 'LAUFEN', definition: 'Courir (lief — gelaufen)', theme: 'Verbes forts 5ème' },
  { word: 'FALLEN', definition: 'Tomber (fiel — gefallen)', theme: 'Verbes forts 5ème' },
  { word: 'HELFEN', definition: 'Aider (half — geholfen)', theme: 'Verbes forts 5ème' },
  { word: 'WERFEN', definition: 'Lancer (warf — geworfen)', theme: 'Verbes forts 5ème' },
  { word: 'FLIEGEN', definition: 'Voler (flog — geflogen)', theme: 'Verbes forts 5ème' },
  { word: 'SCHWIMMEN', definition: 'Nager (schwamm — geschwommen)', theme: 'Verbes forts 5ème' },
  { word: 'SINGEN', definition: 'Chanter (sang — gesungen)', theme: 'Verbes forts 5ème' },
  { word: 'VERGESSEN', definition: 'Oublier (vergaß — vergessen)', theme: 'Verbes forts 5ème' },
  { word: 'BEGINNEN', definition: 'Commencer (begann — begonnen)', theme: 'Verbes forts 5ème' },
  { word: 'GEWINNEN', definition: 'Gagner (gewann — gewonnen)', theme: 'Verbes forts 5ème' },
  { word: 'VERSTEHEN', definition: 'Comprendre (verstand — verstanden)', theme: 'Verbes forts 5ème' },
  { word: 'HALTEN', definition: 'Tenir, s\'arrêter (hielt — gehalten)', theme: 'Verbes forts 5ème' },
  { word: 'RUFEN', definition: 'Appeler (rief — gerufen)', theme: 'Verbes forts 5ème' },
  { word: 'WASCHEN', definition: 'Laver (wusch — gewaschen)', theme: 'Verbes forts 5ème' },
  { word: 'WACHSEN', definition: 'Grandir (wuchs — gewachsen)', theme: 'Verbes forts 5ème' },

  // ========================================
  // Verbes forts 4ème (A2-B1)
  // ========================================
  { word: 'BLEIBEN', definition: 'Rester (blieb — geblieben)', theme: 'Verbes forts 4ème' },
  { word: 'STERBEN', definition: 'Mourir (starb — gestorben)', theme: 'Verbes forts 4ème' },
  { word: 'BRECHEN', definition: 'Casser (brach — gebrochen)', theme: 'Verbes forts 4ème' },
  { word: 'TREFFEN', definition: 'Rencontrer (traf — getroffen)', theme: 'Verbes forts 4ème' },
  { word: 'ZIEHEN', definition: 'Tirer (zog — gezogen)', theme: 'Verbes forts 4ème' },
  { word: 'BIETEN', definition: 'Offrir (bot — geboten)', theme: 'Verbes forts 4ème' },
  { word: 'STREITEN', definition: 'Se disputer (stritt — gestritten)', theme: 'Verbes forts 4ème' },
  { word: 'EMPFEHLEN', definition: 'Recommander (empfahl — empfohlen)', theme: 'Verbes forts 4ème' },
  { word: 'ERSCHEINEN', definition: 'Apparaître (erschien — erschienen)', theme: 'Verbes forts 4ème' },
  { word: 'VERSCHWINDEN', definition: 'Disparaître (verschwand — verschwunden)', theme: 'Verbes forts 4ème' },
  { word: 'BESCHREIBEN', definition: 'Décrire (beschrieb — beschrieben)', theme: 'Verbes forts 4ème' },
  { word: 'VERLIEREN', definition: 'Perdre (verlor — verloren)', theme: 'Verbes forts 4ème' },
  { word: 'ENTSCHEIDEN', definition: 'Décider (entschied — entschieden)', theme: 'Verbes forts 4ème' },
  { word: 'VERGLEICHEN', definition: 'Comparer (verglich — verglichen)', theme: 'Verbes forts 4ème' },
  { word: 'BEWERBEN', definition: 'Postuler (bewarb — beworben)', theme: 'Verbes forts 4ème' },

  // ========================================
  // Verbes forts 3ème (B1)
  // ========================================
  { word: 'ZWINGEN', definition: 'Forcer (zwang — gezwungen)', theme: 'Verbes forts 3ème' },
  { word: 'VERMEIDEN', definition: 'Éviter (vermied — vermieden)', theme: 'Verbes forts 3ème' },
  { word: 'BETRAGEN', definition: 'S\'élever à, se comporter (betrug — betragen)', theme: 'Verbes forts 3ème' },
  { word: 'BEWEISEN', definition: 'Prouver (bewies — bewiesen)', theme: 'Verbes forts 3ème' },
  { word: 'GESTEHEN', definition: 'Avouer (gestand — gestanden)', theme: 'Verbes forts 3ème' },
  { word: 'ERGREIFEN', definition: 'Saisir (ergriff — ergriffen)', theme: 'Verbes forts 3ème' },
  { word: 'UNTERBRECHEN', definition: 'Interrompre (unterbrach — unterbrochen)', theme: 'Verbes forts 3ème' },
  { word: 'VORSCHLAGEN', definition: 'Proposer (schlug vor — vorgeschlagen)', theme: 'Verbes forts 3ème' },
  { word: 'HERAUSFINDEN', definition: 'Découvrir (fand heraus — herausgefunden)', theme: 'Verbes forts 3ème' },
  { word: 'AUFGEBEN', definition: 'Abandonner (gab auf — aufgegeben)', theme: 'Verbes forts 3ème' },
  { word: 'BEITRAGEN', definition: 'Contribuer (trug bei — beigetragen)', theme: 'Verbes forts 3ème' },
  { word: 'ZUNEHMEN', definition: 'Augmenter (nahm zu — zugenommen)', theme: 'Verbes forts 3ème' },
  { word: 'GELTEN', definition: 'Être valable (galt — gegolten)', theme: 'Verbes forts 3ème' },
  { word: 'LEIDEN', definition: 'Souffrir (litt — gelitten)', theme: 'Verbes forts 3ème' },

  // ========================================
  // Vocabulary: Alltag (Vie quotidienne)
  // ========================================
  { word: 'FRUHSTUCK', definition: 'Petit-déjeuner', theme: 'Vocabulary: Alltag' },
  { word: 'MITTAGESSEN', definition: 'Déjeuner, repas de midi', theme: 'Vocabulary: Alltag' },
  { word: 'ABENDESSEN', definition: 'Dîner, repas du soir', theme: 'Vocabulary: Alltag' },
  { word: 'WOHNUNG', definition: 'Appartement', theme: 'Vocabulary: Alltag' },
  { word: 'SCHLAFZIMMER', definition: 'Chambre à coucher', theme: 'Vocabulary: Alltag' },
  { word: 'KUCHE', definition: 'Cuisine', theme: 'Vocabulary: Alltag' },
  { word: 'BADEZIMMER', definition: 'Salle de bain', theme: 'Vocabulary: Alltag' },
  { word: 'WOHNZIMMER', definition: 'Salon, salle de séjour', theme: 'Vocabulary: Alltag' },
  { word: 'NACHBAR', definition: 'Voisin', theme: 'Vocabulary: Alltag' },
  { word: 'HAUSTIER', definition: 'Animal domestique', theme: 'Vocabulary: Alltag' },
  { word: 'EINKAUFEN', definition: 'Faire des courses', theme: 'Vocabulary: Alltag' },
  { word: 'AUFSTEHEN', definition: 'Se lever', theme: 'Vocabulary: Alltag' },
  { word: 'AUFRAUMEN', definition: 'Ranger', theme: 'Vocabulary: Alltag' },
  { word: 'FERNSEHEN', definition: 'Regarder la télévision', theme: 'Vocabulary: Alltag' },
  { word: 'ZEITUNG', definition: 'Journal', theme: 'Vocabulary: Alltag' },
  { word: 'HANDY', definition: 'Téléphone portable', theme: 'Vocabulary: Alltag' },

  // ========================================
  // Vocabulary: Schule (École)
  // ========================================
  { word: 'SCHULER', definition: 'Élève', theme: 'Vocabulary: Schule' },
  { word: 'LEHRER', definition: 'Professeur, enseignant', theme: 'Vocabulary: Schule' },
  { word: 'UNTERRICHT', definition: 'Cours, enseignement', theme: 'Vocabulary: Schule' },
  { word: 'HAUSAUFGABE', definition: 'Devoir à la maison', theme: 'Vocabulary: Schule' },
  { word: 'KLASSENARBEIT', definition: 'Contrôle, évaluation écrite', theme: 'Vocabulary: Schule' },
  { word: 'STUNDENPLAN', definition: 'Emploi du temps', theme: 'Vocabulary: Schule' },
  { word: 'FACH', definition: 'Matière scolaire', theme: 'Vocabulary: Schule' },
  { word: 'ZEUGNIS', definition: 'Bulletin scolaire', theme: 'Vocabulary: Schule' },
  { word: 'TAFEL', definition: 'Tableau noir', theme: 'Vocabulary: Schule' },
  { word: 'HEFT', definition: 'Cahier', theme: 'Vocabulary: Schule' },
  { word: 'KUGELSCHREIBER', definition: 'Stylo à bille', theme: 'Vocabulary: Schule' },
  { word: 'BLEISTIFT', definition: 'Crayon à papier', theme: 'Vocabulary: Schule' },
  { word: 'SCHULHOF', definition: 'Cour de récréation', theme: 'Vocabulary: Schule' },
  { word: 'PAUSE', definition: 'Récréation', theme: 'Vocabulary: Schule' },
  { word: 'BIBLIOTHEK', definition: 'Bibliothèque', theme: 'Vocabulary: Schule' },

  // ========================================
  // Vocabulary: Essen und Trinken (Nourriture et boisson)
  // ========================================
  { word: 'BROT', definition: 'Pain', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'KARTOFFEL', definition: 'Pomme de terre', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'FLEISCH', definition: 'Viande', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'GEMUSE', definition: 'Légumes', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'OBST', definition: 'Fruits', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'KUCHEN', definition: 'Gâteau', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'WURST', definition: 'Saucisse, charcuterie', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'KASE', definition: 'Fromage', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'MILCH', definition: 'Lait', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'WASSER', definition: 'Eau', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'SAFT', definition: 'Jus de fruit', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'ZUCKER', definition: 'Sucre', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'SALZ', definition: 'Sel', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'REIS', definition: 'Riz', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'NUDELN', definition: 'Pâtes', theme: 'Vocabulary: Essen und Trinken' },
  { word: 'HONIG', definition: 'Miel', theme: 'Vocabulary: Essen und Trinken' },

  // ========================================
  // Vocabulary: Reisen und Orte (Voyages et lieux)
  // ========================================
  { word: 'BAHNHOF', definition: 'Gare', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'FLUGHAFEN', definition: 'Aéroport', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'FAHRKARTE', definition: 'Billet de transport', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'KOFFER', definition: 'Valise', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'UNTERKUNFT', definition: 'Hébergement, logement', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'STRAND', definition: 'Plage', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'GEBIRGE', definition: 'Montagne, chaîne de montagnes', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'LANDSCHAFT', definition: 'Paysage', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'SEHENSWURDIGKEIT', definition: 'Curiosité touristique, monument à visiter', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'RATHAUS', definition: 'Mairie, hôtel de ville', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'MARKTPLATZ', definition: 'Place du marché', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'BRUCKE', definition: 'Pont', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'KIRCHE', definition: 'Église', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'SCHLOSS', definition: 'Château', theme: 'Vocabulary: Reisen und Orte' },
  { word: 'AUSLAND', definition: 'Étranger, pays étranger', theme: 'Vocabulary: Reisen und Orte' },

  // ========================================
  // Vocabulary: Körper und Gesundheit (Corps et santé)
  // ========================================
  { word: 'KOPF', definition: 'Tête', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'HAND', definition: 'Main', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'AUGE', definition: 'Œil', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'HERZ', definition: 'Cœur', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'BAUCH', definition: 'Ventre', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'RUCKEN', definition: 'Dos', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'ZAHNARZT', definition: 'Dentiste', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'KRANKENHAUS', definition: 'Hôpital', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'APOTHEKE', definition: 'Pharmacie', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'ERHOLUNG', definition: 'Repos, récupération', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'SCHMERZ', definition: 'Douleur', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'FIEBER', definition: 'Fièvre', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'HUSTEN', definition: 'Toux', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'SCHNUPFEN', definition: 'Rhume', theme: 'Vocabulary: Körper und Gesundheit' },
  { word: 'GESUNDHEIT', definition: 'Santé', theme: 'Vocabulary: Körper und Gesundheit' },

  // ========================================
  // Vocabulary: Gefühle und Persönlichkeit (Sentiments et personnalité)
  // ========================================
  { word: 'FREUDE', definition: 'Joie', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'TRAURIGKEIT', definition: 'Tristesse', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'ANGST', definition: 'Peur, angoisse', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'HOFFNUNG', definition: 'Espoir', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'ENTTAUSCHUNG', definition: 'Déception', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'EIFERSUCHT', definition: 'Jalousie', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'STOLZ', definition: 'Fierté', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'GEDULD', definition: 'Patience', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'EHRLICH', definition: 'Honnête', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'MUTIG', definition: 'Courageux', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'FLEISSIG', definition: 'Travailleur, assidu', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'FREUNDLICH', definition: 'Aimable, sympathique', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'NEUGIERIG', definition: 'Curieux', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'ZUVERLASSIG', definition: 'Fiable, digne de confiance', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'SELBSTBEWUSST', definition: 'Sûr de soi, confiant', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
  { word: 'SCHUCHTERN', definition: 'Timide', theme: 'Vocabulary: Gefühle und Persönlichkeit' },
];
