import type { ActionKind, Card, Command, Decision, ResourceAction } from './types';
import { CARD_DEFS, CONTRIBUTION_VALUE, WOOD_PER_PLACE } from './cards';
import { type GameEngine, MAX_TRADES_PER_TURN, successChance } from './GameEngine';
import type { Player } from './Player';
import type { Rng } from './rng';

/**
 * IA simple : renvoie la commande qu'un bot joue pour la décision courante.
 * Les bots n'utilisent que l'information publique + leur propre main.
 * Leur caractère (coopératif, égoïste, paranoïaque) influence chaque choix.
 */
export function chooseBotCommand(engine: GameEngine, rng: Rng = Math.random): Command {
  const d = engine.decision;
  switch (d.kind) {
    case 'action':
      return botAction(engine, d, rng);
    case 'trade':
      return botAnswerTrade(engine, d);
    case 'contribute':
      return botContribute(engine, d, rng);
    case 'vote':
      return botVote(engine, d, rng);
    case 'shield':
      return { type: 'shield', playerId: d.playerId, use: true };
    case 'flee':
      return { type: 'flee', playerId: d.playerId, yes: true };
    case 'gameover':
      throw new Error('Partie terminée');
  }
}

const RISK_AVERSION = { cooperatif: 1.6, egoiste: 2.0, paranoiaque: 2.8 } as const;

function botAction(engine: GameEngine, d: Extract<Decision, { kind: 'action' }>, rng: Rng): Command {
  const p = engine.player(d.playerId);
  const playable = engine.playableCards(p.id);
  const find = (type: Card['type']) => playable.find((c) => c.type === type);
  const n = engine.alivePlayers.length;
  const { water, food, wood } = engine.resources;
  const play = (c: Card, targetId?: number): Command => ({ type: 'playCard', playerId: p.id, cardId: c.id, targetId });

  // Se soigner en priorité
  const soins = find('soins');
  if (soins && p.diseases > 0) return play(soins, p.id);
  const sickOther = engine.alivePlayers.find((o) => o.sick && o.id !== p.id);
  if (soins && sickOther && p.personality === 'cooperatif') return play(soins, sickOther.id);

  // Montrer une arme ou une protection pour dissuader (une seule fois)
  const deterrent = p.hand.find((c) => (c.type === 'fusil' || c.type === 'tole') && !c.revealed);
  if (deterrent && p.personality !== 'cooperatif' && rng() < 0.25) return { type: 'reveal', playerId: p.id, cardId: deterrent.id };

  const peek = find('longuevue');
  if (peek && engine.peeks.get(p.id)?.day !== engine.day) return play(peek);

  const cafe = find('cafe');
  if (cafe && d.extraActions === 0) return play(cafe);

  // Bateau gonflable / scotch : on les pose (l'égoïste attend que l'autre moitié soit posée)
  for (const part of ['bateau', 'scotch'] as const) {
    const c = find(part);
    const otherPosed = part === 'bateau' ? engine.boat.tape : engine.boat.hull;
    if (c && (p.personality === 'cooperatif' || otherPosed || engine.lastDay)) return play(c);
  }

  // Partager ses vivres et planches quand le départ est à portée
  const placesNeeded = n * WOOD_PER_PLACE;
  const nearDeparture = wood + 4 >= placesNeeded * (p.personality === 'cooperatif' ? 0.7 : 0.9) || engine.lastDay;
  if (nearDeparture) {
    const shareable = playable.find((c) => CONTRIBUTION_VALUE[c.type]);
    if (shareable && (p.personality === 'cooperatif' || engine.lastDay || (engine.places >= n - 1 && water + food >= 3 * n))) return play(shareable);
  }

  // Échange opportuniste : se débarrasser d'une cartouche sans fusil
  const junk = p.hand.find((c) => c.type === 'cartouche') && !p.has('fusil') ? p.find('cartouche') : undefined;
  if (junk && d.tradesLeft === MAX_TRADES_PER_TURN && rng() < 0.3) {
    const partner = engine.alivePlayers.filter((o) => o.id !== p.id && o.hand.length > 0);
    if (partner.length) return { type: 'proposeTrade', playerId: p.id, cardId: junk.id, targetId: partner[Math.floor(rng() * partner.length)].id };
  }

  // Malade : se reposer ou prendre le risque ?
  if (p.diseases > 0) {
    const shortageLikely = water < n || food < n;
    const restChance = { cooperatif: 0.7, egoiste: 0.75, paranoiaque: 0.9 }[p.personality] - (shortageLikely ? 0.2 : 0);
    if (rng() < restChance) return { type: 'rest', playerId: p.id };
  }

  const { action, draws } = pickAction(engine, p, rng);
  return { type: 'action', playerId: p.id, action, draws };
}

