import type { Case } from '../../lib/liveCarnet';
import { titreSansMention } from '../../lib/liveCarnet';

/** La bande de cases d'un carnet : une par question, pleine si elle est répondue, pointillée pour un bonus. */
export function BandeCases({ cases, fixes = false }: { cases: Case[]; fixes?: boolean }) {
  const faites = cases.filter((c) => c.faite).length;
  return (
    <div className={`ed-cases${fixes ? ' ed-cases--fixes' : ''}`} role="img" aria-label={`${faites} questions répondues sur ${cases.length}`}>
      {cases.map((c) => (
        <span
          key={c.id}
          className={`ed-case${c.faite ? ' ed-case--faite' : ''}${c.bonus ? ' ed-case--bonus' : ''}`}
          title={`${c.num} · ${titreSansMention(c.titre)}${c.faite ? ' (répondue)' : ''}`}
        >
          {c.num}
        </span>
      ))}
    </div>
  );
}

/** La légende des cases. */
export function LegendeCases({ suite }: { suite?: string }) {
  return (
    <div className="ed-legende">
      <span><span className="ed-case ed-case--faite" aria-hidden />question répondue</span>
      <span><span className="ed-case" aria-hidden />pas encore</span>
      <span><span className="ed-case ed-case--bonus" aria-hidden />bonus</span>
      <span>H hypothèse · C conclusion{suite ? ` · ${suite}` : ''}</span>
    </div>
  );
}
