import type { BagConfig, LogType, Personality, WeatherCard } from '../types';
import { DIFFICULTY } from '../GameEngine';
import { Deck, weatherCard } from '../Deck';
import { PLAYER_COLORS } from '../Player';
import { VoteSystem } from '../VoteSystem';
import { type Rng, createRng, pick, shuffle } from '../rng';
import { CHALLENGES, REGULAR_CHALLENGES, finalScore, type ChallengeState } from './challenges';
import { KL_ITEMS, REWARDS } from './items';
import type {
  ChallengeId,
  ChallengeInfo,
  ChallengeKind,
  KLAction,
  KLCommand,
  KLDecision,
  KLFx,
  KLItem,
  KLItemType,
  KLLogEntry,
  KLPlayerConfig,
  KLResult,
  KLSettings,
  KLVoteReason,
  KLVoteRecord,
  RewardId,
  TeamState,
} from './types';

export const KL_MAX_DISEASES = 3;
export const KL_MIN_PLAYERS = 4;
export const KL_MAX_PLAYERS = 16;
export const MAX_FORME = 10;

export const TEAM_PRESETS = [
  { name: 'Les Jaunes', color: '#facc15' },
  { name: 'Les Rouges', color: '#ef4444' },
  { name: 'Les Bleus', color: '#3b82f6' },
  { name: 'Les Verts', color: '#22c55e' },
];
export const MERGED_TEAM = { name: 'Les Réunifiés', color: '#f97316' };
export const SOLO_TEAM = { name: "L'île", color: '#a78bfa' };

const START_FORME = { facile: 8, normal: 7, difficile: 6 } as const;
const NO_FIRE_DISEASE_CHANCE = 0.12;
/** Bien nourri, désaltéré et au chaud : chance de guérir d'une maladie pendant la nuit. */
const HEALING_NIGHT_CHANCE = 0.4;
/** En forme (≥ ce seuil), une récolte réussie rapporte +1. */
export const FIT_THRESHOLD = 6;

type Phase = 'challenge' | 'action' | 'vote' | 'finalChoice' | 'gameover';

export class KLError extends Error {}

export class KLPlayer {
  alive = true;
  diseases = 0;
  forme: number;
  hand: KLItem[] = [];
  eliminatedDay?: number;
  eliminatedHow?: string;
  isJury = false;
  challengeWins = 0;

  constructor(
    public readonly id: number,
    public name: string,
    public isBot: boolean,
    public readonly personality: Personality,
    public readonly color: string,
    public readonly skin: number,
    public team: number,
    forme: number,
  ) {
    this.forme = forme;
  }

  /** Équipe d'origine (avant la réunification), pour l'affichage. */
  originalTeam = 0;

  has(type: KLItemType): boolean {
    return this.hand.some((c) => c.type === type);
  }
}

export class KohLantaEngine {
  readonly players: KLPlayer[];
  teams: TeamState[];
  readonly settings: KLSettings;
  readonly log: KLLogEntry[] = [];
  readonly voteHistory: KLVoteRecord[] = [];
  readonly startCount: number;

  day = 0;
  /** Jours « normaux » écoulés (cycle confort / immunité / conseil). */
  cycleDay = 0;
  weather: WeatherCard | null = null;
  merged: boolean;
  challenge: ChallengeInfo | null = null;
  lastChallengeResult: { game: ChallengeId; kind: ChallengeKind; ranking: number[]; winners: number[] } | null = null;
  immune = new Set<number>();
  councilTeam: number | null = null;
  jury: number[] = [];
  finalists: number[] = [];
  poteauxWinner: number | null = null;
  orientationDone = false;
  result: KLResult | null = null;

  private readonly rng: Rng;
  private readonly itemDeck: Deck<KLItem>;
  private readonly weatherDeck: Deck<WeatherCard> | null;
  private phase: Phase = 'challenge';
  private queue: number[] = [];
  private qIdx = 0;
  private vote: VoteSystem | null = null;
  private voteReason: KLVoteReason = 'water';
  private voteTeam = 0;
  private necklaces = new Set<number>();
  private deprived = new Map<string, Set<number>>();
  private lastGames: ChallengeId[] = [];
  private logCounter = 0;
  private listeners = new Set<() => void>();

