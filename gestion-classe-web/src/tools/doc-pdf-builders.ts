import { jsPDF } from 'jspdf';

// ── Types ──

export interface DeplacementData {
  anneeScolaire: string;
  etablissement: string;
}

export interface RapportData {
  academie: string;
  region: string;
  etablissement: string;
  adresse: string;
  tel: string;
  email: string;
  siteWeb: string;
  date: string;
  redacteur: string;
  lieuDateHeure: string;
  elevesConcernes: string;
  faits: string;
  punitions: string[];
  sanctions: string[];
  exclusionClasse: boolean;
  exclusionCollege: boolean;
}

export interface SupportItem {
  label: string;
  detail: string;
}

export interface CaptationData {
  etablissement: string;
  tel: string;
  codepostal: string;
  annee: string;
  classe: string;
  finalites: string;
  projet: string;
  titreOeuvre: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  supports: SupportItem[];
}

export interface SortieData {
  organisateur: string;
  fonction: string;
  date: string;
  classe: string;
  lieu: string;
  heureDepart: string;
  heureRetour: string;
  matiere: string;
  objectifs: string;
  transport: string;
  dateRetourCoupon: string;
  lieuDepart: string;
  lieuArrivee: string;
}

export interface Eleve {
  nom: string;
  prenom: string;
  sexe: string;
  tel: string;
}

export interface ClasseRow {
  nom: string;
  effectif: string;
  participants: string;
}

export interface AccompRow {
  nom: string;
  qualite: string;
  tel: string;
}

export interface BudgetData {
  nbFamilles: number;
  montantFamille: number;
  etablissement: number;
  dons: number;
  subCommune: number;
  subDept: number;
  subRegion: number;
  subEtat: number;
  subAutres: number;
  depBus: number;
  depTrain: number;
  depAvion: number;
  depTransportAutre: number;
  depHebergement: number;
  depRepas: number;
  depActivites: number;
  depMateriel: number;
  depDivers: number;
}

export interface DemandeData {
  pays: string;
  departement: string;
  adresse: string;
  nature: string;
  type: string;
  reciprocite: string;
  hebergement: string;
  transport: string;
  transportPrecision: string;
  responsable: string;
  qualite: string;
  telUrgence: string;
  telChef: string;
  dateDepart: string;
  heureDepart: string;
  dateRetour: string;
  heureRetour: string;
  lieuDepart: string;
  lieuRetour: string;
  nbJournees: string;
  classes: ClasseRow[];
  domaines: string[];
  disciplines: string;
  objectifs: string;
  liens: string;
  activites: string;
  travauxPrepa: string;
  restitution: string;
  nonParticipants: string;
  datePrepa: string;
  dateBilan: string;
  budget: BudgetData;
  accompagnateurs: AccompRow[];
  eleves: Eleve[];
  elevesClasse: string;
  incidences: string;
}

// ── Constants ──

const W = 210, H = 297;
const BLUE: [number, number, number] = [0, 0, 145];
const LIGHT_BG: [number, number, number] = [245, 245, 254];
const BLACK: [number, number, number] = [0, 0, 0];
const GRAY: [number, number, number] = [100, 100, 100];

// ── Shared Helpers ──

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function setFont(doc: jsPDF, style: string, size: number, color: [number, number, number]) {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function wrappedText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lh: number): number {
  const lines = doc.splitTextToSize(text, maxW);
  doc.text(lines, x, y);
  return y + lines.length * lh;
}

export async function loadLogoPNG(): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = '/tools/logo-academie.svg';
  });
}

// ══════════════════════════════════════════
// CAPTATION PDF
// ══════════════════════════════════════════

