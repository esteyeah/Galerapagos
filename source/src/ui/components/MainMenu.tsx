import { useState } from 'react';
import { DIFFICULTY, type Difficulty } from '../../engine';
import type { AppSettings } from '../settings';
import RulesContent from './RulesContent';
import RulesKL from './RulesKL';

interface Props {
  settings: AppSettings;
  onSettings: (p: Partial<AppSettings>) => void;
  onLocal: () => void;
  onHost: () => void;
  onJoin: () => void;
}

const DIFF_TEXT: Record<Difficulty, string> = {
  facile: 'Plus de vivres et de cartes au départ, sac plus clément (1 ⚫ pour 7 ⚪), ouragan tardif.',
  normal: 'L’expérience prévue : 1 ⚫ pour 6 ⚪, réserves correctes.',
  difficile: 'Moins de cartes au départ, sac plus risqué (2 ⚫ pour 10 ⚪), ouragan plus précoce.',
};

function Toggle({ on, onChange, label, icon }: { on: boolean; onChange: (v: boolean) => void; label: string; icon: string }) {
  return (
    <button onClick={() => onChange(!on)} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left ${on ? 'border-amber-300/60 bg-amber-300/10' : 'border-white/10 bg-white/5'}`} aria-pressed={on}>
      <span>
        {icon} {label}
      </span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? 'bg-amber-400' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export default function MainMenu({ settings, onSettings, onLocal, onHost, onJoin }: Props) {
  const [showRules, setShowRules] = useState(false);
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 py-10">
      <header className="text-center">
        <div className="text-6xl">🏝️</div>
        <h1 className="font-display text-5xl font-bold tracking-wide text-amber-300 drop-shadow sm:text-6xl">Naufragés</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-300">Construisez le radeau, remplissez les réserves… et quittez l'île. Quitte à laisser quelqu'un derrière.</p>
      </header>

      <section className="panel p-5">
        <h2 className="mb-3 font-display text-xl text-amber-200">Mode de jeu</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => onSettings({ mode: 'classique' })}
            className={`rounded-xl border p-3 text-left ${settings.mode === 'classique' ? 'border-amber-300/70 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}
          >
            <div className="font-semibold">🛶 Survie classique</div>
            <div className="text-sm text-slate-400">Tous ensemble pour fuir l'île… tant que les vivres suffisent.</div>
          </button>
          <button
            onClick={() => onSettings({ mode: 'kohlanta' })}
            className={`rounded-xl border p-3 text-left ${settings.mode === 'kohlanta' ? 'border-orange-400/80 bg-orange-500/15' : 'border-white/10 bg-white/5'}`}
          >
            <div className="font-semibold">🔥 Koh Lanta <span className="ml-1 rounded bg-orange-500 px-1.5 text-xs text-white">nouveau</span></div>
            <div className="text-sm text-slate-400">Épreuves en 3D, conseils, réunification, finale et jury. Un seul gagnant.</div>
          </button>
        </div>

        {settings.mode === 'kohlanta' && (
          <div className="mt-4 grid gap-3 rounded-xl border border-orange-400/30 bg-orange-500/5 p-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-semibold">Équipes</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} onClick={() => onSettings({ klTeams: n })} className={`flex-1 rounded-lg px-2 py-1.5 text-sm ${settings.klTeams === n ? 'bg-amber-400 font-bold text-slate-900' : 'bg-white/5'}`}>
                    {n === 1 ? 'Solo' : n}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-400">« Solo » : chacun pour soi.</div>
            </div>
            <Toggle icon="🌦️" label="Météo avec effet" on={settings.klWeather} onChange={(klWeather) => onSettings({ klWeather })} />
            <p className="text-xs text-slate-400 sm:col-span-2">
              Cycle de 3 jours : confort, immunité, puis conseil. Feu à allumer (mini-jeu), forme qui influence les récoltes et les épreuves, 3 maladies = abandon. Finale : orientation à 4, poteaux à 3, puis jury.
            </p>
          </div>
        )}

        <h2 className="mb-2 mt-5 font-display text-xl text-amber-200">Difficulté</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
            <button key={d} onClick={() => onSettings({ difficulty: d })} className={`rounded-xl border p-3 text-left ${settings.difficulty === d ? 'border-amber-300/70 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}>
              <div className="font-semibold">{{ facile: '🌴', normal: '⛵', difficile: '🌪️' }[d]} {DIFFICULTY[d].label}</div>
              <div className="text-xs text-slate-400">{DIFF_TEXT[d]}</div>
            </button>
          ))}
        </div>

        <h2 className="mb-2 mt-5 font-display text-xl text-amber-200">Paramètres</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {settings.mode === 'classique' && <Toggle icon="🌦️" label="Météo & ouragan" on={settings.weather} onChange={(weather) => onSettings({ weather })} />}
          <Toggle icon="🎵" label="Musique" on={settings.music} onChange={(music) => onSettings({ music })} />
          <Toggle icon="🔊" label="Bruitages" on={settings.sfx} onChange={(sfx) => onSettings({ sfx })} />
        </div>
        <p className={`mt-2 text-xs text-slate-400 ${settings.mode === 'kohlanta' ? 'hidden' : ''}`}>
          {settings.weather
            ? "Avec météo : la pluie aide à recueillir l'eau, la sécheresse l'empêche, et l'ouragan met fin à la partie."
            : "Sans météo : pas d'ouragan. La partie ne s'arrête que par l'évasion… ou la mort de tous."}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <button className="btn-primary flex-col py-4 text-lg" onClick={onLocal}>
          <span className="text-2xl">🎮</span> Jouer hors ligne
          <span className="text-xs font-normal opacity-80">Solo contre des bots ou pass-and-play</span>
        </button>
        <button className="btn-ghost flex-col py-4 text-lg" onClick={onHost}>
          <span className="text-2xl">🌐</span> Créer une partie en ligne
          <span className="text-xs font-normal opacity-70">Obtenez un code à partager</span>
        </button>
        <button className="btn-ghost flex-col py-4 text-lg" onClick={onJoin}>
          <span className="text-2xl">🔑</span> Rejoindre une partie
          <span className="text-xs font-normal opacity-70">Avec le code d'un ami</span>
        </button>
      </section>

      <div className="text-center">
        <button className="btn-ghost" onClick={() => setShowRules((s) => !s)}>📜 {showRules ? 'Masquer les règles' : 'Lire les règles'}</button>
      </div>
      {showRules && (
        <section className="panel animate-pop p-5">
          {settings.mode === 'kohlanta' ? <RulesKL /> : <RulesContent />}
        </section>
      )}
    </div>
  );
}
