import type {
  ActionKind,
  BagConfig,
  BoatState,
  Card,
  Command,
  Decision,
  Difficulty,
  GameOptions,
  GameResult,
  GameSettings,
  LogEntry,
  LogFx,
  LogType,
  NeedsReason,
  PlayerConfig,
  ResourceAction,
  Resources,
  VoteReason,
  VoteRecord,
  WeatherCard,
} from './types';
import { CARD_DEFS, CONTRIBUTION_VALUE, WOOD_PER_PLACE, canPlayIn } from './cards';
import { Deck, HURRICANE_WINDOW, createWeatherDeck, createWreckDeck, weatherCard } from './Deck';
import { MAX_DISEASES, PLAYER_COLORS, Player } from './Player';
import { VoteSystem } from './VoteSystem';
import { type Rng, createRng, pick, shuffle } from './rng';

type Phase = 'action' | 'trade' | 'contribute' | 'vote' | 'shield' | 'flee' | 'gameover';

export const DIFFICULTY: Record<Difficulty, { label: string; bag: BagConfig; stockPerPlayer: number; stockBonus: number; startCards: number }> = {
  facile: { label: 'Facile', bag: { white: 7, black: 1, maxDraw: 6 }, stockPerPlayer: 3, stockBonus: 2, startCards: 3 },
  normal: { label: 'Normal', bag: { white: 6, black: 1, maxDraw: 6 }, stockPerPlayer: 2.5, stockBonus: 3, startCards: 2 },
  difficile: { label: 'Difficile', bag: { white: 10, black: 2, maxDraw: 6 }, stockPerPlayer: 2.5, stockBonus: 3, startCards: 1 },
};

export const MAX_TRADES_PER_TURN = 2;

const RESOURCE_OF: Record<ResourceAction, keyof Resources> = { fish: 'food', water: 'water', wood: 'wood' };
const TOOL_OF: Record<ResourceAction, 'canne' | 'bache' | 'hache'> = { fish: 'canne', water: 'bache', wood: 'hache' };

/** Probabilité de ne tirer que des boules blanches en piochant `k` boules. */
export function successChance(bag: BagConfig, k: number): number {
  let p = 1;
  const total = bag.white + bag.black;
  for (let i = 0; i < k; i++) p *= (bag.white - i) / (total - i);
  return Math.max(0, p);
}

export class GameError extends Error {}

/**
 * Moteur de jeu : machine à états entièrement indépendante de l'interface.
 * À tout moment, `decision` indique qui doit agir et comment ; on avance
 * la partie en appelant `dispatch(command)`.
 */
export class GameEngine {
  readonly players: Player[];
  readonly resources: Resources;
  readonly boat: BoatState = { hull: false, tape: false };
  readonly log: LogEntry[] = [];
  readonly voteHistory: VoteRecord[] = [];
  readonly settings: GameSettings;
  readonly bag: BagConfig;
  readonly hurricaneWindow: [number, number] | null;

  day = 0;
  weather: WeatherCard | null = null;
  lastDay = false;
  result: GameResult | null = null;

  private readonly rng: Rng;
  private readonly weatherDeck: Deck<WeatherCard> | null;
  private readonly wreckDeck: Deck<Card>;
  private phase: Phase = 'action';
  private firstPlayerId = 0;
  private queue: number[] = [];
  private qIdx = 0;
  private extraActions = 0;
  private tradesLeft = MAX_TRADES_PER_TURN;
  private pendingTrade: { fromId: number; toId: number; cardId: string } | null = null;
  private needsReason: NeedsReason = 'consumption';
  private vote: VoteSystem | null = null;
  private voteReason: VoteReason = 'water';
  private protectedIds = new Set<number>();
  private deprived = { water: new Set<number>(), food: new Set<number>() };
  private pendingShield: { playerId: number; source: 'vote' | 'shot'; attackerId?: number } | null = null;
  private fleeVotes = new Map<number, boolean>();
  private logCounter = 0;
  /** Cartes météo vues grâce à la longue-vue (par joueur). */
  readonly peeks = new Map<number, { day: number; cards: WeatherCard[] }>();
  private listeners = new Set<() => void>();

