/**
 * Retoucher une animation du tableau sans toucher à son dessin (lot 2 de PLAN_animations_tableau.md).
 *
 * Onglet « Étapes » : le titre et la légende de chaque étape, la masquer, changer l'ordre. Ces
 * textes vivent dans le bloc « gc-anim » du code (voir `lib/boardAnimation`) : on ne réécrit que ce
 * bloc. À droite, l'aperçu joue l'étape en cours de retouche.
 * Onglet « Code » : le fichier entier, pour qui veut aller plus loin (ou le remplacer par un autre).
 *
 * Rien n'est écrit dans la page avant « Enregistrer » : un seul pas d'annulation.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANIMATION_MAX_CHARS, animationData, animationInfo, canReorderSteps, sanitizeCaption, withAnimationData,
  type AnimationData, type AnimationObject, type AnimationStepData,
} from '../../lib/boardAnimation';
import type { ObjectCommand } from '../../lib/boardReveal';
import { AnimationView } from './objects/AnimationView';

interface Props {
  animation: AnimationObject;
  onClose: () => void;
  onSave: (code: string) => void;
}

const PREVIEW_W = 460;

/** Légende : zone de saisie avec gras (les mots clés). Le texte y est posé une fois, jamais réécrit pendant la frappe. */
function CaptionField({ initial, onChange, onFocus }: { initial: string; onChange: (html: string) => void; onFocus: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const emit = () => onChange(sanitizeCaption(ref.current?.innerHTML ?? ''));
  const bold = () => { ref.current?.focus(); document.execCommand('bold'); emit(); };
  return (
    <div className="wbanim__caption">
      <div
        ref={ref}
        className="wbanim__editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Légende de l'étape"
        aria-multiline
        onInput={emit}
        onFocus={onFocus}
        onPaste={(e) => {
          // Collage en texte brut : pas de mise en forme venue d'ailleurs
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
        }}
      />
      <button type="button" className="wbanim__bold" title="Mot clé en gras (Ctrl+B)" onPointerDown={(e) => e.preventDefault()} onClick={bold}><b>G</b></button>
    </div>
  );
}

export function BoardAnimationDialog({ animation, onClose, onSave }: Props) {
  const [code, setCode] = useState(animation.code);
  const data = useMemo(() => animationData(code), [code]);
  const [tab, setTab] = useState<'steps' | 'code'>(() => (animationData(animation.code) ? 'steps' : 'code'));
  const [selected, setSelected] = useState(0);
  /** Change à chaque réordonnancement ou retour de l'onglet Code : les zones de légende se remontent. */
  const [epoch, setEpoch] = useState(0);
  const [previewCode, setPreviewCode] = useState(animation.code);
  const [command, setCommand] = useState<ObjectCommand | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  // L'aperçu se recharge quand la frappe s'arrête
  useEffect(() => {
    const t = window.setTimeout(() => setPreviewCode(code), 500);
    return () => window.clearTimeout(t);
  }, [code]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const info = animationInfo(previewCode);
  const ratio = info.ratio ?? 16 / 9;
  const visibleCount = data ? data.steps.filter((s) => !s.hidden).length : 0;
  const reorder = data ? canReorderSteps(data) : false;
  const changed = code !== animation.code;
  const tooBig = code.length > ANIMATION_MAX_CHARS;

  const write = (next: AnimationData) => setCode((c) => withAnimationData(c, next));
  const patchStep = (index: number, patch: Partial<AnimationStepData>) => {
    if (!data) return;
    write({ ...data, steps: data.steps.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  };
  const toggleHidden = (index: number) => {
    if (!data) return;
    const s = data.steps[index];
    if (!s.hidden && visibleCount <= 1) return; // il reste toujours une étape à jouer
    const next = { ...s };
    if (s.hidden) delete next.hidden; else next.hidden = true;
    write({ ...data, steps: data.steps.map((x, i) => (i === index ? next : x)) });
  };
  const move = (index: number, delta: -1 | 1) => {
    if (!data || !reorder) return;
    const to = index + delta;
    if (to < 0 || to >= data.steps.length) return;
    const steps = [...data.steps];
    [steps[index], steps[to]] = [steps[to], steps[index]];
    write({ ...data, steps });
    setSelected(to);
    setEpoch((n) => n + 1);
  };

  /** Rang de l'étape choisie parmi celles qui sont jouées (l'aperçu ne connaît qu'elles). */
  const previewStep = useMemo(() => {
    const d = animationData(previewCode);
    if (!d) return 0;
    let rank = 0;
    for (let i = 0; i < Math.min(selected, d.steps.length); i++) if (!d.steps[i].hidden) rank++;
    return Math.min(rank, Math.max(0, d.steps.filter((s) => !s.hidden).length - 1));
  }, [previewCode, selected]);

  const replaceWithFile = async (file: File) => {
    if (file.size > ANIMATION_MAX_CHARS) { window.alert(`Fichier trop lourd (${Math.round(file.size / 1000)} ko ; ${ANIMATION_MAX_CHARS / 1000} ko au plus).`); return; }
    setCode(await file.text());
    setSelected(0);
    setEpoch((n) => n + 1);
  };

  return (
    <div className="wbx wbanim" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onClick={onClose}>
      <div className="wbx__box wbanim__box" role="dialog" aria-label="Retoucher l'animation" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
        <div className="wbx__head">
          <h2>Animation</h2>
          <div className="wbanim__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'steps'} className={tab === 'steps' ? 'is-on' : ''} disabled={!data} title={data ? 'Titres et légendes des étapes' : 'Ce fichier ne déclare pas d\'étapes'} onClick={() => { setTab('steps'); setEpoch((n) => n + 1); }}>Étapes</button>
            <button type="button" role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'is-on' : ''} onClick={() => setTab('code')}>Code</button>
          </div>
          <button type="button" className="wbx__close" onClick={onClose} title="Fermer (Échap)">✕</button>
        </div>

        <div className="wbanim__body">
          {tab === 'steps' && data && (
            <ol className="wbanim__steps">
              {data.steps.map((s, i) => (
                <li key={`${epoch}-${s.id ?? i}`} className={`wbanim__step ${i === selected ? 'is-on' : ''} ${s.hidden ? 'is-hidden' : ''}`} onPointerDown={() => setSelected(i)}>
                  <span className="wbanim__num" aria-hidden>{s.hidden ? '–' : data.steps.slice(0, i + 1).filter((x) => !x.hidden).length}</span>
                  <div className="wbanim__fields">
                    <input
                      className="wbanim__title"
                      value={s.title}
                      placeholder="Titre de l'étape"
                      aria-label={`Titre de l'étape ${i + 1}`}
                      onFocus={() => setSelected(i)}
                      onChange={(e) => patchStep(i, { title: e.target.value })}
                    />
                    <CaptionField initial={s.caption} onFocus={() => setSelected(i)} onChange={(html) => patchStep(i, { caption: html })} />
                    {s.hidden && <span className="wbanim__note">Étape masquée : elle n'est pas jouée.</span>}
                  </div>
                  <div className="wbanim__acts">
                    <button type="button" title="Monter" disabled={!reorder || i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" title="Descendre" disabled={!reorder || i === data.steps.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className={s.hidden ? 'is-on' : ''} title={s.hidden ? 'Jouer de nouveau cette étape' : 'Masquer cette étape'} disabled={!s.hidden && visibleCount <= 1} onClick={() => toggleHidden(i)}>{s.hidden ? '🙈' : '👁'}</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {tab === 'code' && (
            <div className="wbanim__code">
              <p className="wbanim__hint">
                Le fichier entier de l'animation. Les textes des étapes sont dans le bloc <code>gc-anim</code>, le dessin dans <code>GC.play</code>.
                {!data && ' Ce fichier ne déclare pas d\'étapes : il est joué tel quel, avec ses propres boutons.'}
              </p>
              <textarea value={code} spellCheck={false} aria-label="Code de l'animation" onChange={(e) => setCode(e.target.value)} />
              <div className="wbanim__coderow">
                <button type="button" className="wbanim__link" onClick={() => fileRef.current?.click()}>Remplacer par un fichier…</button>
                <span className={tooBig ? 'wbanim__warn' : ''}>{Math.round(code.length / 1000)} ko sur {ANIMATION_MAX_CHARS / 1000}</span>
              </div>
              <input ref={fileRef} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void replaceWithFile(f); e.target.value = ''; }} />
            </div>
          )}

          <aside className="wbanim__preview">
            <div className="wbanim__frame" style={{ width: PREVIEW_W, height: Math.round(PREVIEW_W / ratio) }}>
              <AnimationView o={{ ...animation, code: previewCode, x: 0, y: 0, w: PREVIEW_W, h: Math.round(PREVIEW_W / ratio) }} scale={1} play={false} step={previewStep} command={command} />
            </div>
            <div className="wbanim__previewrow">
              <span>Aperçu{info.contract ? ` · étape ${previewStep + 1} sur ${info.steps.length}` : ''}</span>
              <button type="button" className="wbanim__link" onClick={() => setCommand({ command: 'replay', at: Date.now() })}>↺ Rejouer</button>
            </div>
          </aside>
        </div>

        <div className="wbx__foot">
          {tooBig && <span className="wbanim__warn">Animation trop lourde pour être enregistrée.</span>}
          <button type="button" className="wbx__btn" onClick={onClose}>Annuler</button>
          <button type="button" className="wbx__btn wbx__btn--primary" disabled={!changed || tooBig} onClick={() => onSave(code)}>Enregistrer</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

/* Couleurs prises au thème du tableau (sombre au TBI, clair sous le ruban) : jamais de teinte fixe pour le fond ou le texte. */
const CSS = `
.wbx.wbx.wbanim { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(17,24,39,0.6); font: 400 14px/1.4 var(--wb-font-ui, Inter, system-ui, sans-serif); }
.wbx.wbx.wbanim .wbanim__box { width: min(1180px, calc(100vw - 32px)); height: min(780px, calc(100vh - 32px)); display: flex; flex-direction: column; overflow: hidden; }
.wbx.wbx.wbanim .wbx__head { display: flex; align-items: center; gap: 16px; padding: 14px 18px 10px; }
.wbx.wbx.wbanim .wbx__head h2 { margin: 0; font: 700 20px/1.2 var(--wb-font-ui, Inter, sans-serif); }
.wbx.wbx.wbanim .wbx__close { margin-left: auto; flex: none; width: 36px; height: 36px; border: 0; border-radius: 8px; background: var(--wb-chrome-sunk); color: var(--wb-on-chrome); font-size: 16px; cursor: pointer; }
.wbanim__tabs { display: flex; gap: 4px; padding: 3px; border-radius: 9px; background: var(--wb-chrome-sunk); }
.wbanim__tabs button { height: 30px; padding: 0 14px; border: 0; border-radius: 7px; background: transparent; color: var(--wb-on-chrome-dim); font: 600 13px/1 var(--wb-font-ui, Inter, sans-serif); cursor: pointer; }
.wbanim__tabs button.is-on { background: var(--wb-chrome); color: var(--wb-on-chrome); box-shadow: 0 1px 2px rgba(0,0,0,.18); }
.wbanim__tabs button:disabled { opacity: .45; cursor: default; }
.wbanim__body { flex: 1; min-height: 0; display: flex; gap: 18px; padding: 4px 18px 12px; }
.wbanim__steps { flex: 1; min-width: 0; margin: 0; padding: 0 6px 0 0; list-style: none; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.wbanim__step { display: flex; gap: 10px; align-items: flex-start; padding: 10px; border: 1px solid var(--wb-chrome-line); border-radius: 10px; background: var(--wb-chrome); }
.wbanim__step.is-on { border-color: var(--wb-select); box-shadow: 0 0 0 1px var(--wb-select); }
.wbanim__step.is-hidden .wbanim__fields { opacity: .55; }
.wbanim__num { flex: none; width: 26px; height: 26px; margin-top: 3px; border-radius: 50%; background: var(--wb-chrome-sunk); color: var(--wb-on-chrome-dim); font: 700 13px/26px var(--wb-font-ui, Inter, sans-serif); text-align: center; }
.wbanim__step.is-on .wbanim__num { background: var(--wb-select); color: #FFFFFF; }
.wbanim__fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.wbanim__title { width: 100%; height: 34px; padding: 0 10px; border: 1px solid var(--wb-chrome-line); border-radius: 7px; background: var(--wb-chrome-sunk); color: var(--wb-on-chrome); font: 700 15px/1 var(--wb-font-ui, Inter, sans-serif); }
.wbanim__caption { display: flex; gap: 6px; align-items: flex-start; }
.wbanim__editor { flex: 1; min-width: 0; min-height: 52px; padding: 7px 10px; border: 1px solid var(--wb-chrome-line); border-radius: 7px; background: var(--wb-chrome-sunk); color: var(--wb-on-chrome); font: 400 14px/1.4 var(--wb-font-ui, Inter, sans-serif); outline: none; user-select: text; white-space: pre-wrap; overflow-wrap: anywhere; }
.wbanim__editor b, .wbanim__editor strong { color: #C00000; font-weight: 700; }
.wbanim__title:focus, .wbanim__editor:focus, .wbanim__code textarea:focus { border-color: var(--wb-select); outline: none; }
.wbanim__bold, .wbanim__acts button { flex: none; width: 30px; height: 30px; border: 1px solid var(--wb-chrome-line); border-radius: 7px; background: var(--wb-chrome); color: var(--wb-on-chrome); font: 600 14px/1 var(--wb-font-ui, Inter, sans-serif); cursor: pointer; }
.wbanim__bold:hover, .wbanim__acts button:hover:not(:disabled) { background: var(--wb-chrome-hover); }
.wbanim__acts { flex: none; display: flex; flex-direction: column; gap: 4px; }
.wbanim__acts button:disabled { opacity: .35; cursor: default; }
.wbanim__acts button.is-on { border-color: var(--wb-select); }
.wbanim__note { color: var(--wb-on-chrome-dim); font-size: 12px; }
.wbanim__code { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.wbanim__hint { margin: 0; color: var(--wb-on-chrome-dim); font-size: 13px; }
.wbanim__hint code { padding: 1px 5px; border-radius: 4px; background: var(--wb-chrome-sunk); font: 12px/1.4 ui-monospace, 'Cascadia Mono', Consolas, monospace; }
.wbanim__code textarea { flex: 1; min-height: 0; resize: none; padding: 10px 12px; border: 1px solid var(--wb-chrome-line); border-radius: 8px; background: var(--wb-chrome-sunk); color: var(--wb-on-chrome); font: 12px/1.5 ui-monospace, 'Cascadia Mono', Consolas, monospace; white-space: pre; tab-size: 2; user-select: text; }
.wbanim__coderow, .wbanim__previewrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--wb-on-chrome-dim); font-size: 13px; }
.wbanim__link { border: 0; padding: 4px 0; background: transparent; color: var(--wb-select); font: 600 13px/1 var(--wb-font-ui, Inter, sans-serif); cursor: pointer; }
.wbanim__preview { flex: none; width: ${PREVIEW_W}px; display: flex; flex-direction: column; gap: 8px; }
.wbanim__frame { border: 1px solid var(--wb-chrome-line); border-radius: 8px; overflow: hidden; background: #FFFFFF; }
.wbanim__warn { color: var(--wb-danger, #DC2626); font-weight: 600; }
.wbx.wbx.wbanim .wbx__foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 10px 18px 14px; border-top: 1px solid var(--wb-chrome-line); }
.wbx.wbx.wbanim .wbx__foot .wbanim__warn { margin-right: auto; }
.wbx.wbx.wbanim .wbx__btn { height: 38px; padding: 0 18px; border: 1px solid var(--wb-chrome-line); border-radius: 8px; background: var(--wb-chrome); color: var(--wb-on-chrome); font: 600 14px/1 var(--wb-font-ui, Inter, sans-serif); cursor: pointer; }
.wbx.wbx.wbanim .wbx__btn--primary { background: var(--wb-select); border-color: var(--wb-select); color: #FFFFFF; }
.wbx.wbx.wbanim .wbx__btn:disabled { opacity: .45; cursor: default; }
@media (max-width: 900px) { .wbanim__preview { display: none; } }
`;