export function buildCaptationPDF(data: CaptationData, logoPNG: string | null): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML = 20, MR = 20, CW = W - ML - MR;
  let y = 10;

  function sectionTitle(num: string, title: string, startY: number): number {
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(0.5);
    doc.line(ML, startY, ML + CW, startY);
    startY += 5;
    setFont(doc, 'bold', 10, BLUE);
    doc.text(`${num} - ${title}`, ML, startY);
    return startY + 2;
  }

  function checkPage(needed: number): number {
    if (y + needed > H - 15) { doc.addPage(); y = 20; }
    return y;
  }

  // Header
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 8, 'F');

  if (logoPNG) doc.addImage(logoPNG, 'PNG', ML, 10, 25, 25);

  setFont(doc, 'bold', 13, BLUE);
  doc.text("AUTORISATION DE CAPTATION ET", W / 2, 18, { align: 'center' });
  setFont(doc, 'bold', 13, BLUE);
  doc.text("D'UTILISATION D'IMAGE/VOIX", W / 2, 24, { align: 'center' });

  y = 32;
  setFont(doc, 'italic', 8, GRAY);
  doc.text('Ecole / Etablissement scolaire public', W / 2, y, { align: 'center' });

  y = 40;
  doc.setFillColor(248, 248, 255);
  doc.roundedRect(ML, y, CW, 22, 2, 2, 'F');

  y += 6;
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Ecole ou etablissement scolaire :", ML + 3, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.etablissement, ML + 3 + doc.getTextWidth("Ecole ou etablissement scolaire :") + 2, y);

  y += 6;
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Telephone :", ML + 3, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.tel, ML + 3 + doc.getTextWidth("Telephone :") + 2, y);
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Code postal / Commune :", W / 2, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.codepostal, W / 2 + doc.getTextWidth("Code postal / Commune :") + 2, y);

  y += 7;
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Annee scolaire :", ML + 3, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.annee, ML + 3 + doc.getTextWidth("Annee scolaire :") + 2, y);
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Classe de :", W / 2, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.classe, W / 2 + doc.getTextWidth("Classe de :") + 2, y);

  // Section 1
  y += 14;
  y = sectionTitle('1', 'Finalites envisagees', y);
  y += 2;
  setFont(doc, 'italic', 8, GRAY);
  doc.text("Gestion administrative, activites pedagogiques,", ML, y);
  y += 3.5;
  doc.text("Merci de detailler autant que possible les differentes finalites envisagees et de les completer si besoin :", ML, y);
  y += 5;
  setFont(doc, 'normal', 9, BLACK);
  y = wrappedText(doc, data.finalites || '(non precise)', ML, y, CW, 4);

  // Section 2
  y += 6;
  y = sectionTitle('2', 'Designation du projet audio-visuel', y);
  y += 2;
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Projet :", ML, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(`\u00AB ${data.projet} \u00BB`, ML + doc.getTextWidth("Projet :") + 2, y);

  y += 6;
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Titre de l'oeuvre si applicable :", ML, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.titreOeuvre || '', ML + doc.getTextWidth("Titre de l'oeuvre si applicable :") + 2, y);

  y += 6;
  setFont(doc, 'normal', 8.5, BLACK);
  doc.text("L'enregistrement aura lieu aux dates/moments et lieux indiques ci-apres.", ML, y);

  y += 5;
  setFont(doc, 'bold', 9, BLACK);
  const dateLabel = "Date(s) d'enregistrement :";
  doc.text(dateLabel, ML, y);
  setFont(doc, 'normal', 9, [200, 0, 0]);
  const dateRange = `du ${data.dateDebut || '...'} au ${data.dateFin || '...'}`;
  doc.text(dateRange, ML + doc.getTextWidth(dateLabel) + 2, y);

  setFont(doc, 'bold', 9, BLACK);
  const lieuX = ML + doc.getTextWidth(dateLabel) + 2 + doc.getTextWidth(dateRange) + 6;
  doc.text("Lieu(x) :", Math.min(lieuX, W / 2 + 20), y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.lieu || '', Math.min(lieuX, W / 2 + 20) + doc.getTextWidth("Lieu(x) :") + 2, y);

  y += 6;
  setFont(doc, 'normal', 7.5, BLACK);
  y = wrappedText(doc,
    "La presente autorisation est consentie a titre gratuit. Le producteur de l'oeuvre audiovisuelle creee ou le beneficiaire de l'enregistrement exercera l'integralite des droits d'exploitation attaches a cette oeuvre/cet enregistrement. L'oeuvre/l'enregistrement demeurera sa propriete exclusive. Le producteur/le beneficiaire de l'autorisation, s'interdit expressement de ceder les presentes autorisations a un tiers.",
    ML, y, CW, 3.2);

  y += 2;
  setFont(doc, 'italic', 7, GRAY);
  doc.text("* Le cas echeant", ML, y);

  // Section 3: Modes d'exploitation
  y += 8;
  y = checkPage(40);
  y = sectionTitle('3', "Modes d'exploitation envisagees", y);

  y += 2;
  setFont(doc, 'italic', 7.5, GRAY);
  doc.text("Pour chaque support, le(s) representant(s) legal(aux) coche(nt) la case correspondant a leur choix.", ML, y);
  y += 3;
  doc.text("Conservation : 1 annee scolaire pour tous les supports.", ML, y);
  y += 6;

  const colAuth = ML;
  const colSupport = ML + 28;
  const colDetail = ML + 90;

  doc.setFillColor(...LIGHT_BG);
  doc.rect(ML, y - 3.5, CW, 7, 'F');
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(ML, y + 3.5, ML + CW, y + 3.5);

  setFont(doc, 'bold', 8, BLUE);
  doc.text('Autorisation', colAuth + 1, y);
  doc.text('Support', colSupport + 1, y);
  doc.text("Precision / Etendue", colDetail + 1, y);
  y += 8;

  for (const support of data.supports) {
    y = checkPage(16);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(colAuth + 1, y - 2.5, 3, 3);
    setFont(doc, 'normal', 7, BLACK);
    doc.text('OUI', colAuth + 5.5, y);
    doc.rect(colAuth + 14, y - 2.5, 3, 3);
    doc.text('NON', colAuth + 18.5, y);

    setFont(doc, 'bold', 8, BLACK);
    const supportLines = doc.splitTextToSize(support.label, 58);
    doc.text(supportLines, colSupport + 1, y);

    setFont(doc, 'normal', 7, GRAY);
    const detailLines = support.detail ? doc.splitTextToSize(support.detail, CW - 90) : [];
    if (detailLines.length) doc.text(detailLines, colDetail + 1, y);

    const rowH = Math.max(supportLines.length, detailLines.length, 1) * 3.5 + 5;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(ML, y + rowH - 4, ML + CW, y + rowH - 4);
    y += rowH;
  }

  // Section 4: Consentement eleve
  y += 4;
  y = checkPage(50);
  y = sectionTitle('4', "Consentement de l'eleve", y);
  y += 2;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("On m'a explique et j'ai compris a quoi servait ce projet.", ML, y); y += 5;
  doc.text("On m'a explique et j'ai compris qui pourrait voir cet enregistrement.", ML, y); y += 5;
  doc.text("Et je suis d'accord pour que l'on enregistre, pour ce projet,     mon image     ma voix.", ML, y);
  y += 4;
  doc.rect(ML + doc.getTextWidth("Et je suis d'accord pour que l'on enregistre, pour ce projet,  "), y - 7, 3, 3);
  doc.rect(ML + doc.getTextWidth("Et je suis d'accord pour que l'on enregistre, pour ce projet,     mon image  "), y - 7, 3, 3);

  y += 4;
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Nom prenom de l'eleve :", ML, y);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(ML + doc.getTextWidth("Nom prenom de l'eleve :") + 2, y + 1, ML + CW, y + 1);
  y += 8;
  doc.text("Signature :", ML + CW - 30, y);

  // Section 5: Autorisation parentale
  y += 10;
  y = checkPage(65);
  y = sectionTitle('5', 'Autorisation parentale', y);
  y += 2;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("Je (Nous) soussigne(e)(s) :", ML, y);
  setFont(doc, 'italic', 9, GRAY);
  doc.text("[Nom - Prenom]", ML + doc.getTextWidth("Je (Nous) soussigne(e)(s) :") + 2, y);
  y += 5;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("Demeurant :", ML, y);
  setFont(doc, 'italic', 9, GRAY);
  doc.text("[adresse]", ML + doc.getTextWidth("Demeurant :") + 2, y);
  y += 5;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("Et :", ML, y);
  setFont(doc, 'italic', 9, GRAY);
  doc.text("[Nom - Prenom]", ML + doc.getTextWidth("Et :") + 2, y);
  y += 5;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("Demeurant :", ML, y);
  setFont(doc, 'italic', 9, GRAY);
  doc.text("[adresses a preciser si differentes]", ML + doc.getTextWidth("Demeurant :") + 2, y);
  y += 5;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("Agissant en qualite de representant(s) legal(aux) de :", ML, y);
  setFont(doc, 'italic', 9, GRAY);
  doc.text("[Nom - Prenom de l'eleve]", ML + doc.getTextWidth("Agissant en qualite de representant(s) legal(aux) de :") + 2, y);
  y += 7;

  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc,
    "Je reconnais etre entierement investi de mes droits civils a son egard. Je reconnais expressement que le mineur que je represente n'est lie par aucun contrat exclusif pour l'utilisation de son image et/ou de sa voix, voire de son nom et",
    ML, y, CW, 3.5);

  y += 3;
  doc.rect(ML + 2, y - 3, 3, 3);
  setFont(doc, 'bold', 8.5, BLACK);
  doc.text("autorise(ons) la captation de l'image / de la voix de l'enfant et l'utilisation qui en sera faite par son ecole /", ML + 7, y);
  y += 4;
  doc.text("etablissement scolaire.", ML + 7, y);

  y += 6;
  doc.rect(ML + 2, y - 3, 3, 3);
  doc.text("n'autorise(ons) pas la captation de l'image / de la voix de l'enfant.", ML + 7, y);

  y += 6;
  setFont(doc, 'normal', 8.5, BLACK);
  doc.text('Merci d\'ecrire lisiblement le mot "REFUS" : _______________', ML + 10, y);

  y += 8;
  setFont(doc, 'normal', 9, BLACK);
  doc.text("Fait a .............................................", ML, y);
  y += 6;
  doc.text("Le .................................................", ML, y);
  doc.text("Signature (s) :", ML + CW - 40, y);

  // Section 6: Droits
  y += 10;
  y = checkPage(50);
  y = sectionTitle('6', 'Pour exercer vos droits', y);
  y += 2;
  setFont(doc, 'normal', 7.5, BLACK);
  y = wrappedText(doc,
    "Les donnees recueillies au sein de ce formulaire font l'objet d'un traitement par le chef d'etablissement pour les colleges et lycees ou le directeur academique des services de l'education nationale pour les ecoles afin de repondre a une mission d'interet public. Ces donnees ne sont pas conservees au-dela de l'annee scolaire relative a la presente autorisation. Les informations vous concernant ainsi que votre enfant ne sont transmises qu'aux seules personnes en charge du traitement de la presente autorisation.",
    ML, y, CW, 3.2);
  y += 4;
  y = wrappedText(doc,
    "Vous disposez d'un droit d'acces aux donnees vous concernant, d'un droit de rectification, d'un droit d'opposition et d'un droit a la limitation du traitement de vos donnees. Vous disposez egalement d'un droit a l'effacement concernant l'image/la voix enregistree et utilisee dans le cadre decrit ci-dessus.",
    ML, y, CW, 3.2);
  y += 4;
  y = wrappedText(doc,
    "Pour exercer vos droits ou pour toute question sur le traitement de vos donnees, vous pouvez contacter le delegue a la protection des donnees a l'adresse suivante: dpd@ac-nancy-metz.fr Si vous estimez que vos droits ne sont pas respectes vous pouvez adresser une reclamation aupres de la CNIL, en ligne sur www.cnil.fr ou par voie postale a l'adresse suivante : 3 place de Fontenoy - TSA 80715 - 75334 PARIS Cedex 07",
    ML, y, CW, 3.2);
  y += 6;
  setFont(doc, 'bold', 8.5, BLACK);
  doc.text("Fait en autant d'originaux que necessaire (representants legaux, organisateur projet et etablissement scolaire).", W / 2, y, { align: 'center' });

  // Page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setFont(doc, 'normal', 8, GRAY);
    doc.text(`${p}/${totalPages}`, W - MR, H - 10, { align: 'right' });
  }

  return doc;
}

