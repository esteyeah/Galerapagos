import { useEffect } from 'react';
import type { GameView, LogEntry } from '../../engine';

const ACTION_ICON = { fish: '🎣', water: '💧', wood: '🪓' } as const;

/** Mise en avant de la dernière action (bien visible quand un bot joue). */
export function ActionSpotlight({ entry, view }: { entry: LogEntry | null; view: GameView }) {
  if (!entry?.fx) return null;
  const fx = entry.fx;
  const actor = 'playerId' in fx ? view.players[fx.playerId] : null;
  const icon =
    fx.kind === 'draw' ? ACTION_ICON[fx.action] : fx.kind === 'wreck' ? '🛳️' : fx.kind === 'rest' ? '😴' : fx.kind === 'shot' ? '💥' : fx.kind === 'give' ? (fx.trade ? '🔄' : '🎁') : '🃏';
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-live="polite">
      <div key={entry.id} className="animate-spot flex max-w-xl items-center gap-4 rounded-2xl border border-amber-300/50 bg-slate-900 px-5 py-4 shadow-2xl shadow-black/60">
        <div className="text-5xl">{icon}</div>
        <div className="min-w-0">
          {actor && (
            <div className="font-display text-lg" style={{ color: actor.color }}>
              {actor.isBot ? '🤖 ' : ''}
              {actor.name}
            </div>
          )}
          {fx.kind === 'draw' && (
            <div className="my-1 flex gap-1.5">
              {fx.balls.map((b, i) => (
                <span
                  key={i}
                  className={`animate-ball inline-block h-6 w-6 rounded-full ${b === 'w' ? 'bg-slate-100 shadow-[inset_-3px_-3px_0_rgba(0,0,0,.15)]' : 'border border-white/40 bg-slate-950'}`}
                  style={{ animationDelay: `${i * 180}ms` }}
                />
              ))}
            </div>
          )}
          <div className="text-sm text-slate-100" style={fx.kind === 'draw' ? { animation: `fadein .3s ${fx.balls.length * 180}ms both` } : undefined}>
            {entry.text}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Animation plein écran quand un naufragé meurt. */
export function DeathOverlay({ entry, view, onDone }: { entry: LogEntry | null; view: GameView; onDone: () => void }) {
  useEffect(() => {
    if (!entry) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [entry, onDone]);
  if (!entry || entry.fx?.kind !== 'death') return null;
  const p = view.players[entry.fx.playerId];
  return (
    <div key={entry.id} className="animate-death fixed inset-0 z-[60] flex cursor-pointer items-center justify-center p-4" onClick={onDone}>
      <div className="text-center">
        <div className="animate-skull text-8xl">💀</div>
        <div className="mt-4 font-display text-4xl text-rose-200 sm:text-5xl" style={{ textShadow: `0 0 30px ${p.color}` }}>
          {p.name} a péri
        </div>
        <div className="mt-2 text-lg text-rose-100/80">{entry.fx.cause}</div>
        <div className="mt-6 text-xs text-rose-100/50">Touchez pour continuer</div>
      </div>
    </div>
  );
}
