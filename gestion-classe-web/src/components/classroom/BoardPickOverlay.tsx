/**
 * Tirage au sort depuis le tableau : roulette de noms, sans remise dans la séance, absents
 * exclus ; un, deux (binôme) ou trois élèves. Le résultat est aussi envoyé au téléphone.
 */
import { useEffect, useRef, useState } from 'react';

export interface PickableStudent { id: string; pseudo: string; absent?: boolean }

interface Props {
  students: PickableStudent[];
  /** Déjà tirés dans la séance (sans remise). */
  alreadyPicked: ReadonlySet<string>;
  onPicked: (ids: string[]) => void;
  onStamp: (id: string) => void;
  onResetPool: () => void;
  onClose: () => void;
}

const firstName = (p: string) => p.split(' ')[0] || p;
const suffix = (p: string) => p.split(' ').slice(1).join(' ');

export function BoardPickOverlay({ students, alreadyPicked, onPicked, onStamp, onResetPool, onClose }: Props) {
  const [count, setCount] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<PickableStudent[]>([]);
  const [done, setDone] = useState(false);
  const [stamped, setStamped] = useState<Set<string>>(new Set());
  const timer = useRef<number | null>(null);

  const present = students.filter((s) => !s.absent);
  const pool = present.filter((s) => !alreadyPicked.has(s.id));

  const spin = () => {
    if (spinning) return;
    const source = pool.length >= count ? pool : present;
    if (source.length === 0) return;
    setSpinning(true);
    setDone(false);
    setStamped(new Set());
    let n = 0;
    const total = 16 + Math.floor(Math.random() * 8);
    const step = () => {
      const shuffled = [...source].sort(() => Math.random() - 0.5).slice(0, count);
      setShown(shuffled);
      n++;
      if (n < total) timer.current = window.setTimeout(step, 45 + n * 14);
      else {
        setSpinning(false);
        setDone(true);
        onPicked(shuffled.map((s) => s.id));
      }
    };
    step();
  };

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); spin(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // spin lit l'état courant : rattaché à chaque rendu
  });

  return (
    <div className="wbp" onPointerDown={(e) => e.stopPropagation()}>
      <div className="wbp__box">
        <div className="wbp__head">
          <span>Tirage au sort</span>
          <span className="wbp__pool">{pool.length} / {present.length} restant{pool.length > 1 ? 's' : ''}{students.length - present.length > 0 ? ` · ${students.length - present.length} absent${students.length - present.length > 1 ? 's' : ''} exclu${students.length - present.length > 1 ? 's' : ''}` : ''}</span>
          <button type="button" className="wbp__close" onClick={onClose} title="Fermer (Échap)">✕</button>
        </div>
        <div className={`wbp__names ${spinning ? 'is-spinning' : ''} ${done ? 'is-done' : ''}`}>
          {shown.length === 0 && <div className="wbp__placeholder">?</div>}
          {shown.map((s) => (
            <div key={s.id} className="wbp__name">
              {firstName(s.pseudo)}<span>{suffix(s.pseudo)}</span>
              {done && (
                <button type="button" className={`wbp__stamp ${stamped.has(s.id) ? 'is-on' : ''}`} disabled={stamped.has(s.id)} onClick={() => { onStamp(s.id); setStamped((prev) => new Set(prev).add(s.id)); }} title="+1 tampon (envoyé au téléphone)">
                  {stamped.has(s.id) ? '⭐ envoyé' : '+1 tampon'}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="wbp__bar">
          <div className="wbp__count">
            {[1, 2, 3].map((n) => <button key={n} type="button" className={count === n ? 'is-on' : ''} onClick={() => setCount(n)} disabled={spinning}>{n === 1 ? '1 élève' : n === 2 ? 'Binôme' : 'Trio'}</button>)}
          </div>
          <button type="button" className="wbp__go" onClick={spin} disabled={spinning || present.length === 0}>{spinning ? '…' : done ? 'Encore (Espace)' : 'Tirer (Espace)'}</button>
          <button type="button" className="wbp__reset" onClick={onResetPool} disabled={spinning || alreadyPicked.size === 0} title="Remettre tout le monde dans le chapeau">Remise à zéro</button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.wbp { position: fixed; inset: 0; z-index: 26; display: flex; align-items: center; justify-content: center; background: rgba(17,24,39,0.75); font-family: Inter, system-ui, sans-serif; }
.wbp__box { width: min(880px, calc(100vw - 40px)); display: flex; flex-direction: column; gap: 18px; padding: 22px 26px; border-radius: 22px; background: #111827; color: #F9FAFB; box-shadow: 0 30px 90px rgba(0,0,0,0.6); }
.wbp__head { display: flex; align-items: center; gap: 14px; font: 600 14px/1 Inter, system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #9CA3AF; }
.wbp__pool { flex: 1; text-transform: none; letter-spacing: 0; font-weight: 500; }
.wbp__close { width: 36px; height: 36px; border: 0; border-radius: 50%; background: #1F2937; color: #E5E7EB; cursor: pointer; }
.wbp__names { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px; min-height: 160px; align-items: center; }
.wbp__placeholder { font: 700 120px/1 Inter, system-ui, sans-serif; color: #374151; }
.wbp__name { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 30px; border-radius: 18px; background: #1F2937; font: 700 clamp(36px, 7vw, 84px)/1 Inter, system-ui, sans-serif; }
.wbp__name span { font-size: 0.4em; font-weight: 500; color: #9CA3AF; }
.is-spinning .wbp__name { opacity: 0.75; }
.is-done .wbp__name { background: #312E81; outline: 3px solid #6366F1; }
.wbp__stamp { height: 40px; padding: 0 16px; border: 0; border-radius: 10px; background: #F59E0B; color: #111827; font: 700 15px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbp__stamp.is-on { background: #374151; color: #F9FAFB; cursor: default; }
.wbp__bar { display: flex; align-items: center; gap: 12px; }
.wbp__count { display: flex; gap: 6px; flex: 1; }
.wbp__count button { height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: #1F2937; color: #E5E7EB; font: 600 14px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbp__count button.is-on { background: #4F46E5; color: #FFFFFF; }
.wbp__go { height: 54px; padding: 0 28px; border: 0; border-radius: 14px; background: #4F46E5; color: #FFFFFF; font: 700 18px/1 Inter, system-ui, sans-serif; cursor: pointer; }
.wbp__go:disabled, .wbp__reset:disabled, .wbp__count button:disabled { opacity: 0.5; cursor: default; }
.wbp__reset { height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: #374151; color: #E5E7EB; font: 600 13px/1 Inter, system-ui, sans-serif; cursor: pointer; }
`;