  constructor(configs: KLPlayerConfig[], settings: Partial<KLSettings> = {}, seed = Date.now()) {
    if (configs.length < KL_MIN_PLAYERS || configs.length > KL_MAX_PLAYERS) throw new KLError(`Il faut entre ${KL_MIN_PLAYERS} et ${KL_MAX_PLAYERS} aventuriers.`);
    this.settings = { teams: 2, weather: true, difficulty: 'normal', ...settings };
    const n = configs.length;
    this.settings.teams = Math.max(1, Math.min(4, Math.floor(this.settings.teams), Math.floor(n / 2)));
    this.rng = createRng(seed);
    this.startCount = n;
    this.merged = this.settings.teams === 1;

    let counter = 0;
    const items: KLItem[] = [];
    for (const def of Object.values(KL_ITEMS)) for (let i = 0; i < def.copies; i++) items.push({ id: `k${++counter}`, type: def.type });
    this.itemDeck = new Deck(items, this.rng).shuffle();

    if (this.settings.weather) {
      const kinds = ['secheresse', 'secheresse', 'nuageux', 'nuageux', 'nuageux', 'nuageux', 'averse', 'averse', 'averse', 'deluge', 'deluge'] as const;
      this.weatherDeck = new Deck(kinds.map((k) => weatherCard(k)), this.rng).shuffle();
    } else {
      this.weatherDeck = null;
    }

    const personalities = ['cooperatif', 'egoiste', 'paranoiaque'] as const;
    const order = shuffle(this.rng, configs.map((_, i) => i));
    const teamOf = new Map(order.map((idx, k) => [idx, this.merged ? 0 : k % this.settings.teams]));
    const forme = START_FORME[this.settings.difficulty];
    this.players = configs.map((c, i) => {
      const p = new KLPlayer(i, c.name, c.isBot, c.personality ?? pick(this.rng, personalities), PLAYER_COLORS[i % PLAYER_COLORS.length], c.skin ?? i % 10, teamOf.get(i)!, forme);
      p.originalTeam = p.team;
      return p;
    });
    const presets = this.merged ? [SOLO_TEAM] : TEAM_PRESETS.slice(0, this.settings.teams);
    const bonus = { facile: 2, normal: 0, difficile: -1 }[this.settings.difficulty];
    this.teams = presets.map((t, id) => {
      const size = this.players.filter((p) => p.team === id).length;
      return { id, name: t.name, color: t.color, water: Math.max(2, 3 * size + 2 + bonus * size), food: Math.max(1, 3 * size + bonus * size), wood: 3, fire: false };
    });
    if (this.settings.difficulty === 'facile') for (const p of this.players) p.hand.push(this.itemDeck.draw()!);

    this.addLog(
      'info',
      this.merged
        ? `${n} aventuriers débarquent sur l'île. Ici, c'est chacun pour soi : un seul remportera l'aventure.`
        : `${n} aventuriers débarquent, répartis en ${this.teams.length} équipes : ${this.teams.map((t) => t.name).join(', ')}.`,
    );
    this.startDay();
  }

  // ─────────────── Lecture ───────────────

