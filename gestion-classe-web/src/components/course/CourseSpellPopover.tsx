/**
 * Bulle du correcteur (lot T11) : la faute, l'explication, les propositions (un clic remplace),
 * « Ignorer » (pour cette séance) et « Ajouter au dictionnaire » (mots, gardé sur l'ordinateur).
 */
import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { addToDictionary, applySuggestion, ignoreIssue, type SpellHit } from './courseSpell';

interface Props {
  editor: Editor;
  hit: SpellHit;
  rect: DOMRect;
  onClose: () => void;
}

export function CourseSpellPopover({ editor, hit, rect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { issue } = hit;

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    // Le texte a changé sous la bulle (frappe, Ctrl+Z) : elle n'a plus de sens
    const onUpdate = () => onClose();
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    editor.on('update', onUpdate);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      editor.off('update', onUpdate);
    };
  }, [editor, onClose]);

  const apply = (value: string) => {
    // Le mot a bougé depuis l'analyse : applySuggestion ne remplace rien
    applySuggestion(editor, hit, value);
    onClose();
  };

  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 328));
  const below = rect.bottom + 6 + 220 < window.innerHeight;
  const style: React.CSSProperties = below ? { left, top: rect.bottom + 6 } : { left, bottom: window.innerHeight - rect.top + 6 };

  return (
    <div ref={ref} className="ce-spellpop" style={style} role="dialog" aria-label={issue.short}>
      <div className={`ce-spellpop__kind ce-spellpop__kind--${issue.kind}`}>{issue.short}</div>
      <p className="ce-spellpop__msg">{issue.message}</p>
      {issue.suggestions.length > 0 ? (
        <div className="ce-spellpop__sugg">
          {issue.suggestions.map((s) => (
            <button key={s} type="button" className="ce-spellpop__btn ce-spellpop__btn--sugg" onClick={() => apply(s)}>{s || '(supprimer)'}</button>
          ))}
        </div>
      ) : (
        <p className="ce-spellpop__none">Pas de proposition.</p>
      )}
      <div className="ce-spellpop__foot">
        <button type="button" className="ce-spellpop__btn" onClick={() => { ignoreIssue(editor, issue); onClose(); }}>Ignorer</button>
        {issue.kind === 'spelling' && (
          <button type="button" className="ce-spellpop__btn" onClick={() => { addToDictionary(editor, issue); onClose(); }} title="Ce mot ne sera plus souligné, ni dans les cours ni au tableau blanc (sur cet ordinateur)">Ajouter au dictionnaire</button>
        )}
      </div>
    </div>
  );
}
