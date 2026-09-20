/**
 * Bulle d'interaction : posée à côté de l'objet cible qu'un bouton vient de viser (mode liaison)
 * ou d'une flèche d'interaction existante. Trois pastilles (Afficher, Masquer, Afficher / masquer),
 * l'état de départ de la cible, puis Valider / Annuler ; sur une interaction existante, Supprimer.
 * Remplace l'ancien panneau latéral : tout se règle là où l'on regarde.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { INTERACTION_LABELS, type InteractionAction } from '../../lib/boardObjects';

export interface InteractionDraft { action: InteractionAction; hidden: boolean }

interface Props {
  /** Rectangle écran de la cible (ou de la flèche) : la bulle se range à côté. */
  anchor: { left: number; top: number; right: number; bottom: number };
  targetLabel: string;
  draft: InteractionDraft;
  /** Interaction déjà enregistrée : Supprimer est proposé. */
  existing: boolean;
  onChange: (draft: InteractionDraft) => void;
  onConfirm: () => void;
  onRemove: () => void;
  onTest: () => void;
  onCancel: () => void;
}

const ACTIONS: InteractionAction[] = ['show', 'hide', 'toggle'];
const ICONS: Record<InteractionAction, string> = { show: '👁', hide: '🙈', toggle: '⇄' };
/** Libellés courts pour tenir sur une ligne de pastille (le libellé long reste dans les menus). */
const SHORT: Record<InteractionAction, string> = { show: 'Afficher', hide: 'Masquer', toggle: 'Basculer' };
const stop = (e: React.PointerEvent) => e.stopPropagation();

export function BoardInteractionBubble({ anchor, targetLabel, draft, existing, onChange, onConfirm, onRemove, onTest, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // À droite de la cible, sinon à gauche, sinon dessous ; toujours dans l'écran
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 12;
    let left = anchor.right + gap;
    let top = anchor.top;
    if (left + r.width > window.innerWidth - 8) left = anchor.left - r.width - gap;
    if (left < 8) { left = Math.max(8, Math.min(anchor.left, window.innerWidth - r.width - 8)); top = anchor.bottom + gap; }
    top = Math.max(8, Math.min(top, window.innerHeight - r.height - 8));
    setPos({ left, top });
  }, [anchor]);

  return (
    <div
      ref={ref}
      className="wbib"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      onPointerDown={stop}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onCancel(); if (e.key === 'Enter') onConfirm(); }}
    >
      <style>{CSS}</style>
      <div className="wbib__title">⚡ Quand on touche le bouton, <b>{targetLabel}</b> :</div>
      <div className="wbib__actions" role="radiogroup">
        {ACTIONS.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={draft.action === a} title={INTERACTION_LABELS[a]} className={`wbib__pill ${draft.action === a ? 'is-on' : ''}`} onClick={() => onChange({ ...draft, action: a })}>
            <span aria-hidden>{ICONS[a]}</span>{SHORT[a]}
          </button>
        ))}
      </div>
      <label className="wbib__check">
        <input type="checkbox" checked={draft.hidden} onChange={(e) => onChange({ ...draft, hidden: e.target.checked })} />
        caché au début de la séance
      </label>
      <div className="wbib__foot">
        {existing && <button type="button" className="wbib__btn wbib__btn--danger" onClick={onRemove} title="Retirer cette interaction">Supprimer</button>}
        <button type="button" className="wbib__btn" onClick={onTest} title="Déclencher le bouton maintenant">▶ Tester</button>
        <span className="wbib__spacer" />
        <button type="button" className="wbib__btn" onClick={onCancel}>Annuler</button>
        <button type="button" className="wbib__btn wbib__btn--primary" onClick={onConfirm} autoFocus>Valider</button>
      </div>
    </div>
  );
}

const CSS = `
.wbib { position: fixed; z-index: 16; width: 320px; max-width: calc(100vw - 16px); padding: var(--wb-panel-pad, 10px) calc(var(--wb-panel-pad, 10px) + 4px); border-radius: 14px; background: #111827; color: #F9FAFB; font: 500 14px/1.35 Inter, system-ui, sans-serif; box-shadow: 0 16px 48px rgba(0,0,0,0.45); user-select: none; }
.wbib__title { margin-bottom: 8px; color: #D1D5DB; }
.wbib__title b { color: #FFFFFF; }
.wbib__actions { display: flex; gap: 6px; margin-bottom: 8px; }
.wbib__pill { display: flex; flex: 1; align-items: center; justify-content: center; gap: 6px; min-height: var(--wb-menu-h, 40px); padding: 4px 8px; border: 1px solid #374151; border-radius: 999px; background: #1F2937; color: #E5E7EB; font: 600 13px/1.1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbib__pill.is-on { background: #4F46E5; border-color: #6366F1; color: #FFFFFF; }
.wbib__check { display: flex; align-items: center; gap: 8px; min-height: 32px; color: #D1D5DB; cursor: pointer; }
.wbib__check input { width: 18px; height: 18px; accent-color: #6366F1; }
.wbib__foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.wbib__spacer { flex: 1; }
.wbib__btn { min-height: calc(var(--wb-menu-h, 40px) - 4px); padding: 0 12px; border: 1px solid #374151; border-radius: 10px; background: transparent; color: #E5E7EB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbib__btn:hover { background: #1F2937; }
.wbib__btn--primary { background: #4F46E5; border-color: #4F46E5; color: #FFFFFF; }
.wbib__btn--primary:hover { background: #4338CA; }
.wbib__btn--danger { color: #FCA5A5; border-color: #7F1D1D; }
.wbib__btn--danger:hover { background: #7F1D1D; color: #FFFFFF; }
`;