  constructor(configs: PlayerConfig[], options: GameOptions = {}) {
    if (configs.length < 3 || configs.length > 8) throw new GameError('Il faut entre 3 et 8 joueurs.');
    this.settings = { difficulty: 'normal', weather: true, ...options.settings };
    const diff = DIFFICULTY[this.settings.difficulty];
    this.bag = { ...diff.bag };
    this.rng = createRng(options.seed ?? Date.now());
    this.hurricaneWindow = this.settings.weather ? HURRICANE_WINDOW[this.settings.difficulty] : null;
    this.weatherDeck = this.hurricaneWindow ? createWeatherDeck(this.rng, ...this.hurricaneWindow) : null;
    this.wreckDeck = createWreckDeck(this.rng, this.settings.weather);

    const personalities = ['cooperatif', 'egoiste', 'paranoiaque'] as const;
    this.players = configs.map(
      (c, i) => new Player(i, c.name, c.isBot, c.personality ?? pick(this.rng, personalities), PLAYER_COLORS[i % PLAYER_COLORS.length]),
    );
    const n = this.players.length;
    const stock = Math.round(n * diff.stockPerPlayer) + diff.stockBonus;
    this.resources = { water: stock, food: stock, wood: 0 };

    this.addLog(
      'info',
      this.hurricaneWindow
        ? `${n} naufragés sur une île déserte. Un ouragan frappera entre le jour ${this.hurricaneWindow[0]} et le jour ${this.hurricaneWindow[1]}.`
        : `${n} naufragés sur une île déserte. Pas d'ouragan à l'horizon : seuls l'évasion… ou la mort mettront fin à l'aventure.`,
    );
    for (let k = 0; k < diff.startCards; k++) for (const p of this.players) p.addCard(this.wreckDeck.draw()!);
    if (diff.startCards > 0) this.addLog('info', `Chacun a récupéré ${diff.startCards > 1 ? `${diff.startCards} objets` : 'un objet'} sur la plage.`);
    this.firstPlayerId = Math.floor(this.rng() * n);
    this.startDay();
  }

  // ───────────────────────────── Lecture de l'état ─────────────────────────────

  get alivePlayers(): Player[] {
    return this.players.filter((p) => p.alive);
  }

  get currentPhase(): Phase {
    return this.phase;
  }

  get wreckRemaining(): number {
    return this.wreckDeck.size;
  }

  /** Places disponibles sur le radeau (4 bois par place + bateau réparé). */
  get places(): number {
    return Math.floor(this.resources.wood / WOOD_PER_PLACE) + (this.boat.hull && this.boat.tape ? 1 : 0);
  }

  player(id: number): Player {
    const p = this.players[id];
    if (!p) throw new GameError(`Joueur inconnu : ${id}`);
    return p;
  }

  /** Conditions remplies pour quitter l'île maintenant ? */
  canFlee(): boolean {
    const n = this.alivePlayers.length;
    return n > 0 && this.places >= n && this.resources.water >= n && this.resources.food >= n;
  }

  get decision(): Decision {
    switch (this.phase) {
      case 'gameover':
        return { kind: 'gameover' };
      case 'action':
        return { kind: 'action', playerId: this.queue[this.qIdx], extraActions: this.extraActions, tradesLeft: this.tradesLeft };
      case 'trade': {
        const t = this.pendingTrade!;
        return { kind: 'trade', playerId: t.toId, fromId: t.fromId, offered: { ...this.player(t.fromId).getCard(t.cardId)! } };
      }
      case 'contribute':
        return { kind: 'contribute', playerId: this.queue[this.qIdx], reason: this.needsReason, ...this.shortages() };
      case 'vote': {
        const v = this.vote!;
        const voter = v.nextVoter()!;
        return {
          kind: 'vote',
          playerId: voter,
          candidates: v.candidatesFor(voter),
          allCandidates: [...v.candidates],
          canShoot: this.player(voter).canShoot(),
          reason: this.voteReason,
          remaining: this.remainingVictims(),
        };
      }
      case 'shield':
        return { kind: 'shield', ...this.pendingShield!, reason: this.voteReason };
      case 'flee':
        return { kind: 'flee', playerId: this.queue[this.qIdx] };
    }
  }

