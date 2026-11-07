import { COMPETENCE_LEVELS, type GradeDetails } from './gradeDetails';
import { questionScore, type ActivityDefinition, type WorkCorrection } from './productionsQueries';

/**
 * Correction d'une production numérique (critères cochés, remarques, compétences 1 à 4, conseils)
 * lue au format du détail d'une copie d'éval (gradeDetails.ts) : la colonne de droite des
 * productions affiche ainsi exactement la même analyse que celle des copies scannées
 * (GradeDetailsView : radar, niveaux, tableau des questions).
 */
export function productionDetails(
  def: ActivityDefinition,
  corr: WorkCorrection,
  skills: Record<string, number>,
  advice: string,
  total: number,
  baremeTotal: number,
): GradeDetails {
  const compName = new Map((def.competences ?? []).map((c) => [c.id, c.nom]));
  return {
    version: null,
    baremeTotal,
    noteBrute: total,
    noteForcee: false,
    // Le bonus n'a pas de barème propre : il compte à part, pas dans le tableau.
    questions: def.questions
      .filter((q) => !q.bonus)
      .map((q) => ({
        label: `${q.num}. ${q.titre}`,
        bareme: q.points,
        points: questionScore(q, corr),
        commentaire: corr.questions[q.id]?.remarque?.trim() ?? '',
        competences: (q.competences ?? []).map((id) => compName.get(id) ?? id),
      })),
    competences: (def.competences ?? []).map((c) => {
      const lvl = skills[c.id];
      return { nom: c.nom, niveau: lvl >= 1 && lvl <= 4 ? COMPETENCE_LEVELS[lvl - 1] : null };
    }),
    forces: '',
    faiblesses: advice.trim(),
    commentaire: '',
  };
}
