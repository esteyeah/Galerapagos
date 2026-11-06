import { WOOD_PER_PLACE, type GameView } from '../../engine';

const WEATHER_ICON = { secheresse: '☀️', nuageux: '☁️', averse: '🌦️', deluge: '⛈️', ouragan: '🌀' } as const;

function Gauge({ icon, label, value, night, goal, color, footer }: { icon: string; label: string; value: number; night?: number; goal: number; color: string; footer: React.ReactNode }) {
  const max = Math.max(goal, value, 1) * 1.15;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const danger = night !== undefined && value < night;
  const ready = value >= goal;
  return (
    <div className="panel flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-300">
          {icon} {label}
        </span>
        <span className={`font-display text-3xl tabular-nums ${danger ? 'text-rose-400' : ready ? 'text-emerald-300' : 'text-slate-50'}`}>{value}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: pct(value), background: color }} />
        {night !== undefined && <div className="absolute top-0 h-full w-0.5 bg-rose-300/80" style={{ left: pct(night) }} title="Consommation de ce soir" />}
        <div className="absolute top-0 h-full w-0.5 bg-emerald-300" style={{ left: pct(goal) }} title="Objectif de départ" />
      </div>
      <div className="text-xs text-slate-400">{footer}</div>
    </div>
  );
}

export default function Dashboard({ view }: { view: GameView }) {
  const n = view.players.filter((p) => p.alive).length;
  const w = view.weather;
  const { water, food, wood } = view.resources;
  const boatPlace = view.boat.hull && view.boat.tape ? 1 : 0;
  const woodGoal = Math.max(0, n - boatPlace) * WOOD_PER_PLACE;
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className={`panel flex items-center gap-3 p-3 ${w?.hurricane ? 'border-rose-400/60 bg-rose-950/50' : ''}`}>
        <div className="text-5xl">{w ? w.hurricane ? <span className="animate-storm">🌀</span> : WEATHER_ICON[w.kind] : '🏝️'}</div>
        <div className="min-w-0">
          <div className="font-display text-2xl">Jour {view.day}</div>
          <div className={w?.hurricane ? 'font-bold text-rose-300' : 'text-slate-300'}>{w ? w.label : 'Sans météo'}</div>
          <div className="text-xs text-slate-400">
            {!w ? 'Fin : évasion ou mort de tous' : w.hurricane ? 'Le radeau part ce soir !' : !w.canCollect ? "Pas de collecte d'eau" : w.waterBonus ? `+${w.waterBonus} 💧 si collecte réussie` : 'Collecte sans bonus'}
          </div>
        </div>
      </div>
      <Gauge icon="💧" label="Eau" value={water} night={n} goal={2 * n} color="linear-gradient(90deg,#0ea5e9,#67e8f9)" footer={<>Ce soir : <b className={water < n ? 'text-rose-300' : ''}>{n}</b> · Départ : <b>{2 * n}</b></>} />
      <Gauge icon="🐟" label="Nourriture" value={food} night={n} goal={2 * n} color="linear-gradient(90deg,#f97316,#fcd34d)" footer={<>Ce soir : <b className={food < n ? 'text-rose-300' : ''}>{n}</b> · Départ : <b>{2 * n}</b></>} />
      <Gauge
        icon="🪵"
        label="Bois du radeau"
        value={wood}
        goal={woodGoal}
        color="linear-gradient(90deg,#a16207,#d6a35c)"
        footer={
          <>
            Places : <b className={view.places >= n ? 'text-emerald-300' : ''}>{view.places}</b> / {n} · {WOOD_PER_PLACE} 🪵 par place
            {view.boat.hull || view.boat.tape ? <span className="ml-1">· 🛶 {boatPlace ? 'réparé' : view.boat.hull ? 'troué' : 'scotch posé'}</span> : null}
          </>
        }
      />
      <div className="panel flex flex-col justify-center gap-1 p-3 text-sm">
        {view.hurricaneWindow ? (
          <div>
            🌀 Ouragan : <b>jour {view.hurricaneWindow[0]} à {view.hurricaneWindow[1]}</b>
          </div>
        ) : (
          <div>🌀 Pas d'ouragan</div>
        )}
        <div>
          🧍 Survivants : <b>{n}</b> / {view.players.length}
        </div>
        <div title="Composition du sac pour pêcher, recueillir l'eau et couper du bois">
          🎱 Sac : <b>{view.bag.white} ⚪ + {view.bag.black} ⚫</b>
        </div>
        <div>
          🛳️ Épave : <b>{view.wreckRemaining}</b> objets
        </div>
        {view.canFlee && <div className="font-semibold text-emerald-300">⛵ Départ possible !</div>}
      </div>
    </section>
  );
}
