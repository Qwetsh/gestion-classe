/**
 * Bulle d'interaction : posée à côté de l'objet cible qu'un bouton vient de viser (mode liaison),
 * d'une flèche d'interaction existante, ou du bouton lui-même pour une action sans cible.
 *
 * Deux niveaux : la famille (Visibilité, Cache, Post-it, Page, Son, Outil) puis l'action, en ne
 * proposant que ce que la cible permet. En dessous, la séquence complète du bouton, réordonnable.
 * Tester joue la séquence avec le brouillon, sans rien écrire.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import {
  INTERACTION_FAMILIES, INTERACTION_LABELS, describeInteraction, interactionFamily,
  type BoardObject, type Interaction, type InteractionAction, type InteractionFamily,
} from '../../lib/boardObjects';

export interface InteractionDraft {
  action: InteractionAction;
  /** La cible démarre cachée (actions de visibilité seulement). */
  hidden: boolean;
  /** Page visée (action « aller à la page »). */
  pageId?: string;
  /** Ne se joue qu'une fois par séance. */
  once: boolean;
}

interface Props {
  /** Rectangle écran de la cible (ou du bouton) : la bulle se range à côté. */
  anchor: { left: number; top: number; right: number; bottom: number };
  /** Nom de la cible ; `null` pour une action sans cible. */
  targetLabel: string | null;
  /** Actions permises pour cette cible (voir `actionsFor`). */
  actions: readonly InteractionAction[];
  draft: InteractionDraft;
  /** Interaction déjà enregistrée (édition) : Supprimer est proposé. */
  existing: boolean;
  /** Séquence complète du bouton, l'étape en cours d'édition étant `editingIndex`. */
  sequence: readonly Interaction[];
  editingIndex: number | null;
  objects: readonly BoardObject[];
  pageIds: readonly string[];
  onChange: (draft: InteractionDraft) => void;
  onConfirm: () => void;
  onRemove: () => void;
  onTest: () => void;
  onCancel: () => void;
  /** Séquence : ouvrir une étape, la déplacer, la retirer. */
  onSelectStep: (index: number) => void;
  onMoveStep: (index: number, delta: -1 | 1) => void;
  onRemoveStep: (index: number) => void;
}

const ICONS: Record<InteractionAction, string> = {
  show: '👁', hide: '🙈', toggle: '⇄',
  reveal: '🎭', cover: '🙈',
  unfold: '📂', fold: '📁',
  goto: '🔢', next: '→', prev: '←', reset: '↺',
  play: '▶', pause: '⏸', playToggle: '⏯',
  start: '▶', stop: '⏹', startToggle: '⏯', roll: '🎲',
};
/** Libellés courts pour tenir sur une pastille (le libellé long reste dans les menus). */
const SHORT: Record<InteractionAction, string> = {
  show: 'Afficher', hide: 'Masquer', toggle: 'Basculer',
  reveal: 'Découvrir', cover: 'Recouvrir',
  unfold: 'Déplier', fold: 'Replier',
  goto: 'Page…', next: 'Suivante', prev: 'Précédente', reset: 'Réinitialiser',
  play: 'Lire', pause: 'Pause', playToggle: 'Lire / pause',
  start: 'Lancer', stop: 'Arrêter', startToggle: 'Lancer / arrêter', roll: 'Tirer',
};
const VISIBILITY: readonly InteractionAction[] = ['show', 'hide', 'toggle'];
const FAMILY_ORDER: readonly InteractionFamily[] = ['visibility', 'cover', 'note', 'page', 'media', 'tool'];
const stop = (e: React.PointerEvent) => e.stopPropagation();

