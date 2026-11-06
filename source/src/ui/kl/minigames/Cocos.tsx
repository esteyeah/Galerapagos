import { useMemo, useRef, useState } from 'react';
import { CHALLENGES } from '../../../engine/kohlanta';
import { createRng } from '../../../engine';
import { BigButton, formeMod, useGameLoop, useKeys, useThrottledReport, type MinigameProps } from './common';

const DEF = CHALLENGES.cocos;
const THROWS = 10;

/** Lancer : fixer la direction puis la force, au bon moment. */
export default function Cocos({ seed, forme, running, onState }: MinigameProps) {
  const targets = useMemo(() => {
    const rng = createRng(seed);
    return Array.from({ length: THROWS }, () => 0.35 + rng() * 0.45);
  }, [seed]);
  const mod = formeMod(forme);
  const st = useRef({ n: 0, step: 'aim' as 'aim' | 'power' | 'flight', aim: 0, power: 0, score: 0, last: '' as string, flightUntil: 0, done: false, elapsed: 0 });
  const [, force] = useState(0);
  const report = useThrottledReport(onState);
  const width = 0.09 * mod;

  const press = () => {
    const s = st.current;
    if (s.done || !running) return;
    if (s.step === 'aim') s.step = 'power';
    else if (s.step === 'power') {
      const aimErr = Math.abs(s.aim);
      const powErr = Math.abs(s.power - targets[s.n]);
      const pts = aimErr < width * 0.5 && powErr < width * 0.5 ? 3 : aimErr < width * 1.2 && powErr < width * 1.2 ? 1 : 0;
      s.score += pts;
      s.last = pts === 3 ? '🎯 En plein dans le mille ! +3' : pts ? '👍 Touché ! +1' : '😬 Raté…';
      s.n++;
      s.step = 'flight';
      s.flightUntil = s.elapsed + 0.8;
      onState({ progress: s.n / THROWS, done: s.n >= THROWS, fallen: false, time: s.elapsed, score: s.score, pose: 'throw' });
    }
  };
  useKeys(running, { ' ': press, Space: press, Enter: press });

  useGameLoop(running, (elapsed) => {
    const s = st.current;
    s.elapsed = elapsed;
    if (s.done) return;
    if (s.step === 'aim') s.aim = Math.sin(elapsed * 2.6 * (1.1 - forme * 0.02));
    if (s.step === 'power') s.power = (Math.sin(elapsed * 2.2) + 1) / 2;
    if (s.step === 'flight' && elapsed > s.flightUntil) s.step = 'aim';
    if (s.n >= THROWS || elapsed >= DEF.duration) s.done = true;
    report({ progress: s.n / THROWS, done: s.done, fallen: false, time: elapsed, score: s.score, pose: s.step === 'flight' ? 'throw' : undefined });
    force((x) => x + 1);
  });

  const s = st.current;
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span>
          🥥 Lancer <b>{Math.min(s.n + 1, THROWS)}</b> / {THROWS}
        </span>
        <span>
          Score : <b className="text-amber-300">{s.score}</b>
        </span>
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-400">Direction</div>
        <div className="relative h-6 rounded-full bg-slate-800">
          <div className="absolute inset-y-0 rounded-full bg-emerald-500/50" style={{ left: `${50 - width * 50 * 1.2}%`, width: `${width * 120}%` }} />
          <div className="absolute inset-y-0 rounded-full bg-emerald-400" style={{ left: `${50 - width * 25}%`, width: `${width * 50}%` }} />
          <div className="absolute top-0 h-6 w-1.5 -translate-x-1/2 rounded bg-white" style={{ left: `${50 + s.aim * 48}%` }} />
        </div>
      </div>
      <div className={s.step === 'aim' ? 'opacity-40' : ''}>
        <div className="mb-1 text-xs text-slate-400">Force</div>
        <div className="relative h-6 rounded-full bg-slate-800">
          <div className="absolute inset-y-0 rounded-full bg-amber-500/50" style={{ left: `${(targets[Math.min(s.n, THROWS - 1)] - width * 0.6) * 100}%`, width: `${width * 120}%` }} />
          <div className="absolute inset-y-0 rounded-full bg-amber-400" style={{ left: `${(targets[Math.min(s.n, THROWS - 1)] - width * 0.25) * 100}%`, width: `${width * 50}%` }} />
          <div className="absolute top-0 h-6 w-1.5 -translate-x-1/2 rounded bg-white" style={{ left: `${s.power * 100}%` }} />
        </div>
      </div>
      <div className="h-6 text-center font-semibold">{s.done ? `Terminé : ${s.score} points` : s.last}</div>
      <BigButton onPress={press} disabled={s.step === 'flight' || s.done}>
        {s.step === 'aim' ? '🎯 Fixer la direction' : s.step === 'power' ? '💪 Lancer !' : '…'}
      </BigButton>
    </div>
  );
}
