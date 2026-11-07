import type { Rng } from '../rng';
import type { KLPlayer, KohLantaEngine } from './KohLantaEngine';
import type { KLCommand, KLDecision } from './types';

/** Chance qu'un bot réussisse le mini-jeu du feu, selon sa forme. */
export function botFireSuccess(forme: number, rng: Rng): boolean {
  return rng() < 0.3 + forme * 0.05;
}

const AVERSION = { cooperatif: 2.4, egoiste: 3.0, paranoiaque: 3.8 } as const;

export function chooseKLBotCommand(engine: KohLantaEngine, rng: Rng = Math.random): KLCommand {
  const d = engine.decision;
  switch (d.kind) {
    case 'action':
      return botAction(engine, d, rng);
    case 'vote':
      return botVote(engine, d, rng);
    case 'finalChoice': {
      const me = engine.player(d.playerId);
      // On choisit l'adversaire qui a le moins de chances de séduire le jury
      const appeal = (id: number) => {
        const p = engine.player(id);
        const votesFor = engine.voteHistory.filter((r) => r.reason === 'council').reduce((s, r) => s + Object.values(r.ballots).filter((t) => t === id).length, 0);
        return p.challengeWins * 2 - votesFor + rng();
      };
      const target = [...d.options].sort((a, b) => appeal(a) - appeal(b))[0];
      void me;
      return { type: 'finalChoice', playerId: d.playerId, targetId: target };
    }
    case 'ambassador':
      return botAmbassador(engine, d, rng);
    default:
      throw new Error('Pas de décision de bot pour cette phase.');
  }
}

function botAction(engine: KohLantaEngine, d: Extract<KLDecision, { kind: 'action' }>, rng: Rng): KLCommand {
  const p = engine.player(d.playerId);
  const team = engine.team(p.team);
  const mates = engine.members(p.team);
  const n = mates.length;
  const playable = engine.playableCards(p.id);
  const find = (t: string) => playable.find((c) => c.type === t);
  const play = (cardId: string, targetId?: number): KLCommand => ({ type: 'playCard', playerId: p.id, cardId, targetId });

  const soins = find('soins');
  if (soins) {
    const sick = p.diseases > 0 ? p : p.personality === 'cooperatif' ? mates.find((m) => m.diseases > 0) : undefined;
    if (sick) return play(soins.id, sick.id);
  }
  const energie = find('energie');
  if (energie && p.forme <= 5) return play(energie.id);
  const silex = find('silex');
  if (silex) return play(silex.id);
  const shortage = team.water < n || team.food < n;
  const food = playable.find((c) => c.type === 'riz' || c.type === 'fruits' || c.type === 'gourde');
  if (food && (p.personality === 'cooperatif' || shortage)) return play(food.id);

  if (p.diseases >= 2 || (p.diseases === 1 && rng() < (p.forme <= 4 ? 0.7 : 0.35))) return { type: 'action', playerId: p.id, action: 'rest' };
  if (p.forme <= 2 && rng() < 0.5) return { type: 'action', playerId: p.id, action: 'rest' };

  if (!team.fire && team.wood >= 1 && rng() < 0.8) {
    return { type: 'action', playerId: p.id, action: 'fire', success: botFireSuccess(p.forme, rng) };
  }

  const w = engine.settings.weather ? engine.weather : null;
  const need = {
    water: Math.max(0, 3 * n - team.water) + (team.water < n ? 2 * n : 0),
    fish: Math.max(0, 3 * n - team.food) + (team.food < n ? 2 * n : 0),
    wood: Math.max(0, 4 - team.wood) * (team.fire ? 2.5 : 4),
  };
  const bag = engine.bagFor(p);
  const aversion = p.diseases > 0 ? 6 : AVERSION[p.personality];
  let best: { action: 'fish' | 'water' | 'wood' | 'jungle'; draws: number; score: number } = {
    action: 'jungle',
    draws: 1,
    score: (p.personality === 'egoiste' ? 1.2 : 0.5) + rng(),
  };
  for (const a of ['water', 'fish', 'wood'] as const) {
    if (a === 'water' && w && !w.canCollect) continue;
    let bestK = 1;
    let bestScore = -Infinity;
    let bestEv = 0;
    for (let k = 1; k <= bag.maxDraw; k++) {
      let pS = 1;
      for (let i = 0; i < k; i++) pS *= (bag.white - i) / (bag.white + bag.black - i);
      const ev = pS * k;
      const score = ev - aversion * (1 - pS);
      if (score > bestScore) {
        bestScore = score;
        bestK = k;
        bestEv = ev;
      }
    }
    const score = need[a] * (0.6 + bestEv / 3) * (0.8 + rng() * 0.4);
    if (score > best.score) best = { action: a, draws: bestK, score };
  }
  return { type: 'action', playerId: p.id, action: best.action, draws: best.draws };
}

