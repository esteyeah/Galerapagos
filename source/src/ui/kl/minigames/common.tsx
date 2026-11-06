import { useEffect, useRef } from 'react';
import type { ChallengeState } from '../../../engine/kohlanta';

export interface MinigameProps {
  seed: number;
  /** Forme du joueur (0–10) : rend l'épreuve un peu plus facile ou plus dure. */
  forme: number;
  running: boolean;
  onState: (s: ChallengeState) => void;
}

/** Multiplicateur de performance lié à la forme (0,8 à 1,2). */
export const formeMod = (forme: number) => 0.8 + forme * 0.04;

/** Boucle d'animation : appelle `tick(elapsed, dt)` tant que `running`. */
export function useGameLoop(running: boolean, tick: (elapsed: number, dt: number) => void): void {
  const ref = useRef(tick);
  ref.current = tick;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const start = performance.now();
    let last = start;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current((now - start) / 1000, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** Envoie l'état au plus toutes les 100 ms (et immédiatement s'il est final). */
export function useThrottledReport(onState: (s: ChallengeState) => void) {
  const last = useRef(0);
  return (s: ChallengeState, force = false) => {
    const now = performance.now();
    if (force || s.done || s.fallen || now - last.current > 100) {
      last.current = now;
      onState(s);
    }
  };
}

/** Touches clavier pendant le mini-jeu. */
export function useKeys(running: boolean, handlers: Record<string, () => void>): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current[e.key] ?? ref.current[e.code];
      if (h && !e.repeat) {
        e.preventDefault();
        h();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);
}

export function BigButton({ children, onPress, color = 'bg-amber-400 text-slate-900', disabled }: { children: React.ReactNode; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      className={`min-h-14 flex-1 touch-none select-none rounded-2xl px-4 py-3 font-display text-xl shadow-lg shadow-black/40 transition active:scale-95 disabled:opacity-40 ${color}`}
    >
      {children}
    </button>
  );
}

export function Meter({ value, label, color, danger }: { value: number; label: string; color: string; danger?: boolean }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value * 100)} %</span>
      </div>
      <div className={`h-3 overflow-hidden rounded-full bg-slate-800 ${danger ? 'animate-pulse' : ''}`}>
        <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

/** Barre d'équilibre : curseur entre -1 et 1, chute au-delà. */
export function BalanceBar({ value }: { value: number }) {
  const danger = Math.abs(value) > 0.7;
  return (
    <div className="relative h-8 overflow-hidden rounded-full border border-white/20 bg-gradient-to-r from-rose-600/70 via-emerald-500/60 to-rose-600/70">
      <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/60" />
      <div
        className={`absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${danger ? 'bg-rose-400' : 'bg-white'}`}
        style={{ left: `${50 + Math.max(-1, Math.min(1, value)) * 48}%` }}
      />
    </div>
  );
}
