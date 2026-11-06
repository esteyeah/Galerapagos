import { describe, expect, it } from 'vitest';
import { GameEngine, GameError, VoteSystem, Deck, buildView, createRng, createWeatherDeck, chooseBotCommand, successChance } from '..';
import type { Card, CardType, Decision, GameSettings, ResourceAction, WeatherKind } from '..';
import { weatherCard } from '../Deck';

let uid = 0;
const card = (type: CardType): Card => ({ id: `t${++uid}`, type });

function makeGame(n = 3, settings: Partial<GameSettings> = {}, seed = 42): GameEngine {
  const g = new GameEngine(
    Array.from({ length: n }, (_, i) => ({ name: `J${i}`, isBot: false })),
    { seed, settings },
  );
  for (const p of g.players) p.hand = [];
  if (g.weather) g.weather = weatherCard('nuageux');
  return g;
}

const current = (g: GameEngine): Decision => g.decision;
const actor = (g: GameEngine): number => (g.decision as { playerId: number }).playerId;

/** Sac truqué : toujours blanc (ok) ou toujours noir. */
function rigBag(g: GameEngine, outcome: 'white' | 'black'): void {
  g.bag.white = outcome === 'white' ? 6 : 0;
  g.bag.black = outcome === 'white' ? 0 : 6;
}

function setWeather(g: GameEngine, kind: WeatherKind): void {
  g.weather = weatherCard(kind);
}

/** Fait jouer la même action à tous les joueurs restants de la journée en cours. */
function finishActions(g: GameEngine, action: ResourceAction | 'wreck' | 'rest' = 'rest', draws = 1): void {
  const day = g.day;
  while (g.decision.kind === 'action' && g.day === day) {
    const pid = actor(g);
    if (action === 'rest') g.dispatch({ type: 'rest', playerId: pid });
    else g.dispatch({ type: 'action', playerId: pid, action, draws });
  }
}

function voteAll(g: GameEngine, plan: (voter: number, candidates: number[]) => number): void {
  for (let d = current(g); d.kind === 'vote'; d = current(g)) {
    g.dispatch({ type: 'vote', playerId: d.playerId, targetId: plan(d.playerId, d.candidates) });
  }
}

function runBotGame(g: GameEngine, seed: number, maxDays = 60): void {
  const rng = createRng(seed);
  let guard = 0;
  while (g.decision.kind !== 'gameover' && g.day <= maxDays) {
    g.dispatch(chooseBotCommand(g, rng));
    if (++guard > 50000) throw new Error('boucle infinie');
  }
}

describe('Mise en place & difficultés', () => {
  it('refuse moins de 3 ou plus de 8 joueurs', () => {
    expect(() => new GameEngine([{ name: 'a', isBot: true }, { name: 'b', isBot: true }])).toThrow(GameError);
    expect(() => new GameEngine(Array.from({ length: 9 }, (_, i) => ({ name: `${i}`, isBot: true })))).toThrow(GameError);
  });

  it('les difficultés changent ressources, cartes de départ et sac', () => {
    const mk = (difficulty: GameSettings['difficulty']) =>
      new GameEngine(Array.from({ length: 4 }, (_, i) => ({ name: `J${i}`, isBot: true })), { seed: 1, settings: { difficulty } });
    const [f, n, d] = [mk('facile'), mk('normal'), mk('difficile')];
    expect(f.resources.water).toBeGreaterThan(n.resources.water);
    expect(f.players[0].hand.length).toBeGreaterThan(n.players[0].hand.length);
    expect(n.players[0].hand.length).toBeGreaterThan(d.players[0].hand.length);
    expect(successChance(f.bag, 3)).toBeGreaterThan(successChance(n.bag, 3));
    expect(successChance(n.bag, 3)).toBeGreaterThan(successChance(d.bag, 3));
  });

  it("le mode sans météo n'a ni météo ni ouragan", () => {
    const g = makeGame(3, { weather: false });
    expect(g.weather).toBeNull();
    expect(g.hurricaneWindow).toBeNull();
    expect(g.players.flatMap((p) => p.hand).some((c) => c.type === 'longuevue')).toBe(false);
  });
});

