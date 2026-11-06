/** Simulation de parties Koh Lanta 100 % bots. Usage : npx tsx scripts/sim-kl.ts [parties] [joueurs] [équipes] */
import { KohLantaEngine, chooseKLBotCommand, botPlan, CHALLENGES, type ChallengeState } from '../src/engine/kohlanta';
import { createRng } from '../src/engine';

const games = Number(process.argv[2] ?? 200);
const n = Number(process.argv[3] ?? 12);
const teams = Number(process.argv[4] ?? 2);
let days = 0, abandons = 0, councils = 0, winners = 0, mergedAt = 0, fireNights = 0;
for (let g = 0; g < games; g++) {
  const rng = createRng(g + 11);
  const e = new KohLantaEngine(Array.from({ length: n }, (_, i) => ({ name: `B${i}`, isBot: true })), { teams }, g + 1);
  let guard = 0;
  let merged = false;
  while (e.decision.kind !== 'gameover') {
    if (++guard > 20000) throw new Error('boucle infinie');
    const d = e.decision;
    if (d.kind === 'challenge') {
      const def = CHALLENGES[d.challenge.game];
      const states: Record<number, ChallengeState> = {};
      for (const id of d.challenge.participants) states[id] = botPlan(def, e.player(id).forme, rng)(def.duration);
      e.submitChallenge(states);
    } else e.dispatch(chooseKLBotCommand(e, rng));
    if (!merged && e.merged) { merged = true; mergedAt += e.alivePlayers.length; }
  }
  days += e.day;
  abandons += e.players.filter((p) => p.eliminatedHow === 'Abandon médical').length;
  councils += e.players.filter((p) => p.eliminatedHow === 'Éliminé au conseil').length;
  if (e.result?.winnerId !== null) winners++;
  fireNights += e.log.filter((l) => l.text.includes('au coin du feu')).length / Math.max(1, e.log.filter((l) => l.text.includes('🌙')).length);
}
console.log(`${games} parties · ${n} joueurs · ${teams} équipe(s)`);
console.log(`  Durée ${(days / games).toFixed(1)} j | abandons ${(abandons / games).toFixed(1)} | éliminés au conseil ${(councils / games).toFixed(1)} | gagnant désigné ${winners}/${games} | réunif. à ${(mergedAt / games).toFixed(1)} | nuits avec feu ${(fireNights / games * 100).toFixed(0)} %`);
