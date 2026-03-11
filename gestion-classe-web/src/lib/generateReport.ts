import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Types
interface ClassData {
  id: string;
  name: string;
  level: string; // "5e", "4e", "3e", "6e", "autre"
  participations: number;
  bavardages: number;
  absences: number;
  sorties: number;
  ratio: number;
  studentCount: number;
}

interface GenderStats {
  garcons: { participations: number; bavardages: number; absences: number; count: number };
  filles: { participations: number; bavardages: number; absences: number; count: number };
}

interface StudentSortie {
  studentId: string;
  pseudo: string;
  className: string;
  count: number;
}

interface LevelStats {
  level: string;
  classes: number;
  participations: number;
  bavardages: number;
  absences: number;
  ratio: number;
}

interface ReportData {
  trimester: number;
  schoolYear: string;
  dateRange: { start: string; end: string };
  classes: ClassData[];
  genderStats: GenderStats | null;
  studentSorties: StudentSortie[];
  totalStudents: number;
}

// Types for year-end report
interface TrimesterGradeData {
  trimester: number;
  className: string;
  studentCount: number;
  totalParticipations: number;
  totalAbsences: number;
  averageGrade: number;
}

interface StudentYearData {
  pseudo: string;
  className: string;
  t1Grade: number | null;
  t2Grade: number | null;
  t3Grade: number | null;
  yearAverage: number;
  evolution: 'up' | 'down' | 'stable';
  t1Participations: number;
  t2Participations: number;
  t3Participations: number;
}

interface YearEndReportData {
  schoolYear: string;
  classes: ClassData[];
  genderStats: GenderStats | null;
  studentSorties: StudentSortie[];
  totalStudents: number;
  trimesterData: TrimesterGradeData[];
  studentYearData: StudentYearData[];
  topProgressStudents: StudentYearData[];
  concerningStudents: StudentYearData[];
}

// Extract level from class name (e.g., "5e2" -> "5e", "4eA" -> "4e")
function extractLevel(className: string): string {
  const match = className.match(/^(\d+e)/i);
  if (match) return match[1].toLowerCase();
  return 'autre';
}

// Calculate level statistics
function calculateLevelStats(classes: ClassData[]): LevelStats[] {
  const byLevel = new Map<string, { classes: number; participations: number; bavardages: number; absences: number }>();

  classes.forEach(cls => {
    if (!byLevel.has(cls.level)) {
      byLevel.set(cls.level, { classes: 0, participations: 0, bavardages: 0, absences: 0 });
    }
    const entry = byLevel.get(cls.level)!;
    entry.classes++;
    entry.participations += cls.participations;
    entry.bavardages += cls.bavardages;
    entry.absences += cls.absences;
  });

  return Array.from(byLevel.entries())
    .map(([level, data]) => ({
      level,
      classes: data.classes,
      participations: data.participations,
      bavardages: data.bavardages,
      absences: data.absences,
      ratio: data.participations + data.bavardages > 0
        ? Math.round((data.participations / (data.participations + data.bavardages)) * 100)
        : 0,
    }))
    .sort((a, b) => {
      // Sort by level number (6e, 5e, 4e, 3e, autre)
      const order = ['6e', '5e', '4e', '3e', 'autre'];
      return order.indexOf(a.level) - order.indexOf(b.level);
    });
}

// Identify class strengths and weaknesses
function analyzeClass(cls: ClassData, allClasses: ClassData[]): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Calculate averages
  const avgRatio = allClasses.reduce((sum, c) => sum + c.ratio, 0) / allClasses.length;
  const avgBavardages = allClasses.reduce((sum, c) => sum + c.bavardages, 0) / allClasses.length;
  const avgAbsences = allClasses.reduce((sum, c) => sum + c.absences, 0) / allClasses.length;
  const avgParticipations = allClasses.reduce((sum, c) => sum + c.participations, 0) / allClasses.length;

  // Strengths
  if (cls.ratio >= avgRatio + 10) strengths.push('Excellent ratio participation/bavardage');
  else if (cls.ratio >= avgRatio) strengths.push('Bon ratio participation/bavardage');

  if (cls.bavardages < avgBavardages * 0.7) strengths.push('Peu de bavardages');
  if (cls.participations > avgParticipations * 1.3) strengths.push('Classe tres participative');
  if (cls.absences < avgAbsences * 0.5) strengths.push('Excellent taux de presence');

  // Weaknesses
  if (cls.ratio < avgRatio - 15) weaknesses.push('Ratio participation/bavardage faible');
  if (cls.bavardages > avgBavardages * 1.5) weaknesses.push('Taux de bavardage eleve');
  if (cls.absences > avgAbsences * 1.5) weaknesses.push('Taux d\'absence eleve');
  if (cls.participations < avgParticipations * 0.5) weaknesses.push('Faible participation');
  if (cls.sorties > 10) weaknesses.push('Nombreuses sorties');

  // Ensure at least one item in each if possible
  if (strengths.length === 0 && cls.ratio >= 50) strengths.push('Ratio equilibre');
  if (weaknesses.length === 0 && cls.ratio < 70) weaknesses.push('Marge de progression possible');

  return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3) };
}

