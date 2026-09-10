/**
 * Widgets posables sur la page : minuteur, dé, roue, niveau sonore, calculatrice.
 * L'état de fonctionnement (compte à rebours, dernier tirage) est local ; seuls les réglages
 * (durée, nombre de faces, entrées de la roue, niveau) sont enregistrés dans l'objet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOISE_LEVELS, type WidgetObject } from '../../../lib/boardMedia';

interface Props {
  o: WidgetObject;
  scale: number;
  onConfig: (patch: WidgetObject['config']) => void;
}

const hold = (e: React.PointerEvent) => e.stopPropagation();
const pad2 = (n: number) => String(n).padStart(2, '0');

function TimerWidget({ o, onConfig }: Props) {
  const total = o.config.seconds ?? 300;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const endAt = useRef<number | null>(null);
  useEffect(() => { if (!running) setLeft(total); }, [total, running]);
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + left * 1000;
    const t = window.setInterval(() => {
      const remaining = Math.max(0, Math.round(((endAt.current ?? 0) - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) { setRunning(false); try { new AudioContext().resume().then(beep); } catch { /* pas de son */ } }
    }, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const beep = () => {
    try {
      const ac = new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = 880;
      osc.connect(gain); gain.connect(ac.destination);
      gain.gain.setValueAtTime(0.2, ac.currentTime);
      osc.start(); osc.stop(ac.currentTime + 0.6);
    } catch { /* audio indisponible */ }
  };
  return (
    <>
      <div className={`wbw__time ${running && left <= 10 ? 'is-urgent' : ''}`}>{pad2(Math.floor(left / 60))}:{pad2(left % 60)}</div>
      <div className="wbw__row" onPointerDown={hold}>
        <button type="button" onClick={() => setRunning((v) => !v)}>{running ? 'Pause' : left === 0 ? 'Relancer' : 'Démarrer'}</button>
        <button type="button" onClick={() => { setRunning(false); setLeft(total); }}>Remise</button>
        <button type="button" onClick={() => onConfig({ seconds: Math.max(30, total - 60) })} disabled={running}>−1 min</button>
        <button type="button" onClick={() => onConfig({ seconds: total + 60 })} disabled={running}>+1 min</button>
      </div>
    </>
  );
}

function DiceWidget({ o, onConfig }: Props) {
  const faces = o.config.faces ?? 6;
  const [value, setValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let n = 0;
    const t = window.setInterval(() => {
      setValue(1 + Math.floor(Math.random() * faces));
      if (++n >= 12) { window.clearInterval(t); setRolling(false); }
    }, 70);
  };
  return (
    <>
      <div className="wbw__big">{value ?? '?'}</div>
      <div className="wbw__row" onPointerDown={hold}>
        <button type="button" onClick={roll} disabled={rolling}>Lancer</button>
        {[6, 8, 10, 12, 20].map((f) => (
          <button key={f} type="button" className={faces === f ? 'is-on' : ''} onClick={() => { onConfig({ faces: f }); setValue(null); }}>d{f}</button>
        ))}
      </div>
    </>
  );
}

function WheelWidget({ o, onConfig }: Props) {
  const entries = o.config.entries ?? ['A', 'B', 'C'];
  const [pick, setPick] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spin = () => {
    if (spinning || entries.length === 0) return;
    setSpinning(true);
    let n = 0;
    const total = 18 + Math.floor(Math.random() * 10);
    const step = () => {
      setPick(entries[Math.floor(Math.random() * entries.length)]);
      n++;
      if (n < total) window.setTimeout(step, 40 + n * 12);
      else setSpinning(false);
    };
    step();
  };
  const edit = () => {
    const text = window.prompt('Une entrée par ligne (ou séparées par des virgules)', entries.join('\n'));
    if (text === null) return;
    const list = text.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) onConfig({ entries: list });
  };
  return (
    <>
      <div className="wbw__big wbw__big--text">{pick ?? '—'}</div>
      <div className="wbw__row" onPointerDown={hold}>
        <button type="button" onClick={spin} disabled={spinning}>Tourner</button>
        <button type="button" onClick={edit}>Liste ({entries.length})</button>
      </div>
    </>
  );
}

function NoiseWidget({ o, onConfig }: Props) {
  const level = o.config.level ?? 0;
  return (
    <div className="wbw__noise" onPointerDown={hold}>
      {NOISE_LEVELS.map((l, i) => (
        <button key={l.label} type="button" className={level === i ? 'is-on' : ''} style={{ ['--c' as string]: l.color }} onClick={() => onConfig({ level: i })} title={l.label}>
          <span>{l.icon}</span>{l.label}
        </button>
      ))}
    </div>
  );
}

