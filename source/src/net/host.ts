import Peer, { type DataConnection } from 'peerjs';
import { GameEngine, GameError, buildView, type Command, type Difficulty, type Personality } from '../engine';
import { type ClientMsg, type HostMsg, type LobbyState, MAX_SEATS, OFFLINE_AFTER, PEER_PREFIX, PING_INTERVAL, peerOptions, randomCode, randomToken } from './protocol';

interface Remote {
  token: string;
  seat: number;
  conn: DataConnection | null;
  lastSeen: number;
}

/**
 * Session hôte : le navigateur de l'hôte fait tourner le moteur (et les bots)
 * et envoie à chaque joueur distant une vue filtrée de la partie.
 */
export class HostSession {
  engine: GameEngine | null = null;
  lobby: LobbyState;
  error: string | null = null;
  private remotes: Remote[] = [];
  private listeners = new Set<() => void>();
  private unsubscribeEngine: (() => void) | null = null;
  private watchdog: number;

  private constructor(private peer: Peer, code: string, hostName: string, settings: LobbyState['settings']) {
    this.lobby = { code, seats: [{ seat: 0, name: hostName, kind: 'host', connected: true }], settings, started: false, introId: null };
    peer.on('connection', (conn) => this.onConnection(conn));
    // Un joueur silencieux depuis trop longtemps est considéré comme déconnecté
    this.watchdog = window.setInterval(() => {
      const now = Date.now();
      for (const r of this.remotes) if (r.conn && now - r.lastSeen > OFFLINE_AFTER) this.onClose(r.conn);
    }, PING_INTERVAL);
    peer.on('disconnected', () => {
      // perte du serveur de signalisation : les connexions existantes restent actives
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      this.error = `Réseau : ${err.message}`;
      this.emit();
    });
  }

  /** Crée un salon avec un code libre. */
  static create(hostName: string, settings: LobbyState['settings']): Promise<HostSession> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const tryOpen = () => {
        const code = randomCode();
        const peer = new Peer(PEER_PREFIX + code, peerOptions());
        peer.once('open', () => resolve(new HostSession(peer, code, hostName, settings)));
        peer.once('error', (err) => {
          peer.destroy();
          if ((err as { type?: string }).type === 'unavailable-id' && ++attempts < 5) tryOpen();
          else reject(new Error(`Impossible de créer le salon (${err.message}). Vérifiez votre connexion Internet.`));
        });
      };
      tryOpen();
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  // ─────────────── Salon ───────────────

  addBot(name: string, personality: Personality | 'random'): void {
    if (this.lobby.started || this.lobby.seats.length >= MAX_SEATS) return;
    this.lobby.seats.push({ seat: this.lobby.seats.length, name, kind: 'bot', personality, connected: true });
    this.syncLobby();
  }

  removeSeat(seat: number): void {
    if (this.lobby.started || seat === 0) return;
    const removed = this.lobby.seats[seat];
    if (!removed) return;
    if (removed.kind === 'remote') {
      const r = this.remotes.find((x) => x.seat === seat);
      if (r?.conn) {
        this.send(r.conn, { t: 'closed', reason: "L'hôte vous a retiré du salon." });
        setTimeout(() => r.conn?.close(), 300);
      }
      this.remotes = this.remotes.filter((x) => x !== r);
    }
    this.lobby.seats.splice(seat, 1);
    this.lobby.seats.forEach((s, i) => (s.seat = i));
    for (const r of this.remotes) if (r.seat > seat) r.seat--;
    for (const r of this.remotes) if (r.conn) this.send(r.conn, { t: 'welcome', seat: r.seat, token: r.token });
    this.syncLobby();
  }

  setSettings(settings: Partial<LobbyState['settings']>): void {
    if (this.lobby.started) return;
    this.lobby.settings = { ...this.lobby.settings, ...settings };
    this.syncLobby();
  }

  start(introId: number): void {
    if (this.lobby.started) return;
    if (this.lobby.seats.length < 3) throw new GameError('Il faut au moins 3 naufragés (ajoutez des bots).');
    this.engine = new GameEngine(
      this.lobby.seats.map((s) => ({ name: s.name, isBot: s.kind === 'bot', personality: s.personality === 'random' ? undefined : s.personality })),
      { settings: this.lobby.settings },
    );
    this.lobby.started = true;
    this.lobby.introId = introId;
    this.unsubscribeEngine = this.engine.subscribe(() => this.broadcastViews());
    this.syncLobby();
    this.broadcastViews();
  }

