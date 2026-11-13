/**
 * Barre Rechercher / Remplacer du cours (lot T7) : Ctrl+F, Ctrl+H. Entrée = suivant,
 * Maj+Entrée = précédent, Échap = fermer (le curseur revient sur le résultat courant).
 */
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { clearSearch, getSearch, replaceAll, replaceCurrent, setSearch, stepSearch, type SearchMatch, type SearchOptions } from './courseSearch';
import { Icon } from './courseIcons';

interface Props {
  editor: Editor;
  /** Ouverte par Ctrl+H : la ligne « Remplacer par » est dépliée. */
  replaceOpen: boolean;
  onReplaceOpen: (open: boolean) => void;
  /** Texte de départ (la sélection au moment du Ctrl+F). */
  initialQuery: string;
  /** Change à chaque Ctrl+F : la barre reprend le focus et sélectionne sa recherche. */
  focusKey: number;
  /** Faire défiler le bureau jusqu'à un résultat. */
  onReveal: (pos: number) => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function CourseFindBar({ editor, replaceOpen, onReplaceOpen, initialQuery, focusKey, onReveal, onClose, onToast }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState('');
  const [options, setOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const { count, current } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const s = getSearch(e.state);
      return { count: s.matches.length, current: s.current };
    },
  }) ?? { count: 0, current: -1 };

  // Nouvelle recherche à chaque frappe (et à chaque option)
  useEffect(() => {
    setSearch(editor.view, query, options);
    const s = getSearch(editor.state);
    const m = s.matches[s.current];
    if (m) onReveal(m.from);
    // onReveal est stable côté éditeur ; ne pas relancer la recherche quand il change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, query, options]);

  // Fermeture : plus de surlignage
  useEffect(() => () => { if (!editor.isDestroyed) clearSearch(editor.view); }, [editor]);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusKey, initialQuery]);

  const reveal = (m: SearchMatch | null) => { if (m) onReveal(m.from); };

  const close = () => {
    const s = getSearch(editor.state);
    const m = s.matches[s.current];
    onClose();
    if (m) editor.chain().focus().setTextSelection(m).run();
    else editor.commands.focus();
  };

  const doReplaceAll = () => {
    const n = replaceAll(editor.view, replacement);
    onToast(n === 0 ? 'Aucune occurrence à remplacer.' : `${n} remplacement${n > 1 ? 's' : ''}. Ctrl+Z pour tout défaire.`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' && e.target === inputRef.current) { e.preventDefault(); reveal(stepSearch(editor.view, e.shiftKey ? -1 : 1)); }
  };

  const status = !query ? '' : count === 0 ? 'Aucun résultat' : `${current + 1} sur ${count}`;

  return (
    <div className="ce-find-bar" role="search" aria-label="Rechercher dans le cours" onKeyDown={onKeyDown}>
      <div className="ce-find-bar__row">
        <button
          type="button"
          className={`ce-find-bar__toggle ${replaceOpen ? 'is-open' : ''}`}
          title={replaceOpen ? 'Masquer « Remplacer »' : 'Remplacer (Ctrl+H)'}
          aria-label="Afficher le remplacement"
          aria-expanded={replaceOpen}
          onClick={() => onReplaceOpen(!replaceOpen)}
        >
          ▸
        </button>
        <div className="ce-find-bar__field">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
            aria-label="Rechercher"
            spellCheck={false}
          />
          <span className={`ce-find-bar__count ${query && count === 0 ? 'is-none' : ''}`} aria-live="polite">{status}</span>
        </div>
        <button type="button" className="ce-find-bar__btn" title="Précédent (Maj+Entrée)" aria-label="Résultat précédent" disabled={count === 0} onClick={() => reveal(stepSearch(editor.view, -1))}>↑</button>
        <button type="button" className="ce-find-bar__btn" title="Suivant (Entrée)" aria-label="Résultat suivant" disabled={count === 0} onClick={() => reveal(stepSearch(editor.view, 1))}>↓</button>
        <button type="button" className="ce-find-bar__btn" title="Fermer (Échap)" aria-label="Fermer la recherche" onClick={close}>✕</button>
      </div>
      <div className="ce-find-bar__opts">
        <label><input type="checkbox" checked={options.caseSensitive} onChange={(e) => setOptions((o) => ({ ...o, caseSensitive: e.target.checked }))} /> Majuscules et accents exacts</label>
        <label><input type="checkbox" checked={options.wholeWord} onChange={(e) => setOptions((o) => ({ ...o, wholeWord: e.target.checked }))} /> Mot entier</label>
      </div>
      {replaceOpen && (
        <div className="ce-find-bar__row">
          <span className="ce-find-bar__spacer" />
          <div className="ce-find-bar__field">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); reveal(replaceCurrent(editor.view, replacement)); } }}
              placeholder="Remplacer par"
              aria-label="Remplacer par"
              spellCheck={false}
            />
          </div>
          <button type="button" className="ce-btn ce-btn--sm" disabled={count === 0} onClick={() => reveal(replaceCurrent(editor.view, replacement))}>Remplacer</button>
          <button type="button" className="ce-btn ce-btn--sm" disabled={count === 0} onClick={doReplaceAll}>Tout</button>
        </div>
      )}
    </div>
  );
}
