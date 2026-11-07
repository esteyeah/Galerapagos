import { useCallback, useEffect, useMemo, useState } from 'react';
import { KohLantaEngine, buildKLView, chooseKLBotCommand, type KLCommand, type KLPlayerConfig, type KLSettings } from '../../engine/kohlanta';
import type { AppSettings } from '../settings';
import { SPEEDS, type Speed } from '../useBotLoop';
import KLBoard from './KLBoard';
import KLChallenge from './KLChallenge';
import AvatarPortrait from './AvatarPortrait';

interface Props {
  configs: KLPlayerConfig[];
  klSettings: KLSettings;
  settings: AppSettings;
  onSettings: (p: Partial<AppSettings>) => void;
  onQuit: () => void;
}

/** Partie Koh Lanta hors ligne : solo contre des bots ou pass-and-play. */
export default function KLLocalGame({ configs, klSettings, settings, onSettings, onQuit }: Props) {
  const engine = useMemo(() => new KohLantaEngine(configs, klSettings), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [version, setVersion] = useState(0);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => engine.subscribe(() => setVersion((v) => v + 1)), [engine]);

  const d = engine.decision;
  const owner = 'playerId' in d ? engine.player(d.playerId) : null;

  // Bots (hors épreuves)
  useEffect(() => {
    if (!owner || !owner.isBot || paused) return;
    const delay = d.kind === 'action' ? SPEEDS[speed] : Math.round(SPEEDS[speed] * 0.45);
    const t = setTimeout(() => {
      try {
        engine.dispatch(chooseKLBotCommand(engine));
      } catch (e) {
        setError(`Erreur d'un bot : ${(e as Error).message}`);
        setPaused(true);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [engine, version, paused, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  const humans = engine.players.filter((p) => !p.isBot);
  const multiHuman = humans.length > 1;
  const spectator = humans.length === 0;
  const [confirmed, setConfirmed] = useState<number | null>(multiHuman ? null : (humans[0]?.id ?? null));
  const ownerIsHuman = !!owner && !owner.isBot;
  const needsHandover = multiHuman && ownerIsHuman && confirmed !== owner!.id;
  useEffect(() => {
    if (multiHuman && (!owner || owner.isBot)) setConfirmed(null);
  }, [multiHuman, owner]);
  const viewerId = multiHuman ? (ownerIsHuman && !needsHandover ? owner!.id : null) : (humans[0]?.id ?? null);
  const view = buildKLView(engine, viewerId, spectator);
  void version;

  const send = useCallback(
    (cmd: KLCommand) => {
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
      <KLBoard view={view} send={send} error={error} settings={settings} onSettings={onSettings} onQuit={onQuit} controls={{ speed, setSpeed, paused, setPaused }} hideHand={viewerId === null} />
      {d.kind === 'challenge' && (
        <KLChallenge
          key={d.challenge.seed}
          view={buildKLView(engine, multiHuman ? null : viewerId, spectator)}
          challenge={d.challenge}
          localHumans={d.challenge.participants.filter((id) => !engine.player(id).isBot)}
          onComplete={(states) => engine.submitChallenge(states)}
        />
      )}
      {needsHandover && owner && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/95 p-4">
          <div className="panel animate-pop max-w-md p-8 text-center">
            <div className="mx-auto w-fit">
              <AvatarPortrait skin={owner.skin} team={owner.color} size={90} />
            </div>
            <h2 className="mt-3 font-display text-3xl" style={{ color: owner.color }}>Au tour de {owner.name}</h2>
            <p className="mt-2 text-slate-300">Passez l'appareil à {owner.name}. Les autres, détournez les yeux : votes et objets sont secrets !</p>
            <button className="btn-primary mt-6 text-lg" onClick={() => setConfirmed(owner.id)}>Je suis {owner.name}</button>
          </div>
        </div>
      )}
    </>
  );
}
