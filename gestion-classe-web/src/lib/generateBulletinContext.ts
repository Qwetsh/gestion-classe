/**
 * Generates a Markdown file with per-student data,
 * structured for Claude to produce bulletin remarks.
 */

interface BulletinStudentData {
  pseudo: string;
  gender: 'M' | 'F';
  participations: number;
  manualParticipations: number;
  totalParticipations: number;
  malus: number;
  absences: number;
  grade: number;
  bonus: number;
  oralGrade: number | null;
  oralLabel: string | null;
  remarques: string[];
  sorties: { subtype: string; count: number }[];
  stampProgress: { cardNumber: number; stampCount: number; tier: string } | null;
  groupGrades: { sessionName: string; score: number; maxPoints: number }[];
}

interface BulletinExportOptions {
  className: string;
  trimester: number;
  schoolYear: string;
  classAverage: number;
  students: BulletinStudentData[];
  matiere?: string;
}

const ORAL_GRADE_LABELS: Record<number, string> = {
  1: 'Insuffisant',
  2: 'Fragile',
  3: 'Satisfaisant',
  4: 'Bien',
  5: 'Tres bien',
};

export function getOralLabel(grade: number): string {
  return ORAL_GRADE_LABELS[grade] || `${grade}/5`;
}

export function generateBulletinContext(options: BulletinExportOptions): string {
  const { className, trimester, schoolYear, classAverage, students, matiere } = options;

  const lines: string[] = [];

  lines.push(`# Contexte pour appreciations de bulletin`);
  lines.push(``);
  lines.push(`## Informations generales`);
  lines.push(`- Classe : ${className}`);
  lines.push(`- Trimestre : T${trimester}`);
  lines.push(`- Annee scolaire : ${schoolYear}`);
  lines.push(`- Moyenne de classe (participation) : ${classAverage.toFixed(1)}/20`);
  lines.push(`- Nombre d'eleves : ${students.length}`);
  if (matiere) lines.push(`- Matiere : ${matiere}`);
  lines.push(``);
  lines.push(`## Legende des donnees`);
  lines.push(`- **Participations** : nombre de fois ou l'eleve a leve la main / participe activement`);
  lines.push(`- **Malus** : nombre de bavardages ou comportements perturbateurs`);
  lines.push(`- **Absences** : nombre de seances manquees`);
  lines.push(`- **Note** : note de participation calculee sur 20`);
  lines.push(`- **Bonus** : participations supplementaires au-dela de l'objectif`);
  lines.push(`- **Oral** : evaluation de la qualite de l'expression orale (1-5)`);
  lines.push(`- **Remarques** : observations libres notees en cours`);
  lines.push(`- **Sorties** : nombre de sorties de classe par motif`);
  lines.push(`- **TP** : notes de travaux pratiques en groupe`);
  lines.push(`- **Tampons** : progression dans le systeme de recompenses (engagement)`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## Donnees par eleve`);
  lines.push(``);

  for (const s of students) {
    lines.push(`### ${s.pseudo} (${s.gender === 'F' ? 'fille' : 'garcon'})`);
    lines.push(``);
    lines.push(`| Indicateur | Valeur |`);
    lines.push(`|---|---|`);
    lines.push(`| Participations | ${s.totalParticipations} (${s.participations} en cours + ${s.manualParticipations} manuelles) |`);
    lines.push(`| Malus (bavardages) | ${s.malus} |`);
    lines.push(`| Absences | ${s.absences} |`);
    lines.push(`| Note participation | ${s.grade.toFixed(1)}/20 |`);
    if (s.bonus > 0) {
      lines.push(`| Bonus | +${s.bonus.toFixed(0)} participations au-dela de l'objectif |`);
    }
    if (s.oralGrade !== null) {
      lines.push(`| Oral | ${s.oralGrade}/5 (${s.oralLabel}) |`);
    }

    if (s.groupGrades.length > 0) {
      lines.push(``);
      lines.push(`**Travaux pratiques :**`);
      for (const g of s.groupGrades) {
        lines.push(`- ${g.sessionName} : ${g.score}/${g.maxPoints}`);
      }
    }

    if (s.sorties.length > 0) {
      lines.push(``);
      lines.push(`**Sorties :** ${s.sorties.map(x => `${x.subtype} (${x.count})`).join(', ')}`);
    }

    if (s.stampProgress) {
      lines.push(``);
      lines.push(`**Tampons :** carte n${s.stampProgress.cardNumber} (${s.stampProgress.tier}), ${s.stampProgress.stampCount}/10 tampons`);
    }

    if (s.remarques.length > 0) {
      lines.push(``);
      lines.push(`**Remarques de l'enseignant :**`);
      for (const r of s.remarques) {
        lines.push(`- "${r}"`);
      }
    }

    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Consigne pour Claude`);
  lines.push(``);
  lines.push(`A partir des donnees ci-dessus, redige une appreciation de bulletin pour chaque eleve.`);
  lines.push(`Consignes :`);
  lines.push(`- 2-3 phrases par eleve, ton professionnel et bienveillant`);
  lines.push(`- Mentionne les points forts ET les axes d'amelioration`);
  lines.push(`- Adapte le ton selon le profil (eleve en difficulte vs excellent)`);
  lines.push(`- Utilise le prenom de l'eleve`);
  lines.push(`- Si beaucoup de malus : souligner le besoin de concentration`);
  lines.push(`- Si beaucoup d'absences : mentionner l'impact sur la progression`);
  lines.push(`- Si bonne participation + bonne note : encourager et feliciter`);
  lines.push(`- Si remarques specifiques : les integrer naturellement`);
  lines.push(`- Tutoiement interdit, utiliser "vous" ou formulation impersonnelle`);
  lines.push(`- Format de sortie : tableau avec colonnes Prenom | Appreciation`);

  return lines.join('\n');
}

export function downloadBulletinContext(content: string, className: string, trimester: number): void {
  const filename = `bulletin_T${trimester}_${className.replace(/\s+/g, '_')}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
