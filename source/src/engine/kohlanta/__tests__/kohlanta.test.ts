import { describe, expect, it } from 'vitest';
import { createRng } from '../../rng';
import {
  CHALLENGES,
  KL_MAX_DISEASES,
  KohLantaEngine,
  KLError,
  botPlan,
  buildKLView,
  chooseKLBotCommand,
  finalScore,
  type ChallengeState,
  type KLDecision,
} from '..';

const humans = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `A${i}`, isBot: false }));
const dec = (e: KohLantaEngine): KLDecision => e.decision;

/** Joue l'épreuve en cours : le joueur `best` gagne, les autres suivent dans l'ordre inverse des ids. */
function playChallenge(e: KohLantaEngine, best?: number, worst?: number): void {
  const d = dec(e);
  if (d.kind !== 'challenge') throw new Error('pas d’épreuve');
  const states: Record<number, ChallengeState> = {};
  for (const id of d.challenge.participants) {
    const score = id === best ? 99 : id === worst ? 0 : 50 - id;
    states[id] = { progress: 1, done: true, fallen: false, time: 100 - score, score };
  }
  e.submitChallenge(states);
}

function restAll(e: KohLantaEngine): void {
  const day = e.day;
  while (dec(e).kind === 'action' && e.day === day) e.dispatch({ type: 'action', playerId: (dec(e) as { playerId: number }).playerId, action: 'rest' });
}

describe('Mise en place Koh Lanta', () => {
  it('accepte 4 à 16 aventuriers et répartit les équipes', () => {
    expect(() => new KohLantaEngine(humans(3))).toThrow(KLError);
    expect(() => new KohLantaEngine(humans(17))).toThrow(KLError);
    const e = new KohLantaEngine(humans(12), { teams: 3 }, 1);
    expect(e.teams).toHaveLength(3);
    for (const t of e.teams) expect(e.members(t.id)).toHaveLength(4);
    expect(e.merged).toBe(false);
  });

  it('chacun pour soi : une seule tribu dès le départ', () => {
    const e = new KohLantaEngine(humans(6), { teams: 1 }, 1);
    expect(e.merged).toBe(true);
    expect(e.teams).toHaveLength(1);
  });

  it('le jour 1 commence par une épreuve de confort par équipes', () => {
    const e = new KohLantaEngine(humans(8), { teams: 2 }, 1);
    const d = dec(e);
    expect(d.kind).toBe('challenge');
    if (d.kind === 'challenge') {
      expect(d.challenge.kind).toBe('confort');
      expect(d.challenge.teamMode).toBe(true);
      expect(d.challenge.reward).toBeDefined();
      expect(CHALLENGES[d.challenge.game].finalOnly).toBeFalsy();
    }
  });

  it("sans météo : pas de carte météo", () => {
    const e = new KohLantaEngine(humans(6), { weather: false }, 1);
    expect(buildKLView(e, 0).weather).toBeNull();
  });
});

describe('Cycle de 3 jours', () => {
  it('confort → camp, immunité → camp, camp → conseil', () => {
    const e = new KohLantaEngine(humans(10), { teams: 2 }, 2);
    playChallenge(e, 0);
    expect(dec(e).kind).toBe('action');
    restAll(e);
    expect(e.day).toBe(2);
    let d = dec(e);
    expect(d.kind === 'challenge' && d.challenge.kind).toBe('immunite');
    const team0 = e.player(0).team;
    playChallenge(e, 0);
    // l'équipe perdante ira au conseil
    expect(e.councilTeam).not.toBe(team0);
    restAll(e);
    expect(e.day).toBe(3);
    expect(dec(e).kind).toBe('action');
    restAll(e);
    d = dec(e);
    expect(d).toMatchObject({ kind: 'vote', reason: 'council', teamId: e.councilTeam });
    // seuls les membres de l'équipe perdante votent
    const councilTeam = e.councilTeam;
    const voters = new Set<number>();
    while (dec(e).kind === 'vote') {
      const v = dec(e) as Extract<KLDecision, { kind: 'vote' }>;
      voters.add(v.playerId);
      e.dispatch({ type: 'vote', playerId: v.playerId, targetId: v.candidates[0] });
    }
    for (const id of voters) expect(e.player(id).originalTeam).toBe(councilTeam);
    expect(e.alivePlayers).toHaveLength(9);
    expect(e.day).toBe(4);
  });
});