  /** Cartes que le joueur peut jouer pour la décision en cours. */
  playableCards(playerId: number): Card[] {
    const d = this.decision;
    if (d.kind === 'gameover' || d.playerId !== playerId) return [];
    const p = this.player(playerId);
    if (d.kind === 'action') {
      return p.hand.filter((c) => {
        if (!canPlayIn(c.type, 'turn')) return false;
        if (c.type === 'soins') return this.alivePlayers.some((o) => o.sick);
        if (c.type === 'longuevue') return !!this.weatherDeck;
        if (c.type === 'bateau') return !this.boat.hull;
        if (c.type === 'scotch') return !this.boat.tape;
        return true;
      });
    }
    if (d.kind === 'contribute') {
      const ctx = d.reason === 'departure' ? 'departure' : 'contribute';
      return p.hand.filter((c) => canPlayIn(c.type, ctx) && !(c.type === 'bateau' && this.boat.hull) && !(c.type === 'scotch' && this.boat.tape));
    }
    return [];
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Remplace un joueur humain par un bot (ex : déconnexion en ligne). */
  setBot(playerId: number, isBot: boolean): void {
    this.player(playerId).isBot = isBot;
    this.listeners.forEach((fn) => fn());
  }

  // ───────────────────────────── Commandes ─────────────────────────────

  dispatch(cmd: Command): void {
    if (cmd.type === 'reveal') {
      this.handleReveal(cmd.playerId, cmd.cardId);
      this.listeners.forEach((fn) => fn());
      return;
    }
    const d = this.decision;
    if (d.kind === 'gameover') throw new GameError('La partie est terminée.');
    if (cmd.playerId !== d.playerId) throw new GameError(`Ce n'est pas au tour de ${this.player(cmd.playerId).name}.`);

    switch (d.kind) {
      case 'action':
        this.handleActionPhase(cmd);
        break;
      case 'trade':
        this.handleTradeAnswer(cmd);
        break;
      case 'contribute':
        this.handleContribute(cmd);
        break;
      case 'vote':
        this.handleVote(cmd);
        break;
      case 'shield':
        this.handleShield(cmd);
        break;
      case 'flee':
        this.handleFlee(cmd);
        break;
    }
    this.listeners.forEach((fn) => fn());
  }

  private handleReveal(playerId: number, cardId: string): void {
    const p = this.player(playerId);
    if (!p.alive) throw new GameError('Un joueur mort ne peut plus montrer de cartes.');
    const card = p.getCard(cardId);
    if (!card) throw new GameError('Carte introuvable.');
    if (card.revealed) return;
    card.revealed = true;
    const def = CARD_DEFS[card.type];
    this.addLog('card', `👁️ ${p.name} montre une carte à tout le monde : ${def.emoji} ${def.name}.`, { fx: { kind: 'card', playerId, cardType: card.type } });
  }

  private handleActionPhase(cmd: Command): void {
    const p = this.player(cmd.playerId);
    switch (cmd.type) {
      case 'playCard': {
        const card = this.requirePlayable(p, cmd.cardId);
        this.applyCard(p, card, cmd.targetId);
        return;
      }
      case 'give': {
        const target = this.requireOther(p, cmd.targetId);
        const card = p.removeCard(cmd.cardId);
        if (!card) throw new GameError('Carte introuvable.');
        target.addCard(card);
        const def = CARD_DEFS[card.type];
        this.addLog(
          'card',
          card.revealed ? `🎁 ${p.name} donne ${def.emoji} ${def.name} à ${target.name}.` : `🎁 ${p.name} donne une carte à ${target.name}.`,
          { privateTo: target.id, privateText: `Vous recevez : ${def.emoji} ${def.name}`, fx: { kind: 'give', playerId: p.id, targetId: target.id, trade: false } },
        );
        return;
      }
      case 'proposeTrade': {
        if (this.tradesLeft <= 0) throw new GameError('Vous avez déjà proposé assez d\'échanges ce tour-ci.');
        const target = this.requireOther(p, cmd.targetId);
        if (!p.getCard(cmd.cardId)) throw new GameError('Carte introuvable.');
        if (target.hand.length === 0) throw new GameError(`${target.name} n'a aucune carte à échanger.`);
        this.tradesLeft--;
        this.pendingTrade = { fromId: p.id, toId: target.id, cardId: cmd.cardId };
        this.phase = 'trade';
        this.addLog('card', `🤝 ${p.name} propose un échange à ${target.name}…`);
        return;
      }
      case 'rest': {
        if (p.diseases > 0) {
          p.diseases--;
          this.addLog('action', `😴 ${p.name} se repose toute la journée et guérit d'une maladie.`, { fx: { kind: 'rest', playerId: p.id } });
        } else {
          this.addLog('action', `😴 ${p.name} fait la sieste à l'ombre d'un cocotier.`, { fx: { kind: 'rest', playerId: p.id } });
        }
        this.endTurnStep(p);
        return;
      }
      case 'action': {
        this.performAction(p, cmd.action, cmd.draws ?? 1);
        this.endTurnStep(p);
        return;
      }
      default:
        throw new GameError(`Commande ${cmd.type} invalide pendant la phase d'action.`);
    }
  }

  /** Après une action : action bonus (café) ou joueur suivant. */
  private endTurnStep(p: Player): void {
    if (this.phase === 'gameover') return;
    if (p.alive && this.extraActions > 0) {
      this.extraActions--;
    } else {
      this.nextActor();
    }
  }

  private handleTradeAnswer(cmd: Command): void {
    if (cmd.type !== 'answerTrade') throw new GameError('Acceptez ou refusez l\'échange.');
    const t = this.pendingTrade!;
    const from = this.player(t.fromId);
    const to = this.player(t.toId);
    const given = cmd.accept ? to.getCard(cmd.cardId ?? '') : undefined;
    if (cmd.accept && !given) throw new GameError('Choisissez la carte à donner en échange.');
    this.pendingTrade = null;
    this.phase = 'action';
    if (!given) {
      this.addLog('card', `✋ ${to.name} refuse l'échange proposé par ${from.name}.`);
      return;
    }
    const offered = from.removeCard(t.cardId)!;
    to.removeCard(given.id);
    from.addCard(given);
    to.addCard(offered);
    const dg = CARD_DEFS[given.type];
    const doff = CARD_DEFS[offered.type];
    this.addLog('card', `🔄 ${from.name} et ${to.name} échangent une carte.`, { fx: { kind: 'give', playerId: from.id, targetId: to.id, trade: true } });
    this.addLog('card', '', { privateTo: from.id, privateText: `Échange : vous recevez ${dg.emoji} ${dg.name}` });
    this.addLog('card', '', { privateTo: to.id, privateText: `Échange : vous recevez ${doff.emoji} ${doff.name}` });
  }

  private handleContribute(cmd: Command): void {
    const p = this.player(cmd.playerId);
    if (cmd.type === 'playCard') {
      const card = this.requirePlayable(p, cmd.cardId);
      this.applyCard(p, card);
      if (this.remainingVictims() <= 0) this.resolveShortage();
      return;
    }
    if (cmd.type === 'pass') {
      this.qIdx++;
      if (this.qIdx >= this.queue.length) this.resolveShortage();
      return;
    }
    throw new GameError(`Commande ${cmd.type} invalide pendant la mise en commun.`);
  }

  private handleVote(cmd: Command): void {
    const v = this.vote!;
    const p = this.player(cmd.playerId);
    if (cmd.type === 'vote') {
      try {
        v.cast(p.id, cmd.targetId);
      } catch (e) {
        throw new GameError((e as Error).message);
      }
      this.addLog('vote', `🗳️ ${p.name} a voté.`, { fx: { kind: 'vote', playerId: p.id } });
      if (v.isComplete()) this.resolveVote();
      return;
    }
    if (cmd.type === 'shoot') {
      if (!p.canShoot()) throw new GameError('Il faut un fusil et une cartouche pour tirer.');
      const target = this.requireOther(p, cmd.targetId);
      this.wreckDeck.discard(p.removeType('cartouche')!);
      this.addLog('danger', `💥 ${p.name} sort un fusil et tire sur ${target.name} !`, { fx: { kind: 'shot', playerId: p.id, targetId: target.id } });
      if (target.has('tole')) {
        this.pendingShield = { playerId: target.id, source: 'shot', attackerId: p.id };
        this.phase = 'shield';
      } else {
        this.killByShot(target, p);
      }
      return;
    }
    throw new GameError(`Commande ${cmd.type} invalide pendant le vote.`);
  }

  private handleShield(cmd: Command): void {
    if (cmd.type !== 'shield') throw new GameError('Répondez : utiliser la tôle ou non.');
    const { playerId, source, attackerId } = this.pendingShield!;
    const p = this.player(playerId);
    this.pendingShield = null;
    if (cmd.use) this.wreckDeck.discard(p.removeType('tole')!);

    if (source === 'shot') {
      if (cmd.use) {
        this.addLog('vote', `🛡️ La balle ricoche sur la plaque de tôle de ${p.name} ! Le vote reprend.`);
        this.phase = 'vote';
      } else {
        this.killByShot(p, this.player(attackerId!));
      }
      return;
    }
    if (cmd.use) {
      this.addLog('vote', `🛡️ ${p.name} brandit une plaque de tôle et échappe à la sentence ! Il faut désigner quelqu'un d'autre.`);
      this.protectedIds.add(p.id);
      this.resolveShortage();
    } else {
      this.acceptDesignation(p);
    }
  }

  private handleFlee(cmd: Command): void {
    if (cmd.type !== 'flee') throw new GameError('Votez pour partir ou rester.');
    this.fleeVotes.set(cmd.playerId, cmd.yes);
    this.qIdx++;
    if (this.qIdx < this.queue.length) return;
    const yes = [...this.fleeVotes.values()].filter(Boolean).length;
    const n = this.queue.length;
    this.addLog('vote', `Vote de départ : ${yes} pour, ${n - yes} contre.`);
    if (yes > n / 2) {
      this.endGame(true, this.weatherDeck ? "Le radeau prend la mer avant l'ouragan !" : 'Le radeau prend la mer : cap sur la civilisation !');
    } else {
      this.addLog('info', "La tribu décide de rester un jour de plus sur l'île.");
      this.startDay();
    }
  }

  // ───────────────────────────── Effets ─────────────────────────────

  private requireOther(p: Player, targetId: number): Player {
    const target = this.player(targetId);
    if (!target.alive || target.id === p.id) throw new GameError('Cible invalide.');
    return target;
  }

  private requirePlayable(p: Player, cardId: string): Card {
    const card = this.playableCards(p.id).find((c) => c.id === cardId);
    if (!card) throw new GameError('Cette carte ne peut pas être jouée maintenant.');
    return card;
  }

  private applyCard(p: Player, card: Card, targetId?: number): void {
    const def = CARD_DEFS[card.type];
    const value = CONTRIBUTION_VALUE[card.type];
    const fx: LogFx = { kind: 'card', playerId: p.id, cardType: card.type };
    if (value) {
      this.resources.water += value.water;
      this.resources.food += value.food;
      this.resources.wood += value.wood;
      p.contributed += value.water + value.food + value.wood;
      const parts = [value.water && `+${value.water} 💧`, value.food && `+${value.food} 🐟`, value.wood && `+${value.wood} 🪵`].filter(Boolean);
      this.addLog('card', `${p.name} partage : ${def.emoji} ${def.name} (${parts.join(', ')}).`, { fx });
    } else if (card.type === 'bateau' || card.type === 'scotch') {
      if (card.type === 'bateau') this.boat.hull = true;
      else this.boat.tape = true;
      p.contributed += 2;
      const done = this.boat.hull && this.boat.tape;
      this.addLog(
        'card',
        done
          ? `${p.name} pose ${def.emoji} ${def.name} : le bateau gonflable est réparé ! 🛶 Une place de radeau en plus.`
          : `${p.name} pose ${def.emoji} ${def.name} près du radeau. Il manque ${card.type === 'bateau' ? 'du scotch' : 'un bateau à réparer'}…`,
        { fx },
      );
    } else if (card.type === 'cafe') {
      this.extraActions++;
      this.addLog('card', `${p.name} avale un ${def.emoji} café noir : action supplémentaire !`, { fx });
    } else if (card.type === 'soins') {
      const target = targetId !== undefined ? this.player(targetId) : p.sick ? p : this.alivePlayers.find((o) => o.sick);
      if (!target || !target.alive || !target.sick) throw new GameError('Il faut cibler un joueur malade.');
      target.diseases--;
      this.addLog('card', target.id === p.id ? `${p.name} utilise une ${def.emoji} trousse de secours et guérit d'une maladie.` : `${p.name} soigne ${target.name} avec une ${def.emoji} trousse de secours.`, {
        fx: { ...fx, targetId: target.id },
      });
    } else if (card.type === 'longuevue' && this.weatherDeck) {
      const cards = this.weatherDeck.peek(2);
      this.peeks.set(p.id, { day: this.day, cards });
      this.addLog('card', `${p.name} scrute l'horizon avec une ${def.emoji} longue-vue.`, {
        fx,
        privateTo: p.id,
        privateText: `Prochaines météos : ${cards.length ? cards.map((c) => (c.hurricane ? '🌀 OURAGAN' : c.label)).join(' puis ') : "rien… l'ouragan est là."}`,
      });
    } else {
      throw new GameError(`${def.name} ne se joue pas ainsi.`);
    }
    p.removeCard(card.id);
    if (card.type !== 'bateau' && card.type !== 'scotch') this.wreckDeck.discard({ id: card.id, type: card.type });
  }

  private performAction(p: Player, action: ActionKind, draws: number): void {
    if (action === 'wreck') {
      const card = this.wreckDeck.draw();
      if (!card) {
        this.addLog('action', `${p.name} fouille l'épave, mais il n'y a plus rien à récupérer.`, { fx: { kind: 'wreck', playerId: p.id } });
        return;
      }
      p.addCard(card);
      const def = CARD_DEFS[card.type];
      this.addLog('action', `🛳️ ${p.name} fouille l'épave et ramène un objet.`, {
        fx: { kind: 'wreck', playerId: p.id },
        privateTo: p.id,
        privateText: `Vous trouvez : ${def.emoji} ${def.name}`,
      });
      return;
    }
    if (!(action in RESOURCE_OF)) throw new GameError(`Action inconnue : ${action as string}`);
    if (action === 'water' && this.weather && !this.weather.canCollect) throw new GameError("Pas une goutte de pluie aujourd'hui : impossible de recueillir de l'eau.");
    const k = Math.max(1, Math.min(this.bag.maxDraw, Math.floor(draws)));
    const bag = shuffle(this.rng, [...Array<'w'>(this.bag.white).fill('w'), ...Array<'b'>(this.bag.black).fill('b')]);
    const balls = bag.slice(0, k) as ('w' | 'b')[];
    const label = { fish: 'pêche', water: "collecte d'eau", wood: 'coupe du bois' }[action];
    if (balls.includes('b')) {
      this.addLog('danger', `⚫ ${p.name} tente sa chance (${k} boule${k > 1 ? 's' : ''}) pour la ${label}… boule noire ! Rien du tout, et une maladie en prime.`, {
        fx: { kind: 'draw', playerId: p.id, action, balls, gain: 0 },
      });
      this.addDisease(p, action === 'wood' ? 'Mordu par un serpent' : action === 'fish' ? 'Empoisonné par un poisson' : 'Malade d\'une eau croupie');
      return;
    }
    const res = RESOURCE_OF[action];
    const bonus = (p.has(TOOL_OF[action]) ? 1 : 0) + (action === 'water' && this.weather ? this.weather.waterBonus : 0);
    const gain = k + bonus;
    this.resources[res] += gain;
    const icon = { food: '🐟', water: '💧', wood: '🪵' }[res];
    this.addLog('action', `⚪ ${p.name} pioche ${k} boule${k > 1 ? 's' : ''} blanche${k > 1 ? 's' : ''} : +${gain} ${icon}${bonus ? ` (dont +${bonus} bonus)` : ''}.`, {
      fx: { kind: 'draw', playerId: p.id, action, balls, gain },
    });
  }

  private addDisease(p: Player, deathCause: string): void {
    p.diseases++;
    if (p.diseases >= MAX_DISEASES) {
      this.kill(p, deathCause, null);
    } else {
      this.addLog('danger', `🤒 ${p.name} tombe malade (${p.diseases}/${MAX_DISEASES}). Une maladie de plus et c'est la fin…`, {
        fx: { kind: 'disease', playerId: p.id, diseases: p.diseases },
      });
    }
  }

  // ───────────────────────────── Déroulement ─────────────────────────────

  private orderedAlive(): number[] {
    const n = this.players.length;
    const ids: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.players[(this.firstPlayerId + i) % n];
      if (p.alive) ids.push(p.id);
    }
    return ids;
  }