  get alivePlayers(): KLPlayer[] {
    return this.players.filter((p) => p.alive);
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  player(id: number): KLPlayer {
    const p = this.players[id];
    if (!p) throw new KLError(`Joueur inconnu : ${id}`);
    return p;
  }

  members(teamId: number): KLPlayer[] {
    return this.alivePlayers.filter((p) => p.team === teamId);
  }

  team(teamId: number): TeamState {
    return this.teams[teamId];
  }

  /** Composition du sac pour un joueur, selon la difficulté et sa forme. */
  bagFor(p: KLPlayer): BagConfig {
    const base = DIFFICULTY[this.settings.difficulty].bag;
    let white = base.white;
    let black = base.black;
    if (p.forme >= 8) white++;
    if (p.forme <= 3) black++;
    if (p.forme <= 1) black++;
    return { white, black, maxDraw: Math.min(6, white) };
  }

  /** Position dans le cycle de 3 jours : 1 confort, 2 immunité, 3 conseil (0 pour la finale). */
  get cyclePosition(): number {
    return this.isFinalStage ? 0 : ((this.cycleDay - 1) % 3) + 1;
  }

  get isFinalStage(): boolean {
    return this.challenge?.kind === 'orientation' || this.challenge?.kind === 'poteaux' || this.finalists.length > 0 || this.phase === 'finalChoice';
  }

  get decision(): KLDecision {
    switch (this.phase) {
      case 'gameover':
        return { kind: 'gameover' };
      case 'challenge':
        return { kind: 'challenge', challenge: this.challenge! };
      case 'action': {
        const p = this.player(this.queue[this.qIdx]);
        return { kind: 'action', playerId: p.id, teamId: p.team };
      }
      case 'vote': {
        const v = this.vote!;
        const voter = v.nextVoter()!;
        return {
          kind: 'vote',
          playerId: voter,
          candidates: v.candidatesFor(voter),
          reason: this.voteReason,
          teamId: this.voteTeam,
          canNecklace: this.voteReason === 'council' && this.player(voter).has('collier') && !this.necklaces.has(voter),
          remaining: this.voteReason === 'water' || this.voteReason === 'food' ? this.remainingFor(this.voteTeam, this.voteReason) : 1,
        };
      }
      case 'finalChoice':
        return { kind: 'finalChoice', playerId: this.poteauxWinner!, options: this.alivePlayers.filter((p) => p.id !== this.poteauxWinner).map((p) => p.id) };
    }
  }

  playableCards(playerId: number): KLItem[] {
    const d = this.decision;
    if (d.kind !== 'action' || d.playerId !== playerId) return [];
    const p = this.player(playerId);
    const team = this.team(p.team);
    return p.hand.filter((c) => {
      if (!KL_ITEMS[c.type].playable) return false;
      if (c.type === 'soins') return this.members(p.team).some((m) => m.diseases > 0);
      if (c.type === 'silex') return !team.fire && team.wood >= 1;
      return true;
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  setBot(playerId: number, isBot: boolean): void {
    this.player(playerId).isBot = isBot;
    this.emit();
  }

  // ─────────────── Commandes ───────────────

  dispatch(cmd: KLCommand): void {
    const d = this.decision;
    if (d.kind === 'gameover') throw new KLError('La partie est terminée.');
    if (d.kind === 'challenge') throw new KLError("L'épreuve est en cours.");
    if (cmd.playerId !== d.playerId) throw new KLError(`Ce n'est pas au tour de ${this.player(cmd.playerId).name}.`);
    if (d.kind === 'action') this.handleAction(cmd);
    else if (d.kind === 'vote') this.handleVote(cmd);
    else if (d.kind === 'finalChoice') this.handleFinalChoice(cmd);
    this.emit();
  }

  /** Résultats de l'épreuve en cours (envoyés par l'interface qui l'a fait jouer). */
  submitChallenge(states: Record<number, ChallengeState>): void {
    if (this.phase !== 'challenge' || !this.challenge) throw new KLError("Aucune épreuve en cours.");
    const ch = this.challenge;
    const def = CHALLENGES[ch.game];
    const score = (id: number) => finalScore(def, states[id] ?? { progress: 0, done: false, fallen: true, time: 0, score: 0 });
    const ranking = [...ch.participants].sort((a, b) => score(b) - score(a));
    for (const id of ch.participants) this.changeForme(this.player(id), -1);
    let winners: number[] = [];

    if (ch.teamMode) {
      const teamScores = this.teams
        .map((t) => {
          const ids = ch.participants.filter((id) => this.player(id).team === t.id);
          const avg = ids.length ? ids.reduce((s, id) => s + ranking.length - ranking.indexOf(id), 0) / ids.length : -1;
          return { t, avg, ids };
        })
        .filter((x) => x.ids.length > 0)
        .sort((a, b) => b.avg - a.avg);
      const best = teamScores[0];
      winners = best.ids;
      this.addLog('info', `🏆 ${best.t.name} remportent ${ch.kind === 'confort' ? "l'épreuve de confort" : "l'immunité"} ! (classement : ${teamScores.map((x) => x.t.name).join(' › ')})`, {
        fx: { kind: 'challenge', kind2: ch.kind, game: ch.game },
      });
      if (ch.kind === 'confort') {
        this.applyReward(ch.reward!, best.t.id, best.ids);
      } else {
        const last = teamScores[teamScores.length - 1];
        this.councilTeam = last.t.id;
        for (const x of teamScores.slice(0, -1)) for (const id of x.ids) this.immune.add(id);
        this.addLog('vote', `🔥 ${last.t.name} iront au conseil après-demain.`);
      }
    } else {
      const best = ranking[0];
      winners = [best];
      const bp = this.player(best);
      if (ch.kind === 'confort') {
        this.addLog('info', `🏆 ${bp.name} remporte l'épreuve de confort !`, { fx: { kind: 'challenge', kind2: ch.kind, game: ch.game } });
        this.applyReward(ch.reward!, bp.team, [best]);
      } else if (ch.kind === 'immunite') {
        this.immune.add(best);
        this.addLog('info', `📿 ${bp.name} remporte le collier d'immunité individuel !`, { fx: { kind: 'challenge', kind2: ch.kind, game: ch.game } });
      } else if (ch.kind === 'orientation') {
        const loser = ranking[ranking.length - 1];
        this.addLog('info', `🧭 ${bp.name} remporte la course d'orientation. ${this.player(loser).name} termine à la dernière place…`, { fx: { kind: 'challenge', kind2: ch.kind, game: ch.game } });
        this.orientationDone = true;
        this.eliminate(this.player(loser), "Dernière place à la course d'orientation");
      } else {
        this.poteauxWinner = best;
        this.addLog('info', `🪵 ${bp.name} remporte les poteaux ! À ${bp.name} de choisir son adversaire pour la finale.`, { fx: { kind: 'challenge', kind2: ch.kind, game: ch.game } });
      }
    }
    for (const id of winners) {
      this.changeForme(this.player(id), +2);
      this.player(id).challengeWins++;
    }
    this.lastChallengeResult = { game: ch.game, kind: ch.kind, ranking, winners };
    this.challenge = null;

    if (ch.kind === 'confort' || ch.kind === 'immunite') this.startCamp();
    else if (ch.kind === 'orientation') this.startDay();
    else this.phase = 'finalChoice';
    this.emit();
  }

  private handleAction(cmd: KLCommand): void {
    const p = this.player(cmd.playerId);
    const team = this.team(p.team);
    if (cmd.type === 'playCard') {
      const card = this.playableCards(p.id).find((c) => c.id === cmd.cardId);
      if (!card) throw new KLError('Cette carte ne peut pas être jouée maintenant.');
      this.applyItem(p, card, cmd.targetId);
      return;
    }
    if (cmd.type === 'give') {
      const target = this.player(cmd.targetId);
      if (!target.alive || target.id === p.id || target.team !== p.team) throw new KLError('On ne peut donner qu’à un coéquipier.');
      const idx = p.hand.findIndex((c) => c.id === cmd.cardId);
      if (idx < 0) throw new KLError('Carte introuvable.');
      const [card] = p.hand.splice(idx, 1);
      target.hand.push(card);
      const def = KL_ITEMS[card.type];
      this.addLog('card', `🎁 ${p.name} donne un objet à ${target.name}.`, { privateTo: target.id, privateText: `Vous recevez : ${def.emoji} ${def.name}` });
      return;
    }
    if (cmd.type !== 'action') throw new KLError(`Commande ${cmd.type} invalide pendant la vie de camp.`);

    switch (cmd.action) {
      case 'rest': {
        const healed = p.diseases > 0;
        if (healed) p.diseases--;
        this.changeForme(p, +2);
        this.addLog('action', `😴 ${p.name} se repose${healed ? ' et guérit d’une maladie' : ''} (+2 forme).`, { fx: { kind: 'rest', playerId: p.id } });
        break;
      }
      case 'jungle': {
        const card = this.itemDeck.draw();
        if (!card) {
          this.addLog('action', `${p.name} fouille la jungle sans rien trouver.`, { fx: { kind: 'jungle', playerId: p.id } });
          break;
        }
        p.hand.push(card);
        const def = KL_ITEMS[card.type];
        this.addLog('action', `🌴 ${p.name} fouille la jungle et revient avec quelque chose…`, { fx: { kind: 'jungle', playerId: p.id }, privateTo: p.id, privateText: `Vous trouvez : ${def.emoji} ${def.name}` });
        break;
      }
      case 'fire': {
        if (team.fire) throw new KLError('Le feu brûle déjà.');
        if (team.wood < 1) throw new KLError('Il faut au moins 1 bois pour allumer le feu.');
        if (cmd.success) {
          team.fire = true;
          team.wood--;
          this.changeForme(p, +1);
          this.addLog('action', `🔥 ${p.name} fait jaillir une flamme : le feu de ${team.name} est allumé !`, { fx: { kind: 'fire', playerId: p.id, success: true } });
        } else {
          this.changeForme(p, -1);
          this.addLog('danger', `💨 ${p.name} s'épuise à frotter les bâtons… le feu ne prend pas (-1 forme).`, { fx: { kind: 'fire', playerId: p.id, success: false } });
        }
        break;
      }
      case 'fish':
      case 'water':
      case 'wood':
        this.performDraw(p, cmd.action, cmd.draws ?? 1);
        break;
      default:
        throw new KLError(`Action inconnue : ${cmd.action as string}`);
    }
    this.nextActor();
  }

  private performDraw(p: KLPlayer, action: 'fish' | 'water' | 'wood', draws: number): void {
    const w = this.settings.weather ? this.weather : null;
    if (action === 'water' && w && !w.canCollect) throw new KLError("Soleil de plomb : impossible de recueillir de l'eau aujourd'hui.");
    const bag = this.bagFor(p);
    const k = Math.max(1, Math.min(bag.maxDraw, Math.floor(draws)));
    const balls = shuffle(this.rng, [...Array<'w'>(bag.white).fill('w'), ...Array<'b'>(bag.black).fill('b')]).slice(0, k) as ('w' | 'b')[];
    const label = { fish: 'la pêche', water: "la collecte d'eau", wood: 'la coupe du bois' }[action];
    if (balls.includes('b')) {
      this.changeForme(p, -1);
      this.addLog('danger', `⚫ ${p.name} tente ${label} (${k} boule${k > 1 ? 's' : ''})… boule noire ! Rien, et une maladie.`, { fx: { kind: 'draw', playerId: p.id, action, balls, gain: 0 } });
      this.addDisease(p, action === 'wood' ? 'Blessé dans la jungle' : action === 'fish' ? 'Piqué par une raie' : "Malade d'une eau croupie");
      return;
    }
    const tool = { fish: 'masque', water: 'bache', wood: 'machette' }[action] as KLItemType;
    const bonus = (p.has(tool) ? 1 : 0) + (action === 'water' && w ? w.waterBonus : 0) + (p.forme >= FIT_THRESHOLD ? 1 : 0);
    const gain = k + bonus;
    const team = this.team(p.team);
    team[{ fish: 'food', water: 'water', wood: 'wood' }[action] as 'food' | 'water' | 'wood'] += gain;
    const icon = { fish: '🐟', water: '💧', wood: '🪵' }[action];
    this.addLog('action', `⚪ ${p.name} pioche ${k} boule${k > 1 ? 's' : ''} blanche${k > 1 ? 's' : ''} : +${gain} ${icon}${bonus ? ` (dont +${bonus} bonus)` : ''}.`, {
      fx: { kind: 'draw', playerId: p.id, action, balls, gain },
    });
  }

  private applyItem(p: KLPlayer, card: KLItem, targetId?: number): void {
    const def = KL_ITEMS[card.type];
    const team = this.team(p.team);
    const fx: KLFx = { kind: 'card', playerId: p.id, item: card.type };
    switch (card.type) {
      case 'riz':
        team.food += 2;
        break;
      case 'fruits':
        team.food += 1;
        team.water += 1;
        break;
      case 'gourde':
        team.water += 2;
        break;
      case 'energie':
        this.changeForme(p, +3);
        break;
      case 'soins': {
        const target = targetId !== undefined ? this.player(targetId) : p.diseases > 0 ? p : this.members(p.team).find((m) => m.diseases > 0);
        if (!target || target.team !== p.team || target.diseases <= 0) throw new KLError('Il faut cibler un coéquipier malade.');
        target.diseases--;
        fx.targetId = target.id;
        break;
      }
      case 'silex':
        team.fire = true;
        team.wood--;
        break;
      default:
        throw new KLError(`${def.name} ne se joue pas ainsi.`);
    }
    p.hand = p.hand.filter((c) => c.id !== card.id);
    this.itemDeck.discard(card);
    this.addLog('card', `${p.name} utilise ${def.emoji} ${def.name}${card.type === 'silex' ? ' : le feu est allumé !' : '.'}`, { fx });
  }

  private applyReward(reward: RewardId, teamId: number, winners: number[]): void {
    const team = this.team(teamId);
    const r = REWARDS[reward];
    switch (reward) {
      case 'vivres':
        team.food += 4;
        team.water += 2;
        break;
      case 'peche':
        team.food += 3;
        this.player(winners[0]).hand.push({ id: `r${this.day}m`, type: 'masque' });
        break;
      case 'feu':
        team.wood += 3;
        this.player(winners[0]).hand.push({ id: `r${this.day}s`, type: 'silex' });
        break;
      case 'repos':
        for (const id of winners) this.changeForme(this.player(id), +3);
        break;
      case 'soins':
        for (const id of winners) {
          const w = this.player(id);
          if (w.diseases > 0) w.diseases--;
          this.changeForme(w, +1);
        }
        break;
      case 'eau':
        team.water += 5;
        break;
    }
    this.addLog('card', `🎁 Récompense : ${r.emoji} ${r.label} (${r.description}).`);
  }

  private handleVote(cmd: KLCommand): void {
    const v = this.vote!;
    const p = this.player(cmd.playerId);
    if (cmd.type === 'necklace') {
      if (this.voteReason !== 'council' || !p.has('collier')) throw new KLError("Pas de collier d'immunité à jouer.");
      p.hand = p.hand.filter((c) => c !== p.hand.find((x) => x.type === 'collier'));
      this.necklaces.add(p.id);
      this.addLog('vote', `📿 ${p.name} sort un collier d'immunité ! Les voix contre ${p.name} ne compteront pas.`, { fx: { kind: 'card', playerId: p.id, item: 'collier' } });
      return;
    }
    if (cmd.type !== 'vote') throw new KLError('Votez pour quelqu’un.');
    try {
      v.cast(p.id, cmd.targetId);
    } catch (e) {
      throw new KLError((e as Error).message);
    }
    this.addLog('vote', `🗳️ ${p.name} a voté.`, { fx: { kind: 'vote', playerId: p.id } });
    if (v.isComplete()) this.resolveVote();
  }

  private handleFinalChoice(cmd: KLCommand): void {
    if (cmd.type !== 'finalChoice') throw new KLError('Choisissez votre adversaire.');
    const d = this.decision;
    if (d.kind !== 'finalChoice' || !d.options.includes(cmd.targetId)) throw new KLError('Adversaire invalide.');
    const winner = this.player(this.poteauxWinner!);
    const opponent = this.player(cmd.targetId);
    const third = this.alivePlayers.find((p) => p.id !== winner.id && p.id !== opponent.id)!;
    this.addLog('info', `🤝 ${winner.name} choisit d'affronter ${opponent.name} devant le jury final.`);
    this.eliminate(third, 'Non choisi pour la finale');
    this.startJury([winner.id, opponent.id]);
  }

  // ─────────────── Déroulement ───────────────

  private startDay(): void {
    if (this.phase === 'gameover') return;
    this.day++;
    if (this.weatherDeck) {
      const w = this.weatherDeck.draw()!;
      this.weatherDeck.discard(w);
      this.weather = w;
    }
    this.checkMerge();
    const alive = this.alivePlayers.length;
    const weatherText = this.weather && this.settings.weather ? ` — ${this.weather.label}` : '';
    if (alive <= 1) {
      this.finish(this.alivePlayers[0]?.id ?? null, alive ? 'Dernier aventurier en lice.' : "Plus personne sur l'île.");
      return;
    }
    if (alive === 2) {
      this.addLog('day', `🌅 Jour ${this.day}${weatherText} : les deux derniers aventuriers font face au jury.`);
      this.startJury(this.alivePlayers.map((p) => p.id));
      return;
    }
    if (alive === 3) {
      this.addLog('day', `🌅 Jour ${this.day}${weatherText} : finale ! Place à l'épreuve des poteaux.`);
      this.startChallenge('poteaux');
      return;
    }
    if (alive === 4 && !this.orientationDone) {
      this.addLog('day', `🌅 Jour ${this.day}${weatherText} : les quatre derniers s'élancent pour la course d'orientation.`);
      this.startChallenge('orientation');
      return;
    }
    this.cycleDay++;
    const pos = this.cyclePosition;
    this.addLog('day', `🌅 Jour ${this.day}${weatherText} — ${pos === 1 ? 'épreuve de confort' : pos === 2 ? "épreuve d'immunité" : 'vie de camp, puis conseil'}.`);
    if (pos === 1) {
      this.immune.clear();
      this.councilTeam = null;
      this.startChallenge('confort');
    } else if (pos === 2) {
      this.startChallenge('immunite');
    } else {
      this.startCamp();
    }
  }

  private checkMerge(): void {
    if (this.merged) return;
    const teamsAlive = this.teams.filter((t) => this.members(t.id).length > 0);
    const mergeAt = Math.max(5, Math.ceil(this.startCount / 2));
    const tooSmall = teamsAlive.some((t) => this.members(t.id).length <= 1);
    if (this.alivePlayers.length > mergeAt && !tooSmall && teamsAlive.length > 1) return;
    const pooled: TeamState = { id: 0, name: MERGED_TEAM.name, color: MERGED_TEAM.color, water: 0, food: 0, wood: 0, fire: false };
    for (const t of this.teams) {
      pooled.water += t.water;
      pooled.food += t.food;
      pooled.wood += t.wood;
      pooled.fire ||= t.fire;
    }
    this.teams = [pooled];
    for (const p of this.alivePlayers) p.team = 0;
    this.merged = true;
    this.immune.clear();
    this.councilTeam = null;
    this.addLog('info', `🤝 RÉUNIFICATION ! Les ${this.alivePlayers.length} aventuriers restants forment une seule tribu. Désormais, c'est chacun pour soi.`);
  }

  private startChallenge(kind: ChallengeKind): void {
    let game: ChallengeId;
    if (kind === 'orientation') game = 'orientation';
    else if (kind === 'poteaux') game = 'poteaux';
    else {
      const pool = REGULAR_CHALLENGES.filter((g) => !this.lastGames.includes(g));
      game = pick(this.rng, pool.length ? pool : REGULAR_CHALLENGES);
      this.lastGames = [game, ...this.lastGames].slice(0, 2);
    }
    const teamMode = !this.merged && (kind === 'confort' || kind === 'immunite');
    const rewards = Object.keys(REWARDS) as RewardId[];
    this.challenge = {
      kind,
      game,
      participants: this.alivePlayers.map((p) => p.id),
      teamMode,
      seed: Math.floor(this.rng() * 1e9),
      reward: kind === 'confort' ? pick(this.rng, rewards) : undefined,
    };
    const def = CHALLENGES[game];
    this.addLog('info', `${def.emoji} Épreuve ${kind === 'confort' ? 'de confort' : kind === 'immunite' ? "d'immunité" : 'finale'} : ${def.name}${teamMode ? ' (par équipes)' : ''}.`, {
      fx: { kind: 'challenge', kind2: kind, game },
    });
    this.phase = 'challenge';
  }

  private startCamp(): void {
    const ordered = [...this.alivePlayers].sort((a, b) => a.team - b.team || a.id - b.id);
    this.queue = ordered.map((p) => p.id);
    this.qIdx = 0;
    this.phase = 'action';
    if (this.queue.length === 0) this.finish(null, "Plus personne sur l'île.");
  }

  private nextActor(): void {
    this.qIdx++;
    while (this.qIdx < this.queue.length && !this.player(this.queue[this.qIdx]).alive) this.qIdx++;
    if (this.phase === 'gameover') return;
    if (this.qIdx >= this.queue.length) this.evening();
  }

  private evening(): void {
    for (const team of this.teams) {
      if (this.members(team.id).length === 0) continue;
      if (team.fire && this.settings.weather && this.weather?.kind === 'deluge' && this.rng() < 0.5) {
        team.fire = false;
        this.addLog('danger', `🌧️ La pluie diluvienne éteint le feu de ${team.name} !`);
      } else if (team.fire) {
        if (team.wood >= 1) team.wood--;
        else {
          team.fire = false;
          this.addLog('danger', `🪵 Faute de bois, le feu de ${team.name} s'éteint.`);
        }
      }
    }
    this.deprived.clear();
    this.resolveNeeds();
  }

  private deprivedSet(teamId: number, res: 'water' | 'food'): Set<number> {
    const key = `${teamId}:${res}`;
    if (!this.deprived.has(key)) this.deprived.set(key, new Set());
    return this.deprived.get(key)!;
  }

  private remainingFor(teamId: number, res: 'water' | 'food'): number {
    const members = this.members(teamId);
    const already = members.filter((m) => this.deprivedSet(teamId, res).has(m.id)).length;
    return Math.max(0, members.length - this.team(teamId)[res] - already);
  }

  private resolveNeeds(): void {
    for (const team of this.teams) {
      for (const res of ['water', 'food'] as const) {
        const remaining = this.remainingFor(team.id, res);
        if (remaining <= 0) continue;
        const notDeprived = this.members(team.id).filter((m) => !this.deprivedSet(team.id, res).has(m.id));
        if (remaining >= notDeprived.length) {
          for (const m of notDeprived) this.deprivedSet(team.id, res).add(m.id);
          this.addLog('danger', `${team.name} n'ont ${res === 'water' ? "plus une goutte d'eau" : 'plus rien à manger'} pour personne ce soir…`);
          continue;
        }
        this.voteReason = res;
        this.voteTeam = team.id;
        this.addLog('vote', `🗳️ ${team.name} : il manque ${remaining} ${res === 'water' ? "portion(s) d'eau" : 'portion(s) de nourriture'}. Qui s'en passera ?`);
        this.startVote(this.members(team.id).map((m) => m.id), notDeprived.map((m) => m.id));
        return;
      }
    }
    this.applyConsumption();
  }

  private startVote(voters: number[], candidates: number[]): void {
    if (candidates.length === 1) {
      this.onDesignated(candidates[0], null);
      return;
    }
    this.vote = new VoteSystem(voters, candidates);
    this.phase = 'vote';
  }

  private resolveVote(): void {
    const v = this.vote!;
    const cancelled: number[] = [];
    const counts = new Map<number, number>();
    for (const c of v.candidates) counts.set(c, 0);
    for (const [voter, target] of v.ballots) {
      if (this.necklaces.has(target)) {
        cancelled.push(voter);
        continue;
      }
      counts.set(target, (counts.get(target) ?? 0) + 1);
    }
    let pool = [...counts.entries()].filter(([id]) => !this.necklaces.has(id));
    if (pool.length === 0) pool = [...counts.entries()];
    const max = Math.max(...pool.map(([, n]) => n));
    const leaders = pool.filter(([, n]) => n === max).map(([id]) => id);
    const victim = leaders.length > 1 ? pick(this.rng, leaders) : leaders[0];
    const reveal = [...v.ballots.entries()].map(([voter, target]) => `${this.player(voter).name} → ${this.player(target).name}`).join(', ');
    if (this.voteReason !== 'jury') this.addLog('vote', `Dépouillement : ${reveal}.`, { fx: this.voteReason === 'council' ? { kind: 'reveal', council: true } : undefined });
    if (leaders.length > 1 && this.voteReason !== 'jury') this.addLog('vote', `Égalité ! Tirage au sort : ${this.player(victim).name}.`);
    this.voteHistory.push({ day: this.day, reason: this.voteReason, teamId: this.voteTeam, ballots: v.ballotsRecord(), victimId: victim, cancelled: cancelled.length ? cancelled : undefined });
    this.vote = null;
    this.onDesignated(victim, leaders.length > 1 ? leaders : null);
  }

  private onDesignated(victimId: number, tied: number[] | null): void {
    const victim = this.player(victimId);
    if (this.voteReason === 'water' || this.voteReason === 'food') {
      this.deprivedSet(this.voteTeam, this.voteReason).add(victimId);
      this.addLog('vote', `${victim.name} se passera ${this.voteReason === 'water' ? "d'eau" : 'de nourriture'} cette nuit.`);
      this.resolveNeeds();
    } else if (this.voteReason === 'council') {
      this.necklaces.clear();
      this.addLog('death', `🔥 ${victim.name}, la tribu a parlé. Votre flamme s'éteint.`, { fx: { kind: 'eliminated', playerId: victim.id, how: 'Éliminé au conseil' } });
      this.eliminate(victim, 'Éliminé au conseil', true);
      this.startDay();
    } else {
      // jury final
      const votes = this.voteHistory.at(-1)!.ballots;
      const tally = (id: number) => Object.values(votes).filter((t) => t === id).length;
      let winner = victimId;
      if (tied && this.poteauxWinner !== null && tied.includes(this.poteauxWinner)) winner = this.poteauxWinner;
      this.addLog('vote', `Le jury a voté : ${this.finalists.map((id) => `${this.player(id).name} ${tally(id)} voix`).join(', ')}.`);
      this.finish(winner, `Élu par le jury final (${tally(winner)} voix sur ${Object.keys(votes).length}).`);
    }
  }

  private applyConsumption(): void {
    for (const team of this.teams) {
      const members = this.members(team.id);
      if (members.length === 0) continue;
      const dW = this.deprivedSet(team.id, 'water');
      const dF = this.deprivedSet(team.id, 'food');
      team.water = Math.max(0, team.water - members.filter((m) => !dW.has(m.id)).length);
      team.food = Math.max(0, team.food - members.filter((m) => !dF.has(m.id)).length);
      for (const m of members) {
        if (dW.has(m.id)) {
          this.changeForme(m, -2);
          this.addDisease(m, 'Déshydratation');
        }
        if (m.alive && dF.has(m.id)) {
          this.changeForme(m, -2);
          this.addDisease(m, 'Épuisé par la faim');
        }
        if (!m.alive) continue;
        if (!team.fire) {
          this.changeForme(m, -1);
          if (this.rng() < NO_FIRE_DISEASE_CHANCE) this.addDisease(m, 'Malade faute de feu');
        } else if (!dW.has(m.id) && !dF.has(m.id)) {
          this.changeForme(m, +1);
          if (m.diseases > 0 && this.rng() < HEALING_NIGHT_CHANCE) {
            m.diseases--;
            this.addLog('info', `🌿 Nuit réparatrice pour ${m.name}, qui guérit d'une maladie.`);
          }
        }
      }
      this.addLog('info', `🌙 ${team.name} : nuit ${team.fire ? 'au coin du feu 🔥' : 'sans feu, eau non bouillie 🥶'}.`);
    }
    this.deprived.clear();
    if (this.alivePlayers.length <= 1 && !this.finalists.length) {
      this.finish(this.alivePlayers[0]?.id ?? null, this.alivePlayers.length ? 'Dernier aventurier en lice.' : "Plus personne sur l'île.");
      return;
    }
    if (this.cyclePosition === 3) this.startCouncil();
    else this.startDay();
  }

  private startCouncil(): void {
    let voters: number[];
    let candidates: number[];
    if (this.merged) {
      voters = this.alivePlayers.map((p) => p.id);
      candidates = voters.filter((id) => !this.immune.has(id));
      this.voteTeam = 0;
    } else {
      const teamId = this.councilTeam ?? this.teams.reduce((a, b) => (this.members(a.id).length >= this.members(b.id).length ? a : b)).id;
      voters = this.members(teamId).map((p) => p.id);
      candidates = voters;
      this.voteTeam = teamId;
    }
    if (voters.length <= 1 || candidates.length === 0) {
      this.addLog('vote', 'Pas de conseil ce soir : trop peu de votants.');
      this.startDay();
      return;
    }
    this.voteReason = 'council';
    this.necklaces.clear();
    this.addLog('vote', `🔥 Conseil ${this.merged ? 'de la tribu réunifiée' : `de ${this.team(this.voteTeam).name}`}. ${this.immune.size && this.merged ? `${[...this.immune].map((id) => this.player(id).name).join(', ')} a l'immunité.` : ''}`);
    this.startVote(voters, candidates);
  }

  private startJury(finalists: number[]): void {
    this.finalists = finalists;
    const jurors = this.jury.filter((id) => !finalists.includes(id));
    if (jurors.length === 0) {
      const winner = this.poteauxWinner ?? pick(this.rng, finalists);
      this.finish(winner, 'Aucun juré : le vainqueur des poteaux l’emporte.');
      return;
    }
    this.voteReason = 'jury';
    this.voteTeam = 0;
    this.addLog('vote', `⚖️ Le jury final (${jurors.length} membres) doit choisir entre ${finalists.map((id) => this.player(id).name).join(' et ')}.`);
    this.vote = new VoteSystem(jurors, finalists);
    this.phase = 'vote';
  }

  private eliminate(p: KLPlayer, how: string, alreadyLogged = false): void {
    if (!p.alive) return;
    p.alive = false;
    p.eliminatedDay = this.day;
    p.eliminatedHow = how;
    if (this.merged) {
      p.isJury = true;
      this.jury.push(p.id);
    }
    if (!alreadyLogged) this.addLog('death', `🔥 ${p.name} quitte l'aventure (${how.toLowerCase()}).`, { fx: { kind: 'eliminated', playerId: p.id, how } });
    const cards = p.hand.splice(0);
    const mates = this.members(p.team);
    if (cards.length && mates.length) shuffle(this.rng, cards).forEach((c, i) => mates[i % mates.length].hand.push(c));
  }

  private addDisease(p: KLPlayer, cause: string): void {
    if (!p.alive) return;
    p.diseases++;
    if (p.diseases >= KL_MAX_DISEASES) {
      this.addLog('death', `🚑 L'équipe médicale doit évacuer ${p.name} (${cause.toLowerCase()}) : fin de l'aventure.`, { fx: { kind: 'eliminated', playerId: p.id, how: 'Abandon médical' } });
      this.eliminate(p, 'Abandon médical', true);
    } else {
      this.addLog('danger', `🤒 ${p.name} tombe malade (${p.diseases}/${KL_MAX_DISEASES}).`, { fx: { kind: 'disease', playerId: p.id, diseases: p.diseases } });
    }
  }

  private changeForme(p: KLPlayer, delta: number): void {
    p.forme = Math.max(0, Math.min(MAX_FORME, p.forme + delta));
  }

  private finish(winnerId: number | null, reason: string): void {
    this.phase = 'gameover';
    const juryVotes: Record<number, number> = {};
    const last = this.voteHistory.at(-1);
    if (last?.reason === 'jury') for (const t of Object.values(last.ballots)) juryVotes[t] = (juryVotes[t] ?? 0) + 1;
    this.result = { winnerId, finalists: [...this.finalists], juryVotes, reason };
    this.addLog(winnerId !== null ? 'victory' : 'defeat', winnerId !== null ? `🏆 ${this.player(winnerId).name} remporte l'aventure ! ${reason}` : `☠️ ${reason}`);
  }

  private addLog(type: LogType, text: string, extra: Partial<KLLogEntry> = {}): void {
    this.log.push({ id: ++this.logCounter, day: this.day, type, text, ...extra });
  }
}

export type { KLAction };
