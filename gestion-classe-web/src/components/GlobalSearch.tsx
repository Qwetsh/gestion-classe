/**
 * Recherche globale (Ctrl+K) : une fenêtre pour aller n'importe où — une page, un cours, une
 * classe, un élève, une évaluation, un outil, une section des Réglages. Lot R1 de PLAN_mes_cours.md.
 *
 * Sans rien de tapé, elle liste les pages du menu. Flèches pour choisir, Entrée pour ouvrir,
 * Échap pour fermer.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { NavGroup } from '../lib/appNav';
import { flattenGroups, pageItems, searchItems, settingItems, type SearchItem } from '../lib/globalSearch';
import { fetchSearchItems } from '../lib/globalSearchQueries';
import type { SettingsSectionKey } from '../lib/settingsSections';
import '../styles/global-search.css';

interface Props {
  userId: string | null;
  /** Entrées du menu visibles pour ce professeur (onglets masqués exclus). */
  groups: NavGroup[];
  onOpenSettings: (section: SettingsSectionKey) => void;
  onClose: () => void;
}

export function GlobalSearch({ userId, groups, onOpenSettings, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  /** Cours, classes, élèves, évaluations, outils : lus en base à l'ouverture. */
  const [remote, setRemote] = useState<SearchItem[] | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchSearchItems(userId).then((items) => { if (!cancelled) setRemote(items); });
    return () => { cancelled = true; };
  }, [userId]);

  const items = useMemo(() => [...pageItems(groups), ...(remote ?? []), ...settingItems()], [groups, remote]);
  const results = useMemo(() => searchItems(items, query), [items, query]);
  const flat = useMemo(() => flattenGroups(results), [results]);
  const current = Math.min(active, Math.max(0, flat.length - 1));

  const activate = (item: SearchItem) => {
    onClose();
    if (item.section) onOpenSettings(item.section);
    else if (item.href) void navigate(item.href);
  };

  const move = (delta: number) => {
    const count = flat.length;
    if (count === 0) return;
    // À partir de la valeur à jour : deux appuis rapprochés avancent bien de deux
    setActive((prev) => (Math.min(prev, count - 1) + delta + count) % count);
  };

  // Le résultat choisi au clavier reste visible dans la liste
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[current]) activate(flat[current]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const typed = query.trim() !== '';
  /** Rang du premier résultat de chaque famille dans la liste à plat. */
  const starts = results.map((_, g) => results.slice(0, g).reduce((n, group) => n + group.items.length, 0));

  return createPortal(
    <div className="gsearch" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gsearch__panel" role="dialog" aria-modal="true" aria-label="Recherche" onKeyDown={onKeyDown}>
        <label className="gsearch__field">
          <Search size={18} aria-hidden />
          <input
            className="gsearch__input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Aller à une page, un cours, un élève, une évaluation…"
            aria-label="Rechercher dans l’application"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="gsearch__kbd">Échap</kbd>
        </label>

        <div className="gsearch__results" ref={listRef} role="listbox" aria-label="Résultats">
          {results.map((group, g) => (
            <div key={group.kind} className="gsearch__group">
              <div className="gsearch__label">{group.label}</div>
              {group.items.map((item, k) => {
                const i = starts[g] + k;
                return (
                  <button
                    key={`${item.kind}:${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={i === current}
                    data-index={i}
                    className={`gsearch__item${i === current ? ' is-active' : ''}`}
                    onMouseMove={() => { if (i !== current) setActive(i); }}
                    onClick={() => activate(item)}
                  >
                    <span className="gsearch__title">{item.title}</span>
                    {item.hint && <span className="gsearch__hint">{item.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {typed && flat.length === 0 && (
            <p className="gsearch__empty">{remote === null && userId ? 'Recherche…' : `Rien ne correspond à « ${query.trim()} ».`}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
