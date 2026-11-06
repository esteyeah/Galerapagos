import type { KLItem, KLLogEntry, KLResult, KLSettings, KLVoteRecord, TeamState, ChallengeInfo, KLDecision } from './types';
import type { Personality, WeatherCard, BagConfig } from '../types';
import type { KohLantaEngine } from './KohLantaEngine';
import type { ChallengeId, ChallengeKind } from './types';

export interface KLPlayerView {
  id: number;
  name: string;
  isBot: boolean;
  personality?: Personality;
  color: string;
  skin: number;
  team: number;
  originalTeam: number;
  alive: boolean;
  diseases: number;
  forme: number;
  handCount: number;
  /** Main complète pour le joueur concerné uniquement. */
  hand: KLItem[];
  immune: boolean;
  isJury: boolean;
  challengeWins: number;
  eliminatedDay?: number;
  eliminatedHow?: string;
  bag: BagConfig;
}

export interface KLView {
  mode: 'kohlanta';
  viewerId: number | null;
  settings: KLSettings;
  day: number;
  cyclePosition: number;
  weather: WeatherCard | null;
  merged: boolean;
  teams: TeamState[];
  players: KLPlayerView[];
  decision: KLDecision;
  playableCardIds: string[];
  challenge: ChallengeInfo | null;
  lastChallengeResult: { game: ChallengeId; kind: ChallengeKind; ranking: number[]; winners: number[] } | null;
  councilTeam: number | null;
  finalists: number[];
  jury: number[];
  log: KLLogEntry[];
  voteHistory: KLVoteRecord[];
  result: KLResult | null;
}

export function buildKLView(engine: KohLantaEngine, viewerId: number | null, revealAll = false): KLView {
  const log: KLLogEntry[] = [];
  for (const e of engine.log.slice(-1500)) {
    if (e.privateTo === undefined || revealAll || e.privateTo === viewerId) log.push(e);
    else if (e.text) log.push({ ...e, privateText: undefined, privateTo: undefined });
  }
  // Pendant un vote, on ne dévoile pas les bulletins en cours (seulement l'historique terminé).
  return {
    mode: 'kohlanta',
    viewerId,
    settings: { ...engine.settings },
    day: engine.day,
    cyclePosition: engine.cyclePosition,
    weather: engine.settings.weather ? engine.weather : null,
    merged: engine.merged,
    teams: engine.teams.map((t) => ({ ...t })),
    players: engine.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      personality: p.isBot || revealAll ? p.personality : undefined,
      color: p.color,
      skin: p.skin,
      team: p.team,
      originalTeam: p.originalTeam,
      alive: p.alive,
      diseases: p.diseases,
      forme: p.forme,
      handCount: p.hand.length,
      hand: revealAll || p.id === viewerId ? p.hand.map((c) => ({ ...c })) : [],
      immune: engine.immune.has(p.id),
      isJury: p.isJury,
      challengeWins: p.challengeWins,
      eliminatedDay: p.eliminatedDay,
      eliminatedHow: p.eliminatedHow,
      bag: engine.bagFor(p),
    })),
    decision: engine.decision,
    playableCardIds: viewerId === null ? [] : engine.playableCards(viewerId).map((c) => c.id),
    challenge: engine.challenge,
    lastChallengeResult: engine.lastChallengeResult,
    councilTeam: engine.councilTeam,
    finalists: [...engine.finalists],
    jury: [...engine.jury],
    log,
    voteHistory: engine.voteHistory,
    result: engine.result,
  };
}