  private startDay(): void {
    if (this.alivePlayers.length === 0) {
      this.endGame(false, 'Toute la tribu a péri.');
      return;
    }
    if (this.day > 0) {
      const n = this.players.length;
      for (let i = 1; i <= n; i++) {
        const cand = (this.firstPlayerId + i) % n;
        if (this.players[cand].alive) {
          this.firstPlayerId = cand;
          break;
        }
      }
    }
    this.day++;
    if (this.weatherDeck) {
      this.weather = this.weatherDeck.draw() ?? weatherCard('ouragan');
      if (this.weather.hurricane) {
        this.lastDay = true;
        this.addLog('day', `🌀 Jour ${this.day} — L'OURAGAN APPROCHE ! Dernier jour : ce soir, le radeau doit partir.`, { fx: { kind: 'weather', weather: 'ouragan' } });
      } else {
        const w = this.weather;
        const detail = !w.canCollect ? 'impossible de recueillir de l\'eau' : w.waterBonus ? `+${w.waterBonus} 💧 si la collecte réussit` : 'collecte d\'eau sans bonus';
        this.addLog('day', `${{ secheresse: '☀️', nuageux: '☁️', averse: '🌦️', deluge: '⛈️', ouragan: '🌀' }[w.kind]} Jour ${this.day} — ${w.label} (${detail}).`, {
          fx: { kind: 'weather', weather: w.kind },
        });
      }
    } else {
      this.addLog('day', `🏝️ Jour ${this.day} sur l'île.`);
    }
    this.queue = this.orderedAlive();
    this.qIdx = 0;
    this.extraActions = 0;
    this.tradesLeft = MAX_TRADES_PER_TURN;
    this.phase = 'action';
  }

