import { useState } from 'react';
import { KL_MAX_PLAYERS, KL_MIN_PLAYERS, type KLPlayerConfig } from '../../engine/kohlanta';
import type { Personality } from '../../engine';
import { PersonalitySelect } from '../components/LocalSetup';
import AvatarPortrait from './AvatarPortrait';
import { SKINS } from './skins';

const BOT_NAMES = ['Robin', 'Selma', 'Kenji', 'Ana', 'Tom', 'Lina', 'Oscar', 'Maé', 'Iris', 'Hugo', 'Nina', 'Malik', 'Jade', 'Théo', 'Léa', 'Sami', 'Zoé'];
type Row = { name: string; isBot: boolean; personality: Personality | 'random'; skin: number };

export function SkinPicker({ value, onChange, team }: { value: number; onChange: (v: number) => void; team?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/60 px-1.5 py-1" onClick={() => setOpen((o) => !o)} title="Choisir son aventurier">
        <AvatarPortrait skin={value} team={team} size={34} />
        <span className="text-xs text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 grid w-72 grid-cols-5 gap-1 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
          {SKINS.map((s) => (
            <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }} className={`flex flex-col items-center rounded-lg p-1 text-[10px] leading-tight ${s.id === value ? 'bg-amber-400/25 ring-1 ring-amber-300' : 'hover:bg-white/10'}`}>
              <AvatarPortrait skin={s.id} team={team} size={40} />
              <span className="mt-0.5 text-center">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KLSetup({ playerName, onStart, onBack, teams, onTeams, weather, onWeather }: {
  playerName: string;
  onStart: (c: KLPlayerConfig[]) => void;
  onBack: () => void;
  teams: number;
  onTeams: (n: number) => void;
  weather: boolean;
  onWeather: (w: boolean) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({ name: i === 0 ? playerName : BOT_NAMES.filter((b) => b !== playerName)[i - 1], isBot: i > 0, personality: 'random', skin: i % SKINS.length })),
  );
  const setCount = (n: number) =>
    setRows((r) => {
      if (n <= r.length) return r.slice(0, n);
      const used = new Set(r.map((x) => x.name));
      const extra: Row[] = [];
      for (const name of BOT_NAMES) {
        if (r.length + extra.length >= n) break;
        if (!used.has(name)) extra.push({ name, isBot: true, personality: 'random', skin: (r.length + extra.length) % SKINS.length });
      }
      return [...r, ...extra];
    });
  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  const names = rows.map((r) => r.name.trim());
  const valid = names.every((n) => n.length > 0) && new Set(names).size === names.length;
  const maxTeams = Math.min(4, Math.floor(rows.length / 2));

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 py-10">
      <button className="self-start text-sm text-slate-400 hover:text-slate-200" onClick={onBack}>← Retour au menu</button>
      <section className="panel p-5">
        <h2 className="font-display text-3xl text-amber-300">🔥 Koh Lanta — hors ligne</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-sm font-semibold">Équipes</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} disabled={n > maxTeams} onClick={() => onTeams(n)} className={`flex-1 rounded-lg px-2 py-2 text-sm disabled:opacity-30 ${Math.min(teams, maxTeams) === n ? 'bg-amber-400 font-bold text-slate-900' : 'bg-white/5'}`}>
                  {n === 1 ? 'Solo' : n}
                </button>
              ))}
            </div>
            <div className="mt-1 text-xs text-slate-400">{teams === 1 ? 'Chacun pour soi dès le début.' : `${teams} équipes jusqu'à la réunification.`}</div>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">Météo</div>
            <div className="flex gap-1">
              <button onClick={() => onWeather(true)} className={`flex-1 rounded-lg px-2 py-2 text-sm ${weather ? 'bg-amber-400 font-bold text-slate-900' : 'bg-white/5'}`}>🌦️ Avec effet</button>
              <button onClick={() => onWeather(false)} className={`flex-1 rounded-lg px-2 py-2 text-sm ${!weather ? 'bg-amber-400 font-bold text-slate-900' : 'bg-white/5'}`}>Sans effet</button>
            </div>
            <div className="mt-1 text-xs text-slate-400">La pluie aide à trouver de l'eau mais peut éteindre le feu. Jamais d'ouragan.</div>
          </div>
        </div>
        <label className="my-4 flex items-center gap-3">
          <span className="font-semibold">Aventuriers :</span>
          <input id="kl-count" type="range" min={KL_MIN_PLAYERS} max={KL_MAX_PLAYERS} value={rows.length} onChange={(e) => setCount(Number(e.target.value))} className="flex-1 accent-amber-400" />
          <span className="w-8 text-center font-display text-2xl text-amber-300">{rows.length}</span>
        </label>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 p-2">
              <SkinPicker value={r.skin} onChange={(skin) => update(i, { skin })} />
              <input id={`kl-name-${i}`} value={r.name} maxLength={14} onChange={(e) => update(i, { name: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 outline-none focus:border-amber-400" />
              <div className="flex overflow-hidden rounded-lg border border-white/10 text-sm">
                <button className={`px-3 py-1.5 ${!r.isBot ? 'bg-amber-400 text-slate-900' : ''}`} onClick={() => update(i, { isBot: false })}>🧑</button>
                <button className={`px-3 py-1.5 ${r.isBot ? 'bg-cyan-500 text-slate-900' : ''}`} onClick={() => update(i, { isBot: true })}>🤖</button>
              </div>
              {r.isBot && <PersonalitySelect value={r.personality} onChange={(personality) => update(i, { personality })} />}
            </li>
          ))}
        </ul>
        {!valid && <p className="mt-2 text-sm text-rose-300">Chaque aventurier a besoin d'un nom unique.</p>}
        <p className="mt-3 text-xs text-slate-400">Plusieurs humains ? Chacun joue les épreuves à son tour sur cet appareil. Pour jouer en même temps, créez une partie en ligne.</p>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary text-lg" disabled={!valid} onClick={() => onStart(rows.map((r) => ({ name: r.name.trim(), isBot: r.isBot, skin: r.skin, personality: r.personality === 'random' ? undefined : r.personality })))}>
            Débarquer sur l'île →
          </button>
        </div>
      </section>
    </div>
  );
}
