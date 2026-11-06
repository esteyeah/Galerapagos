import { useEffect, useMemo, useRef } from 'react';
import { CHALLENGES, REWARDS, finalScore, type ChallengeInfo, type ChallengeState, type KLPlayerView, type TeamState } from '../../engine/kohlanta';
import { createChallengeScene, type ChallengeScene } from './three/challengeScene';
import { Minigame } from './minigames';
import AvatarPortrait from './AvatarPortrait';
import type { StageStep } from './useChallengeRunner';

interface Props {
  challenge: ChallengeInfo;
  players: KLPlayerView[];
  teams: TeamState[];
  viewerId: number | null;
  step: StageStep;
  elapsed: number;
  countdown: number;
  states: Record<number, ChallengeState>;
  statesRef?: React.MutableRefObject<Record<number, ChallengeState>>;
  /** Joueur qui joue sur cet appareil maintenant. */
  currentHuman: number | null;
  onLocalState: (s: ChallengeState) => void;
  onReady?: () => void;
  onFastForward?: () => void;
  onContinue?: () => void;
  timeScale?: number;
  waitingLabel?: string;
}

const KIND_LABEL = { confort: 'Épreuve de confort', immunite: "Épreuve d'immunité", orientation: 'Finale — Course d’orientation', poteaux: 'Finale — Les poteaux' } as const;