  private nextActor(): void {
    this.extraActions = 0;
    this.tradesLeft = MAX_TRADES_PER_TURN;
    this.qIdx++;
    while (this.qIdx < this.queue.length && !this.player(this.queue[this.qIdx]).alive) this.qIdx++;
    if (this.alivePlayers.length === 0) {
      this.endGame(false, 'Toute la tribu a péri.');
      return;
    }
    if (this.qIdx >= this.queue.length) this.startNeeds('consumption');
  }

  private shortages(): { shortWater: number; shortFood: number; shortPlaces: number } {
    const n = this.alivePlayers.length;
    return {
      shortWater: Math.max(0, n - this.resources.water),
      shortFood: Math.max(0, n - this.resources.food),
      shortPlaces: this.needsReason === 'departure' ? Math.max(0, n - this.places) : 0,
    };
  }

  /** Nombre de joueurs restant à désigner pour la pénurie / le départ en cours. */
  remainingVictims(): number {
    const alive = this.alivePlayers;
    const n = alive.length;
    if (this.needsReason === 'departure') {
      const { water, food } = this.resources;
      return Math.max(0, n - Math.min(water, food, this.places));
    }
    const res = this.currentShortResource();
    if (!res) return 0;
    return this.remainingFor(res);
  }

  private remainingFor(res: 'water' | 'food'): number {
    const alive = this.alivePlayers;
    const already = alive.filter((p) => this.deprived[res].has(p.id)).length;
    return Math.max(0, alive.length - this.resources[res] - already);
  }

