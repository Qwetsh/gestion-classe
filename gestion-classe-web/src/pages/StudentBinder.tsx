/**
 * Classeur des élèves (PLAN_classeur_eleves.md, lot 2) : page publique `/classeur/c/<jeton>`, celle
 * du lien posé dans Pronote. Sans compte ni code : le jeton désigne une classe, et le serveur ne
 * rend que ce que le professeur lui a ouvert (Edge Function `classeur-eleve`). Aucune donnée
 * personnelle, aucun lien vers l'espace du professeur.
 *
 * Le classeur est le même composant que celui du professeur (BinderBook) ; seule sa source change.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { pagesFromReleased } from '../lib/binderRelease';
import { INK_WIDTH_MM, SUMMARY_LEAD, withSummaries, wrapInk } from '../lib/binderSummary';
import { MM } from '../lib/course/coursePage';
import { StudentBinderError, fetchStudentToc, studentDocLoader, type BinderKey, type StudentToc } from '../lib/studentBinder';
import { BinderBook } from '../components/binder/BinderBook';
import { BinderSourceContext } from '../components/binder/binderSource';
import { useInkMeasure } from '../components/binder/useInkMeasure';

const ERRORS: Record<StudentBinderError['kind'], string> = {
  forbidden: 'Ce lien ne fonctionne plus. Demande le nouveau lien à ton professeur.',
  not_found: 'Ce classeur est introuvable.',
  network: 'Pas de connexion. Vérifie ta connexion à Internet, puis recharge la page.',
  server: 'Le classeur ne répond pas pour le moment. Réessaie dans quelques minutes.',
};

export function StudentBinder() {
  const { token = '' } = useParams();
  const key = useMemo<BinderKey>(() => ({ token }), [token]);
  /** Sommaire lu pour un lien ; il ne vaut que pour lui. */
  const [loaded, setLoaded] = useState<{ token: string; toc: StudentToc } | null>(null);
  const [failed, setFailed] = useState<{ token: string; message: string } | null>(null);
  const measure = useInkMeasure();

  useEffect(() => {
    let cancelled = false;
    fetchStudentToc(key).then(
      (toc) => { if (!cancelled) setLoaded({ token: key.token, toc }); },
      (err: unknown) => { if (!cancelled) setFailed({ token: key.token, message: ERRORS[err instanceof StudentBinderError ? err.kind : 'server'] }); },
    );
    return () => { cancelled = true; };
  }, [key]);
  const toc = loaded?.token === token ? loaded.toc : null;
  const error = failed?.token === token ? failed.message : null;

  // L'adresse porte le jeton : ni indexation, ni adresse transmise aux sites ouverts depuis une fiche
  useEffect(() => {
    const metas = [['robots', 'noindex, nofollow'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });
    return () => { for (const meta of metas) meta.remove(); };
  }, []);
  useEffect(() => {
    const before = document.title;
    document.title = toc?.className ? `Classeur de SVT — ${toc.className}` : 'Classeur de SVT';
    return () => { document.title = before; };
  }, [toc]);

  const source = useMemo(() => ({ loadDoc: studentDocLoader(key) }), [key]);

  const pages = useMemo(() => {
    if (!toc || !measure) return [];
    const { pages: sheets, texts } = pagesFromReleased(toc.entries, (id) => toc.boards.get(id));
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
        barEnd={toc?.className ? <span className="bd-level">{toc.className}</span> : undefined}
      />
    </BinderSourceContext.Provider>
  );
}
