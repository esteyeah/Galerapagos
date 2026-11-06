export type ResourceAction = 'fish' | 'water' | 'wood';
export type ActionKind = ResourceAction | 'wreck';
export type Difficulty = 'facile' | 'normal' | 'difficile';

export type CardType =
  | 'gourde'
  | 'conserve'
  | 'coco'
  | 'planches'
  | 'cafe'
  | 'soins'
  | 'longuevue'
  | 'fusil'
  | 'cartouche'
  | 'tole'
  | 'hache'
  | 'canne'
  | 'bache'
  | 'bateau'
  | 'scotch';

export interface Card {
  id: string;
  type: CardType;
  /** Carte montrée à tous (reste visible jusqu'à ce qu'elle soit jouée). */
  revealed?: boolean;
}

export type Personality = 'cooperatif' | 'egoiste' | 'paranoiaque';

export interface PlayerConfig {
  name: string;
  isBot: boolean;
  personality?: Personality;
}

export type WeatherKind = 'secheresse' | 'nuageux' | 'averse' | 'deluge' | 'ouragan';

export interface WeatherCard {
  kind: WeatherKind;
  label: string;
  /** Portions d'eau en plus si la collecte réussit. */
  waterBonus: number;
  /** Peut-on recueillir de l'eau aujourd'hui ? */
  canCollect: boolean;
  hurricane: boolean;
}

export interface GameSettings {
  difficulty: Difficulty;
  /** Mode avec météo (et ouragan) ou sans météo (fin : évasion ou mort de tous). */
  weather: boolean;
}

export interface GameOptions {
  seed?: number;
  settings?: Partial<GameSettings>;
}

export interface Resources {
  water: number;
  food: number;
  wood: number;
}

export interface BoatState {
  hull: boolean;
  tape: boolean;
}

export type NeedsReason = 'consumption' | 'departure';
export type VoteReason = 'water' | 'food' | 'departure';

export type Decision =
  | { kind: 'action'; playerId: number; extraActions: number; tradesLeft: number }
  | { kind: 'trade'; playerId: number; fromId: number; offered: Card }
  | { kind: 'contribute'; playerId: number; reason: NeedsReason; shortWater: number; shortFood: number; shortPlaces: number }
  | {
      kind: 'vote';
      playerId: number;
      candidates: number[];
      allCandidates: number[];
      canShoot: boolean;
      reason: VoteReason;
      remaining: number;
    }
  | { kind: 'shield'; playerId: number; source: 'vote' | 'shot'; attackerId?: number; reason?: VoteReason }
  | { kind: 'flee'; playerId: number }
  | { kind: 'gameover' };

export type Command =
  | { type: 'playCard'; playerId: number; cardId: string; targetId?: number }
  | { type: 'action'; playerId: number; action: ActionKind; draws?: number }
  | { type: 'rest'; playerId: number }
  | { type: 'give'; playerId: number; cardId: string; targetId: number }
  | { type: 'proposeTrade'; playerId: number; cardId: string; targetId: number }
  | { type: 'answerTrade'; playerId: number; accept: boolean; cardId?: string }
  | { type: 'reveal'; playerId: number; cardId: string }
  | { type: 'pass'; playerId: number }
  | { type: 'vote'; playerId: number; targetId: number }
  | { type: 'shoot'; playerId: number; targetId: number }
  | { type: 'shield'; playerId: number; use: boolean }
  | { type: 'flee'; playerId: number; yes: boolean };

export type LogType = 'day' | 'action' | 'danger' | 'death' | 'vote' | 'card' | 'info' | 'victory' | 'defeat';

/** Effet visuel associé à une entrée du journal (animations de l'interface). */
export type LogFx =
  | { kind: 'draw'; playerId: number; action: ResourceAction; balls: ('w' | 'b')[]; gain: number }
  | { kind: 'wreck'; playerId: number }
  | { kind: 'rest'; playerId: number }
  | { kind: 'disease'; playerId: number; diseases: number }
  | { kind: 'death'; playerId: number; cause: string }
  | { kind: 'card'; playerId: number; cardType: CardType; targetId?: number }
  | { kind: 'give'; playerId: number; targetId: number; trade: boolean }
  | { kind: 'shot'; playerId: number; targetId: number }
  | { kind: 'vote'; playerId: number }
  | { kind: 'weather'; weather: WeatherKind };

export interface LogEntry {
  id: number;
  day: number;
  type: LogType;
  text: string;
  /** Si défini, `privateText` n'est visible que par ce joueur (ex : carte piochée). */
  privateTo?: number;
  privateText?: string;
  fx?: LogFx;
}

export interface VoteRecord {
  day: number;
  reason: VoteReason;
  ballots: Record<number, number>;
  victimId: number | null;
}

export interface GameResult {
  victory: boolean;
  survivors: number[];
  reason: string;
}

export interface BagConfig {
  white: number;
  black: number;
  maxDraw: number;
}