describe('Sac de boules', () => {
  it('7 boules dont 1 noire : la probabilité de succès est (7-k)/7', () => {
    const g = makeGame();
    for (let k = 1; k <= 6; k++) expect(successChance(g.bag, k)).toBeCloseTo((7 - k) / 7);
  });

  it('que des blanches : on gagne autant que de boules piochées (+1 avec l\'outil)', () => {
    const g = makeGame();
    rigBag(g, 'white');
    const food = g.resources.food;
    g.dispatch({ type: 'action', playerId: actor(g), action: 'fish', draws: 4 });
    expect(g.resources.food).toBe(food + 4);
    const p2 = actor(g);
    g.player(p2).addCard(card('hache'));
    g.dispatch({ type: 'action', playerId: p2, action: 'wood', draws: 3 });
    expect(g.resources.wood).toBe(4);
  });

  it("la météo ajoute de l'eau en cas de succès, et la sécheresse empêche la collecte", () => {
    const g = makeGame();
    rigBag(g, 'white');
    setWeather(g, 'deluge');
    const water = g.resources.water;
    g.dispatch({ type: 'action', playerId: actor(g), action: 'water', draws: 2 });
    expect(g.resources.water).toBe(water + 4);
    setWeather(g, 'nuageux');
    g.dispatch({ type: 'action', playerId: actor(g), action: 'water', draws: 2 });
    expect(g.resources.water).toBe(water + 6);
    setWeather(g, 'secheresse');
    expect(() => g.dispatch({ type: 'action', playerId: actor(g), action: 'water', draws: 1 })).toThrow(GameError);
  });

  it('une boule noire : rien gagné et une maladie ; deux maladies = la mort', () => {
    const g = makeGame();
    rigBag(g, 'black');
    const pid = actor(g);
    g.dispatch({ type: 'action', playerId: pid, action: 'wood', draws: 3 });
    expect(g.resources.wood).toBe(0);
    expect(g.player(pid).diseases).toBe(1);
    g.player(pid).addCard(card('canne'));
    // on agit malade : risque de mourir
    finishActions(g, 'rest');
    // jour 2 (pas de pénurie : stocks larges)
    while (actor(g) !== pid) g.dispatch({ type: 'rest', playerId: actor(g) });
    g.dispatch({ type: 'action', playerId: pid, action: 'fish', draws: 1 });
    expect(g.player(pid).alive).toBe(false);
    expect(g.alivePlayers.flatMap((p) => p.hand).some((c) => c.type === 'canne')).toBe(true);
  });

  it('passer son tour guérit une seule maladie', () => {
    const g = makeGame();
    const p = g.player(actor(g));
    p.diseases = 1;
    g.dispatch({ type: 'rest', playerId: p.id });
    expect(p.diseases).toBe(0);
  });

  it('la trousse de secours soigne un autre joueur', () => {
    const g = makeGame();
    const me = g.player(actor(g));
    const other = g.alivePlayers.find((o) => o.id !== me.id)!;
    other.diseases = 1;
    const s = card('soins');
    me.addCard(s);
    g.dispatch({ type: 'playCard', playerId: me.id, cardId: s.id, targetId: other.id });
    expect(other.diseases).toBe(0);
  });
});

describe('Cartes : dons, échanges, cartes montrées', () => {
  it('donner une carte pendant son tour', () => {
    const g = makeGame();
    const me = g.player(actor(g));
    const other = g.alivePlayers.find((o) => o.id !== me.id)!;
    const c = card('gourde');
    me.addCard(c);
    g.dispatch({ type: 'give', playerId: me.id, cardId: c.id, targetId: other.id });
    expect(other.getCard(c.id)).toBeDefined();
    expect(me.hand).toHaveLength(0);
    expect(g.decision).toMatchObject({ kind: 'action', playerId: me.id }); // ne consomme pas l'action
  });

  it("proposer un échange : l'autre accepte en choisissant sa carte, ou refuse", () => {
    const g = makeGame();
    const me = g.player(actor(g));
    const other = g.alivePlayers.find((o) => o.id !== me.id)!;
    const mine = card('cartouche');
    const theirs = card('hache');
    me.addCard(mine);
    other.addCard(theirs);
    g.dispatch({ type: 'proposeTrade', playerId: me.id, cardId: mine.id, targetId: other.id });
    expect(g.decision).toMatchObject({ kind: 'trade', playerId: other.id, fromId: me.id });
    g.dispatch({ type: 'answerTrade', playerId: other.id, accept: true, cardId: theirs.id });
    expect(me.has('hache')).toBe(true);
    expect(other.has('cartouche')).toBe(true);
    expect(g.decision).toMatchObject({ kind: 'action', playerId: me.id });

    g.dispatch({ type: 'proposeTrade', playerId: me.id, cardId: theirs.id, targetId: other.id });
    g.dispatch({ type: 'answerTrade', playerId: other.id, accept: false });
    expect(me.has('hache')).toBe(true);
    expect(() => g.dispatch({ type: 'proposeTrade', playerId: me.id, cardId: theirs.id, targetId: other.id })).toThrow(GameError); // 2 max
  });

  it('une carte montrée devient visible des autres, les autres restent cachées', () => {
    const g = makeGame();
    const p = g.players[0];
    const shown = card('fusil');
    const hidden = card('tole');
    p.addCard(shown);
    p.addCard(hidden);
    g.dispatch({ type: 'reveal', playerId: 0, cardId: shown.id }); // possible même hors de son tour
    const view = buildView(g, 1);
    expect(view.players[0].visibleCards.map((c) => c.type)).toEqual(['fusil']);
    expect(view.players[0].handCount).toBe(2);
    expect(buildView(g, 0).players[0].visibleCards).toHaveLength(2);
  });
});