describe('Vie de camp', () => {
  it('le feu : succès = feu allumé (-1 bois), échec = -1 forme', () => {
    const e = new KohLantaEngine(humans(8), { teams: 2 }, 3);
    playChallenge(e);
    const pid = (dec(e) as { playerId: number }).playerId;
    const p = e.player(pid);
    const team = e.team(p.team);
    const forme = p.forme;
    e.dispatch({ type: 'action', playerId: pid, action: 'fire', success: false });
    expect(team.fire).toBe(false);
    expect(p.forme).toBe(forme - 1);
    const next = e.player((dec(e) as { playerId: number }).playerId);
    const nteam = e.team(next.team);
    if (!nteam.fire) {
      const wood = nteam.wood;
      e.dispatch({ type: 'action', playerId: next.id, action: 'fire', success: true });
      expect(nteam.fire).toBe(true);
      expect(nteam.wood).toBe(wood - 1);
    }
  });

  it('la forme agit sur le sac : en pleine forme une blanche de plus, épuisé des noires en plus', () => {
    const e = new KohLantaEngine(humans(6), {}, 4);
    const p = e.player(0);
    p.forme = 9;
    const fit = e.bagFor(p);
    p.forme = 1;
    const tired = e.bagFor(p);
    expect(fit.white).toBeGreaterThan(tired.white - 1);
    expect(tired.black).toBeGreaterThan(fit.black);
  });

  it('à 3 maladies, abandon médical', () => {
    const e = new KohLantaEngine(humans(8), { teams: 2 }, 5);
    playChallenge(e);
    const pid = (dec(e) as { playerId: number }).playerId;
    const p = e.player(pid);
    p.diseases = KL_MAX_DISEASES - 1;
    p.forme = 0; // sac plein de noires
    for (let i = 0; i < 20 && p.alive; i++) {
      if (dec(e).kind !== 'action' || (dec(e) as { playerId: number }).playerId !== pid) break;
      e.dispatch({ type: 'action', playerId: pid, action: 'fish', draws: 6 });
    }
    // 6 boules dans un sac de 6 blanches + 3 noires : forcément une noire
    expect(p.alive).toBe(false);
    expect(p.eliminatedHow).toBe('Abandon médical');
  });

  it('on ne donne un objet qu’à un coéquipier', () => {
    const e = new KohLantaEngine(humans(8), { teams: 2 }, 6);
    playChallenge(e);
    const pid = (dec(e) as { playerId: number }).playerId;
    const p = e.player(pid);
    p.hand.push({ id: 'x1', type: 'riz' });
    const enemy = e.alivePlayers.find((o) => o.team !== p.team)!;
    expect(() => e.dispatch({ type: 'give', playerId: pid, cardId: 'x1', targetId: enemy.id })).toThrow(KLError);
    const mate = e.alivePlayers.find((o) => o.team === p.team && o.id !== pid)!;
    e.dispatch({ type: 'give', playerId: pid, cardId: 'x1', targetId: mate.id });
    expect(mate.hand.some((c) => c.id === 'x1')).toBe(true);
  });
});