/** Meilleur nombre de boules à piocher pour une action, selon le risque accepté. */
function bestDraw(engine: GameEngine, p: Player, bonus: number): { draws: number; ev: number } {
  const aversion = p.diseases > 0 ? 9 : RISK_AVERSION[p.personality];
  let best = { draws: 1, ev: -Infinity, score: -Infinity };
  for (let k = 1; k <= engine.bag.maxDraw; k++) {
    const pS = successChance(engine.bag, k);
    const ev = pS * (k + bonus);
    const score = ev - aversion * (1 - pS);
    if (score > best.score) best = { draws: k, ev, score };
  }
  return { draws: best.draws, ev: best.ev };
}

function pickAction(engine: GameEngine, p: Player, rng: Rng): { action: ActionKind; draws: number } {
  const n = engine.alivePlayers.length;
  const { water, food, wood } = engine.resources;
  const last = engine.lastDay;
  const w = engine.weather;

  // Plan : combien de jours pour finir le radeau ? Il faut tenir jusque-là, plus les vivres du voyage.
  const woodGoal = Math.max(0, n - (engine.boat.hull && engine.boat.tape ? 1 : 0)) * WOOD_PER_PLACE;
  const woodLeft = Math.max(0, woodGoal - wood);
  const daysToRaft = last ? 0 : Math.ceil(woodLeft / Math.max(1, n * 1.3));
  const nights = Math.min(daysToRaft, 6) + 1;
  const need: Record<ResourceAction, number> = {
    water: Math.max(0, n * (nights + 1) - water) + (water < n ? 3 * n : 0),
    fish: Math.max(0, n * (nights + 1) - food) + (food < n ? 3 * n : 0),
    wood: woodLeft * (last ? 3 : 1),
  };
  const bonus: Record<ResourceAction, number> = {
    water: (p.has('bache') ? 1 : 0) + (w ? w.waterBonus : 0),
    fish: p.has('canne') ? 1 : 0,
    wood: p.has('hache') ? 1 : 0,
  };
  const wreckScore = last ? -1 : (p.personality === 'egoiste' ? 2 : 1) + rng() * 2;
  let best: { action: ActionKind; draws: number; score: number } = { action: 'wreck', draws: 1, score: wreckScore };
  for (const a of ['water', 'fish', 'wood'] as const) {
    if (a === 'water' && w && !w.canCollect) continue;
    const { draws, ev } = bestDraw(engine, p, bonus[a]);
    const score = need[a] * (0.6 + ev / 3) * (0.8 + rng() * 0.4);
    if (score > best.score) best = { action: a, draws, score };
  }
  return { action: best.action, draws: best.draws };
}

function botAnswerTrade(engine: GameEngine, d: Extract<Decision, { kind: 'trade' }>): Command {
  const me = engine.player(d.playerId);
  const protectedTypes = me.personality === 'paranoiaque' ? ['fusil', 'tole'] : [];
  const tradable = me.hand.filter((c) => !protectedTypes.includes(c.type));
  if (tradable.length === 0) return { type: 'answerTrade', playerId: me.id, accept: false };
  const worst = tradable.reduce((a, b) => (CARD_DEFS[a.type].value <= CARD_DEFS[b.type].value ? a : b));
  const offeredValue = CARD_DEFS[d.offered.type].value;
  const margin = { cooperatif: -1, egoiste: 1, paranoiaque: 0 }[me.personality];
  const accept = offeredValue >= CARD_DEFS[worst.type].value + margin;
  return accept ? { type: 'answerTrade', playerId: me.id, accept: true, cardId: worst.id } : { type: 'answerTrade', playerId: me.id, accept: false };
}

