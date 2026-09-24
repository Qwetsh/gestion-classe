import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AssessmentRow, ExportClass, ExportStudent, GradeBookExport, GradeRow } from './evaluationQueries';
import {
  describeGrades,
  effectiveGrade,
  STATUS_SHORT,
  studentAverage,
  type GradeEntry,
  type GradeStatus,
} from './gradeStats';

/**
 * Export du carnet de notes (cf. PLAN_carnet_de_notes.md §6.2, lot 3).
 *
 * Ces exports se téléchargent : ils ne dépendent d'aucun compte tiers, d'aucune clé à
 * renseigner, d'aucun réseau autre que Supabase. C'est le filet réel, celui qui doit
 * fonctionner le jour où le reste ne fonctionne pas.
 */

const PERIODS = [1, 2, 3];

const cellKey = (assessmentId: string, studentId: string) => `${assessmentId}|${studentId}`;

/** Horodatage de nom de fichier : `2026-09-22`. */
function stamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function frDateTime(d: Date): string {
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function frDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

/** Entrée de calcul pour un élève à une évaluation. */
function entryOf(cls: ExportClass, assessmentId: string, studentId: string): GradeEntry {
  const row = cls.grades.get(cellKey(assessmentId, studentId));
  return {
    studentId,
    grade: row?.grade ?? null,
    status: (row?.status ?? 'noted') as GradeStatus,
  };
}

/**
 * Valeur d'une cellule exportée : la note **sur 20** si elle en a une, sinon le libellé
 * du statut. On exporte le /20 et non la note brute pour que les colonnes restent
 * comparables entre évaluations de barèmes différents ; le barème figure dans l'en-tête.
 */
export function exportCell(row: GradeRow | undefined): number | string {
  if (!row) return '';
  if (row.status !== 'noted') return STATUS_SHORT[row.status];
  if (row.grade === null || row.grade === undefined) return '';
  return round2(row.grade);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Moyenne d'un élève sur une période (ou sur l'année si `period` vaut `null`). */
function averageOf(cls: ExportClass, studentId: string, period: number | null): number | null {
  const rows = cls.assessments
    .filter((a) => period === null || a.period === period)
    .map((a) => ({
      entry: entryOf(cls, a.id, studentId),
      assessment: { coefficient: Number(a.coefficient) || 0, countsInAverage: a.counts_in_average },
    }));
  const avg = studentAverage(rows);
  return avg === null ? null : round2(avg);
}

/** Libellé de l'étendue couverte : « 2026-2027 » ou « 2024-2025 à 2026-2027 ». */
function yearLabel(data: GradeBookExport): string {
  const y = data.schoolYears;
  if (y.length === 0) return '—';
  if (y.length === 1) return y[0];
  return `${y[0]} à ${y[y.length - 1]}`;
}

/** Fragment d'horodatage pour le nom de fichier. */
function yearSlug(data: GradeBookExport): string {
  const y = data.schoolYears;
  if (y.length === 0) return 'vide';
  return y.length === 1 ? y[0] : `${y[0]}_${y[y.length - 1]}`;
}

/** Nom d'élève, suffixé quand il n'appartient plus à la classe. */
export function studentLabel(s: ExportStudent): string {
  return s.attached ? s.pseudo : `${s.pseudo} (a quitté la classe)`;
}

/** En-tête de colonne : « T1 · Éval Nutrition (coef 2, /20) », préfixée de l'année si besoin. */
function columnLabel(a: AssessmentRow, multiYear: boolean): string {
  const bits = [`coef ${Number(a.coefficient)}`, `/${Number(a.bareme_total ?? 20)}`];
  if (!a.counts_in_average) bits.push('hors moyenne');
  const prefix = multiYear && a.school_year ? `${a.school_year} ` : '';
  return `${prefix}T${a.period ?? '?'} · ${a.name} (${bits.join(', ')})`;
}

/**
 * Nom d'onglet Excel : 31 caractères maximum, sans les caractères interdits, et unique
 * dans le classeur — Excel refuse le doublon et tronque en silence.
 * Exporté pour être testé.
 */
export function sheetName(name: string, taken: Set<string>): string {
  let base = name.replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Classe';
  let candidate = base;
  let i = 2;
  while (taken.has(candidate)) {
    const suffix = ` (${i++})`;
    base = base.slice(0, 31 - suffix.length);
    candidate = base + suffix;
  }
  taken.add(candidate);
  return candidate;
}

// ============================================================
// Export Excel
// ============================================================

/**
 * Classeur : un onglet par classe, un récapitulatif, et des métadonnées.
 *
 * L'onglet « Métadonnées » n'est pas décoratif : il porte la date d'export et la date de
 * la plus ancienne évaluation, c'est-à-dire ce que cette sauvegarde couvre réellement.
 */
export function exportGradeBookXlsx(data: GradeBookExport, account: string): void {
  const now = new Date();
  const wb = XLSX.utils.book_new();
  // Pré-réservés : une classe portant l'un de ces noms ferait échouer l'ajout d'onglet.
  const taken = new Set<string>(['Récapitulatif', 'Métadonnées']);
  const multiYear = data.schoolYears.length > 1;

  // --- Un onglet par classe ---
  for (const cls of data.classes) {
    const ordered = [...cls.assessments].sort(
      (a, b) => (a.school_year ?? '').localeCompare(b.school_year ?? '')
        || (a.period ?? 0) - (b.period ?? 0)
        || (a.date ?? '').localeCompare(b.date ?? ''),
    );

    const header = ['Élève', ...ordered.map((a) => columnLabel(a, multiYear))];
    for (const p of PERIODS) {
      if (ordered.some((a) => a.period === p)) header.push(`Moyenne T${p}`);
    }
    header.push('Moyenne année');

    const rows: (string | number)[][] = [header];

    for (const s of cls.students) {
      const line: (string | number)[] = [studentLabel(s)];
      for (const a of ordered) line.push(exportCell(cls.grades.get(cellKey(a.id, s.id))));
      for (const p of PERIODS) {
        if (!ordered.some((a) => a.period === p)) continue;
        line.push(averageOf(cls, s.id, p) ?? '');
      }
      line.push(averageOf(cls, s.id, null) ?? '');
      rows.push(line);
    }

    // Pieds de tableau : moyenne et médiane de classe par évaluation.
    const stats = ordered.map((a) => describeGrades(cls.students.map((s) => entryOf(cls, a.id, s.id))));
    rows.push([
      'Moyenne classe',
      ...stats.map((st) => (st.mean === null ? '' : round2(st.mean))),
    ]);
    rows.push([
      'Médiane',
      ...stats.map((st) => (st.median === null ? '' : round2(st.median))),
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Pas de gel des volets : SheetJS (edition communautaire) ne sait pas l'ecrire.
    ws['!cols'] = [{ wch: 22 }, ...ordered.map(() => ({ wch: 16 })), ...PERIODS.map(() => ({ wch: 12 }))];
    XLSX.utils.book_append_sheet(wb, ws, sheetName(cls.className, taken));
  }

  // --- Récapitulatif : une ligne par élève ---
  const recap: (string | number)[][] = [
    ['Classe', 'Élève', 'Rattachement', 'Moyenne T1', 'Moyenne T2', 'Moyenne T3', 'Moyenne année', 'Notes saisies'],
  ];
  for (const cls of data.classes) {
    for (const s of cls.students) {
      const counted = cls.assessments.filter(
        (a) => effectiveGrade(entryOf(cls, a.id, s.id)) !== null,
      ).length;
      recap.push([
        cls.className,
        s.pseudo,
        s.attached ? 'Dans la classe' : 'A quitté la classe',
        averageOf(cls, s.id, 1) ?? '',
        averageOf(cls, s.id, 2) ?? '',
        averageOf(cls, s.id, 3) ?? '',
        averageOf(cls, s.id, null) ?? '',
        counted,
      ]);
    }
  }
  const wsRecap = XLSX.utils.aoa_to_sheet(recap);
  wsRecap['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 13 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');

  // --- Métadonnées ---
  const meta: (string | number)[][] = [
    ['Export du carnet de notes'],
    [],
    ['Exporté le', frDateTime(now)],
    ['Années couvertes', yearLabel(data)],
    ['Compte', account],
    ['Classes exportées', data.classes.length],
    ['Élèves', data.classes.reduce((n, c) => n + c.students.length, 0)],
    ['Évaluations', data.classes.reduce((n, c) => n + c.assessments.length, 0)],
    ['Notes enregistrées', data.totalGrades],
    ['Couverture à partir du', frDate(data.coverageFrom)],
    ['Élèves ayant quitté leur classe', data.detachedCount],
    [],
    ['Lecture des statuts'],
    ['abs', 'Absent — exclu de la moyenne'],
    ['disp', 'Dispensé — exclu de la moyenne'],
    ['n.r.', 'Non rendu — exclu de la moyenne'],
    ['n.r. (0)', 'Non rendu — compte comme un zéro'],
    ['(vide)', 'Pas encore corrigé — exclu de la moyenne'],
    [],
    ['Les notes des onglets de classe sont ramenées sur 20 ; le barème de saisie figure dans l’en-tête de colonne.'],
    ['Un élève marqué « a quitté la classe » a changé de classe ou a été détaché au passage'],
    ['d’année : ses notes restent dans la sauvegarde, rattachées à la classe où il les a obtenues.'],
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta['!cols'] = [{ wch: 24 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Métadonnées');

  XLSX.writeFile(wb, `notes_${yearSlug(data)}_${stamp(now)}.xlsx`);
}

// ============================================================
// Export PDF
// ============================================================

/**
 * Version imprimable : un tableau par classe et par trimestre, horodaté en pied de page.
 * C'est la pièce qu'on peut produire telle quelle en cas de litige.
 */
export function exportGradeBookPdf(data: GradeBookExport, account: string): void {
  const now = new Date();
  const doc = new jsPDF({ orientation: 'landscape' });
  let first = true;

  const years = data.schoolYears.length > 0 ? data.schoolYears : [null];

  for (const cls of data.classes) {
    for (const year of years) {
     for (const period of PERIODS) {
      const assessments = cls.assessments
        .filter((a) => (year === null || a.school_year === year) && a.period === period)
        .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
      if (assessments.length === 0) continue;

      if (!first) doc.addPage();
      first = false;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 34, 34);
      doc.text(`${cls.className} — Trimestre ${period}`, 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text(`Année ${year ?? '—'} · notes ramenées sur 20`, 14, 22);

      const head = [
        ['Élève', ...assessments.map((a) => `${a.name}\ncoef ${Number(a.coefficient)} · /${Number(a.bareme_total ?? 20)}`), 'Moyenne'],
      ];

      const body = cls.students.map((s) => [
        studentLabel(s),
        ...assessments.map((a) => {
          const v = exportCell(cls.grades.get(cellKey(a.id, s.id)));
          return typeof v === 'number' ? v.toFixed(1).replace('.', ',') : v;
        }),
        (() => {
          const rows = assessments.map((a) => ({
            entry: entryOf(cls, a.id, s.id),
            assessment: { coefficient: Number(a.coefficient) || 0, countsInAverage: a.counts_in_average },
          }));
          const avg = studentAverage(rows);
          return avg === null ? '—' : avg.toFixed(1).replace('.', ',');
        })(),
      ]);

      const stats = assessments.map((a) => describeGrades(cls.students.map((s) => entryOf(cls, a.id, s.id))));
      const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(1).replace('.', ','));

      autoTable(doc, {
        head,
        body,
        foot: [
          ['Moyenne classe', ...stats.map((st) => fmt(st.mean)), ''],
          ['Médiane', ...stats.map((st) => fmt(st.median)), ''],
        ],
        startY: 27,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 7.5 },
        footStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
        columnStyles: { 0: { halign: 'left', cellWidth: 46 } },
        // Toutes les colonnes de notes sont centrées ; seul le nom reste à gauche.
        didParseCell: (hook) => {
          if (hook.column.index > 0) hook.cell.styles.halign = 'center';
        },
      });
     }
    }
  }

  if (first) {
    // Aucune évaluation : on produit quand même une page, qui dit qu'il n'y a rien.
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Aucune évaluation enregistrée sur la période demandée.', 14, 20);
  }

  // Pied de page sur chaque page : la trace qui donne sa valeur au document.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    const h = doc.internal.pageSize.getHeight();
    const w = doc.internal.pageSize.getWidth();
    doc.text(
      `Carnet de notes ${yearLabel(data)} · ${account} · export du ${frDateTime(now)} · couverture depuis le ${frDate(data.coverageFrom)}`,
      14, h - 8,
    );
    doc.text(`${i}/${pages}`, w - 20, h - 8);
  }

  doc.save(`notes_${yearSlug(data)}_${stamp(now)}.pdf`);
}