// ══════════════════════════════════════════
// SORTIE SCOLAIRE PDF
// ══════════════════════════════════════════

export function buildSortiePDF(data: SortieData, logoPNG: string | null): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML = 20, MR = 20, CW = W - ML - MR;
  let y = 10;

  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 8, 'F');

  if (logoPNG) doc.addImage(logoPNG, 'PNG', ML, 10, 25, 25);

  y = 16;
  setFont(doc, 'bold', 10, BLUE);
  doc.text('College Pierre Mendes France', W - MR, y, { align: 'right' });
  setFont(doc, 'normal', 8, GRAY);
  doc.text('57140 WOIPPY - Tel. 03 87 54 36 40', W - MR, y + 5, { align: 'right' });

  y = 42;
  setFont(doc, 'bold', 14, BLUE);
  doc.text('INFORMATION AUX PARENTS', W / 2, y, { align: 'center' });
  y += 6;
  setFont(doc, 'bold', 12, BLUE);
  doc.text('Sortie scolaire obligatoire', W / 2, y, { align: 'center' });
  y += 2;
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.5);
  const tw = doc.getTextWidth('Sortie scolaire obligatoire');
  doc.line((W - tw) / 2, y, (W + tw) / 2, y);

  y += 10;
  setFont(doc, 'normal', 10, BLACK);
  doc.text('Madame, Monsieur,', ML, y);
  y += 8;
  doc.text('Une sortie pedagogique ', ML, y);
  setFont(doc, 'bold', 10, BLACK);
  doc.text('gratuite', ML + doc.getTextWidth('Une sortie pedagogique '), y);
  setFont(doc, 'normal', 10, BLACK);
  doc.text(' est organisee par :', ML + doc.getTextWidth('Une sortie pedagogique ') + doc.getTextWidth('gratuite'), y);

  // Info box
  y += 6;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ML, y, CW, 42, 2, 2, 'F');

  y += 6;
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Organisateur :', ML + 4, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(`${data.organisateur} (${data.fonction})`, ML + 36, y);

  y += 6;
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Date :', ML + 4, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.date || '...', ML + 20, y);
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Classe(s) :', W / 2 + 10, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.classe || '...', W / 2 + 36, y);

  y += 6;
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Lieu :', ML + 4, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.lieu || '...', ML + 20, y);

  y += 6;
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Horaires :', ML + 4, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(`De ${data.heureDepart || '...'} a ${data.heureRetour || '...'}`, ML + 28, y);

  y += 6;
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Matiere(s) :', ML + 4, y);
  setFont(doc, 'normal', 9, BLACK);
  doc.text(data.matiere || '...', ML + 28, y);

  y += 6;
  setFont(doc, 'bold', 9, BLUE);
  doc.text('Objectifs :', ML + 4, y);
  setFont(doc, 'normal', 9, BLACK);
  const objLines = doc.splitTextToSize(data.objectifs || '...', CW - 32);
  doc.text(objLines, ML + 28, y);

  const objH = objLines.length * 4;
  y += objH + 4;

  // Important notice
  y += 4;
  doc.setFillColor(255, 245, 230);
  doc.setDrawColor(220, 120, 0);
  doc.setLineWidth(0.4);
  doc.roundedRect(ML, y, CW, 10, 2, 2, 'FD');
  setFont(doc, 'bold', 10, [220, 120, 0]);
  doc.text('Cette sortie, organisee sur le temps scolaire, est gratuite et donc obligatoire.', ML + 4, y + 7);

  y += 16;
  setFont(doc, 'normal', 9, BLACK);
  y = wrappedText(doc, "Le reglement interieur de l'etablissement s'applique aux eleves pendant la sortie.", ML, y, CW, 4);
  y += 4;
  y = wrappedText(doc, "Nous vous remercions de nous signaler tout probleme physique auquel votre enfant pourrait etre sujet pendant la sortie (allergie, precautions particulieres).", ML, y, CW, 4);

  // Separator
  y += 8;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(ML, y, ML + CW, y);
  doc.setLineDashPattern([], 0);
  setFont(doc, 'normal', 10, GRAY);
  doc.text('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', ML, y + 1);

  // Accuse de reception
  y += 8;
  setFont(doc, 'bold', 12, BLUE);
  doc.text("ACCUSE DE RECEPTION D'INFORMATION", W / 2, y, { align: 'center' });
  y += 5;
  doc.text('DE SORTIE SCOLAIRE OBLIGATOIRE', W / 2, y, { align: 'center' });

  y += 7;
  setFont(doc, 'bold', 9, BLACK);
  doc.text(`A retourner a  ${data.organisateur || 'M/Mme _______________'}`, ML, y);
  doc.text(`Avant le :  ${data.dateRetourCoupon || '___ / ___ / 20___'}`, W - MR, y, { align: 'right' });

  y += 8;
  setFont(doc, 'normal', 9, BLACK);
  doc.text('Je soussigne(e) (Nom, Prenom) : ________________________________________________', ML, y);
  y += 6;
  doc.text('Representant legal de l\'eleve (Nom, Prenom) : _______________________________________ Classe : ______', ML, y);
  y += 6;
  doc.text(`accuse reception de l'information de sortie scolaire gratuite et obligatoire organisee le ${data.date || '___ / ___ / 20___'}.`, ML, y);
  y += 6;
  doc.text(`Heure de depart :  ${data.heureDepart || '___h___'}   -   Heure de retour :  ${data.heureRetour || '___h___'}`, ML, y);
  y += 6;
  doc.text(`Lieu de la sortie :  ${data.lieu || '______________________________'}`, ML, y);
  doc.text(`Mode de transport :  ${data.transport}`, W / 2 + 10, y);
  y += 6;
  doc.text(`Lieu de depart :  ${data.lieuDepart}   -   Lieu d'arrivee :  ${data.lieuArrivee}`, ML, y);

  y += 8;
  setFont(doc, 'normal', 8.5, BLACK);
  y = wrappedText(doc,
    "Je declare avoir souscrit une assurance responsabilite civile et garantie individuelle aupres de la societe ________________________________________________ (Police n ______________________________________).",
    ML, y, CW, 3.5);

  y += 5;
  setFont(doc, 'bold', 8.5, BLACK);
  doc.text('Mon enfant presente le probleme physique suivant auquel il pourrait etre sujet au cours de la sortie :', ML, y);
  y += 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + CW, y);
  y += 4;
  doc.line(ML, y, ML + CW, y);

  y += 6;
  doc.rect(ML, y - 3, 3, 3);
  doc.text('Un PAI (Projet d\'Accueil Individualise) a ete complete et valide durant cette annee scolaire.', ML + 5, y);
  y += 6;
  doc.rect(ML, y - 3, 3, 3);
  doc.text('J\'autorise l\'organisateur/trice de la sortie a prendre les mesures d\'urgence en cas d\'accident.', ML + 5, y);

  y += 8;
  setFont(doc, 'normal', 9, BLACK);
  doc.text('Date : ___________________', ML, y);
  doc.text('Signature du representant legal :', W / 2 + 10, y);

  setFont(doc, 'normal', 8, GRAY);
  doc.text('College Pierre Mendes France - Woippy', ML, H - 10);

  return doc;
}

