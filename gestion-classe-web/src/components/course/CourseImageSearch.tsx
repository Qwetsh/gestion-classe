/**
 * Fenêtre « Banque d'images » (Insertion › Banque d'images, lot T16b) : recherche de photos et de
 * schémas libres dans Wikimedia Commons. L'image choisie est copiée dans le cours avec son crédit
 * (auteur, licence, source), écrit d'office sous l'image.
 */
import { useEffect, useRef, useState } from 'react';
import { downloadCommonsImage, searchCommons, type BankImage, type ImageCredit } from './courseImageBank';

interface Props {
  /** Reçoit le fichier téléchargé et son crédit ; la fenêtre se ferme ensuite. */
  onInsert: (file: File, credit: ImageCredit) => void;
  onClose: () => void;
}

export function CourseImageSearch({ onInsert, onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ query: string; items: BankImage[]; next: number | null } | null>(null);
  const [picked, setPicked] = useState<BankImage | null>(null);
  const [busy, setBusy] = useState<'search' | 'more' | 'insert' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async (query: string, offset: number) => {
    // Une requête à la fois (règles d'usage de l'API Wikimedia)
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBusy(offset ? 'more' : 'search');
    setError(null);
    try {
      const page = await searchCommons(query, offset, ctrl.signal);
      if (ctrl.signal.aborted) return;
      setResults((prev) => ({
        query,
        items: offset && prev ? [...prev.items, ...page.items.filter((i) => !prev.items.some((p) => p.file === i.file))] : page.items,
        next: page.next,
      }));
      if (!offset) setPicked(null);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Recherche impossible');
    } finally {
      if (abortRef.current === ctrl) setBusy(null);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query && busy !== 'insert') void run(query, 0);
  };

  const insert = async (img: BankImage) => {
    if (busy === 'insert') return;
    setBusy('insert');
    setError(null);
    try {
      const file = await downloadCommonsImage(img);
      onInsert(file, img.credit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image non téléchargée');
      setBusy(null);
    }
  };

  return (
    <div className="ce-modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ce-dialog ce-bank" role="dialog" aria-label="Banque d'images" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
        <h3 className="ce-dialog__title">Banque d'images</h3>
        <form className="ce-bank__search" onSubmit={submit}>
          <input
            ref={inputRef}
            className="ce-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="volcan, cellule animale, Louis XIV, carte de France…"
            aria-label="Chercher une image"
            spellCheck
            lang="fr"
          />
          <button type="submit" className="ce-btn ce-btn--primary" disabled={!q.trim() || busy === 'search' || busy === 'insert'}>
            {busy === 'search' ? 'Recherche…' : 'Chercher'}
          </button>
        </form>

        <div className="ce-bank__results" aria-busy={busy === 'search'}>
          {!results && !error && (
            <p className="ce-bank__empty">
              Photos et schémas libres de <b>Wikimedia Commons</b>. Les mots en anglais donnent souvent plus de
              résultats (« volcano », « animal cell »).
            </p>
          )}
          {results && results.items.length === 0 && <p className="ce-bank__empty">Aucune image pour « {results.query} ».</p>}
          {results && results.items.length > 0 && (
            <div className="ce-bank__grid">
              {results.items.map((img) => (
                <button
                  key={img.file}
                  type="button"
                  className={`ce-bank__item ${picked?.file === img.file ? 'is-picked' : ''}`}
                  onClick={() => setPicked(img)}
                  onDoubleClick={() => void insert(img)}
                  title={`${img.title}\n${img.credit.text}`}
                  aria-pressed={picked?.file === img.file}
                >
                  <img src={img.thumb} alt={img.title} loading="lazy" referrerPolicy="no-referrer" />
                  <span className="ce-bank__lic">{img.license || 'Libre'}</span>
                </button>
              ))}
            </div>
          )}
          {results?.next != null && results.items.length > 0 && (
            <button type="button" className="ce-btn ce-bank__more" onClick={() => void run(results.query, results.next ?? 0)} disabled={busy !== null}>
              {busy === 'more' ? 'Chargement…' : 'Plus de résultats'}
            </button>
          )}
        </div>

        {error && <p className="ce-bank__error" role="alert">{error}</p>}

        <div className="ce-bank__picked">
          {picked ? (
            <>
              <span className="ce-bank__picked-title">{picked.title}</span>
              <span className="ce-bank__picked-credit">
                Crédit écrit sous l'image : {picked.credit.text}{' '}
                <a href={picked.credit.url} target="_blank" rel="noopener noreferrer">Voir la source</a>
              </span>
            </>
          ) : (
            <span className="ce-bank__picked-credit">Cliquez une image pour voir son crédit ; double-clic pour l'insérer.</span>
          )}
        </div>

        <div className="ce-dialog__foot">
          <span className="ce-spacer-flex" />
          <button type="button" className="ce-btn" onClick={onClose}>Annuler</button>
          <button type="button" className="ce-btn ce-btn--primary" disabled={!picked || busy === 'insert'} onClick={() => picked && void insert(picked)}>
            {busy === 'insert' ? 'Téléchargement…' : 'Insérer'}
          </button>
        </div>
      </div>
    </div>
  );
}
