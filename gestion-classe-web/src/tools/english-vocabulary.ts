export interface EnglishTerm {
  word: string;
  definition: string;
  theme: string;
}

export const ENGLISH_THEMES = [
  'Verbes irréguliers 6ème',
  'Verbes irréguliers 5ème',
  'Verbes irréguliers 4ème',
  'Verbes irréguliers 3ème',
  'Vocabulary: Everyday Life',
  'Vocabulary: School & Education',
  'Vocabulary: Food & Cooking',
  'Vocabulary: Travel & Places',
  'Vocabulary: Body & Health',
  'Vocabulary: Feelings & Personality',
] as const;

export type EnglishTheme = (typeof ENGLISH_THEMES)[number];

export const ENGLISH_VOCABULARY: EnglishTerm[] = [
  // ========================================
  // Verbes irréguliers 6ème (A1)
  // ========================================
  { word: 'BE', definition: 'Être (was/were — been)', theme: 'Verbes irréguliers 6ème' },
  { word: 'HAVE', definition: 'Avoir (had — had)', theme: 'Verbes irréguliers 6ème' },
  { word: 'DO', definition: 'Faire (did — done)', theme: 'Verbes irréguliers 6ème' },
  { word: 'GO', definition: 'Aller (went — gone)', theme: 'Verbes irréguliers 6ème' },
  { word: 'COME', definition: 'Venir (came — come)', theme: 'Verbes irréguliers 6ème' },
  { word: 'SAY', definition: 'Dire (said — said)', theme: 'Verbes irréguliers 6ème' },
  { word: 'GET', definition: 'Obtenir (got — got)', theme: 'Verbes irréguliers 6ème' },
  { word: 'MAKE', definition: 'Fabriquer (made — made)', theme: 'Verbes irréguliers 6ème' },
  { word: 'SEE', definition: 'Voir (saw — seen)', theme: 'Verbes irréguliers 6ème' },
  { word: 'EAT', definition: 'Manger (ate — eaten)', theme: 'Verbes irréguliers 6ème' },
  { word: 'DRINK', definition: 'Boire (drank — drunk)', theme: 'Verbes irréguliers 6ème' },
  { word: 'GIVE', definition: 'Donner (gave — given)', theme: 'Verbes irréguliers 6ème' },
  { word: 'TAKE', definition: 'Prendre (took — taken)', theme: 'Verbes irréguliers 6ème' },
  { word: 'KNOW', definition: 'Savoir (knew — known)', theme: 'Verbes irréguliers 6ème' },
  { word: 'CAN', definition: 'Pouvoir (could)', theme: 'Verbes irréguliers 6ème' },

  // ========================================
  // Verbes irréguliers 5ème (A2)
  // ========================================
  { word: 'BUY', definition: 'Acheter (bought — bought)', theme: 'Verbes irréguliers 5ème' },
  { word: 'BRING', definition: 'Apporter (brought — brought)', theme: 'Verbes irréguliers 5ème' },
  { word: 'THINK', definition: 'Penser (thought — thought)', theme: 'Verbes irréguliers 5ème' },
  { word: 'FIND', definition: 'Trouver (found — found)', theme: 'Verbes irréguliers 5ème' },
  { word: 'TELL', definition: 'Raconter (told — told)', theme: 'Verbes irréguliers 5ème' },
  { word: 'WRITE', definition: 'Écrire (wrote — written)', theme: 'Verbes irréguliers 5ème' },
  { word: 'READ', definition: 'Lire (read — read)', theme: 'Verbes irréguliers 5ème' },
  { word: 'SPEAK', definition: 'Parler (spoke — spoken)', theme: 'Verbes irréguliers 5ème' },
  { word: 'RUN', definition: 'Courir (ran — run)', theme: 'Verbes irréguliers 5ème' },
  { word: 'SIT', definition: 'Être assis (sat — sat)', theme: 'Verbes irréguliers 5ème' },
  { word: 'STAND', definition: 'Être debout (stood — stood)', theme: 'Verbes irréguliers 5ème' },
  { word: 'PUT', definition: 'Mettre (put — put)', theme: 'Verbes irréguliers 5ème' },
  { word: 'LEAVE', definition: 'Partir (left — left)', theme: 'Verbes irréguliers 5ème' },
  { word: 'FEEL', definition: 'Ressentir (felt — felt)', theme: 'Verbes irréguliers 5ème' },
  { word: 'MEET', definition: 'Rencontrer (met — met)', theme: 'Verbes irréguliers 5ème' },
  { word: 'WIN', definition: 'Gagner (won — won)', theme: 'Verbes irréguliers 5ème' },
  { word: 'LOSE', definition: 'Perdre (lost — lost)', theme: 'Verbes irréguliers 5ème' },
  { word: 'SLEEP', definition: 'Dormir (slept — slept)', theme: 'Verbes irréguliers 5ème' },
  { word: 'KEEP', definition: 'Garder (kept — kept)', theme: 'Verbes irréguliers 5ème' },
  { word: 'BEGIN', definition: 'Commencer (began — begun)', theme: 'Verbes irréguliers 5ème' },

  // ========================================
  // Verbes irréguliers 4ème (A2+)
  // ========================================
  { word: 'BUILD', definition: 'Construire (built — built)', theme: 'Verbes irréguliers 4ème' },
  { word: 'BREAK', definition: 'Casser (broke — broken)', theme: 'Verbes irréguliers 4ème' },
  { word: 'CHOOSE', definition: 'Choisir (chose — chosen)', theme: 'Verbes irréguliers 4ème' },
  { word: 'CATCH', definition: 'Attraper (caught — caught)', theme: 'Verbes irréguliers 4ème' },
  { word: 'CUT', definition: 'Couper (cut — cut)', theme: 'Verbes irréguliers 4ème' },
  { word: 'DRAW', definition: 'Dessiner (drew — drawn)', theme: 'Verbes irréguliers 4ème' },
  { word: 'DRIVE', definition: 'Conduire (drove — driven)', theme: 'Verbes irréguliers 4ème' },
  { word: 'FALL', definition: 'Tomber (fell — fallen)', theme: 'Verbes irréguliers 4ème' },
  { word: 'FLY', definition: 'Voler (flew — flown)', theme: 'Verbes irréguliers 4ème' },
  { word: 'FORGET', definition: 'Oublier (forgot — forgotten)', theme: 'Verbes irréguliers 4ème' },
  { word: 'GROW', definition: 'Grandir (grew — grown)', theme: 'Verbes irréguliers 4ème' },
  { word: 'HEAR', definition: 'Entendre (heard — heard)', theme: 'Verbes irréguliers 4ème' },
  { word: 'HIDE', definition: 'Cacher (hid — hidden)', theme: 'Verbes irréguliers 4ème' },
  { word: 'HOLD', definition: 'Tenir (held — held)', theme: 'Verbes irréguliers 4ème' },
  { word: 'HURT', definition: 'Blesser (hurt — hurt)', theme: 'Verbes irréguliers 4ème' },
  { word: 'LEAD', definition: 'Mener (led — led)', theme: 'Verbes irréguliers 4ème' },
  { word: 'LEARN', definition: 'Apprendre (learnt — learnt)', theme: 'Verbes irréguliers 4ème' },
  { word: 'LEND', definition: 'Prêter (lent — lent)', theme: 'Verbes irréguliers 4ème' },
  { word: 'PAY', definition: 'Payer (paid — paid)', theme: 'Verbes irréguliers 4ème' },
  { word: 'RING', definition: 'Sonner (rang — rung)', theme: 'Verbes irréguliers 4ème' },
  { word: 'RISE', definition: 'Se lever (rose — risen)', theme: 'Verbes irréguliers 4ème' },
  { word: 'SEND', definition: 'Envoyer (sent — sent)', theme: 'Verbes irréguliers 4ème' },
  { word: 'SELL', definition: 'Vendre (sold — sold)', theme: 'Verbes irréguliers 4ème' },
  { word: 'SHOW', definition: 'Montrer (showed — shown)', theme: 'Verbes irréguliers 4ème' },
  { word: 'SING', definition: 'Chanter (sang — sung)', theme: 'Verbes irréguliers 4ème' },
  { word: 'SPEND', definition: 'Dépenser (spent — spent)', theme: 'Verbes irréguliers 4ème' },
  { word: 'STEAL', definition: 'Voler, dérober (stole — stolen)', theme: 'Verbes irréguliers 4ème' },
  { word: 'SWIM', definition: 'Nager (swam — swum)', theme: 'Verbes irréguliers 4ème' },
  { word: 'TEACH', definition: 'Enseigner (taught — taught)', theme: 'Verbes irréguliers 4ème' },
  { word: 'THROW', definition: 'Lancer (threw — thrown)', theme: 'Verbes irréguliers 4ème' },
  { word: 'UNDERSTAND', definition: 'Comprendre (understood — understood)', theme: 'Verbes irréguliers 4ème' },
  { word: 'WAKE', definition: 'Se réveiller (woke — woken)', theme: 'Verbes irréguliers 4ème' },
  { word: 'WEAR', definition: 'Porter un vêtement (wore — worn)', theme: 'Verbes irréguliers 4ème' },

  // ========================================
  // Verbes irréguliers 3ème (B1)
  // ========================================
  { word: 'BECOME', definition: 'Devenir (became — become)', theme: 'Verbes irréguliers 3ème' },
  { word: 'BEND', definition: 'Plier (bent — bent)', theme: 'Verbes irréguliers 3ème' },
  { word: 'BET', definition: 'Parier (bet — bet)', theme: 'Verbes irréguliers 3ème' },
  { word: 'BITE', definition: 'Mordre (bit — bitten)', theme: 'Verbes irréguliers 3ème' },
  { word: 'BLEED', definition: 'Saigner (bled — bled)', theme: 'Verbes irréguliers 3ème' },
  { word: 'BLOW', definition: 'Souffler (blew — blown)', theme: 'Verbes irréguliers 3ème' },
  { word: 'BURST', definition: 'Éclater (burst — burst)', theme: 'Verbes irréguliers 3ème' },
  { word: 'COST', definition: 'Coûter (cost — cost)', theme: 'Verbes irréguliers 3ème' },
  { word: 'DEAL', definition: 'Traiter (dealt — dealt)', theme: 'Verbes irréguliers 3ème' },
  { word: 'DIG', definition: 'Creuser (dug — dug)', theme: 'Verbes irréguliers 3ème' },
  { word: 'FEED', definition: 'Nourrir (fed — fed)', theme: 'Verbes irréguliers 3ème' },
  { word: 'FIGHT', definition: 'Se battre (fought — fought)', theme: 'Verbes irréguliers 3ème' },
  { word: 'FORBID', definition: 'Interdire (forbade — forbidden)', theme: 'Verbes irréguliers 3ème' },
  { word: 'FREEZE', definition: 'Geler (froze — frozen)', theme: 'Verbes irréguliers 3ème' },
  { word: 'HANG', definition: 'Pendre (hung — hung)', theme: 'Verbes irréguliers 3ème' },
  { word: 'HIT', definition: 'Frapper (hit — hit)', theme: 'Verbes irréguliers 3ème' },
  { word: 'LAY', definition: 'Poser (laid — laid)', theme: 'Verbes irréguliers 3ème' },
  { word: 'LET', definition: 'Laisser (let — let)', theme: 'Verbes irréguliers 3ème' },
  { word: 'LIGHT', definition: 'Allumer (lit — lit)', theme: 'Verbes irréguliers 3ème' },
  { word: 'MEAN', definition: 'Signifier (meant — meant)', theme: 'Verbes irréguliers 3ème' },
  { word: 'OVERCOME', definition: 'Surmonter (overcame — overcome)', theme: 'Verbes irréguliers 3ème' },
  { word: 'QUIT', definition: 'Quitter (quit — quit)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SEEK', definition: 'Chercher (sought — sought)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SET', definition: 'Fixer (set — set)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SHAKE', definition: 'Secouer (shook — shaken)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SHINE', definition: 'Briller (shone — shone)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SHOOT', definition: 'Tirer (shot — shot)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SHUT', definition: 'Fermer (shut — shut)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SLIDE', definition: 'Glisser (slid — slid)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SPREAD', definition: 'Répandre (spread — spread)', theme: 'Verbes irréguliers 3ème' },
  { word: 'STICK', definition: 'Coller (stuck — stuck)', theme: 'Verbes irréguliers 3ème' },
  { word: 'STRIKE', definition: 'Frapper (struck — struck)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SWEAR', definition: 'Jurer (swore — sworn)', theme: 'Verbes irréguliers 3ème' },
  { word: 'SWEEP', definition: 'Balayer (swept — swept)', theme: 'Verbes irréguliers 3ème' },
  { word: 'TEAR', definition: 'Déchirer (tore — torn)', theme: 'Verbes irréguliers 3ème' },
  { word: 'WITHDRAW', definition: 'Retirer (withdrew — withdrawn)', theme: 'Verbes irréguliers 3ème' },

  // ========================================
  // Vocabulary: Everyday Life
  // ========================================
  { word: 'BREAKFAST', definition: 'Petit-déjeuner', theme: 'Vocabulary: Everyday Life' },
  { word: 'LUNCH', definition: 'Déjeuner', theme: 'Vocabulary: Everyday Life' },
  { word: 'DINNER', definition: 'Dîner', theme: 'Vocabulary: Everyday Life' },
  { word: 'NEIGHBOURHOOD', definition: 'Quartier, voisinage', theme: 'Vocabulary: Everyday Life' },
  { word: 'HOUSEWORK', definition: 'Tâches ménagères', theme: 'Vocabulary: Everyday Life' },
  { word: 'SCHEDULE', definition: 'Emploi du temps', theme: 'Vocabulary: Everyday Life' },
  { word: 'COMMUTE', definition: 'Trajet domicile-travail', theme: 'Vocabulary: Everyday Life' },
  { word: 'CHORE', definition: 'Corvée, tâche du quotidien', theme: 'Vocabulary: Everyday Life' },
  { word: 'LEISURE', definition: 'Temps libre, loisirs', theme: 'Vocabulary: Everyday Life' },
  { word: 'GROCERY', definition: 'Courses alimentaires', theme: 'Vocabulary: Everyday Life' },
  { word: 'FURNITURE', definition: 'Mobilier, meubles', theme: 'Vocabulary: Everyday Life' },
  { word: 'APPLIANCE', definition: 'Appareil électroménager', theme: 'Vocabulary: Everyday Life' },
  { word: 'LAUNDRY', definition: 'Linge à laver', theme: 'Vocabulary: Everyday Life' },
  { word: 'APPOINTMENT', definition: 'Rendez-vous', theme: 'Vocabulary: Everyday Life' },
  { word: 'RECEIPT', definition: 'Ticket de caisse, reçu', theme: 'Vocabulary: Everyday Life' },

  // ========================================
  // Vocabulary: School & Education
  // ========================================
  { word: 'TIMETABLE', definition: 'Emploi du temps scolaire', theme: 'Vocabulary: School & Education' },
  { word: 'HOMEWORK', definition: 'Devoirs à la maison', theme: 'Vocabulary: School & Education' },
  { word: 'SUBJECT', definition: 'Matière scolaire', theme: 'Vocabulary: School & Education' },
  { word: 'ASSEMBLY', definition: 'Rassemblement de tous les élèves', theme: 'Vocabulary: School & Education' },
  { word: 'HEADTEACHER', definition: 'Directeur d\'école', theme: 'Vocabulary: School & Education' },
  { word: 'PUPIL', definition: 'Élève (primaire)', theme: 'Vocabulary: School & Education' },
  { word: 'SCHOLARSHIP', definition: 'Bourse d\'études', theme: 'Vocabulary: School & Education' },
  { word: 'BOARDING', definition: 'Internat, pensionnat', theme: 'Vocabulary: School & Education' },
  { word: 'DETENTION', definition: 'Retenue, colle', theme: 'Vocabulary: School & Education' },
  { word: 'PLAYGROUND', definition: 'Cour de récréation', theme: 'Vocabulary: School & Education' },
  { word: 'CANTEEN', definition: 'Cantine scolaire', theme: 'Vocabulary: School & Education' },
  { word: 'TERM', definition: 'Trimestre scolaire', theme: 'Vocabulary: School & Education' },
  { word: 'UNIFORM', definition: 'Uniforme scolaire', theme: 'Vocabulary: School & Education' },
  { word: 'CURRICULUM', definition: 'Programme scolaire', theme: 'Vocabulary: School & Education' },
  { word: 'ASSIGNMENT', definition: 'Travail, devoir à rendre', theme: 'Vocabulary: School & Education' },

  // ========================================
  // Vocabulary: Food & Cooking
  // ========================================
  { word: 'RECIPE', definition: 'Recette de cuisine', theme: 'Vocabulary: Food & Cooking' },
  { word: 'INGREDIENT', definition: 'Ingrédient', theme: 'Vocabulary: Food & Cooking' },
  { word: 'TABLESPOON', definition: 'Cuillère à soupe', theme: 'Vocabulary: Food & Cooking' },
  { word: 'OVEN', definition: 'Four', theme: 'Vocabulary: Food & Cooking' },
  { word: 'SAUCEPAN', definition: 'Casserole', theme: 'Vocabulary: Food & Cooking' },
  { word: 'BOWL', definition: 'Bol, saladier', theme: 'Vocabulary: Food & Cooking' },
  { word: 'FLOUR', definition: 'Farine', theme: 'Vocabulary: Food & Cooking' },
  { word: 'DOUGH', definition: 'Pâte (à pain, à pizza)', theme: 'Vocabulary: Food & Cooking' },
  { word: 'SEASONING', definition: 'Assaisonnement', theme: 'Vocabulary: Food & Cooking' },
  { word: 'BEVERAGE', definition: 'Boisson', theme: 'Vocabulary: Food & Cooking' },
  { word: 'SCRAMBLED', definition: 'Brouillé (œufs brouillés)', theme: 'Vocabulary: Food & Cooking' },
  { word: 'ROAST', definition: 'Rôti, rôtir', theme: 'Vocabulary: Food & Cooking' },
  { word: 'SLICE', definition: 'Tranche', theme: 'Vocabulary: Food & Cooking' },
  { word: 'LEFTOVERS', definition: 'Restes de repas', theme: 'Vocabulary: Food & Cooking' },
  { word: 'STARTER', definition: 'Entrée (plat)', theme: 'Vocabulary: Food & Cooking' },

  // ========================================
  // Vocabulary: Travel & Places
  // ========================================
  { word: 'ABROAD', definition: 'À l\'étranger', theme: 'Vocabulary: Travel & Places' },
  { word: 'LUGGAGE', definition: 'Bagages', theme: 'Vocabulary: Travel & Places' },
  { word: 'DEPARTURE', definition: 'Départ', theme: 'Vocabulary: Travel & Places' },
  { word: 'ARRIVAL', definition: 'Arrivée', theme: 'Vocabulary: Travel & Places' },
  { word: 'PLATFORM', definition: 'Quai de gare', theme: 'Vocabulary: Travel & Places' },
  { word: 'JOURNEY', definition: 'Voyage, trajet', theme: 'Vocabulary: Travel & Places' },
  { word: 'FLIGHT', definition: 'Vol (avion)', theme: 'Vocabulary: Travel & Places' },
  { word: 'CUSTOMS', definition: 'Douane', theme: 'Vocabulary: Travel & Places' },
  { word: 'PASSPORT', definition: 'Passeport', theme: 'Vocabulary: Travel & Places' },
  { word: 'LANDMARK', definition: 'Monument, point de repère', theme: 'Vocabulary: Travel & Places' },
  { word: 'SIGHTSEEING', definition: 'Tourisme, visite de sites', theme: 'Vocabulary: Travel & Places' },
  { word: 'ACCOMMODATION', definition: 'Hébergement', theme: 'Vocabulary: Travel & Places' },
  { word: 'EXCHANGE', definition: 'Échange (monnaie, séjour)', theme: 'Vocabulary: Travel & Places' },
  { word: 'HARBOUR', definition: 'Port', theme: 'Vocabulary: Travel & Places' },
  { word: 'DESTINATION', definition: 'Destination', theme: 'Vocabulary: Travel & Places' },

  // ========================================
  // Vocabulary: Body & Health
  // ========================================
  { word: 'HEADACHE', definition: 'Mal de tête', theme: 'Vocabulary: Body & Health' },
  { word: 'STOMACH', definition: 'Estomac, ventre', theme: 'Vocabulary: Body & Health' },
  { word: 'THROAT', definition: 'Gorge', theme: 'Vocabulary: Body & Health' },
  { word: 'SHOULDER', definition: 'Épaule', theme: 'Vocabulary: Body & Health' },
  { word: 'ANKLE', definition: 'Cheville', theme: 'Vocabulary: Body & Health' },
  { word: 'WRIST', definition: 'Poignet', theme: 'Vocabulary: Body & Health' },
  { word: 'COUGH', definition: 'Toux, tousser', theme: 'Vocabulary: Body & Health' },
  { word: 'FEVER', definition: 'Fièvre', theme: 'Vocabulary: Body & Health' },
  { word: 'INJURY', definition: 'Blessure', theme: 'Vocabulary: Body & Health' },
  { word: 'PRESCRIPTION', definition: 'Ordonnance médicale', theme: 'Vocabulary: Body & Health' },
  { word: 'BANDAGE', definition: 'Pansement, bandage', theme: 'Vocabulary: Body & Health' },
  { word: 'SYMPTOM', definition: 'Symptôme', theme: 'Vocabulary: Body & Health' },
  { word: 'DISEASE', definition: 'Maladie', theme: 'Vocabulary: Body & Health' },
  { word: 'RECOVERY', definition: 'Guérison, rétablissement', theme: 'Vocabulary: Body & Health' },
  { word: 'WHEELCHAIR', definition: 'Fauteuil roulant', theme: 'Vocabulary: Body & Health' },

  // ========================================
  // Vocabulary: Feelings & Personality
  // ========================================
  { word: 'ANXIOUS', definition: 'Anxieux, inquiet', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'PROUD', definition: 'Fier', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'GRATEFUL', definition: 'Reconnaissant', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'RELIEVED', definition: 'Soulagé', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'STUBBORN', definition: 'Têtu, obstiné', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'SELFISH', definition: 'Égoïste', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'GENEROUS', definition: 'Généreux', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'RELIABLE', definition: 'Fiable, sur qui on peut compter', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'OUTGOING', definition: 'Extraverti, sociable', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'MOODY', definition: 'D\'humeur changeante', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'CONFIDENT', definition: 'Sûr de soi, confiant', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'DISAPPOINTED', definition: 'Déçu', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'EMBARRASSED', definition: 'Gêné, embarrassé', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'OVERWHELMED', definition: 'Submergé, dépassé', theme: 'Vocabulary: Feelings & Personality' },
  { word: 'TRUSTWORTHY', definition: 'Digne de confiance', theme: 'Vocabulary: Feelings & Personality' },
];
