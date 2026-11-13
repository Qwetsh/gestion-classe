/**
 * Fenêtre « Icône » (Insertion › Icône, lot T16a) : recherche en français (« volcan »,
 * « attention », « cellule »…), un clic insère l'icône au curseur ; la fenêtre reste ouverte pour
 * en poser plusieurs.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CourseIconEntry } from './courseIconSet';
import { foldText } from './courseSearch';

interface Props {
  left: number;
  top: number;
  onInsert: (name: string) => void;
  onClose: () => void;
}

export function CourseIconPicker({ left, top, onInsert, onClose }: Props) {
  const [icons, setIcons] = useState<CourseIconEntry[] | null>(null);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./courseIconSet').then((m) => { if (!cancelled) setIcons(m.COURSE_ICONS); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    inputRef.current?.focus();
    return () => { window.clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const shown = useMemo(() => {
    if (!icons) return [];
    const words = foldText(q.trim()).split(/\s+/).filter(Boolean);
    if (words.length === 0) return icons;
    return icons.filter((i) => { const hay = foldText(`${i.keywords} ${i.name}`); return words.every((w) => hay.includes(w)); });
  }, [icons, q]);

  return (
    <div
      ref={ref}
      className="ce-iconpick"
      style={{ left: Math.max(8, Math.min(left, window.innerWidth - 388)), top }}
      role="dialog"
      aria-label="Icônes"
      // le curseur reste dans le texte pendant qu'on choisit (sauf dans le champ de recherche)
      onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}
    >
      <input ref={inputRef} className="ce-input ce-iconpick__search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher : cellule, volcan, attention…" aria-label="Chercher une icône" />
      <div className="ce-iconpick__grid">
        {!icons && <span className="ce-iconpick__none">Chargement…</span>}
        {icons && shown.length === 0 && <span className="ce-iconpick__none">Aucune icône pour « {q} ».</span>}
        {shown.map(({ name, Icon, keywords }) => (
          <button key={name} type="button" className="ce-iconpick__btn" title={keywords.split(' ')[0]} aria-label={keywords.split(' ')[0]} onClick={() => onInsert(name)}>
            <Icon size={20} strokeWidth={1.9} aria-hidden />
          </button>
        ))}
      </div>
      <div className="ce-iconpick__foot">L’icône prend la taille et la couleur du texte. Icônes Lucide (licence ISC).</div>
    </div>
  );
}
