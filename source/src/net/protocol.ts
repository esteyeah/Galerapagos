import type { Command, Difficulty, GameView, Personality } from '../engine';

export interface LobbySeat {
  seat: number;
  name: string;
  kind: 'host' | 'remote' | 'bot';
  personality?: Personality | 'random';
  connected: boolean;
}

export interface LobbyState {
  code: string;
  seats: LobbySeat[];
  settings: { difficulty: Difficulty; weather: boolean };
  started: boolean;
  introId: number | null;
}

export type HostMsg =
  | { t: 'welcome'; seat: number; token: string }
  | { t: 'lobby'; lobby: LobbyState }
  | { t: 'view'; view: GameView }
  | { t: 'error'; message: string }
  | { t: 'closed'; reason: string };

export type ClientMsg = { t: 'hello'; name: string; token?: string } | { t: 'cmd'; cmd: Command } | { t: 'leave' } | { t: 'ping' };

export const PING_INTERVAL = 3000;
export const OFFLINE_AFTER = 10000;

export const PEER_PREFIX = 'naufrages-v2-';
export const MAX_SEATS = 8;

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export function randomCode(): string {
  return Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
}

export function randomToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Options PeerJS. Par défaut : serveur public gratuit de PeerJS.
 * Pour tester avec un serveur local : ?peerhost=localhost&peerport=9000
 */
export function peerOptions(): Record<string, unknown> {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const host = q.get('peerhost');
  if (!host) return { debug: 0 };
  return { debug: 0, host, port: Number(q.get('peerport') ?? 9000), path: q.get('peerpath') ?? '/', secure: q.get('peersecure') === '1' };
}