// Generate PDF report
export function generateAnalysisReport(data: ReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  const addTitle = (text: string, size: number = 16) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 34, 34);
    doc.text(text, 14, yPos);
    yPos += size * 0.5 + 4;
  };

  const addSubtitle = (text: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(text, 14, yPos);
    yPos += 8;
  };

  const addText = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageWidth - 28 - indent);
    doc.text(lines, 14 + indent, yPos);
    yPos += lines.length * 5 + 2;
  };

  const addBullet = (text: string, color: 'green' | 'red' | 'orange' | 'blue' = 'blue') => {
    const colors = {
      green: [34, 197, 94],
      red: [239, 68, 68],
      orange: [245, 158, 11],
      blue: [59, 130, 246],
    };
    doc.setFillColor(colors[color][0], colors[color][1], colors[color][2]);
    doc.circle(18, yPos - 2, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(text, 22, yPos);
    yPos += 6;
  };

  const checkNewPage = (needed: number = 30) => {
    if (yPos > 270 - needed) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Calculate totals
  const totals = data.classes.reduce(
    (acc, cls) => ({
      participations: acc.participations + cls.participations,
      bavardages: acc.bavardages + cls.bavardages,
      absences: acc.absences + cls.absences,
      sorties: acc.sorties + cls.sorties,
    }),
    { participations: 0, bavardages: 0, absences: 0, sorties: 0 }
  );
  const globalRatio = totals.participations + totals.bavardages > 0
    ? Math.round((totals.participations / (totals.participations + totals.bavardages)) * 100)
    : 0;

  // Add level to classes
  const classesWithLevel = data.classes.map(cls => ({
    ...cls,
    level: extractLevel(cls.name),
  }));

  const levelStats = calculateLevelStats(classesWithLevel);

  // ========== 1. HEADER ==========
  addTitle(`Rapport d'analyse - Trimestre ${data.trimester}`, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Annee scolaire ${data.schoolYear}`, 14, yPos);
  yPos += 6;
  doc.text(`Periode: ${data.dateRange.start} - ${data.dateRange.end}`, 14, yPos);
  yPos += 6;
  doc.text(`${data.classes.length} classe(s) - ${data.totalStudents} eleve(s)`, 14, yPos);
  yPos += 12;

  // ========== 2. VUE D'ENSEMBLE ==========
  addSubtitle('Vue d\'ensemble');

  autoTable(doc, {
    startY: yPos,
    head: [['Participations', 'Bavardages', 'Absences', 'Sorties', 'Ratio +/-']],
    body: [[
      totals.participations.toString(),
      totals.bavardages.toString(),
      totals.absences.toString(),
      totals.sorties.toString(),
      `${globalRatio}%`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], fontSize: 10 },
    bodyStyles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Interpretation
  if (globalRatio >= 70) {
    addText('Le ratio global est excellent, les classes sont globalement bien impliquees.');
  } else if (globalRatio >= 50) {
    addText('Le ratio global est correct, avec une marge de progression possible.');
  } else {
    addText('Le ratio global est faible, les bavardages sont trop frequents par rapport aux participations.');
  }
  yPos += 4;

  // ========== 3. COMPARAISON PAR NIVEAU ==========
  checkNewPage(60);
  addSubtitle('Comparaison par niveau');

  if (levelStats.length > 1) {
    autoTable(doc, {
      startY: yPos,
      head: [['Niveau', 'Classes', 'Participations', 'Bavardages', 'Absences', 'Ratio']],
      body: levelStats.map(lvl => [
        lvl.level.toUpperCase(),
        lvl.classes.toString(),
        lvl.participations.toString(),
        lvl.bavardages.toString(),
        lvl.absences.toString(),
        `${lvl.ratio}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    // Analysis
    const bestLevel = levelStats.reduce((a, b) => a.ratio > b.ratio ? a : b);
    const worstLevel = levelStats.reduce((a, b) => a.ratio < b.ratio ? a : b);

    if (bestLevel.level !== worstLevel.level) {
      addText(`Le niveau ${bestLevel.level.toUpperCase()} presente le meilleur ratio (${bestLevel.ratio}%), tandis que les ${worstLevel.level.toUpperCase()} ont le ratio le plus faible (${worstLevel.ratio}%).`);
    }
  } else {
    addText('Un seul niveau selectionne, comparaison non applicable.');
  }
  yPos += 4;

  // ========== 4. ANALYSE PAR CLASSE ==========
  checkNewPage(40);
  addSubtitle('Analyse par classe');

  // Sort classes by ratio descending
  const sortedClasses = [...classesWithLevel].sort((a, b) => b.ratio - a.ratio);

  sortedClasses.forEach((cls, idx) => {
    checkNewPage(45);

    // Class header
    doc.setFillColor(245, 245, 250);
    doc.rect(14, yPos - 4, pageWidth - 28, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(34, 34, 34);
    doc.text(`${idx + 1}. ${cls.name}`, 16, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Ratio: ${cls.ratio}%`, pageWidth - 40, yPos);
    yPos += 10;

    // Stats line
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`+${cls.participations} participations | -${cls.bavardages} bavardages | ${cls.absences} absences | ${cls.sorties} sorties`, 16, yPos);
    yPos += 7;

    // Strengths and weaknesses
    const analysis = analyzeClass(cls, classesWithLevel);

    if (analysis.strengths.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('Points forts:', 16, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(analysis.strengths.join(' - '), 42, yPos);
      yPos += 5;
    }

    if (analysis.weaknesses.length > 0) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68);
      doc.text('A ameliorer:', 16, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(analysis.weaknesses.join(' - '), 42, yPos);
      yPos += 5;
    }

    yPos += 4;
  });

  // ========== 5. EQUITE FILLES/GARCONS ==========
  checkNewPage(50);
  addSubtitle('Equite filles / garcons');

  if (data.genderStats && (data.genderStats.filles.count > 0 || data.genderStats.garcons.count > 0)) {
    const gs = data.genderStats;
    const fillesAvg = gs.filles.count > 0 ? (gs.filles.participations / gs.filles.count).toFixed(1) : '0';
    const garconsAvg = gs.garcons.count > 0 ? (gs.garcons.participations / gs.garcons.count).toFixed(1) : '0';

    autoTable(doc, {
      startY: yPos,
      head: [['', 'Effectif', 'Participations', 'Moy/eleve', 'Bavardages', 'Absences']],
      body: [
        ['Filles', gs.filles.count.toString(), gs.filles.participations.toString(), fillesAvg, gs.filles.bavardages.toString(), gs.filles.absences.toString()],
        ['Garcons', gs.garcons.count.toString(), gs.garcons.participations.toString(), garconsAvg, gs.garcons.bavardages.toString(), gs.garcons.absences.toString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    // Analysis
    const fillesAvgNum = gs.filles.count > 0 ? gs.filles.participations / gs.filles.count : 0;
    const garconsAvgNum = gs.garcons.count > 0 ? gs.garcons.participations / gs.garcons.count : 0;
    const diff = Math.abs(fillesAvgNum - garconsAvgNum);
    const avgGlobal = (fillesAvgNum + garconsAvgNum) / 2;
    const diffPercent = avgGlobal > 0 ? (diff / avgGlobal) * 100 : 0;

    if (diffPercent > 20) {
      const higher = fillesAvgNum > garconsAvgNum ? 'filles' : 'garcons';
      const lower = higher === 'filles' ? 'garcons' : 'filles';
      addText(`Attention: Les ${higher} participent significativement plus que les ${lower} (ecart de ${diffPercent.toFixed(0)}%). Il serait bon de veiller a solliciter davantage les ${lower}.`, 0);
    } else {
      addText('L\'equilibre de participation entre filles et garcons est globalement respecte.');
    }
  } else {
    addText('Donnees de genre insuffisantes pour l\'analyse.');
  }
  yPos += 4;

  // ========== 6. SORTIES ==========
  checkNewPage(50);
  addSubtitle('Analyse des sorties');

  // Sorties par classe
  const sortiesByClass = classesWithLevel
    .filter(cls => cls.sorties > 0)
    .sort((a, b) => b.sorties - a.sorties);

  if (sortiesByClass.length > 0) {
    addText(`Total: ${totals.sorties} sorties sur la periode.`);

    if (sortiesByClass.length > 0) {
      const topSortiesClass = sortiesByClass[0];
      if (topSortiesClass.sorties > totals.sorties / sortiesByClass.length * 1.5) {
        addText(`La classe ${topSortiesClass.name} a un nombre de sorties eleve (${topSortiesClass.sorties}).`);
      }
    }
  }

  // Eleves recurrents (>3 sorties)
  const recurrentStudents = data.studentSorties.filter(s => s.count >= 3).slice(0, 10);

  if (recurrentStudents.length > 0) {
    yPos += 2;
    addText('Eleves avec sorties frequentes (3+):');

    autoTable(doc, {
      startY: yPos,
      head: [['Eleve', 'Classe', 'Nb sorties']],
      body: recurrentStudents.map(s => [s.pseudo, s.className, s.count.toString()]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14 },
      tableWidth: 100,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  } else if (totals.sorties > 0) {
    addText('Aucun eleve avec plus de 3 sorties sur la periode.');
  } else {
    addText('Aucune sortie enregistree sur la periode.');
  }
  yPos += 4;

  // ========== 7. SYNTHESE ==========
  checkNewPage(60);
  addSubtitle('Synthese');

  // Points positifs
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(34, 197, 94);
  doc.text('Points positifs:', 14, yPos);
  yPos += 6;

  const positives: string[] = [];
  if (globalRatio >= 60) positives.push(`Ratio global satisfaisant (${globalRatio}%)`);
  const bestClass = sortedClasses[0];
  if (bestClass) positives.push(`${bestClass.name} se distingue avec ${bestClass.ratio}% de ratio`);
  if (data.genderStats) {
    const gs = data.genderStats;
    const fillesAvg = gs.filles.count > 0 ? gs.filles.participations / gs.filles.count : 0;
    const garconsAvg = gs.garcons.count > 0 ? gs.garcons.participations / gs.garcons.count : 0;
    if (Math.abs(fillesAvg - garconsAvg) < 1) positives.push('Bonne equite filles/garcons');
  }
  if (recurrentStudents.length === 0 && totals.sorties > 0) positives.push('Pas d\'abus de sorties detecte');
  if (positives.length === 0) positives.push('Donnees en cours de collecte');

  positives.slice(0, 3).forEach(p => addBullet(p, 'green'));
  yPos += 2;

  // Axes d'amelioration
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(245, 158, 11);
  doc.text('Axes d\'amelioration:', 14, yPos);
  yPos += 6;

  const improvements: string[] = [];
  if (globalRatio < 60) improvements.push(`Ameliorer le ratio global (actuellement ${globalRatio}%)`);
  const worstClass = sortedClasses[sortedClasses.length - 1];
  if (worstClass && worstClass.ratio < 50) improvements.push(`Attention a ${worstClass.name} (ratio ${worstClass.ratio}%)`);
  if (data.genderStats) {
    const gs = data.genderStats;
    const fillesAvg = gs.filles.count > 0 ? gs.filles.participations / gs.filles.count : 0;
    const garconsAvg = gs.garcons.count > 0 ? gs.garcons.participations / gs.garcons.count : 0;
    if (fillesAvg > garconsAvg * 1.3) improvements.push('Solliciter davantage les garcons');
    else if (garconsAvg > fillesAvg * 1.3) improvements.push('Solliciter davantage les filles');
  }
  if (recurrentStudents.length > 3) improvements.push('Surveiller les sorties frequentes');
  if (improvements.length === 0) improvements.push('Continuer sur cette lancee');

  improvements.slice(0, 3).forEach(p => addBullet(p, 'orange'));
  yPos += 4;

  // Classes a surveiller
  const classesToWatch = sortedClasses.filter(c => c.ratio < 50);
  if (classesToWatch.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('Classes a surveiller:', 14, yPos);
    yPos += 6;
    classesToWatch.slice(0, 3).forEach(c => addBullet(`${c.name} - ratio ${c.ratio}%`, 'red'));
  }

  // Footer
  yPos = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(`Rapport genere le ${new Date().toLocaleDateString('fr-FR')} - Gestion Classe`, 14, yPos);

  // Save
  const fileName = `Rapport_T${data.trimester}_${data.schoolYear.replace('/', '-')}.pdf`;
  doc.save(fileName);
}

// Generate Year-End PDF Report with trimester comparison
export function generateYearEndReport(data: YearEndReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  const addSubtitle = (text: string) => {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(text, 14, yPos);
    yPos += 8;
  };

  const addText = (text: string, indent: number = 0) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(text, pageWidth - 28 - indent);
    doc.text(lines, 14 + indent, yPos);
    yPos += lines.length * 5 + 2;
  };

  const addBullet = (text: string, color: 'green' | 'red' | 'orange' | 'blue' = 'blue') => {
    const colors = {
      green: [34, 197, 94],
      red: [239, 68, 68],
      orange: [245, 158, 11],
      blue: [59, 130, 246],
    };
    doc.setFillColor(colors[color][0], colors[color][1], colors[color][2]);
    doc.circle(18, yPos - 2, 1.5, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(text, 22, yPos);
    yPos += 6;
  };

  const checkNewPage = (needed: number = 30) => {
    if (yPos > 270 - needed) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Calculate totals
  const totals = data.classes.reduce(
    (acc, cls) => ({
      participations: acc.participations + cls.participations,
      bavardages: acc.bavardages + cls.bavardages,
      absences: acc.absences + cls.absences,
      sorties: acc.sorties + cls.sorties,
    }),
    { participations: 0, bavardages: 0, absences: 0, sorties: 0 }
  );
  const globalRatio = totals.participations + totals.bavardages > 0
    ? Math.round((totals.participations / (totals.participations + totals.bavardages)) * 100)
    : 0;

  // Add level to classes
  const classesWithLevel = data.classes.map(cls => ({
    ...cls,
    level: extractLevel(cls.name),
  }));

  const levelStats = calculateLevelStats(classesWithLevel);
  const sortedClasses = [...classesWithLevel].sort((a, b) => b.ratio - a.ratio);

  // ========== 1. HEADER ==========
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('BILAN DE FIN D\'ANNEE', 14, 18);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`Annee scolaire ${data.schoolYear}`, 14, 28);
  yPos = 45;

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`${data.classes.length} classe(s) - ${data.totalStudents} eleve(s)`, 14, yPos);
  yPos += 10;

  // ========== 2. BILAN GLOBAL ANNUEL ==========
  addSubtitle('Bilan global de l\'annee');

  autoTable(doc, {
    startY: yPos,
    head: [['', 'Participations', 'Bavardages', 'Absences', 'Sorties', 'Ratio']],
    body: [
      ['TOTAL ANNEE', totals.participations.toString(), totals.bavardages.toString(), totals.absences.toString(), totals.sorties.toString(), `${globalRatio}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], fontSize: 10 },
    bodyStyles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
  });
  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ========== 3. EVOLUTION PAR TRIMESTRE ==========
  checkNewPage(80);
  addSubtitle('Evolution par trimestre');

  // Group trimester data by trimester
  const t1Data = data.trimesterData.filter(t => t.trimester === 1);
  const t2Data = data.trimesterData.filter(t => t.trimester === 2);
  const t3Data = data.trimesterData.filter(t => t.trimester === 3);

  const calcTrimesterTotals = (tData: TrimesterGradeData[]) => ({
    participations: tData.reduce((sum, t) => sum + t.totalParticipations, 0),
    absences: tData.reduce((sum, t) => sum + t.totalAbsences, 0),
    avgGrade: tData.length > 0 ? tData.reduce((sum, t) => sum + t.averageGrade, 0) / tData.length : 0,
  });

  const t1Totals = calcTrimesterTotals(t1Data);
  const t2Totals = calcTrimesterTotals(t2Data);
  const t3Totals = calcTrimesterTotals(t3Data);

  autoTable(doc, {
    startY: yPos,
    head: [['Trimestre', 'Participations', 'Absences', 'Moyenne generale', 'Evolution']],
    body: [
      ['Trimestre 1', t1Totals.participations.toString(), t1Totals.absences.toString(), `${t1Totals.avgGrade.toFixed(1)}/20`, '-'],
      ['Trimestre 2', t2Totals.participations.toString(), t2Totals.absences.toString(), `${t2Totals.avgGrade.toFixed(1)}/20`,
        t2Totals.avgGrade > t1Totals.avgGrade ? '↗ +' + (t2Totals.avgGrade - t1Totals.avgGrade).toFixed(1) :
        t2Totals.avgGrade < t1Totals.avgGrade ? '↘ ' + (t2Totals.avgGrade - t1Totals.avgGrade).toFixed(1) : '→ stable'],
      ['Trimestre 3', t3Totals.participations.toString(), t3Totals.absences.toString(), `${t3Totals.avgGrade.toFixed(1)}/20`,
        t3Totals.avgGrade > t2Totals.avgGrade ? '↗ +' + (t3Totals.avgGrade - t2Totals.avgGrade).toFixed(1) :
        t3Totals.avgGrade < t2Totals.avgGrade ? '↘ ' + (t3Totals.avgGrade - t2Totals.avgGrade).toFixed(1) : '→ stable'],
    ],
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241], fontSize: 10 },
    bodyStyles: { fontSize: 10, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
    didParseCell: (hookData) => {
      const text = hookData.cell.raw as string;
      if (text && text.includes('↗')) {
        hookData.cell.styles.textColor = [34, 197, 94];
        hookData.cell.styles.fontStyle = 'bold';
      } else if (text && text.includes('↘')) {
        hookData.cell.styles.textColor = [239, 68, 68];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Interpretation
  const yearEvolution = t3Totals.avgGrade - t1Totals.avgGrade;
  if (yearEvolution > 1) {
    addText(`Excellente progression sur l'annee : +${yearEvolution.toFixed(1)} points de moyenne entre le T1 et le T3.`);
  } else if (yearEvolution > 0) {
    addText(`Legere progression sur l'annee : +${yearEvolution.toFixed(1)} points de moyenne.`);
  } else if (yearEvolution < -1) {
    addText(`Baisse notable sur l'annee : ${yearEvolution.toFixed(1)} points de moyenne. A analyser.`);
  } else {
    addText('Stabilite des resultats sur l\'annee.');
  }
  yPos += 6;

  // ========== 4. COMPARAISON PAR NIVEAU ==========
  checkNewPage(60);
  addSubtitle('Bilan par niveau');

  if (levelStats.length > 1) {
    autoTable(doc, {
      startY: yPos,
      head: [['Niveau', 'Classes', 'Participations', 'Bavardages', 'Ratio annuel']],
      body: levelStats.map(lvl => [
        lvl.level.toUpperCase(),
        lvl.classes.toString(),
        lvl.participations.toString(),
        lvl.bavardages.toString(),
        `${lvl.ratio}%`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    const bestLevel = levelStats.reduce((a, b) => a.ratio > b.ratio ? a : b);
    const worstLevel = levelStats.reduce((a, b) => a.ratio < b.ratio ? a : b);
    if (bestLevel.level !== worstLevel.level) {
      addText(`Meilleur niveau : ${bestLevel.level.toUpperCase()} (${bestLevel.ratio}%) | A renforcer : ${worstLevel.level.toUpperCase()} (${worstLevel.ratio}%)`);
    }
  }
  yPos += 4;

  // ========== 5. CLASSEMENT DES CLASSES ==========
  checkNewPage(60);
  addSubtitle('Classement des classes (annee complete)');

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Classe', 'Participations', 'Bavardages', 'Absences', 'Ratio']],
    body: sortedClasses.map((cls, idx) => [
      (idx + 1).toString(),
      cls.name,
      cls.participations.toString(),
      cls.bavardages.toString(),
      cls.absences.toString(),
      `${cls.ratio}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
    bodyStyles: { fontSize: 9, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', fontStyle: 'bold' }
    },
    margin: { left: 14 },
    tableWidth: pageWidth - 28,
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 0) {
        const rank = parseInt(hookData.cell.raw as string);
        if (rank === 1) hookData.cell.styles.fillColor = [255, 215, 0];
        else if (rank === 2) hookData.cell.styles.fillColor = [192, 192, 192];
        else if (rank === 3) hookData.cell.styles.fillColor = [205, 127, 50];
      }
    },
  });
  yPos = (doc as any).lastAutoTable.finalY + 8;

  // ========== 6. ELEVES EN PROGRESSION ==========
  checkNewPage(60);
  addSubtitle('Eleves en forte progression');

  if (data.topProgressStudents.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Eleve', 'Classe', 'T1', 'T2', 'T3', 'Progression']],
      body: data.topProgressStudents.slice(0, 10).map(s => [
        s.pseudo,
        s.className,
        s.t1Grade !== null ? `${s.t1Grade.toFixed(1)}` : '-',
        s.t2Grade !== null ? `${s.t2Grade.toFixed(1)}` : '-',
        s.t3Grade !== null ? `${s.t3Grade.toFixed(1)}` : '-',
        `+${(s.yearAverage - (s.t1Grade || 0)).toFixed(1)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94], fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  } else {
    addText('Donnees insuffisantes pour identifier les progressions.');
  }

  // ========== 7. ELEVES A SURVEILLER ==========
  checkNewPage(60);
  addSubtitle('Eleves en difficulte');

  if (data.concerningStudents.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Eleve', 'Classe', 'T1', 'T2', 'T3', 'Evolution']],
      body: data.concerningStudents.slice(0, 10).map(s => [
        s.pseudo,
        s.className,
        s.t1Grade !== null ? `${s.t1Grade.toFixed(1)}` : '-',
        s.t2Grade !== null ? `${s.t2Grade.toFixed(1)}` : '-',
        s.t3Grade !== null ? `${s.t3Grade.toFixed(1)}` : '-',
        `${(s.yearAverage - (s.t1Grade || s.yearAverage)).toFixed(1)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  } else {
    addText('Aucun eleve en difficulte majeure identifie.');
  }

  // ========== 8. EQUITE FILLES/GARCONS ==========
  checkNewPage(50);
  addSubtitle('Equite filles / garcons (annee)');

  if (data.genderStats && (data.genderStats.filles.count > 0 || data.genderStats.garcons.count > 0)) {
    const gs = data.genderStats;
    const fillesAvg = gs.filles.count > 0 ? (gs.filles.participations / gs.filles.count).toFixed(1) : '0';
    const garconsAvg = gs.garcons.count > 0 ? (gs.garcons.participations / gs.garcons.count).toFixed(1) : '0';

    autoTable(doc, {
      startY: yPos,
      head: [['', 'Effectif', 'Participations totales', 'Moy/eleve', 'Bavardages', 'Absences']],
      body: [
        ['Filles', gs.filles.count.toString(), gs.filles.participations.toString(), fillesAvg, gs.filles.bavardages.toString(), gs.filles.absences.toString()],
        ['Garcons', gs.garcons.count.toString(), gs.garcons.participations.toString(), garconsAvg, gs.garcons.bavardages.toString(), gs.garcons.absences.toString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241], fontSize: 9 },
      bodyStyles: { fontSize: 9, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
      margin: { left: 14 },
      tableWidth: pageWidth - 28,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;

    const fillesAvgNum = gs.filles.count > 0 ? gs.filles.participations / gs.filles.count : 0;
    const garconsAvgNum = gs.garcons.count > 0 ? gs.garcons.participations / gs.garcons.count : 0;
    const diffPercent = Math.abs(fillesAvgNum - garconsAvgNum) / ((fillesAvgNum + garconsAvgNum) / 2) * 100;

    if (diffPercent > 20) {
      const higher = fillesAvgNum > garconsAvgNum ? 'filles' : 'garcons';
      addBullet(`Desequilibre notable : les ${higher} participent ${diffPercent.toFixed(0)}% plus`, 'orange');
    } else {
      addBullet('Bonne equite de participation entre filles et garcons', 'green');
    }
  }
  yPos += 4;

  // ========== 9. SORTIES RECURRENTES ==========
  checkNewPage(50);
  addSubtitle('Sorties recurrentes (annee)');

  const recurrentStudents = data.studentSorties.filter(s => s.count >= 5).slice(0, 8);
  if (recurrentStudents.length > 0) {
    addText(`${recurrentStudents.length} eleve(s) avec 5+ sorties sur l'annee :`);
    autoTable(doc, {
      startY: yPos,
      head: [['Eleve', 'Classe', 'Nb sorties']],
      body: recurrentStudents.map(s => [s.pseudo, s.className, s.count.toString()]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14 },
      tableWidth: 100,
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
  } else {
    addText('Aucun abus de sorties detecte sur l\'annee.');
  }

  // ========== 10. SYNTHESE ANNUELLE ==========
  doc.addPage();
  yPos = 20;

  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageWidth, 25, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('SYNTHESE DE L\'ANNEE', 14, 16);
  yPos = 35;

  // Points positifs
  addSubtitle('Points positifs');
  const positives: string[] = [];
  if (globalRatio >= 60) positives.push(`Ratio global satisfaisant sur l'annee (${globalRatio}%)`);
  if (yearEvolution > 0) positives.push(`Progression generale : +${yearEvolution.toFixed(1)} pts de moyenne`);
  if (sortedClasses[0]) positives.push(`Classe exemplaire : ${sortedClasses[0].name} (${sortedClasses[0].ratio}%)`);
  if (data.topProgressStudents.length > 5) positives.push(`${data.topProgressStudents.length} eleves en forte progression`);
  if (positives.length === 0) positives.push('Annee de mise en place du suivi');
  positives.forEach(p => addBullet(p, 'green'));
  yPos += 6;

  // Axes d'amelioration
  addSubtitle('Axes d\'amelioration pour l\'annee prochaine');
  const improvements: string[] = [];
  if (globalRatio < 60) improvements.push(`Viser un ratio global > 60% (actuellement ${globalRatio}%)`);
  if (sortedClasses[sortedClasses.length - 1]?.ratio < 50) {
    improvements.push(`Renforcer le suivi des classes type ${sortedClasses[sortedClasses.length - 1].name}`);
  }
  if (data.concerningStudents.length > 5) improvements.push(`Attention aux ${data.concerningStudents.length} eleves en difficulte`);
  if (recurrentStudents.length > 3) improvements.push('Mettre en place un suivi des sorties');
  if (improvements.length === 0) improvements.push('Maintenir les efforts actuels');
  improvements.forEach(p => addBullet(p, 'orange'));
  yPos += 6;

  // Recommandations
  addSubtitle('Recommandations');
  addBullet('Conserver les donnees d\'evolution pour comparaison', 'blue');
  addBullet('Preparer le T1 avec des objectifs clairs par classe', 'blue');
  addBullet('Identifier les eleves a suivre des la rentree', 'blue');

  // Footer
  yPos = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text(`Bilan genere le ${new Date().toLocaleDateString('fr-FR')} - Gestion Classe`, 14, yPos);

  // Save
  const fileName = `Bilan_Annuel_${data.schoolYear.replace('/', '-')}.pdf`;
  doc.save(fileName);
}

// Helper to prepare year-end data
export function prepareYearEndReportData(
  classes: { id: string; name: string }[],
  events: { type: string; class_id: string; student_id: string }[],
  students: { id: string; pseudo: string; class_id: string }[],
  trimesterGrades: { student_id: string; trimester: number; grade: number; participations: number; class_id: string }[],
  genderStats: GenderStats | null,
  schoolYear: string,
): YearEndReportData {
  // Calculate class stats from events
  const classStatsMap = new Map<string, ClassData>();
  classes.forEach(cls => {
    classStatsMap.set(cls.id, {
      id: cls.id,
      name: cls.name,
      level: extractLevel(cls.name),
      participations: 0,
      bavardages: 0,
      absences: 0,
      sorties: 0,
      ratio: 0,
      studentCount: students.filter(s => s.class_id === cls.id).length,
    });
  });

  events.forEach(event => {
    const cls = classStatsMap.get(event.class_id);
    if (!cls) return;
    if (event.type === 'participation') cls.participations++;
    else if (event.type === 'bavardage') cls.bavardages++;
    else if (event.type === 'absence') cls.absences++;
    else if (event.type === 'sortie') cls.sorties++;
  });

  classStatsMap.forEach(cls => {
    const total = cls.participations + cls.bavardages;
    cls.ratio = total > 0 ? Math.round((cls.participations / total) * 100) : 0;
  });

  // Trimester data aggregation
  const trimesterDataMap = new Map<string, TrimesterGradeData>();
  trimesterGrades.forEach(tg => {
    const cls = classes.find(c => c.id === tg.class_id);
    const key = `${tg.trimester}-${tg.class_id}`;
    if (!trimesterDataMap.has(key)) {
      trimesterDataMap.set(key, {
        trimester: tg.trimester,
        className: cls?.name || 'Inconnu',
        studentCount: 0,
        totalParticipations: 0,
        totalAbsences: 0,
        averageGrade: 0,
      });
    }
    const entry = trimesterDataMap.get(key)!;
    entry.studentCount++;
    entry.totalParticipations += tg.participations;
    entry.averageGrade = ((entry.averageGrade * (entry.studentCount - 1)) + tg.grade) / entry.studentCount;
  });

  // Student year data
  const studentYearDataMap = new Map<string, StudentYearData>();
  students.forEach(s => {
    const cls = classes.find(c => c.id === s.class_id);
    studentYearDataMap.set(s.id, {
      pseudo: s.pseudo,
      className: cls?.name || 'Inconnu',
      t1Grade: null,
      t2Grade: null,
      t3Grade: null,
      yearAverage: 0,
      evolution: 'stable',
      t1Participations: 0,
      t2Participations: 0,
      t3Participations: 0,
    });
  });

  trimesterGrades.forEach(tg => {
    const entry = studentYearDataMap.get(tg.student_id);
    if (!entry) return;
    if (tg.trimester === 1) {
      entry.t1Grade = tg.grade;
      entry.t1Participations = tg.participations;
    } else if (tg.trimester === 2) {
      entry.t2Grade = tg.grade;
      entry.t2Participations = tg.participations;
    } else if (tg.trimester === 3) {
      entry.t3Grade = tg.grade;
      entry.t3Participations = tg.participations;
    }
  });

  // Calculate year average and evolution
  studentYearDataMap.forEach(entry => {
    const grades = [entry.t1Grade, entry.t2Grade, entry.t3Grade].filter(g => g !== null) as number[];
    entry.yearAverage = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;

    if (entry.t1Grade !== null && entry.t3Grade !== null) {
      const diff = entry.t3Grade - entry.t1Grade;
      if (diff > 2) entry.evolution = 'up';
      else if (diff < -2) entry.evolution = 'down';
      else entry.evolution = 'stable';
    }
  });

  const studentYearData = Array.from(studentYearDataMap.values());

  // Top progress students (T3 - T1 > 2 points)
  const topProgressStudents = studentYearData
    .filter(s => s.t1Grade !== null && s.t3Grade !== null && (s.t3Grade - s.t1Grade) > 2)
    .sort((a, b) => ((b.t3Grade || 0) - (b.t1Grade || 0)) - ((a.t3Grade || 0) - (a.t1Grade || 0)));

  // Concerning students (average < 10 or T3 - T1 < -2)
  const concerningStudents = studentYearData
    .filter(s => s.yearAverage < 10 || (s.t1Grade !== null && s.t3Grade !== null && (s.t3Grade - s.t1Grade) < -2))
    .sort((a, b) => a.yearAverage - b.yearAverage);

  // Student sorties
  const sortiesByStudent = new Map<string, number>();
  events.filter(e => e.type === 'sortie').forEach(e => {
    sortiesByStudent.set(e.student_id, (sortiesByStudent.get(e.student_id) || 0) + 1);
  });

  const studentSorties: StudentSortie[] = [];
  sortiesByStudent.forEach((count, studentId) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const cls = classes.find(c => c.id === student.class_id);
      studentSorties.push({
        studentId,
        pseudo: student.pseudo,
        className: cls?.name || 'Inconnu',
        count,
      });
    }
  });
  studentSorties.sort((a, b) => b.count - a.count);

  return {
    schoolYear,
    classes: Array.from(classStatsMap.values()),
    genderStats,
    studentSorties,
    totalStudents: students.length,
    trimesterData: Array.from(trimesterDataMap.values()),
    studentYearData,
    topProgressStudents,
    concerningStudents,
  };
}

// Helper to prepare data from Analytics/Students pages
export function prepareReportData(
  classes: { id: string; name: string }[],
  events: { type: string; class_id: string; student_id: string }[],
  students: { id: string; pseudo: string; class_id: string }[],
  genderStats: GenderStats | null,
  trimester: number,
  schoolYear: string,
): ReportData {
  // Calculate class stats
  const classStatsMap = new Map<string, ClassData>();

  classes.forEach(cls => {
    classStatsMap.set(cls.id, {
      id: cls.id,
      name: cls.name,
      level: extractLevel(cls.name),
      participations: 0,
      bavardages: 0,
      absences: 0,
      sorties: 0,
      ratio: 0,
      studentCount: students.filter(s => s.class_id === cls.id).length,
    });
  });

  events.forEach(event => {
    const cls = classStatsMap.get(event.class_id);
    if (!cls) return;

    if (event.type === 'participation') cls.participations++;
    else if (event.type === 'bavardage') cls.bavardages++;
    else if (event.type === 'absence') cls.absences++;
    else if (event.type === 'sortie') cls.sorties++;
  });

  // Calculate ratios
  classStatsMap.forEach(cls => {
    const total = cls.participations + cls.bavardages;
    cls.ratio = total > 0 ? Math.round((cls.participations / total) * 100) : 0;
  });

  // Calculate student sorties
  const sortiesByStudent = new Map<string, number>();
  events.filter(e => e.type === 'sortie').forEach(e => {
    sortiesByStudent.set(e.student_id, (sortiesByStudent.get(e.student_id) || 0) + 1);
  });

  const studentSorties: StudentSortie[] = [];
  sortiesByStudent.forEach((count, studentId) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const cls = classes.find(c => c.id === student.class_id);
      studentSorties.push({
        studentId,
        pseudo: student.pseudo,
        className: cls?.name || 'Inconnu',
        count,
      });
    }
  });
  studentSorties.sort((a, b) => b.count - a.count);

  // Date range
  const now = new Date();
  const startOfTrimester = new Date(now.getFullYear(), (trimester - 1) * 4, 1); // Approximate

  return {
    trimester,
    schoolYear,
    dateRange: {
      start: startOfTrimester.toLocaleDateString('fr-FR'),
      end: now.toLocaleDateString('fr-FR'),
    },
    classes: Array.from(classStatsMap.values()),
    genderStats,
    studentSorties,
    totalStudents: students.length,
  };
}
