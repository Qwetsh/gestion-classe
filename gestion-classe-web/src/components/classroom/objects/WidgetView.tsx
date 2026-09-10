/**
 * Widgets posables sur la page : minuteur, dé, roue, niveau sonore, calculatrice.
 * L'état de fonctionnement (compte à rebours, dernier tirage) est local ; seuls les réglages
 * (durée, nombre de faces, entrées de la roue, niveau) sont enregistrés dans l'objet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { NOISE_LEVELS, TRAFFIC_LEVELS, makeGroups, type WidgetObject } from '../../../lib/boardMedia';

interface Props {
  o: WidgetObject;
  scale: number;
  onConfig: (patch: WidgetObject['config']) => void;
  /** Élèves présents de la séance (groupes aléatoires) ; absent hors mode classe. */
  students?: string[];
}

/** Sonomètre : niveau mesuré au micro, alerte au-dessus du seuil (comme ClassroomScreen). */
function MeterWidget({ o, onConfig }: Props) {
  const threshold = o.config.threshold ?? 60;
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState<'off' | 'on' | 'denied'>('off');
  const [alarm, setAlarm] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const over = useRef(0);

  const stop = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setStatus('off');
    setLevel(0);
    setAlarm(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      stream.current = s;
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(s);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let smooth = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        // -60 dBFS (silence de classe) → 0, -10 dBFS (cris) → 100
        const db = 20 * Math.log10(Math.max(rms, 1e-6));
        const target = Math.max(0, Math.min(100, ((db + 60) / 50) * 100));
        smooth = smooth * 0.8 + target * 0.2;
        setLevel(smooth);
        over.current = smooth > threshold ? over.current + 1 : 0;
        setAlarm(over.current > 45); // ~0,75 s au-dessus du seuil
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      setStatus('on');
    } catch {
      setStatus('denied');
    }
    // threshold lu via la fermeture : on relance si on le change (effet ci-dessous)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => { over.current = 0; }, [threshold]);

  const color = level > threshold ? '#DC2626' : level > threshold * 0.7 ? '#F59E0B' : '#10B981';
  return (
    <div className={`wbw__meter ${alarm ? 'is-alarm' : ''}`} onPointerDown={hold}>
      <div className="wbw__meter-bar">
        <div className="wbw__meter-fill" style={{ width: `${level}%`, background: color }} />
        <div className="wbw__meter-thr" style={{ left: `${threshold}%` }} />
      </div>
      <div className="wbw__row">
        {status !== 'on'
          ? <button type="button" onClick={() => void start()}>{status === 'denied' ? 'Micro refusé — réessayer' : 'Écouter la classe'}</button>
          : <button type="button" onClick={stop}>Arrêter</button>}
        <button type="button" onClick={() => onConfig({ threshold: Math.max(10, threshold - 10) })} title="Seuil plus bas (plus strict)">Seuil −</button>
        <span className="wbw__small">{Math.round(threshold)}</span>
        <button type="button" onClick={() => onConfig({ threshold: Math.min(100, threshold + 10) })} title="Seuil plus haut (plus tolérant)">Seuil +</button>
      </div>
      {alarm && <div className="wbw__alarm">Trop de bruit</div>}
    </div>
  );
}

