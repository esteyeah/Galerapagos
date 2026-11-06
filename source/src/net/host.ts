import Peer, { type DataConnection } from 'peerjs';
import { GameEngine, GameError, buildView, type Command, type Personality } from '../engine';
import { KohLantaEngine, buildKLView, type ChallengeState, type KLCommand } from '../engine/kohlanta';
import {
  type ClientMsg,
  type HostMsg,
  type LobbyState,
  OFFLINE_AFTER,
  PEER_PREFIX,
  PING_INTERVAL,
  maxSeats,
  peerOptions,
  randomCode,
  randomToken,
} from './protocol';

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
  engine: GameEngine | KohLantaEngine | null = null;
  lobby: LobbyState;
  error: string | null = null;
  /** États envoyés par les joueurs distants pendant une épreuve Koh Lanta. */
  readonly remoteChallenge = new Map<number, { seed: number; state: ChallengeState }>();
  private remotes: Remote[] = [];
  private listeners = new Set<() => void>();
  private unsubscribeEngine: (() => void) | null = null;
  private watchdog: number;

  private constructor(private peer: Peer, code: string, hostName: string, hostSkin: number, settings: LobbyState['settings']) {
    this.lobby = { code, seats: [{ seat: 0, name: hostName, kind: 'host', connected: true, skin: hostSkin }], settings, started: false, introId: null };
    peer.on('connection', (conn) => this.onConnection(conn));
    this.watchdog = window.setInterval(() => {
      const now = Date.now();
      for (const r of this.remotes) if (r.conn && now - r.lastSeen > OFFLINE_AFTER) this.onClose(r.conn);
    }, PING_INTERVAL);
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('error', (err) => {
      this.error = `Réseau : ${err.message}`;
      this.emit();
    });
  }

  static create(hostName: string, hostSkin: number, settings: LobbyState['settings']): Promise<HostSession> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const tryOpen = () => {
        const code = randomCode();
        const peer = new Peer(PEER_PREFIX + code, peerOptions());
        peer.once('open', () => resolve(new HostSession(peer, code, hostName, hostSkin, settings)));
        peer.once('error', (err) => {
          peer.destroy();
          if ((err as { type?: string }).type === 'unavailable-id' && ++attempts < 5) tryOpen();
          else reject(new Error(`Impossible de créer le salon (${err.message}). Vérifiez votre connexion Internet.`));
        });
      };
      tryOpen();
    });
  }

  get isKL(): boolean {
    return this.engine instanceof KohLantaEngine;
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
    if (this.lobby.started || this.lobby.seats.length >= maxSeats(this.lobby.settings.mode)) return;
    const seat = this.lobby.seats.length;
    this.lobby.seats.push({ seat, name, kind: 'bot', personality, connected: true, skin: (seat * 3) % 10 });
    this.syncLobby();
  }

  setSkin(seat: number, skin: number): void {
    if (this.lobby.started || !this.lobby.seats[seat]) return;
    this.lobby.seats[seat].skin = skin;
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
        const c = r.conn;
        setTimeout(() => c.close(), 300);
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
    // en passant en mode survie, on retire les places en trop (bots d'abord)
    while (this.lobby.seats.length > maxSeats(this.lobby.settings.mode)) {
      const bot = [...this.lobby.seats].reverse().find((s) => s.kind === 'bot');
      if (!bot) break;
      this.removeSeat(bot.seat);
    }
    this.syncLobby();
  }

  start(introId: number): void {
    if (this.lobby.started) return;
    const st = this.lobby.settings;
    const min = st.mode === 'kohlanta' ? 4 : 3;
    if (this.lobby.seats.length < min) throw new GameError(`Il faut au moins ${min} joueurs (ajoutez des bots).`);
    if (this.lobby.seats.length > maxSeats(st.mode)) throw new GameError('Trop de joueurs pour ce mode.');
    const configs = this.lobby.seats.map((s) => ({ name: s.name, isBot: s.kind === 'bot', skin: s.skin, personality: s.personality === 'random' ? undefined : s.personality }));
    this.engine =
      st.mode === 'kohlanta'
        ? new KohLantaEngine(configs, { teams: st.klTeams, weather: st.klWeather, difficulty: st.difficulty })
        : new GameEngine(configs, { settings: { difficulty: st.difficulty, weather: st.weather } });
    this.lobby.started = true;
    this.lobby.introId = introId;
    this.unsubscribeEngine = this.engine.subscribe(() => this.broadcastViews());
    this.syncLobby();
    this.broadcastViews();
  }

  /** Commande jouée localement par l'hôte ou par un bot. */
  dispatch(cmd: Command | KLCommand): void {
    if (!this.engine) return;
    if (this.engine instanceof KohLantaEngine) this.engine.dispatch(cmd as KLCommand);
    else this.engine.dispatch(cmd as Command);
  }

  replaceWithBot(seat: number): void {
    if (!this.engine) return;
    this.engine.setBot(seat, true);
    this.lobby.seats[seat].kind = 'bot';
    this.syncLobby();
  }

  /** Diffuse l'état en direct d'une épreuve (Koh Lanta) à tous les invités. */
  broadcastChallenge(msg: Extract<HostMsg, { t: 'ch' }>): void {
    for (const r of this.remotes) if (r.conn) this.send(r.conn, msg);
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
        const p = this.engine?.players[known.seat];
        if (this.engine && seat.kind === 'bot' && p?.alive) {
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
      if (this.lobby.seats.length >= maxSeats(this.lobby.settings.mode)) {
        this.send(conn, { t: 'closed', reason: 'Le salon est complet.' });
        return;
      }
      const name = this.uniqueName((msg.name || 'Naufragé').trim().slice(0, 14));
      const seat = this.lobby.seats.length;
      const remote: Remote = { token: randomToken(), seat, conn, lastSeen: Date.now() };
      this.remotes.push(remote);
      this.lobby.seats.push({ seat, name, kind: 'remote', connected: true, skin: msg.skin ?? seat % 10 });
      this.send(conn, { t: 'welcome', seat, token: remote.token });
      this.syncLobby();
      return;
    }
    const remote = this.remotes.find((r) => r.conn === conn);
    if (!remote) return;
    remote.lastSeen = Date.now();
    switch (msg.t) {
      case 'ping':
        return;
      case 'skin':
        this.setSkin(remote.seat, msg.skin);
        return;
      case 'ch-state':
        this.remoteChallenge.set(remote.seat, { seed: msg.seed, state: msg.state });
        return;
      case 'leave':
        this.onClose(conn);
        return;
      case 'cmd':
        if (!this.engine || this.lobby.seats[remote.seat]?.kind !== 'remote') return;
        try {
          this.dispatch({ ...msg.cmd, playerId: remote.seat } as Command | KLCommand);
        } catch (e) {
          this.send(conn, { t: 'error', message: (e as Error).message });
        }
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
    const engine = this.engine;
    if (!engine) return;
    for (const r of this.remotes) {
      if (!r.conn) continue;
      this.send(r.conn, { t: 'view', view: engine instanceof KohLantaEngine ? buildKLView(engine, r.seat) : buildView(engine, r.seat) });
    }
    this.emit();
  }
}
