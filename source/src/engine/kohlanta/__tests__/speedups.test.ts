import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng';
import { CHALLENGES, KohLantaEngine, MAX_ELIMINATION_CHALLENGES, MAX_SURPRISE_COUNCILS, botPlan, chooseKLBotCommand, type ChallengeState, type KLDecision } from '..';

const humans = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `A${i}`, isBot: false }));
const dec = (e: KohLantaEngine): KLDecision => e.decision;

function submit(e: KohLantaEngine, worst?: number): void {
  const d = dec(e);
  if (d.kind !== 'challenge') return;
  const states: Record<number, ChallengeState> = {};
  for (const id of d.challenge.participants) {
    const score = id === worst ? 0 : 50 - id;
    states[id] = { progress: 1, done: true, fallen: false, time: 100 - score, score };
  }
  e.submitChallenge(states);
}

/** Avance d'un pas avec des choix simples (humains). */
function step(e: KohLantaEngine, ambassadorAgree = true): void {
  // réserves pleines : on teste les règles d'élimination, pas la survie
  for (const t of e.teams) {
    t.water = 99;
    t.food = 99;
    t.wood = 9;
  }
  const d = dec(e);
  if (d.kind === 'challenge') submit(e);
  else if (d.kind === 'action') e.dispatch({ type: 'action', playerId: d.playerId, action: 'rest' });
  else if (d.kind === 'vote') e.dispatch({ type: 'vote', playerId: d.playerId, targetId: d.candidates[(e.day + d.playerId) % d.candidates.length] });
  else if (d.kind === 'finalChoice') e.dispatch({ type: 'finalChoice', playerId: d.playerId, targetId: d.options[0] });
  else if (d.kind === 'ambassador') {
    const target = ambassadorAgree ? d.candidates[0] : d.candidates[d.proposals.length % d.candidates.length];
    e.dispatch({ type: 'ambassador', playerId: d.playerId, targetId: target });
  }
}

/** Avance jusqu'à la négociation des ambassadeurs (en essayant plusieurs graines). */
function reachAmbassadors(): KohLantaEngine {
  for (let seed = 1; seed < 60; seed++) {
    const e = new KohLantaEngine(humans(12), { teams: 2 }, seed);
    for (let i = 0; i < 3000 && dec(e).kind !== 'ambassador' && dec(e).kind !== 'gameover'; i++) step(e);
    if (dec(e).kind === 'ambassador') return e;
  }
  throw new Error('jamais atteint');
}

describe('Ambassadeurs à la réunification', () => {
  it("chaque équipe élit un ambassadeur ; s'ils sont d'accord, leur cible est éliminée", () => {
    const e = reachAmbassadors();
    const d = dec(e) as Extract<KLDecision, { kind: 'ambassador' }>;
    expect(e.merged).toBe(true);
    expect(e.ambassadors).toHaveLength(2);
    expect(new Set(e.ambassadors.map((id) => e.player(id).originalTeam)).size).toBe(2);
    expect(d.candidates.some((id) => e.ambassadors.includes(id))).toBe(false);
    const before = e.alivePlayers.length;
    const target = d.candidates[0];
    while (dec(e).kind === 'ambassador') e.dispatch({ type: 'ambassador', playerId: (dec(e) as { playerId: number }).playerId, targetId: target });
    expect(e.player(target).alive).toBe(false);
    expect(e.player(target).eliminatedHow).toBe('Désigné par les ambassadeurs');
    expect(e.player(target).isJury).toBe(true);
    expect(e.alivePlayers).toHaveLength(before - 1);
  });

  it('sans accord, le sort élimine un des ambassadeurs', () => {
    const e = reachAmbassadors();
    const ambassadors = [...e.ambassadors];
    let k = 0;
    while (dec(e).kind === 'ambassador') {
      const d = dec(e) as Extract<KLDecision, { kind: 'ambassador' }>;
      e.dispatch({ type: 'ambassador', playerId: d.playerId, targetId: d.candidates[k++] });
    }
    const out = ambassadors.filter((id) => !e.player(id).alive);
    expect(out).toHaveLength(1);
    expect(e.player(out[0]).eliminatedHow).toBe('Tiré au sort entre les ambassadeurs');
  });
});

