import Peer, { type DataConnection } from 'peerjs';
import type { Command, GameView } from '../engine';
import type { ChallengeState, KLCommand, KLView } from '../engine/kohlanta';
import { type ClientMsg, type HostMsg, type LobbyState, PEER_PREFIX, PING_INTERVAL, peerOptions } from './protocol';

export type ClientStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

const tokenKey = (code: string) => `naufrages.token.${code}`;

/** Session d'un joueur distant : reçoit le salon puis sa vue de la partie. */
export class ClientSession {
  status: ClientStatus = 'connecting';
  seat: number | null = null;
  lobby: LobbyState | null = null;
  view: GameView | KLView | null = null;
  challenge: Extract<HostMsg, { t: 'ch' }> | null = null;
  error: string | null = null;
  closedReason: string | null = null;
  private conn: DataConnection | null = null;
  private listeners = new Set<() => void>();
  private retries = 0;
  private pinger: number;
  private onPageHide = () => this.sendRaw({ t: 'leave' });

  constructor(
    readonly code: string,
    private name: string,
    private skin = 0,
    private peer: Peer = new Peer(peerOptions()),
  ) {
    peer.on('open', () => this.connect());
    this.pinger = window.setInterval(() => this.sendRaw({ t: 'ping' }), PING_INTERVAL);
    window.addEventListener('pagehide', this.onPageHide);
    peer.on('error', (err) => {
      const type = (err as { type?: string }).type;
      if (type === 'peer-unavailable') {
        if (this.status === 'connecting') this.close('Aucun salon avec ce code. Vérifiez le code ou demandez à l\'hôte s\'il est toujours là.');
        else this.scheduleReconnect();
      } else {
        this.error = `Réseau : ${err.message}`;
        this.emit();
      }
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private connect(): void {
    const conn = this.peer.connect(PEER_PREFIX + this.code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    conn.on('open', () => {
      this.retries = 0;
      let token: string | undefined;
      try {
        token = localStorage.getItem(tokenKey(this.code)) ?? undefined;
      } catch {
        /* ignore */
      }
      this.sendRaw({ t: 'hello', name: this.name, token, skin: this.skin });
    });
    conn.on('data', (raw) => this.onMessage(raw as HostMsg));
    conn.on('close', () => {
      if (this.status !== 'closed') this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.status === 'closed') return;
    if (++this.retries > 8) {
      this.close("Connexion perdue avec l'hôte.");
      return;
    }
    this.status = 'reconnecting';
    this.emit();
    setTimeout(() => {
      if (this.status === 'closed') return;
      if (this.peer.disconnected) this.peer.reconnect();
      this.connect();
    }, 1500 * this.retries);
  }

  private onMessage(msg: HostMsg): void {
    switch (msg.t) {
      case 'welcome':
        this.seat = msg.seat;
        this.status = 'connected';
        try {
          localStorage.setItem(tokenKey(this.code), msg.token);
        } catch {
          /* ignore */
        }
        break;
      case 'lobby':
        this.lobby = msg.lobby;
        break;
      case 'view':
        this.view = msg.view;
        if ('mode' in msg.view && msg.view.decision.kind !== 'challenge') this.challenge = null;
        break;
      case 'ch':
        this.challenge = msg;
        break;
      case 'error':
        this.error = msg.message;
        break;
      case 'closed':
        this.close(msg.reason);
        return;
    }
    this.emit();
  }

  setSkin(skin: number): void {
    this.skin = skin;
    this.sendRaw({ t: 'skin', skin });
  }

  sendChallengeState(seed: number, state: ChallengeState): void {
    this.sendRaw({ t: 'ch-state', seed, state });
  }

  send(cmd: Command | KLCommand): void {
    this.error = null;
    this.sendRaw({ t: 'cmd', cmd });
  }

  private sendRaw(msg: ClientMsg): void {
    if (this.conn?.open) this.conn.send(msg);
  }

  close(reason: string): void {
    window.clearInterval(this.pinger);
    window.removeEventListener('pagehide', this.onPageHide);
    this.status = 'closed';
    this.closedReason = reason;
    this.emit();
  }

  leave(): void {
    this.sendRaw({ t: 'leave' });
    window.clearInterval(this.pinger);
    window.removeEventListener('pagehide', this.onPageHide);
    this.status = 'closed';
    setTimeout(() => this.peer.destroy(), 300);
  }
}
