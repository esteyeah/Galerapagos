import { useMemo, useRef, useState } from 'react';
import { CHALLENGES } from '../../../engine/kohlanta';
import { createRng } from '../../../engine';
import { useGameLoop, useThrottledReport, type MinigameProps } from './common';

const DEF = CHALLENGES.puzzle;

/** Image du totem sculpté, découpée en 9 pièces. */
const PICTURE = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#fde68a"/></linearGradient></defs>
<rect width="300" height="300" fill="url(#s)"/><circle cx="230" cy="70" r="34" fill="#fbbf24"/>
<rect x="0" y="230" width="300" height="70" fill="#0ea5e9"/><path d="M0 250 Q75 235 150 250 T300 250 V300 H0Z" fill="#0284c7"/>
<rect x="105" y="40" width="90" height="230" rx="10" fill="#92400e"/>
<rect x="95" y="40" width="110" height="50" rx="8" fill="#b45309"/>
<circle cx="130" cy="120" r="14" fill="#fef3c7"/><circle cx="170" cy="120" r="14" fill="#fef3c7"/>
<circle cx="130" cy="120" r="6" fill="#111"/><circle cx="170" cy="120" r="6" fill="#111"/>
<path d="M120 165 Q150 190 180 165" stroke="#fef3c7" stroke-width="9" fill="none" stroke-linecap="round"/>
<path d="M60 70 L105 95 L60 120Z" fill="#dc2626"/><path d="M240 70 L195 95 L240 120Z" fill="#dc2626"/>
<rect x="115" y="205" width="70" height="14" fill="#facc15"/><path d="M30 230 Q40 150 70 120" stroke="#166534" stroke-width="10" fill="none"/>
<path d="M70 120 l-40 10 M70 120 l-25 -25 M70 120 l10 -35" stroke="#16a34a" stroke-width="9" stroke-linecap="round"/></svg>`)}`;

/** Puzzle : échanger les pièces pour reconstituer l'image. */
export default function Puzzle({ seed, running, onState }: MinigameProps) {
  const initial = useMemo(() => {
    const rng = createRng(seed);
    let order: number[];
    do {
      order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    } while (order.filter((v, i) => v === i).length > 2);
    return order;
  }, [seed]);
  const [order, setOrder] = useState(initial);
  const [sel, setSel] = useState<number | null>(null);
  const st = useRef({ done: false, time: 0, elapsed: 0 });
  const report = useThrottledReport(onState);
  const correct = order.filter((v, i) => v === i).length;

  useGameLoop(running, (elapsed) => {
    st.current.elapsed = elapsed;
    if (st.current.done) return;
    report({ progress: correct / 9, done: false, fallen: false, time: Math.min(elapsed, DEF.duration), score: correct, pose: 'think' });
  });

  const tap = (i: number) => {
    if (!running || st.current.done) return;
    if (sel === null) {
      setSel(i);
      return;
    }
    const next = [...order];
    [next[sel], next[i]] = [next[i], next[sel]];
    setOrder(next);
    setSel(null);
    if (next.every((v, k) => v === k)) {
      st.current.done = true;
      st.current.time = st.current.elapsed;
      onState({ progress: 1, done: true, fallen: false, time: st.current.time, score: 9 });
    }
  };

  return (
    <div className="flex items-start justify-center gap-3">
      <div className="grid w-48 grid-cols-3 gap-1 sm:w-72">
        {order.map((piece, i) => (
          <button
            key={i}
            onClick={() => tap(i)}
            className={`aspect-square rounded-md bg-no-repeat transition ${sel === i ? 'scale-95 ring-4 ring-amber-300' : ''} ${piece === i ? 'ring-1 ring-emerald-400/70' : ''}`}
            style={{ backgroundImage: `url("${PICTURE}")`, backgroundSize: '300% 300%', backgroundPosition: `${(piece % 3) * 50}% ${Math.floor(piece / 3) * 50}%` }}
            aria-label={`Pièce ${i + 1}`}
          />
        ))}
      </div>
      <div className="w-24 text-center text-xs sm:text-sm">
        <div className="mb-1 text-slate-400">Modèle</div>
        <img src={PICTURE} alt="Modèle à reconstituer" className="w-16 rounded-md opacity-90 sm:w-24" />
        <div className="mt-2">
          {st.current.done ? '🏁 Terminé !' : (
            <>
              Pièces bien placées : <b className="text-amber-300">{correct}</b> / 9
            </>
          )}
        </div>
      </div>
    </div>
  );
}
