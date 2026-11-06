/** Démo console : une partie complète entre bots. Usage : npm run demo -- [graine] [facile|normal|difficile] [meteo|sans] */
import { GameEngine, chooseBotCommand, createRng, type Difficulty } from '../src/engine';

const seed = Number(process.argv[2] ?? 2026);
const difficulty = (process.argv[3] ?? 'normal') as Difficulty;
const weather = (process.argv[4] ?? 'meteo') !== 'sans';
const names = ['Robin', 'Selma', 'Kenji', 'Ana', 'Tom'];
const engine = new GameEngine(names.map((name) => ({ name, isBot: true })), { seed, settings: { difficulty, weather } });
const rng = createRng(seed);

let printed = 0;
const flush = () => {
  for (; printed < engine.log.length; printed++) {
    const e = engine.log[printed];
    if (e.type === 'day') {
      const r = engine.resources;
      console.log(`\n\x1b[1m${e.text}\x1b[0m   [💧${r.water} 🐟${r.food} 🪵${r.wood} (${engine.places} places) | ${engine.alivePlayers.length} vivants]`);
    } else if (e.text) {
      console.log(`  ${e.text}${e.privateText ? `  \x1b[2m(${e.privateText})\x1b[0m` : ''}`);
    }
  }
};
flush();
while (engine.decision.kind !== 'gameover' && engine.day <= 60) {
  engine.dispatch(chooseBotCommand(engine, rng));
  flush();
}
console.log('\nCaractères :', engine.players.map((p) => `${p.name}=${p.personality}${p.alive ? '' : ' 💀'}`).join(', '));