  private currentShortResource(): 'water' | 'food' | null {
    if (this.remainingFor('water') > 0) return 'water';
    if (this.remainingFor('food') > 0) return 'food';
    return null;
  }

  private startNeeds(reason: NeedsReason): void {
    this.needsReason = reason;
    this.protectedIds.clear();
    this.deprived.water.clear();
    this.deprived.food.clear();
    if (this.remainingVictims() <= 0) {
      this.resolveShortage();
      return;
    }
    const s = this.shortages();
    const missing = [s.shortWater && `${s.shortWater} 💧`, s.shortFood && `${s.shortFood} 🐟`, s.shortPlaces && `${s.shortPlaces} place${s.shortPlaces > 1 ? 's' : ''} 🛶`]
      .filter(Boolean)
      .join(', ');
    this.addLog(
      'danger',
      reason === 'consumption'
        ? `⚠️ Pénurie ! Il manque ${missing} pour la nuit. Qui va partager ses réserves ?`
        : `⚠️ Le radeau n'est pas prêt : il manque ${missing} pour embarquer tout le monde !`,
    );
    const ctx = reason === 'departure' ? 'departure' : 'contribute';
    this.queue = this.orderedAlive().filter((id) => this.player(id).hand.some((c) => canPlayIn(c.type, ctx)));
    this.qIdx = 0;
    if (this.queue.length === 0) this.resolveShortage();
    else this.phase = 'contribute';
  }

