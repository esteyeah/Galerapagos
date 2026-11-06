import { useMemo, useRef, useState } from 'react';
import { CHALLENGES } from '../../../engine/kohlanta';
import { createRng } from '../../../engine';
import { formeMod, useGameLoop, useThrottledReport, type MinigameProps } from './common';

const TOTEMS = [
  { emoji: '🦅', color: 'bg-red-600' },
  { emoji: '🐢', color: 'bg-blue-600' },
  { emoji: '🦎', color: 'bg-green-600' },
  { emoji: '🐍', color: 'bg-yellow-500' },
];
const DEF = CHALLENGES.totems;

/** Mémoire : reproduire une séquence qui s'allonge. Une erreur = éliminé. */
export default function Totems({ seed, forme, running, onState }: MinigameProps) {
  const sequence = useMemo(() => {
    const rng = createRng(seed);
    return Array.from({ length: 30 }, () => Math.floor(rng() * 4));
  }, [seed]);
  const st = useRef({ round: 3, phase: 'show' as 'show' | 'input', showStart: 0, input: 0, fallen: false, done: false, time: 0, lit: -1, elapsed: 0 });
  const [, force] = useState(0);
  const report = useThrottledReport(onState);
  const stepTime = 0.75 / formeMod(forme);

  useGameLoop(running, (elapsed) => {
    const s = st.current;
    s.elapsed = elapsed;
    if (s.fallen || s.done) return;
    if (s.phase === 'show') {
      const k = Math.floor((elapsed - s.showStart) / Math.max(0.35, stepTime - s.round * 0.02));
      s.lit = k < s.round ? sequence[k] : -1;
      const frac = ((elapsed - s.showStart) / Math.max(0.35, stepTime - s.round * 0.02)) % 1;
      if (frac > 0.75) s.lit = -1;
      if (k >= s.round) {
        s.phase = 'input';
        s.input = 0;
      }
    }
    if (elapsed >= DEF.duration) {
      s.done = true;
      s.time = DEF.duration;
    }
    report({ progress: Math.min(1, elapsed / DEF.duration), done: s.done, fallen: false, time: elapsed, score: s.round, pose: 'think' });
    force((x) => x + 1);
  });

  const s = st.current;
  const press = (i: number) => {
    if (s.phase !== 'input' || s.fallen || s.done || !running) return;
    if (sequence[s.input] !== i) {
      s.fallen = true;
      s.time = s.elapsed;
      onState({ progress: Math.min(1, s.elapsed / DEF.duration), done: true, fallen: true, time: s.elapsed, score: s.round });
    } else {
      s.input++;
      if (s.input >= s.round) {
        s.round++;
        s.phase = 'show';
        s.showStart = s.elapsed + 0.6;
      }
    }
    force((v) => v + 1);
  };

  return (
    <div className="space-y-3">
      <div className="text-center text-sm text-slate-300">
        {s.fallen ? '❌ Mauvais totem… éliminé·e !' : s.done ? '🏆 Mémoire infaillible !' : s.phase === 'show' ? `👀 Regardez bien… (séquence de ${s.round})` : `👉 À vous : ${s.input} / ${s.round}`}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {TOTEMS.map((t, i) => (
          <button
            key={i}
            onPointerDown={() => press(i)}
            className={`aspect-[3/4] rounded-2xl text-4xl transition ${t.color} ${s.lit === i ? 'scale-110 brightness-150 ring-4 ring-white' : 'opacity-70'} ${s.phase === 'input' && !s.fallen ? 'hover:opacity-100 active:scale-95' : ''}`}
          >
            {t.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
