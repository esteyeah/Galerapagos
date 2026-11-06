import { useState, type ReactNode } from 'react';
import type { Command, GameView } from '../../engine';
import type { AppSettings } from '../settings';
import { SPEEDS, type Speed } from '../useBotLoop';
import { useFx } from '../useFx';
import Dashboard from './Dashboard';
import PlayerList from './PlayerList';
import DecisionPanel from './DecisionPanel';
import Hand from './Hand';
import EventLog from './EventLog';
import GameOver from './GameOver';
import RulesContent from './RulesContent';
import { ActionSpotlight, DeathOverlay } from './Effects';
import PlayerDetails from './PlayerDetails';

export interface BotControls {
  speed: Speed;
  setSpeed: (s: Speed) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
}

interface Props {
  view: GameView;
  send: (c: Command) => void;
  error: string | null;
  settings: AppSettings;
  onSettings: (p: Partial<AppSettings>) => void;
  onQuit: () => void;
  controls?: BotControls;
  presence?: Record<number, boolean>;
  onReplaceWithBot?: (seat: number) => void;
  banner?: ReactNode;
  /** Masque la main (pass-and-play pendant le tour d'un autre). */
  hideHand?: boolean;
}

export default function GameBoard({ view, send, error, settings, onSettings, onQuit, controls, presence, onReplaceWithBot, banner, hideHand }: Props) {
  const [showRules, setShowRules] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const fx = useFx(view.log);
  const activeId = view.decision.kind === 'gameover' ? null : view.decision.playerId;

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold text-amber-300">🏝️ Naufragés</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button className="btn-ghost px-3 py-1" onClick={() => onSettings({ music: !settings.music })} title="Musique">{settings.music ? '🎵' : '🔇'} Musique</button>
          <button className="btn-ghost px-3 py-1" onClick={() => onSettings({ sfx: !settings.sfx })} title="Bruitages">{settings.sfx ? '🔊' : '🔈'} Sons</button>
          {controls && (
            <>
              <span className="text-slate-400">Bots</span>
              {(Object.keys(SPEEDS) as Speed[]).map((s) => (
                <button key={s} onClick={() => controls.setSpeed(s)} className={`rounded-lg px-2 py-1 capitalize ${controls.speed === s ? 'bg-cyan-500 text-slate-900' : 'bg-white/5 hover:bg-white/10'}`}>
                  {s}
                </button>
              ))}
              <button className="btn-ghost px-3 py-1" onClick={() => controls.setPaused(!controls.paused)}>{controls.paused ? '▶️ Reprendre' : '⏸️ Pause'}</button>
            </>
          )}
          <button className="btn-ghost px-3 py-1" onClick={() => setShowRules(true)}>📜 Règles</button>
          {confirmQuit ? (
            <span className="flex items-center gap-1">
              <span className="text-rose-200">Quitter ?</span>
              <button className="btn-danger px-3 py-1" onClick={onQuit}>Oui</button>
              <button className="btn-ghost px-3 py-1" onClick={() => setConfirmQuit(false)}>Non</button>
            </span>
          ) : (
            <button className="btn-ghost px-3 py-1" onClick={() => setConfirmQuit(true)}>🚪 Quitter</button>
          )}
        </div>
      </header>

      {banner}
      <Dashboard view={view} />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PlayerList view={view} activeId={activeId} presence={presence} bubbles={fx.bubbles} onReplaceWithBot={onReplaceWithBot} onSelect={setSelected} />
          <DecisionPanel view={view} send={send} paused={controls?.paused} />
          {error && <div className="animate-pop rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-rose-200">⚠️ {error}</div>}
          {!hideHand && <Hand view={view} send={send} />}
        </div>
        <EventLog log={view.log} />
      </div>

      <ActionSpotlight entry={fx.spot} view={view} />
      <DeathOverlay entry={fx.death} view={view} onDone={fx.dismissDeath} />
      {view.result && showResult && !fx.death && <GameOver view={view} onClose={() => setShowResult(false)} onQuit={onQuit} />}

      {selected !== null && <PlayerDetails view={view} playerId={selected} onClose={() => setSelected(null)} />}

      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setShowRules(false)}>
          <div className="panel animate-pop max-h-[85vh] max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <RulesContent />
            <button className="btn-primary mt-4" onClick={() => setShowRules(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