describe('Radeau', () => {
  it('une place = 4 bois ; bateau gonflable + scotch = une place de plus', () => {
    const g = makeGame();
    g.resources.wood = 7;
    expect(g.places).toBe(1);
    const me = g.player(actor(g));
    const b = card('bateau');
    const s = card('scotch');
    me.addCard(b);
    me.addCard(s);
    g.dispatch({ type: 'playCard', playerId: me.id, cardId: b.id });
    expect(g.places).toBe(1);
    g.dispatch({ type: 'playCard', playerId: me.id, cardId: s.id });
    expect(g.places).toBe(2);
  });
});

describe('Pénurie : votes de privation', () => {
  it('les cartes personnelles peuvent combler la pénurie', () => {
    const g = makeGame();
    g.resources.water = 1;
    g.players[0].addCard(card('gourde'));
    finishActions(g, 'rest');
    expect(g.decision).toMatchObject({ kind: 'contribute', playerId: 0, shortWater: 2 });
    g.dispatch({ type: 'playCard', playerId: 0, cardId: g.players[0].hand[0].id });
    expect(g.decision).toMatchObject({ kind: 'action' });
    expect(g.day).toBe(2);
    expect(g.players.every((p) => p.diseases === 0)).toBe(true);
  });

  it('un vote désigne qui est privé : il tombe malade mais ne meurt pas', () => {
    const g = makeGame();
    g.resources.water = 2;
    finishActions(g, 'rest');
    expect(current(g)).toMatchObject({ kind: 'vote', reason: 'water', remaining: 1 });
    voteAll(g, (voter) => (voter === 1 ? 0 : 1));
    expect(g.players[1].alive).toBe(true);
    expect(g.players[1].diseases).toBe(1);
    expect(g.resources.water).toBe(0);
    expect(g.day).toBe(2);
  });

  it('priver un joueur déjà malade le tue', () => {
    const g = makeGame();
    g.resources.food = 2;
    g.players[2].diseases = 1;
    finishActions(g, 'rest');
    g.players[2].diseases = 1; // il s'est peut-être reposé
    voteAll(g, (voter) => (voter === 2 ? 0 : 2));
    expect(g.players[2].alive).toBe(false);
    expect(g.players[2].deathCause).toBe('Mort de faim');
  });

  it("en cas d'égalité, tirage au sort parmi les ex aequo", () => {
    for (let seed = 1; seed < 15; seed++) {
      const g = makeGame(4, {}, seed);
      g.resources.water = 3;
      finishActions(g, 'rest');
      voteAll(g, (voter) => (voter === 0 || voter === 2 ? 1 : 0));
      const victims = g.players.filter((p) => p.diseases > 0).map((p) => p.id);
      expect(victims).toHaveLength(1);
      expect([0, 1]).toContain(victims[0]);
    }
  });

  it('il faut autant de votes que de portions manquantes, sans désigner deux fois la même personne', () => {
    const g = makeGame(4);
    g.resources.water = 2;
    finishActions(g, 'rest');
    voteAll(g, (_voter, cands) => cands[0]);
    const designated = g.voteHistory.filter((r) => r.reason === 'water').map((r) => r.victimId!);
    expect(designated).toHaveLength(2);
    expect(g.players.filter((p) => p.diseases === 1)).toHaveLength(2);
    expect(new Set(designated).size).toBe(2);
  });

  it('la plaque de tôle protège le désigné', () => {
    const g = makeGame();
    g.resources.water = 2;
    finishActions(g, 'rest');
    g.players[1].addCard(card('tole'));
    voteAll(g, (voter) => (voter === 1 ? 0 : 1));
    expect(g.decision).toMatchObject({ kind: 'shield', playerId: 1, source: 'vote' });
    g.dispatch({ type: 'shield', playerId: 1, use: true });
    for (let d = current(g); d.kind === 'vote'; d = current(g)) {
      expect(d.allCandidates).not.toContain(1);
      g.dispatch({ type: 'vote', playerId: d.playerId, targetId: d.playerId === 2 ? 0 : 2 });
    }
    expect(g.players[1].diseases).toBe(0);
    expect(g.players[2].diseases).toBe(1);
  });

  it('un tir de fusil tue directement et le tireur récupère les cartes', () => {
    const g = makeGame();
    g.resources.water = 2;
    finishActions(g, 'rest');
    const voter = actor(g);
    const shooter = g.player(voter);
    shooter.addCard(card('fusil'));
    shooter.addCard(card('cartouche'));
    const victim = g.alivePlayers.find((p) => p.id !== voter)!;
    victim.addCard(card('canne'));
    expect(g.decision).toMatchObject({ kind: 'vote', canShoot: true });
    g.dispatch({ type: 'shoot', playerId: voter, targetId: victim.id });
    expect(victim.alive).toBe(false);
    expect(shooter.has('canne')).toBe(true);
    expect(g.day).toBe(2); // plus que 2 survivants : l'eau suffit
  });
});