export function BoardInteractionBubble({
  anchor, targetLabel, actions, draft, existing, sequence, editingIndex, objects, pageIds,
  onChange, onConfirm, onRemove, onTest, onCancel, onSelectStep, onMoveStep, onRemoveStep,
}: Props) {
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

  // Familles qui ont au moins une action permise, dans l'ordre d'affichage
  const families = FAMILY_ORDER.filter((f) => INTERACTION_FAMILIES[f].actions.some((a) => actions.includes(a)));
  const family = interactionFamily(draft.action);
  const familyActions = INTERACTION_FAMILIES[family].actions.filter((a) => actions.includes(a));
  const pickFamily = (f: InteractionFamily) => {
    const first = INTERACTION_FAMILIES[f].actions.find((a) => actions.includes(a));
    if (first && first !== draft.action) onChange({ ...draft, action: first });
  };
  const hasPageEffect = sequence.some((it, i) => i !== editingIndex && (it.action === 'goto' || it.action === 'next' || it.action === 'prev'))
    || draft.action === 'goto' || draft.action === 'next' || draft.action === 'prev';

  return (
    <div
      ref={ref}
      className="wbib"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      onPointerDown={stop}
      onContextMenu={(e) => e.stopPropagation()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onCancel(); if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') onConfirm(); }}
    >
      <style>{CSS}</style>
      <div className="wbib__title">
        ⚡ Quand on touche le bouton, {targetLabel ? <b>{targetLabel}</b> : <b>ce bouton</b>} :
      </div>

      {families.length > 1 && (
        <div className="wbib__families" role="tablist">
          {families.map((f) => (
            <button key={f} type="button" role="tab" aria-selected={family === f} className={`wbib__fam ${family === f ? 'is-on' : ''}`} title={INTERACTION_FAMILIES[f].label} onClick={() => pickFamily(f)}>
              <span aria-hidden>{INTERACTION_FAMILIES[f].icon}</span>
              <span className="wbib__fam-label">{INTERACTION_FAMILIES[f].label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="wbib__actions" role="radiogroup">
        {familyActions.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={draft.action === a} title={INTERACTION_LABELS[a]} className={`wbib__pill ${draft.action === a ? 'is-on' : ''}`} onClick={() => onChange({ ...draft, action: a })}>
            <span aria-hidden>{ICONS[a]}</span>{SHORT[a]}
          </button>
        ))}
      </div>

      {draft.action === 'goto' && (
        <div className="wbib__pages" role="radiogroup" aria-label="Page cible">
          {pageIds.map((id, i) => (
            <button key={id} type="button" role="radio" aria-checked={draft.pageId === id} className={`wbib__page ${draft.pageId === id ? 'is-on' : ''}`} onClick={() => onChange({ ...draft, pageId: id })}>{i + 1}</button>
          ))}
        </div>
      )}

      {VISIBILITY.includes(draft.action) && targetLabel && (
        <label className="wbib__check">
          <input type="checkbox" checked={draft.hidden} onChange={(e) => onChange({ ...draft, hidden: e.target.checked })} />
          caché au début de la séance
        </label>
      )}
      <label className="wbib__check">
        <input type="checkbox" checked={draft.once} onChange={(e) => onChange({ ...draft, once: e.target.checked })} />
        une seule fois par séance
      </label>

      {sequence.length > 0 && (
        <div className="wbib__seq">
          <div className="wbib__seq-title">Actions du bouton ({sequence.length}{editingIndex === null ? ' + 1' : ''})</div>
          <ol className="wbib__steps">
            {sequence.map((it, i) => (
              <li key={i} className={`wbib__step ${i === editingIndex ? 'is-on' : ''}`}>
                <button type="button" className="wbib__step-label" title="Modifier cette étape" onClick={() => onSelectStep(i)}>
                  <span className="wbib__step-n">{i + 1}</span>
                  <span className="wbib__step-txt">{describeInteraction(it, objects, pageIds)}{it.once ? ' · 1×' : ''}</span>
                </button>
                <button type="button" className="wbib__step-btn" title="Monter" disabled={i === 0} onClick={() => onMoveStep(i, -1)}>↑</button>
                <button type="button" className="wbib__step-btn" title="Descendre" disabled={i === sequence.length - 1} onClick={() => onMoveStep(i, 1)}>↓</button>
                <button type="button" className="wbib__step-btn wbib__step-btn--danger" title="Retirer" onClick={() => onRemoveStep(i)}>✕</button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="wbib__foot">
        {existing && <button type="button" className="wbib__btn wbib__btn--danger" onClick={onRemove} title="Retirer cette interaction">Supprimer</button>}
        <button type="button" className="wbib__btn" onClick={onTest} title={hasPageEffect ? 'Jouer la séquence sans écrire (les changements de page ne sont pas joués)' : 'Jouer la séquence sans écrire'}>▶ Tester</button>
        <span className="wbib__spacer" />
        <button type="button" className="wbib__btn" onClick={onCancel}>Annuler</button>
        <button type="button" className="wbib__btn wbib__btn--primary" onClick={onConfirm} autoFocus>Valider</button>
      </div>
    </div>
  );
}

const CSS = `
.wbib { position: fixed; z-index: 16; width: 360px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); overflow: auto; padding: var(--wb-panel-pad, 10px) calc(var(--wb-panel-pad, 10px) + 4px); border-radius: 14px; background: #111827; color: #F9FAFB; font: 500 14px/1.35 Inter, system-ui, sans-serif; box-shadow: 0 16px 48px rgba(0,0,0,0.45); user-select: none; }
.wbib__title { margin-bottom: 8px; color: #D1D5DB; }
.wbib__title b { color: #FFFFFF; }
.wbib__families { display: flex; gap: 4px; margin-bottom: 8px; }
.wbib__fam { display: flex; flex: 1; flex-direction: column; align-items: center; gap: 2px; min-height: var(--wb-menu-h, 40px); padding: 4px 2px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: #9CA3AF; font: 600 10.5px/1.1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbib__fam span[aria-hidden] { font-size: 16px; line-height: 1; }
.wbib__fam.is-on { background: #1F2937; border-color: #374151; color: #FFFFFF; }
.wbib__fam-label { white-space: nowrap; }
.wbib__actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.wbib__pill { display: flex; flex: 1 1 30%; align-items: center; justify-content: center; gap: 6px; min-height: var(--wb-menu-h, 40px); padding: 4px 8px; border: 1px solid #374151; border-radius: 999px; background: #1F2937; color: #E5E7EB; font: 600 13px/1.1 Inter, system-ui, sans-serif; cursor: pointer; white-space: nowrap; }
.wbib__pill.is-on { background: #4F46E5; border-color: #6366F1; color: #FFFFFF; }
.wbib__pages { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.wbib__page { min-width: 36px; min-height: 36px; border: 1px solid #374151; border-radius: 8px; background: #1F2937; color: #E5E7EB; font: 700 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbib__page.is-on { background: #4F46E5; border-color: #6366F1; color: #FFFFFF; }
.wbib__check { display: flex; align-items: center; gap: 8px; min-height: 30px; color: #D1D5DB; cursor: pointer; }
.wbib__check input { width: 18px; height: 18px; accent-color: #6366F1; }
.wbib__seq { margin-top: 8px; padding-top: 8px; border-top: 1px solid #374151; }
.wbib__seq-title { margin-bottom: 4px; color: #9CA3AF; font: 600 11px/1.2 Inter, system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.04em; }
.wbib__steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.wbib__step { display: flex; align-items: center; gap: 2px; border-radius: 8px; }
.wbib__step.is-on { background: #1F2937; }
.wbib__step-label { display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; min-height: 34px; padding: 0 6px; border: 0; border-radius: 8px; background: transparent; color: #E5E7EB; font: 500 13px/1.2 Inter, system-ui, sans-serif; text-align: left; cursor: pointer; }
.wbib__step-label:hover { background: #1F2937; }
.wbib__step-n { flex: none; width: 18px; height: 18px; border-radius: 50%; background: #374151; color: #F9FAFB; font: 700 10px/18px Inter, system-ui, sans-serif; text-align: center; }
.wbib__step.is-on .wbib__step-n { background: #4F46E5; }
.wbib__step-txt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbib__step-btn { flex: none; width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #9CA3AF; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbib__step-btn:hover:not(:disabled) { background: #374151; color: #FFFFFF; }
.wbib__step-btn:disabled { opacity: 0.3; cursor: default; }
.wbib__step-btn--danger:hover:not(:disabled) { background: #7F1D1D; }
.wbib__foot { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.wbib__spacer { flex: 1; }
.wbib__btn { min-height: calc(var(--wb-menu-h, 40px) - 4px); padding: 0 12px; border: 1px solid #374151; border-radius: 10px; background: transparent; color: #E5E7EB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbib__btn:hover { background: #1F2937; }
.wbib__btn--primary { background: #4F46E5; border-color: #4F46E5; color: #FFFFFF; }
.wbib__btn--primary:hover { background: #4338CA; }
.wbib__btn--danger { color: #FCA5A5; border-color: #7F1D1D; }
.wbib__btn--danger:hover { background: #7F1D1D; color: #FFFFFF; }
`;