  /** Avance la résolution de la pénurie : votes successifs puis repas (ou départ). */
  private resolveShortage(): void {
    if (this.alivePlayers.length === 0) {
      this.endGame(false, 'Toute la tribu a péri.');
      return;
    }
    if (this.needsReason === 'departure') {
      const required = this.remainingVictims();
      if (required <= 0) {
        const n = this.alivePlayers.length;
        this.endGame(true, `Le radeau s'élance dans la tempête avec ${n} survivant${n > 1 ? 's' : ''} à son bord !`);
        return;
      }
      const alive = this.orderedAlive();
      if (required >= alive.length) {
        this.addLog('death', "Le radeau ne peut emporter personne…");
        for (const id of alive) this.kill(this.player(id), "Emporté par l'ouragan", null);
        this.endGame(false, "L'ouragan a englouti l'île et ses naufragés.");
        return;
      }
      this.voteReason = 'departure';
      this.startVoteAmong(alive);
      return;
    }

    const res = this.currentShortResource();
    if (!res) {
      this.applyConsumption();
      return;
    }
    const remaining = this.remainingFor(res);
    const notDeprived = this.orderedAlive().filter((id) => !this.deprived[res].has(id));
    if (remaining >= notDeprived.length) {
      for (const id of notDeprived) this.deprived[res].add(id);
      this.addLog('danger', `Il n'y a ${res === 'water' ? "pas d'eau" : 'rien à manger'} pour personne ce soir…`);
      this.resolveShortage();
      return;
    }
    this.voteReason = res;
    this.startVoteAmong(notDeprived);
  }

  private startVoteAmong(pool: number[]): void {
    let candidates = pool.filter((id) => !this.protectedIds.has(id));
    if (candidates.length === 0) candidates = pool;
    if (candidates.length === 1) {
      this.addLog('vote', `Un seul candidat possible : ${this.player(candidates[0]).name}.`);
      this.designate(candidates[0]);
      return;
    }
    const what =
      this.voteReason === 'departure'
        ? `qui restera sur l'île (${this.remainingVictims()} place${this.remainingVictims() > 1 ? 's' : ''} manquante${this.remainingVictims() > 1 ? 's' : ''})`
        : `qui sera privé ${this.voteReason === 'water' ? "d'eau" : 'de nourriture'} ce soir (${this.remainingVictims()} portion${this.remainingVictims() > 1 ? 's' : ''} manquante${this.remainingVictims() > 1 ? 's' : ''})`;
    this.addLog('vote', `🗳️ Vote : la tribu doit désigner ${what}.`);
    this.vote = new VoteSystem(this.orderedAlive(), candidates);
    this.phase = 'vote';
  }