function botContribute(engine: GameEngine, d: Extract<Decision, { kind: 'contribute' }>, rng: Rng): Command {
  const p = engine.player(d.playerId);
  const playable = engine.playableCards(p.id);
  const useful = playable.find((c) => {
    if (c.type === 'bateau' || c.type === 'scotch') return d.shortPlaces > 0;
    const v = CONTRIBUTION_VALUE[c.type];
    if (!v) return false;
    return (d.shortWater > 0 && v.water > 0) || (d.shortFood > 0 && v.food > 0) || (d.shortPlaces > 0 && v.wood > 0);
  });
  if (!useful) return { type: 'pass', playerId: p.id };

  const threatened = votesAgainst(engine, p.id) > 0 || p.diseases > 0;
  const willing =
    d.reason === 'departure' ||
    p.personality === 'cooperatif' ||
    (p.personality === 'paranoiaque' && (threatened || rng() < 0.6)) ||
    (p.personality === 'egoiste' && (threatened || rng() < 0.35));
  return willing ? { type: 'playCard', playerId: p.id, cardId: useful.id } : { type: 'pass', playerId: p.id };
}

function votesAgainst(engine: GameEngine, targetId: number, fromId?: number): number {
  let n = 0;
  for (const rec of engine.voteHistory) {
    for (const [voter, target] of Object.entries(rec.ballots)) {
      if (target === targetId && (fromId === undefined || Number(voter) === fromId)) n++;
    }
  }
  return n;
}

function hostility(engine: GameEngine, me: Player, target: Player, reason: Decision & { kind: 'vote' }, rng: Rng): number {
  const grudge = votesAgainst(engine, me.id, target.id);
  let score = rng() * 2;
  score += grudge * (me.personality === 'paranoiaque' ? 3 : 1.5);
  score -= target.contributed * (me.personality === 'cooperatif' ? 0.4 : 0.15);
  if (me.personality === 'egoiste') score += target.hand.length * 0.5; // le nombre de cartes est public
  if (target.hand.some((c) => c.revealed && (c.type === 'fusil' || c.type === 'tole'))) score -= 1.5; // dissuasion
  if (reason.reason !== 'departure') {
    // Priver un malade le tue : le coopératif l'évite, les autres s'en servent
    if (target.diseases > 0) score += me.personality === 'cooperatif' ? -3 : 1;
  } else if (target.diseases > 0) {
    score += 1;
  }
  return score;
}

function botVote(engine: GameEngine, d: Extract<Decision, { kind: 'vote' }>, rng: Rng): Command {
  const me = engine.player(d.playerId);

  if (d.canShoot) {
    const others = engine.alivePlayers.filter((o) => o.id !== me.id);
    const ranked = others.map((o) => ({ o, s: hostility(engine, me, o, d, rng) })).sort((a, b) => b.s - a.s);
    const threatened = d.reason === 'departure' && d.allCandidates.includes(me.id);
    const shouldShoot =
      (threatened && rng() < 0.7) ||
      (me.personality === 'paranoiaque' && ranked[0] && ranked[0].s >= 5) ||
      (me.personality === 'egoiste' && d.reason === 'departure' && rng() < 0.3);
    if (shouldShoot && ranked[0]) return { type: 'shoot', playerId: me.id, targetId: ranked[0].o.id };
  }

  const ranked = d.candidates.map((id) => ({ id, s: hostility(engine, me, engine.player(id), d, rng) })).sort((a, b) => b.s - a.s);
  return { type: 'vote', playerId: me.id, targetId: ranked[0].id };
}
