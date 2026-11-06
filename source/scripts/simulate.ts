/**
 * Simulation de masse entre bots : sert à équilibrer le jeu.
 * Usage : npm run sim -- [parties] [joueurs] [facile|normal|difficile] [meteo|sans]
 */
import { GameEngine, chooseBotCommand, createRng, type Difficulty } from '../src/engine';

const games = Number(process.argv[2] ?? 300);
const nPlayers = Number(process.argv[3] ?? 5);
const difficulty = (process.argv[4] ?? 'normal') as Difficulty;
const weather = (process.argv[5] ?? 'meteo') !== 'sans';
const MAX_DAYS = 60;

let wins = 0, survivors = 0, days = 0, stalls = 0, deaths = 0, shots = 0, votes = 0, black = 0, draws = 0;
for (let g = 0; g < games; g++) {
  const rng = createRng(g * 7919 + 1);
  const engine = new GameEngine(
    Array.from({ length: nPlayers }, (_, i) => ({ name: `Bot${i + 1}`, isBot: true })),
    { seed: g + 1, settings: { difficulty, weather } },
  );
  let guard = 0;
  while (engine.decision.kind !== 'gameover' && engine.day <= MAX_DAYS) {
    engine.dispatch(chooseBotCommand(engine, rng));
    if (++guard > 50000) throw new Error('Boucle infinie détectée');
  }
  if (engine.decision.kind !== 'gameover') stalls++;
  else if (engine.result!.victory) { wins++; survivors += engine.result!.survivors.length; }
  days += engine.day;
  deaths += engine.players.filter((p) => !p.alive).length;
  shots += engine.log.filter((l) => l.fx?.kind === 'shot').length;
  votes += engine.voteHistory.length;
  for (const l of engine.log) if (l.fx?.kind === 'draw') { draws++; if (l.fx.balls.includes('b')) black++; }
}
console.log(`${games} parties · ${nPlayers} joueurs · ${difficulty} · ${weather ? 'avec météo' : 'sans météo'}`);
console.log(`  Victoires ${((wins / games) * 100).toFixed(1)} % | survivants/victoire ${(survivors / Math.max(1, wins)).toFixed(2)} | morts/partie ${(deaths / games).toFixed(2)} | bloquées ${stalls}`);
console.log(`  Durée ${(days / games).toFixed(1)} j | votes ${(votes / games).toFixed(1)} | tirs ${(shots / games).toFixed(2)} | boules noires ${((black / Math.max(1, draws)) * 100).toFixed(0)} %`);