/** Évaluateur arithmétique sûr (+ − × ÷, parenthèses, décimales, %). */
function evaluate(expr: string): number {
  const tokens = expr.replace(/\s+/g, '').replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').match(/\d+(?:\.\d+)?|[()+\-*/%]/g) ?? [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const factor = (): number => {
    const t = next();
    if (t === '(') { const v = sum(); if (next() !== ')') throw new Error('Parenthèse'); return v; }
    if (t === '-') return -factor();
    if (t === '+') return factor();
    if (t === undefined || Number.isNaN(Number(t))) throw new Error('Expression');
    let v = Number(t);
    if (peek() === '%') { next(); v /= 100; }
    return v;
  };
  const product = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') { const op = next(); const r = factor(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (peek() === '+' || peek() === '-') { const op = next(); const r = product(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  const v = sum();
  if (i < tokens.length) throw new Error('Expression');
  return v;
}

function CalcWidget() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const press = useCallback((k: string) => {
    if (k === 'C') { setExpr(''); setResult(null); return; }
    if (k === '⌫') { setExpr((e) => e.slice(0, -1)); return; }
    if (k === '=') {
      try { const v = evaluate(expr); setResult(Number.isFinite(v) ? String(Math.round(v * 1e10) / 1e10) : 'Erreur'); }
      catch { setResult('Erreur'); }
      return;
    }
    setResult(null);
    setExpr((e) => e + k);
  }, [expr]);
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', ',', '%', '+', '(', ')', '⌫', 'C', '='];
  return (
    <div className="wbw__calc" onPointerDown={hold}>
      <div className="wbw__screen"><span>{expr || '0'}</span>{result !== null && <b>= {result}</b>}</div>
      <div className="wbw__keys">
        {keys.map((k) => <button key={k} type="button" className={k === '=' ? 'is-eq' : ''} onClick={() => press(k)}>{k}</button>)}
      </div>
    </div>
  );
}

export function WidgetView(props: Props) {
  const { o, scale } = props;
  return (
    <div className={`wbw wbw--${o.widget}`} style={{ width: o.w * scale, height: o.h * scale, fontSize: Math.max(11, 14 * scale) }}>
      {o.widget === 'timer' && <TimerWidget {...props} />}
      {o.widget === 'dice' && <DiceWidget {...props} />}
      {o.widget === 'wheel' && <WheelWidget {...props} />}
      {o.widget === 'noise' && <NoiseWidget {...props} />}
      {o.widget === 'calc' && <CalcWidget />}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbw { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5em; padding: 0.6em; border-radius: 12px; background: #312E81; color: #F9FAFB; font-family: Inter, system-ui, sans-serif; overflow: hidden; user-select: none; box-sizing: border-box; }
.wbw__time { font: 700 3.4em/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: 0.04em; }
.wbw__time.is-urgent { color: #FCA5A5; }
.wbw__big { font: 700 3.6em/1 Inter, system-ui, sans-serif; }
.wbw__big--text { font-size: 2em; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbw__row { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.4em; }
.wbw button { height: 2.2em; padding: 0 0.9em; border: 0; border-radius: 0.6em; background: rgba(255,255,255,0.14); color: #FFFFFF; font: 600 1em/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbw button:hover { background: rgba(255,255,255,0.24); }
.wbw button.is-on { background: #FFFFFF; color: #312E81; }
.wbw button:disabled { opacity: 0.45; cursor: default; }
.wbw--noise { background: #111827; padding: 0.4em; }
.wbw__noise { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.4em; width: 100%; height: 100%; }
.wbw__noise button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2em; height: auto; background: rgba(255,255,255,0.08); border: 3px solid transparent; }
.wbw__noise button span { font-size: 1.8em; }
.wbw__noise button.is-on { background: var(--c); color: #FFFFFF; border-color: #FFFFFF; }
.wbw--calc { background: #1F2937; padding: 0.4em; }
.wbw__calc { display: flex; flex-direction: column; gap: 0.4em; width: 100%; height: 100%; }
.wbw__screen { display: flex; flex-direction: column; align-items: flex-end; padding: 0.4em 0.6em; border-radius: 0.5em; background: #111827; font: 500 1.3em/1.2 "IBM Plex Mono", ui-monospace, monospace; min-height: 2.6em; word-break: break-all; }
.wbw__screen b { color: #A5B4FC; }
.wbw__keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3em; flex: 1; }
.wbw__keys button { height: auto; padding: 0; font-size: 1.1em; }
.wbw__keys button.is-eq { grid-column: span 1; background: #4F46E5; }
`;
