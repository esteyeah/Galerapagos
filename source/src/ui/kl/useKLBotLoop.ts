import { useEffect } from 'react';
import { chooseKLBotCommand, type KohLantaEngine } from '../../engine/kohlanta';
import { SPEEDS, type Speed } from '../useBotLoop';

/** Fait jouer les bots Koh Lanta (hors épreuves, gérées à part). */
export function useKLBotLoop(engine: KohLantaEngine | null, version: number, paused: boolean, speed: Speed, onError: (m: string) => void): void {
  useEffect(() => {
    if (!engine || paused) return;
    const d = engine.decision;
    if (d.kind === 'challenge' || d.kind === 'gameover' || !engine.player(d.playerId).isBot) return;
    const delay = d.kind === 'action' ? SPEEDS[speed] : Math.round(SPEEDS[speed] * 0.45);
    const t = setTimeout(() => {
      try {
        engine.dispatch(chooseKLBotCommand(engine));
      } catch (e) {
        onError(`Erreur d'un bot : ${(e as Error).message}`);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [engine, version, paused, speed, onError]);
}
