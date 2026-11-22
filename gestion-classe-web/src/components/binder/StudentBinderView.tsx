/**
 * Classeur des élèves (PLAN_classeur_eleves.md, lots 2 et 3) : le classeur d'une classe, tel que le
 * serveur le rend à un visiteur sans compte (Edge Function `classeur-eleve`). Deux entrées : le lien
 * posé dans Pronote (jeton, page `/classeur/c/<jeton>`) et l'onglet « Classeur » de l'espace élève
 * (code à 6 chiffres, page `/eleve`). Aucune donnée personnelle, aucun lien vers l'espace du
 * professeur.
 *
 * Le classeur est le même composant que celui du professeur (BinderBook) ; seule sa source change.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { pagesFromReleased } from '../../lib/binderRelease';
import { INK_WIDTH_MM, SUMMARY_LEAD, withSummaries, wrapInk } from '../../lib/binderSummary';
import { MM } from '../../lib/course/coursePage';
import { StudentBinderError, binderKeyId, fetchStudentToc, studentDocLoader, type BinderKey, type StudentToc } from '../../lib/studentBinder';
import { BinderBook } from './BinderBook';
import { BinderSourceContext } from './binderSource';
import { useInkMeasure } from './useInkMeasure';

const ERRORS: Record<StudentBinderError['kind'], string> = {
  forbidden: 'Ce classeur n’est plus accessible par ici. Demande à ton professeur.',
  not_found: 'Ce classeur est introuvable.',
  network: 'Pas de connexion. Vérifie ta connexion à Internet, puis recharge la page.',
  server: 'Le classeur ne répond pas pour le moment. Réessaie dans quelques minutes.',
};

interface Props {
  /** Ce qui ouvre le classeur : le jeton du lien, ou le code de l'élève. */
  binderKey: BinderKey;
  /** Retour à l'écran d'où le classeur a été ouvert (espace élève). */
  onClose?: () => void;
  /** Le nom de la classe est connu (titre de la page). */
  onClassName?: (name: string) => void;
}

export function StudentBinderView({ binderKey, onClose, onClassName }: Props) {
  const id = binderKeyId(binderKey);
  // La clé est refaite à chaque rendu par l'appelant : on la fige tant qu'elle désigne le même accès
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = useMemo(() => binderKey, [id]);
  /** Sommaire lu pour un accès ; il ne vaut que pour lui. */
  const [loaded, setLoaded] = useState<{ id: string; toc: StudentToc } | null>(null);
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null);
  const measure = useInkMeasure();

  useEffect(() => {
    let cancelled = false;
    fetchStudentToc(key).then(
      (toc) => { if (!cancelled) { setLoaded({ id, toc }); onClassName?.(toc.className); } },
      (err: unknown) => { if (!cancelled) setFailed({ id, message: ERRORS[err instanceof StudentBinderError ? err.kind : 'server'] }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, id]);
  const toc = loaded?.id === id ? loaded.toc : null;
  const error = failed?.id === id ? failed.message : null;

  const source = useMemo(() => ({ loadDoc: studentDocLoader(key) }), [key]);

  const pages = useMemo(() => {
    if (!toc || !measure) return [];
    const { pages: sheets, texts } = pagesFromReleased(toc.entries, (board) => toc.boards.get(board));
    // Rien d'ouvert : pas de classeur vide à feuilleter
    if (sheets.every((p) => p.kind === 'divider')) return [];
    const width = INK_WIDTH_MM * MM * 0.97;
    return withSummaries(sheets, texts, (paragraphs) => wrapInk(paragraphs, width, measure, SUMMARY_LEAD));
  }, [toc, measure]);

  const message = error ? null
    : !toc || !measure ? 'Ouverture du classeur…'
    : pages.length === 0 ? 'Ce classeur est encore vide. Les activités y arrivent au fil des cours.'
    : null;

  return (
    <BinderSourceContext.Provider value={source}>
      <BinderBook
        pages={pages}
        ready={!!toc && !!measure}
        error={error}
        message={message}
        student
        barStart={onClose && (
          <button type="button" className="bd-btn" onClick={onClose} title="Revenir à mon espace">
            <ArrowLeft size={18} aria-hidden /> <span className="bd-hide-sm">Retour</span>
          </button>
        )}
        barEnd={toc?.className ? <span className="bd-level">{toc.className}</span> : undefined}
      />
    </BinderSourceContext.Provider>
  );
}
