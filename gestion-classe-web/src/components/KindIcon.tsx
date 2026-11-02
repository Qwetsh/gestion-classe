import { ASSESSMENT_KIND_LABEL, type AssessmentKind } from '../lib/evaluationQueries';

/**
 * Petite icône du type d'évaluation, pour l'en-tête de colonne du carnet (traits, couleur du
 * texte). Écrit : feuille ; devoir maison : maison ; TP : fiole ; oral : micro ; projet : dossier.
 */
export function KindIcon({ kind, size = 12 }: { kind: AssessmentKind; size?: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    role: 'img' as const, 'aria-label': ASSESSMENT_KIND_LABEL[kind] ?? kind,
  };
  switch (kind) {
    case 'dm':
      return <svg {...common}><title>{ASSESSMENT_KIND_LABEL.dm}</title><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9z" /></svg>;
    case 'tp':
      return <svg {...common}><title>{ASSESSMENT_KIND_LABEL.tp}</title><path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3M7.5 14h9" /></svg>;
    case 'oral':
      return <svg {...common}><title>{ASSESSMENT_KIND_LABEL.oral}</title><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>;
    case 'groupe':
      return <svg {...common}><title>{ASSESSMENT_KIND_LABEL.groupe}</title><circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" /><path d="M2 20c.6-3 3-5 6-5s5.4 2 6 5M12.5 15.3c1-.8 2.2-1.3 3.5-1.3 3 0 5.4 2 6 5" /></svg>;
    case 'projet':
      return <svg {...common}><title>{ASSESSMENT_KIND_LABEL.projet}</title><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>;
    case 'ecrit':
    default:
      return <svg {...common}><title>{ASSESSMENT_KIND_LABEL.ecrit}</title><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" /></svg>;
  }
}
