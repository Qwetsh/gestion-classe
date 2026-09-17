/**
 * Panneau « Interactions » d'un objet-bouton (façon Genially) : la liste de ce que le bouton fait
 * quand on le touche en classe — afficher, masquer ou basculer d'autres objets de la page.
 *
 * Le choix d'une cible se fait sur la page elle-même : « Choisir un objet » puis un tap sur
 * l'objet visé (le calque passe en mode cible). Chaque ligne règle l'action et l'état de départ
 * de la cible (cachée ou visible). « Tester » déclenche le bouton comme en classe.
 */
import { INTERACTION_LABELS, objectShortLabel, type BoardObject, type InteractionAction } from '../../lib/boardObjects';

interface Props {
  /** L'objet qui sert de bouton. */
  trigger: BoardObject;
  /** Objets de la page (pour nommer les cibles et connaître leur état de départ). */
  objects: BoardObject[];
  /** Choix d'une cible en cours : on attend un tap sur la page. */
  picking: boolean;
  onPick: () => void;
  onCancelPick: () => void;
  onSetAction: (index: number, action: InteractionAction) => void;
  onRemove: (index: number) => void;
  /** Bascule « caché au départ » d'un objet (cible ou bouton lui-même). */
  onToggleHidden: (id: string) => void;
  onTest: () => void;
  onClose: () => void;
}

const ACTIONS: InteractionAction[] = ['show', 'hide', 'toggle'];
const stop = (e: React.PointerEvent) => e.stopPropagation();

export function BoardInteractionsPanel({ trigger, objects, picking, onPick, onCancelPick, onSetAction, onRemove, onToggleHidden, onTest, onClose }: Props) {
  const byId = new Map(objects.map((o) => [o.id, o]));
  const list = trigger.interactions ?? [];

  return (
    <div className="wbia" onPointerDown={stop} onContextMenu={(e) => e.stopPropagation()}>
      <style>{CSS}</style>
      <div className="wbia__head">
        <span className="wbia__title">⚡ Bouton · {objectShortLabel(trigger)}</span>
        <button type="button" className="wbia__close" title="Fermer" onClick={onClose}>✕</button>
      </div>
      <p className="wbia__hint">En classe (stylo ou mode affichage), toucher ce bouton déclenche :</p>

      {list.length === 0 && !picking && <p className="wbia__empty">Aucune interaction pour l'instant.</p>}
      <ul className="wbia__list">
        {list.map((it, i) => {
          const target = byId.get(it.targetId);
          return (
            <li key={`${it.targetId}-${i}`} className={`wbia__row ${target ? '' : 'is-missing'}`}>
              <select className="wbia__select" value={it.action} onChange={(e) => onSetAction(i, e.target.value as InteractionAction)} title="Action">
                {ACTIONS.map((a) => <option key={a} value={a}>{INTERACTION_LABELS[a]}</option>)}
              </select>
              <span className="wbia__target" title={target ? objectShortLabel(target) : 'Objet supprimé'}>{target ? objectShortLabel(target) : 'Objet supprimé'}</span>
              {target && (
                <label className="wbia__check" title="État de la cible au début de la séance">
                  <input type="checkbox" checked={target.hidden === true} onChange={() => onToggleHidden(target.id)} />
                  caché au départ
                </label>
              )}
              <button type="button" className="wbia__remove" title="Retirer cette interaction" onClick={() => onRemove(i)}>✕</button>
            </li>
          );
        })}
      </ul>

      {picking ? (
        <div className="wbia__picking">
          <span>Touchez l'objet à afficher ou masquer sur la page…</span>
          <button type="button" className="wbia__btn wbia__btn--ghost" onClick={onCancelPick}>Annuler</button>
        </div>
      ) : (
        <button type="button" className="wbia__btn wbia__btn--primary" onClick={onPick}>＋ Choisir un objet à afficher / masquer</button>
      )}

      <div className="wbia__foot">
        <label className="wbia__check" title="Le bouton lui-même peut être caché au départ (révélé par un autre bouton)">
          <input type="checkbox" checked={trigger.hidden === true} onChange={() => onToggleHidden(trigger.id)} />
          ce bouton est caché au départ
        </label>
        <button type="button" className="wbia__btn" disabled={list.length === 0} onClick={onTest} title="Déclencher le bouton maintenant">▶ Tester</button>
      </div>
      <p className="wbia__hint wbia__hint--small">Astuce : « Tout recouvrir » (menu de la page) remet les objets dans leur état de départ.</p>
    </div>
  );
}

const CSS = `
.wbia { position: fixed; right: 16px; top: 16px; z-index: 14; width: 360px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: auto; padding: 12px 14px 14px; border-radius: 14px; background: #111827; color: #F9FAFB; font: 500 13px/1.35 Inter, system-ui, sans-serif; box-shadow: 0 16px 48px rgba(0,0,0,0.45); user-select: none; }
.wbia__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.wbia__title { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbia__close { flex: none; width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: #D1D5DB; font-size: 14px; cursor: pointer; }
.wbia__close:hover { background: #1F2937; color: #FFFFFF; }
.wbia__hint { margin: 0 0 8px; color: #9CA3AF; }
.wbia__hint--small { margin: 10px 0 0; font-size: 12px; }
.wbia__empty { margin: 0 0 8px; color: #6B7280; font-style: italic; }
.wbia__list { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.wbia__row { display: grid; grid-template-columns: auto 1fr auto; grid-template-areas: "action target remove" "check check remove"; align-items: center; gap: 4px 8px; padding: 8px 10px; border-radius: 10px; background: #1F2937; }
.wbia__row.is-missing { opacity: 0.6; }
.wbia__select { grid-area: action; height: 32px; padding: 0 6px; border: 1px solid #374151; border-radius: 8px; background: #111827; color: #F9FAFB; font: inherit; }
.wbia__target { grid-area: target; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wbia__row .wbia__check { grid-area: check; }
.wbia__remove { grid-area: remove; width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: #FCA5A5; font-size: 13px; cursor: pointer; }
.wbia__remove:hover { background: #7F1D1D; color: #FFFFFF; }
.wbia__check { display: inline-flex; align-items: center; gap: 6px; color: #D1D5DB; cursor: pointer; font-size: 12px; }
.wbia__check input { width: 16px; height: 16px; accent-color: #6366F1; }
.wbia__btn { height: 40px; padding: 0 14px; border: 0; border-radius: 10px; background: #374151; color: #F9FAFB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbia__btn:disabled { opacity: 0.45; cursor: default; }
.wbia__btn--primary { width: 100%; background: #4F46E5; }
.wbia__btn--primary:hover { background: #4338CA; }
.wbia__btn--ghost { background: transparent; border: 1px solid #4B5563; }
.wbia__picking { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #312E81; color: #E0E7FF; }
.wbia__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid #1F2937; }
`;