// ══════════════════════════════════════════
// DEMANDE SORTIE/SEJOUR PDF
// ══════════════════════════════════════════

export function buildDemandePDF(data: DemandeData, logoPNG: string | null): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML = 15, MR = 15, CW = W - ML - MR;
  let y = 10;

  function checkPage(needed: number) {
    if (y + needed > H - 15) { doc.addPage(); y = 15; }
    return y;
  }
  function lbl(text: string, x: number, yy: number) { setFont(doc, 'bold', 8, BLUE); doc.text(text, x, yy); }
  function val(text: string, x: number, yy: number) { setFont(doc, 'normal', 8, BLACK); doc.text(text || '', x, yy); }
  function sHead(title: string) {
    y = checkPage(12);
    doc.setFillColor(...BLUE);
    doc.roundedRect(ML, y, CW, 7, 1, 1, 'F');
    setFont(doc, 'bold', 9, [255, 255, 255]);
    doc.text(title, ML + 3, y + 5);
    y += 10;
  }

  // Header
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, W, 6, 'F');
  if (logoPNG) doc.addImage(logoPNG, 'PNG', ML, 8, 20, 20);

  setFont(doc, 'bold', 14, BLUE);
  doc.text('SORTIES ET SEJOURS COLLECTIFS', W / 2, 16, { align: 'center' });
  setFont(doc, 'bold', 11, BLUE);
  doc.text("D'ELEVES DU SECOND DEGRE", W / 2, 22, { align: 'center' });
  setFont(doc, 'normal', 7, GRAY);
  doc.text('College Pierre Mendes France - 57140 WOIPPY', W / 2, 28, { align: 'center' });
  y = 34;

  // Destination
  sHead('DESTINATION');
  lbl(data.pays === 'france' ? 'France, departement :' : 'Etranger, pays :', ML, y);
  val(data.departement, ML + 40, y);
  y += 5;
  lbl('Adresse du lieu :', ML, y); val(data.adresse, ML + 35, y);
  y += 7;

  // Type & Transport
  sHead('TYPE DE DEPLACEMENT & TRANSPORT');
  lbl('Nature :', ML, y); val(data.nature === 'obligatoire' ? 'Obligatoire' : 'Facultatif', ML + 20, y);
  lbl('Type :', ML + 60, y); val(data.type === 'sortie' ? 'Sortie (sans nuitee)' : 'Sejour avec nuitee', ML + 75, y);
  y += 5;
  if (data.type === 'sejour') {
    lbl('Reciprocite :', ML, y); val(data.reciprocite === 'avec' ? 'Avec' : 'Sans', ML + 30, y);
    lbl('Hebergement :', ML + 60, y); val(data.hebergement, ML + 85, y);
    y += 5;
  }
  lbl('Transport :', ML, y); val(data.transport + (data.transportPrecision ? ' (' + data.transportPrecision + ')' : ''), ML + 25, y);
  y += 7;

  // Responsable
  sHead('RESPONSABLE DE LA SORTIE');
  lbl('Nom prenom :', ML, y); val(data.responsable, ML + 28, y);
  lbl('Qualite :', ML + 90, y); val(data.qualite, ML + 108, y);
  y += 5;
  lbl('Tel. urgence :', ML, y); val(data.telUrgence, ML + 28, y);
  lbl('Tel. chef etab. :', ML + 90, y); val(data.telChef, ML + 115, y);
  y += 7;

  // Deplacement
  sHead('RENSEIGNEMENTS DU DEPLACEMENT');
  lbl('Depart :', ML, y); val(data.dateDepart + '  a  ' + (data.heureDepart || '...'), ML + 22, y);
  lbl('Lieu :', ML + 80, y); val(data.lieuDepart, ML + 94, y);
  y += 5;
  lbl('Retour :', ML, y); val(data.dateRetour + '  a  ' + (data.heureRetour || '...'), ML + 22, y);
  lbl('Lieu :', ML + 80, y); val(data.lieuRetour, ML + 94, y);
  y += 5;
  lbl('Nb demi-journee(s) sur temps scolaire :', ML, y); val(data.nbJournees, ML + 65, y);
  y += 7;

  // Composition
  sHead('COMPOSITION DU GROUPE');
  if (data.classes.length > 0) {
    doc.setFillColor(...LIGHT_BG);
    doc.rect(ML, y - 3, CW, 6, 'F');
    setFont(doc, 'bold', 7, BLUE);
    doc.text('Classe', ML + 2, y); doc.text('Effectif', ML + 50, y); doc.text('Participants', ML + 80, y);
    y += 5;
    let totalEff = 0, totalPart = 0;
    data.classes.forEach((c) => {
      setFont(doc, 'normal', 8, BLACK);
      doc.text(c.nom, ML + 2, y); doc.text(c.effectif + '', ML + 50, y); doc.text(c.participants + '', ML + 80, y);
      totalEff += parseInt(c.effectif) || 0;
      totalPart += parseInt(c.participants) || 0;
      y += 4;
    });
    setFont(doc, 'bold', 8, BLUE);
    doc.text('TOTAL', ML + 2, y); doc.text(totalEff + '', ML + 50, y); doc.text(totalPart + '', ML + 80, y);
    y += 7;
  }

  // Pedagogique
  y = checkPage(50);
  sHead('CONTENU PEDAGOGIQUE');
  lbl('Domaines :', ML, y); val(data.domaines.join(', ') || '(aucun)', ML + 22, y);
  y += 5;
  lbl('Disciplines :', ML, y); val(data.disciplines, ML + 25, y);
  y += 5;
  lbl('Objectifs :', ML, y);
  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc, data.objectifs || '', ML + 22, y, CW - 22, 3.5); y += 2;
  lbl('Liens projet etab. :', ML, y);
  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc, data.liens || '', ML + 35, y, CW - 35, 3.5); y += 2;
  lbl('Activites :', ML, y);
  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc, data.activites || '', ML + 22, y, CW - 22, 3.5); y += 2;
  lbl('Travaux prepa. :', ML, y);
  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc, data.travauxPrepa || '', ML + 30, y, CW - 30, 3.5); y += 2;
  lbl('Restitution :', ML, y);
  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc, data.restitution || '', ML + 25, y, CW - 25, 3.5); y += 2;
  lbl('Eleves non-participants :', ML, y);
  setFont(doc, 'normal', 8, BLACK);
  y = wrappedText(doc, data.nonParticipants || '', ML + 42, y, CW - 42, 3.5); y += 4;
  lbl('Prepa pedagogique :', ML, y); val(data.datePrepa || '...', ML + 38, y);
  lbl('Bilan pedagogique :', ML + 90, y); val(data.dateBilan || '...', ML + 125, y);
  y += 10;

  // Signature
  y = checkPage(25);
  setFont(doc, 'normal', 8, BLACK);
  doc.text('Date de la demande : ___ / ___ / 20___', ML, y);
  doc.text('Signature du professeur organisateur :', ML + 90, y);
  y += 12;
  lbl('Decision du Chef d\'etablissement : le ___ / ___ / 20___', ML, y);
  doc.rect(ML + 95, y - 3, 3, 3); val('Avis favorable', ML + 100, y);
  doc.rect(ML + 130, y - 3, 3, 3); val('Avis defavorable', ML + 135, y);
  y += 8;
  setFont(doc, 'normal', 8, BLACK);
  doc.text('Signature du Chef d\'etablissement et Cachet :', ML, y);

  // ═══ ANNEXE 1: BUDGET ═══
  doc.addPage();
  y = 15;
  setFont(doc, 'bold', 14, BLUE);
  doc.text('Annexe 1 : Budget previsionnel', W / 2, y, { align: 'center' });
  y += 10;

  const b = data.budget;
  const halfW = (CW - 6) / 2;

  function budgetTable(title: string, items: { label: string; value: number }[], x: number, startY: number) {
    doc.setFillColor(...BLUE);
    doc.roundedRect(x, startY, halfW, 6, 1, 1, 'F');
    setFont(doc, 'bold', 8, [255, 255, 255]);
    doc.text(title, x + 2, startY + 4);
    let ty = startY + 9;
    let total = 0;
    items.forEach((item) => {
      setFont(doc, 'normal', 7.5, BLACK);
      doc.text(item.label, x + 2, ty);
      doc.text(item.value.toFixed(2) + ' EUR', x + halfW - 2, ty, { align: 'right' });
      total += item.value;
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
      doc.line(x, ty + 1.5, x + halfW, ty + 1.5);
      ty += 5;
    });
    doc.setFillColor(...LIGHT_BG);
    doc.rect(x, ty, halfW, 6, 'F');
    setFont(doc, 'bold', 8, BLUE);
    doc.text('TOTAL', x + 2, ty + 4);
    doc.text(total.toFixed(2) + ' EUR', x + halfW - 2, ty + 4, { align: 'right' });
    return ty + 8;
  }

  const recettesItems = [
    { label: `Participation familles (${b.nbFamilles} x ${b.montantFamille.toFixed(2)})`, value: b.nbFamilles * b.montantFamille },
    { label: 'Etablissement', value: b.etablissement },
    { label: 'Dons (FSE, MDL, associations)', value: b.dons },
    { label: 'Commune / Com. de communes', value: b.subCommune },
    { label: 'Conseil Departemental', value: b.subDept },
    { label: 'Conseil Regional', value: b.subRegion },
    { label: 'Etat', value: b.subEtat },
    { label: 'Autres subventions', value: b.subAutres },
  ];

  const depensesItems = [
    { label: 'Bus', value: b.depBus },
    { label: 'Train', value: b.depTrain },
    { label: 'Avion', value: b.depAvion },
    { label: 'Autres transport', value: b.depTransportAutre },
    { label: 'Hebergement', value: b.depHebergement },
    { label: 'Repas', value: b.depRepas },
    { label: 'Activites / Visites', value: b.depActivites },
    { label: 'Materiel pedagogique', value: b.depMateriel },
    { label: 'Divers', value: b.depDivers },
  ];

  const endR = budgetTable('RECETTES', recettesItems, ML, y);
  const endD = budgetTable('DEPENSES', depensesItems, ML + halfW + 6, y);
  y = Math.max(endR, endD);

  // ═══ ANNEXE 2: LISTES ═══
  doc.addPage();
  y = 15;
  setFont(doc, 'bold', 14, BLUE);
  doc.text('Annexe 2 : Listes nominatives', W / 2, y, { align: 'center' });
  y += 10;

  // Accompagnateurs
  sHead('ACCOMPAGNATEURS');
  doc.setFillColor(...LIGHT_BG);
  doc.rect(ML, y - 3, CW, 5, 'F');
  setFont(doc, 'bold', 7, BLUE);
  doc.text('N', ML + 2, y); doc.text('Nom et Prenom', ML + 10, y);
  doc.text('Qualite', ML + 80, y); doc.text('Telephone', ML + 140, y);
  y += 4;

  for (let ai = 0; ai < Math.max(data.accompagnateurs.length, 4); ai++) {
    const a = data.accompagnateurs[ai] || { nom: '', qualite: '', tel: '' };
    setFont(doc, 'normal', 7.5, BLACK);
    doc.text((ai + 1) + '', ML + 2, y);
    doc.text(a.nom || '', ML + 10, y);
    doc.text(a.qualite || '', ML + 80, y);
    doc.text(a.tel || '', ML + 140, y);
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
    doc.line(ML, y + 1.5, ML + CW, y + 1.5);
    y += 4;
  }
  y += 5;

  // Eleves
  sHead('ELEVES - Classe(s) : ' + (data.elevesClasse || '___'));
  doc.setFillColor(...LIGHT_BG);
  doc.rect(ML, y - 3, CW, 5, 'F');
  setFont(doc, 'bold', 7, BLUE);
  doc.text('N', ML + 2, y); doc.text('Nom', ML + 10, y);
  doc.text('Prenom', ML + 60, y); doc.text('Sexe', ML + 110, y);
  doc.text('Tel. urgence', ML + 130, y);
  y += 4;

  const eleves = data.eleves;
  const maxRows = Math.max(eleves.length, 30);
  for (let ei = 0; ei < maxRows; ei++) {
    y = checkPage(5);
    const el = eleves[ei] || { nom: '', prenom: '', sexe: '', tel: '' };
    setFont(doc, 'normal', 7, BLACK);
    doc.text((ei + 1) + '', ML + 2, y);
    doc.text(el.nom || '', ML + 10, y);
    doc.text(el.prenom || '', ML + 60, y);
    doc.text(el.sexe || '', ML + 110, y);
    doc.text(el.tel || '', ML + 130, y);
    doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
    doc.line(ML, y + 1.5, ML + CW, y + 1.5);
    y += 4;
  }

  // Incidences
  y += 5;
  y = checkPage(20);
  sHead('INCIDENCES SUR L\'EMPLOI DU TEMPS');
  setFont(doc, 'normal', 8, BLACK);
  if (data.incidences) {
    y = wrappedText(doc, data.incidences, ML, y, CW, 3.5);
  } else {
    for (let li = 0; li < 5; li++) {
      doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
      doc.line(ML, y, ML + CW, y);
      y += 5;
    }
  }

  // Page numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    setFont(doc, 'normal', 7, GRAY);
    doc.text(`${p}/${totalPages}`, W - MR, H - 8, { align: 'right' });
    doc.text('College Pierre Mendes France - Woippy', ML, H - 8);
  }

  return doc;
}

