// Icônes de la page En direct (traits, couleur du texte).
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const IconeActualiser = ({ taille = 18 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
);
export const IconeMessage = ({ taille = 16 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}><path d="M4 5h16v11H8l-4 4z" /></svg>
);
export const IconeSuivant = ({ taille = 16 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconePrecedent = ({ taille = 18 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}><path d="M15 6l-6 6 6 6" /></svg>
);
export const IconeOrdonnance = ({ taille = 14 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}><path d="M7 3h10v18H7z" /><path d="M10 8h4M10 12h4M10 16h2" /></svg>
);
export const IconeCoche = ({ taille = 12 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base} strokeWidth={3}><path d="M5 12l5 5 9-10" /></svg>
);
export const IconeFermer = ({ taille = 18 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
