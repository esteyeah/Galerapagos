import type { BagConfig, BoatState, Card, Decision, GameResult, GameSettings, LogEntry, Personality, Resources, VoteRecord, WeatherCard } from './types';
import type { GameEngine } from './GameEngine';

/** Vue publique d'un joueur (+ sa main complète uniquement pour lui-même). */
export interface PlayerView {
  id: number;
  name: string;
  isBot: boolean;
  personality?: Personality;
  color: string;
  alive: boolean;
  diseases: number;
  handCount: number;
  /** Cartes visibles : toute la main pour le joueur concerné, sinon les cartes montrées. */
  visibleCards: Card[];
  contributed: number;
  deathDay?: number;
  deathCause?: string;
}

export type ViewDecision =
  | Exclude<Decision, { kind: 'trade' }>
  | { kind: 'trade'; playerId: number; fromId: number; offered: Card | null };

/** Instantané sérialisable (JSON) de la partie, filtré pour un spectateur donné. */
export interface GameView {
  viewerId: number | null;
  settings: GameSettings;
  day: number;
  weather: WeatherCard | null;
  lastDay: boolean;
  hurricaneWindow: [number, number] | null;
  resources: Resources;
  boat: BoatState;
  places: number;
  canFlee: boolean;
  bag: BagConfig;
  wreckRemaining: number;
  decision: ViewDecision;
  playableCardIds: string[];
  players: PlayerView[];
  log: LogEntry[];
  voteHistory: VoteRecord[];
  result: GameResult | null;
}

const LOG_LIMIT = 400;

export function buildView(engine: GameEngine, viewerId: number | null, revealAll = false): GameView {
  const d = engine.decision;
  let decision: ViewDecision = d;
  if (d.kind === 'trade' && !revealAll && viewerId !== d.playerId && viewerId !== d.fromId) {
    decision = { ...d, offered: null };
  }
  const log: LogEntry[] = [];
  for (const e of engine.log.slice(-LOG_LIMIT)) {
    if (e.privateTo === undefined || revealAll || e.privateTo === viewerId) {
      log.push(e);
    } else if (e.text) {
      log.push({ ...e, privateText: undefined, privateTo: undefined });
    }
  }
  return {
    viewerId,
    settings: { ...engine.settings },
    day: engine.day,
    weather: engine.weather,
    lastDay: engine.lastDay,
    hurricaneWindow: engine.hurricaneWindow,
    resources: { ...engine.resources },
    boat: { ...engine.boat },
    places: engine.places,
    canFlee: engine.canFlee(),
    bag: engine.bag,
    wreckRemaining: engine.wreckRemaining,
    decision,
    playableCardIds: viewerId === null ? [] : engine.playableCards(viewerId).map((c) => c.id),
    players: engine.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      personality: p.isBot || revealAll ? p.personality : undefined,
      color: p.color,
      alive: p.alive,
      diseases: p.diseases,
      handCount: p.hand.length,
      visibleCards: (revealAll || p.id === viewerId ? p.hand : p.hand.filter((c) => c.revealed)).map((c) => ({ ...c })),
      contributed: p.contributed,
      deathDay: p.deathDay,
      deathCause: p.deathCause,
    })),
    log,
    voteHistory: engine.voteHistory,
    result: engine.result,
  };
}