describe('Conseil, collier et finale', () => {
  it("le collier d'immunité annule les voix contre son porteur", () => {
    const e = new KohLantaEngine(humans(6), { teams: 1 }, 7);
    playChallenge(e, 5);
    restAll(e);
    playChallenge(e, 5); // immunité pour A5
    restAll(e);
    restAll(e);
    expect(dec(e)).toMatchObject({ kind: 'vote', reason: 'council' });
    e.player(0).hand.push({ id: 'col', type: 'collier' });
    while (dec(e).kind === 'vote') {
      const v = dec(e) as Extract<KLDecision, { kind: 'vote' }>;
      expect(v.candidates).not.toContain(5); // immunisé
      if (v.playerId === 0 && v.canNecklace) {
        e.dispatch({ type: 'necklace', playerId: 0 });
        continue;
      }
      const target = v.candidates.includes(0) ? 0 : v.candidates[0];
      e.dispatch({ type: 'vote', playerId: v.playerId, targetId: target });
    }
    expect(e.player(0).alive).toBe(true);
    expect(e.alivePlayers).toHaveLength(5);
    expect(e.voteHistory.at(-1)?.cancelled?.length).toBeGreaterThan(0);
  });

  it('à 4 : orientation ; à 3 : poteaux, le gagnant choisit son adversaire ; puis le jury vote', () => {
    const e = new KohLantaEngine(humans(4), { teams: 1 }, 8);
    let d = dec(e);
    expect(d.kind === 'challenge' && d.challenge.game).toBe('orientation');
    playChallenge(e, 0, 3);
    expect(e.player(3).alive).toBe(false);
    expect(e.jury).toContain(3);
    d = dec(e);
    expect(d.kind === 'challenge' && d.challenge.game).toBe('poteaux');
    playChallenge(e, 1);
    d = dec(e);
    expect(d).toMatchObject({ kind: 'finalChoice', playerId: 1 });
    e.dispatch({ type: 'finalChoice', playerId: 1, targetId: 2 });
    expect(e.player(0).alive).toBe(false);
    expect(e.finalists.sort()).toEqual([1, 2]);
    while (dec(e).kind === 'vote') {
      const v = dec(e) as Extract<KLDecision, { kind: 'vote' }>;
      expect(v.reason).toBe('jury');
      expect([0, 3]).toContain(v.playerId);
      e.dispatch({ type: 'vote', playerId: v.playerId, targetId: 2 });
    }
    expect(e.result?.winnerId).toBe(2);
  });

  it('la réunification arrive quand il reste la moitié des aventuriers', () => {
    const e = new KohLantaEngine(humans(10), { teams: 2 }, 9);
    for (let guard = 0; guard < 400 && !e.merged; guard++) {
      const d = dec(e);
      if (d.kind === 'challenge') playChallenge(e);
      else if (d.kind === 'action') e.dispatch({ type: 'action', playerId: d.playerId, action: 'rest' });
      else if (d.kind === 'vote') e.dispatch({ type: 'vote', playerId: d.playerId, targetId: d.candidates[0] });
    }
    expect(e.merged).toBe(true);
    // la moitié (5) ou plus tôt si une équipe est réduite à un seul membre
    const byTeam = [0, 1].map((t) => e.players.filter((p) => p.originalTeam === t && p.alive).length);
    expect(e.alivePlayers.length <= 5 || Math.min(...byTeam) <= 1).toBe(true);
    expect(e.teams).toHaveLength(1);
  });
});

describe('Bots et simulation', () => {
  it('des parties 100 % bots vont jusqu’au bout, avec un gagnant', () => {
    for (const [n, teams] of [
      [4, 1],
      [6, 2],
      [9, 3],
      [16, 4],
      [12, 1],
    ]) {
      for (let seed = 1; seed <= 4; seed++) {
        const rng = createRng(seed);
        const e = new KohLantaEngine(Array.from({ length: n }, (_, i) => ({ name: `B${i}`, isBot: true })), { teams }, seed);
        let guard = 0;
        while (dec(e).kind !== 'gameover') {
          if (++guard > 30000) throw new Error('boucle infinie');
          const d = dec(e);
          if (d.kind === 'challenge') {
            const def = CHALLENGES[d.challenge.game];
            const st: Record<number, ChallengeState> = {};
            for (const id of d.challenge.participants) st[id] = botPlan(def, e.player(id).forme, rng)(def.duration);
            e.submitChallenge(st);
          } else e.dispatch(chooseKLBotCommand(e, rng));
        }
        expect(e.result).not.toBeNull();
      }
    }
  });

  it('le score final classe correctement chaque type d’épreuve', () => {
    const race = CHALLENGES.parcours;
    expect(finalScore(race, { progress: 1, done: true, fallen: false, time: 30, score: 0 })).toBeGreaterThan(finalScore(race, { progress: 1, done: true, fallen: false, time: 40, score: 0 }));
    expect(finalScore(race, { progress: 1, done: true, fallen: false, time: 60, score: 0 })).toBeGreaterThan(finalScore(race, { progress: 0.9, done: false, fallen: false, time: 70, score: 0 }));
    const end = CHALLENGES.paresseux;
    expect(finalScore(end, { progress: 1, done: false, fallen: false, time: 120, score: 0 })).toBeGreaterThan(finalScore(end, { progress: 0.5, done: true, fallen: true, time: 60, score: 0 }));
  });

  it('la vue cache les objets des autres (dont le collier)', () => {
    const e = new KohLantaEngine(humans(6), {}, 10);
    e.player(1).hand.push({ id: 'c', type: 'collier' });
    const v = buildKLView(e, 0);
    expect(v.players[1].hand).toHaveLength(0);
    expect(v.players[1].handCount).toBeGreaterThan(0);
    expect(buildKLView(e, 1).players[1].hand.some((c) => c.type === 'collier')).toBe(true);
  });
});
