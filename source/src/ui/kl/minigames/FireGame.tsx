import { useRef, useState } from 'react';
import { BigButton, formeMod, useGameLoop, useKeys } from './common';

/**
 * Mini-jeu du feu : frotter les bâtons en rythme pour garder la chaleur
 * dans la zone idéale jusqu'à ce que la braise prenne.
 */
export default function FireGame({ forme, onDone }: { forme: number; onDone: (success: boolean) => void }) {
  const mod = formeMod(forme);
  const st = useRef({ heat: 0.1, ember: 0, lastSide: 0, finished: false, elapsed: 0 });
  const [, force] = useState(0);
  const [running, setRunning] = useState(false);
  const LIMIT = 15;

  const rub = (side: number) => {
    const s = st.current;
    if (!running || s.finished) return;
    s.heat += side !== s.lastSide ? 0.07 : 0.015;
    s.lastSide = side;
  };
  useKeys(running, { ArrowLeft: () => rub(-1), ArrowRight: () => rub(1) });

  useGameLoop(running, (elapsed, dt) => {
    const s = st.current;
    if (s.finished) return;
    s.elapsed = elapsed;
    s.heat = Math.max(0, s.heat - dt * 0.28);
    const inZone = s.heat > 0.55 && s.heat < 0.85;
    if (inZone) s.ember += dt * 0.16 * mod;
    else if (s.heat >= 0.95) s.ember -= dt * 0.25; // trop fort : la braise s'étouffe
    s.ember = Math.max(0, s.ember);
    if (s.ember >= 1 || elapsed >= LIMIT) {
      s.finished = true;
      setRunning(false);
      setTimeout(() => onDone(s.ember >= 1), 900);
    }
    force((x) => x + 1);
  });

  const s = st.current;
  const success = s.finished && s.ember >= 1;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className={`text-6xl transition ${success ? 'scale-125' : ''}`}>{success ? '🔥' : s.ember > 0.5 ? '🌫️' : s.finished ? '💨' : '🪵'}</div>
        <div className="flex-1 space-y-2">
          <div>
            <div className="mb-0.5 text-xs text-slate-300">Chaleur (restez dans la zone verte)</div>
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-800">
              <div className="absolute inset-y-0 bg-emerald-500/40" style={{ left: '55%', width: '30%' }} />
              <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-red-500" style={{ width: `${Math.min(1, s.heat) * 100}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-0.5 text-xs text-slate-300">Braise</div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-yellow-300" style={{ width: `${Math.min(1, s.ember) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
      <div className="text-center text-sm text-slate-300">
        {s.finished ? (success ? '🔥 Le feu a pris !' : '💨 Raté… vous perdez de la forme.') : running ? `Frottez en alternant ◀ ▶ — ${Math.max(0, Math.ceil(LIMIT - s.elapsed))} s` : 'Alternez gauche / droite pour faire monter la chaleur, sans trop forcer.'}
      </div>
      {!running && !s.finished ? (
        <BigButton onPress={() => setRunning(true)}>🔥 Commencer à frotter</BigButton>
      ) : (
        <div className="flex gap-2">
          <BigButton onPress={() => rub(-1)} disabled={s.finished}>◀</BigButton>
          <BigButton onPress={() => rub(1)} disabled={s.finished}>▶</BigButton>
        </div>
      )}
    </div>
  );
}