// ══════════════════════════════════════════
// RAPPORT D'INCIDENT PDF
// ══════════════════════════════════════════

export function buildRapportPDF(data: RapportData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML = 15, MR = 15, CW = W - ML - MR;
  let y = 15;

  // ── Header left: Academy info ──
  setFont(doc, 'bold', 9, BLACK);
  doc.text(`Academie ${data.academie}`, ML, y);
  y += 4;
  setFont(doc, 'normal', 8, BLACK);
  doc.text(`Region academique ${data.region}`, ML, y);
  y += 4;
  doc.text("Ministere de l'Education Nationale,", ML, y);
  y += 3.5;
  doc.text("de l'Enseignement Superieur", ML, y);
  y += 3.5;
  doc.text("et de la Recherche", ML, y);
  y += 4;
  setFont(doc, 'italic', 8, BLACK);
  doc.text("Republique Francaise", ML, y);

  // ── Header right: Title ──
  setFont(doc, 'bold', 16, BLACK);
  doc.text("RAPPORT D'INCIDENT", W - MR, 18, { align: 'right' });
  setFont(doc, 'italic', 9, BLACK);
  doc.text("(pour tout fait ne relevant pas de l'exclusion de cours)", W - MR, 24, { align: 'right' });

  // ── Date ──
  y = 42;
  setFont(doc, 'normal', 10, BLACK);
  doc.text(`Date : ${data.date || '____ / ____ / 20____'}`, W - MR, y, { align: 'right' });

  // ── Redacteur ──
  y += 10;
  const redLabel = "Rapport redige par (Nom, Prenom et fonctions) :";
  setFont(doc, 'bold', 10, BLACK);
  doc.text(redLabel, ML, y);
  const redLabelW = doc.getTextWidth(redLabel); // measure while still bold
  y += 6;
  if (data.redacteur) {
    setFont(doc, 'normal', 10, BLACK);
    doc.text(data.redacteur, ML, y);
  } else {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(ML + redLabelW + 4, y - 5, W - MR, y - 5);
  }

  // ── Two-column box ──
  y += 6;
  const boxTop = y;
  const boxH = 34;
  const midX = ML + CW / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(ML, boxTop, CW, boxH);
  doc.line(midX, boxTop, midX, boxTop + boxH);

  setFont(doc, 'bold', 9, BLACK);
  doc.text("Lieu, date et heure de l'incident :", ML + 2, boxTop + 6);
  doc.text("Eleve(s) concerne(s) et classe(s) :", midX + 2, boxTop + 6);

  setFont(doc, 'normal', 9, BLACK);
  if (data.lieuDateHeure) {
    const leftLines = doc.splitTextToSize(data.lieuDateHeure, CW / 2 - 6);
    doc.text(leftLines, ML + 2, boxTop + 13);
  }
  if (data.elevesConcernes) {
    const rightLines = doc.splitTextToSize(data.elevesConcernes, CW / 2 - 6);
    doc.text(rightLines, midX + 2, boxTop + 13);
  }

  // ── FAITS ──
  y = boxTop + boxH + 10;
  setFont(doc, 'bold', 11, BLACK);
  doc.text("FAITS :", W / 2, y, { align: 'center' });
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  const faitsTw = doc.getTextWidth("FAITS :");
  doc.line((W - faitsTw) / 2, y + 1, (W + faitsTw) / 2, y + 1);

  y += 6;
  setFont(doc, 'italic', 8, GRAY);
  doc.text("NB : Si plusieurs eleves sont impliques, merci de bien preciser l'action de chacun.", ML, y);

  y += 6;
  setFont(doc, 'normal', 9, BLACK);
  if (data.faits) {
    y = wrappedText(doc, data.faits, ML, y, CW, 4.5);
  }

  // ── "Si besoin, TSVP" ──
  const tsvpY = Math.max(y + 10, 200);
  setFont(doc, 'italic', 9, BLACK);
  doc.text("Si besoin, TSVP \u2192", W - MR, tsvpY, { align: 'right' });

  // ── Horizontal separator ──
  const sepY = tsvpY + 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(ML, sepY, ML + CW, sepY);

  // ── SUITE section ──
  let sy = sepY + 7;
  setFont(doc, 'bolditalic', 9, BLACK);
  doc.text("SUITE (les personnels non enseignant transmettront ce document au CPE) :", W / 2, sy, { align: 'center' });

  sy += 7;
  setFont(doc, 'bolditalic', 9, BLACK);
  doc.text("Punition demandee (enseignants) / suggeree (personnel non enseignant) a saisir sur Pronote :", ML, sy);

  const PUNITIONS = [
    "Observation ecrite et le carnet de liaison de l'eleve a faire signer par les parents",
    "Excuse publique orale ou ecrite",
    "Devoir supplementaire signe par les parents",
    "Retenue",
  ];

  sy += 6;
  for (const p of PUNITIONS) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(ML + 1, sy - 2.8, 3, 3);
    if (data.punitions.includes(p)) {
      setFont(doc, 'bold', 9, BLACK);
      doc.text("X", ML + 1.6, sy);
    }
    setFont(doc, 'normal', 9, BLACK);
    doc.text(p, ML + 7, sy);
    sy += 5.5;
  }

  // ── Sanctions ──
  sy += 2;
  setFont(doc, 'bolditalic', 9, BLACK);
  doc.text("Sanction suggeree (decision reservee au chef d'etablissement) :", ML, sy);

  sy += 6;
  const sanctionStartY = sy;

  // Left column
  const SANCTIONS_LEFT = ["Avertissement", "Blame"];
  for (const s of SANCTIONS_LEFT) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(ML + 1, sy - 2.8, 3, 3);
    if (data.sanctions.includes(s)) {
      setFont(doc, 'bold', 9, BLACK);
      doc.text("X", ML + 1.6, sy);
    }
    setFont(doc, 'normal', 9, BLACK);
    doc.text(s, ML + 7, sy);
    sy += 5.5;
  }

  // Right column
  let ry = sanctionStartY;
  const rCol = W / 2 + 5;

  // Exclusion temporaire with sub-checkboxes
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(rCol, ry - 2.8, 3, 3);
  if (data.sanctions.includes('Exclusion temporaire')) {
    setFont(doc, 'bold', 9, BLACK);
    doc.text("X", rCol + 0.6, ry);
  }
  setFont(doc, 'normal', 9, BLACK);
  const exclLabel = "Exclusion temporaire (";
  doc.text(exclLabel, rCol + 6, ry);
  const etX = rCol + 6 + doc.getTextWidth(exclLabel);
  doc.rect(etX, ry - 2.8, 3, 3);
  if (data.exclusionClasse) {
    setFont(doc, 'bold', 9, BLACK);
    doc.text("X", etX + 0.6, ry);
    setFont(doc, 'normal', 9, BLACK);
  }
  const classeLabel = " de classe, ";
  doc.text(classeLabel, etX + 3.5, ry);
  const etX2 = etX + 3.5 + doc.getTextWidth(classeLabel);
  doc.rect(etX2, ry - 2.8, 3, 3);
  if (data.exclusionCollege) {
    setFont(doc, 'bold', 9, BLACK);
    doc.text("X", etX2 + 0.6, ry);
    setFont(doc, 'normal', 9, BLACK);
  }
  doc.text(" du", etX2 + 3.5, ry);
  ry += 4;
  doc.text("college)", rCol + 6, ry);

  ry += 2;
  doc.rect(rCol, ry - 2.8, 3, 3);
  if (data.sanctions.includes('Saisine du Conseil de discipline')) {
    setFont(doc, 'bold', 9, BLACK);
    doc.text("X", rCol + 0.6, ry);
    setFont(doc, 'normal', 9, BLACK);
  }
  doc.text("Saisine du Conseil de discipline", rCol + 6, ry);

  // ── Signature & Regulation ──
  sy = Math.max(sy, ry) + 6;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(ML, sy, ML + CW, sy);
  sy += 5;

  const col1 = ML;
  const col2 = ML + CW / 3;
  const col3 = ML + CW * 2 / 3;

  setFont(doc, 'bold', 9, BLACK);
  doc.text("Signature :", col1, sy);
  setFont(doc, 'italic', 9, BLACK);
  doc.text("le cas echeant :", col2, sy);
  setFont(doc, 'bold', 9, BLACK);
  doc.text("Regulation effectuee le ___ / ___ /", col3, sy);
  sy += 5;
  doc.text("20____", col3, sy);
  sy += 5;
  doc.text("Sanction decidee :", col3, sy);

  // ── Footer ──
  setFont(doc, 'normal', 7, GRAY);
  const footerParts = [data.adresse, 'Tel. ' + data.tel, data.email, data.siteWeb].filter(Boolean);
  doc.text(footerParts.join('  '), W / 2, H - 8, { align: 'center' });

  return doc;
}

