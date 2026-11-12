/**
 * Menu « Blocs » (Insertion) : les gabarits de fiche et d'évaluation de `courseBlocks.ts`.
 */
import { useEffect, useRef } from 'react';
import { COURSE_BLOCKS, type CourseBlock } from './courseBlocks';
import { Icon } from './courseIcons';

interface Props {
  left: number;
  top: number;
  onPick: (block: CourseBlock) => void;
  onClose: () => void;
}

export function CourseBlocksMenu({ left, top, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const t = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0);
    document.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div ref={ref} className="ce-menu" style={{ left: Math.max(8, Math.min(left, window.innerWidth - 348)), top }} role="menu" aria-label="Blocs" onMouseDown={(e) => e.preventDefault()}>
      {COURSE_BLOCKS.map((b) => (
        <button key={b.id} type="button" role="menuitem" className="ce-menu__item" onClick={() => { onPick(b); onClose(); }}>
          <Icon name={b.icon} size={24} />
          <span>
            <strong>{b.label}</strong>
            <small>{b.hint}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
