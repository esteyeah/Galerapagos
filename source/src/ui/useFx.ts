import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../engine';
import { audio } from './audio';

const SPOT_KINDS = new Set(['draw', 'wreck', 'rest', 'card', 'give', 'shot']);

/**
 * Suit les nouvelles entrées du journal pour déclencher animations et sons :
 * mise en avant de la dernière action, bulles sous les joueurs, écran de mort.
 */
export function useFx(log: LogEntry[]) {
  const lastId = useRef<number | null>(null);
  const [spot, setSpot] = useState<LogEntry | null>(null);
  const [deaths, setDeaths] = useState<LogEntry[]>([]);
  const [bubbles, setBubbles] = useState<Record<number, LogEntry>>({});

  useEffect(() => {
    const last = log.at(-1)?.id ?? 0;
    if (lastId.current === null) {
      lastId.current = last;
      return;
    }
    const fresh = log.filter((e) => e.id > lastId.current!);
    lastId.current = last;
    if (fresh.length === 0) return;

    let newSpot: LogEntry | null = null;
    const newBubbles: Record<number, LogEntry> = {};
    const newDeaths: LogEntry[] = [];
    for (const e of fresh) {
      const fx = e.fx;
      if (e.type === 'victory') audio.play('victory');
      if (e.type === 'defeat') audio.play('defeat');
      if (!fx) continue;
      switch (fx.kind) {
        case 'draw':
          audio.play(fx.balls.includes('b') ? 'black' : 'white');
          break;
        case 'disease':
          audio.play('disease');
          break;
        case 'death':
          audio.play('death');
          newDeaths.push(e);
          break;
        case 'vote':
          audio.play('vote');
          break;
        case 'card':
        case 'give':
        case 'wreck':
          audio.play('card');
          break;
        case 'shot':
          audio.play('shot');
          break;
        case 'weather':
          if (fx.weather === 'ouragan' || fx.weather === 'deluge') audio.play('thunder');
          break;
      }
      if (SPOT_KINDS.has(fx.kind) && e.text) newSpot = e;
      if ('playerId' in fx && e.text && fx.kind !== 'death') newBubbles[fx.playerId] = e;
    }
    if (newSpot) setSpot(newSpot);
    if (Object.keys(newBubbles).length) setBubbles((b) => ({ ...b, ...newBubbles }));
    if (newDeaths.length) setDeaths((d) => [...d, ...newDeaths]);
  }, [log]);

  // La mise en avant disparaît après quelques secondes
  useEffect(() => {
    if (!spot) return;
    const t = setTimeout(() => setSpot(null), 3200);
    return () => clearTimeout(t);
  }, [spot]);

  // Les bulles s'effacent au bout d'un moment
  useEffect(() => {
    if (Object.keys(bubbles).length === 0) return;
    const t = setTimeout(() => setBubbles({}), 9000);
    return () => clearTimeout(t);
  }, [bubbles]);

  return { spot, bubbles, death: deaths[0] ?? null, dismissDeath: () => setDeaths((d) => d.slice(1)) };
}