function GroupsWidget({ o, onConfig, students }: Props) {
  const names = students && students.length > 0 ? students : (o.config.entries ?? []);
  const size = o.config.groupSize ?? 4;
  const groups = o.config.groups ?? [];
  const draw = () => { if (names.length > 0) onConfig({ groups: makeGroups(names, size) }); };
  const edit = () => {
    const text = window.prompt('Un prénom par ligne (ou séparés par des virgules)', (o.config.entries ?? []).join('\n'));
    if (text === null) return;
    const list = text.split(/[\n,;]/).map((s) => s.trim()).filter(Boolean);
    onConfig({ entries: list, groups: [] });
  };
  return (
    <div className="wbw__groups" onPointerDown={hold}>
      <div className="wbw__row">
        <span className="wbw__small">{names.length} élève{names.length > 1 ? 's' : ''}{students && students.length > 0 ? ' présents' : ''}</span>
        <button type="button" onClick={() => onConfig({ groupSize: Math.max(2, size - 1) })}>−</button>
        <span className="wbw__small">par {size}</span>
        <button type="button" onClick={() => onConfig({ groupSize: Math.min(10, size + 1) })}>+</button>
        <button type="button" className="is-on" onClick={draw} disabled={names.length === 0}>Former les groupes</button>
        {(!students || students.length === 0) && <button type="button" onClick={edit}>Liste…</button>}
      </div>
      <div className="wbw__grid">
        {groups.map((g, i) => (
          <div key={i} className="wbw__group">
            <b>Groupe {i + 1}</b>
            {g.map((n) => <span key={n}>{n}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClockWidget({ o, onConfig }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(t); }, []);
  const showSeconds = o.config.showSeconds ?? false;
  const showDate = o.config.showDate ?? true;
  return (
    <>
      <div className="wbw__time" onDoubleClick={() => onConfig({ showSeconds: !showSeconds })} title="Double-clic : secondes">
        {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...(showSeconds ? { second: '2-digit' } : {}) })}
      </div>
      {showDate && <div className="wbw__date">{now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
      <div className="wbw__row wbw__row--faint" onPointerDown={hold}>
        <button type="button" onClick={() => onConfig({ showSeconds: !showSeconds })}>{showSeconds ? 'Sans secondes' : 'Secondes'}</button>
        <button type="button" onClick={() => onConfig({ showDate: !showDate })}>{showDate ? 'Sans date' : 'Date'}</button>
      </div>
    </>
  );
}

function TrafficWidget({ o, onConfig }: Props) {
  const level = o.config.level ?? 0;
  return (
    <div className="wbw__traffic" onPointerDown={hold}>
      {TRAFFIC_LEVELS.map((l, i) => (
        <button key={l.label} type="button" className={`wbw__light ${level === i ? 'is-on' : ''}`} style={{ ['--c' as string]: l.color }} onClick={() => onConfig({ level: i })} title={l.label} />
      ))}
      <span className="wbw__traffic-label">{TRAFFIC_LEVELS[level]?.label}</span>
    </div>
  );
}

function QrWidget({ o, onConfig }: Props) {
  const text = o.config.text ?? '';
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    QRCode.toDataURL(text, { width: 512, margin: 1 }).then((u) => { if (!cancelled) setUrl(u); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [text]);
  const shown = text ? url : null;
  const edit = () => { const t = window.prompt('Adresse ou texte du QR code', text); if (t !== null) onConfig({ text: t.trim() }); };
  return (
    <div className="wbw__qr" onPointerDown={hold}>
      {shown ? <img src={shown} alt="" draggable={false} /> : <button type="button" onClick={edit}>Contenu du QR code…</button>}
      {shown && <button type="button" className="wbw__qr-edit" onClick={edit} title="Modifier">✎</button>}
    </div>
  );
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
      {o.widget === 'meter' && <MeterWidget {...props} />}
      {o.widget === 'groups' && <GroupsWidget {...props} />}
      {o.widget === 'clock' && <ClockWidget {...props} />}
      {o.widget === 'traffic' && <TrafficWidget {...props} />}
      {o.widget === 'qr' && <QrWidget {...props} />}
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
.wbw__small { color: #C7D2FE; font-size: 0.9em; }
.wbw__row--faint { opacity: 0.55; }
.wbw__row--faint:hover { opacity: 1; }
.wbw__date { font: 500 1.1em/1 Inter, system-ui, sans-serif; color: #C7D2FE; text-transform: capitalize; }
.wbw--clock, .wbw--qr { background: #111827; }
.wbw--meter { background: #111827; }
.wbw__meter { display: flex; flex-direction: column; gap: 0.6em; width: 100%; align-items: center; }
.wbw__meter.is-alarm { animation: wbw-alarm 0.6s ease-in-out infinite alternate; }
@keyframes wbw-alarm { from { box-shadow: inset 0 0 0 4px rgba(220,38,38,0.2); } to { box-shadow: inset 0 0 0 10px rgba(220,38,38,0.75); } }
.wbw__meter-bar { position: relative; width: 100%; height: 2.2em; border-radius: 1.1em; background: #1F2937; overflow: hidden; }
.wbw__meter-fill { height: 100%; transition: width 0.08s linear; border-radius: 1.1em; }
.wbw__meter-thr { position: absolute; top: 0; bottom: 0; width: 3px; background: #FFFFFF; }
.wbw__alarm { font: 800 1.6em/1 Inter, system-ui, sans-serif; color: #FCA5A5; }
.wbw__groups { display: flex; flex-direction: column; gap: 0.5em; width: 100%; height: 100%; }
.wbw__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9em, 1fr)); gap: 0.4em; overflow-y: auto; flex: 1; }
.wbw__group { display: flex; flex-direction: column; gap: 0.15em; padding: 0.4em 0.6em; border-radius: 0.6em; background: rgba(255,255,255,0.1); font-size: 0.95em; }
.wbw__group b { color: #C7D2FE; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.05em; }
.wbw--traffic { background: #111827; }
.wbw__traffic { display: flex; flex-direction: column; align-items: center; gap: 0.5em; padding: 0.5em; border-radius: 1em; background: #1F2937; }
.wbw__light { width: 3.2em; height: 3.2em; border-radius: 50%; border: 3px solid #374151; background: #111827; padding: 0; opacity: 0.35; }
.wbw__light.is-on { background: var(--c); border-color: #FFFFFF; opacity: 1; box-shadow: 0 0 1.2em var(--c); }
.wbw__traffic-label { font: 600 0.9em/1 Inter, system-ui, sans-serif; color: #E5E7EB; }
.wbw__qr { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.wbw__qr img { max-width: 100%; max-height: 100%; border-radius: 0.5em; background: #FFFFFF; }
.wbw__qr-edit { position: absolute; right: 0.3em; bottom: 0.3em; width: 2em !important; min-width: 0 !important; padding: 0 !important; opacity: 0.6; }
.wbw--calc { background: #1F2937; padding: 0.4em; }
.wbw__calc { display: flex; flex-direction: column; gap: 0.4em; width: 100%; height: 100%; }
.wbw__screen { display: flex; flex-direction: column; align-items: flex-end; padding: 0.4em 0.6em; border-radius: 0.5em; background: #111827; font: 500 1.3em/1.2 "IBM Plex Mono", ui-monospace, monospace; min-height: 2.6em; word-break: break-all; }
.wbw__screen b { color: #A5B4FC; }
.wbw__keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3em; flex: 1; }
.wbw__keys button { height: auto; padding: 0; font-size: 1.1em; }
.wbw__keys button.is-eq { grid-column: span 1; background: #4F46E5; }
`;
