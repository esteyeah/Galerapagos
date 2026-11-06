import { useState } from 'react';
import type { Personality, PlayerConfig } from '../../engine';

const BOT_NAMES = ['Robin', 'Selma', 'Kenji', 'Ana', 'Tom', 'Lina', 'Oscar', 'Maé', 'Iris'];
export type Row = { name: string; isBot: boolean; personality: Personality | 'random' };

const solo = (n: number, me: string): Row[] =>
  Array.from({ length: n }, (_, i) => ({ name: i === 0 ? me : BOT_NAMES.filter((b) => b !== me)[i - 1], isBot: i > 0, personality: 'random' }));
const hotseat = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ name: `Joueur ${i + 1}`, isBot: false, personality: 'random' }));

export function PersonalitySelect({ value, onChange }: { value: Row['personality']; onChange: (v: Row['personality']) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Row['personality'])} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-sm">
      <option value="random">Caractère aléatoire</option>
      <option value="cooperatif">🤝 Coopératif</option>
      <option value="egoiste">💰 Égoïste</option>
      <option value="paranoiaque">👀 Paranoïaque</option>
    </select>
  );
}

export default function LocalSetup({ playerName, onStart, onBack }: { playerName: string; onStart: (c: PlayerConfig[]) => void; onBack: () => void }) {
  const [rows, setRows] = useState<Row[]>(solo(5, playerName));

  const setCount = (n: number) =>
    setRows((r) => {
      if (n <= r.length) return r.slice(0, n);
      const used = new Set(r.map((x) => x.name));
      const extra: Row[] = [];
      for (const name of BOT_NAMES) {
        if (r.length + extra.length >= n) break;
        if (!used.has(name)) extra.push({ name, isBot: true, personality: 'random' });
      }
      return [...r, ...extra];
    });
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const names = rows.map((r) => r.name.trim());
  const valid = names.every((n) => n.length > 0) && new Set(names).size === names.length;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 py-10">
      <button className="self-start text-sm text-slate-400 hover:text-slate-200" onClick={onBack}>← Retour au menu</button>
      <section className="panel p-5">
        <h2 className="font-display text-3xl text-amber-300">Partie hors ligne</h2>
        <div className="my-4 flex flex-wrap items-center gap-2">
          <span className="mr-2 font-semibold">Mode rapide :</span>
          <button className="btn-ghost" onClick={() => setRows(solo(rows.length, playerName))}>🤖 Solo contre des bots</button>
          <button className="btn-ghost" onClick={() => setRows(hotseat(rows.length))}>🫱 Pass-and-play</button>
        </div>
        <label className="mb-4 flex items-center gap-3">
          <span className="font-semibold">Naufragés :</span>
          <input id="player-count" type="range" min={3} max={8} value={rows.length} onChange={(e) => setCount(Number(e.target.value))} className="flex-1 accent-amber-400" />
          <span className="w-6 text-center font-display text-2xl text-amber-300">{rows.length}</span>
        </label>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-2">
              <input
                id={`player-name-${i}`}
                value={r.name}
                maxLength={14}
                onChange={(e) => update(i, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 outline-none focus:border-amber-400"
              />
              <div className="flex overflow-hidden rounded-lg border border-white/10 text-sm">
                <button className={`px-3 py-1.5 ${!r.isBot ? 'bg-amber-400 text-slate-900' : ''}`} onClick={() => update(i, { isBot: false })}>🧑 Humain</button>
                <button className={`px-3 py-1.5 ${r.isBot ? 'bg-cyan-500 text-slate-900' : ''}`} onClick={() => update(i, { isBot: true })}>🤖 Bot</button>
              </div>
              {r.isBot && <PersonalitySelect value={r.personality} onChange={(personality) => update(i, { personality })} />}
            </li>
          ))}
        </ul>
        {!valid && <p className="mt-2 text-sm text-rose-300">Chaque naufragé a besoin d'un nom unique.</p>}
        <div className="mt-4 flex justify-end">
          <button
            className="btn-primary text-lg"
            disabled={!valid}
            onClick={() => onStart(rows.map((r) => ({ name: r.name.trim(), isBot: r.isBot, personality: r.personality === 'random' ? undefined : r.personality })))}
          >
            Échouer sur l'île →
          </button>
        </div>
      </section>
    </div>
  );
}
