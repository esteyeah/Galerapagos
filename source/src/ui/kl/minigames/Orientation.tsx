import { useMemo, useRef, useState } from 'react';
import { createRng } from '../../../engine';
import { formeMod, useGameLoop, useThrottledReport, type MinigameProps } from './common';

const SIZE = 5;
const LANDMARKS = [
  { emoji: '🪨', name: 'du rocher' },
  { emoji: '🌴', name: 'du palmier' },
  { emoji: '🛖', name: 'de la cabane' },
  { emoji: '💧', name: 'de la source' },
  { emoji: '🗿', name: 'du totem' },
];
const DIRS = [
  { dx: 0, dy: -1, name: 'au nord' },
  { dx: 0, dy: 1, name: 'au sud' },
  { dx: 1, dy: 0, name: "à l'est" },
  { dx: -1, dy: 0, name: "à l'ouest" },
];
const BALISES = 6;

interface Clue {
  marks: { x: number; y: number; i: number }[];
  answer: { x: number; y: number };
  text: string;
}

function makeClues(seed: number): Clue[] {
  const rng = createRng(seed);
  const clues: Clue[] = [];
  while (clues.length < BALISES) {
    const cells = new Set<string>();
    const marks = LANDMARKS.map((_, i) => {
      let x = 0;
      let y = 0;
      do {
        x = Math.floor(rng() * SIZE);
        y = Math.floor(rng() * SIZE);
      } while (cells.has(`${x},${y}`));
      cells.add(`${x},${y}`);
      return { x, y, i };
    });
    const ref = marks[Math.floor(rng() * marks.length)];
    const dir = DIRS[Math.floor(rng() * DIRS.length)];
    const steps = 1 + Math.floor(rng() * 2);
    const ax = ref.x + dir.dx * steps;
    const ay = ref.y + dir.dy * steps;
    if (ax < 0 || ay < 0 || ax >= SIZE || ay >= SIZE || cells.has(`${ax},${ay}`)) continue;
    clues.push({ marks, answer: { x: ax, y: ay }, text: `La balise est ${steps} case${steps > 1 ? 's' : ''} ${dir.name} ${LANDMARKS[ref.i].name} ${LANDMARKS[ref.i].emoji}` });
  }
  return clues;
}

/** Course d'orientation : lire l'indice et trouver la balise sur la carte. */
export default function Orientation({ seed, forme, running, onState }: MinigameProps) {
  const clues = useMemo(() => makeClues(seed), [seed]);
  const st = useRef({ found: 0, lockUntil: 0, done: false, time: 0, wrong: null as string | null, elapsed: 0 });
  const [, force] = useState(0);
  const report = useThrottledReport(onState);
  const penalty = 4 / formeMod(forme);

  useGameLoop(running, (elapsed) => {
    const s = st.current;
    s.elapsed = elapsed;
    if (s.done) return;
    report({ progress: s.found / BALISES, done: false, fallen: false, time: elapsed, score: 0, pose: elapsed < s.lockUntil ? 'stun' : 'think' });
    force((x) => x + 1);
  });

  const s = st.current;
  const clue = clues[Math.min(s.found, BALISES - 1)];
  const locked = s.elapsed < s.lockUntil;
  const pick = (x: number, y: number) => {
    if (s.done || locked || !running) return;
    if (x === clue.answer.x && y === clue.answer.y) {
      s.found++;
      s.wrong = null;
      if (s.found >= BALISES) {
        s.done = true;
        s.time = s.elapsed;
        onState({ progress: 1, done: true, fallen: false, time: s.time, score: 0 });
      }
    } else {
      s.wrong = `${x},${y}`;
      s.lockUntil = s.elapsed + penalty;
    }
    force((v) => v + 1);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>
          🧭 Balise <b>{Math.min(s.found + 1, BALISES)}</b> / {BALISES}
        </span>
        <span className="text-xs text-slate-400">N ↑</span>
      </div>
      <div className={`rounded-xl px-3 py-2 text-center font-semibold ${locked ? 'bg-rose-500/30 text-rose-100' : 'bg-amber-400/20 text-amber-100'}`}>
        {s.done ? '🏁 Toutes les balises trouvées !' : locked ? `❌ Mauvaise case ! Pénalité… ${Math.ceil(s.lockUntil - s.elapsed)} s` : clue.text}
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-5 gap-1">
        {Array.from({ length: SIZE * SIZE }, (_, k) => {
          const x = k % SIZE;
          const y = Math.floor(k / SIZE);
          const mark = clue.marks.find((m) => m.x === x && m.y === y);
          return (
            <button
              key={k}
              onClick={() => pick(x, y)}
              disabled={!!mark || s.done}
              className={`aspect-square rounded-lg text-2xl ${mark ? 'bg-emerald-900/60' : s.wrong === `${x},${y}` && locked ? 'bg-rose-600/60' : 'bg-emerald-700/40 hover:bg-amber-300/40'}`}
            >
              {mark ? LANDMARKS[mark.i].emoji : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
