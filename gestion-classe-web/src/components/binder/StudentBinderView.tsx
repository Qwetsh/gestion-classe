/**
 * Classeur des élèves (PLAN_classeur_eleves.md, lots 2 et 3) : le classeur d'une classe, tel que le
 * serveur le rend à un visiteur sans compte (Edge Function `classeur-eleve`). Deux entrées : le lien
 * posé dans Pronote (jeton, page `/classeur/c/<jeton>`) et l'onglet « Classeur » de l'espace élève
 * (code à 6 chiffres, page `/eleve`). Aucune donnée personnelle, aucun lien vers l'espace du
 * professeur.
 *
 * Le classeur est le même composant que celui du professeur (BinderBook) ; seule sa source change.
 * Rien n'est lu en base ni dans le stockage par ce navigateur : les fiches et les adresses de leurs
 * images viennent du serveur. Ces adresses ne vivent que quelques heures : un classeur resté ouvert
 * est relu quand on y revient.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { pagesFromReleased } from '../../lib/binderRelease';
import { INK_WIDTH_MM, SUMMARY_LEAD, withSummaries, wrapInk } from '../../lib/binderSummary';
import { setSeededUrlsOnly } from '../../lib/boardMedia';
import { MM } from '../../lib/course/coursePage';
import { StudentBinderError, binderKeyId, fetchStudentToc, studentDocLoader, type BinderKey, type StudentToc } from '../../lib/studentBinder';
import { BinderBook } from './BinderBook';
import { BinderSourceContext } from './binderSource';
import { useInkMeasure } from './useInkMeasure';

/** Message d'un refus ou d'une panne, selon l'entrée : le lien de Pronote, ou l'onglet de l'espace élève. */
function errorMessage(kind: StudentBinderError['kind'], byLink: boolean): string {
  if (kind === 'forbidden') return byLink ? 'Ce lien ne fonctionne plus. Demande le nouveau lien à ton professeur.' : 'Ce classeur n’est plus accessible par ici. Demande à ton professeur.';
  if (kind === 'not_found') return 'Ce classeur est introuvable.';
  // Dans l'espace élève, recharger la page ferait ressaisir le code
  if (kind === 'network') return byLink ? 'Pas de connexion. Vérifie ta connexion à Internet, puis recharge la page.' : 'Pas de connexion. Vérifie ta connexion à Internet, puis rouvre le classeur.';
  return 'Le classeur ne répond pas pour le moment. Réessaie dans quelques minutes.';
}

/** Âge au-delà duquel le classeur est relu au retour sur la page (les adresses d'images vivent 6 h). */
const STALE_MS = 4 * 60 * 60 * 1000;

interface Props {
  /** Ce qui ouvre le classeur : le jeton du lien, ou le code de l'élève. */
  binderKey: BinderKey;
  /** Retour à l'écran d'où le classeur a été ouvert (espace élève) : le classeur est alors posé par-dessus lui. */
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
  /** Relecture : change quand le classeur a trop vieilli (nouvelles activités, adresses d'images périmées). */
  const [round, setRound] = useState(0);
  const measure = useInkMeasure();

  // Ici, seules les adresses d'images fournies par le serveur servent : un professeur connecté qui
  // regarde le classeur de sa classe voit ce que voient ses élèves
  useEffect(() => {
    setSeededUrlsOnly(true);
    return () => setSeededUrlsOnly(false);
  }, []);

  // Posé par-dessus l'espace élève : la page du dessous ne défile pas pendant qu'on feuillette
  const embedded = !!onClose;
  useEffect(() => {
    if (!embedded) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [embedded]);

  useEffect(() => {
    let cancelled = false;
    const readAt = Date.now();
    fetchStudentToc(key).then(
      (toc) => { if (!cancelled) { setLoaded({ id, toc }); setFailed(null); onClassName?.(toc.className); } },
      (err: unknown) => { if (!cancelled) setFailed({ id, message: errorMessage(err instanceof StudentBinderError ? err.kind : 'server', 'token' in key) }); },
    );
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - readAt > STALE_MS) setRound((n) => n + 1); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, id, round]);
  const toc = loaded?.id === id ? loaded.toc : null;
  // Une relecture ratée ne retire pas le classeur déjà affiché
  const error = failed?.id === id && !toc ? failed.message : null;

  // Les fiches sont redemandées à chaque relecture : leurs images reçoivent de nouvelles adresses
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const source = useMemo(() => ({ loadDoc: studentDocLoader(key) }), [key, round]);

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
        embedded={embedded}
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
