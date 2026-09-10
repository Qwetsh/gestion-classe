import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export interface QrCardStudent {
  pseudo: string;
  code: string | null;
}

export interface QrCardClass {
  name: string;
  students: QrCardStudent[];
}

/**
 * Génère un PDF A4 de cartes à découper : une carte par élève avec un QR code
 * menant à l'interface élève (code pré-rempli) + le code d'accès en clair.
 * Chaque classe démarre sur une nouvelle page, élèves triés par pseudo.
 *
 * Grille : 5 colonnes × 6 lignes = 30 cartes / page, QR de 27 mm
 * (largement lisible pour une URL courte, même imprimé en qualité brouillon).
 */
export async function generateStudentQrCardsPdf(classes: QrCardClass[], studentPageUrl: string): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 8;
  const HEADER_H = 12;
  const COLS = 5;
  const ROWS = 6;
  const CARD_W = (PAGE_W - MARGIN * 2) / COLS;
  const CARD_H = (PAGE_H - MARGIN * 2 - HEADER_H) / ROWS;
  const QR_SIZE = 27;
  const PER_PAGE = COLS * ROWS;

  const shortUrl = studentPageUrl.replace(/^https?:\/\//, '');

  let firstPage = true;

  const drawHeader = (className: string, pageIdx: number, pageCount: number) => {
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(className, MARGIN, MARGIN + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const hint = `Scanne le QR code ou va sur ${shortUrl} et saisis ton code`;
    const pageLabel = pageCount > 1 ? `   ·   ${pageIdx + 1}/${pageCount}` : '';
    doc.text(hint + pageLabel, PAGE_W - MARGIN, MARGIN + 6, { align: 'right' });

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, MARGIN + HEADER_H - 2, PAGE_W - MARGIN, MARGIN + HEADER_H - 2);
  };

  const drawCard = (student: QrCardStudent, className: string, col: number, row: number) => {
    const x = MARGIN + col * CARD_W;
    const y = MARGIN + HEADER_H + row * CARD_H;

    // Bord pointillé pour la découpe
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.rect(x, y, CARD_W, CARD_H);
    doc.setLineDashPattern([], 0);

    // QR code : URL de l'app avec le code pré-rempli
    // Tracé vectoriel (rectangles) : fichier léger et rendu net à l'impression,
    // contrairement aux PNG que jsPDF stocke non compressés.
    const target = student.code ? `${studentPageUrl}?code=${student.code}` : studentPageUrl;
    const qr = QRCode.create(target, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const modules = qr.modules.data;
    const cell = QR_SIZE / size;
    const qrX = x + (CARD_W - QR_SIZE) / 2;
    const qrY = y + 2.5;
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < size; r++) {
      // Fusionne les modules noirs contigus d'une ligne en un seul rectangle
      let c = 0;
      while (c < size) {
        if (!modules[r * size + c]) { c++; continue; }
        let end = c;
        while (end + 1 < size && modules[r * size + end + 1]) end++;
        doc.rect(qrX + c * cell, qrY + r * cell, (end - c + 1) * cell, cell, 'F');
        c = end + 1;
      }
    }

    // Pseudo
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const pseudo = doc.splitTextToSize(student.pseudo, CARD_W - 4)[0] as string;
    doc.text(pseudo, x + CARD_W / 2, qrY + QR_SIZE + 4.2, { align: 'center' });

    // Code d'accès
    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    const codeText = student.code ? student.code.split('').join(' ') : '- - - - - -';
    doc.text(codeText, x + CARD_W / 2, qrY + QR_SIZE + 9.8, { align: 'center' });

    // Classe (utile si les cartes se mélangent)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(130, 130, 130);
    doc.text(className, x + CARD_W / 2, y + CARD_H - 1.8, { align: 'center' });
  };

  for (const cls of classes) {
    const students = [...cls.students].sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr'));
    if (students.length === 0) continue;
    const pageCount = Math.ceil(students.length / PER_PAGE);

    for (let p = 0; p < pageCount; p++) {
      if (!firstPage) doc.addPage();
      firstPage = false;
      drawHeader(cls.name, p, pageCount);

      const slice = students.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
      for (let i = 0; i < slice.length; i++) {
        drawCard(slice[i], cls.name, i % COLS, Math.floor(i / COLS));
      }
    }
  }

  return doc;
}
