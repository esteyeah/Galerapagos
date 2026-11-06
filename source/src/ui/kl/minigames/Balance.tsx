import { useMemo, useRef, useState } from 'react';
import { CHALLENGES, type ChallengeId } from '../../../engine/kohlanta';
import { createRng } from '../../../engine';
import { BalanceBar, BigButton, Meter, formeMod, useGameLoop, useKeys, useThrottledReport, type MinigameProps } from './common';

/**
 * Équilibre (paresseux et poteaux) : garder le curseur au centre.
 * Paresseux : la prise faiblit, il faut la raffermir.
 * Poteaux : ordres de changement de pied à exécuter vite.
 */
export default function Balance({ seed, forme, running, onState, game }: MinigameProps & { game: Extract<ChallengeId, 'paresseux' | 'poteaux'> }) {
  const def = CHALLENGES[game];
  const rng = useMemo(() => createRng(seed), [seed]);
  const mod = formeMod(forme);
  const st = useRef({ b: 0, v: 0, grip: 1, fallen: false, done: false, time: 0, order: null as null | { side: -1 | 1; until: number }, nextOrder: 10, gust: 0 });
  const [, force] = useState(0);
  const report = useThrottledReport(onState);

  const push = (dir: number) => {
    const s = st.current;
    if (s.fallen || s.done) return;
    s.v += dir * 0.55;
    if (s.order && s.order.side === dir) s.order = null;
    else if (s.order && s.order.side !== dir) s.v += dir * 0.8; // mauvais pied : gros déséquilibre
  };
  const regrip = () => {
    const s = st.current;
    if (s.fallen || s.done || game !== 'paresseux') return;
    s.grip = Math.min(1, s.grip + 0.22);
    s.v += (rng() - 0.5) * 0.9;
  };
  useKeys(running, { ArrowLeft: () => push(-1), ArrowRight: () => push(1), ' ': regrip, Space: regrip, ArrowUp: regrip });

  useGameLoop(running, (elapsed, dt) => {
    const s = st.current;
    if (s.fallen || s.done) return;
    const difficulty = 1 + elapsed / 45;
    // dérive aléatoire qui s'accentue avec le temps
    s.v += (rng() - 0.5) * 2.6 * difficulty * dt / mod + s.b * 0.9 * dt;
    if (game === 'poteaux') {
      if (elapsed > s.gust && rng() < 0.01) {
        s.v += (rng() < 0.5 ? -1 : 1) * 0.6 * difficulty;
        s.gust = elapsed + 3;
      }
      if (!s.order && elapsed > s.nextOrder) {
        s.order = { side: rng() < 0.5 ? -1 : 1, until: elapsed + 1.8 / Math.sqrt(difficulty) * mod };
        s.nextOrder = elapsed + 9 + rng() * 6;
      }
      if (s.order && elapsed > s.order.until) {
        s.v += s.order.side * -1.4;
        s.order = null;
      }
    } else {
      s.grip -= dt * 0.045 * difficulty / mod;
      if (s.grip <= 0) s.fallen = true;
    }
    s.v *= Math.pow(0.4, dt);
    s.b += s.v * dt;
    if (Math.abs(s.b) > 1) s.fallen = true;
    if (s.fallen) s.time = elapsed;
    if (!s.fallen && elapsed >= def.duration) {
      s.done = true;
      s.time = def.duration;
    }
    report({ progress: Math.min(1, elapsed / def.duration), done: s.done || s.fallen, fallen: s.fallen, time: s.fallen || s.done ? s.time : elapsed, score: 0, balance: s.b, pose: Math.abs(s.b) > 0.7 ? 'wobble' : undefined });
    force((x) => x + 1);
  });

  const s = st.current;
  return (
    <div className="space-y-3">
      <BalanceBar value={s.b} />
      {game === 'paresseux' && <Meter value={s.grip} label="✊ Prise" color="linear-gradient(90deg,#f43f5e,#facc15,#22c55e)" danger={s.grip < 0.3} />}
      {game === 'poteaux' && (
        <div className={`rounded-xl px-3 py-2 text-center font-display text-xl ${s.order ? 'animate-pulse bg-amber-400 text-slate-900' : 'bg-white/5 text-slate-300'}`}>
          {s.order ? `🦶 Changez de pied : ${s.order.side < 0 ? '◀ GAUCHE' : 'DROITE ▶'} !` : s.fallen ? '💦 Plouf !' : 'Tenez bon…'}
        </div>
      )}
      {s.fallen && game === 'paresseux' && <div className="rounded-xl bg-sky-500/30 px-3 py-2 text-center font-display text-xl">💦 Plouf ! Vous êtes tombé·e.</div>}
      {s.done && <div className="rounded-xl bg-emerald-500/30 px-3 py-2 text-center font-display text-xl">🏆 Vous avez tenu jusqu'au bout !</div>}
      <div className="flex gap-2">
        <BigButton onPress={() => push(-1)}>◀</BigButton>
        {game === 'paresseux' && (
          <BigButton onPress={regrip} color="bg-cyan-500 text-slate-900">
            ✊ Raffermir
          </BigButton>
        )}
        <BigButton onPress={() => push(1)}>▶</BigButton>
      </div>
    </div>
  );
}
