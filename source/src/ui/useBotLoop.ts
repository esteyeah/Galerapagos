import { useEffect } from 'react';
import { chooseBotCommand, type GameEngine } from '../engine';

export const SPEEDS = { lent: 2600, normal: 1700, rapide: 700 } as const;
export type Speed = keyof typeof SPEEDS;

/** Fait jouer les bots (côté hôte ou partie locale), avec un délai pour suivre leurs actions. */
export function useBotLoop(engine: GameEngine | null, version: number, paused: boolean, speed: Speed, onError: (msg: string) => void): void {
  useEffect(() => {
    if (!engine || paused) return;
    const d = engine.decision;
    if (d.kind === 'gameover' || !engine.player(d.playerId).isBot) return;
    // Un vote ou une réponse va plus vite qu'une action (qui déclenche une animation)
    const delay = d.kind === 'action' ? SPEEDS[speed] : Math.round(SPEEDS[speed] * 0.45);
    const t = setTimeout(() => {
      try {
        engine.dispatch(chooseBotCommand(engine));
      } catch (e) {
        onError(`Erreur d'un bot : ${(e as Error).message}`);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [engine, version, paused, speed, onError]);
}

/** Re-rend le composant à chaque changement du moteur. */
export function useEngineVersion(engine: GameEngine | null, setVersion: (fn: (v: number) => number) => void): void {
  useEffect(() => (engine ? engine.subscribe(() => setVersion((v) => v + 1)) : undefined), [engine, setVersion]);
}