export default function ChallengeStage(props: Props) {
  const { challenge, players, teams, viewerId, step, elapsed, countdown, states, currentHuman } = props;
  const def = CHALLENGES[challenge.game];
  const mount = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ChallengeScene | null>(null);
  const liveStates = useRef(states);
  liveStates.current = props.statesRef?.current ?? states;

  const teamColor = (p: KLPlayerView) => (challenge.teamMode ? teams[p.team]?.color : p.color) ?? p.color;
  const participants = useMemo(
    () =>
      challenge.participants.map((id) => {
        const p = players[id];
        return { id, name: p.name, skin: p.skin, teamColor: teamColor(p), isMe: id === (currentHuman ?? viewerId) };
      }),
    [challenge.seed, currentHuman], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (!mount.current) return;
    let scene: ChallengeScene | null = null;
    try {
      scene = createChallengeScene(mount.current, challenge.game, participants);
    } catch {
      scene = null; // WebGL indisponible : on garde l'affichage 2D
    }
    sceneRef.current = scene;
    scene?.world.onFrame(() => scene!.update(liveStates.current));
    return () => {
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [challenge.seed, participants]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranking = [...challenge.participants].sort((a, b) => finalScore(def, states[b] ?? { progress: 0, done: false, fallen: false, time: 0, score: 0 }) - finalScore(def, states[a] ?? { progress: 0, done: false, fallen: false, time: 0, score: 0 }));
  const me = currentHuman !== null ? players[currentHuman] : null;
  const myState = currentHuman !== null ? states[currentHuman] : undefined;
  const playing = step === 'playing' && me && !(myState?.done || myState?.fallen);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950">
      <div ref={mount} className="absolute inset-0" />
      {/* Bandeau titre */}
      <div className="pointer-events-none relative z-10 flex flex-wrap items-start justify-between gap-2 p-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="rounded-2xl bg-slate-950/75 px-4 py-2 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-200/80">{KIND_LABEL[challenge.kind]}{challenge.teamMode ? ' · par équipes' : ''}</div>
          <div className="font-display text-2xl text-amber-300">
            {def.emoji} {def.name}
          </div>
          {challenge.reward && (
            <div className="text-sm text-slate-200">
              À gagner : {REWARDS[challenge.reward].emoji} {REWARDS[challenge.reward].label}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-slate-950/75 px-4 py-2 text-right font-display text-2xl tabular-nums text-white backdrop-blur">
          ⏱ {Math.max(0, def.duration - elapsed).toFixed(0)} s{props.timeScale && props.timeScale > 1 ? <span className="ml-1 text-sm text-cyan-300">×{props.timeScale}</span> : null}
        </div>
      </div>

      {/* Classement en direct */}
      <div className="pointer-events-none absolute right-3 top-24 z-10 hidden max-h-[55vh] w-56 overflow-y-auto rounded-2xl bg-slate-950/70 p-2 backdrop-blur sm:block">
        {ranking.map((id, i) => {
          const p = players[id];
          const s = states[id];
          return (
            <div key={id} className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm ${id === (currentHuman ?? viewerId) ? 'bg-amber-400/20' : ''}`}>
              <span className="w-4 text-right text-xs text-slate-400">{i + 1}</span>
              <AvatarPortrait skin={p.skin} team={teamColor(p)} size={22} dead={s?.fallen} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-xs tabular-nums text-slate-300">{s?.fallen ? '💦' : s?.done ? '🏁' : def.style === 'score' ? s?.score ?? 0 : `${Math.round((s?.progress ?? 0) * 100)}%`}</span>
            </div>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Zone de jeu */}
      <div className="relative z-10 p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-950/85 p-4 shadow-2xl backdrop-blur">
          {step === 'ready' && me && (
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-3">
                <AvatarPortrait skin={me.skin} team={teamColor(me)} size={56} />
                <div className="text-left">
                  <div className="font-display text-2xl">À {me.name} de jouer !</div>
                  <div className="text-sm text-slate-400">{def.description}</div>
                </div>
              </div>
              <p className="text-sm text-amber-100">🎮 {def.controls}</p>
              <button className="btn-primary w-full py-3 text-lg" onClick={props.onReady}>Je suis prêt·e !</button>
            </div>
          )}
          {step === 'countdown' && (
            <div className="text-center">
              <div className="text-sm text-slate-300">{me ? `🎮 ${def.controls}` : def.description}</div>
              <div key={Math.ceil(countdown)} className="animate-pop font-display text-7xl text-amber-300">{Math.ceil(countdown)}</div>
            </div>
          )}
          {step === 'playing' && me && (
            <>
              {playing ? (
                <Minigame game={challenge.game} seed={challenge.seed} forme={me.forme} running onState={props.onLocalState} />
              ) : (
                <div className="space-y-2 text-center">
                  <div className="font-display text-2xl">{myState?.fallen ? '💦 Éliminé·e de l’épreuve' : '🏁 Terminé !'}</div>
                  <p className="text-sm text-slate-400">Les autres continuent…</p>
                  {props.onFastForward && <button className="btn-ghost" onClick={props.onFastForward}>⏩ Accélérer</button>}
                </div>
              )}
            </>
          )}
          {step === 'playing' && !me && (
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-slate-300">{props.waitingLabel ?? '👀 Vous regardez l’épreuve.'}</div>
              {props.onFastForward && <button className="btn-ghost" onClick={props.onFastForward}>⏩ {props.timeScale && props.timeScale > 1 ? 'Vitesse normale' : 'Accélérer'}</button>}
            </div>
          )}
          {step === 'done' && (
            <div className="space-y-3">
              <div className="text-center font-display text-2xl text-amber-300">🏁 Résultats</div>
              <ol className="max-h-48 space-y-1 overflow-y-auto">
                {ranking.map((id, i) => {
                  const p = players[id];
                  const s = states[id];
                  return (
                    <li key={id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${i === 0 ? 'bg-amber-400/20' : 'bg-white/5'}`}>
                      <span className="w-5 font-display text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</span>
                      <AvatarPortrait skin={p.skin} team={teamColor(p)} size={26} />
                      <span className="flex-1 truncate">{p.name}</span>
                      {challenge.teamMode && <span className="text-xs" style={{ color: teams[p.team]?.color }}>{teams[p.team]?.name}</span>}
                      <span className="text-xs tabular-nums text-slate-300">
                        {def.style === 'race' ? (s?.done ? `${s.time.toFixed(1)} s` : `${Math.round((s?.progress ?? 0) * 100)} %`) : def.style === 'score' ? `${s?.score ?? 0} pts` : s?.fallen ? `${(s.time ?? 0).toFixed(0)} s` : 'Jusqu’au bout'}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {props.onContinue ? <button className="btn-primary w-full py-3" onClick={props.onContinue}>Continuer →</button> : <p className="text-center text-sm text-slate-400">En attente de l’hôte…</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