describe('Destins liés', () => {
  it("au conseil, l'éliminé emmène son binôme", () => {
    let checked = false;
    for (let seed = 1; seed < 80 && !checked; seed++) {
      const e = new KohLantaEngine(humans(14), { teams: 1 }, seed);
      for (let i = 0; i < 3000 && !e.linkedActive && dec(e).kind !== 'gameover'; i++) step(e);
      if (!e.linkedActive) continue;
      expect(e.pairs.size).toBeGreaterThanOrEqual(2);
      for (const [a, b] of e.pairs) expect(e.pairs.get(b)).toBe(a);
      // aller jusqu'au conseil et voter contre quelqu'un qui a un binôme
      for (let i = 0; i < 500 && !(dec(e).kind === 'vote' && (dec(e) as { reason: string }).reason === 'council'); i++) step(e);
      const d = dec(e) as Extract<KLDecision, { kind: 'vote' }>;
      const target = d.candidates.find((id) => e.pairs.has(id) && e.player(e.pairs.get(id)!).alive)!;
      const mate = e.pairs.get(target)!;
      const before = e.alivePlayers.length;
      while (dec(e).kind === 'vote') {
        const v = dec(e) as Extract<KLDecision, { kind: 'vote' }>;
        e.dispatch({ type: 'vote', playerId: v.playerId, targetId: v.candidates.includes(target) ? target : v.candidates[0] });
      }
      expect(e.player(target).alive).toBe(false);
      expect(e.player(mate).alive).toBe(false);
      expect(e.player(mate).eliminatedHow).toContain('Destin lié');
      expect(e.alivePlayers.length).toBe(before - 2);
      // les binômes du cycle sont dissous (un nouveau tirage peut avoir lieu ensuite)
      expect(e.pairs.get(target)).toBeUndefined();
      checked = true;
    }
    expect(checked).toBe(true);
  });
});

describe('Épreuves éliminatoires et conseils surprises', () => {
  it("le dernier d'une épreuve éliminatoire quitte l'aventure", () => {
    let checked = false;
    for (let seed = 1; seed < 80 && !checked; seed++) {
      const e = new KohLantaEngine(humans(10), { teams: 1 }, seed);
      for (let i = 0; i < 3000 && dec(e).kind !== 'gameover'; i++) {
        const d = dec(e);
        if (d.kind === 'challenge' && d.challenge.kind === 'elimination') {
          const worst = d.challenge.participants[0];
          submit(e, worst);
          expect(e.player(worst).alive).toBe(false);
          expect(e.player(worst).eliminatedHow).toContain('éliminatoire');
          checked = true;
          break;
        }
        step(e);
      }
    }
    expect(checked).toBe(true);
  });

  it('au plus 2 conseils surprises et 2 épreuves éliminatoires par partie', () => {
    let surprises = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed);
      const e = new KohLantaEngine(Array.from({ length: 16 }, (_, i) => ({ name: `B${i}`, isBot: true })), { teams: seed % 4 + 1 }, seed);
      for (let guard = 0; dec(e).kind !== 'gameover'; guard++) {
        if (guard > 40000) throw new Error('boucle infinie');
        const d = dec(e);
        if (d.kind === 'challenge') {
          const def = CHALLENGES[d.challenge.game];
          const st: Record<number, ChallengeState> = {};
          for (const id of d.challenge.participants) st[id] = botPlan(def, e.player(id).forme, rng)(def.duration);
          e.submitChallenge(st);
        } else e.dispatch(chooseKLBotCommand(e, rng));
      }
      expect(e.surpriseCount).toBeLessThanOrEqual(MAX_SURPRISE_COUNCILS);
      expect(e.eliminationCount).toBeLessThanOrEqual(MAX_ELIMINATION_CHALLENGES);
      expect(e.result?.winnerId).not.toBeNull();
      surprises += e.surpriseCount;
    }
    expect(surprises).toBeGreaterThan(0);
  });
});
