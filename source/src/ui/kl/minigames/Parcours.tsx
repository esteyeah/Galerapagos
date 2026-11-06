import { useMemo, useRef, useState } from 'react';
import { CHALLENGES } from '../../../engine/kohlanta';
import { createRng } from '../../../engine';
import { BigButton, formeMod, useGameLoop, useKeys, useThrottledReport, type MinigameProps } from './common';

const DEF = CHALLENGES.parcours;

/** Course d'obstacles : taper en rythme pour avancer, sauter au bon moment. */
export default function Parcours({ seed, forme, running, onState }: MinigameProps) {
  const obstacles = useMemo(() => {
    const rng = createRng(seed);
    return Array.from({ length: 8 }, (_, i) => 0.09 + i * 0.11 + rng() * 0.03);
  }, [seed]);
  const st = useRef({ progress: 0, speed: 0, lastSide: 0, stunUntil: 0, jumpUntil: 0, cleared: new Set<number>(), done: false, time: 0 });
  const [, force] = useState(0);
  const report = useThrottledReport(onState);
  const mod = formeMod(forme);

  const tap = (side: number) => {
    const s = st.current;
    if (s.done || performance.now() < s.stunUntil) return;
    s.speed += side !== s.lastSide ? 0.0055 * mod : 0.0015;
    s.speed = Math.min(s.speed, 0.024 * mod);
    s.lastSide = side;
  };
  const jump = () => {
    const s = st.current;
    if (s.done || performance.now() < s.stunUntil) return;
    s.jumpUntil = performance.now() + 550;
  };
  useKeys(running, { ArrowLeft: () => tap(-1), ArrowRight: () => tap(1), ' ': jump, Space: jump, ArrowUp: jump });

  useGameLoop(running, (elapsed, dt) => {
    const s = st.current;
    if (s.done) return;
    const now = performance.now();
    s.speed *= Math.pow(0.35, dt);
    if (now >= s.stunUntil) s.progress += s.speed * dt * 4;
    // obstacles
    obstacles.forEach((o, i) => {
      if (s.cleared.has(i)) return;
      if (s.progress >= o) {
        if (now < s.jumpUntil) s.cleared.add(i);
        else {
          s.progress = o - 0.012;
          s.speed = 0;
          s.stunUntil = now + 1100;
          s.cleared.add(i);
        }
      }
    });
    if (s.progress >= 1) {
      s.progress = 1;
      s.done = true;
      s.time = elapsed;
    }
    report({ progress: s.progress, done: s.done, fallen: false, time: s.done ? s.time : elapsed, score: 0, pose: now < s.stunUntil ? 'stun' : now < s.jumpUntil ? 'jump' : undefined });
    if (elapsed > DEF.duration && !s.done) report({ progress: s.progress, done: false, fallen: false, time: elapsed, score: 0 }, true);
    force((x) => x + 1);
  });

  const s = st.current;
  const next = obstacles.findIndex((o, i) => !s.cleared.has(i) && o > s.progress);
  const dist = next >= 0 ? obstacles[next] - s.progress : 1;
  const inZone = dist < 0.035;
  const stunned = performance.now() < s.stunUntil;
  return (
    <div className="space-y-3">
      <div className="relative h-10 overflow-hidden rounded-xl bg-amber-900/40">
        {obstacles.map((o, i) => (
          <div key={i} className={`absolute top-1 h-8 w-1.5 rounded ${s.cleared.has(i) ? 'bg-emerald-400/50' : 'bg-amber-700'}`} style={{ left: `${o * 100}%` }} />
        ))}
        <div className="absolute top-1 text-2xl transition-[left] duration-75" style={{ left: `calc(${s.progress * 100}% - 12px)` }}>
          🏃
        </div>
        <div className="absolute right-0 top-0 h-full w-1 bg-white" />
      </div>
      <div className={`rounded-xl px-3 py-1 text-center font-semibold ${stunned ? 'bg-rose-500/30 text-rose-100' : inZone ? 'animate-pulse bg-emerald-500/40 text-emerald-50' : 'bg-white/5 text-slate-300'}`}>
        {s.done ? '🏁 Arrivé !' : stunned ? '💥 Obstacle percuté !' : inZone ? '⬆️ SAUTEZ MAINTENANT !' : 'Alternez gauche / droite pour courir'}
      </div>
      <div className="flex gap-2">
        <BigButton onPress={() => tap(-1)}>◀ Gauche</BigButton>
        <BigButton onPress={jump} color={inZone ? 'bg-emerald-400 text-slate-900' : 'bg-cyan-500 text-slate-900'}>⬆ Sauter</BigButton>
        <BigButton onPress={() => tap(1)}>Droite ▶</BigButton>
      </div>
    </div>
  );
}
