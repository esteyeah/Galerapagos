import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameEngine, buildView, type Command, type PlayerConfig } from '../../engine';
import type { AppSettings } from '../settings';
import { useBotLoop, useEngineVersion, type Speed } from '../useBotLoop';
import GameBoard from './GameBoard';

interface Props {
  configs: PlayerConfig[];
  settings: AppSettings;
  onSettings: (p: Partial<AppSettings>) => void;
  onQuit: () => void;
}

/** Partie hors ligne : solo contre des bots ou pass-and-play sur un même appareil. */
export default function LocalGame({ configs, settings, onSettings, onQuit }: Props) {
  const engine = useMemo(() => new GameEngine(configs, { settings: { difficulty: settings.difficulty, weather: settings.weather } }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [version, setVersion] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEngineVersion(engine, setVersion);
  const onBotError = useCallback((m: string) => {
    setError(m);
    setPaused(true);
  }, []);
  useBotLoop(engine, version, paused, speed, onBotError);

  const decision = engine.decision;
  const owner = decision.kind === 'gameover' ? null : engine.player(decision.playerId);
  const humans = engine.players.filter((p) => !p.isBot);
  const multiHuman = humans.length > 1;
  const spectator = humans.length === 0;

  // Pass-and-play : on confirme qui tient l'appareil avant de dévoiler une main.
  const [confirmedViewer, setConfirmedViewer] = useState<number | null>(multiHuman ? null : (humans[0]?.id ?? null));
  const ownerIsHuman = !!owner && !owner.isBot;
  const needsHandover = multiHuman && ownerIsHuman && confirmedViewer !== owner!.id;
  useEffect(() => {
    if (multiHuman && owner?.isBot) setConfirmedViewer(null);
  }, [multiHuman, owner]);
  const viewerId = multiHuman ? (ownerIsHuman && !needsHandover ? owner!.id : null) : (humans[0]?.id ?? null);

  const view = buildView(engine, viewerId, spectator);
  void version;

  const send = useCallback(
    (cmd: Command) => {
      try {
        setError(null);
        engine.dispatch(cmd);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [engine],
  );

  return (
    <>
      <GameBoard
        view={view}
        send={send}
        error={error}
        settings={settings}
        onSettings={onSettings}
        onQuit={onQuit}
        controls={{ speed, setSpeed, paused, setPaused }}
        hideHand={viewerId === null}
      />
      {needsHandover && owner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/95 p-4">
          <div className="panel animate-pop max-w-md p-8 text-center">
            <div className="text-5xl">🫱📱</div>
            <h2 className="mt-3 font-display text-3xl" style={{ color: owner.color }}>Au tour de {owner.name}</h2>
            <p className="mt-2 text-slate-300">Passez l'appareil à {owner.name}. Les autres, détournez les yeux : la main est secrète !</p>
            <button className="btn-primary mt-6 text-lg" onClick={() => setConfirmedViewer(owner.id)}>
              Je suis {owner.name}, afficher ma main
            </button>
          </div>
        </div>
      )}
    </>
  );
}