// ══════════════════════════════════════════
// AUTORISATION DE DEPLACEMENT PDF
// ══════════════════════════════════════════

export function buildDeplacementPDF(data: DeplacementData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ML = 12, MR = 12, CW = W - ML - MR;
  const colW = (CW - 6) / 2; // 2 columns with 6mm gap
  const rowH = 82; // height of each card
  const gap = 6;

  // ── Header ──
  setFont(doc, 'italic', 10, BLACK);
  doc.text(`Annee Scolaire ${data.anneeScolaire} \u2014 ${data.etablissement}`, W / 2, 12, { align: 'center' });

  function drawCard(x: number, y: number) {
    // Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(x, y, colW, rowH);

    let cy = y + 7;
    const px = x + 5; // padding left
    const lineEnd = x + colW - 5;

    // Title
    setFont(doc, 'bold', 10, BLACK);
    doc.text("Autorisation de deplacement", x + colW / 2, cy, { align: 'center' });
    cy += 7;

    // Fields with underlines
    const fields = [
      { label: "Date :", lineW: 35 },
      { label: "Nom :", lineW: 40 },
      { label: "Prenom :", lineW: 38 },
      { label: "Classe :", lineW: 15 },
      { label: "Professeur :", lineW: 30 },
    ];

    setFont(doc, 'normal', 9, BLACK);
    for (const f of fields) {
      doc.text(f.label, px, cy);
      const labelW = doc.getTextWidth(f.label);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(px + labelW + 2, cy + 0.5, px + labelW + 2 + f.lineW, cy + 0.5);
      cy += 5;
    }

    // "est autorisé·e à se rendre"
    cy += 1;
    setFont(doc, 'normal', 9, BLACK);
    doc.text("est autorise\u00B7e a se rendre", px, cy);
    cy += 6;

    // Checkbox: aux toilettes
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(px, cy - 2.8, 3, 3);
    doc.text("aux toilettes", px + 5, cy);
    cy += 4;

    // (cas d'urgence uniquement)
    setFont(doc, 'italic', 8, BLACK);
    doc.text("(cas d'urgence uniquement)", px + 5, cy);
    cy += 5;

    // Checkbox: autre
    setFont(doc, 'normal', 9, BLACK);
    doc.rect(px, cy - 2.8, 3, 3);
    doc.text("autre :", px + 5, cy);
    const autreW = doc.getTextWidth("autre :");
    doc.setLineWidth(0.2);
    doc.line(px + 5 + autreW + 2, cy + 0.5, lineEnd, cy + 0.5);
    cy += 5.5;

    // Heure
    doc.text("Heure :", px, cy);
    const heureW = doc.getTextWidth("Heure :");
    doc.line(px + heureW + 2, cy + 0.5, px + heureW + 2 + 28, cy + 0.5);
    cy += 5;

    // Retour en classe
    doc.text("Retour en classe heure :", px, cy);
    const retourW = doc.getTextWidth("Retour en classe heure :");
    doc.line(px + retourW + 2, cy + 0.5, lineEnd, cy + 0.5);
  }

  // ── Draw 6 cards: 2 columns × 3 rows ──
  const startY = 18;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const x = ML + col * (colW + gap);
      const y = startY + row * (rowH + gap);
      drawCard(x, y);
    }
  }

  return doc;
}