describe('Fin de partie', () => {
  it('la tribu peut voter pour fuir quand radeau et vivres suffisent', () => {
    const g = makeGame();
    g.resources.water = 6;
    g.resources.food = 6;
    g.resources.wood = 12;
    finishActions(g, 'rest');
    expect(g.decision.kind).toBe('flee');
    while (g.decision.kind === 'flee') g.dispatch({ type: 'flee', playerId: actor(g), yes: true });
    expect(g.result).toMatchObject({ victory: true });
    expect(g.result?.survivors).toHaveLength(3);
  });

  it("si l'ouragan arrive sans radeau, tout le monde meurt", () => {
    const g = makeGame();
    g.lastDay = true;
    g.resources.water = 10;
    g.resources.food = 10;
    finishActions(g, 'rest');
    expect(g.result).toMatchObject({ victory: false });
    expect(g.alivePlayers).toHaveLength(0);
  });

  it("le jour de l'ouragan, ceux qui n'ont pas de place sont désignés par vote", () => {
    const g = makeGame();
    g.lastDay = true;
    g.resources.water = 10;
    g.resources.food = 10;
    g.resources.wood = 8;
    finishActions(g, 'rest');
    expect(g.decision).toMatchObject({ kind: 'vote', reason: 'departure' });
    voteAll(g, (_v, cands) => cands[0]);
    expect(g.result).toMatchObject({ victory: true });
    expect(g.result?.survivors).toHaveLength(2);
  });

  it('les parties 100 % bots se terminent (toutes difficultés, avec et sans météo)', () => {
    for (const difficulty of ['facile', 'normal', 'difficile'] as const) {
      for (const weather of [true, false]) {
        for (let seed = 1; seed <= 12; seed++) {
          const n = 3 + (seed % 6);
          const g = new GameEngine(Array.from({ length: n }, (_, i) => ({ name: `B${i}`, isBot: true })), { seed, settings: { difficulty, weather } });
          runBotGame(g, seed);
          if (weather) {
            expect(g.result).not.toBeNull();
            expect(g.day).toBeLessThanOrEqual(g.hurricaneWindow![1]);
          }
          if (g.result?.victory) expect(g.result.survivors.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Vue filtrée', () => {
  it('cache les mains et les informations privées des autres joueurs', () => {
    const g = makeGame();
    rigBag(g, 'white');
    const pid = actor(g);
    g.dispatch({ type: 'action', playerId: pid, action: 'wreck' });
    const other = (pid + 1) % 3;
    const mine = buildView(g, pid);
    const theirs = buildView(g, other);
    expect(mine.players[pid].visibleCards).toHaveLength(1);
    expect(theirs.players[pid].visibleCards).toHaveLength(0);
    expect(theirs.players[pid].handCount).toBe(1);
    expect(mine.log.at(-1)?.privateText).toBeDefined();
    expect(theirs.log.at(-1)?.privateText).toBeUndefined();
    expect(JSON.parse(JSON.stringify(theirs))).toEqual(theirs); // sérialisable
  });
});

describe('VoteSystem & Deck', () => {
  it('compte les voix et détecte les égalités', () => {
    const v = new VoteSystem([0, 1, 2, 3], [0, 1, 2, 3]);
    expect(() => v.cast(0, 0)).toThrow();
    v.cast(0, 1);
    v.cast(1, 0);
    v.cast(2, 1);
    v.cast(3, 0);
    expect(v.isComplete()).toBe(true);
    expect(v.leaders().sort()).toEqual([0, 1]);
  });

  it('remélange la défausse quand la pioche est vide', () => {
    const d = new Deck([1, 2], createRng(1));
    d.draw();
    d.discard(d.draw()!);
    expect(d.draw()).toBe(2);
  });

  it("le paquet météo se termine par l'ouragan dans la fenêtre prévue", () => {
    for (let s = 1; s < 50; s++) {
      const cards = [...createWeatherDeck(createRng(s), 12, 15).toArray()];
      expect(cards.at(-1)?.hurricane).toBe(true);
      expect(cards.length).toBeGreaterThanOrEqual(12);
      expect(cards.length).toBeLessThanOrEqual(15);
      expect(cards.slice(0, -1).some((c) => c.kind === 'nuageux')).toBe(true);
    }
  });
});