function grudge(engine: KohLantaEngine, me: number, target: number): number {
  return engine.voteHistory.reduce((s, r) => s + (r.ballots[target] === me ? 1 : 0), 0);
}

function botVote(engine: KohLantaEngine, d: Extract<KLDecision, { kind: 'vote' }>, rng: Rng): KLCommand {
  const me = engine.player(d.playerId);
  if (d.canNecklace) {
    const threatened = engine.voteHistory.some((r) => Object.values(r.ballots).includes(me.id));
    if (me.personality === 'paranoiaque' || threatened || rng() < 0.35) return { type: 'necklace', playerId: me.id };
  }
  const score = (t: KLPlayer): number => {
    let s = rng() * 2 + grudge(engine, me.id, t.id) * (me.personality === 'paranoiaque' ? 3 : 1.5);
    if (d.reason === 'ambassador') {
      // on envoie négocier un coéquipier solide (il risque le tirage au sort)
      return t.forme + t.challengeWins * 1.5 + rng() * 3 - (me.personality === 'paranoiaque' ? grudge(engine, me.id, t.id) * -2 : 0);
    }
    if (d.reason === 'jury') {
      // Le juré récompense les finalistes qui l'ont épargné et les grands champions (score inversé : on vote pour le plus haut)
      return -(s + t.challengeWins * 0.8 - grudge(engine, me.id, t.id) * 3);
    }
    if (d.reason === 'council') {
      if (engine.merged) s += t.challengeWins * (me.personality === 'egoiste' ? 1.5 : 0.8) + t.forme * 0.2; // éliminer les menaces
      else s += (10 - t.forme) * 0.4 + t.diseases; // éliminer les maillons faibles
    } else {
      // privation : priver un malade peut le faire abandonner
      if (t.diseases >= 2) s += me.personality === 'cooperatif' ? -4 : 1;
      else if (t.diseases === 1) s += me.personality === 'cooperatif' ? -1.5 : 0.5;
    }
    return s;
  };
  const ranked = d.candidates.map((id) => ({ id, s: score(engine.player(id)) })).sort((a, b) => (d.reason === 'jury' ? a.s - b.s : b.s - a.s));
  return { type: 'vote', playerId: me.id, targetId: ranked[0].id };
}

const AGREE = { cooperatif: 0.75, egoiste: 0.45, paranoiaque: 0.55 } as const;

/** Ambassadeur : se rallier à la proposition d'un autre… ou défendre ses anciens coéquipiers. */
function botAmbassador(engine: KohLantaEngine, d: Extract<KLDecision, { kind: 'ambassador' }>, rng: Rng): KLCommand {
  const me = engine.player(d.playerId);
  const first = d.proposals[0];
  if (first && d.candidates.includes(first.target)) {
    const t = engine.player(first.target);
    if (t.originalTeam !== me.originalTeam && rng() < AGREE[me.personality]) return { type: 'ambassador', playerId: me.id, targetId: t.id };
  }
  const rivals = d.candidates.filter((id) => engine.player(id).originalTeam !== me.originalTeam);
  const pool = rivals.length ? rivals : d.candidates;
  const threat = (id: number) => {
    const p = engine.player(id);
    return p.challengeWins * 1.5 + p.forme * 0.3 + grudge(engine, me.id, id) * 2 + rng() * 2;
  };
  const target = [...pool].sort((a, b) => threat(b) - threat(a))[0];
  return { type: 'ambassador', playerId: me.id, targetId: target };
}