  private resolveVote(): void {
    const v = this.vote!;
    const summary = [...v.ballots.entries()].map(([voter, target]) => `${this.player(voter).name} → ${this.player(target).name}`).join(', ');
    this.addLog('vote', `Bulletins : ${summary}.`);
    const leaders = v.leaders();
    const victim = leaders.length > 1 ? pick(this.rng, leaders) : leaders[0];
    if (leaders.length > 1) {
      this.addLog('vote', `Égalité entre ${leaders.map((id) => this.player(id).name).join(', ')} ! Tirage au sort : c'est ${this.player(victim).name}.`);
    } else {
      this.addLog('vote', `La tribu désigne ${this.player(victim).name}.`);
    }
    this.voteHistory.push({ day: this.day, reason: this.voteReason, ballots: v.ballotsRecord(), victimId: victim });
    this.vote = null;
    this.designate(victim);
  }

  private designate(victimId: number): void {
    const victim = this.player(victimId);
    if (victim.has('tole')) {
      this.pendingShield = { playerId: victimId, source: 'vote' };
      this.phase = 'shield';
    } else {
      this.acceptDesignation(victim);
    }
  }

  private acceptDesignation(victim: Player): void {
    this.vote = null;
    this.protectedIds.clear();
    if (this.voteReason === 'departure') {
      this.kill(victim, "Abandonné face à l'ouragan", null);
    } else {
      this.deprived[this.voteReason].add(victim.id);
      this.addLog('vote', `${victim.name} devra se passer ${this.voteReason === 'water' ? "d'eau" : 'de nourriture'} cette nuit.`);
    }
    this.resolveShortage();
  }

  private killByShot(victim: Player, shooter: Player): void {
    this.vote = null;
    this.kill(victim, `Abattu par ${shooter.name}`, shooter);
    this.protectedIds.clear();
    this.resolveShortage();
  }

  private kill(p: Player, cause: string, heir: Player | null): void {
    if (!p.alive) return;
    p.alive = false;
    p.deathDay = this.day;
    p.deathCause = cause;
    const cards = p.hand.splice(0);
    this.addLog('death', `💀 ${p.name} a péri (${cause.toLowerCase()}).`, { fx: { kind: 'death', playerId: p.id, cause } });
    if (cards.length === 0) return;
    if (heir && heir.alive) {
      cards.forEach((c) => heir.addCard({ id: c.id, type: c.type }));
      this.addLog('card', `${heir.name} fouille le corps et récupère ${cards.length} carte${cards.length > 1 ? 's' : ''}.`);
    } else {
      const alive = this.alivePlayers;
      if (alive.length === 0) return;
      shuffle(this.rng, cards).forEach((c, i) => alive[i % alive.length].addCard({ id: c.id, type: c.type }));
      this.addLog(
        'card',
        cards.length > 1 ? `Les ${cards.length} affaires de ${p.name} sont partagées au hasard entre les survivants.` : `L'unique affaire de ${p.name} revient au hasard à un survivant.`,
      );
    }
  }

  private applyConsumption(): void {
    this.phase = 'action';
    const alive = this.alivePlayers;
    const drinkers = alive.filter((p) => !this.deprived.water.has(p.id)).length;
    const eaters = alive.filter((p) => !this.deprived.food.has(p.id)).length;
    this.resources.water = Math.max(0, this.resources.water - drinkers);
    this.resources.food = Math.max(0, this.resources.food - eaters);
    this.addLog('info', `🌙 La nuit tombe : la tribu consomme ${drinkers} 💧 et ${eaters} 🐟.`);
    for (const p of alive) {
      const missW = this.deprived.water.has(p.id);
      const missF = this.deprived.food.has(p.id);
      if (missW) this.addDisease(p, 'Mort de soif');
      if (missF && p.alive) this.addDisease(p, 'Mort de faim');
    }
    this.deprived.water.clear();
    this.deprived.food.clear();
    if (this.alivePlayers.length === 0) {
      this.endGame(false, 'Toute la tribu a péri.');
      return;
    }
    if (this.lastDay) {
      this.startNeeds('departure');
    } else if (this.canFlee()) {
      this.addLog('info', '⛵ Le radeau est prêt et les vivres suffisent ! La tribu vote pour partir.');
      this.queue = this.orderedAlive();
      this.qIdx = 0;
      this.fleeVotes.clear();
      this.phase = 'flee';
    } else {
      this.startDay();
    }
  }

  private endGame(victory: boolean, reason: string): void {
    this.phase = 'gameover';
    const survivors = this.alivePlayers.map((p) => p.id);
    this.result = { victory: victory && survivors.length > 0, survivors, reason };
    this.addLog(victory ? 'victory' : 'defeat', `${victory ? '🏆' : '☠️'} ${reason}`);
  }

  private addLog(type: LogType, text: string, extra: Partial<LogEntry> = {}): void {
    this.log.push({ id: ++this.logCounter, day: this.day, type, text, ...extra });
  }
}
