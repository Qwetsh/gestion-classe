/**
 * Petit clavier AZERTY intégré aux panneaux latéraux du tableau (recherche internet, vidéo) :
 * dix colonnes à la largeur du panneau, pour taper une recherche au doigt sur le TBI. Il écrit
 * dans une valeur contrôlée, pas dans l'élément qui a le focus : rien ne se perd si le champ
 * n'est pas sélectionné.
 */

interface Props {
  onKey: (text: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  enterLabel?: string;
}

const ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm'],
];

export function BoardPanelKeyboard({ onKey, onBackspace, onEnter, enterLabel = 'Chercher' }: Props) {
  // Les touches ne prennent pas le focus et n'atteignent pas le tableau
  const hold = (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); };
  const key = (k: string, cls = '') => (
    <button key={k} type="button" className={`pk__k ${cls}`} onPointerDown={hold} onClick={() => onKey(k)}>{k === ' ' ? 'espace' : k}</button>
  );

  return (
    <div className="pk" onPointerDown={hold} onContextMenu={(e) => e.preventDefault()}>
      {ROWS.map((row) => row.map((k) => key(k)))}
      {['w', 'x', 'c', 'v', 'b', 'n', '\'', '-'].map((k) => key(k))}
      <button type="button" className="pk__k pk__k--2 pk__k--dark" onPointerDown={hold} onClick={onBackspace} aria-label="Effacer">⌫</button>
      {['é', 'è', 'à', 'ç', 'ê', 'ù'].map((k) => key(k))}
      {key(' ', 'pk__k--2')}
      <button type="button" className="pk__k pk__k--2 pk__k--go" onPointerDown={hold} onClick={onEnter}>{enterLabel}</button>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.pk { display: grid; grid-template-columns: repeat(10, 1fr); gap: 5px; padding: 8px 10px 10px; background: #111827; user-select: none; touch-action: manipulation; }
.pk__k { height: 46px; min-width: 0; padding: 0; border: 0; border-radius: 9px; background: #1F2937; color: #F9FAFB; font: 600 19px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.pk__k:active { background: #4F46E5; }
.pk__k--2 { grid-column: span 2; font-size: 14px; }
.pk__k--dark { background: #374151; font-size: 19px; }
.pk__k--go { background: #4F46E5; }
.pk__k--go:active { background: #4338CA; }
`;
