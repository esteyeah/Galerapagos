import type { Difficulty, LogType, Personality, WeatherCard } from '../types';

export type KLItemType = 'riz' | 'fruits' | 'gourde' | 'machette' | 'masque' | 'bache' | 'silex' | 'soins' | 'collier' | 'energie';

export interface KLItem {
  id: string;
  type: KLItemType;
}

export interface KLSettings {
  /** 1 = chacun pour soi, 2 à 4 = équipes. */
  teams: number;
  /** La météo influence-t-elle la collecte d'eau et le feu ? (jamais d'ouragan) */
  weather: boolean;
  difficulty: Difficulty;
}

export interface KLPlayerConfig {
  name: string;
  isBot: boolean;
  personality?: Personality;
  skin?: number;
}

export type ChallengeKind = 'confort' | 'immunite' | 'orientation' | 'poteaux';
export type ChallengeId = 'parcours' | 'paresseux' | 'poteaux' | 'orientation' | 'totems' | 'cocos' | 'puzzle';

export interface ChallengeInfo {
  kind: ChallengeKind;
  game: ChallengeId;
  participants: number[];
  /** Épreuve par équipes (score moyen de l'équipe) ou individuelle. */
  teamMode: boolean;
  seed: number;
  /** Récompense mise en jeu pour une épreuve de confort. */
  reward?: RewardId;
}

export type RewardId = 'vivres' | 'peche' | 'feu' | 'repos' | 'soins' | 'eau';

export type KLAction = 'fish' | 'water' | 'wood' | 'jungle' | 'rest' | 'fire';
export type KLVoteReason = 'water' | 'food' | 'council' | 'jury';

export type KLDecision =
  | { kind: 'challenge'; challenge: ChallengeInfo }
  | { kind: 'action'; playerId: number; teamId: number }
  | { kind: 'vote'; playerId: number; candidates: number[]; reason: KLVoteReason; teamId: number; canNecklace: boolean; remaining: number }
  | { kind: 'finalChoice'; playerId: number; options: number[] }
  | { kind: 'gameover' };

export type KLCommand =
  | { type: 'action'; playerId: number; action: KLAction; draws?: number; success?: boolean }
  | { type: 'playCard'; playerId: number; cardId: string; targetId?: number }
  | { type: 'give'; playerId: number; cardId: string; targetId: number }
  | { type: 'vote'; playerId: number; targetId: number }
  | { type: 'necklace'; playerId: number }
  | { type: 'finalChoice'; playerId: number; targetId: number };

export type KLFx =
  | { kind: 'draw'; playerId: number; action: 'fish' | 'water' | 'wood'; balls: ('w' | 'b')[]; gain: number }
  | { kind: 'fire'; playerId: number; success: boolean }
  | { kind: 'jungle'; playerId: number }
  | { kind: 'rest'; playerId: number }
  | { kind: 'disease'; playerId: number; diseases: number }
  | { kind: 'eliminated'; playerId: number; how: string }
  | { kind: 'card'; playerId: number; item: KLItemType; targetId?: number }
  | { kind: 'vote'; playerId: number }
  | { kind: 'challenge'; kind2: ChallengeKind; game: ChallengeId }
  | { kind: 'reveal'; council: true };

export interface KLLogEntry {
  id: number;
  day: number;
  type: LogType;
  text: string;
  privateTo?: number;
  privateText?: string;
  fx?: KLFx;
}

export interface KLVoteRecord {
  day: number;
  reason: KLVoteReason;
  teamId: number;
  ballots: Record<number, number>;
  victimId: number | null;
  /** Bulletins annulés par un collier d'immunité. */
  cancelled?: number[];
}

export interface KLResult {
  winnerId: number | null;
  finalists: number[];
  juryVotes: Record<number, number>;
  reason: string;
}

export interface TeamState {
  id: number;
  name: string;
  color: string;
  water: number;
  food: number;
  wood: number;
  fire: boolean;
}

export type { WeatherCard };