  /** Commande jouée localement par l'hôte ou par un bot. */
  dispatch(cmd: Command): void {
    this.engine?.dispatch(cmd);
  }

  /** Un joueur déconnecté est remplacé par un bot (ou repris par lui à son retour). */
  replaceWithBot(seat: number): void {
    if (!this.engine) return;
    this.engine.setBot(seat, true);
    this.lobby.seats[seat].kind = 'bot';
    this.syncLobby();
  }

  close(): void {
    for (const r of this.remotes) if (r.conn) this.send(r.conn, { t: 'closed', reason: "L'hôte a quitté la partie." });
    this.unsubscribeEngine?.();
    window.clearInterval(this.watchdog);
    setTimeout(() => this.peer.destroy(), 300);
  }

  // ─────────────── Réseau ───────────────

  private onConnection(conn: DataConnection): void {
    conn.on('data', (raw) => this.onMessage(conn, raw as ClientMsg));
    conn.on('close', () => this.onClose(conn));
    conn.on('error', () => this.onClose(conn));
  }

  private onMessage(conn: DataConnection, msg: ClientMsg): void {
    if (msg.t === 'hello') {
      const known = msg.token ? this.remotes.find((r) => r.token === msg.token) : undefined;
      if (known) {
        known.conn = conn;
        known.lastSeen = Date.now();
        const seat = this.lobby.seats[known.seat];
        seat.connected = true;
        if (this.engine && seat.kind === 'bot' && this.engine.players[known.seat].alive) {
          // retour d'un joueur remplacé par un bot : il reprend la main
          seat.kind = 'remote';
          this.engine.setBot(known.seat, false);
        }
        this.send(conn, { t: 'welcome', seat: known.seat, token: known.token });
        this.syncLobby();
        this.broadcastViews();
        return;
      }
      if (this.lobby.started) {
        this.send(conn, { t: 'closed', reason: 'La partie a déjà commencé.' });
        return;
      }
      if (this.lobby.seats.length >= MAX_SEATS) {
        this.send(conn, { t: 'closed', reason: 'Le salon est complet.' });
        return;
      }
      const name = this.uniqueName((msg.name || 'Naufragé').trim().slice(0, 14));
      const seat = this.lobby.seats.length;
      const remote: Remote = { token: randomToken(), seat, conn, lastSeen: Date.now() };
      this.remotes.push(remote);
      this.lobby.seats.push({ seat, name, kind: 'remote', connected: true });
      this.send(conn, { t: 'welcome', seat, token: remote.token });
      this.syncLobby();
      return;
    }
    const remote = this.remotes.find((r) => r.conn === conn);
    if (!remote) return;
    remote.lastSeen = Date.now();
    if (msg.t === 'ping') return;
    if (msg.t === 'cmd' && this.engine) {
      if (this.lobby.seats[remote.seat]?.kind !== 'remote') return;
      try {
        this.engine.dispatch({ ...msg.cmd, playerId: remote.seat } as Command);
      } catch (e) {
        this.send(conn, { t: 'error', message: (e as Error).message });
      }
    } else if (msg.t === 'leave') {
      this.onClose(conn);
    }
  }

  private onClose(conn: DataConnection): void {
    const remote = this.remotes.find((r) => r.conn === conn);
    if (!remote) return;
    remote.conn = null;
    try {
      conn.close();
    } catch {
      /* déjà fermée */
    }
    if (!this.lobby.started) {
      this.remotes = this.remotes.filter((r) => r !== remote);
      this.removeSeat(remote.seat);
      return;
    }
    const seat = this.lobby.seats[remote.seat];
    if (seat) seat.connected = false;
    this.syncLobby();
  }

  private uniqueName(name: string): string {
    const taken = new Set(this.lobby.seats.map((s) => s.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) if (!taken.has(`${name} ${i}`.toLowerCase())) return `${name} ${i}`;
  }

  private send(conn: DataConnection, msg: HostMsg): void {
    try {
      if (conn.open) conn.send(msg);
    } catch {
      /* connexion perdue */
    }
  }

  private syncLobby(): void {
    for (const r of this.remotes) if (r.conn) this.send(r.conn, { t: 'lobby', lobby: this.lobby });
    this.emit();
  }

  private broadcastViews(): void {
    if (!this.engine) return;
    for (const r of this.remotes) if (r.conn) this.send(r.conn, { t: 'view', view: buildView(this.engine, r.seat) });
    this.emit();
  }
}

export type { Difficulty };
